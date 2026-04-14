import Phaser from 'phaser';

const SIZE = 128;

type BlockFn = (x: number, y: number, c: number, w?: number, h?: number) => void;

function render(
  ctx: CanvasRenderingContext2D,
  cellSize: number,
  gridW: number,
  gridH: number,
  fn: (b: BlockFn) => void,
) {
  const ox = Math.floor((SIZE - gridW * cellSize) / 2);
  const oy = Math.floor((SIZE - gridH * cellSize) / 2);
  fn((x, y, c, w = 1, h = 1) => {
    ctx.fillStyle = '#' + c.toString(16).padStart(6, '0');
    ctx.fillRect(ox + x * cellSize, oy + y * cellSize, w * cellSize, h * cellSize);
  });
}

/* ================================================================
   SLIME — cute green blob with big eyes
   14 cols × 12 rows, 8px cells (112×96)
   ================================================================ */

function drawSlime(b: BlockFn) {
  const D = 0x1a7a1a,
    M = 0x33cc33,
    L = 0x55ee55,
    H = 0x88ff88;
  const W = 0xffffff,
    K = 0x111111;

  // outline
  b(5, 0, D, 4);
  b(3, 1, D);
  b(4, 1, D);
  b(9, 1, D);
  b(10, 1, D);
  b(2, 2, D);
  b(2, 3, D);
  b(2, 4, D);
  b(2, 5, D);
  b(2, 6, D);
  b(11, 2, D);
  b(11, 3, D);
  b(11, 4, D);
  b(11, 5, D);
  b(11, 6, D);
  b(3, 7, D);
  b(10, 7, D);
  b(4, 8, D);
  b(9, 8, D);
  b(5, 9, D, 4);

  // body fill
  b(5, 1, M, 4);
  b(3, 2, M, 8);
  b(3, 3, M, 8);
  b(3, 4, M, 8);
  b(3, 5, M, 8);
  b(3, 6, M, 8);
  b(4, 7, M, 6);
  b(5, 8, M, 4);

  // highlight (top-left)
  b(3, 2, H, 2);
  b(5, 2, L, 2);
  b(3, 3, H);
  b(4, 3, L);

  // eyes (white + pupil)
  b(5, 3, W, 2);
  b(8, 3, W, 2);
  b(5, 4, W, 2);
  b(8, 4, W, 2);
  b(6, 4, K);
  b(9, 4, K);

  // mouth
  b(6, 6, D, 2);

  // drips
  b(4, 9, D);
  b(9, 9, D);
  b(4, 10, M);
  b(9, 10, M);
}

/* ================================================================
   SKELETON — skull with eye sockets, teeth, ribcage
   12 cols × 16 rows, 7px cells (84×112)
   ================================================================ */

function drawSkeleton(b: BlockFn) {
  const D = 0x777766,
    B = 0xccccbb,
    L = 0xeeeedd;
  const K = 0x222222,
    R = 0xcc2222;

  // skull outline
  b(3, 0, D, 6);
  b(2, 1, D);
  b(9, 1, D);
  b(1, 2, D);
  b(10, 2, D);
  b(1, 3, D);
  b(10, 3, D);
  b(1, 4, D);
  b(10, 4, D);
  b(1, 5, D);
  b(10, 5, D);
  b(2, 6, D);
  b(9, 6, D);
  b(3, 7, D, 6);

  // skull fill
  b(3, 1, B, 6);
  b(2, 2, B, 8);
  b(2, 3, B, 8);
  b(2, 4, B, 8);
  b(2, 5, B, 8);
  b(3, 6, B, 6);

  // skull highlight
  b(3, 1, L, 3);
  b(2, 2, L, 2);

  // eye sockets
  b(3, 3, K, 2);
  b(7, 3, K, 2);
  b(3, 4, K, 2);
  b(7, 4, K, 2);
  // red glow in eyes
  b(3, 3, R);
  b(7, 3, R);

  // nose
  b(5, 5, K, 2);

  // teeth
  b(3, 6, L);
  b(5, 6, L);
  b(6, 6, L);
  b(8, 6, L);
  b(4, 6, K);
  b(7, 6, K);

  // neck
  b(4, 8, D);
  b(7, 8, D);
  b(5, 8, B, 2);

  // ribcage
  b(3, 9, D);
  b(8, 9, D);
  b(4, 9, B);
  b(5, 9, D);
  b(6, 9, D);
  b(7, 9, B);
  b(2, 10, D);
  b(9, 10, D);
  b(3, 10, B);
  b(5, 10, D);
  b(6, 10, D);
  b(8, 10, B);
  b(4, 10, B);
  b(7, 10, B);
  b(2, 11, D);
  b(9, 11, D);
  b(3, 11, B);
  b(5, 11, D);
  b(6, 11, D);
  b(8, 11, B);
  b(4, 11, B);
  b(7, 11, B);
  b(3, 12, D);
  b(8, 12, D);
  b(4, 12, B);
  b(5, 12, D);
  b(6, 12, D);
  b(7, 12, B);

  // spine below
  b(5, 13, D, 2);

  // leg bones
  b(3, 14, D, 2);
  b(7, 14, D, 2);
  b(3, 15, D);
  b(8, 15, D);
}

