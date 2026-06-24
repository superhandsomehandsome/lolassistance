const QUEUE_NAMES: Record<number, string> = {
  0: '自定义',
  2: '匹配模式',
  4: '排位赛',
  6: '排位赛',
  7: '人机对战',
  8: '3v3 匹配',
  9: '排位 3v3',
  14: '5v5 匹配',
  16: '统治战场',
  17: '统治排位',
  25: '统治人机',
  31: '人机对战',
  32: '人机对战',
  33: '人机对战',
  41: '3v3 排位',
  42: '5v5 排位',
  52: '人机 3v3',
  61: '5v5 组队',
  65: '极地大乱斗',
  67: '极地大乱斗',
  70: '克隆模式',
  72: '魄罗大乱斗',
  73: '魄罗大乱斗',
  75: '六杀模式',
  76: '无限火力',
  78: '镜像模式',
  83: '无限火力',
  91: '末日人机',
  92: '末日人机',
  93: '末日人机',
  96: '飞升模式',
  98: '六杀扭曲',
  100: '极地大乱斗',
  300: '传送门突击',
  310: '复仇模式',
  313: '黑市乱斗',
  315: '尼克斯试炼',
  317: '明星表演赛',
  318: '无限乱斗',
  325: '无限乱斗',
  400: '匹配模式',
  410: '排位赛',
  420: '单双排',
  430: '匹配模式',
  440: '灵活组排',
  450: '极地大乱斗',
  460: '3v3 匹配',
  470: '3v3 排位',
  490: '快速模式',
  600: '猎血盛宴',
  610: '暗星模式',
  700: '冠军杯赛',
  720: '极地大乱斗（冠军）',
  800: '人机（入门）',
  810: '人机（入门）',
  820: '人机（入门）',
  830: '人机（入门）',
  840: '人机（新手）',
  850: '人机（一般）',
  900: '无限火力',
  910: '飞升模式',
  920: '传送门突击',
  940: '尼克斯试炼',
  950: '末日人机',
  960: '末日人机',
  980: '星之守护者',
  990: '星之守护者',
  1000: '超凡模式',
  1010: '无限火力',
  1020: '克隆模式',
  1030: '机器人大作战',
  1040: '云顶之弈',
  1050: '云顶之弈',
  1090: '云顶之弈（匹配）',
  1100: '云顶之弈（排位）',
  1110: '云顶之弈（教学）',
  1130: '云顶之弈（超级英雄）',
  1150: '云顶之弈（双人作战）',
  1160: '云顶之弈（双人排位）',
  1170: '云顶之弈（队伍）',
  1200: '极限闪击',
  1300: '极限闪击',
  1400: '终极魔典',
  1700: '斗魂竞技场',
  1710: '斗魂竞技场（排位）',
  1810: '斗魂竞技场',
  1820: '斗魂竞技场（排位）',
  1900: '无限火力',
  2000: '教学模式',
  2010: '教学模式',
  2020: '教学模式',

  // 海克斯大乱斗 / 特殊模式
  3000: '海克斯大乱斗',
  3010: '海克斯大乱斗'
}

const MAP_NAMES: Record<number, string> = {
  1: '召唤师峡谷',
  2: '召唤师峡谷（秋季）',
  3: '教学地图',
  4: '扭曲丛林',
  8: '水晶之痕',
  10: '扭曲丛林',
  11: '召唤师峡谷',
  12: '嚎哭深渊',
  14: '屠夫之桥',
  16: '宇宙遗迹',
  18: '瓦洛兰城市公园',
  19: '暗星空间',
  20: '奥德赛星舰',
  21: '极限闪击',
  22: '云顶之弈',
  30: '斗魂竞技场',
  33: '海克斯大乱斗'
}

const SPELL_IMAGE_IDS: Record<number, string> = {
  1: 'SummonerBoost',
  3: 'SummonerExhaust',
  4: 'SummonerFlash',
  6: 'SummonerHaste',
  7: 'SummonerHeal',
  11: 'SummonerSmite',
  12: 'SummonerTeleport',
  13: 'SummonerMana',
  14: 'SummonerDot',
  21: 'SummonerBarrier',
  30: 'SummonerPoroRecall',
  31: 'SummonerPoroThrow',
  32: 'SummonerSnowball',
  39: 'SummonerSnowURFSnowball_Mark',
  54: 'Summoner_UltBookPlaceholder',
  55: 'Summoner_UltBookSmitePlaceholder'
}

export function getQueueName(queueId?: number, gameMode?: string, mapId?: number): string {
  if (queueId !== undefined && QUEUE_NAMES[queueId]) return QUEUE_NAMES[queueId]
  if (mapId !== undefined && MAP_NAMES[mapId]) return MAP_NAMES[mapId]
  if (gameMode === 'ARAM') return '极地大乱斗'
  if (gameMode === 'CLASSIC') return '匹配模式'
  if (gameMode === 'URF') return '无限火力'
  if (gameMode === 'ONEFORALL') return '克隆模式'
  if (gameMode === 'NEXUSBLITZ') return '极限闪击'
  if (gameMode === 'CHERRY') return '斗魂竞技场'
  if (gameMode) return gameMode
  return '对局'
}

export function getMapName(mapId?: number): string {
  if (mapId !== undefined && MAP_NAMES[mapId]) return MAP_NAMES[mapId]
  return ''
}

export function getSpellImageId(spellId?: number): string | null {
  if (!spellId) return null
  return SPELL_IMAGE_IDS[spellId] ?? null
}

export function calcKdaRatio(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return kills + assists
  return (kills + assists) / deaths
}

export function formatKdaRatio(kills: number, deaths: number, assists: number): string {
  const ratio = calcKdaRatio(kills, deaths, assists)
  if (deaths === 0) return 'Perfect'
  return ratio.toFixed(2)
}

export function formatCsPerMin(cs: number, durationSec: number): string {
  if (durationSec <= 0) return '0.0'
  return (cs / (durationSec / 60)).toFixed(1)
}
