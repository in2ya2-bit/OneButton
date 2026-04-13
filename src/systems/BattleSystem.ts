import Phaser from 'phaser';
import { Monster } from '../objects/Monster';
import { SkillButton } from '../objects/SkillButton';
import { DamageText } from '../objects/DamageText';
import { SoundManager } from '../data/SoundManager';
import { ClassDef } from '../data/classes';

export interface IBattleSceneContext extends Phaser.Scene {
  gameOver: boolean;
  cardSelecting: boolean;
  doorSelecting: boolean;
  pauseOpen: boolean;
  monsters: Monster[];
  targetMonster: Monster | null;
  selectedClass: ClassDef;
  currentBossType: 'none' | 'mini' | 'final';
  readonly localStage: number;
  monsterStunned: boolean;
  monsterFrozen: boolean;
  stealthActive: boolean;
  stealthGuaranteeCrit: boolean;
  roguePostDodgeActive: boolean;
  roguePostDodgeTimer?: Phaser.Time.TimerEvent;
  skillButtons: (SkillButton | null)[];
  gold: number;
  readonly effectiveAtk: number;
  overdriveGaugeFill?: Phaser.GameObjects.Graphics;

  drawOverdriveGauge(): void;
  emitParticles(x: number, y: number, colors?: number[], count?: number): void;
  handleMonsterKill(monster: Monster): void;
  updateUI(): void;
  refreshSkillButtonStates(): void;
  onMonsterAttack(): void;
  updateParryCdDisplay(): void;
}

export class BattleSystem {
  /* ---- state (moved from GameScene) ---- */

  overdriveGauge = 0;
  overdriveActive = false;
  overdriveFever = false;
  overdriveTimer?: Phaser.Time.TimerEvent;
  overdriveEdgeGfx?: Phaser.GameObjects.Graphics;
  overdriveCountdown?: Phaser.GameObjects.Text;
  odReadyText?: Phaser.GameObjects.Text;
  odPulseTween?: Phaser.Tweens.Tween;
  odDarkOverlay?: Phaser.GameObjects.Graphics;
  odTimeBar?: Phaser.GameObjects.Graphics;
  odTimeBarBg?: Phaser.GameObjects.Graphics;
  odParticleTimer?: Phaser.Time.TimerEvent;
  odAuraGfx?: Phaser.GameObjects.Graphics;
  odAuraTween?: Phaser.Tweens.Tween;
  odSlotGlowTimer?: Phaser.Time.TimerEvent;
  odEffects: Phaser.GameObjects.GameObject[] = [];

  comboCount = 0;
  comboTimer?: Phaser.Time.TimerEvent;

  parryReady = true;
  parryCd = 0;
  parryWindowOpen = false;
  parryWindowOpenTime = 0;
  parryAttempted = false;
  parryGaugeGfx?: Phaser.GameObjects.Graphics;
  parryWindowTimer?: Phaser.Time.TimerEvent;
  parryAuraGfx?: Phaser.GameObjects.Graphics;
  parrySeqId = 0;
  attackSeqActive = false;
  parryTutorialShown = false;
  firstParryDone = false;
  parrySuccessCount = 0;
  parryMasteryLevel = 0;
  parryIsFakePhase = false;
  parryFakeCompleted = false;
  parryMultiHitQueue: number[] = [];
  parryMultiHitSuccesses = 0;
  bossAttackIncoming = false;
  parryEarlyFailed = false;

  private ctx: IBattleSceneContext;

  constructor(scene: IBattleSceneContext) {
    this.ctx = scene;
  }

  /* ---- reset (called from GameScene.resetState) ---- */

  reset(): void {
    this.overdriveGauge = 0;
    this.overdriveActive = false;
    this.overdriveFever = false;
    this.comboCount = 0;
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
    this.attackSeqActive = false;
    this.firstParryDone = false;
    this.parryTutorialShown = false;
    this.parrySeqId = 0;
    this.odEffects = [];
  }

  /* ---- Overdrive ---- */

