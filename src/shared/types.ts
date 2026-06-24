export type GamePhase =
  | 'None'
  | 'Lobby'
  | 'Matchmaking'
  | 'ReadyCheck'
  | 'ChampSelect'
  | 'GameStart'
  | 'InProgress'
  | 'EndOfGame'
  | 'WaitingForStats'
  | 'PreEndOfGame'
  | 'Disconnected'
  | 'Unknown'

export type Lane = 'top' | 'jungle' | 'middle' | 'bottom' | 'support'

export type RankBracket =
  | 'emerald_plus'
  | 'iron'
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'emerald'
  | 'diamond'
  | 'master'
  | 'grandmaster'

export const RANK_BRACKET_OPTIONS: Array<{ id: RankBracket; label: string }> = [
  { id: 'emerald_plus', label: '翡翠+（默认）' },
  { id: 'iron', label: '黑铁' },
  { id: 'bronze', label: '黄铜' },
  { id: 'silver', label: '白银' },
  { id: 'gold', label: '黄金' },
  { id: 'platinum', label: '铂金' },
  { id: 'emerald', label: '翡翠' },
  { id: 'diamond', label: '钻石' },
  { id: 'master', label: '大师' },
  { id: 'grandmaster', label: '宗师+' }
]

const RANK_BRACKET_IDS = new Set(RANK_BRACKET_OPTIONS.map((option) => option.id))

export function isRankBracket(value: string): value is RankBracket {
  return RANK_BRACKET_IDS.has(value as RankBracket)
}

export function getRankBracketLabel(bracket: RankBracket): string {
  return RANK_BRACKET_OPTIONS.find((o) => o.id === bracket)?.label ?? bracket
}

export type TierLabel = 'T0' | 'T1' | 'T2' | 'T3' | 'T4'

export interface RiotPlayer {
  puuid: string
  gameName: string
  tagLine: string
  riotId: string
}

export interface MatchSummary {
  matchId: string
  gameId?: number
  championId: number
  championName: string
  championImageId?: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  items: number[]
  gameDuration: number
  gameCreation: number
  queueId?: number
  queueName?: string
  gameMode?: string
  goldEarned?: number
  damage?: number
  visionScore?: number
  spell1Id?: number
  spell2Id?: number
  doubleKills?: number
  tripleKills?: number
  quadraKills?: number
  pentaKills?: number
}

export interface MatchParticipantDetail {
  participantId: number
  championId: number
  championName: string
  championImageId?: string
  summonerName: string
  champLevel: number
  spell1Id: number
  spell2Id: number
  items: number[]
  kills: number
  deaths: number
  assists: number
  cs: number
  goldEarned: number
  damage: number
  totalDamageTaken: number
  physicalDamage: number
  magicDamage: number
  trueDamage: number
  visionScore: number
  wardsPlaced: number
  wardsKilled: number
  win: boolean
  teamId: number
  doubleKills: number
  tripleKills: number
  quadraKills: number
  pentaKills: number
  largestMultiKill: number
  largestKillingSpree: number
}

export interface MatchTeamDetail {
  teamId: number
  win: boolean
  totalKills: number
  totalDeaths: number
  totalAssists: number
  totalGold: number
}

export interface MatchDetail {
  matchId: string
  gameId: number
  queueId: number
  queueName: string
  mapName: string
  gameDuration: number
  gameCreation: number
  teams: MatchTeamDetail[]
  participants: MatchParticipantDetail[]
}

export interface PlayerWithHistory {
  puuid: string
  gameName: string
  tagLine: string
  riotId: string
  championId?: number
  championName?: string
  team?: 'ally' | 'enemy'
  matches: MatchSummary[]
  loading?: boolean
  error?: string
}

export interface TeamData {
  allies: PlayerWithHistory[]
  enemies: PlayerWithHistory[]
  phase: GamePhase
  updatedAt: number
}

export interface ChampionTier {
  championId: number
  name: string
  imageId: string
  tier: TierLabel
  tierRank: number
  winRate: number
  pickRate: number
  banRate: number
  lane: Lane
  rank: number
}

export interface TierListData {
  lanes: Record<Lane, ChampionTier[]>
  patch: string
  rankBracket: RankBracket
  rankBracketLabel: string
  dataSource: string
  avgWinRate: number | null
  updatedAt: number
}

export interface LcuStatus {
  connected: boolean
  gamePhase: GamePhase
  lockfilePath?: string
  port?: number
}

export interface AppSettings {
  lolInstallPath?: string
  riotApiKey?: string
  spellHotkey?: string
}

export interface LivePlayer {
  summonerName: string
  riotId: string
  riotIdGameName: string
  riotIdTagLine: string
  team: 'ORDER' | 'CHAOS'
  championName: string
  isAlly: boolean
  spell1Id: string
  spell2Id: string
}

export interface EnemySpellState {
  riotId: string
  championName: string
  spell1Id: string
  spell2Id: string
  spell1UsedAt: number | null
  spell2UsedAt: number | null
  spell1Cooldown: number
  spell2Cooldown: number
}

export interface PendingSpellRecord {
  id: string
  timestamp: number
}

export interface ChampSelectState {
  myTeam: ChampSelectPlayer[]
  theirTeam: ChampSelectPlayer[]
  myChampionId: number
  myLane: Lane | null
  bans: number[]
  phase: 'ban' | 'pick' | 'finalization' | 'unknown'
}

export interface ChampSelectPlayer {
  summonerId: number
  championId: number
  championName: string
  championImageId: string
  assignedPosition: string
}

export interface MatchupInfo {
  opponentId: number
  opponentName: string
  opponentImageId: string
  winRate: number
  games: number
}

export interface ItemBuildInfo {
  items: number[]
  winRate: number
  games: number
  label: string
}

export interface RunePageInfo {
  primaryTree: number
  primaryPerks: number[]
  secondaryTree: number
  secondaryPerks: number[]
  statShards: number[]
  winRate: number
  games: number
  label: string
}

export interface ChampionDataResponse {
  championId: number
  championName: string
  lane: Lane
  tier: RankBracket
  matchups: MatchupInfo[]
  bestCounters: MatchupInfo[]
  worstCounters: MatchupInfo[]
  builds: ItemBuildInfo[]
  runes: RunePageInfo[]
}
