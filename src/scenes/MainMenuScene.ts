import Phaser from 'phaser';
import { REGIONS } from '../data/regions';
import { CLASSES, ClassDef } from '../data/classes';
import { SaveManager, MARK_DEFS } from '../data/SaveManager';
import { ACHIEVEMENTS, CATEGORY_LABELS } from '../data/achievements';
import { RelicPanel } from '../objects/RelicPanel';
import { DEFAULT_RELIC_LEVELS } from '../data/relics';

export class MainMenuScene extends Phaser.Scene {
  private relicPanel!: RelicPanel;
  private selectedClassId: string | null = null;
  private screenElements: Phaser.GameObjects.GameObject[] = [];

  constructor() { super({ key: 'MainMenuScene' }); }

  private bestLocal(ri: number): number { return this.registry.get(`bestLocal_${ri}`) ?? 0; }
  private isUnlocked(ri: number): boolean { return ri <= 1 || this.bestLocal(ri - 1) >= 20; }
  private get relicPoints(): number { return this.registry.get('relicPoints') ?? 0; }

  create() {
    this.selectedClassId = null;
    this.screenElements = [];
    this.relicPanel = new RelicPanel(this, { onClose: () => {} });
    this.drawBackground();
    this.showClassSelection();
  }

  private clearScreen() {
    this.screenElements.forEach(el => el.destroy());
    this.screenElements = [];
  }

