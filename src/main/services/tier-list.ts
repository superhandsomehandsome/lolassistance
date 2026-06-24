import axios from 'axios'
import type { ChampionTier, Lane, RankBracket, TierLabel, TierListData } from '../../shared/types'
import { getRankBracketLabel } from '../../shared/types'
import { riotApi } from './riot-api'

const LANES: Lane[] = ['top', 'jungle', 'middle', 'bottom', 'support']

/**
 * 最低分路出场占比阈值。低于此值的英雄视为「偶尔走这个分路」，过滤掉。
 * 例如：亚索走上单 pctLane=25 表示他 25% 的对局在上单，高于阈值则保留。
 */
const MIN_PCT_LANE = 15

function tierNumberToLabel(tier: number): TierLabel {
  if (tier <= 1) return 'T0'
  if (tier === 2) return 'T1'
  if (tier === 3) return 'T2'
  if (tier === 4) return 'T3'
  return 'T4'
}

interface LolalyticsChampionStats {
  rank: number
  pctLane: number
  wr: number
  pr: number
  br: number
}

interface LolalyticsResponse {
  avgWr?: number
  tier?: Record<
    string,
    {
      lane?: Record<
        string,
        {
          cid?: Record<string, LolalyticsChampionStats>
        }
      >
    }
  >
}

class TierListService {
  private readonly cache = new Map<RankBracket, TierListData>()
  private readonly cacheAt = new Map<RankBracket, number>()
  private readonly cacheTtlMs = 30 * 60 * 1000

  private readonly championNames = new Map<number, string>()
  private readonly championImageIds = new Map<number, string>()
  private champDataLoaded = false

  async getTierList(rankBracket: RankBracket = 'emerald_plus', force = false): Promise<TierListData> {
    const cachedAt = this.cacheAt.get(rankBracket) ?? 0
    const cached = this.cache.get(rankBracket)

    if (!force && cached && Date.now() - cachedAt < this.cacheTtlMs) {
      return cached
    }

    await this.ensureChampionData()

    const lanes = {} as Record<Lane, ChampionTier[]>
    const patch = riotApi.getDdragonVersion()
    let totalAvgWr = 0
    let avgWrCount = 0

    for (const lane of LANES) {
      const { data } = await axios.get<LolalyticsResponse>(
        `https://a1.lolalytics.com/mega/?ep=tier&lane=${lane}&tier=${rankBracket}&queue=ranked`,
        { timeout: 15000 }
      )

      if (data.avgWr) {
        totalAvgWr += data.avgWr
        avgWrCount += 1
      }

      const champions: ChampionTier[] = []

      if (data.tier) {
        for (const [tierKey, tierGroup] of Object.entries(data.tier)) {
          const tierNum = Number(tierKey)
          const laneData = tierGroup.lane?.[lane]?.cid
          if (!laneData) continue

          for (const [cid, stats] of Object.entries(laneData)) {
            // 过滤掉出场占比过低的「客串」走位
            if (stats.pctLane < MIN_PCT_LANE) continue

            const championId = Number(cid)
            champions.push({
              championId,
              name: this.championNames.get(championId) ?? riotApi.getChampionName(championId),
              imageId: this.championImageIds.get(championId) ?? riotApi.getChampionImageId(championId),
              tier: tierNumberToLabel(tierNum),
              tierRank: tierNum,
              winRate: stats.wr,
              pickRate: stats.pr,
              banRate: stats.br,
              lane,
              rank: stats.rank
            })
          }
        }
      }

      champions.sort((a, b) => a.rank - b.rank)
      lanes[lane] = champions
    }

    const result: TierListData = {
      lanes,
      patch,
      rankBracket,
      rankBracketLabel: getRankBracketLabel(rankBracket),
      dataSource: 'Lolalytics',
      avgWinRate: avgWrCount > 0 ? totalAvgWr / avgWrCount : null,
      updatedAt: Date.now()
    }

    this.cache.set(rankBracket, result)
    this.cacheAt.set(rankBracket, Date.now())
    return result
  }

  private async ensureChampionData(): Promise<void> {
    if (this.champDataLoaded) return

    try {
      const version = riotApi.getDdragonVersion()
      const { data } = await axios.get<{
        data: Record<string, { key: string; id: string; name: string }>
      }>(`https://ddragon.leagueoflegends.com/cdn/${version}/data/zh_CN/champion.json`)

      for (const champ of Object.values(data.data)) {
        const id = Number(champ.key)
        this.championNames.set(id, champ.name)
        this.championImageIds.set(id, champ.id)
      }
      this.champDataLoaded = true
    } catch {
      // 降级：使用 riotApi 的英雄名称
    }
  }
}

export const tierListService = new TierListService()
