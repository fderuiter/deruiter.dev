/**
 * Laser Loon scene art (#1597): procedural parallax backdrops for each act,
 * the loon itself, and one silhouette per enemy type. Everything is drawn
 * with canvas paths, so there are no image assets to load.
 *
 * Backdrop layers are rendered once per act, size and pixel ratio into
 * offscreen canvases that tile horizontally, and each frame only blits them
 * at a parallax offset. With motion reduced, the offsets stay at zero.
 */
import type { CampaignAct, CivicEnemyType, Target } from "@/lib/laser-loon";

type Ctx = CanvasRenderingContext2D;
export type BackdropTheme = CampaignAct["backgroundTheme"];

interface ThemeSpec {
  sky: [string, string, string];
  glow: string;
  far: (g: Ctx, w: number, h: number, rnd: () => number) => void;
  mid: (g: Ctx, w: number, h: number, rnd: () => number) => void;
  near: (g: Ctx, w: number, h: number, rnd: () => number) => void;
}

/** Parallax speeds for the far, mid and near layers, in px per second. */
const LAYER_SPEEDS = [4, 11, 24] as const;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws `draw` at x, x - w and x + w so a layer tiles without a seam. */
function wrapped(w: number, x: number, draw: (x: number) => void) {
  draw(x);
  draw(x - w);
  draw(x + w);
}

function pine(g: Ctx, x: number, base: number, height: number) {
  const half = height * 0.28;
  g.beginPath();
  g.moveTo(x, base - height);
  for (let tier = 1; tier <= 3; tier++) {
    const y = base - height + (height * tier) / 3;
    g.lineTo(x + (half * tier) / 3, y);
    g.lineTo(x + (half * tier) / 6, y);
  }
  g.lineTo(x + 2, base);
  g.lineTo(x - 2, base);
  for (let tier = 3; tier >= 1; tier--) {
    const y = base - height + (height * tier) / 3;
    g.lineTo(x - (half * tier) / 6, y);
    g.lineTo(x - (half * tier) / 3, y);
  }
  g.closePath();
  g.fill();
}

