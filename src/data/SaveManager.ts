const PERM_KEY = 'mc_permanent';
const RUN_KEY = 'mc_run';
const SETTINGS_KEY = 'mc_settings';
const ACH_KEY = 'mc_achievements';
const SOUL_KEY = 'mc_soul';
const MARK_KEY = 'mc_marks';

export interface SoulData {
  gold: number;
  stage: number;
  region: number;
}

export type MarkId = 'dark' | 'curse' | 'fear' | 'despair' | 'madness';
export const ALL_MARK_IDS: MarkId[] = ['dark', 'curse', 'fear', 'despair', 'madness'];

export interface MarkInfo {
  id: MarkId;
  name: string;
  icon: string;
  penalty: string;
  bonus: string;
}

export const MARK_DEFS: Record<MarkId, MarkInfo> = {
  dark: { id: 'dark', name: '어둠의 각인', icon: '🌑', penalty: '최대 HP -15', bonus: 'ATK +3' },
  curse: {
    id: 'curse',
    name: '저주의 각인',
    icon: '💀',
    penalty: 'MP 회복 -20%',
    bonus: '스킬 데미지 +25%',
  },
  fear: {
    id: 'fear',
    name: '공포의 각인',
    icon: '👁️',
    penalty: '받는 데미지 +10%',
    bonus: '골드 드롭 +30%',
  },
  despair: {
    id: 'despair',
    name: '절망의 각인',
    icon: '💔',
    penalty: '포션 효과 -20%',
    bonus: '크리티컬 +15%',
  },
  madness: {
    id: 'madness',
    name: '광기의 각인',
    icon: '🔥',
    penalty: '공격속도 +20%',
    bonus: '피격 시 HP -2 추가',
  },
};

export interface PermanentData {
  relicPoints: number;
  relicLevels: Record<string, number>;
  bestLocal: Record<number, number>;
  prestigeCount: number;
  totalPlayCount: number;
}

export interface RunData {
  stage: number;
  startRegion: number;
  classId: string;
  playerHp: number;
  playerMaxHp: number;
  playerMp: number;
  playerMaxMp: number;
  attackPower: number;
  gold: number;
  level: number;
  xp: number;
  xpToNext: number;
  cardLevels: Record<string, number>;
  skillLevels: Record<string, number>;
  equippedSkills: string[];
  quickSlots: { potionLv: number; count: number }[];
  activeSynergies: string[];
  cardRarityBonus: Record<string, number>;
  legendaryEffects: Record<string, boolean>;
  highestStageCleared: number;
  totalKills: number;
  totalGoldEarned: number;
  hasRevived: boolean;
  autoAttackEnabled?: boolean;
  savedAt: number;
}

export interface SettingsData {
  muted: boolean;
  bgmVolume: number;
  sfxVolume: number;
  fullscreen: boolean;
}

export interface AchievementSave {
  /** id → timestamp of unlock */
  unlocked: Record<string, number>;
  /** id → true if reward claimed */
  claimed: Record<string, boolean>;
  /** cumulative kill count across all runs */
  totalKillsAll: number;
  /** cumulative run completions */
  totalRunsCompleted: number;
  /** whether any potion was used this run (tracked transiently, persisted per save) */
  potionUsedThisRun: boolean;
  /** whether player took damage during current boss fight */
  bossHitThisRun: boolean;
}

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export const SaveManager = {
  /* ---- permanent ---- */

  loadPermanent(): PermanentData {
    const d = load<PermanentData>(PERM_KEY);
    return {
      relicPoints: d?.relicPoints ?? 0,
      relicLevels: d?.relicLevels ?? {},
      bestLocal: d?.bestLocal ?? {},
      prestigeCount: d?.prestigeCount ?? 0,
      totalPlayCount: d?.totalPlayCount ?? 0,
    };
  },

  savePermanent(data: PermanentData) {
    save(PERM_KEY, data);
  },

  /* ---- run ---- */

  loadRun(): RunData | null {
    return load<RunData>(RUN_KEY);
  },
  saveRun(data: RunData) {
    save(RUN_KEY, data);
  },
  deleteRun() {
    localStorage.removeItem(RUN_KEY);
  },
  hasRun(): boolean {
    return localStorage.getItem(RUN_KEY) !== null;
  },

  /* ---- settings ---- */

  loadSettings(): SettingsData {
    const d = load<SettingsData>(SETTINGS_KEY);
    return {
      muted: d?.muted ?? false,
      bgmVolume: d?.bgmVolume ?? 0.5,
      sfxVolume: d?.sfxVolume ?? 0.7,
      fullscreen: d?.fullscreen ?? false,
    };
  },
  saveSettings(data: SettingsData) {
    save(SETTINGS_KEY, data);
  },

  /* ---- achievements ---- */

  loadAchievements(): AchievementSave {
    const d = load<AchievementSave>(ACH_KEY);
    return {
      unlocked: d?.unlocked ?? {},
      claimed: d?.claimed ?? {},
      totalKillsAll: d?.totalKillsAll ?? 0,
      totalRunsCompleted: d?.totalRunsCompleted ?? 0,
      potionUsedThisRun: d?.potionUsedThisRun ?? false,
      bossHitThisRun: d?.bossHitThisRun ?? false,
    };
  },
  saveAchievements(data: AchievementSave) {
    save(ACH_KEY, data);
  },

  /* ---- soul ---- */

  loadSoul(): SoulData | null {
    return load<SoulData>(SOUL_KEY);
  },
  saveSoul(data: SoulData) {
    save(SOUL_KEY, data);
  },
  deleteSoul() {
    localStorage.removeItem(SOUL_KEY);
  },

  /* ---- death marks ---- */

  loadMarks(): MarkId[] {
    const d = load<MarkId[]>(MARK_KEY);
    return Array.isArray(d) ? d : [];
  },
  saveMarks(marks: MarkId[]) {
    save(MARK_KEY, marks);
  },

  /* ---- reset ---- */

  resetAll() {
    localStorage.removeItem(PERM_KEY);
    localStorage.removeItem(RUN_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(ACH_KEY);
    localStorage.removeItem(SOUL_KEY);
    localStorage.removeItem(MARK_KEY);
  },
};
