import { useCallback, useEffect, useState } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type {
  ChampionDataResponse,
  ItemBuildInfo,
  Lane,
  RankBracket,
  RunePageInfo
} from '../../../shared/types'
import { championIconUrl, lolalyticsItemIconUrl, runeIconUrl, statModIconUrl } from '@/lib/ddragon'
import { cn } from '@/lib/utils'

interface BuildRecommendProps {
  championId: number
  championName: string
  lane: Lane
  tier: RankBracket
  opponentId?: number
  opponentName?: string
}

const RUNE_TREE_NAMES: Record<number, string> = {
  8000: '精密', 8100: '主宰', 8200: '巫术', 8300: '灵感', 8400: '坚决'
}

function RuneTree({ tree }: { tree: number }): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/30 px-2 py-0.5 text-[10px]">
      {RUNE_TREE_NAMES[tree] ?? tree}
    </span>
  )
}

function RunePageCard({ rune }: { rune: RunePageInfo }): React.JSX.Element {
  const renderRuneIcon = (id: number): React.JSX.Element => (
    <img
      key={id}
      src={runeIconUrl(id)}
      alt={String(id)}
      title={String(id)}
      className="h-8 w-8 rounded-full bg-muted/40"
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )

  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium">{rune.label}</span>
        <div className="flex items-center gap-2 text-xs">
          <span className={rune.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
            {rune.winRate.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">{rune.games} 场</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <div className="mb-1 flex items-center gap-1">
            <RuneTree tree={rune.primaryTree} />
            <span className="text-[10px] text-muted-foreground">主系</span>
          </div>
          <div className="flex gap-1">
            {rune.primaryPerks.map(renderRuneIcon)}
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <div className="mb-1 flex items-center gap-1">
            <RuneTree tree={rune.secondaryTree} />
            <span className="text-[10px] text-muted-foreground">副系</span>
          </div>
          <div className="flex gap-1">
            {rune.secondaryPerks.map(renderRuneIcon)}
          </div>
        </div>
        {rune.statShards.length > 0 && (
          <>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="mb-1 text-[10px] text-muted-foreground">属性碎片</div>
              <div className="flex gap-1">
                {rune.statShards.map((shard) => (
                  <img
                    key={shard}
                    src={statModIconUrl(shard)}
                    alt={String(shard)}
                    title={String(shard)}
                    className="h-8 w-8 rounded-full bg-muted/40"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BuildCard({ build }: { build: ItemBuildInfo }): React.JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-xs font-medium">{build.label}</span>
          {build.itemNames && build.itemNames.length > 0 && build.itemNames.join(' / ') !== build.label && (
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              {build.itemNames.join(' / ')}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={build.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}>
            {build.winRate.toFixed(1)}%
          </span>
          <span className="text-muted-foreground">{build.games} 场</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {build.items.map((itemId, j) => (
          <img
            key={j}
            src={lolalyticsItemIconUrl(itemId)}
            alt={String(itemId)}
            className="h-9 w-9 rounded"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ))}
      </div>
      {build.reason && (
        <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{build.reason}</p>
      )}
    </div>
  )
}

function SituationalBuilds({ builds }: { builds: ItemBuildInfo[] }): React.JSX.Element {
  const positions = [4, 5, 6]

  return (
    <div>
      <div className="mb-2">
        <h4 className="text-xs font-medium text-muted-foreground">局势装备选择</h4>
        <p className="mt-1 text-[10px] text-muted-foreground">
          核心三件后不要固定照抄，按敌方伤害类型、回血、控制和你当前经济选择。
        </p>
      </div>
      <div className="space-y-3">
        {positions.map((position) => {
          const choices = builds.filter((build) => build.position === position)
          if (choices.length === 0) return null
          return (
            <div key={position} className="rounded-lg border border-border/70 bg-background/30 p-3">
              <div className="mb-2 text-xs font-medium">第 {position} 件候选</div>
              <div className="grid gap-2 md:grid-cols-2">
                {choices.map((build, index) => (
                  <BuildCard key={`${position}-${build.items.join('-')}-${index}`} build={build} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function BuildRecommend({
  championId,
  championName,
  lane,
  tier,
  opponentId,
  opponentName
}: BuildRecommendProps): React.JSX.Element {
  const [data, setData] = useState<ChampionDataResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.invoke(
        IPC_CHANNELS.CHAMPION_DATA_GET,
        championId,
        lane,
        tier
      ) as ChampionDataResponse
      setData(result)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [championId, lane, tier])

  useEffect(() => {
    if (championId > 0) void fetch()
  }, [championId, fetch])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        加载推荐...
      </div>
    )
  }

  if (!data) return <></>
  const startingBuilds = data.builds.filter((build) => build.label.includes('出门'))
  const coreBuilds = data.builds.filter((build) => !build.position && !build.label.includes('出门'))
  const situationalBuilds = data.builds.filter((build) => build.position)

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <img
          src={championIconUrl(String(championId))}
          alt={championName}
          className="h-10 w-10 rounded-full"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        <div>
          <h3 className="text-sm font-semibold">{championName} 出装与符文推荐</h3>
          <p className="text-xs text-muted-foreground">
            {laneLabel(lane)}
            {opponentName && (
              <span className={cn('ml-1')}>
                vs <span className="font-medium text-red-400">{opponentName}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      {data.builds.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">基础路线</h4>
          <div className="space-y-2">
            {[...startingBuilds, ...coreBuilds].map((build, i) => (
              <BuildCard key={i} build={build} />
            ))}
          </div>
        </div>
      )}

      {situationalBuilds.length > 0 && (
        <SituationalBuilds builds={situationalBuilds} />
      )}

      {data.runes.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-medium text-muted-foreground">符文配置</h4>
          <div className="space-y-2">
            {data.runes.map((rune, i) => (
              <RunePageCard key={i} rune={rune} />
            ))}
          </div>
        </div>
      )}

      {opponentId && opponentId > 0 && (
        <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          当前对位 {opponentName ?? '?'}：核心装按该英雄分路高胜率数据，后续第 4/5/6 件请优先参考上方局势装备。
        </div>
      )}
    </div>
  )
}

function laneLabel(lane: Lane): string {
  const map: Record<Lane, string> = { top: '上单', jungle: '打野', middle: '中单', bottom: 'ADC', support: '辅助' }
  return map[lane] ?? lane
}
