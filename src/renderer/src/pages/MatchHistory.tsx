import { useState } from 'react'
import { Search } from 'lucide-react'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'
import type { PlayerWithHistory } from '../../../shared/types'
import { PlayerCard } from '@/components/PlayerCard'
import { StatusBar } from '@/components/StatusBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppStore } from '@/stores/app-store'

function TeamSection({
  title,
  players,
  color
}: {
  title: string
  players: PlayerWithHistory[]
  color: 'blue' | 'red'
}): React.JSX.Element | null {
  if (players.length === 0) return null
  const borderColor = color === 'blue' ? 'border-blue-500/40' : 'border-red-500/40'
  const titleColor = color === 'blue' ? 'text-blue-400' : 'text-red-400'

  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-2 border-b pb-1.5 ${borderColor}`}>
        <div
          className={`h-3 w-1 rounded-full ${color === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`}
        />
        <h2 className={`text-base font-semibold ${titleColor}`}>{title}</h2>
        <span className="text-xs text-muted-foreground">{players.length} 人</span>
      </div>
      <div className="space-y-2">
        {players.map((p) => (
          <PlayerCard
            key={`${p.riotId}-${p.championId ?? 0}`}
            player={p}
            teamColor={color}
          />
        ))}
      </div>
    </div>
  )
}

function PlayerList({
  title,
  players
}: {
  title: string
  players: PlayerWithHistory[]
}): React.JSX.Element | null {
  if (players.length === 0) return null
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2">
        {players.map((p) => (
          <PlayerCard key={`${p.riotId}-${p.championId ?? 0}`} player={p} />
        ))}
      </div>
    </div>
  )
}

export function MatchHistory(): React.JSX.Element {
  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)
  const gamePhase = useAppStore((s) => s.gamePhase)
  const teamData = useAppStore((s) => s.teamData)
  const searchResult = useAppStore((s) => s.searchResult)
  const setSearchResult = useAppStore((s) => s.setSearchResult)
  const lcuStatus = useAppStore((s) => s.lcuStatus)

  const handleSearch = async (): Promise<void> => {
    if (!searchInput.trim()) return
    setSearching(true)
    try {
      const result = (await window.api.invoke(
        IPC_CHANNELS.MATCH_SEARCH,
        searchInput.trim()
      )) as PlayerWithHistory
      setSearchResult(result)
    } catch (error) {
      const msg = error instanceof Error ? error.message : '搜索失败'
      setSearchResult({
        puuid: '',
        gameName: searchInput,
        tagLine: '',
        riotId: searchInput,
        matches: [],
        error: msg.includes('未配置') || msg.includes('客户端')
          ? '请先启动英雄联盟客户端后再搜索'
          : msg
      })
    } finally {
      setSearching(false)
    }
  }

  const showWaiting =
    !lcuStatus.connected && teamData.allies.length === 0 && teamData.enemies.length === 0
  const inChampSelect = gamePhase === 'ChampSelect' || teamData.phase === 'ChampSelect'
  const inGamePhases = ['InProgress', 'GameStart']
  const inGame =
    inGamePhases.includes(gamePhase) || inGamePhases.includes(teamData.phase)

  const hasTeamColors = inGame || (inChampSelect && teamData.allies.length > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">战绩查询</h1>
        <p className="text-muted-foreground">
          选人阶段自动查询己方战绩，加载界面/游戏内自动查询全部 10 人
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          通过 LCU 本地接口查询，国服/外服均可用，无需 API Key
        </p>
      </div>

      <StatusBar />

      <div className="flex gap-2">
        <Input
          placeholder="搜索任意玩家：游戏名#标签 或 游戏名"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
        />
        <Button onClick={() => void handleSearch()} disabled={searching} size="icon">
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {searchResult && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">搜索结果</h2>
          <PlayerCard player={searchResult} />
        </div>
      )}

      {showWaiting && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
          <p className="text-lg">等待英雄联盟客户端</p>
          <p className="mt-2 text-sm">启动游戏后，进入选人阶段将自动加载己方战绩</p>
          <p className="mt-1 text-xs">连接后可搜索任意玩家（含国服）</p>
        </div>
      )}

      {!showWaiting && (
        <div className="space-y-6">
          {inChampSelect && teamData.enemies.length === 0 && (
            <p className="text-sm text-amber-400/80">
              选人阶段仅显示己方队伍（Riot 已隐藏敌方召唤师名）
            </p>
          )}

          {hasTeamColors ? (
            <>
              <TeamSection title="己方队伍" players={teamData.allies} color="blue" />
              {teamData.enemies.length > 0 && (
                <TeamSection title="敌方队伍" players={teamData.enemies} color="red" />
              )}
            </>
          ) : (
            <>
              <PlayerList title="己方队伍" players={teamData.allies} />
              {teamData.enemies.length > 0 && (
                <PlayerList title="敌方队伍" players={teamData.enemies} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
