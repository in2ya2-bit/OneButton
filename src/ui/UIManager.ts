import Phaser from 'phaser';
import { SkillButton } from '../objects/SkillButton';
import { DamageText } from '../objects/DamageText';
import { ClassDef } from '../data/classes';
import { RegionDef } from '../data/regions';
import { ALL_SKILL_DEFS } from '../data/skillDefs';
import { MarkId, MARK_DEFS } from '../data/SaveManager';
import {
  SHOP_BTN,
  RELIC_BTN,
  HP_BAR,
  MP_BAR,
  XP_BAR,
  MAX_SLOTS,
  SLOT_W,
  SLOT_H,
  SLOT_Y,
  SLOT_XS,
  QSLOT_W,
  QSLOT_H,
  QSLOT_Y,
  QSLOT_XS,
  PLAYER_POS,
} from '../config/constants';
import type { QuickSlotData } from '../types/index';
import { POTION_DATA } from '../config/cardData';
import type { BattleSystem } from '../systems/BattleSystem';
import type { StageManager } from '../systems/StageManager';
export interface IUISceneContext extends Phaser.Scene {
  selectedClass: ClassDef;
  deathMarks: MarkId[];
  gameOver: boolean;
  cardSelecting: boolean;
  doorSelecting: boolean;
  narrationActive: boolean;
  skillSealed: boolean;
  equippedSkills: string[];
  skillLevels: Record<string, number>;
  quickSlots: QuickSlotData[];
  playerMp: number;
  playerMaxMp: number;
  playerHp: number;
  playerMaxHp: number;
  gold: number;
  stage: number;
  localStage: number;
  regionDef: RegionDef;
  currentBossType: 'none' | 'mini' | 'final';
  atkBuffActive: boolean;
  invincible: boolean;
  prestigeCount: number;
  relicPoints: number;
  effectiveAtk: number;
  attacksPerSec: number;
  critChance: number;
  defenseRate: number;
  lifestealRate: number;
  potionMultiplier: number;

  battleSystem: BattleSystem;
  stageManager: StageManager;
  overlayManager: { shopOpen: boolean; toggleShop(): void; toggleRelic(): void };

  xp: number;
  xpToNext: number;
  level: number;
  autoAttackEnabled: boolean;
  emergencyDefCd: number;

  getSkillMult(id: string): number;
  skillCd(id: string): number;
  equipSkill(skillId: string, animate?: boolean): void;
  useQuickSlot(index: number): void;
  onSkillActivate(slotIdx: number): void;
  useEmergencyDef(): void;
  updateUI(): void;
  drawPlayerHpBar(): void;
  drawMpBar(): void;
  emitParticles(x: number, y: number, colors?: number[], count?: number): void;
}

export class UIManager {
  goldText!: Phaser.GameObjects.Text;
  relicPtsText!: Phaser.GameObjects.Text;
  statsLine1!: Phaser.GameObjects.Text;
  statsLine2!: Phaser.GameObjects.Text;
  bonusText!: Phaser.GameObjects.Text;
  stageText!: Phaser.GameObjects.Text;
  waveText!: Phaser.GameObjects.Text;

  xpBarFill!: Phaser.GameObjects.Graphics;
  xpLevelText!: Phaser.GameObjects.Text;

  playerHpBg!: Phaser.GameObjects.Graphics;
  playerHpFill!: Phaser.GameObjects.Graphics;
  playerHpText!: Phaser.GameObjects.Text;
  playerMpFill!: Phaser.GameObjects.Graphics;
  playerMpText!: Phaser.GameObjects.Text;

  shopBtnBg!: Phaser.GameObjects.Graphics;
  relicBtnBg!: Phaser.GameObjects.Graphics;

  emptySlotGfx: Phaser.GameObjects.Graphics[] = [];
  skillButtons: (SkillButton | null)[] = [];

