import type { MatchSummary } from '../../../shared/types'
import { championIconUrl } from '@/lib/ddragon'

interface PlayerTrendProps {
  matches: MatchSummary[]
}

function WinRateChart({ matches }: { matches: MatchSummary[] }): React.JSX.Element {
  if (matches.length < 2) {
    return <div className="text-xs text-muted-foreground">数据不足</div>
  }

  const w = 240
  const h = 80
  const pad = { top: 8, right: 8, bottom: 16, left: 28 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom

  const sorted = [...matches].sort((a, b) => a.gameCreation - b.gameCreation)
  const points: { x: number; y: number; wr: number }[] = []
  let wins = 0
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].win) wins++
    const wr = (wins / (i + 1)) * 100
    const x = pad.left + (i / (sorted.length - 1)) * cw
    const y = pad.top + ch - (wr / 100) * ch
    points.push({ x, y, wr })
  }

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const lastWr = points[points.length - 1].wr

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>胜率走势</span>
        <span className={lastWr >= 50 ? 'text-emerald-400' : 'text-red-400'}>
          {lastWr.toFixed(0)}%
        </span>
      </div>
      <svg width={w} height={h} className="overflow-visible">
        <line
          x1={pad.left} y1={pad.top + ch / 2}
          x2={pad.left + cw} y2={pad.top + ch / 2}
          stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3,3"
        />
        <text x={pad.left - 4} y={pad.top + 4} textAnchor="end" className="fill-muted-foreground text-[8px]">100</text>
        <text x={pad.left - 4} y={pad.top + ch / 2 + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">50</text>
        <text x={pad.left - 4} y={pad.top + ch + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">0</text>
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5}
            fill={sorted[i].win ? '#22c55e' : '#ef4444'}
            stroke="var(--background)" strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  )
}

function KdaChart({ matches }: { matches: MatchSummary[] }): React.JSX.Element {
  if (matches.length < 2) {
    return <div className="text-xs text-muted-foreground">数据不足</div>
  }

  const w = 240
  const h = 80
  const pad = { top: 8, right: 8, bottom: 16, left: 28 }
  const cw = w - pad.left - pad.right
  const ch = h - pad.top - pad.bottom

  const sorted = [...matches].sort((a, b) => a.gameCreation - b.gameCreation)
  const kdas = sorted.map((m) => m.deaths === 0 ? m.kills + m.assists : (m.kills + m.assists) / m.deaths)
  const maxKda = Math.max(...kdas, 5)

  const points = kdas.map((kda, i) => ({
    x: pad.left + (i / (sorted.length - 1)) * cw,
    y: pad.top + ch - (Math.min(kda, maxKda) / maxKda) * ch,
    kda
  }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const avgKda = kdas.reduce((a, b) => a + b, 0) / kdas.length

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>KDA 趋势</span>
        <span className={avgKda >= 3 ? 'text-emerald-400' : avgKda >= 2 ? 'text-amber-400' : 'text-red-400'}>
          平均 {avgKda.toFixed(2)}
        </span>
      </div>
      <svg width={w} height={h} className="overflow-visible">
        <path d={linePath} fill="none" stroke="#a78bfa" strokeWidth={2} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5}
            fill={sorted[i].win ? '#22c55e' : '#ef4444'}
            stroke="var(--background)" strokeWidth={1}
          />
        ))}
      </svg>
    </div>
  )
}

function ChampionPool({ matches }: { matches: MatchSummary[] }): React.JSX.Element {
  if (matches.length === 0) return <></>

  const champCount = new Map<string, { name: string; imageId: string; wins: number; total: number }>()
  for (const m of matches) {
    const key = String(m.championId)
    const existing = champCount.get(key)
    if (existing) {
      existing.total++
      if (m.win) existing.wins++
    } else {
      champCount.set(key, {
        name: m.championName,
        imageId: m.championImageId ?? m.championName,
        wins: m.win ? 1 : 0,
        total: 1
      })
    }
  }

  const sorted = [...champCount.values()].sort((a, b) => b.total - a.total).slice(0, 5)

  return (
    <div>
      <div className="mb-1.5 text-[10px] text-muted-foreground">常用英雄</div>
      <div className="flex gap-2">
        {sorted.map((champ) => {
          const wr = Math.round((champ.wins / champ.total) * 100)
          return (
            <div key={champ.name} className="flex flex-col items-center gap-0.5">
              <div className="relative">
                <img
                  src={championIconUrl(champ.imageId)}
                  alt={champ.name}
                  className="h-8 w-8 rounded-full ring-1 ring-border"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-background px-1 text-[8px] font-semibold leading-tight">
                  {champ.total}
                </div>
              </div>
              <span className={`text-[9px] font-medium ${wr >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
                {wr}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GameModeDistribution({ matches }: { matches: MatchSummary[] }): React.JSX.Element {
  if (matches.length === 0) return <></>

  const modeCount = new Map<string, number>()
  for (const m of matches) {
    const mode = m.queueName ?? m.gameMode ?? '未知'
    modeCount.set(mode, (modeCount.get(mode) ?? 0) + 1)
  }

  const sorted = [...modeCount.entries()].sort((a, b) => b[1] - a[1])
  const total = matches.length

  return (
    <div>
      <div className="mb-1.5 text-[10px] text-muted-foreground">模式分布</div>
      <div className="space-y-1">
        {sorted.map(([mode, count]) => {
          const pct = (count / total) * 100
          return (
            <div key={mode} className="flex items-center gap-2 text-[10px]">
              <span className="w-16 truncate text-muted-foreground">{mode}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/30">
                <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PlayerTrend({ matches }: PlayerTrendProps): React.JSX.Element {
  if (matches.length === 0) {
    return <div className="py-2 text-center text-xs text-muted-foreground">暂无数据</div>
  }

  const wins = matches.filter((m) => m.win).length
  const losses = matches.length - wins
  const totalKills = matches.reduce((s, m) => s + m.kills, 0)
  const totalDeaths = matches.reduce((s, m) => s + m.deaths, 0)
  const totalAssists = matches.reduce((s, m) => s + m.assists, 0)
  const avgCs = Math.round(matches.reduce((s, m) => s + m.cs, 0) / matches.length)

  return (
    <div className="space-y-3 rounded-md bg-background/40 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">最近 {matches.length} 场数据</span>
        <div className="flex gap-2 text-muted-foreground">
          <span>
            <span className="font-semibold text-emerald-400">{wins}胜</span>{' '}
            <span className="font-semibold text-red-400">{losses}负</span>
          </span>
          <span>|</span>
          <span>
            平均 {(totalKills / matches.length).toFixed(1)}/
            {(totalDeaths / matches.length).toFixed(1)}/
            {(totalAssists / matches.length).toFixed(1)}
          </span>
          <span>|</span>
          <span>{avgCs} CS</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <WinRateChart matches={matches} />
        <KdaChart matches={matches} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChampionPool matches={matches} />
        <GameModeDistribution matches={matches} />
      </div>
    </div>
  )
}
