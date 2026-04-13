export type EffectType =
  | 'single_dmg'
  | 'multi_hit'
  | 'aoe'
  | 'dot'
  | 'buff_self'
  | 'debuff_enemy'
  | 'stealth'
  | 'reflect';

export type SfxType =
  | 'hit' | 'fire' | 'ice' | 'lightning' | 'poison'
  | 'explosion' | 'shield' | 'buff' | 'debuff' | 'stealth';

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  color: number;
  classId: string;
  category: string;
  baseCd: number;
  baseMult: number;
  descFn: (mult: number) => string;
  sfxType: SfxType;
  effectType: EffectType;
  mpCost: number;
  /** Extra params for specific effect types */
  hits?: number;
  dotSeconds?: number;
  buffDuration?: number;
  buffEffect?: string;
  debuffDuration?: number;
  debuffEffect?: string;
  stealthDuration?: number;
  reflectPct?: number;
  btnColor: number;
  btnHover: number;
}

/* ================================================================
   WARRIOR SKILLS (9)
   ================================================================ */

export const WARRIOR_SKILLS: SkillDef[] = [
  { id: 'w_smash', name: '강타', icon: '🔨', color: 0xcc4422, classId: 'warrior', category: '공격', baseCd: 4, baseMult: 2, mpCost: 15, descFn: m => `ATK×${m.toFixed(1)} 단타`, sfxType: 'hit', effectType: 'single_dmg', btnColor: 0x883322, btnHover: 0xaa4433 },
  { id: 'w_whirlwind', name: '회오리 베기', icon: '🌀', color: 0xdd5533, classId: 'warrior', category: '공격', baseCd: 6, baseMult: 1.2, mpCost: 20, descFn: m => `ATK×${m.toFixed(1)} ×3회 연타`, sfxType: 'hit', effectType: 'multi_hit', hits: 3, btnColor: 0x884422, btnHover: 0xaa5533 },
  { id: 'w_earthquake', name: '지진 타격', icon: '💥', color: 0xbb6633, classId: 'warrior', category: '공격', baseCd: 8, baseMult: 3, mpCost: 25, descFn: m => `ATK×${m.toFixed(1)} + 2초 스턴`, sfxType: 'explosion', effectType: 'single_dmg', debuffDuration: 2, debuffEffect: 'stun', btnColor: 0x775522, btnHover: 0x996633 },
  { id: 'w_shield_up', name: '방패 올리기', icon: '🛡️', color: 0x4488cc, classId: 'warrior', category: '방어', baseCd: 10, baseMult: 0, mpCost: 25, descFn: () => `3초간 받는 데미지 -70%`, sfxType: 'shield', effectType: 'buff_self', buffDuration: 3, buffEffect: 'def70', btnColor: 0x336688, btnHover: 0x4488aa },
  { id: 'w_taunt', name: '도발', icon: '😤', color: 0xcc8844, classId: 'warrior', category: '방어', baseCd: 8, baseMult: 0, mpCost: 15, descFn: () => `몬스터 ATK -30% (5초)`, sfxType: 'debuff', effectType: 'debuff_enemy', debuffDuration: 5, debuffEffect: 'weakatk30', btnColor: 0x886633, btnHover: 0xaa8844 },
  { id: 'w_counter', name: '반격', icon: '🔄', color: 0xaa5544, classId: 'warrior', category: '방어', baseCd: 12, baseMult: 0, mpCost: 25, descFn: () => `피격 시 50% 반사 (5초)`, sfxType: 'shield', effectType: 'reflect', reflectPct: 0.5, buffDuration: 5, btnColor: 0x774433, btnHover: 0x995544 },
  { id: 'w_grenade', name: '수류탄', icon: '💣', color: 0xdd6622, classId: 'warrior', category: '범위', baseCd: 7, baseMult: 2.5, mpCost: 30, descFn: m => `전체 ATK×${m.toFixed(1)} 물리 데미지`, sfxType: 'explosion', effectType: 'aoe', btnColor: 0x884411, btnHover: 0xaa5522 },
  { id: 'w_shield_blast', name: '폭발 방패', icon: '🛡💥', color: 0x5599cc, classId: 'warrior', category: '범위', baseCd: 10, baseMult: 2, mpCost: 30, descFn: m => `3초 방어 후 ATK×${m.toFixed(1)} 반사 폭발`, sfxType: 'explosion', effectType: 'aoe', buffDuration: 3, buffEffect: 'def50', btnColor: 0x447788, btnHover: 0x5599aa },
  { id: 'w_warcry', name: '전쟁의 외침', icon: '📣', color: 0xff6644, classId: 'warrior', category: '범위', baseCd: 15, baseMult: 0, mpCost: 45, descFn: () => `5초 ATK +50% + 공격속도 +30%`, sfxType: 'buff', effectType: 'buff_self', buffDuration: 5, buffEffect: 'warcry', btnColor: 0x993322, btnHover: 0xbb4433 },
];

