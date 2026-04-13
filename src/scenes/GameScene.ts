import Phaser from 'phaser';
import { Monster } from '../objects/Monster';
import { DamageText } from '../objects/DamageText';
import { SkillButton } from '../objects/SkillButton';
import { REGIONS, RegionDef } from '../data/regions';
import { DEFAULT_RELIC_LEVELS } from '../data/relics';
import { CLASSES, ClassDef } from '../data/classes';
import {
  SaveManager,
  RunData,
  AchievementSave,
  SoulData,
  MarkId,
  ALL_MARK_IDS,
  MARK_DEFS,
} from '../data/SaveManager';
import { SoundManager } from '../data/SoundManager';
import { ACHIEVEMENTS } from '../data/achievements';
import { RelicPanel } from '../objects/RelicPanel';
import {
  ALL_SKILL_DEFS,
  CLASS_SKILL_POOLS,
  BASIC_ATTACK_SKILLS,
  SkillDef,
  SfxType,
} from '../data/skillDefs';
import { SpecialType } from '../objects/Monster';
import { NARRATION, NarrationEntry } from '../data/narration';
import {
  INIT_HP,
  INIT_ATK,
  INIT_ATK_INTERVAL_MS,
  MIN_ATK_INTERVAL_MS,
  INIT_MP,
  MP_REGEN_PER_SEC,
  MON_BASE_HP,
  MON_HP_GROWTH,
  MON_BASE_ATK,
  MON_ATK_GROWTH,
  MON_ATK_INTERVAL_NORMAL,
  MON_ATK_INTERVAL_MINI,
  MON_ATK_INTERVAL_FINAL,
  SHOP_BTN,
  RELIC_BTN,
  HP_BAR,
  MP_BAR,
  XP_BAR,
  MAIN_MON_POS,
  SUB_MON_POSITIONS,
  MAX_SLOTS,
  SLOT_W,
  SLOT_H,
  SLOT_Y,
  SLOT_XS,
  QSLOT_W,
  QSLOT_H,
  QSLOT_Y,
  QSLOT_XS,
  MAX_POTION_STACK,
} from '../config/constants';
import type { CardDef, CardRarity, QuickSlotData } from '../types/index';
import {
  STAT_CARDS,
  POTION_DATA,
  SHOP_ITEMS,
  DOOR_DEFS,
  EVENTS,
  RARITY_COLORS,
  LEGENDARY_DESCS,
  SYNERGIES,
  AUTO_ATK_CARDS,
} from '../config/cardData';

function cv(base: number, level: number): number {
  return level <= 0 ? 0 : base * level;
}

function rollRarity(): CardRarity {
  const r = Math.random();
  if (r < 0.05) return 'legendary';
  if (r < 0.2) return 'rare';
  return 'normal';
}

function skillMult(id: string, level: number): number {
  if (level <= 0) return 0;
  const def = ALL_SKILL_DEFS[id];
  if (!def) return 0;
  return def.baseMult * (1 + 0.3 * (level - 1));
}

function skillCdCalc(id: string, level: number, cdReduction: number): number {
  const def = ALL_SKILL_DEFS[id];
  if (!def) return 0;
  return def.baseCd * Math.pow(0.85, Math.max(0, level - 1)) * cdReduction;
}

/* ================================================================ */

export class GameScene extends Phaser.Scene {
  /* ---- state ---- */

  private gold = 0;
  private attackPower = INIT_ATK;
  private stage = 1;
  private highestStageCleared = 0;
  private regionBossesKilled = 0;

  private level = 1;
  private xp = 0;
  private xpToNext = 18;
  private pendingLevelUps = 0;
  private cardLevels: Record<string, number> = {};

  private equippedSkills: string[] = [];
  private skillLevels: Record<string, number> = {};
  private quickSlots: QuickSlotData[] = [];

  private playerHp = INIT_HP;
  private playerMaxHp = INIT_HP;
  private playerMp = INIT_MP;
  private playerMaxMp = INIT_MP;
  private mpRegenAccum = 0;
  private attackAccum = 0;
  private autoAttackEnabled = false;
  private autoAttackBadge?: Phaser.GameObjects.Container;
  private chargeTimers: Phaser.Time.TimerEvent[] = [];

  private atkBuffActive = false;
  private atkBuffTimer?: Phaser.Time.TimerEvent;
  private invincible = false;
  private invincibleTimer?: Phaser.Time.TimerEvent;

  /* skill-effect state */
  private stealthActive = false;
  private stealthGuaranteeCrit = false;
  private reflectActive = false;
  private reflectPct = 0;
  private dodgeChance = 0;
  private warcryActive = false;
  private manaOverloadActive = false;
  private monsterStunned = false;
  private monsterWeakened = false;
  private monsterWeakenPct = 0;
  private monsterFrozen = false;
  private shieldDmgReduce = 0;
  private shadowCloneActive = false;
  private shadowCloneMult = 0;
  private dotTimers: Phaser.Time.TimerEvent[] = [];
  private tempCritBonus = 0;

  private gameOver = false;
  private cardSelecting = false;
  private shopOpen = false;
  private relicOpen = false;
  private monsters: Monster[] = [];
  private targetMonster: Monster | null = null;
  private waveXpAccum = 0;
  private poisonTimer?: Phaser.Time.TimerEvent;

  private currentBossType: 'none' | 'mini' | 'final' = 'none';
  private bossSpecialTimer?: Phaser.Time.TimerEvent;
  private bossRageTimer?: Phaser.Time.TimerEvent;
  private bossRageLevel = 0;
  private monsterAttackTimer?: Phaser.Time.TimerEvent;
  private totalKills = 0;
  private totalGoldEarned = 0;

  private waveTotal = 0;
  private waveCurrent = 0;
  private stageType: 'combat' | 'elite' | 'boss' | 'shop' | 'rest' | 'event' = 'combat';
  private doorSelecting = false;
  private isEliteStage = false;
  private nextCombatCursed = false;
  private tempEventAtkBuff = 0;
  private hasRevived = false;
  private relicPanel!: RelicPanel;
  private waveText!: Phaser.GameObjects.Text;
  private shopFromDoor = false;
  private restCardPending = false;
  private pendingStageClear = false;
  private pendingStageClearBoss = false;
  private waveClearing = false;
  private waitingFirstCard = false;
  private pauseOpen = false;
  private cardRarityBonus: Record<string, number> = {};
  private legendaryEffects: Record<string, boolean> = {};
  private activeSynergies: string[] = [];
  private mageStartRare = false;
  private achData!: AchievementSave;
  private potionUsedThisRun = false;
  private bossHitThisRun = false;
  private cheatInvincible = false;
  private cheatAtk = false;

  private deathMarks: MarkId[] = [];
  private soulData: SoulData | null = null;
  private soulRecovered = false;
  private skillSealed = false;
  private skillSealTimer?: Phaser.Time.TimerEvent;

  private bossPatternTimer?: Phaser.Time.TimerEvent;
  private bossPatternWarning?: Phaser.GameObjects.Text;
  private bossDefenseReduction = 0;
  private bossDefenseTimer?: Phaser.Time.TimerEvent;

  /* response system state */
  private overdriveGauge = 0;
  private overdriveActive = false;
  private overdriveFever = false;
  private overdriveTimer?: Phaser.Time.TimerEvent;
  private overdriveEdgeGfx?: Phaser.GameObjects.Graphics;
  private overdriveCountdown?: Phaser.GameObjects.Text;
  private odReadyText?: Phaser.GameObjects.Text;
  private odPulseTween?: Phaser.Tweens.Tween;
  private odDarkOverlay?: Phaser.GameObjects.Graphics;
  private odTimeBar?: Phaser.GameObjects.Graphics;
  private odTimeBarBg?: Phaser.GameObjects.Graphics;
  private odParticleTimer?: Phaser.Time.TimerEvent;
  private odAuraGfx?: Phaser.GameObjects.Graphics;
  private odAuraTween?: Phaser.Tweens.Tween;
  private odSlotGlowTimer?: Phaser.Time.TimerEvent;
  private odEffects: Phaser.GameObjects.GameObject[] = [];
  private comboCount = 0;
  private comboTimer?: Phaser.Time.TimerEvent;
  private emergencyDefCd = 0;
  private emergencyDefActive = false;
  private parryReady = true;
  private parryCd = 0;
  private parryWindowOpen = false;
  private parryWindowOpenTime = 0;
  private parryAttempted = false;
  private parryGaugeGfx?: Phaser.GameObjects.Graphics;
  private parryWindowTimer?: Phaser.Time.TimerEvent;
  private parryAuraGfx?: Phaser.GameObjects.Graphics;
  private parrySeqId = 0;
  private attackSeqActive = false;
  private parryTutorialShown = false;
  private firstParryDone = false;
  private parrySuccessCount = 0;
  private parryMasteryLevel = 0;
  private parryIsFakePhase = false;
  private parryFakeCompleted = false;
  private parryMultiHitQueue: number[] = [];
  private parryMultiHitSuccesses = 0;
  private bossAttackIncoming = false;
  private mageBarrierActive = false;
  private mageBarrierAbsorb = 0;
  private roguePostDodgeTimer?: Phaser.Time.TimerEvent;
  private roguePostDodgeActive = false;

  /* ---- UI refs ---- */

  private goldText!: Phaser.GameObjects.Text;
  private relicPtsText!: Phaser.GameObjects.Text;
  private statsLine1!: Phaser.GameObjects.Text;
  private statsLine2!: Phaser.GameObjects.Text;
  private bonusText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;

  private xpBarFill!: Phaser.GameObjects.Graphics;
  private xpLevelText!: Phaser.GameObjects.Text;

  private playerHpBg!: Phaser.GameObjects.Graphics;
  private playerHpFill!: Phaser.GameObjects.Graphics;
  private playerHpText!: Phaser.GameObjects.Text;
  private playerMpFill!: Phaser.GameObjects.Graphics;
  private playerMpText!: Phaser.GameObjects.Text;

  private shopBtnBg!: Phaser.GameObjects.Graphics;
  private relicBtnBg!: Phaser.GameObjects.Graphics;

  private emptySlotGfx: Phaser.GameObjects.Graphics[] = [];
  private skillButtons: (SkillButton | null)[] = [];

  private qSlotBgs: Phaser.GameObjects.Graphics[] = [];
  private qSlotIcons: Phaser.GameObjects.Text[] = [];
  private qSlotLvTexts: Phaser.GameObjects.Text[] = [];
  private qSlotCounts: Phaser.GameObjects.Text[] = [];

  private bgGraphics!: Phaser.GameObjects.Graphics;
  private bossBgOverlay?: Phaser.GameObjects.Graphics;
  private atkGaugeFill!: Phaser.GameObjects.Graphics;
  private buffBarContainer?: Phaser.GameObjects.Container;
  private tooltipBg?: Phaser.GameObjects.Graphics;
  private tooltipText?: Phaser.GameObjects.Text;
  private overlayElements: Phaser.GameObjects.GameObject[] = [];
  private pauseElements: Phaser.GameObjects.GameObject[] = [];
  private synergyContainer?: Phaser.GameObjects.Container;

  /* response system UI */
  private overdriveGaugeBg?: Phaser.GameObjects.Graphics;
  private overdriveGaugeFill?: Phaser.GameObjects.Graphics;
  private overdriveGaugeText?: Phaser.GameObjects.Text;
  private emergencyDefBtn?: Phaser.GameObjects.Container;
  private emergencyDefCdText?: Phaser.GameObjects.Text;
  private parryHintText?: Phaser.GameObjects.Text;
  private parryCdOverlay?: Phaser.GameObjects.Text;
  private narrationBg?: Phaser.GameObjects.Graphics;
  private narrationText?: Phaser.GameObjects.Text;
  private narrationSpeaker?: Phaser.GameObjects.Text;
  private narrationActive = false;
  private narrationTimer?: Phaser.Time.TimerEvent;
  private narrationTypingTimer?: Phaser.Time.TimerEvent;

  private startRegion = 1;
  private selectedClass: ClassDef = CLASSES[0];

  constructor() {
    super({ key: 'GameScene' });
  }

  private loadingRun = false;

  init(data: { startRegion?: number; classId?: string; loadRun?: boolean }) {
    this.loadingRun = data?.loadRun === true;
    this.startRegion = data?.startRegion ?? 1;
    this.selectedClass = CLASSES.find(c => c.id === (data?.classId ?? 'warrior')) ?? CLASSES[0];
  }

  /* ---- persistent registry helpers ---- */

  private get relicPoints(): number {
    return this.registry.get('relicPoints') ?? 0;
  }
  private set relicPointsVal(v: number) {
    this.registry.set('relicPoints', v);
  }

  private get relicLevels(): Record<string, number> {
    const stored = this.registry.get('relicLevels');
    return { ...DEFAULT_RELIC_LEVELS, ...(stored ?? {}) };
  }
  private setRelicLevel(id: string, lv: number) {
    const cur = { ...this.relicLevels };
    cur[id] = lv;
    this.registry.set('relicLevels', cur);
  }

  private get prestigeCount(): number {
    return this.registry.get('prestigeCount') ?? 0;
  }
  private get goldMultiplier(): number {
    return 1 + this.prestigeCount * 0.2;
  }

  /* ---- computed: region ---- */

  private get currentRegion(): number {
    return Math.min(REGIONS.length, Math.ceil(this.stage / 20));
  }
  private get localStage(): number {
    return ((this.stage - 1) % 20) + 1;
  }
  private get regionDef(): RegionDef {
    return REGIONS[Math.min(REGIONS.length - 1, this.currentRegion - 1)];
  }

  /* ---- computed: stats ---- */

  private gcv(id: string): number {
    const card = STAT_CARDS.find(c => c.id === id);
    if (!card) return 0;
    return cv(card.baseValue, this.cardLevels[id] ?? 0) + (this.cardRarityBonus[id] ?? 0);
  }
  private getSkillMult(id: string): number {
    return skillMult(id, this.skillLevels[id] ?? 0);
  }
  private hasSynergy(id: string): boolean {
    return this.activeSynergies.includes(id);
  }
  private skillCd(id: string): number {
    return skillCdCalc(id, this.skillLevels[id] ?? 0, this.cooldownReduction);
  }
  private skillCdAt(id: string, level: number): number {
    return skillCdCalc(id, level, this.cooldownReduction);
  }

  private get markMult(): number {
    return this.deathMarks.length >= 5 ? 2 : 1;
  }
  private markCount(id: MarkId): number {
    return this.deathMarks.filter(m => m === id).length * this.markMult;
  }

  private get baseMaxHp(): number {
    return (
      this.selectedClass.hp +
      this.relicLevels.heart * 30 -
      this.relicLevels.dark * 20 -
      this.markCount('dark') * 15
    );
  }
  private get baseAtk(): number {
    return (
      this.selectedClass.atk +
      this.relicLevels.warrior * 2 +
      this.relicLevels.dark * 5 +
      this.markCount('dark') * 3
    );
  }

  private get effectiveAtk(): number {
    let base = this.attackPower + Math.floor(this.gcv('atk')) + this.tempEventAtkBuff;
    if (this.playerHp <= this.playerMaxHp * 0.1) {
      base = Math.floor(base * (1 + this.relicLevels.iron * 0.5));
    }
    if (this.atkBuffActive) base = Math.floor(base * 1.5);
    if (this.warcryActive) base = Math.floor(base * 1.5);
    if (this.cheatAtk) base *= 100;
    return base;
  }
  private get critChance(): number {
    let c = this.gcv('crit') / 100 + this.relicLevels.eye * 0.05;
    if (this.legendaryEffects.atk) c += 0.15;
    if (this.legendaryEffects.crit) c += 0.2;
    if (this.selectedClass.id === 'rogue') c += 0.2;
    c += this.tempCritBonus;
    c += this.markCount('despair') * 0.15;
    if (this.stealthGuaranteeCrit) c = 1;
    return c;
  }
  private get critDamageMult(): number {
    let m = this.legendaryEffects.crit ? 3 : 2;
    if (this.selectedClass.id === 'rogue') m += 0.5;
    return m;
  }
  private get defenseRate(): number {
    let d = this.gcv('def') / 100 + this.relicLevels.shield * 0.05;
    if (this.hasSynergy('iron_guard')) d += 0.1;
    if (this.selectedClass.id === 'warrior') d += 0.15;
    d += this.shieldDmgReduce;
    d -= this.markCount('fear') * 0.1;
    d -= this.bossDefenseReduction;
    return Math.min(Math.max(d, -0.5), 0.9);
  }
  private get lifestealRate(): number {
    let rate = this.gcv('steal') / 100 + this.relicLevels.ring * 0.03;
    if (this.hasSynergy('survivor') && this.playerHp <= this.playerMaxHp * 0.15) rate *= 2;
    return rate;
  }
  private get attackIntervalMs(): number {
    const swiftMult = 1 - this.relicLevels.swift * 0.05;
    const spdVal = this.gcv('spd') * 1000;
    let base = (this.selectedClass.atkIntervalMs - spdVal) * swiftMult;
    if (this.warcryActive) base *= 0.7;
    if (this.hasSynergy('berserker')) base *= 0.9;
    base *= Math.pow(0.8, this.markCount('madness'));
    return Math.max(MIN_ATK_INTERVAL_MS, base);
  }
  private get attacksPerSec(): number {
    return 1000 / this.attackIntervalMs;
  }
  private get xpMultiplier(): number {
    return 1 + this.relicLevels.sage * 0.15;
  }

  private get goldDropMultiplier(): number {
    return (
      this.goldMultiplier *
      (1 + this.relicLevels.gold_touch * 0.2) *
      (1 + this.markCount('fear') * 0.3)
    );
  }
  private get shopDiscount(): number {
    return 1 - this.relicLevels.merchant * 0.1;
  }
  private get potionMultiplier(): number {
    return (1 + this.relicLevels.spring * 0.25) * (1 - this.markCount('despair') * 0.2);
  }
  private get skillDamageMult(): number {
    let m = 1 + this.relicLevels.mana * 0.15;
    if (this.selectedClass.id === 'mage') m += 0.3;
    m += this.markCount('curse') * 0.25;
    if (this.manaOverloadActive) m *= 3;
    if (this.overdriveActive) {
      m *= 2;
      if (this.selectedClass?.id === 'mage') m *= 2;
    }
    return m;
  }
  private get mpRegenRate(): number {
    let rate = MP_REGEN_PER_SEC * (1 + this.relicLevels.mana_spring * 0.2);
    rate *= 1 - this.markCount('curse') * 0.2;
    return Math.max(0.5, rate);
  }
  private get cooldownReduction(): number {
    let r = 1 - this.relicLevels.time * 0.1;
    if (this.selectedClass.id === 'mage') r *= 0.8;
    return r;
  }

  private get monsterAttackPower(): number {
    const r = this.regionDef;
    let base = Math.floor(MON_BASE_ATK * Math.pow(MON_ATK_GROWTH, this.stage - 1) * r.atkMult);
    if (this.currentBossType === 'mini') base = Math.floor(base * 2.5);
    if (this.currentBossType === 'final') base *= 3;
    if (this.nextCombatCursed && this.currentBossType === 'none') base *= 2;
    return base;
  }

  /* ================================================================
     LIFECYCLE
     ================================================================ */

