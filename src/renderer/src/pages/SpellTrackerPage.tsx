import { SpellTracker } from '@/components/SpellTracker'
import { StatusBar } from '@/components/StatusBar'
import { useAppStore } from '@/stores/app-store'

export function SpellTrackerPage(): React.JSX.Element {
  const gamePhase = useAppStore((s) => s.gamePhase)
  const livePlayers = useAppStore((s) => s.livePlayers)

  const enemyLivePlayers = livePlayers.filter((p) => !p.isAlly)
  const inGamePhases = ['InProgress', 'GameStart']
  const inGame = inGamePhases.includes(gamePhase)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">技能追踪</h1>
        <p className="text-muted-foreground">
          记录敌方召唤师技能冷却时间，精准掌控对线节奏
        </p>
      </div>

      <StatusBar />

      {!inGame && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          <p className="text-lg">等待进入对局</p>
          <p className="mt-2 text-sm">
            加载界面或游戏开始后，敌方技能追踪将自动激活
          </p>
          <p className="mt-1 text-xs">
            按快捷键记录技能使用时间，稍后点击对应技能按钮分配
          </p>
        </div>
      )}

      {inGame && enemyLivePlayers.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          <p>正在获取敌方玩家数据...</p>
          <p className="mt-1 text-xs">游戏加载完成后将自动显示</p>
        </div>
      )}

      {inGame && enemyLivePlayers.length > 0 && (
        <SpellTracker enemies={enemyLivePlayers} />
      )}
    </div>
  )
}
