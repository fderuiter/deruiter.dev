/**
 * Working With Duck office art (#1675): an illustrated top-down home office
 * and a 3/4-view Duck, an English Cream golden retriever, with a pose per
 * behaviour. His coat and face come from `duck-art.ts` (#1707). Everything is
 * drawn with canvas paths, so there are no image assets to load.
 *
 * The room's furniture never moves, so it is painted once per pixel ratio
 * into an offscreen canvas and blitted each frame. Only live state (bowl
 * levels, the door's urgency, props, puddles, Duck) is drawn per frame.
 * Decorative motion (squash and stretch, zoomies bob, pulsing rings) is
 * skipped under `prefers-reduced-motion`.
 */
import { clamp, gameFont } from "@/lib/game-utils";
import {
  BACK_DOOR_BOUNDS,
  BATHTUB_BOUNDS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  DESK_BOUNDS,
  DOG_BED_BOUNDS,
  FOOD_BOWL_BOUNDS,
  RUG_BOUNDS,
  WATER_BOWL_BOUNDS,
  type DuckAccessory,
  type DuckBehaviorState,
  type DuckTrick,
  type PortfolioHazard,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import {
  DUCK_COAT,
  drawDuckEye,
  drawDuckNose,
  paintMudInPath,
  type DuckCoat,
  type MudBlob,
} from "./duck-art";

type Ctx = CanvasRenderingContext2D;

// Geist Mono, resolved at draw time so canvas labels match the DOM HUD.
const labelFont = () => gameFont(10, "bold");
const smallFont = () => gameFont(9);

/** Engine colours that fall outside the arcade palette, mapped at draw time. */
const TONE_MAP: Record<string, string> = {
  "#a855f7": "#fbbf24",
  "#c084fc": "#cbd5e1",
};

function tone(color: string): string {
  return TONE_MAP[color.toLowerCase()] ?? color;
}

let reducedMotionQuery: MediaQueryList | null | undefined;

export function prefersReducedMotion(): boolean {
  if (reducedMotionQuery === undefined) {
    reducedMotionQuery =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
  }
  return reducedMotionQuery?.matches ?? false;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

/**
 * Draws centred text, nudged horizontally so the whole string stays on the
 * canvas. Duck's status labels and floating alerts follow him to the walls,
 * where centring on his position clipped them at the edge (#1550).
 */
function fillCenteredTextInCanvas(
  ctx: Ctx,
  text: string,
  x: number,
  y: number
) {
  const halfWidth = ctx.measureText(text).width / 2;
  const margin = 6;
  const minX = margin + halfWidth;
  const maxX = CANVAS_WIDTH - margin - halfWidth;
  ctx.fillText(text, minX > maxX ? CANVAS_WIDTH / 2 : clamp(x, minX, maxX), y);
}

/** A short label on a dark pill, kept inside the canvas. */
function pill(
  ctx: Ctx,
  text: string,
  x: number,
  y: number,
  color: string,
  font = labelFont()
) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const w = ctx.measureText(text).width + 12;
  const cx = clamp(x, 6 + w / 2, CANVAS_WIDTH - 6 - w / 2);
  ctx.fillStyle = "rgba(13, 14, 17, 0.84)";
  roundRect(ctx, cx - w / 2, y - 8, w, 16, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(text, cx, y + 0.5);
  ctx.restore();
}

// --- The room, painted once per pixel ratio ---

function paintFloor(g: Ctx) {
  const rnd = mulberry32(1675);
  const plankH = 28;
  const tones = ["#4d3524", "#523927", "#48321f", "#553b28"];
  for (let row = 0, y = 0; y < CANVAS_HEIGHT; row++, y += plankH) {
    let x = row % 2 === 0 ? -60 : -130;
    while (x < CANVAS_WIDTH) {
      const len = 150 + Math.floor(rnd() * 90);
      g.fillStyle = tones[Math.floor(rnd() * tones.length)];
      g.fillRect(x, y, len, plankH);
      g.strokeStyle = "rgba(255, 220, 170, 0.05)";
      g.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const gy = y + 6 + rnd() * (plankH - 12);
        g.beginPath();
        g.moveTo(x + 8, gy);
        g.bezierCurveTo(
          x + len * 0.35,
          gy - 2,
          x + len * 0.65,
          gy + 2,
          x + len - 8,
          gy
        );
        g.stroke();
      }
      g.fillStyle = "rgba(0, 0, 0, 0.35)";
      g.fillRect(x + len - 1, y, 1, plankH);
      x += len;
    }
    g.fillStyle = "rgba(0, 0, 0, 0.3)";
    g.fillRect(0, y + plankH - 1, CANVAS_WIDTH, 1);
  }
}

function paintWall(g: Ctx) {
  g.fillStyle = "#2b2521";
  g.fillRect(0, 0, CANVAS_WIDTH, 48);
  g.fillStyle = "#3a322c";
  g.fillRect(0, 0, CANVAS_WIDTH, 3);
  g.fillStyle = "#1b1613";
  g.fillRect(0, 46, CANVAS_WIDTH, 5);
  const shadow = g.createLinearGradient(0, 51, 0, 70);
  shadow.addColorStop(0, "rgba(0, 0, 0, 0.35)");
  shadow.addColorStop(1, "rgba(0, 0, 0, 0)");
  g.fillStyle = shadow;
  g.fillRect(0, 51, CANVAS_WIDTH, 19);

  // Bookshelf
  g.fillStyle = "#5c4130";
  g.fillRect(40, 8, 170, 34);
  g.fillStyle = "#3d2b20";
  g.fillRect(44, 12, 162, 26);
  const spines = [
    "#b45309",
    "#0f766e",
    "#475569",
    "#a16207",
    "#7f1d1d",
    "#334155",
    "#15803d",
    "#9a3412",
  ];
  const rnd = mulberry32(42);
  let bx = 47;
  while (bx < 200) {
    const w = 6 + Math.floor(rnd() * 6);
    const h = 16 + Math.floor(rnd() * 8);
    g.fillStyle = spines[Math.floor(rnd() * spines.length)];
    g.fillRect(bx, 38 - h, w, h);
    g.fillStyle = "rgba(255, 255, 255, 0.12)";
    g.fillRect(bx + 1, 38 - h + 3, w - 2, 1.5);
    bx += w + 1;
  }

  // Framed photo of Duck and a wall clock
  g.fillStyle = "#6b4a33";
  g.fillRect(540, 10, 56, 32);
  g.fillStyle = "#e7dcc6";
  g.fillRect(544, 14, 48, 24);
  g.fillStyle = "#86b6d9";
  g.fillRect(546, 16, 44, 12);
  g.fillStyle = "#5f8f3a";
  g.fillRect(546, 28, 44, 8);
  g.fillStyle = DUCK_COAT.base;
  ellipse(g, 568, 28, 9, 6);
  g.fill();
  ellipse(g, 575, 23, 5, 5);
  g.fill();
  g.fillStyle = DUCK_COAT.ear;
  ellipse(g, 573, 24, 2, 3);
  g.fill();
  g.fillStyle = "#151210";
  ellipse(g, 579.5, 23.5, 1, 1);
  g.fill();

  g.fillStyle = "#e7e5e4";
  ellipse(g, 628, 25, 13, 13);
  g.fill();
  g.strokeStyle = "#57534e";
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = "#1c1917";
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(628, 25);
  g.lineTo(628, 16);
  g.moveTo(628, 25);
  g.lineTo(634, 28);
  g.stroke();
}

function paintWindow(g: Ctx) {
  // Curtains
  g.fillStyle = "#9a4a34";
  g.fillRect(344, 4, 16, 48);
  g.fillRect(445, 4, 16, 48);
  g.fillStyle = "rgba(0, 0, 0, 0.2)";
  for (const cx of [349, 355, 450, 456]) g.fillRect(cx, 4, 1.5, 48);

  // Glass, sky and a branch
  const sky = g.createLinearGradient(0, 10, 0, 56);
  sky.addColorStop(0, "#6fb3e0");
  sky.addColorStop(1, "#cfe8f6");
  g.fillStyle = sky;
  g.fillRect(362, 12, 81, 42);
  g.fillStyle = "rgba(255, 255, 255, 0.85)";
  ellipse(g, 382, 24, 9, 5);
  g.fill();
  ellipse(g, 392, 21, 8, 6);
  g.fill();
  g.strokeStyle = "#4a3526";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(443, 18);
  g.quadraticCurveTo(425, 24, 414, 40);
  g.stroke();
  g.fillStyle = "#4d7c0f";
  for (const [lx, ly] of [
    [436, 20],
    [426, 26],
    [420, 33],
    [431, 30],
  ]) {
    ellipse(g, lx, ly, 4, 2.5);
    g.fill();
  }

  // Frame and crossbars
  g.strokeStyle = "#7a5a3c";
  g.lineWidth = 3;
  g.strokeRect(360.5, 10.5, 84, 45);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(402.5, 11);
  g.lineTo(402.5, 55);
  g.moveTo(361, 33.5);
  g.lineTo(444, 33.5);
  g.stroke();

  // Daylight on the floor
  g.fillStyle = "rgba(255, 236, 190, 0.07)";
  g.beginPath();
  g.moveTo(362, 56);
  g.lineTo(443, 56);
  g.lineTo(476, 196);
  g.lineTo(330, 196);
  g.closePath();
  g.fill();
}

function paintRug(g: Ctx) {
  const { x, y, width: w, height: h } = RUG_BOUNDS;
  // Fringe on the short sides
  g.strokeStyle = "#e7d3b0";
  g.lineWidth = 1.5;
  for (let fy = y + 16; fy < y + h - 12; fy += 6) {
    g.beginPath();
    g.moveTo(x - 6, fy);
    g.lineTo(x + 2, fy);
    g.moveTo(x + w - 2, fy);
    g.lineTo(x + w + 6, fy);
    g.stroke();
  }
  g.fillStyle = "rgba(0, 0, 0, 0.3)";
  roundRect(g, x + 3, y + 5, w, h, 14);
  g.fill();
  g.fillStyle = "#b8703f";
  roundRect(g, x, y, w, h, 14);
  g.fill();
  g.fillStyle = "#83382a";
  roundRect(g, x + 10, y + 10, w - 20, h - 20, 8);
  g.fill();
  g.strokeStyle = "#d9a066";
  g.lineWidth = 1.5;
  roundRect(g, x + 16, y + 16, w - 32, h - 32, 6);
  g.stroke();

  // Central medallion and small diamonds
  const cx = x + w / 2;
  const cy = y + h / 2;
  const diamond = (dx: number, dy: number, rx: number, ry: number) => {
    g.beginPath();
    g.moveTo(dx, dy - ry);
    g.lineTo(dx + rx, dy);
    g.lineTo(dx, dy + ry);
    g.lineTo(dx - rx, dy);
    g.closePath();
  };
  g.fillStyle = "#1f4e56";
  diamond(cx, cy, 52, 40);
  g.fill();
  g.fillStyle = "#d9a066";
  diamond(cx, cy, 30, 22);
  g.fill();
  g.fillStyle = "#83382a";
  diamond(cx, cy, 14, 10);
  g.fill();
  g.fillStyle = "rgba(217, 160, 102, 0.55)";
  for (const [dx, dy] of [
    [x + 34, y + 34],
    [x + w - 34, y + 34],
    [x + 34, y + h - 34],
    [x + w - 34, y + h - 34],
  ]) {
    diamond(dx, dy, 8, 8);
    g.fill();
  }
}

function paintDesk(g: Ctx) {
  const { x, y, width: w } = DESK_BOUNDS;
  // Shadow and wooden top
  g.fillStyle = "rgba(0, 0, 0, 0.35)";
  roundRect(g, x + 3, y + 6, w, 76, 8);
  g.fill();
  const wood = g.createLinearGradient(0, y, 0, y + 76);
  wood.addColorStop(0, "#94694a");
  wood.addColorStop(1, "#6e4c33");
  g.fillStyle = wood;
  roundRect(g, x, y, w, 76, 8);
  g.fill();
  g.strokeStyle = "rgba(255, 230, 190, 0.08)";
  g.lineWidth = 1;
  for (let gy = y + 12; gy < y + 72; gy += 11) {
    g.beginPath();
    g.moveTo(x + 6, gy);
    g.lineTo(x + w - 6, gy + 2);
    g.stroke();
  }

  // Dual monitors
  for (const mx of [x + 15, x + 90]) {
    g.fillStyle = "#1f2227";
    g.fillRect(mx + 26, y + 44, 14, 8);
    g.fillStyle = "#15171b";
    roundRect(g, mx, y + 6, 66, 40, 4);
    g.fill();
    g.fillStyle = "#0b1220";
    g.fillRect(mx + 3, y + 9, 60, 33);
  }
  const lines: Array<[number, number, number, string]> = [
    [x + 20, y + 14, 34, "#22d3ee"],
    [x + 24, y + 20, 40, "#94a3b8"],
    [x + 24, y + 26, 30, "#34d399"],
    [x + 20, y + 32, 22, "#fbbf24"],
    [x + 95, y + 14, 40, "#38bdf8"],
    [x + 99, y + 20, 48, "#34d399"],
    [x + 99, y + 26, 28, "#94a3b8"],
    [x + 95, y + 32, 36, "#f87171"],
  ];
  g.globalAlpha = 0.8;
  for (const [lx, ly, lw, c] of lines) {
    g.fillStyle = c;
    g.fillRect(lx, ly, lw, 2.5);
  }
  g.globalAlpha = 1;

  // Keyboard, mouse and a mug of coffee
  g.fillStyle = "#2a2d34";
  roundRect(g, x + 58, y + 56, 60, 13, 3);
  g.fill();
  g.fillStyle = "#4b5060";
  for (let k = 0; k < 9; k++) {
    g.fillRect(x + 62 + k * 6, y + 59, 4, 3);
    g.fillRect(x + 62 + k * 6, y + 64, 4, 3);
  }
  g.fillStyle = "#d4d4d8";
  ellipse(g, x + 130, y + 62, 4, 6);
  g.fill();
  g.fillStyle = "#e7e5e4";
  ellipse(g, x + 24, y + 62, 8, 8);
  g.fill();
  g.fillStyle = "#6b4226";
  ellipse(g, x + 24, y + 62, 5.5, 5.5);
  g.fill();
  g.strokeStyle = "#e7e5e4";
  g.lineWidth = 2.5;
  g.beginPath();
  g.arc(x + 33, y + 62, 3.5, -Math.PI / 2, Math.PI / 2);
  g.stroke();

  // Chair and you, seen from above, facing the desk
  const px = x + 85;
  const py = y + 100;
  g.fillStyle = "rgba(0, 0, 0, 0.3)";
  ellipse(g, px + 2, py + 4, 25, 23);
  g.fill();
  g.fillStyle = "#2b2d33";
  ellipse(g, px, py, 24, 22);
  g.fill();
  g.strokeStyle = "#3f424a";
  g.lineWidth = 2;
  g.stroke();
  g.strokeStyle = "#2f5d62";
  g.lineWidth = 7;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(px - 15, py - 4);
  g.lineTo(px - 12, py - 22);
  g.moveTo(px + 15, py - 4);
  g.lineTo(px + 12, py - 22);
  g.stroke();
  g.lineCap = "butt";
  g.fillStyle = "#2f5d62";
  ellipse(g, px, py - 2, 19, 11);
  g.fill();
  g.fillStyle = "#8b5e3c";
  ellipse(g, px, py - 5, 10, 10);
  g.fill();
  g.fillStyle = "rgba(255, 230, 200, 0.25)";
  ellipse(g, px - 3, py - 8, 4, 3);
  g.fill();
  g.fillStyle = "#e0b48f";
  ellipse(g, px - 12, py - 24, 3.5, 3.5);
  g.fill();
  ellipse(g, px + 12, py - 24, 3.5, 3.5);
  g.fill();
  g.fillStyle = "#a8a29e";
  g.font = smallFont();
  g.textAlign = "center";
  g.fillText("you", px, py + 34);
}

function paintDogBed(g: Ctx) {
  const cx = DOG_BED_BOUNDS.x + DOG_BED_BOUNDS.width / 2;
  const cy = DOG_BED_BOUNDS.y + DOG_BED_BOUNDS.height / 2;
  const rx = DOG_BED_BOUNDS.width / 2;
  const ry = DOG_BED_BOUNDS.height / 2;
  g.fillStyle = "rgba(0, 0, 0, 0.35)";
  ellipse(g, cx + 3, cy + 5, rx, ry);
  g.fill();
  g.fillStyle = "#7a4b2e";
  ellipse(g, cx, cy, rx, ry);
  g.fill();
  g.strokeStyle = "#a06a44";
  g.lineWidth = 3;
  ellipse(g, cx, cy, rx - 4, ry - 4);
  g.stroke();

  g.save();
  ellipse(g, cx, cy - 2, rx - 16, ry - 16);
  g.clip();
  g.fillStyle = "#d2b48c";
  g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
  g.strokeStyle = "rgba(160, 106, 68, 0.35)";
  g.lineWidth = 3;
  for (let i = -rx; i < rx; i += 14) {
    g.beginPath();
    g.moveTo(cx + i, cy - ry);
    g.lineTo(cx + i, cy + ry);
    g.moveTo(cx - rx, cy + i * 0.8);
    g.lineTo(cx + rx, cy + i * 0.8);
    g.stroke();
  }
  g.restore();

  // A chew bone on the cushion
  g.save();
  g.translate(cx + 16, cy + 6);
  g.rotate(-0.4);
  g.fillStyle = "#f5ecd7";
  g.fillRect(-8, -2.5, 16, 5);
  for (const [bx, by] of [
    [-8, -3],
    [-8, 3],
    [8, -3],
    [8, 3],
  ]) {
    ellipse(g, bx, by, 3.2, 3.2);
    g.fill();
  }
  g.restore();

  g.fillStyle = "#f5e6cc";
  g.font = smallFont();
  g.textAlign = "center";
  g.fillText("Duck's bed", cx, cy + ry - 5);
}

function paintBowls(g: Ctx) {
  g.fillStyle = "#2f3b33";
  roundRect(g, 56, 356, 128, 50, 8);
  g.fill();
  g.strokeStyle = "#3e4d42";
  g.lineWidth = 1.5;
  g.stroke();
  for (const b of [WATER_BOWL_BOUNDS, FOOD_BOWL_BOUNDS]) {
    const cx = b.x + 25;
    const cy = b.y + 20;
    const steel = g.createLinearGradient(cx - 22, cy - 16, cx + 22, cy + 16);
    steel.addColorStop(0, "#d1d5db");
    steel.addColorStop(1, "#4b5563");
    g.fillStyle = steel;
    ellipse(g, cx, cy, 22, 16);
    g.fill();
    g.fillStyle = "#1f2937";
    ellipse(g, cx, cy, 17, 12);
    g.fill();
  }
}

function paintBathroom(g: Ctx) {
  const { x, y, width: w, height: h } = BATHTUB_BOUNDS;
  g.save();
  roundRect(g, x, y, w, h, 10);
  g.clip();
  g.fillStyle = "#9fb0c4";
  g.fillRect(x, y, w, h);
  g.strokeStyle = "#7d8ea3";
  g.lineWidth = 1;
  for (let t = 0; t <= w; t += 12) {
    g.beginPath();
    g.moveTo(x + t, y);
    g.lineTo(x + t, y + h);
    g.stroke();
  }
  for (let t = 0; t <= h; t += 12) {
    g.beginPath();
    g.moveTo(x, y + t);
    g.lineTo(x + w, y + t);
    g.stroke();
  }
  g.fillStyle = "rgba(15, 23, 42, 0.35)";
  g.fillRect(x, y, w, h);
  g.restore();

  // A claw-foot tub from above
  g.fillStyle = "rgba(0, 0, 0, 0.3)";
  roundRect(g, x + 14, y + 14, 71, 50, 22);
  g.fill();
  g.fillStyle = "#f1f5f9";
  roundRect(g, x + 12, y + 10, 71, 50, 22);
  g.fill();
  g.fillStyle = "#bfdbfe";
  roundRect(g, x + 18, y + 16, 59, 38, 17);
  g.fill();
  g.fillStyle = "#94a3b8";
  g.fillRect(x + 72, y + 32, 7, 6);
  g.strokeStyle = "rgba(255, 255, 255, 0.7)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(x + 32, y + 30, 6, Math.PI, Math.PI * 1.5);
  g.stroke();
}

function paintBackDoor(g: Ctx) {
  const { x, y, width: w, height: h } = BACK_DOOR_BOUNDS;
  g.fillStyle = "#3b2a1e";
  roundRect(g, x, y, w, h, 6);
  g.fill();
  g.fillStyle = "#7c5a3a";
  g.fillRect(x + 8, y + 6, w - 16, h - 12);
  g.strokeStyle = "rgba(0, 0, 0, 0.3)";
  g.lineWidth = 1.5;
  g.strokeRect(x + 14, y + 50, w - 28, 22);
  g.strokeRect(x + 14, y + 78, w - 28, 24);

  // Yard through the door's window
  const yard = g.createLinearGradient(0, y + 12, 0, y + 42);
  yard.addColorStop(0, "#9fd0ee");
  yard.addColorStop(0.45, "#9fd0ee");
  yard.addColorStop(0.46, "#65a30d");
  yard.addColorStop(1, "#3f6212");
  g.fillStyle = yard;
  g.fillRect(x + 14, y + 12, w - 28, 32);
  g.strokeStyle = "#5b4130";
  g.lineWidth = 2;
  g.strokeRect(x + 14, y + 12, w - 28, 32);
  g.beginPath();
  g.moveTo(x + w / 2, y + 12);
  g.lineTo(x + w / 2, y + 44);
  g.stroke();

  g.fillStyle = "#d4a017";
  ellipse(g, x + w - 18, y + 64, 3.5, 3.5);
  g.fill();
}

function paintPlant(g: Ctx) {
  g.fillStyle = "rgba(0, 0, 0, 0.3)";
  ellipse(g, 30, 468, 16, 8);
  g.fill();
  g.fillStyle = "#9a3412";
  ellipse(g, 28, 462, 14, 12);
  g.fill();
  const leaves: Array<[number, number, number]> = [
    [18, 452, -0.8],
    [36, 450, 0.7],
    [28, 446, 0],
    [16, 462, -1.6],
    [40, 462, 1.5],
  ];
  for (const [lx, ly, a] of leaves) {
    g.save();
    g.translate(lx, ly);
    g.rotate(a);
    g.fillStyle = "#4d7c0f";
    ellipse(g, 0, 0, 5, 11);
    g.fill();
    g.strokeStyle = "#65a30d";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -9);
    g.lineTo(0, 9);
    g.stroke();
    g.restore();
  }
}

