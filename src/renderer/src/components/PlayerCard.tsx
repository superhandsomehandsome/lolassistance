import { useState } from 'react'
import { ChevronDown, Copy } from 'lucide-react'
import type { PlayerWithHistory } from '../../../shared/types'
import { MatchHistoryRow } from '@/components/MatchHistoryRow'
import { PlayerTrend } from '@/components/PlayerTrend'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  championIconUrl,
  formatKda,
  formatWinRate
} from '@/lib/ddragon'
import { cn } from '@/lib/utils'

interface PlayerCardProps {
  player: PlayerWithHistory
  teamColor?: 'blue' | 'red'
}

export function PlayerCard({ player, teamColor }: PlayerCardProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [queueFilter, setQueueFilter] = useState<string>('全部')

  const totalKills = player.matches.reduce((s, m) => s + m.kills, 0)
  const totalDeaths = player.matches.reduce((s, m) => s + m.deaths, 0)
  const totalAssists = player.matches.reduce((s, m) => s + m.assists, 0)
  const avgKda =
    player.matches.length > 0
      ? formatKda(
          Math.round(totalKills / player.matches.length),
          Math.round(totalDeaths / player.matches.length),
          Math.round(totalAssists / player.matches.length)
        )
      : '-'

  // 提取该玩家出现过的游戏模式，用于筛选
  const queueOptions = ['全部', ...Array.from(
    new Set(player.matches.map((m) => m.queueName).filter((n): n is string => Boolean(n)))
  )]
  const filteredMatches = queueFilter === '全部'
    ? player.matches
    : player.matches.filter((m) => m.queueName === queueFilter)

  const borderClass =
    teamColor === 'blue'
      ? 'border-blue-500/30'
      : teamColor === 'red'
        ? 'border-red-500/30'
        : 'border-border'

  const accentClass =
    teamColor === 'blue'
      ? 'bg-blue-500/5'
      : teamColor === 'red'
        ? 'bg-red-500/5'
        : 'bg-card'

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent/50',
            borderClass,
            accentClass,
            open && 'rounded-b-none border-b-0'
          )}
        >
          {player.championName ? (
            <img
              src={championIconUrl(player.championName)}
              alt=""
              className="h-10 w-10 rounded-full"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-xs">
              ?
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {player.championName && (
                <span className="shrink-0 text-sm font-semibold">{player.championName}</span>
              )}
              <span
                className="truncate text-sm text-muted-foreground select-text"
                title={player.riotId}
                onClick={(e) => e.stopPropagation()}
              >
                {player.riotId}
              </span>
              <button
                type="button"
                title="复制 ID"
                onClick={(e) => {
                  e.stopPropagation()
                  void navigator.clipboard.writeText(player.riotId)
                }}
                className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
              >
                <Copy className="h-3 w-3" />
              </button>
            </div>
            {player.error && <div className="text-xs text-red-400">{player.error}</div>}
          </div>

          {player.loading ? (
            <Skeleton className="h-4 w-24" />
          ) : (
            <div className="flex items-center gap-1">
              {player.matches.map((m, i) => (
                <div
                  key={`${player.riotId}-dot-${i}`}
                  className={cn('h-2.5 w-2.5 rounded-full', m.win ? 'bg-emerald-500' : 'bg-red-500')}
                />
              ))}
              {player.matches.length === 0 && (
                <span className="text-xs text-muted-foreground">暂无数据</span>
              )}
            </div>
          )}

          <div className="w-20 text-center text-sm text-muted-foreground">
            {player.loading ? <Skeleton className="mx-auto h-4 w-12" /> : formatWinRate(player.matches)}
          </div>

          <div className="w-16 text-center text-sm">{player.loading ? '-' : avgKda}</div>

          <ChevronDown
            className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className={cn('space-y-3 rounded-b-lg border border-t-0 px-4 py-3', borderClass, accentClass)}>
          {player.loading && (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          )}
          {!player.loading && player.matches.length > 0 && (
            <PlayerTrend matches={filteredMatches} />
          )}
          {!player.loading && player.matches.length > 0 && queueOptions.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {queueOptions.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQueueFilter(q)}
                  className={cn(
                    'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                    queueFilter === q
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          {!player.loading &&
            filteredMatches.map((match) => <MatchHistoryRow key={match.matchId} match={match} />)}
          {!player.loading && filteredMatches.length === 0 && !player.error && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              {player.matches.length > 0 ? '该模式下暂无对局' : '暂无对局记录'}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
