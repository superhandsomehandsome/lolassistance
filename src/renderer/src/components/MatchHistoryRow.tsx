import { useState } from 'react'
import { ChevronDown, Swords, Eye } from 'lucide-react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import { formatCsPerMin, formatKdaRatio, getSpellImageId } from '../../../shared/match-labels'
import type { MatchDetail, MatchParticipantDetail, MatchSummary, MatchTeamDetail } from '../../../shared/types'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import {
  championIconUrl,
  formatDuration,
  formatKda,
  formatRelativeTime,
  itemIconUrl,
  spellIconUrl
} from '@/lib/ddragon'
import { cn } from '@/lib/utils'

interface MatchHistoryRowProps {
  match: MatchSummary
}

function formatGold(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`
  return String(value)
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function ItemSlot({ itemId }: { itemId: number; matchId?: string; index?: number }): React.JSX.Element {
  if (!itemId) {
    return <div className="h-6 w-6 rounded border border-border/30 bg-black/40" />
  }
  return (
    <img
      src={itemIconUrl(itemId)}
      alt=""
      className="h-6 w-6 rounded border border-border/20"
      onError={(e) => {
        const el = e.target as HTMLImageElement
        el.style.display = 'none'
        const placeholder = document.createElement('div')
        placeholder.className = 'h-6 w-6 rounded border border-border/30 bg-black/40'
        el.parentElement?.replaceChild(placeholder, el)
      }}
    />
  )
}

function ScoreboardHeader({
  team,
  teamIndex,
  isWinnerTeam
}: {
  team: MatchTeamDetail
  teamIndex: number
  isWinnerTeam: boolean
}): React.JSX.Element {
  const teamColor = teamIndex === 0 ? 'text-blue-400' : 'text-red-400'
  const borderColor = teamIndex === 0 ? 'border-blue-500/30' : 'border-red-500/30'

  return (
    <div className={cn('flex items-center justify-between border-b px-3 py-2', borderColor)}>
      <div className="flex items-center gap-3">
        <span className={cn('text-sm font-bold', teamColor)}>
          队伍{teamIndex + 1}
        </span>
        {isWinnerTeam && (
          <Badge variant="default" className="h-5 text-[10px]">胜</Badge>
        )}
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{team.totalKills}</span>
          {' / '}
          <span className="font-semibold text-foreground">{team.totalDeaths}</span>
          {' / '}
          <span className="font-semibold text-foreground">{team.totalAssists}</span>
        </span>
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {team.totalGold.toLocaleString()}
        </span>
        <Swords className="h-3.5 w-3.5" />
        <Eye className="h-3.5 w-3.5" />
      </div>
    </div>
  )
}

function ScoreboardColumnHeader({ teamIndex: _teamIndex }: { teamIndex: number }): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 px-2 py-1 text-[10px] text-muted-foreground/60">
      <div className="w-[30px]" />
      <div className="w-8" />
      <div className="min-w-0 flex-1" />
      <div className="flex w-[52px] justify-center gap-0.5">
        <div className="w-6 text-center">D</div>
        <div className="w-6 text-center">F</div>
      </div>
      <div className="flex w-[182px] justify-center">装备</div>
      <div className="w-[90px] text-center">KDA</div>
      <div className="w-[56px] text-right">金币</div>
    </div>
  )
}

function ScoreboardPlayerRow({
  participant,
  highlight,
  matchId,
  teamIndex
}: {
  participant: MatchParticipantDetail
  highlight: boolean
  matchId: string
  teamIndex: number
}): React.JSX.Element {
  const teamAccent = teamIndex === 0 ? 'bg-blue-500/5' : 'bg-red-500/5'
  const highlightBg = teamIndex === 0 ? 'bg-blue-500/15 ring-1 ring-blue-500/30' : 'bg-red-500/15 ring-1 ring-red-500/30'
  const spell1 = getSpellImageId(participant.spell1Id)
  const spell2 = getSpellImageId(participant.spell2Id)
  const kdaColor =
    participant.deaths === 0
      ? 'text-amber-400'
      : (participant.kills + participant.assists) / participant.deaths >= 3
        ? 'text-emerald-400'
        : ''

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded px-2 py-1 text-sm transition-colors',
        highlight ? highlightBg : teamAccent
      )}
    >
      {/* Level + Champion icon */}
      <div className="relative w-[30px]">
        <div className="absolute -left-0.5 top-0 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 text-[9px] font-bold text-white ring-1 ring-gray-700">
          {participant.champLevel}
        </div>
        <img
          src={championIconUrl(participant.championImageId ?? participant.championName)}
          alt={participant.championName}
          className="ml-1 h-7 w-7 rounded-full"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      </div>

      {/* Summoner name */}
      <div className="w-8" />
      <div className="min-w-0 flex-1 truncate text-xs font-medium">
        {participant.summonerName}
      </div>

      {/* Summoner spells */}
      <div className="flex w-[52px] justify-center gap-0.5">
        {spell1 ? (
          <img src={spellIconUrl(spell1)} alt="" className="h-5 w-5 rounded" />
        ) : (
          <div className="h-5 w-5 rounded bg-black/40" />
        )}
        {spell2 ? (
          <img src={spellIconUrl(spell2)} alt="" className="h-5 w-5 rounded" />
        ) : (
          <div className="h-5 w-5 rounded bg-black/40" />
        )}
      </div>

      {/* Items (6 + trinket) */}
      <div className="flex w-[182px] justify-center gap-0.5">
        {(participant.items ?? []).slice(0, 7).map((itemId, i) => (
          <ItemSlot
            key={`${matchId}-p${participant.participantId}-item${i}`}
            itemId={itemId}
            matchId={matchId}
            index={i}
          />
        ))}
        {/* Pad to 7 slots if fewer items */}
        {Array.from({ length: Math.max(0, 7 - (participant.items?.length ?? 0)) }).map((_, i) => (
          <div key={`${matchId}-p${participant.participantId}-empty${i}`} className="h-6 w-6 rounded border border-border/30 bg-black/40" />
        ))}
      </div>

      {/* KDA */}
      <div className={cn('w-[90px] text-center text-xs font-semibold tabular-nums', kdaColor)}>
        {participant.kills} / {participant.deaths} / {participant.assists}
      </div>

      {/* Gold */}
      <div className="w-[56px] text-right text-xs tabular-nums text-muted-foreground">
        {participant.goldEarned.toLocaleString()}
      </div>
    </div>
  )
}

function DamageBar({
  participant,
  maxDamage,
  teamIndex
}: {
  participant: MatchParticipantDetail
  maxDamage: number
  teamIndex: number
}): React.JSX.Element {
  const pct = maxDamage > 0 ? (participant.damage / maxDamage) * 100 : 0
  const barColor = teamIndex === 0 ? 'bg-blue-500' : 'bg-red-500'

  return (
    <div className="flex items-center gap-2">
      <img
        src={championIconUrl(participant.championImageId ?? participant.championName)}
        alt=""
        className="h-6 w-6 rounded-full"
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
        }}
      />
      <div className="flex-1">
        <div className="h-4 overflow-hidden rounded bg-black/30">
          <div className={cn('h-full rounded transition-all', barColor)} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="w-14 text-right text-xs tabular-nums text-muted-foreground">
        {participant.damage.toLocaleString()}
      </span>
    </div>
  )
}

type DetailTab = 'scoreboard' | 'damage'

export function MatchHistoryRow({ match }: MatchHistoryRowProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('scoreboard')

  const kdaRatio = formatKdaRatio(match.kills, match.deaths, match.assists)
  const csPerMin = formatCsPerMin(match.cs, match.gameDuration)
  const spell1 = getSpellImageId(match.spell1Id)
  const spell2 = getSpellImageId(match.spell2Id)

  const handleOpenChange = (next: boolean): void => {
    setOpen(next)
    if (!next || detail || !match.gameId) return

    setLoadingDetail(true)
    setDetailError(null)
    void window.api
      .invoke(IPC_CHANNELS.MATCH_GET_DETAIL, match.gameId)
      .then((data) => {
        setDetail((data as MatchDetail | null) ?? null)
        if (!data) setDetailError('无法加载对局详情')
      })
      .catch(() => setDetailError('加载对局详情失败'))
      .finally(() => setLoadingDetail(false))
  }

  const team1 = detail?.participants.filter((p) => p.teamId === 100) ?? []
  const team2 = detail?.participants.filter((p) => p.teamId === 200) ?? []
  const teamInfo1 = detail?.teams.find((t) => t.teamId === 100)
  const teamInfo2 = detail?.teams.find((t) => t.teamId === 200)

  const fallbackTeam = (players: MatchParticipantDetail[]): MatchTeamDetail => ({
    teamId: players[0]?.teamId ?? 100,
    win: players[0]?.win ?? false,
    totalKills: players.reduce((a, p) => a + p.kills, 0),
    totalDeaths: players.reduce((a, p) => a + p.deaths, 0),
    totalAssists: players.reduce((a, p) => a + p.assists, 0),
    totalGold: players.reduce((a, p) => a + p.goldEarned, 0)
  })

  const t1 = teamInfo1 ?? fallbackTeam(team1)
  const t2 = teamInfo2 ?? fallbackTeam(team2)

  const maxDamage = detail
    ? Math.max(...detail.participants.map((p) => p.damage))
    : 0

  return (
    <Collapsible open={open} onOpenChange={handleOpenChange}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/40',
            match.win
              ? 'border-emerald-500/30 bg-emerald-500/5'
              : 'border-red-500/30 bg-red-500/5',
            open && 'rounded-b-none border-b-0'
          )}
        >
          {/* Champion icon */}
          <img
            src={championIconUrl(match.championImageId ?? match.championName)}
            alt={match.championName}
            className="h-10 w-10 rounded-full ring-2 ring-background"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />

          {/* Info block */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant={match.win ? 'default' : 'destructive'} className="shrink-0">
                {match.win ? '胜利' : '失败'}
              </Badge>
              <span className="truncate font-medium">{match.championName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {match.queueName ?? '对局'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                KDA{' '}
                <span className="font-medium text-foreground">
                  {formatKda(match.kills, match.deaths, match.assists)}
                </span>
                {' '}
                <span className="text-muted-foreground">({kdaRatio})</span>
              </span>
              <span>{csPerMin} CS/分</span>
              {match.goldEarned !== undefined && (
                <span>{formatGold(match.goldEarned)}</span>
              )}
            </div>
          </div>

          {/* Spells + item preview */}
          <div className="hidden items-center gap-2 sm:flex">
            {spell1 && <img src={spellIconUrl(spell1)} alt="" className="h-6 w-6 rounded" />}
            {spell2 && <img src={spellIconUrl(spell2)} alt="" className="h-6 w-6 rounded" />}
            <div className="ml-1 flex gap-0.5">
              {match.items.slice(0, 3).filter(Boolean).map((itemId, i) => (
                <img
                  key={`${match.matchId}-prev-${i}`}
                  src={itemIconUrl(itemId)}
                  alt=""
                  className="h-6 w-6 rounded"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Duration + time */}
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-muted-foreground">{formatDuration(match.gameDuration)}</span>
            <span className="text-[10px] text-muted-foreground/60">{formatRelativeTime(match.gameCreation)}</span>
          </div>

          <ChevronDown
            className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div
          className={cn(
            'rounded-b-md border border-t-0 bg-card',
            match.win ? 'border-emerald-500/30' : 'border-red-500/30'
          )}
        >
          {/* Match header */}
          {detail && (
            <div className="flex items-center justify-between border-b border-border/30 px-4 py-2">
              <div className="flex items-center gap-2">
                <Badge variant={match.win ? 'default' : 'destructive'} className="text-sm font-bold">
                  {match.win ? '胜利' : '失败'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {detail.mapName && `${detail.mapName} · `}
                  {detail.queueName} · {formatDuration(detail.gameDuration)} · {formatDate(detail.gameCreation)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground/50">
                ID {detail.gameId}
              </span>
            </div>
          )}

          {/* Tab buttons */}
          {detail && !loadingDetail && (
            <div className="flex gap-1 border-b border-border/20 px-4 py-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('scoreboard')}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  activeTab === 'scoreboard'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                计分板
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('damage')}
                className={cn(
                  'rounded px-3 py-1 text-xs font-medium transition-colors',
                  activeTab === 'damage'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                伤害图表
              </button>
            </div>
          )}

          {/* Loading state */}
          {loadingDetail && (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}

          {detailError && (
            <div className="p-4 text-sm text-muted-foreground">{detailError}</div>
          )}

          {/* Scoreboard tab */}
          {detail && !loadingDetail && activeTab === 'scoreboard' && (
            <div>
              {/* Team 1 */}
              {team1.length > 0 && (
                <div>
                  <ScoreboardHeader team={t1} teamIndex={0} isWinnerTeam={t1.win} />
                  <ScoreboardColumnHeader teamIndex={0} />
                  <div className="space-y-px px-1 pb-2">
                    {team1.map((p) => (
                      <ScoreboardPlayerRow
                        key={p.participantId}
                        participant={p}
                        highlight={p.championId === match.championId}
                        matchId={detail.matchId}
                        teamIndex={0}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Team 2 */}
              {team2.length > 0 && (
                <div>
                  <ScoreboardHeader team={t2} teamIndex={1} isWinnerTeam={t2.win} />
                  <ScoreboardColumnHeader teamIndex={1} />
                  <div className="space-y-px px-1 pb-2">
                    {team2.map((p) => (
                      <ScoreboardPlayerRow
                        key={p.participantId}
                        participant={p}
                        highlight={p.championId === match.championId}
                        matchId={detail.matchId}
                        teamIndex={1}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Damage tab */}
          {detail && !loadingDetail && activeTab === 'damage' && (
            <div className="space-y-4 p-4">
              <div className="text-xs font-medium text-muted-foreground">对英雄造成的总伤害</div>

              {/* Team 1 damage */}
              {team1.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold text-blue-400">队伍1</div>
                  {team1.map((p) => (
                    <DamageBar
                      key={p.participantId}
                      participant={p}
                      maxDamage={maxDamage}
                      teamIndex={0}
                    />
                  ))}
                </div>
              )}

              {/* Team 2 damage */}
              {team2.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold text-red-400">队伍2</div>
                  {team2.map((p) => (
                    <DamageBar
                      key={p.participantId}
                      participant={p}
                      maxDamage={maxDamage}
                      teamIndex={1}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {!match.gameId && (
            <div className="p-4 text-xs text-muted-foreground">该对局暂无详情数据</div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
