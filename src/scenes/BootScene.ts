import Phaser from 'phaser';
import { generateMonsterTextures } from '../objects/MonsterArt';
import { generateRelicTextures } from '../objects/RelicIcons';
import { SaveManager } from '../data/SaveManager';
import { DEFAULT_RELIC_LEVELS } from '../data/relics';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    generateMonsterTextures(this);
    generateRelicTextures(this);

    const particleCanvas = this.textures.createCanvas('particle', 16, 16);
    if (particleCanvas) {
      const ctx = particleCanvas.context;
      const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(8, 8, 8, 0, Math.PI * 2);
      ctx.fill();
      particleCanvas.refresh();
    }

    const perm = SaveManager.loadPermanent();
    this.registry.set('relicPoints', perm.relicPoints);
    this.registry.set('relicLevels', { ...DEFAULT_RELIC_LEVELS, ...perm.relicLevels });
    this.registry.set('prestigeCount', perm.prestigeCount);
    for (const [ri, best] of Object.entries(perm.bestLocal)) {
      this.registry.set(`bestLocal_${ri}`, best);
    }

    this.scene.start('TitleScene');
  }
}