/* ================================================================
   MAGE SKILLS (12)
   ================================================================ */

export const MAGE_SKILLS: SkillDef[] = [
  { id: 'm_fireball', name: '파이어볼', icon: '🔥', color: 0xff4400, classId: 'mage', category: '불', baseCd: 5, baseMult: 3, mpCost: 20, descFn: m => `ATK×${m.toFixed(1)} 화염 데미지`, sfxType: 'fire', effectType: 'single_dmg', btnColor: 0x993311, btnHover: 0xcc4422 },
  { id: 'm_firestorm', name: '화염 폭풍', icon: '🔥🌪', color: 0xff6622, classId: 'mage', category: '불', baseCd: 8, baseMult: 1.5, mpCost: 30, descFn: m => `ATK×${m.toFixed(1)}/s 3초 화염 도트`, sfxType: 'fire', effectType: 'dot', dotSeconds: 3, btnColor: 0x884411, btnHover: 0xaa5522 },
  { id: 'm_magma', name: '마그마 폭발', icon: '🌋', color: 0xff3300, classId: 'mage', category: '불', baseCd: 10, baseMult: 2, mpCost: 40, descFn: m => `전체 ATK×${m.toFixed(1)} + 3초 연소`, sfxType: 'fire', effectType: 'aoe', dotSeconds: 3, btnColor: 0x992211, btnHover: 0xbb3322 },
  { id: 'm_ice_spike', name: '아이스 스파이크', icon: '❄️', color: 0x44aaff, classId: 'mage', category: '얼음', baseCd: 6, baseMult: 2, mpCost: 20, descFn: m => `ATK×${m.toFixed(1)} + 공격속도 -40% (3초)`, sfxType: 'ice', effectType: 'single_dmg', debuffDuration: 3, debuffEffect: 'slow40', btnColor: 0x336699, btnHover: 0x4488bb },
  { id: 'm_freeze', name: '빙결', icon: '🧊', color: 0x66ccff, classId: 'mage', category: '얼음', baseCd: 10, baseMult: 0, mpCost: 35, descFn: () => `적 2초 완전 동결`, sfxType: 'ice', effectType: 'debuff_enemy', debuffDuration: 2, debuffEffect: 'freeze', btnColor: 0x4488aa, btnHover: 0x66aacc },
  { id: 'm_blizzard', name: '눈보라', icon: '🌨️', color: 0x88ddff, classId: 'mage', category: '얼음', baseCd: 12, baseMult: 1.8, mpCost: 40, descFn: m => `전체 ATK×${m.toFixed(1)} + 전체 감속`, sfxType: 'ice', effectType: 'aoe', debuffDuration: 3, debuffEffect: 'slow40', btnColor: 0x5599bb, btnHover: 0x77bbdd },
  { id: 'm_lightning', name: '번개 화살', icon: '⚡', color: 0xffee44, classId: 'mage', category: '번개', baseCd: 3, baseMult: 1.5, mpCost: 15, descFn: m => `ATK×${m.toFixed(1)} 빠른 번개`, sfxType: 'lightning', effectType: 'single_dmg', btnColor: 0x888833, btnHover: 0xaaaa44 },
  { id: 'm_chain_lightning', name: '번개 연쇄', icon: '⚡⚡', color: 0xddcc22, classId: 'mage', category: '번개', baseCd: 7, baseMult: 1.2, mpCost: 25, descFn: m => `ATK×${m.toFixed(1)} ×3회 번개`, sfxType: 'lightning', effectType: 'multi_hit', hits: 3, btnColor: 0x777722, btnHover: 0x999933 },
  { id: 'm_thunder', name: '뇌전', icon: '🌩️', color: 0xffdd00, classId: 'mage', category: '번개', baseCd: 10, baseMult: 2.5, mpCost: 35, descFn: m => `전체 ATK×${m.toFixed(1)} + 1초 마비`, sfxType: 'lightning', effectType: 'aoe', debuffDuration: 1, debuffEffect: 'stun', btnColor: 0x887711, btnHover: 0xaa9922 },
  { id: 'm_magic_burst', name: '마법 폭발', icon: '💫', color: 0x9966ff, classId: 'mage', category: '광역', baseCd: 8, baseMult: 2, mpCost: 35, descFn: m => `전체 ATK×${m.toFixed(1)} 마법 데미지`, sfxType: 'explosion', effectType: 'aoe', btnColor: 0x553399, btnHover: 0x7744bb },
  { id: 'm_meteor', name: '메테오', icon: '☄️', color: 0xff5500, classId: 'mage', category: '광역', baseCd: 15, baseMult: 5, mpCost: 50, descFn: m => `전체 ATK×${m.toFixed(1)} 강력 화염`, sfxType: 'fire', effectType: 'aoe', btnColor: 0x993300, btnHover: 0xbb4411 },
  { id: 'm_mana_overload', name: '마나 과부하', icon: '🔮', color: 0xaa44ff, classId: 'mage', category: '광역', baseCd: 20, baseMult: 0, mpCost: 60, descFn: () => `5초간 스킬 데미지 ×3`, sfxType: 'buff', effectType: 'buff_self', buffDuration: 5, buffEffect: 'mana_overload', btnColor: 0x662299, btnHover: 0x8833bb },
];

