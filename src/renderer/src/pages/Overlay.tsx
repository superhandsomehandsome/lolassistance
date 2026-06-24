import { useCallback, useEffect, useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { MatchSummary, TeamData } from '../../../shared/types'
import { championIconUrl, formatKda } from '@/lib/ddragon'
import { cn } from '@/lib/utils'

interface OverlayPlayer {
  riotId: string
  championName: string
  isAlly: boolean
  matches: MatchSummary[]
  loading: boolean
}

function MiniPlayerRow({ player }: { player: OverlayPlayer }): React.JSX.Element {
  const wins = player.matches.filter((m) => m.win).length
  const total = player.matches.length
  const wrPct = total > 0 ? Math.round((wins / total) * 100) : 0
  const totalK = player.matches.reduce((s, m) => s + m.kills, 0)
  const totalD = player.matches.reduce((s, m) => s + m.deaths, 0)
  const totalA = player.matches.reduce((s, m) => s + m.assists, 0)
  const avgKda = total > 0
    ? formatKda(Math.round(totalK / total), Math.round(totalD / total), Math.round(totalA / total))
    : '-'

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <img
        src={championIconUrl(player.championName)}
        alt=""
        className="h-6 w-6 rounded-full"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <span className="w-24 truncate text-xs font-medium">{player.riotId}</span>
      {player.loading ? (
        <span className="text-[10px] text-muted-foreground">...</span>
      ) : (
        <>
          <div className="flex gap-0.5">
            {player.matches.slice(0, 10).map((m, i) => (
              <div
                key={i}
                className={cn('h-2 w-2 rounded-full', m.win ? 'bg-emerald-500' : 'bg-red-500')}
              />
            ))}
          </div>
          <span className={cn('text-[10px] font-semibold tabular-nums', wrPct >= 50 ? 'text-emerald-400' : 'text-red-400')}>
            {total > 0 ? `${wrPct}%` : '-'}
          </span>
          <span className="text-[10px] text-muted-foreground">{avgKda}</span>
        </>
      )}
    </div>
  )
}

export function Overlay(): React.JSX.Element {
  const [players, setPlayers] = useState<OverlayPlayer[]>([])
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const unsubs = [
      window.api.on(IPC_CHANNELS.TEAM_DATA_UPDATE, (data) => {
        const td = data as TeamData
        const all: OverlayPlayer[] = [
          ...td.allies.map((p) => ({
            riotId: p.riotId,
            championName: p.championName ?? '',
            isAlly: true,
            matches: p.matches,
            loading: p.loading ?? false
          })),
          ...td.enemies.map((p) => ({
            riotId: p.riotId,
            championName: p.championName ?? '',
            isAlly: false,
            matches: p.matches,
            loading: p.loading ?? false
          }))
        ]
        setPlayers(all)
      }),
      window.api.on(IPC_CHANNELS.GAME_LIVE_PLAYERS, () => {
        // live players arrive separately; team data update handles the merge
      })
    ]

    void window.api.invoke(IPC_CHANNELS.MATCH_TEAM_PLAYERS).then((data) => {
      if (!data) return
      const td = data as TeamData
      const all: OverlayPlayer[] = [
        ...td.allies.map((p) => ({
          riotId: p.riotId,
          championName: p.championName ?? '',
          isAlly: true,
          matches: p.matches,
          loading: p.loading ?? false
        })),
        ...td.enemies.map((p) => ({
          riotId: p.riotId,
          championName: p.championName ?? '',
          isAlly: false,
          matches: p.matches,
          loading: p.loading ?? false
        }))
      ]
      setPlayers(all)
    })

    return () => unsubs.forEach((u) => u())
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'F7') setVisible((v) => !v)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 鼠标进入 overlay 面板时取消点击穿透，离开时恢复穿透
  const handleMouseEnter = useCallback(() => {
    window.api.send('overlay:set-ignore-mouse', false)
  }, [])

  const handleMouseLeave = useCallback(() => {
    window.api.send('overlay:set-ignore-mouse', true)
  }, [])

  const allies = players.filter((p) => p.isAlly)
  const enemies = players.filter((p) => !p.isAlly)

  if (!visible || players.length === 0) {
    return (
      <div className="fixed right-2 top-2 rounded bg-black/60 px-2 py-1 text-[10px] text-white/50 backdrop-blur-sm">
        按 F7 显示 Overlay
      </div>
    )
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="fixed left-0 top-0 select-none rounded-lg border border-white/10 bg-black/80 shadow-2xl backdrop-blur-md"
      style={{ minWidth: 320 }}
    >
      {/* 标题栏：可拖动 */}
      <div
        className="flex items-center justify-between border-b border-white/10 px-3 py-1.5"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="text-xs font-bold text-white/80">LOL 助手</span>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="text-[10px] text-white/40 hover:text-white/80"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        >
          F7 隐藏
        </button>
      </div>

      {allies.length > 0 && (
        <div>
          <div className="bg-blue-500/10 px-3 py-0.5 text-[10px] font-medium text-blue-400">己方</div>
          {allies.map((p) => (
            <MiniPlayerRow key={p.riotId} player={p} />
          ))}
        </div>
      )}

      {enemies.length > 0 && (
        <div>
          <div className="bg-red-500/10 px-3 py-0.5 text-[10px] font-medium text-red-400">敌方</div>
          {enemies.map((p) => (
            <MiniPlayerRow key={p.riotId} player={p} />
          ))}
        </div>
      )}
    </div>
  )
}