let roomCache: { scale: number; canvas: HTMLCanvasElement } | null = null;

function getRoom(scale: number): HTMLCanvasElement | null {
  if (roomCache?.scale === scale) return roomCache.canvas;
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(CANVAS_WIDTH * scale);
  canvas.height = Math.round(CANVAS_HEIGHT * scale);
  const g = canvas.getContext("2d");
  // Partial 2D contexts (headless test harnesses) fall back to a flat floor.
  if (!g || typeof g.clip !== "function") return null;
  g.scale(scale, scale);
  paintFloor(g);
  paintWall(g);
  paintWindow(g);
  paintRug(g);
  paintDesk(g);
  paintDogBed(g);
  paintBowls(g);
  paintBathroom(g);
  paintBackDoor(g);
  paintPlant(g);
  const vignette = g.createRadialGradient(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    CANVAS_HEIGHT * 0.45,
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT / 2,
    CANVAS_WIDTH * 0.62
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.35)");
  g.fillStyle = vignette;
  g.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  roomCache = { scale, canvas };
  return canvas;
}

// --- Props that Duck can chew ---

function biteMarks(ctx: Ctx, points: Array<[number, number]>) {
  ctx.fillStyle = "#3a2a1f";
  for (const [bx, by] of points) {
    ellipse(ctx, bx, by, 3.2, 3.2);
    ctx.fill();
  }
}

