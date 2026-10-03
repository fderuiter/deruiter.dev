/**
 * Retro Labyrinth presentation rules (epic #1522): the pixel grid, integer
 * scaling, the tile palette, sprite choice, the floor route and the room
 * plates. Everything here is pure, so it is unit tested without a canvas;
 * `labyrinth-atlas.ts` turns these rules into pixels.
 *
 * Nothing here changes a game rule. The maze, entities and FOV come from
 * `@/lib/dungeon` unchanged; this module only decides how they look.
 */

import { clamp } from "@/lib/game-utils";
import type {
  CRTThemeConfig,
  EnemyState,
  EnemyType,
  ItemId,
} from "@/lib/dungeon";

/** Logical size of one tile, in art pixels. */
export const TILE = 16;
/** Columns and rows of every Retro Labyrinth room. */
export const GRID_COLS = 15;
export const GRID_ROWS = 9;
/** The logical canvas: one art pixel per unit. */
export const LOGICAL_WIDTH = GRID_COLS * TILE;
export const LOGICAL_HEIGHT = GRID_ROWS * TILE;

/** Site surface and signal colours (AGENTS.md section 20). */
export const LABYRINTH_INK = {
  stage: "#0d0e11",
  panel: "#13151a",
  raised: "#1a1d24",
  hairline: "rgba(255, 255, 255, 0.08)",
  text: "#f4f4f6",
  muted: "#a1a1aa",
  amber: "#f59e0b",
  emerald: "#10b981",
  red: "#ef4444",
  steel: "#94a3b8",
  ice: "#7dd3fc",
} as const;

/** How the canvas is sized so each art pixel is a whole number of device pixels. */
export interface IntegerCanvasSize {
  /** Device pixels per art pixel. Always a whole number of at least 1. */
  scale: number;
  /** Backing store size, in device pixels. */
  backingWidth: number;
  backingHeight: number;
  /** Size the canvas element is displayed at, in CSS pixels. */
  cssWidth: number;
  cssHeight: number;
}

/**
 * Picks the largest whole-number scale at which the logical canvas fits the
 * available CSS box on a display with the given device pixel ratio. Scaling
 * by a whole number of device pixels is what keeps nearest-neighbour
 * sampling free of uneven pixels and blur. A box too small for 1x still gets
 * 1x, shown shrunk, rather than nothing.
 */
export function computeIntegerCanvasSize(
  availableCssWidth: number,
  availableCssHeight: number,
  devicePixelRatio: number,
  logicalWidth: number = LOGICAL_WIDTH,
  logicalHeight: number = LOGICAL_HEIGHT
): IntegerCanvasSize {
  const dpr =
    Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
      ? devicePixelRatio
      : 1;
  const w = Number.isFinite(availableCssWidth) ? availableCssWidth : 0;
  const h = Number.isFinite(availableCssHeight) ? availableCssHeight : 0;
  const fit = Math.min((w * dpr) / logicalWidth, (h * dpr) / logicalHeight);
  // A hair of tolerance so a box that is exactly 3x does not round to 2x.
  const scale = Math.max(1, Math.floor(fit + 1e-6));
  const backingWidth = logicalWidth * scale;
  const backingHeight = logicalHeight * scale;
  const fits = fit >= 1;
  return {
    scale,
    backingWidth,
    backingHeight,
    cssWidth: fits ? backingWidth / dpr : w,
    cssHeight: fits ? backingHeight / dpr : (w * logicalHeight) / logicalWidth,
  };
}

/** Bits of {@link wallEdgeMask}: which sides of a wall face open floor. */
export const EDGE_N = 1;
export const EDGE_E = 2;
export const EDGE_S = 4;
export const EDGE_W = 8;

/** True for the solid wall tile; moving airgap walls are drawn separately. */
function isSolidWall(cell: string | undefined): boolean {
  return cell === "#";
}

/**
 * Which sides of the wall at (x, y) face a non-wall tile. The atlas holds a
 * wall variant per mask, so a wall gets an edge highlight only where it
 * meets floor, and a darker front face only where floor lies below it.
 * Off-grid neighbours count as wall, so the outer ring has no rim.
 */