/* ================================================================
   ORC — muscular green humanoid with tusks and horns
   14 cols × 16 rows, 7px cells (98×112)
   ================================================================ */

function drawOrc(b: BlockFn) {
  const D = 0x2a4a1a,
    M = 0x4a7a2a,
    L = 0x6aaa4a;
  const BR = 0x664422,
    BL = 0x886644;
  const T = 0xddddcc,
    R = 0xdd3322,
    Y = 0xffcc00;

  // horns
  b(3, 0, D);
  b(10, 0, D);
  b(3, 1, T);
  b(10, 1, T);
  b(4, 1, D);
  b(9, 1, D);

  // head outline
  b(4, 2, D, 6);
  b(3, 3, D);
  b(10, 3, D);
  b(3, 4, D);
  b(10, 4, D);
  b(3, 5, D);
  b(10, 5, D);
  b(3, 6, D);
  b(10, 6, D);
  b(4, 7, D, 6);

  // head fill
  b(4, 3, M, 6);
  b(4, 4, M, 6);
  b(4, 5, M, 6);
  b(4, 6, M, 6);

  // brow (angry)
  b(4, 3, D, 2);
  b(8, 3, D, 2);

  // eyes
  b(5, 4, Y);
  b(8, 4, Y);
  b(5, 4, R);
  b(8, 4, R);

  // lighter face
  b(5, 3, L, 4);

  // tusks
  b(4, 7, T);
  b(9, 7, T);
  b(4, 8, T);
  b(9, 8, T);

  // body outline
  b(2, 8, D, 2);
  b(10, 8, D, 2);
  b(1, 9, D);
  b(12, 9, D);
  b(1, 10, D);
  b(12, 10, D);
  b(1, 11, D);
  b(12, 11, D);
  b(2, 12, D);
  b(11, 12, D);

  // body fill (muscular)
  b(4, 8, M, 5);
  b(2, 9, M, 10);
  b(2, 10, M, 10);
  b(2, 11, M, 10);
  b(3, 12, M, 8);

  // body highlights (muscles)
  b(3, 9, L, 2);
  b(8, 9, L, 2);
  b(3, 10, L);
  b(9, 10, L);

  // belt
  b(2, 12, BR, 10);
  b(5, 12, BL, 4); // buckle area
  b(6, 12, Y, 2); // buckle

  // legs
  b(3, 13, D);
  b(5, 13, D);
  b(8, 13, D);
  b(10, 13, D);
  b(3, 13, M);
  b(4, 13, M);
  b(9, 13, M);
  b(10, 13, M);
  b(3, 14, D);
  b(4, 14, M);
  b(9, 14, M);
  b(10, 14, D);
  b(3, 15, D, 2);
  b(9, 15, D, 2);
}

/* ================================================================
   DRAGON — fierce red winged beast with horns
   18 cols × 16 rows, 7px cells (126×112)
   ================================================================ */

