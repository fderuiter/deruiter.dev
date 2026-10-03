import { buildGameFont, clamp, resolveGameFontFamily } from "@/lib/game-utils";
import {
  drawOutfitAvatar,
  isSubjectFullyCompliant,
  type AuditorState,
  type CDISCDomain,
  type ClinicalSubject,
  type OfficeId,
  type OutfitConfig,
} from "@/lib/clinical-trial-chaos";
import {
  AUDITOR_SCALE,
  FOLDER_FX_MS,
  getAuditorX,
  getChuteSlots,
  getConveyorGeometry,
  getFolderFxPose,
  getFolderTabs,
  getOfficeFloorStyle,
  getSightCone,
  getSlotX,
  getVisibleSubjects,
  isFolderInCone,
  type ConveyorGeometry,
  type FolderFx,
  type FolderTab,
  type OfficeFloorStyle,
} from "./floor-scene";

export { getConveyorGeometry, getVisibleSubjects };

/** The game's identity hue (plan section 2.1): its world, never a signal. */
const CLINICAL_BLUE = "#60a5fa";
const AMBER = "#f59e0b";
const EMERALD = "#10b981";
const RED = "#ef4444";
const STAMP_RED = "#dc2626";
const MANILA = "#e4d1a0";
const MANILA_EDGE = "#a8894f";
const MANILA_BACK = "#c7ad74";
const INK = "#2b2418";

/** Mutable, per-canvas animation state the component keeps in a ref. */
export interface FloorAnimState {
  /** Drawn left edge of each folder, eased toward its slot. */
  folderX: Map<string, number>;
  lastDrawAt: number;
  fx: FolderFx[];
  chuteFlash: { domain: CDISCDomain; until: number; tone: "good" | "bad" }[];
  /**
   * Pre-rendered static art (wall, catwalk, floor, chutes, the player), one
   * bitmap per layer, rebuilt only when what it shows changes. Redrawing it
   * every frame cost far more than the moving parts.
   */
  layers: Map<string, { key: string; canvas: HTMLCanvasElement }>;
}

export function createFloorAnimState(): FloorAnimState {
  return {
    folderX: new Map(),
    lastDrawAt: 0,
    fx: [],
    chuteFlash: [],
    layers: new Map(),
  };
}

/** What the floor frame shows beyond the simulation state. */
interface ConveyorDrawOptions {
  selectedSubjectId: string | null;
  officeId: OfficeId;
  floorColor: string;
  outfit: OutfitConfig;
  /** Open stations in hotkey order; one chute each. */
  stations: readonly { id: CDISCDomain; color: string }[];
  /** Chutes that accept the active, clean folder. */
  acceptingDomains: readonly CDISCDomain[];
  /** Belt travel, in logical pixels; it only advances while clocks run. */
  beltOffset: number;
  now: number;
  /**
   * Reduced motion, a small screen or a still frame drawn while the shift is
   * stopped: folders snap to their slots and nothing flies.
   */
  calm: boolean;
  anim: FloorAnimState;
  /** Device pixels per logical pixel, so cached layers stay sharp. */
  pixelRatio?: number;
}

// The page's Geist Mono family, read once and then reused. While the
// variable is unset (before fonts load, or in a test DOM) it is re-read at
// most once a second, never per text draw: each read is a style recalc.
let fontFamily = "";
let fontCheckedAt = -Infinity;

function refreshFontFamily(now: number): void {
  if (fontFamily || now - fontCheckedAt < 1000) return;
  fontCheckedAt = now;
  fontFamily = resolveGameFontFamily();
}

/** Geist Mono, as loaded by the page, so canvas and DOM type match. */
function monoFont(size: number, weight = 700): string {
  return buildGameFont(size, weight, fontFamily);
}

/**
 * Draws a static layer from its cached bitmap, painting it first when its
 * key (everything the layer depends on) has changed. Falls back to painting
 * straight onto the frame where no offscreen canvas can be made.
 */
