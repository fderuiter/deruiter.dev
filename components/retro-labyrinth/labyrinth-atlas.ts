/**
 * Retro Labyrinth's pixel art (epic #1522, item 2): a procedural 16px tile
 * atlas and 1-bit sprites, each drawn once to an offscreen canvas and then
 * stamped with `drawImage` and nearest-neighbour sampling every frame.
 *
 * Tiles are painted with `fillRect` only, so the atlas is identical on every
 * browser and needs no image assets. Sprites are 1-bit bitmaps: one ink
 * colour plus a dark outline computed from the bitmap, so they read on any
 * floor or wall.
 */

import {
  EDGE_E,
  EDGE_N,
  EDGE_S,
  EDGE_W,
  FLOOR_VARIANTS,
  LABYRINTH_INK,
  TILE,
  fogAlpha,
  type LabyrinthSpriteName,
  type PlateBox,
  type TilePalette,
} from "./labyrinth-art";

type Ctx = CanvasRenderingContext2D;

/** Atlas slots. Wall variants follow WALL, one per edge mask (0 to 15). */
export const ATLAS = {
  FLOOR: 0,
  WALL: FLOOR_VARIANTS,
  AIRGAP: FLOOR_VARIANTS + 16,
  TERMINAL: FLOOR_VARIANTS + 17,
  CHEST: FLOOR_VARIANTS + 18,
  EXIT_OPEN: FLOOR_VARIANTS + 19,
  EXIT_LOCKED: FLOOR_VARIANTS + 20,
  COUNT: FLOOR_VARIANTS + 21,
} as const;

/**
 * 1-bit sprites: `#` is ink, anything else is clear. Actors are 12x12 and
 * pickups 8x8, so a pickup never reads as a creature.
 */
export const SPRITES: Record<LabyrinthSpriteName, string[]> = {
  // A hooded netrunner with a visor slit.
  player: [
    "....####....",
    "...######...",
    "..########..",
    "..#......#..",
    "..########..",
    "...######...",
    ".##########.",
    "#.########.#",
    "#.########.#",
    "...##..##...",
    "...##..##...",
    "..###..###..",
  ],
  bug: [
    "..#......#..",
    "...#....#...",
    "....####....",
    "...#.##.#...",
    "#.########.#",
    ".##########.",
    "...######...",
    "#.###..###.#",
    ".##########.",
    "...######...",
    ".#..#..#..#.",
    "#..........#",
  ],
  drone: [
    "###......###",
    ".#........#.",
    "..#......#..",
    "...######...",
    "..########..",
    "..##.##.##..",
    "..########..",
    "...######...",
    "..#......#..",
    ".#........#.",
    "###......###",
    "............",
  ],
  slime: [
    "............",
    "....####....",
    "...######...",
    "..########..",
    "..##.##.##..",
    ".##########.",
    ".##########.",
    "############",
    "###.####.###",
    "############",
    ".#.#.##.#.#.",
    "............",
  ],
  daemon: [
    "#..........#",
    "##........##",
    ".##.####.##.",
    "..########..",
    "..#..##..#..",
    "..########..",
    "...#.##.#...",
    "..########..",
    ".###.##.###.",
    ".##########.",
    ".#.#.##.#.#.",
    ".#........#.",
  ],
  coin: [
    "..####..",
    ".#.##.#.",
    "#.#..#.#",
    "#.##...#",
    "#...##.#",
    "#.#..#.#",
    ".#.##.#.",
    "..####..",
  ],
  mug: [
    ".#.#.#..",
    "........",
    "#####...",
    "#...###.",
    "#...#.#.",
    "#...###.",
    "#...#...",
    ".###....",
  ],
  box: [
    "########",
    "#..##..#",
    "########",
    "#......#",
    "#.####.#",
    "#......#",
    "#......#",
    "########",
  ],
  shield: [
    "########",
    "#.####.#",
    "#.####.#",
    "#.####.#",
    ".#.##.#.",
    ".#.##.#.",
    "..#..#..",
    "...##...",
  ],
  gem: [
    "........",
    ".######.",
    "#.#..#.#",
    "########",
    ".#....#.",
    "..#..#..",
    "...##...",
    "........",
  ],
  key: [
    "........",
    ".###....",
    "#...#...",
    "#...####",
    "#...#.#.",
    ".###..#.",
    "........",
    "........",
  ],
  bomb: [
    "......#.",
    ".....#..",
    "..####..",
    ".######.",
    "###.####",
    "##.#####",
    ".######.",
    "..####..",
  ],
  chip: [
    "#.#.#.#.",
    "########",
    "#......#",
    "#.#..#.#",
    "#......#",
    "########",
    "#.#.#.#.",
    "........",
  ],
  plug: [
    "..#..#..",
    "..#..#..",
    ".######.",
    ".#....#.",
    ".######.",
    "...##...",
    "...##...",
    "...##...",
  ],
  skull: [
    ".######.",
    "########",
    "#..##..#",
    "#..##..#",
    "########",
    ".##..##.",
    ".######.",
    ".#.##.#.",
  ],
  disk: [
    "########",
    "#.####.#",
    "#.####.#",
    "#......#",
    "#.####.#",
    "#.#..#.#",
    "#.####.#",
    "########",
  ],
  // A route node: a ring with a centre dot.
  node: [
    "..####..",
    ".#....#.",
    "#......#",
    "#..##..#",
    "#..##..#",
    "#......#",
    ".#....#.",
    "..####..",
  ],
};

