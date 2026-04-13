import Phaser from 'phaser';

export class UIManager {
  constructor(private scene: Phaser.Scene) {}
  // 이후 GameScene에서 아래 메서드들이 이전될 예정:
  // createUI, createPlayerHpBar, createXpBar
  // drawPlayerHpBar, drawXpBar, drawMpBar
  // createSkillSlots, createQuickSlots
  // createBuffBar, updateBuffBar
  // createOverdriveGauge, drawOverdriveGauge
  // createParryUI, createResponseButtons
  // refreshSkillButtonStates, rebuildSkillUI
  // updateUI, updateSynergyDisplay
}