  addOverdrive(amount: number): void {
    if (this.overdriveActive) return;
    this.overdriveGauge = Math.min(100, this.overdriveGauge + amount);
    this.ctx.drawOverdriveGauge();
  }

  tryActivateOverdrive(): void {
    if (this.overdriveActive || this.overdriveGauge < 100) return;
    this.activateOverdrive();
  }

  activateOverdrive(): void {
    this.overdriveActive = true;
    this.overdriveFever = this.comboCount >= 30;
    this.overdriveGauge = 100;
    this.odPulseTween?.stop();
    this.odPulseTween = undefined;
    this.ctx.overdriveGaugeFill?.setAlpha(1);
    this.odReadyText?.setAlpha(0);
    this.ctx.drawOverdriveGauge();

    this.ctx.cameras.main.flash(100, 255, 255, 255);
    SoundManager.sfxLevelUp();
    SoundManager.sfxCritical();

    const ring = this.ctx.add.graphics().setDepth(200).setAlpha(1);
    const ringObj = { r: 10, a: 1 };
    this.ctx.tweens.add({
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

    const titleLabel = this.overdriveFever ? '⚡ OVERDRIVE FEVER!! ⚡' : '⚡ OVERDRIVE!! ⚡';
    const titleColor = this.overdriveFever ? '#ff44ff' : '#ffdd00';
    const titleText = this.ctx.add
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
    this.ctx.tweens.add({
      targets: titleText,
      y: 230,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.ctx.tweens.add({
          targets: titleText,
          alpha: 0,
          y: 200,
          duration: 600,
          delay: 600,
          onComplete: () => titleText.destroy(),
        });
      },
    });

    const cls = this.ctx.selectedClass?.id;
    if (cls === 'warrior') {
      if (this.ctx.targetMonster && !this.ctx.targetMonster.isDead) {
        const t = this.ctx.targetMonster;
        const dmg = Math.floor(this.ctx.effectiveAtk * 3);
        t.takeDamage(dmg);
        DamageText.show(this.ctx, t.x, t.y - 50, `⚔ ${dmg}`, '#ffaa00', '32px');
        this.ctx.emitParticles(t.x, t.y, [0xff4422, 0xffcc00], 10);
      }
    } else if (cls === 'mage') {
      const magic = this.ctx.add.graphics().setDepth(195).setAlpha(0);
      magic.lineStyle(2, 0x4488ff, 1);
      magic.strokeCircle(400, 300, 120);
      magic.lineStyle(1, 0xffcc00, 0.8);
      magic.strokeCircle(400, 300, 100);
      magic.lineStyle(1, 0x4488ff, 0.6);
      magic.strokeCircle(400, 300, 80);
      this.ctx.tweens.add({
        targets: magic,
        alpha: 0.8,
        duration: 200,
        yoyo: true,
        hold: 300,
        onComplete: () => magic.destroy(),
      });
      this.ctx.emitParticles(400, 300, [0x4488ff, 0xffcc00, 0xffffff], 16);
    } else if (cls === 'rogue') {
      for (let i = 0; i < 3; i++) {
        const ghost = this.ctx.add.graphics().setDepth(195).setAlpha(0.5);
        ghost.fillStyle(0x9944cc, 0.4);
        ghost.fillCircle(400 + (i - 1) * 50, 300, 25);
        this.ctx.tweens.add({
          targets: ghost,
          alpha: 0,
          x: (i - 1) * 30,
          duration: 600,
          delay: i * 100,
          onComplete: () => ghost.destroy(),
        });
      }
      this.ctx.emitParticles(400, 300, [0x9944cc, 0xffcc00], 14);
    }

    this.ctx.emitParticles(400, 280, [0xffdd00, 0xffaa00, 0xffffff], 24);

    this.odDarkOverlay = this.ctx.add.graphics().setDepth(5).setAlpha(0);
    this.odDarkOverlay.fillStyle(0x000000, 0.25);
    this.odDarkOverlay.fillRect(0, 0, 800, 600);
    this.ctx.tweens.add({ targets: this.odDarkOverlay, alpha: 1, duration: 300 });

    this.overdriveEdgeGfx = this.ctx.add.graphics().setDepth(155);
    const edgeCol = this.overdriveFever ? 0xff44ff : 0xffcc00;
    this.overdriveEdgeGfx.lineStyle(5, edgeCol, 0.9);
    this.overdriveEdgeGfx.strokeRect(2, 2, 796, 596);
    this.overdriveEdgeGfx.lineStyle(2, 0xffffff, 0.3);
    this.overdriveEdgeGfx.strokeRect(6, 6, 788, 588);
    this.ctx.tweens.add({
      targets: this.overdriveEdgeGfx,
      alpha: 0.4,
      duration: 350,
      yoyo: true,
      repeat: -1,
    });

    const tbx = 200,
      tby = 8,
      tbw = 400,
      tbh = 6;
    this.odTimeBarBg = this.ctx.add.graphics().setDepth(200);
    this.odTimeBarBg.fillStyle(0x000000, 0.5);
    this.odTimeBarBg.fillRoundedRect(tbx, tby, tbw, tbh, 3);
    this.odTimeBar = this.ctx.add.graphics().setDepth(201);

    this.odParticleTimer = this.ctx.time.addEvent({
      delay: 120,
      loop: true,
      callback: () => {
        if (!this.overdriveActive) return;
        const px = Phaser.Math.Between(20, 780),
          py = Phaser.Math.Between(20, 580);
        const col = this.overdriveFever
          ? Phaser.Math.RND.pick([0xff44ff, 0xffcc00, 0xffffff])
          : Phaser.Math.RND.pick([0xffdd00, 0xffaa00, 0xffffff]);
        const p = this.ctx.add.graphics().setDepth(6).setAlpha(0.7);
        const sz = Phaser.Math.FloatBetween(1.5, 3.5);
        p.fillStyle(col, 1);
        p.fillCircle(0, 0, sz);
        p.setPosition(px, py);
        this.ctx.tweens.add({
          targets: p,
          y: py - 40,
          alpha: 0,
          duration: Phaser.Math.Between(600, 1200),
          onComplete: () => p.destroy(),
        });
      },
    });

    this.odAuraGfx = this.ctx.add.graphics().setDepth(90);
    const auraObj = { angle: 0 };
    this.odAuraTween = this.ctx.tweens.add({
      targets: auraObj,
      angle: 360,
      duration: 2000,
      repeat: -1,
      onUpdate: () => {
        if (!this.odAuraGfx || !this.ctx.targetMonster) return;
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

    let glowIdx = 0;
    this.odSlotGlowTimer = this.ctx.time.addEvent({
      delay: 200,
      loop: true,
      callback: () => {
        if (!this.overdriveActive) return;
        for (let i = 0; i < this.ctx.skillButtons.length; i++) {
          const btn = this.ctx.skillButtons[i];
          if (!btn) continue;
          btn.setOverdriveGlow(i === glowIdx % this.ctx.skillButtons.length);
        }
        glowIdx++;
      },
    });

    for (const btn of this.ctx.skillButtons) {
      if (btn) btn.resetCooldown();
    }

    let remaining = 5;
    this.overdriveTimer = this.ctx.time.addEvent({
      delay: 1000,
      repeat: 4,
      callback: () => {
        remaining--;
        this.overdriveGauge = Math.max(0, (remaining / 5) * 100);
        this.ctx.drawOverdriveGauge();
        this.drawOdTimeBar(remaining / 5, remaining <= 2);
        if (remaining <= 3 && remaining > 0) {
          if (!this.overdriveCountdown) {
            this.overdriveCountdown = this.ctx.add
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
          this.ctx.tweens.add({
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

    this.ctx.time.paused = true;
    setTimeout(() => {
      if (!this.ctx.pauseOpen) this.ctx.time.paused = false;
    }, 150);
  }

  drawOdTimeBar(ratio: number, urgent: boolean): void {
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

  endOverdrive(): void {
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

    for (const btn of this.ctx.skillButtons) {
      if (btn) btn.setOverdriveGlow(false);
    }

    const endText = this.ctx.add
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
    this.ctx.tweens.add({
      targets: endText,
      alpha: 0,
      y: 220,
      duration: 1000,
      onComplete: () => endText.destroy(),
    });

    if (this.overdriveEdgeGfx) {
      this.ctx.tweens.add({
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
      this.ctx.tweens.add({
        targets: this.odDarkOverlay,
        alpha: 0,
        duration: 500,
        onComplete: () => {
          this.odDarkOverlay?.destroy();
          this.odDarkOverlay = undefined;
        },
      });
    }

    this.ctx.drawOverdriveGauge();
    this.ctx.refreshSkillButtonStates();
  }

  /* ---- Combo ---- */

  addComboHit(): void {
    this.comboCount++;
    this.comboTimer?.remove();
    this.comboTimer = this.ctx.time.delayedCall(3000, () => {
      this.comboCount = 0;
    });
    if (this.comboCount === 10) this.addOverdrive(20);
    else if (this.comboCount === 20) this.addOverdrive(40);
  }

  /* ---- Parry helpers ---- */

  getParryWindow(): number {
    const mastery = this.parryMasteryLevel >= 1 ? 20 : 0;
    if (this.ctx.currentBossType === 'final') return 100 + mastery;
    if (this.ctx.currentBossType === 'mini') return 150 + mastery;
    const hasSpecial = this.ctx.monsters.some(
      m => !m.isDead && m.specialType && m.specialType !== 'none',
    );
    if (hasSpecial) return 150 + mastery;
    return 200 + mastery;
  }

  getPerfectWindow(): number {
    return 80 + (this.parryMasteryLevel >= 2 ? 20 : 0);
  }

  shouldFakeAttack(): boolean {
    const ls = this.ctx.localStage;
    if (this.ctx.currentBossType !== 'none') return Math.random() < 0.4;
    if (ls < 7) return false;
    return Math.random() < Math.min(0.3, (ls - 6) * 0.04);
  }

  getGaugeColor(): number {
    if (this.ctx.currentBossType !== 'none') return 0xff4444;
    if (this.parryIsFakePhase) return 0xff8800;
    return 0xffcc00;
  }

  getBossMultiHitCount(): number {
    if (this.ctx.currentBossType === 'final') return Phaser.Math.Between(2, 3);
    if (this.ctx.currentBossType === 'mini') return Phaser.Math.Between(1, 2);
    return 1;
  }

  checkParryMastery(): void {
    if (this.parrySuccessCount >= 30 && this.parryMasteryLevel < 3) {
      this.parryMasteryLevel = 3;
      DamageText.show(this.ctx, 400, 260, '⚔ 패링 달인! 페이크 힌트 활성', '#ffd700', '18px');
    } else if (this.parrySuccessCount >= 15 && this.parryMasteryLevel < 2) {
      this.parryMasteryLevel = 2;
      DamageText.show(this.ctx, 400, 260, '⚔ 패링 숙련! 퍼펙트 창 확대', '#ffcc44', '16px');
    } else if (this.parrySuccessCount >= 5 && this.parryMasteryLevel < 1) {
      this.parryMasteryLevel = 1;
      DamageText.show(this.ctx, 400, 260, '⚔ 패링 입문! 패링 창 확대', '#ddaa44', '16px');
    }
  }

  cancelParrySequence(): void {
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

  /* ---- Parry attempt ---- */

  attemptParry(): void {
    if (this.ctx.gameOver || !this.parryReady || this.ctx.cardSelecting || this.ctx.doorSelecting)
      return;
    this.parryAttempted = true;

    if (this.parryIsFakePhase) {
      DamageText.show(this.ctx, 400, 230, 'FAKE!', '#ff8800', '22px');
      return;
    }

    if (this.parryWindowOpen) {
      const elapsed = Date.now() - this.parryWindowOpenTime;
      const isPerfect = elapsed <= this.getPerfectWindow();
      this.resolveParryHit(isPerfect);
    } else if (this.attackSeqActive) {
      this.parryEarlyFailed = true;
      DamageText.show(this.ctx, 400, 230, 'TOO EARLY!', '#ff8800', '22px');
      this.parryReady = false;
      this.parryCd = 8;
      this.ctx.updateParryCdDisplay();
    }
  }

  private resolveParryHit(isPerfect: boolean): void {
    this.parryWindowOpen = false;
    this.parryWindowTimer?.remove();
    this.parryWindowTimer = undefined;
    this.parryGaugeGfx?.clear();

    if (this.parryMultiHitQueue.length > 0) {
      this.parryMultiHitSuccesses++;
      if (isPerfect) {
        DamageText.show(this.ctx, 400, 200, '✨ PERFECT!', '#ffd700', '26px');
        this.ctx.emitParticles(400, 280, [0xffd700, 0xffffff], 8);
      } else {
        DamageText.show(this.ctx, 400, 200, 'PARRY!', '#ffcc44', '22px');
      }
      SoundManager.sfxCritical();
      this.parryMultiHitQueue.shift();
      if (this.parryMultiHitQueue.length > 0) {
        this.ctx.time.delayedCall(400, () => this.runMultiHitGauge());
      }
      return;
    }

    this.executeParryReward(isPerfect, false);
  }

  executeParryReward(isPerfect: boolean, isCounterFake: boolean): number {
    this.parrySeqId++;
    this.attackSeqActive = false;
    this.parryWindowOpen = false;
    this.parryAttempted = false;
    this.parryEarlyFailed = false;
    this.parryReady = false;
    this.parryCd = 8;
    this.ctx.updateParryCdDisplay();
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
      this.ctx.drawOverdriveGauge();
      this.activateOverdrive();
    } else if (isPerfect) {
      atkMult = 3;
      odGain = 30;
      dmgReduce = 1;
      label = '✨ PERFECT! ✨';
      color = '#ffd700';
      this.ctx.scene.pause();
      setTimeout(() => {
        if (this.ctx.scene.isPaused() && !this.ctx.pauseOpen) this.ctx.scene.resume();
      }, 100);
    } else {
      atkMult = 1.5;
      odGain = 15;
      dmgReduce = 0.7;
      label = '⚔ PARRY!';
      color = '#ffcc44';
    }

    DamageText.show(
      this.ctx,
      400,
      200,
      label,
      color,
      isPerfect || isCounterFake ? '30px' : '24px',
    );
    this.ctx.cameras.main.flash(200, 255, 200, 50);
    this.ctx.emitParticles(400, 280, [0xffd700, 0xffaa00], isPerfect || isCounterFake ? 14 : 8);
    SoundManager.sfxCritical();

    this.ctx.monsterStunned = true;
    this.ctx.time.delayedCall(1000, () => {
      this.ctx.monsterStunned = false;
    });

    if (this.ctx.targetMonster && !this.ctx.targetMonster.isDead) {
      const counterDmg = Math.floor(this.ctx.effectiveAtk * atkMult);
      const dead = this.ctx.targetMonster.takeDamage(counterDmg);
      DamageText.show(
        this.ctx,
        this.ctx.targetMonster.x,
        this.ctx.targetMonster.y - 50,
        `반격! ${counterDmg}`,
        color,
        '22px',
      );
      if (dead) this.ctx.handleMonsterKill(this.ctx.targetMonster);
    }

    if (!isCounterFake) this.addOverdrive(odGain);

    if (!this.firstParryDone) {
      this.firstParryDone = true;
      this.ctx.gold += 10;
      DamageText.show(this.ctx, 400, 240, '첫 패링! +10G', '#ffdd44', '16px');
      this.ctx.updateUI();
    }

    return dmgReduce;
  }

  /* ---- Monster attack sequence ---- */

  startMonsterAttackSequence(): void {
    const alive = this.ctx.monsters.filter(m => !m.isDead);
    if (
      this.ctx.gameOver ||
      this.ctx.cardSelecting ||
      this.ctx.doorSelecting ||
      this.ctx.pauseOpen ||
      alive.length === 0
    )
      return;
    if (this.ctx.monsterStunned || this.ctx.monsterFrozen) return;
    if (this.attackSeqActive) return;

    this.attackSeqActive = true;
    this.parrySeqId++;
    const seqId = this.parrySeqId;

    const attacker = Phaser.Math.RND.pick(alive);
    const ax = attacker.x,
      ay = attacker.y;
    const isFake = this.shouldFakeAttack();
    const isBossMulti = this.ctx.currentBossType !== 'none' && !isFake;
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
      stale() || this.ctx.gameOver || this.ctx.monsters.filter(m => !m.isDead).length === 0;
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
      const gaugeTween = this.ctx.tweens.add({
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
          this.parryGaugeGfx?.arc(
            ax,
            ay - 55,
            GAUGE_R,
            -Math.PI / 2,
            -Math.PI / 2 + angle,
            false,
          );
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
            this.ctx.time.delayedCall(120, () => {
              if (abortCheck()) {
                cleanup();
                return;
              }
              this.parryGaugeGfx?.clear();
              this.parryIsFakePhase = false;
              this.parryFakeCompleted = true;
              if (this.parryMasteryLevel >= 3) {
                DamageText.show(this.ctx, ax, ay - 80, '👁 페이크!', '#ff8800', '14px');
              }
              this.ctx.time.delayedCall(500, () => {
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

          this.parryWindowTimer = this.ctx.time.delayedCall(pw, () => {
            this.parryWindowTimer = undefined;
            this.parryWindowOpen = false;
            this.parryGaugeGfx?.clear();
            if (abortCheck()) return;
            this.parryGaugeGfx?.lineStyle(5, 0xff2222, 1);
            this.parryGaugeGfx?.strokeCircle(ax, ay - 55, GAUGE_R);
            if (this.parryAttempted && !this.parryEarlyFailed) {
              DamageText.show(this.ctx, 400, 230, 'TOO LATE!', '#ff8800', '22px');
            }
            this.parryEarlyFailed = false;
            this.ctx.time.delayedCall(50, () => {
              this.parryGaugeGfx?.clear();
              if (abortCheck()) return;
              onDone();
            });
          });
        },
      });
    };

    const WARN_MS = 1500;
    const GAUGE_MS = 800;
    this.parryAuraGfx?.clear();
    const auraPulse = { val: 0 };
    const auraTween = this.ctx.tweens.add({
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

    this.ctx.time.delayedCall(WARN_MS - GAUGE_MS, () => {
      if (abortCheck()) {
        auraTween.stop();
        cleanup();
        return;
      }

      const showParryFail = () => {
        if (this.parryAttempted && !this.parryEarlyFailed) {
          DamageText.show(this.ctx, 400, 230, 'MISS!', '#ff4444', '24px');
          this.ctx.cameras.main.flash(100, 200, 0, 0);
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
                this.ctx.onMonsterAttack();
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
            this.ctx.onMonsterAttack();
          },
          color,
          false,
        );
      }
    });
  }

  runMultiHitGauge(): void {
    const alive = this.ctx.monsters.filter(m => !m.isDead);
    if (this.ctx.gameOver || alive.length === 0) return;
    const seqId = this.parrySeqId;
    const attacker = alive[0];
    const ax = attacker.x,
      ay = attacker.y;
    const remaining = this.parryMultiHitQueue.length;
    const total = remaining + this.parryMultiHitSuccesses;
    const GAUGE_R = 18;

    DamageText.show(this.ctx, ax, ay - 80, `${total - remaining + 1}/${total}`, '#ff8844', '14px');

    const pw = this.getParryWindow();
    const GAUGE_MS = 600;
    this.parryAttempted = false;
    this.parryEarlyFailed = false;
    this.parryWindowOpen = false;
    this.parryIsFakePhase = false;

    const stale = () => seqId !== this.parrySeqId;
    const abortCheck = () =>
      stale() || this.ctx.gameOver || this.ctx.monsters.filter(m => !m.isDead).length === 0;

    const gaugeFill = { val: 0 };
    const gaugeTween = this.ctx.tweens.add({
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
        this.parryGaugeGfx?.arc(
          ax,
          ay - 55,
          GAUGE_R,
          -Math.PI / 2,
          -Math.PI / 2 + angle,
          false,
        );
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

        this.parryWindowTimer = this.ctx.time.delayedCall(pw, () => {
          this.parryWindowTimer = undefined;
          this.parryWindowOpen = false;
          this.parryGaugeGfx?.clear();
          if (abortCheck()) return;

          if (this.parryAttempted && !this.parryEarlyFailed) {
            DamageText.show(this.ctx, 400, 230, 'TOO LATE!', '#ff8800', '20px');
          }
          this.parryEarlyFailed = false;

          this.parryMultiHitQueue.shift();
          if (this.parryMultiHitQueue.length > 0) {
            this.ctx.time.delayedCall(300, () => this.runMultiHitGauge());
          } else {
            this.finishMultiHit();
          }
        });
      },
    });
  }

  finishMultiHit(): void {
    this.attackSeqActive = false;
    const total = this.parryMultiHitSuccesses + this.parryMultiHitQueue.length;
    const successes = this.parryMultiHitSuccesses;
    this.parryAuraGfx?.clear();
    this.parryGaugeGfx?.clear();

    if (successes === total && total > 1) {
      DamageText.show(this.ctx, 400, 190, '⚡ PERFECT PARRY! ⚡', '#ffd700', '28px');
      this.ctx.emitParticles(400, 280, [0xffd700, 0xffffff], 16);
      this.ctx.scene.pause();
      setTimeout(() => {
        if (this.ctx.scene.isPaused() && !this.ctx.pauseOpen) this.ctx.scene.resume();
      }, 100);
      if (this.ctx.targetMonster && !this.ctx.targetMonster.isDead) {
        const dmg = Math.floor(this.ctx.effectiveAtk * 3);
        const dead = this.ctx.targetMonster.takeDamage(dmg);
        DamageText.show(
          this.ctx,
          this.ctx.targetMonster.x,
          this.ctx.targetMonster.y - 50,
          `반격! ${dmg}`,
          '#ffd700',
          '22px',
        );
        if (dead) this.ctx.handleMonsterKill(this.ctx.targetMonster);
      }
      this.addOverdrive(30);
      this.parrySuccessCount += total;
      this.checkParryMastery();
      this.parryReady = false;
      this.parryCd = 8;
      this.ctx.updateParryCdDisplay();
      this.ctx.monsterStunned = true;
      this.ctx.time.delayedCall(1500, () => {
        this.ctx.monsterStunned = false;
      });
    } else if (successes > 0) {
      this.parrySuccessCount += successes;
      this.checkParryMastery();
      this.parryReady = false;
      this.parryCd = 8;
      this.ctx.updateParryCdDisplay();
      this.ctx.onMonsterAttack();
    } else {
      this.ctx.onMonsterAttack();
    }
    this.parryMultiHitQueue = [];
    this.parryMultiHitSuccesses = 0;
  }

  /* ---- Rogue dodge ---- */

  tryRogueDodge(): boolean {
    if (this.ctx.selectedClass.id !== 'rogue') return false;
    if (!this.ctx.stealthActive) return false;
    DamageText.show(this.ctx, 400, 200, '🗡 DODGE! 암살 준비!', '#cc44ff', '26px');
    this.ctx.roguePostDodgeActive = true;
    this.ctx.stealthGuaranteeCrit = true;
    this.ctx.roguePostDodgeTimer?.remove();
    this.ctx.roguePostDodgeTimer = this.ctx.time.delayedCall(3000, () => {
      this.ctx.roguePostDodgeActive = false;
    });
    return true;
  }
}