/* ================================================================
   ROGUE SKILLS (12)
   ================================================================ */

export const ROGUE_SKILLS: SkillDef[] = [
  { id: 'r_poison_dagger', name: '독 단검', icon: '🗡☠', color: 0x44aa22, classId: 'rogue', category: '독검', baseCd: 5, baseMult: 1.5, mpCost: 15, descFn: m => `ATK×${m.toFixed(1)} + 5초 독 도트`, sfxType: 'poison', effectType: 'single_dmg', dotSeconds: 5, btnColor: 0x226611, btnHover: 0x338822 },
  { id: 'r_venom_inject', name: '맹독 주입', icon: '💉', color: 0x33cc11, classId: 'rogue', category: '독검', baseCd: 8, baseMult: 2, mpCost: 25, descFn: m => `ATK×${m.toFixed(1)} 독 + 방어력 감소`, sfxType: 'poison', effectType: 'single_dmg', debuffDuration: 5, debuffEffect: 'defdown', btnColor: 0x228811, btnHover: 0x33aa22 },
  { id: 'r_poison_fog', name: '독 안개', icon: '🌫️', color: 0x66cc44, classId: 'rogue', category: '독검', baseCd: 12, baseMult: 0.8, mpCost: 30, descFn: m => `3초간 ATK×${m.toFixed(1)}/s 자동 독`, sfxType: 'poison', effectType: 'dot', dotSeconds: 3, btnColor: 0x448822, btnHover: 0x55aa33 },
  { id: 'r_chakram', name: '차크람', icon: '💿', color: 0xcc8844, classId: 'rogue', category: '차크람', baseCd: 6, baseMult: 1.8, mpCost: 20, descFn: m => `전체 ATK×${m.toFixed(1)} 관통`, sfxType: 'hit', effectType: 'aoe', btnColor: 0x886633, btnHover: 0xaa8844 },
  { id: 'r_spin_chakram', name: '회전 차크람', icon: '🔄💿', color: 0xddaa55, classId: 'rogue', category: '차크람', baseCd: 9, baseMult: 1.2, mpCost: 25, descFn: m => `ATK×${m.toFixed(1)} ×3회 관통`, sfxType: 'hit', effectType: 'multi_hit', hits: 3, btnColor: 0x887744, btnHover: 0xaa9955 },
  { id: 'r_explode_chakram', name: '폭발 차크람', icon: '💿💥', color: 0xff8844, classId: 'rogue', category: '차크람', baseCd: 12, baseMult: 2.5, mpCost: 35, descFn: m => `전체 ATK×${m.toFixed(1)} 폭발`, sfxType: 'explosion', effectType: 'aoe', btnColor: 0x885533, btnHover: 0xaa6644 },
  { id: 'r_stealth', name: '은신', icon: '👤', color: 0x6644aa, classId: 'rogue', category: '은신', baseCd: 10, baseMult: 0, mpCost: 30, descFn: () => `3초 무적 + 다음 공격 크리티컬`, sfxType: 'stealth', effectType: 'stealth', stealthDuration: 3, btnColor: 0x443377, btnHover: 0x664499 },
  { id: 'r_shadow_clone', name: '그림자 분신', icon: '👥', color: 0x7755bb, classId: 'rogue', category: '은신', baseCd: 12, baseMult: 0.5, mpCost: 30, descFn: m => `2초 분신 (ATK×${m.toFixed(1)} 추가 타격)`, sfxType: 'stealth', effectType: 'buff_self', buffDuration: 2, buffEffect: 'shadow_clone', btnColor: 0x553388, btnHover: 0x7744aa },
  { id: 'r_assassinate', name: '암살', icon: '🔪', color: 0xcc2255, classId: 'rogue', category: '은신', baseCd: 15, baseMult: 5, mpCost: 45, descFn: m => `ATK×${m.toFixed(1)} (은신 시 ×2)`, sfxType: 'hit', effectType: 'single_dmg', btnColor: 0x881133, btnHover: 0xaa2244 },
  { id: 'r_flashbang', name: '섬광탄', icon: '💡', color: 0xffffaa, classId: 'rogue', category: '도구', baseCd: 8, baseMult: 0, mpCost: 25, descFn: () => `1.5초 스턴 + CRIT +30% (5초)`, sfxType: 'debuff', effectType: 'debuff_enemy', debuffDuration: 1.5, debuffEffect: 'stun', buffDuration: 5, buffEffect: 'crit30', btnColor: 0x888855, btnHover: 0xaaaa66 },
  { id: 'r_trap', name: '함정 설치', icon: '🪤', color: 0xaa7733, classId: 'rogue', category: '도구', baseCd: 10, baseMult: 4, mpCost: 25, descFn: m => `ATK×${m.toFixed(1)} 자동 발동 함정`, sfxType: 'explosion', effectType: 'single_dmg', btnColor: 0x775522, btnHover: 0x996633 },
  { id: 'r_smoke', name: '연막탄', icon: '💨', color: 0x888888, classId: 'rogue', category: '도구', baseCd: 10, baseMult: 0, mpCost: 20, descFn: () => `3초 회피율 +50%`, sfxType: 'stealth', effectType: 'buff_self', buffDuration: 3, buffEffect: 'dodge50', btnColor: 0x555555, btnHover: 0x777777 },
];

