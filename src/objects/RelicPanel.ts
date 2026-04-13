import Phaser from 'phaser';
import { RELICS, MAX_RELIC_LV, relicUpgradeCost, DEFAULT_RELIC_LEVELS } from '../data/relics';

const COLS = 4, ROWS = 5;
const CARD_W = 148, CARD_H = 58, GAP = 8;
const GRID_W = COLS * CARD_W + (COLS - 1) * GAP;
const GRID_X0 = (800 - GRID_W) / 2;
const GRID_Y0 = 108;
const DETAIL_Y = GRID_Y0 + ROWS * (CARD_H + GAP) + 4;

export class RelicPanel {
  private scene: Phaser.Scene;
  private els: Phaser.GameObjects.GameObject[] = [];
  private selectedIdx = 0;
  private tab: 'upgrade' | 'refund' = 'upgrade';
  private _open = false;
  private onCloseCb?: () => void;
  private onUpgradeCb?: () => void;

  constructor(scene: Phaser.Scene, opts?: { onClose?: () => void; onUpgrade?: () => void }) {
    this.scene = scene;
    this.onCloseCb = opts?.onClose;
    this.onUpgradeCb = opts?.onUpgrade;
  }

  get isOpen() { return this._open; }

  private get pts(): number { return this.scene.registry.get('relicPoints') ?? 0; }
  private set pts(v: number) { this.scene.registry.set('relicPoints', v); }
  private get rl(): Record<string, number> {
    const stored = this.scene.registry.get('relicLevels');
    return { ...DEFAULT_RELIC_LEVELS, ...(stored ?? {}) };
  }
  private setLv(id: string, lv: number) {
    const c = { ...this.rl }; c[id] = lv;
    this.scene.registry.set('relicLevels', c);
  }

  open() { this._open = true; this.selectedIdx = 0; this.tab = 'upgrade'; this.draw(); }
  close() { this._open = false; this.els.forEach(e => e.destroy()); this.els = []; this.onCloseCb?.(); }

