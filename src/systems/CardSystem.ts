import Phaser from 'phaser';

export class CardSystem {
  constructor(private scene: Phaser.Scene) {}
  // 이후 GameScene에서 아래 메서드들이 이전될 예정:
  // showCardSelection, renderMixedCards, drawCardUI
  // shouldOfferAutoAtkCard, pickAutoAtkCard
  // finishCardPick
  // checkSynergies, createSynergyDisplay, updateSynergyDisplay
}
