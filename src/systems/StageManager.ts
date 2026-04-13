import Phaser from 'phaser';
import { Monster } from '../objects/Monster';
import { DamageText } from '../objects/DamageText';
import { SkillButton } from '../objects/SkillButton';
import { RegionDef } from '../data/regions';
import { SaveManager, SoulData, MarkId } from '../data/SaveManager';
import { SoundManager } from '../data/SoundManager';
import { SpecialType } from '../objects/Monster';
import { NARRATION, NarrationEntry } from '../data/narration';
import {
  MON_BASE_HP,
  MON_HP_GROWTH,
  MON_ATK_INTERVAL_NORMAL,
  MON_ATK_INTERVAL_MINI,
  MON_ATK_INTERVAL_FINAL,
  MAIN_MON_POS,
  SUB_MON_POSITIONS,
} from '../config/constants';
import type { DoorDef, EventDef } from '../types/index';
import { DOOR_DEFS, EVENTS } from '../config/cardData';
import type { BattleSystem } from './BattleSystem';
import type { ClassDef } from '../data/classes';

export interface IStageSceneContext extends Phaser.Scene {
  stage: number;
  startRegion: number;
  readonly currentRegion: number;
  readonly localStage: number;
  readonly regionDef: RegionDef;
  monsters: Monster[];
  targetMonster: Monster | null;
  selectedClass: ClassDef;
  gold: number;
  level: number;
  playerHp: number;
  playerMaxHp: number;
  cardSelecting: boolean;
  gameOver: boolean;
  pauseOpen: boolean;
  relicLevels: Record<string, number>;
  deathMarks: MarkId[];
  battleSystem: BattleSystem;
  highestStageCleared: number;
  attackPower: number;
  regionBossesKilled: number;
  pendingLevelUps: number;
  waveXpAccum: number;
  shopFromDoor: boolean;
  restCardPending: boolean;
  legendaryEffects: Record<string, boolean>;
  readonly goldDropMultiplier: number;
  readonly monsterAttackPower: number;
  readonly defenseRate: number;
  bossHitThisRun: boolean;
  soulRecovered: boolean;
  soulData: SoulData | null;
  overlayElements: Phaser.GameObjects.GameObject[];
  bgGraphics: Phaser.GameObjects.Graphics;
  skillButtons: (SkillButton | null)[];
  attackAccum: number;
  poisonTimer?: Phaser.Time.TimerEvent;
  skillSealTimer?: Phaser.Time.TimerEvent;
  skillSealed: boolean;
  chargeTimers: Phaser.Time.TimerEvent[];
  invincible: boolean;
  stealthActive: boolean;
  emergencyDefCd: number;
  parryHintText?: Phaser.GameObjects.Text;
  emergencyDefBtn?: Phaser.GameObjects.Container;

  showCardSelection(isFirst?: boolean): void;
  updateUI(): void;
  drawPlayerHpBar(): void;
  closeOverlay(): void;
  checkAchievements(): void;
  autoSave(): void;
  showRunClear(): void;
  showGameOver(): void;
  emitParticles(x: number, y: number, colors?: number[], count?: number): void;
  openShop(): void;
  gainXp(amount: number): void;
  showNarration(entry: NarrationEntry, onDone?: () => void): void;
  tryParryBossPattern(incomingDmg: number): boolean;
  tryMageBarrier(incomingDmg: number): { absorbed: boolean; dmg: number };
  tryWarriorBlock(incomingDmg: number): boolean;
  playBossStrongHitEffect(dmg: number): void;
  checkBossNoHit(): void;
  handleSplitMonster(monster: Monster): void;
  startChargeTimer(monster: Monster): void;
  showSpecialMonsterTooltip(type: SpecialType): void;
  highlightDefenseSkills(on: boolean): void;
  highlightResponseBtns(on: boolean): void;
  refreshSkillButtonStates(): void;
  checkBossNoHit(): void;
  awardRelicPoints(pts: number): void;
  totalKills: number;
  totalGoldEarned: number;
}

export class StageManager {
  waveTotal = 0;
  waveCurrent = 0;
  stageType: 'combat' | 'elite' | 'boss' | 'shop' | 'rest' | 'event' = 'combat';
  doorSelecting = false;
  isEliteStage = false;
  nextCombatCursed = false;
  tempEventAtkBuff = 0;
  currentBossType: 'none' | 'mini' | 'final' = 'none';
  bossSpecialTimer?: Phaser.Time.TimerEvent;
  bossRageTimer?: Phaser.Time.TimerEvent;
  bossRageLevel = 0;
  monsterAttackTimer?: Phaser.Time.TimerEvent;
  pendingStageClear = false;
  pendingStageClearBoss = false;
  waveClearing = false;
  bossPatternTimer?: Phaser.Time.TimerEvent;
  bossPatternWarning?: Phaser.GameObjects.Text;
  bossDefenseReduction = 0;
  bossDefenseTimer?: Phaser.Time.TimerEvent;
  bossBgOverlay?: Phaser.GameObjects.Graphics;

  private ctx: IStageSceneContext;

  constructor(scene: IStageSceneContext) {
    this.ctx = scene;
  }

  get bossRageMult(): number {
    return 1 + this.bossRageLevel * 0.15;
  }

