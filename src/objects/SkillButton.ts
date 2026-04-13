import Phaser from 'phaser';

export interface SkillConfig {
  name: string;
  icon: string;
  cooldown: number;
  color: number;
  hoverColor: number;
}

export class SkillButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private overlay: Phaser.GameObjects.Graphics;
  private iconText: Phaser.GameObjects.Text;
  private cdText: Phaser.GameObjects.Text;

  private conf: SkillConfig;
  private bw: number;
  private bh: number;
  private ready = true;
  private mpDisabled = false;
  private highlighted = false;
  private odGlow = false;
  private odGlowGfx?: Phaser.GameObjects.Graphics;
  public skillId = '';

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    w: number, h: number,
    config: SkillConfig,
  ) {
    super(scene, x, y);
    this.conf = config;
    this.bw = w;
    this.bh = h;

    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.drawBg(false);

    this.iconText = scene.add.text(0, -8, config.icon, {
      fontSize: '24px',
    }).setOrigin(0.5);
    this.add(this.iconText);

    const label = scene.add.text(0, h / 2 - 11, config.name, {
      fontSize: '10px',
      color: '#ffffff',
      fontFamily: 'Arial',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(label);

    this.overlay = scene.add.graphics();
    this.add(this.overlay);

    this.cdText = scene.add.text(0, -4, '', {
      fontSize: '22px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setVisible(false);
    this.add(this.cdText);

    const zone = scene.add.zone(0, 0, w, h)
      .setInteractive({ useHandCursor: true });
    this.add(zone);

    zone.on('pointerdown', () => {
      if (!this.ready) return;
      if (this.mpDisabled) { this.emit('activate-blocked'); return; }
      this.emit('activate');
    });
    zone.on('pointerover', () => {
      if (this.ready && !this.mpDisabled) this.drawBg(true);
      this.emit('tooltip-show');
    });
    zone.on('pointerout', () => {
      this.drawBg(false);
      this.emit('tooltip-hide');
    });

    this.setDepth(50);
    scene.add.existing(this as unknown as Phaser.GameObjects.GameObject);
  }

  private drawBg(hover: boolean) {
    const { bw: w, bh: h, conf } = this;
    this.bg.clear();
    const usable = this.ready && !this.mpDisabled;
    this.bg.fillStyle(
      usable ? (hover ? conf.hoverColor : conf.color) : 0x333333,
      1,
    );
    this.bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    if (this.highlighted && usable) {
      this.bg.lineStyle(3, 0x00ffaa, 0.9);
    } else {
      this.bg.lineStyle(2, usable ? 0xffffff : 0x555555, 0.4);
    }
    this.bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
  }

  setMpDisabled(disabled: boolean) {
    if (this.mpDisabled === disabled) return;
    this.mpDisabled = disabled;
    this.drawBg(false);
    this.iconText.setAlpha(disabled && this.ready ? 0.4 : (this.ready ? 1 : 0.3));
  }

  setHighlight(on: boolean) {
    if (this.highlighted === on) return;
    this.highlighted = on;
    this.drawBg(false);
  }

  private drawOverlay(ratio: number) {
    this.overlay.clear();
    if (ratio <= 0) return;
    const { bw: w, bh: h } = this;
    const inset = 3;
    const overlayH = (h - inset * 2) * ratio;
    this.overlay.fillStyle(0x000000, 0.55);
    this.overlay.fillRect(
      -w / 2 + inset, -h / 2 + inset,
      w - inset * 2, overlayH,
    );
  }

  startCooldown(overrideCd?: number) {
    this.ready = false;
    this.drawBg(false);
    this.iconText.setAlpha(0.3);
    this.cdText.setVisible(true);

    const cd = overrideCd ?? this.conf.cooldown;
    const counter = { val: 1 };

    this.scene.tweens.add({
      targets: counter,
      val: 0,
      duration: cd * 1000,
      onUpdate: () => {
        this.drawOverlay(counter.val);
        const sec = Math.ceil(counter.val * cd);
        this.cdText.setText(sec > 0 ? `${sec}` : '');
      },
      onComplete: () => {
        this.ready = true;
        this.overlay.clear();
        this.iconText.setAlpha(1);
        this.cdText.setVisible(false);
        this.drawBg(false);

        this.scene.tweens.add({
          targets: this,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 150,
          yoyo: true,
          ease: 'Sine.easeOut',
        });
      },
    });
  }

  resetCooldown() {
    this.ready = true;
    this.overlay.clear();
    this.iconText.setAlpha(1);
    this.cdText.setVisible(false);
    this.drawBg(false);
  }

  setOverdriveGlow(on: boolean) {
    if (this.odGlow === on) return;
    this.odGlow = on;
    if (on) {
      if (!this.odGlowGfx) {
        this.odGlowGfx = this.scene.add.graphics();
        this.add(this.odGlowGfx);
      }
      const { bw: w, bh: h } = this;
      this.odGlowGfx.clear();
      this.odGlowGfx.lineStyle(3, 0xffcc00, 0.9);
      this.odGlowGfx.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 12);
      this.odGlowGfx.lineStyle(1, 0xffffff, 0.4);
      this.odGlowGfx.strokeRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, 14);
    } else {
      this.odGlowGfx?.clear();
    }
  }

  get isReady(): boolean {
    return this.ready;
  }
}
