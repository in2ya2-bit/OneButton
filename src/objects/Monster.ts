import Phaser from 'phaser';

export type SpecialType = 'none' | 'shield' | 'split' | 'charge';

export interface MonsterConfig {
  name: string;
  hp: number;
  gold: number;
  type: string;
  size: number;
  level: number;
  nameColor?: string;
  isSub?: boolean;
  specialType?: SpecialType;
  canSplit?: boolean;
}

export class Monster extends Phaser.GameObjects.Container {
  private bodySprite: Phaser.GameObjects.Sprite;
  private hpBarFill: Phaser.GameObjects.Graphics;
  private hpText: Phaser.GameObjects.Text;
  private idleTween?: Phaser.Tweens.Tween;
  private targetRing: Phaser.GameObjects.Graphics;
  private targetTween?: Phaser.Tweens.Tween;

  private shieldBarFill?: Phaser.GameObjects.Graphics;
  private shieldText?: Phaser.GameObjects.Text;
  private shieldGlow?: Phaser.GameObjects.Graphics;
  private chargeGlow?: Phaser.GameObjects.Graphics;

  private monsterSize: number;
  private barW: number;
  private barH: number;
  private barY: number;
  private maxHp: number;
  private currentHp: number;
  private baseY: number;

  public readonly goldReward: number;
  public readonly isSub: boolean;
  public readonly specialType: SpecialType;
  public readonly canSplit: boolean;
  public readonly monsterType: string;
  public readonly monsterName: string;
  public readonly monsterLevel: number;

