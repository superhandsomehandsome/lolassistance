import { useCallback, useEffect, useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type {
  ChampionDataResponse,
  ChampSelectState,
  ItemBuildInfo,
  Lane,
  MatchupInfo,
  RankBracket
} from '../../../shared/types'
import { RANK_BRACKET_OPTIONS } from '../../../shared/types'
import { BuildRecommend } from '@/components/BuildRecommend'
import { StatusBar } from '@/components/StatusBar'
import { championIconUrl, lolalyticsItemIconUrl, runeIconUrl, statModIconUrl } from '@/lib/ddragon'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/app-store'

const LANE_OPTIONS: Array<{ id: Lane; label: string }> = [
  { id: 'top', label: '上单' },
  { id: 'jungle', label: '打野' },
  { id: 'middle', label: '中单' },
  { id: 'bottom', label: 'ADC' },
  { id: 'support', label: '辅助' }
]

function WinRateBar({ wr }: { wr: number }): React.JSX.Element {
  const color = wr >= 55 ? 'bg-emerald-500' : wr >= 50 ? 'bg-blue-500' : wr >= 45 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-20 overflow-hidden rounded-full bg-muted/30">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(wr, 100)}%` }} />
      </div>
      <span className={cn('text-xs font-medium tabular-nums', wr >= 50 ? 'text-emerald-400' : 'text-red-400')}>
        {wr.toFixed(1)}%
      </span>
    </div>
  )
}

function MatchupRow({ m }: { m: MatchupInfo }): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/30">
      <img
        src={championIconUrl(m.opponentImageId || m.opponentName)}
        alt={m.opponentName}
        className="h-8 w-8 rounded-full"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <span className="w-20 truncate text-sm">{m.opponentName}</span>
      <WinRateBar wr={m.winRate} />
      <span className="ml-auto text-xs text-muted-foreground">{m.games} 场</span>
    </div>
  )
}

