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
  itemNames?: string[]
  winRate: number
  games: number
  label: string
  position?: number
  reason?: string
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
const CACHE_SCHEMA_VERSION = 'situational-soft-dedup-v8'

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
 * 根据符文 ID 推断所属符文系。
 * 符文 ID 大致按系分段（81xx 主宰、82xx 巫术、83xx 灵感、84xx 坚决），
 * 精密系包含 80xx 以及若干 9xxx 小符文（如 9101/9103/9104/9105/9111），
 * 9923（疾刃）属于主宰系。用区间判断比硬编码列表更稳健、不易遗漏新符文。
 */
function getTreeForRune(runeId: number): number {
  if (runeId === 9923) return 8100
  if (runeId >= 9000) return 8000
  if (runeId >= 8400) return 8400
  if (runeId >= 8300) return 8300
  if (runeId >= 8200) return 8200
  if (runeId >= 8100) return 8100
  return 8000
}

function sectionBetween(html: string, startLabel: string, endLabels: string[]): string {
  const start = html.indexOf(startLabel)
  if (start < 0) return ''

  let end = html.length
  for (const label of endLabels) {
    const idx = html.indexOf(label, start + startLabel.length)
    if (idx >= 0 && idx < end) end = idx
  }
  return html.slice(start, end)
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[^;]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueConsecutive(ids: number[]): number[] {
  const result: number[] = []
  for (const id of ids) {
    if (id > 0 && result[result.length - 1] !== id) result.push(id)
  }
  return result
}

function parsePercentAndGames(section: string): { winRate: number; games: number } {
  const text = stripHtml(section)
  const match = text.match(/(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:Win Rate\s*)?([\d,]+)?\s*(?:Games)?/i)
  return {
    winRate: match ? Number(match[1]) : 0,
    games: match?.[2] ? Number(match[2].replace(/,/g, '')) : 0
  }
}

function parsePercentGamePairs(section: string): Array<{ winRate: number; games: number }> {
  const text = stripHtml(section)
  const pairs: Array<{ winRate: number; games: number }> = []
  const pattern = /(\d{1,2}(?:\.\d{1,2})?)\s*%\s*([\d,]+)\b/g
  for (const match of text.matchAll(pattern)) {
    pairs.push({
      winRate: Number(match[1]),
      games: Number(match[2].replace(/,/g, ''))
    })
  }
  return pairs.filter((pair) => pair.winRate > 0 && pair.games > 0)
}

interface ItemEntry {
  id: number
  name: string
  index: number
}

const ITEM_REASON_OVERRIDES: Record<number, string> = {
  3075: '对面回血多或物理普攻多时优先，提供重伤和护甲反伤',
  3165: '对面回血多且你需要法强重伤时选择',
  6609: '对面回血多且你是物理战士时选择',
  3143: '对面暴击/射手发育好时优先，降低爆发伤害',
  3065: '对面魔法伤害高，或你依赖治疗/护盾时优先',
  4401: '对面持续魔法伤害或控制较多时优先',
  2501: '对面法师爆发高时优先，先保证不被秒',
  6665: '需要中后期双抗、团战站得更久时选择',
  3190: '团队需要保护后排、对面开团强时选择',
  3156: '对面 AP 爆发高，且你需要输出装时选择',
  6333: '对面控制多，需要解除压制/控制时选择',
  3026: '高赏金或关键团前容错装，防止被先手秒杀',
  3157: '对面刺客/爆发强，关键技能需要规避时选择',
  3102: '对面先手控制或单点技能威胁大时选择',
  6694: '需要补穿甲和收割能力时选择',
  3036: '对面护甲高或前排成型时选择',
  3135: '对面魔抗高时选择，提高法术穿透',
  3089: '顺风扩大法强收益，追求更高爆发时选择',
  4637: '顺风滚雪球或需要爆发进场时选择',
  4645: '需要法穿节奏、对面开始堆魔抗时选择',
  3078: '均势战士通用选择，兼顾伤害、血量和拉扯',
  6631: '需要持续作战和单带压制时选择',
  6675: '需要攻击特效/持续输出时选择',
  3068: '对线物理英雄或需要清线、抗 AD 时选择',
  2502: '需要抗物理持续伤害并在团战中回复时选择',
  3041: '滚雪球装：仅在大幅领先时购买；其高胜率多来自顺风样本，落后勿出',
  1082: '滚雪球装：前期领先时低价滚雪球，落后或势均时不推荐',
  4646: '需要法穿+爆发节奏、对面血量偏低时选择',
  4644: '对面阵容偏脆、需要持续法强压制时选择',
  3137: '对面魔抗高且有护盾/治疗时选择，兼顾法穿与重伤',
  3116: '对面贴脸或需要持续减速消耗时选择'
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function parseItemEntries(section: string): ItemEntry[] {
  const entries: ItemEntry[] = []
  const pattern = /<img[^>]+item64\/(\d+)\.webp[^>]+alt="([^"]*)"[^>]*>/g
  for (const match of section.matchAll(pattern)) {
    const id = Number(match[1])
    if (!id || entries[entries.length - 1]?.id === id) continue
    entries.push({ id, name: decodeHtmlEntities(match[2] ?? String(id)), index: match.index ?? 0 })
  }
  return entries
}

