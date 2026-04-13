export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  perLevel: string;
  descFn: (lv: number) => string;
}

export const RELICS: RelicDef[] = [
  {
    id: 'heart',
    name: '고대의 심장',
    icon: '❤️',
    color: 0xcc2222,
    perLevel: 'HP +30',
    descFn: lv => `초기 HP +${lv * 30}`,
  },
  {
    id: 'warrior',
    name: '전사의 각인',
    icon: '⚔️',
    color: 0xcc6622,
    perLevel: 'ATK +2',
    descFn: lv => `초기 ATK +${lv * 2}`,
  },
  {
    id: 'swift',
    name: '신속의 발',
    icon: '👟',
    color: 0x2288cc,
    perLevel: 'SPD +5%',
    descFn: lv => `공격속도 +${lv * 5}%`,
  },
  {
    id: 'purse',
    name: '연금술사의 지갑',
    icon: '💰',
    color: 0xddaa33,
    perLevel: 'Gold +20',
    descFn: lv => `초기 골드 +${lv * 20}`,
  },
  {
    id: 'sage',
    name: '현자의 지식',
    icon: '📚',
    color: 0x4466bb,
    perLevel: 'XP +15%',
    descFn: lv => `경험치 +${lv * 15}%`,
  },
  {
    id: 'lucky',
    name: '행운의 동전',
    icon: '🍀',
    color: 0x33aa44,
    perLevel: '선택지 +1',
    descFn: lv => `카드 선택지 +${lv}`,
  },
  {
    id: 'ring',
    name: '흡혈의 반지',
    icon: '💍',
    color: 0xcc3344,
    perLevel: 'HP 3% 회복',
    descFn: lv => `공격 시 HP ${lv * 3}% 회복`,
  },
  {
    id: 'shield',
    name: '방패의 문장',
    icon: '🛡️',
    color: 0x3366cc,
    perLevel: 'DEF +5%',
    descFn: lv => `초기 방어력 +${lv * 5}%`,
  },
  {
    id: 'eye',
    name: '치명타의 눈',
    icon: '👁️',
    color: 0xddaa22,
    perLevel: 'CRIT +5%',
    descFn: lv => `치명타 확률 +${lv * 5}%`,
  },
  {
    id: 'claw',
    name: '독의 발톱',
    icon: '🐾',
    color: 0x44aa33,
    perLevel: '독 DMG +20%',
    descFn: lv => `독 데미지 +${lv * 20}%`,
  },
  {
    id: 'rune',
    name: '폭발의 룬',
    icon: '🔮',
    color: 0x8844cc,
    perLevel: '범위 DMG +20%',
    descFn: lv => `범위 스킬 +${lv * 20}%`,
  },
  {
    id: 'spring',
    name: '회복의 샘',
    icon: '💧',
    color: 0x4488dd,
    perLevel: '포션 +25%',
    descFn: lv => `포션 효과 +${lv * 25}%`,
  },
  {
    id: 'merchant',
    name: '상인의 축복',
    icon: '🪙',
    color: 0xbb8833,
    perLevel: '가격 -10%',
    descFn: lv => `상점 가격 -${lv * 10}%`,
  },
  {
    id: 'memory',
    name: '전투의 기억',
    icon: '🧠',
    color: 0xaa4488,
    perLevel: '보스킬 HP+20',
    descFn: lv => `보스 처치 시 HP ${lv * 20} 회복`,
  },
  {
    id: 'dark',
    name: '어둠의 계약',
    icon: '📜',
    color: 0x6622aa,
    perLevel: 'ATK+5 HP-20',
    descFn: lv => `ATK +${lv * 5}, 최대HP -${lv * 20}`,
  },
  {
    id: 'time',
    name: '시간의 모래',
    icon: '⏳',
    color: 0xccaa33,
    perLevel: 'CD -10%',
    descFn: lv => `스킬 쿨타임 -${lv * 10}%`,
  },
  {
    id: 'iron',
    name: '강철 의지',
    icon: '✊',
    color: 0x888899,
    perLevel: '위기ATK+50%',
    descFn: lv => `HP 10%↓ ATK +${lv * 50}%`,
  },
  {
    id: 'gold_touch',
    name: '황금 손길',
    icon: '👑',
    color: 0xddbb33,
    perLevel: 'Gold +20%',
    descFn: lv => `골드 드롭 +${lv * 20}%`,
  },
  {
    id: 'mana',
    name: '마나의 결정',
    icon: '💎',
    color: 0x7744cc,
    perLevel: '스킬DMG+15%',
    descFn: lv => `스킬 데미지 +${lv * 15}%`,
  },
  {
    id: 'immortal',
    name: '불사의 인장',
    icon: '🔥',
    color: 0xff6622,
    perLevel: '부활HP+10%',
    descFn: lv => `부활 1회 (HP ${20 + lv * 10}%)`,
  },
  {
    id: 'mana_spring',
    name: '마나의 샘',
    icon: '🌀',
    color: 0x2266cc,
    perLevel: 'MP회복+20%',
    descFn: lv => `MP 회복속도 +${lv * 20}%`,
  },
];

export const MAX_RELIC_LV = 5;

export function relicUpgradeCost(nextLv: number): number {
  return nextLv * 2;
}

export const DEFAULT_RELIC_LEVELS: Record<string, number> = {
  heart: 0,
  warrior: 0,
  swift: 0,
  purse: 0,
  sage: 0,
  lucky: 0,
  ring: 0,
  shield: 0,
  eye: 0,
  claw: 0,
  rune: 0,
  spring: 0,
  merchant: 0,
  memory: 0,
  dark: 0,
  time: 0,
  iron: 0,
  gold_touch: 0,
  mana: 0,
  immortal: 0,
  mana_spring: 0,
};
