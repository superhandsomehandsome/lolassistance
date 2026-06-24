import axios from 'axios'
import https from 'https'
import type { LivePlayer } from '../../shared/types'

const httpsAgent = new https.Agent({ rejectUnauthorized: false })
const LIVE_CLIENT_URL = 'https://127.0.0.1:2999/liveclientdata/playerlist'

interface LiveClientPlayer {
  summonerName: string
  riotId?: string
  riotIdGameName?: string
  riotIdTagLine?: string
  team: 'ORDER' | 'CHAOS'
  championName: string
  summonerSpells?: {
    summonerSpellOne?: { rawDisplayName?: string; displayName?: string }
    summonerSpellTwo?: { rawDisplayName?: string; displayName?: string }
  }
}

type LivePlayersListener = (players: LivePlayer[]) => void

class LiveClientService {
  private pollTimer: NodeJS.Timeout | null = null
  private active = false
  private lastKey = ''
  private listeners = new Set<LivePlayersListener>()
  private localTeam: 'ORDER' | 'CHAOS' | null = null

  onPlayersUpdate(listener: LivePlayersListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => void this.poll(), 2000)
    void this.poll()
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.active = false
    this.lastKey = ''
    this.localTeam = null
  }

  private async poll(): Promise<void> {
    try {
      const { data } = await axios.get<LiveClientPlayer[]>(LIVE_CLIENT_URL, {
        httpsAgent,
        timeout: 3000
      })

      if (!Array.isArray(data) || data.length === 0) {
        this.active = false
        return
      }

      this.active = true

      if (!this.localTeam) {
        try {
          const activeRes = await axios.get<{ summonerName?: string; riotId?: string; team?: 'ORDER' | 'CHAOS' }>(
            'https://127.0.0.1:2999/liveclientdata/activeplayer',
            { httpsAgent, timeout: 3000 }
          )

          if (activeRes.data.team) {
            this.localTeam = activeRes.data.team
          } else {
            // fallback：用 activeplayer 的名字在 playerlist 里找对应的队伍
            const myName = activeRes.data.riotId ?? activeRes.data.summonerName ?? ''
            if (myName) {
              const me = data.find((p) =>
                (p.riotId ?? p.summonerName) === myName || p.summonerName === myName
              )
              if (me) this.localTeam = me.team
            }
          }
        } catch {
          // activeplayer 不可用时，默认第一个玩家队伍（ORDER 常为蓝方）
        }
      }

      const players: LivePlayer[] = data.map((p) => {
        const gameName = p.riotIdGameName ?? p.summonerName
        const tagLine = p.riotIdTagLine ?? ''
        const riotId = p.riotId ?? (tagLine ? `${gameName}#${tagLine}` : gameName)
        const isAlly = this.localTeam ? p.team === this.localTeam : false

        const spell1Raw = p.summonerSpells?.summonerSpellOne?.rawDisplayName ?? ''
        const spell2Raw = p.summonerSpells?.summonerSpellTwo?.rawDisplayName ?? ''
        const spell1Id = spell1Raw.replace('GeneratedTip_SummonerSpell_', '').replace('_DisplayName', '')
        const spell2Id = spell2Raw.replace('GeneratedTip_SummonerSpell_', '').replace('_DisplayName', '')

        return {
          summonerName: p.summonerName,
          riotId,
          riotIdGameName: gameName,
          riotIdTagLine: tagLine,
          team: p.team,
          championName: p.championName,
          isAlly,
          spell1Id: spell1Id || 'SummonerFlash',
          spell2Id: spell2Id || 'SummonerFlash'
        }
      })

      const key = players.map((p) => `${p.riotId}:${p.championName}`).join('|')
      if (key === this.lastKey) return
      this.lastKey = key

      for (const listener of this.listeners) listener(players)
    } catch {
      if (this.active) {
        this.active = false
        this.lastKey = ''
        this.localTeam = null
      }
    }
  }

  isActive(): boolean {
    return this.active
  }
}

export const liveClientService = new LiveClientService()