function itemReason(itemId: number, position: number): string {
  return ITEM_REASON_OVERRIDES[itemId]
    ?? `第 ${position} 件根据对局补强：顺风优先高胜率输出/功能装，劣势优先保命和抗性。`
}

function parseSituationalChoices(section: string, position: number): ItemBuild[] {
  const entries = parseItemEntries(section)
  const statPairs = parsePercentGamePairs(section)
  const choices: ItemBuild[] = []
  const seen = new Set<number>()

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    if (seen.has(entry.id)) continue
    seen.add(entry.id)

    const nextIndex = entries[i + 1]?.index ?? Math.min(section.length, entry.index + 1200)
    const itemSection = section.slice(Math.max(0, entry.index - 700), nextIndex)
    const parsedStats = parsePercentAndGames(itemSection)
    const fallbackStats = statPairs[choices.length] ?? { winRate: 0, games: 0 }
    const stats = parsedStats.games > 0 ? parsedStats : fallbackStats
    if (stats.games <= 0) continue

    choices.push({
      items: [entry.id],
      itemNames: [entry.name],
      winRate: stats.winRate,
      games: stats.games,
      label: entry.name,
      position,
      reason: itemReason(entry.id, position)
    })
  }

  return choices
    .sort((a, b) => b.games - a.games)
    .slice(0, 4)
}

function parseSelectedImageIds(section: string, kind: 'rune68' | 'statmod32'): number[] {
  const selected: number[] = []
  const pattern = new RegExp(`<img[^>]+${kind}/(\\d+)\\.webp[^>]*class="([^"]*)"`, 'g')
  for (const match of section.matchAll(pattern)) {
    const className = match[2] ?? ''
    if (!className.includes('grayscale')) selected.push(Number(match[1]))
  }
  return uniqueConsecutive(selected)
}