function cachedLayer(
  anim: FloorAnimState,
  name: string,
  key: string,
  width: number,
  height: number,
  pixelRatio: number,
  paint: (layer: CanvasRenderingContext2D) => void
): HTMLCanvasElement | null {
  const entry = anim.layers.get(name);
  if (entry && entry.key === key) return entry.canvas;
  const canvas =
    typeof document !== "undefined" ? document.createElement("canvas") : null;
  const layer = canvas?.getContext("2d") ?? null;
  if (!canvas || !layer) return null;
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  layer.scale(pixelRatio, pixelRatio);
  paint(layer);
  anim.layers.set(name, { key, canvas });
  return canvas;
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  anim: FloorAnimState,
  name: string,
  key: string,
  width: number,
  height: number,
  pixelRatio: number,
  paint: (layer: CanvasRenderingContext2D) => void
): void {
  const canvas = cachedLayer(anim, name, key, width, height, pixelRatio, paint);
  if (canvas) ctx.drawImage(canvas, 0, 0, width, height);
  else paint(ctx);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

/** A tiny deterministic hash so decor is stable frame to frame. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------- office --

function drawWall(
  ctx: CanvasRenderingContext2D,
  width: number,
  g: ConveyorGeometry,
  style: OfficeFloorStyle
) {
  ctx.fillStyle = style.wallBase;
  ctx.fillRect(0, 0, width, g.floorY);

  switch (style.wall) {
    case "cubicle": {
      // Beige-grey cubicle partitions behind the belt, memos pinned on top.
      ctx.fillStyle = style.wallAlt;
      ctx.fillRect(0, 14, width, g.catwalkY - 14);
      for (let x = 6; x < width; x += 96) {
        ctx.fillStyle = "#24262d";
        ctx.fillRect(x, g.catwalkY + 14, 90, g.beltY - g.catwalkY - 14);
        ctx.fillStyle = style.trim;
        ctx.fillRect(x, g.catwalkY + 14, 90, 2);
        ctx.fillStyle = "rgba(203,213,225,0.16)";
        ctx.fillRect(x + 10 + hash(x) * 40, g.catwalkY + 22, 12, 9);
      }
      // Wall clock stuck at five to five.
      const cx = width * 0.5;
      ctx.strokeStyle = "#4b4f59";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, 36, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#a1a1aa";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, 36);
      ctx.lineTo(cx + 5, 39);
      ctx.moveTo(cx, 36);
      ctx.lineTo(cx - 1, 28);
      ctx.stroke();
      break;
    }
    case "cinder": {
      // Painted cinder block and the basement's exposed pipes.
      ctx.strokeStyle = style.trim;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1;
      for (let row = 0, y = 26; y < g.floorY; row++, y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
        for (let x = row % 2 ? 0 : 18; x < width; x += 36) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 14);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      for (const [y, h] of [
        [16, 5],
        [24, 3],
      ]) {
        ctx.fillStyle = "#2d3631";
        ctx.fillRect(0, y, width, h);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(0, y, width, 1);
      }
      for (let x = 60; x < width; x += 150) {
        ctx.fillStyle = "#3a453e";
        ctx.fillRect(x, 14, 6, 9);
      }
      break;
    }
    case "curtain": {
      // Glass curtain wall with a night skyline beyond.
      const glass = ctx.createLinearGradient(0, 0, 0, g.floorY);
      glass.addColorStop(0, "#0d1828");
      glass.addColorStop(1, style.wallAlt);
      ctx.fillStyle = glass;
      ctx.fillRect(0, 12, width, g.floorY - 12);
      for (let i = 0, x = 0; x < width; i++) {
        const w = 26 + hash(i) * 34;
        const h = 22 + hash(i + 40) * 50;
        ctx.fillStyle = "#091320";
        ctx.fillRect(x, g.catwalkY + 6 - h, w - 3, h + 40);
        ctx.fillStyle = "rgba(148,163,184,0.18)";
        for (let wy = g.catwalkY - h + 12; wy < g.catwalkY; wy += 8) {
          if (hash(i * 7 + wy) > 0.55) ctx.fillRect(x + 4, wy, 2, 2);
        }
        x += w;
      }
      ctx.fillStyle = style.trim;
      for (let x = 0; x < width; x += 76) ctx.fillRect(x, 12, 2, g.floorY);
      ctx.fillRect(0, g.catwalkY + 18, width, 2);
      break;
    }
    case "garage": {
      // Concrete wall, a pegboard and a corrugated roll-up door.
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      for (let x = 30; x < width * 0.5; x += 9) {
        for (let y = 26; y < g.catwalkY - 4; y += 9) ctx.fillRect(x, y, 2, 2);
      }
      const doorX = width * 0.56;
      ctx.fillStyle = style.wallAlt;
      ctx.fillRect(doorX, 14, width - doorX - 16, g.floorY - 14);
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let y = 18; y < g.floorY; y += 7) {
        ctx.fillRect(doorX, y, width - doorX - 16, 2);
      }
      ctx.fillStyle = style.trim;
      ctx.fillRect(doorX - 3, 12, 3, g.floorY - 12);
      ctx.fillRect(width - 16, 12, 3, g.floorY - 12);
      break;
    }
    case "home": {
      // A spare room: window, bookshelf and a framed print.
      const wx = width * 0.62;
      ctx.fillStyle = "#0e1422";
      ctx.fillRect(wx, 22, 92, 50);
      ctx.fillStyle = "#cbd5e1";
      ctx.beginPath();
      ctx.arc(wx + 70, 36, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = style.trim;
      ctx.fillRect(wx - 3, 19, 98, 3);
      ctx.fillRect(wx - 3, 72, 98, 4);
      ctx.fillRect(wx + 45, 22, 2, 50);
      const sx = width * 0.2;
      ctx.fillStyle = "#2b1f1a";
      ctx.fillRect(sx, 18, 110, 56);
      const spines = ["#5b4636", "#3f4a5c", "#6b5a45", "#4a3f52", "#5c6b5a"];
      for (let shelf = 0; shelf < 2; shelf++) {
        let x = sx + 4;
        for (let i = 0; x < sx + 104; i++) {
          const w = 5 + Math.round(hash(i + shelf * 13) * 5);
          const h = 18 + Math.round(hash(i * 3 + shelf) * 6);
          ctx.fillStyle = spines[(i + shelf) % spines.length];
          ctx.fillRect(x, 18 + 4 + shelf * 27 + (24 - h), w, h);
          x += w + 1;
        }
        ctx.fillStyle = style.trim;
        ctx.fillRect(sx, 46 + shelf * 27, 110, 2);
      }
      ctx.strokeStyle = style.trim;
      ctx.lineWidth = 2;
      ctx.strokeRect(width * 0.44, 26, 34, 26);
      break;
    }
  }

  // Ceiling and its fluorescent panels: static, never flickering.
  ctx.fillStyle = "#0a0b0e";
  ctx.fillRect(0, 0, width, 12);
  for (let x = width * 0.12; x < width; x += width * 0.26) {
    ctx.fillStyle = "rgba(226,232,240,0.55)";
    ctx.fillRect(x, 9, 54, 3);
    ctx.fillStyle = "rgba(96,165,250,0.05)";
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x + 54, 12);
    ctx.lineTo(x + 74, 44);
    ctx.lineTo(x - 20, 44);
    ctx.closePath();
    ctx.fill();
  }
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  g: ConveyorGeometry,
  style: OfficeFloorStyle
) {
  const top = g.floorY;
  const h = height - top;
  ctx.fillStyle = style.floorBase;
  ctx.fillRect(0, top, width, h);
  switch (style.floor) {
    case "carpet": {
      ctx.fillStyle = style.floorAlt;
      for (let x = 0, i = 0; x < width; x += 24, i++) {
        if (i % 2) ctx.fillRect(x, top, 24, h);
      }
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      for (let i = 0; i < width / 6; i++) {
        ctx.fillRect(hash(i) * width, top + 2 + hash(i + 99) * (h - 4), 1, 1);
      }
      break;
    }
    case "tile": {
      const s = 11;
      ctx.fillStyle = style.floorAlt;
      for (let x = 0, i = 0; x < width; x += s, i++) {
        for (let y = top, j = 0; y < height; y += s, j++) {
          if ((i + j) % 2) ctx.fillRect(x, y, s, s);
        }
      }
      break;
    }
    case "glass": {
      ctx.strokeStyle = "rgba(148,163,184,0.10)";
      ctx.lineWidth = 2;
      for (let x = -40; x < width; x += 70) {
        ctx.beginPath();
        ctx.moveTo(x, height);
        ctx.lineTo(x + 30, top);
        ctx.stroke();
      }
      break;
    }
    case "dock": {
      // Hazard stripes along the dock edge, in a muted ochre so they read
      // as paint rather than a signal.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, top, width, 6);
      ctx.clip();
      ctx.fillStyle = "#8a6a1c";
      for (let x = -12; x < width + 12; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, top + 6);
        ctx.lineTo(x + 8, top);
        ctx.lineTo(x + 16, top);
        ctx.lineTo(x + 8, top + 6);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      for (let x = 0; x < width; x += 96) ctx.fillRect(x, top + 6, 1, h);
      break;
    }
    case "wood": {
      ctx.fillStyle = style.floorAlt;
      for (let y = top, row = 0; y < height; y += 7, row++) {
        ctx.fillRect(0, y, width, 1);
        for (let x = (row % 3) * 40; x < width; x += 120) {
          ctx.fillRect(x, y, 1, 7);
        }
      }
      // A rug under the desk.
      ctx.fillStyle = "rgba(96,165,250,0.12)";
      ctx.fillRect(4, top + 2, g.beltLeft - 8, h - 4);
      break;
    }
  }
  ctx.fillStyle = style.trim;
  ctx.fillRect(0, top, width, 1);
}

// ------------------------------------------------------------- equipment --

function drawCatwalk(
  ctx: CanvasRenderingContext2D,
  width: number,
  g: ConveyorGeometry,
  part: "deck" | "rail"
) {
  const y = g.catwalkY;
  const left = width * 0.08;
  if (part === "deck") {
    ctx.fillStyle = "#1f232b";
    ctx.fillRect(left, y, width - left - 8, 5);
    ctx.fillStyle = "#2c313b";
    for (let x = left; x < width - 8; x += 6) ctx.fillRect(x, y + 1, 1, 3);
    ctx.fillStyle = "#15181d";
    for (let x = left + 20; x < width - 8; x += 110) {
      ctx.fillRect(x, y + 5, 3, 14);
    }
    return;
  }
  ctx.strokeStyle = "#3a404c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, y - 17);
  ctx.lineTo(width - 8, y - 17);
  ctx.moveTo(left, y - 8);
  ctx.lineTo(width - 8, y - 8);
  ctx.stroke();
  ctx.fillStyle = "#3a404c";
  for (let x = left; x < width - 8; x += 52) ctx.fillRect(x, y - 18, 2, 18);
}

/** The belt's static frame: legs, surface, rollers and the inbound hatch. */
function drawBeltBase(
  ctx: CanvasRenderingContext2D,
  width: number,
  g: ConveyorGeometry
) {
  const x0 = g.beltLeft - 4;
  const x1 = g.beltRight + 4;
  const frameTop = g.beltY + 5;

  // Legs down to the floor, behind the chutes.
  ctx.fillStyle = "#16181e";
  for (let x = x0 + 24; x < x1; x += 132) {
    ctx.fillRect(x, frameTop, 5, g.floorY - frameTop);
  }

  // Belt surface; its tread marks move, so they are drawn per frame.
  ctx.fillStyle = "#121419";
  ctx.fillRect(x0, g.beltY, x1 - x0, 5);

  // Frame with rollers.
  ctx.fillStyle = "#22262f";
  ctx.fillRect(x0, frameTop, x1 - x0, g.beltHeight - 5);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x0, frameTop, x1 - x0, 1);
  const { r, cy } = rollerMetrics(g);
  ctx.fillStyle = "#2f3440";
  for (let x = x0 + 12; x < x1 - 6; x += 26) {
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Inbound hatch on the right: new folders arrive from the sites.
  const hx = width - 12;
  ctx.fillStyle = "#07080a";
  ctx.fillRect(hx, g.subjectTop - 12, 12, g.beltY - g.subjectTop + 12);
  ctx.fillStyle = "#3a404c";
  ctx.fillRect(hx - 2, g.subjectTop - 14, 14, 3);
}

function rollerMetrics(g: ConveyorGeometry): { r: number; cy: number } {
  const frameTop = g.beltY + 5;
  return {
    r: Math.max(3, (g.beltHeight - 5) / 2 - 2),
    cy: frameTop + (g.beltHeight - 5) / 2,
  };
}

const TREAD_PITCH = 14;

/**
 * The moving part of the belt: tread marks travelling left toward the desk
 * (one cached strip, shifted) and a spoke on each roller turning with it.
 */
function drawBeltMotion(
  ctx: CanvasRenderingContext2D,
  g: ConveyorGeometry,
  beltOffset: number,
  anim: FloorAnimState,
  pixelRatio: number
) {
  const x0 = g.beltLeft - 4;
  const x1 = g.beltRight + 4;
  const span = x1 - x0 + TREAD_PITCH;
  const paintTreads = (layer: CanvasRenderingContext2D, dx: number) => {
    layer.fillStyle = "#262a33";
    for (let x = dx; x < dx + span; x += TREAD_PITCH) {
      layer.fillRect(x, 1, 6, 2);
    }
  };
  const shift = ((beltOffset % TREAD_PITCH) + TREAD_PITCH) % TREAD_PITCH;
  const strip = cachedLayer(
    anim,
    "treads",
    `${span}@${pixelRatio}`,
    span,
    5,
    pixelRatio,
    (layer) => paintTreads(layer, 0)
  );
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, g.beltY, x1 - x0, 5);
  ctx.clip();
  if (strip) {
    ctx.drawImage(strip, x0 - shift, g.beltY, span, 5);
  } else {
    ctx.translate(0, g.beltY);
    paintTreads(ctx, x0 - shift);
  }
  ctx.restore();

  const { r, cy } = rollerMetrics(g);
  const angle = -beltOffset / r;
  const dx = Math.cos(angle) * r;
  const dy = Math.sin(angle) * r;
  ctx.strokeStyle = "#4b5260";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = x0 + 12; x < x1 - 6; x += 26) {
    ctx.moveTo(x - dx, cy - dy);
    ctx.lineTo(x + dx, cy + dy);
  }
  ctx.stroke();
}

