import { create } from 'zustand'
import type {
  ChampionTier,
  ChampSelectState,
  GamePhase,
  Lane,
  LcuStatus,
  LivePlayer,
  PlayerWithHistory,
  RankBracket,
  TeamData,
  TierListData
} from '../../../shared/types'

export type AppPage = 'match-history' | 'spell-tracker' | 'champion-rank' | 'draft-assistant' | 'settings'

interface AppState {
  currentPage: AppPage
  setCurrentPage: (page: AppPage) => void

  lcuStatus: LcuStatus
  setLcuStatus: (status: LcuStatus) => void

  gamePhase: GamePhase
  setGamePhase: (phase: GamePhase) => void

  teamData: TeamData
  setTeamData: (data: TeamData) => void

  searchResult: PlayerWithHistory | null
  setSearchResult: (player: PlayerWithHistory | null) => void

  tierList: TierListData | null
  setTierList: (data: TierListData | null) => void

  selectedLane: Lane
  setSelectedLane: (lane: Lane) => void

  selectedRankBracket: RankBracket
  setSelectedRankBracket: (bracket: RankBracket) => void

  livePlayers: LivePlayer[]
  setLivePlayers: (players: LivePlayer[]) => void

  champSelectState: ChampSelectState | null
  setChampSelectState: (state: ChampSelectState | null) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'match-history',
  setCurrentPage: (page) => set({ currentPage: page }),

  lcuStatus: { connected: false, gamePhase: 'None' },
  setLcuStatus: (status) => set({ lcuStatus: status }),

  gamePhase: 'None',
  setGamePhase: (phase) => set({ gamePhase: phase }),

  teamData: { allies: [], enemies: [], phase: 'None', updatedAt: 0 },
  setTeamData: (data) => set({ teamData: data }),

  searchResult: null,
  setSearchResult: (player) => set({ searchResult: player }),

  tierList: null,
  setTierList: (data) => set({ tierList: data }),

  selectedLane: 'top',
  setSelectedLane: (lane) => set({ selectedLane: lane }),

  selectedRankBracket: 'emerald_plus',
  setSelectedRankBracket: (bracket) => set({ selectedRankBracket: bracket }),

  livePlayers: [],
  setLivePlayers: (players) => set({ livePlayers: players }),

  champSelectState: null,
  setChampSelectState: (state) => set({ champSelectState: state })
}))

export function getTierChampions(
  tierList: TierListData | null,
  lane: Lane,
  tier: ChampionTier['tier']
): ChampionTier[] {
  if (!tierList) return []
  return tierList.lanes[lane]?.filter((c) => c.tier === tier) ?? []
}