  qSlotBgs: Phaser.GameObjects.Graphics[] = [];
  qSlotIcons: Phaser.GameObjects.Text[] = [];
  qSlotLvTexts: Phaser.GameObjects.Text[] = [];
  qSlotCounts: Phaser.GameObjects.Text[] = [];

  atkGaugeFill!: Phaser.GameObjects.Graphics;
  buffBarContainer?: Phaser.GameObjects.Container;
  tooltipBg?: Phaser.GameObjects.Graphics;
  tooltipText?: Phaser.GameObjects.Text;

  overdriveGaugeBg?: Phaser.GameObjects.Graphics;
  overdriveGaugeFill?: Phaser.GameObjects.Graphics;
  overdriveGaugeText?: Phaser.GameObjects.Text;
  emergencyDefBtn?: Phaser.GameObjects.Container;
  emergencyDefCdText?: Phaser.GameObjects.Text;
  parryHintText?: Phaser.GameObjects.Text;
  parryCdOverlay?: Phaser.GameObjects.Text;

  autoAttackBadge?: Phaser.GameObjects.Container;

  private mpWarningShown = false;

  private ctx: IUISceneContext;

  constructor(scene: IUISceneContext) {
    this.ctx = scene;
  }

  reset(): void {
    this.emptySlotGfx = [];
    this.skillButtons = [];
    this.qSlotBgs = [];
    this.qSlotIcons = [];
    this.qSlotLvTexts = [];
    this.qSlotCounts = [];
    this.mpWarningShown = false;
    this.autoAttackBadge = undefined;
  }

