export interface SpellInfo {
  id: string
  name: string
  cooldown: number
  iconKey: string
}

export const SUMMONER_SPELLS: Record<string, SpellInfo> = {
  SummonerFlash: { id: 'SummonerFlash', name: '闪现', cooldown: 300, iconKey: 'SummonerFlash' },
  SummonerTeleport: { id: 'SummonerTeleport', name: '传送', cooldown: 360, iconKey: 'SummonerTeleport' },
  SummonerDot: { id: 'SummonerDot', name: '点燃', cooldown: 180, iconKey: 'SummonerDot' },
  SummonerHeal: { id: 'SummonerHeal', name: '治疗', cooldown: 240, iconKey: 'SummonerHeal' },
  SummonerBarrier: { id: 'SummonerBarrier', name: '屏障', cooldown: 180, iconKey: 'SummonerBarrier' },
  SummonerExhaust: { id: 'SummonerExhaust', name: '虚弱', cooldown: 210, iconKey: 'SummonerExhaust' },
  SummonerSmite: { id: 'SummonerSmite', name: '惩戒', cooldown: 15, iconKey: 'SummonerSmite' },
  SummonerBoost: { id: 'SummonerBoost', name: '净化', cooldown: 210, iconKey: 'SummonerBoost' },
  SummonerHaste: { id: 'SummonerHaste', name: '幽灵疾步', cooldown: 210, iconKey: 'SummonerHaste' },
  SummonerMana: { id: 'SummonerMana', name: '清晰术', cooldown: 240, iconKey: 'SummonerMana' },
  SummonerSnowball: { id: 'SummonerSnowball', name: '雪球', cooldown: 40, iconKey: 'SummonerSnowball' }
}

const SPELL_NAME_MAP: Record<string, string> = {}
for (const spell of Object.values(SUMMONER_SPELLS)) {
  SPELL_NAME_MAP[spell.name] = spell.id
  SPELL_NAME_MAP[spell.id] = spell.id
}

export function resolveSpellId(nameOrId: string): string {
  return SPELL_NAME_MAP[nameOrId] ?? nameOrId
}

export function getSpellInfo(nameOrId: string): SpellInfo | null {
  const id = resolveSpellId(nameOrId)
  return SUMMONER_SPELLS[id] ?? null
}

export function spellIconUrl(spellKey: string, version = '14.24.1'): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spellKey}.png`
}
