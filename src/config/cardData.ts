import type {
  CardDef,
  CardRarity,
  PotionDef,
  ShopItemDef,
  DoorDef,
  EventDef,
  SynergyDef,
  AutoAtkCardDef,
} from '../types/index';

export const STAT_CARDS: CardDef[] = [
  {
    id: 'hp',
    name: 'HP 증가',
    icon: '❤️',
    color: 0xcc2222,
    baseValue: 20,
    rareValue: 30,
    legendValue: 50,
    descFn: v => `최대 HP +${Math.floor(v)}`,
  },
  {
    id: 'atk',
    name: '공격력 증가',
    icon: '⚔️',
    color: 0xff6622,
    baseValue: 3,
    rareValue: 5,
    legendValue: 8,
    descFn: v => `ATK +${Math.floor(v)}`,
  },
  {
    id: 'spd',
    name: '공격속도 증가',
    icon: '💨',
    color: 0x2288cc,
    baseValue: 0.08,
    rareValue: 0.12,
    legendValue: 0.2,
    descFn: v => `공격 간격 -${v.toFixed(2)}s`,
  },
  {
    id: 'crit',
    name: '치명타 확률',
    icon: '🎯',
    color: 0xffaa00,
    baseValue: 8,
    rareValue: 12,
    legendValue: 20,
    descFn: v => `치명타 +${Math.floor(v)}%`,
  },
  {
    id: 'def',
    name: '방어력 증가',
    icon: '🛡️',
    color: 0x4488cc,
    baseValue: 8,
    rareValue: 12,
    legendValue: 20,
    descFn: v => `피해 -${Math.floor(v)}%`,
  },
  {
    id: 'steal',
    name: '흡혈',
    icon: '🩸',
    color: 0x882266,
    baseValue: 4,
    rareValue: 6,
    legendValue: 10,
    descFn: v => `공격 시 HP ${v.toFixed(1)}% 회복`,
  },
  {
    id: 'mp',
    name: 'MP 증가',
    icon: '💎',
    color: 0x2244cc,
    baseValue: 15,
    rareValue: 25,
    legendValue: 40,
    descFn: v => `최대 MP +${Math.floor(v)}`,
  },
];

export const POTION_DATA: Record<number, PotionDef> = {
  1: { healAmount: 35, bgColor: 0x1a2e1a, borderColor: 0x44aa44, label: 'Lv.1' },
  2: { healAmount: 80, bgColor: 0x1a1a2e, borderColor: 0x4488cc, label: 'Lv.2' },
  3: { healAmount: -1, bgColor: 0x2a1a2e, borderColor: 0x9944cc, label: 'Lv.3' },
};

export const SHOP_ITEMS: ShopItemDef[] = [
  { name: 'Lv.1 포션', desc: 'HP +35', cost: 30, icon: '🧪', kind: 'potion', potionLv: 1 },
  { name: 'Lv.2 포션', desc: 'HP +80', cost: 65, icon: '🧪', kind: 'potion', potionLv: 2 },
  { name: 'Lv.3 포션', desc: 'HP 완전 회복', cost: 130, icon: '🧪', kind: 'potion', potionLv: 3 },
  {
    name: '공격력 버프',
    desc: 'ATK 50%↑ (30초)',
    cost: 50,
    icon: '🗡️',
    kind: 'buff',
    buffType: 'atk',
  },
  {
    name: '무적',
    desc: '5초간 데미지 무효',
    cost: 100,
    icon: '✨',
    kind: 'buff',
    buffType: 'invincible',
  },
];

export const DOOR_DEFS: DoorDef[] = [
  { type: 'combat', icon: '⚔️', name: '전투', desc: '일반 몬스터 웨이브', color: 0x4466aa },
  { type: 'elite', icon: '⚡', name: '엘리트', desc: '강한 몬스터 (보상 x2)', color: 0xcc6622 },
  { type: 'shop', icon: '🏪', name: '상점', desc: '아이템 구매', color: 0x44aa66 },
  { type: 'rest', icon: '🔥', name: '휴식', desc: 'HP 30% 회복 + 카드 강화', color: 0xcc8833 },
  { type: 'event', icon: '🎲', name: '이벤트', desc: '랜덤 이벤트', color: 0x8844aa },
];

