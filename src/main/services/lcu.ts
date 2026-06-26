import axios, { type AxiosInstance } from 'axios'
import https from 'https'
import WebSocket from 'ws'
import type {
  ChampSelectState,
  ChampSelectPlayer,
  GamePhase,
  Lane,
  MatchDetail,
  MatchParticipantDetail,
  MatchSummary,
  MatchTeamDetail
} from '../../shared/types'
import { getQueueName, getMapName } from '../../shared/match-labels'
import { findLockfile, type LockfileInfo } from './lockfile'
import { riotApi } from './riot-api'

const httpsAgent = new https.Agent({ rejectUnauthorized: false })

interface ChampSelectCell {
  cellId: number
  championId: number
  championPickIntent: number
  summonerId: number
  team: number
  assignedPosition?: string
}

interface ChampSelectAction {
  id: number
  actorCellId: number
  championId: number
  type: 'ban' | 'pick'
  completed: boolean
  isInProgress: boolean
}

interface ChampSelectSession {
  myTeam: ChampSelectCell[]
  theirTeam: ChampSelectCell[]
  localPlayerCellId: number
  actions?: ChampSelectAction[][]
  timer?: { phase: string }
}

interface LcuSummoner {
  gameName: string
  tagLine: string
  puuid: string
  summonerId: number
}

export interface AllyPlayerInfo {
  summonerId: number
  gameName: string
  tagLine: string
  riotId: string
  championId: number
}

interface LcuMatchParticipantStats {
  win: boolean
  champLevel: number
  kills: number
  deaths: number
  assists: number
  totalMinionsKilled: number
  neutralMinionsKilled: number
  goldEarned: number
  totalDamageDealtToChampions: number
  totalDamageTaken: number
  physicalDamageDealtToChampions: number
  magicDamageDealtToChampions: number
  trueDamageDealtToChampions: number
  visionScore: number
  wardsPlaced: number
  wardsKilled: number
  doubleKills: number
  tripleKills: number
  quadraKills: number
  pentaKills: number
  largestMultiKill: number
  largestKillingSpree: number
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
}

interface LcuMatchParticipant {
  participantId?: number
  championId: number
  spell1Id?: number
  spell2Id?: number
  teamId?: number
  stats: LcuMatchParticipantStats
}

interface LcuMatchTeam {
  teamId: number
  win: string
}

interface LcuMatchGame {
  gameId: number
  platformId: string
  gameCreation: number
  gameDuration: number
  queueId: number
  mapId: number
  gameMode: string
  gameType?: string
  teams?: LcuMatchTeam[]
  participants: LcuMatchParticipant[]
  participantIdentities?: Array<{
    participantId: number
    player: { gameName?: string; tagLine?: string; summonerName?: string }
  }>
}

interface LcuMatchHistoryResponse {
  games: {
    games: LcuMatchGame[]
  }
}

function mapLcuGameToSummary(game: LcuMatchGame, participantIndex = 0): MatchSummary | null {
  const p = game.participants[participantIndex]
  if (!p) return null

  const s = p.stats
  const items = [s.item0, s.item1, s.item2, s.item3, s.item4, s.item5, s.item6].filter(
    (id) => id > 0
  )

  return {
    matchId: `${game.platformId}_${game.gameId}`,
    gameId: game.gameId,
    championId: p.championId,
    championName: riotApi.getChampionName(p.championId),
    championImageId: riotApi.getChampionImageId(p.championId),
    win: s.win,
    kills: s.kills,
    deaths: s.deaths,
    assists: s.assists,
    cs: s.totalMinionsKilled + s.neutralMinionsKilled,
    items,
    gameDuration: game.gameDuration,
    gameCreation: game.gameCreation,
    queueId: game.queueId,
    queueName: getQueueName(game.queueId, game.gameMode, game.mapId),
    gameMode: game.gameMode,
    goldEarned: s.goldEarned,
    damage: s.totalDamageDealtToChampions,
    visionScore: s.visionScore,
    spell1Id: p.spell1Id,
    spell2Id: p.spell2Id,
    doubleKills: s.doubleKills,
    tripleKills: s.tripleKills,
    quadraKills: s.quadraKills,
    pentaKills: s.pentaKills
  }
}