function ChampSelectPanel({ csState }: { csState: ChampSelectState }): React.JSX.Element {
  const phaseLabel = csState.phase === 'ban' ? 'Ban 阶段' : csState.phase === 'pick' ? 'Pick 阶段' : csState.phase === 'finalization' ? '确认阶段' : '选人中'

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">当前 BP 状态</h3>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{phaseLabel}</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-2 text-xs text-blue-400">己方</div>
          <div className="space-y-1">
            {csState.myTeam.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                {p.championId > 0 ? (
                  <img src={championIconUrl(p.championImageId || p.championName)} alt="" className="h-6 w-6 rounded-full"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px]">?</div>
                )}
                <span className="text-xs">{p.championName || '未选择'}</span>
                {p.assignedPosition && <span className="text-[10px] text-muted-foreground">({p.assignedPosition})</span>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs text-red-400">敌方</div>
          <div className="space-y-1">
            {csState.theirTeam.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                {p.championId > 0 ? (
                  <img src={championIconUrl(p.championImageId || p.championName)} alt="" className="h-6 w-6 rounded-full"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px]">?</div>
                )}
                <span className="text-xs">{p.championName || '未选择'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {csState.bans.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <div className="mb-1 text-xs text-muted-foreground">已 Ban</div>
          <div className="flex flex-wrap gap-1">
            {csState.bans.map((id, i) => (
              <div key={i} className="h-6 w-6 overflow-hidden rounded-full ring-1 ring-red-500/30">
                <img src={championIconUrl(String(id))} alt="" className="h-full w-full grayscale"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function DraftAssistant(): React.JSX.Element {
  const gamePhase = useAppStore((s) => s.gamePhase)
  const champSelectState = useAppStore((s) => s.champSelectState)
  const [selectedLane, setSelectedLane] = useState<Lane>('middle')
  const [selectedTier, setSelectedTier] = useState<RankBracket>('emerald_plus')
  const [lookupChampId, setLookupChampId] = useState<number | null>(null)
  const [champData, setChampData] = useState<ChampionDataResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inChampSelect = gamePhase === 'ChampSelect'

  useEffect(() => {
    if (!champSelectState?.myLane) return
    setSelectedLane(champSelectState.myLane)
  }, [champSelectState?.myLane])

  useEffect(() => {
    if (!inChampSelect || !champSelectState) return
    const enemies = champSelectState.theirTeam.filter((p) => p.championId > 0)
    if (enemies.length > 0) {
      const latestEnemy = enemies[enemies.length - 1]
      setLookupChampId(latestEnemy.championId)
    }
  }, [inChampSelect, champSelectState])

  const fetchData = useCallback(async (champId: number, lane: Lane, tier: RankBracket) => {
    setLoading(true)
    setError(null)
    try {
      const data = await window.api.invoke(IPC_CHANNELS.CHAMPION_DATA_GET, champId, lane, tier) as ChampionDataResponse
      setChampData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (lookupChampId && lookupChampId > 0) {
      void fetchData(lookupChampId, selectedLane, selectedTier)
    }
  }, [lookupChampId, selectedLane, selectedTier, fetchData])

  const handleManualLookup = (champId: number): void => {
    setLookupChampId(champId)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold">选人助手</h1>
        <p className="text-sm text-muted-foreground">
          选人阶段自动分析对位胜率，推荐 Counter Pick 和 Ban 位
        </p>
      </div>

      <StatusBar />

      {inChampSelect && champSelectState && (
        <ChampSelectPanel csState={champSelectState} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {LANE_OPTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedLane(id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                selectedLane === id ? 'bg-primary text-primary-foreground' : 'bg-muted/40 hover:bg-muted'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <select
          value={selectedTier}
          onChange={(e) => setSelectedTier(e.target.value as RankBracket)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
        >
          {RANK_BRACKET_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
      </div>

      {!inChampSelect && !champData && (
        <QuickLookupPanel onLookup={handleManualLookup} />
      )}

      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-2 text-sm text-muted-foreground">加载对位数据...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {champData && !loading && (
        <ChampionDataPanel data={champData} />
      )}

      {inChampSelect && champSelectState && champSelectState.myChampionId > 0 && (
        <BuildRecommend
          championId={champSelectState.myChampionId}
          championName={champSelectState.myTeam.find((p) => p.championId === champSelectState.myChampionId)?.championName ?? ''}
          lane={selectedLane}
          tier={selectedTier}
          opponentId={lookupChampId ?? undefined}
          opponentName={champData?.championName}
        />
      )}
    </div>
  )
}

function QuickLookupPanel({ onLookup }: { onLookup: (id: number) => void }): React.JSX.Element {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ id: number; name: string; imageId: string }>>([])

  useEffect(() => {
    void (async () => {
      try {
        const data = await window.api.invoke(IPC_CHANNELS.TIER_GET_LIST, 'emerald_plus') as {
          lanes: Record<string, Array<{ championId: number; name: string; imageId: string }>>
        }
        if (data?.lanes) {
          const seen = new Set<number>()
          const all: Array<{ id: number; name: string; imageId: string }> = []
          for (const lane of Object.values(data.lanes)) {
            for (const champ of lane) {
              if (!seen.has(champ.championId)) {
                seen.add(champ.championId)
                all.push({ id: champ.championId, name: champ.name, imageId: champ.imageId })
              }
            }
          }
          all.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
          setSuggestions(all)
        }
      } catch {
        // tier list unavailable
      }
    })()
  }, [])

  const filtered = input.trim()
    ? suggestions.filter((c) => c.name.toLowerCase().includes(input.toLowerCase()))
    : []

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-medium">手动查询对位</h3>
      <p className="mb-3 text-xs text-muted-foreground">不在选人阶段时，可手动输入敌方英雄名查看对位数据</p>
      <input
        type="text"
        placeholder="输入英雄名（如：亚索）"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {filtered.length > 0 && (
        <div className="mt-2 max-h-48 overflow-auto rounded-md border border-border bg-background">
          {filtered.slice(0, 20).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => { onLookup(c.id); setInput(c.name) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/50"
            >
              <img src={championIconUrl(c.imageId)} alt="" className="h-6 w-6 rounded-full"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ChampionDataPanel({ data }: { data: ChampionDataResponse }): React.JSX.Element {
  const startingBuilds = data.builds.filter((build) => build.label.includes('出门'))
  const coreBuilds = data.builds.filter((build) => !build.position && !build.label.includes('出门'))
  const situationalBuilds = data.builds.filter((build) => build.position)
  const baseBuilds = [...startingBuilds, ...coreBuilds]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <img src={championIconUrl(String(data.championId))} alt="" className="h-12 w-12 rounded-full"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        <div>
          <h3 className="font-semibold">{data.championName}</h3>
          <p className="text-xs text-muted-foreground">
            {data.lane === 'top' ? '上单' : data.lane === 'jungle' ? '打野' : data.lane === 'middle' ? '中单' : data.lane === 'bottom' ? 'ADC' : '辅助'}
            {' · '}
            对位数据
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-3 text-sm font-medium text-emerald-400">
            克制 {data.championName} 的英雄（推荐选择）
          </h4>
          <p className="mb-2 text-[10px] text-muted-foreground">
            胜率 = 对手打 {data.championName} 的胜率（越高越克制）
          </p>
          <div className="space-y-1">
            {data.bestCounters.map((m) => (
              <MatchupRow key={m.opponentId} m={{ ...m, winRate: 100 - m.winRate }} />
            ))}
            {data.bestCounters.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">暂无数据</div>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-3 text-sm font-medium text-red-400">
            {data.championName} 克制的英雄（放心选）
          </h4>
          <p className="mb-2 text-[10px] text-muted-foreground">
            胜率 = {data.championName} 打对手的胜率（越高越好打）
          </p>
          <div className="space-y-1">
            {data.worstCounters.map((m) => (
              <MatchupRow key={m.opponentId} m={m} />
            ))}
            {data.worstCounters.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">暂无数据</div>
            )}
          </div>
        </div>
      </div>

      {data.builds.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-3 text-sm font-medium">推荐出装</h4>
          <div className="space-y-4">
            {baseBuilds.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground">基础路线</div>
                {baseBuilds.map((build, i) => (
                  <BuildLine key={i} build={build} />
                ))}
              </div>
            )}

            {situationalBuilds.length > 0 && (
              <div className="space-y-3 border-t border-border pt-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">局势装备选择</div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    核心装之后按对手回血、暴击、AP 爆发、控制和自身经济选择。
                  </p>
                </div>
                {[4, 5, 6].map((position) => {
                  const choices = situationalBuilds.filter((build) => build.position === position)
                  if (choices.length === 0) return null
                  return (
                    <div key={position}>
                      <div className="mb-2 text-xs font-medium">第 {position} 件候选</div>
                      <div className="grid gap-2 md:grid-cols-2">
                        {choices.map((build, i) => (
                          <BuildLine key={`${position}-${i}`} build={build} compact />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {data.runes.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h4 className="mb-3 text-sm font-medium">推荐符文</h4>
          <div className="space-y-3">
            {data.runes.map((rune, i) => (
              <div key={i} className="rounded-md bg-muted/20 p-3">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium">{rune.label}</span>
                  <span>
                    <span className={rune.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
                      {rune.winRate.toFixed(1)}%
                    </span>
                    <span className="ml-1 text-muted-foreground">({rune.games} 场)</span>
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="mr-1 text-[10px] text-muted-foreground">主系</span>
                    {rune.primaryPerks.map((id) => (
                      <img key={id} src={runeIconUrl(id)} alt={String(id)} className="h-7 w-7 rounded-full bg-muted/40"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="mr-1 text-[10px] text-muted-foreground">副系</span>
                    {rune.secondaryPerks.map((id) => (
                      <img key={id} src={runeIconUrl(id)} alt={String(id)} className="h-7 w-7 rounded-full bg-muted/40"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ))}
                  </div>
                  {rune.statShards.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="mr-1 text-[10px] text-muted-foreground">属性</span>
                      {rune.statShards.map((id) => (
                        <img key={id} src={statModIconUrl(id)} alt={String(id)} className="h-7 w-7 rounded-full bg-muted/40"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BuildLine({
  build,
  compact = false
}: {
  build: ItemBuildInfo
  compact?: boolean
}): React.JSX.Element {
  return (
    <div className={cn('rounded-md bg-muted/15', compact ? 'p-2' : 'p-0')}>
      <div className="mb-1 flex items-start justify-between gap-3 text-xs">
        <div>
          <span className="text-muted-foreground">{build.label}</span>
          {build.itemNames && build.itemNames.length > 0 && build.itemNames.join(' / ') !== build.label && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">{build.itemNames.join(' / ')}</div>
          )}
        </div>
        <span className="shrink-0">
          <span className={build.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
            {build.winRate.toFixed(1)}%
          </span>
          <span className="ml-1 text-muted-foreground">({build.games} 场)</span>
        </span>
      </div>
      <div className="flex gap-1">
        {build.items.map((itemId, j) => (
          <ItemIcon key={j} itemId={itemId} />
        ))}
      </div>
      {build.reason && (
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{build.reason}</p>
      )}
    </div>
  )
}

function ItemIcon({ itemId }: { itemId: number }): React.JSX.Element {
  if (itemId <= 0) return <div className="h-8 w-8 rounded bg-muted/30" />
  return (
    <img
      src={lolalyticsItemIconUrl(itemId)}
      alt={String(itemId)}
      className="h-8 w-8 rounded"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}
