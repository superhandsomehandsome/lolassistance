import { useCallback, useEffect, useRef, useState } from 'react'

import { IPC_CHANNELS } from '../../../shared/ipc-channels'

import type { EnemySpellState, LivePlayer, PendingSpellRecord } from '../../../shared/types'

import { getSpellInfo, spellIconUrl, type SpellInfo } from '../../../shared/spell-data'

import { championIconUrl } from '@/lib/ddragon'

import { cn } from '@/lib/utils'

import { useAppStore } from '@/stores/app-store'



function formatTimer(seconds: number): string {

  const m = Math.floor(seconds / 60)

  const s = Math.floor(seconds % 60)

  return `${m}:${s.toString().padStart(2, '0')}`

}



function SpellButton({

  spell,

  usedAt,

  cooldown,

  onToggle,

  now

}: {

  spell: SpellInfo

  usedAt: number | null

  cooldown: number

  onToggle: () => void

  now: number

}): React.JSX.Element {

  const remaining = usedAt ? Math.max(0, cooldown - (now - usedAt) / 1000) : 0

  const active = usedAt !== null && remaining > 0

  const ready = usedAt !== null && remaining <= 0

  const pct = active ? (remaining / cooldown) * 100 : 0



  return (

    <button

      type="button"

      onClick={onToggle}

      className={cn(

        'relative flex h-10 items-center gap-2 rounded-md border px-2 text-sm transition-all select-none',

        active && 'border-red-500/50 bg-red-500/10 text-red-300',

        ready && 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300 animate-pulse',

        !active && !ready && 'border-border bg-card hover:bg-accent/50 text-muted-foreground'

      )}

      title={active ? '点击重置计时' : ready ? '点击清除（已就绪）' : `点击开始 ${spell.name} 倒计时`}

    >

      {active && (

        <div

          className="absolute inset-0 rounded-md bg-red-500/10 transition-all"

          style={{ width: `${pct}%` }}

        />

      )}

      <img

        src={spellIconUrl(spell.iconKey)}

        alt={spell.name}

        className={cn('relative z-10 h-6 w-6 rounded', active && 'opacity-80')}

        onError={(e) => {

          ;(e.target as HTMLImageElement).style.display = 'none'

        }}

      />

      <span className="relative z-10 w-14 text-center font-mono text-xs">

        {active ? formatTimer(remaining) : ready ? '已就绪' : spell.name}

      </span>

    </button>

  )

}



function EnemyRow({

  state,

  onSpellToggle,

  now

}: {

  state: EnemySpellState

  onSpellToggle: (riotId: string, slot: 1 | 2) => void

  now: number

}): React.JSX.Element {

  const spell1 = getSpellInfo(state.spell1Id)

  const spell2 = getSpellInfo(state.spell2Id)



  return (

    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">

      <img

        src={championIconUrl(state.championName)}

        alt=""

        className="h-8 w-8 rounded-full"

        onError={(e) => {

          ;(e.target as HTMLImageElement).style.display = 'none'

        }}

      />

      <div className="w-20 truncate text-sm font-medium">

        {state.riotId.split('#')[0]}

      </div>

      <div className="flex gap-2">

        {spell1 && (

          <SpellButton

            spell={spell1}

            usedAt={state.spell1UsedAt}

            cooldown={state.spell1Cooldown}

            onToggle={() => onSpellToggle(state.riotId, 1)}

            now={now}

          />

        )}

        {spell2 && (

          <SpellButton

            spell={spell2}

            usedAt={state.spell2UsedAt}

            cooldown={state.spell2Cooldown}

            onToggle={() => onSpellToggle(state.riotId, 2)}

            now={now}

          />

        )}

      </div>

    </div>

  )

}



function PendingSpellQueue({

  records,

  now,

  onDismiss

}: {

  records: PendingSpellRecord[]

  now: number

  onDismiss: (id: string) => void

}): React.JSX.Element {

  if (records.length === 0) return <></>



  return (

    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">

      <p className="mb-2 text-xs font-medium text-amber-300">待分配技能（按快捷键记录）</p>

      <div className="flex flex-wrap gap-2">

        {records.map((record, index) => {

          const elapsed = Math.max(0, (now - record.timestamp) / 1000)

          return (

            <div

              key={record.id}

              className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-xs text-amber-300"

            >

              <span className="font-mono">

                #{index + 1} +{formatTimer(elapsed)}

              </span>

              <button

                type="button"

                onClick={() => onDismiss(record.id)}

                className="rounded px-1 text-amber-400/80 hover:bg-amber-500/20 hover:text-amber-200"

                title="取消此记录"

              >

                ×

              </button>

            </div>

          )

        })}

      </div>

      <p className="mt-2 text-xs text-muted-foreground">点击敌方技能按钮将最早记录分配给该技能</p>

    </div>

  )

}



interface SpellTrackerProps {

  enemies: LivePlayer[]

}



