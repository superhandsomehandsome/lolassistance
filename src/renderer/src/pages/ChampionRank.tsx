import { useCallback, useEffect, useRef, useState } from 'react'

import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { ChampionTier, Lane, RankBracket, TierLabel, TierListData } from '../../../shared/types'
import { isRankBracket, RANK_BRACKET_OPTIONS } from '../../../shared/types'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { championIconUrl } from '@/lib/ddragon'
import { getTierChampions, useAppStore } from '@/stores/app-store'

const LANES: { id: Lane; label: string }[] = [
  { id: 'top', label: '上单' },
  { id: 'jungle', label: '打野' },
  { id: 'middle', label: '中单' },
  { id: 'bottom', label: 'ADC' },
  { id: 'support', label: '辅助' }
]

const TIER_ORDER: TierLabel[] = ['T0', 'T1', 'T2', 'T3', 'T4']

const TIER_VARIANT: Record<TierLabel, 't0' | 't1' | 't2' | 't3' | 't4'> = {
  T0: 't0',
  T1: 't1',
  T2: 't2',
  T3: 't3',
  T4: 't4'
}

function ChampionTierCard({ champ }: { champ: ChampionTier }): React.JSX.Element {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-3 p-3">
        <img
          src={championIconUrl(champ.imageId)}
          alt={champ.name}
          className="h-10 w-10 rounded-full"
          onError={(e) => {
            ;(e.target as HTMLImageElement).src = championIconUrl('Aatrox')
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{champ.name}</div>
          <div className="text-xs text-muted-foreground">#{champ.rank}</div>
        </div>
        <Badge variant={TIER_VARIANT[champ.tier]}>{champ.tier}</Badge>
        <div className="text-right text-xs">
          <div className="text-emerald-400">{champ.winRate.toFixed(1)}%</div>
          <div className="text-muted-foreground">登场 {champ.pickRate.toFixed(1)}%</div>
          <div className="text-muted-foreground">Ban {champ.banRate.toFixed(1)}%</div>
        </div>
      </CardContent>
    </Card>
  )
}

function TierSection({
  tier,
  champions
}: {
  tier: TierLabel
  champions: ChampionTier[]
}): React.JSX.Element | null {
  if (champions.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={TIER_VARIANT[tier]} className="text-sm">
          {tier}
        </Badge>
        <span className="text-sm text-muted-foreground">{champions.length} 位英雄</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {champions.map((champ) => (
          <ChampionTierCard key={`${champ.lane}-${champ.championId}`} champ={champ} />
        ))}
      </div>
    </div>
  )
}

export function ChampionRank(): React.JSX.Element {
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const tierList = useAppStore((s) => s.tierList)
  const setTierList = useAppStore((s) => s.setTierList)
  const selectedLane = useAppStore((s) => s.selectedLane)
  const setSelectedLane = useAppStore((s) => s.setSelectedLane)
  const selectedRankBracket = useAppStore((s) => s.selectedRankBracket)
  const setSelectedRankBracket = useAppStore((s) => s.setSelectedRankBracket)

  // 兼容旧缓存中的无效段位值
  useEffect(() => {
    if (!isRankBracket(selectedRankBracket)) {
      setSelectedRankBracket('emerald_plus')
    }
  }, [selectedRankBracket, setSelectedRankBracket])

  const loadTierList = useCallback(
    async (bracket: RankBracket, force = false): Promise<void> => {
      const requestId = ++requestIdRef.current
      setLoading(true)
      setLoadError(null)
      try {
        const data = (await window.api.invoke(
          IPC_CHANNELS.TIER_GET_LIST,
          bracket,
          force
        )) as TierListData

        if (requestId !== requestIdRef.current) return
        setTierList(data)
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        console.error('Failed to load tier list', error)
        setTierList(null)
        setLoadError('加载失败，请检查网络后点击「刷新数据」重试')
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
        }
      }
    },
    [setTierList]
  )

  useEffect(() => {
    if (!isRankBracket(selectedRankBracket)) return
    setTierList(null)
    void loadTierList(selectedRankBracket)
  }, [selectedRankBracket, loadTierList, setTierList])

  const activeBracket = isRankBracket(selectedRankBracket) ? selectedRankBracket : 'emerald_plus'
  const displayList = tierList && tierList.rankBracket === activeBracket ? tierList : null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">英雄排行</h1>
          <p className="text-muted-foreground">
            各段位排位数据，每段独立样本（数据来源：Lolalytics）
            {displayList && (
              <span className="ml-2 text-xs">
                {displayList.rankBracketLabel}
                {displayList.avgWinRate !== null && (
                  <span> · 平均胜率 {displayList.avgWinRate.toFixed(1)}%</span>
                )}
                <span> · {new Date(displayList.updatedAt).toLocaleString()}</span>
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            每段位使用独立样本，T0 ~ T4 由各分路内部排名决定；已过滤出场率 &lt; 15% 的客串走位
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void loadTierList(activeBracket, true)}
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新数据'}
        </Button>
      </div>

      <div className="max-w-xs space-y-2">
        <label className="text-sm font-medium text-muted-foreground">选择段位</label>
        <Select
          value={activeBracket}
          onValueChange={(value) => setSelectedRankBracket(value as RankBracket)}
          disabled={loading}
        >
          <SelectTrigger>
            <SelectValue placeholder="选择段位" />
          </SelectTrigger>
          <SelectContent>
            {RANK_BRACKET_OPTIONS.map((bracket) => (
              <SelectItem key={bracket.id} value={bracket.id}>
                {bracket.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={selectedLane} onValueChange={(v) => setSelectedLane(v as Lane)}>
        <TabsList>
          {LANES.map((lane) => (
            <TabsTrigger key={lane.id} value={lane.id}>
              {lane.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {LANES.map((lane) => (
          <TabsContent key={lane.id} value={lane.id} className="space-y-6">
            {loading && (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {!loading && loadError && (
              <div className="py-12 text-center text-muted-foreground">{loadError}</div>
            )}

            {!loading && !loadError && displayList && (
              <>
                {TIER_ORDER.map((tier) => (
                  <TierSection
                    key={tier}
                    tier={tier}
                    champions={getTierChampions(displayList, lane.id, tier)}
                  />
                ))}
                {TIER_ORDER.every(
                  (tier) => getTierChampions(displayList, lane.id, tier).length === 0
                ) && (
                  <div className="py-12 text-center text-muted-foreground">
                    该分路暂无数据
                  </div>
                )}
              </>
            )}

            {!loading && !loadError && !displayList && (
              <div className="py-12 text-center text-muted-foreground">
                数据加载中，请稍候…
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
