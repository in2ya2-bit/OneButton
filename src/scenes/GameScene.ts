import Phaser from 'phaser';
import { Monster } from '../objects/Monster';
import { DamageText } from '../objects/DamageText';
import { SkillButton } from '../objects/SkillButton';
import { REGIONS, RegionDef } from '../data/regions';
import { DEFAULT_RELIC_LEVELS } from '../data/relics';
import { CLASSES, ClassDef } from '../data/classes';
import { SaveManager, RunData, AchievementSave, SoulData, MarkId } from '../data/SaveManager';
import { SoundManager } from '../data/SoundManager';
import { ACHIEVEMENTS } from '../data/achievements';
import { RelicPanel } from '../objects/RelicPanel';
import { ALL_SKILL_DEFS, BASIC_ATTACK_SKILLS, SkillDef, SfxType } from '../data/skillDefs';
import { SpecialType } from '../objects/Monster';
import { NARRATION, NarrationEntry } from '../data/narration';
import {
  INIT_HP,
  INIT_ATK,
  MIN_ATK_INTERVAL_MS,
  INIT_MP,
  MP_REGEN_PER_SEC,
  MON_BASE_HP,
  MON_HP_GROWTH,
  MON_BASE_ATK,
  MON_ATK_GROWTH,
  HP_BAR,
  XP_BAR,
  SUB_MON_POSITIONS,
  MAX_SLOTS,
  SLOT_W,
  SLOT_H,
  SLOT_Y,
  SLOT_XS,
  QSLOT_Y,
  QSLOT_XS,
  MAX_POTION_STACK,
} from '../config/constants';
import type { QuickSlotData } from '../types/index';
import { STAT_CARDS, POTION_DATA } from '../config/cardData';
import { BattleSystem, IBattleSceneContext } from '../systems/BattleSystem';
import { StageManager, IStageSceneContext } from '../systems/StageManager';
import { CardSystem, ICardSceneContext } from '../systems/CardSystem';
import { UIManager, IUISceneContext } from '../ui/UIManager';
import { OverlayManager, IOverlaySceneContext } from '../ui/OverlayManager';