export function wallEdgeMask(maze: string[][], x: number, y: number): number {
  const open = (nx: number, ny: number) => {
    const row = maze[ny];
    if (!row || nx < 0 || nx >= row.length) return false;
    return !isSolidWall(row[nx]);
  };
  let mask = 0;
  if (open(x, y - 1)) mask |= EDGE_N;
  if (open(x + 1, y)) mask |= EDGE_E;
  if (open(x, y + 1)) mask |= EDGE_S;
  if (open(x - 1, y)) mask |= EDGE_W;
  return mask;
}

/** Number of floor variants in the atlas. */
export const FLOOR_VARIANTS = 3;

/**
 * A stable floor variant for a tile, so the floor has texture without
 * flickering between frames or repeating in an obvious stripe.
 */
export function floorVariant(x: number, y: number): number {
  const h = Math.imul(x * 73856093, 1) ^ Math.imul(y * 19349663, 1);
  const mixed = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return ((mixed ^ (mixed >>> 15)) >>> 0) % FLOOR_VARIANTS;
}

/** Linear mix of two #rrggbb colours: `amount` 0 is `a`, 1 is `b`. */
export function mixHex(a: string, b: string, amount: number): string {
  const parse = (hex: string) => {
    const clean = hex.replace("#", "");
    const full =
      clean.length === 3
        ? clean
            .split("")
            .map((c) => c + c)
            .join("")
        : clean.padEnd(6, "0").slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);
  };
  const t = clamp(amount, 0, 1);
  const ca = parse(a);
  const cb = parse(b);
  const out = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Colours the atlas paints with for one phosphor theme. */
export interface TilePalette {
  floor: string;
  floorAlt: string;
  floorSeam: string;
  floorSpeck: string;
  wallTop: string;
  wallFace: string;
  wallLine: string;
  wallRim: string;
  exitOpen: string;
  exitLocked: string;
  terminal: string;
  terminalScreen: string;
  chest: string;
  airgap: string;
  airgapDark: string;
}

/**
 * The tile palette for a phosphor theme. Floor is neutral graphite and walls
 * are lit in the theme hue, so walls stand well clear of the floor whatever
 * the theme (the audit found emerald walls on a dark green floor).
 */
export function tilePaletteFor(theme: CRTThemeConfig): TilePalette {
  const hue = theme.primaryColor;
  return {
    floor: LABYRINTH_INK.stage,
    floorAlt: "#101216",
    floorSeam: "#16191f",
    floorSpeck: mixHex(LABYRINTH_INK.stage, hue, 0.28),
    wallTop: mixHex(LABYRINTH_INK.stage, hue, 0.3),
    wallFace: mixHex(LABYRINTH_INK.stage, hue, 0.14),
    wallLine: mixHex(LABYRINTH_INK.stage, hue, 0.2),
    wallRim: hue,
    exitOpen: hue,
    exitLocked: LABYRINTH_INK.red,
    terminal: LABYRINTH_INK.steel,
    terminalScreen: LABYRINTH_INK.amber,
    chest: LABYRINTH_INK.amber,
    airgap: LABYRINTH_INK.steel,
    airgapDark: LABYRINTH_INK.panel,
  };
}

/** Sprite names the atlas draws. */
export type LabyrinthSpriteName =
  | "player"
  | "bug"
  | "drone"
  | "slime"
  | "daemon"
  | "coin"
  | "mug"
  | "box"
  | "shield"
  | "gem"
  | "key"
  | "bomb"
  | "chip"
  | "plug"
  | "skull"
  | "disk"
  | "node";

/** The sprite an enemy type is drawn with. */
export function enemySprite(type: EnemyType): LabyrinthSpriteName {
  switch (type) {
    case "drone":
      return "drone";
    case "slime":
      return "slime";
    case "sentinel_daemon":
    case "kerberos_warden":
    case "kernel_titan":
    case "neural_warden":
      return "daemon";
    default:
      return "bug";
  }
}

/**
 * An enemy's colour says what it is doing, using the shared signals: red
 * when it hunts the player, amber while it patrols, ice while frozen or
 * stunned and steel while confused.
 */
