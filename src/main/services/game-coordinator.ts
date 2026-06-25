import type { BrowserWindow } from 'electron'
import type { ChampSelectState, GamePhase, LcuStatus, LivePlayer, PlayerWithHistory, TeamData } from '../../shared/types'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import { lcuService } from './lcu'
import { liveClientService } from './live-client'
import { broadcastToOverlay, handlePhaseForOverlay } from './overlay'
import { clearPendingSpells } from './pending-spells'
import { riotApi } from './riot-api'

let mainWindow: BrowserWindow | null = null
let currentTeamData: TeamData = {
  allies: [],
  enemies: [],
  phase: 'None',
  updatedAt: Date.now()
}
let liveRetryTimer: NodeJS.Timeout | null = null

export function setMainWindow(win: BrowserWindow): void {
  mainWindow = win
}

function broadcast(channel: string, payload: unknown): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

function broadcastStatus(): void {
  const status: LcuStatus = lcuService.getStatus()
  broadcast(IPC_CHANNELS.LCU_STATUS, status)
}

function broadcastTeamData(): void {
  broadcast(IPC_CHANNELS.TEAM_DATA_UPDATE, currentTeamData)
  broadcastToOverlay(IPC_CHANNELS.TEAM_DATA_UPDATE, currentTeamData)
}

/**
 * 查询单个玩家战绩。
 * 优先使用 LCU 本地接口（国服可用，无需 API Key），
 * 降级到 Riot 外部 API（需 Key，仅外服）。
 */
async function fetchPlayerHistory(
  gameName: string,
  tagLine: string,
  options?: { championId?: number; championName?: string; team?: 'ally' | 'enemy'; quiet?: boolean }
): Promise<PlayerWithHistory> {
  await riotApi.ensureChampionData()
  const riotId = `${gameName}#${tagLine}`
  const pending = (): PlayerWithHistory => ({
    puuid: '',
    gameName,
    tagLine,
    riotId,
    championId: options?.championId,
    championName: options?.championName,
    team: options?.team,
    matches: [],
    loading: true
  })

  // 先尝试 LCU 本地接口
  if (lcuService.isConnected()) {
    try {
      const lookupName = tagLine ? `${gameName}#${tagLine}` : gameName
      const summoner = await lcuService.getSummonerByName(lookupName)

      if (summoner?.puuid) {
        const matches = await lcuService.getMatchHistory(summoner.puuid, 10)
        return {
          puuid: summoner.puuid,
          gameName: summoner.gameName || gameName,
          tagLine: summoner.tagLine || tagLine,
          riotId: `${summoner.gameName || gameName}#${summoner.tagLine || tagLine}`,
          championId: options?.championId,
          championName: options?.championName,
          team: options?.team,
          matches,
          loading: false
        }
      }
    } catch (error) {
      console.warn('[Coordinator] LCU match history failed, trying Riot API', error)
      if (options?.quiet) return pending()
    }
  }

  if (options?.quiet) return pending()

  // 降级到 Riot 外部 API（仅外服有效）
  if (riotApi.isConfigured()) {
    try {
      return await riotApi.getPlayerHistory(gameName, tagLine, options)
    } catch (error) {
      const msg = error instanceof Error ? error.message : ''
      const is404 = msg.includes('404') || msg.includes('not found')
      return {
        puuid: '',
        gameName,
        tagLine,
        riotId,
        championId: options?.championId,
        championName: options?.championName,
        team: options?.team,
        matches: [],
        loading: false,
        error: is404
          ? '在 Riot 国际服务器上未找到该玩家。如果是国服账号，请先启动英雄联盟客户端再搜索'
          : `查询失败：${msg}`
      }
    }
  }

  return {
    puuid: '',
    gameName,
    tagLine,
    riotId,
    championId: options?.championId,
    championName: options?.championName,
    team: options?.team,
    matches: [],
    loading: false,
    error: '请先启动英雄联盟客户端（国服账号必须通过客户端查询）'
  }
}

async function fetchHistories(
  players: Array<{
    gameName: string
    tagLine: string
    championId?: number
    championName?: string
    team?: 'ally' | 'enemy'
  }>,
  quiet = false
): Promise<PlayerWithHistory[]> {
  return Promise.all(
    players.map((p) =>
      fetchPlayerHistory(p.gameName, p.tagLine, {
        championId: p.championId,
        championName: p.championName,
        team: p.team,
        quiet
      })
    )
  )
}