function cv(base: number, level: number): number {
  return level <= 0 ? 0 : base * level;
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

export class GameScene
  extends Phaser.Scene
  implements
    IBattleSceneContext,
    IStageSceneContext,
    ICardSceneContext,
    IUISceneContext,
    IOverlaySceneContext
{
  /* ---- systems ---- */

  public battleSystem!: BattleSystem;
  public stageManager!: StageManager;
  public cardSystem!: CardSystem;
  public uiManager!: UIManager;
  public overlayManager!: OverlayManager;

  /* ---- state ---- */

  public gold = 0;
  public attackPower = INIT_ATK;
  public stage = 1;
  public highestStageCleared = 0;
  public regionBossesKilled = 0;

  public level = 1;
  public xp = 0;
  public xpToNext = 18;
  public pendingLevelUps = 0;
  public cardLevels: Record<string, number> = {};

  public equippedSkills: string[] = [];
  public skillLevels: Record<string, number> = {};
  public quickSlots: QuickSlotData[] = [];

  public playerHp = INIT_HP;
  public playerMaxHp = INIT_HP;
  public playerMp = INIT_MP;
  public playerMaxMp = INIT_MP;
  private mpRegenAccum = 0;
  public attackAccum = 0;
  public autoAttackEnabled = false;
  public chargeTimers: Phaser.Time.TimerEvent[] = [];

  public atkBuffActive = false;
  private atkBuffTimer?: Phaser.Time.TimerEvent;
  public invincible = false;
  private invincibleTimer?: Phaser.Time.TimerEvent;

  /* skill-effect state */
  public stealthActive = false;
  public stealthGuaranteeCrit = false;
  private reflectActive = false;
  private reflectPct = 0;
  private dodgeChance = 0;
  private warcryActive = false;
  private manaOverloadActive = false;
  public monsterStunned = false;
  private monsterWeakened = false;
  private monsterWeakenPct = 0;
  public monsterFrozen = false;
  private shieldDmgReduce = 0;
  private shadowCloneActive = false;
  private shadowCloneMult = 0;
  private dotTimers: Phaser.Time.TimerEvent[] = [];
  private tempCritBonus = 0;

  public gameOver = false;
  public cardSelecting = false;
  public monsters: Monster[] = [];
  public targetMonster: Monster | null = null;
  public waveXpAccum = 0;
  public poisonTimer?: Phaser.Time.TimerEvent;

  public totalKills = 0;
  public totalGoldEarned = 0;

  public hasRevived = false;
  public relicPanel!: RelicPanel;
  private waveText!: Phaser.GameObjects.Text;
  public shopFromDoor = false;
  public restCardPending = false;
  public waitingFirstCard = false;
  public cardRarityBonus: Record<string, number> = {};
  public legendaryEffects: Record<string, boolean> = {};
  public activeSynergies: string[] = [];
  public mageStartRare = false;
  private achData!: AchievementSave;
  private potionUsedThisRun = false;
  public bossHitThisRun = false;
  public cheatInvincible = false;
  public cheatAtk = false;

  public deathMarks: MarkId[] = [];
  public soulData: SoulData | null = null;
  public soulRecovered = false;
  public skillSealed = false;
  public skillSealTimer?: Phaser.Time.TimerEvent;

  /* response system state */
  public emergencyDefCd = 0;
  private emergencyDefActive = false;
  private mageBarrierActive = false;
  private mageBarrierAbsorb = 0;
  public roguePostDodgeTimer?: Phaser.Time.TimerEvent;
  public roguePostDodgeActive = false;

  public bgGraphics!: Phaser.GameObjects.Graphics;

  public startRegion = 1;
  public selectedClass: ClassDef = CLASSES[0];

  public get currentBossType(): 'none' | 'mini' | 'final' {
    return this.stageManager.currentBossType;
  }

  public get doorSelecting(): boolean {
    return this.stageManager.doorSelecting;
  }
  public set doorSelecting(v: boolean) {
    this.stageManager.doorSelecting = v;
  }

  public get stageType(): 'combat' | 'elite' | 'boss' | 'shop' | 'rest' | 'event' {
    return this.stageManager.stageType;
  }

  public get isEliteStage(): boolean {
    return this.stageManager.isEliteStage;
  }

  public get nextCombatCursed(): boolean {
    return this.stageManager.nextCombatCursed;
  }

  public get tempEventAtkBuff(): number {
    return this.stageManager.tempEventAtkBuff;
  }

  get overlayElements(): Phaser.GameObjects.GameObject[] {
    return this.overlayManager.overlayElements;
  }

  get shopOpen(): boolean {
    return this.overlayManager.shopOpen;
  }
  set shopOpen(v: boolean) {
    this.overlayManager.shopOpen = v;
  }

  get pauseOpen(): boolean {
    return this.overlayManager.pauseOpen;
  }
  set pauseOpen(v: boolean) {
    this.overlayManager.pauseOpen = v;
  }

  get narrationActive(): boolean {
    return this.overlayManager.narrationActive;
  }

  get relicOpen(): boolean {
    return this.overlayManager.relicOpen;
  }
  set relicOpen(v: boolean) {
    this.overlayManager.relicOpen = v;
  }

  get skillButtons(): (SkillButton | null)[] {
    return this.uiManager.skillButtons;
  }

  get overdriveGaugeFill(): Phaser.GameObjects.Graphics | undefined {
    return this.uiManager.overdriveGaugeFill;
  }
  set overdriveGaugeFill(v: Phaser.GameObjects.Graphics | undefined) {
    this.uiManager.overdriveGaugeFill = v;
  }

  get overdriveGaugeText(): Phaser.GameObjects.Text | undefined {
    return this.uiManager.overdriveGaugeText;
  }
  set overdriveGaugeText(v: Phaser.GameObjects.Text | undefined) {
    this.uiManager.overdriveGaugeText = v;
  }

  get emergencyDefBtn(): Phaser.GameObjects.Container | undefined {
    return this.uiManager.emergencyDefBtn;
  }

  get parryHintText(): Phaser.GameObjects.Text | undefined {
    return this.uiManager.parryHintText;
  }

  get prestigeCount(): number {
    return this.registry.get('prestigeCount') ?? 0;
  }

  get relicPoints(): number {
    return this.registry.get('relicPoints') ?? 0;
  }

  set relicPointsVal(v: number) {
    this.registry.set('relicPoints', v);
  }

  public get shopDiscount(): number {
    return 1 - this.relicLevels.merchant * 0.1;
  }

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

  public get relicLevels(): Record<string, number> {
    const stored = this.registry.get('relicLevels');
    return { ...DEFAULT_RELIC_LEVELS, ...(stored ?? {}) };
  }
  private setRelicLevel(id: string, lv: number) {
    const cur = { ...this.relicLevels };
    cur[id] = lv;
    this.registry.set('relicLevels', cur);
  }

  private get goldMultiplier(): number {
    return 1 + this.prestigeCount * 0.2;
  }

  /* ---- computed: region ---- */

  public get currentRegion(): number {
    return Math.min(REGIONS.length, Math.ceil(this.stage / 20));
  }
  public get localStage(): number {
    return ((this.stage - 1) % 20) + 1;
  }
  public get regionDef(): RegionDef {
    return REGIONS[Math.min(REGIONS.length - 1, this.currentRegion - 1)];
  }

  /* ---- computed: stats ---- */

  public gcv(id: string): number {
    const card = STAT_CARDS.find(c => c.id === id);
    if (!card) return 0;
    return cv(card.baseValue, this.cardLevels[id] ?? 0) + (this.cardRarityBonus[id] ?? 0);
  }
  public getSkillMult(id: string): number {
    return skillMult(id, this.skillLevels[id] ?? 0);
  }
  public hasSynergy(id: string): boolean {
    return this.activeSynergies.includes(id);
  }
  public skillCd(id: string): number {
    return skillCdCalc(id, this.skillLevels[id] ?? 0, this.cooldownReduction);
  }
  public skillCdAt(id: string, level: number): number {
    return skillCdCalc(id, level, this.cooldownReduction);
  }

  private get markMult(): number {
    return this.deathMarks.length >= 5 ? 2 : 1;
  }
  private markCount(id: MarkId): number {
    return this.deathMarks.filter(m => m === id).length * this.markMult;
  }

  public get baseMaxHp(): number {
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

  public get effectiveAtk(): number {
    let base = this.attackPower + Math.floor(this.gcv('atk')) + this.tempEventAtkBuff;
    if (this.playerHp <= this.playerMaxHp * 0.1) {
      base = Math.floor(base * (1 + this.relicLevels.iron * 0.5));
    }
    if (this.atkBuffActive) base = Math.floor(base * 1.5);
    if (this.warcryActive) base = Math.floor(base * 1.5);
    if (this.cheatAtk) base *= 100;
    return base;
  }
  public get critChance(): number {
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
  public get defenseRate(): number {
    let d = this.gcv('def') / 100 + this.relicLevels.shield * 0.05;
    if (this.hasSynergy('iron_guard')) d += 0.1;
    if (this.selectedClass.id === 'warrior') d += 0.15;
    d += this.shieldDmgReduce;
    d -= this.markCount('fear') * 0.1;
    d -= this.stageManager.bossDefenseReduction;
    return Math.min(Math.max(d, -0.5), 0.9);
  }
  public get lifestealRate(): number {
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
  public get attacksPerSec(): number {
    return 1000 / this.attackIntervalMs;
  }
  private get xpMultiplier(): number {
    return 1 + this.relicLevels.sage * 0.15;
  }

  public get goldDropMultiplier(): number {
    return (
      this.goldMultiplier *
      (1 + this.relicLevels.gold_touch * 0.2) *
      (1 + this.markCount('fear') * 0.3)
    );
  }
  public get potionMultiplier(): number {
    return (1 + this.relicLevels.spring * 0.25) * (1 - this.markCount('despair') * 0.2);
  }
  private get skillDamageMult(): number {
    let m = 1 + this.relicLevels.mana * 0.15;
    if (this.selectedClass.id === 'mage') m += 0.3;
    m += this.markCount('curse') * 0.25;
    if (this.manaOverloadActive) m *= 3;
    if (this.battleSystem.overdriveActive) {
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

  public get monsterAttackPower(): number {
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
    this.battleSystem = new BattleSystem(this);
    this.stageManager = new StageManager(this);
    this.cardSystem = new CardSystem(this);
    this.uiManager = new UIManager(this);
    this.overlayManager = new OverlayManager(this);

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

    this.stageManager.createBackground();
    this.uiManager.createUI();
    this.uiManager.createXpBar();
    this.uiManager.createPlayerHpBar();
    this.uiManager.createQuickSlots();
    this.uiManager.createSkillSlots();
    this.relicPanel = new RelicPanel(this, {
      onClose: () => {
        this.overlayManager.relicOpen = false;
      },
      onUpgrade: () => this.updateUI(),
    });

    this.input.keyboard?.on('keydown-ONE', () => this.useQuickSlot(0));
    this.input.keyboard?.on('keydown-TWO', () => this.useQuickSlot(1));
    this.input.keyboard?.on('keydown-Q', () => this.onSkillActivate(0));
    this.input.keyboard?.on('keydown-W', () => this.onSkillActivate(1));
    this.input.keyboard?.on('keydown-E', () => this.onSkillActivate(2));
    this.input.keyboard?.on('keydown-R', () => this.onSkillActivate(3));
    this.input.keyboard?.on('keydown-ENTER', () => this.battleSystem.tryActivateOverdrive());
    this.input.keyboard?.on('keydown-TAB', (e: KeyboardEvent) => {
      e.preventDefault();
      this.stageManager.cycleTarget();
    });
    this.input.keyboard?.on('keydown-ESC', () => this.overlayManager.togglePauseMenu());
    this.input.keyboard?.on('keydown-F9', () => this.overlayManager.toggleCheatInvincible());
    this.input.keyboard?.on('keydown-F10', () => this.overlayManager.toggleCheatAtk());

    this.cardSystem.createSynergyDisplay();
    this.uiManager.createBuffBar();
    this.uiManager.createTooltip();
    this.uiManager.createResponseButtons();
    this.uiManager.createBottomButtons();

    if (isResume) {
      this.uiManager.rebuildSkillUI();
      if (this.autoAttackEnabled) this.uiManager.showAutoAttackBadge();
      this.cardSystem.updateSynergyDisplay();
      this.uiManager.drawQuickSlots();
      this.uiManager.drawPlayerHpBar();
      this.uiManager.drawMpBar();
      this.uiManager.drawXpBar();
      this.updateUI();
      this.stageManager.startStage();
    } else {
      SaveManager.deleteRun();
      const perm = SaveManager.loadPermanent();
      perm.totalPlayCount = (perm.totalPlayCount ?? 0) + 1;
      SaveManager.savePermanent(perm);

      if (this.selectedClass.id === 'mage') this.mageStartRare = true;
      this.uiManager.rebuildSkillUI();

      this.waitingFirstCard = true;

      const showGuidesThenCard = () => {
        this.stageManager.showBasicAtkTutorial(!this.autoAttackEnabled, () => {
          this.battleSystem.parryTutorialShown = true;
          this.stageManager.showParryTutorial();
          this.pendingLevelUps = 1;
          this.cardSelecting = true;
          this.time.delayedCall(500, () => this.cardSystem.showCardSelection(true));
        });
      };

      this.overlayManager.showNarration(NARRATION.gameStart, () => {
        const regionEntry = NARRATION.regionEnter[this.currentRegion];
        if (regionEntry) {
          this.overlayManager.showNarration(regionEntry, () => showGuidesThenCard());
        } else {
          showGuidesThenCard();
        }
      });
    }
    SoundManager.playBattleBgm();
  }

  update(_t: number, delta: number) {
    if (this.gameOver || this.cardSelecting || this.doorSelecting || this.pauseOpen) {
      this.uiManager.drawAtkGauge(0);
      return;
    }

    this.mpRegenAccum += delta;
    if (this.mpRegenAccum >= 1000) {
      this.mpRegenAccum -= 1000;
      if (this.playerMp < this.playerMaxMp) {
        this.playerMp = Math.min(this.playerMaxMp, this.playerMp + this.mpRegenRate);
        this.uiManager.drawMpBar();
        this.refreshSkillButtonStates();
      }
    }
    this.uiManager.checkLowMpWarning();

    if (this.emergencyDefCd > 0) {
      this.emergencyDefCd = Math.max(0, this.emergencyDefCd - delta / 1000);
      this.uiManager.updateEmergencyDefBtn();
    }
    if (this.battleSystem.parryCd > 0) {
      this.battleSystem.parryCd = Math.max(0, this.battleSystem.parryCd - delta / 1000);
      if (this.battleSystem.parryCd <= 0) {
        this.battleSystem.parryReady = true;
        this.uiManager.updateParryCdDisplay();
      }
    }

    const target = this.targetMonster;
    if (!target || target.isDead) {
      this.uiManager.drawAtkGauge(0);
      return;
    }
    if (this.autoAttackEnabled) {
      const basicBtn = this.skillButtons[0];
      if (basicBtn && basicBtn.isReady && !this.skillSealed) {
        this.onSkillActivate(0);
      }
    }
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
    this.chargeTimers = [];
    this.atkBuffActive = false;
    this.invincible = false;
    this.gameOver = false;
    this.cardSelecting = false;
    this.overlayManager.reset();
    this.waveXpAccum = 0;
    this.monsters = [];
    this.targetMonster = null;
    this.hasRevived = false;
    this.shopFromDoor = false;
    this.restCardPending = false;
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
    this.skillSealed = false;
    this.skillSealTimer = undefined;
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
    this.battleSystem.reset();
    this.stageManager.reset();
    this.emergencyDefCd = 0;
    this.emergencyDefActive = false;
    this.mageBarrierActive = false;
    this.mageBarrierAbsorb = 0;
    this.roguePostDodgeActive = false;
    this.roguePostDodgeTimer = undefined;
    this.totalKills = 0;
    this.totalGoldEarned = 0;
    this.uiManager.reset();
    this.cardSystem.reset();
  }

  /* ---- delegated: UI / overlay / cards ---- */

  public drawPlayerHpBar(): void {
    this.uiManager.drawPlayerHpBar();
  }

  public refreshSkillButtonStates(): void {
    this.uiManager.refreshSkillButtonStates();
  }

  public drawOverdriveGauge(): void {
    this.uiManager.drawOverdriveGauge();
  }

  public updateParryCdDisplay(): void {
    this.uiManager.updateParryCdDisplay();
  }

  public updateUI(): void {
    this.uiManager.updateUI();
  }

  public openShop(): void {
    this.overlayManager.openShop();
  }

  public closeOverlay(): void {
    this.overlayManager.closeOverlay();
  }

  public showCardSelection(isFirst?: boolean): void {
    this.cardSystem.showCardSelection(isFirst);
  }

  public showNarration(entry: NarrationEntry, onDone?: () => void): void {
    this.overlayManager.showNarration(entry, onDone);
  }

  public showRunClear(): void {
    this.overlayManager.showRunClear();
  }

  public showGameOver(): void {
    this.overlayManager.showGameOver();
  }

  public showAutoAttackBadge(): void {
    this.uiManager.showAutoAttackBadge();
  }

  public highlightResponseBtns(on: boolean): void {
    this.uiManager.highlightResponseBtns(on);
  }

  public highlightDefenseSkills(on: boolean): void {
    this.uiManager.highlightDefenseSkills(on);
  }

  public drawMpBar(): void {
    this.uiManager.drawMpBar();
  }

  public updateBuffBar(): void {
    this.uiManager.updateBuffBar();
  }

  useQuickSlot(index: number): void {
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
    this.uiManager.drawQuickSlots();
    DamageText.show(this, QSLOT_XS[index], QSLOT_Y - 35, `+${heal} HP`, '#44ff44', '18px');
    if (this.uiManager.qSlotBgs[index]) {
      this.tweens.add({
        targets: this.uiManager.qSlotBgs[index],
        alpha: 0.4,
        duration: 80,
        yoyo: true,
      });
    }
  }

  canAddPotion(lv: number): boolean {
    for (const s of this.quickSlots) {
      if (s.potionLv === lv && s.count < MAX_POTION_STACK) return true;
      if (s.potionLv === 0 || s.count <= 0) return true;
    }
    return false;
  }

  addPotion(lv: number): boolean {
    for (const s of this.quickSlots) {
      if (s.potionLv === lv && s.count < MAX_POTION_STACK) {
        s.count++;
        this.uiManager.drawQuickSlots();
        return true;
      }
    }
    for (const s of this.quickSlots) {
      if (s.potionLv === 0 || s.count <= 0) {
        s.potionLv = lv;
        s.count = 1;
        this.uiManager.drawQuickSlots();
        return true;
      }
    }
    return false;
  }

  useEmergencyDef(): void {
    if (this.gameOver || this.emergencyDefCd > 0) return;

    if (this.selectedClass.id === 'mage') {
      this.emergencyDefCd = 15;
      this.mageBarrierActive = true;
      DamageText.show(this, 400, 200, '🔮 마법 배리어!', '#aa66ff', '24px');
      this.cameras.main.flash(100, 80, 50, 255);
      this.emitParticles(400, 280, [0xaa66ff, 0x6644cc], 8);
      this.battleSystem.addOverdrive(this.battleSystem.bossAttackIncoming ? 30 : 0);
    } else {
      this.emergencyDefCd = 20;
      this.emergencyDefActive = true;
      if (this.battleSystem.bossAttackIncoming) {
        DamageText.show(this, 400, 200, '✨ GUARD! 완전 무효화! ✨', '#44ffaa', '28px');
        this.invincible = true;
        this.battleSystem.addOverdrive(30);
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
    this.uiManager.updateEmergencyDefBtn();
    SoundManager.sfxShield();
  }

  public tryParryBossPattern(incomingDmg: number): boolean {
    if (!this.battleSystem.parryWindowOpen || !this.battleSystem.parryReady) return false;
    const elapsed = Date.now() - this.battleSystem.parryWindowOpenTime;
    const isPerfect = elapsed <= this.battleSystem.getPerfectWindow();
    this.battleSystem.parrySeqId++;
    this.battleSystem.parryWindowOpen = false;
    this.battleSystem.parryWindowTimer?.remove();
    this.battleSystem.parryWindowTimer = undefined;
    this.battleSystem.parryReady = false;
    this.battleSystem.parryCd = 8;
    this.updateParryCdDisplay();
    this.battleSystem.parryGaugeGfx?.clear();
    this.battleSystem.parryAuraGfx?.clear();

    this.battleSystem.parrySuccessCount++;
    this.battleSystem.checkParryMastery();

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

    this.battleSystem.addOverdrive(isPerfect ? 30 : 15);
    return true;
  }

  public tryWarriorBlock(incomingDmg: number): boolean {
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

  public tryMageBarrier(incomingDmg: number): { absorbed: boolean; dmg: number } {
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

  public gainXp(amount: number): void {
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
    this.uiManager.animateXpFill(this.level > prevLevel ? 0 : oldRatio, newRatio);
    this.uiManager.drawXpBar();
    this.updateUI();
    if (this.level > prevLevel) this.cardSystem.showLevelUpEffect();
    if (this.pendingLevelUps > 0 && !this.cardSelecting) {
      this.time.delayedCall(300, () => {
        if (this.pendingLevelUps > 0 && !this.cardSelecting) {
          this.showCardSelection();
        }
      });
    }
  }

  startAtkBuff(): void {
    this.atkBuffActive = true;
    this.atkBuffTimer?.remove();
    this.atkBuffTimer = this.time.delayedCall(30000, () => {
      this.atkBuffActive = false;
      this.updateUI();
    });
    this.updateUI();
  }

  startInvincibility(): void {
    this.invincible = true;
    this.invincibleTimer?.remove();
    this.invincibleTimer = this.time.delayedCall(5000, () => {
      this.invincible = false;
    });
  }

  public showSpecialMonsterTooltip(type: SpecialType) {
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

  public startChargeTimer(monster: Monster) {
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

  public handleSplitMonster(original: Monster) {
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
        this.stageManager.setTarget(baby);
      });
    }
    this.stageManager.setupMonsterAttackTimer();
    if (!this.targetMonster || this.targetMonster.isDead) {
      this.stageManager.retargetNextAlive();
    }
  }

  public awardRelicPoints(pts: number) {
    if (pts <= 0) return;
    this.relicPointsVal = this.relicPoints + pts;
    DamageText.show(this, 400, 100, `+${pts} 💎 유물 포인트`, '#cc88ff', '22px');
    this.updateUI();
  }

  equipSkill(skillId: string, animate = true): void {
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
      if (d) this.uiManager.showMpWarning(d.name, d.mpCost);
    });
    btn.on('tooltip-show', () => this.uiManager.showSkillTooltip(skillId, SLOT_XS[idx], SLOT_Y));
    btn.on('tooltip-hide', () => this.uiManager.hideTooltip());
    this.skillButtons[idx] = btn;
    if (this.uiManager.emptySlotGfx[idx]) this.uiManager.emptySlotGfx[idx].setVisible(false);
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
      this.uiManager.showAutoAttackBadge();
    }
  }

  private isBasicAttackId(id: string): boolean {
    return id.startsWith('basic_');
  }

  onSkillActivate(slotIdx: number): void {
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
      btn?.startCooldown(this.battleSystem.overdriveActive ? 0 : this.skillCd(id));
      return;
    }

    const mpCost = this.battleSystem.overdriveActive ? 0 : def.mpCost;
    if (this.playerMp < mpCost) {
      this.uiManager.showMpWarning(def.name, def.mpCost);
      return;
    }
    this.playerMp -= mpCost;
    this.drawMpBar();
    this.refreshSkillButtonStates();
    this.skillButtons[slotIdx]?.startCooldown(
      this.battleSystem.overdriveActive ? 0 : this.skillCd(id),
    );
    this.battleSystem.addOverdrive(15);
    this.playSfxForType(def.sfxType);
    this.executeSkill(def);
  }

  private playSfxForType(sfx: SfxType): void {
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

  private executeSkill(def: SkillDef): void {
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

  private execSingleDmg(def: SkillDef, mult: number): void {
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

  private execMultiHit(def: SkillDef, mult: number): void {
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

  private execAoe(def: SkillDef, mult: number): void {
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

  private execDot(def: SkillDef, mult: number): void {
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

  private startDot(def: SkillDef, mult: number, seconds: number): void {
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

  private startAoeDot(def: SkillDef, mult: number, seconds: number): void {
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

  private execBuffSelf(def: SkillDef): void {
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

  private applyBuff(effect: string, duration: number): void {
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
    this.uiManager.updateBuffBar();
  }

  private execDebuffEnemy(def: SkillDef, mult: number): void {
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

  private applyDebuff(effect: string, duration: number): void {
    switch (effect) {
      case 'stun':
        this.monsterStunned = true;
        this.stageManager.monsterAttackTimer?.paused &&
          (this.stageManager.monsterAttackTimer.paused = true);
        this.time.delayedCall(duration * 1000, () => {
          this.monsterStunned = false;
          if (this.stageManager.monsterAttackTimer)
            this.stageManager.monsterAttackTimer.paused = false;
        });
        DamageText.show(this, 400, 160, '💫 스턴!', '#ffdd44', '20px');
        break;
      case 'freeze':
        this.monsterFrozen = true;
        if (this.stageManager.monsterAttackTimer)
          this.stageManager.monsterAttackTimer.paused = true;
        this.time.delayedCall(duration * 1000, () => {
          this.monsterFrozen = false;
          if (this.stageManager.monsterAttackTimer)
            this.stageManager.monsterAttackTimer.paused = false;
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

  private execStealth(def: SkillDef): void {
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
    this.uiManager.updateBuffBar();
  }

  private execReflect(def: SkillDef): void {
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
    this.uiManager.updateBuffBar();
  }

  private showSkillVfx(x: number, y: number, color: number, type: string): void {
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

  private applyLifesteal(dmg: number): void {
    if (this.lifestealRate <= 0) return;
    this.playerHp = Math.min(
      this.playerHp + Math.max(1, Math.floor(dmg * this.lifestealRate)),
      this.playerMaxHp,
    );
    this.drawPlayerHpBar();
  }

  /* ================================================================
     AUTO COMBAT
     ================================================================ */

  private onAutoAttack(isAuto = true) {
    const t = this.targetMonster;
    if (this.gameOver || !t || t.isDead) return;
    let dmg = this.effectiveAtk;
    if (this.battleSystem.overdriveActive) dmg = Math.floor(dmg * 2);
    if (this.hasSynergy('berserker')) dmg += 5;
    let color = '#ffffff',
      size = '24px';
    const forceCrit = this.roguePostDodgeActive && this.stealthGuaranteeCrit;
    const odCrit = this.battleSystem.overdriveActive && this.selectedClass?.id === 'rogue';
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
    this.battleSystem.addOverdrive(isAuto ? 5 : 10);
    if (isCrit) this.battleSystem.addOverdrive(20);
    this.battleSystem.addComboHit();

    if (this.battleSystem.overdriveActive) {
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
      const critLabel = this.battleSystem.overdriveActive ? 'CRITICAL!!' : 'CRITICAL!';
      const critSize = this.battleSystem.overdriveActive ? '26px' : '18px';
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
        this.battleSystem.overdriveActive ? 12 : 8,
      );
      if (this.stealthGuaranteeCrit) this.stealthGuaranteeCrit = false;
    } else {
      this.emitParticles(
        t.x + ox,
        t.y + oy,
        this.battleSystem.overdriveActive ? [0xffdd00, 0xffaa00] : undefined,
      );
    }
    this.applyLifesteal(dmg);

    if (
      this.battleSystem.overdriveActive &&
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

  public handleMonsterKill(monster: Monster): void {
    this.stageManager.handleMonsterKill(monster);
  }

  public onMonsterAttack() {
    this.battleSystem.attackSeqActive = false;
    const alive = this.monsters.filter(m => !m.isDead);
    if (this.gameOver || this.cardSelecting || this.doorSelecting || alive.length === 0) return;
    if (this.monsterStunned || this.monsterFrozen) return;
    const attacker = Phaser.Math.RND.pick(alive);
    const atkMult = attacker.isSub ? 0.5 : 1;
    let monAtk = this.monsterAttackPower;
    if (this.currentBossType !== 'none')
      monAtk = Math.floor(monAtk * this.stageManager.bossRageMult);
    if (this.monsterWeakened) monAtk = Math.floor(monAtk * (1 - this.monsterWeakenPct));
    const madnessExtra = this.markCount('madness') * 2;
    const rawDmg = Math.max(
      1,
      Math.floor(monAtk * atkMult * (1 - this.defenseRate)) + madnessExtra,
    );

    attacker.playAttackAnimation();

    if (this.invincible || this.stealthActive) {
      if (this.stealthActive && this.selectedClass.id === 'rogue')
        this.battleSystem.tryRogueDodge();
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
    this.battleSystem.addOverdrive(5);

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

    const hpBar = this.uiManager.playerHpFill;
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

  public playBossStrongHitEffect(dmg: number) {
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

    const hpBar = this.uiManager.playerHpFill;
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
     ACHIEVEMENTS
     ================================================================ */

  private tryUnlock(id: string) {
    if (this.achData.unlocked[id]) return;
    this.achData.unlocked[id] = Date.now();
    SaveManager.saveAchievements(this.achData);
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (def) this.showAchievementPopup(def.icon, def.name);
  }

  public checkAchievements() {
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

  public checkBossNoHit() {
    if (!this.bossHitThisRun && this.currentBossType !== 'none') {
      this.tryUnlock('boss_no_hit');
    }
  }

  public flushAchKills() {
    this.achData.totalKillsAll += this.totalKills;
    SaveManager.saveAchievements(this.achData);
  }

  public flushAchRunComplete() {
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

  public autoSave() {
    SaveManager.saveRun(this.buildRunData());
    this.syncPermanentToStorage();
    this.overlayManager.showSaveIcon();
  }

  public syncPermanentToStorage() {
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

  public deleteRunSave() {
    SaveManager.deleteRun();
  }

  /* ================================================================
     PARTICLES
     ================================================================ */

  public emitParticles(x: number, y: number, colors?: number[], count?: number) {
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
}