function mapLcuGameToDetail(game: LcuMatchGame): MatchDetail {
  const nameByParticipant = new Map<number, string>()
  for (const identity of game.participantIdentities ?? []) {
    const player = identity.player
    const name = player.gameName
      ? player.tagLine
        ? `${player.gameName}#${player.tagLine}`
        : player.gameName
      : (player.summonerName ?? '未知')
    nameByParticipant.set(identity.participantId, name)
  }

  const participants: MatchParticipantDetail[] = game.participants.map((p, index) => {
    const s = p.stats
    const participantId = p.participantId ?? index + 1
    const teamId = p.teamId ?? (participantId <= 5 ? 100 : 200)
    return {
      participantId,
      championId: p.championId,
      championName: riotApi.getChampionName(p.championId),
      championImageId: riotApi.getChampionImageId(p.championId),
      summonerName: nameByParticipant.get(participantId) ?? `玩家 ${participantId}`,
      champLevel: s.champLevel ?? 1,
      spell1Id: p.spell1Id ?? 0,
      spell2Id: p.spell2Id ?? 0,
      items: [s.item0, s.item1, s.item2, s.item3, s.item4, s.item5, s.item6],
      kills: s.kills,
      deaths: s.deaths,
      assists: s.assists,
      cs: s.totalMinionsKilled + s.neutralMinionsKilled,
      goldEarned: s.goldEarned ?? 0,
      damage: s.totalDamageDealtToChampions ?? 0,
      totalDamageTaken: s.totalDamageTaken ?? 0,
      physicalDamage: s.physicalDamageDealtToChampions ?? 0,
      magicDamage: s.magicDamageDealtToChampions ?? 0,
      trueDamage: s.trueDamageDealtToChampions ?? 0,
      visionScore: s.visionScore ?? 0,
      wardsPlaced: s.wardsPlaced ?? 0,
      wardsKilled: s.wardsKilled ?? 0,
      win: s.win,
      teamId,
      doubleKills: s.doubleKills ?? 0,
      tripleKills: s.tripleKills ?? 0,
      quadraKills: s.quadraKills ?? 0,
      pentaKills: s.pentaKills ?? 0,
      largestMultiKill: s.largestMultiKill ?? 0,
      largestKillingSpree: s.largestKillingSpree ?? 0
    }
  })

  const teamMap = new Map<number, MatchTeamDetail>()
  for (const t of game.teams ?? []) {
    teamMap.set(t.teamId, {
      teamId: t.teamId,
      win: t.win === 'Win',
      totalKills: 0,
      totalDeaths: 0,
      totalAssists: 0,
      totalGold: 0
    })
  }
  for (const p of participants) {
    let team = teamMap.get(p.teamId)
    if (!team) {
      team = { teamId: p.teamId, win: p.win, totalKills: 0, totalDeaths: 0, totalAssists: 0, totalGold: 0 }
      teamMap.set(p.teamId, team)
    }
    team.totalKills += p.kills
    team.totalDeaths += p.deaths
    team.totalAssists += p.assists
    team.totalGold += p.goldEarned
  }

  return {
    matchId: `${game.platformId}_${game.gameId}`,
    gameId: game.gameId,
    queueId: game.queueId,
    queueName: getQueueName(game.queueId, game.gameMode, game.mapId),
    mapName: getMapName(game.mapId),
    gameDuration: game.gameDuration,
    gameCreation: game.gameCreation,
    teams: Array.from(teamMap.values()),
    participants
  }
}

type PhaseListener = (phase: GamePhase) => void
type AllyListener = (allies: AllyPlayerInfo[]) => void
type StatusListener = () => void
type ChampSelectListener = (state: ChampSelectState) => void

class LcuService {
  private lockfile: LockfileInfo | null = null
  private ws: WebSocket | null = null
  private client: AxiosInstance | null = null
  private pollTimer: NodeJS.Timeout | null = null
  private currentPhase: GamePhase = 'None'
  private phaseListeners = new Set<PhaseListener>()
  private allyListeners = new Set<AllyListener>()
  private statusListeners = new Set<StatusListener>()
  private champSelectListeners = new Set<ChampSelectListener>()
  private lastAllyKey = ''
  private consecutiveErrors = 0
  private lastChampSelectState: ChampSelectState | null = null

