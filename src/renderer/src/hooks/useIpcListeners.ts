import { useEffect } from 'react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { ChampSelectState, GamePhase, LcuStatus, LivePlayer, TeamData } from '../../../shared/types'
import { useAppStore } from '@/stores/app-store'

export function useIpcListeners(): void {
  const setLcuStatus = useAppStore((s) => s.setLcuStatus)
  const setGamePhase = useAppStore((s) => s.setGamePhase)
  const setTeamData = useAppStore((s) => s.setTeamData)
  const setLivePlayers = useAppStore((s) => s.setLivePlayers)
  const setChampSelectState = useAppStore((s) => s.setChampSelectState)

  useEffect(() => {
    const unsubs = [
      window.api.on(IPC_CHANNELS.LCU_STATUS, (status) => {
        const s = status as LcuStatus
        setLcuStatus(s)
        if (s.gamePhase) setGamePhase(s.gamePhase)
      }),
      window.api.on(IPC_CHANNELS.LCU_GAME_PHASE, (phase) => {
        setGamePhase(phase as GamePhase)
      }),
      window.api.on(IPC_CHANNELS.TEAM_DATA_UPDATE, (data) => {
        setTeamData(data as TeamData)
      }),
      window.api.on(IPC_CHANNELS.GAME_LIVE_PLAYERS, (data) => {
        setLivePlayers(data as LivePlayer[])
      }),
      window.api.on(IPC_CHANNELS.CHAMP_SELECT_UPDATE, (data) => {
        setChampSelectState(data as ChampSelectState)
      })
    ]

    void window.api.invoke(IPC_CHANNELS.LCU_GET_STATUS).then((status) => {
      if (status) {
        const s = status as LcuStatus
        setLcuStatus(s)
        if (s.gamePhase) setGamePhase(s.gamePhase)
      }
    })

    void window.api.invoke(IPC_CHANNELS.MATCH_TEAM_PLAYERS).then((data) => {
      if (data) setTeamData(data as TeamData)
    })

    return () => unsubs.forEach((u) => u())
  }, [setLcuStatus, setGamePhase, setTeamData, setLivePlayers, setChampSelectState])
}