  private shieldHp = 0;
  private shieldMaxHp = 0;
  public charging = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: MonsterConfig) {
    super(scene, x, y);

    this.baseY = y;
    this.maxHp = config.hp;
    this.currentHp = config.hp;
    this.goldReward = config.gold;
    this.monsterSize = config.size;
    this.isSub = config.isSub ?? false;
    this.specialType = config.specialType ?? 'none';
    this.canSplit = config.canSplit ?? (this.specialType === 'split');
    this.monsterType = config.type;
    this.monsterName = config.name;
    this.monsterLevel = config.level;

    if (this.specialType === 'shield') {
      this.shieldMaxHp = Math.floor(config.hp * 0.3);
      this.shieldHp = this.shieldMaxHp;
    }

    this.barW = this.isSub ? 80 : 140;
    this.barH = this.isSub ? 10 : 14;
    this.barY = -config.size - (this.isSub ? 20 : 30);

    const scale = config.size / 60;
    const textureKey = `monster-${config.type}`;

    this.targetRing = scene.add.graphics();
    this.targetRing.setVisible(false);
    this.add(this.targetRing);

    const shadow = scene.add.sprite(5, 10, textureKey);
    shadow.setTint(0x000000).setAlpha(0.2).setScale(scale * 1.05);
    this.add(shadow);

    this.bodySprite = scene.add.sprite(0, 0, textureKey);
    this.bodySprite.setScale(scale);
    this.add(this.bodySprite);

    if (this.specialType === 'shield') {
      this.shieldGlow = scene.add.graphics();
      this.shieldGlow.lineStyle(3, 0x4488ff, 0.6);
      this.shieldGlow.strokeCircle(0, 0, config.size * 0.8);
      this.shieldGlow.lineStyle(1, 0x88ccff, 0.3);
      this.shieldGlow.strokeCircle(0, 0, config.size * 0.9);
      this.add(this.shieldGlow);
    }

    if (this.specialType === 'charge') {
      this.chargeGlow = scene.add.graphics();
      this.chargeGlow.lineStyle(2, 0xff2222, 0.5);
      this.chargeGlow.strokeRect(-config.size * 0.7, -config.size * 0.7, config.size * 1.4, config.size * 1.4);
      this.add(this.chargeGlow);
    }

    const hpBarBg = scene.add.graphics();
    hpBarBg.fillStyle(0x000000, 0.6);
    hpBarBg.fillRoundedRect(-this.barW / 2 - 3, this.barY - 3, this.barW + 6, this.barH + 6, 7);
    hpBarBg.fillStyle(0x222222, 1);
    hpBarBg.fillRoundedRect(-this.barW / 2, this.barY, this.barW, this.barH, 5);
    this.add(hpBarBg);

    this.hpBarFill = scene.add.graphics();
    this.add(this.hpBarFill);

    this.hpText = scene.add.text(0, this.barY + this.barH / 2, '', {
      fontSize: this.isSub ? '9px' : '11px',
      color: '#ffffff',
      fontFamily: 'Arial',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.hpText);

    if (this.specialType === 'shield') {
      const sbY = this.barY - this.barH - 6;
      const sbBg = scene.add.graphics();
      sbBg.fillStyle(0x000000, 0.5);
      sbBg.fillRoundedRect(-this.barW / 2 - 2, sbY - 2, this.barW + 4, 8, 4);
      sbBg.fillStyle(0x112244, 1);
      sbBg.fillRoundedRect(-this.barW / 2, sbY, this.barW, 6, 3);
      this.add(sbBg);
      this.shieldBarFill = scene.add.graphics();
      this.add(this.shieldBarFill);
      this.shieldText = scene.add.text(0, sbY + 3, '', {
        fontSize: '8px', color: '#aaddff', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 1,
      }).setOrigin(0.5);
      this.add(this.shieldText);
    }

    const typeIcons: Record<SpecialType, string> = { none: '', shield: '🛡️', split: '💥', charge: '⚡' };
    const typeIcon = typeIcons[this.specialType];
    const nameFontSize = this.isSub ? '14px' : '20px';
    const displayName = this.isSub
      ? config.name
      : `${typeIcon ? typeIcon + ' ' : ''}${config.name} Lv.${config.level}`;
    const nameText = scene.add.text(0, this.barY - (this.isSub ? 14 : 20) - (this.specialType === 'shield' ? 10 : 0), displayName, {
      fontSize: nameFontSize,
      color: config.nameColor ?? (this.isSub ? '#aaaaaa' : '#ffffff'),
      fontFamily: 'Arial, sans-serif',
      stroke: '#000000',
      strokeThickness: this.isSub ? 3 : 4,
    }).setOrigin(0.5);
    this.add(nameText);

    this.updateHpBar();
    this.updateShieldBar();

    const hitSize = config.size * 1.2;
    this.setSize(hitSize * 2, hitSize * 2);
    this.setInteractive({ useHandCursor: true });

    this.setScale(0);
    this.setAlpha(0);
    scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: this.isSub ? 300 : 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.idleTween = scene.tweens.add({
          targets: this,
          y: this.baseY - (this.isSub ? 4 : 6),
          duration: this.isSub ? 900 : 1200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  get hasShield(): boolean { return this.shieldHp > 0; }

  private updateShieldBar() {
    if (!this.shieldBarFill || !this.shieldText) return;
    const sbY = this.barY - this.barH - 6;
    const ratio = this.shieldMaxHp > 0 ? Phaser.Math.Clamp(this.shieldHp / this.shieldMaxHp, 0, 1) : 0;
    const fw = this.barW * ratio;
    this.shieldBarFill.clear();
    if (fw > 0) {
      this.shieldBarFill.fillStyle(0x4488ff, 1);
      this.shieldBarFill.fillRoundedRect(-this.barW / 2, sbY, fw, 6, Math.min(3, fw / 2));
    }
    this.shieldText.setText(this.shieldHp > 0 ? `${Math.ceil(this.shieldHp)} / ${this.shieldMaxHp}` : '');
    if (this.shieldGlow) this.shieldGlow.setVisible(this.shieldHp > 0);
  }

  breakShield() {
    this.shieldHp = 0;
    this.updateShieldBar();
  }

  setTargeted(on: boolean) {
    this.targetRing.setVisible(on);
    this.targetTween?.stop();
    this.targetTween = undefined;
    if (on) {
      this.targetRing.clear();
      const w = this.monsterSize * 1.3;
      const h = w * 0.35;
      const ry = this.monsterSize * 0.25;
      this.targetRing.lineStyle(2, 0xffff00, 0.8);
      this.targetRing.strokeEllipse(0, ry, w, h);
      this.targetRing.lineStyle(1, 0xffff00, 0.3);
      this.targetRing.strokeEllipse(0, ry, w + 8, h + 5);
      this.targetTween = this.scene.tweens.add({
        targets: this.targetRing, alpha: 0.4,
        duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      });
    }
  }

  private updateHpBar() {
    const ratio = Phaser.Math.Clamp(this.currentHp / this.maxHp, 0, 1);
    const fillW = this.barW * ratio;

    this.hpBarFill.clear();
    if (fillW > 0) {
      const r = Math.floor(220 * (1 - ratio));
      const g = Math.floor(200 * ratio);
      const color = (r << 16) | (g << 8) | 0x10;
      const cornerR = Math.min(5, fillW / 2);
      this.hpBarFill.fillStyle(color, 1);
      this.hpBarFill.fillRoundedRect(-this.barW / 2, this.barY, fillW, this.barH, cornerR);
    }

    this.hpText.setText(`${Math.max(0, Math.ceil(this.currentHp))} / ${this.maxHp}`);
  }

  takeDamage(amount: number): boolean {
    const actual = this.applyShieldReduction(amount);
    this.currentHp = Math.max(0, this.currentHp - actual);
    this.updateHpBar();
    this.playHitEffect();
    return this.currentHp <= 0;
  }

  private applyShieldReduction(raw: number): number {
    if (this.shieldHp <= 0) return raw;
    const shieldAbsorb = Math.min(this.shieldHp, raw);
    this.shieldHp -= shieldAbsorb;
    this.updateShieldBar();
    const passThrough = raw - shieldAbsorb;
    return Math.floor(passThrough * 0.2);
  }

  get isDead(): boolean {
    return this.currentHp <= 0;
  }

  get hpRatio(): number {
    return Phaser.Math.Clamp(this.currentHp / this.maxHp, 0, 1);
  }

  private playHitEffect() {
    this.bodySprite.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => {
      if (this.bodySprite?.active) this.bodySprite.clearTint();
    });

    this.scene.tweens.add({
      targets: this,
      scaleX: 0.92,
      scaleY: 0.92,
      duration: 60,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  takeDamageColored(amount: number, tintColor: number): boolean {
    const actual = this.applyShieldReduction(amount);
    this.currentHp = Math.max(0, this.currentHp - actual);
    this.updateHpBar();
    this.bodySprite.setTintFill(tintColor);
    this.scene.time.delayedCall(120, () => {
      if (this.bodySprite?.active) this.bodySprite.clearTint();
    });
    this.scene.tweens.add({
      targets: this,
      scaleX: 0.88,
      scaleY: 0.88,
      duration: 80,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
    return this.currentHp <= 0;
  }

  takeDamageAoe(amount: number, tintColor: number): boolean {
    if (this.shieldHp > 0) {
      this.shieldHp = 0;
      this.updateShieldBar();
    }
    this.currentHp = Math.max(0, this.currentHp - amount);
    this.updateHpBar();
    this.bodySprite.setTintFill(tintColor);
    this.scene.time.delayedCall(120, () => {
      if (this.bodySprite?.active) this.bodySprite.clearTint();
    });
    this.scene.tweens.add({
      targets: this, scaleX: 0.88, scaleY: 0.88, duration: 80, yoyo: true, ease: 'Sine.easeOut',
    });
    return this.currentHp <= 0;
  }

  playAttackAnimation() {
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 100,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  playDeathAnimation(onComplete: () => void) {
    this.idleTween?.stop();
    this.targetTween?.stop();
    this.targetRing.setVisible(false);

    for (let i = 0; i < Phaser.Math.Between(this.isSub ? 3 : 5, this.isSub ? 5 : 8); i++) {
      const cx = this.x + Phaser.Math.Between(-25, 25);
      const cy = this.y + Phaser.Math.Between(-25, 25);
      const circle = this.scene.add.graphics().setDepth(89);
      const color = Phaser.Math.RND.pick([0xffffff, 0xffcc00, 0xff8800, 0xff4400]);
      const sz = Phaser.Math.Between(this.isSub ? 2 : 3, this.isSub ? 5 : 8);
      circle.fillStyle(color, 1);
      circle.fillCircle(0, 0, sz);
      circle.setPosition(cx, cy);
      this.scene.tweens.add({
        targets: circle,
        x: cx + Phaser.Math.Between(-70, 70),
        y: cy + Phaser.Math.Between(-90, -15),
        alpha: 0, scale: 0,
        duration: Phaser.Math.Between(250, 550),
        ease: 'Quad.easeOut',
        onComplete: () => circle.destroy(),
      });
    }

    this.scene.tweens.add({
      targets: this, scaleX: 1.3, scaleY: 1.3,
      duration: 80, yoyo: true, ease: 'Sine.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          scaleX: 1.5, scaleY: 0.15, alpha: 0, y: this.baseY + 30,
          duration: this.isSub ? 250 : 350, ease: 'Back.easeIn',
          onComplete: () => { this.destroy(); onComplete(); },
        });
      },
    });
  }
}
