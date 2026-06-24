import { execSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { getSettings } from './config'

export interface LockfileInfo {
  processName: string
  pid: number
  port: number
  password: string
  protocol: string
  path: string
  authToken: string
}

const DRIVE_LETTERS = ['C', 'D', 'E', 'F', 'G', 'H']

const COMMON_LOCKFILE_PATHS = [
  // 国际服
  'C:\\Riot Games\\League of Legends\\lockfile',
  'D:\\Riot Games\\League of Legends\\lockfile',
  'E:\\Riot Games\\League of Legends\\lockfile',
  'F:\\Riot Games\\League of Legends\\lockfile',
  // 国服 WeGame（最常见）
  'C:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  'D:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  'E:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  'F:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  // 国服其他路径
  'C:\\腾讯游戏\\英雄联盟\\LeagueClient\\lockfile',
  'D:\\腾讯游戏\\英雄联盟\\LeagueClient\\lockfile',
  'E:\\腾讯游戏\\英雄联盟\\LeagueClient\\lockfile',
  'F:\\腾讯游戏\\英雄联盟\\LeagueClient\\lockfile',
  'C:\\WeGame\\英雄联盟\\LeagueClient\\lockfile',
  'D:\\WeGame\\英雄联盟\\LeagueClient\\lockfile',
  'C:\\Program Files\\腾讯游戏\\英雄联盟\\LeagueClient\\lockfile',
  'D:\\Program Files\\腾讯游戏\\英雄联盟\\LeagueClient\\lockfile',
  'C:\\Program Files (x86)\\腾讯游戏\\英雄联盟\\LeagueClient\\lockfile',
  'D:\\Program Files (x86)\\腾讯游戏\\英雄联盟\\LeagueClient\\lockfile'
]

function parseLockfile(content: string, path: string): LockfileInfo | null {
  const trimmed = content.trim()
  if (!trimmed.includes(':')) return null

  const [processName, pid, port, password, protocol] = trimmed.split(':')
  if (!port || !password) return null

  return {
    processName,
    pid: Number(pid),
    port: Number(port),
    password,
    protocol: protocol || 'https',
    path,
    authToken: Buffer.from(`riot:${password}`).toString('base64')
  }
}

function tryReadLockfile(path: string): LockfileInfo | null {
  if (!existsSync(path)) return null
  try {
    const content = readFileSync(path, 'utf-8')
    return parseLockfile(content, path)
  } catch {
    return null
  }
}

/** 扫描 WeGameApps 目录，自动发现 LeagueClient 安装路径 */
function discoverWeGameLeagueClientDirs(): string[] {
  const dirs: string[] = []

  for (const drive of DRIVE_LETTERS) {
    const wegameApps = `${drive}:\\WeGameApps`
    if (!existsSync(wegameApps)) continue

    try {
      for (const entry of readdirSync(wegameApps)) {
        const leagueClient = join(wegameApps, entry, 'LeagueClient')
        if (existsSync(join(leagueClient, 'LeagueClientUx.exe'))) {
          dirs.push(leagueClient)
        }
      }
    } catch {
      continue
    }
  }

  return dirs
}

/** 从日志文件解析 LCU 端口和认证 token（国服 WeGame lockfile 为空时的 fallback） */
function parseCredentialsFromLog(content: string): { port: number; password: string } | null {
  const tokenMatch = content.match(/--remoting-auth-token=([\w_-]+)/)
  const portMatch = content.match(/--app-port=(\d+)/)
  if (!tokenMatch || !portMatch) return null

  const port = Number(portMatch[1])
  if (!Number.isFinite(port) || port <= 0) return null

  return { port, password: tokenMatch[1] }
}

function findFromLogs(leagueClientDir: string): LockfileInfo | null {
  const logCandidates: Array<{ path: string; mtime: number }> = []

  const collectLogs = (dir: string): void => {
    if (!existsSync(dir)) return
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith('.log')) continue
        const fullPath = join(dir, file)
        try {
          const stat = statSync(fullPath)
          if (stat.size < 200) continue
          logCandidates.push({ path: fullPath, mtime: stat.mtimeMs })
        } catch {
          continue
        }
      }
    } catch {
      // ignore
    }
  }

  collectLogs(leagueClientDir)
  collectLogs(join(leagueClientDir, '..', 'Game', 'Logs', 'LeagueClient Logs'))

  logCandidates.sort((a, b) => b.mtime - a.mtime)

  for (const { path } of logCandidates.slice(0, 8)) {
    try {
      const content = readFileSync(path, 'utf-8')
      const creds = parseCredentialsFromLog(content)
      if (!creds) continue

      return {
        processName: 'LeagueClientUx',
        pid: 0,
        port: creds.port,
        password: creds.password,
        protocol: 'https',
        path: join(leagueClientDir, 'lockfile'),
        authToken: Buffer.from(`riot:${creds.password}`).toString('base64')
      }
    } catch {
      continue
    }
  }

  return null
}

function findFromProcess(): LockfileInfo | null {
  if (process.platform !== 'win32') return null

  const commands = [
    'wmic PROCESS WHERE "name=\'LeagueClientUx.exe\'" GET commandline /VALUE',
    'powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\"Name=\'LeagueClientUx.exe\'\\").CommandLine"'
  ]

  for (const cmd of commands) {
    try {
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000, windowsHide: true })
      const creds = parseCredentialsFromLog(output)
      if (!creds) continue

      return {
        processName: 'LeagueClientUx',
        pid: 0,
        port: creds.port,
        password: creds.password,
        protocol: 'https',
        path: 'process',
        authToken: Buffer.from(`riot:${creds.password}`).toString('base64')
      }
    } catch {
      continue
    }
  }

  return null
}

export function findLockfile(): LockfileInfo | null {
  const candidates: string[] = []
  const leagueClientDirs: string[] = []

  const customPath = getSettings().lolInstallPath
  if (customPath) {
    candidates.push(join(customPath, 'lockfile'))
    candidates.push(
      customPath.endsWith('lockfile')
        ? customPath
        : join(customPath, 'League of Legends', 'lockfile')
    )
    candidates.push(
      customPath.endsWith('LeagueClient')
        ? join(customPath, 'lockfile')
        : join(customPath, 'LeagueClient', 'lockfile')
    )
    if (customPath.endsWith('LeagueClient')) {
      leagueClientDirs.push(customPath)
    }
  }

  candidates.push(...COMMON_LOCKFILE_PATHS)
  leagueClientDirs.push(...discoverWeGameLeagueClientDirs())

  // 去重
  const seenPaths = new Set<string>()
  for (const path of candidates) {
    if (seenPaths.has(path)) continue
    seenPaths.add(path)

    const info = tryReadLockfile(path)
    if (info) return info
  }

  const seenDirs = new Set<string>()
  for (const dir of leagueClientDirs) {
    if (seenDirs.has(dir)) continue
    seenDirs.add(dir)

    const info = findFromLogs(dir)
    if (info) return info
  }

  return findFromProcess()
}