function pitchDeck(ctx: Ctx, chewed: boolean) {
  ctx.fillStyle = "#3f3f46";
  ctx.fillRect(-14, 12, 3, 12);
  ctx.fillRect(11, 12, 3, 12);
  ctx.fillStyle = chewed ? "#d6cfc2" : "#f5f5f4";
  roundRect(ctx, -22, -18, 44, 32, 3);
  ctx.fill();
  ctx.strokeStyle = "#a8a29e";
  ctx.lineWidth = 1;
  ctx.stroke();
  const bars: Array<[number, number, string]> = [
    [-15, 10, "#10b981"],
    [-6, 16, "#f59e0b"],
    [3, 13, "#38bdf8"],
    [12, 22, "#10b981"],
  ];
  for (const [bx, bh, c] of bars) {
    ctx.fillStyle = chewed ? "#78716c" : c;
    ctx.fillRect(bx, 9 - bh, 6, bh);
  }
  ctx.strokeStyle = "#57534e";
  ctx.beginPath();
  ctx.moveTo(-18, 9.5);
  ctx.lineTo(19, 9.5);
  ctx.stroke();
  if (chewed)
    biteMarks(ctx, [
      [20, -14],
      [22, -8],
      [17, 12],
      [21, 6],
    ]);
}

function powerStrip(ctx: Ctx, chewed: boolean) {
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.bezierCurveTo(-18, -18, -28, -12, -30, -22);
  ctx.moveTo(4, -4);
  ctx.bezierCurveTo(10, -18, 22, -10, 28, -20);
  ctx.moveTo(18, 2);
  ctx.bezierCurveTo(26, 12, 12, 20, 22, 26);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "#e5e7eb";
  roundRect(ctx, -22, -7, 44, 14, 4);
  ctx.fill();
  ctx.strokeStyle = "#9ca3af";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#374151";
  for (const ox of [-14, -4, 6]) {
    ctx.fillRect(ox, -3, 2, 5);
    ctx.fillRect(ox + 4, -3, 2, 5);
  }
  ctx.fillStyle = chewed ? "#57534e" : "#ef4444";
  ctx.fillRect(15, -3, 4, 6);
  if (chewed) {
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(26, 18);
    ctx.lineTo(30, 14);
    ctx.lineTo(28, 20);
    ctx.lineTo(33, 17);
    ctx.stroke();
  }
}

