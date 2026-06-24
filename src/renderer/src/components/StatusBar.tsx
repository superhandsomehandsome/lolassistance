import { useAppStore } from '@/stores/app-store'
import { cn } from '@/lib/utils'

const PHASE_LABELS: Record<string, string> = {
  None: '空闲',
  Lobby: '大厅',
  Matchmaking: '匹配中',
  ReadyCheck: '确认对局',
  ChampSelect: '选人阶段',
  GameStart: '加载中',
  InProgress: '游戏中',
  EndOfGame: '游戏结束',
  WaitingForStats: '等待结算',
  Disconnected: '连接断开',
  Unknown: '未知'
}

export function StatusBar(): React.JSX.Element {
  const lcuStatus = useAppStore((s) => s.lcuStatus)
  const gamePhase = useAppStore((s) => s.gamePhase)

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-2 text-sm">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            lcuStatus.connected ? 'bg-emerald-500' : 'bg-muted-foreground/40'
          )}
        />
        <span className="text-muted-foreground">
          {lcuStatus.connected ? '客户端已连接' : '请启动英雄联盟客户端'}
        </span>
      </div>
      {lcuStatus.connected && (
        <>
          <div className="text-muted-foreground">|</div>
          <div>
            状态：
            <span className="ml-1 font-medium text-foreground">
              {PHASE_LABELS[gamePhase] ?? gamePhase}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
