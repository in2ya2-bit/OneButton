export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  desc: string;
  category: 'combat' | 'build' | 'class' | 'challenge';
  reward: number; // relic points
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // 전투
  {
    id: 'stage_1',
    name: '첫 발걸음',
    icon: '👣',
    desc: '스테이지 1 클리어',
    category: 'combat',
    reward: 1,
  },
  {
    id: 'stage_10',
    name: '던전 탐험가',
    icon: '🗺️',
    desc: '스테이지 10 클리어',
    category: 'combat',
    reward: 1,
  },
  {
    id: 'stage_20',
    name: '던전 정복자',
    icon: '🏰',
    desc: '스테이지 20 클리어 (지역1 완료)',
    category: 'combat',
    reward: 1,
  },
  {
    id: 'stage_40',
    name: '심연의 도전자',
    icon: '💀',
    desc: '스테이지 40 클리어 (지역2 완료)',
    category: 'combat',
    reward: 1,
  },
  {
    id: 'stage_60',
    name: '전설의 용사',
    icon: '👑',
    desc: '스테이지 60 클리어 (지역3 완료)',
    category: 'combat',
    reward: 1,
  },
  {
    id: 'kill_100',
    name: '몬스터 헌터',
    icon: '⚔️',
    desc: '총 몬스터 100마리 처치',
    category: 'combat',
    reward: 1,
  },
  {
    id: 'kill_1000',
    name: '학살자',
    icon: '🔥',
    desc: '총 몬스터 1000마리 처치',
    category: 'combat',
    reward: 1,
  },
  // 빌드
  {
    id: 'cards_5',
    name: '카드 수집가',
    icon: '🃏',
    desc: '카드 5종 보유',
    category: 'build',
    reward: 1,
  },
  {
    id: 'cards_10',
    name: '덱 마스터',
    icon: '📚',
    desc: '카드 10종 보유',
    category: 'build',
    reward: 1,
  },
  {
    id: 'synergy_3',
    name: '시너지 달인',
    icon: '🔗',
    desc: '시너지 3개 동시 활성화',
    category: 'build',
    reward: 1,
  },
  {
    id: 'legendary_1',
    name: '전설의 손',
    icon: '⭐',
    desc: '전설 카드 1개 획득',
    category: 'build',
    reward: 1,
  },
  {
    id: 'legendary_3',
    name: '황금 덱',
    icon: '🌟',
    desc: '전설 카드 3개 동시 보유',
    category: 'build',
    reward: 1,
  },
  // 클래스
  {
    id: 'warrior_clear',
    name: '강철 전사',
    icon: '⚔️',
    desc: '전사로 지역 1 클리어',
    category: 'class',
    reward: 1,
  },
  {
    id: 'mage_clear',
    name: '마법의 대가',
    icon: '🔮',
    desc: '마법사로 지역 1 클리어',
    category: 'class',
    reward: 1,
  },
  {
    id: 'rogue_clear',
    name: '그림자 암살자',
    icon: '🗡️',
    desc: '도적으로 지역 1 클리어',
    category: 'class',
    reward: 1,
  },
  // 도전
  {
    id: 'no_potion_10',
    name: '절약가',
    icon: '💪',
    desc: '포션 없이 스테이지 10 클리어',
    category: 'challenge',
    reward: 3,
  },
  {
    id: 'boss_no_hit',
    name: '무적',
    icon: '✨',
    desc: '보스전에서 피해 없이 클리어',
    category: 'challenge',
    reward: 3,
  },
  {
    id: 'gold_500',
    name: '부자',
    icon: '💰',
    desc: '골드 500 이상 보유',
    category: 'challenge',
    reward: 3,
  },
  {
    id: 'relic_max_10',
    name: '유물 수집가',
    icon: '💎',
    desc: '유물 10개 최대 레벨 달성',
    category: 'challenge',
    reward: 3,
  },
  {
    id: 'runs_10',
    name: '런 중독자',
    icon: '🔄',
    desc: '총 런 10회 완료',
    category: 'challenge',
    reward: 3,
  },
];

export const CATEGORY_LABELS: Record<string, { name: string; color: string }> = {
  combat: { name: '전투', color: '#ff6644' },
  build: { name: '빌드', color: '#44aaff' },
  class: { name: '클래스', color: '#aa66ff' },
  challenge: { name: '도전', color: '#ffaa22' },
};
