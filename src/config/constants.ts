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

export const SHOP_BTN = { x: 330, y: 560, w: 160, h: 36 } as const;
export const RELIC_BTN = { x: 510, y: 560, w: 160, h: 36 } as const;
export const HP_BAR = { x: 535, y: 62, w: 235, h: 18 } as const;
export const MP_BAR = { x: 535, y: 86, w: 235, h: 10 } as const;
export const XP_BAR = { x: 335, y: 42, w: 130, h: 5 } as const;

export const MAIN_MON_POS = { x: 400, y: 230 };
export const SUB_MON_POSITIONS = [
  { x: 200, y: 360 },
  { x: 600, y: 360 },
  { x: 300, y: 395 },
  { x: 500, y: 395 },
];

export const MAX_SLOTS = 4;
export const SLOT_W = 62;
export const SLOT_H = 55;
export const SLOT_Y = 478;
export const SLOT_XS = Array.from({ length: MAX_SLOTS }, (_, i) => 270 + i * 68);

export const QSLOT_W = 52;
export const QSLOT_H = 52;
export const QSLOT_Y = SLOT_Y;
export const QSLOT_XS = [78, 142];

export const MAX_POTION_STACK = 9;
