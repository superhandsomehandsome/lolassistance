const DDRAGON_VERSION = '14.24.1'

export function championIconUrl(championIdOrName: string, version = DDRAGON_VERSION): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championIdOrName}.png`
}

export function itemIconUrl(itemId: number, version = DDRAGON_VERSION): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`
}

export function spellIconUrl(spellImageId: string, version = DDRAGON_VERSION): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spellImageId}.png`
}

export function formatNumber(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString()
}

export function formatKda(kills: number, deaths: number, assists: number): string {
  return `${kills}/${deaths}/${assists}`
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatWinRate(matches: { win: boolean }[]): string {
  if (matches.length === 0) return '-'
  const wins = matches.filter((m) => m.win).length
  return `${Math.round((wins / matches.length) * 100)}%`
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}
