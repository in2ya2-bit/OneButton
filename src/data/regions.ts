export interface RegionMonster { name: string; type: string; size: number }

export interface RegionDef {
  name: string; icon: string;
  bgTop: number; bgBot: number; panelColor: number;
  hpMult: number; atkMult: number; goldMult: number;
  monsters: RegionMonster[];
  miniBossName: string; miniBossType: string;
  bossName: string; bossType: string;
}

export const REGIONS: RegionDef[] = [
  {
    name: '어둠의 숲', icon: '🌲',
    bgTop: 0x1a1a2e, bgBot: 0x16213e, panelColor: 0x0f3460,
    hpMult: 1, atkMult: 1, goldMult: 1,
    monsters: [
      { name: '슬라임', type: 'slime', size: 55 },
      { name: '스켈레톤', type: 'skeleton', size: 60 },
      { name: '오크', type: 'orc', size: 70 },
    ],
    miniBossName: '💀 어둠의 드래곤', miniBossType: 'dragon',
    bossName: '👑 숲의 마왕', bossType: 'boss',
  },
  {
    name: '해골 던전', icon: '💀',
    bgTop: 0x1a1a28, bgBot: 0x2a1a3e, panelColor: 0x2a1a40,
    hpMult: 1.5, atkMult: 1.5, goldMult: 1.5,
    monsters: [
      { name: '해골 전사', type: 'skeleton', size: 65 },
      { name: '언데드 오크', type: 'orc', size: 72 },
      { name: '해골 슬라임', type: 'slime', size: 58 },
    ],
    miniBossName: '💀 해골 드래곤', miniBossType: 'dragon',
    bossName: '👑 던전의 군주', bossType: 'boss',
  },
  {
    name: '용암 동굴', icon: '🌋',
    bgTop: 0x2e1a1a, bgBot: 0x3e2a16, panelColor: 0x3a1500,
    hpMult: 2.2, atkMult: 2.2, goldMult: 2.5,
    monsters: [
      { name: '화염 오크', type: 'orc', size: 75 },
      { name: '용족 병사', type: 'dragon', size: 65 },
      { name: '마그마 골렘', type: 'skeleton', size: 70 },
    ],
    miniBossName: '💀 화염 드래곤', miniBossType: 'dragon',
    bossName: '👑 용암의 마왕', bossType: 'boss',
  },
];