function drawDragon(b: BlockFn) {
  const D = 0x881111,
    M = 0xcc2222,
    L = 0xff4444;
  const Y = 0xffcc00,
    O = 0xff8800,
    BL = 0xffccaa;
  const K = 0x111111,
    W = 0xffffff;

  // horns
  b(6, 0, D);
  b(11, 0, D);
  b(6, 1, D);
  b(7, 1, D);
  b(10, 1, D);
  b(11, 1, D);

  // head outline
  b(7, 2, D, 4);
  b(6, 3, D);
  b(11, 3, D);
  b(6, 4, D);
  b(11, 4, D);
  b(6, 5, D);
  b(11, 5, D);
  b(7, 6, D, 4);

  // head fill
  b(7, 3, M, 4);
  b(7, 4, M, 4);
  b(7, 5, M, 4);

  // head highlight
  b(7, 3, L, 2);

  // eyes
  b(7, 4, Y);
  b(10, 4, Y);
  b(8, 4, K);
  b(10, 4, K);
  b(7, 4, Y);
  b(9, 4, Y);

  // nostrils
  b(8, 5, O);
  b(9, 5, O);

  // LEFT wing
  b(3, 3, D);
  b(4, 3, D);
  b(5, 3, D);
  b(1, 4, D);
  b(2, 4, D);
  b(3, 4, M);
  b(4, 4, M);
  b(5, 4, D);
  b(0, 5, D);
  b(1, 5, M);
  b(2, 5, M);
  b(3, 5, L);
  b(4, 5, M);
  b(5, 5, D);
  b(0, 6, D);
  b(1, 6, M);
  b(2, 6, L);
  b(3, 6, M);
  b(4, 6, M);
  b(5, 6, D);
  b(1, 7, D);
  b(2, 7, M);
  b(3, 7, M);
  b(4, 7, D);
  b(2, 8, D);
  b(3, 8, D);

  // RIGHT wing (mirrored)
  b(12, 3, D);
  b(13, 3, D);
  b(14, 3, D);
  b(12, 4, D);
  b(13, 4, M);
  b(14, 4, M);
  b(15, 4, D);
  b(16, 4, D);
  b(12, 5, D);
  b(13, 5, M);
  b(14, 5, L);
  b(15, 5, M);
  b(16, 5, M);
  b(17, 5, D);
  b(12, 6, D);
  b(13, 6, M);
  b(14, 6, M);
  b(15, 6, L);
  b(16, 6, M);
  b(17, 6, D);
  b(13, 7, D);
  b(14, 7, M);
  b(15, 7, M);
  b(16, 7, D);
  b(14, 8, D);
  b(15, 8, D);

  // body outline
  b(7, 7, D, 4);
  b(6, 8, D);
  b(11, 8, D);
  b(6, 9, D);
  b(11, 9, D);
  b(6, 10, D);
  b(11, 10, D);
  b(7, 11, D, 4);

  // body fill
  b(7, 7, M, 4);
  b(7, 8, M, 4);
  b(7, 9, M, 4);
  b(7, 10, M, 4);

  // belly
  b(8, 8, BL, 2);
  b(8, 9, BL, 2);
  b(8, 10, BL, 2);

  // legs
  b(7, 12, D);
  b(7, 12, M);
  b(10, 12, D);
  b(10, 12, M);
  b(6, 13, D);
  b(7, 13, M);
  b(10, 13, M);
  b(11, 13, D);
  b(6, 14, D, 2);
  b(10, 14, D, 2);

  // tail
  b(11, 11, D);
  b(12, 11, M);
  b(13, 11, D);
  b(13, 12, D);
  b(14, 12, M);
  b(15, 12, D);
  b(15, 13, D);
  b(16, 13, L);

  // fire particles
  b(6, 6, O);
  b(5, 7, Y);
  b(6, 7, O);
}

/* ================================================================
   BOSS — imposing purple demon with tall horns, wings, crown
   16 cols × 16 rows, 7px cells (112×112)
   ================================================================ */

