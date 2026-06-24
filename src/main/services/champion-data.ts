import axios from 'axios'
import type { Lane, RankBracket } from '../../shared/types'
import { riotApi } from './riot-api'

export interface MatchupData {
  opponentId: number
  opponentName: string
  opponentImageId: string
  winRate: number
  games: number
}

export interface ItemBuild {
  items: number[]
  winRate: number
  games: number
  label: string
}

export interface RunePage {
  primaryTree: number
  primaryPerks: number[]
  secondaryTree: number
  secondaryPerks: number[]
  statShards: number[]
  winRate: number
  games: number
  label: string
}

export interface ChampionMatchupResponse {
  championId: number
  championName: string
  lane: Lane
  tier: RankBracket
  matchups: MatchupData[]
  bestCounters: MatchupData[]
  worstCounters: MatchupData[]
  builds: ItemBuild[]
  runes: RunePage[]
  vsBuilds: Map<number, ItemBuild[]>
  vsRunes: Map<number, RunePage[]>
}

interface CacheEntry<T> {
  data: T
  timestamp: number
}

const CACHE_TTL_MS = 30 * 60 * 1000

const TIER_TO_URL: Record<string, string> = {
  emerald_plus: 'emerald_plus',
  iron: 'iron',
  bronze: 'bronze',
  silver: 'silver',
  gold: 'gold',
  platinum: 'platinum',
  emerald: 'emerald',
  diamond: 'diamond',
  master: 'master',
  grandmaster: 'grandmaster'
}

const LANE_TO_URL: Record<Lane, string> = {
  top: 'top',
  jungle: 'jungle',
  middle: 'middle',
  bottom: 'bottom',
  support: 'support'
}

/**
 * 从 Lolalytics counters 页面抓取对位胜率数据。
 * Lolalytics 使用 Qwik SSR，所有数据直接嵌入 HTML。
 *
 * 对位数据格式：champx 图片后跟胜率百分比
 *   champx46/{champname}.webp ... XX.XX%
 *
 * winRate 含义：查询英雄对阵该对手的胜率（例如查 Yasuo，
 * champx46/quinn.webp 后跟 38.65% 表示 Yasuo 打 Quinn 只有 38.65%）
 */
async function scrapeCounters(
  championImageId: string,
  lane: Lane,
  tier: RankBracket
): Promise<MatchupData[]> {
  const tierParam = TIER_TO_URL[tier] ?? 'emerald_plus'
  const laneParam = LANE_TO_URL[lane] ?? 'middle'
  const url = `https://lolalytics.com/lol/${championImageId.toLowerCase()}/counters/?lane=${laneParam}&tier=${tierParam}`

  const { data: html } = await axios.get<string>(url, {
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  })

  const matchups: MatchupData[] = []

  // champx 图片后方的第一个百分比即为本英雄对阵该对手的胜率
  const pattern = /champx\d+\/([a-z]+)\.webp[\s\S]*?(\d{2}\.\d{1,2})%/gi
  for (const m of html.matchAll(pattern)) {
    const oppImageId = m[1]
    const wr = parseFloat(m[2])
    if (isNaN(wr) || oppImageId === championImageId.toLowerCase()) continue

    const oppId = riotApi.getChampionIdByImageId(oppImageId)
    matchups.push({
      opponentId: oppId,
      opponentName: oppId > 0 ? riotApi.getChampionName(oppId) : oppImageId,
      opponentImageId: oppImageId.charAt(0).toUpperCase() + oppImageId.slice(1),
      winRate: wr,
      games: 0
    })
  }

  return matchups
}

/**
 * 从 Lolalytics build 页面抓取出装和符文数据。
 * 物品通过 item64/{id}.webp 提取，符文通过 rune68/{id}.webp 提取。
 */