function drawChutes(
  ctx: CanvasRenderingContext2D,
  width: number,
  g: ConveyorGeometry,
  stations: readonly { id: CDISCDomain; color: string }[],
  accepting: readonly CDISCDomain[]
) {
  const slots = getChuteSlots(width, stations.length, g.beltLeft);
  slots.forEach((slot, i) => {
    const station = stations[i];
    const top = g.chuteTop;
    const half = slot.mouth / 2;
    const tube = slot.mouth * 0.42;

    // Pneumatic tube down into the floor, with a cool glass highlight.
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(slot.cx - tube / 2, top + 14, tube, g.floorY - top - 10);
    ctx.fillStyle = "rgba(96,165,250,0.22)";
    ctx.fillRect(slot.cx - tube / 2 + 3, top + 16, 2, g.floorY - top - 14);
    ctx.fillStyle = "#2a2e38";
    ctx.fillRect(slot.cx - tube / 2 - 2, g.floorY - 4, tube + 4, 4);

    // Funnel mouth.
    ctx.beginPath();
    ctx.moveTo(slot.cx - half, top);
    ctx.lineTo(slot.cx + half, top);
    ctx.lineTo(slot.cx + tube / 2, top + 15);
    ctx.lineTo(slot.cx - tube / 2, top + 15);
    ctx.closePath();
    ctx.fillStyle = "#23272f";
    ctx.fill();
    ctx.fillStyle = station.color;
    ctx.fillRect(slot.cx - half, top - 1, slot.mouth, 3);

    if (accepting.includes(station.id)) {
      ctx.strokeStyle = EMERALD;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(slot.cx - half - 2, top - 3);
      ctx.lineTo(slot.cx + half + 2, top - 3);
      ctx.lineTo(slot.cx + tube / 2 + 2, top + 16);
      ctx.lineTo(slot.cx - tube / 2 - 2, top + 16);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = EMERALD;
      ctx.beginPath();
      ctx.moveTo(slot.cx - 5, top - 11);
      ctx.lineTo(slot.cx + 5, top - 11);
      ctx.lineTo(slot.cx, top - 5);
      ctx.closePath();
      ctx.fill();
    }

    // Plate: hotkey and domain.
    const plateY = top + 22;
    roundRect(ctx, slot.cx - 17, plateY, 34, 15, 3);
    ctx.fillStyle = "#0d0e11";
    ctx.fill();
    ctx.strokeStyle = station.color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = "#f4f4f6";
    ctx.font = monoFont(9);
    ctx.textAlign = "center";
    ctx.fillText(`${i + 1} ${station.id}`, slot.cx, plateY + 11);
    ctx.textAlign = "left";
  });
}