function buildRunePage(runeIds: number[], statShards: number[], section: string): RunePage | null {
  if (runeIds.length < 6) return null

  // Lolalytics HTML 中已选符文按顺序排列：前 4 个为主系（含基石），随后 2 个为副系。
  // 直接按顺序切分比按系过滤更稳健，避免个别符文 ID 归类错误导致整页丢弃。
  const primaryPerks = runeIds.slice(0, 4)
  const secondaryPerks = runeIds.slice(4, 6)
  if (primaryPerks.length < 4 || secondaryPerks.length < 2) return null

  const primaryTree = getTreeForRune(primaryPerks[0])
  const secondaryTree = getTreeForRune(secondaryPerks[0])
  const stats = parsePercentAndGames(section)
  return {
    primaryTree,
    primaryPerks,
    secondaryTree,
    secondaryPerks,
    statShards: statShards.slice(0, 3),
    winRate: stats.winRate,
    games: stats.games,
    label: '推荐符文'
  }
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
  const championKey = championImageId.toLowerCase()
  const tableStart = html.indexOf('WR vs')
  const tableHtml = tableStart >= 0 ? html.slice(tableStart) : html
  const rowPattern = new RegExp(`href="/lol/${championKey}/vs/([a-z0-9]+)/build/[^"]*"`, 'gi')
  const seen = new Set<string>()

  for (const m of tableHtml.matchAll(rowPattern)) {
    const oppImageId = m[1]
    if (seen.has(oppImageId) || oppImageId === championKey) continue

    const rowHtml = tableHtml.slice(m.index ?? 0, (m.index ?? 0) + 4500)
    const rowText = stripHtml(rowHtml)
    const wrMatch = rowText.match(/(\d{1,2}\.\d{1,2})\s*%\s*VS/i)
    const gamesMatch = rowText.match(/([\d,]+)\s*Games/i)
    const wr = wrMatch ? Number(wrMatch[1]) : NaN
    const games = gamesMatch ? Number(gamesMatch[1].replace(/,/g, '')) : 0
    if (isNaN(wr) || games <= 0) continue

    const oppId = riotApi.getChampionIdByImageId(oppImageId)
    seen.add(oppImageId)
    matchups.push({
      opponentId: oppId,
      opponentName: oppId > 0 ? riotApi.getChampionName(oppId) : oppImageId,
      opponentImageId: oppId > 0 ? riotApi.getChampionImageId(oppId) : oppImageId,
      winRate: wr,
      games
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

  const coreSection = sectionBetween(html, 'Core Build', ['Item 4', 'Item 5', 'Item 6', 'LEGEND:', 'Counters'])
  const coreEntries = parseItemEntries(coreSection).slice(0, 3)
  const coreItems = coreEntries.map((item) => item.id)
  const coreStats = parsePercentAndGames(coreSection)
  if (coreItems.length >= 2 && coreStats.games > 0) {
    builds.push({
      items: coreItems,
      itemNames: coreEntries.map((item) => item.name),
      winRate: coreStats.winRate,
      games: coreStats.games,
      label: '核心三件（优先成型）',
      reason: '通常先按这套做出核心战斗力，再根据敌方阵容选择第 4/5/6 件。'
    })
  }

  const startSection = sectionBetween(html, 'Starting Items', ['Core Build'])
  const startEntries = parseItemEntries(startSection).slice(0, 4)
  const startingItems = startEntries.map((item) => item.id)
  const startStats = parsePercentAndGames(startSection)
  if (startingItems.length > 0 && startStats.games > 0) {
    builds.push({
      items: startingItems,
      itemNames: startEntries.map((item) => item.name),
      winRate: startStats.winRate,
      games: startStats.games,
      label: '出门装'
    })
  }

  const item4Section = sectionBetween(html, 'Item 4', ['Item 5', 'Item 6', 'LEGEND:', 'Counters'])
  const item5Section = sectionBetween(html, 'Item 5', ['Item 6', 'LEGEND:', 'Counters'])
  const item6Section = sectionBetween(html, 'Item 6', ['LEGEND:', 'Counters'])

  const raw4 = parseSituationalChoices(item4Section, 4)
  const raw5 = parseSituationalChoices(item5Section, 5)
  const raw6 = parseSituationalChoices(item6Section, 6)

  // 软去重：同一件装备可能在不同出装路径里出现在不同槽位（如 Mejai's 顺风滚雪球），
  // 完全删除会丢失第 6 件候选。改为限制同一装备最多出现在 2 个槽位，
  // 保留它胜率/场次最高的前两次，避免三个槽位全是同一件装备的极端重复。
  const MAX_SLOTS_PER_ITEM = 2
  const slotCount = new Map<number, number>()
  const keep = (b: ItemBuild): boolean => {
    const id = b.items[0]
    const count = slotCount.get(id) ?? 0
    if (count >= MAX_SLOTS_PER_ITEM) return false
    slotCount.set(id, count + 1)
    return true
  }

  // 按场次降序处理，让该装备最常出现的槽位优先被保留
  const allSorted = [...raw4, ...raw5, ...raw6].sort((a, b) => b.games - a.games)
  const keptSet = new Set<ItemBuild>()
  for (const b of allSorted) {
    if (keep(b)) keptSet.add(b)
  }

  const dedup4 = raw4.filter((b) => keptSet.has(b))
  const dedup5 = raw5.filter((b) => keptSet.has(b))
  const dedup6 = raw6.filter((b) => keptSet.has(b))

  builds.push(...dedup4, ...dedup5, ...dedup6)

  const primaryIdx = html.indexOf('Primary Runes')
  const runeEnd = primaryIdx >= 0 ? html.indexOf('Starting Items', primaryIdx) : -1
  const runeSection = primaryIdx >= 0
    ? html.slice(Math.max(0, primaryIdx - 1200), runeEnd > primaryIdx ? runeEnd : primaryIdx + 30000)
    : ''
  const runePage = buildRunePage(
    parseSelectedImageIds(runeSection, 'rune68'),
    parseSelectedImageIds(runeSection, 'statmod32'),
    runeSection
  )
  if (runePage) runes.push(runePage)

  return { builds, runes }
}

class ChampionDataService {
  private readonly cache = new Map<string, CacheEntry<ChampionMatchupResponse>>()

  private cacheKey(championId: number, lane: Lane, tier: RankBracket): string {
    return `${CACHE_SCHEMA_VERSION}:${championId}:${lane}:${tier}`
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
