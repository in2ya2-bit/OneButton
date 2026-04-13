export interface ClassDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  hoverColor: number;
  borderColor: number;
  hp: number;
  atk: number;
  atkIntervalMs: number;
  passive: string;
  startBonus: string;
  style: string;
  cardWeights: Record<string, number>;
  skillPreview: string[];
}

export const CLASSES: ClassDef[] = [
  {
    id: 'warrior',
    name: '전사',
    icon: '⚔️',
    color: 0x882222,
    hoverColor: 0xaa3333,
    borderColor: 0xcc4444,
    hp: 100,
    atk: 4,
    atkIntervalMs: 1500,
    passive: '받는 데미지 -15%',
    startBonus: '포션 Lv.1 ×1 지급',
    style: '튼튼하고 안정적, 초보자 추천',
    cardWeights: { hp: 1.3, def: 1.3 },
    skillPreview: ['강타', '회오리 베기', '방패 올리기', '전쟁의 외침'],
  },
  {
    id: 'mage',
    name: '마법사',
    icon: '🔮',
    color: 0x223388,
    hoverColor: 0x3344aa,
    borderColor: 0x4466cc,
    hp: 100,
    atk: 6,
    atkIntervalMs: 1000,
    passive: '스킬 데미지 +30%, 스킬 쿨타임 -20%',
    startBonus: '희귀 카드 1장 즉시 선택',
    style: '고위험 고보상, 스킬 중심',
    cardWeights: {},
    skillPreview: ['파이어볼', '아이스 스파이크', '번개 화살', '메테오'],
  },
  {
    id: 'rogue',
    name: '도적',
    icon: '🗡️',
    color: 0x552288,
    hoverColor: 0x7733aa,
    borderColor: 0x9944cc,
    hp: 100,
    atk: 5,
    atkIntervalMs: 800,
    passive: '크리티컬 확률 +20%, 크리티컬 데미지 +50%',
    startBonus: '골드 +50 지급',
    style: '빠르고 공격적, 크리티컬 빌드',
    cardWeights: { spd: 1.3, crit: 1.3 },
    skillPreview: ['독 단검', '차크람', '은신', '암살'],
  },
];