  createUI(): void {
    this.stageText = this.ctx.add
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

    this.waveText = this.ctx.add
      .text(400, 46, '', {
        fontSize: '13px',
        color: '#99aacc',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50);

    this.goldText = this.ctx.add
      .text(12, 58, '', {
        fontSize: '20px',
        color: '#ffd700',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(50);

    this.relicPtsText = this.ctx.add
      .text(770, 30, '', {
        fontSize: '14px',
        color: '#cc88ff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(1, 0.5)
      .setDepth(50);

    this.statsLine1 = this.ctx.add
      .text(12, 80, '', {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(50);

    this.statsLine2 = this.ctx.add
      .text(30, 72, '', {
        fontSize: '16px',
        color: '#66ccff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setDepth(50)
      .setVisible(false);

    this.bonusText = this.ctx.add
      .text(30, 92, '', {
        fontSize: '14px',
        color: '#aaaaaa',
        fontFamily: 'Arial, sans-serif',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setDepth(50)
      .setVisible(false);

    this.atkGaugeFill = this.ctx.add.graphics().setDepth(50);

    const classIconBg = this.ctx.add.graphics().setDepth(49);
    classIconBg.fillStyle(this.ctx.selectedClass.color, 0.7);
    classIconBg.fillRoundedRect(736, 8, 40, 40, 8);
    classIconBg.lineStyle(2, this.ctx.selectedClass.borderColor, 0.9);
    classIconBg.strokeRoundedRect(736, 8, 40, 40, 8);
    this.ctx.add
      .text(756, 22, this.ctx.selectedClass.icon, {
        fontSize: '22px',
      })
      .setOrigin(0.5)
      .setDepth(50);
    this.ctx.add
      .text(756, 42, this.ctx.selectedClass.name, {
        fontSize: '9px',
        color: '#cccccc',
        fontFamily: 'Arial',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(50);

    const playerCharBg = this.ctx.add.graphics().setDepth(49);
    playerCharBg.fillStyle(this.ctx.selectedClass.color, 0.2);
    playerCharBg.fillCircle(PLAYER_POS.x, PLAYER_POS.y, 30);
    playerCharBg.lineStyle(2, this.ctx.selectedClass.borderColor, 0.6);
    playerCharBg.strokeCircle(PLAYER_POS.x, PLAYER_POS.y, 30);

    this.ctx.add
      .text(PLAYER_POS.x, PLAYER_POS.y, this.ctx.selectedClass.icon, {
        fontSize: '44px',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(50);

    this.createMarkDisplay();
    this.updateUI();
  }

  createMarkDisplay(): void {
    if (this.ctx.deathMarks.length === 0) return;
    const isCursed = this.ctx.deathMarks.length >= 5;
    const startX = 30,
      startY = 200;
    const markBg = this.ctx.add.graphics().setDepth(49);
    markBg.fillStyle(isCursed ? 0x330000 : 0x111122, 0.6);
    markBg.fillRoundedRect(startX - 4, startY - 4, this.ctx.deathMarks.length * 22 + 8, 24, 6);
    if (isCursed) {
      this.ctx.tweens.add({ targets: markBg, alpha: 0.3, duration: 800, yoyo: true, repeat: -1 });
    }
    this.ctx.deathMarks.forEach((markId, i) => {
      const md = MARK_DEFS[markId];
      this.ctx.add
        .text(startX + i * 22 + 8, startY + 8, md.icon, {
          fontSize: '14px',
        })
        .setOrigin(0.5)
        .setDepth(50);
    });
    if (isCursed) {
      this.ctx.add
        .text(startX + this.ctx.deathMarks.length * 22 + 12, startY + 8, '저주받은 자', {
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

  createXpBar(): void {
    const { x, y, w, h } = XP_BAR;
    this.xpLevelText = this.ctx.add
      .text(x + w / 2, y + h + 6, '', {
        fontSize: '10px',
        color: '#88ccff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 0)
      .setDepth(52);
    const bg = this.ctx.add.graphics().setDepth(50);
    bg.fillStyle(0x000000, 0.5);
    bg.fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 4);
    bg.fillStyle(0x222233, 1);
    bg.fillRoundedRect(x, y, w, h, 3);
    this.xpBarFill = this.ctx.add.graphics().setDepth(51);
    this.drawXpBar();
  }

  drawXpBar(): void {
    const { x, y, w, h } = XP_BAR;
    const ratio = Phaser.Math.Clamp(this.ctx.xp / this.ctx.xpToNext, 0, 1);
    const fw = w * ratio;
    this.xpBarFill.clear();
    if (fw > 0) {
      this.xpBarFill.fillStyle(0x44aaff, 1);
      this.xpBarFill.fillRoundedRect(x, y, fw, h, Math.min(3, fw / 2));
    }
    this.xpLevelText.setText(`Lv.${this.ctx.level}  ${this.ctx.xp}/${this.ctx.xpToNext}`);
  }

  animateXpFill(fromRatio: number, toRatio: number): void {
    const { x, y, w, h } = XP_BAR;
    const obj = { r: Phaser.Math.Clamp(fromRatio, 0, 1) };
    this.ctx.tweens.add({
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

  createPlayerHpBar(): void {
    this.playerHpBg = this.ctx.add.graphics().setDepth(50).setVisible(false);
    this.playerHpFill = this.ctx.add.graphics().setDepth(51).setVisible(false);
    this.playerHpText = this.ctx.add.text(0, 0, '').setVisible(false).setDepth(52);
    this.playerMpFill = this.ctx.add.graphics().setDepth(51).setVisible(false);
    this.playerMpText = this.ctx.add.text(0, 0, '').setVisible(false).setDepth(52);
  }

  drawPlayerHpBar(): void {
    // HP bar hidden
  }

  drawMpBar(): void {
    // MP bar hidden
  }

  refreshSkillButtonStates(): void {
    for (let i = 0; i < this.ctx.equippedSkills.length; i++) {
      const sid = this.ctx.equippedSkills[i];
      const def = ALL_SKILL_DEFS[sid];
      const btn = this.skillButtons[i];
      if (!def || !btn) continue;
      btn.setMpDisabled(this.ctx.skillSealed || this.ctx.playerMp < def.mpCost);
    }
  }

  public showMpWarning(_skillName: string, _cost: number): void {
    const msg = this.ctx.add
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
    this.ctx.tweens.add({
      targets: msg,
      alpha: 1,
      duration: 150,
      onComplete: () => {
        this.ctx.tweens.add({
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

  flashMpBar(): void {
    // MP bar hidden
  }

  checkLowMpWarning(): void {
    const ratio = this.ctx.playerMp / this.ctx.playerMaxMp;
    if (ratio <= 0.2 && !this.mpWarningShown && this.ctx.equippedSkills.length > 0) {
      this.mpWarningShown = true;
      DamageText.show(
        this.ctx,
        MP_BAR.x + MP_BAR.w / 2,
        MP_BAR.y + 20,
        '⚠ MP 부족',
        '#4488ff',
        '14px',
      );
      this.flashMpBar();
    } else if (ratio > 0.3) {
      this.mpWarningShown = false;
    }
  }

  createQuickSlots(): void {
    this.ctx.add
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
      this.qSlotBgs.push(this.ctx.add.graphics().setDepth(49));
      this.qSlotIcons.push(
        this.ctx.add
          .text(x, QSLOT_Y - 6, '', { fontSize: '20px' })
          .setOrigin(0.5)
          .setDepth(51),
      );
      this.qSlotLvTexts.push(
        this.ctx.add
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
        this.ctx.add
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
      this.ctx.add
        .text(x - QSLOT_W / 2 + 4, QSLOT_Y - QSLOT_H / 2 + 2, `${i + 1}`, {
          fontSize: '9px',
          color: '#aaaacc',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setDepth(52);
      const zone = this.ctx.add
        .zone(x, QSLOT_Y, QSLOT_W, QSLOT_H)
        .setInteractive({ useHandCursor: true })
        .setDepth(53);
      zone.on('pointerdown', () => this.ctx.useQuickSlot(i));
      const slotIdx = i;
      zone.on('pointerover', () => this.showItemTooltip(slotIdx));
      zone.on('pointerout', () => this.hideTooltip());
    }
    this.drawQuickSlots();
  }

  drawQuickSlots(): void {
    for (let i = 0; i < 2; i++) {
      const x = QSLOT_XS[i],
        slot = this.ctx.quickSlots[i],
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

  createSkillSlots(): void {
    this.ctx.add
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
      const gfx = this.ctx.add.graphics().setDepth(48);
      const sx = SLOT_XS[i];
      gfx.fillStyle(0x1a1a28, 0.5);
      gfx.fillRoundedRect(sx - SLOT_W / 2, SLOT_Y - SLOT_H / 2, SLOT_W, SLOT_H, 10);
      gfx.lineStyle(2, 0x333344, 0.6);
      gfx.strokeRoundedRect(sx - SLOT_W / 2, SLOT_Y - SLOT_H / 2, SLOT_W, SLOT_H, 10);
      this.emptySlotGfx.push(gfx);
      this.ctx.add
        .text(sx, SLOT_Y, '+', {
          fontSize: '22px',
          color: '#333344',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(48);
      this.ctx.add
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

  createPassiveSlot(): void {
    const px = 700,
      py = SLOT_Y;
    const pw = 72,
      ph = 55;
    const cls = this.ctx.selectedClass;

    this.ctx.add
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

    const bg = this.ctx.add.graphics().setDepth(48);
    bg.fillStyle(cls.color, 0.6);
    bg.fillRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 10);
    bg.lineStyle(2, cls.borderColor, 0.8);
    bg.strokeRoundedRect(px - pw / 2, py - ph / 2, pw, ph, 10);

    this.ctx.add
      .text(px, py - 12, cls.icon, {
        fontSize: '22px',
      })
      .setOrigin(0.5)
      .setDepth(49);

    this.ctx.add
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

    const zone = this.ctx.add.zone(px, py, pw, ph).setInteractive().setDepth(50);
    const tooltip = this.ctx.add
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

  createBuffBar(): void {
    this.buffBarContainer = this.ctx.add.container(0, 0).setDepth(52);
    this.updateBuffBar();
  }

  createTooltip(): void {
    this.tooltipBg = this.ctx.add.graphics().setDepth(900).setVisible(false);
    this.tooltipText = this.ctx.add
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

  public showTooltip(x: number, y: number, lines: string[]): void {
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

  public hideTooltip(): void {
    this.tooltipBg?.setVisible(false);
    this.tooltipText?.setVisible(false);
  }

  public showSkillTooltip(skillId: string, sx: number, sy: number): void {
    const def = ALL_SKILL_DEFS[skillId];
    if (!def) return;
    const lv = this.ctx.skillLevels[skillId] ?? 0;
    const mult = this.ctx.getSkillMult(skillId);
    const cd = this.ctx.skillCd(skillId);
    const lines = [
      `${def.icon} ${def.name}  [${def.category}]`,
      def.descFn(mult),
      `MP: ${def.mpCost}  |  쿨타임: ${cd.toFixed(1)}s`,
    ];
    if (lv > 0) lines.push(`강화 Lv.${lv}`);
    this.showTooltip(sx, sy - SLOT_H / 2, lines);
  }

  showItemTooltip(slotIdx: number): void {
    const slot = this.ctx.quickSlots[slotIdx];
    if (!slot || slot.potionLv <= 0 || slot.count <= 0) return;
    const pd = POTION_DATA[slot.potionLv];
    if (!pd) return;
    const healDesc =
      pd.healAmount < 0
        ? 'HP 완전 회복'
        : `HP +${Math.ceil(pd.healAmount * this.ctx.potionMultiplier)}`;
    const lines = [
      `🧪 포션 ${pd.label}`,
      healDesc,
      `보유: ${slot.count}개  |  키: [${slotIdx + 1}]`,
    ];
    this.showTooltip(QSLOT_XS[slotIdx], QSLOT_Y - QSLOT_H / 2, lines);
  }

  createResponseButtons(): void {
    this.createOverdriveGauge();
    this.createEmergencyDefBtn();
    this.createParryUI();
  }

  createOverdriveGauge(): void {
    this.overdriveGaugeBg = this.ctx.add.graphics().setDepth(48).setVisible(false);
    this.overdriveGaugeFill = this.ctx.add.graphics().setDepth(49).setVisible(false);
    this.overdriveGaugeText = this.ctx.add.text(0, 0, '').setVisible(false).setDepth(50);
    this.ctx.battleSystem.odReadyText = this.ctx.add.text(0, 0, '').setVisible(false).setDepth(50);
  }

  private getOdColor(): number {
    return 0x3388ff;
  }

  drawOverdriveGauge(): void {
    // OD gauge hidden
  }

  createEmergencyDefBtn(): void {
    const bx = HP_BAR.x + HP_BAR.w + 30,
      by = HP_BAR.y + 7;
    const bw = 42,
      bh = 38;
    const container = this.ctx.add.container(bx, by).setDepth(52);

    const bg = this.ctx.add.graphics();
    bg.fillStyle(0x224466, 0.8);
    bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    bg.lineStyle(2, 0x44aaff, 0.7);
    bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    container.add(bg);

    const icon = this.ctx.add.text(0, -5, '🛡', { fontSize: '18px' }).setOrigin(0.5);
    container.add(icon);

    this.emergencyDefCdText = this.ctx.add
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

    const zone = this.ctx.add.zone(0, 0, bw, bh).setInteractive({ useHandCursor: true });
    container.add(zone);
    zone.on('pointerdown', () => this.ctx.useEmergencyDef());
    zone.on('pointerover', () => {
      const isMage = this.ctx.selectedClass.id === 'mage';
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

  updateEmergencyDefBtn(): void {
    if (!this.emergencyDefCdText) return;
    if (this.ctx.emergencyDefCd > 0) {
      this.emergencyDefCdText.setText(`${Math.ceil(this.ctx.emergencyDefCd)}s`);
    } else {
      this.emergencyDefCdText.setText('READY');
    }
  }

  createParryUI(): void {
    this.parryHintText = this.ctx.add
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

    this.parryCdOverlay = this.ctx.add
      .text(400, SLOT_Y + SLOT_H / 2 + 46, '', {
        fontSize: '9px',
        color: '#aa8844',
        fontFamily: 'Arial',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(48);

    this.ctx.battleSystem.parryGaugeGfx = this.ctx.add.graphics().setDepth(250);
    this.ctx.battleSystem.parryAuraGfx = this.ctx.add.graphics().setDepth(99);

    this.ctx.input.keyboard?.on('keydown-SPACE', () => this.ctx.battleSystem.attemptParry());
    this.ctx.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) this.ctx.battleSystem.attemptParry();
    });
    this.ctx.game.canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  updateParryCdDisplay(): void {
    if (!this.parryCdOverlay) return;
    if (this.ctx.battleSystem.parryCd > 0) {
      this.parryCdOverlay
        .setText(`패링 쿨타임 ${Math.ceil(this.ctx.battleSystem.parryCd)}s`)
        .setColor('#886644');
    } else {
      this.parryCdOverlay.setText('').setColor('#aa8844');
    }
  }

  showAutoAttackBadge(): void {
    if (this.autoAttackBadge) this.autoAttackBadge.destroy();
    const sx = SLOT_XS[0];
    const container = this.ctx.add
      .container(sx + SLOT_W / 2 - 2, SLOT_Y - SLOT_H / 2 + 2)
      .setDepth(55);
    const bg = this.ctx.add.graphics();
    bg.fillStyle(0x228833, 0.9);
    bg.fillRoundedRect(-22, -8, 44, 16, 4);
    bg.lineStyle(1, 0x44ff66, 0.8);
    bg.strokeRoundedRect(-22, -8, 44, 16, 4);
    const txt = this.ctx.add
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
    this.ctx.tweens.add({
      targets: container,
      alpha: 0.5,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.autoAttackBadge = container;
  }

  rebuildSkillUI(): void {
    this.skillButtons.forEach(b => b?.destroy());
    this.skillButtons = new Array(MAX_SLOTS).fill(null);
    this.emptySlotGfx.forEach(g => g.setVisible(true));
    const skills = [...this.ctx.equippedSkills];
    this.ctx.equippedSkills = [];
    for (const sid of skills) this.ctx.equipSkill(sid, false);
  }

  createBottomButtons(): void {
    this.createShopButton();
    this.createRelicButton();
  }

  private createShopButton(): void {
    const { x, y, w, h } = SHOP_BTN;
    this.shopBtnBg = this.ctx.add.graphics().setDepth(50);
    this.drawBottomBtn(this.shopBtnBg, x, y, w, h, 0x443820, 0xaa8833, false);
    this.ctx.add
      .text(x, y, '🛒 상점', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(51);
    const z = this.ctx.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(52);
    z.on('pointerdown', () => {
      if (!this.ctx.gameOver && !this.ctx.cardSelecting && !this.ctx.doorSelecting)
        this.ctx.overlayManager.toggleShop();
    });
    z.on('pointerover', () =>
      this.drawBottomBtn(this.shopBtnBg, x, y, w, h, 0x5a4a2a, 0xccaa55, true),
    );
    z.on('pointerout', () =>
      this.drawBottomBtn(this.shopBtnBg, x, y, w, h, 0x443820, 0xaa8833, false),
    );
  }

  private createRelicButton(): void {
    const { x, y, w, h } = RELIC_BTN;
    this.relicBtnBg = this.ctx.add.graphics().setDepth(50);
    this.drawBottomBtn(this.relicBtnBg, x, y, w, h, 0x332255, 0x8855cc, false);
    this.ctx.add
      .text(x, y, '💎 유물', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(51);
    const z = this.ctx.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(52);
    z.on('pointerdown', () => {
      if (!this.ctx.gameOver && !this.ctx.cardSelecting && !this.ctx.doorSelecting)
        this.ctx.overlayManager.toggleRelic();
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
  ): void {
    gfx.clear();
    gfx.fillStyle(fill, 1);
    gfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, 10);
    gfx.lineStyle(2, border, 1);
    gfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 10);
  }

  updateBuffBar(): void {
    if (!this.buffBarContainer) return;
    this.buffBarContainer.removeAll(true);
  }

  drawAtkGauge(ratio: number): void {
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

  updateUI(): void {
    const r = this.ctx.regionDef;
    let stageStr = `${r.icon} ${r.name} - Stage ${this.ctx.localStage}/20`;
    if (this.ctx.currentBossType === 'mini') {
      stageStr += '  MINI BOSS';
      this.stageText.setColor('#ff8844');
    } else if (this.ctx.currentBossType === 'final') {
      stageStr += '  BOSS';
      this.stageText.setColor('#ffd700');
    } else {
      this.stageText.setColor('#ffffff');
    }
    this.stageText.setText(stageStr);
    if (this.ctx.stageManager.waveTotal > 0 && this.ctx.stageManager.waveCurrent > 0) {
      this.waveText.setText(
        `Wave ${this.ctx.stageManager.waveCurrent}/${this.ctx.stageManager.waveTotal}`,
      );
      this.waveText.setVisible(true);
    } else {
      this.waveText.setText('');
      this.waveText.setVisible(false);
    }
    this.relicPtsText.setText(`💎 ${this.ctx.relicPoints}`);

    this.goldText.setText(`💰 ${this.ctx.gold}G`);
    const atkStr = this.ctx.atkBuffActive
      ? `⚔ ATK: ${this.ctx.effectiveAtk} 🔥`
      : `⚔ ATK: ${this.ctx.effectiveAtk}`;
    this.statsLine1.setText(atkStr);
    this.statsLine1.setColor(this.ctx.atkBuffActive ? '#ff8844' : '#ff6b6b');
    this.statsLine2.setText(`💨 SPD: ${this.ctx.attacksPerSec.toFixed(2)}/s`);
    const parts: string[] = [];
    if (this.ctx.critChance > 0) parts.push(`CRIT ${Math.floor(this.ctx.critChance * 100)}%`);
    if (this.ctx.defenseRate > 0) parts.push(`DEF ${Math.floor(this.ctx.defenseRate * 100)}%`);
    if (this.ctx.lifestealRate > 0)
      parts.push(`흡혈 ${(this.ctx.lifestealRate * 100).toFixed(1)}%`);
    if (this.ctx.invincible) parts.push('✨무적');
    if (this.ctx.prestigeCount > 0) parts.push(`P×${this.ctx.prestigeCount}`);
    this.bonusText.setText(parts.join('  '));
    this.updateBuffBar();
  }

  highlightResponseBtns(on: boolean): void {
    if (this.emergencyDefBtn) {
      if (on && this.ctx.emergencyDefCd <= 0) {
        this.ctx.tweens.add({
          targets: this.emergencyDefBtn,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 250,
          yoyo: true,
          repeat: -1,
          key: 'edef_pulse',
        });
      } else {
        this.ctx.tweens.killTweensOf(this.emergencyDefBtn);
        this.emergencyDefBtn.setScale(1);
      }
    }
    if (on && this.parryHintText) {
      this.parryHintText.setColor('#ffdd44');
    } else if (this.parryHintText) {
      this.parryHintText.setColor('#887744');
    }
  }

  highlightDefenseSkills(on: boolean): void {
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
}