async function scrapeBuild(
  championImageId: string,
  lane: Lane,
  tier: RankBracket
): Promise<{ builds: ItemBuild[]; runes: RunePage[] }> {
  const tierParam = TIER_TO_URL[tier] ?? 'emerald_plus'
  const laneParam = LANE_TO_URL[lane] ?? 'middle'
  const url = `https://lolalytics.com/lol/${championImageId.toLowerCase()}/build/?lane=${laneParam}&tier=${tierParam}`

  const { data: html } = await axios.get<string>(url, {
    timeout: 20000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  })

  const builds: ItemBuild[] = []
  const runes: RunePage[] = []

  // 提取核心出装：查找 "Core Build" 区域附近的 item64 图片
  const coreIdx = html.indexOf('Core Build')
  if (coreIdx >= 0) {
    const coreSection = html.slice(coreIdx, coreIdx + 3000)
    const itemIds = [...coreSection.matchAll(/item64\/(\d+)\.webp/g)].map((m) => Number(m[1]))
    const wrMatch = coreSection.match(/(\d{2}\.\d{1,2})%/)
    if (itemIds.length > 0) {
      builds.push({
        items: itemIds.slice(0, 6),
        winRate: wrMatch ? parseFloat(wrMatch[1]) : 0,
        games: 0,
        label: '核心出装（最高胜率）'
      })
    }
  }

  // 提取起始装备
  const startIdx = html.indexOf('Starting')
  if (startIdx >= 0) {
    const startSection = html.slice(startIdx, startIdx + 2000)
    const itemIds = [...startSection.matchAll(/item64\/(\d+)\.webp/g)].map((m) => Number(m[1]))
    const wrMatch = startSection.match(/(\d{2}\.\d{1,2})%/)
    if (itemIds.length > 0) {
      builds.push({
        items: itemIds.slice(0, 4),
        winRate: wrMatch ? parseFloat(wrMatch[1]) : 0,
        games: 0,
        label: '出门装'
      })
    }
  }

  // 提取符文：rune68/{id}.webp，前4个为主系，接下来2个为副系
  const runeIds = [...html.matchAll(/rune68\/(\d+)\.webp/g)].map((m) => Number(m[1]))
  const shardIds = [...html.matchAll(/statmod32\/(\d+)\.webp/g)].map((m) => Number(m[1]))

  if (runeIds.length >= 6) {
    const primaryTree = getPrimaryTree(runeIds[0])
    const secondaryTree = getSecondaryTree(runeIds.slice(4, 6))
    runes.push({
      primaryTree,
      primaryPerks: runeIds.slice(0, 4),
      secondaryTree,
      secondaryPerks: runeIds.slice(4, 6),
      statShards: shardIds.slice(0, 3),
      winRate: 0,
      games: 0,
      label: '推荐符文'
    })
  }

  return { builds, runes }
}

function getPrimaryTree(keystoneId: number): number {
  if (keystoneId >= 8000 && keystoneId < 8100) return 8000
  if (keystoneId >= 8100 && keystoneId < 8200) return 8100
  if (keystoneId >= 8200 && keystoneId < 8300) return 8200
  if (keystoneId >= 8300 && keystoneId < 8400) return 8300
  if (keystoneId >= 8400 && keystoneId < 8500) return 8400
  return 8000
}

function getSecondaryTree(perks: number[]): number {
  for (const p of perks) {
    if (p >= 8000 && p < 8100) return 8000
    if (p >= 8100 && p < 8200) return 8100
    if (p >= 8200 && p < 8300) return 8200
    if (p >= 8300 && p < 8400) return 8300
    if (p >= 8400 && p < 8500) return 8400
  }
  return 8100
}

class ChampionDataService {
  private readonly cache = new Map<string, CacheEntry<ChampionMatchupResponse>>()

  private cacheKey(championId: number, lane: Lane, tier: RankBracket): string {
    return `${championId}:${lane}:${tier}`
  }

  async getChampionData(
    championId: number,
    lane: Lane,
    tier: RankBracket = 'emerald_plus'
  ): Promise<ChampionMatchupResponse> {
    const key = this.cacheKey(championId, lane, tier)
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data
    }

    const championName = riotApi.getChampionName(championId)
    const championImageId = riotApi.getChampionImageId(championId)

    const [matchups, buildData] = await Promise.all([
      scrapeCounters(championImageId, lane, tier).catch(() => [] as MatchupData[]),
      scrapeBuild(championImageId, lane, tier).catch(() => ({ builds: [] as ItemBuild[], runes: [] as RunePage[] }))
    ])

    // winRate = 查询英雄打对手的胜率
    // bestCounters = 对手打你胜率最高的（你打对手胜率最低的）
    // worstCounters = 你打对手胜率最高的
    const bestCounters = [...matchups]
      .sort((a, b) => a.winRate - b.winRate)
      .slice(0, 10)

    const worstCounters = [...matchups]
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, 10)

    const result: ChampionMatchupResponse = {
      championId,
      championName,
      lane,
      tier,
      matchups,
      bestCounters,
      worstCounters,
      builds: buildData.builds,
      runes: buildData.runes,
      vsBuilds: new Map(),
      vsRunes: new Map()
    }

    this.cache.set(key, { data: result, timestamp: Date.now() })
    return result
  }

  async getCounterPicks(
    opponentId: number,
    lane: Lane,
    tier: RankBracket = 'emerald_plus'
  ): Promise<MatchupData[]> {
    const champData = await this.getChampionData(opponentId, lane, tier)
    return champData.bestCounters
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const championDataService = new ChampionDataService()