const THEMES: Record<BackdropTheme, ThemeSpec> = {
  // Act 1: Lake Minnetonka at dawn.
  lake: {
    sky: ["#0b1324", "#16304a", "#7c4a24"],
    glow: "rgba(245, 158, 11, 0.22)",
    far: (g, w, h, rnd) => {
      g.fillStyle = "#0e2230";
      const base = h * 0.62;
      for (let x = 0; x < w; x += 9 + rnd() * 7) {
        const ht = 26 + rnd() * 30;
        wrapped(w, x, (px) => pine(g, px, base, ht));
      }
      g.fillRect(0, base - 2, w, h - base + 2);
    },
    mid: (g, w, h) => {
      const top = h * 0.64;
      const water = g.createLinearGradient(0, top, 0, h);
      water.addColorStop(0, "#1c3b52");
      water.addColorStop(1, "#0a1826");
      g.fillStyle = water;
      g.fillRect(0, top, w, h - top);
      g.strokeStyle = "rgba(251, 191, 36, 0.16)";
      g.lineWidth = 1;
      for (let i = 0; i < 14; i++) {
        const y = top + 6 + i * 9;
        const len = 30 + ((i * 37) % 70);
        for (let x = (i * 53) % 120; x < w; x += 150) {
          wrapped(w, x, (px) => {
            g.beginPath();
            g.moveTo(px, y);
            g.lineTo(px + len, y);
            g.stroke();
          });
        }
      }
    },
    near: (g, w, h, rnd) => {
      g.strokeStyle = "#07111a";
      g.fillStyle = "#07111a";
      g.lineWidth = 2;
      for (let x = 0; x < w; x += 5 + rnd() * 14) {
        const ht = 16 + rnd() * 34;
        const lean = (rnd() - 0.5) * 8;
        wrapped(w, x, (px) => {
          g.beginPath();
          g.moveTo(px, h);
          g.quadraticCurveTo(px + lean * 0.4, h - ht * 0.6, px + lean, h - ht);
          g.stroke();
          if (ht > 36) {
            g.beginPath();
            g.ellipse(px + lean, h - ht, 2.5, 7, lean * 0.03, 0, Math.PI * 2);
            g.fill();
          }
        });
      }
    },
  },
  // Act 2: the State Fair midway at dusk.
  fair: {
    sky: ["#0d1120", "#3a1d1a", "#b45309"],
    glow: "rgba(251, 146, 60, 0.24)",
    far: (g, w, h) => {
      g.fillStyle = "#1a1418";
      g.strokeStyle = "#1a1418";
      const base = h * 0.66;
      const cx = w * 0.3;
      const cy = base - 92;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy, 78, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + Math.cos(a) * 78, cy + Math.sin(a) * 78);
        g.stroke();
        g.fillRect(cx + Math.cos(a) * 78 - 4, cy + Math.sin(a) * 78, 8, 7);
      }
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(cx - 40, base);
      g.lineTo(cx, cy);
      g.lineTo(cx + 40, base);
      g.stroke();
      // The Space Tower.
      g.fillRect(w * 0.74 - 3, base - 170, 6, 170);
      g.fillRect(w * 0.74 - 14, base - 128, 28, 10);
      g.fillRect(0, base, w, h - base);
    },
    mid: (g, w, h) => {
      const base = h * 0.78;
      for (let i = 0; i < 6; i++) {
        const x = (i * w) / 6 + 30;
        wrapped(w, x, (px) => {
          for (let s = 0; s < 4; s++) {
            g.fillStyle = s % 2 === 0 ? "#3b1716" : "#261412";
            g.beginPath();
            g.moveTo(px + 32, base - 58);
            g.lineTo(px + s * 16, base - 24);
            g.lineTo(px + (s + 1) * 16, base - 24);
            g.closePath();
            g.fill();
          }
          g.fillStyle = "#1c1011";
          g.fillRect(px, base - 24, 64, 24);
        });
      }
      g.fillStyle = "#140c0d";
      g.fillRect(0, base, w, h - base);
    },
    near: (g, w, h) => {
      const y0 = h * 0.2;
      g.strokeStyle = "rgba(20, 12, 13, 0.9)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, y0);
      for (let x = 0; x <= w; x += 8) {
        g.lineTo(x, y0 + Math.sin((x / w) * Math.PI * 6) * 14 + 14);
      }
      g.stroke();
      g.fillStyle = "rgba(253, 224, 71, 0.75)";
      for (let x = 12; x < w; x += 24) {
        const y = y0 + Math.sin((x / w) * Math.PI * 6) * 14 + 17;
        g.beginPath();
        g.arc(x, y, 1.8, 0, Math.PI * 2);
        g.fill();
      }
    },
  },
  // Act 3: the Redesign Commission hearing room.
  hearing: {
    sky: ["#15110d", "#1f1812", "#2a2016"],
    glow: "rgba(245, 158, 11, 0.12)",
    far: (g, w, h) => {
      for (let i = 0; i < 5; i++) {
        const x = (i * w) / 5 + 30;
        wrapped(w, x, (px) => {
          g.fillStyle = "#3a3024";
          g.fillRect(px, h * 0.1, 80, h * 0.45);
          g.fillStyle = "rgba(0, 0, 0, 0.35)";
          for (let y = h * 0.12; y < h * 0.54; y += 7) {
            g.fillRect(px + 4, y, 72, 2);
          }
        });
      }
    },
    mid: (g, w, h) => {
      g.fillStyle = "#231a12";
      g.fillRect(0, h * 0.6, w, h * 0.12);
      g.fillStyle = "#2f2419";
      g.fillRect(0, h * 0.58, w, 5);
      g.fillStyle = "#18120c";
      for (let x = 20; x < w; x += 96) {
        g.fillRect(x, h * 0.52, 10, h * 0.08);
        g.fillRect(x - 6, h * 0.5, 22, 5);
      }
    },
    near: (g, w, h) => {
      g.fillStyle = "#0e0a07";
      for (let x = 0; x < w; x += 44) {
        wrapped(w, x, (px) => {
          g.beginPath();
          g.roundRect(px + 4, h - 34, 36, 34, 6);
          g.fill();
        });
      }
    },
  },
  // Act 4: the Capitol dome at night.
  capitol: {
    sky: ["#030712", "#0b1325", "#1e293b"],
    glow: "rgba(148, 163, 184, 0.16)",
    far: (g, w, h, rnd) => {
      g.fillStyle = "rgba(244, 244, 246, 0.8)";
      for (let i = 0; i < 70; i++) {
        g.fillRect(rnd() * w, rnd() * h * 0.5, 1.2, 1.2);
      }
      const cx = w * 0.62;
      const base = h * 0.7;
      // Moonlit dome with a cool rim so it reads against the night sky.
      const dome = g.createLinearGradient(0, base - 150, 0, base);
      dome.addColorStop(0, "#3b4a63");
      dome.addColorStop(1, "#1c2638");
      g.fillStyle = dome;
      g.fillRect(cx - 150, base - 46, 300, 46);
      g.fillRect(cx - 60, base - 70, 120, 24);
      g.beginPath();
      g.ellipse(cx, base - 70, 52, 58, 0, Math.PI, 0);
      g.fill();
      g.fillRect(cx - 5, base - 150, 10, 24);
      g.strokeStyle = "rgba(203, 213, 225, 0.35)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(cx, base - 70, 52, 58, 0, Math.PI, Math.PI * 1.6);
      g.stroke();
      g.fillStyle = "rgba(251, 191, 36, 0.55)";
      for (let x = cx - 138; x < cx + 138; x += 16) {
        g.fillRect(x, base - 36, 5, 9);
      }
    },
    mid: (g, w, h, rnd) => {
      const base = h * 0.76;
      g.fillStyle = "#0d1522";
      let x = 0;
      while (x < w) {
        const bw = 22 + rnd() * 40;
        const bh = 20 + rnd() * 60;
        g.fillRect(x, base - bh, bw, bh);
        g.fillStyle = "rgba(251, 191, 36, 0.35)";
        for (let wy = base - bh + 6; wy < base - 4; wy += 9) {
          if (rnd() > 0.55) g.fillRect(x + 5, wy, 3, 4);
        }
        g.fillStyle = "#0d1522";
        x += bw + 3;
      }
      g.fillRect(0, base, w, h - base);
    },
    near: (g, w, h) => {
      g.fillStyle = "#cbd5e1";
      g.beginPath();
      g.moveTo(0, h);
      for (let x = 0; x <= w; x += 16) {
        g.lineTo(x, h - 14 - Math.sin((x / w) * Math.PI * 4) * 5);
      }
      g.lineTo(w, h);
      g.closePath();
      g.fill();
    },
  },
};

