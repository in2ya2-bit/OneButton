import Phaser from 'phaser';
import { SaveManager } from '../data/SaveManager';
import { SoundManager } from '../data/SoundManager';
import { ACHIEVEMENTS } from '../data/achievements';
import { CLASSES } from '../data/classes';

export class TitleScene extends Phaser.Scene {
  private introShown = false;
  private menuElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    this.introShown = false;
    this.menuElements = [];
    this.drawBackground();
    this.showIntro();
  }

  private drawBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x05050f, 0x05050f, 0x0e0e22, 0x0e0e22, 1, 1, 1, 1);
    bg.fillRect(0, 0, 800, 600);

    for (let i = 0; i < 60; i++) {
      const x = Phaser.Math.Between(0, 800),
        y = Phaser.Math.Between(0, 600);
      const size = Phaser.Math.FloatBetween(0.5, 2);
      const alpha = Phaser.Math.FloatBetween(0.1, 0.5);
      const star = this.add.graphics();
      star.fillStyle(0xffffff, alpha);
      star.fillCircle(x, y, size);
      this.tweens.add({
        targets: star,
        alpha: alpha * 0.3,
        duration: Phaser.Math.Between(1500, 4000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 2000),
      });
    }

    for (let i = 0; i < 15; i++) {
      const dust = this.add.graphics();
      const dx = Phaser.Math.Between(0, 800),
        dy = Phaser.Math.Between(200, 500);
      dust.fillStyle(0x8888cc, 0.15);
      dust.fillCircle(0, 0, Phaser.Math.Between(2, 5));
      dust.setPosition(dx, dy);
      this.tweens.add({
        targets: dust,
        x: dx + Phaser.Math.Between(-100, 100),
        y: dy - Phaser.Math.Between(20, 80),
        alpha: 0,
        duration: Phaser.Math.Between(4000, 8000),
        repeat: -1,
        delay: Phaser.Math.Between(0, 3000),
        onRepeat: () => {
          dust.setPosition(Phaser.Math.Between(0, 800), Phaser.Math.Between(200, 500));
          dust.setAlpha(0.15);
        },
      });
    }

    const silhouette = this.add.graphics();
    silhouette.fillStyle(0x111133, 0.6);
    silhouette.fillCircle(400, 380, 40);
    silhouette.fillTriangle(380, 340, 420, 340, 400, 310);
    silhouette.fillTriangle(360, 360, 340, 390, 370, 375);
    silhouette.fillTriangle(440, 360, 460, 390, 430, 375);
    this.tweens.add({
      targets: silhouette,
      y: -3,
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private showIntro() {
    const pressText = this.add
      .text(400, 480, 'Press Any Key to Start', {
        fontSize: '18px',
        color: '#888899',
        fontFamily: 'Arial, sans-serif',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const title = this.add
      .text(400, 160, '⚔ MONSTER\nCLICKER ⚔', {
        fontSize: '52px',
        color: '#ffd700',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 8,
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const subtitle = this.add
      .text(400, 255, 'Into the Dungeon', {
        fontSize: '16px',
        color: '#6666aa',
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'italic',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, duration: 1200, ease: 'Sine.easeIn' });
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 800, delay: 600 });
    this.tweens.add({
      targets: pressText,
      alpha: 1,
      duration: 800,
      delay: 1200,
      onComplete: () => {
        this.tweens.add({
          targets: pressText,
          alpha: 0.3,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      },
    });

    const onAnyKey = () => {
      if (this.introShown) return;
      this.introShown = true;
      SoundManager.init();
      SoundManager.sfxClick();
      SoundManager.playTitleBgm();
      this.tweens.add({
        targets: [pressText],
        alpha: 0,
        duration: 200,
        onComplete: () => {
          pressText.destroy();
          this.showMainMenu();
        },
      });
    };

    this.input.keyboard?.on('keydown', onAnyKey);
    this.input.on('pointerdown', onAnyKey);
  }

  private showMainMenu() {
    this.menuElements.forEach(e => e.destroy());
    this.menuElements = [];
    const els = this.menuElements;

    const hasRun = SaveManager.hasRun();
    const achData = SaveManager.loadAchievements();
    const unclaimed = ACHIEVEMENTS.filter(
      a => achData.unlocked[a.id] && !achData.claimed[a.id],
    ).length;

    interface MenuEntry {
      label: string;
      icon: string;
      enabled: boolean;
      badge?: number;
      action: () => void;
    }
    const items: MenuEntry[] = [
      { label: '새 게임', icon: '⚔️', enabled: true, action: () => this.goToClassSelect() },
      { label: '이어하기', icon: '▶', enabled: hasRun, action: () => this.continueRun() },
      { label: '유물', icon: '💎', enabled: true, action: () => this.goToRelics() },
      {
        label: '업적',
        icon: '🏆',
        enabled: true,
        badge: unclaimed > 0 ? unclaimed : undefined,
        action: () => this.goToAchievements(),
      },
      { label: '설정', icon: '⚙️', enabled: true, action: () => this.showSettings() },
    ];

    const startY = 320,
      gap = 48,
      btnW = 220,
      btnH = 40;

    items.forEach((item, i) => {
      const by = startY + i * gap;
      const g = this.add.graphics().setAlpha(0);
      const draw = (hover: boolean) => {
        g.clear();
        if (!item.enabled) {
          g.fillStyle(0x111118, 0.6);
          g.fillRoundedRect(400 - btnW / 2, by - btnH / 2, btnW, btnH, 10);
        } else {
          g.fillStyle(hover ? 0x2a2a44 : 0x1a1a2e, 0.9);
          g.fillRoundedRect(400 - btnW / 2, by - btnH / 2, btnW, btnH, 10);
          g.lineStyle(1.5, hover ? 0x6666aa : 0x444466, 0.8);
          g.strokeRoundedRect(400 - btnW / 2, by - btnH / 2, btnW, btnH, 10);
        }
      };
      draw(false);
      els.push(g);

      const labelColor = item.enabled ? '#ffffff' : '#444455';
      const t = this.add
        .text(400, by, `${item.icon}  ${item.label}`, {
          fontSize: '17px',
          color: labelColor,
          fontFamily: 'Arial, sans-serif',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setAlpha(0);
      els.push(t);

      if (item.badge) {
        const bdg = this.add.graphics().setAlpha(0);
        bdg.fillStyle(0xff3333, 1);
        bdg.fillCircle(400 + btnW / 2 - 12, by - 10, 9);
        els.push(bdg);
        const bdgT = this.add
          .text(400 + btnW / 2 - 12, by - 10, `${item.badge}`, {
            fontSize: '10px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
          .setAlpha(0);
        els.push(bdgT);
        this.tweens.add({ targets: [bdg, bdgT], alpha: 1, duration: 300, delay: 400 + i * 80 });
      }

      if (!item.enabled && item.label === '이어하기') {
        const sub = this.add
          .text(400, by + 14, '저장 데이터 없음', {
            fontSize: '9px',
            color: '#333344',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 1,
          })
          .setOrigin(0.5)
          .setAlpha(0);
        els.push(sub);
        this.tweens.add({ targets: sub, alpha: 0.5, duration: 300, delay: 400 + i * 80 });
      }

      if (item.enabled && hasRun && item.label === '이어하기') {
        const rd = SaveManager.loadRun()!;
        const cls = CLASSES.find(c => c.id === rd.classId);
        const sub = this.add
          .text(400, by + 14, `${cls?.icon ?? ''} Stage ${rd.stage}`, {
            fontSize: '9px',
            color: '#6688aa',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 1,
          })
          .setOrigin(0.5)
          .setAlpha(0);
        els.push(sub);
        this.tweens.add({ targets: sub, alpha: 1, duration: 300, delay: 400 + i * 80 });
      }

      this.tweens.add({
        targets: [g, t],
        alpha: 1,
        x: '+=0',
        duration: 300,
        delay: 300 + i * 80,
        ease: 'Sine.easeOut',
      });
      g.setPosition(-30, 0);
      t.setPosition(t.x - 30, t.y);
      this.tweens.add({
        targets: [g],
        x: 0,
        duration: 350,
        delay: 300 + i * 80,
        ease: 'Back.easeOut',
      });
      this.tweens.add({
        targets: [t],
        x: '+=30',
        duration: 350,
        delay: 300 + i * 80,
        ease: 'Back.easeOut',
      });

      if (item.enabled) {
        const zone = this.add.zone(400, by, btnW, btnH).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => draw(true));
        zone.on('pointerout', () => draw(false));
        zone.on('pointerdown', () => {
          SoundManager.sfxClick();
          item.action();
        });
        els.push(zone);
      }
    });

    const ver = this.add
      .text(790, 590, 'v1.0', {
        fontSize: '10px',
        color: '#333344',
        fontFamily: 'Arial',
      })
      .setOrigin(1, 1);
    els.push(ver);
  }

  private goToClassSelect() {
    SoundManager.stopBgm();
    this.cameras.main.fade(300, 0, 0, 0, false, (_c: Phaser.Cameras.Scene2D.Camera, p: number) => {
      if (p >= 1) this.scene.start('MainMenuScene');
    });
  }

  private continueRun() {
    const rd = SaveManager.loadRun();
    if (!rd) return;
    SoundManager.stopBgm();
    this.cameras.main.fade(300, 0, 0, 0, false, (_c: Phaser.Cameras.Scene2D.Camera, p: number) => {
      if (p >= 1)
        this.scene.start('GameScene', {
          startRegion: rd.startRegion,
          classId: rd.classId,
          loadRun: true,
        });
    });
  }

  private goToRelics() {
    SoundManager.stopBgm();
    this.cameras.main.fade(300, 0, 0, 0, false, (_c: Phaser.Cameras.Scene2D.Camera, p: number) => {
      if (p >= 1) this.scene.start('MainMenuScene', { openRelic: true });
    });
  }

  private goToAchievements() {
    SoundManager.stopBgm();
    this.cameras.main.fade(300, 0, 0, 0, false, (_c: Phaser.Cameras.Scene2D.Camera, p: number) => {
      if (p >= 1) this.scene.start('MainMenuScene', { openAchievements: true });
    });
  }

  private showSettings() {
    const sEls: Phaser.GameObjects.GameObject[] = [];
    const settings = SaveManager.loadSettings();

    const bg = this.add.graphics().setDepth(500);
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 800, 600);
    sEls.push(bg);

    const panel = this.add.graphics().setDepth(501);
    panel.fillStyle(0x12122a, 0.95);
    panel.fillRoundedRect(200, 120, 400, 360, 16);
    panel.lineStyle(2, 0x444466, 0.8);
    panel.strokeRoundedRect(200, 120, 400, 360, 16);
    sEls.push(panel);

    sEls.push(
      this.add
        .text(400, 150, '⚙️ 설정', {
          fontSize: '28px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(502),
    );

    const makeSlider = (label: string, y: number, val: number, onChange: (v: number) => void) => {
      sEls.push(
        this.add
          .text(240, y, label, {
            fontSize: '14px',
            color: '#aabbcc',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 2,
          })
          .setDepth(502),
      );

      const sx = 350,
        sw = 180,
        sh = 8;
      const track = this.add.graphics().setDepth(502);
      track.fillStyle(0x222233, 1);
      track.fillRoundedRect(sx, y + 6, sw, sh, 4);
      sEls.push(track);

      const fill = this.add.graphics().setDepth(503);
      const knob = this.add.graphics().setDepth(504);
      const valText = this.add
        .text(sx + sw + 15, y + 2, `${Math.round(val * 100)}%`, {
          fontSize: '12px',
          color: '#ffffff',
          fontFamily: 'Arial',
          stroke: '#000000',
          strokeThickness: 2,
        })
        .setDepth(502);
      sEls.push(fill, knob, valText);

      const drawSlider = (v: number) => {
        fill.clear();
        knob.clear();
        const fw = sw * v;
        fill.fillStyle(0x4466aa, 1);
        fill.fillRoundedRect(sx, y + 6, fw, sh, 4);
        knob.fillStyle(0xffffff, 1);
        knob.fillCircle(sx + fw, y + 10, 8);
        valText.setText(`${Math.round(v * 100)}%`);
      };
      drawSlider(val);

      const zone = this.add
        .zone(sx + sw / 2, y + 10, sw + 20, 30)
        .setInteractive()
        .setDepth(505);
      zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
        const v = Phaser.Math.Clamp((ptr.x - sx) / sw, 0, 1);
        drawSlider(v);
        onChange(v);
      });
      zone.on('pointermove', (ptr: Phaser.Input.Pointer) => {
        if (!ptr.isDown) return;
        const v = Phaser.Math.Clamp((ptr.x - sx) / sw, 0, 1);
        drawSlider(v);
        onChange(v);
      });
      sEls.push(zone);
    };

    makeSlider('BGM 볼륨', 200, settings.bgmVolume, v => {
      settings.bgmVolume = v;
      SaveManager.saveSettings(settings);
      SoundManager.updateSettings(settings);
    });

    makeSlider('SFX 볼륨', 250, settings.sfxVolume, v => {
      settings.sfxVolume = v;
      SaveManager.saveSettings(settings);
      SoundManager.updateSettings(settings);
    });

    const muteBx = 400,
      muteBy = 315;
    const muteG = this.add.graphics().setDepth(502);
    const muteText = this.add
      .text(muteBx, muteBy, '', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(503);
    sEls.push(muteG, muteText);

    const drawMute = () => {
      muteG.clear();
      muteG.fillStyle(settings.muted ? 0x882222 : 0x224422, 1);
      muteG.fillRoundedRect(muteBx - 70, muteBy - 16, 140, 32, 8);
      muteText.setText(settings.muted ? '🔇 음소거 ON' : '🔊 음소거 OFF');
    };
    drawMute();

    const muteZone = this.add
      .zone(muteBx, muteBy, 140, 32)
      .setInteractive({ useHandCursor: true })
      .setDepth(504);
    muteZone.on('pointerdown', () => {
      settings.muted = !settings.muted;
      SaveManager.saveSettings(settings);
      SoundManager.updateSettings(settings);
      drawMute();
    });
    sEls.push(muteZone);

    const fsBx = 400,
      fsBy = 365;
    const fsG = this.add.graphics().setDepth(502);
    const fsText = this.add
      .text(fsBx, fsBy, '', {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'Arial',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(503);
    sEls.push(fsG, fsText);

    const drawFs = () => {
      fsG.clear();
      fsG.fillStyle(settings.fullscreen ? 0x225522 : 0x333344, 1);
      fsG.fillRoundedRect(fsBx - 70, fsBy - 16, 140, 32, 8);
      fsText.setText(settings.fullscreen ? '🖥 전체화면 ON' : '🖥 전체화면 OFF');
    };
    drawFs();

    const fsZone = this.add
      .zone(fsBx, fsBy, 140, 32)
      .setInteractive({ useHandCursor: true })
      .setDepth(504);
    fsZone.on('pointerdown', () => {
      settings.fullscreen = !settings.fullscreen;
      SaveManager.saveSettings(settings);
      if (settings.fullscreen) this.scale.startFullscreen();
      else this.scale.stopFullscreen();
      drawFs();
    });
    sEls.push(fsZone);

    const closeBy = 440;
    const closeG = this.add.graphics().setDepth(502);
    const drawClose = (h: boolean) => {
      closeG.clear();
      closeG.fillStyle(h ? 0x444455 : 0x333344, 1);
      closeG.fillRoundedRect(350, closeBy - 16, 100, 32, 8);
    };
    drawClose(false);
    sEls.push(closeG);
    sEls.push(
      this.add
        .text(400, closeBy, '닫기', {
          fontSize: '15px',
          color: '#ffffff',
          fontFamily: 'Arial',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(503),
    );
    const closeZone = this.add
      .zone(400, closeBy, 100, 32)
      .setInteractive({ useHandCursor: true })
      .setDepth(504);
    closeZone.on('pointerover', () => drawClose(true));
    closeZone.on('pointerout', () => drawClose(false));
    closeZone.on('pointerdown', () => sEls.forEach(e => e.destroy()));
    sEls.push(closeZone);
  }
}