/** A parsed 1-bit bitmap. */
export interface SpriteBitmap {
  width: number;
  height: number;
  ink: boolean[][];
}

/** Parses sprite rows into a bitmap; short rows are padded with clear pixels. */
export function parseSprite(rows: string[]): SpriteBitmap {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return {
    width,
    height: rows.length,
    ink: rows.map((row) =>
      Array.from({ length: width }, (_, x) => row[x] === "#")
    ),
  };
}

/**
 * The outline of a bitmap: clear pixels that touch ink on a side, in a
 * bitmap one pixel larger on every edge. Drawn dark under the ink, it keeps
 * a 1-bit sprite legible on a lit wall as well as on the floor.
 */
export function spriteOutline(bitmap: SpriteBitmap): boolean[][] {
  const w = bitmap.width + 2;
  const h = bitmap.height + 2;
  const inkAt = (x: number, y: number) => !!bitmap.ink[y - 1]?.[x - 1];
  return Array.from({ length: h }, (_, y) =>
    Array.from(
      { length: w },
      (_, x) =>
        !inkAt(x, y) &&
        (inkAt(x - 1, y) ||
          inkAt(x + 1, y) ||
          inkAt(x, y - 1) ||
          inkAt(x, y + 1))
    )
  );
}

function createCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const spriteCache = new Map<string, HTMLCanvasElement | null>();

/**
 * The offscreen canvas for a sprite in one colour, built on first use and
 * cached. The canvas is the bitmap plus a one-pixel outline on each side.
 */
export function getSpriteCanvas(
  name: LabyrinthSpriteName,
  color: string
): HTMLCanvasElement | null {
  const key = `${name}:${color}`;
  if (spriteCache.has(key)) return spriteCache.get(key) ?? null;
  const bitmap = parseSprite(SPRITES[name]);
  const outline = spriteOutline(bitmap);
  const canvas = createCanvas(bitmap.width + 2, bitmap.height + 2);
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) {
    spriteCache.set(key, null);
    return null;
  }
  ctx.fillStyle = LABYRINTH_INK.stage;
  outline.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) ctx.fillRect(x, y, 1, 1);
    })
  );
  ctx.fillStyle = color;
  bitmap.ink.forEach((row, y) =>
    row.forEach((on, x) => {
      if (on) ctx.fillRect(x + 1, y + 1, 1, 1);
    })
  );
  spriteCache.set(key, canvas);
  return canvas;
}

