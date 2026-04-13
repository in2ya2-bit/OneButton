import Phaser from 'phaser';

export class OverlayManager {
  constructor(private scene: Phaser.Scene) {}
  // 이후 GameScene에서 아래 메서드들이 이전될 예정:
  // openShop, closeOverlay
  // toggleRelic
  // showGameOver
  // showRunClear
  // showPauseMenu, hidePauseMenu, togglePauseMenu
  // showNarration, dismissNarration
}