/** A routed or rejected folder lights its chute mouth for a moment. */
function drawChuteFlashes(
  ctx: CanvasRenderingContext2D,
  width: number,
  g: ConveyorGeometry,
  stations: readonly { id: CDISCDomain; color: string }[],
  anim: FloorAnimState,
  now: number
) {
  if (anim.chuteFlash.length === 0) return;
  const slots = getChuteSlots(width, stations.length, g.beltLeft);
  slots.forEach((slot, i) => {
    const flash = anim.chuteFlash.find(
      (f) => f.domain === stations[i].id && f.until > now
    );
    if (!flash) return;
    const top = g.chuteTop;
    const half = slot.mouth / 2;
    const tube = slot.mouth * 0.42;
    ctx.beginPath();
    ctx.moveTo(slot.cx - half, top + 2);
    ctx.lineTo(slot.cx + half, top + 2);
    ctx.lineTo(slot.cx + tube / 2, top + 15);
    ctx.lineTo(slot.cx - tube / 2, top + 15);
    ctx.closePath();
    ctx.fillStyle =
      flash.tone === "good" ? "rgba(16,185,129,0.55)" : "rgba(239,68,68,0.55)";
    ctx.fill();
  });
}

// --------------------------------------------------------------- figures --

function drawAuditor(
  ctx: CanvasRenderingContext2D,
  width: number,
  g: ConveyorGeometry,
  auditor: AuditorState
) {
  const realX = getAuditorX(auditor, width);
  // Drawn in sprite units around the feet, then scaled up.
  ctx.save();
  ctx.translate(realX, g.catwalkY);
  ctx.scale(AUDITOR_SCALE, AUDITOR_SCALE);
  const ax = 0;
  const foot = 0;
  const dir = auditor.direction >= 0 ? 1 : -1;
  const onBreak = auditor.behavior === "coffee_break";
  const walking =
    auditor.behavior === "patrolling" || auditor.behavior === "suspicious";
  // The stride follows position, so the legs stop whenever the clocks do.
  const stride = walking ? Math.sin(realX / 6) * 4 : 0;

  ctx.strokeStyle = "#1e293b";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ax - 2, foot - 13);
  ctx.lineTo(ax - 2 + stride, foot - 1);
  ctx.moveTo(ax + 2, foot - 13);
  ctx.lineTo(ax + 2 - stride, foot - 1);
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "#0b0f17";
  ctx.fillRect(ax - 4 + stride + (dir > 0 ? 0 : -2), foot - 2, 6, 2);
  ctx.fillRect(ax - 0 - stride + (dir > 0 ? 0 : -2), foot - 2, 6, 2);

  // Trench coat.
  ctx.fillStyle = "#3b4658";
  ctx.beginPath();
  ctx.moveTo(ax - 6, foot - 32);
  ctx.lineTo(ax + 6, foot - 32);
  ctx.lineTo(ax + 8.5, foot - 11);
  ctx.lineTo(ax - 8.5, foot - 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2c3545";
  ctx.fillRect(ax - 7.5, foot - 21, 15, 2);
  // FDA badge on a lanyard, in the game's own blue.
  ctx.fillStyle = CLINICAL_BLUE;
  ctx.fillRect(ax + dir * 1 - 2, foot - 27, 4, 5);

  // Arm with clipboard, or the coffee.
  const handX = ax + dir * 9;
  if (onBreak) {
    ctx.fillStyle = "#f4f4f6";
    ctx.fillRect(handX - 3, foot - 26, 6, 7);
    ctx.strokeStyle = "#f4f4f6";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(handX + dir * 4, foot - 22.5, 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const raised = auditor.behavior === "inspecting" ? -4 : 0;
    ctx.fillStyle = MANILA;
    ctx.fillRect(handX - 4, foot - 29 + raised, 8, 11);
    ctx.fillStyle = "#64748b";
    ctx.fillRect(handX - 2, foot - 30 + raised, 4, 2);
    if (auditor.behavior === "issuing_483") {
      ctx.fillStyle = STAMP_RED;
      ctx.fillRect(handX - 3, foot - 26 + raised, 6, 5);
    }
  }

  // Head, hat and glasses facing the walk.
  ctx.fillStyle = "#d9b38c";
  ctx.beginPath();
  ctx.arc(ax, foot - 38, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(ax - 9, foot - 44, 18, 2);
  ctx.fillRect(ax - 5.5, foot - 50, 11, 6);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(ax + dir * 2 - (dir > 0 ? 0 : 4), foot - 39, 5, 1.5);

  ctx.restore();

  // Name pill, at true scale above the hat.
  const label = onBreak
    ? "FDA · ON BREAK"
    : `FDA · ${Math.round(auditor.suspicion)}%`;
  ctx.font = monoFont(9);
  const tw = ctx.measureText(label).width + 10;
  const px = clamp(realX - tw / 2, 4, width - tw - 4);
  const pillY = g.catwalkY - 52 * AUDITOR_SCALE - 15;
  roundRect(ctx, px, pillY, tw, 13, 3);
  ctx.fillStyle = "rgba(13,14,17,0.88)";
  ctx.fill();
  ctx.strokeStyle =
    auditor.behavior === "issuing_483"
      ? RED
      : auditor.behavior === "suspicious"
        ? AMBER
        : "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#f4f4f6";
  ctx.fillText(label, px + 5, pillY + 9.5);
}

function drawSightCone(
  ctx: CanvasRenderingContext2D,
  cone: NonNullable<ReturnType<typeof getSightCone>>
) {
  const grad = ctx.createLinearGradient(0, cone.apexY, 0, cone.baseY);
  const hex = cone.color;
  grad.addColorStop(0, withAlpha(hex, cone.alpha));
  grad.addColorStop(1, withAlpha(hex, cone.alpha * 0.25));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(cone.apexX, cone.apexY);
  ctx.lineTo(cone.farX, cone.baseY);
  ctx.lineTo(cone.nearX, cone.baseY);
  ctx.closePath();
  ctx.fill();
}

function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha.toFixed(3)})`;
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  g: ConveyorGeometry,
  outfit: OutfitConfig
) {
  const cx = g.beltLeft * 0.5;
  const foot = g.beltY + 44;
  // Platform and a standing desk at belt height.
  ctx.fillStyle = "#1c1f26";
  ctx.fillRect(4, foot, g.beltLeft - 8, g.floorY - foot);
  ctx.fillStyle = "#2c313b";
  ctx.fillRect(4, foot, g.beltLeft - 8, 2);
  drawOutfitAvatar(ctx, cx, foot, outfit, 1.5);
  ctx.fillStyle = "#3a404c";
  ctx.fillRect(cx + 10, g.beltY + 2, g.beltLeft - cx - 10, 4);
  ctx.fillStyle = "#2c313b";
  ctx.fillRect(g.beltLeft - 8, g.beltY + 6, 3, foot - g.beltY - 6);
  // Stamp pad on the desk.
  ctx.fillStyle = STAMP_RED;
  ctx.fillRect(g.beltLeft - 20, g.beltY - 1, 9, 3);

  ctx.font = monoFont(9);
  const label = "YOU";
  const tw = ctx.measureText(label).width + 10;
  roundRect(ctx, cx - tw / 2, foot - 88, tw, 13, 3);
  ctx.fillStyle = "rgba(13,14,17,0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#f4f4f6";
  ctx.textAlign = "center";
  ctx.fillText(label, cx, foot - 78.5);
  ctx.textAlign = "left";
}

// --------------------------------------------------------------- folders --

interface FolderLook {
  label: string;
  tabs: FolderTab[];
  flagged: number;
  isSAE: boolean;
  selected: boolean;
  /** 0..1 of the subject's clock left, or null to hide the fuse. */
  timeRatio: number | null;
  inCone: boolean;
  stamp: "REJECTED" | "EXPIRED" | null;
  compact: boolean;
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  text: string,
  size: number
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.2);
  ctx.font = monoFont(size, 800);
  const w = ctx.measureText(text).width + 12;
  const h = size + 8;
  ctx.globalAlpha *= 0.92;
  roundRect(ctx, -w / 2, -h / 2, w, h, 3);
  ctx.fillStyle = "rgba(254,226,226,0.35)";
  ctx.fill();
  ctx.strokeStyle = STAMP_RED;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = STAMP_RED;
  ctx.textAlign = "center";
  ctx.fillText(text, 0, size / 2 - 1);
  ctx.textAlign = "left";
  ctx.restore();
}

function drawFolder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  look: FolderLook
) {
  const lift = look.selected ? 5 : 0;
  const top = y - lift;

  // Shadow on the belt.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 1, w / 2, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Domain tabs behind the front cover.
  if (!look.compact || w > 70) {
    const tabW = clamp((w - 16) / 3 - 4, 18, 30);
    look.tabs.forEach((tab, i) => {
      const tx = x + 6 + i * (tabW + 3);
      roundRect(ctx, tx, top - 14, tabW, 16, 3);
      ctx.fillStyle = tab.color;
      ctx.fill();
      ctx.fillStyle = "#0d0e11";
      ctx.font = monoFont(9);
      ctx.textAlign = "center";
      ctx.fillText(tab.domain, tx + tabW / 2, top - 4.5);
      ctx.textAlign = "left";
    });
  }

  // Back cover and the sheets inside.
  ctx.fillStyle = MANILA_BACK;
  ctx.fillRect(x + 2, top - 1, w - 4, h);
  ctx.fillStyle = "#f3ecda";
  ctx.fillRect(x + 6, top - 3, w - 14, 5);

  // Front cover.
  roundRect(ctx, x, top + 2, w, h - 2, 3);
  ctx.fillStyle = MANILA;
  ctx.fill();
  ctx.strokeStyle = MANILA_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (look.isSAE) {
    ctx.fillStyle = STAMP_RED;
    ctx.fillRect(x, top + 2, 4, h - 2);
  }
  if (look.inCone) {
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x + 1, top + 3, w - 2, h - 4);
  }

  // Subject label.
  const labelSize = look.compact ? 10 : 11;
  ctx.fillStyle = INK;
  ctx.font = monoFont(labelSize);
  const labelX = x + (look.isSAE ? 9 : 7);
  // Status: flags to fix, or ready to route. On a short folder (tablet
  // widths) the pill shares the label row and the label keeps only the
  // subject number.
  const status = look.flagged > 0 ? `${look.flagged} FIX` : "READY";
  // Stacked needs the pill (12px) between the label row and the fuse.
  const stacked = h >= 41;
  ctx.font = monoFont(8.5);
  const pw = ctx.measureText(status).width + 8;
  ctx.font = monoFont(labelSize);
  const labelRoom = x + w - labelX - 4 - (stacked ? 0 : pw + 6);
  const label =
    ctx.measureText(look.label).width > labelRoom
      ? look.label.replace(/^[A-Z]+-/, "")
      : look.label;
  ctx.fillText(label, labelX, top + 17);

  const pillY = stacked ? Math.max(top + h - 25, top + 20) : top + 8;
  if (w > 64) {
    ctx.font = monoFont(8.5);
    roundRect(ctx, x + w - pw - 6, pillY, pw, 12, 3);
    ctx.fillStyle = look.flagged > 0 ? AMBER : EMERALD;
    ctx.fill();
    ctx.fillStyle = "#0d0e11";
    ctx.fillText(status, x + w - pw - 2, pillY + 9);
    if (look.isSAE && !look.compact && stacked) {
      ctx.fillStyle = STAMP_RED;
      ctx.font = monoFont(8.5, 800);
      ctx.fillText("SAE", x + 9, pillY + 9);
    }
  }

  // Clock fuse along the bottom edge.
  if (look.timeRatio !== null) {
    const fx = x + 6;
    const fw = w - 12;
    const fy = top + h - 9;
    ctx.fillStyle = "#c9b483";
    ctx.fillRect(fx, fy, fw, 4);
    ctx.fillStyle =
      look.timeRatio < 0.25 ? RED : look.timeRatio < 0.5 ? AMBER : "#475569";
    ctx.fillRect(fx, fy, fw * clamp(look.timeRatio, 0, 1), 4);
  }

  if (look.selected) {
    roundRect(ctx, x - 3, top - 1, w + 6, h + 4, 5);
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (look.stamp) {
    drawStamp(
      ctx,
      x + w / 2,
      top + h / 2 + 2,
      look.stamp,
      look.compact ? 9 : 11
    );
  }
}

function folderLookFor(
  subj: ClinicalSubject,
  stations: readonly { id: CDISCDomain; color: string }[],
  selected: boolean,
  inCone: boolean,
  compact: boolean,
  stamp: FolderLook["stamp"]
): FolderLook {
  return {
    label: subj.subjectLabel,
    tabs: getFolderTabs(subj, stations),
    flagged: subj.observations.filter((o) => !o.isResolved).length,
    isSAE: !!subj.isSAE,
    selected,
    timeRatio: subj.maxTime > 0 ? subj.timeRemaining / subj.maxTime : 0,
    inCone,
    stamp,
    compact,
  };
}

/** Builds the event record for a folder animation from a live subject. */
export function createFolderFx(
  kind: FolderFx["kind"],
  subj: ClinicalSubject,
  stations: readonly { id: CDISCDomain; color: string }[],
  fromX: number,
  toX: number,
  now: number,
  /** Reduced motion passes 0: no flight, only the stamp. */
  durationOverride?: number
): FolderFx {
  const duration =
    durationOverride !== undefined
      ? Math.max(1, durationOverride)
      : kind === "drop"
        ? FOLDER_FX_MS.drop
        : kind === "bounce"
          ? FOLDER_FX_MS.bounce
          : FOLDER_FX_MS.expire;
  return {
    kind,
    subjectId: subj.id,
    label: subj.subjectLabel,
    isSAE: !!subj.isSAE,
    clean: isSubjectFullyCompliant(subj),
    tabs: getFolderTabs(subj, stations),
    fromX,
    toX,
    startedAt: now,
    duration,
    stampUntil:
      kind === "bounce" ? now + duration + FOLDER_FX_MS.stampHold : now,
  };
}

// ----------------------------------------------------------------- frame --

/**
 * Draws one floor frame: the office, the auditor's catwalk and sight-cone,
 * the belt with its manila folders, the station chutes, the player's desk
 * and any folder events in flight. Compact canvases (phones) draw only the
 * belt and folders.
 */
export function drawConveyor(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  auditorState: AuditorState,
  subjects: ClinicalSubject[],
  opts: ConveyorDrawOptions
): void {
  const { anim, now, calm, stations, selectedSubjectId } = opts;
  refreshFontFamily(now);
  const g = getConveyorGeometry(width, height);
  const style = getOfficeFloorStyle(opts.officeId, opts.floorColor);
  const dt = anim.lastDrawAt > 0 ? (now - anim.lastDrawAt) / 1000 : 1;
  anim.lastDrawAt = now;
  anim.fx = anim.fx.filter(
    (fx) => !getFolderFxPose(fx, now, g, g.folderWidth).done
  );
  anim.chuteFlash = anim.chuteFlash.filter((f) => f.until > now);

  ctx.clearRect(0, 0, width, height);

  const cone = getSightCone(auditorState, g, width);
  if (g.compact) {
    ctx.fillStyle = style.wallBase;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(20, g.beltY, width - 40, g.beltHeight);
    ctx.strokeStyle = "#2c313b";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, g.beltY, width - 40, g.beltHeight);
    ctx.fillStyle = "#f4f4f6";
    ctx.font = monoFont(11);
    ctx.fillText(`FDA ${Math.round(auditorState.suspicion)}%`, 20, 20);
    ctx.textAlign = "right";
    ctx.fillText(`QUEUE ${subjects.length}/5`, width - 24, 20);
    ctx.textAlign = "left";
  } else {
    const ratio = opts.pixelRatio ?? 1;
    const size = `${width}x${height}@${ratio}`;
    const office = `${size}|${opts.officeId}|${opts.floorColor}|${fontFamily}`;
    drawLayer(ctx, anim, "back", office, width, height, ratio, (layer) => {
      drawWall(layer, width, g, style);
      drawCatwalk(layer, width, g, "deck");
    });
    if (cone) drawSightCone(ctx, cone);
    drawAuditor(ctx, width, g, auditorState);
    drawLayer(ctx, anim, "front", office, width, height, ratio, (layer) => {
      drawCatwalk(layer, width, g, "rail");
      drawFloor(layer, width, height, g, style);
    });
    drawLayer(ctx, anim, "belt", size, width, height, ratio, (layer) =>
      drawBeltBase(layer, width, g)
    );
    drawBeltMotion(ctx, g, opts.beltOffset, anim, ratio);
    const chuteKey = `${size}|${fontFamily}|${stations
      .map((s) => `${s.id}${s.color}`)
      .join(",")}|${opts.acceptingDomains.join(",")}`;
    drawLayer(ctx, anim, "chutes", chuteKey, width, height, ratio, (layer) =>
      drawChutes(layer, width, g, stations, opts.acceptingDomains)
    );
    drawChuteFlashes(ctx, width, g, stations, anim, now);
    drawLayer(
      ctx,
      anim,
      "player",
      `${size}|${opts.outfit.id}|${fontFamily}`,
      width,
      height,
      ratio,
      (layer) => drawPlayer(layer, g, opts.outfit)
    );
  }

  // Folders resting on the belt. Each eases toward its slot so the belt
  // visibly closes a gap; new folders roll in from the inbound hatch.
  const animating = new Map(anim.fx.map((fx) => [fx.subjectId, fx]));
  const visible = getVisibleSubjects(
    subjects,
    selectedSubjectId,
    g.visibleSlots
  );
  const live = new Set(visible.map((s) => s.id));
  for (const id of anim.folderX.keys()) {
    if (!live.has(id)) anim.folderX.delete(id);
  }
  visible.forEach((subj, idx) => {
    const target = getSlotX(g, idx);
    const prev = anim.folderX.get(subj.id);
    const x =
      calm || g.compact || dt >= 1
        ? target
        : prev === undefined
          ? width + 4
          : prev + (target - prev) * clamp(dt * 9, 0, 1);
    anim.folderX.set(subj.id, Math.abs(x - target) < 0.5 ? target : x);

    const fx = animating.get(subj.id);
    if (fx) {
      const pose = getFolderFxPose(fx, now, g, g.folderWidth);
      if (!pose.settled) return; // drawn in flight below
      const look = folderLookFor(
        subj,
        stations,
        subj.id === selectedSubjectId,
        false,
        g.compact,
        pose.stamp ? "REJECTED" : null
      );
      drawFolder(ctx, x, g.subjectTop, g.folderWidth, g.subjectHeight, look);
      return;
    }
    const inCone = isFolderInCone(cone, x, x + g.folderWidth);
    drawFolder(
      ctx,
      x,
      g.subjectTop,
      g.folderWidth,
      g.subjectHeight,
      folderLookFor(
        subj,
        stations,
        subj.id === selectedSubjectId,
        inCone,
        g.compact,
        null
      )
    );
  });

  // Folders in flight: drops into chutes, bounces back, expiries.
  for (const fx of anim.fx) {
    const pose = getFolderFxPose(fx, now, g, g.folderWidth);
    // A still frame (shift stopped) or reduced motion shows no flights.
    if (pose.settled || calm) continue;
    ctx.save();
    ctx.globalAlpha = pose.alpha;
    const cx = pose.x + g.folderWidth / 2;
    const cy = pose.y + g.subjectHeight / 2;
    ctx.translate(cx, cy);
    ctx.scale(pose.scale, pose.scale);
    ctx.translate(-cx, -cy);
    drawFolder(ctx, pose.x, pose.y, g.folderWidth, g.subjectHeight, {
      label: fx.label,
      tabs: fx.tabs,
      flagged: fx.clean ? 0 : 1,
      isSAE: fx.isSAE,
      selected: false,
      timeRatio: null,
      inCone: false,
      stamp: pose.stamp
        ? fx.kind === "expire"
          ? "EXPIRED"
          : "REJECTED"
        : null,
      compact: g.compact,
    });
    ctx.restore();
  }
}