function auditFile(ctx: Ctx, chewed: boolean) {
  ctx.save();
  ctx.rotate(-0.12);
  ctx.fillStyle = chewed ? "#a8906a" : "#c9a45c";
  roundRect(ctx, -20, -14, 40, 30, 2);
  ctx.fill();
  ctx.fillRect(-20, -18, 14, 5);
  ctx.restore();
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(-16, -16, 30, 28);
  ctx.fillStyle = "#94a3b8";
  for (let l = 0; l < 5; l++)
    ctx.fillRect(-12, -11 + l * 5, 22 - (l % 2) * 6, 1.5);
  ctx.save();
  ctx.rotate(0.08);
  ctx.fillStyle = chewed ? "#d6b36a" : "#e8c77d";
  roundRect(ctx, -20, -2, 40, 18, 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(-2, 3, 16, 8);
  if (chewed)
    biteMarks(ctx, [
      [-20, 8],
      [-18, 14],
      [-14, -16],
      [16, 15],
    ]);
}

function laptop(ctx: Ctx, chewed: boolean) {
  ctx.fillStyle = "#1f2937";
  roundRect(ctx, -20, -24, 40, 22, 3);
  ctx.fill();
  ctx.fillStyle = chewed ? "#111827" : "#0b1220";
  ctx.fillRect(-17, -21, 34, 16);
  if (!chewed) {
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(-13, -17, 16, 2);
    ctx.fillStyle = "#34d399";
    ctx.fillRect(-13, -12, 22, 2);
  } else {
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-6, -21);
    ctx.lineTo(-2, -13);
    ctx.lineTo(-10, -8);
    ctx.moveTo(-2, -13);
    ctx.lineTo(8, -6);
    ctx.stroke();
  }
  ctx.fillStyle = "#9ca3af";
  roundRect(ctx, -22, -2, 44, 22, 3);
  ctx.fill();
  ctx.fillStyle = "#6b7280";
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      ctx.fillRect(-18 + c * 4.6, 1 + r * 4, 3.2, 2.6);
  ctx.fillStyle = "#b8bdc6";
  ctx.fillRect(-7, 14, 14, 4);
}

const PROP_NAMES: Record<string, string> = {
  "pitch-deck": "pitch deck",
  resume: "résumé",
  "power-cable": "power strip",
  "server-cable": "server cable",
  "audit-file": "audit file",
  "clinical-db": "study binder",
  laptop: "laptop",
  "garmin-watch": "watch",
};

const PROP_PAINTERS: Record<string, (ctx: Ctx, chewed: boolean) => void> = {
  "pitch-deck": pitchDeck,
  resume: pitchDeck,
  "power-cable": powerStrip,
  "server-cable": powerStrip,
  "audit-file": auditFile,
  "clinical-db": auditFile,
  laptop,
  "garmin-watch": laptop,
};