  reset(): void {
    this.waveTotal = 0;
    this.waveCurrent = 0;
    this.stageType = 'combat';
    this.doorSelecting = false;
    this.isEliteStage = false;
    this.nextCombatCursed = false;
    this.tempEventAtkBuff = 0;
    this.currentBossType = 'none';
    this.bossSpecialTimer = undefined;
    this.bossRageTimer = undefined;
    this.bossRageLevel = 0;
    this.monsterAttackTimer = undefined;
    this.pendingStageClear = false;
    this.pendingStageClearBoss = false;
    this.waveClearing = false;
    this.bossPatternTimer = undefined;
    this.bossPatternWarning = undefined;
    this.bossDefenseReduction = 0;
    this.bossDefenseTimer = undefined;
    this.bossBgOverlay?.destroy();
    this.bossBgOverlay = undefined;
  }

  createBackground(): void {
    this.ctx.bgGraphics = this.ctx.add.graphics();
    this.drawRegionBackground();
  }

  drawRegionBackground(): void {
    const r = this.ctx.regionDef;
    this.ctx.bgGraphics.clear();
    this.ctx.bgGraphics.fillGradientStyle(r.bgTop, r.bgTop, r.bgBot, r.bgBot, 1, 1, 1, 1);
    this.ctx.bgGraphics.fillRect(0, 0, 800, 600);
    this.ctx.bgGraphics.fillStyle(r.panelColor, 0.25);
    this.ctx.bgGraphics.fillRect(0, 430, 800, 170);
    this.ctx.bgGraphics.lineStyle(1, 0x1a5276, 0.4);
    this.ctx.bgGraphics.lineBetween(0, 430, 800, 430);
    this.ctx.bgGraphics.fillStyle(0xffffff, 0.04);
    this.ctx.bgGraphics.fillCircle(400, 300, 160);
    this.ctx.bgGraphics.fillStyle(0xffffff, 0.03);
    this.ctx.bgGraphics.fillCircle(400, 300, 120);
  }