  private drawBackground() {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0a0a1e, 0x0a0a1e, 0x12122e, 0x12122e, 1, 1, 1, 1);
    bg.fillRect(0, 0, 800, 600);
    bg.fillStyle(0xffffff, 0.02); bg.fillCircle(400, 320, 200);
    bg.fillStyle(0xffffff, 0.015); bg.fillCircle(400, 320, 280);
    for (let i = 0; i < 30; i++) {
      const sx = Phaser.Math.Between(0, 800), sy = Phaser.Math.Between(0, 600);
      bg.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.1, 0.4));
      bg.fillCircle(sx, sy, Phaser.Math.Between(1, 2));
    }
  }

  /* ==== CLASS SELECTION ==== */

  private showClassSelection() {
    this.clearScreen();
    const els = this.screenElements;

    const title = this.add.text(400, 45, '⚔ MONSTER CLICKER ⚔', {
      fontSize: '42px', color: '#ffd700', fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5);
    els.push(title);

    const sub = this.add.text(400, 85, '클래스를 선택하세요', {
      fontSize: '16px', color: '#8888aa', fontFamily: 'Arial, sans-serif',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);
    els.push(sub);

    const cardW = 220, cardH = 380, gap = 25;
    const totalW = cardW * 3 + gap * 2;
    const startX = (800 - totalW) / 2 + cardW / 2;

    CLASSES.forEach((cls, i) => {
      const cx = startX + i * (cardW + gap), cy = 305;
      this.drawClassCard(cls, cx, cy, cardW, cardH, els);
    });

    this.drawContinueButton(els);
    this.drawRelicArea(els);
    this.drawResetButton(els);
    this.drawSoulInfo(els);
    this.drawMarkInfo(els);
  }

  private drawContinueButton(els: Phaser.GameObjects.GameObject[]) {
    const rd = SaveManager.loadRun();
    if (!rd) return;

    const cls = CLASSES.find(c => c.id === rd.classId);
    const region = REGIONS[rd.startRegion - 1];
    const localStage = ((rd.stage - 1) % 20) + 1;
    const label = `▶ 이어하기 - ${cls?.icon ?? ''} ${region?.name ?? ''} / Stage ${localStage}`;

    const bx = 400, by = 530, bw = 340, bh = 40;
    const btnG = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? 0x336655 : 0x224433, 1);
      btnG.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 12);
      btnG.lineStyle(2, hover ? 0x66ddaa : 0x44aa77, 1);
      btnG.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 12);
    };
    drawBtn(false);
    els.push(btnG);

    els.push(this.add.text(bx, by, label, {
      fontSize: '14px', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));

    const zone = this.add.zone(bx, by, bw, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBtn(true));
    zone.on('pointerout', () => drawBtn(false));
    zone.on('pointerdown', () => {
      this.cameras.main.fade(300, 0, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
        if (progress >= 1) {
          this.scene.start('GameScene', {
            startRegion: rd.startRegion,
            classId: rd.classId,
            loadRun: true,
          });
        }
      });
    });
    els.push(zone);
  }

  private drawResetButton(els: Phaser.GameObjects.GameObject[]) {
    const bx = 60, by = 575, bw = 80, bh = 28;
    const btnG = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? 0x553322 : 0x332211, 1);
      btnG.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
      btnG.lineStyle(1, hover ? 0xaa5533 : 0x664422, 0.8);
      btnG.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
    };
    drawBtn(false);
    els.push(btnG);
    els.push(this.add.text(bx, by, '🗑 초기화', {
      fontSize: '11px', color: '#aa7755', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));
    const zone = this.add.zone(bx, by, bw, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBtn(true));
    zone.on('pointerout', () => drawBtn(false));
    zone.on('pointerdown', () => this.showResetConfirm());
    els.push(zone);
  }

  private drawSoulInfo(els: Phaser.GameObjects.GameObject[]) {
    const soul = SaveManager.loadSoul();
    if (!soul) return;
    const region = REGIONS[soul.region - 1];
    const localStage = ((soul.stage - 1) % 20) + 1;
    const text = `💀 미회수 소울: ${soul.gold}G (${region?.name ?? '?'} Stage ${localStage})`;
    els.push(this.add.text(400, 508, text, {
      fontSize: '13px', color: '#ddaa44', fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));
  }

  private drawMarkInfo(els: Phaser.GameObjects.GameObject[]) {
    const marks = SaveManager.loadMarks();
    if (marks.length === 0) return;
    const isCursed = marks.length >= 5;
    const startX = 400 - marks.length * 11;
    const y = 120;
    const bg = this.add.graphics();
    bg.fillStyle(isCursed ? 0x330000 : 0x111122, 0.6);
    bg.fillRoundedRect(startX - 8, y - 10, marks.length * 22 + 16, 24, 6);
    if (isCursed) {
      bg.lineStyle(1, 0xff2222, 0.5);
      bg.strokeRoundedRect(startX - 8, y - 10, marks.length * 22 + 16, 24, 6);
    }
    els.push(bg);
    marks.forEach((markId, i) => {
      const md = MARK_DEFS[markId];
      els.push(this.add.text(startX + i * 22 + 3, y, md.icon, {
        fontSize: '13px',
      }).setOrigin(0, 0.5));
    });
    if (isCursed) {
      els.push(this.add.text(400, y + 16, '⚠ 저주받은 자', {
        fontSize: '10px', color: '#ff4444', fontFamily: 'Arial', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5));
    }
  }

  private showResetConfirm() {
    const els: Phaser.GameObjects.GameObject[] = [];
    const bg = this.add.graphics().setDepth(500);
    bg.fillStyle(0x000000, 0.7); bg.fillRect(0, 0, 800, 600);
    els.push(bg);

    const panel = this.add.graphics().setDepth(501);
    panel.fillStyle(0x1a1a2e, 0.95);
    panel.fillRoundedRect(250, 220, 300, 160, 16);
    panel.lineStyle(2, 0xff4444, 0.8);
    panel.strokeRoundedRect(250, 220, 300, 160, 16);
    els.push(panel);

    els.push(this.add.text(400, 255, '⚠ 데이터 초기화', {
      fontSize: '20px', color: '#ff6644', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(502));

    els.push(this.add.text(400, 285, '모든 진행 데이터가 삭제됩니다.\n정말 초기화하시겠습니까?', {
      fontSize: '12px', color: '#cccccc', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 2, align: 'center',
    }).setOrigin(0.5).setDepth(502));

    const makeBtn = (x: number, label: string, color: number, hover: number, onClick: () => void) => {
      const g = this.add.graphics().setDepth(501);
      const draw = (h: boolean) => {
        g.clear();
        g.fillStyle(h ? hover : color, 1);
        g.fillRoundedRect(x - 55, 335, 110, 34, 10);
      };
      draw(false);
      els.push(g);
      els.push(this.add.text(x, 352, label, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(502));
      const z = this.add.zone(x, 352, 110, 34).setInteractive({ useHandCursor: true }).setDepth(503);
      z.on('pointerover', () => draw(true));
      z.on('pointerout', () => draw(false));
      z.on('pointerdown', onClick);
      els.push(z);
    };

    makeBtn(340, '취소', 0x333344, 0x444466, () => {
      els.forEach(e => e.destroy());
    });
    makeBtn(460, '초기화', 0x882222, 0xaa3333, () => {
      SaveManager.resetAll();
      this.registry.set('relicPoints', 0);
      this.registry.set('relicLevels', { ...DEFAULT_RELIC_LEVELS });
      this.registry.set('prestigeCount', 0);
      for (let i = 1; i <= 3; i++) this.registry.set(`bestLocal_${i}`, 0);
      els.forEach(e => e.destroy());
      this.scene.restart();
    });
  }

  private drawClassCard(cls: ClassDef, cx: number, cy: number, cw: number, ch: number, els: Phaser.GameObjects.GameObject[]) {
    const card = this.add.graphics();
    const drawCard = (hover: boolean) => {
      card.clear();
      card.fillStyle(cls.color, hover ? 1 : 0.85);
      card.fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 16);
      card.lineStyle(hover ? 4 : 3, cls.borderColor, hover ? 1 : 0.8);
      card.strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 16);
    };
    drawCard(false);
    els.push(card);

    /* ---- header: icon + name ---- */
    const headY = cy - ch / 2 + 50;
    els.push(this.add.text(cx, headY - 12, cls.icon, { fontSize: '42px' }).setOrigin(0.5));
    els.push(this.add.text(cx, headY + 28, cls.name, {
      fontSize: '26px', color: '#ffffff', fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5));

    /* ---- stats row (HP / ATK / SPD) ---- */
    const statY = headY + 64;
    const statFmt = { fontSize: '13px', color: '#aabbcc', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 2 };
    const valFmt = { fontSize: '16px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 };
    const stats = [
      { label: 'HP', val: `${cls.hp}`, col: '#ff8888' },
      { label: 'ATK', val: `${cls.atk}`, col: '#ffcc66' },
      { label: 'SPD', val: `${(cls.atkIntervalMs / 1000).toFixed(1)}s`, col: '#88ccff' },
    ];
    const gap = cw / 3;
    stats.forEach((s, i) => {
      const sx = cx - cw / 2 + gap * i + gap / 2;
      els.push(this.add.text(sx, statY, s.label, statFmt).setOrigin(0.5));
      els.push(this.add.text(sx, statY + 18, s.val, { ...valFmt, color: s.col }).setOrigin(0.5));
    });

    /* ---- divider line ---- */
    const divG = this.add.graphics();
    divG.lineStyle(1, cls.borderColor, 0.4);
    divG.lineBetween(cx - cw / 2 + 16, statY + 42, cx + cw / 2 - 16, statY + 42);
    els.push(divG);

    /* ---- passive (single highlight line) ---- */
    const passY = statY + 58;
    els.push(this.add.text(cx, passY, `✦ ${cls.passive}`, {
      fontSize: '12px', color: '#ffdd88', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2, wordWrap: { width: cw - 30 }, align: 'center',
    }).setOrigin(0.5));

    /* ---- skill preview (compact) ---- */
    const skillY = passY + 30;
    els.push(this.add.text(cx, skillY, cls.skillPreview.join(' · '), {
      fontSize: '11px', color: '#88bbdd', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 2, wordWrap: { width: cw - 24 }, align: 'center',
    }).setOrigin(0.5));

    /* ---- start bonus (small tag) ---- */
    const bonusY = skillY + 26;
    els.push(this.add.text(cx, bonusY, `🎁 ${cls.startBonus}`, {
      fontSize: '11px', color: '#aaffaa', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));

    /* ---- select button ---- */
    const btnY = cy + ch / 2 - 36, btnW = 140, btnH = 40;
    const btnG = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? cls.hoverColor : cls.color, 1);
      btnG.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
      btnG.lineStyle(2, cls.borderColor, hover ? 1 : 0.7);
      btnG.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
    };
    drawBtn(false);
    els.push(btnG);

    els.push(this.add.text(cx, btnY, '▶ 선택', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5));

    /* ---- interactions ---- */
    const fullZone = this.add.zone(cx, cy, cw, ch).setInteractive({ useHandCursor: true });
    fullZone.on('pointerover', () => { drawCard(true); drawBtn(true); });
    fullZone.on('pointerout', () => { drawCard(false); drawBtn(false); });
    fullZone.on('pointerdown', () => {
      this.selectedClassId = cls.id;
      this.cameras.main.flash(200, ...this.hexToRgb(cls.borderColor));
      this.time.delayedCall(250, () => this.showRegionSelection());
    });
    els.push(fullZone);
  }

  private hexToRgb(hex: number): [number, number, number] {
    return [(hex >> 16) & 0xff, (hex >> 8) & 0xff, hex & 0xff];
  }

  /* ==== REGION SELECTION ==== */

  private showRegionSelection() {
    this.clearScreen();
    const els = this.screenElements;

    const cls = CLASSES.find(c => c.id === this.selectedClassId) ?? CLASSES[0];

    els.push(this.add.text(400, 30, '⚔ MONSTER CLICKER ⚔', {
      fontSize: '34px', color: '#ffd700', fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5));

    const classTag = this.add.graphics();
    classTag.fillStyle(cls.color, 0.8);
    classTag.fillRoundedRect(320, 52, 160, 28, 8);
    classTag.lineStyle(2, cls.borderColor, 0.8);
    classTag.strokeRoundedRect(320, 52, 160, 28, 8);
    els.push(classTag);
    els.push(this.add.text(400, 66, `${cls.icon} ${cls.name}`, {
      fontSize: '14px', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));

    const backBtn = this.add.graphics();
    const drawBack = (hover: boolean) => {
      backBtn.clear();
      backBtn.fillStyle(hover ? 0x333344 : 0x222233, 1);
      backBtn.fillRoundedRect(20, 52, 90, 28, 8);
      backBtn.lineStyle(1, 0x555566, 0.8);
      backBtn.strokeRoundedRect(20, 52, 90, 28, 8);
    };
    drawBack(false);
    els.push(backBtn);
    els.push(this.add.text(65, 66, '◀ 뒤로', {
      fontSize: '13px', color: '#aaaacc', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));
    const backZone = this.add.zone(65, 66, 90, 28).setInteractive({ useHandCursor: true });
    backZone.on('pointerover', () => drawBack(true));
    backZone.on('pointerout', () => drawBack(false));
    backZone.on('pointerdown', () => this.showClassSelection());
    els.push(backZone);

    els.push(this.add.text(400, 100, '지역을 선택하여 모험을 시작하세요', {
      fontSize: '14px', color: '#8888aa', fontFamily: 'Arial, sans-serif',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5));

    this.drawRegionCards(els);
    this.drawRelicArea(els);
  }

  private drawRegionCards(els: Phaser.GameObjects.GameObject[]) {
    const cardW = 210, cardH = 310, gap = 25;
    const totalW = cardW * 3 + gap * 2;
    const startX = (800 - totalW) / 2 + cardW / 2;

    REGIONS.forEach((r, i) => {
      const ri = i + 1;
      const cx = startX + i * (cardW + gap), cy = 300;
      const unlocked = this.isUnlocked(ri);
      const best = this.bestLocal(ri);
      const cleared = best >= 20;
      const stageStart = i * 20 + 1, stageEnd = (i + 1) * 20;

      const card = this.add.graphics();
      if (unlocked) {
        card.fillStyle(r.bgTop, 0.85);
        card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16);
        card.lineStyle(3, cleared ? 0xffd700 : 0x4466aa, 0.9);
        card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16);
        const topG = this.add.graphics();
        topG.fillStyle(r.bgBot, 0.6);
        topG.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, 70, { tl: 16, tr: 16, bl: 0, br: 0 });
        els.push(topG);
        els.push(this.add.text(cx, cy - cardH / 2 + 35, r.icon, { fontSize: '36px' }).setOrigin(0.5));
      } else {
        card.fillStyle(0x111122, 0.7);
        card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16);
        card.lineStyle(2, 0x333344, 0.5);
        card.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 16);
        els.push(this.add.text(cx, cy - cardH / 2 + 35, '🔒', { fontSize: '36px' }).setOrigin(0.5).setAlpha(0.5));
      }
      els.push(card);

      els.push(this.add.text(cx, cy - 60, r.name, {
        fontSize: '22px', color: unlocked ? '#ffffff' : '#555566', fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5));
      els.push(this.add.text(cx, cy - 30, `Stage ${stageStart}~${stageEnd}`, {
        fontSize: '14px', color: unlocked ? '#aabbcc' : '#444455', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5));

      if (cleared) {
        els.push(this.add.text(cx, cy + 5, '✅ 클리어 완료', {
          fontSize: '14px', color: '#44ff88', fontFamily: 'Arial', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5));
      } else if (unlocked && best > 0) {
        els.push(this.add.text(cx, cy + 5, `최고 기록: ${best}/20`, {
          fontSize: '14px', color: '#aaddff', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5));
      } else if (unlocked) {
        els.push(this.add.text(cx, cy + 5, '기록 없음', {
          fontSize: '13px', color: '#666677', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5));
      } else {
        const prevName = REGIONS[i - 1]?.name ?? '';
        els.push(this.add.text(cx, cy + 5, `${prevName} 클리어 시 해금`, {
          fontSize: '12px', color: '#555566', fontFamily: 'Arial', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5));
      }

      if (unlocked) {
        const btnY = cy + 80, btnW = 140, btnH = 44;
        const btnG = this.add.graphics();
        const drawBtn = (hover: boolean) => {
          btnG.clear();
          btnG.fillStyle(hover ? 0x336644 : 0x224433, 1);
          btnG.fillRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
          btnG.lineStyle(2, hover ? 0x66cc88 : 0x44aa66, 1);
          btnG.strokeRoundedRect(cx - btnW / 2, btnY - btnH / 2, btnW, btnH, 12);
        };
        drawBtn(false);
        els.push(btnG);
        els.push(this.add.text(cx, btnY, '▶ 시작하기', {
          fontSize: '16px', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
        }).setOrigin(0.5));
        const zone = this.add.zone(cx, btnY, btnW, btnH).setInteractive({ useHandCursor: true });
        zone.on('pointerover', () => drawBtn(true));
        zone.on('pointerout', () => drawBtn(false));
        zone.on('pointerdown', () => {
          this.cameras.main.fade(300, 0, 0, 0, false, (_cam: Phaser.Cameras.Scene2D.Camera, progress: number) => {
            if (progress >= 1) this.scene.start('GameScene', { startRegion: ri, classId: this.selectedClassId });
          });
        });
        els.push(zone);

        const diff = i === 0 ? '쉬움~보통' : i === 1 ? '도전적' : '매우 어려움';
        const dColor = i === 0 ? '#44aa66' : i === 1 ? '#ddaa44' : '#dd4444';
        els.push(this.add.text(cx, cy + 120, diff, {
          fontSize: '11px', color: dColor, fontFamily: 'Arial', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5));
      } else {
        els.push(this.add.text(cx, cy + 80, '🔒 잠김', {
          fontSize: '16px', color: '#444455', fontFamily: 'Arial, sans-serif', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5));
      }
    });
  }

  private drawRelicArea(els: Phaser.GameObjects.GameObject[]) {
    els.push(this.add.text(710, 548, `💎 ${this.relicPoints}`, {
      fontSize: '16px', color: '#cc88ff', fontFamily: 'Arial, sans-serif', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5));

    const bx = 710, by = 575, bw = 100, bh = 34;
    const btnG = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? 0x4a3377 : 0x332255, 1);
      btnG.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
      btnG.lineStyle(2, hover ? 0xaa77ee : 0x8855cc, 1);
      btnG.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
    };
    drawBtn(false);
    els.push(btnG);
    els.push(this.add.text(bx, by, '💎 유물', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5));
    const zone = this.add.zone(bx, by, bw, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBtn(true));
    zone.on('pointerout', () => drawBtn(false));
    zone.on('pointerdown', () => {
      if (!this.relicPanel.isOpen) this.relicPanel.open();
    });
    els.push(zone);

    this.drawAchievementButton(els);
  }

  private drawAchievementButton(els: Phaser.GameObjects.GameObject[]) {
    const achData = SaveManager.loadAchievements();
    const unclaimed = ACHIEVEMENTS.filter(a => achData.unlocked[a.id] && !achData.claimed[a.id]).length;

    const bx = 590, by = 575, bw = 100, bh = 34;
    const btnG = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnG.clear();
      btnG.fillStyle(hover ? 0x554422 : 0x332211, 1);
      btnG.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
      btnG.lineStyle(2, hover ? 0xddaa44 : 0xaa7722, 1);
      btnG.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 10);
    };
    drawBtn(false);
    els.push(btnG);
    els.push(this.add.text(bx, by, '🏆 업적', {
      fontSize: '14px', color: '#ffffff', fontFamily: 'Arial, sans-serif', fontStyle: 'bold',
    }).setOrigin(0.5));

    if (unclaimed > 0) {
      const badge = this.add.graphics();
      badge.fillStyle(0xff3333, 1);
      badge.fillCircle(bx + bw / 2 - 6, by - bh / 2 + 6, 9);
      els.push(badge);
      els.push(this.add.text(bx + bw / 2 - 6, by - bh / 2 + 6, `${unclaimed}`, {
        fontSize: '10px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5));
    }

    const zone = this.add.zone(bx, by, bw, bh).setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => drawBtn(true));
    zone.on('pointerout', () => drawBtn(false));
    zone.on('pointerdown', () => this.showAchievementPanel());
    els.push(zone);
  }

  private showAchievementPanel() {
    const achData = SaveManager.loadAchievements();
    const panelEls: Phaser.GameObjects.GameObject[] = [];

    const bg = this.add.graphics().setDepth(500);
    bg.fillStyle(0x000000, 0.75); bg.fillRect(0, 0, 800, 600);
    panelEls.push(bg);

    const panel = this.add.graphics().setDepth(501);
    panel.fillStyle(0x12122a, 0.95);
    panel.fillRoundedRect(40, 30, 720, 540, 16);
    panel.lineStyle(2, 0xffd700, 0.5);
    panel.strokeRoundedRect(40, 30, 720, 540, 16);
    panelEls.push(panel);

    panelEls.push(this.add.text(400, 55, '🏆 업적', {
      fontSize: '28px', color: '#ffd700', fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(502));

    const total = ACHIEVEMENTS.length;
    const done = ACHIEVEMENTS.filter(a => achData.unlocked[a.id]).length;
    panelEls.push(this.add.text(400, 82, `${done}/${total} 달성`, {
      fontSize: '13px', color: '#aaaacc', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(502));

    const categories = ['combat', 'build', 'class', 'challenge'];
    let gy = 102;

    for (const cat of categories) {
      const catInfo = CATEGORY_LABELS[cat];
      const items = ACHIEVEMENTS.filter(a => a.category === cat);

      panelEls.push(this.add.text(70, gy, `▸ ${catInfo.name}`, {
        fontSize: '13px', color: catInfo.color, fontFamily: 'Arial', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setDepth(502));
      gy += 20;

      const cols = 4;
      const cellW = 168, cellH = 62;

      items.forEach((ach, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = 70 + col * (cellW + 6), cy = gy + row * (cellH + 4);
        const unlocked = !!achData.unlocked[ach.id];
        const claimed = !!achData.claimed[ach.id];

        const card = this.add.graphics().setDepth(502);
        card.fillStyle(unlocked ? 0x1a2a1a : 0x151520, 0.9);
        card.fillRoundedRect(cx, cy, cellW, cellH, 8);
        card.lineStyle(1.5, unlocked ? 0x44aa44 : 0x333344, unlocked ? 0.8 : 0.4);
        card.strokeRoundedRect(cx, cy, cellW, cellH, 8);
        panelEls.push(card);

        const iconAlpha = unlocked ? 1 : 0.3;
        panelEls.push(this.add.text(cx + 8, cy + 8, ach.icon, {
          fontSize: '18px',
        }).setDepth(503).setAlpha(iconAlpha));

        panelEls.push(this.add.text(cx + 32, cy + 6, ach.name, {
          fontSize: '11px', color: unlocked ? '#ffffff' : '#555566',
          fontFamily: 'Arial', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2,
        }).setDepth(503));

        panelEls.push(this.add.text(cx + 32, cy + 22, ach.desc, {
          fontSize: '9px', color: unlocked ? '#88aacc' : '#444455',
          fontFamily: 'Arial', stroke: '#000000', strokeThickness: 1,
          wordWrap: { width: cellW - 40 },
        }).setDepth(503));

        if (unlocked && !claimed) {
          const rbx = cx + cellW - 36, rby = cy + cellH - 14;
          const rbg = this.add.graphics().setDepth(503);
          rbg.fillStyle(0x226622, 1);
          rbg.fillRoundedRect(rbx - 16, rby - 8, 48, 16, 4);
          panelEls.push(rbg);
          const rText = this.add.text(rbx + 8, rby, `+${ach.reward}💎`, {
            fontSize: '9px', color: '#44ff44', fontFamily: 'Arial', fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(504);
          panelEls.push(rText);
          const rZone = this.add.zone(rbx + 8, rby, 48, 16)
            .setInteractive({ useHandCursor: true }).setDepth(505);
          rZone.on('pointerdown', () => {
            achData.claimed[ach.id] = true;
            SaveManager.saveAchievements(achData);
            const perm = SaveManager.loadPermanent();
            perm.relicPoints += ach.reward;
            SaveManager.savePermanent(perm);
            this.registry.set('relicPoints', perm.relicPoints);
            panelEls.forEach(e => e.destroy());
            this.showAchievementPanel();
          });
          panelEls.push(rZone);
        } else if (unlocked && claimed) {
          panelEls.push(this.add.text(cx + cellW - 18, cy + cellH - 14, '✅', {
            fontSize: '10px',
          }).setOrigin(0.5).setDepth(503));
        } else {
          panelEls.push(this.add.text(cx + cellW - 22, cy + cellH - 14, `+${ach.reward}💎`, {
            fontSize: '8px', color: '#444455', fontFamily: 'Arial',
            stroke: '#000000', strokeThickness: 1,
          }).setOrigin(0.5).setDepth(503));
        }
      });

      gy += Math.ceil(items.length / cols) * (cellH + 4) + 8;
    }

    const closeBx = 400, closeBy = 548, closeBw = 120, closeBh = 34;
    const closeG = this.add.graphics().setDepth(502);
    const drawClose = (hover: boolean) => {
      closeG.clear();
      closeG.fillStyle(hover ? 0x444455 : 0x333344, 1);
      closeG.fillRoundedRect(closeBx - closeBw / 2, closeBy - closeBh / 2, closeBw, closeBh, 10);
    };
    drawClose(false);
    panelEls.push(closeG);
    panelEls.push(this.add.text(closeBx, closeBy, '닫기', {
      fontSize: '16px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(503));
    const closeZone = this.add.zone(closeBx, closeBy, closeBw, closeBh)
      .setInteractive({ useHandCursor: true }).setDepth(504);
    closeZone.on('pointerover', () => drawClose(true));
    closeZone.on('pointerout', () => drawClose(false));
    closeZone.on('pointerdown', () => {
      panelEls.forEach(e => e.destroy());
      this.clearScreen();
      this.showClassSelection();
    });
    panelEls.push(closeZone);
  }
}