interface BackdropCache {
  key: string;
  sky: HTMLCanvasElement;
  layers: HTMLCanvasElement[];
}

let cache: BackdropCache | null = null;

function makeLayer(
  w: number,
  h: number,
  scale: number,
  paint: (g: Ctx) => void
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.scale(scale, scale);
  paint(g);
  return canvas;
}

function getBackdrop(
  theme: BackdropTheme,
  w: number,
  h: number,
  scale: number
): BackdropCache | null {
  const key = `${theme}:${w}x${h}@${scale}`;
  if (cache?.key === key) return cache;
  const spec = THEMES[theme];
  const sky = makeLayer(w, h, scale, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, spec.sky[0]);
    grad.addColorStop(0.55, spec.sky[1]);
    grad.addColorStop(1, spec.sky[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const glow = g.createRadialGradient(
      w * 0.5,
      h * 0.62,
      10,
      w * 0.5,
      h * 0.62,
      w * 0.6
    );
    glow.addColorStop(0, spec.glow);
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, w, h);
  });
  if (!sky) return null;
  const painters = [spec.far, spec.mid, spec.near];
  const layers: HTMLCanvasElement[] = [];
  for (let i = 0; i < painters.length; i++) {
    const rnd = mulberry32(1597 + i * 101 + theme.length * 7);
    const layer = makeLayer(w, h, scale, (g) => painters[i](g, w, h, rnd));
    if (!layer) return null;
    layers.push(layer);
  }
  cache = { key, sky, layers };
  return cache;
}

/**
 * Paints the act's sky and three parallax layers. `timeMs` drives the
 * scroll; pass `animate: false` to hold every layer still.
 */
export function drawActBackdrop(
  ctx: Ctx,
  theme: BackdropTheme,
  width: number,
  height: number,
  timeMs: number,
  options: { scale?: number; animate?: boolean } = {}
): void {
  const scale = options.scale ?? 1;
  const backdrop = getBackdrop(theme, width, height, scale);
  if (!backdrop) {
    ctx.fillStyle = THEMES[theme].sky[1];
    ctx.fillRect(0, 0, width, height);
    return;
  }
  ctx.drawImage(backdrop.sky, 0, 0, width, height);
  backdrop.layers.forEach((layer, i) => {
    const offset = options.animate
      ? -(((timeMs / 1000) * LAYER_SPEEDS[i]) % width)
      : 0;
    ctx.drawImage(layer, offset, 0, width, height);
    if (offset !== 0) ctx.drawImage(layer, offset + width, 0, width, height);
  });
}

