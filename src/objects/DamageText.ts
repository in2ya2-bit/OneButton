import Phaser from 'phaser';

export class DamageText {
  static show(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string | number,
    color = '#ffffff',
    fontSize = '28px',
  ) {
    const t = scene.add
      .text(x, y, String(text), {
        fontSize,
        color,
        fontFamily: 'Arial, sans-serif',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(100);

    scene.tweens.add({
      targets: t,
      y: y - 70,
      alpha: 0,
      scale: 1.3,
      duration: 900,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }
}