export function SpellTracker({ enemies }: SpellTrackerProps): React.JSX.Element {

  const gamePhase = useAppStore((s) => s.gamePhase)

  const [states, setStates] = useState<Map<string, EnemySpellState>>(new Map())

  const [pendingSpells, setPendingSpells] = useState<PendingSpellRecord[]>([])

  const [now, setNow] = useState(Date.now())

  const tickRef = useRef<NodeJS.Timeout | null>(null)



  const syncPendingSpells = useCallback(async () => {

    const list = (await window.api.invoke(IPC_CHANNELS.SPELL_PENDING_LIST)) as PendingSpellRecord[]

    setPendingSpells(list)

  }, [])



  useEffect(() => {

    void syncPendingSpells()

  }, [syncPendingSpells])



  useEffect(() => {

    const unsubscribe = window.api.on(IPC_CHANNELS.SPELL_PENDING_ADD, (record) => {

      setPendingSpells((prev) => [...prev, record as PendingSpellRecord])

    })

    return unsubscribe

  }, [])



  useEffect(() => {

    if (gamePhase === 'None' || gamePhase === 'EndOfGame' || gamePhase === 'Lobby') {

      setPendingSpells([])

    }

  }, [gamePhase])



  useEffect(() => {

    setStates((prev) => {

      const next = new Map(prev)

      for (const enemy of enemies) {

        const existing = next.get(enemy.riotId)

        const spell1 = getSpellInfo(enemy.spell1Id)

        const spell2 = getSpellInfo(enemy.spell2Id)



        if (!existing) {

          next.set(enemy.riotId, {

            riotId: enemy.riotId,

            championName: enemy.championName,

            spell1Id: enemy.spell1Id,

            spell2Id: enemy.spell2Id,

            spell1UsedAt: null,

            spell2UsedAt: null,

            spell1Cooldown: spell1?.cooldown ?? 300,

            spell2Cooldown: spell2?.cooldown ?? 300

          })

        } else {

          next.set(enemy.riotId, {

            ...existing,

            championName: enemy.championName,

            spell1Id: enemy.spell1Id,

            spell2Id: enemy.spell2Id,

            spell1Cooldown: spell1?.cooldown ?? existing.spell1Cooldown,

            spell2Cooldown: spell2?.cooldown ?? existing.spell2Cooldown

          })

        }

      }

      return next

    })

  }, [enemies])



  useEffect(() => {

    tickRef.current = setInterval(() => setNow(Date.now()), 500)

    return () => {

      if (tickRef.current) clearInterval(tickRef.current)

    }

  }, [])



  const handleDismissPending = useCallback(async (id: string) => {

    const removed = (await window.api.invoke(IPC_CHANNELS.SPELL_PENDING_DISMISS, id)) as boolean

    if (removed) {

      setPendingSpells((prev) => prev.filter((record) => record.id !== id))

    }

  }, [])



  const handleSpellToggle = useCallback(

    async (riotId: string, slot: 1 | 2) => {

      const state = states.get(riotId)

      if (!state) return



      const usedAtKey = slot === 1 ? 'spell1UsedAt' : 'spell2UsedAt'

      const cdKey = slot === 1 ? 'spell1Cooldown' : 'spell2Cooldown'

      const currentUsedAt = state[usedAtKey]

      const cooldown = state[cdKey]

      const remaining = currentUsedAt ? cooldown - (Date.now() - currentUsedAt) / 1000 : 0



      if (currentUsedAt && remaining > 0) {

        setStates((prev) => {

          const next = new Map(prev)

          const current = next.get(riotId)

          if (!current) return prev

          next.set(riotId, { ...current, [usedAtKey]: null })

          return next

        })

        return

      }



      let usedAt = Date.now()

      if (!currentUsedAt) {
        const consumed = (await window.api.invoke(
          IPC_CHANNELS.SPELL_PENDING_CONSUME
        )) as PendingSpellRecord | null
        if (consumed) {
          usedAt = consumed.timestamp
          setPendingSpells((prev) => prev.filter((record) => record.id !== consumed.id))
        }
      }



      setStates((prev) => {

        const next = new Map(prev)

        const current = next.get(riotId)

        if (!current) return prev

        next.set(riotId, { ...current, [usedAtKey]: usedAt })

        return next

      })

    },

    [states]

  )



  const enemyStates = enemies

    .map((e) => states.get(e.riotId))

    .filter((s): s is EnemySpellState => s !== undefined)



  if (enemyStates.length === 0) return <></>



  return (

    <div className="space-y-3">

      <h2 className="text-lg font-semibold">技能追踪</h2>

      <p className="text-xs text-muted-foreground">

        游戏中按快捷键记录技能使用时间，稍后点击敌方技能按钮分配；也可直接点击开始倒计时（快捷键可在设置中修改）

      </p>

      <PendingSpellQueue records={pendingSpells} now={now} onDismiss={handleDismissPending} />

      <div className="space-y-2">

        {enemyStates.map((state) => (

          <EnemyRow

            key={state.riotId}

            state={state}

            onSpellToggle={(riotId, slot) => {

              void handleSpellToggle(riotId, slot)

            }}

            now={now}

          />

        ))}

      </div>

    </div>

  )

}