/**
 * Draws the loon in its own coordinate space: facing right, body centred on
 * the origin, eye at (30, -10), which is where the laser leaves from.
 */
export function drawLoon(ctx: Ctx, eyeColor: string): void {
  // Wake on the water.
  ctx.fillStyle = "rgba(148, 197, 222, 0.14)";
  ctx.beginPath();
  ctx.ellipse(-14, 24, 40, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // White underside, then the black back over it.
  ctx.fillStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.ellipse(0, 14, 36, 13, -0.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-40, 12);
  ctx.quadraticCurveTo(-30, -6, 4, -4);
  ctx.quadraticCurveTo(26, -2, 30, 10);
  ctx.quadraticCurveTo(10, 20, -40, 12);
  ctx.closePath();
  ctx.fillStyle = "#0b0f14";
  ctx.fill();
  ctx.clip();
  // The checkered mantle: rows of small white squares.
  ctx.fillStyle = "rgba(244, 244, 246, 0.85)";
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 10; col++) {
      const x = -32 + col * 6 + (row % 2) * 3;
      ctx.fillRect(x, -2 + row * 4, 2.2, 2.2);
    }
  }
  ctx.restore();

  // Neck and head, with a faint green sheen.
  ctx.fillStyle = "#05080b";
  ctx.beginPath();
  ctx.moveTo(14, 6);
  ctx.quadraticCurveTo(16, -10, 22, -16);
  ctx.quadraticCurveTo(30, -24, 38, -14);
  ctx.quadraticCurveTo(40, -6, 30, -2);
  ctx.quadraticCurveTo(26, 4, 26, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(16, 185, 129, 0.18)";
  ctx.beginPath();
  ctx.ellipse(28, -14, 6, 4, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Striped white necklace.
  ctx.strokeStyle = "rgba(244, 244, 246, 0.9)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(19 + i * 1.8, -4 + i * 0.4);
    ctx.lineTo(20 + i * 1.8, 2 + i * 0.4);
    ctx.stroke();
  }

  // Dagger bill.
  ctx.fillStyle = "#1f2937";
  ctx.beginPath();
  ctx.moveTo(36, -14);
  ctx.lineTo(58, -10);
  ctx.lineTo(36, -7);
  ctx.closePath();
  ctx.fill();

  // Red eye, lit by the active laser.
  ctx.save();
  ctx.fillStyle = eyeColor;
  ctx.shadowColor = eyeColor;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(30, -10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(31, -11, 1.4, 0, Math.PI * 2);
  ctx.fill();
}

type Painter = (ctx: Ctx, r: number, color: string, phase: number) => void;

function wingPair(ctx: Ctx, r: number, phase: number) {
  const flap = Math.sin(phase * 3) * 0.35;
  ctx.fillStyle = "rgba(203, 213, 225, 0.35)";
  ctx.strokeStyle = "rgba(226, 232, 240, 0.6)";
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.rotate(side * (0.6 + flap));
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.55, r * 0.22, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

function mosquito(ctx: Ctx, r: number, color: string, phase: number) {
  wingPair(ctx, r, phase);
  ctx.strokeStyle = "#1f2937";
  ctx.lineWidth = 1.2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.2, r * 0.1);
    ctx.lineTo(i * r * 0.5, r * 0.8);
    ctx.stroke();
  }
  ctx.fillStyle = "#27272a";
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, 0, r * 0.55, r * 0.22, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(r * 0.45, -r * 0.05, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#52525b";
  ctx.beginPath();
  ctx.moveTo(r * 0.6, 0);
  ctx.lineTo(r * 1.1, r * 0.15);
  ctx.stroke();
}

function hail(ctx: Ctx, r: number) {
  ctx.fillStyle = "#475569";
  for (const [x, y, s] of [
    [-0.4, 0, 0.45],
    [0.1, -0.2, 0.55],
    [0.5, 0.05, 0.4],
  ]) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, s * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#e0f2fe";
  for (const [x, y] of [
    [-0.4, 0.6],
    [0.1, 0.8],
    [0.5, 0.55],
  ]) {
    ctx.beginPath();
    ctx.arc(x * r, y * r, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
}

function jetski(ctx: Ctx, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.2);
  ctx.lineTo(r, r * 0.35);
  ctx.lineTo(r * 0.7, r * 0.6);
  ctx.lineTo(-r * 0.9, r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#18181b";
  ctx.fillRect(-r * 0.3, -r * 0.1, r * 0.5, r * 0.3);
  ctx.beginPath();
  ctx.arc(-r * 0.1, -r * 0.4, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(186, 230, 253, 0.6)";
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.5);
  ctx.lineTo(-r * 1.5, r * 0.1);
  ctx.lineTo(-r * 1.3, r * 0.6);
  ctx.closePath();
  ctx.fill();
}

function butterBlock(ctx: Ctx, r: number) {
  ctx.fillStyle = "#fde68a";
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-r * 0.8, -r * 0.5, r * 1.6, r, r * 0.15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.fillRect(-r * 0.7, -r * 0.4, r * 1.4, r * 0.15);
}

function butterBomb(ctx: Ctx, r: number) {
  butterBlock(ctx, r);
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r * 0.5, -r * 0.5);
  ctx.quadraticCurveTo(r * 0.7, -r, r * 0.95, -r * 0.85);
  ctx.stroke();
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.arc(r * 0.95, -r * 0.85, r * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

function prontoPup(ctx: Ctx, r: number) {
  ctx.strokeStyle = "#d6d3d1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.3);
  ctx.lineTo(0, r * 1.05);
  ctx.stroke();
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.2, r * 0.35, r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#facc15";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.15, -r * 0.6);
  for (let i = 0; i < 4; i++) {
    ctx.lineTo(i % 2 ? -r * 0.15 : r * 0.15, -r * 0.4 + i * r * 0.22);
  }
  ctx.stroke();
}

function livestock(ctx: Ctx, r: number) {
  ctx.fillStyle = "#e7e5e4";
  ctx.beginPath();
  ctx.roundRect(-r * 0.8, -r * 0.35, r * 1.3, r * 0.7, r * 0.25);
  ctx.fill();
  ctx.fillRect(r * 0.4, -r * 0.55, r * 0.45, r * 0.45);
  ctx.fillStyle = "#1c1917";
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.05, r * 0.2, 0, Math.PI * 2);
  ctx.arc(r * 0.15, r * 0.1, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
  for (const x of [-0.65, -0.35, 0.1, 0.35]) {
    ctx.fillRect(x * r, r * 0.3, r * 0.12, r * 0.45);
  }
  // Plywood stand: it's a decoy.
  ctx.fillStyle = "#78716c";
  ctx.fillRect(-r * 0.9, r * 0.75, r * 1.8, r * 0.12);
}

function redTape(ctx: Ctx, r: number, color: string, phase: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.28;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (let i = 0; i <= 10; i++) {
    const x = -r + (i / 10) * r * 2;
    const y = Math.sin(i * 0.9 + phase) * r * 0.45;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.lineCap = "butt";
}

function vetoStamp(ctx: Ctx, r: number, color: string) {
  ctx.fillStyle = "#44403c";
  ctx.beginPath();
  ctx.arc(0, -r * 0.65, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-r * 0.12, -r * 0.45, r * 0.24, r * 0.5);
  ctx.fillStyle = "#292524";
  ctx.fillRect(-r * 0.75, 0, r * 1.5, r * 0.35);
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.8, r * 0.35, r * 1.6, r * 0.25);
}

function tricolorFlag(ctx: Ctx, r: number, _c: string, phase: number) {
  ctx.fillStyle = "#a8a29e";
  ctx.fillRect(-r * 0.8, -r, r * 0.08, r * 2);
  const colors = ["#2563eb", "#f4f4f6", "#16a34a"];
  const w = (r * 1.5) / 3;
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    const wave = Math.sin(phase * 2 + i) * r * 0.06;
    ctx.fillRect(-r * 0.72 + i * w, -r + wave, w + 0.5, r);
  });
}

function clipboard(ctx: Ctx, r: number) {
  ctx.fillStyle = "#92400e";
  ctx.beginPath();
  ctx.roundRect(-r * 0.6, -r * 0.8, r * 1.2, r * 1.6, r * 0.1);
  ctx.fill();
  ctx.fillStyle = "#f4f4f6";
  ctx.fillRect(-r * 0.48, -r * 0.6, r * 0.96, r * 1.3);
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(-r * 0.25, -r * 0.92, r * 0.5, r * 0.22);
  ctx.fillStyle = "#64748b";
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(
      -r * 0.38,
      -r * 0.35 + i * r * 0.2,
      r * (0.76 - (i % 2) * 0.2),
      1.5
    );
  }
}

function amendment(ctx: Ctx, r: number, color: string) {
  ctx.fillStyle = "#f5f5f4";
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.8);
  ctx.lineTo(r * 0.35, -r * 0.8);
  ctx.lineTo(r * 0.6, -r * 0.55);
  ctx.lineTo(r * 0.6, r * 0.8);
  ctx.lineTo(-r * 0.6, r * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#a8a29e";
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(-r * 0.45, -r * 0.45 + i * r * 0.22, r * 0.8, 1.5);
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(r * 0.25, r * 0.5, r * 0.2, 0, Math.PI * 2);
  ctx.fill();
}

function star(ctx: Ctx, r: number, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
    else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
}

function seal(ctx: Ctx, r: number, color: string) {
  ctx.fillStyle = "#b45309";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = color;
  star(ctx, r * 0.45);
  ctx.fill();
}

function vortex(ctx: Ctx, r: number, color: string, phase: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const a = phase + arm * ((Math.PI * 2) / 3) + t * Math.PI * 2.2;
      const rad = r * (0.1 + t * 0.9);
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.stroke();
  }
  ctx.fillStyle = "#e0f2fe";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2);
  ctx.fill();
}