export function enemyTint(state: EnemyState): string {
  switch (state) {
    case "chase":
    case "attack":
      return LABYRINTH_INK.red;
    case "frozen":
    case "stunned":
      return LABYRINTH_INK.ice;
    case "confused":
      return LABYRINTH_INK.steel;
    default:
      return LABYRINTH_INK.amber;
  }
}

/** The sprite and tint a pickup is drawn with. */
export function itemArt(itemId: ItemId): {
  sprite: LabyrinthSpriteName;
  tint: string;
} {
  switch (itemId) {
    case "coffee":
      return { sprite: "mug", tint: LABYRINTH_INK.steel };
    case "node_modules":
      return { sprite: "box", tint: LABYRINTH_INK.amber };
    case "todo_shield":
      return { sprite: "shield", tint: LABYRINTH_INK.emerald };
    case "commit_token":
      return { sprite: "gem", tint: LABYRINTH_INK.amber };
    case "hotfix_key":
      return { sprite: "key", tint: LABYRINTH_INK.amber };
    case "git_stash":
      return { sprite: "bomb", tint: LABYRINTH_INK.red };
    case "ram_expansion":
      return { sprite: "chip", tint: LABYRINTH_INK.steel };
    case "zero_day_payload":
      return { sprite: "skull", tint: LABYRINTH_INK.red };
    case "bypass_chip":
      return { sprite: "plug", tint: LABYRINTH_INK.emerald };
    case "crypto_stash":
      return { sprite: "coin", tint: LABYRINTH_INK.amber };
    case "firmware_patch":
      return { sprite: "disk", tint: LABYRINTH_INK.steel };
    default:
      return { sprite: "coin", tint: LABYRINTH_INK.amber };
  }
}

/**
 * Colours that read as purple or pink on dark, which AGENTS.md section 20
 * rules out. Floating text that asks for one is drawn in amber instead.
 */
const OFF_PALETTE = new Set([
  "#a855f7",
  "#c084fc",
  "#e9d5ff",
  "#ec4899",
  "#f472b6",
  "#d946ef",
]);

/** A colour safe for the board: off-palette purples and pinks become amber. */
export function boardSafeColor(color: string): string {
  return OFF_PALETTE.has(color.toLowerCase()) ? LABYRINTH_INK.amber : color;
}

/** Fog levels for {@link fogAlpha}. */
export const FOG_UNSEEN = 1;
export const FOG_REMEMBERED = 0.62;

/**
 * How dark the fog is over a tile. Unexplored rooms are black; tiles the
 * player has seen but cannot see now are dimmed; visible tiles are clear.
 * Classic stages have no fog.
 */
export function fogAlpha(
  explored: boolean,
  visible: boolean,
  hasFog: boolean
): number {
  if (!hasFog || visible) return 0;
  return explored ? FOG_REMEMBERED : FOG_UNSEEN;
}

/** A grid tile. */
interface GridPoint {
  x: number;
  y: number;
}

/**
 * The shortest walkable path between two tiles, both ends included, by
 * breadth-first search over everything but solid walls. Moving airgap walls
 * count as open because they shift every step. Returns just the start when
 * the target is unreachable, so a route never draws through a wall.
 */
export function walkablePath(
  maze: string[][],
  from: GridPoint,
  to: GridPoint
): GridPoint[] {
  const rows = maze.length;
  const cols = maze[0]?.length ?? 0;
  const inside = (p: GridPoint) =>
    p.x >= 0 && p.y >= 0 && p.x < cols && p.y < rows;
  if (!inside(from) || !inside(to)) return [from];
  if (from.x === to.x && from.y === to.y) return [from];

  const key = (p: GridPoint) => p.y * cols + p.x;
  const previous = new Map<number, number>();
  previous.set(key(from), -1);
  const queue: GridPoint[] = [from];
  const steps = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.x === to.x && current.y === to.y) break;
    for (const [dx, dy] of steps) {
      const next = { x: current.x + dx, y: current.y + dy };
      if (!inside(next) || previous.has(key(next))) continue;
      if (isSolidWall(maze[next.y][next.x])) continue;
      previous.set(key(next), key(current));
      queue.push(next);
    }
  }
  if (!previous.has(key(to))) return [from];

  const path: GridPoint[] = [];
  let cursor = key(to);
  while (cursor !== -1) {
    path.push({ x: cursor % cols, y: Math.floor(cursor / cols) });
    cursor = previous.get(cursor) ?? -1;
  }
  return path.reverse();
}