function drawBoss(b: BlockFn) {
  const D = 0x330055,
    M = 0x6611aa,
    L = 0x9933dd,
    H = 0xcc66ff;
  const R = 0xff2222,
    Y = 0xffcc00,
    K = 0x111111,
    W = 0xffffff;

  // tall horns
  b(3, 0, D);
  b(12, 0, D);
  b(3, 1, M);
  b(4, 1, D);
  b(11, 1, D);
  b(12, 1, M);
  b(4, 2, M);
  b(5, 2, D);
  b(10, 2, D);
  b(11, 2, M);
  b(5, 3, D);
  b(10, 3, D);

  // crown jewel
  b(7, 2, Y, 2);
  b(6, 3, Y);
  b(7, 3, R);
  b(8, 3, R);
  b(9, 3, Y);

  // head outline
  b(5, 4, D, 6);
  b(4, 5, D);
  b(11, 5, D);
  b(4, 6, D);
  b(11, 6, D);
  b(5, 7, D, 6);

  // head fill
  b(5, 5, M, 6);
  b(5, 6, M, 6);

  // face highlight
  b(5, 5, L, 2);

  // eyes (glowing red)
  b(6, 5, R);
  b(9, 5, R);
  b(6, 6, W);
  b(7, 6, K);
  b(8, 6, K);
  b(9, 6, W);

  // mouth
  b(6, 7, K, 4);
  b(6, 7, R);
  b(9, 7, R);

  // LEFT wing
  b(2, 5, D);
  b(3, 5, D);
  b(0, 6, D);
  b(1, 6, M);
  b(2, 6, L);
  b(3, 6, M);
  b(0, 7, D);
  b(1, 7, M);
  b(2, 7, L);
  b(3, 7, D);
  b(0, 8, D);
  b(1, 8, M);
  b(2, 8, D);
  b(1, 9, D);
  b(2, 9, D);

  // RIGHT wing (mirrored)
  b(12, 5, D);
  b(13, 5, D);
  b(12, 6, M);
  b(13, 6, L);
  b(14, 6, M);
  b(15, 6, D);
  b(12, 7, D);
  b(13, 7, L);
  b(14, 7, M);
  b(15, 7, D);
  b(13, 8, D);
  b(14, 8, M);
  b(15, 8, D);
  b(13, 9, D);
  b(14, 9, D);

  // body outline
  b(4, 8, D);
  b(11, 8, D);
  b(3, 9, D);
  b(12, 9, D);
  b(3, 10, D);
  b(12, 10, D);
  b(3, 11, D);
  b(12, 11, D);
  b(3, 12, D);
  b(12, 12, D);
  b(4, 13, D, 8);

  // body fill
  b(5, 8, M, 6);
  b(4, 9, M, 8);
  b(4, 10, M, 8);
  b(4, 11, M, 8);
  b(4, 12, M, 8);

  // body highlights
  b(5, 9, L, 2);
  b(9, 9, L, 2);
  b(5, 10, H);
  b(10, 10, H);

  // robe / belt
  b(4, 12, Y, 8);
  b(7, 12, R, 2);

  // legs
  b(5, 13, M, 2);
  b(9, 13, M, 2);
  b(5, 14, D, 2);
  b(9, 14, D, 2);
  b(4, 15, D, 3);
  b(9, 15, D, 3);
}

/* ================================================================
   TEXTURE GENERATION
   ================================================================ */

const MONSTER_TYPES: Record<
  string,
  {
    cellSize: number;
    gridW: number;
    gridH: number;
    draw: (b: BlockFn) => void;
  }
> = {
  slime: { cellSize: 8, gridW: 14, gridH: 12, draw: drawSlime },
  skeleton: { cellSize: 7, gridW: 12, gridH: 16, draw: drawSkeleton },
  orc: { cellSize: 7, gridW: 14, gridH: 16, draw: drawOrc },
  dragon: { cellSize: 7, gridW: 18, gridH: 16, draw: drawDragon },
  boss: { cellSize: 7, gridW: 16, gridH: 16, draw: drawBoss },
};

export function generateMonsterTextures(scene: Phaser.Scene) {
  for (const [type, def] of Object.entries(MONSTER_TYPES)) {
    const canvas = scene.textures.createCanvas(`monster-${type}`, SIZE, SIZE);
    if (!canvas) continue;
    const ctx = canvas.context;
    render(ctx, def.cellSize, def.gridW, def.gridH, def.draw);
    canvas.refresh();
  }
}
