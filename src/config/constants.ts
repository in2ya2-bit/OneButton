/* ---- balance constants ---- */

export const INIT_HP = 100;
export const INIT_ATK = 4;
export const INIT_ATK_INTERVAL_MS = 1200;
export const MIN_ATK_INTERVAL_MS = 300;
export const INIT_MP = 80;
export const MP_REGEN_PER_SEC = 0.3;

export const MON_BASE_HP = 40;
export const MON_HP_GROWTH = 1.08;
export const MON_BASE_ATK = 6;
export const MON_ATK_GROWTH = 1.06;
export const MON_ATK_INTERVAL_NORMAL = 2500;
export const MON_ATK_INTERVAL_MINI = 2000;
export const MON_ATK_INTERVAL_FINAL = 1500;

/* ---- layout constants ---- */

// 버튼
export const SHOP_BTN = { x: 290, y: 576, w: 170, h: 32 } as const;
export const RELIC_BTN = { x: 490, y: 576, w: 170, h: 32 } as const;

// HP/MP바 - 스킬슬롯 바로 위, 화면 중앙
export const HP_BAR = { x: 310, y: 488, w: 260, h: 14 } as const;
export const MP_BAR = { x: 310, y: 506, w: 260, h: 7 } as const;

// XP바
export const XP_BAR = { x: 320, y: 26, w: 160, h: 5 } as const;

// 몬스터 위치
export const MAIN_MON_POS = { x: 400, y: 185 };
export const SUB_MON_POSITIONS = [
  { x: 210, y: 270 },
  { x: 590, y: 270 },
  { x: 250, y: 330 },
  { x: 550, y: 330 },
];

// 플레이어 캐릭터 위치 (패링 게이지 아래, HP바 위)
export const PLAYER_POS = { x: 400, y: 435 };

// 스킬 슬롯
export const MAX_SLOTS = 4;
export const SLOT_W = 62;
export const SLOT_H = 55;
export const SLOT_Y = 520;
export const SLOT_XS = Array.from({ length: MAX_SLOTS }, (_, i) => 270 + i * 68);

// 퀵슬롯
export const QSLOT_W = 52;
export const QSLOT_H = 52;
export const QSLOT_Y = SLOT_Y;
export const QSLOT_XS = [78, 142];

export const MAX_POTION_STACK = 9;