function parseRiotId(riotId: string): { gameName: string; tagLine: string } {
  const hashIndex = riotId.lastIndexOf('#')
  if (hashIndex <= 0) return { gameName: riotId, tagLine: '' }
  return {
    gameName: riotId.slice(0, hashIndex),
    tagLine: riotId.slice(hashIndex + 1)
  }
}

function mapLivePlayers(players: LivePlayer[], isAlly: boolean) {
  return players
    .filter((p) => p.isAlly === isAlly)
    .map((p) => ({
      gameName: p.riotIdGameName,
      tagLine: p.riotIdTagLine,
      championName: p.championName,
      team: isAlly ? 'ally' as const : 'enemy' as const
    }))
}

function scheduleLiveRetry(players: LivePlayer[], attempt: number): void {
  if (liveRetryTimer) clearTimeout(liveRetryTimer)
  if (attempt >= 8) return

  liveRetryTimer = setTimeout(() => {
    void refreshLiveTeamData(players, attempt + 1)
  }, 2500)
}

async function refreshLiveTeamData(players: LivePlayer[], attempt = 0): Promise<void> {
  const allyPlayers = mapLivePlayers(players, true)
  const enemyPlayers = mapLivePlayers(players, false)

  const [allies, enemies] = await Promise.all([
    fetchHistories(allyPlayers, true),
    fetchHistories(enemyPlayers, true)
  ])

  currentTeamData = {
    allies,
    enemies,
    phase: 'InProgress',
    updatedAt: Date.now()
  }
  broadcast(IPC_CHANNELS.GAME_LIVE_PLAYERS, players)
  broadcastToOverlay(IPC_CHANNELS.GAME_LIVE_PLAYERS, players)
  broadcastTeamData()

  if ([...allies, ...enemies].some((p) => p.loading)) {
    scheduleLiveRetry(players, attempt)
  }
}

export function startGameCoordinator(): void {
  lcuService.onPhaseChange((phase: GamePhase) => {
    broadcast(IPC_CHANNELS.LCU_GAME_PHASE, phase)
    broadcastStatus()
    handlePhaseForOverlay(phase)

    currentTeamData = { ...currentTeamData, phase, updatedAt: Date.now() }

    if (phase === 'GameStart' || phase === 'InProgress') {
      liveClientService.start()
    }

    if (phase === 'None' || phase === 'EndOfGame' || phase === 'Lobby') {
      liveClientService.stop()
      clearPendingSpells()
      if (phase === 'None' || phase === 'Lobby') {
        currentTeamData = { allies: [], enemies: [], phase, updatedAt: Date.now() }
        broadcastTeamData()
      }
    }
  })

  lcuService.onStatusUpdate(() => {
    broadcastStatus()
  })

  lcuService.onChampSelectUpdate((state: ChampSelectState) => {
    broadcast(IPC_CHANNELS.CHAMP_SELECT_UPDATE, state)
  })

  lcuService.onAlliesUpdate((allies) => {
    void (async () => {
      const players = allies.map((a) => ({
        gameName: a.gameName,
        tagLine: a.tagLine,
        championId: a.championId,
        championName: riotApi.getChampionName(a.championId),
        team: 'ally' as const
      }))

      const histories = await fetchHistories(players)
      currentTeamData = {
        allies: histories,
        enemies: [],
        phase: 'ChampSelect',
        updatedAt: Date.now()
      }
      broadcastTeamData()
    })()
  })

  liveClientService.onPlayersUpdate((players) => {
    if (liveRetryTimer) clearTimeout(liveRetryTimer)
    void refreshLiveTeamData(players)
  })

  lcuService.start()
  broadcastStatus()
}

export function stopGameCoordinator(): void {
  if (liveRetryTimer) clearTimeout(liveRetryTimer)
  liveRetryTimer = null
  lcuService.stop()
  liveClientService.stop()
}

export function getCurrentTeamData(): TeamData {
  return currentTeamData
}

export async function searchPlayer(riotId: string): Promise<PlayerWithHistory> {
  const trimmed = riotId.trim()
  const { gameName, tagLine } = parseRiotId(trimmed)
  return fetchPlayerHistory(gameName, tagLine)
}

export async function getPlayerHistory(
  gameName: string,
  tagLine: string
): Promise<PlayerWithHistory> {
  return fetchPlayerHistory(gameName, tagLine)
}

export async function getMatchDetail(gameId: number) {
  return lcuService.getMatchDetail(gameId)
}

export { parseRiotId }
