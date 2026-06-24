import axios, { type AxiosInstance } from 'axios'
import type { MatchSummary, PlayerWithHistory } from '../../shared/types'
import { RateLimiter } from './rate-limiter'

const ACCOUNT_REGION = 'https://asia.api.riotgames.com'
const MATCH_REGION = 'https://asia.api.riotgames.com'

interface DDragonChampion {
  id: string
  key: string
  name: string
}

interface ChampionInfo {
  name: string
  imageId: string
}

class RiotApiService {
  private readonly limiter = new RateLimiter(8, 80)
  private readonly puuidCache = new Map<string, string>()
  private readonly historyCache = new Map<string, PlayerWithHistory>()
  private client: AxiosInstance | null = null
  private championMap = new Map<number, ChampionInfo>()
  private ddragonVersion = '14.24.1'
  private champDataReady: Promise<void> = Promise.resolve()

  init(): void {
    // 英雄数据来自公共 CDN，无需 API Key，必须始终加载
    this.champDataReady = this.loadChampionData()

    const apiKey = process.env.RIOT_API_KEY?.trim()
    if (!apiKey || apiKey === 'your_riot_api_key_here') {
      console.warn('[RiotAPI] RIOT_API_KEY not configured (国服可通过 LCU 查战绩，无需配置)')
      return
    }

    this.client = axios.create({
      headers: { 'X-Riot-Token': apiKey },
      timeout: 15000
    })
  }

  async ensureChampionData(): Promise<void> {
    await this.champDataReady
  }

  isConfigured(): boolean {
    return this.client !== null
  }

  getDdragonVersion(): string {
    return this.ddragonVersion
  }

  private async loadChampionData(): Promise<void> {
    try {
      const versionsRes = await axios.get<string[]>(
        'https://ddragon.leagueoflegends.com/api/versions.json'
      )
      this.ddragonVersion = versionsRes.data[0] ?? this.ddragonVersion

      const champRes = await axios.get<{ data: Record<string, DDragonChampion> }>(
        `https://ddragon.leagueoflegends.com/cdn/${this.ddragonVersion}/data/zh_CN/champion.json`
      )

      for (const champ of Object.values(champRes.data.data)) {
        this.championMap.set(Number(champ.key), { name: champ.name, imageId: champ.id })
      }
    } catch (error) {
      console.error('[RiotAPI] Failed to load champion data', error)
    }
  }

  getChampionName(championId: number): string {
    return this.championMap.get(championId)?.name ?? `Champion${championId}`
  }

  getChampionImageId(championId: number): string {
    return this.championMap.get(championId)?.imageId ?? 'Aatrox'
  }

  getChampionIdByImageId(imageId: string): number {
    const lower = imageId.toLowerCase()
    for (const [id, info] of this.championMap.entries()) {
      if (info.imageId.toLowerCase() === lower) return id
    }
    return 0
  }

  private ensureClient(): AxiosInstance {
    if (!this.client) throw new Error('Riot API Key 未配置，请在 .env 中设置 RIOT_API_KEY')
    return this.client
  }

  async getPuuid(gameName: string, tagLine: string): Promise<string> {
    const riotId = `${gameName}#${tagLine}`
    const cached = this.puuidCache.get(riotId)
    if (cached) return cached

    const client = this.ensureClient()
    const encodedName = encodeURIComponent(gameName)
    const encodedTag = encodeURIComponent(tagLine)

    const { data } = await this.limiter.run(() =>
      client.get<{ puuid: string }>(
        `${ACCOUNT_REGION}/riot/account/v1/accounts/by-riot-id/${encodedName}/${encodedTag}`
      )
    )

    this.puuidCache.set(riotId, data.puuid)
    return data.puuid
  }

  async getPlayerHistory(
    gameName: string,
    tagLine: string,
    options?: { championId?: number; championName?: string; team?: 'ally' | 'enemy' }
  ): Promise<PlayerWithHistory> {
    const riotId = `${gameName}#${tagLine}`
    const cacheKey = `${riotId}:${options?.championId ?? 0}`
    const cached = this.historyCache.get(cacheKey)
    if (cached && !cached.loading) return cached

    const loadingPlayer: PlayerWithHistory = {
      puuid: '',
      gameName,
      tagLine,
      riotId,
      championId: options?.championId,
      championName: options?.championName,
      team: options?.team,
      matches: [],
      loading: true
    }
    this.historyCache.set(cacheKey, loadingPlayer)

    try {
      const puuid = await this.getPuuid(gameName, tagLine)
      const client = this.ensureClient()

      const { data: matchIds } = await this.limiter.run(() =>
        client.get<string[]>(
          `${MATCH_REGION}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`
        )
      )

      const matches: MatchSummary[] = []
      for (const matchId of matchIds) {
        const match = await this.fetchMatchSummary(matchId, puuid)
        if (match) matches.push(match)
      }

      const result: PlayerWithHistory = {
        puuid,
        gameName,
        tagLine,
        riotId,
        championId: options?.championId,
        championName: options?.championName,
        team: options?.team,
        matches,
        loading: false
      }
      this.historyCache.set(cacheKey, result)
      return result
    } catch (error) {
      const failed: PlayerWithHistory = {
        puuid: '',
        gameName,
        tagLine,
        riotId,
        championId: options?.championId,
        championName: options?.championName,
        team: options?.team,
        matches: [],
        loading: false,
        error: error instanceof Error ? error.message : '查询失败'
      }
      this.historyCache.set(cacheKey, failed)
      return failed
    }
  }

  private async fetchMatchSummary(matchId: string, puuid: string): Promise<MatchSummary | null> {
    const client = this.ensureClient()

    const { data } = await this.limiter.run(() =>
      client.get<{
        info: {
          gameDuration: number
          gameCreation: number
          participants: Array<{
            puuid: string
            championId: number
            win: boolean
            kills: number
            deaths: number
            assists: number
            totalMinionsKilled: number
            neutralMinionsKilled: number
            item0: number
            item1: number
            item2: number
            item3: number
            item4: number
            item5: number
            item6: number
          }>
        }
      }>(`${MATCH_REGION}/lol/match/v5/matches/${matchId}`)
    )

    const participant = data.info.participants.find((p) => p.puuid === puuid)
    if (!participant) return null

    return {
      matchId,
      championId: participant.championId,
      championName: this.getChampionName(participant.championId),
      championImageId: this.getChampionImageId(participant.championId),
      win: participant.win,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
      items: [
        participant.item0,
        participant.item1,
        participant.item2,
        participant.item3,
        participant.item4,
        participant.item5,
        participant.item6
      ].filter((id) => id > 0),
      gameDuration: data.info.gameDuration,
      gameCreation: data.info.gameCreation
    }
  }

  async searchPlayer(riotIdInput: string): Promise<PlayerWithHistory> {
    const trimmed = riotIdInput.trim()
    const hashIndex = trimmed.lastIndexOf('#')
    if (hashIndex <= 0) throw new Error('请输入正确格式：游戏名#标签')

    const gameName = trimmed.slice(0, hashIndex)
    const tagLine = trimmed.slice(hashIndex + 1)
    return this.getPlayerHistory(gameName, tagLine)
  }

  clearCache(): void {
    this.historyCache.clear()
  }
}

export const riotApi = new RiotApiService()
