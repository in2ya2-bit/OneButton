import Phaser from 'phaser';
import { DamageText } from '../objects/DamageText';
import { RelicPanel } from '../objects/RelicPanel';
import { SHOP_ITEMS } from '../config/cardData';
import { SaveManager, MarkId, ALL_MARK_IDS, MARK_DEFS } from '../data/SaveManager';
import { SoundManager } from '../data/SoundManager';
import { NARRATION, NarrationEntry } from '../data/narration';
import type { StageManager } from '../systems/StageManager';
import type { BattleSystem } from '../systems/BattleSystem';
import type { ClassDef } from '../data/classes';

export interface IOverlaySceneContext extends Phaser.Scene {
  gold: number;
  shopFromDoor: boolean;
  gameOver: boolean;
  cardSelecting: boolean;
  doorSelecting: boolean;
  stage: number;
  localStage: number;
  startRegion: number;
  level: number;
  totalKills: number;
  totalGoldEarned: number;
  regionBossesKilled: number;
  deathMarks: MarkId[];
  relicLevels: Record<string, number>;
  hasRevived: boolean;
  playerHp: number;
  playerMaxHp: number;
  invincible: boolean;
  skillSealed: boolean;
  cheatInvincible: boolean;
  cheatAtk: boolean;
  selectedClass: ClassDef;
  prestigeCount: number;
  atkBuffActive: boolean;
  skillSealTimer?: Phaser.Time.TimerEvent;
  poisonTimer?: Phaser.Time.TimerEvent;
  roguePostDodgeTimer?: Phaser.Time.TimerEvent;

  relicPanel: RelicPanel;
  stageManager: StageManager;
  battleSystem: BattleSystem;

  readonly shopDiscount: number;

  updateUI(): void;
  drawPlayerHpBar(): void;
  highlightResponseBtns(on: boolean): void;
  checkAchievements(): void;
  autoSave(): void;
  syncPermanentToStorage(): void;
  deleteRunSave(): void;
  flushAchKills(): void;
  flushAchRunComplete(): void;

  canAddPotion(lv: number): boolean;
  addPotion(lv: number): boolean;
  startAtkBuff(): void;
  startInvincibility(): void;

  emitParticles(x: number, y: number, colors?: number[], count?: number): void;
}

export class OverlayManager {
  overlayElements: Phaser.GameObjects.GameObject[] = [];
  pauseElements: Phaser.GameObjects.GameObject[] = [];
  shopOpen = false;
  relicOpen = false;
  pauseOpen = false;

  narrationBg?: Phaser.GameObjects.Graphics;
  narrationText?: Phaser.GameObjects.Text;
  narrationSpeaker?: Phaser.GameObjects.Text;
  narrationActive = false;
  narrationTimer?: Phaser.Time.TimerEvent;
  narrationTypingTimer?: Phaser.Time.TimerEvent;

  private ctx: IOverlaySceneContext;

  constructor(scene: IOverlaySceneContext) {
    this.ctx = scene;
  }

  reset(): void {
    this.overlayElements.forEach(e => e.destroy());
    this.overlayElements = [];
    this.pauseElements.forEach(e => e.destroy());
    this.pauseElements = [];
    this.shopOpen = false;
    this.relicOpen = false;
    this.pauseOpen = false;
    this.dismissNarration();
  }

  toggleShop(): void {
    this.shopOpen ? this.closeOverlay() : this.openShop();
  }

