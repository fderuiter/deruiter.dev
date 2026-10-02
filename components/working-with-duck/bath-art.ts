/**
 * Working With Duck bathtub art (#1707): a warm tiled bathroom, a porcelain
 * tub and a wet Duck who shares the office sprite's coat and face from
 * `duck-art.ts`. Presentation only: the tub keeps the bounds the bath
 * minigame always had, and every visual reads straight off the engine's
 * bathtub state (mud until rinsed, lather while scrubbing, a spray while
 * rinsing, a clean ivory Duck at the end).
 */
import { clamp } from "@/lib/game-utils";
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import {
  DUCK_WET_COAT,
  drawDuckEye,
  drawDuckNose,
  paintMudInPath,
  type MudBlob,
} from "./duck-art";
import { prefersReducedMotion } from "./office-art";

type Ctx = CanvasRenderingContext2D;

/** The tub and its water, unchanged from the original bath minigame. */
const TUB = { x: 200, y: 120, w: 400, h: 260, r: 40 };
const WATER = { x: 220, y: 140, w: 360, h: 220, r: 30 };
/** Duck sits in the middle of the tub, where the first bubbles spawn. */
const DUCK_X = 400;
const DUCK_Y = 240;
const WALL_H = 104;
/** Duck is drawn at this size in the tub so his face reads at game scale. */
const DUCK_SCALE = 1.45;

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function roundRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function paintRoom(ctx: Ctx) {
  // Floor: large pale stone tiles
  ctx.fillStyle = "#d8d0c2";
  ctx.fillRect(0, WALL_H, CANVAS_WIDTH, CANVAS_HEIGHT - WALL_H);
  const tile = 50;
  for (let y = WALL_H, row = 0; y < CANVAS_HEIGHT; y += tile, row++) {
    for (let x = 0, col = 0; x < CANVAS_WIDTH; x += tile, col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#e0d9cc" : "#dbd3c5";
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
    }
  }

  // Wall: cream subway tile above a trim
  ctx.fillStyle = "#d9cfbf";
  ctx.fillRect(0, 0, CANVAS_WIDTH, WALL_H);
  const bw = 44;
  const bh = 20;
  for (let y = 0, row = 0; y < WALL_H - 6; y += bh, row++) {
    for (let x = row % 2 === 0 ? 0 : -bw / 2; x < CANVAS_WIDTH; x += bw) {
      ctx.fillStyle = "#f4efe6";
      ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(x + 3, y + 2, bw - 10, 2);
    }
  }
  ctx.fillStyle = "#b9ab95";
  ctx.fillRect(0, WALL_H - 8, CANVAS_WIDTH, 8);
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.fillRect(0, WALL_H, CANVAS_WIDTH, 6);

  // Shelf with shampoo bottles, top left
  ctx.fillStyle = "#a08867";
  ctx.fillRect(36, 70, 128, 7);
  const bottles: Array<[number, number, number, string]> = [
    [50, 22, 34, "#7fb3a6"],
    [80, 18, 26, "#f2c46d"],
    [106, 20, 38, "#e7a1a1"],
    [134, 16, 22, "#9fb7d8"],
  ];
  for (const [bx, w, h, color] of bottles) {
    ctx.fillStyle = color;
    roundRect(ctx, bx, 70 - h, w, h, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(bx + 3, 70 - h + 5, 3, h - 10);
    ctx.fillStyle = "#3f3f46";
    ctx.fillRect(bx + w / 2 - 3, 70 - h - 5, 6, 5);
  }

  // Towel on a rail, top right
  ctx.strokeStyle = "#a1a1aa";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(640, 30);
  ctx.lineTo(764, 30);
  ctx.stroke();
  ctx.fillStyle = "#7c9cbf";
  roundRect(ctx, 652, 28, 100, 84, 6);
  ctx.fill();
  ctx.fillStyle = "#f4efe6";
  ctx.fillRect(652, 92, 100, 6);
  ctx.fillRect(652, 101, 100, 3);
  ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
  ctx.fillRect(652, 28, 100, 8);

  // Bath mat in front of the tub
  ctx.fillStyle = "#93ad98";
  roundRect(ctx, 300, 398, 200, 72, 14);
  ctx.fill();
  ctx.strokeStyle = "#7f9a85";
  ctx.lineWidth = 2;
  for (let x = 316; x < 490; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 406);
    ctx.lineTo(x, 462);
    ctx.stroke();
  }

  // Tub shadow and porcelain
  ctx.fillStyle = "rgba(60, 45, 30, 0.18)";
  roundRect(ctx, TUB.x + 6, TUB.y + 10, TUB.w, TUB.h, TUB.r);
  ctx.fill();
  const shell = ctx.createLinearGradient(0, TUB.y, 0, TUB.y + TUB.h);
  shell.addColorStop(0, "#ffffff");
  shell.addColorStop(1, "#e8e4dc");
  ctx.fillStyle = shell;
  ctx.strokeStyle = "#c8c1b4";
  ctx.lineWidth = 2;
  roundRect(ctx, TUB.x, TUB.y, TUB.w, TUB.h, TUB.r);
  ctx.fill();
  ctx.stroke();
  // Inner basin wall, so the rim has depth
  ctx.fillStyle = "#e3e7e6";
  roundRect(
    ctx,
    WATER.x - 6,
    WATER.y - 6,
    WATER.w + 12,
    WATER.h + 12,
    WATER.r + 4
  );
  ctx.fill();
  ctx.strokeStyle = "#d2d0c8";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Faucet at the far end
  ctx.fillStyle = "#cbd5e1";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  roundRect(ctx, 204, 226, 22, 48, 6);
  ctx.fill();
  ctx.stroke();
  roundRect(ctx, 218, 244, 22, 12, 4);
  ctx.fill();
  ctx.stroke();
  for (const ty of [222, 278]) {
    ellipse(ctx, 215, ty, 7, 5);
    ctx.fill();
    ctx.stroke();
  }

  // Soap dish on the near rim
  ctx.fillStyle = "#e7e5e4";
  ctx.strokeStyle = "#a8a29e";
  ellipse(ctx, 548, 364, 20, 8);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#f9d9a8";
  roundRect(ctx, 536, 356, 24, 10, 4);
  ctx.fill();
}