  create() {
    const isResume = this.loadingRun;
    this.resetState();

    this.deathMarks = SaveManager.loadMarks();
    this.soulData = SaveManager.loadSoul();
    this.soulRecovered = false;

    if (isResume) {
      const rd = SaveManager.loadRun();
      if (rd) {
        this.loadRunData(rd);
        this.selectedClass = CLASSES.find(c => c.id === rd.classId) ?? CLASSES[0];
      }
    }
    this.loadingRun = false;

    this.createBackground();
    this.createUI();
    this.createXpBar();
    this.createPlayerHpBar();
    this.createQuickSlots();
    this.createSkillSlots();
    this.relicPanel = new RelicPanel(this, {
      onClose: () => {
        this.relicOpen = false;
      },
      onUpgrade: () => this.updateUI(),
    });

    this.input.keyboard?.on('keydown-ONE', () => this.useQuickSlot(0));
    this.input.keyboard?.on('keydown-TWO', () => this.useQuickSlot(1));
    this.input.keyboard?.on('keydown-Q', () => this.onSkillActivate(0));
    this.input.keyboard?.on('keydown-W', () => this.onSkillActivate(1));
    this.input.keyboard?.on('keydown-E', () => this.onSkillActivate(2));
    this.input.keyboard?.on('keydown-R', () => this.onSkillActivate(3));
    this.input.keyboard?.on('keydown-ENTER', () => this.tryActivateOverdrive());
    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.cycleTarget();
    });
    this.input.keyboard?.on('keydown-ESC', () => this.togglePauseMenu());
    this.input.keyboard?.on('keydown-F9', () => this.toggleCheatInvincible());
    this.input.keyboard?.on('keydown-F10', () => this.toggleCheatAtk());

    this.createSynergyDisplay();
    this.createBuffBar();
    this.createTooltip();
    this.createResponseButtons();

    if (isResume) {
      this.rebuildSkillUI();
      if (this.autoAttackEnabled) this.showAutoAttackBadge();
      this.updateSynergyDisplay();
      this.drawQuickSlots();
      this.drawPlayerHpBar();
      this.drawMpBar();
      this.drawXpBar();
      this.updateUI();
      this.startStage();
    } else {
      SaveManager.deleteRun();
      const perm = SaveManager.loadPermanent();
      perm.totalPlayCount = (perm.totalPlayCount ?? 0) + 1;
      SaveManager.savePermanent(perm);

      if (this.selectedClass.id === 'mage') this.mageStartRare = true;
      this.rebuildSkillUI();

      this.waitingFirstCard = true;

      const showGuidesThenCard = () => {
        this.showBasicAtkTutorial(!this.autoAttackEnabled, () => {
          this.parryTutorialShown = true;
          this.showParryTutorial();
          this.pendingLevelUps = 1;
          this.cardSelecting = true;
          this.time.delayedCall(500, () => this.showCardSelection(true));
        });
      };

      this.showNarration(NARRATION.gameStart, () => {
        const regionEntry = NARRATION.regionEnter[this.currentRegion];
        if (regionEntry) {
          this.showNarration(regionEntry, () => showGuidesThenCard());
        } else {
          showGuidesThenCard();
        }
      });
    }
    SoundManager.playBattleBgm();
  }

  update(_t: number, delta: number) {
    if (this.gameOver || this.cardSelecting || this.doorSelecting || this.pauseOpen) {
      this.drawAtkGauge(0);
      return;
    }

    this.mpRegenAccum += delta;
    if (this.mpRegenAccum >= 1000) {
      this.mpRegenAccum -= 1000;
      if (this.playerMp < this.playerMaxMp) {
        this.playerMp = Math.min(this.playerMaxMp, this.playerMp + this.mpRegenRate);
        this.drawMpBar();
        this.refreshSkillButtonStates();
      }
    }
    this.checkLowMpWarning();

    if (this.emergencyDefCd > 0) {
      this.emergencyDefCd = Math.max(0, this.emergencyDefCd - delta / 1000);
      this.updateEmergencyDefBtn();
    }
    if (this.parryCd > 0) {
      this.parryCd = Math.max(0, this.parryCd - delta / 1000);
      if (this.parryCd <= 0) {
        this.parryReady = true;
        this.updateParryCdDisplay();
      }
    }

    const target = this.targetMonster;
    if (!target || target.isDead) {
      this.drawAtkGauge(0);
      return;
    }
    if (this.autoAttackEnabled) {
      const basicBtn = this.skillButtons[0];
      if (basicBtn && basicBtn.isReady && !this.skillSealed) {
        this.onSkillActivate(0);
      }
    }
  }

  private drawAtkGauge(ratio: number) {
    const gx = 30,
      gy = 178,
      gw = 160,
      gh = 6;
    this.atkGaugeFill.clear();
    const fw = gw * ratio;
    if (fw <= 0) return;
    const g = Math.floor(100 + 155 * ratio);
    const b = Math.floor(255 * (1 - ratio * 0.4));
    this.atkGaugeFill.fillStyle((0x30 << 16) | (g << 8) | b, 1);
    this.atkGaugeFill.fillRoundedRect(gx, gy, fw, gh, Math.min(3, fw / 2));
  }

  private resetState() {
    const rl = this.relicLevels;
    this.gold = rl.purse * 20;
    this.attackPower = this.baseAtk;
    this.stage = (this.startRegion - 1) * 20 + 1;
    this.highestStageCleared = 0;
    this.regionBossesKilled = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 30 + 1 * 15;
    this.pendingLevelUps = 0;
    this.cardLevels = { hp: 0, atk: 0, spd: 0, crit: 0, def: 0, steal: 0, mp: 0 };
    this.skillLevels = {};
    this.equippedSkills = [];
    const basicSkill = BASIC_ATTACK_SKILLS[this.selectedClass.id];
    if (basicSkill) {
      this.skillLevels[basicSkill.id] = 1;
      this.equippedSkills.push(basicSkill.id);
    }
    this.quickSlots = [
      { potionLv: 1, count: 2 },
      { potionLv: 0, count: 0 },
    ];
    if (this.selectedClass.id === 'warrior') {
      this.quickSlots[0] = { potionLv: 1, count: 3 };
    } else if (this.selectedClass.id === 'rogue') {
      this.gold += 50;
    }
    this.playerMaxHp = this.baseMaxHp;
    this.playerHp = this.playerMaxHp;
    this.playerMaxMp = INIT_MP;
    this.playerMp = this.playerMaxMp;
    this.mpRegenAccum = 0;
    this.attackAccum = 0;
    this.autoAttackEnabled = false;
    this.attackSeqActive = false;
    this.chargeTimers = [];
    this.atkBuffActive = false;
    this.invincible = false;
    this.gameOver = false;
    this.cardSelecting = false;
    this.shopOpen = false;
    this.relicOpen = false;
    this.waveTotal = 0;
    this.waveCurrent = 0;
    this.waveXpAccum = 0;
    this.monsters = [];
    this.targetMonster = null;
    this.stageType = 'combat';
    this.doorSelecting = false;
    this.isEliteStage = false;
    this.nextCombatCursed = false;
    this.tempEventAtkBuff = 0;
    this.hasRevived = false;
    this.shopFromDoor = false;
    this.restCardPending = false;
    this.pendingStageClear = false;
    this.pendingStageClearBoss = false;
    this.waveClearing = false;
    this.pauseOpen = false;
    this.waitingFirstCard = false;
    this.cardRarityBonus = {};
    this.legendaryEffects = {};
    this.activeSynergies = [];
    this.mageStartRare = false;
    this.achData = SaveManager.loadAchievements();
    this.potionUsedThisRun = false;
    this.bossHitThisRun = false;
    this.poisonTimer = undefined;
    this.bossSpecialTimer = undefined;
    this.bossRageTimer = undefined;
    this.bossRageLevel = 0;
    this.bossPatternTimer = undefined;
    this.bossPatternWarning = undefined;
    this.bossDefenseReduction = 0;
    this.bossDefenseTimer = undefined;
    this.skillSealed = false;
    this.skillSealTimer = undefined;
    this.monsterAttackTimer = undefined;
    this.stealthActive = false;
    this.stealthGuaranteeCrit = false;
    this.reflectActive = false;
    this.reflectPct = 0;
    this.dodgeChance = 0;
    this.warcryActive = false;
    this.manaOverloadActive = false;
    this.monsterStunned = false;
    this.monsterWeakened = false;
    this.monsterWeakenPct = 0;
    this.monsterFrozen = false;
    this.shieldDmgReduce = 0;
    this.shadowCloneActive = false;
    this.shadowCloneMult = 0;
    this.dotTimers = [];
    this.tempCritBonus = 0;
    this.mpWarningShown = false;
    this.currentBossType = 'none';
    this.overdriveGauge = 0;
    this.overdriveActive = false;
    this.overdriveFever = false;
    this.comboCount = 0;
    this.emergencyDefCd = 0;
    this.emergencyDefActive = false;
    this.parryReady = true;
    this.parryCd = 0;
    this.parryWindowOpen = false;
    this.parryWindowOpenTime = 0;
    this.parryAttempted = false;
    this.parryEarlyFailed = false;
    this.parrySuccessCount = 0;
    this.parryMasteryLevel = 0;
    this.parryIsFakePhase = false;
    this.parryFakeCompleted = false;
    this.parryMultiHitQueue = [];
    this.parryMultiHitSuccesses = 0;
    this.bossAttackIncoming = false;
    this.mageBarrierActive = false;
    this.mageBarrierAbsorb = 0;
    this.roguePostDodgeActive = false;
    this.roguePostDodgeTimer = undefined;
    this.totalKills = 0;
    this.totalGoldEarned = 0;
    this.emptySlotGfx = [];
    this.skillButtons = [];
    this.qSlotBgs = [];
    this.qSlotIcons = [];
    this.qSlotLvTexts = [];
    this.qSlotCounts = [];
    this.bossBgOverlay = undefined;
    this.overlayElements = [];
    this.pauseElements = [];
  }

  /* ================================================================
     BACKGROUND
     ================================================================ */

  private createBackground() {
    this.bgGraphics = this.add.graphics();
    this.drawRegionBackground();
  }

  private drawRegionBackground() {
    const r = this.regionDef;
    this.bgGraphics.clear();
    this.bgGraphics.fillGradientStyle(r.bgTop, r.bgTop, r.bgBot, r.bgBot, 1, 1, 1, 1);
    this.bgGraphics.fillRect(0, 0, 800, 600);
    this.bgGraphics.fillStyle(r.panelColor, 0.25);
    this.bgGraphics.fillRect(0, 430, 800, 170);
    this.bgGraphics.lineStyle(1, 0x1a5276, 0.4);
    this.bgGraphics.lineBetween(0, 430, 800, 430);
    this.bgGraphics.fillStyle(0xffffff, 0.04);
    this.bgGraphics.fillCircle(400, 300, 160);
    this.bgGraphics.fillStyle(0xffffff, 0.03);
    this.bgGraphics.fillCircle(400, 300, 120);
  }

  private showBossBackground(isFinal: boolean) {
    this.hideBossBackground();
    this.bossBgOverlay = this.add.graphics().setDepth(1);
    this.bossBgOverlay.fillStyle(isFinal ? 0x4a0000 : 0x3a1500, 0.35);
    this.bossBgOverlay.fillRect(0, 0, 800, 600);
    const bc = isFinal ? 0xff0000 : 0xff6600;
    this.bossBgOverlay.lineStyle(4, bc, 0.45);
    this.bossBgOverlay.strokeRect(2, 2, 796, 596);
    this.bossBgOverlay.lineStyle(2, bc, 0.2);
    this.bossBgOverlay.strokeRect(8, 8, 784, 584);
    this.tweens.add({
      targets: this.bossBgOverlay,
      alpha: 0.6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private hideBossBackground() {
    this.bossBgOverlay?.destroy();
    this.bossBgOverlay = undefined;
  }

  /* ================================================================
     HUD
     ================================================================ */

  private createUI() {
    this.stageText = this.add
      .text(400, 14, '', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50);

    this.waveText = this.add
      .text(HP_BAR.x + HP_BAR.w / 2, HP_BAR.y + HP_BAR.h + 12, '', {
        fontSize: '13px',
        color: '#99aacc',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50);

    this.goldText = this.add
      .text(30, 68, '', {
        fontSize: '20px',
        color: '#ffd700',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(50);

    this.relicPtsText = this.add
      .text(770, 22, '', {
        fontSize: '14px',
        color: '#cc88ff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5)
      .setDepth(50);

    this.statsLine1 = this.add
      .text(30, 94, '', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(50);

    this.statsLine2 = this.add
      .text(30, 118, '', {
        fontSize: '16px',
        color: '#66ccff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(50);

    this.bonusText = this.add
      .text(30, 142, '', {
        fontSize: '14px',
        color: '#aaaaaa',
        fontFamily: 'Arial, sans-serif',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(50);

    this.atkGaugeFill = this.add.graphics().setDepth(50);

    const classIconBg = this.add.graphics().setDepth(49);
    classIconBg.fillStyle(this.selectedClass.color, 0.7);
    classIconBg.fillRoundedRect(726, 38, 44, 44, 8);
    classIconBg.lineStyle(2, this.selectedClass.borderColor, 0.9);
    classIconBg.strokeRoundedRect(726, 38, 44, 44, 8);
    this.add
      .text(748, 52, this.selectedClass.icon, {
        fontSize: '22px',
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.add
      .text(748, 72, this.selectedClass.name, {
        fontSize: '9px',
        color: '#cccccc',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(50);

    this.createMarkDisplay();
    this.updateUI();
  }

  private createMarkDisplay() {
    if (this.deathMarks.length === 0) return;
    const isCursed = this.deathMarks.length >= 5;
    const startX = 30,
      startY = 200;
    const markBg = this.add.graphics().setDepth(49);
    markBg.fillStyle(isCursed ? 0x330000 : 0x111122, 0.6);
    markBg.fillRoundedRect(startX - 4, startY - 4, this.deathMarks.length * 22 + 8, 24, 6);
    if (isCursed) {
      markBg.lineStyle(1, 0xff2222, 0.5);
      markBg.strokeRoundedRect(startX - 4, startY - 4, this.deathMarks.length * 22 + 8, 24, 6);
      this.tweens.add({ targets: markBg, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
    }
    this.deathMarks.forEach((markId, i) => {
      const md = MARK_DEFS[markId];
      this.add
        .text(startX + i * 22 + 8, startY + 8, md.icon, {
          fontSize: '14px',
        })
        .setOrigin(0.5)
        .setDepth(50);
    });
    if (isCursed) {
      this.add
        .text(startX + this.deathMarks.length * 22 + 12, startY + 8, '저주받은 자', {
          fontSize: '9px',
          color: '#ff4444',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5)
        .setDepth(50);
    }
  }

  private createXpBar() {
    const { x, y, w, h } = XP_BAR;
    this.xpLevelText = this.add
      .text(x + w / 2, y - 8, '', {
        fontSize: '11px',
        color: '#88ccff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(52);
    const bg = this.add.graphics().setDepth(50);
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
    bg.fillStyle(0x222233, 1);
    bg.fillRoundedRect(x, y, w, h, 3);
    this.xpBarFill = this.add.graphics().setDepth(51);
    this.drawXpBar();
  }

  private drawXpBar() {
    const { x, y, w, h } = XP_BAR;
    const ratio = Phaser.Math.Clamp(this.xp / this.xpToNext, 0, 1);
    const fw = w * ratio;
    this.xpBarFill.clear();
    if (fw > 0) {
      this.xpBarFill.fillStyle(0x44aaff, 1);
      this.xpBarFill.fillRoundedRect(x, y, fw, h, Math.min(3, fw / 2));
    }
    this.xpLevelText.setText(`Lv.${this.level}  ${this.xp}/${this.xpToNext}`);
  }

  private createPlayerHpBar() {
    const { x, y, w, h } = HP_BAR;
    this.add
      .text(x - 28, y + h / 2, '♥', {
        fontSize: '20px',
        color: '#ff4444',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.playerHpBg = this.add.graphics().setDepth(50);
    this.playerHpBg.fillStyle(0x000000, 0.6);
    this.playerHpBg.fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 7);
    this.playerHpBg.fillStyle(0x331111, 1);
    this.playerHpBg.fillRoundedRect(x, y, w, h, 5);
    this.playerHpFill = this.add.graphics().setDepth(51);
    this.playerHpText = this.add
      .text(x + w / 2, y + h / 2, '', {
        fontSize: '11px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(52);

    const mb = MP_BAR;
    this.add
      .text(mb.x - 28, mb.y + mb.h / 2, '◆', {
        fontSize: '14px',
        color: '#4488ff',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(50);
    const mpBg = this.add.graphics().setDepth(50);
    mpBg.fillStyle(0x000000, 0.6);
    mpBg.fillRoundedRect(mb.x - 2, mb.y - 2, mb.w + 4, mb.h + 4, 5);
    mpBg.fillStyle(0x111133, 1);
    mpBg.fillRoundedRect(mb.x, mb.y, mb.w, mb.h, 4);
    this.playerMpFill = this.add.graphics().setDepth(51);
    this.playerMpText = this.add
      .text(mb.x + mb.w / 2, mb.y + mb.h / 2, '', {
        fontSize: '8px',
        color: '#aaddff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 1,
      })
      .setOrigin(0.5)
      .setDepth(52);

    this.drawPlayerHpBar();
    this.drawMpBar();
  }

  private drawPlayerHpBar() {
    const { x, y, w, h } = HP_BAR;
    const ratio = Phaser.Math.Clamp(this.playerHp / this.playerMaxHp, 0, 1);
    const fw = w * ratio;
    this.playerHpFill.clear();
    if (fw > 0) {
      const r = 160 + Math.floor(70 * ratio);
      const g = Math.floor(50 * ratio);
      this.playerHpFill.fillStyle((r << 16) | (g << 8) | 0x20, 1);
      this.playerHpFill.fillRoundedRect(x, y, fw, h, Math.min(5, fw / 2));
    }
    this.playerHpText.setText(`${Math.max(0, Math.ceil(this.playerHp))} / ${this.playerMaxHp}`);
  }

  private drawMpBar() {
    const { x, y, w, h } = MP_BAR;
    const ratio = Phaser.Math.Clamp(this.playerMp / this.playerMaxMp, 0, 1);
    const fw = w * ratio;
    this.playerMpFill.clear();
    if (fw > 0) {
      this.playerMpFill.fillStyle(0x2266dd, 1);
      this.playerMpFill.fillRoundedRect(x, y, fw, h, Math.min(4, fw / 2));
    }
    this.playerMpText.setText(`${Math.ceil(this.playerMp)} / ${this.playerMaxMp}`);
  }

  private refreshSkillButtonStates() {
    for (let i = 0; i < this.equippedSkills.length; i++) {
      const sid = this.equippedSkills[i];
      const def = ALL_SKILL_DEFS[sid];
      const btn = this.skillButtons[i];
      if (!def || !btn) continue;
      btn.setMpDisabled(this.skillSealed || this.playerMp < def.mpCost);
    }
  }

  private mpWarningShown = false;

  private showMpWarning(_skillName: string, _cost: number) {
    const msg = this.add
      .text(400, 280, '마나부족', {
        fontSize: '32px',
        color: '#6699ff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(300)
      .setAlpha(0);
    this.tweens.add({
      targets: msg,
      alpha: 1,
      duration: 150,
      onComplete: () => {
        this.tweens.add({
          targets: msg,
          alpha: 0,
          y: 260,
          delay: 1800,
          duration: 200,
          onComplete: () => msg.destroy(),
        });
      },
    });
  }

  private flashMpBar() {
    const { x, y, w, h } = MP_BAR;
    const flash = this.add.graphics().setDepth(100);
    flash.fillStyle(0xff2222, 0.6);
    flash.fillRoundedRect(x, y, w, h, 4);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      yoyo: true,
      repeat: 1,
      onComplete: () => flash.destroy(),
    });
  }

  private checkLowMpWarning() {
    const ratio = this.playerMp / this.playerMaxMp;
    if (ratio <= 0.2 && !this.mpWarningShown && this.equippedSkills.length > 0) {
      this.mpWarningShown = true;
      DamageText.show(this, MP_BAR.x + MP_BAR.w / 2, MP_BAR.y + 20, '⚠ MP 부족', '#4488ff', '14px');
      this.flashMpBar();
    } else if (ratio > 0.3) {
      this.mpWarningShown = false;
    }
  }

  /* ================================================================
     ITEM QUICK SLOTS
     ================================================================ */

  private createQuickSlots() {
    this.add
      .text(110, QSLOT_Y - 34, 'ITEM', {
        fontSize: '10px',
        color: '#777788',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(48);
    for (let i = 0; i < 2; i++) {
      const x = QSLOT_XS[i];
      this.qSlotBgs.push(this.add.graphics().setDepth(49));
      this.qSlotIcons.push(
        this.add
          .text(x, QSLOT_Y - 6, '', { fontSize: '20px' })
          .setOrigin(0.5)
          .setDepth(51),
      );
      this.qSlotLvTexts.push(
        this.add
          .text(x, QSLOT_Y + 14, '', {
            fontSize: '9px',
            color: '#cccccc',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
          })
          .setOrigin(0.5)
          .setDepth(51),
      );
      this.qSlotCounts.push(
        this.add
          .text(x + QSLOT_W / 2 - 4, QSLOT_Y + QSLOT_H / 2 - 4, '', {
            fontSize: '12px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(1, 1)
          .setDepth(52),
      );
      this.add
        .text(x - QSLOT_W / 2 + 4, QSLOT_Y - QSLOT_H / 2 + 2, `${i + 1}`, {
          fontSize: '9px',
          color: '#aaaacc',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setDepth(52);
      const zone = this.add
        .zone(x, QSLOT_Y, QSLOT_W, QSLOT_H)
        .setInteractive({ useHandCursor: true })
        .setDepth(53);
      zone.on('pointerdown', () => this.useQuickSlot(i));
      const slotIdx = i;
      zone.on('pointerover', () => this.showItemTooltip(slotIdx));
      zone.on('pointerout', () => this.hideTooltip());
    }
    this.drawQuickSlots();
  }

  private drawQuickSlots() {
    for (let i = 0; i < 2; i++) {
      const x = QSLOT_XS[i],
        slot = this.quickSlots[i],
        bg = this.qSlotBgs[i];
      bg.clear();
      if (slot.potionLv > 0 && slot.count > 0) {
        const pd = POTION_DATA[slot.potionLv];
        bg.fillStyle(pd.bgColor, 0.9);
        bg.fillRoundedRect(x - QSLOT_W / 2, QSLOT_Y - QSLOT_H / 2, QSLOT_W, QSLOT_H, 8);
        bg.lineStyle(2, pd.borderColor, 0.8);
        bg.strokeRoundedRect(x - QSLOT_W / 2, QSLOT_Y - QSLOT_H / 2, QSLOT_W, QSLOT_H, 8);
        this.qSlotIcons[i].setText('🧪').setVisible(true);
        this.qSlotLvTexts[i].setText(pd.label).setVisible(true);
        this.qSlotCounts[i].setText(`×${slot.count}`).setVisible(true);
      } else {
        bg.fillStyle(0x1a1a28, 0.4);
        bg.fillRoundedRect(x - QSLOT_W / 2, QSLOT_Y - QSLOT_H / 2, QSLOT_W, QSLOT_H, 8);
        bg.lineStyle(2, 0x333344, 0.4);
        bg.strokeRoundedRect(x - QSLOT_W / 2, QSLOT_Y - QSLOT_H / 2, QSLOT_W, QSLOT_H, 8);
        this.qSlotIcons[i].setVisible(false);
        this.qSlotLvTexts[i].setVisible(false);
        this.qSlotCounts[i].setVisible(false);
      }
    }
  }

  private useQuickSlot(index: number) {
    if (this.gameOver || this.narrationActive) return;
    const slot = this.quickSlots[index];
    if (!slot || slot.potionLv === 0 || slot.count <= 0) return;
    this.potionUsedThisRun = true;
    SoundManager.sfxPotion();
    if (this.playerHp >= this.playerMaxHp) {
      DamageText.show(this, QSLOT_XS[index], QSLOT_Y - 35, 'HP FULL', '#88ff88', '14px');
      return;
    }
    const pd = POTION_DATA[slot.potionLv];
    if (!pd) return;
    let heal = pd.healAmount < 0 ? Math.ceil(this.playerMaxHp - this.playerHp) : pd.healAmount;
    if (pd.healAmount >= 0) heal = Math.ceil(heal * this.potionMultiplier);
    this.playerHp = Math.min(this.playerHp + heal, this.playerMaxHp);
    slot.count--;
    if (slot.count <= 0) {
      slot.potionLv = 0;
      slot.count = 0;
    }
    this.drawPlayerHpBar();
    this.drawQuickSlots();
    DamageText.show(this, QSLOT_XS[index], QSLOT_Y - 35, `+${heal} HP`, '#44ff44', '18px');
    if (this.qSlotBgs[index]) {
      this.tweens.add({ targets: this.qSlotBgs[index], alpha: 0.4, duration: 80, yoyo: true });
    }
  }

  private canAddPotion(lv: number): boolean {
    for (const s of this.quickSlots) {
      if (s.potionLv === lv && s.count < MAX_POTION_STACK) return true;
      if (s.potionLv === 0 || s.count <= 0) return true;
    }
    return false;
  }

  private addPotion(lv: number): boolean {
    for (const s of this.quickSlots) {
      if (s.potionLv === lv && s.count < MAX_POTION_STACK) {
        s.count++;
        this.drawQuickSlots();
        return true;
      }
    }
    for (const s of this.quickSlots) {
      if (s.potionLv === 0 || s.count <= 0) {
        s.potionLv = lv;
        s.count = 1;
        this.drawQuickSlots();
        return true;
      }
    }
    return false;
  }

  /* ================================================================
     SKILL SLOTS
     ================================================================ */

  private createSkillSlots() {
    this.add
      .text(400, SLOT_Y - 34, 'SKILL', {
        fontSize: '10px',
        color: '#777788',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(48);
    const SKILL_KEYS = ['Q', 'W', 'E', 'R'];
    for (let i = 0; i < MAX_SLOTS; i++) {
      const gfx = this.add.graphics().setDepth(48);
      const sx = SLOT_XS[i];
      gfx.fillStyle(0x1a1a28, 0.5);
      gfx.fillRoundedRect(sx - SLOT_W / 2, SLOT_Y - SLOT_H / 2, SLOT_W, SLOT_H, 10);
      gfx.lineStyle(2, 0x333344, 0.6);
      gfx.strokeRoundedRect(sx - SLOT_W / 2, SLOT_Y - SLOT_H / 2, SLOT_W, SLOT_H, 10);
      this.emptySlotGfx.push(gfx);
      this.add
        .text(sx, SLOT_Y, '+', {
          fontSize: '22px',
          color: '#333344',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(48);
      this.add
        .text(sx - SLOT_W / 2 + 4, SLOT_Y - SLOT_H / 2 + 2, SKILL_KEYS[i], {
          fontSize: '9px',
          color: '#aaaacc',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setDepth(52);
    }
    this.skillButtons = new Array(MAX_SLOTS).fill(null);
    this.createPassiveSlot();
  }

  private createPassiveSlot() {
    const px = 700,
      py = SLOT_Y;
    const pw = 72,
      ph = 55;
    const cls = this.selectedClass;

    this.add
      .text(px, py - 34, 'PASSIVE', {
        fontSize: '9px',
        color: '#777788',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(48);

    const bg = this.add.graphics().setDepth(48);
    bg.fillStyle(cls.color, 0.6);
    bg.fillRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 10);
    bg.lineStyle(2, cls.borderColor, 0.8);
    bg.strokeRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 10);

    this.add
      .text(px, py - 12, cls.icon, {
        fontSize: '22px',
      })
      .setOrigin(0.5)
      .setDepth(49);

    this.add
      .text(px, py + 14, cls.name, {
        fontSize: '9px',
        color: '#cccccc',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(49);

    const zone = this.add.zone(px, py, pw, ph).setInteractive().setDepth(50);
    const tooltip = this.add
      .text(px, py - ph / 2 - 8, `✦ ${cls.passive}`, {
        fontSize: '11px',
        color: '#ffdd88',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
        backgroundColor: '#111122',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5, 1)
      .setDepth(200)
      .setVisible(false);

    zone.on('pointerover', () => {
      tooltip.setVisible(true);
    });
    zone.on('pointerout', () => {
      tooltip.setVisible(false);
    });
  }

  private createBuffBar() {
    this.buffBarContainer = this.add.container(0, 0).setDepth(52);
    this.updateBuffBar();
  }

  private createTooltip() {
    this.tooltipBg = this.add.graphics().setDepth(900).setVisible(false);
    this.tooltipText = this.add
      .text(0, 0, '', {
        fontSize: '11px',
        color: '#eeeeee',
        fontFamily: 'Arial, sans-serif',
        stroke: '#000000',
        strokeThickness: 2,
        lineSpacing: 4,
        padding: { x: 8, y: 6 },
        backgroundColor: '#0a0a1e',
        fixedWidth: 220,
        wordWrap: { width: 204 },
      })
      .setDepth(901)
      .setVisible(false);
  }

  private showTooltip(x: number, y: number, lines: string[]) {
    if (!this.tooltipBg || !this.tooltipText) return;
    const text = lines.join('\n');
    this.tooltipText.setText(text);

    const tw = 220;
    const th = this.tooltipText.height;
    let tx = x - tw / 2;
    let ty = y - th - 6;
    if (tx < 4) tx = 4;
    if (tx + tw > 796) tx = 796 - tw;
    if (ty < 4) ty = y + 30;

    this.tooltipBg.clear();
    this.tooltipBg.fillStyle(0x0a0a1e, 0.95);
    this.tooltipBg.fillRoundedRect(tx - 1, ty - 1, tw + 2, th + 2, 8);
    this.tooltipBg.lineStyle(1.5, 0x6688cc, 0.8);
    this.tooltipBg.strokeRoundedRect(tx - 1, ty - 1, tw + 2, th + 2, 8);

    this.tooltipText.setPosition(tx, ty);
    this.tooltipBg.setVisible(true);
    this.tooltipText.setVisible(true);
  }

  private hideTooltip() {
    this.tooltipBg?.setVisible(false);
    this.tooltipText?.setVisible(false);
  }

  private showSkillTooltip(skillId: string, sx: number, sy: number) {
    const def = ALL_SKILL_DEFS[skillId];
    if (!def) return;
    const lv = this.skillLevels[skillId] ?? 0;
    const mult = this.getSkillMult(skillId);
    const cd = this.skillCd(skillId);
    const lines = [
      `${def.icon} ${def.name}  [${def.category}]`,
      def.descFn(mult),
      `MP: ${def.mpCost}  |  쿨타임: ${cd.toFixed(1)}s`,
    ];
    if (lv > 0) lines.push(`강화 Lv.${lv}`);
    this.showTooltip(sx, sy - SLOT_H / 2, lines);
  }

  private showItemTooltip(slotIdx: number) {
    const slot = this.quickSlots[slotIdx];
    if (!slot || slot.potionLv <= 0 || slot.count <= 0) return;
    const pd = POTION_DATA[slot.potionLv];
    if (!pd) return;
    const healDesc =
      pd.healAmount < 0
        ? 'HP 완전 회복'
        : `HP +${Math.ceil(pd.healAmount * this.potionMultiplier)}`;
    const lines = [
      `🧪 포션 ${pd.label}`,
      healDesc,
      `보유: ${slot.count}개  |  키: [${slotIdx + 1}]`,
    ];
    this.showTooltip(QSLOT_XS[slotIdx], QSLOT_Y - QSLOT_H / 2, lines);
  }

  /* ================================================================
     RESPONSE SYSTEM: OVERDRIVE GAUGE + EMERGENCY DEF + PARRY
     ================================================================ */

  private createResponseButtons() {
    this.createOverdriveGauge();
    this.createEmergencyDefBtn();
    this.createParryUI();
  }

  private createOverdriveGauge() {
    const gx = 280,
      gy = SLOT_Y - 52,
      gw = 240,
      gh = 10;
    this.overdriveGaugeBg = this.add.graphics().setDepth(48);
    this.overdriveGaugeBg.fillStyle(0x111122, 0.7);
    this.overdriveGaugeBg.fillRoundedRect(gx, gy, gw, gh, 4);
    this.overdriveGaugeBg.lineStyle(1, 0x554400, 0.5);
    this.overdriveGaugeBg.strokeRoundedRect(gx, gy, gw, gh, 4);
    this.overdriveGaugeFill = this.add.graphics().setDepth(49);
    this.overdriveGaugeText = this.add
      .text(gx + gw / 2, gy - 1, 'OD 0%', {
        fontSize: '8px',
        color: '#ffaa00',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(50);
    this.odReadyText = this.add
      .text(gx + gw / 2, gy + gh + 2, '', {
        fontSize: '10px',
        color: '#ffdd00',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(50)
      .setAlpha(0);

    const odZone = this.add
      .zone(gx + gw / 2, gy + gh / 2, gw, gh + 12)
      .setInteractive()
      .setDepth(55);
    odZone.on('pointerdown', () => this.tryActivateOverdrive());

    this.drawOverdriveGauge();
  }

  private getOdColor(): number {
    if (this.overdriveGauge >= 80) return 0xffcc00;
    if (this.overdriveGauge >= 50) return 0xaa44ff;
    return 0x3388ff;
  }

  private drawOverdriveGauge() {
    if (!this.overdriveGaugeFill || !this.overdriveGaugeText) return;
    const gx = 280,
      gy = SLOT_Y - 52,
      gw = 240,
      gh = 10;
    this.overdriveGaugeFill.clear();
    const ratio = Phaser.Math.Clamp(this.overdriveGauge / 100, 0, 1);
    if (ratio > 0) {
      this.overdriveGaugeFill.fillStyle(this.getOdColor(), 0.9);
      this.overdriveGaugeFill.fillRoundedRect(gx, gy, gw * ratio, gh, 4);
    }
    if (this.overdriveActive) {
      this.overdriveGaugeText.setText('⚡ OVERDRIVE ⚡');
      this.overdriveGaugeText.setColor('#ffdd00');
    } else {
      this.overdriveGaugeText.setText(`OD ${Math.floor(this.overdriveGauge)}%`);
      this.overdriveGaugeText.setColor(this.overdriveGauge >= 80 ? '#ffdd00' : '#ffaa00');
    }

    if (!this.overdriveActive && this.odReadyText) {
      if (this.overdriveGauge >= 100) {
        this.odReadyText.setText('OVERDRIVE! [Enter]').setAlpha(1);
        if (!this.odPulseTween || !this.odPulseTween.isPlaying()) {
          this.odPulseTween = this.tweens.add({
            targets: [this.odReadyText, this.overdriveGaugeFill],
            alpha: 0.4,
            duration: 300,
            yoyo: true,
            repeat: -1,
          });
        }
      } else if (this.overdriveGauge >= 80) {
        this.odReadyText.setText('OVERDRIVE 준비!').setAlpha(1);
        if (!this.odPulseTween || !this.odPulseTween.isPlaying()) {
          this.odPulseTween = this.tweens.add({
            targets: this.overdriveGaugeFill,
            alpha: 0.5,
            duration: 500,
            yoyo: true,
            repeat: -1,
          });
        }
      } else if (this.overdriveGauge >= 50) {
        this.odPulseTween?.stop();
        this.odPulseTween = undefined;
        this.overdriveGaugeFill?.setAlpha(1);
        this.odReadyText.setAlpha(0);
      } else {
        this.odPulseTween?.stop();
        this.odPulseTween = undefined;
        this.overdriveGaugeFill?.setAlpha(1);
        this.odReadyText.setAlpha(0);
      }
    }
  }

  private addOverdrive(amount: number) {
    if (this.overdriveActive) return;
    this.overdriveGauge = Math.min(100, this.overdriveGauge + amount);
    this.drawOverdriveGauge();
  }

  private tryActivateOverdrive() {
    if (this.overdriveActive || this.overdriveGauge < 100) return;
    this.activateOverdrive();
  }

  private activateOverdrive() {
    this.overdriveActive = true;
    this.overdriveFever = this.comboCount >= 30;
    this.overdriveGauge = 100;
    this.odPulseTween?.stop();
    this.odPulseTween = undefined;
    this.overdriveGaugeFill?.setAlpha(1);
    this.odReadyText?.setAlpha(0);
    this.drawOverdriveGauge();

    /* --- 0) White flash + SFX --- */
    this.cameras.main.flash(100, 255, 255, 255);
    SoundManager.sfxLevelUp();
    SoundManager.sfxCritical();

    /* --- 1) Shockwave ring --- */
    const ring = this.add.graphics().setDepth(200).setAlpha(1);
    const ringObj = { r: 10, a: 1 };
    this.tweens.add({
      targets: ringObj,
      r: 300,
      a: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        ring.clear();
        ring.lineStyle(4, this.overdriveFever ? 0xff44ff : 0xffcc00, ringObj.a);
        ring.strokeCircle(400, 280, ringObj.r);
        ring.lineStyle(2, 0xffffff, ringObj.a * 0.5);
        ring.strokeCircle(400, 280, ringObj.r * 0.7);
      },
      onComplete: () => ring.destroy(),
    });

    /* --- 2) Title text bounce --- */
    const titleLabel = this.overdriveFever ? '⚡ OVERDRIVE FEVER!! ⚡' : '⚡ OVERDRIVE!! ⚡';
    const titleColor = this.overdriveFever ? '#ff44ff' : '#ffdd00';
    const titleText = this.add
      .text(400, 350, titleLabel, {
        fontSize: '42px',
        color: titleColor,
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(210)
      .setAlpha(0);
    this.tweens.add({
      targets: titleText,
      y: 230,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: titleText,
          alpha: 0,
          y: 200,
          duration: 600,
          delay: 600,
          onComplete: () => titleText.destroy(),
        });
      },
    });

    /* --- 3) Class-specific activation effect --- */
    const cls = this.selectedClass?.id;
    if (cls === 'warrior') {
      if (this.targetMonster && !this.targetMonster.isDead) {
        const t = this.targetMonster;
        const dmg = Math.floor(this.effectiveAtk * 3);
        t.takeDamage(dmg);
        DamageText.show(this, t.x, t.y - 50, `⚔ ${dmg}`, '#ffaa00', '32px');
        this.emitParticles(t.x, t.y, [0xff4422, 0xffcc00], 10);
      }
    } else if (cls === 'mage') {
      const magic = this.add.graphics().setDepth(195).setAlpha(0);
      magic.lineStyle(2, 0x4488ff, 1);
      magic.strokeCircle(400, 300, 120);
      magic.lineStyle(1, 0xffcc00, 0.8);
      magic.strokeCircle(400, 300, 100);
      magic.lineStyle(1, 0x4488ff, 0.6);
      magic.strokeCircle(400, 300, 80);
      this.tweens.add({
        targets: magic,
        alpha: 0.8,
        duration: 200,
        yoyo: true,
        hold: 300,
        onComplete: () => magic.destroy(),
      });
      this.emitParticles(400, 300, [0x4488ff, 0xffcc00, 0xffffff], 16);
    } else if (cls === 'rogue') {
      for (let i = 0; i < 3; i++) {
        const ghost = this.add.graphics().setDepth(195).setAlpha(0.5);
        ghost.fillStyle(0x9944cc, 0.4);
        ghost.fillCircle(400 + (i - 1) * 50, 300, 25);
        this.tweens.add({
          targets: ghost,
          alpha: 0,
          x: (i - 1) * 30,
          duration: 600,
          delay: i * 100,
          onComplete: () => ghost.destroy(),
        });
      }
      this.emitParticles(400, 300, [0x9944cc, 0xffcc00], 14);
    }

    /* --- 4) Burst particles --- */
    this.emitParticles(400, 280, [0xffdd00, 0xffaa00, 0xffffff], 24);

    /* --- 5) Dark overlay + gold border --- */
    this.odDarkOverlay = this.add.graphics().setDepth(5).setAlpha(0);
    this.odDarkOverlay.fillStyle(0x000000, 0.25);
    this.odDarkOverlay.fillRect(0, 0, 800, 600);
    this.tweens.add({ targets: this.odDarkOverlay, alpha: 1, duration: 300 });

    this.overdriveEdgeGfx = this.add.graphics().setDepth(155);
    const edgeCol = this.overdriveFever ? 0xff44ff : 0xffcc00;
    this.overdriveEdgeGfx.lineStyle(5, edgeCol, 0.9);
    this.overdriveEdgeGfx.strokeRect(2, 2, 796, 596);
    this.overdriveEdgeGfx.lineStyle(2, 0xffffff, 0.3);
    this.overdriveEdgeGfx.strokeRect(6, 6, 788, 588);
    this.tweens.add({
      targets: this.overdriveEdgeGfx,
      alpha: 0.4,
      duration: 350,
      yoyo: true,
      repeat: -1,
    });

    /* --- 6) Time bar at top --- */
    const tbx = 200,
      tby = 8,
      tbw = 400,
      tbh = 6;
    this.odTimeBarBg = this.add.graphics().setDepth(200);
    this.odTimeBarBg.fillStyle(0x000000, 0.5);
    this.odTimeBarBg.fillRoundedRect(tbx, tby, tbw, tbh, 3);
    this.odTimeBar = this.add.graphics().setDepth(201);

    /* --- 7) Floating gold particles --- */
    this.odParticleTimer = this.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        if (!this.overdriveActive) return;
        const px = Phaser.Math.Between(20, 780),
          py = Phaser.Math.Between(20, 580);
        const col = this.overdriveFever
          ? Phaser.Math.RND.pick([0xff44ff, 0xffcc00, 0xffffff])
          : Phaser.Math.RND.pick([0xffdd00, 0xffaa00, 0xffffff]);
        const p = this.add.graphics().setDepth(6).setAlpha(0.7);
        const sz = Phaser.Math.FloatBetween(1.5, 3.5);
        p.fillStyle(col, 1);
        p.fillCircle(0, 0, sz);
        p.setPosition(px, py);
        this.tweens.add({
          targets: p,
          y: py - 40,
          alpha: 0,
          duration: Phaser.Math.Between(600, 1200),
          onComplete: () => p.destroy(),
        });
      },
    });

    /* --- 8) Character gold aura --- */
    this.odAuraGfx = this.add.graphics().setDepth(90);
    const auraObj = { angle: 0 };
    this.odAuraTween = this.tweens.add({
      targets: auraObj,
      angle: 360,
      duration: 2000,
      repeat: -1,
      onUpdate: () => {
        if (!this.odAuraGfx || !this.targetMonster) return;
        this.odAuraGfx.clear();
        const cx = 400,
          cy = 460;
        for (let i = 0; i < 6; i++) {
          const a = ((auraObj.angle + i * 60) * Math.PI) / 180;
          const rx = cx + Math.cos(a) * 22,
            ry = cy + Math.sin(a) * 12;
          this.odAuraGfx.fillStyle(this.overdriveFever ? 0xff44ff : 0xffcc00, 0.5);
          this.odAuraGfx.fillCircle(rx, ry, 3);
        }
      },
    });

    /* --- 9) Skill slot glow cycle --- */
    let glowIdx = 0;
    this.odSlotGlowTimer = this.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        if (!this.overdriveActive) return;
        for (let i = 0; i < this.skillButtons.length; i++) {
          const btn = this.skillButtons[i];
          if (!btn) continue;
          if (i === glowIdx % this.skillButtons.length) {
            btn.setOverdriveGlow(true);
          } else {
            btn.setOverdriveGlow(false);
          }
        }
        glowIdx++;
      },
    });

    /* --- 10) Reset all skill cooldowns --- */
    for (const btn of this.skillButtons) {
      if (btn) btn.resetCooldown();
    }

    /* --- 11) Duration timer with countdown --- */
    let remaining = 5;
    this.overdriveTimer = this.time.addEvent({
      delay: 1000,
      repeat: 4,
      callback: () => {
        remaining--;
        this.overdriveGauge = Math.max(0, (remaining / 5) * 100);
        this.drawOverdriveGauge();
        this.drawOdTimeBar(remaining / 5, remaining <= 2);
        if (remaining <= 3 && remaining > 0) {
          if (!this.overdriveCountdown) {
            this.overdriveCountdown = this.add
              .text(400, 160, '', {
                fontSize: '36px',
                color: '#ffdd00',
                fontFamily: 'Arial',
                fontStyle: 'bold',
                stroke: '#000000',
                strokeThickness: 6,
              })
              .setOrigin(0.5)
              .setDepth(210);
          }
          this.overdriveCountdown.setText(`${remaining}`).setAlpha(1).setScale(1);
          this.tweens.add({
            targets: this.overdriveCountdown,
            alpha: 0,
            scaleX: 2.5,
            scaleY: 2.5,
            duration: 800,
            onComplete: () => this.overdriveCountdown?.setScale(1),
          });
        }
        if (remaining <= 0) {
          this.endOverdrive();
        }
      },
    });
    this.drawOdTimeBar(1, false);

    /* --- Hitstop (must be last so all setup completes first) --- */
    this.time.paused = true;
    setTimeout(() => {
      if (!this.pauseOpen) this.time.paused = false;
    }, 150);
  }

  private drawOdTimeBar(ratio: number, urgent: boolean) {
    if (!this.odTimeBar) return;
    const tbx = 200,
      tby = 8,
      tbw = 400,
      tbh = 6;
    this.odTimeBar.clear();
    const col = urgent ? 0xff4444 : this.overdriveFever ? 0xff44ff : 0xffcc00;
    this.odTimeBar.fillStyle(col, 0.9);
    this.odTimeBar.fillRoundedRect(tbx, tby, tbw * ratio, tbh, 3);
  }

  private endOverdrive() {
    this.overdriveActive = false;
    this.overdriveFever = false;
    this.overdriveGauge = 0;
    this.overdriveTimer?.remove();
    this.overdriveTimer = undefined;
    this.odParticleTimer?.remove();
    this.odParticleTimer = undefined;
    this.odSlotGlowTimer?.remove();
    this.odSlotGlowTimer = undefined;
    this.odAuraTween?.stop();
    this.odAuraTween = undefined;
    this.odAuraGfx?.destroy();
    this.odAuraGfx = undefined;
    this.overdriveCountdown?.destroy();
    this.overdriveCountdown = undefined;
    this.odTimeBar?.destroy();
    this.odTimeBar = undefined;
    this.odTimeBarBg?.destroy();
    this.odTimeBarBg = undefined;

    for (const btn of this.skillButtons) {
      if (btn) btn.setOverdriveGlow(false);
    }

    const endText = this.add
      .text(400, 240, 'OVERDRIVE END', {
        fontSize: '28px',
        color: '#888888',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(210)
      .setAlpha(0.8);
    this.tweens.add({
      targets: endText,
      alpha: 0,
      y: 220,
      duration: 1000,
      onComplete: () => endText.destroy(),
    });

    if (this.overdriveEdgeGfx) {
      this.tweens.add({
        targets: this.overdriveEdgeGfx,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.overdriveEdgeGfx?.destroy();
          this.overdriveEdgeGfx = undefined;
        },
      });
    }
    if (this.odDarkOverlay) {
      this.tweens.add({
        targets: this.odDarkOverlay,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.odDarkOverlay?.destroy();
          this.odDarkOverlay = undefined;
        },
      });
    }

    this.drawOverdriveGauge();
    this.refreshSkillButtonStates();
  }

  private addComboHit() {
    this.comboCount++;
    this.comboTimer?.remove();
    this.comboTimer = this.time.delayedCall(3000, () => {
      this.comboCount = 0;
    });
    if (this.comboCount === 10) this.addOverdrive(20);
    else if (this.comboCount === 20) this.addOverdrive(40);
  }

  /* ---- Emergency Defense ---- */

  private createEmergencyDefBtn() {
    const bx = HP_BAR.x + HP_BAR.w + 36,
      by = HP_BAR.y + 10;
    const bw = 42,
      bh = 38;
    const container = this.add.container(bx, by).setDepth(52);

    const bg = this.add.graphics();
    bg.fillStyle(0x224466, 0.8);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    bg.lineStyle(2, 0x44aaff, 0.7);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    container.add(bg);

    const icon = this.add.text(0, -5, '🛡', { fontSize: '18px' }).setOrigin(0.5);
    container.add(icon);

    this.emergencyDefCdText = this.add
      .text(0, 14, '', {
        fontSize: '8px',
        color: '#aaccff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    container.add(this.emergencyDefCdText);

    const zone = this.add.zone(0, 0, bw, bh).setInteractive({ useHandCursor: true });
    container.add(zone);
    zone.on('pointerdown', () => this.useEmergencyDef());
    zone.on('pointerover', () => {
      const isMage = this.selectedClass.id === 'mage';
      this.showTooltip(
        bx,
        by - bh / 2,
        isMage
          ? ['🔮 마법 배리어', '다음 피해 1회 완전 흡수', '흡수 데미지 30% 반사', '쿨타임: 15초']
          : [
              '🛡 긴급 방어',
              '2초간 피해 -70%',
              '보스 강공격 중 사용 시 완전 무효화',
              '쿨타임: 20초',
            ],
      );
    });
    zone.on('pointerout', () => this.hideTooltip());

    this.emergencyDefBtn = container;
    this.updateEmergencyDefBtn();
  }

  private updateEmergencyDefBtn() {
    if (!this.emergencyDefCdText) return;
    if (this.emergencyDefCd > 0) {
      this.emergencyDefCdText.setText(`${Math.ceil(this.emergencyDefCd)}s`);
    } else {
      this.emergencyDefCdText.setText('READY');
    }
  }

  private useEmergencyDef() {
    if (this.gameOver || this.emergencyDefCd > 0) return;

    if (this.selectedClass.id === 'mage') {
      this.emergencyDefCd = 15;
      this.mageBarrierActive = true;
      DamageText.show(this, 400, 200, '🔮 마법 배리어!', '#aa66ff', '24px');
      this.cameras.main.flash(100, 80, 50, 255);
      this.emitParticles(400, 280, [0xaa66ff, 0x6644cc], 8);
      this.addOverdrive(this.bossAttackIncoming ? 30 : 0);
    } else {
      this.emergencyDefCd = 20;
      this.emergencyDefActive = true;
      if (this.bossAttackIncoming) {
        DamageText.show(this, 400, 200, '✨ GUARD! 완전 무효화! ✨', '#44ffaa', '28px');
        this.invincible = true;
        this.addOverdrive(30);
        this.cameras.main.flash(200, 50, 200, 255);
        this.emitParticles(400, 280, [0x44ffaa, 0x88ffdd], 10);
        this.time.delayedCall(2000, () => {
          this.emergencyDefActive = false;
          if (!this.cheatInvincible) this.invincible = false;
        });
      } else {
        DamageText.show(this, 400, 200, '🛡 긴급 방어!', '#4488ff', '22px');
        this.cameras.main.flash(100, 50, 100, 200);
        this.shieldDmgReduce = 0.7;
        this.time.delayedCall(2000, () => {
          this.emergencyDefActive = false;
          this.shieldDmgReduce = Math.max(0, this.shieldDmgReduce - 0.7);
        });
      }
    }
    this.updateEmergencyDefBtn();
    SoundManager.sfxShield();
  }

  /* ---- Parry System (Spacebar / Right-click) ---- */

  private createParryUI() {
    this.parryHintText = this.add
      .text(400, SLOT_Y + SLOT_H / 2 + 34, 'SPACE / 우클릭 = 패링', {
        fontSize: '10px',
        color: '#887744',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(48);

    this.parryCdOverlay = this.add
      .text(400, SLOT_Y + SLOT_H / 2 + 46, '', {
        fontSize: '9px',
        color: '#aa8844',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(48);

    this.parryGaugeGfx = this.add.graphics().setDepth(250);
    this.parryAuraGfx = this.add.graphics().setDepth(99);

    this.input.keyboard?.on('keydown-SPACE', () => this.attemptParry());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.attemptParry();
    });
    this.game.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  private updateParryCdDisplay() {
    if (!this.parryCdOverlay) return;
    if (this.parryCd > 0) {
      this.parryCdOverlay.setText(`패링 쿨타임 ${Math.ceil(this.parryCd)}s`).setColor('#886644');
    } else {
      this.parryCdOverlay.setText('').setColor('#aa8844');
    }
  }

  private getParryWindow(): number {
    const mastery = this.parryMasteryLevel >= 1 ? 20 : 0;
    if (this.currentBossType === 'final') return 100 + mastery;
    if (this.currentBossType === 'mini') return 150 + mastery;
    const hasSpecial = this.monsters.some(
      m => !m.isDead && m.specialType && m.specialType !== 'none',
    );
    if (hasSpecial) return 150 + mastery;
    return 200 + mastery;
  }

  private getPerfectWindow(): number {
    return 80 + (this.parryMasteryLevel >= 2 ? 20 : 0);
  }

  private shouldFakeAttack(): boolean {
    const ls = this.localStage;
    if (this.currentBossType !== 'none') return Math.random() < 0.4;
    if (ls < 7) return false;
    return Math.random() < Math.min(0.3, (ls - 6) * 0.04);
  }

  private getGaugeColor(): number {
    if (this.currentBossType !== 'none') return 0xff4444;
    if (this.parryIsFakePhase) return 0xff8800;
    return 0xffcc00;
  }

  private getBossMultiHitCount(): number {
    if (this.currentBossType === 'final') return Phaser.Math.Between(2, 3);
    if (this.currentBossType === 'mini') return Phaser.Math.Between(1, 2);
    return 1;
  }

  private checkParryMastery() {
    if (this.parrySuccessCount >= 30 && this.parryMasteryLevel < 3) {
      this.parryMasteryLevel = 3;
      DamageText.show(this, 400, 260, '⚔ 패링 달인! 페이크 힌트 활성', '#ffd700', '18px');
    } else if (this.parrySuccessCount >= 15 && this.parryMasteryLevel < 2) {
      this.parryMasteryLevel = 2;
      DamageText.show(this, 400, 260, '⚔ 패링 숙련! 퍼펙트 창 확대', '#ffcc44', '16px');
    } else if (this.parrySuccessCount >= 5 && this.parryMasteryLevel < 1) {
      this.parryMasteryLevel = 1;
      DamageText.show(this, 400, 260, '⚔ 패링 입문! 패링 창 확대', '#ddaa44', '16px');
    }
  }

  /* ================================================================
     NARRATION SYSTEM
     ================================================================ */

  private showNarration(entry: NarrationEntry, onDone?: () => void) {
    this.dismissNarration();
    this.narrationActive = true;

    const bw = 600,
      bh = 100,
      bx = (800 - bw) / 2,
      by = (600 - bh) / 2;
    this.narrationBg = this.add.graphics().setDepth(800);
    this.narrationBg.fillStyle(0x000000, 0.82);
    this.narrationBg.fillRoundedRect(bx, by, bw, bh, 12);
    this.narrationBg.lineStyle(1, 0x666688, 0.4);
    this.narrationBg.strokeRoundedRect(bx, by, bw, bh, 12);

    if (entry.speaker) {
      this.narrationSpeaker = this.add
        .text(bx + 16, by + 8, entry.speaker, {
          fontSize: '12px',
          color: '#ffaa44',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setDepth(801);
    }

    const textY = entry.speaker ? by + 28 : by + 16;
    this.narrationText = this.add
      .text(bx + 20, textY, '', {
        fontSize: '14px',
        color: '#dddddd',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
        lineSpacing: 6,
        wordWrap: { width: bw - 40 },
      })
      .setDepth(801);

    const skipText = this.add
      .text(bx + bw - 16, by + bh - 16, '클릭/스페이스 = 스킵', {
        fontSize: '9px',
        color: '#666677',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(1, 1)
      .setDepth(801);

    const fullText = entry.lines.join('\n');
    let charIdx = 0;
    const typeSpeed = 35;

    this.narrationTypingTimer = this.time.addEvent({
      delay: typeSpeed,
      repeat: fullText.length - 1,
      callback: () => {
        charIdx++;
        this.narrationText?.setText(fullText.substring(0, charIdx));
      },
    });

    const finish = () => {
      this.narrationTypingTimer?.remove();
      charIdx = fullText.length;
      this.narrationText?.setText(fullText);
    };

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      if (charIdx < fullText.length) {
        finish();
        return;
      }
      dismissed = true;
      cleanup();
      this.dismissNarration();
      onDone?.();
    };

    const skipZone = this.add.zone(400, 300, 800, 600).setInteractive().setDepth(799);
    const onSpace = () => dismiss();
    skipZone.on('pointerdown', () => dismiss());
    this.input.keyboard?.on('keydown-SPACE', onSpace);

    const cleanup = () => {
      skipZone.destroy();
      skipText.destroy();
      this.input.keyboard?.off('keydown-SPACE', onSpace);
    };

    const autoMs = 3500 + fullText.length * typeSpeed;
    this.narrationTimer = this.time.delayedCall(autoMs, () => dismiss());
  }

  private dismissNarration() {
    this.narrationActive = false;
    this.narrationTimer?.remove();
    this.narrationTypingTimer?.remove();
    this.narrationBg?.destroy();
    this.narrationBg = undefined;
    this.narrationText?.destroy();
    this.narrationText = undefined;
    this.narrationSpeaker?.destroy();
    this.narrationSpeaker = undefined;
  }

  private cancelParrySequence() {
    this.parrySeqId++;
    this.attackSeqActive = false;
    this.parryWindowTimer?.remove();
    this.parryWindowTimer = undefined;
    this.parryGaugeGfx?.clear();
    this.parryAuraGfx?.clear();
    this.parryWindowOpen = false;
    this.parryIsFakePhase = false;
    this.parryMultiHitQueue = [];
    this.parryMultiHitSuccesses = 0;
  }

  private parryEarlyFailed = false;

  private attemptParry() {
    if (this.gameOver || !this.parryReady || this.cardSelecting || this.doorSelecting) return;
    this.parryAttempted = true;

    if (this.parryIsFakePhase) {
      DamageText.show(this, 400, 230, 'FAKE!', '#ff8800', '22px');
      return;
    }

    if (this.parryWindowOpen) {
      const elapsed = Date.now() - this.parryWindowOpenTime;
      const isPerfect = elapsed <= this.getPerfectWindow();
      this.resolveParryHit(isPerfect);
    } else if (this.attackSeqActive) {
      this.parryEarlyFailed = true;
      DamageText.show(this, 400, 230, 'TOO EARLY!', '#ff8800', '22px');
      this.parryReady = false;
      this.parryCd = 8;
      this.updateParryCdDisplay();
    }
  }

  private resolveParryHit(isPerfect: boolean) {
    this.parryWindowOpen = false;
    this.parryWindowTimer?.remove();
    this.parryWindowTimer = undefined;
    this.parryGaugeGfx?.clear();

    if (this.parryMultiHitQueue.length > 0) {
      this.parryMultiHitSuccesses++;
      if (isPerfect) {
        DamageText.show(this, 400, 200, '✨ PERFECT!', '#ffd700', '26px');
        this.emitParticles(400, 280, [0xffd700, 0xffffff], 8);
      } else {
        DamageText.show(this, 400, 200, 'PARRY!', '#ffcc44', '22px');
      }
      SoundManager.sfxCritical();
      this.parryMultiHitQueue.shift();
      if (this.parryMultiHitQueue.length > 0) {
        this.time.delayedCall(400, () => this.runMultiHitGauge());
      }
      return;
    }

    this.executeParryReward(isPerfect, false);
  }

  private executeParryReward(isPerfect: boolean, isCounterFake: boolean) {
    this.parrySeqId++;
    this.attackSeqActive = false;
    this.parryWindowOpen = false;
    this.parryAttempted = false;
    this.parryEarlyFailed = false;
    this.parryReady = false;
    this.parryCd = 8;
    this.updateParryCdDisplay();
    this.parryGaugeGfx?.clear();
    this.parryAuraGfx?.clear();

    this.parrySuccessCount++;
    this.checkParryMastery();

    let atkMult: number;
    let odGain: number;
    let label: string;
    let color: string;
    let dmgReduce: number;

    if (isCounterFake) {
      atkMult = 5;
      odGain = 100;
      dmgReduce = 1;
      label = '⚡ COUNTER! ⚡';
      color = '#ffd700';
      this.overdriveGauge = 100;
      this.drawOverdriveGauge();
      this.activateOverdrive();
    } else if (isPerfect) {
      atkMult = 3;
      odGain = 30;
      dmgReduce = 1;
      label = '✨ PERFECT! ✨';
      color = '#ffd700';
      this.scene.pause();
      setTimeout(() => {
        if (this.scene.isPaused() && !this.pauseOpen) this.scene.resume();
      }, 100);
    } else {
      atkMult = 1.5;
      odGain = 15;
      dmgReduce = 0.7;
      label = '⚔ PARRY!';
      color = '#ffcc44';
    }

    DamageText.show(this, 400, 200, label, color, isPerfect || isCounterFake ? '30px' : '24px');
    this.cameras.main.flash(200, 255, 200, 50);
    this.emitParticles(400, 280, [0xffd700, 0xffaa00], isPerfect || isCounterFake ? 14 : 8);
    SoundManager.sfxCritical();

    this.monsterStunned = true;
    this.time.delayedCall(1000, () => {
      this.monsterStunned = false;
    });

    if (this.targetMonster && !this.targetMonster.isDead) {
      const counterDmg = Math.floor(this.effectiveAtk * atkMult);
      const dead = this.targetMonster.takeDamage(counterDmg);
      DamageText.show(
        this,
        this.targetMonster.x,
        this.targetMonster.y - 50,
        `반격! ${counterDmg}`,
        color,
        '22px',
      );
      if (dead) this.handleMonsterKill(this.targetMonster);
    }

    if (!isCounterFake) this.addOverdrive(odGain);

    if (!this.firstParryDone) {
      this.firstParryDone = true;
      this.gold += 10;
      DamageText.show(this, 400, 240, '첫 패링! +10G', '#ffdd44', '16px');
      this.updateUI();
    }

    return dmgReduce;
  }

  private startMonsterAttackSequence() {
    const alive = this.monsters.filter(m => !m.isDead);
    if (
      this.gameOver ||
      this.cardSelecting ||
      this.doorSelecting ||
      this.pauseOpen ||
      alive.length === 0
    )
      return;
    if (this.monsterStunned || this.monsterFrozen) return;
    if (this.attackSeqActive) return;

    this.attackSeqActive = true;
    this.parrySeqId++;
    const seqId = this.parrySeqId;

    const attacker = Phaser.Math.RND.pick(alive);
    const ax = attacker.x,
      ay = attacker.y;
    const isFake = this.shouldFakeAttack();
    const isBossMulti = this.currentBossType !== 'none' && !isFake;
    const hitCount = isBossMulti ? this.getBossMultiHitCount() : 1;

    this.parryAttempted = false;
    this.parryEarlyFailed = false;
    this.parryWindowOpen = false;
    this.parryIsFakePhase = false;
    this.parryFakeCompleted = false;
    this.parryMultiHitQueue = [];
    this.parryMultiHitSuccesses = 0;

    const GAUGE_R = 18;
    const stale = () => seqId !== this.parrySeqId;
    const abortCheck = () =>
      stale() || this.gameOver || this.monsters.filter(m => !m.isDead).length === 0;
    const cleanup = () => {
      this.parryAuraGfx?.clear();
      this.parryGaugeGfx?.clear();
      this.parryWindowOpen = false;
      this.parryIsFakePhase = false;
    };

    const runGaugeCycle = (onDone: () => void, gaugeColor: number, fake: boolean) => {
      const pw = this.getParryWindow();
      const GAUGE_MS = 800;
      this.parryAttempted = false;
      this.parryIsFakePhase = fake;

      const gaugeFill = { val: 0 };
      const gaugeTween = this.tweens.add({
        targets: gaugeFill,
        val: 1,
        duration: GAUGE_MS,
        ease: 'Linear',
        onUpdate: () => {
          if (abortCheck()) {
            gaugeTween.stop();
            cleanup();
            return;
          }
          this.parryGaugeGfx?.clear();
          this.parryGaugeGfx?.lineStyle(4, 0x333333, 0.6);
          this.parryGaugeGfx?.strokeCircle(ax, ay - 55, GAUGE_R);
          const angle = gaugeFill.val * Math.PI * 2;
          this.parryGaugeGfx?.lineStyle(4, gaugeColor, 0.9);
          this.parryGaugeGfx?.beginPath();
          this.parryGaugeGfx?.arc(ax, ay - 55, GAUGE_R, -Math.PI / 2, -Math.PI / 2 + angle, false);
          this.parryGaugeGfx?.strokePath();
        },
        onComplete: () => {
          if (abortCheck()) {
            cleanup();
            return;
          }

          if (fake) {
            this.parryGaugeGfx?.clear();
            this.parryGaugeGfx?.lineStyle(5, 0x44ff44, 1);
            this.parryGaugeGfx?.strokeCircle(ax, ay - 55, GAUGE_R);
            this.parryGaugeGfx?.fillStyle(0x44ff44, 0.3);
            this.parryGaugeGfx?.fillCircle(ax, ay - 55, GAUGE_R - 2);
            this.time.delayedCall(120, () => {
              if (abortCheck()) {
                cleanup();
                return;
              }
              this.parryGaugeGfx?.clear();
              this.parryIsFakePhase = false;
              this.parryFakeCompleted = true;
              if (this.parryMasteryLevel >= 3) {
                DamageText.show(this, ax, ay - 80, '👁 페이크!', '#ff8800', '14px');
              }
              this.time.delayedCall(500, () => {
                if (abortCheck()) {
                  cleanup();
                  return;
                }
                onDone();
              });
            });
            return;
          }

          this.parryWindowOpen = true;
          this.parryWindowOpenTime = Date.now();
          this.parryGaugeGfx?.clear();
          this.parryGaugeGfx?.lineStyle(5, 0x44ff44, 1);
          this.parryGaugeGfx?.strokeCircle(ax, ay - 55, GAUGE_R);
          this.parryGaugeGfx?.fillStyle(0x44ff44, 0.3);
          this.parryGaugeGfx?.fillCircle(ax, ay - 55, GAUGE_R - 2);

          this.parryWindowTimer = this.time.delayedCall(pw, () => {
            this.parryWindowTimer = undefined;
            this.parryWindowOpen = false;
            this.parryGaugeGfx?.clear();
            if (abortCheck()) return;
            this.parryGaugeGfx?.lineStyle(5, 0xff2222, 1);
            this.parryGaugeGfx?.strokeCircle(ax, ay - 55, GAUGE_R);
            if (this.parryAttempted && !this.parryEarlyFailed) {
              DamageText.show(this, 400, 230, 'TOO LATE!', '#ff8800', '22px');
            }
            this.parryEarlyFailed = false;
            this.time.delayedCall(50, () => {
              this.parryGaugeGfx?.clear();
              if (abortCheck()) return;
              onDone();
            });
          });
        },
      });
    };

    // Phase 1: Red aura
    const WARN_MS = 1500;
    const GAUGE_MS = 800;
    this.parryAuraGfx?.clear();
    const auraPulse = { val: 0 };
    const auraTween = this.tweens.add({
      targets: auraPulse,
      val: 1,
      duration: WARN_MS,
      onUpdate: () => {
        if (abortCheck()) {
          auraTween.stop();
          cleanup();
          return;
        }
        this.parryAuraGfx?.clear();
        const alpha = 0.15 + auraPulse.val * 0.35;
        const radius = 40 + auraPulse.val * 15;
        this.parryAuraGfx?.fillStyle(0xff2222, alpha);
        this.parryAuraGfx?.fillCircle(ax, ay, radius);
      },
    });

    this.time.delayedCall(WARN_MS - GAUGE_MS, () => {
      if (abortCheck()) {
        auraTween.stop();
        cleanup();
        return;
      }

      const showParryFail = () => {
        if (this.parryAttempted && !this.parryEarlyFailed) {
          DamageText.show(this, 400, 230, 'MISS!', '#ff4444', '24px');
          this.cameras.main.flash(100, 200, 0, 0);
        }
        this.parryEarlyFailed = false;
      };

      if (isFake) {
        const fakeColor = 0xff8800;
        runGaugeCycle(
          () => {
            if (abortCheck()) {
              auraTween.stop();
              cleanup();
              return;
            }
            const realColor = this.getGaugeColor();
            runGaugeCycle(
              () => {
                auraTween.stop();
                this.parryAuraGfx?.clear();
                if (abortCheck()) return;
                showParryFail();
                this.onMonsterAttack();
              },
              realColor,
              false,
            );
          },
          fakeColor,
          true,
        );
      } else if (hitCount > 1) {
        for (let i = 0; i < hitCount; i++) this.parryMultiHitQueue.push(i);
        this.runMultiHitGauge();
        return;
      } else {
        const color = this.getGaugeColor();
        runGaugeCycle(
          () => {
            auraTween.stop();
            this.parryAuraGfx?.clear();
            if (abortCheck()) return;
            showParryFail();
            this.onMonsterAttack();
          },
          color,
          false,
        );
      }
    });
  }

  private runMultiHitGauge() {
    const alive = this.monsters.filter(m => !m.isDead);
    if (this.gameOver || alive.length === 0) return;
    const seqId = this.parrySeqId;
    const attacker = alive[0];
    const ax = attacker.x,
      ay = attacker.y;
    const remaining = this.parryMultiHitQueue.length;
    const total = remaining + this.parryMultiHitSuccesses;
    const GAUGE_R = 18;

    DamageText.show(this, ax, ay - 80, `${total - remaining + 1}/${total}`, '#ff8844', '14px');

    const pw = this.getParryWindow();
    const GAUGE_MS = 600;
    this.parryAttempted = false;
    this.parryEarlyFailed = false;
    this.parryWindowOpen = false;
    this.parryIsFakePhase = false;

    const stale = () => seqId !== this.parrySeqId;
    const abortCheck = () =>
      stale() || this.gameOver || this.monsters.filter(m => !m.isDead).length === 0;

    const gaugeFill = { val: 0 };
    const gaugeTween = this.tweens.add({
      targets: gaugeFill,
      val: 1,
      duration: GAUGE_MS,
      ease: 'Linear',
      onUpdate: () => {
        if (abortCheck()) {
          gaugeTween.stop();
          this.parryGaugeGfx?.clear();
          return;
        }
        this.parryGaugeGfx?.clear();
        this.parryGaugeGfx?.lineStyle(4, 0x333333, 0.6);
        this.parryGaugeGfx?.strokeCircle(ax, ay - 55, GAUGE_R);
        const angle = gaugeFill.val * Math.PI * 2;
        this.parryGaugeGfx?.lineStyle(4, 0xff4444, 0.9);
        this.parryGaugeGfx?.beginPath();
        this.parryGaugeGfx?.arc(ax, ay - 55, GAUGE_R, -Math.PI / 2, -Math.PI / 2 + angle, false);
        this.parryGaugeGfx?.strokePath();
      },
      onComplete: () => {
        if (abortCheck()) {
          this.parryGaugeGfx?.clear();
          return;
        }
        this.parryWindowOpen = true;
        this.parryWindowOpenTime = Date.now();
        this.parryGaugeGfx?.clear();
        this.parryGaugeGfx?.lineStyle(5, 0x44ff44, 1);
        this.parryGaugeGfx?.strokeCircle(ax, ay - 55, GAUGE_R);
        this.parryGaugeGfx?.fillStyle(0x44ff44, 0.3);
        this.parryGaugeGfx?.fillCircle(ax, ay - 55, GAUGE_R - 2);

        this.parryWindowTimer = this.time.delayedCall(pw, () => {
          this.parryWindowTimer = undefined;
          this.parryWindowOpen = false;
          this.parryGaugeGfx?.clear();
          if (abortCheck()) return;

          if (this.parryAttempted && !this.parryEarlyFailed) {
            DamageText.show(this, 400, 230, 'TOO LATE!', '#ff8800', '20px');
          }
          this.parryEarlyFailed = false;

          this.parryMultiHitQueue.shift();
          if (this.parryMultiHitQueue.length > 0) {
            this.time.delayedCall(300, () => this.runMultiHitGauge());
          } else {
            this.finishMultiHit();
          }
        });
      },
    });
  }

  private finishMultiHit() {
    this.attackSeqActive = false;
    const total = this.parryMultiHitSuccesses + this.parryMultiHitQueue.length;
    const successes = this.parryMultiHitSuccesses;
    this.parryAuraGfx?.clear();
    this.parryGaugeGfx?.clear();

    if (successes === total && total > 1) {
      DamageText.show(this, 400, 190, '⚡ PERFECT PARRY! ⚡', '#ffd700', '28px');
      this.emitParticles(400, 280, [0xffd700, 0xffffff], 16);
      this.scene.pause();
      setTimeout(() => {
        if (this.scene.isPaused() && !this.pauseOpen) this.scene.resume();
      }, 100);
      if (this.targetMonster && !this.targetMonster.isDead) {
        const dmg = Math.floor(this.effectiveAtk * 3);
        const dead = this.targetMonster.takeDamage(dmg);
        DamageText.show(
          this,
          this.targetMonster.x,
          this.targetMonster.y - 50,
          `반격! ${dmg}`,
          '#ffd700',
          '22px',
        );
        if (dead) this.handleMonsterKill(this.targetMonster);
      }
      this.addOverdrive(30);
      this.parrySuccessCount += total;
      this.checkParryMastery();
      this.parryReady = false;
      this.parryCd = 8;
      this.updateParryCdDisplay();
      this.monsterStunned = true;
      this.time.delayedCall(1500, () => {
        this.monsterStunned = false;
      });
    } else if (successes > 0) {
      this.parrySuccessCount += successes;
      this.checkParryMastery();
      this.parryReady = false;
      this.parryCd = 8;
      this.updateParryCdDisplay();
      this.onMonsterAttack();
    } else {
      this.onMonsterAttack();
    }
    this.parryMultiHitQueue = [];
    this.parryMultiHitSuccesses = 0;
  }

  private tryParryBossPattern(incomingDmg: number): boolean {
    if (!this.parryWindowOpen || !this.parryReady) return false;
    const elapsed = Date.now() - this.parryWindowOpenTime;
    const isPerfect = elapsed <= this.getPerfectWindow();
    this.parrySeqId++;
    this.parryWindowOpen = false;
    this.parryWindowTimer?.remove();
    this.parryWindowTimer = undefined;
    this.parryReady = false;
    this.parryCd = 8;
    this.updateParryCdDisplay();
    this.parryGaugeGfx?.clear();
    this.parryAuraGfx?.clear();

    this.parrySuccessCount++;
    this.checkParryMastery();

    const label = isPerfect ? '✨ PERFECT PARRY! ✨' : '⚔ PARRY!';
    const atkMult = isPerfect ? 3 : 1.5;
    DamageText.show(this, 400, 200, label, '#ffd700', isPerfect ? '30px' : '24px');
    this.cameras.main.flash(200, 255, 200, 50);
    this.emitParticles(400, 280, [0xffd700, 0xffaa00], isPerfect ? 14 : 8);
    SoundManager.sfxCritical();

    if (isPerfect) {
      this.scene.pause();
      setTimeout(() => {
        if (this.scene.isPaused() && !this.pauseOpen) this.scene.resume();
      }, 100);
    }

    this.monsterStunned = true;
    this.time.delayedCall(1000, () => {
      this.monsterStunned = false;
    });

    if (this.targetMonster && !this.targetMonster.isDead) {
      const reflectDmg = Math.floor(Math.max(incomingDmg * 0.5, this.effectiveAtk * atkMult));
      if (reflectDmg > 0) {
        const dead = this.targetMonster.takeDamage(reflectDmg);
        DamageText.show(
          this,
          this.targetMonster.x,
          this.targetMonster.y - 50,
          `반사! ${reflectDmg}`,
          '#ffd700',
          '20px',
        );
        if (dead) this.handleMonsterKill(this.targetMonster);
      }
    }

    this.addOverdrive(isPerfect ? 30 : 15);
    return true;
  }

  /* ---- Class-specific responses ---- */

  private tryWarriorBlock(incomingDmg: number): boolean {
    if (this.selectedClass.id !== 'warrior') return false;
    const shieldSkill = this.equippedSkills.find(s => s === 'w_shield_up');
    if (!shieldSkill) return false;
    const btn = this.skillButtons.find(b => b?.skillId === 'w_shield_up');
    if (!btn || !this.shieldDmgReduce || this.shieldDmgReduce < 0.5) return false;
    const counterDmg = Math.floor(incomingDmg * 0.5);
    DamageText.show(this, 400, 200, '🛡 BLOCK! 반격!', '#44aaff', '26px');
    if (counterDmg > 0 && this.targetMonster && !this.targetMonster.isDead) {
      const dead = this.targetMonster.takeDamage(counterDmg);
      DamageText.show(
        this,
        this.targetMonster.x,
        this.targetMonster.y - 50,
        `반격 ${counterDmg}`,
        '#44aaff',
        '18px',
      );
      if (dead) this.handleMonsterKill(this.targetMonster);
    }
    return true;
  }

  private tryMageBarrier(incomingDmg: number): { absorbed: boolean; dmg: number } {
    if (!this.mageBarrierActive) return { absorbed: false, dmg: incomingDmg };
    this.mageBarrierActive = false;
    const reflectDmg = Math.floor(incomingDmg * 0.3);
    DamageText.show(this, 400, 200, '🔮 BARRIER! 흡수!', '#aa66ff', '26px');
    this.cameras.main.flash(150, 100, 50, 255);
    if (reflectDmg > 0 && this.targetMonster && !this.targetMonster.isDead) {
      const dead = this.targetMonster.takeDamage(reflectDmg);
      DamageText.show(
        this,
        this.targetMonster.x,
        this.targetMonster.y - 50,
        `반사 ${reflectDmg}`,
        '#aa66ff',
        '18px',
      );
      if (dead) this.handleMonsterKill(this.targetMonster);
    }
    return { absorbed: true, dmg: 0 };
  }

  private tryRogueDodge(): boolean {
    if (this.selectedClass.id !== 'rogue') return false;
    if (!this.stealthActive) return false;
    DamageText.show(this, 400, 200, '🗡 DODGE! 암살 준비!', '#cc44ff', '26px');
    this.roguePostDodgeActive = true;
    this.stealthGuaranteeCrit = true;
    this.roguePostDodgeTimer?.remove();
    this.roguePostDodgeTimer = this.time.delayedCall(3000, () => {
      this.roguePostDodgeActive = false;
    });
    return true;
  }

  private updateBuffBar() {
    if (!this.buffBarContainer) return;
    this.buffBarContainer.removeAll(true);

    const by = SLOT_Y + SLOT_H / 2 + 14;

    const stats: { icon: string; label: string; value: string; color: string }[] = [
      {
        icon: '❤️',
        label: 'HP',
        value: `${Math.ceil(this.playerHp)}/${this.playerMaxHp}`,
        color: '#ff6666',
      },
      {
        icon: '💎',
        label: 'MP',
        value: `${Math.ceil(this.playerMp)}/${this.playerMaxMp}`,
        color: '#4488ff',
      },
      { icon: '⚔️', label: 'ATK', value: `${this.effectiveAtk}`, color: '#ff8844' },
      { icon: '💨', label: 'SPD', value: `${this.attacksPerSec.toFixed(2)}/s`, color: '#66ccff' },
      {
        icon: '🛡️',
        label: 'DEF',
        value: `${Math.floor(this.defenseRate * 100)}%`,
        color: '#4488cc',
      },
      {
        icon: '🎯',
        label: 'CRIT',
        value: `${Math.floor(this.critChance * 100)}%`,
        color: '#ffaa00',
      },
      {
        icon: '🩸',
        label: '흡혈',
        value: `${(this.lifestealRate * 100).toFixed(1)}%`,
        color: '#cc4488',
      },
    ];

    const gap = 6;
    const itemW = 110;
    const totalW = stats.length * itemW + (stats.length - 1) * gap;
    const startX = 400 - totalW / 2;

    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x0a0a18, 0.7);
    panelBg.fillRoundedRect(startX - 8, by - 10, totalW + 16, 22, 6);
    this.buffBarContainer.add(panelBg);

    stats.forEach((s, i) => {
      const sx = startX + i * (itemW + gap);
      const txt = this.add
        .text(sx, by, `${s.icon} ${s.label} ${s.value}`, {
          fontSize: '10px',
          color: s.color,
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setDepth(53);
      this.buffBarContainer!.add(txt);
    });
  }

  private rebuildSkillUI() {
    this.skillButtons.forEach(b => b?.destroy());
    this.skillButtons = new Array(MAX_SLOTS).fill(null);
    this.emptySlotGfx.forEach(g => g.setVisible(true));
    const skills = [...this.equippedSkills];
    this.equippedSkills = [];
    for (const sid of skills) this.equipSkill(sid, false);
  }

  private isBasicAttackId(id: string): boolean {
    return id.startsWith('basic_');
  }

  private showAutoAttackBadge() {
    if (this.autoAttackBadge) this.autoAttackBadge.destroy();
    const sx = SLOT_XS[0];
    const container = this.add.container(sx + SLOT_W / 2 - 2, SLOT_Y - SLOT_H / 2 + 2).setDepth(55);
    const bg = this.add.graphics();
    bg.fillStyle(0x228833, 0.9);
    bg.fillRoundedRect(-22, -8, 44, 16, 4);
    bg.lineStyle(1, 0x44ff66, 0.8);
    bg.strokeRoundedRect(-22, -8, 44, 16, 4);
    const txt = this.add
      .text(0, 0, 'AUTO', {
        fontSize: '9px',
        color: '#44ff66',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5);
    container.add([bg, txt]);
    this.tweens.add({
      targets: container,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.autoAttackBadge = container;
  }

  private equipSkill(skillId: string, animate = true) {
    const idx = this.equippedSkills.length;
    if (idx >= MAX_SLOTS) return;
    this.equippedSkills.push(skillId);
    const def = ALL_SKILL_DEFS[skillId];
    if (!def) return;
    const btn = new SkillButton(this, SLOT_XS[idx], SLOT_Y, SLOT_W, SLOT_H, {
      name: def.name,
      icon: def.icon,
      cooldown: this.skillCd(skillId),
      color: def.btnColor,
      hoverColor: def.btnHover,
    });
    btn.skillId = skillId;
    btn.on('activate', () => this.onSkillActivate(idx));
    btn.on('activate-blocked', () => {
      const d = ALL_SKILL_DEFS[skillId];
      if (d) this.showMpWarning(d.name, d.mpCost);
    });
    btn.on('tooltip-show', () => this.showSkillTooltip(skillId, SLOT_XS[idx], SLOT_Y));
    btn.on('tooltip-hide', () => this.hideTooltip());
    this.skillButtons[idx] = btn;
    if (this.emptySlotGfx[idx]) this.emptySlotGfx[idx].setVisible(false);
    if (animate) {
      this.tweens.add({
        targets: btn,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 150,
        yoyo: true,
        ease: 'Back.easeOut',
      });
    }
    if (idx === 0 && this.isBasicAttackId(skillId) && this.autoAttackEnabled) {
      this.showAutoAttackBadge();
    }
  }

  /* ================================================================
     BOTTOM BUTTONS: SHOP + RELIC
     ================================================================ */

  private createBottomButtons() {
    this.createShopButton();
    this.createRelicButton();
  }

  private createShopButton() {
    const { x, y, w, h } = SHOP_BTN;
    this.shopBtnBg = this.add.graphics().setDepth(50);
    this.drawBottomBtn(this.shopBtnBg, x, y, w, h, 0x443820, 0xaa8833, false);
    this.add
      .text(x, y, '🛒 상점', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(51);
    const z = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(52);
    z.on('pointerdown', () => {
      if (!this.gameOver && !this.cardSelecting && !this.doorSelecting) this.toggleShop();
    });
    z.on('pointerover', () =>
      this.drawBottomBtn(this.shopBtnBg, x, y, w, h, 0x5a4a2a, 0xccaa55, true),
    );
    z.on('pointerout', () =>
      this.drawBottomBtn(this.shopBtnBg, x, y, w, h, 0x443820, 0xaa8833, false),
    );
  }

  private createRelicButton() {
    const { x, y, w, h } = RELIC_BTN;
    this.relicBtnBg = this.add.graphics().setDepth(50);
    this.drawBottomBtn(this.relicBtnBg, x, y, w, h, 0x332255, 0x8855cc, false);
    this.add
      .text(x, y, '💎 유물', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(51);
    const z = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(52);
    z.on('pointerdown', () => {
      if (!this.gameOver && !this.cardSelecting && !this.doorSelecting) this.toggleRelic();
    });
    z.on('pointerover', () =>
      this.drawBottomBtn(this.relicBtnBg, x, y, w, h, 0x4a3377, 0xaa77ee, true),
    );
    z.on('pointerout', () =>
      this.drawBottomBtn(this.relicBtnBg, x, y, w, h, 0x332255, 0x8855cc, false),
    );
  }

  private drawBottomBtn(
    gfx: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: number,
    border: number,
    _hover: boolean,
  ) {
    gfx.clear();
    gfx.fillStyle(fill, 1);
    gfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    gfx.lineStyle(2, border, 1);
    gfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);
  }

  /* ================================================================
     SHOP
     ================================================================ */

  private toggleShop() {
    this.shopOpen ? this.closeOverlay() : this.openShop();
  }

  private openShop() {
    if (this.relicPanel?.isOpen) this.relicPanel.close();
    if (this.relicOpen) this.closeOverlay();
    this.shopOpen = true;
    const els = this.overlayElements;
    const bg = this.add.graphics().setDepth(250).setAlpha(0);
    bg.fillStyle(0x000000, 0.6);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.tweens.add({ targets: bg, alpha: 1, duration: 200 });

    const panel = this.add.graphics().setDepth(251);
    panel.fillStyle(0x1a1a30, 0.95);
    panel.fillRoundedRect(170, 100, 460, 370, 16);
    panel.lineStyle(2, 0x4466aa, 0.8);
    panel.strokeRoundedRect(170, 100, 460, 370, 16);
    els.push(panel);
    els.push(
      this.add
        .text(400, 126, '🛒 상점', {
          fontSize: '24px',
          color: '#ffd700',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(252),
    );
    const closeZ = this.add
      .zone(605, 115, 40, 30)
      .setInteractive({ useHandCursor: true })
      .setDepth(253);
    closeZ.on('pointerdown', () => this.closeOverlay());
    els.push(closeZ);
    els.push(
      this.add
        .text(605, 115, '✕', {
          fontSize: '20px',
          color: '#ff6666',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(252),
    );

    SHOP_ITEMS.forEach((item, i) => {
      const iy = 155 + i * 52;
      const price = Math.floor(item.cost * this.shopDiscount);
      const can = this.canBuyShopItem(i);
      const row = this.add.graphics().setDepth(251);
      row.fillStyle(can ? 0x222244 : 0x1a1a28, 0.8);
      row.fillRoundedRect(190, iy, 420, 46, 8);
      els.push(row);
      els.push(this.add.text(208, iy + 13, item.icon, { fontSize: '18px' }).setDepth(252));
      els.push(
        this.add
          .text(234, iy + 8, item.name, {
            fontSize: '14px',
            color: can ? '#ffffff' : '#666666',
            fontFamily: 'Arial',
            fontStyle: 'bold',
          })
          .setDepth(252),
      );
      els.push(
        this.add
          .text(234, iy + 28, item.desc, {
            fontSize: '10px',
            color: can ? '#aaaaaa' : '#555555',
            fontFamily: 'Arial',
          })
          .setDepth(252),
      );
      if (item.kind === 'potion' && !this.canAddPotion(item.potionLv!)) {
        els.push(
          this.add
            .text(490, iy + 23, '슬롯 없음', {
              fontSize: '10px',
              color: '#ff4444',
              fontFamily: 'Arial',
              stroke: '#000000',
              strokeThickness: 2,
            })
            .setOrigin(0.5)
            .setDepth(252),
        );
      }
      els.push(
        this.add
          .text(570, iy + 23, `${price}G`, {
            fontSize: '15px',
            color: can ? '#ffd700' : '#664400',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2,
          })
          .setOrigin(0.5)
          .setDepth(252),
      );
      if (can) {
        const bz = this.add
          .zone(570, iy + 23, 80, 42)
          .setInteractive({ useHandCursor: true })
          .setDepth(253);
        bz.on('pointerdown', () => this.buyShopItem(i));
        els.push(bz);
      }
    });
    els.push(
      this.add
        .text(400, 430, `보유: ${this.gold}G`, {
          fontSize: '14px',
          color: '#ccaa44',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(252),
    );

    if (this.shopFromDoor) {
      const cx = 400,
        cy = 468,
        cw = 200,
        ch = 36;
      const cG = this.add.graphics().setDepth(251);
      const drawCont = (hover: boolean) => {
        cG.clear();
        cG.fillStyle(hover ? 0x335533 : 0x223322, 1);
        cG.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 10);
        cG.lineStyle(2, hover ? 0x55aa66 : 0x448855, 1);
        cG.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 10);
      };
      drawCont(false);
      els.push(cG);
      els.push(
        this.add
          .text(cx, cy, '계속하기', {
            fontSize: '16px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setDepth(252),
      );
      const cz = this.add
        .zone(cx, cy, cw, ch)
        .setInteractive({ useHandCursor: true })
        .setDepth(253);
      cz.on('pointerover', () => drawCont(true));
      cz.on('pointerout', () => drawCont(false));
      cz.on('pointerdown', () => this.closeOverlay());
      els.push(cz);
    }
  }

  private canBuyShopItem(i: number): boolean {
    const item = SHOP_ITEMS[i];
    const price = Math.floor(item.cost * this.shopDiscount);
    if (this.gold < price) return false;
    if (item.kind === 'potion') return this.canAddPotion(item.potionLv!);
    if (item.buffType === 'atk') return !this.atkBuffActive;
    return !this.invincible;
  }

  private buyShopItem(i: number) {
    const item = SHOP_ITEMS[i];
    const price = Math.floor(item.cost * this.shopDiscount);
    if (item.kind === 'potion') {
      if (!this.addPotion(item.potionLv!)) return;
      this.gold -= price;
    } else {
      this.gold -= price;
      if (item.buffType === 'atk') this.startAtkBuff();
      else if (item.buffType === 'invincible') this.startInvincibility();
    }
    this.updateUI();
    this.closeOverlay();
  }

  private startAtkBuff() {
    this.atkBuffActive = true;
    this.atkBuffTimer?.remove();
    this.atkBuffTimer = this.time.delayedCall(30000, () => {
      this.atkBuffActive = false;
      this.updateUI();
    });
    this.updateUI();
  }

  private startInvincibility() {
    this.invincible = true;
    this.invincibleTimer?.remove();
    this.invincibleTimer = this.time.delayedCall(5000, () => {
      this.invincible = false;
    });
  }

  /* ================================================================
     RELIC PANEL
     ================================================================ */

  private toggleRelic() {
    if (this.relicPanel.isOpen) {
      this.relicPanel.close();
    } else {
      if (this.shopOpen) this.closeOverlay();
      this.relicOpen = true;
      this.relicPanel.open();
    }
  }

  /* ================================================================
     SKILL ACTIVATION
     ================================================================ */

  private onSkillActivate(slotIdx: number) {
    if (this.gameOver || this.cardSelecting || this.doorSelecting || this.narrationActive) return;
    if (!this.targetMonster || this.targetMonster.isDead) return;
    if (this.skillSealed) {
      DamageText.show(this, 400, 300, '스킬 봉인 중!', '#cc22ff', '22px');
      return;
    }
    const id = this.equippedSkills[slotIdx];
    if (!id) return;
    const btn = this.skillButtons[slotIdx];
    if (btn && !btn.isReady) return;
    const def = ALL_SKILL_DEFS[id];
    if (!def) return;

    if (this.isBasicAttackId(id)) {
      this.onAutoAttack(false);
      btn?.startCooldown(this.overdriveActive ? 0 : this.skillCd(id));
      return;
    }

    const mpCost = this.overdriveActive ? 0 : def.mpCost;
    if (this.playerMp < mpCost) {
      this.showMpWarning(def.name, def.mpCost);
      return;
    }
    this.playerMp -= mpCost;
    this.drawMpBar();
    this.refreshSkillButtonStates();
    this.skillButtons[slotIdx]?.startCooldown(this.overdriveActive ? 0 : this.skillCd(id));
    this.addOverdrive(15);
    this.playSfxForType(def.sfxType);
    this.executeSkill(def);
  }

  private playSfxForType(sfx: SfxType) {
    switch (sfx) {
      case 'hit':
        SoundManager.sfxHit();
        break;
      case 'fire':
        SoundManager.sfxFireball();
        break;
      case 'ice':
        SoundManager.sfxIce();
        break;
      case 'lightning':
        SoundManager.sfxLightning();
        break;
      case 'poison':
        SoundManager.sfxPoison();
        break;
      case 'explosion':
        SoundManager.sfxExplosion();
        break;
      case 'shield':
        SoundManager.sfxShield();
        break;
      case 'buff':
        SoundManager.sfxBuff();
        break;
      case 'debuff':
        SoundManager.sfxDebuff();
        break;
      case 'stealth':
        SoundManager.sfxStealth();
        break;
    }
  }

  private executeSkill(def: SkillDef) {
    const level = this.skillLevels[def.id] ?? 1;
    const mult = skillMult(def.id, level);

    switch (def.effectType) {
      case 'single_dmg':
        this.execSingleDmg(def, mult);
        break;
      case 'multi_hit':
        this.execMultiHit(def, mult);
        break;
      case 'aoe':
        this.execAoe(def, mult);
        break;
      case 'dot':
        this.execDot(def, mult);
        break;
      case 'buff_self':
        this.execBuffSelf(def);
        break;
      case 'debuff_enemy':
        this.execDebuffEnemy(def, mult);
        break;
      case 'stealth':
        this.execStealth(def);
        break;
      case 'reflect':
        this.execReflect(def);
        break;
    }

    if (def.dotSeconds && def.effectType === 'single_dmg') {
      this.startDot(def, mult, def.dotSeconds);
    }
    if (def.dotSeconds && def.effectType === 'aoe') {
      this.startAoeDot(def, mult, def.dotSeconds);
    }
    if (def.debuffEffect && def.debuffDuration && def.effectType !== 'debuff_enemy') {
      this.applyDebuff(def.debuffEffect, def.debuffDuration);
    }
    if (
      def.buffEffect &&
      def.buffDuration &&
      def.effectType !== 'buff_self' &&
      def.effectType !== 'reflect'
    ) {
      this.applyBuff(def.buffEffect, def.buffDuration);
    }
  }

  private execSingleDmg(def: SkillDef, mult: number) {
    const t = this.targetMonster!;
    let dmg = Math.floor(this.effectiveAtk * mult * this.skillDamageMult);
    if (def.id === 'r_assassinate' && this.stealthActive) dmg *= 2;
    const dead = t.takeDamageColored(dmg, def.color);
    DamageText.show(
      this,
      t.x,
      t.y - 40,
      dmg,
      '#' + def.color.toString(16).padStart(6, '0'),
      '32px',
    );
    this.showSkillVfx(t.x, t.y, def.color, 'single');
    this.applyLifesteal(dmg);
    if (dead) this.handleMonsterKill(t);
  }

  private execMultiHit(def: SkillDef, mult: number) {
    const t = this.targetMonster!;
    const hits = def.hits ?? 3;
    const dmgPer = Math.floor(this.effectiveAtk * mult * this.skillDamageMult);
    for (let i = 0; i < hits; i++) {
      this.time.delayedCall(i * 120, () => {
        if (this.gameOver || t.isDead) return;
        const dead = t.takeDamageColored(dmgPer, def.color);
        const ox = Phaser.Math.Between(-15, 15);
        DamageText.show(
          this,
          t.x + ox,
          t.y - 40 - i * 12,
          dmgPer,
          '#' + def.color.toString(16).padStart(6, '0'),
          '24px',
        );
        this.emitParticles(t.x, t.y, [def.color, 0xffffff], 3);
        this.applyLifesteal(dmgPer);
        if (dead) this.handleMonsterKill(t);
      });
    }
    this.cameras.main.shake(60, 0.004);
  }

  private execAoe(def: SkillDef, mult: number) {
    const dmg = Math.floor(this.effectiveAtk * mult * this.skillDamageMult);
    DamageText.show(this, 400, 210, dmg, '#' + def.color.toString(16).padStart(6, '0'), '38px');
    this.showSkillVfx(400, 300, def.color, 'aoe');
    this.cameras.main.shake(250, 0.018);
    this.cameras.main.flash(
      150,
      (def.color >> 16) & 0xff,
      (def.color >> 8) & 0xff,
      def.color & 0xff,
    );
    this.applyLifesteal(dmg);
    const alive = this.monsters.filter(m => !m.isDead);
    alive.forEach(m => {
      const dead = m.takeDamageAoe(dmg, def.color);
      if (dead) this.handleMonsterKill(m);
    });
  }

  private execDot(def: SkillDef, mult: number) {
    const t = this.targetMonster!;
    DamageText.show(
      this,
      t.x,
      t.y - 40,
      def.name + '!',
      '#' + def.color.toString(16).padStart(6, '0'),
      '24px',
    );
    this.showSkillVfx(t.x, t.y, def.color, 'dot');
    const seconds = def.dotSeconds ?? 3;
    this.startDot(def, mult, seconds);
  }

  private startDot(def: SkillDef, mult: number, seconds: number) {
    const tick = Math.floor(this.effectiveAtk * mult * this.skillDamageMult);
    const timer = this.time.addEvent({
      delay: 1000,
      repeat: seconds - 1,
      callback: () => {
        const t = this.targetMonster;
        if (this.gameOver || !t || t.isDead) return;
        const dead = t.takeDamageColored(tick, def.color);
        DamageText.show(
          this,
          t.x + Phaser.Math.Between(-20, 20),
          t.y - 30,
          tick,
          '#' + def.color.toString(16).padStart(6, '0'),
          '20px',
        );
        this.emitParticles(t.x, t.y, [def.color], 2);
        this.applyLifesteal(tick);
        if (dead) this.handleMonsterKill(t);
      },
    });
    this.dotTimers.push(timer);
  }

  private startAoeDot(def: SkillDef, mult: number, seconds: number) {
    const tick = Math.floor(this.effectiveAtk * mult * this.skillDamageMult * 0.5);
    const timer = this.time.addEvent({
      delay: 1000,
      repeat: seconds - 1,
      callback: () => {
        if (this.gameOver) return;
        const alive = this.monsters.filter(m => !m.isDead);
        alive.forEach(m => {
          const dead = m.takeDamageColored(tick, def.color);
          DamageText.show(
            this,
            m.x + Phaser.Math.Between(-10, 10),
            m.y - 20,
            tick,
            '#' + def.color.toString(16).padStart(6, '0'),
            '16px',
          );
          if (dead) this.handleMonsterKill(m);
        });
      },
    });
    this.dotTimers.push(timer);
  }

  private execBuffSelf(def: SkillDef) {
    if (!def.buffEffect || !def.buffDuration) return;
    this.applyBuff(def.buffEffect, def.buffDuration);
    DamageText.show(
      this,
      400,
      120,
      `✦ ${def.name}!`,
      '#' + def.color.toString(16).padStart(6, '0'),
      '24px',
    );
    this.showSkillVfx(400, 300, def.color, 'buff');
  }

  private applyBuff(effect: string, duration: number) {
    switch (effect) {
      case 'def70':
        this.shieldDmgReduce = 0.7;
        this.time.delayedCall(duration * 1000, () => {
          this.shieldDmgReduce = 0;
        });
        DamageText.show(this, 400, 100, '🛡 방어 +70%!', '#88ccff', '18px');
        break;
      case 'def50':
        this.shieldDmgReduce = 0.5;
        this.time.delayedCall(duration * 1000, () => {
          this.shieldDmgReduce = 0;
        });
        break;
      case 'warcry':
        this.warcryActive = true;
        this.time.delayedCall(duration * 1000, () => {
          this.warcryActive = false;
        });
        DamageText.show(this, 400, 100, '📣 ATK +50%! SPD +30%!', '#ff8844', '18px');
        break;
      case 'mana_overload':
        this.manaOverloadActive = true;
        this.time.delayedCall(duration * 1000, () => {
          this.manaOverloadActive = false;
        });
        DamageText.show(this, 400, 100, '🔮 스킬 데미지 ×3!', '#aa44ff', '20px');
        break;
      case 'shadow_clone':
        this.shadowCloneActive = true;
        this.shadowCloneMult = skillMult('r_shadow_clone', this.skillLevels['r_shadow_clone'] ?? 1);
        this.time.delayedCall(duration * 1000, () => {
          this.shadowCloneActive = false;
          this.shadowCloneMult = 0;
        });
        DamageText.show(this, 400, 100, '👥 분신 생성!', '#7755bb', '18px');
        break;
      case 'dodge50':
        this.dodgeChance = 0.5;
        this.time.delayedCall(duration * 1000, () => {
          this.dodgeChance = 0;
        });
        DamageText.show(this, 400, 100, '💨 회피율 +50%!', '#888888', '18px');
        break;
      case 'crit30':
        this.tempCritBonus += 0.3;
        this.time.delayedCall(duration * 1000, () => {
          this.tempCritBonus = Math.max(0, this.tempCritBonus - 0.3);
        });
        DamageText.show(this, 400, 100, '🎯 CRIT +30%!', '#ffaa00', '18px');
        break;
    }
    this.updateBuffBar();
  }

  private execDebuffEnemy(def: SkillDef, mult: number) {
    if (!def.debuffEffect || !def.debuffDuration) return;
    if (mult > 0) {
      const t = this.targetMonster!;
      const dmg = Math.floor(this.effectiveAtk * mult * this.skillDamageMult);
      if (dmg > 0) {
        const dead = t.takeDamageColored(dmg, def.color);
        DamageText.show(
          this,
          t.x,
          t.y - 40,
          dmg,
          '#' + def.color.toString(16).padStart(6, '0'),
          '28px',
        );
        this.applyLifesteal(dmg);
        if (dead) {
          this.handleMonsterKill(t);
          return;
        }
      }
    }
    this.applyDebuff(def.debuffEffect, def.debuffDuration);
    DamageText.show(
      this,
      400,
      130,
      `${def.icon} ${def.name}!`,
      '#' + def.color.toString(16).padStart(6, '0'),
      '20px',
    );
    this.showSkillVfx(this.targetMonster!.x, this.targetMonster!.y, def.color, 'debuff');
    if (def.buffEffect && def.buffDuration) {
      this.applyBuff(def.buffEffect, def.buffDuration);
    }
  }

  private applyDebuff(effect: string, duration: number) {
    switch (effect) {
      case 'stun':
        this.monsterStunned = true;
        this.monsterAttackTimer?.paused && (this.monsterAttackTimer.paused = true);
        this.time.delayedCall(duration * 1000, () => {
          this.monsterStunned = false;
          if (this.monsterAttackTimer) this.monsterAttackTimer.paused = false;
        });
        DamageText.show(this, 400, 160, '💫 스턴!', '#ffdd44', '20px');
        break;
      case 'freeze':
        this.monsterFrozen = true;
        if (this.monsterAttackTimer) this.monsterAttackTimer.paused = true;
        this.time.delayedCall(duration * 1000, () => {
          this.monsterFrozen = false;
          if (this.monsterAttackTimer) this.monsterAttackTimer.paused = false;
        });
        DamageText.show(this, 400, 160, '🧊 동결!', '#66ccff', '22px');
        break;
      case 'slow40':
        break;
      case 'weakatk30':
        this.monsterWeakened = true;
        this.monsterWeakenPct = 0.3;
        this.time.delayedCall(duration * 1000, () => {
          this.monsterWeakened = false;
          this.monsterWeakenPct = 0;
        });
        DamageText.show(this, 400, 160, '😤 약화!', '#cc8844', '18px');
        break;
      case 'defdown':
        break;
    }
  }

  private execStealth(def: SkillDef) {
    const dur = def.stealthDuration ?? 3;
    this.stealthActive = true;
    this.stealthGuaranteeCrit = true;
    this.invincible = true;
    this.time.delayedCall(dur * 1000, () => {
      this.stealthActive = false;
      this.invincible = false;
    });
    DamageText.show(this, 400, 120, '👤 은신!', '#6644aa', '24px');
    this.showSkillVfx(400, 300, def.color, 'buff');
    this.updateBuffBar();
  }

  private execReflect(def: SkillDef) {
    const dur = def.buffDuration ?? 5;
    const pct = def.reflectPct ?? 0.5;
    this.reflectActive = true;
    this.reflectPct = pct;
    this.time.delayedCall(dur * 1000, () => {
      this.reflectActive = false;
      this.reflectPct = 0;
    });
    DamageText.show(
      this,
      400,
      120,
      `🔄 반격 ${Math.floor(pct * 100)}%!`,
      '#' + def.color.toString(16).padStart(6, '0'),
      '22px',
    );
    this.showSkillVfx(400, 300, def.color, 'buff');
    this.updateBuffBar();
  }

  private showSkillVfx(x: number, y: number, color: number, type: string) {
    const colorHex = '#' + color.toString(16).padStart(6, '0');
    const darkerColor = Phaser.Display.Color.ValueToColor(color).darken(30).color;
    const lighterColor = Phaser.Display.Color.ValueToColor(color).lighten(50).color;

    if (type === 'aoe') {
      this.emitParticles(x, y, [color, lighterColor, 0xffffff], 16);
      const flash = this.add.graphics().setDepth(150).setAlpha(0.3);
      flash.fillStyle(color, 1);
      flash.fillRect(0, 0, 800, 600);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 350,
        onComplete: () => flash.destroy(),
      });
      const ring = this.add.graphics().setDepth(89).setAlpha(0.6);
      ring.lineStyle(5, color, 1);
      ring.strokeCircle(x, y, 15);
      this.tweens.add({
        targets: ring,
        scaleX: 8,
        scaleY: 6,
        alpha: 0,
        duration: 450,
        onComplete: () => ring.destroy(),
      });
    } else if (type === 'single') {
      this.emitParticles(x, y, [color, lighterColor], 8);
      this.cameras.main.shake(60, 0.005);
      const circle = this.add.graphics().setDepth(89).setAlpha(0.7);
      circle.lineStyle(3, color, 1);
      circle.strokeCircle(x, y, 10);
      circle.fillStyle(darkerColor, 0.2);
      circle.fillCircle(x, y, 10);
      this.tweens.add({
        targets: circle,
        scaleX: 4,
        scaleY: 4,
        alpha: 0,
        duration: 300,
        onComplete: () => circle.destroy(),
      });
    } else if (type === 'dot') {
      for (let i = 0; i < 4; i++) {
        const bx = x + Phaser.Math.Between(-40, 40),
          by = y + Phaser.Math.Between(-20, 20);
        const bubble = this.add.graphics().setDepth(89).setAlpha(0.6);
        const sz = Phaser.Math.Between(3, 6);
        bubble.fillStyle(color, 0.5);
        bubble.fillCircle(0, 0, sz);
        bubble.setPosition(bx, by);
        this.tweens.add({
          targets: bubble,
          y: by - 50,
          alpha: 0,
          duration: 600,
          delay: i * 80,
          onComplete: () => bubble.destroy(),
        });
      }
    } else if (type === 'buff') {
      this.emitParticles(x, y, [color, lighterColor, 0xffffff], 10);
      this.cameras.main.flash(100, (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff);
    } else if (type === 'debuff') {
      this.emitParticles(x, y, [color, darkerColor], 6);
    }
    void colorHex;
  }

  private applyLifesteal(dmg: number) {
    if (this.lifestealRate <= 0) return;
    this.playerHp = Math.min(
      this.playerHp + Math.max(1, Math.floor(dmg * this.lifestealRate)),
      this.playerMaxHp,
    );
    this.drawPlayerHpBar();
  }

  /* ================================================================
     LEVEL-UP CARD SYSTEM
     ================================================================ */

  private gainXp(amount: number) {
    const adjusted = Math.floor(amount * this.xpMultiplier);
    const oldRatio = this.xp / this.xpToNext;
    const prevLevel = this.level;
    this.xp += adjusted;
    DamageText.show(this, 400, XP_BAR.y + 20, `+${adjusted} XP`, '#88ccff', '16px');
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = 30 + this.level * 15;
      this.pendingLevelUps++;
    }
    const newRatio = this.xp / this.xpToNext;
    this.animateXpFill(this.level > prevLevel ? 0 : oldRatio, newRatio);
    this.xpLevelText.setText(`Lv.${this.level}  ${this.xp}/${this.xpToNext}`);
    this.updateUI();
    if (this.level > prevLevel) this.showLevelUpEffect();
    if (this.pendingLevelUps > 0 && !this.cardSelecting) {
      this.time.delayedCall(300, () => {
        if (this.pendingLevelUps > 0 && !this.cardSelecting) {
          this.showCardSelection();
        }
      });
    }
  }

  private animateXpFill(fromRatio: number, toRatio: number) {
    const { x, y, w, h } = XP_BAR;
    const obj = { r: Phaser.Math.Clamp(fromRatio, 0, 1) };
    this.tweens.add({
      targets: obj,
      r: Phaser.Math.Clamp(toRatio, 0, 1),
      duration: 500,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        const fw = w * obj.r;
        this.xpBarFill.clear();
        if (fw > 0) {
          this.xpBarFill.fillStyle(0x44aaff, 1);
          this.xpBarFill.fillRoundedRect(x, y, fw, h, Math.min(3, fw / 2));
          this.xpBarFill.fillStyle(0x88ccff, 0.3);
          this.xpBarFill.fillRoundedRect(x, y, fw, h / 2, Math.min(3, fw / 2));
        }
      },
    });
  }

  private showLevelUpEffect() {
    const ring1 = this.add.graphics().setDepth(95).setAlpha(0.8);
    ring1.lineStyle(4, 0xffd700, 1);
    ring1.strokeCircle(400, 300, 20);
    ring1.fillStyle(0xffd700, 0.12);
    ring1.fillCircle(400, 300, 20);
    this.tweens.add({
      targets: ring1,
      scaleX: 6,
      scaleY: 6,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeOut',
      onComplete: () => ring1.destroy(),
    });
    const ring2 = this.add.graphics().setDepth(95).setAlpha(0.5);
    ring2.lineStyle(2, 0xffaa00, 1);
    ring2.strokeCircle(400, 300, 12);
    this.tweens.add({
      targets: ring2,
      scaleX: 10,
      scaleY: 10,
      alpha: 0,
      duration: 900,
      delay: 100,
      ease: 'Quad.easeOut',
      onComplete: () => ring2.destroy(),
    });
    SoundManager.sfxLevelUp();
    const lvText = this.add
      .text(400, 280, 'LEVEL UP!', {
        fontSize: '42px',
        color: '#ffd700',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setDepth(96)
      .setScale(0.3)
      .setAlpha(0);
    this.tweens.add({
      targets: lvText,
      scale: 1.2,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: lvText,
          scale: 1.5,
          alpha: 0,
          y: 230,
          duration: 600,
          delay: 500,
          ease: 'Quad.easeIn',
          onComplete: () => lvText.destroy(),
        });
      },
    });
    this.emitParticles(400, 300, [0xffd700, 0xffaa00, 0xffcc44, 0xffffff], 14);
    this.cameras.main.flash(250, 255, 210, 0);
  }

  private showCardSelection(skillOnly = false) {
    if (this.cardSelecting && this.overlayElements.length > 0) return;
    this.cardSelecting = true;
    if (this.shopOpen) this.closeOverlay();
    if (this.relicPanel?.isOpen) {
      this.relicPanel.close();
      this.relicOpen = false;
    }
    const els = this.overlayElements;

    const bg = this.add.graphics().setDepth(300).setAlpha(0);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.tweens.add({ targets: bg, alpha: 1, duration: 300 });

    const titleStr = skillOnly ? '⚔ 스킬을 선택하세요!' : '⬆ LEVEL UP!';
    const title = this.add
      .text(400, 90, titleStr, {
        fontSize: '36px',
        color: '#ffdd44',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setDepth(301)
      .setScale(0);
    els.push(title);
    this.tweens.add({ targets: title, scale: 1, duration: 400, delay: 100, ease: 'Back.easeOut' });

    els.push(
      this.add
        .text(400, 125, skillOnly ? '스킬을 획득하세요' : '카드를 선택하세요', {
          fontSize: '16px',
          color: '#cccccc',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(301),
    );

    if (skillOnly) {
      this.showSkillCardPicks(els);
    } else {
      const showSkillsThisLevel = Math.random() < 0.5 && this.equippedSkills.length < MAX_SLOTS;
      if (showSkillsThisLevel) {
        this.showMixedCardPicks(els);
      } else {
        this.showStatCardPicks(els);
      }
    }
  }

  private shouldOfferAutoAtkCard(): boolean {
    if (this.autoAttackEnabled) return false;
    if (this.level < 3) return false;
    const chance = this.level >= 4 ? 0.66 : 0.33;
    return Math.random() < chance;
  }

  private showStatCardPicks(els: Phaser.GameObjects.GameObject[]) {
    if (this.shouldOfferAutoAtkCard()) {
      this.showStatCardsWithAutoAtk(els);
      return;
    }

    const eligible = STAT_CARDS.filter(c => (this.cardLevels[c.id] ?? 0) < 4);
    const weights = this.selectedClass.cardWeights;
    const weighted: CardDef[] = [];
    for (const c of eligible) {
      const w = weights[c.id] ?? 1;
      const count = Math.round(w * 10);
      for (let j = 0; j < count; j++) weighted.push(c);
    }
    const luckyBonus = this.relicLevels.lucky ?? 0;
    const numPicks = Math.min(eligible.length, 3 + luckyBonus);
    const seen = new Set<string>();
    const picks: CardDef[] = [];
    const shuffled = Phaser.Utils.Array.Shuffle([...weighted]);
    for (const c of shuffled) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      picks.push(c);
      if (picks.length >= numPicks) break;
    }
    const rarities = picks.map((_, idx) => {
      if (this.mageStartRare && idx === 0) return 'rare' as CardRarity;
      return rollRarity();
    });
    if (this.mageStartRare) this.mageStartRare = false;
    this.renderStatCards(picks, rarities, els);
  }

  private showStatCardsWithAutoAtk(els: Phaser.GameObjects.GameObject[]) {
    const eligible = STAT_CARDS.filter(c => (this.cardLevels[c.id] ?? 0) < 4);
    const weights = this.selectedClass.cardWeights;
    const weighted: CardDef[] = [];
    for (const c of eligible) {
      const w = weights[c.id] ?? 1;
      for (let j = 0; j < Math.round(w * 10); j++) weighted.push(c);
    }
    const seen = new Set<string>();
    const statPicks: CardDef[] = [];
    for (const c of Phaser.Utils.Array.Shuffle([...weighted])) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      statPicks.push(c);
      if (statPicks.length >= 2) break;
    }
    const rarities = statPicks.map(() => rollRarity());

    const autoCard = AUTO_ATK_CARDS[this.selectedClass.id];
    const total = statPicks.length + 1;
    const cw = 180,
      gap = 20;
    const totalW = total * cw + (total - 1) * gap;
    const startX = 400 - totalW / 2 + cw / 2;

    const autoIdx = Phaser.Math.Between(0, total - 1);
    let statI = 0;
    for (let i = 0; i < total; i++) {
      const cx = startX + i * (cw + gap),
        cy = 280,
        ch = 240;
      if (i === autoIdx) {
        this.renderAutoAtkCard(cx, cy, cw, ch, autoCard, els);
      } else {
        const card = statPicks[statI];
        const rarity = rarities[statI];
        statI++;
        this.renderSingleStatCard(cx, cy, cw, ch, card, rarity, els, i, total);
      }
    }
  }

  private showSkillCardPicks(els: Phaser.GameObjects.GameObject[]) {
    const pool = CLASS_SKILL_POOLS[this.selectedClass.id] ?? [];
    const eligible = pool.filter(s => {
      const lv = this.skillLevels[s.id] ?? 0;
      if (lv >= 4) return false;
      if (lv === 0 && this.equippedSkills.length >= MAX_SLOTS) return false;
      return true;
    });
    const numPicks = Math.min(eligible.length, 3);
    const picks = Phaser.Utils.Array.Shuffle([...eligible]).slice(0, numPicks);
    this.renderSkillCards(picks, els);
  }

  private showMixedCardPicks(els: Phaser.GameObjects.GameObject[]) {
    const pool = CLASS_SKILL_POOLS[this.selectedClass.id] ?? [];
    const eligibleSkills = pool.filter(s => {
      const lv = this.skillLevels[s.id] ?? 0;
      if (lv >= 4) return false;
      if (lv === 0 && this.equippedSkills.length >= MAX_SLOTS) return false;
      return true;
    });
    const eligibleStats = STAT_CARDS.filter(c => (this.cardLevels[c.id] ?? 0) < 4);

    if (eligibleSkills.length === 0) {
      this.showStatCardPicks(els);
      return;
    }

    const skillPick = Phaser.Math.RND.pick(eligibleSkills);
    const weights = this.selectedClass.cardWeights;
    const weighted: CardDef[] = [];
    for (const c of eligibleStats) {
      const w = weights[c.id] ?? 1;
      const count = Math.round(w * 10);
      for (let j = 0; j < count; j++) weighted.push(c);
    }
    const statPicks: CardDef[] = [];
    const seen = new Set<string>();
    const shuffled = Phaser.Utils.Array.Shuffle([...weighted]);
    for (const c of shuffled) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      statPicks.push(c);
      if (statPicks.length >= 2) break;
    }

    const rarities = statPicks.map(() => rollRarity());
    this.renderMixedCards(statPicks, rarities, [skillPick], els);
  }

  private renderStatCards(
    picks: CardDef[],
    rarities: CardRarity[],
    els: Phaser.GameObjects.GameObject[],
  ) {
    const synergyCompletingIds = new Set<string>();
    for (const syn of SYNERGIES) {
      if (this.activeSynergies.includes(syn.id)) continue;
      const missing = syn.requires.filter(r => (this.cardLevels[r] ?? 0) === 0);
      if (missing.length === 1) synergyCompletingIds.add(missing[0]);
    }

    const cw = picks.length <= 3 ? 180 : 150;
    const gap = 20;
    const totalW = picks.length * cw + (picks.length - 1) * gap;
    const startX = 400 - totalW / 2 + cw / 2;

    picks.forEach((card, i) => {
      const cx = startX + i * (cw + gap),
        cy = 280,
        ch = 240;
      const rarity = rarities[i];
      const rc = RARITY_COLORS[rarity];
      const curLv = this.cardLevels[card.id] ?? 0;
      const nextLv = curLv + 1;
      const perPick =
        rarity === 'legendary'
          ? card.legendValue
          : rarity === 'rare'
            ? card.rareValue
            : card.baseValue;
      const nextVal = cv(card.baseValue, curLv) + perPick + (this.cardRarityBonus[card.id] ?? 0);
      const isNew = curLv === 0;
      const completesSynergy = synergyCompletingIds.has(card.id) && curLv === 0;

      const allParts = this.drawCardUI(
        cx,
        cy,
        cw,
        ch,
        {
          icon: card.icon,
          name: card.name,
          color: card.color,
          desc: card.descFn(perPick),
          rarity,
          rc,
          isNew,
          isSkill: false,
          curLv,
          legendaryDesc:
            rarity === 'legendary' && LEGENDARY_DESCS[card.id] ? LEGENDARY_DESCS[card.id] : null,
          cdText: null,
          synergyName: completesSynergy
            ? (SYNERGIES.find(
                s =>
                  s.requires.includes(card.id) &&
                  s.requires.filter(r => (this.cardLevels[r] ?? 0) === 0).length === 1,
              )?.name ?? null)
            : null,
        },
        els,
        i,
        picks.length,
      );

      const zone = this.add
        .zone(cx, cy, cw, ch)
        .setInteractive({ useHandCursor: true })
        .setDepth(303);
      zone.on('pointerover', () =>
        this.tweens.add({
          targets: [...allParts, zone],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
        }),
      );
      zone.on('pointerout', () =>
        this.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
      );
      zone.on('pointerdown', () => this.pickStatCard(card.id, rarity));
      els.push(zone);
    });
  }

  private renderSingleStatCard(
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    card: CardDef,
    rarity: CardRarity,
    els: Phaser.GameObjects.GameObject[],
    i: number,
    total: number,
  ) {
    const rc = RARITY_COLORS[rarity];
    const curLv = this.cardLevels[card.id] ?? 0;
    const perPick =
      rarity === 'legendary'
        ? card.legendValue
        : rarity === 'rare'
          ? card.rareValue
          : card.baseValue;
    const isNew = curLv === 0;
    const synergyCompletingIds = new Set<string>();
    for (const syn of SYNERGIES) {
      if (this.activeSynergies.includes(syn.id)) continue;
      const missing = syn.requires.filter(r => (this.cardLevels[r] ?? 0) === 0);
      if (missing.length === 1) synergyCompletingIds.add(missing[0]);
    }
    const completesSynergy = synergyCompletingIds.has(card.id) && curLv === 0;
    const allParts = this.drawCardUI(
      cx,
      cy,
      cw,
      ch,
      {
        icon: card.icon,
        name: card.name,
        color: card.color,
        desc: card.descFn(perPick),
        rarity,
        rc,
        isNew,
        isSkill: false,
        curLv,
        legendaryDesc:
          rarity === 'legendary' && LEGENDARY_DESCS[card.id] ? LEGENDARY_DESCS[card.id] : null,
        cdText: null,
        synergyName: completesSynergy
          ? (SYNERGIES.find(
              s =>
                s.requires.includes(card.id) &&
                s.requires.filter(r => (this.cardLevels[r] ?? 0) === 0).length === 1,
            )?.name ?? null)
          : null,
      },
      els,
      i,
      total,
    );
    const zone = this.add
      .zone(cx, cy, cw, ch)
      .setInteractive({ useHandCursor: true })
      .setDepth(303);
    zone.on('pointerover', () =>
      this.tweens.add({ targets: [...allParts, zone], scaleX: 1.05, scaleY: 1.05, duration: 100 }),
    );
    zone.on('pointerout', () =>
      this.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
    );
    zone.on('pointerdown', () => this.pickStatCard(card.id, rarity));
    els.push(zone);
  }

  private renderAutoAtkCard(
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    card: AutoAtkCardDef,
    els: Phaser.GameObjects.GameObject[],
  ) {
    const g = this.add.graphics().setDepth(301);
    g.fillStyle(0x0a1a10, 0.95);
    g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);
    g.lineStyle(3, 0x44ff66, 0.9);
    g.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);
    els.push(g);

    const glow = this.add.graphics().setDepth(300);
    glow.fillStyle(0x44ff66, 0.08);
    glow.fillRoundedRect(cx - cw / 2 - 4, cy - ch / 2 - 4, cw + 8, ch + 8, 16);
    this.tweens.add({ targets: glow, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });
    els.push(glow);

    const icon = this.add
      .text(cx, cy - 70, card.icon, { fontSize: '32px' })
      .setOrigin(0.5)
      .setDepth(302);
    els.push(icon);
    const name = this.add
      .text(cx, cy - 38, card.name, {
        fontSize: '15px',
        color: '#44ff66',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(302);
    els.push(name);
    const label = this.add
      .text(cx, cy - 18, '🔄 자동공격', {
        fontSize: '11px',
        color: '#88ffaa',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(302);
    els.push(label);

    const desc = this.add
      .text(cx, cy + 10, card.desc, {
        fontSize: '11px',
        color: '#ccddcc',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: cw - 20 },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(302);
    els.push(desc);

    const hint = this.add
      .text(cx, cy + ch / 2 - 20, '기본 공격이 자동 발동!', {
        fontSize: '10px',
        color: '#66dd88',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(302);
    els.push(hint);

    const zone = this.add
      .zone(cx, cy, cw, ch)
      .setInteractive({ useHandCursor: true })
      .setDepth(303);
    const parts = [g, glow, icon, name, label, desc, hint];
    zone.on('pointerover', () =>
      this.tweens.add({ targets: [...parts, zone], scaleX: 1.05, scaleY: 1.05, duration: 100 }),
    );
    zone.on('pointerout', () =>
      this.tweens.add({ targets: [...parts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
    );
    zone.on('pointerdown', () => this.pickAutoAtkCard());
    els.push(zone);
  }

  private pickAutoAtkCard() {
    SoundManager.sfxCardSelect();
    this.autoAttackEnabled = true;
    this.showAutoAttackBadge();
    DamageText.show(this, 400, 200, '🔄 자동공격 활성화!', '#44ff66', '28px');
    this.cameras.main.flash(300, 68, 255, 102);
    this.emitParticles(SLOT_XS[0], SLOT_Y, [0x44ff66, 0x88ffaa, 0xffffff], 12);
    this.finishCardPick();
  }

  private renderSkillCards(picks: SkillDef[], els: Phaser.GameObjects.GameObject[]) {
    const cw = picks.length <= 3 ? 180 : 150;
    const gap = 20;
    const totalW = picks.length * cw + (picks.length - 1) * gap;
    const startX = 400 - totalW / 2 + cw / 2;

    picks.forEach((skill, i) => {
      const cx = startX + i * (cw + gap),
        cy = 280,
        ch = 240;
      const curLv = this.skillLevels[skill.id] ?? 0;
      const nextLv = curLv + 1;
      const nextMult = skillMult(skill.id, nextLv);
      const isNew = curLv === 0;

      const allParts = this.drawCardUI(
        cx,
        cy,
        cw,
        ch,
        {
          icon: skill.icon,
          name: skill.name,
          color: skill.color,
          desc: skill.descFn(nextMult),
          rarity: 'normal',
          rc: {
            border: skill.color,
            text: '#' + skill.color.toString(16).padStart(6, '0'),
            label: skill.category,
            bg: 0x111122,
          },
          isNew,
          isSkill: true,
          curLv,
          legendaryDesc: null,
          cdText: `CD: ${this.skillCdAt(skill.id, nextLv).toFixed(1)}s`,
          synergyName: null,
        },
        els,
        i,
        picks.length,
      );

      const zone = this.add
        .zone(cx, cy, cw, ch)
        .setInteractive({ useHandCursor: true })
        .setDepth(303);
      zone.on('pointerover', () =>
        this.tweens.add({
          targets: [...allParts, zone],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
        }),
      );
      zone.on('pointerout', () =>
        this.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
      );
      zone.on('pointerdown', () => this.pickSkillCard(skill.id));
      els.push(zone);
    });
  }

  private renderMixedCards(
    statPicks: CardDef[],
    statRarities: CardRarity[],
    skillPicks: SkillDef[],
    els: Phaser.GameObjects.GameObject[],
  ) {
    const all = statPicks.length + skillPicks.length;
    const cw = all <= 3 ? 180 : 150;
    const gap = 20;
    const totalW = all * cw + (all - 1) * gap;
    const startX = 400 - totalW / 2 + cw / 2;
    let idx = 0;

    statPicks.forEach((card, i) => {
      const cx = startX + idx * (cw + gap),
        cy = 280,
        ch = 240;
      const rarity = statRarities[i];
      const rc = RARITY_COLORS[rarity];
      const curLv = this.cardLevels[card.id] ?? 0;
      const perPick =
        rarity === 'legendary'
          ? card.legendValue
          : rarity === 'rare'
            ? card.rareValue
            : card.baseValue;
      const isNew = curLv === 0;

      const allParts = this.drawCardUI(
        cx,
        cy,
        cw,
        ch,
        {
          icon: card.icon,
          name: card.name,
          color: card.color,
          desc: card.descFn(perPick),
          rarity,
          rc,
          isNew,
          isSkill: false,
          curLv,
          legendaryDesc:
            rarity === 'legendary' && LEGENDARY_DESCS[card.id] ? LEGENDARY_DESCS[card.id] : null,
          cdText: null,
          synergyName: null,
        },
        els,
        idx,
        all,
      );

      const zone = this.add
        .zone(cx, cy, cw, ch)
        .setInteractive({ useHandCursor: true })
        .setDepth(303);
      zone.on('pointerover', () =>
        this.tweens.add({
          targets: [...allParts, zone],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
        }),
      );
      zone.on('pointerout', () =>
        this.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
      );
      zone.on('pointerdown', () => this.pickStatCard(card.id, rarity));
      els.push(zone);
      idx++;
    });

    skillPicks.forEach(skill => {
      const cx = startX + idx * (cw + gap),
        cy = 280,
        ch = 240;
      const curLv = this.skillLevels[skill.id] ?? 0;
      const nextLv = curLv + 1;
      const nextMult = skillMult(skill.id, nextLv);
      const isNew = curLv === 0;

      const allParts = this.drawCardUI(
        cx,
        cy,
        cw,
        ch,
        {
          icon: skill.icon,
          name: skill.name,
          color: skill.color,
          desc: skill.descFn(nextMult),
          rarity: 'normal',
          rc: {
            border: skill.color,
            text: '#' + skill.color.toString(16).padStart(6, '0'),
            label: skill.category,
            bg: 0x111122,
          },
          isNew,
          isSkill: true,
          curLv,
          legendaryDesc: null,
          cdText: `CD: ${this.skillCdAt(skill.id, nextLv).toFixed(1)}s`,
          synergyName: null,
        },
        els,
        idx,
        all,
      );

      const zone = this.add
        .zone(cx, cy, cw, ch)
        .setInteractive({ useHandCursor: true })
        .setDepth(303);
      zone.on('pointerover', () =>
        this.tweens.add({
          targets: [...allParts, zone],
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 100,
        }),
      );
      zone.on('pointerout', () =>
        this.tweens.add({ targets: [...allParts, zone], scaleX: 1, scaleY: 1, duration: 100 }),
      );
      zone.on('pointerdown', () => this.pickSkillCard(skill.id));
      els.push(zone);
      idx++;
    });
  }

  private drawCardUI(
    cx: number,
    cy: number,
    cw: number,
    ch: number,
    opts: {
      icon: string;
      name: string;
      color: number;
      desc: string;
      rarity: CardRarity;
      rc: { border: number; text: string; label: string; bg: number };
      isNew: boolean;
      isSkill: boolean;
      curLv: number;
      legendaryDesc: string | null;
      cdText: string | null;
      synergyName: string | null;
    },
    els: Phaser.GameObjects.GameObject[],
    i: number,
    total: number,
  ): Phaser.GameObjects.GameObject[] {
    const { rarity, rc } = opts;

    const g = this.add.graphics().setDepth(301);
    g.fillStyle(rc.bg, 0.95);
    g.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);
    const borderW = rarity === 'legendary' ? 4 : 3;
    g.lineStyle(borderW, rc.border, rarity === 'normal' ? 0.6 : 1);
    g.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 14);

    if (rarity === 'legendary') {
      const glow = this.add.graphics().setDepth(300).setAlpha(0.25);
      glow.fillStyle(0xffd700, 0.12);
      glow.fillRoundedRect(cx - cw / 2 - 4, cy - ch / 2 - 4, cw + 8, ch + 8, 16);
      this.tweens.add({ targets: glow, alpha: 0.08, duration: 600, yoyo: true, repeat: -1 });
      els.push(glow);
    }

    const topBar = this.add.graphics().setDepth(301);
    topBar.fillStyle(opts.color, 0.3);
    topBar.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, 50, { tl: 14, tr: 14, bl: 0, br: 0 });

    const rarityLabel = this.add
      .text(cx - cw / 2 + 8, cy - ch / 2 + 6, rc.label, {
        fontSize: '9px',
        color: rc.text,
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(303);

    const iconSize = total <= 3 ? '36px' : '28px';
    const nameSize = total <= 3 ? '16px' : '13px';
    const icon = this.add
      .text(cx, cy - 90, opts.icon, { fontSize: iconSize })
      .setOrigin(0.5)
      .setDepth(302);
    const name = this.add
      .text(cx, cy - 50, opts.name, {
        fontSize: nameSize,
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(302);

    if (opts.isSkill) {
      els.push(
        this.add
          .text(cx + cw / 2 - 8, cy - ch / 2 + 8, 'SKILL', {
            fontSize: '9px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            backgroundColor: '#ff4400',
            padding: { x: 3, y: 1 },
          })
          .setOrigin(1, 0)
          .setDepth(303),
      );
    }

    const desc = this.add
      .text(cx, cy - 5, opts.desc, {
        fontSize: '12px',
        color: '#aaddff',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
        wordWrap: { width: cw - 16 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(302);

    let legendaryDescT: Phaser.GameObjects.Text | null = null;
    if (opts.legendaryDesc) {
      legendaryDescT = this.add
        .text(cx, cy + 12, `★ ${opts.legendaryDesc}`, {
          fontSize: '9px',
          color: '#ffd700',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
          wordWrap: { width: cw - 16 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(302);
    }

    let cdLine: Phaser.GameObjects.Text | null = null;
    if (opts.cdText) {
      const cdY = legendaryDescT ? cy + 30 : cy + 14;
      cdLine = this.add
        .text(cx, cdY, opts.cdText, {
          fontSize: '11px',
          color: '#99bbdd',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(302);
    }

    const badgeY = cdLine ? cy + 46 : legendaryDescT ? cy + 40 : opts.isSkill ? cy + 35 : cy + 28;
    const bdg = this.add
      .text(
        cx,
        badgeY,
        opts.isNew ? (opts.isSkill ? '✦ 스킬 획득' : '✦ NEW') : `강화 Lv.${opts.curLv + 1}`,
        {
          fontSize: '13px',
          color: opts.isNew ? '#44ff44' : '#ffaa44',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        },
      )
      .setOrigin(0.5)
      .setDepth(302);

    const starsT = this.add
      .text(
        cx,
        badgeY + 18,
        opts.isNew ? '' : '★'.repeat(opts.curLv) + '☆'.repeat(4 - opts.curLv),
        {
          fontSize: '14px',
          color: '#ffcc00',
          fontFamily: 'Arial',
        },
      )
      .setOrigin(0.5)
      .setDepth(302);

    let synergyHint: Phaser.GameObjects.Text | null = null;
    if (opts.synergyName) {
      synergyHint = this.add
        .text(cx, cy + ch / 2 - 28, `🔗 ${opts.synergyName}`, {
          fontSize: '10px',
          color: '#44ffaa',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(303);
      this.tweens.add({ targets: synergyHint, alpha: 0.4, duration: 500, yoyo: true, repeat: -1 });
    }

    const hintT = this.add
      .text(cx, cy + ch / 2 - 14, '클릭하여 선택', {
        fontSize: '10px',
        color: '#555577',
        fontFamily: 'Arial',
      })
      .setOrigin(0.5)
      .setDepth(302);

    const allParts: Phaser.GameObjects.GameObject[] = [
      g,
      topBar,
      rarityLabel,
      icon,
      name,
      desc,
      bdg,
      starsT,
      hintT,
    ];
    if (cdLine) allParts.push(cdLine);
    if (legendaryDescT) allParts.push(legendaryDescT);
    if (synergyHint) allParts.push(synergyHint);
    els.push(...allParts);

    allParts.forEach(p => (p as any).setAlpha?.(0));
    const textEls: Phaser.GameObjects.Text[] = [icon, name, desc, bdg, starsT, hintT, rarityLabel];
    if (cdLine) textEls.push(cdLine);
    if (legendaryDescT) textEls.push(legendaryDescT);
    if (synergyHint) textEls.push(synergyHint);
    textEls.forEach(t => {
      t.y += 30;
    });
    this.tweens.add({ targets: allParts, alpha: 1, duration: 280, delay: 350 + i * 120 });
    this.tweens.add({
      targets: textEls,
      y: '-=30',
      duration: 350,
      delay: 350 + i * 120,
      ease: 'Back.easeOut',
    });

    if (rarity === 'legendary') {
      this.time.delayedCall(350 + i * 120, () => {
        this.emitParticles(cx, cy, [0xffd700, 0xffaa00, 0xffcc44], 8);
        this.cameras.main.flash(80, 255, 215, 0);
      });
    }
    return allParts;
  }

  private pickStatCard(id: string, rarity: CardRarity = 'normal') {
    SoundManager.sfxCardSelect();
    const card = STAT_CARDS.find(c => c.id === id)!;
    const oldMax = this.playerMaxHp;
    this.cardLevels[id] = (this.cardLevels[id] ?? 0) + 1;
    const newLv = this.cardLevels[id];

    const rarityExtra =
      rarity === 'legendary'
        ? card.legendValue - card.baseValue
        : rarity === 'rare'
          ? card.rareValue - card.baseValue
          : 0;
    if (rarityExtra > 0) {
      this.cardRarityBonus[id] = (this.cardRarityBonus[id] ?? 0) + rarityExtra;
    }

    if (rarity === 'legendary' && LEGENDARY_DESCS[id] && !this.legendaryEffects[id]) {
      this.legendaryEffects[id] = true;
      this.showLegendaryActivation(card);
    }

    const synIron = this.hasSynergy('iron_guard') ? 30 : 0;
    this.playerMaxHp = this.baseMaxHp + Math.floor(this.gcv('hp')) + synIron;
    if (this.playerMaxHp > oldMax) {
      this.playerHp = Math.min(this.playerHp + (this.playerMaxHp - oldMax), this.playerMaxHp);
    }
    const newMaxMp = INIT_MP + Math.floor(this.gcv('mp'));
    if (newMaxMp > this.playerMaxMp) {
      this.playerMp = Math.min(this.playerMp + (newMaxMp - this.playerMaxMp), newMaxMp);
    }
    this.playerMaxMp = newMaxMp;
    this.drawMpBar();
    this.finishCardPick();
  }

  private pickSkillCard(id: string) {
    SoundManager.sfxCardSelect();
    const curLv = this.skillLevels[id] ?? 0;
    if (curLv === 0) {
      this.skillLevels[id] = 1;
      this.equipSkill(id);
    } else {
      this.skillLevels[id] = Math.min(curLv + 1, 4);
    }
    this.finishCardPick();
  }

  private finishCardPick() {
    this.drawPlayerHpBar();
    this.updateUI();
    this.cameras.main.flash(200, 255, 255, 100);
    this.closeOverlay();
    this.checkSynergies();
    this.updateBuffBar();
    this.checkAchievements();
    this.autoSave();

    this.pendingLevelUps--;
    if (this.pendingLevelUps > 0) {
      this.time.delayedCall(500, () => this.showCardSelection());
    } else {
      this.cardSelecting = false;
      if (this.waitingFirstCard) {
        this.waitingFirstCard = false;
        this.startStage();
        return;
      }
      if (this.pendingStageClear) {
        this.pendingStageClear = false;
        const boss = this.pendingStageClearBoss;
        this.pendingStageClearBoss = false;
        this.time.delayedCall(200, () => this.onStageClear(boss));
      } else if (this.restCardPending) {
        this.restCardPending = false;
        this.advanceToNextStage();
      }
    }
  }

  /* ================================================================
     OVERLAY MANAGEMENT
     ================================================================ */

  private closeOverlay() {
    this.overlayElements.forEach(e => e.destroy());
    this.overlayElements = [];
    const wasDoor = this.shopFromDoor;
    this.shopOpen = false;
    this.relicOpen = false;
    this.shopFromDoor = false;
    if (wasDoor) {
      this.time.delayedCall(100, () => this.advanceToNextStage());
    }
  }

  private getWaveCount(): number {
    if (this.currentBossType !== 'none') return 1;
    const ls = this.localStage;
    if (ls <= 3) return 3;
    if (ls <= 7) return 4;
    if (ls <= 9) return 5;
    if (ls <= 15) return 4 + (Math.random() < 0.5 ? 1 : 0);
    return 5 + (Math.random() < 0.5 ? 1 : 0);
  }

  private startStage() {
    if (!this.soulRecovered) this.checkSoulRecovery();
    const ls = this.localStage;
    if (ls === 10 || ls === 20) {
      this.stageType = 'boss';
    }

    switch (this.stageType) {
      case 'combat':
      case 'elite':
      case 'boss':
        this.isEliteStage = this.stageType === 'elite';
        this.waveTotal = this.stageType === 'boss' ? 1 : this.getWaveCount();
        this.waveCurrent = 0;
        this.spawnNextWave();
        break;
      case 'shop':
        this.openShopFromDoor();
        break;
      case 'rest':
        this.showRestScreen();
        break;
      case 'event':
        this.showEventScreen();
        break;
    }
  }

  private spawnNextWave() {
    this.waveClearing = false;
    this.waveCurrent++;
    this.updateUI();
    this.spawnMonster();

    if (this.pendingLevelUps > 0 && this.cardSelecting) {
      this.time.delayedCall(500, () => this.showCardSelection(true));
    }
  }

  private showBasicAtkTutorial(show: boolean, onDone?: () => void) {
    if (!show) {
      onDone?.();
      return;
    }
    const bg = this.add.graphics().setDepth(400);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(150, 230, 500, 50, 10);
    bg.lineStyle(1, 0x66ccff, 0.6);
    bg.strokeRoundedRect(150, 230, 500, 50, 10);
    const txt = this.add
      .text(
        400,
        245,
        '[Q]키 또는 스킬 슬롯 클릭으로 기본 공격!\n레벨업 후 자동공격 카드를 획득하면 자동으로 공격합니다.',
        {
          fontSize: '11px',
          color: '#88ccff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
          align: 'center',
        },
      )
      .setOrigin(0.5, 0)
      .setDepth(401);
    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: [bg, txt],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          bg.destroy();
          txt.destroy();
          onDone?.();
        },
      });
    });
  }

  private showParryTutorial() {
    const bg = this.add.graphics().setDepth(400);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(150, 360, 500, 60, 10);
    bg.lineStyle(1, 0xffcc44, 0.6);
    bg.strokeRoundedRect(150, 360, 500, 60, 10);
    const txt = this.add
      .text(400, 380, '몬스터의 원형 게이지가 초록색이 될 때\nSPACE / 우클릭으로 패링!', {
        fontSize: '13px',
        color: '#ffdd88',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setDepth(401);
    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: [bg, txt],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          bg.destroy();
          txt.destroy();
        },
      });
    });
  }

  private onStageClear(wasBossForMemory: boolean) {
    if (wasBossForMemory && this.relicLevels.memory > 0) {
      const heal = this.relicLevels.memory * 20;
      this.playerHp = Math.min(this.playerHp + heal, this.playerMaxHp);
      this.drawPlayerHpBar();
      DamageText.show(this, 400, 160, `+${heal} HP (전투의 기억)`, '#ff88cc', '18px');
    }

    this.nextCombatCursed = false;
    this.tempEventAtkBuff = 0;

    this.advanceToNextStage();
  }

  private advanceToNextStage() {
    this.stage++;
    this.highestStageCleared = Math.max(this.highestStageCleared, this.stage - 1);
    this.pendingStageClear = false;
    this.pendingStageClearBoss = false;
    this.checkAchievements();
    this.autoSave();
    this.checkSoulRecovery();
    const ls = this.localStage;

    if (ls > 20) return;

    if (this.legendaryEffects.hp && this.playerHp < this.playerMaxHp) {
      this.playerHp = Math.min(this.playerHp + 5, this.playerMaxHp);
      this.drawPlayerHpBar();
      DamageText.show(this, 400, 180, '+5 HP', '#88ff88', '14px');
    }

    if (ls === 10 || ls === 20) {
      this.stageType = 'boss';
      this.startStage();
    } else if (ls % 3 === 0 || ls === 9 || ls === 19) {
      this.showDoorSelection();
    } else {
      this.stageType = 'combat';
      this.startStage();
    }
  }

  private showDoorSelection() {
    this.doorSelecting = true;
    const els = this.overlayElements;

    const bg = this.add.graphics().setDepth(280).setAlpha(0);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.tweens.add({ targets: bg, alpha: 1, duration: 300 });

    els.push(
      this.add
        .text(400, 80, '경로를 선택하세요', {
          fontSize: '32px',
          color: '#ddbb66',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(281),
    );

    els.push(
      this.add
        .text(
          400,
          115,
          `${this.regionDef.icon} ${this.regionDef.name} - Stage ${this.localStage}/20`,
          {
            fontSize: '14px',
            color: '#888899',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 2,
          },
        )
        .setOrigin(0.5)
        .setDepth(281),
    );

    const doors = this.generateDoors();
    const doorW = 200,
      doorH = 240,
      gap = 30;
    const totalW = doors.length * doorW + (doors.length - 1) * gap;
    const startX = 400 - totalW / 2 + doorW / 2;

    doors.forEach((door, i) => {
      const dx = startX + i * (doorW + gap),
        dy = 275;

      const card = this.add.graphics().setDepth(281);
      const drawCard = (hover: boolean) => {
        card.clear();
        card.fillStyle(hover ? 0x1a1a44 : 0x0e0e28, 0.95);
        card.fillRoundedRect(dx - doorW / 2, dy - doorH / 2, doorW, doorH, 14);
        card.lineStyle(hover ? 3 : 2, door.color, hover ? 1 : 0.6);
        card.strokeRoundedRect(dx - doorW / 2, dy - doorH / 2, doorW, doorH, 14);
        const tg = hover ? 0.5 : 0.3;
        card.fillStyle(door.color, tg);
        card.fillRoundedRect(dx - doorW / 2, dy - doorH / 2, doorW, 60, {
          tl: 14,
          tr: 14,
          bl: 0,
          br: 0,
        });
      };
      drawCard(false);
      els.push(card);

      els.push(
        this.add
          .text(dx, dy - 90, door.icon, { fontSize: '48px' })
          .setOrigin(0.5)
          .setDepth(282),
      );
      els.push(
        this.add
          .text(dx, dy - 30, door.name, {
            fontSize: '22px',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(282),
      );
      els.push(
        this.add
          .text(dx, dy + 10, door.desc, {
            fontSize: '12px',
            color: '#aabbcc',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 2,
            wordWrap: { width: doorW - 20 },
            align: 'center',
          })
          .setOrigin(0.5)
          .setDepth(282),
      );

      if (door.type === 'elite') {
        els.push(
          this.add
            .text(dx, dy + 50, '⚠ 위험!', {
              fontSize: '14px',
              color: '#ff6644',
              fontFamily: 'Arial',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 2,
            })
            .setOrigin(0.5)
            .setDepth(282),
        );
      } else if (door.type === 'rest') {
        els.push(
          this.add
            .text(dx, dy + 50, '♥ 안전', {
              fontSize: '14px',
              color: '#44ff88',
              fontFamily: 'Arial',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 2,
            })
            .setOrigin(0.5)
            .setDepth(282),
        );
      }

      els.push(
        this.add
          .text(dx, dy + doorH / 2 - 30, '클릭하여 선택', {
            fontSize: '11px',
            color: '#555577',
            fontFamily: 'Arial',
          })
          .setOrigin(0.5)
          .setDepth(282),
      );

      const z = this.add
        .zone(dx, dy, doorW, doorH)
        .setInteractive({ useHandCursor: true })
        .setDepth(283);
      z.on('pointerover', () => drawCard(true));
      z.on('pointerout', () => drawCard(false));
      z.on('pointerdown', () => this.selectDoor(door.type));
      els.push(z);
    });
  }

  private generateDoors(): DoorDef[] {
    const ls = this.localStage;
    const preBoss = ls === 9 || ls === 19;

    const combatDoors = DOOR_DEFS.filter(d => d.type === 'combat' || d.type === 'elite');
    const picks: DoorDef[] = [];
    picks.push(Phaser.Math.RND.pick(combatDoors));

    const remaining = DOOR_DEFS.filter(d => d.type !== picks[0].type);
    picks.push(Phaser.Math.RND.pick(remaining));

    const remaining2 = DOOR_DEFS.filter(d => !picks.find(p => p.type === d.type));
    if (remaining2.length > 0) {
      picks.push(Phaser.Math.RND.pick(remaining2));
    }

    if (preBoss && !picks.find(d => d.type === 'rest')) {
      const restDoor = DOOR_DEFS.find(d => d.type === 'rest')!;
      picks[picks.length - 1] = restDoor;
    }

    return Phaser.Utils.Array.Shuffle(picks);
  }

  private selectDoor(type: string) {
    this.doorSelecting = false;
    this.pendingLevelUps = 0;
    this.pendingStageClear = false;
    this.pendingStageClearBoss = false;
    this.cardSelecting = false;
    this.closeOverlay();
    this.stageType = type as 'combat' | 'elite' | 'boss' | 'shop' | 'rest' | 'event';
    this.autoSave();
    this.startStage();
  }

  private openShopFromDoor() {
    this.shopFromDoor = true;
    this.openShop();
  }

  private showRestScreen() {
    this.restCardPending = true;
    const els = this.overlayElements;
    const bg = this.add.graphics().setDepth(280).setAlpha(0);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.tweens.add({ targets: bg, alpha: 1, duration: 300 });

    els.push(
      this.add
        .text(400, 150, '🔥 휴식', {
          fontSize: '36px',
          color: '#ffaa44',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 5,
        })
        .setOrigin(0.5)
        .setDepth(281),
    );

    const heal = Math.ceil(this.playerMaxHp * 0.3);
    this.playerHp = Math.min(this.playerHp + heal, this.playerMaxHp);
    this.drawPlayerHpBar();

    els.push(
      this.add
        .text(400, 210, `HP ${heal} 회복!`, {
          fontSize: '22px',
          color: '#44ff88',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(281),
    );

    els.push(
      this.add
        .text(400, 260, '카드를 강화하세요', {
          fontSize: '16px',
          color: '#aabbcc',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(281),
    );

    const btnG = this.add.graphics().setDepth(281);
    const bx = 400,
      by = 500,
      bw = 200,
      bh = 48;
    const drawBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? 0x446644 : 0x334433, 1);
      btnG.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 12);
      btnG.lineStyle(2, hover ? 0x66cc88 : 0x44aa66, 1);
      btnG.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 12);
    };
    drawBtn(false);
    els.push(btnG);
    els.push(
      this.add
        .text(bx, by, '계속하기', {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(282),
    );
    const z = this.add.zone(bx, by, bw, bh).setInteractive({ useHandCursor: true }).setDepth(283);
    z.on('pointerover', () => drawBtn(true));
    z.on('pointerout', () => drawBtn(false));
    z.on('pointerdown', () => {
      this.closeOverlay();
      this.pendingLevelUps++;
      this.cardSelecting = true;
      this.showCardSelection();
    });
    els.push(z);
  }

  private showEventScreen() {
    const evt = Phaser.Math.RND.pick(EVENTS);
    const els = this.overlayElements;

    const bg = this.add.graphics().setDepth(280).setAlpha(0);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.tweens.add({ targets: bg, alpha: 1, duration: 300 });

    els.push(this.add.text(400, 130, evt.icon, { fontSize: '60px' }).setOrigin(0.5).setDepth(281));
    els.push(
      this.add
        .text(400, 190, evt.name, {
          fontSize: '28px',
          color: '#ddbb66',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(281),
    );
    els.push(
      this.add
        .text(400, 230, evt.desc, {
          fontSize: '16px',
          color: '#aabbcc',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(281),
    );

    this.applyEvent(evt);

    els.push(
      this.add
        .text(400, 300, evt.effect, {
          fontSize: '20px',
          color: '#ff8844',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(281),
    );

    const btnG = this.add.graphics().setDepth(281);
    const bx = 400,
      by = 420,
      bw = 200,
      bh = 48;
    const drawBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? 0x444466 : 0x333344, 1);
      btnG.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 12);
      btnG.lineStyle(2, hover ? 0x8888aa : 0x666688, 1);
      btnG.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 12);
    };
    drawBtn(false);
    els.push(btnG);
    els.push(
      this.add
        .text(bx, by, '계속하기', {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(282),
    );
    const z = this.add.zone(bx, by, bw, bh).setInteractive({ useHandCursor: true }).setDepth(283);
    z.on('pointerover', () => drawBtn(true));
    z.on('pointerout', () => drawBtn(false));
    z.on('pointerdown', () => {
      this.closeOverlay();
      this.advanceToNextStage();
    });
    els.push(z);
  }

  private applyEvent(evt: EventDef) {
    switch (evt.id) {
      case 'spring':
        this.playerHp = this.playerMaxHp;
        this.playerMaxHp = Math.max(50, this.playerMaxHp - 20);
        this.playerHp = Math.min(this.playerHp, this.playerMaxHp);
        this.drawPlayerHpBar();
        break;
      case 'devil':
        this.attackPower += 5;
        this.gold = Math.floor(this.gold * 0.5);
        break;
      case 'relic_find':
        this.awardRelicPoints(2);
        break;
      case 'curse':
        this.nextCombatCursed = true;
        break;
      case 'bless':
        this.tempEventAtkBuff = 10;
        break;
    }
    this.updateUI();
  }

  /* ================================================================
     MONSTER SPAWN + BOSS SYSTEM
     ================================================================ */

  private spawnMonster() {
    const ls = this.localStage;
    if (ls === 10 || ls === 20) {
      this.showBossWarning(ls === 20, () => this.doSpawnMonster());
    } else {
      this.doSpawnMonster();
    }
  }

  private getSubCount(): number {
    const base = 1 + Math.floor((this.waveCurrent - 1) / 2);
    const stageBonus = Math.floor((this.localStage - 1) / 7);
    return Math.min(SUB_MON_POSITIONS.length, base + stageBonus);
  }

  private doSpawnMonster() {
    const ls = this.localStage;
    const isMiniBoss = ls === 10;
    const isRegionBoss = ls === 20;
    const isBoss = isMiniBoss || isRegionBoss;

    this.monsters = [];
    this.targetMonster = null;

    const r = this.regionDef;
    let baseHp = Math.floor(MON_BASE_HP * Math.pow(MON_HP_GROWTH, this.stage - 1) * r.hpMult);
    let goldDrop = Math.floor(this.stage * 4 * this.goldDropMultiplier * r.goldMult);

    if (this.isEliteStage && !isBoss) {
      baseHp = Math.floor(baseHp * 2);
      goldDrop = Math.floor(goldDrop * 2);
    }

    if (isBoss) {
      this.currentBossType = isRegionBoss ? 'final' : 'mini';
      this.showBossBackground(isRegionBoss);

      const bossType = isRegionBoss ? r.bossType : r.miniBossType;
      const bossName = isRegionBoss ? r.bossName : r.miniBossName;
      const nameColor = isRegionBoss ? '#ffd700' : '#ff8844';
      const hpMult = isRegionBoss ? 6 : 4;
      const goldMult = isRegionBoss ? 10 : 5;
      const bossSize = isRegionBoss ? 90 : 80;

      const boss = new Monster(this, MAIN_MON_POS.x, MAIN_MON_POS.y, {
        name: bossName,
        hp: baseHp * hpMult,
        gold: goldDrop * goldMult,
        type: bossType,
        size: Math.floor(bossSize * 1.5),
        level: this.stage,
        nameColor,
      });
      this.monsters.push(boss);

      this.bossRageLevel = 0;
      this.bossRageTimer = this.time.addEvent({
        delay: isRegionBoss ? 15000 : 20000,
        loop: true,
        callback: () => this.advanceBossRage(isRegionBoss),
      });
      this.startBossPatterns();
    } else {
      this.currentBossType = 'none';
      this.hideBossBackground();
      const pool = r.monsters;
      const data = pool[(ls - 1) % pool.length];

      const specialType = this.rollSpecialType();
      const goldMod = specialType === 'shield' ? 1.5 : specialType === 'split' ? 1.5 : 1;

      const main = new Monster(this, MAIN_MON_POS.x, MAIN_MON_POS.y, {
        name: data.name,
        hp: baseHp,
        gold: Math.floor(goldDrop * goldMod),
        type: data.type,
        size: data.size,
        level: this.stage,
        specialType,
      });
      this.monsters.push(main);

      if (specialType !== 'none') {
        this.showSpecialMonsterTooltip(specialType);
      }
      if (specialType === 'charge') {
        this.startChargeTimer(main);
      }

      const subCount = this.getSubCount();
      const subData = pool[0];
      for (let i = 0; i < subCount; i++) {
        const pos = SUB_MON_POSITIONS[i];
        const sub = new Monster(this, pos.x, pos.y, {
          name: subData.name,
          hp: Math.floor(baseHp * 0.3),
          gold: Math.floor(goldDrop * 0.2),
          type: subData.type,
          size: Math.floor(subData.size * 0.65),
          level: this.stage,
          isSub: true,
        });
        this.monsters.push(sub);
      }
    }

    this.setTarget(this.monsters[0]);
    this.monsters.forEach(m => {
      m.on('pointerdown', () => {
        if (this.gameOver || this.cardSelecting || this.doorSelecting || m.isDead) return;
        this.setTarget(m);
      });
    });

    this.setupMonsterAttackTimer();
    this.attackAccum = 0;
    this.updateUI();
  }

  private setTarget(monster: Monster) {
    if (this.targetMonster === monster) return;
    if (this.targetMonster && !this.targetMonster.isDead) {
      this.targetMonster.setTargeted(false);
    }
    this.targetMonster = monster;
    this.targetMonster.setTargeted(true);
  }

  private cycleTarget() {
    if (this.gameOver || this.cardSelecting || this.doorSelecting) return;
    const alive = this.monsters.filter(m => !m.isDead);
    if (alive.length <= 1) return;
    const curIdx = alive.indexOf(this.targetMonster!);
    const next = alive[(curIdx + 1) % alive.length];
    this.setTarget(next);
    DamageText.show(this, next.x, next.y - 60, '▶ TARGET', '#44ddff', '14px');
  }

  private retargetNextAlive() {
    if (this.targetMonster) this.targetMonster.setTargeted(false);
    const alive = this.monsters.filter(m => !m.isDead);
    if (alive.length > 0) {
      const mainAlive = alive.find(m => !m.isSub);
      this.targetMonster = mainAlive ?? alive[0];
      this.targetMonster.setTargeted(true);
    } else {
      this.targetMonster = null;
    }
  }

  private setupMonsterAttackTimer() {
    this.monsterAttackTimer?.remove();
    const aliveCount = this.monsters.filter(m => !m.isDead).length;
    if (aliveCount === 0) return;
    let interval: number;
    if (this.currentBossType !== 'none') {
      interval = this.currentBossType === 'final' ? MON_ATK_INTERVAL_FINAL : MON_ATK_INTERVAL_MINI;
    } else {
      interval = Math.max(1500, MON_ATK_INTERVAL_NORMAL - (aliveCount - 1) * 350);
    }
    this.monsterAttackTimer = this.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => this.startMonsterAttackSequence(),
    });
  }

  /* ---- special monster types ---- */

  private rollSpecialType(): SpecialType {
    const ls = this.localStage;
    const bonus = ls >= 11 ? 0.1 : 0;
    const pool: { type: SpecialType; chance: number }[] = [];
    if (ls >= 5) pool.push({ type: 'shield', chance: 0.3 + bonus });
    if (ls >= 6) pool.push({ type: 'charge', chance: 0.25 + bonus });
    if (ls >= 8) pool.push({ type: 'split', chance: 0.2 + bonus });
    if (pool.length === 0) return 'none';
    for (const entry of pool) {
      if (Math.random() < entry.chance) return entry.type;
    }
    return 'none';
  }

  private showSpecialMonsterTooltip(type: SpecialType) {
    const labels: Record<SpecialType, string> = {
      none: '',
      shield: '🛡️ 실드 몬스터 - 실드 파괴 후 본체 공격!',
      split: '💥 분열 몬스터 - 처치 시 2마리로 분열!',
      charge: '⚡ 돌진 몬스터 - 돌진 시 3배 데미지!',
    };
    const text = labels[type];
    if (!text) return;
    const tip = this.add
      .text(400, 140, text, {
        fontSize: '14px',
        color: '#ffdd88',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setAlpha(0);
    this.tweens.add({
      targets: tip,
      alpha: 1,
      duration: 300,
      hold: 2000,
      yoyo: true,
      onComplete: () => tip.destroy(),
    });
  }

  private startChargeTimer(monster: Monster) {
    const timer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => {
        if (this.gameOver || monster.isDead) {
          timer.remove();
          return;
        }
        monster.charging = true;
        DamageText.show(this, monster.x, monster.y - 60, '⚡ 돌진 준비!', '#ff4444', '20px');
        this.time.delayedCall(1500, () => {
          if (this.gameOver || monster.isDead) return;
          monster.charging = false;
          if (this.shieldDmgReduce >= 0.5) {
            DamageText.show(this, 400, 180, '방어 성공!', '#88ccff', '20px');
            return;
          }
          const baseAtk = Math.floor(
            MON_BASE_ATK * Math.pow(MON_ATK_GROWTH, this.stage - 1) * this.regionDef.atkMult,
          );
          const chargeDmg = Math.floor(baseAtk * 3 * (1 - this.defenseRate));
          if (this.invincible) return;
          this.playerHp = Math.max(0, this.playerHp - chargeDmg);
          this.drawPlayerHpBar();
          DamageText.show(this, 400, 180, `⚡돌진! -${chargeDmg}`, '#ff2222', '28px');
          this.cameras.main.shake(300, 0.025);
          this.cameras.main.flash(200, 255, 50, 50);
          if (this.playerHp <= 0) this.showGameOver();
        });
      },
    });
    this.chargeTimers.push(timer);
  }

  private handleSplitMonster(original: Monster) {
    if (!original.canSplit) return;
    DamageText.show(this, original.x, original.y - 50, '💥 분열!', '#ffaa44', '24px');
    this.emitParticles(original.x, original.y, [0xffaa00, 0xff6600, 0xffffff], 8);

    const baseHp = Math.floor(
      MON_BASE_HP * Math.pow(MON_HP_GROWTH, this.stage - 1) * this.regionDef.hpMult * 0.5,
    );
    const baseGold = Math.floor(
      this.stage * 4 * this.goldDropMultiplier * this.regionDef.goldMult * 0.3,
    );

    for (let i = 0; i < 2; i++) {
      const pos = SUB_MON_POSITIONS[i] ?? {
        x: original.x + (i === 0 ? -80 : 80),
        y: original.y + 50,
      };
      const baby = new Monster(this, pos.x, pos.y, {
        name: original.monsterName,
        hp: baseHp,
        gold: baseGold,
        type: original.monsterType,
        size: Math.floor(original.isSub ? 30 : 40),
        level: original.monsterLevel,
        isSub: true,
        specialType: 'none',
        canSplit: false,
      });
      this.monsters.push(baby);
      baby.on('pointerdown', () => {
        if (this.gameOver || this.cardSelecting || this.doorSelecting || baby.isDead) return;
        this.setTarget(baby);
      });
    }
    this.setupMonsterAttackTimer();
    if (!this.targetMonster || this.targetMonster.isDead) {
      this.retargetNextAlive();
    }
  }

  private showBossWarning(isFinal: boolean, onComplete: () => void) {
    SoundManager.sfxBossWarning();
    SoundManager.playBossBgm();
    const r = this.regionDef;

    const blackout = this.add.graphics().setDepth(200).setAlpha(0);
    blackout.fillStyle(0x000000, 1);
    blackout.fillRect(0, 0, 800, 600);
    this.tweens.add({ targets: blackout, alpha: 1, duration: 200 });

    this.time.delayedCall(500, () => {
      const warningBg = this.add.graphics().setDepth(200);
      warningBg.fillStyle(isFinal ? 0x220000 : 0x221100, 0.85);
      warningBg.fillRect(0, 0, 800, 600);
      blackout.destroy();

      const warnText = this.add
        .text(400, 240, '⚠ WARNING ⚠', {
          fontSize: '56px',
          color: '#ff3333',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setDepth(201)
        .setAlpha(0)
        .setScale(1.5);
      this.tweens.add({
        targets: warnText,
        alpha: 1,
        scale: 1,
        duration: 250,
        ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: warnText,
        alpha: 0.2,
        duration: 200,
        yoyo: true,
        repeat: 4,
        delay: 300,
      });

      const bossLabel = isFinal ? `${r.bossName} 등장!` : `${r.miniBossName} 등장!`;
      const nameText = this.add
        .text(400, 320, bossLabel, {
          fontSize: '36px',
          color: isFinal ? '#ffd700' : '#ff8844',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(201)
        .setAlpha(0)
        .setScale(0.5);
      this.tweens.add({
        targets: nameText,
        alpha: 1,
        scale: 1,
        duration: 400,
        delay: 400,
        ease: 'Back.easeOut',
      });

      this.cameras.main.shake(1000, 0.015);

      const edgeFlash = this.add.graphics().setDepth(199);
      const ec = isFinal ? 0xff0000 : 0xff8800;
      edgeFlash.lineStyle(8, ec, 0.8);
      edgeFlash.strokeRect(0, 0, 800, 600);
      edgeFlash.lineStyle(3, ec, 0.4);
      edgeFlash.strokeRect(6, 6, 788, 588);
      this.tweens.add({ targets: edgeFlash, alpha: 0, duration: 250, yoyo: true, repeat: 4 });

      this.time.delayedCall(2000, () => {
        this.tweens.add({
          targets: [warningBg, warnText, nameText, edgeFlash],
          alpha: 0,
          duration: 300,
          onComplete: () => {
            warningBg.destroy();
            warnText.destroy();
            nameText.destroy();
            edgeFlash.destroy();
            const region = this.currentRegion;
            const narr = isFinal
              ? NARRATION.finalBossEnter[region]
              : NARRATION.miniBossEnter[region];
            if (narr) {
              this.showNarration(narr, () => onComplete());
            } else {
              onComplete();
            }
          },
        });
      });
    });
  }

  /* ================================================================
     BOSS RAGE & SPECIAL ATTACKS
     ================================================================ */

  private advanceBossRage(isFinal: boolean) {
    const maxRage = isFinal ? 5 : 4;
    if (this.bossRageLevel >= maxRage) return;
    this.bossRageLevel++;
    const rageColors = ['#ffaa00', '#ff8800', '#ff5500', '#ff2200', '#ff0000'];
    DamageText.show(
      this,
      400,
      160,
      `분노 ${this.bossRageLevel}단계!`,
      rageColors[this.bossRageLevel - 1],
      '28px',
    );
    this.cameras.main.shake(200, 0.01 * this.bossRageLevel);
  }

  private get bossRageMult(): number {
    return 1 + this.bossRageLevel * 0.15;
  }

  private startBossPatterns() {
    this.bossPatternTimer?.remove();
    this.bossPatternTimer = undefined;
    const isFinal = this.currentBossType === 'final';
    const baseCd = isFinal ? 6000 : 8000;
    this.scheduleBossPattern(baseCd);
  }

  private scheduleBossPattern(delay: number) {
    this.bossPatternTimer = this.time.delayedCall(delay, () => {
      this.executeBossPattern();
    });
  }

  private executeBossPattern() {
    const boss = this.monsters.find(m => !m.isDead && !m.isSub);
    if (this.gameOver || this.cardSelecting || this.doorSelecting || !boss) {
      this.scheduleBossPattern(3000);
      return;
    }
    const isFinal = this.currentBossType === 'final';
    const hpPct = boss.hpRatio;
    const cdReduction = isFinal && hpPct <= 0.2 ? 0.5 : 1;

    if (this.currentBossType === 'mini') {
      if (hpPct <= 0.3) {
        this.bossPatternFuryRush(boss);
      } else {
        const roll = Math.random();
        if (roll < 0.5) this.bossPatternSmash(boss);
        else this.bossPatternDefense(boss);
      }
    } else {
      if (hpPct <= 0.2 && Math.random() < 0.3) {
        DamageText.show(this, boss.x, boss.y - 70, '💥 분노 폭발! 패턴 가속!', '#ff0000', '20px');
        this.cameras.main.shake(300, 0.02);
      }
      const roll = Math.random();
      if (roll < 0.3) this.bossPatternAnnihilate(boss);
      else if (roll < 0.55) this.bossPatternSummon(boss);
      else if (roll < 0.8) this.bossPatternCurse(boss);
      else this.bossPatternSmash(boss);
    }

    const baseCd = isFinal ? 6000 : 8000;
    this.scheduleBossPattern(Math.floor(baseCd * cdReduction));
  }

  private showPatternWarning(
    boss: Phaser.GameObjects.Container,
    text: string,
    color: string,
    warnTime: number,
    onExecute: () => void,
    responseHint?: string,
  ) {
    this.bossPatternWarning?.destroy();
    const hint = responseHint ?? '방어 가능!';
    const warnText = `${text}\n${hint}`;
    const warn = this.add
      .text(boss.x, boss.y - 88, warnText, {
        fontSize: '18px',
        color,
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(200);
    this.bossPatternWarning = warn;
    this.tweens.add({
      targets: warn,
      alpha: 0.3,
      duration: 300,
      yoyo: true,
      repeat: Math.floor(warnTime / 600),
    });
    this.highlightDefenseSkills(true);
    this.bossAttackIncoming = true;
    this.highlightResponseBtns(true);
    this.time.delayedCall(warnTime, () => {
      warn.destroy();
      this.bossPatternWarning = undefined;
      this.highlightDefenseSkills(false);
      this.bossAttackIncoming = false;
      this.highlightResponseBtns(false);
      onExecute();
    });
  }

  private highlightResponseBtns(on: boolean) {
    if (this.emergencyDefBtn) {
      if (on && this.emergencyDefCd <= 0) {
        this.tweens.add({
          targets: this.emergencyDefBtn,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 250,
          yoyo: true,
          repeat: -1,
          key: 'edef_pulse',
        });
      } else {
        this.tweens.killTweensOf(this.emergencyDefBtn);
        this.emergencyDefBtn.setScale(1);
      }
    }
    if (on && this.parryHintText) {
      this.parryHintText.setColor('#ffdd44');
    } else if (this.parryHintText) {
      this.parryHintText.setColor('#887744');
    }
  }

  private highlightDefenseSkills(on: boolean) {
    this.skillButtons.forEach(btn => {
      if (!btn) return;
      const def = ALL_SKILL_DEFS[btn.skillId];
      if (
        def &&
        (def.effectType === 'buff_self' ||
          def.effectType === 'stealth' ||
          def.id === 'w_shield_up' ||
          def.id === 'r_stealth' ||
          def.id === 'r_smoke')
      ) {
        btn.setHighlight(on);
      }
    });
  }

  private bossPatternSmash(boss: Phaser.GameObjects.Container) {
    this.showPatternWarning(
      boss,
      '⚔ 강타 준비!',
      '#ffaa00',
      2000,
      () => {
        if (this.gameOver) return;
        (boss as Monster).playAttackAnimation();
        const rawDmg = Math.max(
          1,
          Math.floor(this.monsterAttackPower * 3 * this.bossRageMult * (1 - this.defenseRate)),
        );
        if (this.tryParryBossPattern(rawDmg)) return;
        if (this.invincible || this.stealthActive) {
          if (this.stealthActive) this.tryRogueDodge();
          DamageText.show(this, 400, 180, 'IMMUNE', '#66eeff', '24px');
          return;
        }
        const barrier = this.tryMageBarrier(rawDmg);
        if (barrier.absorbed) return;
        this.playerHp = Math.max(0, this.playerHp - rawDmg);
        this.bossHitThisRun = true;
        this.tryWarriorBlock(rawDmg);
        this.drawPlayerHpBar();
        this.playBossStrongHitEffect(rawDmg);
        if (this.playerHp <= 0) this.showGameOver();
      },
      '⚔ 방어/패링 가능!',
    );
  }

  private bossPatternDefense(boss: Phaser.GameObjects.Container) {
    this.showPatternWarning(boss, '🛡 방어 태세!', '#4488ff', 1500, () => {
      if (this.gameOver) return;
      this.bossDefenseReduction = -0.8;
      DamageText.show(this, boss.x, boss.y - 50, '방어! 데미지 -80%', '#4488ff', '18px');
      this.bossDefenseTimer?.remove();
      this.bossDefenseTimer = this.time.delayedCall(3000, () => {
        this.bossDefenseReduction = 0;
        this.bossDefenseTimer = undefined;
      });
    });
  }

  private bossPatternFuryRush(boss: Phaser.GameObjects.Container) {
    DamageText.show(this, boss.x, boss.y - 80, '💢 분노 돌진!', '#ff2200', '22px');
    this.bossAttackIncoming = true;
    this.highlightResponseBtns(true);
    this.cameras.main.shake(200, 0.015);
    let hits = 0;
    const hitTimer = this.time.addEvent({
      delay: 500,
      repeat: 2,
      callback: () => {
        if (this.gameOver) {
          hitTimer.remove();
          return;
        }
        const dmg = Math.max(
          1,
          Math.floor(this.monsterAttackPower * 1.5 * this.bossRageMult * (1 - this.defenseRate)),
        );
        if (this.tryParryBossPattern(dmg)) {
          hitTimer.remove();
          return;
        }
        if (this.invincible || this.stealthActive) {
          DamageText.show(this, 400, 180, 'IMMUNE', '#66eeff', '20px');
          return;
        }
        const barrier = this.tryMageBarrier(dmg);
        if (barrier.absorbed) return;
        this.playerHp = Math.max(0, this.playerHp - dmg);
        this.bossHitThisRun = true;
        this.drawPlayerHpBar();
        DamageText.show(
          this,
          400 + Phaser.Math.Between(-30, 30),
          180,
          `-${dmg}`,
          '#ff4400',
          '24px',
        );
        this.cameras.main.shake(150, 0.01);
        this.flashScreenEdges();
        SoundManager.sfxBossHit();
        hits++;
        if (this.playerHp <= 0) {
          hitTimer.remove();
          this.showGameOver();
        }
      },
    });
    this.time.delayedCall(2000, () => {
      this.bossAttackIncoming = false;
      this.highlightResponseBtns(false);
    });
  }

  private bossPatternAnnihilate(boss: Phaser.GameObjects.Container) {
    this.showPatternWarning(
      boss,
      '💀 절멸...',
      '#ff0000',
      3000,
      () => {
        if (this.gameOver) return;
        const dmg = Math.max(1, Math.floor(this.playerMaxHp * 0.6));
        if (this.tryParryBossPattern(dmg)) return;
        if (this.invincible || this.stealthActive) {
          if (this.stealthActive) this.tryRogueDodge();
          DamageText.show(this, 400, 180, 'IMMUNE', '#66eeff', '24px');
          return;
        }
        const barrier = this.tryMageBarrier(dmg);
        if (barrier.absorbed) return;
        this.playerHp = Math.max(0, this.playerHp - dmg);
        this.bossHitThisRun = true;
        this.drawPlayerHpBar();
        this.playBossStrongHitEffect(dmg);
        this.emitParticles(400, 280, [0xff0000, 0xff4400], 14);
        if (this.playerHp <= 0) this.showGameOver();
      },
      '⚠ 긴급방어/회피 가능!',
    );
  }

  private bossPatternSummon(boss: Phaser.GameObjects.Container) {
    this.showPatternWarning(boss, '👻 소환!', '#aa44ff', 2000, () => {
      if (this.gameOver) return;
      const r = this.regionDef;
      const pool = r.monsters;
      const data = pool[0];
      const baseHp = Math.floor(
        MON_BASE_HP * Math.pow(MON_HP_GROWTH, this.stage - 1) * r.hpMult * 0.3,
      );
      const goldDrop = Math.floor(this.stage * 2);
      for (let i = 0; i < 2; i++) {
        const pos = SUB_MON_POSITIONS[i];
        if (!pos) continue;
        const already = this.monsters.find(m => !m.isDead && Math.abs(m.x - pos.x) < 30);
        if (already) continue;
        const sub = new Monster(this, pos.x, pos.y, {
          name: data.name,
          hp: baseHp,
          gold: goldDrop,
          type: data.type,
          size: Math.floor(data.size * 0.7),
          level: this.stage,
          isSub: true,
        });
        this.monsters.push(sub);
        sub.setAlpha(0);
        this.tweens.add({ targets: sub, alpha: 1, duration: 300 });
      }
      DamageText.show(this, boss.x, boss.y - 50, '소환 완료!', '#aa44ff', '18px');
      this.emitParticles(boss.x, boss.y, [0xaa44ff, 0x6622cc], 8);
    });
  }

  private bossPatternCurse(boss: Phaser.GameObjects.Container) {
    this.showPatternWarning(
      boss,
      '🔮 저주!',
      '#cc22ff',
      2000,
      () => {
        if (this.gameOver) return;
        if (this.tryParryBossPattern(0)) {
          DamageText.show(this, 400, 200, '저주 반사!', '#ffd700', '22px');
          return;
        }
        if (this.invincible || this.stealthActive) {
          if (this.stealthActive) this.tryRogueDodge();
          DamageText.show(this, 400, 180, 'IMMUNE', '#66eeff', '24px');
          return;
        }
        this.skillSealed = true;
        this.skillButtons.forEach(btn => btn?.setMpDisabled(true));
        DamageText.show(this, 400, 250, '🔮 스킬 10초 봉인!', '#cc22ff', '24px');
        this.cameras.main.flash(200, 100, 0, 200);
        this.skillSealTimer?.remove();
        this.skillSealTimer = this.time.delayedCall(10000, () => {
          this.skillSealed = false;
          this.skillSealTimer = undefined;
          this.refreshSkillButtonStates();
          DamageText.show(this, 400, 250, '봉인 해제!', '#88ff88', '20px');
        });
      },
      '⚔ 패링/회피 가능!',
    );
  }

  /* ================================================================
     AUTO COMBAT
     ================================================================ */

  private onAutoAttack(isAuto = true) {
    const t = this.targetMonster;
    if (this.gameOver || !t || t.isDead) return;
    let dmg = this.effectiveAtk;
    if (this.overdriveActive) dmg = Math.floor(dmg * 2);
    if (this.hasSynergy('berserker')) dmg += 5;
    let color = '#ffffff',
      size = '24px';
    const forceCrit = this.roguePostDodgeActive && this.stealthGuaranteeCrit;
    const odCrit = this.overdriveActive && this.selectedClass?.id === 'rogue';
    const isCrit = odCrit || forceCrit || Math.random() < this.critChance;
    let critMult = this.critDamageMult;
    if (this.hasSynergy('glass_cannon')) critMult += 0.5;
    if (isCrit) {
      dmg = Math.floor(dmg * critMult);
      color = '#ff2222';
      size = '36px';
      SoundManager.sfxCritical();
    } else {
      SoundManager.sfxHit();
    }
    if (forceCrit) {
      this.roguePostDodgeActive = false;
      this.stealthGuaranteeCrit = false;
    }
    this.addOverdrive(isAuto ? 5 : 10);
    if (isCrit) this.addOverdrive(20);
    this.addComboHit();

    if (this.overdriveActive) {
      if (isCrit) {
        color = '#ff4444';
        size = '52px';
      } else {
        color = '#ffdd00';
        size = '36px';
      }
    }

    const dead = t.takeDamage(dmg);
    const ox = Phaser.Math.Between(-20, 20),
      oy = Phaser.Math.Between(-15, 0);
    DamageText.show(this, t.x + ox, t.y - 40 + oy, dmg, color, size);

    if (isCrit && this.hasSynergy('death_touch')) {
      this.playerHp = Math.min(this.playerHp + 20, this.playerMaxHp);
      this.drawPlayerHpBar();
      DamageText.show(this, t.x, t.y - 70, '+20 HP', '#ff44aa', '14px');
    }
    if (isCrit) {
      const critLabel = this.overdriveActive ? 'CRITICAL!!' : 'CRITICAL!';
      const critSize = this.overdriveActive ? '26px' : '18px';
      DamageText.show(
        this,
        t.x + Phaser.Math.Between(-30, 30),
        t.y - 70,
        critLabel,
        '#ff4444',
        critSize,
      );
      this.cameras.main.shake(60, 0.004);
      this.emitParticles(
        t.x,
        t.y - 20,
        [0xff2222, 0xff6600, 0xffcc00],
        this.overdriveActive ? 12 : 8,
      );
      if (this.stealthGuaranteeCrit) this.stealthGuaranteeCrit = false;
    } else {
      this.emitParticles(
        t.x + ox,
        t.y + oy,
        this.overdriveActive ? [0xffdd00, 0xffaa00] : undefined,
      );
    }
    this.applyLifesteal(dmg);

    if (
      this.overdriveActive &&
      this.selectedClass?.id === 'warrior' &&
      Math.random() < 0.5 &&
      !t.isDead
    ) {
      this.monsterStunned = true;
      this.time.delayedCall(600, () => {
        this.monsterStunned = false;
      });
      DamageText.show(this, t.x, t.y - 85, 'STUN!', '#ffcc00', '16px');
    }

    if (this.shadowCloneActive && this.shadowCloneMult > 0) {
      const cloneDmg = Math.floor(this.effectiveAtk * this.shadowCloneMult);
      this.time.delayedCall(60, () => {
        if (this.gameOver || t.isDead) return;
        t.takeDamage(cloneDmg);
        DamageText.show(this, t.x + 20, t.y - 55, cloneDmg, '#7755bb', '18px');
        if (t.isDead) this.handleMonsterKill(t);
      });
    }

    if (dead) this.handleMonsterKill(t);
    else if (this.legendaryEffects.spd && Math.random() < 0.1) {
      this.time.delayedCall(80, () => {
        if (this.gameOver || !t || t.isDead) return;
        const d2 = this.effectiveAtk;
        t.takeDamage(d2);
        DamageText.show(this, t.x + Phaser.Math.Between(-15, 15), t.y - 55, d2, '#88ccff', '20px');
        DamageText.show(this, t.x, t.y - 75, '2연타!', '#66ddff', '14px');
        if (t.isDead) this.handleMonsterKill(t);
      });
    }
  }

  /* ================================================================
     MONSTER COUNTERATTACK
     ================================================================ */

  private onMonsterAttack() {
    this.attackSeqActive = false;
    const alive = this.monsters.filter(m => !m.isDead);
    if (this.gameOver || this.cardSelecting || this.doorSelecting || alive.length === 0) return;
    if (this.monsterStunned || this.monsterFrozen) return;
    const attacker = Phaser.Math.RND.pick(alive);
    const atkMult = attacker.isSub ? 0.5 : 1;
    let monAtk = this.monsterAttackPower;
    if (this.currentBossType !== 'none') monAtk = Math.floor(monAtk * this.bossRageMult);
    if (this.monsterWeakened) monAtk = Math.floor(monAtk * (1 - this.monsterWeakenPct));
    const madnessExtra = this.markCount('madness') * 2;
    const rawDmg = Math.max(
      1,
      Math.floor(monAtk * atkMult * (1 - this.defenseRate)) + madnessExtra,
    );

    attacker.playAttackAnimation();

    if (this.invincible || this.stealthActive) {
      if (this.stealthActive && this.selectedClass.id === 'rogue') this.tryRogueDodge();
      DamageText.show(this, HP_BAR.x + HP_BAR.w / 2, HP_BAR.y - 5, 'IMMUNE', '#66eeff', '20px');
      return;
    }
    if (this.dodgeChance > 0 && Math.random() < this.dodgeChance) {
      DamageText.show(this, HP_BAR.x + HP_BAR.w / 2, HP_BAR.y - 5, 'DODGE', '#aaaaaa', '20px');
      return;
    }

    const barrier = this.tryMageBarrier(rawDmg);
    if (barrier.absorbed) return;

    this.playerHp = Math.max(0, this.playerHp - rawDmg);
    if (this.currentBossType !== 'none') this.bossHitThisRun = true;
    this.drawPlayerHpBar();
    this.playHitEffect(rawDmg, this.currentBossType !== 'none');
    this.addOverdrive(5);

    this.tryWarriorBlock(rawDmg);

    if (this.reflectActive && this.reflectPct > 0) {
      const reflected = Math.floor(rawDmg * this.reflectPct);
      if (reflected > 0 && this.targetMonster && !this.targetMonster.isDead) {
        const dead = this.targetMonster.takeDamage(reflected);
        DamageText.show(
          this,
          this.targetMonster.x,
          this.targetMonster.y - 40,
          `🔄${reflected}`,
          '#aa5544',
          '18px',
        );
        if (dead) this.handleMonsterKill(this.targetMonster);
      }
    }

    if (
      this.hasSynergy('tank') &&
      Math.random() < 0.05 &&
      this.targetMonster &&
      !this.targetMonster.isDead
    ) {
      const counterDmg = Math.floor(this.effectiveAtk * 0.5);
      this.targetMonster.takeDamage(counterDmg);
      DamageText.show(
        this,
        this.targetMonster.x,
        this.targetMonster.y - 50,
        `반격! ${counterDmg}`,
        '#5599cc',
        '16px',
      );
      if (this.targetMonster.isDead) this.handleMonsterKill(this.targetMonster);
    }

    if (this.playerHp <= 0) this.showGameOver();
  }

  private flashScreenEdges() {
    const g = this.add.graphics().setDepth(150).setAlpha(0.35);
    g.fillStyle(0xff0000, 1);
    g.fillRect(0, 0, 800, 8);
    g.fillRect(0, 592, 800, 8);
    g.fillRect(0, 0, 8, 600);
    g.fillRect(792, 0, 8, 600);
    this.tweens.add({
      targets: g,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  private playHitEffect(dmg: number, isBoss: boolean) {
    const hpX = HP_BAR.x + HP_BAR.w / 2;
    DamageText.show(
      this,
      hpX + Phaser.Math.Between(-20, 20),
      HP_BAR.y - 5,
      `-${dmg}`,
      '#ff8844',
      '22px',
    );

    if (isBoss) {
      this.cameras.main.shake(200, 0.008);
      SoundManager.sfxBossHit();
    } else {
      this.cameras.main.shake(100, 0.003);
      SoundManager.sfxPlayerHit();
    }

    this.flashScreenEdges();

    const hpRatio = this.playerHp / this.playerMaxHp;
    if (hpRatio > 0 && hpRatio <= 0.3) {
      SoundManager.sfxHeartbeat();
    }

    const hpBar = this.playerHpFill;
    if (hpBar) {
      this.tweens.add({
        targets: hpBar,
        x: HP_BAR.x + 3,
        duration: 40,
        yoyo: true,
        repeat: 2,
        onComplete: () => {
          hpBar.x = 0;
        },
      });
    }

    const flash = this.add.graphics().setDepth(151).setAlpha(0.25);
    flash.fillStyle(0xff0000, 1);
    flash.fillRect(HP_BAR.x - 3, HP_BAR.y - 3, HP_BAR.w + 6, HP_BAR.h + 6);
    this.tweens.add({ targets: flash, alpha: 0, duration: 150, onComplete: () => flash.destroy() });
  }

  private playBossStrongHitEffect(dmg: number) {
    DamageText.show(this, 400, 160, `CRITICAL HIT!`, '#ff0000', '32px');
    DamageText.show(this, 400, 190, `-${dmg}`, '#ff2200', '28px');
    SoundManager.sfxBossHit();

    this.cameras.main.shake(200, 0.012);

    const overlay = this.add.graphics().setDepth(160).setAlpha(0.35);
    overlay.fillStyle(0xff0000, 1);
    overlay.fillRect(0, 0, 800, 600);
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 300,
      onComplete: () => overlay.destroy(),
    });

    this.flashScreenEdges();

    const hpBar = this.playerHpFill;
    if (hpBar) {
      this.tweens.add({
        targets: hpBar,
        x: HP_BAR.x + 5,
        duration: 30,
        yoyo: true,
        repeat: 4,
        onComplete: () => {
          hpBar.x = 0;
        },
      });
    }

    if (this.playerHp > 0 && this.playerHp / this.playerMaxHp <= 0.3) {
      SoundManager.sfxHeartbeat();
    }
  }

  /* ================================================================
     MONSTER DEATH + REGION TRANSITIONS
     ================================================================ */

  private handleMonsterKill(monster: Monster) {
    this.totalKills++;
    this.cancelParrySequence();
    const reward = monster.goldReward;
    this.gold += reward;
    this.totalGoldEarned += reward;
    SoundManager.sfxGold();

    const isBoss = !monster.isSub && this.currentBossType !== 'none';
    const wasRegionBoss = this.currentBossType === 'final' && !monster.isSub;
    const wasMini = this.currentBossType === 'mini' && !monster.isSub;

    if (isBoss) {
      DamageText.show(
        this,
        monster.x,
        monster.y - 50,
        `BOSS KILL! +${reward} G`,
        '#ffd700',
        '28px',
      );
      this.cameras.main.shake(400, 0.02);
      this.cameras.main.flash(300, 255, 200, 50);
      this.emitParticles(monster.x, monster.y, [0xffd700, 0xffaa00, 0xffffff], 20);
    } else {
      const gSize = monster.isSub ? '18px' : '24px';
      DamageText.show(this, monster.x, monster.y - 30, `+${reward} G`, '#ffd700', gSize);
      this.cameras.main.shake(150, 0.008);
      this.emitParticles(
        monster.x,
        monster.y,
        [0xffffff, 0xffcc00, 0xff8800],
        monster.isSub ? 3 : 6,
      );
    }

    if (wasRegionBoss) {
      this.regionBossesKilled++;
      this.awardRelicPoints(5);
    }
    if (isBoss && !this.bossHitThisRun) this.checkBossNoHit();
    if (this.legendaryEffects.steal) {
      this.playerHp = Math.min(this.playerHp + 10, this.playerMaxHp);
      this.drawPlayerHpBar();
      DamageText.show(this, monster.x, monster.y - 60, '+10 HP', '#ff88cc', '14px');
    }

    const xpMult = wasRegionBoss ? 5 : wasMini ? 3 : monster.isSub ? 0.4 : 1;
    this.waveXpAccum += Math.floor((5 + this.stage * 2) * xpMult);

    if (monster === this.targetMonster) {
      this.retargetNextAlive();
    }

    const shouldSplit = monster.specialType === 'split' && monster.canSplit;

    monster.playDeathAnimation(() => {
      const idx = this.monsters.indexOf(monster);
      if (idx >= 0) this.monsters.splice(idx, 1);

      if (shouldSplit) {
        this.handleSplitMonster(monster);
      }

      this.setupMonsterAttackTimer();

      if (this.waveClearing) return;
      if (this.monsters.filter(m => !m.isDead).length > 0) return;
      this.waveClearing = true;

      this.poisonTimer?.remove();
      this.poisonTimer = undefined;
      this.bossSpecialTimer?.remove();
      this.bossSpecialTimer = undefined;
      this.bossPatternTimer?.remove();
      this.bossPatternTimer = undefined;
      this.bossPatternWarning?.destroy();
      this.bossPatternWarning = undefined;
      this.bossDefenseTimer?.remove();
      this.bossDefenseTimer = undefined;
      this.bossDefenseReduction = 0;
      this.skillSealTimer?.remove();
      this.skillSealTimer = undefined;
      this.skillSealed = false;
      this.bossRageTimer?.remove();
      this.bossRageTimer = undefined;
      this.bossRageLevel = 0;
      this.chargeTimers.forEach(t => t.remove());
      this.chargeTimers = [];
      this.bossAttackIncoming = false;
      this.cancelParrySequence();
      this.highlightResponseBtns(false);

      const wasBossForMemory = wasMini || wasRegionBoss;
      const xpGain = this.waveXpAccum;
      this.waveXpAccum = 0;

      if (wasRegionBoss) {
        this.highestStageCleared = Math.max(this.highestStageCleared, this.stage);
        this.currentBossType = 'none';
        this.hideBossBackground();
        this.saveBestLocal();
        this.awardMilestonePoints();
        this.gainXp(xpGain);
        const clearNarr = NARRATION.regionClear[this.currentRegion];
        if (clearNarr) {
          this.showNarration(clearNarr, () => this.showRunClear());
        } else {
          this.showRunClear();
        }
        return;
      }

      this.currentBossType = 'none';
      this.hideBossBackground();
      SoundManager.playBattleBgm();

      const afterBossNarration = () => {
        if (this.waveCurrent < this.waveTotal) {
          this.time.delayedCall(500, () => {
            this.gainXp(xpGain);
            this.spawnNextWave();
          });
          return;
        }
        this.gainXp(xpGain);
        if (this.pendingLevelUps > 0) {
          this.pendingStageClear = true;
          this.pendingStageClearBoss = wasBossForMemory;
        } else {
          this.onStageClear(wasBossForMemory);
        }
      };

      if (wasMini) {
        const miniNarr = NARRATION.miniBossClear[this.currentRegion];
        if (miniNarr) {
          this.showNarration(miniNarr, afterBossNarration);
        } else {
          afterBossNarration();
        }
      } else {
        afterBossNarration();
      }
    });
  }

  /* ================================================================
     RELIC POINTS
     ================================================================ */

  private awardRelicPoints(pts: number) {
    if (pts <= 0) return;
    this.relicPointsVal = this.relicPoints + pts;
    DamageText.show(this, 400, 100, `+${pts} 💎 유물 포인트`, '#cc88ff', '22px');
    this.updateUI();
  }

  private calculateMilestonePoints(): number {
    let pts = 0;
    if (this.highestStageCleared >= 10) pts += 1;
    if (this.highestStageCleared >= 20) pts += 3;
    if (this.highestStageCleared >= 40) pts += 6;
    if (this.highestStageCleared >= 60) pts += 10;
    return pts;
  }

  private awardMilestonePoints() {
    const pts = this.calculateMilestonePoints();
    if (pts > 0) this.awardRelicPoints(pts);
  }

  /* ================================================================
     SAVE BEST RECORD
     ================================================================ */

  private saveBestLocal() {
    const localCleared = this.highestStageCleared - (this.startRegion - 1) * 20;
    const key = `bestLocal_${this.startRegion}`;
    const current: number = this.registry.get(key) ?? 0;
    if (localCleared > current) {
      this.registry.set(key, localCleared);
    }
  }

  /* ================================================================
     RUN CLEAR + PRESTIGE
     ================================================================ */

  private showRunClear() {
    this.gameOver = true;
    SoundManager.stopBgm();
    SoundManager.playClearFanfare();
    this.flushAchRunComplete();
    this.checkAchievements();
    this.deleteRunSave();
    this.syncPermanentToStorage();
    const milestonePts = this.calculateMilestonePoints();
    const bossPts = this.regionBossesKilled * 3;

    this.showNarration(NARRATION.runClear);

    const overlay = this.add.graphics().setDepth(400).setAlpha(0);
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, 800, 600);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 600 });

    const title = this.add
      .text(400, 80, '🏆 런 클리어! 🏆', {
        fontSize: '48px',
        color: '#ffd700',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(401)
      .setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 700, delay: 400, ease: 'Back.easeOut' });

    const panelG = this.add.graphics().setDepth(401);
    panelG.fillStyle(0x1a1a30, 0.9);
    panelG.fillRoundedRect(200, 140, 400, 230, 16);
    panelG.lineStyle(2, 0xffd700, 0.5);
    panelG.strokeRoundedRect(200, 140, 400, 230, 16);
    panelG.setAlpha(0);
    this.tweens.add({ targets: panelG, alpha: 1, duration: 400, delay: 800 });

    const stats = [
      `처치 몬스터: ${this.totalKills}`,
      `최고 스테이지: ${this.stage}`,
      `획득 골드: ${this.totalGoldEarned}G`,
      `레벨: ${this.level}`,
      `획득 유물 포인트: ${milestonePts + bossPts}💎`,
    ];
    stats.forEach((s, i) => {
      const t = this.add
        .text(400, 168 + i * 34, s, {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(402)
        .setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, delay: 900 + i * 120 });
    });

    if (this.prestigeCount > 0) {
      const pText = this.add
        .text(400, 380, `프레스티지 보너스: 골드 +${this.prestigeCount * 20}%`, {
          fontSize: '14px',
          color: '#cc88ff',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(402)
        .setAlpha(0);
      this.tweens.add({ targets: pText, alpha: 1, duration: 400, delay: 1600 });
    }

    const makeBtn = (
      bx: number,
      by: number,
      label: string,
      sub: string,
      fc: number,
      hc: number,
      bc: number,
      onClick: () => void,
    ) => {
      const bw = 200,
        bh = 52;
      const btnBg = this.add.graphics().setDepth(401).setAlpha(0);
      const draw = (hover: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(hover ? hc : fc, 1);
        btnBg.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 14);
        btnBg.lineStyle(2, bc, 1);
        btnBg.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 14);
      };
      draw(false);
      const bt = this.add
        .text(bx, by - 6, label, {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(402)
        .setAlpha(0);
      const st = this.add
        .text(bx, by + 14, sub, {
          fontSize: '10px',
          color: '#aaaaaa',
          fontFamily: 'Arial',
        })
        .setOrigin(0.5)
        .setDepth(402)
        .setAlpha(0);
      this.tweens.add({
        targets: [btnBg, bt, st],
        alpha: 1,
        duration: 400,
        delay: 1800,
        onComplete: () => {
          const z = this.add
            .zone(bx, by, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setDepth(403);
          z.on('pointerdown', onClick);
          z.on('pointerover', () => draw(true));
          z.on('pointerout', () => draw(false));
        },
      });
    };
    makeBtn(140, 460, '🏠 메인 메뉴', '지역 선택', 0x334455, 0x446677, 0x5588aa, () =>
      this.scene.start('TitleScene'),
    );
    makeBtn(400, 460, '🔄 다시 시작', '같은 지역', 0x993333, 0xbb4444, 0xcc5555, () =>
      this.scene.restart({ startRegion: this.startRegion, classId: this.selectedClass.id }),
    );
    makeBtn(
      660,
      460,
      '⭐ 프레스티지',
      `골드 +${(this.prestigeCount + 1) * 20}%`,
      0x553399,
      0x7744bb,
      0x9966cc,
      () => this.doPrestige(),
    );
  }

  private doPrestige() {
    this.registry.set('prestigeCount', this.prestigeCount + 1);
    this.deleteRunSave();
    this.syncPermanentToStorage();
    this.scene.restart({ startRegion: this.startRegion, classId: this.selectedClass.id });
  }

  /* ================================================================
     GAME OVER
     ================================================================ */

  private showGameOver() {
    if (!this.hasRevived && this.relicLevels.immortal > 0) {
      this.hasRevived = true;
      const healPct = (20 + this.relicLevels.immortal * 10) / 100;
      this.playerHp = Math.ceil(this.playerMaxHp * healPct);
      this.gameOver = false;
      this.drawPlayerHpBar();
      DamageText.show(this, 400, 200, '🔥 불사의 인장 발동!', '#ff6622', '28px');
      this.cameras.main.flash(500, 255, 100, 0);
      this.emitParticles(400, 300, [0xff6622, 0xffaa00, 0xffcc00], 15);
      return;
    }
    this.gameOver = true;
    this.bossSpecialTimer?.remove();
    this.bossPatternTimer?.remove();
    this.bossPatternTimer = undefined;
    this.bossPatternWarning?.destroy();
    this.bossPatternWarning = undefined;
    this.bossDefenseTimer?.remove();
    this.bossDefenseTimer = undefined;
    this.bossDefenseReduction = 0;
    this.skillSealTimer?.remove();
    this.skillSealTimer = undefined;
    this.skillSealed = false;
    this.bossRageTimer?.remove();
    this.bossRageTimer = undefined;
    this.bossRageLevel = 0;
    this.monsterAttackTimer?.remove();
    this.poisonTimer?.remove();
    this.bossAttackIncoming = false;
    this.cancelParrySequence();
    this.roguePostDodgeTimer?.remove();
    this.highlightResponseBtns(false);
    this.saveBestLocal();
    this.awardMilestonePoints();
    this.flushAchKills();
    this.checkAchievements();
    this.deleteRunSave();
    this.syncPermanentToStorage();

    const soulGold = Math.floor(this.gold * 0.5);
    const existingSoul = SaveManager.loadSoul();
    if (
      existingSoul &&
      existingSoul.stage === this.stage &&
      existingSoul.region === this.startRegion
    ) {
      SaveManager.deleteSoul();
    }
    if (soulGold > 0) {
      SaveManager.saveSoul({ gold: soulGold, stage: this.stage, region: this.startRegion });
    }

    let newMark: MarkId | null = null;
    if (this.deathMarks.length < 5) {
      const available = ALL_MARK_IDS.filter(id => !this.deathMarks.includes(id));
      if (available.length > 0) {
        newMark = Phaser.Math.RND.pick(available);
        this.deathMarks.push(newMark);
        SaveManager.saveMarks(this.deathMarks);
      }
    }

    SoundManager.stopBgm();
    SoundManager.sfxGameOver();
    SoundManager.playGameOverBgm();

    this.showNarration(NARRATION.gameOver);

    const overlay = this.add.graphics().setDepth(400).setAlpha(0);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, 800, 600);
    this.tweens.add({ targets: overlay, alpha: 1, duration: 500 });
    const title = this.add
      .text(400, 130, 'GAME OVER', {
        fontSize: '64px',
        color: '#ff3333',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(401)
      .setScale(0);
    this.tweens.add({ targets: title, scale: 1, duration: 600, delay: 300, ease: 'Back.easeOut' });

    const milestonePts = this.calculateMilestonePoints();
    const ptsStr = milestonePts > 0 ? ` · +${milestonePts}💎` : '';
    this.add
      .text(
        400,
        210,
        `Stage ${this.localStage}/20 · Lv.${this.level} · ${this.totalKills} kills${ptsStr}`,
        {
          fontSize: '20px',
          color: '#cccccc',
          fontFamily: 'Arial, sans-serif',
          stroke: '#000000',
          strokeThickness: 3,
        },
      )
      .setOrigin(0.5)
      .setDepth(401);

    if (soulGold > 0) {
      this.add
        .text(400, 240, `💀 소울 드롭: ${soulGold}G (Stage ${this.localStage})`, {
          fontSize: '16px',
          color: '#ddaa44',
          fontFamily: 'Arial, sans-serif',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(401);
    }

    if (newMark) {
      const md = MARK_DEFS[newMark];
      const markY = soulGold > 0 ? 268 : 248;
      const markText = this.add
        .text(400, markY, `${md.icon} ${md.name} 획득! (${md.bonus} / ${md.penalty})`, {
          fontSize: '15px',
          color: '#cc44ff',
          fontFamily: 'Arial, sans-serif',
          stroke: '#000000',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(401)
        .setAlpha(0);
      this.tweens.add({ targets: markText, alpha: 1, duration: 600, delay: 800 });

      if (this.deathMarks.length >= 5) {
        const cursedText = this.add
          .text(400, markY + 22, '⚠ "저주받은 자" - 모든 효과 2배!', {
            fontSize: '14px',
            color: '#ff2222',
            fontFamily: 'Arial, sans-serif',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(401)
          .setAlpha(0);
        this.tweens.add({ targets: cursedText, alpha: 1, duration: 600, delay: 1200 });
      }
    }

    const btnY = 350;
    const makeGoBtn = (
      bx: number,
      by: number,
      label: string,
      fc: number,
      hc: number,
      bc: number,
      onClick: () => void,
    ) => {
      const bw = 220,
        bh = 48;
      const g = this.add.graphics().setDepth(401).setAlpha(0);
      const draw = (hover: boolean) => {
        g.clear();
        g.fillStyle(hover ? hc : fc, 1);
        g.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 14);
        g.lineStyle(2, bc, 1);
        g.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 14);
      };
      draw(false);
      const t = this.add
        .text(bx, by, label, {
          fontSize: '20px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(402)
        .setAlpha(0);
      this.tweens.add({
        targets: [g, t],
        alpha: 1,
        duration: 400,
        delay: 1000,
        onComplete: () => {
          const z = this.add
            .zone(bx, by, bw, bh)
            .setInteractive({ useHandCursor: true })
            .setDepth(403);
          z.on('pointerdown', onClick);
          z.on('pointerover', () => draw(true));
          z.on('pointerout', () => draw(false));
        },
      });
    };

    makeGoBtn(260, btnY, '🔄 다시 시작', 0x993333, 0xbb4444, 0xcc5555, () =>
      this.scene.restart({ startRegion: this.startRegion, classId: this.selectedClass.id }),
    );
    makeGoBtn(540, btnY, '🏠 메인 메뉴', 0x334455, 0x446677, 0x5588aa, () =>
      this.scene.start('TitleScene'),
    );
  }

  /* ================================================================
     UI UPDATE
     ================================================================ */

  private updateUI() {
    const r = this.regionDef;
    let stageStr = `${r.icon} ${r.name} - Stage ${this.localStage}/20`;
    if (this.currentBossType === 'mini') {
      stageStr += '  MINI BOSS';
      this.stageText.setColor('#ff8844');
    } else if (this.currentBossType === 'final') {
      stageStr += '  BOSS';
      this.stageText.setColor('#ffd700');
    } else {
      this.stageText.setColor('#ffffff');
    }
    this.stageText.setText(stageStr);
    if (this.waveTotal > 0 && this.waveCurrent > 0) {
      this.waveText.setText(`Wave ${this.waveCurrent}/${this.waveTotal}`);
      this.waveText.setVisible(true);
    } else {
      this.waveText.setText('');
      this.waveText.setVisible(false);
    }
    this.relicPtsText.setText(`💎 ${this.relicPoints}`);

    this.goldText.setText(`💰 ${this.gold}G`);
    const atkStr = this.atkBuffActive
      ? `⚔ ATK: ${this.effectiveAtk} 🔥`
      : `⚔ ATK: ${this.effectiveAtk}`;
    this.statsLine1.setText(atkStr);
    this.statsLine1.setColor(this.atkBuffActive ? '#ff8844' : '#ff6b6b');
    this.statsLine2.setText(`💨 SPD: ${this.attacksPerSec.toFixed(2)}/s`);
    const parts: string[] = [];
    if (this.critChance > 0) parts.push(`CRIT ${Math.floor(this.critChance * 100)}%`);
    if (this.defenseRate > 0) parts.push(`DEF ${Math.floor(this.defenseRate * 100)}%`);
    if (this.lifestealRate > 0) parts.push(`흡혈 ${(this.lifestealRate * 100).toFixed(1)}%`);
    if (this.invincible) parts.push('✨무적');
    if (this.prestigeCount > 0) parts.push(`P×${this.prestigeCount}`);
    this.bonusText.setText(parts.join('  '));
    this.updateBuffBar();
  }

  /* ================================================================
     ACHIEVEMENTS
     ================================================================ */

  private tryUnlock(id: string) {
    if (this.achData.unlocked[id]) return;
    this.achData.unlocked[id] = Date.now();
    SaveManager.saveAchievements(this.achData);
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (def) this.showAchievementPopup(def.icon, def.name);
  }

  private checkAchievements() {
    const hs = this.highestStageCleared;
    if (hs >= 1) this.tryUnlock('stage_1');
    if (hs >= 10) this.tryUnlock('stage_10');
    if (hs >= 20) this.tryUnlock('stage_20');
    if (hs >= 40) this.tryUnlock('stage_40');
    if (hs >= 60) this.tryUnlock('stage_60');

    const totalKills = this.achData.totalKillsAll + this.totalKills;
    if (totalKills >= 100) this.tryUnlock('kill_100');
    if (totalKills >= 1000) this.tryUnlock('kill_1000');

    const ownedStatCards = Object.values(this.cardLevels).filter(v => v > 0).length;
    const ownedSkills = Object.values(this.skillLevels).filter(v => v > 0).length;
    const ownedCards = ownedStatCards + ownedSkills;
    if (ownedCards >= 5) this.tryUnlock('cards_5');
    if (ownedCards >= 10) this.tryUnlock('cards_10');

    if (this.activeSynergies.length >= 3) this.tryUnlock('synergy_3');

    const legendaryCount = Object.values(this.legendaryEffects).filter(Boolean).length;
    if (legendaryCount >= 1) this.tryUnlock('legendary_1');
    if (legendaryCount >= 3) this.tryUnlock('legendary_3');

    if (hs >= 20 && this.selectedClass.id === 'warrior') this.tryUnlock('warrior_clear');
    if (hs >= 20 && this.selectedClass.id === 'mage') this.tryUnlock('mage_clear');
    if (hs >= 20 && this.selectedClass.id === 'rogue') this.tryUnlock('rogue_clear');

    if (hs >= 10 && !this.potionUsedThisRun) this.tryUnlock('no_potion_10');

    if (this.gold >= 500) this.tryUnlock('gold_500');

    const rl = this.relicLevels;
    const maxedRelics = Object.values(rl).filter(v => v >= 5).length;
    if (maxedRelics >= 10) this.tryUnlock('relic_max_10');

    if (this.achData.totalRunsCompleted >= 10) this.tryUnlock('runs_10');
  }

  private checkBossNoHit() {
    if (!this.bossHitThisRun && this.currentBossType !== 'none') {
      this.tryUnlock('boss_no_hit');
    }
  }

  private flushAchKills() {
    this.achData.totalKillsAll += this.totalKills;
    SaveManager.saveAchievements(this.achData);
  }

  private flushAchRunComplete() {
    this.achData.totalRunsCompleted++;
    this.flushAchKills();
  }

  private showAchievementPopup(icon: string, name: string) {
    SoundManager.sfxAchievement();
    const px = 680,
      py = 540,
      pw = 220,
      ph = 50;
    const bg = this.add.graphics().setDepth(600).setAlpha(0);
    bg.fillStyle(0x1a1a2e, 0.9);
    bg.fillRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 10);
    bg.lineStyle(2, 0xffd700, 0.8);
    bg.strokeRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 10);

    const iconT = this.add
      .text(px - pw / 2 + 14, py - 2, icon, {
        fontSize: '22px',
      })
      .setOrigin(0, 0.5)
      .setDepth(601)
      .setAlpha(0);

    const label = this.add
      .text(px - pw / 2 + 42, py - 9, '🏆 업적 달성!', {
        fontSize: '9px',
        color: '#ffd700',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(601)
      .setAlpha(0);

    const nameT = this.add
      .text(px - pw / 2 + 42, py + 5, name, {
        fontSize: '13px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(601)
      .setAlpha(0);

    const els = [bg, iconT, label, nameT];
    this.tweens.add({
      targets: els,
      alpha: 1,
      duration: 300,
      ease: 'Sine.easeOut',
    });
    this.tweens.add({
      targets: els,
      alpha: 0,
      duration: 400,
      delay: 2600,
      ease: 'Sine.easeIn',
      onComplete: () => els.forEach(e => e.destroy()),
    });
  }

  /* ================================================================
     SAVE / LOAD
     ================================================================ */

  private buildRunData(): RunData {
    return {
      stage: this.stage,
      startRegion: this.startRegion,
      classId: this.selectedClass.id,
      playerHp: this.playerHp,
      playerMaxHp: this.playerMaxHp,
      playerMp: this.playerMp,
      playerMaxMp: this.playerMaxMp,
      attackPower: this.attackPower,
      gold: this.gold,
      level: this.level,
      xp: this.xp,
      xpToNext: this.xpToNext,
      cardLevels: { ...this.cardLevels },
      skillLevels: { ...this.skillLevels },
      equippedSkills: [...this.equippedSkills],
      quickSlots: this.quickSlots.map(s => ({ ...s })),
      activeSynergies: [...this.activeSynergies],
      cardRarityBonus: { ...this.cardRarityBonus },
      legendaryEffects: { ...this.legendaryEffects },
      highestStageCleared: this.highestStageCleared,
      totalKills: this.totalKills,
      totalGoldEarned: this.totalGoldEarned,
      hasRevived: this.hasRevived,
      autoAttackEnabled: this.autoAttackEnabled,
      savedAt: Date.now(),
    };
  }

  private autoSave() {
    SaveManager.saveRun(this.buildRunData());
    this.syncPermanentToStorage();
    this.showSaveIcon();
  }

  private syncPermanentToStorage() {
    const perm = SaveManager.loadPermanent();
    perm.relicPoints = this.relicPoints;
    perm.relicLevels = { ...this.relicLevels };
    perm.prestigeCount = this.prestigeCount;
    for (let ri = 1; ri <= REGIONS.length; ri++) {
      const best: number = this.registry.get(`bestLocal_${ri}`) ?? 0;
      if (best > 0) perm.bestLocal[ri] = Math.max(perm.bestLocal[ri] ?? 0, best);
    }
    perm.totalPlayCount = perm.totalPlayCount ?? 0;
    SaveManager.savePermanent(perm);
  }

  private loadRunData(rd: RunData) {
    this.stage = rd.stage;
    this.highestStageCleared = rd.highestStageCleared;
    this.gold = rd.gold;
    this.attackPower = rd.attackPower;
    this.level = rd.level;
    this.xp = rd.xp;
    this.xpToNext = rd.xpToNext;
    this.playerHp = rd.playerHp;
    this.playerMaxHp = rd.playerMaxHp;
    this.playerMp = rd.playerMp ?? INIT_MP;
    this.playerMaxMp = rd.playerMaxMp ?? INIT_MP;
    this.cardLevels = { ...rd.cardLevels };
    this.skillLevels = { ...(rd.skillLevels ?? {}) };
    this.equippedSkills = [...rd.equippedSkills];
    this.quickSlots = rd.quickSlots.map(s => ({ ...s }));
    this.activeSynergies = [...rd.activeSynergies];
    this.cardRarityBonus = { ...rd.cardRarityBonus };
    this.legendaryEffects = { ...rd.legendaryEffects };
    this.totalKills = rd.totalKills;
    this.totalGoldEarned = rd.totalGoldEarned;
    this.hasRevived = rd.hasRevived;
    this.autoAttackEnabled = rd.autoAttackEnabled ?? false;
  }

  private showSaveIcon() {
    const icon = this.add
      .text(770, 8, '💾', {
        fontSize: '20px',
      })
      .setDepth(500)
      .setAlpha(0);
    this.tweens.add({
      targets: icon,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: 350,
      onComplete: () => icon.destroy(),
    });
  }

  private deleteRunSave() {
    SaveManager.deleteRun();
  }

  private checkSoulRecovery() {
    if (this.soulRecovered || !this.soulData) return;
    if (this.soulData.region === this.startRegion && this.soulData.stage <= this.stage) {
      const recovered = this.soulData.gold;
      this.gold += recovered;
      SaveManager.deleteSoul();
      this.soulRecovered = true;
      this.soulData = null;
      DamageText.show(this, 400, 250, `💀 소울 회수! +${recovered}G`, '#ffd700', '28px');
      this.emitParticles(400, 300, [0xffd700, 0xffaa00, 0xffcc44], 12);
      SoundManager.sfxGold();
      this.updateUI();
    }
  }

  /* ================================================================
     PARTICLES
     ================================================================ */

  private emitParticles(x: number, y: number, colors?: number[], count?: number) {
    const c = colors ?? [0xffff00, 0xff8800, 0xffffff];
    for (let i = 0; i < (count ?? 5); i++) {
      const p = this.add.image(x, y, 'particle').setDepth(90);
      p.setTint(Phaser.Math.RND.pick(c));
      p.setScale(Phaser.Math.FloatBetween(0.8, 2.5));
      this.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-60, 60),
        y: y + Phaser.Math.Between(-80, -20),
        alpha: 0,
        scale: 0,
        duration: Phaser.Math.Between(300, 700),
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  /* ================================================================
     SYNERGY SYSTEM
     ================================================================ */

  private checkSynergies() {
    const prevActive = [...this.activeSynergies];
    this.activeSynergies = [];
    for (const syn of SYNERGIES) {
      const allMet = syn.requires.every(r => (this.cardLevels[r] ?? 0) >= 1);
      if (allMet) this.activeSynergies.push(syn.id);
    }
    for (const id of this.activeSynergies) {
      if (!prevActive.includes(id)) {
        const syn = SYNERGIES.find(s => s.id === id)!;
        this.showSynergyActivation(syn);
      }
    }
    this.updateSynergyDisplay();
  }

  private showSynergyActivation(syn: SynergyDef) {
    const txt = this.add
      .text(400, 200, `🔗 시너지 발동! ${syn.icon}\n${syn.name}`, {
        fontSize: '28px',
        color: '#44ffaa',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0)
      .setScale(0.5);
    const sub = this.add
      .text(400, 248, syn.desc, {
        fontSize: '16px',
        color: '#aaffcc',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 100 });
    this.emitParticles(400, 220, [0x44ffaa, 0x88ffcc, 0x22cc88], 12);
    this.cameras.main.flash(200, 68, 255, 170);
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: [txt, sub],
        alpha: 0,
        y: '-=30',
        duration: 400,
        onComplete: () => {
          txt.destroy();
          sub.destroy();
        },
      });
    });
  }

  private createSynergyDisplay() {
    this.synergyContainer = this.add.container(730, 130).setDepth(50);
  }

  private updateSynergyDisplay() {
    if (!this.synergyContainer) return;
    this.synergyContainer.removeAll(true);
    this.activeSynergies.forEach((id, i) => {
      const syn = SYNERGIES.find(s => s.id === id)!;
      const y = i * 28;
      const bg = this.add.graphics();
      bg.fillStyle(0x112233, 0.7);
      bg.fillRoundedRect(-60, y - 10, 120, 24, 6);
      bg.lineStyle(1, 0x44ffaa, 0.5);
      bg.strokeRoundedRect(-60, y - 10, 120, 24, 6);
      this.synergyContainer!.add(bg);
      const txt = this.add
        .text(0, y, `${syn.icon} ${syn.name}`, {
          fontSize: '10px',
          color: '#44ffaa',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5);
      this.synergyContainer!.add(txt);
    });
  }

  /* ================================================================
     LEGENDARY ACTIVATION
     ================================================================ */

  private showLegendaryActivation(card: CardDef) {
    const txt = this.add
      .text(400, 160, `★ 전설 발동! ★\n${card.icon} ${card.name}`, {
        fontSize: '32px',
        color: '#ffd700',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 7,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0)
      .setScale(0.3);
    const desc = this.add
      .text(400, 215, LEGENDARY_DESCS[card.id] ?? '', {
        fontSize: '18px',
        color: '#ffee88',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(400)
      .setAlpha(0);
    this.tweens.add({ targets: txt, alpha: 1, scale: 1, duration: 400, ease: 'Back.easeOut' });
    this.tweens.add({ targets: desc, alpha: 1, duration: 300, delay: 200 });
    this.emitParticles(400, 180, [0xffd700, 0xffaa00, 0xffffff, 0xffcc44], 18);
    this.cameras.main.flash(300, 255, 215, 0);

    const ring = this.add.graphics().setDepth(399).setAlpha(0.8);
    ring.lineStyle(3, 0xffd700, 1);
    ring.strokeCircle(400, 180, 15);
    this.tweens.add({
      targets: ring,
      scaleX: 8,
      scaleY: 8,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });

    this.time.delayedCall(2200, () => {
      this.tweens.add({
        targets: [txt, desc],
        alpha: 0,
        y: '-=40',
        duration: 500,
        onComplete: () => {
          txt.destroy();
          desc.destroy();
        },
      });
    });
  }

  /* ================================================================
     PAUSE MENU
     ================================================================ */

  private toggleCheatInvincible() {
    this.cheatInvincible = !this.cheatInvincible;
    this.invincible = this.cheatInvincible;
    DamageText.show(
      this,
      400,
      300,
      this.cheatInvincible ? 'CHEAT: 무적 ON' : 'CHEAT: 무적 OFF',
      this.cheatInvincible ? '#00ff00' : '#ff4444',
      '24px',
    );
    this.updateUI();
  }

  private toggleCheatAtk() {
    this.cheatAtk = !this.cheatAtk;
    DamageText.show(
      this,
      400,
      330,
      this.cheatAtk ? 'CHEAT: ATK x100 ON' : 'CHEAT: ATK x100 OFF',
      this.cheatAtk ? '#00ff00' : '#ff4444',
      '24px',
    );
    this.updateUI();
  }

  private togglePauseMenu() {
    if (this.gameOver) return;
    if (this.pauseOpen) {
      this.hidePauseMenu();
    } else {
      this.showPauseMenu();
    }
  }

  private showPauseMenu() {
    this.pauseOpen = true;
    this.time.paused = true;
    const els = this.pauseElements;
    const bg = this.add.graphics().setDepth(500).setAlpha(0);
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.tweens.add({ targets: bg, alpha: 1, duration: 200 });

    const panel = this.add.graphics().setDepth(501);
    panel.fillStyle(0x1a1a30, 0.95);
    panel.fillRoundedRect(250, 160, 300, 280, 16);
    panel.lineStyle(2, 0x4466aa, 0.8);
    panel.strokeRoundedRect(250, 160, 300, 280, 16);
    els.push(panel);

    els.push(
      this.add
        .text(400, 195, '⏸ 일시 정지', {
          fontSize: '28px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(502),
    );

    const makeBtn = (
      y: number,
      label: string,
      fc: number,
      hc: number,
      bc: number,
      onClick: () => void,
    ) => {
      const bw = 220,
        bh = 44;
      const g = this.add.graphics().setDepth(501);
      const draw = (hover: boolean) => {
        g.clear();
        g.fillStyle(hover ? hc : fc, 1);
        g.fillRoundedRect(400 - bw / 2, y - bh / 2, bw, bh, 10);
        g.lineStyle(2, bc, 1);
        g.strokeRoundedRect(400 - bw / 2, y - bh / 2, bw, bh, 10);
      };
      draw(false);
      els.push(g);
      const t = this.add
        .text(400, y, label, {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(502);
      els.push(t);
      const z = this.add.zone(400, y, bw, bh).setInteractive({ useHandCursor: true }).setDepth(503);
      z.on('pointerover', () => draw(true));
      z.on('pointerout', () => draw(false));
      z.on('pointerdown', onClick);
      els.push(z);
    };

    makeBtn(260, '▶ 계속하기', 0x334455, 0x446677, 0x5588aa, () => this.hidePauseMenu());
    makeBtn(315, '🏠 메인화면으로', 0x553333, 0x774444, 0xaa5555, () => {
      this.hidePauseMenu();
      SoundManager.stopBgm();
      this.scene.start('TitleScene');
    });
    makeBtn(370, '🔇 음소거', 0x333355, 0x444477, 0x6666aa, () => {
      const s = SaveManager.loadSettings();
      s.muted = !s.muted;
      SaveManager.saveSettings(s);
      SoundManager.updateSettings(s);
      DamageText.show(this, 400, 400, s.muted ? '음소거 ON' : '음소거 OFF', '#aabbcc', '16px');
    });
  }

  private hidePauseMenu() {
    this.pauseOpen = false;
    this.time.paused = false;
    this.pauseElements.forEach(e => e.destroy());
    this.pauseElements = [];
  }
}
