import Phaser from 'phaser';

export class BattleSystem {
  constructor(private scene: Phaser.Scene) {}
  // 이후 GameScene에서 아래 메서드들이 이전될 예정:
  // addOverdrive, tryActivateOverdrive, activateOverdrive, endOverdrive
  // addComboHit
  // attemptParry, executeParryReward, cancelParrySequence
  // startMonsterAttackSequence, runMultiHitGauge, finishMultiHit
  // onMonsterAttack, onAutoAttack
  // tryRogueDodge
}
