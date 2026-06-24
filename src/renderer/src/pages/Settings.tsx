import { useCallback, useEffect, useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { StatusBar } from '@/components/StatusBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'

interface SettingsData {
  lolInstallPath?: string
  riotApiConfigured: boolean
  spellHotkey?: string
}

function keyEventToAccelerator(e: KeyboardEvent): string | null {
  const key = e.key
  if (key === 'Escape' || key === 'Unidentified') return null

  if (/^F\d{1,2}$/.test(key)) return key
  if (key === ' ') return 'Space'
  if (key.length === 1) return key.toUpperCase()

  const map: Record<string, string> = {
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Enter: 'Return',
    Tab: 'Tab',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Insert: 'Insert'
  }
  if (map[key]) return map[key]
  return null
}

export function Settings(): React.JSX.Element {
  const [pingResult, setPingResult] = useState('未测试')
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<SettingsData | null>(null)
  const [lolPath, setLolPath] = useState('')
  const [saving, setSaving] = useState(false)
  const lcuStatus = useAppStore((s) => s.lcuStatus)

  const [currentHotkey, setCurrentHotkey] = useState('F6')
  const [listening, setListening] = useState(false)
  const [hotkeyError, setHotkeyError] = useState<string | null>(null)

  const handlePing = async (): Promise<void> => {
    setLoading(true)
    try {
      const result = await window.api.invoke(IPC_CHANNELS.PING)
      setPingResult(String(result))
    } catch (error) {
      setPingResult(error instanceof Error ? error.message : 'IPC 调用失败')
    } finally {
      setLoading(false)
    }
  }

  const loadSettings = async (): Promise<void> => {
    const data = (await window.api.invoke(IPC_CHANNELS.SETTINGS_GET)) as SettingsData
    setSettings(data)
    setLolPath(data.lolInstallPath ?? '')
    setCurrentHotkey(data.spellHotkey ?? 'F6')
  }

  const saveLolPath = async (): Promise<void> => {
    setSaving(true)
    try {
      await window.api.invoke(IPC_CHANNELS.SETTINGS_SET_LOL_PATH, lolPath)
      await loadSettings()
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!listening) return
      e.preventDefault()
      e.stopPropagation()

      if (e.key === 'Escape') {
        setListening(false)
        return
      }

      const accel = keyEventToAccelerator(e)
      if (!accel) return

      setListening(false)
      setHotkeyError(null)

      void (async () => {
        const result = (await window.api.invoke(
          IPC_CHANNELS.SETTINGS_SET_HOTKEY,
          accel
        )) as { success: boolean; hotkey: string }
        if (result.success) {
          setCurrentHotkey(result.hotkey)
          setHotkeyError(null)
        } else {
          setHotkeyError(`无法注册快捷键「${accel}」，可能已被占用`)
        }
      })()
    },
    [listening]
  )

  useEffect(() => {
    if (listening) {
      window.addEventListener('keydown', handleKeyDown, true)
      return () => window.removeEventListener('keydown', handleKeyDown, true)
    }
    return undefined
  }, [listening, handleKeyDown])

  useEffect(() => {
    void handlePing()
    void loadSettings()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground">应用配置与系统状态</p>
      </div>

      <StatusBar />

      <div className="max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-medium">技能记录快捷键</h2>
        <p className="text-sm text-muted-foreground">
          在对局中按此键记录敌方技能使用时间，之后分配给对应英雄
        </p>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 min-w-[80px] items-center justify-center rounded-md border px-4 text-sm font-semibold',
              listening
                ? 'animate-pulse border-primary bg-primary/10 text-primary'
                : 'border-border bg-muted'
            )}
          >
            {listening ? '按下按键...' : currentHotkey}
          </div>
          <Button
            size="sm"
            variant={listening ? 'destructive' : 'outline'}
            onClick={() => setListening(!listening)}
          >
            {listening ? '取消' : '修改快捷键'}
          </Button>
        </div>
        {hotkeyError && <p className="text-xs text-red-400">{hotkeyError}</p>}
        <p className="text-xs text-muted-foreground">
          点击「修改快捷键」后按下想要绑定的键。按 Esc 取消
        </p>
      </div>

      <div className="max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-medium">LCU 连接状态</h2>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>连接：{lcuStatus.connected ? '已连接' : '未连接'}</p>
          <p>游戏阶段：{lcuStatus.gamePhase}</p>
          {lcuStatus.lockfilePath && <p className="truncate">Lockfile：{lcuStatus.lockfilePath}</p>}
        </div>
      </div>

      <div className="max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-medium">英雄联盟安装路径</h2>
        <p className="text-sm text-muted-foreground">
          留空则自动检测常见路径（C:\Riot Games\League of Legends）
        </p>
        <Input
          placeholder="例：C:\Riot Games\League of Legends"
          value={lolPath}
          onChange={(e) => setLolPath(e.target.value)}
        />
        <Button size="sm" onClick={() => void saveLolPath()} disabled={saving}>
          {saving ? '保存中...' : '保存路径'}
        </Button>
      </div>

      <div className="max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-medium">Riot API</h2>
        <p className="text-sm text-muted-foreground">
          国服查战绩无需 API Key；外服可在 exe 同目录放置 .env 文件配置
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`h-2 w-2 rounded-full ${settings?.riotApiConfigured ? 'bg-emerald-500' : 'bg-red-500'}`}
          />
          {settings?.riotApiConfigured ? 'API Key 已配置' : 'API Key 未配置（国服无需配置）'}
        </div>
      </div>

      <div className="max-w-lg space-y-4 rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-medium">IPC 通信测试</h2>
        <div className="flex items-center gap-3">
          <Button onClick={() => void handlePing()} disabled={loading} size="sm">
            {loading ? '测试中...' : '重新测试'}
          </Button>
          <code className="rounded bg-muted px-2 py-1 text-sm">ping → {pingResult}</code>
        </div>
      </div>
    </div>
  )
}