/** Draws a sprite centred on (cx, cy), in art pixels, snapped to the grid. */
export function drawSprite(
  ctx: Ctx,
  name: LabyrinthSpriteName,
  color: string,
  cx: number,
  cy: number
): void {
  const sprite = getSpriteCanvas(name, color);
  if (!sprite) return;
  const w = sprite.width;
  const h = sprite.height;
  ctx.drawImage(sprite, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
}

function paintFloor(ctx: Ctx, ox: number, p: TilePalette, variant: number) {
  ctx.fillStyle = variant === 1 ? p.floorAlt : p.floor;
  ctx.fillRect(ox, 0, TILE, TILE);
  // A hairline seam on the top and left edges marks the tile grid.
  ctx.fillStyle = p.floorSeam;
  ctx.fillRect(ox, 0, TILE, 1);
  ctx.fillRect(ox, 0, 1, TILE);
  ctx.fillStyle = p.floorSpeck;
  if (variant === 0) {
    ctx.fillRect(ox + 4, 5, 1, 1);
    ctx.fillRect(ox + 11, 11, 1, 1);
  } else if (variant === 1) {
    ctx.fillRect(ox + 8, 8, 1, 1);
  } else {
    // A short hairline crack.
    ctx.fillRect(ox + 3, 10, 2, 1);
    ctx.fillRect(ox + 5, 11, 2, 1);
    ctx.fillRect(ox + 12, 4, 1, 1);
  }
}

function paintWall(ctx: Ctx, ox: number, p: TilePalette, mask: number) {
  ctx.fillStyle = p.wallTop;
  ctx.fillRect(ox, 0, TILE, TILE);
  // Brick courses on the cap.
  ctx.fillStyle = p.wallLine;
  ctx.fillRect(ox, 5, TILE, 1);
  ctx.fillRect(ox, 10, TILE, 1);
  ctx.fillRect(ox + 7, 0, 1, 5);
  ctx.fillRect(ox + 3, 6, 1, 4);
  ctx.fillRect(ox + 11, 6, 1, 4);
  ctx.fillRect(ox + 7, 11, 1, 5);
  if (mask & EDGE_S) {
    // Floor below: a darker front face, the wall's visible side.
    ctx.fillStyle = p.wallFace;
    ctx.fillRect(ox, 11, TILE, 5);
    ctx.fillStyle = LABYRINTH_INK.stage;
    ctx.fillRect(ox, 15, TILE, 1);
  }
  // A lit rim wherever the wall meets floor.
  ctx.fillStyle = p.wallRim;
  if (mask & EDGE_N) ctx.fillRect(ox, 0, TILE, 1);
  if (mask & EDGE_W) ctx.fillRect(ox, 0, 1, mask & EDGE_S ? 11 : TILE);
  if (mask & EDGE_E)
    ctx.fillRect(ox + TILE - 1, 0, 1, mask & EDGE_S ? 11 : TILE);
  if (mask & EDGE_S) ctx.fillRect(ox, 10, TILE, 1);
}

function paintAirgap(ctx: Ctx, ox: number, p: TilePalette) {
  ctx.fillStyle = p.airgapDark;
  ctx.fillRect(ox, 0, TILE, TILE);
  // Diagonal hazard stripes, four pixels wide.
  ctx.fillStyle = p.airgap;
  for (let y = 1; y < TILE - 1; y++) {
    for (let x = 1; x < TILE - 1; x++) {
      if (((x + y) >> 2) % 2 === 0) ctx.fillRect(ox + x, y, 1, 1);
    }
  }
  ctx.fillStyle = LABYRINTH_INK.stage;
  ctx.fillRect(ox, 0, TILE, 1);
  ctx.fillRect(ox, TILE - 1, TILE, 1);
  ctx.fillRect(ox, 0, 1, TILE);
  ctx.fillRect(ox + TILE - 1, 0, 1, TILE);
}

function paintTerminal(ctx: Ctx, ox: number, p: TilePalette) {
  paintFloor(ctx, ox, p, 0);
  ctx.fillStyle = p.terminal;
  ctx.fillRect(ox + 2, 2, 12, 9);
  ctx.fillStyle = LABYRINTH_INK.stage;
  ctx.fillRect(ox + 3, 3, 10, 7);
  ctx.fillStyle = p.terminalScreen;
  ctx.fillRect(ox + 4, 4, 5, 1);
  ctx.fillRect(ox + 4, 6, 7, 1);
  ctx.fillRect(ox + 4, 8, 2, 1);
  ctx.fillStyle = p.terminal;
  ctx.fillRect(ox + 7, 11, 2, 2);
  ctx.fillRect(ox + 4, 13, 8, 1);
}

function paintChest(ctx: Ctx, ox: number, p: TilePalette) {
  paintFloor(ctx, ox, p, 1);
  ctx.fillStyle = LABYRINTH_INK.steel;
  ctx.fillRect(ox + 2, 5, 12, 9);
  ctx.fillStyle = LABYRINTH_INK.raised;
  ctx.fillRect(ox + 3, 9, 10, 4);
  ctx.fillStyle = p.chest;
  ctx.fillRect(ox + 2, 5, 12, 1);
  ctx.fillRect(ox + 2, 8, 12, 1);
  ctx.fillRect(ox + 7, 7, 2, 4);
}

function paintExit(ctx: Ctx, ox: number, p: TilePalette, locked: boolean) {
  paintFloor(ctx, ox, p, 0);
  const color = locked ? p.exitLocked : p.exitOpen;
  // An arch frame with nested steps leading down.
  ctx.fillStyle = color;
  ctx.fillRect(ox + 2, 2, 12, 1);
  ctx.fillRect(ox + 2, 2, 1, 13);
  ctx.fillRect(ox + 13, 2, 1, 13);
  ctx.fillStyle = LABYRINTH_INK.stage;
  ctx.fillRect(ox + 3, 3, 10, 12);
  if (locked) {
    // Bars and a padlock.
    ctx.fillStyle = color;
    for (let x = 4; x < 13; x += 3) ctx.fillRect(ox + x, 3, 1, 12);
    ctx.fillRect(ox + 6, 8, 4, 4);
    ctx.fillStyle = LABYRINTH_INK.stage;
    ctx.fillRect(ox + 7, 9, 2, 1);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(ox + 5, 6, 6, 1);
    ctx.fillRect(ox + 4, 9, 8, 1);
    ctx.fillRect(ox + 3, 12, 10, 1);
  }
}

const atlasCache = new Map<string, HTMLCanvasElement | null>();

/**
 * The tile atlas for a palette: one 16px row, built once per theme and
 * cached. Slots are listed in {@link ATLAS}.
 */
export function getTileAtlas(palette: TilePalette): HTMLCanvasElement | null {
  const key = JSON.stringify(palette);
  if (atlasCache.has(key)) return atlasCache.get(key) ?? null;
  const canvas = createCanvas(ATLAS.COUNT * TILE, TILE);
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) {
    atlasCache.set(key, null);
    return null;
  }
  for (let v = 0; v < FLOOR_VARIANTS; v++) {
    paintFloor(ctx, (ATLAS.FLOOR + v) * TILE, palette, v);
  }
  for (let mask = 0; mask < 16; mask++) {
    paintWall(ctx, (ATLAS.WALL + mask) * TILE, palette, mask);
  }
  paintAirgap(ctx, ATLAS.AIRGAP * TILE, palette);
  paintTerminal(ctx, ATLAS.TERMINAL * TILE, palette);
  paintChest(ctx, ATLAS.CHEST * TILE, palette);
  paintExit(ctx, ATLAS.EXIT_OPEN * TILE, palette, false);
  paintExit(ctx, ATLAS.EXIT_LOCKED * TILE, palette, true);
  atlasCache.set(key, canvas);
  return canvas;
}