/* ================================================================
   BASIC ATTACK SKILLS (per class, slot 0 only)
   ================================================================ */

export const BASIC_ATTACK_SKILLS: Record<string, SkillDef> = {
  warrior: { id: 'basic_warrior', name: '강타', icon: '🪓', color: 0xcc4422, classId: 'warrior', category: '기본', baseCd: 5, baseMult: 1.2, mpCost: 0, descFn: m => `ATK×${m.toFixed(1)} 근접 슬래시`, sfxType: 'hit', effectType: 'single_dmg', btnColor: 0x883322, btnHover: 0xaa4433 },
  mage: { id: 'basic_mage', name: '마법탄', icon: '✴️', color: 0x4488ff, classId: 'mage', category: '기본', baseCd: 5, baseMult: 1.0, mpCost: 0, descFn: m => `ATK×${m.toFixed(1)} 관통 마법탄`, sfxType: 'lightning', effectType: 'single_dmg', btnColor: 0x336699, btnHover: 0x4488bb },
  rogue: { id: 'basic_rogue', name: '쌍검', icon: '⚔️', color: 0x9944cc, classId: 'rogue', category: '기본', baseCd: 5, baseMult: 0.6, mpCost: 0, descFn: m => `ATK×${m.toFixed(1)} ×2회 빠른 베기`, sfxType: 'hit', effectType: 'multi_hit', hits: 2, btnColor: 0x663388, btnHover: 0x884499 },
};

/* ================================================================
   COMBINED MAP
   ================================================================ */

export const CLASS_SKILL_POOLS: Record<string, SkillDef[]> = {
  warrior: WARRIOR_SKILLS,
  mage: MAGE_SKILLS,
  rogue: ROGUE_SKILLS,
};

const _all: Record<string, SkillDef> = {};
[...WARRIOR_SKILLS, ...MAGE_SKILLS, ...ROGUE_SKILLS].forEach(s => { _all[s.id] = s; });
Object.values(BASIC_ATTACK_SKILLS).forEach(s => { _all[s.id] = s; });
export const ALL_SKILL_DEFS: Record<string, SkillDef> = _all;
