import Phaser from 'phaser';

export class StageManager {
  constructor(private scene: Phaser.Scene) {}
  // 이후 GameScene에서 아래 메서드들이 이전될 예정:
  // startStage, spawnNextWave, spawnMonster, doSpawnMonster
  // advanceToNextStage
  // showDoorSelection, generateDoors
  // showRestScreen, showEventScreen
  // showBossWarning, startBossPatterns, executeBossPattern
  // handleMonsterKill
}