function paintWater(ctx: Ctx, ticks: number, calm: boolean) {
  const water = ctx.createLinearGradient(0, WATER.y, 0, WATER.y + WATER.h);
  water.addColorStop(0, "#a9d8e6");
  water.addColorStop(1, "#7fbfd6");
  ctx.fillStyle = water;
  roundRect(ctx, WATER.x, WATER.y, WATER.w, WATER.h, WATER.r);
  ctx.fill();
  // Restrained highlights that drift slowly unless motion is reduced
  const drift = calm ? 0 : Math.sin(ticks * 0.03) * 6;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  const lines: Array<[number, number, number]> = [
    [250, 170, 50],
    [500, 186, 40],
    [262, 320, 36],
    [508, 334, 46],
  ];
  for (const [x, y, len] of lines) {
    ctx.beginPath();
    ctx.moveTo(x + drift, y);
    ctx.quadraticCurveTo(x + drift + len / 2, y - 4, x + drift + len, y);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

/** Lather clusters, drawn in order so more lather adds more foam. */
const LATHER_SPOTS: Array<[number, number, number]> = [
  [-6, -42, 9],
  [8, -40, 7],
  [-24, 8, 9],
  [24, 10, 8],
  [0, 30, 10],
  [-14, 36, 7],
  [16, 34, 8],
  [-30, 28, 6],
  [32, 26, 6],
  [-2, -48, 6],
];

const BODY_MUD: MudBlob[] = [
  [-32, 34, 12, 10],
  [30, 38, 12, 9],
  [-36, 14, 4, 6],
  [20, 18, 2.5, 3],
  [-12, 40, 3, 2.5],
];
const HEAD_MUD: MudBlob[] = [
  [15, -36, 5, 3],
  [-18, -10, 3, 2.5],
];

function paintWetDuck(
  ctx: Ctx,
  mud: number,
  lather: number,
  clean: boolean,
  ticks: number,
  calm: boolean
) {
  const coat = DUCK_WET_COAT;
  ctx.save();
  ctx.translate(DUCK_X, DUCK_Y);
  ctx.scale(DUCK_SCALE, DUCK_SCALE);

  // Ripple at the waterline
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 2;
  const ripple = calm ? 0 : Math.sin(ticks * 0.06) * 2;
  ellipse(ctx, 0, 46, 54 + ripple, 12 + ripple / 2);
  ctx.stroke();

  // Body: the wet coat clings, so he's slimmer than in the office
  ctx.fillStyle = coat.base;
  ctx.strokeStyle = coat.outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 22, 40, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 22, 40, 34, 0, 0, Math.PI * 2);
  paintMudInPath(ctx, BODY_MUD, mud);
  // Chest, with clumped wet fur points
  ctx.fillStyle = coat.light;
  ctx.beginPath();
  ctx.moveTo(-16, 4);
  ctx.quadraticCurveTo(0, -2, 16, 4);
  ctx.lineTo(13, 26);
  ctx.lineTo(8, 20);
  ctx.lineTo(4, 30);
  ctx.lineTo(0, 22);
  ctx.lineTo(-4, 30);
  ctx.lineTo(-8, 20);
  ctx.lineTo(-13, 26);
  ctx.closePath();
  ctx.fill();

  // The water tints everything below his waterline
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 22, 41, 35, 0, 0, Math.PI * 2);
  if (typeof ctx.clip === "function") ctx.clip();
  ctx.fillStyle = "rgba(127, 191, 214, 0.6)";
  ctx.fillRect(-50, 42, 100, 20);
  ctx.restore();

  // Front paws resting on the water
  for (const px of [-16, 16]) {
    ctx.fillStyle = coat.base;
    ctx.strokeStyle = coat.outline;
    ctx.lineWidth = 1.2;
    ellipse(ctx, px, 44, 10, 6);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = coat.shade;
    ctx.lineWidth = 1;
    for (const t of [-4, 0, 4]) {
      ctx.beginPath();
      ctx.moveTo(px + t, 40);
      ctx.lineTo(px + t, 44);
      ctx.stroke();
    }
  }

  // Front of the ripple passes in front of him
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 46, 54 + ripple, 12 + ripple / 2, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();

  // Long wet ears hang straight down
  for (const side of [-1, 1]) {
    ctx.fillStyle = coat.ear;
    ctx.strokeStyle = coat.outline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(side * 16, -36);
    ctx.bezierCurveTo(side * 30, -34, side * 32, -10, side * 28, 4);
    ctx.lineTo(side * 25, 0);
    ctx.lineTo(side * 23, 6);
    ctx.lineTo(side * 20, 0);
    ctx.bezierCurveTo(side * 18, -14, side * 16, -26, side * 12, -30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Head
  ctx.fillStyle = coat.base;
  ctx.strokeStyle = coat.outline;
  ctx.lineWidth = 1.5;
  ellipse(ctx, 0, -22, 22, 20);
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, 0, -22, 22, 20);
  paintMudInPath(ctx, HEAD_MUD, mud);
  // Wet fur parted in clumps on the crown
  ctx.strokeStyle = coat.shade;
  ctx.lineWidth = 1.4;
  ctx.lineCap = "round";
  for (const [x0, x1] of [
    [-8, -11],
    [-2, -3],
    [5, 7],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x0, -40);
    ctx.quadraticCurveTo(x0 + (x1 - x0) / 2, -36, x1, -31);
    ctx.stroke();
  }
  ctx.lineCap = "butt";

  // Muzzle
  ctx.fillStyle = coat.light;
  ctx.strokeStyle = coat.outline;
  ctx.lineWidth = 1.2;
  ellipse(ctx, 0, -11, 12, 9);
  ctx.fill();
  ctx.stroke();

  // Resigned eyes: dark, heavy-lidded, brows lifted in the middle
  for (const side of [-1, 1]) {
    drawDuckEye(ctx, side * 9, -24, 3.2);
    ctx.fillStyle = coat.base;
    ctx.beginPath();
    ctx.ellipse(side * 9, -25.6, 4.4, 2.6, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = coat.shade;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(side * 4, -32);
    ctx.lineTo(side * 13, -30);
    ctx.stroke();
    ctx.lineCap = "butt";
  }
  drawDuckNose(ctx, 0, -14, 5.5, 4);
  ctx.strokeStyle = coat.outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-5, -6);
  ctx.quadraticCurveTo(0, -8, 5, -6);
  ctx.stroke();

  // Drips off the ears and chin
  ctx.fillStyle = "rgba(125, 190, 220, 0.9)";
  for (const [dx, dy] of [
    [-24, 10],
    [24, 10],
    [0, 0],
  ]) {
    ctx.beginPath();
    ctx.moveTo(dx, dy - 3);
    ctx.quadraticCurveTo(dx + 2.5, dy + 1, dx, dy + 2.5);
    ctx.quadraticCurveTo(dx - 2.5, dy + 1, dx, dy - 3);
    ctx.fill();
  }

  // Lather over the coat
  if (lather > 0) {
    const count = Math.ceil(lather * LATHER_SPOTS.length);
    for (const [lx, ly, r] of LATHER_SPOTS.slice(0, count)) {
      ctx.globalAlpha = Math.min(1, lather * 1.3);
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "#cfe3ec";
      ctx.lineWidth = 1;
      for (const [ox, oy, k] of [
        [0, 0, 1],
        [r * 0.7, r * 0.2, 0.7],
        [-r * 0.6, r * 0.3, 0.6],
      ]) {
        ellipse(ctx, lx + ox, ly + oy, r * k, r * k * 0.85);
        ctx.fill();
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Clean: a few amber glints
  if (clean) {
    ctx.fillStyle = "#fcd34d";
    for (const [sx, sy, r] of [
      [-40, -40, 6],
      [42, -20, 5],
      [34, -52, 4],
    ]) {
      ctx.beginPath();
      ctx.moveTo(sx, sy - r);
      ctx.quadraticCurveTo(sx, sy, sx + r, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy + r);
      ctx.quadraticCurveTo(sx, sy, sx - r, sy);
      ctx.quadraticCurveTo(sx, sy, sx, sy - r);
      ctx.fill();
    }
  }
  ctx.restore();
}

function paintSprayer(ctx: Ctx, spraying: boolean) {
  // Hose from the faucet up to the handheld head on the rim
  ctx.strokeStyle = "#a1a1aa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(215, 222);
  ctx.bezierCurveTo(196, 180, 222, 132, 262, 128);
  ctx.stroke();
  ctx.save();
  ctx.translate(268, 128);
  ctx.rotate(0.55);
  ctx.fillStyle = "#cbd5e1";
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 1.5;
  roundRect(ctx, -8, -5, 22, 10, 4);
  ctx.fill();
  ctx.stroke();
  ellipse(ctx, 16, 0, 6, 8);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  if (!spraying) return;
  // Spray fans toward Duck
  ctx.strokeStyle = "rgba(186, 230, 253, 0.75)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (const [ex, ey] of [
    [360, 196],
    [372, 186],
    [386, 182],
    [352, 210],
  ]) {
    ctx.beginPath();
    ctx.moveTo(284, 140);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

function paintBubbles(ctx: Ctx, state: WorkingWithDuckState) {
  for (const b of state.bathtubState.bubbles) {
    const a = clamp(b.alpha, 0, 1);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.35 * a})`;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * a})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * a})`;
    ellipse(
      ctx,
      b.x - b.size * 0.35,
      b.y - b.size * 0.35,
      b.size * 0.22,
      b.size * 0.16
    );
    ctx.fill();
  }
}

function paintHud(ctx: Ctx, lather: number, rinse: number) {
  const x = CANVAS_WIDTH / 2 - 180;
  const y = 12;
  const w = 360;
  ctx.save();
  ctx.fillStyle = "rgba(13, 14, 17, 0.86)";
  roundRect(ctx, x, y, w, 76, 10);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f4f6";
  ctx.font = "bold 12px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText("DUCK'S BATH", CANVAS_WIDTH / 2, y + 18);

  const bar = (label: string, value: number, color: string, by: number) => {
    ctx.textAlign = "left";
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "bold 9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(label, x + 16, by + 7);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    roundRect(ctx, x + 70, by, w - 130, 8, 4);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, x + 70, by, ((w - 130) * Math.min(100, value)) / 100, 8, 4);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "#e4e4e7";
    ctx.fillText(`${Math.round(value)}%`, x + w - 16, by + 7);
  };
  bar("LATHER", lather, "#7dd3fc", y + 28);
  bar("RINSE", rinse, "#34d399", y + 42);

  ctx.textAlign = "center";
  ctx.font = "bold 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  if (lather < 100) {
    ctx.fillStyle = "#e0f2fe";
    ctx.fillText(
      "Scrub Duck with the cursor to lather",
      CANVAS_WIDTH / 2,
      y + 66
    );
  } else if (rinse < 100) {
    ctx.fillStyle = "#e0f2fe";
    ctx.fillText(
      "Click 'Rinse Spray' below to rinse",
      CANVAS_WIDTH / 2,
      y + 66
    );
  } else {
    ctx.fillStyle = "#4ade80";
    ctx.fillText(
      "All clean! Click 'Finish Bath' to head back",
      CANVAS_WIDTH / 2,
      y + 66
    );
  }
  ctx.restore();
}

/**
 * Paints the bathtub minigame for one frame. Mud shows until Duck is
 * rinsed, lather grows with scrubbing and washes off with the rinse, and a
 * finished bath leaves a clean, wet, ivory Duck.
 */
export function drawBathtubScene(ctx: Ctx, state: WorkingWithDuckState) {
  const calm = prefersReducedMotion();
  const bath = state.bathtubState;
  const rinsed = Math.min(100, bath.rinseLevel) / 100;
  const mud = state.isMuddy ? 1 - rinsed : 0;
  const lather = (Math.min(100, bath.soapLather) / 100) * (1 - rinsed);
  const clean = bath.status === "clean" || bath.rinseLevel >= 100;

  paintRoom(ctx);
  paintWater(ctx, state.ticks, calm);
  paintWetDuck(ctx, mud, lather, clean, state.ticks, calm);
  paintSprayer(ctx, bath.soapLather >= 100 && bath.rinseLevel > 0 && !clean);
  paintBubbles(ctx, state);
  paintHud(ctx, bath.soapLather, bath.rinseLevel);
}