  onPhaseChange(listener: PhaseListener): () => void {
    this.phaseListeners.add(listener)
    return () => this.phaseListeners.delete(listener)
  }

  onAlliesUpdate(listener: AllyListener): () => void {
    this.allyListeners.add(listener)
    return () => this.allyListeners.delete(listener)
  }

  onStatusUpdate(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  onChampSelectUpdate(listener: ChampSelectListener): () => void {
    this.champSelectListeners.add(listener)
    return () => this.champSelectListeners.delete(listener)
  }

  getChampSelectState(): ChampSelectState | null {
    return this.lastChampSelectState
  }

  private notifyStatus(): void {
    for (const listener of this.statusListeners) listener()
  }

  getPhase(): GamePhase {
    return this.currentPhase
  }

  isConnected(): boolean {
    return this.lockfile !== null && this.client !== null
  }

  getStatus() {
    return {
      connected: this.isConnected(),
      gamePhase: this.currentPhase,
      lockfilePath: this.lockfile?.path,
      port: this.lockfile?.port
    }
  }

  start(): void {
    this.pollTimer = setInterval(() => void this.tick(), 2000)
    void this.tick()
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.disconnect()
  }

  private async tick(): Promise<void> {
    const found = findLockfile()

    if (!found) {
      if (this.lockfile) this.disconnect()
      this.setPhase('None')
      this.notifyStatus()
      return
    }

    if (
      !this.lockfile ||
      found.port !== this.lockfile.port ||
      found.password !== this.lockfile.password
    ) {
      this.connect(found)
    }

    if (!this.client) return

    try {
      const { data } = await this.client.get<string>('/lol-gameflow/v1/gameflow-phase')
      this.consecutiveErrors = 0
      this.setPhase(this.normalizePhase(data))
      this.notifyStatus()

      if (data === 'ChampSelect') {
        await this.handleChampSelect()
      }
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code
      this.consecutiveErrors++

      if (code === 'ECONNREFUSED' || code === 'ECONNRESET') {
        console.log('[LCU] 客户端未响应，等待重连...', `(${this.consecutiveErrors}次)`)
      } else {
        console.warn('[LCU] Poll error:', code ?? (error instanceof Error ? error.message : 'unknown'))
      }

      // 连续失败超过阈值才真正断开，避免游戏中瞬时错误导致客户端被标记为断开
      if (this.consecutiveErrors >= 5) {
        this.disconnect()
        this.setPhase('None')
        this.notifyStatus()
      }
    }
  }

  private connect(lockfile: LockfileInfo): void {
    this.disconnect()
    this.lockfile = lockfile
    this.client = axios.create({
      baseURL: `${lockfile.protocol}://127.0.0.1:${lockfile.port}`,
      headers: { Authorization: `Basic ${lockfile.authToken}` },
      httpsAgent,
      timeout: 5000
    })
    this.connectWebSocket(lockfile)
  }

  private disconnect(): void {
    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws.close()
      this.ws = null
    }
    this.client = null
    this.lockfile = null
    this.lastAllyKey = ''
    this.consecutiveErrors = 0
  }