/** Stamps atlas slot `slot` at tile (tx, ty). */
export function drawTile(
  ctx: Ctx,
  atlas: HTMLCanvasElement,
  slot: number,
  tx: number,
  ty: number
): void {
  ctx.drawImage(
    atlas,
    slot * TILE,
    0,
    TILE,
    TILE,
    tx * TILE,
    ty * TILE,
    TILE,
    TILE
  );
}

let monoFamily: string | null = null;

/**
 * The canvas font, in the site's Geist Mono so canvas and DOM text match.
 * The family is read once from `--font-geist-mono`; before that loads, or
 * outside a browser, it falls back to the system monospace.
 */
export function labyrinthFont(sizePx: number, weight: number = 700): string {
  if (monoFamily === null && typeof document !== "undefined") {
    try {
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-geist-mono")
        .trim();
      monoFamily = value ? `${value}, ui-monospace, monospace` : "";
    } catch {
      monoFamily = "";
    }
  }
  return `${weight} ${sizePx}px ${monoFamily || "ui-monospace, monospace"}`;
}

/**
 * Draws a name plate: a graphite plate with a hairline border, a short
 * accent tick on the left and the text in `textColor`. With `swatch`, a
 * 3px key square in that colour leads the text.
 */
export function drawPlate(
  ctx: Ctx,
  box: PlateBox,
  text: string,
  accent: string,
  textColor: string = LABYRINTH_INK.text,
  swatch?: string
): void {
  ctx.save();
  ctx.fillStyle = LABYRINTH_INK.stage;
  ctx.fillRect(box.x - 1, box.y - 1, box.width + 2, box.height + 2);
  ctx.fillStyle = LABYRINTH_INK.panel;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.fillStyle = accent;
  ctx.fillRect(box.x, box.y, 1, box.height);
  let textLeft = box.x;
  if (swatch) {
    ctx.fillStyle = swatch;
    ctx.fillRect(box.x + 3, box.y + 3, 3, 3);
    textLeft = box.x + 5;
  }
  ctx.fillStyle = textColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    text,
    (textLeft + box.x + box.width) / 2 + 0.5,
    box.y + box.height / 2 + 0.5
  );
  ctx.restore();
}

/** Fog texels per tile along each axis. */
export const FOG_TEXELS_PER_TILE = 2;

/**
 * Paints the fog of war into a small texture, `FOG_TEXELS_PER_TILE` texels
 * per tile, which the board stretches over the maze with smoothing on.
 * Inside a fogged or clear region every texel is equal, so the fog is flat
 * there; only where the level changes does smoothing blend neighbouring
 * texels, which makes the fog soft at its edge and nowhere else.
 */
export function paintFogCanvas(
  existing: HTMLCanvasElement | null,
  explored: boolean[][],
  visible: boolean[][],
  hasFog: boolean,
  cols: number,
  rows: number
): HTMLCanvasElement | null {
  const n = FOG_TEXELS_PER_TILE;
  const canvas = existing ?? createCanvas(cols * n, rows * n);
  if (!canvas) return null;
  // Resetting the size clears the texture.
  canvas.width = cols * n;
  canvas.height = rows * n;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const alpha = fogAlpha(
        explored[y]?.[x] ?? true,
        visible[y]?.[x] ?? true,
        hasFog
      );
      if (alpha <= 0) continue;
      ctx.fillStyle = `rgba(7, 8, 10, ${alpha})`;
      ctx.fillRect(x * n, y * n, n, n);
    }
  }
  return canvas;
}