function drawHazard(
  ctx: Ctx,
  hazard: PortfolioHazard,
  state: WorkingWithDuckState,
  calm: boolean
) {
  const isTargeted = state.activeHazardTarget === hazard.id;
  ctx.save();
  ctx.translate(hazard.x, hazard.y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ellipse(ctx, 2, 6, hazard.radius, hazard.radius * 0.7);
  ctx.fill();
  (PROP_PAINTERS[hazard.id] ?? pitchDeck)(ctx, hazard.isChewed);
  ctx.restore();

  if (!isTargeted) return;
  const pulse = calm ? 0 : Math.sin(state.ticks * 0.2) * 3;
  ctx.save();
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2.5;
  ellipse(
    ctx,
    hazard.x,
    hazard.y,
    hazard.radius + 8 + pulse,
    hazard.radius + 8 + pulse
  );
  ctx.stroke();
  const maxTimer = state.duck.maxStateTimer || 240;
  const progress = Math.max(0, state.duck.stateTimer / maxTimer);
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(
    hazard.x,
    hazard.y,
    hazard.radius + 14,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * progress
  );
  ctx.stroke();
  ctx.restore();
  pill(
    ctx,
    `Chewing the ${PROP_NAMES[hazard.id] ?? "files"}! Kong or Drop It`,
    hazard.x,
    hazard.y - hazard.radius - 20,
    "#fb923c"
  );
}

// --- Duck ---

type Fur = DuckCoat;

/**
 * How muddy the Duck being drawn is, 0 to 1. One Duck is drawn at a time,
 * so drawDuck sets it and the part painters read it.
 */
let mud = 0;

interface DuckSprite {
  x: number;
  y: number;
  angle: number;
  state: DuckBehaviorState;
  isCarryingBall: boolean;
  tailWagAngle?: number;
}

interface DuckDrawOptions {
  ticks: number;
  bellyRubProgress?: number;
  accessory?: DuckAccessory;
  isMuddy?: boolean;
  trick?: DuckTrick | null;
  /** 0 when the trick starts, 1 when it ends. */
  trickProgress?: number;
  /** The chewed prop already shows a warning, so skip Duck's own. */
  chewTargetLabelled?: boolean;
}

type Pose = "stand" | "run" | "sit" | "beg" | "sniff" | "nap" | "flop";

function poseFor(state: DuckBehaviorState, trick: DuckTrick | null): Pose {
  if (state === "THE_FLOP") return "flop";
  if (state === "NAP_TIME") return "nap";
  if (state === "PERFORMING_TRICK" || trick) {
    if (trick === "HIGH_FIVE") return "beg";
    if (trick === "SPIN") return "stand";
    return "sit";
  }
  if (state === "ZOOMIES" || state === "FETCHING_BALL") return "run";
  if (
    state === "SNIFFING_POTTY" ||
    state === "SNEAKY_CHEW" ||
    state === "DRINKING_WATER" ||
    state === "EATING_KIBBLE"
  )
    return "sniff";
  return "stand";
}

// One Duck on screen, so the pose-change timing and facing live here.
let lastPose: Pose | null = null;
let poseChangedAt = 0;
let facing = 1;

function leg(
  ctx: Ctx,
  fur: Fur,
  x: number,
  top: number,
  bottom: number,
  lean = 0
) {
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x + lean, bottom);
  ctx.stroke();
  ctx.strokeStyle = fur.base;
  ctx.lineWidth = 6.5;
  ctx.stroke();
  if (mud > 0) {
    // Mud climbs the lower half of the leg from the paw
    ctx.globalAlpha = mud * 0.8;
    ctx.strokeStyle = DUCK_MUD_LEG;
    ctx.lineWidth = 6.5;
    ctx.beginPath();
    ctx.moveTo(x + lean * 0.5, (top + bottom) / 2 + 1);
    ctx.lineTo(x + lean, bottom);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = mud > 0.5 ? DUCK_MUD_PAW : fur.light;
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 1;
  ellipse(ctx, x + lean + 1.5, bottom + 0.5, 5.5, 3.2);
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = "butt";
}

const DUCK_MUD_LEG = "#6f4c2c";
const DUCK_MUD_PAW = "#5c3f24";

function tail(ctx: Ctx, fur: Fur, x: number, y: number, wag: number, lift = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5 - lift + wag * 0.6);
  ctx.fillStyle = fur.base;
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.bezierCurveTo(-10, -8, -20, -6, -27, 2);
  ctx.bezierCurveTo(-20, 3, -18, 8, -24, 10);
  ctx.bezierCurveTo(-12, 10, -6, 6, 0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  paintMudInPath(ctx, TAIL_MUD, mud);
  // Feathering along the underside
  ctx.fillStyle = fur.light;
  ctx.beginPath();
  ctx.moveTo(-6, 3);
  ctx.bezierCurveTo(-12, 6, -18, 7, -22, 8);
  ctx.bezierCurveTo(-14, 5, -10, 3, -6, 1);
  ctx.fill();
  ctx.strokeStyle = fur.shade;
  ctx.lineWidth = 1;
  for (const tx of [-9, -14, -19]) {
    ctx.beginPath();
    ctx.moveTo(tx, 5);
    ctx.lineTo(tx - 2, 9);
    ctx.stroke();
  }
  ctx.restore();
}

const TAIL_MUD: MudBlob[] = [
  [-22, 5, 6, 4],
  [-14, 6, 4, 3],
];

function head(
  ctx: Ctx,
  fur: Fur,
  x: number,
  y: number,
  opts: {
    tilt?: number;
    eyes?: "open" | "closed" | "happy";
    tongue?: boolean;
    earFlap?: number;
    ball?: boolean;
  } = {}
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(opts.tilt ?? 0);

  // Far ear peeks out behind the head
  ctx.fillStyle = fur.shade;
  ellipse(ctx, -9, -8, 6, 8);
  ctx.fill();

  // Skull
  ctx.fillStyle = fur.base;
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 1.5;
  ellipse(ctx, 0, 0, 15, 13.5);
  ctx.fill();
  ctx.stroke();
  // Soft shading under the brow keeps the pale face readable
  ctx.fillStyle = fur.shade;
  ctx.globalAlpha = 0.45;
  ellipse(ctx, -3, 5, 9, 5);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Muzzle
  ctx.fillStyle = fur.light;
  ctx.beginPath();
  ctx.ellipse(12, 5, 10, 7, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fur.base;
  ellipse(ctx, 6, 3, 6, 5);
  ctx.fill();

  // Nose, mouth and tongue
  drawDuckNose(ctx, 21, 2.5, 4.2, 3.3, 0.2);
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(20, 6);
  ctx.quadraticCurveTo(16, 11, 10, 9);
  ctx.stroke();
  if (opts.tongue && !opts.ball) {
    ctx.fillStyle = "#f28b82";
    ctx.beginPath();
    ctx.ellipse(15, 12, 3.5, 5, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c2554d";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(15, 9);
    ctx.lineTo(15.5, 14);
    ctx.stroke();
  }
  if (opts.ball) {
    ctx.fillStyle = "#c7e03a";
    ellipse(ctx, 20, 10, 7.5, 7.5);
    ctx.fill();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(14, 10, 6, -0.9, 0.9);
    ctx.stroke();
  }

  // Eye and brow
  const eyes = opts.eyes ?? "open";
  if (eyes === "open") {
    drawDuckEye(ctx, 5, -4, 2.8);
    ctx.strokeStyle = fur.shade;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(1, -9);
    ctx.quadraticCurveTo(5, -11, 9, -9);
    ctx.stroke();
  } else {
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (eyes === "happy") ctx.arc(5, -3, 3, Math.PI * 1.1, Math.PI * 1.9);
    else ctx.arc(5, -5, 3, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }

  // Near ear, floppy
  ctx.save();
  ctx.translate(-3, -8);
  ctx.rotate(0.25 + (opts.earFlap ?? 0));
  ctx.fillStyle = fur.ear;
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, -2);
  ctx.bezierCurveTo(-12, 4, -12, 16, -5, 20);
  ctx.bezierCurveTo(1, 20, 4, 10, 4, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = fur.shade;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, 6);
  ctx.quadraticCurveTo(-7, 12, -4, 16);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function collar(ctx: Ctx, x: number, y: number, tilt = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 5, 10, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fillStyle = "#fbbf24";
  ellipse(ctx, 5, 8, 2.5, 2.5);
  ctx.fill();
  ctx.restore();
}

function accessory(
  ctx: Ctx,
  kind: DuckAccessory,
  anchors: {
    head: [number, number];
    neck: [number, number];
    feet: Array<[number, number]>;
  }
) {
  if (kind === "none") return;
  if (kind === "bucket-hat") {
    const [hx, hy] = anchors.head;
    ctx.save();
    ctx.translate(hx, hy - 12);
    ctx.fillStyle = "#18181b";
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 3, 16, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-10, 3);
    ctx.quadraticCurveTo(-9, -9, 0, -9);
    ctx.quadraticCurveTo(9, -9, 10, 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-5, -4, 10, 1.4);
    ctx.fillRect(-4, -1, 8, 1.2);
    ctx.restore();
    return;
  }
  const [nx, ny] = anchors.neck;
  if (kind === "bowtie") {
    ctx.save();
    ctx.translate(nx + 4, ny + 8);
    ctx.fillStyle = "#0284c7";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -5);
    ctx.lineTo(-7, 5);
    ctx.closePath();
    ctx.moveTo(0, 0);
    ctx.lineTo(7, -5);
    ctx.lineTo(7, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f59e0b";
    ellipse(ctx, 0, 0, 2.4, 2.4);
    ctx.fill();
    ctx.restore();
  } else if (kind === "bandana") {
    ctx.save();
    ctx.translate(nx + 2, ny + 4);
    ctx.fillStyle = "#ef4444";
    ctx.strokeStyle = "#b91c1c";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, -8);
    ctx.lineTo(8, -2);
    ctx.lineTo(0, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (const [px, py] of [
      [0, -3],
      [3, 3],
      [0, 8],
    ]) {
      ellipse(ctx, px, py, 1, 1);
      ctx.fill();
    }
    ctx.restore();
  } else if (kind === "rain-boots") {
    ctx.fillStyle = "#facc15";
    ctx.strokeStyle = "#ca8a04";
    ctx.lineWidth = 1;
    for (const [fx, fy] of anchors.feet) {
      roundRect(ctx, fx - 4.5, fy - 7, 9, 9, 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

function body(
  ctx: Ctx,
  fur: Fur,
  x: number,
  y: number,
  rx: number,
  ry: number,
  tilt = 0
) {
  ctx.fillStyle = fur.base;
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fur.light;
  ctx.beginPath();
  ctx.ellipse(x + 2, y + ry * 0.45, rx * 0.72, ry * 0.4, tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = fur.shade;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(x - 2, y - ry * 0.5, rx * 0.7, ry * 0.3, tilt, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  // A few fur strokes give the pale coat some form
  ctx.strokeStyle = fur.shade;
  ctx.lineWidth = 1;
  for (const f of [-0.45, -0.1, 0.25]) {
    ctx.beginPath();
    ctx.moveTo(x + rx * f, y - ry * 0.15);
    ctx.quadraticCurveTo(
      x + rx * f - 3,
      y + ry * 0.2,
      x + rx * f - 1,
      y + ry * 0.45
    );
    ctx.stroke();
  }
  if (mud > 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, tilt, 0, Math.PI * 2);
    paintMudInPath(
      ctx,
      [
        [x - rx * 0.5, y + ry * 0.95, rx * 0.45, ry * 0.4],
        [x + rx * 0.25, y + ry * 1.0, rx * 0.5, ry * 0.38],
        [x - rx * 0.9, y + ry * 0.55, rx * 0.2, ry * 0.3],
        [x + rx * 0.05, y + ry * 0.45, rx * 0.05, ry * 0.08],
        [x - rx * 0.3, y + ry * 0.35, rx * 0.04, ry * 0.07],
        [x + rx * 0.5, y + ry * 0.5, rx * 0.06, ry * 0.08],
      ],
      mud
    );
  }
}

function drawStanding(
  ctx: Ctx,
  fur: Fur,
  pose: "stand" | "run" | "sniff",
  wag: number,
  bob: number,
  opts: {
    tongue: boolean;
    ball: boolean;
    earFlap: number;
    accessory: DuckAccessory;
  }
) {
  const run = pose === "run";
  const sniff = pose === "sniff";
  tail(ctx, fur, -26, -6 + bob, wag, sniff ? 0.4 : run ? -0.4 : 0);
  // Far legs, darker
  const farFur = { ...fur, base: fur.shade };
  leg(ctx, farFur, -14, 4 + bob, 22, run ? -8 : 0);
  leg(ctx, farFur, 20, 4 + bob, 22, run ? 8 : 0);
  body(ctx, fur, 0, bob, run ? 31 : 28, run ? 14 : 16, run ? -0.06 : 0);
  leg(ctx, fur, -20, 6 + bob, 23, run ? 9 : 0);
  leg(ctx, fur, 14, 6 + bob, 23, run ? -9 : 0);
  // Chest ruff
  ctx.fillStyle = fur.light;
  ellipse(ctx, 18, 2 + bob, 9, 10);
  ctx.fill();
  const hx = sniff ? 32 : 28;
  const hy = sniff ? 2 + bob : -16 + bob;
  collar(ctx, 21, -4 + bob + (sniff ? 6 : 0), sniff ? 0.6 : -0.2);
  head(ctx, fur, hx, hy, {
    tilt: sniff ? 0.55 : run ? 0.12 : 0,
    tongue: opts.tongue,
    ball: opts.ball,
    earFlap: opts.earFlap,
  });
  accessory(ctx, opts.accessory, {
    head: [hx, hy],
    neck: [21, -4 + bob],
    feet: [
      [-20 + (run ? 9 : 0), 23],
      [14 + (run ? -9 : 0), 23],
      [-14 + (run ? -8 : 0), 22],
      [20 + (run ? 8 : 0), 22],
    ],
  });
}

function drawSitting(
  ctx: Ctx,
  fur: Fur,
  beg: boolean,
  wag: number,
  opts: { tongue: boolean; ball: boolean; accessory: DuckAccessory }
) {
  // Tail sweeps the floor
  ctx.save();
  ctx.translate(-14, 18);
  ctx.rotate(0.9 + wag * 0.4);
  ctx.fillStyle = fur.base;
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.bezierCurveTo(-8, -6, -18, -4, -24, 2);
  ctx.bezierCurveTo(-14, 6, -6, 5, 0, 3);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // Haunch
  ctx.fillStyle = fur.base;
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 1.5;
  ellipse(ctx, -8, 10, 17, 14);
  ctx.fill();
  ctx.stroke();
  paintMudInPath(
    ctx,
    [
      [-12, 23, 12, 5],
      [-20, 14, 2, 2.5],
    ],
    mud
  );
  ctx.fillStyle = fur.light;
  ellipse(ctx, -10, 20, 11, 4);
  ctx.fill();
  // Upright chest
  body(ctx, fur, 6, -4, 13, 19, -0.15);
  const farFur = { ...fur, base: fur.shade };
  leg(ctx, farFur, 12, 4, 23);
  if (beg) {
    // Paw raised for a high five
    ctx.strokeStyle = fur.outline;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(24, -6);
    ctx.stroke();
    ctx.strokeStyle = fur.base;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = fur.light;
    ellipse(ctx, 26, -7, 4, 4.5);
    ctx.fill();
  } else {
    leg(ctx, fur, 6, 4, 24);
  }
  ctx.fillStyle = fur.light;
  ellipse(ctx, 10, -2, 8, 11);
  ctx.fill();
  collar(ctx, 11, -16, -0.1);
  head(ctx, fur, 16, -28, {
    tilt: beg ? -0.12 : 0,
    tongue: opts.tongue,
    ball: opts.ball,
    eyes: beg ? "happy" : "open",
  });
  accessory(ctx, opts.accessory, {
    head: [16, -28],
    neck: [11, -16],
    feet: [
      [6, 24],
      [12, 23],
      [-18, 24],
      [0, 25],
    ],
  });
}

function drawNap(
  ctx: Ctx,
  fur: Fur,
  breath: number,
  accessoryKind: DuckAccessory
) {
  ctx.save();
  ctx.scale(1, 1 + breath);
  // Tail curled round the front
  ctx.fillStyle = fur.base;
  ctx.strokeStyle = fur.outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-24, 6);
  ctx.bezierCurveTo(-20, 22, 10, 24, 22, 16);
  ctx.bezierCurveTo(8, 18, -12, 16, -18, 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  body(ctx, fur, -2, 0, 30, 17);
  ctx.restore();
  // Head resting on paws
  ctx.fillStyle = fur.light;
  ellipse(ctx, 24, 14, 10, 4);
  ctx.fill();
  head(ctx, fur, 20, 2, { tilt: 0.35, eyes: "closed" });
  accessory(ctx, accessoryKind, {
    head: [20, 2],
    neck: [14, 4],
    feet: [
      [26, 16],
      [18, 17],
    ],
  });
}

function drawFlop(ctx: Ctx, fur: Fur, ticks: number, calm: boolean) {
  const kick = calm ? 0 : Math.sin(ticks * 0.3) * 0.15;
  const pawUp = (px: number, py: number, rot: number) => {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.strokeStyle = fur.outline;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -8);
    ctx.stroke();
    ctx.strokeStyle = fur.base;
    ctx.lineWidth = 6.5;
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.fillStyle = "#b5836b";
    ellipse(ctx, 0, -9, 3, 2.5);
    ctx.fill();
    ctx.restore();
  };
  pawUp(-16, -12, -0.4 - kick);
  pawUp(12, -12, 0.4 + kick);
  body(ctx, fur, 0, 2, 30, 16);
  // Pink belly
  ctx.fillStyle = "#f6c7b6";
  ellipse(ctx, 0, -2, 18, 9);
  ctx.fill();
  pawUp(-22, -8, -0.8);
  pawUp(18, -6, 0.9);
  head(ctx, fur, 34, 6, { tilt: 1.2, eyes: "happy", tongue: true });
}

/**
 * Draws Duck at `duck.x, duck.y`: a 3/4-view English Cream golden retriever
 * that faces the way he's heading and holds a pose for his behaviour. When
 * he's muddy the mud sits on his cream coat as patches. Status labels
 * float above him on dark pills.
 */
export function drawDuck(ctx: Ctx, duck: DuckSprite, options: DuckDrawOptions) {
  const calm = prefersReducedMotion();
  const fur = DUCK_COAT;
  mud = options.isMuddy ? 1 : 0;
  const trick = options.trick ?? null;
  const pose = poseFor(duck.state, trick);
  const ticks = options.ticks;
  const accessoryKind = options.accessory ?? "none";

  if (pose !== lastPose) {
    lastPose = pose;
    poseChangedAt = ticks;
  }
  const cos = Math.cos(duck.angle);
  if (cos > 0.2) facing = 1;
  else if (cos < -0.2) facing = -1;

  // Squash on a pose change, easing back over a fifth of a second
  let sx = 1;
  let sy = 1;
  const since = ticks - poseChangedAt;
  if (!calm && since >= 0 && since < 12) {
    const t = since / 12;
    const amount = Math.sin(t * Math.PI) * (1 - t) * 0.16;
    sx = 1 + amount;
    sy = 1 - amount;
  }
  let flip: number = facing;
  if (trick === "SPIN" && !calm) {
    const p = options.trickProgress ?? 0;
    flip = facing * Math.cos(p * Math.PI * 4);
    if (Math.abs(flip) < 0.15) flip = flip < 0 ? -0.15 : 0.15;
  }

  const wag = duck.tailWagAngle ?? (calm ? 0 : Math.sin(ticks * 0.3) * 0.4);
  const lifted = duck.state === "DRAGGED";

  ctx.save();
  ctx.translate(duck.x, duck.y);

  // Ground shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ellipse(ctx, 0, lifted ? 30 : 24, lifted ? 24 : 32, lifted ? 5 : 7);
  ctx.fill();
  if (lifted) ctx.translate(0, -8);

  ctx.scale(flip * sx, sy);
  // Anchor the squash at the feet
  ctx.translate(0, (1 - sy) * 22);

  const happy =
    duck.state === "ZOOMIES" ||
    duck.state === "FETCHING_BALL" ||
    duck.state === "NO_TAKE_THROW" ||
    duck.state === "PERFORMING_TRICK";

  if (pose === "flop") {
    drawFlop(ctx, fur, ticks, calm);
  } else if (pose === "nap") {
    drawNap(ctx, fur, calm ? 0 : Math.sin(ticks * 0.05) * 0.03, accessoryKind);
  } else if (pose === "sit" || pose === "beg") {
    drawSitting(ctx, fur, pose === "beg", wag, {
      tongue: happy,
      ball: duck.isCarryingBall,
      accessory: accessoryKind,
    });
  } else {
    const bob =
      pose === "run" && !calm ? Math.abs(Math.sin(ticks * 0.5)) * -3 : 0;
    drawStanding(ctx, fur, pose, wag, bob, {
      tongue: happy,
      ball: duck.isCarryingBall,
      earFlap:
        pose === "run" && !calm ? -0.5 + Math.sin(ticks * 0.4) * 0.15 : 0,
      accessory: accessoryKind,
    });
    if (pose === "run") {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (const [ly, len] of [
        [-8, 14],
        [0, 20],
        [8, 12],
      ]) {
        ctx.beginPath();
        ctx.moveTo(-44, ly);
        ctx.lineTo(-44 - len, ly);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
    }
  }
  ctx.restore();

  if (pose === "flop") {
    const progress = Math.round(options.bellyRubProgress ?? 0);
    pill(ctx, `Scrub the tummy ${progress}%`, duck.x, duck.y - 46, "#f9a8d4");
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(duck.x - 35, duck.y - 34, 70, 5);
    ctx.fillStyle = "#f472b6";
    ctx.fillRect(
      duck.x - 35,
      duck.y - 34,
      (70 * Math.min(100, progress)) / 100,
      5
    );
    return;
  }
  if (pose === "nap") {
    ctx.save();
    ctx.fillStyle = "#cbd5e1";
    ctx.font = gameFont(14, "bold");
    ctx.textAlign = "center";
    const drift = calm ? 0 : Math.sin(ticks * 0.08) * 4;
    ctx.fillText("z z z", duck.x + facing * 12, duck.y - 30 - drift);
    ctx.restore();
    return;
  }

  const label = STATE_LABELS[duck.state];
  if (label && !(duck.state === "SNEAKY_CHEW" && options.chewTargetLabelled)) {
    pill(ctx, label[0], duck.x, duck.y - 48, label[1]);
  }
}

const STATE_LABELS: Partial<Record<DuckBehaviorState, [string, string]>> = {
  NO_TAKE_THROW: ["No take! Press 4 or call Drop It", "#7dd3fc"],
  SNIFFING_POTTY: ["Sniffing around. Drag him to the door!", "#fca5a5"],
  ZOOMIES: ["Zoomies!", "#fbbf24"],
  SNEAKY_CHEW: ["Sneaky chew!", "#fca5a5"],
  PERFORMING_TRICK: ["Good boy trick!", "#fbbf24"],
  DRINKING_WATER: ["Lap lap lap...", "#7dd3fc"],
  EATING_KIBBLE: ["Munch crunch...", "#fcd34d"],
};

/** The engine marks snores as purple star particles; they draw as a "z". */
const SNORE_COLOR = "#c084fc";

function sparkle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function heart(ctx: Ctx, x: number, y: number, size: number) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.8);
  ctx.bezierCurveTo(
    x - s * 1.4,
    y - s * 0.2,
    x - s * 0.6,
    y - s * 1.3,
    x,
    y - s * 0.45
  );
  ctx.bezierCurveTo(
    x + s * 0.6,
    y - s * 1.3,
    x + s * 1.4,
    y - s * 0.2,
    x,
    y + s * 0.8
  );
  ctx.fill();
}

/** How many light steps a sprint passes through, so gradients are reused. */
const DAYLIGHT_STEPS = 24;

interface DaylightLayer {
  wash: CanvasGradient | null;
  lamp: CanvasGradient | null;
  /** Sunset over the window glass, with its opacity. */
  sky: { fill: CanvasGradient; alpha: number } | null;
}

/** The window glass in the cached room (see paintWindow). */
const WINDOW_GLASS = { x: 362, y: 12, width: 81, height: 42 };

const daylightCache = new WeakMap<Ctx, Map<number, DaylightLayer>>();

/**
 * The day passes over the sprint (#1677): gold morning light from the
 * window at the start, plain daylight at midday, then a dusky blue wash
 * with a desk-lamp pool as the deadline nears. Gradients are built once per
 * step and context, and a context without gradients skips the light.
 */
function drawDaylight(ctx: Ctx, progress: number) {
  if (
    typeof ctx.createLinearGradient !== "function" ||
    typeof ctx.createRadialGradient !== "function"
  ) {
    return;
  }
  const step = Math.round(clamp(progress, 0, 1) * DAYLIGHT_STEPS);
  let byStep = daylightCache.get(ctx);
  if (!byStep) {
    byStep = new Map();
    daylightCache.set(ctx, byStep);
  }
  let layer = byStep.get(step);
  if (!layer) {
    const t = step / DAYLIGHT_STEPS;
    const morning = clamp(1 - t / 0.35, 0, 1);
    const dusk = clamp((t - 0.55) / 0.45, 0, 1);
    let wash: CanvasGradient | null = null;
    if (morning > 0 || dusk > 0) {
      wash = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
      wash.addColorStop(
        0,
        `rgba(${morning > 0 ? "251, 191, 36" : "249, 115, 22"}, ${(
          0.12 * Math.max(morning, dusk)
        ).toFixed(3)})`
      );
      wash.addColorStop(
        1,
        dusk > 0
          ? `rgba(15, 23, 42, ${(0.3 * dusk).toFixed(3)})`
          : "rgba(251, 191, 36, 0)"
      );
    }
    let lamp: CanvasGradient | null = null;
    if (dusk > 0) {
      const cx = DESK_BOUNDS.x + DESK_BOUNDS.width / 2;
      const cy = DESK_BOUNDS.y + DESK_BOUNDS.height / 2;
      lamp = ctx.createRadialGradient(cx, cy, 10, cx, cy, 150);
      lamp.addColorStop(0, `rgba(251, 191, 36, ${(0.16 * dusk).toFixed(3)})`);
      lamp.addColorStop(1, "rgba(251, 191, 36, 0)");
    }
    let sky: DaylightLayer["sky"] = null;
    if (dusk > 0) {
      const fill = ctx.createLinearGradient(
        0,
        WINDOW_GLASS.y,
        0,
        WINDOW_GLASS.y + WINDOW_GLASS.height
      );
      fill.addColorStop(0, "#1e3a5f");
      fill.addColorStop(1, "#f97316");
      sky = { fill, alpha: 0.75 * dusk };
    }
    layer = { wash, lamp, sky };
    byStep.set(step, layer);
  }
  if (layer.sky) {
    ctx.save();
    ctx.globalAlpha = layer.sky.alpha;
    ctx.fillStyle = layer.sky.fill;
    ctx.fillRect(
      WINDOW_GLASS.x,
      WINDOW_GLASS.y,
      WINDOW_GLASS.width,
      WINDOW_GLASS.height
    );
    ctx.restore();
  }
  if (layer.wash) {
    ctx.fillStyle = layer.wash;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
  if (layer.lamp) {
    ctx.fillStyle = layer.lamp;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
}

/**
 * Paints the whole office for one frame: the cached room, then everything
 * that changes with the game state, then Duck, particles and alerts.
 */
export function drawOfficeScene(
  ctx: Ctx,
  state: WorkingWithDuckState,
  scale = 1
) {
  const calm = prefersReducedMotion();
  const room = typeof ctx.drawImage === "function" ? getRoom(scale) : null;
  if (room) {
    ctx.drawImage(room, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  } else {
    ctx.fillStyle = "#4d3524";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }
  drawDaylight(ctx, state.workProgress / (state.targetWorkProgress || 1));

  // Squirrel at the window
  if (state.activeSurpriseEvent?.type === "squirrel-window") {
    ctx.fillStyle = "#b45309";
    ellipse(ctx, 425, 44, 7, 6);
    ctx.fill();
    ellipse(ctx, 433, 37, 5.5, 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(418, 46);
    ctx.bezierCurveTo(408, 44, 406, 30, 414, 26);
    ctx.bezierCurveTo(416, 34, 418, 38, 422, 42);
    ctx.fill();
    ctx.fillStyle = "#1c1917";
    ellipse(ctx, 435, 36, 1.2, 1.2);
    ctx.fill();
    pill(ctx, "Squirrel! Click the window (+200)", 402, 72, "#fbbf24");
  }

  // Monitors light up during a focus burst
  if (state.activeCodeBursts > 0) {
    ctx.fillStyle = "rgba(52, 211, 153, 0.14)";
    ctx.fillRect(DESK_BOUNDS.x + 18, DESK_BOUNDS.y + 9, 60, 33);
    ctx.fillRect(DESK_BOUNDS.x + 93, DESK_BOUNDS.y + 9, 60, 33);
  }
  pill(
    ctx,
    "Space: focus sprint",
    DESK_BOUNDS.x + 85,
    DESK_BOUNDS.y + 146,
    state.activeCodeBursts > 0 ? "#34d399" : "#a8a29e",
    smallFont()
  );

  // Bowl levels
  const water = clamp(state.officeStations.waterLevel, 0, 100) / 100;
  const food = clamp(state.officeStations.foodLevel, 0, 100) / 100;
  if (water > 0) {
    ctx.fillStyle = "#38bdf8";
    ellipse(
      ctx,
      WATER_BOWL_BOUNDS.x + 25,
      WATER_BOWL_BOUNDS.y + 20,
      16 * water,
      11 * water
    );
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ellipse(
      ctx,
      WATER_BOWL_BOUNDS.x + 21,
      WATER_BOWL_BOUNDS.y + 17,
      5 * water,
      2 * water
    );
    ctx.fill();
  }
  if (food > 0) {
    const fx = FOOD_BOWL_BOUNDS.x + 25;
    const fy = FOOD_BOWL_BOUNDS.y + 20;
    ctx.fillStyle = "#8a5a2b";
    ellipse(ctx, fx, fy, 16 * food, 11 * food);
    ctx.fill();
    ctx.fillStyle = "#b07a3e";
    const rnd = mulberry32(7);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 0.85;
      ellipse(
        ctx,
        fx + Math.cos(a) * 14 * food * r,
        fy + Math.sin(a) * 9 * food * r,
        2,
        1.6
      );
      ctx.fill();
    }
  }

  // Bathtub
  const bathX = BATHTUB_BOUNDS.x + BATHTUB_BOUNDS.width / 2;
  if (state.isMuddy) {
    ctx.save();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 5]);
    roundRect(
      ctx,
      BATHTUB_BOUNDS.x - 3,
      BATHTUB_BOUNDS.y - 3,
      BATHTUB_BOUNDS.width + 6,
      BATHTUB_BOUNDS.height + 6,
      12
    );
    ctx.stroke();
    ctx.restore();
    pill(
      ctx,
      "Needs a wash!",
      bathX,
      BATHTUB_BOUNDS.y + 80,
      "#fbbf24",
      smallFont()
    );
  } else {
    pill(ctx, "Bathtub", bathX, BATHTUB_BOUNDS.y + 80, "#cbd5e1", smallFont());
  }

  // Back door
  const isPottyUrgent =
    state.bladder > 75 ||
    state.duck.state === "SNIFFING_POTTY" ||
    state.duck.state === "DRAGGED";
  const doorX = BACK_DOOR_BOUNDS.x + BACK_DOOR_BOUNDS.width / 2;
  const doorY = BACK_DOOR_BOUNDS.y + BACK_DOOR_BOUNDS.height / 2;
  if (isPottyUrgent) {
    const pulse = calm ? 0 : Math.sin(state.ticks * 0.15) * 3;
    ctx.save();
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(
      BACK_DOOR_BOUNDS.x - 4 - pulse,
      BACK_DOOR_BOUNDS.y - 4 - pulse,
      BACK_DOOR_BOUNDS.width + 8 + pulse * 2,
      BACK_DOOR_BOUNDS.height + 8 + pulse * 2
    );
    ctx.strokeStyle = "rgba(34, 197, 94, 0.8)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(state.duck.x, state.duck.y);
    ctx.lineTo(doorX, doorY);
    ctx.stroke();
    ctx.restore();
  }
  pill(
    ctx,
    isPottyUrgent ? "Drop him here" : "Back door",
    doorX,
    BACK_DOOR_BOUNDS.y + 92,
    isPottyUrgent ? "#4ade80" : "#a7f3d0",
    smallFont()
  );

  // A parcel at the door
  if (state.activeSurpriseEvent?.type === "amazon-delivery") {
    const px = BACK_DOOR_BOUNDS.x - 30;
    const py = BACK_DOOR_BOUNDS.y + 40;
    ctx.fillStyle = "#b7864f";
    ctx.fillRect(px, py, 24, 22);
    ctx.fillStyle = "#d4a868";
    ctx.fillRect(px, py, 24, 5);
    ctx.fillStyle = "#e5d3a8";
    ctx.fillRect(px + 10, py, 4, 22);
    pill(
      ctx,
      "Sign for the package",
      BACK_DOOR_BOUNDS.x - 30,
      BACK_DOOR_BOUNDS.y + 22,
      "#fbbf24",
      smallFont()
    );
  }

  state.hazards.forEach((hazard) => drawHazard(ctx, hazard, state, calm));

  ctx.save();
  ctx.font = smallFont();
  ctx.textAlign = "center";
  ctx.fillStyle = water < 0.25 ? "#fbbf24" : "#e7e5e4";
  ctx.fillText(
    `water ${Math.round(water * 100)}%`,
    WATER_BOWL_BOUNDS.x + 25,
    WATER_BOWL_BOUNDS.y + 42
  );
  ctx.fillStyle = food < 0.25 ? "#fbbf24" : "#e7e5e4";
  ctx.fillText(
    `food ${Math.round(food * 100)}%`,
    FOOD_BOWL_BOUNDS.x + 25,
    FOOD_BOWL_BOUNDS.y + 42
  );
  ctx.restore();

  // Puddles
  state.indoorPuddles?.forEach((puddle) => {
    ctx.save();
    ctx.fillStyle = "rgba(250, 204, 21, 0.28)";
    ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(
      puddle.x,
      puddle.y,
      puddle.radius * 1.25,
      puddle.radius * 0.85,
      0.2,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ellipse(
      ctx,
      puddle.x - puddle.radius * 0.4,
      puddle.y - puddle.radius * 0.2,
      puddle.radius * 0.3,
      puddle.radius * 0.12
    );
    ctx.fill();
    if (puddle.mopProgress > 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fillRect(puddle.x - 25, puddle.y - 28, 50, 6);
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(
        puddle.x - 25,
        puddle.y - 28,
        (50 * Math.min(100, puddle.mopProgress)) / 100,
        6
      );
    }
    ctx.restore();
    pill(
      ctx,
      "Scrub to mop",
      puddle.x,
      puddle.y + puddle.radius + 10,
      "#fde68a",
      smallFont()
    );
  });

  // A thrown tennis ball
  if (state.ball?.active) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ellipse(ctx, state.ball.x + 2, state.ball.y + 7, 8, 3);
    ctx.fill();
    ctx.fillStyle = "#c7e03a";
    ellipse(ctx, state.ball.x, state.ball.y, 9, 9);
    ctx.fill();
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(state.ball.x - 7, state.ball.y, 7, -0.9, 0.9);
    ctx.stroke();
  }

  drawDuck(ctx, state.duck, {
    ticks: state.ticks,
    bellyRubProgress: state.bellyRubProgress,
    accessory: state.activeAccessory,
    isMuddy: state.isMuddy,
    trick: state.activeTrick?.trick ?? null,
    trickProgress: state.activeTrick
      ? 1 - state.activeTrick.timer / Math.max(1, state.activeTrick.maxTimer)
      : 0,
    chewTargetLabelled: state.activeHazardTarget !== null,
  });

  state.particles.forEach((p) => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = tone(p.color);
    if (p.shape === "heart") {
      heart(ctx, p.x, p.y, p.size);
    } else if (p.shape === "star" && p.color.toLowerCase() === SNORE_COLOR) {
      ctx.font = gameFont(p.size, "bold");
      ctx.textAlign = "center";
      ctx.fillText("z", p.x, p.y);
    } else if (p.shape === "star") {
      sparkle(ctx, p.x, p.y, p.size / 2);
    } else {
      ellipse(ctx, p.x, p.y, p.size / 2, p.size / 2);
      ctx.fill();
    }
    ctx.restore();
  });

  state.floatingAlerts.forEach((a) => {
    ctx.save();
    ctx.globalAlpha = a.alpha;
    ctx.fillStyle = tone(a.color);
    ctx.font = gameFont(12, "bold");
    ctx.textAlign = "center";
    ctx.shadowColor = "#000000";
    ctx.shadowBlur = 6;
    fillCenteredTextInCanvas(ctx, a.text, a.x, a.y);
    ctx.restore();
  });
}