export const EVENTS: EventDef[] = [
  {
    id: 'spring',
    name: '신비한 샘',
    icon: '🌊',
    desc: '맑은 샘물이 반짝이고 있다...',
    effect: 'HP 완전 회복, 최대 HP -20',
  },
  {
    id: 'devil',
    name: '악마의 거래',
    icon: '😈',
    desc: '어둠 속에서 악마가 나타났다...',
    effect: 'ATK +5, 골드 50% 감소',
  },
  {
    id: 'relic_find',
    name: '고대 유물 발견',
    icon: '🏺',
    desc: '고대 유물을 발견했다!',
    effect: '유물 포인트 +2',
  },
  {
    id: 'curse',
    name: '저주받은 몬스터',
    icon: '👹',
    desc: '저주의 기운이 다가온다...',
    effect: '다음 전투 몬스터 ATK x2',
  },
  {
    id: 'bless',
    name: '축복받은 전사',
    icon: '✨',
    desc: '성스러운 빛이 감싼다...',
    effect: '다음 전투까지 ATK +10',
  },
];

export const RARITY_COLORS: Record<
  CardRarity,
  { border: number; text: string; label: string; bg: number }
> = {
  normal: { border: 0x666688, text: '#aaaaaa', label: '일반', bg: 0x111122 },
  rare: { border: 0x4488ff, text: '#4488ff', label: '희귀', bg: 0x0a1530 },
  legendary: { border: 0xffd700, text: '#ffd700', label: '전설', bg: 0x1a1500 },
};

export const LEGENDARY_DESCS: Record<string, string> = {
  hp: '매 스테이지 HP 5 자동 회복',
  atk: '크리티컬 확률 +15%',
  spd: '공격 시 10% 확률로 2연타',
  steal: '처치 시 HP 10 회복',
  crit: '크리티컬 데미지 3배',
};

export const SYNERGIES: SynergyDef[] = [
  {
    id: 'iron_guard',
    name: '철벽 수호자',
    icon: '❤🛡',
    requires: ['hp', 'def'],
    desc: '최대 HP +30, 피해 -10%',
  },
  {
    id: 'death_touch',
    name: '죽음의 손길',
    icon: '🎯🩸',
    requires: ['crit', 'steal'],
    desc: '치명타 시 HP 20 회복',
  },
  {
    id: 'berserker',
    name: '광전사',
    icon: '⚔💨',
    requires: ['atk', 'spd'],
    desc: 'ATK +5, 공격속도 +10%',
  },
  {
    id: 'survivor',
    name: '생존자',
    icon: '❤🩸',
    requires: ['hp', 'steal'],
    desc: 'HP 15% 이하 시 흡혈 2배',
  },
  {
    id: 'glass_cannon',
    name: '유리 대포',
    icon: '⚔🎯',
    requires: ['atk', 'crit'],
    desc: '크리티컬 데미지 +50%',
  },
  {
    id: 'tank',
    name: '철의 심장',
    icon: '🛡💨',
    requires: ['def', 'spd'],
    desc: '피격 시 5% 확률로 반격',
  },
];

export const AUTO_ATK_CARDS: Record<string, AutoAtkCardDef> = {
  warrior: {
    classId: 'warrior',
    name: '전투 본능',
    icon: '⚔️🔄',
    desc: '기본 공격이 자동으로 발동됩니다',
    color: 0xcc4422,
  },
  mage: {
    classId: 'mage',
    name: '마법 자동화',
    icon: '🔮🔄',
    desc: '마법탄이 자동으로 발사됩니다',
    color: 0x4488ff,
  },
  rogue: {
    classId: 'rogue',
    name: '암살자의 리듬',
    icon: '🗡️🔄',
    desc: '쌍검이 자동으로 공격합니다',
    color: 0x9944cc,
  },
};