  showBossBackground(isFinal: boolean): void {
    this.hideBossBackground();
    this.bossBgOverlay = this.ctx.add.graphics().setDepth(1);
    this.bossBgOverlay.fillStyle(isFinal ? 0x4a0000 : 0x3a1500, 0.35);
    this.bossBgOverlay.fillRect(0, 0, 800, 600);
    const bc = isFinal ? 0xff0000 : 0xff6600;
    this.bossBgOverlay.lineStyle(4, bc, 0.45);
    this.bossBgOverlay.strokeRect(2, 2, 796, 596);
    this.bossBgOverlay.lineStyle(2, bc, 0.2);
    this.bossBgOverlay.strokeRect(8, 8, 784, 584);
    this.ctx.tweens.add({
      targets: this.bossBgOverlay,
      alpha: 0.6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  hideBossBackground(): void {
    this.bossBgOverlay?.destroy();
    this.bossBgOverlay = undefined;
  }

  private getWaveCount(): number {
    if (this.currentBossType !== 'none') return 1;
    const ls = this.ctx.localStage;
    if (ls <= 3) return 3;
    if (ls <= 7) return 4;
    if (ls <= 9) return 5;
    if (ls <= 15) return 4 + (Math.random() < 0.5 ? 1 : 0);
    return 5 + (Math.random() < 0.5 ? 1 : 0);
  }

  startStage(): void {
    if (!this.ctx.soulRecovered) this.checkSoulRecovery();
    const ls = this.ctx.localStage;
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

  spawnNextWave(): void {
    this.waveClearing = false;
    this.waveCurrent++;
    this.ctx.updateUI();
    this.spawnMonster();

    if (this.ctx.pendingLevelUps > 0 && this.ctx.cardSelecting) {
      this.ctx.time.delayedCall(500, () => this.ctx.showCardSelection(true));
    }
  }

  showBasicAtkTutorial(show: boolean, onDone?: () => void): void {
    if (!show) {
      onDone?.();
      return;
    }
    const bg = this.ctx.add.graphics().setDepth(400);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(150, 230, 500, 50, 10);
    bg.lineStyle(1, 0x66ccff, 0.6);
    bg.strokeRoundedRect(150, 230, 500, 50, 10);
    const txt = this.ctx.add
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
    this.ctx.time.delayedCall(3000, () => {
      this.ctx.tweens.add({
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

  showParryTutorial(): void {
    const bg = this.ctx.add.graphics().setDepth(400);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRoundedRect(150, 360, 500, 60, 10);
    bg.lineStyle(1, 0xffcc44, 0.6);
    bg.strokeRoundedRect(150, 360, 500, 60, 10);
    const txt = this.ctx.add
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
    this.ctx.time.delayedCall(5000, () => {
      this.ctx.tweens.add({
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

  onStageClear(wasBossForMemory: boolean): void {
    if (wasBossForMemory && this.ctx.relicLevels.memory > 0) {
      const heal = this.ctx.relicLevels.memory * 20;
      this.ctx.playerHp = Math.min(this.ctx.playerHp + heal, this.ctx.playerMaxHp);
      this.ctx.drawPlayerHpBar();
      DamageText.show(this.ctx, 400, 160, `+${heal} HP (전투의 기억)`, '#ff88cc', '18px');
    }

    this.nextCombatCursed = false;
    this.tempEventAtkBuff = 0;

    this.advanceToNextStage();
  }

  advanceToNextStage(): void {
    this.ctx.stage++;
    this.ctx.highestStageCleared = Math.max(this.ctx.highestStageCleared, this.ctx.stage - 1);
    this.pendingStageClear = false;
    this.pendingStageClearBoss = false;
    this.ctx.checkAchievements();
    this.ctx.autoSave();
    this.checkSoulRecovery();
    const ls = this.ctx.localStage;

    if (ls > 20) return;

    if (this.ctx.legendaryEffects.hp && this.ctx.playerHp < this.ctx.playerMaxHp) {
      this.ctx.playerHp = Math.min(this.ctx.playerHp + 5, this.ctx.playerMaxHp);
      this.ctx.drawPlayerHpBar();
      DamageText.show(this.ctx, 400, 180, '+5 HP', '#88ff88', '14px');
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

  showDoorSelection(): void {
    this.doorSelecting = true;
    const els = this.ctx.overlayElements;

    const bg = this.ctx.add.graphics().setDepth(280).setAlpha(0);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.ctx.tweens.add({ targets: bg, alpha: 1, duration: 300 });

    els.push(
      this.ctx.add
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
      this.ctx.add
        .text(
          400,
          115,
          `${this.ctx.regionDef.icon} ${this.ctx.regionDef.name} - Stage ${this.ctx.localStage}/20`,
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

      const card = this.ctx.add.graphics().setDepth(281);
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
        this.ctx.add
          .text(dx, dy - 90, door.icon, { fontSize: '48px' })
          .setOrigin(0.5)
          .setDepth(282),
      );
      els.push(
        this.ctx.add
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
        this.ctx.add
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
          this.ctx.add
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
          this.ctx.add
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
        this.ctx.add
          .text(dx, dy + doorH / 2 - 30, '클릭하여 선택', {
            fontSize: '11px',
            color: '#555577',
            fontFamily: 'Arial',
          })
          .setOrigin(0.5)
          .setDepth(282),
      );

      const z = this.ctx.add
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
    const ls = this.ctx.localStage;
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

  selectDoor(type: string): void {
    this.doorSelecting = false;
    this.ctx.pendingLevelUps = 0;
    this.pendingStageClear = false;
    this.pendingStageClearBoss = false;
    this.ctx.cardSelecting = false;
    this.ctx.closeOverlay();
    this.stageType = type as 'combat' | 'elite' | 'boss' | 'shop' | 'rest' | 'event';
    this.ctx.autoSave();
    this.startStage();
  }

  openShopFromDoor(): void {
    this.ctx.shopFromDoor = true;
    this.ctx.openShop();
  }

  showRestScreen(): void {
    this.ctx.restCardPending = true;
    const els = this.ctx.overlayElements;
    const bg = this.ctx.add.graphics().setDepth(280).setAlpha(0);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.ctx.tweens.add({ targets: bg, alpha: 1, duration: 300 });

    els.push(
      this.ctx.add
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

    const heal = Math.ceil(this.ctx.playerMaxHp * 0.3);
    this.ctx.playerHp = Math.min(this.ctx.playerHp + heal, this.ctx.playerMaxHp);
    this.ctx.drawPlayerHpBar();

    els.push(
      this.ctx.add
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
      this.ctx.add
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

    const btnG = this.ctx.add.graphics().setDepth(281);
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
      this.ctx.add
        .text(bx, by, '계속하기', {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(282),
    );
    const z = this.ctx.add
      .zone(bx, by, bw, bh)
      .setInteractive({ useHandCursor: true })
      .setDepth(283);
    z.on('pointerover', () => drawBtn(true));
    z.on('pointerout', () => drawBtn(false));
    z.on('pointerdown', () => {
      this.ctx.closeOverlay();
      this.ctx.pendingLevelUps++;
      this.ctx.cardSelecting = true;
      this.ctx.showCardSelection();
    });
    els.push(z);
  }

  showEventScreen(): void {
    const evt = Phaser.Math.RND.pick(EVENTS);
    const els = this.ctx.overlayElements;

    const bg = this.ctx.add.graphics().setDepth(280).setAlpha(0);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.ctx.tweens.add({ targets: bg, alpha: 1, duration: 300 });

    els.push(
      this.ctx.add.text(400, 130, evt.icon, { fontSize: '60px' }).setOrigin(0.5).setDepth(281),
    );
    els.push(
      this.ctx.add
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
      this.ctx.add
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
      this.ctx.add
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

    const btnG = this.ctx.add.graphics().setDepth(281);
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
      this.ctx.add
        .text(bx, by, '계속하기', {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(282),
    );
    const z = this.ctx.add
      .zone(bx, by, bw, bh)
      .setInteractive({ useHandCursor: true })
      .setDepth(283);
    z.on('pointerover', () => drawBtn(true));
    z.on('pointerout', () => drawBtn(false));
    z.on('pointerdown', () => {
      this.ctx.closeOverlay();
      this.advanceToNextStage();
    });
    els.push(z);
  }

  private applyEvent(evt: EventDef): void {
    switch (evt.id) {
      case 'spring':
        this.ctx.playerHp = this.ctx.playerMaxHp;
        this.ctx.playerMaxHp = Math.max(50, this.ctx.playerMaxHp - 20);
        this.ctx.playerHp = Math.min(this.ctx.playerHp, this.ctx.playerMaxHp);
        this.ctx.drawPlayerHpBar();
        break;
      case 'devil':
        this.ctx.attackPower += 5;
        this.ctx.gold = Math.floor(this.ctx.gold * 0.5);
        break;
      case 'relic_find':
        this.ctx.awardRelicPoints(2);
        break;
      case 'curse':
        this.nextCombatCursed = true;
        break;
      case 'bless':
        this.tempEventAtkBuff = 10;
        break;
    }
    this.ctx.updateUI();
  }

  spawnMonster(): void {
    const ls = this.ctx.localStage;
    if (ls === 10 || ls === 20) {
      this.showBossWarning(ls === 20, () => this.doSpawnMonster());
    } else {
      this.doSpawnMonster();
    }
  }

  private getSubCount(): number {
    const base = 1 + Math.floor((this.waveCurrent - 1) / 2);
    const stageBonus = Math.floor((this.ctx.localStage - 1) / 7);
    return Math.min(SUB_MON_POSITIONS.length, base + stageBonus);
  }

  private doSpawnMonster(): void {
    const ls = this.ctx.localStage;
    const isMiniBoss = ls === 10;
    const isRegionBoss = ls === 20;
    const isBoss = isMiniBoss || isRegionBoss;

    this.ctx.monsters = [];
    this.ctx.targetMonster = null;

    const r = this.ctx.regionDef;
    let baseHp = Math.floor(MON_BASE_HP * Math.pow(MON_HP_GROWTH, this.ctx.stage - 1) * r.hpMult);
    let goldDrop = Math.floor(this.ctx.stage * 4 * this.ctx.goldDropMultiplier * r.goldMult);

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

      const boss = new Monster(this.ctx, MAIN_MON_POS.x, MAIN_MON_POS.y, {
        name: bossName,
        hp: baseHp * hpMult,
        gold: goldDrop * goldMult,
        type: bossType,
        size: Math.floor(bossSize * 1.5),
        level: this.ctx.stage,
        nameColor,
      });
      this.ctx.monsters.push(boss);

      this.bossRageLevel = 0;
      this.bossRageTimer = this.ctx.time.addEvent({
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

      const main = new Monster(this.ctx, MAIN_MON_POS.x, MAIN_MON_POS.y, {
        name: data.name,
        hp: baseHp,
        gold: Math.floor(goldDrop * goldMod),
        type: data.type,
        size: data.size,
        level: this.ctx.stage,
        specialType,
      });
      this.ctx.monsters.push(main);

      if (specialType !== 'none') {
        this.ctx.showSpecialMonsterTooltip(specialType);
      }
      if (specialType === 'charge') {
        this.ctx.startChargeTimer(main);
      }

      const subCount = this.getSubCount();
      const subData = pool[0];
      for (let i = 0; i < subCount; i++) {
        const pos = SUB_MON_POSITIONS[i];
        const sub = new Monster(this.ctx, pos.x, pos.y, {
          name: subData.name,
          hp: Math.floor(baseHp * 0.3),
          gold: Math.floor(goldDrop * 0.2),
          type: subData.type,
          size: Math.floor(subData.size * 0.65),
          level: this.ctx.stage,
          isSub: true,
        });
        this.ctx.monsters.push(sub);
      }
    }

    this.setTarget(this.ctx.monsters[0]);
    this.ctx.monsters.forEach(m => {
      m.on('pointerdown', () => {
        if (this.ctx.gameOver || this.ctx.cardSelecting || this.doorSelecting || m.isDead) return;
        this.setTarget(m);
      });
    });

    this.setupMonsterAttackTimer();
    this.ctx.attackAccum = 0;
    this.ctx.updateUI();
  }

  setTarget(monster: Monster): void {
    if (this.ctx.targetMonster === monster) return;
    if (this.ctx.targetMonster && !this.ctx.targetMonster.isDead) {
      this.ctx.targetMonster.setTargeted(false);
    }
    this.ctx.targetMonster = monster;
    this.ctx.targetMonster.setTargeted(true);
  }

  cycleTarget(): void {
    if (this.ctx.gameOver || this.ctx.cardSelecting || this.doorSelecting) return;
    const alive = this.ctx.monsters.filter(m => !m.isDead);
    if (alive.length <= 1) return;
    const curIdx = alive.indexOf(this.ctx.targetMonster!);
    const next = alive[(curIdx + 1) % alive.length];
    this.setTarget(next);
    DamageText.show(this.ctx, next.x, next.y - 60, '▶ TARGET', '#44ddff', '14px');
  }

  retargetNextAlive(): void {
    if (this.ctx.targetMonster) this.ctx.targetMonster.setTargeted(false);
    const alive = this.ctx.monsters.filter(m => !m.isDead);
    if (alive.length > 0) {
      const mainAlive = alive.find(m => !m.isSub);
      this.ctx.targetMonster = mainAlive ?? alive[0];
      this.ctx.targetMonster.setTargeted(true);
    } else {
      this.ctx.targetMonster = null;
    }
  }

  setupMonsterAttackTimer(): void {
    this.monsterAttackTimer?.remove();
    const aliveCount = this.ctx.monsters.filter(m => !m.isDead).length;
    if (aliveCount === 0) return;
    let interval: number;
    if (this.currentBossType !== 'none') {
      interval = this.currentBossType === 'final' ? MON_ATK_INTERVAL_FINAL : MON_ATK_INTERVAL_MINI;
    } else {
      interval = Math.max(1500, MON_ATK_INTERVAL_NORMAL - (aliveCount - 1) * 350);
    }
    this.monsterAttackTimer = this.ctx.time.addEvent({
      delay: interval,
      loop: true,
      callback: () => this.ctx.battleSystem.startMonsterAttackSequence(),
    });
  }

  private rollSpecialType(): SpecialType {
    const ls = this.ctx.localStage;
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

  showBossWarning(isFinal: boolean, onComplete: () => void): void {
    SoundManager.sfxBossWarning();
    SoundManager.playBossBgm();
    const r = this.ctx.regionDef;

    const blackout = this.ctx.add.graphics().setDepth(200).setAlpha(0);
    blackout.fillStyle(0x000000, 1);
    blackout.fillRect(0, 0, 800, 600);
    this.ctx.tweens.add({ targets: blackout, alpha: 1, duration: 200 });

    this.ctx.time.delayedCall(500, () => {
      const warningBg = this.ctx.add.graphics().setDepth(200);
      warningBg.fillStyle(isFinal ? 0x220000 : 0x221100, 0.85);
      warningBg.fillRect(0, 0, 800, 600);
      blackout.destroy();

      const warnText = this.ctx.add
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
      this.ctx.tweens.add({
        targets: warnText,
        alpha: 1,
        scale: 1,
        duration: 250,
        ease: 'Back.easeOut',
      });
      this.ctx.tweens.add({
        targets: warnText,
        alpha: 0.2,
        duration: 200,
        yoyo: true,
        repeat: 4,
        delay: 300,
      });

      const bossLabel = isFinal ? `${r.bossName} 등장!` : `${r.miniBossName} 등장!`;
      const nameText = this.ctx.add
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
      this.ctx.tweens.add({
        targets: nameText,
        alpha: 1,
        scale: 1,
        duration: 400,
        delay: 400,
        ease: 'Back.easeOut',
      });

      this.ctx.cameras.main.shake(1000, 0.015);

      const edgeFlash = this.ctx.add.graphics().setDepth(199);
      const ec = isFinal ? 0xff0000 : 0xff8800;
      edgeFlash.lineStyle(8, ec, 0.8);
      edgeFlash.strokeRect(0, 0, 800, 600);
      edgeFlash.lineStyle(3, ec, 0.4);
      edgeFlash.strokeRect(6, 6, 788, 588);
      this.ctx.tweens.add({ targets: edgeFlash, alpha: 0, duration: 250, yoyo: true, repeat: 4 });

      this.ctx.time.delayedCall(2000, () => {
        this.ctx.tweens.add({
          targets: [warningBg, warnText, nameText, edgeFlash],
          alpha: 0,
          duration: 300,
          onComplete: () => {
            warningBg.destroy();
            warnText.destroy();
            nameText.destroy();
            edgeFlash.destroy();
            const region = this.ctx.currentRegion;
            const narr = isFinal
              ? NARRATION.finalBossEnter[region]
              : NARRATION.miniBossEnter[region];
            if (narr) {
              this.ctx.showNarration(narr, () => onComplete());
            } else {
              onComplete();
            }
          },
        });
      });
    });
  }

  private advanceBossRage(isFinal: boolean): void {
    const maxRage = isFinal ? 5 : 4;
    if (this.bossRageLevel >= maxRage) return;
    this.bossRageLevel++;
    const rageColors = ['#ffaa00', '#ff8800', '#ff5500', '#ff2200', '#ff0000'];
    DamageText.show(
      this.ctx,
      400,
      160,
      `분노 ${this.bossRageLevel}단계!`,
      rageColors[this.bossRageLevel - 1],
      '28px',
    );
    this.ctx.cameras.main.shake(200, 0.01 * this.bossRageLevel);
  }

  startBossPatterns(): void {
    this.bossPatternTimer?.remove();
    this.bossPatternTimer = undefined;
    const isFinal = this.currentBossType === 'final';
    const baseCd = isFinal ? 6000 : 8000;
    this.scheduleBossPattern(baseCd);
  }

  private scheduleBossPattern(delay: number): void {
    this.bossPatternTimer = this.ctx.time.delayedCall(delay, () => {
      this.executeBossPattern();
    });
  }

  private executeBossPattern(): void {
    const boss = this.ctx.monsters.find(m => !m.isDead && !m.isSub);
    if (this.ctx.gameOver || this.ctx.cardSelecting || this.doorSelecting || !boss) {
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
        DamageText.show(
          this.ctx,
          boss.x,
          boss.y - 70,
          '💥 분노 폭발! 패턴 가속!',
          '#ff0000',
          '20px',
        );
        this.ctx.cameras.main.shake(300, 0.02);
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
  ): void {
    this.bossPatternWarning?.destroy();
    const hint = responseHint ?? '방어 가능!';
    const warnText = `${text}\n${hint}`;
    const warn = this.ctx.add
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
    this.ctx.tweens.add({
      targets: warn,
      alpha: 0.3,
      duration: 300,
      yoyo: true,
      repeat: Math.floor(warnTime / 600),
    });
    this.ctx.highlightDefenseSkills(true);
    this.ctx.battleSystem.bossAttackIncoming = true;
    this.ctx.highlightResponseBtns(true);
    this.ctx.time.delayedCall(warnTime, () => {
      warn.destroy();
      this.bossPatternWarning = undefined;
      this.ctx.highlightDefenseSkills(false);
      this.ctx.battleSystem.bossAttackIncoming = false;
      this.ctx.highlightResponseBtns(false);
      onExecute();
    });
  }

  private bossPatternSmash(boss: Phaser.GameObjects.Container): void {
    this.showPatternWarning(
      boss,
      '⚔ 강타 준비!',
      '#ffaa00',
      2000,
      () => {
        if (this.ctx.gameOver) return;
        (boss as Monster).playAttackAnimation();
        const rawDmg = Math.max(
          1,
          Math.floor(
            this.ctx.monsterAttackPower * 3 * this.bossRageMult * (1 - this.ctx.defenseRate),
          ),
        );
        if (this.ctx.tryParryBossPattern(rawDmg)) return;
        if (this.ctx.invincible || this.ctx.stealthActive) {
          if (this.ctx.stealthActive) this.ctx.battleSystem.tryRogueDodge();
          DamageText.show(this.ctx, 400, 180, 'IMMUNE', '#66eeff', '24px');
          return;
        }
        const barrier = this.ctx.tryMageBarrier(rawDmg);
        if (barrier.absorbed) return;
        this.ctx.playerHp = Math.max(0, this.ctx.playerHp - rawDmg);
        this.ctx.bossHitThisRun = true;
        this.ctx.tryWarriorBlock(rawDmg);
        this.ctx.drawPlayerHpBar();
        this.ctx.playBossStrongHitEffect(rawDmg);
        if (this.ctx.playerHp <= 0) this.ctx.showGameOver();
      },
      '⚔ 방어/패링 가능!',
    );
  }

  private bossPatternDefense(boss: Phaser.GameObjects.Container): void {
    this.showPatternWarning(boss, '🛡 방어 태세!', '#4488ff', 1500, () => {
      if (this.ctx.gameOver) return;
      this.bossDefenseReduction = -0.8;
      DamageText.show(this.ctx, boss.x, boss.y - 50, '방어! 데미지 -80%', '#4488ff', '18px');
      this.bossDefenseTimer?.remove();
      this.bossDefenseTimer = this.ctx.time.delayedCall(3000, () => {
        this.bossDefenseReduction = 0;
        this.bossDefenseTimer = undefined;
      });
    });
  }

  private bossPatternFuryRush(boss: Phaser.GameObjects.Container): void {
    DamageText.show(this.ctx, boss.x, boss.y - 80, '💢 분노 돌진!', '#ff2200', '22px');
    this.ctx.battleSystem.bossAttackIncoming = true;
    this.ctx.highlightResponseBtns(true);
    this.ctx.cameras.main.shake(200, 0.015);
    const hitTimer = this.ctx.time.addEvent({
      delay: 500,
      repeat: 2,
      callback: () => {
        if (this.ctx.gameOver) {
          hitTimer.remove();
          return;
        }
        const dmg = Math.max(
          1,
          Math.floor(
            this.ctx.monsterAttackPower * 1.5 * this.bossRageMult * (1 - this.ctx.defenseRate),
          ),
        );
        if (this.ctx.tryParryBossPattern(dmg)) {
          hitTimer.remove();
          return;
        }
        if (this.ctx.invincible || this.ctx.stealthActive) {
          DamageText.show(this.ctx, 400, 180, 'IMMUNE', '#66eeff', '20px');
          return;
        }
        const barrier = this.ctx.tryMageBarrier(dmg);
        if (barrier.absorbed) return;
        this.ctx.playerHp = Math.max(0, this.ctx.playerHp - dmg);
        this.ctx.bossHitThisRun = true;
        this.ctx.drawPlayerHpBar();
        DamageText.show(
          this.ctx,
          400 + Phaser.Math.Between(-30, 30),
          180,
          `-${dmg}`,
          '#ff4400',
          '24px',
        );
        this.ctx.cameras.main.shake(150, 0.01);
        this.flashScreenEdges();
        SoundManager.sfxBossHit();
        if (this.ctx.playerHp <= 0) {
          hitTimer.remove();
          this.ctx.showGameOver();
        }
      },
    });
    this.ctx.time.delayedCall(2000, () => {
      this.ctx.battleSystem.bossAttackIncoming = false;
      this.ctx.highlightResponseBtns(false);
    });
  }

  private flashScreenEdges(): void {
    const g = this.ctx.add.graphics().setDepth(150).setAlpha(0.35);
    g.fillStyle(0xff0000, 1);
    g.fillRect(0, 0, 800, 8);
    g.fillRect(0, 592, 800, 8);
    g.fillRect(0, 0, 8, 600);
    g.fillRect(792, 0, 8, 600);
    this.ctx.tweens.add({
      targets: g,
      alpha: 0,
      duration: 350,
      ease: 'Quad.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  private bossPatternAnnihilate(boss: Phaser.GameObjects.Container): void {
    this.showPatternWarning(
      boss,
      '💀 절멸...',
      '#ff0000',
      3000,
      () => {
        if (this.ctx.gameOver) return;
        const dmg = Math.max(1, Math.floor(this.ctx.playerMaxHp * 0.6));
        if (this.ctx.tryParryBossPattern(dmg)) return;
        if (this.ctx.invincible || this.ctx.stealthActive) {
          if (this.ctx.stealthActive) this.ctx.battleSystem.tryRogueDodge();
          DamageText.show(this.ctx, 400, 180, 'IMMUNE', '#66eeff', '24px');
          return;
        }
        const barrier = this.ctx.tryMageBarrier(dmg);
        if (barrier.absorbed) return;
        this.ctx.playerHp = Math.max(0, this.ctx.playerHp - dmg);
        this.ctx.bossHitThisRun = true;
        this.ctx.drawPlayerHpBar();
        this.ctx.playBossStrongHitEffect(dmg);
        this.ctx.emitParticles(400, 280, [0xff0000, 0xff4400], 14);
        if (this.ctx.playerHp <= 0) this.ctx.showGameOver();
      },
      '⚠ 긴급방어/회피 가능!',
    );
  }

  private bossPatternSummon(boss: Phaser.GameObjects.Container): void {
    this.showPatternWarning(boss, '👻 소환!', '#aa44ff', 2000, () => {
      if (this.ctx.gameOver) return;
      const r = this.ctx.regionDef;
      const pool = r.monsters;
      const data = pool[0];
      const baseHp = Math.floor(
        MON_BASE_HP * Math.pow(MON_HP_GROWTH, this.ctx.stage - 1) * r.hpMult * 0.3,
      );
      const goldDrop = Math.floor(this.ctx.stage * 2);
      for (let i = 0; i < 2; i++) {
        const pos = SUB_MON_POSITIONS[i];
        if (!pos) continue;
        const already = this.ctx.monsters.find(m => !m.isDead && Math.abs(m.x - pos.x) < 30);
        if (already) continue;
        const sub = new Monster(this.ctx, pos.x, pos.y, {
          name: data.name,
          hp: baseHp,
          gold: goldDrop,
          type: data.type,
          size: Math.floor(data.size * 0.7),
          level: this.ctx.stage,
          isSub: true,
        });
        this.ctx.monsters.push(sub);
        sub.setAlpha(0);
        this.ctx.tweens.add({ targets: sub, alpha: 1, duration: 300 });
      }
      DamageText.show(this.ctx, boss.x, boss.y - 50, '소환 완료!', '#aa44ff', '18px');
      this.ctx.emitParticles(boss.x, boss.y, [0xaa44ff, 0x6622cc], 8);
    });
  }

  private bossPatternCurse(boss: Phaser.GameObjects.Container): void {
    this.showPatternWarning(
      boss,
      '🔮 저주!',
      '#cc22ff',
      2000,
      () => {
        if (this.ctx.gameOver) return;
        if (this.ctx.tryParryBossPattern(0)) {
          DamageText.show(this.ctx, 400, 200, '저주 반사!', '#ffd700', '22px');
          return;
        }
        if (this.ctx.invincible || this.ctx.stealthActive) {
          if (this.ctx.stealthActive) this.ctx.battleSystem.tryRogueDodge();
          DamageText.show(this.ctx, 400, 180, 'IMMUNE', '#66eeff', '24px');
          return;
        }
        this.ctx.skillSealed = true;
        this.ctx.skillButtons.forEach(btn => btn?.setMpDisabled(true));
        DamageText.show(this.ctx, 400, 250, '🔮 스킬 10초 봉인!', '#cc22ff', '24px');
        this.ctx.cameras.main.flash(200, 100, 0, 200);
        this.ctx.skillSealTimer?.remove();
        this.ctx.skillSealTimer = this.ctx.time.delayedCall(10000, () => {
          this.ctx.skillSealed = false;
          this.ctx.skillSealTimer = undefined;
          this.ctx.refreshSkillButtonStates();
          DamageText.show(this.ctx, 400, 250, '봉인 해제!', '#88ff88', '20px');
        });
      },
      '⚔ 패링/회피 가능!',
    );
  }

  handleMonsterKill(monster: Monster): void {
    this.ctx.totalKills++;
    this.ctx.battleSystem.cancelParrySequence();
    const reward = monster.goldReward;
    this.ctx.gold += reward;
    this.ctx.totalGoldEarned += reward;
    SoundManager.sfxGold();

    const isBoss = !monster.isSub && this.currentBossType !== 'none';
    const wasRegionBoss = this.currentBossType === 'final' && !monster.isSub;
    const wasMini = this.currentBossType === 'mini' && !monster.isSub;

    if (isBoss) {
      DamageText.show(
        this.ctx,
        monster.x,
        monster.y - 50,
        `BOSS KILL! +${reward} G`,
        '#ffd700',
        '28px',
      );
      this.ctx.cameras.main.shake(400, 0.02);
      this.ctx.cameras.main.flash(300, 255, 200, 50);
      this.ctx.emitParticles(monster.x, monster.y, [0xffd700, 0xffaa00, 0xffffff], 20);
    } else {
      const gSize = monster.isSub ? '18px' : '24px';
      DamageText.show(this.ctx, monster.x, monster.y - 30, `+${reward} G`, '#ffd700', gSize);
      this.ctx.cameras.main.shake(150, 0.008);
      this.ctx.emitParticles(
        monster.x,
        monster.y,
        [0xffffff, 0xffcc00, 0xff8800],
        monster.isSub ? 3 : 6,
      );
    }

    if (wasRegionBoss) {
      this.ctx.regionBossesKilled++;
      this.ctx.awardRelicPoints(5);
    }
    if (isBoss && !this.ctx.bossHitThisRun) this.ctx.checkBossNoHit();
    if (this.ctx.legendaryEffects.steal) {
      this.ctx.playerHp = Math.min(this.ctx.playerHp + 10, this.ctx.playerMaxHp);
      this.ctx.drawPlayerHpBar();
      DamageText.show(this.ctx, monster.x, monster.y - 60, '+10 HP', '#ff88cc', '14px');
    }

    const xpMult = wasRegionBoss ? 5 : wasMini ? 3 : monster.isSub ? 0.4 : 1;
    this.ctx.waveXpAccum += Math.floor((5 + this.ctx.stage * 2) * xpMult);

    if (monster === this.ctx.targetMonster) {
      this.retargetNextAlive();
    }

    const shouldSplit = monster.specialType === 'split' && monster.canSplit;

    monster.playDeathAnimation(() => {
      const idx = this.ctx.monsters.indexOf(monster);
      if (idx >= 0) this.ctx.monsters.splice(idx, 1);

      if (shouldSplit) {
        this.ctx.handleSplitMonster(monster);
      }

      this.setupMonsterAttackTimer();

      if (this.waveClearing) return;
      if (this.ctx.monsters.filter(m => !m.isDead).length > 0) return;
      this.waveClearing = true;

      this.ctx.poisonTimer?.remove();
      this.ctx.poisonTimer = undefined;
      this.bossSpecialTimer?.remove();
      this.bossSpecialTimer = undefined;
      this.bossPatternTimer?.remove();
      this.bossPatternTimer = undefined;
      this.bossPatternWarning?.destroy();
      this.bossPatternWarning = undefined;
      this.bossDefenseTimer?.remove();
      this.bossDefenseTimer = undefined;
      this.bossDefenseReduction = 0;
      this.ctx.skillSealTimer?.remove();
      this.ctx.skillSealTimer = undefined;
      this.ctx.skillSealed = false;
      this.bossRageTimer?.remove();
      this.bossRageTimer = undefined;
      this.bossRageLevel = 0;
      this.ctx.chargeTimers.forEach(t => t.remove());
      this.ctx.chargeTimers = [];
      this.ctx.battleSystem.bossAttackIncoming = false;
      this.ctx.battleSystem.cancelParrySequence();
      this.ctx.highlightResponseBtns(false);

      const wasBossForMemory = wasMini || wasRegionBoss;
      const xpGain = this.ctx.waveXpAccum;
      this.ctx.waveXpAccum = 0;

      if (wasRegionBoss) {
        this.ctx.highestStageCleared = Math.max(this.ctx.highestStageCleared, this.ctx.stage);
        this.currentBossType = 'none';
        this.hideBossBackground();
        this.saveBestLocal();
        this.awardMilestonePoints();
        this.ctx.gainXp(xpGain);
        const clearNarr = NARRATION.regionClear[this.ctx.currentRegion];
        if (clearNarr) {
          this.ctx.showNarration(clearNarr, () => this.ctx.showRunClear());
        } else {
          this.ctx.showRunClear();
        }
        return;
      }

      this.currentBossType = 'none';
      this.hideBossBackground();
      SoundManager.playBattleBgm();

      const afterBossNarration = () => {
        if (this.waveCurrent < this.waveTotal) {
          this.ctx.time.delayedCall(500, () => {
            this.ctx.gainXp(xpGain);
            this.spawnNextWave();
          });
          return;
        }
        this.ctx.gainXp(xpGain);
        if (this.ctx.pendingLevelUps > 0) {
          this.pendingStageClear = true;
          this.pendingStageClearBoss = wasBossForMemory;
        } else {
          this.onStageClear(wasBossForMemory);
        }
      };

      if (wasMini) {
        const miniNarr = NARRATION.miniBossClear[this.ctx.currentRegion];
        if (miniNarr) {
          this.ctx.showNarration(miniNarr, afterBossNarration);
        } else {
          afterBossNarration();
        }
      } else {
        afterBossNarration();
      }
    });
  }

  calculateMilestonePoints(): number {
    let pts = 0;
    if (this.ctx.highestStageCleared >= 10) pts += 1;
    if (this.ctx.highestStageCleared >= 20) pts += 3;
    if (this.ctx.highestStageCleared >= 40) pts += 6;
    if (this.ctx.highestStageCleared >= 60) pts += 10;
    return pts;
  }

  awardMilestonePoints(): void {
    const pts = this.calculateMilestonePoints();
    if (pts > 0) this.ctx.awardRelicPoints(pts);
  }

  saveBestLocal(): void {
    const localCleared = this.ctx.highestStageCleared - (this.ctx.startRegion - 1) * 20;
    const key = `bestLocal_${this.ctx.startRegion}`;
    const current: number = this.ctx.registry.get(key) ?? 0;
    if (localCleared > current) {
      this.ctx.registry.set(key, localCleared);
    }
  }

  checkSoulRecovery(): void {
    if (this.ctx.soulRecovered || !this.ctx.soulData) return;
    if (
      this.ctx.soulData.region === this.ctx.startRegion &&
      this.ctx.soulData.stage <= this.ctx.stage
    ) {
      const recovered = this.ctx.soulData.gold;
      this.ctx.gold += recovered;
      SaveManager.deleteSoul();
      this.ctx.soulRecovered = true;
      this.ctx.soulData = null;
      DamageText.show(this.ctx, 400, 250, `💀 소울 회수! +${recovered}G`, '#ffd700', '28px');
      this.ctx.emitParticles(400, 300, [0xffd700, 0xffaa00, 0xffcc44], 12);
      SoundManager.sfxGold();
      this.ctx.updateUI();
    }
  }
}