  openShop(): void {
    if (this.ctx.relicPanel?.isOpen) this.ctx.relicPanel.close();
    if (this.relicOpen) this.closeOverlay();
    this.shopOpen = true;
    const els = this.overlayElements;
    const bg = this.ctx.add.graphics().setDepth(250).setAlpha(0);
    bg.fillStyle(0x000000, 0.6);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.ctx.tweens.add({ targets: bg, alpha: 1, duration: 200 });

    const panel = this.ctx.add.graphics().setDepth(251);
    panel.fillStyle(0x1a1a30, 0.95);
    panel.fillRoundedRect(170, 100, 460, 370, 16);
    panel.lineStyle(2, 0x4466aa, 0.8);
    panel.strokeRoundedRect(170, 100, 460, 370, 16);
    els.push(panel);
    els.push(
      this.ctx.add
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
    const closeZ = this.ctx.add
      .zone(605, 115, 40, 30)
      .setInteractive({ useHandCursor: true })
      .setDepth(253);
    closeZ.on('pointerdown', () => this.closeOverlay());
    els.push(closeZ);
    els.push(
      this.ctx.add
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
      const price = Math.floor(item.cost * this.ctx.shopDiscount);
      const can = this.canBuyShopItem(i);
      const row = this.ctx.add.graphics().setDepth(251);
      row.fillStyle(can ? 0x222244 : 0x1a1a28, 0.8);
      row.fillRoundedRect(190, iy, 420, 46, 8);
      els.push(row);
      els.push(this.ctx.add.text(208, iy + 13, item.icon, { fontSize: '18px' }).setDepth(252));
      els.push(
        this.ctx.add
          .text(234, iy + 8, item.name, {
            fontSize: '14px',
            color: can ? '#ffffff' : '#666666',
            fontFamily: 'Arial',
            fontStyle: 'bold',
          })
          .setDepth(252),
      );
      els.push(
        this.ctx.add
          .text(234, iy + 28, item.desc, {
            fontSize: '10px',
            color: can ? '#aaaaaa' : '#555555',
            fontFamily: 'Arial',
          })
          .setDepth(252),
      );
      if (item.kind === 'potion' && !this.ctx.canAddPotion(item.potionLv!)) {
        els.push(
          this.ctx.add
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
        this.ctx.add
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
        const bz = this.ctx.add
          .zone(570, iy + 23, 80, 42)
          .setInteractive({ useHandCursor: true })
          .setDepth(253);
        bz.on('pointerdown', () => this.buyShopItem(i));
        els.push(bz);
      }
    });
    els.push(
      this.ctx.add
        .text(400, 430, `보유: ${this.ctx.gold}G`, {
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

    if (this.ctx.shopFromDoor) {
      const cx = 400,
        cy = 468,
        cw = 200,
        ch = 36;
      const cG = this.ctx.add.graphics().setDepth(251);
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
        this.ctx.add
          .text(cx, cy, '계속하기', {
            fontSize: '16px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setDepth(252),
      );
      const cz = this.ctx.add
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
    const price = Math.floor(item.cost * this.ctx.shopDiscount);
    if (this.ctx.gold < price) return false;
    if (item.kind === 'potion') return this.ctx.canAddPotion(item.potionLv!);
    if (item.buffType === 'atk') return !this.ctx.atkBuffActive;
    return !this.ctx.invincible;
  }

  private buyShopItem(i: number): void {
    const item = SHOP_ITEMS[i];
    const price = Math.floor(item.cost * this.ctx.shopDiscount);
    if (item.kind === 'potion') {
      if (!this.ctx.addPotion(item.potionLv!)) return;
      this.ctx.gold -= price;
    } else {
      this.ctx.gold -= price;
      if (item.buffType === 'atk') this.ctx.startAtkBuff();
      else if (item.buffType === 'invincible') this.ctx.startInvincibility();
    }
    this.ctx.updateUI();
    this.closeOverlay();
  }

  toggleRelic(): void {
    if (this.ctx.relicPanel.isOpen) {
      this.ctx.relicPanel.close();
    } else {
      if (this.shopOpen) this.closeOverlay();
      this.relicOpen = true;
      this.ctx.relicPanel.open();
    }
  }

  closeOverlay(): void {
    this.overlayElements.forEach(e => e.destroy());
    this.overlayElements = [];
    const wasDoor = this.ctx.shopFromDoor;
    this.shopOpen = false;
    this.relicOpen = false;
    this.ctx.shopFromDoor = false;
    if (wasDoor) {
      this.ctx.time.delayedCall(100, () => this.ctx.stageManager.advanceToNextStage());
    }
  }

  showNarration(entry: NarrationEntry, onDone?: () => void): void {
    this.dismissNarration();
    this.narrationActive = true;

    const bw = 600,
      bh = 100,
      bx = (800 - bw) / 2,
      by = (600 - bh) / 2;
    this.narrationBg = this.ctx.add.graphics().setDepth(800);
    this.narrationBg.fillStyle(0x000000, 0.82);
    this.narrationBg.fillRoundedRect(bx, by, bw, bh, 12);
    this.narrationBg.lineStyle(1, 0x666688, 0.4);
    this.narrationBg.strokeRoundedRect(bx, by, bw, bh, 12);

    if (entry.speaker) {
      this.narrationSpeaker = this.ctx.add
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
    this.narrationText = this.ctx.add
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

    const skipText = this.ctx.add
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

    this.narrationTypingTimer = this.ctx.time.addEvent({
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

    const skipZone = this.ctx.add.zone(400, 300, 800, 600).setInteractive().setDepth(799);
    const onSpace = () => dismiss();
    skipZone.on('pointerdown', () => dismiss());
    this.ctx.input.keyboard?.on('keydown-SPACE', onSpace);

    const cleanup = () => {
      skipZone.destroy();
      skipText.destroy();
      this.ctx.input.keyboard?.off('keydown-SPACE', onSpace);
    };

    const autoMs = 3500 + fullText.length * typeSpeed;
    this.narrationTimer = this.ctx.time.delayedCall(autoMs, () => dismiss());
  }

  dismissNarration(): void {
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

  showSaveIcon(): void {
    const icon = this.ctx.add
      .text(770, 8, '💾', {
        fontSize: '20px',
      })
      .setDepth(500)
      .setAlpha(0);
    this.ctx.tweens.add({
      targets: icon,
      alpha: 1,
      duration: 150,
      yoyo: true,
      hold: 350,
      onComplete: () => icon.destroy(),
    });
  }

  showRunClear(): void {
    this.ctx.gameOver = true;
    SoundManager.stopBgm();
    SoundManager.playClearFanfare();
    this.ctx.flushAchRunComplete();
    this.ctx.checkAchievements();
    this.ctx.deleteRunSave();
    this.ctx.syncPermanentToStorage();
    const milestonePts = this.ctx.stageManager.calculateMilestonePoints();
    const bossPts = this.ctx.regionBossesKilled * 3;

    this.showNarration(NARRATION.runClear);

    const overlay = this.ctx.add.graphics().setDepth(400).setAlpha(0);
    overlay.fillStyle(0x000000, 0.8);
    overlay.fillRect(0, 0, 800, 600);
    this.ctx.tweens.add({ targets: overlay, alpha: 1, duration: 600 });

    const title = this.ctx.add
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
    this.ctx.tweens.add({
      targets: title,
      scale: 1,
      duration: 700,
      delay: 400,
      ease: 'Back.easeOut',
    });

    const panelG = this.ctx.add.graphics().setDepth(401);
    panelG.fillStyle(0x1a1a30, 0.9);
    panelG.fillRoundedRect(200, 140, 400, 230, 16);
    panelG.lineStyle(2, 0xffd700, 0.5);
    panelG.strokeRoundedRect(200, 140, 400, 230, 16);
    panelG.setAlpha(0);
    this.ctx.tweens.add({ targets: panelG, alpha: 1, duration: 400, delay: 800 });

    const stats = [
      `처치 몬스터: ${this.ctx.totalKills}`,
      `최고 스테이지: ${this.ctx.stage}`,
      `획득 골드: ${this.ctx.totalGoldEarned}G`,
      `레벨: ${this.ctx.level}`,
      `획득 유물 포인트: ${milestonePts + bossPts}💎`,
    ];
    stats.forEach((s, i) => {
      const t = this.ctx.add
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
      this.ctx.tweens.add({ targets: t, alpha: 1, duration: 300, delay: 900 + i * 120 });
    });

    if (this.ctx.prestigeCount > 0) {
      const pText = this.ctx.add
        .text(400, 380, `프레스티지 보너스: 골드 +${this.ctx.prestigeCount * 20}%`, {
          fontSize: '14px',
          color: '#cc88ff',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(402)
        .setAlpha(0);
      this.ctx.tweens.add({ targets: pText, alpha: 1, duration: 400, delay: 1600 });
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
      const btnBg = this.ctx.add.graphics().setDepth(401).setAlpha(0);
      const draw = (hover: boolean) => {
        btnBg.clear();
        btnBg.fillStyle(hover ? hc : fc, 1);
        btnBg.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 14);
        btnBg.lineStyle(2, bc, 1);
        btnBg.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 14);
      };
      draw(false);
      const bt = this.ctx.add
        .text(bx, by - 6, label, {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(402)
        .setAlpha(0);
      const st = this.ctx.add
        .text(bx, by + 14, sub, {
          fontSize: '10px',
          color: '#aaaaaa',
          fontFamily: 'Arial',
        })
        .setOrigin(0.5)
        .setDepth(402)
        .setAlpha(0);
      this.ctx.tweens.add({
        targets: [btnBg, bt, st],
        alpha: 1,
        duration: 400,
        delay: 1800,
        onComplete: () => {
          const z = this.ctx.add
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
      this.ctx.scene.start('TitleScene'),
    );
    makeBtn(400, 460, '🔄 다시 시작', '같은 지역', 0x993333, 0xbb4444, 0xcc5555, () =>
      this.ctx.scene.restart({
        startRegion: this.ctx.startRegion,
        classId: this.ctx.selectedClass.id,
      }),
    );
    makeBtn(
      660,
      460,
      '⭐ 프레스티지',
      `골드 +${(this.ctx.prestigeCount + 1) * 20}%`,
      0x553399,
      0x7744bb,
      0x9966cc,
      () => this.doPrestige(),
    );
  }

  private doPrestige(): void {
    this.ctx.registry.set('prestigeCount', this.ctx.prestigeCount + 1);
    this.ctx.deleteRunSave();
    this.ctx.syncPermanentToStorage();
    this.ctx.scene.restart({
      startRegion: this.ctx.startRegion,
      classId: this.ctx.selectedClass.id,
    });
  }

  showGameOver(): void {
    if (!this.ctx.hasRevived && this.ctx.relicLevels.immortal > 0) {
      this.ctx.hasRevived = true;
      const healPct = (20 + this.ctx.relicLevels.immortal * 10) / 100;
      this.ctx.playerHp = Math.ceil(this.ctx.playerMaxHp * healPct);
      this.ctx.gameOver = false;
      this.ctx.drawPlayerHpBar();
      DamageText.show(this.ctx, 400, 200, '🔥 불사의 인장 발동!', '#ff6622', '28px');
      this.ctx.cameras.main.flash(500, 255, 100, 0);
      this.ctx.emitParticles(400, 300, [0xff6622, 0xffaa00, 0xffcc00], 15);
      return;
    }
    this.ctx.gameOver = true;
    this.ctx.stageManager.bossSpecialTimer?.remove();
    this.ctx.stageManager.bossPatternTimer?.remove();
    this.ctx.stageManager.bossPatternTimer = undefined;
    this.ctx.stageManager.bossPatternWarning?.destroy();
    this.ctx.stageManager.bossPatternWarning = undefined;
    this.ctx.stageManager.bossDefenseTimer?.remove();
    this.ctx.stageManager.bossDefenseTimer = undefined;
    this.ctx.stageManager.bossDefenseReduction = 0;
    this.ctx.skillSealTimer?.remove();
    this.ctx.skillSealTimer = undefined;
    this.ctx.skillSealed = false;
    this.ctx.stageManager.bossRageTimer?.remove();
    this.ctx.stageManager.bossRageTimer = undefined;
    this.ctx.stageManager.bossRageLevel = 0;
    this.ctx.stageManager.monsterAttackTimer?.remove();
    this.ctx.poisonTimer?.remove();
    this.ctx.battleSystem.bossAttackIncoming = false;
    this.ctx.battleSystem.cancelParrySequence();
    this.ctx.roguePostDodgeTimer?.remove();
    this.ctx.highlightResponseBtns(false);
    this.ctx.stageManager.saveBestLocal();
    this.ctx.stageManager.awardMilestonePoints();
    this.ctx.flushAchKills();
    this.ctx.checkAchievements();
    this.ctx.deleteRunSave();
    this.ctx.syncPermanentToStorage();

    const soulGold = Math.floor(this.ctx.gold * 0.5);
    const existingSoul = SaveManager.loadSoul();
    if (
      existingSoul &&
      existingSoul.stage === this.ctx.stage &&
      existingSoul.region === this.ctx.startRegion
    ) {
      SaveManager.deleteSoul();
    }
    if (soulGold > 0) {
      SaveManager.saveSoul({
        gold: soulGold,
        stage: this.ctx.stage,
        region: this.ctx.startRegion,
      });
    }

    let newMark: MarkId | null = null;
    if (this.ctx.deathMarks.length < 5) {
      const available = ALL_MARK_IDS.filter(id => !this.ctx.deathMarks.includes(id));
      if (available.length > 0) {
        newMark = Phaser.Math.RND.pick(available);
        this.ctx.deathMarks.push(newMark);
        SaveManager.saveMarks(this.ctx.deathMarks);
      }
    }

    SoundManager.stopBgm();
    SoundManager.sfxGameOver();
    SoundManager.playGameOverBgm();

    this.showNarration(NARRATION.gameOver);

    const overlay = this.ctx.add.graphics().setDepth(400).setAlpha(0);
    overlay.fillStyle(0x000000, 0.75);
    overlay.fillRect(0, 0, 800, 600);
    this.ctx.tweens.add({ targets: overlay, alpha: 1, duration: 500 });
    const title = this.ctx.add
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
    this.ctx.tweens.add({
      targets: title,
      scale: 1,
      duration: 600,
      delay: 300,
      ease: 'Back.easeOut',
    });

    const milestonePts = this.ctx.stageManager.calculateMilestonePoints();
    const ptsStr = milestonePts > 0 ? ` · +${milestonePts}💎` : '';
    this.ctx.add
      .text(
        400,
        210,
        `Stage ${this.ctx.localStage}/20 · Lv.${this.ctx.level} · ${this.ctx.totalKills} kills${ptsStr}`,
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
      this.ctx.add
        .text(400, 240, `💀 소울 드롭: ${soulGold}G (Stage ${this.ctx.localStage})`, {
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
      const markText = this.ctx.add
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
      this.ctx.tweens.add({ targets: markText, alpha: 1, duration: 600, delay: 800 });

      if (this.ctx.deathMarks.length >= 5) {
        const cursedText = this.ctx.add
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
        this.ctx.tweens.add({ targets: cursedText, alpha: 1, duration: 600, delay: 1200 });
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
      const g = this.ctx.add.graphics().setDepth(401).setAlpha(0);
      const draw = (hover: boolean) => {
        g.clear();
        g.fillStyle(hover ? hc : fc, 1);
        g.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 14);
        g.lineStyle(2, bc, 1);
        g.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 14);
      };
      draw(false);
      const t = this.ctx.add
        .text(bx, by, label, {
          fontSize: '20px',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(402)
        .setAlpha(0);
      this.ctx.tweens.add({
        targets: [g, t],
        alpha: 1,
        duration: 400,
        delay: 1000,
        onComplete: () => {
          const z = this.ctx.add
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
      this.ctx.scene.restart({
        startRegion: this.ctx.startRegion,
        classId: this.ctx.selectedClass.id,
      }),
    );
    makeGoBtn(540, btnY, '🏠 메인 메뉴', 0x334455, 0x446677, 0x5588aa, () =>
      this.ctx.scene.start('TitleScene'),
    );
  }

  togglePauseMenu(): void {
    if (this.ctx.gameOver) return;
    if (this.pauseOpen) {
      this.hidePauseMenu();
    } else {
      this.showPauseMenu();
    }
  }

  private showPauseMenu(): void {
    this.pauseOpen = true;
    this.ctx.time.paused = true;
    const els = this.pauseElements;
    const bg = this.ctx.add.graphics().setDepth(500).setAlpha(0);
    bg.fillStyle(0x000000, 0.75);
    bg.fillRect(0, 0, 800, 600);
    els.push(bg);
    this.ctx.tweens.add({ targets: bg, alpha: 1, duration: 200 });

    const panel = this.ctx.add.graphics().setDepth(501);
    panel.fillStyle(0x1a1a30, 0.95);
    panel.fillRoundedRect(250, 160, 300, 280, 16);
    panel.lineStyle(2, 0x4466aa, 0.8);
    panel.strokeRoundedRect(250, 160, 300, 280, 16);
    els.push(panel);

    els.push(
      this.ctx.add
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
      const g = this.ctx.add.graphics().setDepth(501);
      const draw = (hover: boolean) => {
        g.clear();
        g.fillStyle(hover ? hc : fc, 1);
        g.fillRoundedRect(400 - bw / 2, y - bh / 2, bw, bh, 10);
        g.lineStyle(2, bc, 1);
        g.strokeRoundedRect(400 - bw / 2, y - bh / 2, bw, bh, 10);
      };
      draw(false);
      els.push(g);
      const t = this.ctx.add
        .text(400, y, label, {
          fontSize: '18px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(502);
      els.push(t);
      const z = this.ctx.add
        .zone(400, y, bw, bh)
        .setInteractive({ useHandCursor: true })
        .setDepth(503);
      z.on('pointerover', () => draw(true));
      z.on('pointerout', () => draw(false));
      z.on('pointerdown', onClick);
      els.push(z);
    };

    makeBtn(260, '▶ 계속하기', 0x334455, 0x446677, 0x5588aa, () => this.hidePauseMenu());
    makeBtn(315, '🏠 메인화면으로', 0x553333, 0x774444, 0xaa5555, () => {
      this.hidePauseMenu();
      SoundManager.stopBgm();
      this.ctx.scene.start('TitleScene');
    });
    makeBtn(370, '🔇 음소거', 0x333355, 0x444477, 0x6666aa, () => {
      const s = SaveManager.loadSettings();
      s.muted = !s.muted;
      SaveManager.saveSettings(s);
      SoundManager.updateSettings(s);
      DamageText.show(this.ctx, 400, 400, s.muted ? '음소거 ON' : '음소거 OFF', '#aabbcc', '16px');
    });
  }

  private hidePauseMenu(): void {
    this.pauseOpen = false;
    this.ctx.time.paused = false;
    this.pauseElements.forEach(e => e.destroy());
    this.pauseElements = [];
  }

  toggleCheatInvincible(): void {
    this.ctx.cheatInvincible = !this.ctx.cheatInvincible;
    this.ctx.invincible = this.ctx.cheatInvincible;
    DamageText.show(
      this.ctx,
      400,
      300,
      this.ctx.cheatInvincible ? 'CHEAT: 무적 ON' : 'CHEAT: 무적 OFF',
      this.ctx.cheatInvincible ? '#00ff00' : '#ff4444',
      '24px',
    );
    this.ctx.updateUI();
  }

  toggleCheatAtk(): void {
    this.ctx.cheatAtk = !this.ctx.cheatAtk;
    DamageText.show(
      this.ctx,
      400,
      330,
      this.ctx.cheatAtk ? 'CHEAT: ATK x100 ON' : 'CHEAT: ATK x100 OFF',
      this.ctx.cheatAtk ? '#00ff00' : '#ff4444',
      '24px',
    );
    this.ctx.updateUI();
  }
}