function butterColossus(ctx: Ctx, r: number) {
  butterBlock(ctx, r);
  ctx.fillStyle = "#78350f";
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.05, r * 0.08, 0, Math.PI * 2);
  ctx.arc(r * 0.3, -r * 0.05, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-r * 0.25, r * 0.2, r * 0.5, r * 0.06);
  // A crown of melt drips.
  ctx.fillStyle = "#fde68a";
  for (const x of [-0.5, -0.1, 0.35]) {
    ctx.beginPath();
    ctx.ellipse(x * r, r * 0.55, r * 0.07, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function starflake(ctx: Ctx, r: number, color: string, phase: number) {
  ctx.save();
  ctx.rotate(phase * 0.3);
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(-r * 0.2, -r * 0.75);
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(r * 0.2, -r * 0.75);
    ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = color;
  star(ctx, r * 0.35, 4, 0.4);
  ctx.fill();
  ctx.restore();
}

function gavel(ctx: Ctx, r: number, color: string) {
  ctx.save();
  ctx.rotate(-0.5);
  ctx.fillStyle = "#78350f";
  ctx.fillRect(-r * 0.08, -r * 0.1, r * 0.16, r * 1.05);
  ctx.fillStyle = "#451a03";
  ctx.beginPath();
  ctx.roundRect(-r * 0.7, -r * 0.55, r * 1.4, r * 0.5, r * 0.1);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.72, -r * 0.5, r * 0.12, r * 0.4);
  ctx.fillRect(r * 0.6, -r * 0.5, r * 0.12, r * 0.4);
  ctx.restore();
}

const PAINTERS: Record<CivicEnemyType, Painter> = {
  mosquito,
  hailstorm: hail,
  jetski,
  "butter-bomb": butterBomb,
  "pronto-pup-rogue": prontoPup,
  "livestock-decoy": livestock,
  "red-tape": redTape,
  "veto-stamp": vetoStamp,
  "tricolor-rival": tricolorFlag,
  clipboard,
  "legislative-amendment": amendment,
  "seal-guardian": seal,
  "polar-vortex": vortex,
  "mega-mosquito": mosquito,
  "butter-colossus": butterColossus,
  "starflake-boss": starflake,
  "gavel-sovereign": gavel,
};

/** Enemy types that have a drawn silhouette (all of them). */
export const ENEMY_SILHOUETTE_TYPES = Object.keys(PAINTERS) as CivicEnemyType[];

/**
 * Draws a target's silhouette centred on its position, sized to its hit
 * radius so the art matches the hitbox. A frozen target is drawn in ice.
 */
export function drawEnemySilhouette(ctx: Ctx, target: Target): void {
  const paint = PAINTERS[target.type] ?? PAINTERS.mosquito;
  ctx.save();
  ctx.translate(target.x, target.y);
  // A soft contact shadow keeps shapes readable on busy backdrops.
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 6;
  paint(ctx, target.radius, target.color, target.pulsePhase);
  ctx.restore();
  if (target.frozenTimer > 0) {
    ctx.save();
    ctx.fillStyle = "rgba(186, 230, 253, 0.45)";
    ctx.beginPath();
    ctx.arc(target.x, target.y, target.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
