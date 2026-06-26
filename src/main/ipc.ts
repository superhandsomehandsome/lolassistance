import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import type { Lane, RankBracket } from '../shared/types'
import { championDataService } from './services/champion-data'
import { getSettings, loadSettings, updateSettings } from './services/config'
import {
  getCurrentTeamData,
  getMatchDetail,
  getPlayerHistory,
  searchPlayer,
  startGameCoordinator
} from './services/game-coordinator'
import { registerSpellHotkey } from './services/hotkey'
import { lcuService } from './services/lcu'
import {
  consumePendingSpell,
  dismissPendingSpell,
  getPendingSpells
} from './services/pending-spells'
import { riotApi } from './services/riot-api'
import { tierListService } from './services/tier-list'

export function registerIpcHandlers(): void {
  loadSettings()
  riotApi.init()

  ipcMain.handle(IPC_CHANNELS.PING, async () => 'pong')

  ipcMain.handle(IPC_CHANNELS.LCU_GET_STATUS, async () => lcuService.getStatus())

  ipcMain.handle(IPC_CHANNELS.MATCH_TEAM_PLAYERS, async () => getCurrentTeamData())

  ipcMain.handle(IPC_CHANNELS.MATCH_PLAYER_HISTORY, async (_e, gameName: string, tagLine: string) =>
    getPlayerHistory(gameName, tagLine)
  )

  ipcMain.handle(IPC_CHANNELS.MATCH_SEARCH, async (_e, riotId: string) => searchPlayer(riotId))

  ipcMain.handle(IPC_CHANNELS.MATCH_GET_DETAIL, async (_e, gameId: number) =>
    getMatchDetail(gameId)
  )

  ipcMain.handle(
    IPC_CHANNELS.TIER_GET_LIST,
    async (_e, rankBracket?: RankBracket, force?: boolean) =>
      tierListService.getTierList(rankBracket ?? 'emerald_plus', Boolean(force))
  )

  ipcMain.handle(
    IPC_CHANNELS.CHAMPION_DATA_GET,
    async (_e, championId: number, lane: Lane, tier?: RankBracket) => {
      const data = await championDataService.getChampionData(championId, lane, tier ?? 'emerald_plus')
      return {
        championId: data.championId,
        championName: data.championName,
        lane: data.lane,
        tier: data.tier,
        matchups: data.matchups,
        bestCounters: data.bestCounters,
        worstCounters: data.worstCounters,
        builds: data.builds,
        runes: data.runes
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.CHAMPION_COUNTER_PICKS,
    async (_e, opponentId: number, lane: Lane, tier?: RankBracket) =>
      championDataService.getCounterPicks(opponentId, lane, tier ?? 'emerald_plus')
  )

  ipcMain.handle(IPC_CHANNELS.CHAMP_SELECT_SESSION, async () => lcuService.getChampSelectState())

  ipcMain.handle(IPC_CHANNELS.CHAMPION_SEARCH_INDEX, async () =>
    riotApi.getChampionSearchIndex()
  )

  ipcMain.handle(
    IPC_CHANNELS.CLIENT_STATUS_SET,
    async (_e, status: 'chat' | 'dnd' | 'away' | 'invisible', message: string) => {
      await lcuService.setOnlineStatus(status, message)
      return lcuService.getOnlineStatus()
    }
  )

  ipcMain.handle(IPC_CHANNELS.CLIENT_STATUS_GET, async () => lcuService.getOnlineStatus())

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => ({
    ...getSettings(),
    riotApiConfigured: riotApi.isConfigured()
  }))

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_LOL_PATH, async (_e, path: string) => {
    updateSettings({ lolInstallPath: path })
    return getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_HOTKEY, async (_e, hotkey: string) => {
    const success = registerSpellHotkey(hotkey)
    if (success) {
      updateSettings({ spellHotkey: hotkey })
    }
    return { success, hotkey: success ? hotkey : getSettings().spellHotkey ?? 'F6' }
  })

  ipcMain.handle(IPC_CHANNELS.SPELL_PENDING_LIST, async () => getPendingSpells())

  ipcMain.handle(IPC_CHANNELS.SPELL_PENDING_CONSUME, async () => consumePendingSpell())

  ipcMain.handle(IPC_CHANNELS.SPELL_PENDING_DISMISS, async (_e, id: string) =>
    dismissPendingSpell(id)
  )

  startGameCoordinator()
}