  private draw() {
    this.els.forEach(e => e.destroy()); this.els = [];
    const s = this.scene, e = this.els;
    const D = 260;

    const bg = s.add.graphics().setDepth(D);
    bg.fillStyle(0x000000, 0.75); bg.fillRect(0, 0, 800, 600);
    e.push(bg);

    const panel = s.add.graphics().setDepth(D);
    panel.fillStyle(0x0c0c1e, 0.97); panel.fillRoundedRect(28, 14, 744, 572, 12);
    panel.lineStyle(2, 0x4433aa, 0.7); panel.strokeRoundedRect(28, 14, 744, 572, 12);
    e.push(panel);

    e.push(s.add.text(400, 42, '유물 강화', {
      fontSize: '26px', color: '#ddbb66', fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(D + 1));

    e.push(s.add.text(720, 42, `💎 ${this.pts}`, {
      fontSize: '16px', color: '#cc88ff', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(D + 1));

    const closeZ = s.add.zone(748, 30, 36, 28).setInteractive({ useHandCursor: true }).setDepth(D + 3);
    closeZ.on('pointerdown', () => this.close());
    e.push(closeZ);
    e.push(s.add.text(748, 30, '✕', { fontSize: '18px', color: '#ff6666', fontFamily: 'Arial', fontStyle: 'bold' })
      .setOrigin(0.5).setDepth(D + 2));

    this.drawTabs(D);
    this.drawGrid(D);
    this.drawDetail(D);
  }

  private drawTabs(D: number) {
    const s = this.scene, e = this.els;
    const tabs: [string, 'upgrade' | 'refund'][] = [['강화', 'upgrade'], ['포인트 환불', 'refund']];
    tabs.forEach(([label, key], i) => {
      const tx = 200 + i * 160, ty = 72;
      const active = this.tab === key;
      const g = s.add.graphics().setDepth(D + 1);
      g.fillStyle(active ? 0x2a2244 : 0x111122, 1);
      g.fillRoundedRect(tx - 60, ty - 14, 120, 28, 6);
      g.lineStyle(1, active ? 0x8866cc : 0x333344, 1);
      g.strokeRoundedRect(tx - 60, ty - 14, 120, 28, 6);
      e.push(g);
      e.push(s.add.text(tx, ty, label, {
        fontSize: '13px', color: active ? '#ddbb66' : '#666677', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(D + 2));
      const z = s.add.zone(tx, ty, 120, 28).setInteractive({ useHandCursor: true }).setDepth(D + 3);
      z.on('pointerdown', () => { this.tab = key; this.draw(); });
      e.push(z);
    });
  }

  private drawGrid(D: number) {
    const s = this.scene, e = this.els;
    const rl = this.rl;

    RELICS.forEach((relic, i) => {
      const col = i % COLS, row = Math.floor(i / COLS);
      const cx = GRID_X0 + col * (CARD_W + GAP) + CARD_W / 2;
      const cy = GRID_Y0 + row * (CARD_H + GAP) + CARD_H / 2;
      const lv = rl[relic.id] ?? 0;
      const isMax = lv >= MAX_RELIC_LV;
      const sel = i === this.selectedIdx;

      const g = s.add.graphics().setDepth(D + 1);
      g.fillStyle(sel ? 0x222244 : 0x111128, 1);
      g.fillRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 8);
      const borderColor = isMax ? 0xddaa33 : (sel ? 0x6644aa : 0x2a2a44);
      g.lineStyle(isMax ? 2 : 1.5, borderColor, isMax ? 1 : 0.7);
      g.strokeRoundedRect(cx - CARD_W / 2, cy - CARD_H / 2, CARD_W, CARD_H, 8);
      e.push(g);

      const texKey = `relic_${relic.id}`;
      const iconX = cx - CARD_W / 2 + 22;
      if (s.textures.exists(texKey)) {
        const img = s.add.image(iconX, cy - 6, texKey).setDepth(D + 2).setScale(0.85);
        e.push(img);
      } else {
        e.push(s.add.text(iconX, cy - 8, relic.icon, { fontSize: '20px' }).setOrigin(0.5).setDepth(D + 2));
      }

      e.push(s.add.text(cx + 8, cy - 14, relic.name, {
        fontSize: '11px', color: lv > 0 ? '#ffffff' : '#777788', fontFamily: 'Arial', fontStyle: 'bold',
        stroke: '#000000', strokeThickness: 2,
      }).setOrigin(0.5, 0.5).setDepth(D + 2));

      const barY = cy + 10, barX0 = cx - 20;
      for (let b = 0; b < MAX_RELIC_LV; b++) {
        const bx = barX0 + b * 10;
        const bg2 = s.add.graphics().setDepth(D + 2);
        bg2.fillStyle(b < lv ? (isMax ? 0xddaa33 : 0x8855cc) : 0x222233, 1);
        bg2.fillRect(bx, barY, 8, 5);
        bg2.lineStyle(1, 0x333344, 0.5); bg2.strokeRect(bx, barY, 8, 5);
        e.push(bg2);
      }

      const z = s.add.zone(cx, cy, CARD_W, CARD_H)
        .setInteractive({ useHandCursor: true }).setDepth(D + 3);
      z.on('pointerdown', () => { this.selectedIdx = i; this.draw(); });
      e.push(z);
    });
  }

  private drawDetail(D: number) {
    const s = this.scene, e = this.els;
    const relic = RELICS[this.selectedIdx];
    if (!relic) return;
    const rl = this.rl;
    const lv = rl[relic.id] ?? 0;
    const isMax = lv >= MAX_RELIC_LV;

    const py = DETAIL_Y;
    const pg = s.add.graphics().setDepth(D + 1);
    pg.fillStyle(0x111128, 0.95);
    pg.fillRoundedRect(48, py, 704, 100, 10);
    pg.lineStyle(1.5, relic.color, 0.5);
    pg.strokeRoundedRect(48, py, 704, 100, 10);
    e.push(pg);

    const texKey = `relic_${relic.id}`;
    if (s.textures.exists(texKey)) {
      e.push(s.add.image(88, py + 35, texKey).setDepth(D + 2).setScale(1.1));
    } else {
      e.push(s.add.text(88, py + 30, relic.icon, { fontSize: '28px' }).setOrigin(0.5).setDepth(D + 2));
    }

    e.push(s.add.text(130, py + 12, relic.name, {
      fontSize: '16px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(D + 2));

    const curStr = lv > 0 ? `현재 Lv.${lv}: ${relic.descFn(lv)}` : '미보유';
    e.push(s.add.text(130, py + 38, curStr, {
      fontSize: '12px', color: lv > 0 ? '#88ddaa' : '#555566', fontFamily: 'Arial',
      stroke: '#000000', strokeThickness: 2,
    }).setDepth(D + 2));

    if (!isMax) {
      const nextStr = `다음 Lv.${lv + 1}: ${relic.descFn(lv + 1)}`;
      e.push(s.add.text(130, py + 58, nextStr, {
        fontSize: '11px', color: '#aabbdd', fontFamily: 'Arial',
        stroke: '#000000', strokeThickness: 2,
      }).setDepth(D + 2));
    }

    const stars = lv > 0
      ? '★'.repeat(lv) + '☆'.repeat(MAX_RELIC_LV - lv)
      : '☆'.repeat(MAX_RELIC_LV);
    e.push(s.add.text(130, py + 78, stars, {
      fontSize: '12px', color: isMax ? '#ddaa33' : (lv > 0 ? '#ffcc00' : '#444444'), fontFamily: 'Arial',
    }).setDepth(D + 2));

    if (this.tab === 'upgrade') {
      if (isMax) {
        e.push(s.add.text(640, py + 40, 'MAX', {
          fontSize: '22px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(D + 2));
      } else {
        const cost = relicUpgradeCost(lv + 1);
        const canUp = this.pts >= cost;
        e.push(s.add.text(640, py + 18, `${cost} 💎`, {
          fontSize: '15px', color: canUp ? '#cc88ff' : '#555555', fontFamily: 'Arial', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(D + 2));

        const btnG = s.add.graphics().setDepth(D + 2);
        const drawBtn = (hover: boolean) => {
          btnG.clear();
          const fc = canUp ? (hover ? 0x6644aa : 0x4a3388) : 0x222233;
          const bc = canUp ? (hover ? 0xaa77ee : 0x7755bb) : 0x333344;
          btnG.fillStyle(fc, 1); btnG.fillRoundedRect(600, py + 46, 80, 32, 8);
          btnG.lineStyle(2, bc, 1); btnG.strokeRoundedRect(600, py + 46, 80, 32, 8);
        };
        drawBtn(false); e.push(btnG);
        e.push(s.add.text(640, py + 62, '구입', {
          fontSize: '14px', color: canUp ? '#ffffff' : '#555555', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(D + 3));
        if (canUp) {
          const bz = s.add.zone(640, py + 62, 80, 32)
            .setInteractive({ useHandCursor: true }).setDepth(D + 4);
          bz.on('pointerdown', () => this.doUpgrade());
          bz.on('pointerover', () => drawBtn(true));
          bz.on('pointerout', () => drawBtn(false));
          e.push(bz);
        }
      }
    } else {
      if (lv > 0) {
        let refundPts = 0;
        for (let l = 1; l <= lv; l++) refundPts += relicUpgradeCost(l);
        e.push(s.add.text(640, py + 18, `환불: +${refundPts} 💎`, {
          fontSize: '13px', color: '#cc88ff', fontFamily: 'Arial', fontStyle: 'bold',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(D + 2));

        const btnG = s.add.graphics().setDepth(D + 2);
        const drawBtn = (hover: boolean) => {
          btnG.clear();
          const fc = hover ? 0x663333 : 0x442222;
          btnG.fillStyle(fc, 1); btnG.fillRoundedRect(600, py + 46, 80, 32, 8);
          btnG.lineStyle(2, hover ? 0xcc5555 : 0x884444, 1);
          btnG.strokeRoundedRect(600, py + 46, 80, 32, 8);
        };
        drawBtn(false); e.push(btnG);
        e.push(s.add.text(640, py + 62, '환불', {
          fontSize: '14px', color: '#ff8888', fontFamily: 'Arial', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(D + 3));
        const bz = s.add.zone(640, py + 62, 80, 32)
          .setInteractive({ useHandCursor: true }).setDepth(D + 4);
        bz.on('pointerdown', () => this.doRefund());
        bz.on('pointerover', () => drawBtn(true));
        bz.on('pointerout', () => drawBtn(false));
        e.push(bz);
      } else {
        e.push(s.add.text(640, py + 50, '레벨 없음', {
          fontSize: '13px', color: '#555555', fontFamily: 'Arial',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(D + 2));
      }
    }
  }

  private doUpgrade() {
    const relic = RELICS[this.selectedIdx];
    const lv = this.rl[relic.id] ?? 0;
    if (lv >= MAX_RELIC_LV) return;
    const cost = relicUpgradeCost(lv + 1);
    if (this.pts < cost) return;
    this.pts = this.pts - cost;
    this.setLv(relic.id, lv + 1);
    this.onUpgradeCb?.();
    this.draw();
  }

  private doRefund() {
    const relic = RELICS[this.selectedIdx];
    const lv = this.rl[relic.id] ?? 0;
    if (lv <= 0) return;
    let refundPts = 0;
    for (let l = 1; l <= lv; l++) refundPts += relicUpgradeCost(l);
    this.pts = this.pts + refundPts;
    this.setLv(relic.id, 0);
    this.onUpgradeCb?.();
    this.draw();
  }
}