/**
 * The tiles the route crosses when it walks the tour stop by stop, without
 * repeats. The route is drawn as dots on these floor tiles, never as
 * straight lines across walls.
 */
export function routeTiles(maze: string[][], tour: GridPoint[]): GridPoint[] {
  const seen = new Set<string>();
  const tiles: GridPoint[] = [];
  for (let i = 1; i < tour.length; i++) {
    for (const p of walkablePath(maze, tour[i - 1], tour[i])) {
      const id = `${p.x},${p.y}`;
      if (seen.has(id)) continue;
      seen.add(id);
      tiles.push(p);
    }
  }
  return tiles;
}

/**
 * Dot positions, in art pixels, for a route: one at each tile centre and one
 * half way to the next tile when the two are neighbours, so the path reads
 * as an even dotted line along the corridor.
 */
export function routeDots(tiles: GridPoint[]): GridPoint[] {
  const dots: GridPoint[] = [];
  const half = TILE / 2;
  tiles.forEach((tile, i) => {
    dots.push({ x: tile.x * TILE + half, y: tile.y * TILE + half });
    const next = tiles[i + 1];
    if (next && Math.abs(next.x - tile.x) + Math.abs(next.y - tile.y) === 1) {
      dots.push({
        x: (tile.x + next.x) * half + half,
        y: (tile.y + next.y) * half + half,
      });
    }
  });
  return dots;
}

/**
 * Keeps a centred label of the given width inside the canvas, with a margin,
 * so a long pickup line near the edge is not clipped.
 */
export function clampLabelCenter(
  centerX: number,
  labelWidth: number,
  canvasWidth: number = LOGICAL_WIDTH,
  margin: number = 2
): number {
  const half = labelWidth / 2;
  const min = margin + half;
  const max = canvasWidth - margin - half;
  if (min > max) return canvasWidth / 2;
  return clamp(centerX, min, max);
}

/** A plate placed on a wall: its box in art pixels. */
export interface PlateBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Height of a plate, in art pixels. */
export const PLATE_HEIGHT = 9;

/**
 * Places a name plate on the outer wall row `wallRow`, centred on
 * `centerX` and clamped inside the board. Plates sit on solid wall, never
 * on a tile the player walks, so a label can't hide a corridor and is never
 * clipped by a 16px tile the way "AIRGAP" was.
 */
export function plateOnWall(
  centerX: number,
  textWidth: number,
  wallRow: number,
  padding: number = 3
): PlateBox {
  const width = Math.ceil(textWidth + padding * 2);
  const x = Math.round(clampLabelCenter(centerX, width) - width / 2);
  const y = wallRow * TILE + Math.round((TILE - PLATE_HEIGHT) / 2);
  return { x, y, width, height: PLATE_HEIGHT };
}

/** True when every tile in the row is solid wall, so a plate can sit on it. */
export function isSolidWallRow(maze: string[][], row: number): boolean {
  const cells = maze[row];
  return !!cells && cells.length > 0 && cells.every((c) => isSolidWall(c));
}

/** The room name for the board's top plate: "ROOM 01 · AIRGAP ENCLAVE". */
export function roomPlateText(badge: string): string {
  return badge
    .split("::")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();
}

/**
 * The font size that fits a line of text measured at `baseSize` into
 * `maxWidth`, never larger than the base and never below `minSize`. Long
 * pickup and weapon lines shrink to fit the board instead of being clipped.
 */
export function fitFontSize(
  baseSize: number,
  measuredWidth: number,
  maxWidth: number,
  minSize: number = 4
): number {
  if (measuredWidth <= maxWidth || measuredWidth <= 0) return baseSize;
  return Math.max(minSize, Math.floor((baseSize * maxWidth) / measuredWidth));
}