  private connectWebSocket(lockfile: LockfileInfo): void {
    const ws = new WebSocket(`wss://127.0.0.1:${lockfile.port}`, {
      headers: { Authorization: `Basic ${lockfile.authToken}` },
      rejectUnauthorized: false
    })

    ws.on('open', () => {
      ws.send(JSON.stringify([5, 'OnJsonApiEvent', '/lol-gameflow/v1/gameflow-phase']))
      ws.send(JSON.stringify([5, 'OnJsonApiEvent', '/lol-champ-select/v1/session']))
    })

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as [number, string, { uri?: string; data?: unknown }]
        if (msg[0] !== 8) return

        const event = msg[2]
        if (!event?.uri) return

        if (event.uri === '/lol-gameflow/v1/gameflow-phase' && typeof event.data === 'string') {
          this.setPhase(this.normalizePhase(event.data))
        }

        if (event.uri === '/lol-champ-select/v1/session') {
          void this.handleChampSelect()
        }
      } catch {
        // ignore malformed ws messages
      }
    })

    ws.on('error', (err: NodeJS.ErrnoException) => {
      const code = err?.code
      if (code !== 'ECONNREFUSED' && code !== 'ECONNRESET') {
        console.warn('[LCU] WebSocket error:', code ?? err.message)
      }
      // 连接失败由 tick() 轮询机制负责重连，此处只需静默忽略
    })

    ws.on('close', () => {
      this.ws = null
    })

    this.ws = ws
  }

  private normalizePhase(phase: string): GamePhase {
    const known: GamePhase[] = [
      'None',
      'Lobby',
      'Matchmaking',
      'ReadyCheck',
      'ChampSelect',
      'GameStart',
      'InProgress',
      'EndOfGame',
      'WaitingForStats',
      'PreEndOfGame'
    ]
    return known.includes(phase as GamePhase) ? (phase as GamePhase) : 'Unknown'
  }

  private setPhase(phase: GamePhase): void {
    if (this.currentPhase === phase) return
    this.currentPhase = phase
    for (const listener of this.phaseListeners) listener(phase)
  }

  private positionToLane(pos: string): Lane | null {
    const map: Record<string, Lane> = {
      top: 'top', jungle: 'jungle', middle: 'middle', bottom: 'bottom', utility: 'support'
    }
    return map[pos?.toLowerCase()] ?? null
  }

  private async buildChampSelectPlayer(cell: ChampSelectCell): Promise<ChampSelectPlayer> {
    const champId = cell.championId || cell.championPickIntent || 0
    return {
      summonerId: cell.summonerId,
      championId: champId,
      championName: champId > 0 ? riotApi.getChampionName(champId) : '',
      championImageId: champId > 0 ? riotApi.getChampionImageId(champId) : '',
      assignedPosition: cell.assignedPosition ?? ''
    }
  }

  private async handleChampSelect(): Promise<void> {
    if (!this.client) return
    await riotApi.ensureChampionData()

    try {
      const { data: session } = await this.client.get<ChampSelectSession>('/lol-champ-select/v1/session')
      const allies: AllyPlayerInfo[] = []

      const myTeamPlayers: ChampSelectPlayer[] = []
      const theirTeamPlayers: ChampSelectPlayer[] = []
      let myChampionId = 0
      let myLane: Lane | null = null

      const bans: number[] = []
      let selectPhase: ChampSelectState['phase'] = 'unknown'

      if (session.timer?.phase) {
        const tp = session.timer.phase.toLowerCase()
        if (tp.includes('ban')) selectPhase = 'ban'
        else if (tp.includes('pick') || tp.includes('planning')) selectPhase = 'pick'
        else if (tp.includes('finalization')) selectPhase = 'finalization'
      }

      if (session.actions) {
        for (const actionGroup of session.actions) {
          for (const action of actionGroup) {
            if (action.type === 'ban' && action.completed && action.championId > 0) {
              bans.push(action.championId)
            }
          }
        }
      }

      for (const cell of session.myTeam) {
        myTeamPlayers.push(await this.buildChampSelectPlayer(cell))

        if (cell.cellId === session.localPlayerCellId) {
          myChampionId = cell.championId || cell.championPickIntent || 0
          myLane = this.positionToLane(cell.assignedPosition ?? '')
        }

        if (!cell.summonerId || cell.summonerId <= 0) continue

        const { data: summoner } = await this.client.get<LcuSummoner>(
          `/lol-summoner/v1/summoners/${cell.summonerId}`
        )

        allies.push({
          summonerId: cell.summonerId,
          gameName: summoner.gameName,
          tagLine: summoner.tagLine,
          riotId: `${summoner.gameName}#${summoner.tagLine}`,
          championId: cell.championId || cell.championPickIntent || 0
        })
      }

      for (const cell of session.theirTeam) {
        theirTeamPlayers.push(await this.buildChampSelectPlayer(cell))
      }

      const csState: ChampSelectState = {
        myTeam: myTeamPlayers,
        theirTeam: theirTeamPlayers,
        myChampionId,
        myLane,
        bans,
        phase: selectPhase
      }
      this.lastChampSelectState = csState
      for (const listener of this.champSelectListeners) listener(csState)

      const key = allies.map((a) => `${a.summonerId}:${a.championId}`).join('|')
      if (key === this.lastAllyKey || allies.length === 0) return
      this.lastAllyKey = key

      for (const listener of this.allyListeners) listener(allies)
    } catch {
      // champ select session may not be ready yet
    }
  }

  // ---- 战绩查询（通过 LCU 本地接口，国服可用） ----

  /**
   * 通过召唤师名或 RiotID 查找召唤师信息（含 PUUID）。
   * 支持格式："游戏名#标签" 或 "游戏名"。
   */
  async getSummonerByName(name: string): Promise<LcuSummoner | null> {
    if (!this.client) return null
    try {
      const { data } = await this.client.get<LcuSummoner>('/lol-summoner/v1/summoners', {
        params: { name }
      })
      return data
    } catch {
      return null
    }
  }

  async getSummonerByPuuid(puuid: string): Promise<LcuSummoner | null> {
    if (!this.client) return null
    try {
      const { data } = await this.client.get<LcuSummoner>(
        `/lol-summoner/v2/summoners/puuid/${puuid}`
      )
      return data
    } catch {
      return null
    }
  }

  /**
   * 通过 PUUID 查询战绩（最近 count 场）。
   * 这是 LCU 本地接口，可查询任意玩家，不受隐私设置限制。
   */
  async getMatchHistory(puuid: string, count = 10): Promise<MatchSummary[]> {
    if (!this.client) return []
    try {
      const { data } = await this.client.get<LcuMatchHistoryResponse>(
        `/lol-match-history/v1/products/lol/${puuid}/matches`,
        { params: { begIndex: 0, endIndex: count - 1 } }
      )

      const games = data?.games?.games
      if (!Array.isArray(games)) return []

      return games
        .map((g) => mapLcuGameToSummary(g))
        .filter((m): m is MatchSummary => m !== null)
    } catch (error) {
      console.error('[LCU] Failed to fetch match history', error)
      return []
    }
  }

  async getMatchDetail(gameId: number): Promise<MatchDetail | null> {
    if (!this.client) return null
    try {
      const { data } = await this.client.get<LcuMatchGame>(`/lol-match-history/v1/games/${gameId}`)
      if (!data?.participants?.length) return null
      return mapLcuGameToDetail(data)
    } catch (error) {
      console.error('[LCU] Failed to fetch match detail', error)
      return null
    }
  }

  /** 获取 LCU HTTP 客户端（供外部 fallback 使用） */
  getClient(): AxiosInstance | null {
    return this.client
  }

  /**
   * 设置客户端在线状态和自定义状态文字（好友可见）。
   * 国服经实测可用：PUT /lol-chat/v1/me 带完整 body 能写入并广播给好友。
   * @param status 状态类型：chat(在线) / dnd(忙碌) / away(离开) / invisible(隐身)
   * @param message 自定义状态文字（好友名字下方显示），空字符串清除
   */
  async setOnlineStatus(status: 'chat' | 'away' | 'invisible', message: string): Promise<void> {
    if (!this.client) throw new Error('LCU 未连接，请先启动并登录客户端')
    // 必须先读当前 me，再合并修改后整体 PUT（部分字段 PATCH 在国服被锁，PUT 完整 body 才行）
    // 注意：国服屏蔽了 dnd（忙碌），传入 dnd 会被服务端强制改回 chat，因此此处类型去掉 dnd
    const { data: me } = await this.client.get<Record<string, unknown>>('/lol-chat/v1/me')
    await this.client.put('/lol-chat/v1/me', { ...me, availability: status, statusMessage: message })
  }

  /** 读取当前客户端在线状态和自定义文字 */
  async getOnlineStatus(): Promise<{ status: string; message: string } | null> {
    if (!this.client) return null
    try {
      const { data } = await this.client.get<{ availability?: string; statusMessage?: string }>('/lol-chat/v1/me')
      return { status: data.availability ?? 'chat', message: data.statusMessage ?? '' }
    } catch {
      return null
    }
  }
}

export const lcuService = new LcuService()
