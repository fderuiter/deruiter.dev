import { clamp, gameFont } from "@/lib/game-utils";
import {
  countMarks,
  getRoom,
  getStation,
  tileAt,
  type Facing,
  type PersonPlacement,
  type Room,
  type RoomCondition,
  type RoomId,
  type SetDressingMark,
  type StationId,
  type WorldMap,
} from "@/lib/study-director-world";
import {
  HALL_ROOMS,
  OUTDOOR_ROOMS,
  PALETTE as P,
  ROOM_FLOORS,
  SITE_STAFF_LOOKS,
  SPRITE_W,
  TILE,
  floorTone,
  lightTint,
  isAfterHours,
  siteLookFor,
  spriteRects,
  tileNoise,
  type FloorStyle,
  type Look,
  type Posture,
  type WalkFrame,
} from "./world-art";

// The pixel-art drawing of the office (#1823 to #1828). Everything is drawn on
// the 16px tile grid with whole-pixel rectangles so it stays crisp when the
// canvas is scaled by an integer. `world-art.ts` holds the choices; this file
// turns them into pixels. `FloorRenderer` caches the unchanging layer.

type Ctx = CanvasRenderingContext2D;

function box(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** A 1px outlined rectangle, for frames. */
function frame(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  box(ctx, x, y, w, 1, color);
  box(ctx, x, y + h - 1, w, 1, color);
  box(ctx, x, y, 1, h, color);
  box(ctx, x + w - 1, y, 1, h, color);
}

interface Rect {
  glyph: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const MERGED = new Set(["D", "T", "R", "B", "C", "W"]);

/** Groups same-glyph furniture into rectangles so a desk reads as one desk. */
function furnitureRects(map: WorldMap): Rect[] {
  const used = new Set<string>();
  const rects: Rect[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const glyph = map.rows[y][x];
      if (!MERGED.has(glyph) || used.has(`${x},${y}`)) continue;
      let w = 1;
      while (map.rows[y][x + w] === glyph && !used.has(`${x + w},${y}`)) w += 1;
      let h = 1;
      // Cars park side by side, never nose to tail; keep them one row deep.
      while (
        glyph !== "C" &&
        y + h < map.height &&
        map.rows[y + h].slice(x, x + w) === glyph.repeat(w) &&
        map.rows[y + h][x - 1] !== glyph &&
        map.rows[y + h][x + w] !== glyph
      )
        h += 1;
      for (let dy = 0; dy < h; dy += 1)
        for (let dx = 0; dx < w; dx += 1) used.add(`${x + dx},${y + dy}`);
      rects.push({ glyph, x, y, w, h });
    }
  }
  return rects;
}

/** The room whose interior holds a tile, if any. */
function roomOf(map: WorldMap, x: number, y: number): Room | undefined {
  return map.rooms.find(
    (m) =>
      x >= m.bounds.x &&
      x < m.bounds.x + m.bounds.width &&
      y >= m.bounds.y &&
      y < m.bounds.y + m.bounds.height
  );
}

/** Furniture rectangles of one glyph inside a room, in map order. */
function rectsIn(map: WorldMap, room: Room, glyph: string): Rect[] {
  const b = room.bounds;
  return furnitureRects(map).filter(
    (r) =>
      r.glyph === glyph &&
      r.x >= b.x &&
      r.x < b.x + b.width &&
      r.y >= b.y &&
      r.y < b.y + b.height
  );
}

// ---------------------------------------------------------------------------
// Floors and walls.

function drawFloorTile(ctx: Ctx, style: FloorStyle, tx: number, ty: number) {
  const x = tx * TILE;
  const y = ty * TILE;
  box(ctx, x, y, TILE, TILE, floorTone(style, tx, ty));
  switch (style.pattern) {
    case "carpet": {
      // A woven speckle: two darker pixels at fixed places.
      const a = Math.floor(tileNoise(tx, ty, 1) * 14);
      const b = Math.floor(tileNoise(tx, ty, 2) * 14);
      box(ctx, x + a, y + ((a * 3) % 14), 1, 1, style.line);
      box(ctx, x + b, y + ((b * 5) % 14), 1, 1, style.line);
      break;
    }
    case "linoleum":
      box(ctx, x, y + TILE - 1, TILE, 1, style.line);
      box(ctx, x + TILE - 1, y, 1, TILE, style.line);
      break;
    case "tile":
      box(ctx, x, y + TILE - 1, TILE, 1, style.line);
      box(ctx, x + TILE - 1, y, 1, TILE, style.line);
      box(ctx, x, y, TILE, 1, style.line);
      break;
    case "stone":
      box(ctx, x, y, TILE, 1, style.line);
      box(ctx, x, y, 1, TILE, style.line);
      break;
    case "wood": {
      box(ctx, x, y + TILE - 1, TILE, 1, style.line);
      const seam = 3 + Math.floor(tileNoise(tx, ty, 3) * 10);
      box(ctx, x + seam, y, 1, TILE - 1, style.line);
      break;
    }
    case "asphalt": {
      const a = Math.floor(tileNoise(tx, ty, 4) * 14);
      const b = Math.floor(tileNoise(tx, ty, 5) * 14);
      box(ctx, x + a, y + ((a * 7) % 14), 1, 1, "#22252b");
      box(ctx, x + b, y + ((b * 3) % 14), 1, 1, "#1d2025");
      break;
    }
    default:
      break;
  }
}

/** Floors of every room, a washed look per clinical site, and the car-park bays. */
export function drawGround(ctx: Ctx, map: WorldMap) {
  box(ctx, 0, 0, map.width * TILE, map.height * TILE, P.graphite);
  const hall = map.rooms.find((r) => HALL_ROOMS.has(r.id)) ?? map.rooms[0];
  // Doorways take the hallway floor under the leaf.
  for (let y = 0; y < map.height; y += 1)
    for (let x = 0; x < map.width; x += 1)
      if (tileAt(map, x, y) === "door" && hall)
        drawFloorTile(ctx, ROOM_FLOORS[hall.id], x, y);
  for (const room of map.rooms) {
    const style = ROOM_FLOORS[room.id];
    const b = room.bounds;
    for (let ty = b.y; ty < b.y + b.height; ty += 1)
      for (let tx = b.x; tx < b.x + b.width; tx += 1)
        drawFloorTile(ctx, style, tx, ty);
  }
  const look = siteLookFor(map.id);
  if (look.tintAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = look.tintAlpha;
    for (const room of map.rooms) {
      if (OUTDOOR_ROOMS.has(room.id)) continue;
      const b = room.bounds;
      box(
        ctx,
        b.x * TILE,
        b.y * TILE,
        b.width * TILE,
        b.height * TILE,
        `rgb(${look.tint.join(",")})`
      );
    }
    ctx.restore();
  }
  // Parking bays: a painted line either side of each pair of cars.
  for (let y = 0; y < map.height; y += 1)
    for (let x = 0; x < map.width; x += 1)
      if (map.rows[y][x] === "C" && map.rows[y][x - 1] !== "C") {
        box(ctx, x * TILE - 3, y * TILE, 1, TILE, P.inkFaint);
        box(ctx, (x + 2) * TILE + 2, y * TILE, 1, TILE, P.inkFaint);
      }
}

export function drawWalls(ctx: Ctx, map: WorldMap) {
  const solid = (x: number, y: number) =>
    x < 0 || y < 0 || x >= map.width || y >= map.height
      ? true
      : tileAt(map, x, y) === "wall";
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const kind = tileAt(map, x, y);
      const px = x * TILE;
      const py = y * TILE;
      if (kind === "wall") {
        box(ctx, px, py, TILE, TILE, P.wallCap);
        if (!solid(x, y + 1)) {
          // The lit face of a wall that looks into a room: a highlight, the
          // face, a skirting line and a soft shadow on the floor below.
          box(ctx, px, py + 9, TILE, 7, P.wallFace);
          box(ctx, px, py + 9, TILE, 1, P.wallHighlight);
          box(ctx, px, py + TILE - 1, TILE, 1, P.wallBase);
          ctx.save();
          ctx.globalAlpha = 0.35;
          box(ctx, px, py + TILE, TILE, 2, P.outline);
          ctx.restore();
        }
        if (!solid(x - 1, y)) box(ctx, px, py, 1, TILE, P.wallHighlight);
        if (!solid(x + 1, y)) box(ctx, px + TILE - 1, py, 1, TILE, P.wallBase);
      } else if (kind === "door") {
        const across = solid(x - 1, y) && solid(x + 1, y);
        if (across) {
          // A doorway in a horizontal wall: jambs either side, the leaf open.
          box(ctx, px, py, 2, TILE, P.wallCap);
          box(ctx, px + TILE - 2, py, 2, TILE, P.wallCap);
          box(ctx, px + 2, py, TILE - 4, 2, P.wallHighlight);
          box(ctx, px + 2, py + 2, 2, TILE - 4, P.woodLight);
          box(ctx, px + 2, py + TILE - 3, TILE - 4, 1, P.amberDim);
        } else {
          box(ctx, px, py, TILE, 2, P.wallCap);
          box(ctx, px, py + TILE - 2, TILE, 2, P.wallCap);
          box(ctx, px, py + 2, 2, TILE - 4, P.woodLight);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Props.

/** Pairs of cars share the car park; their colours are muted on purpose. */
const CAR_COLORS = ["#475569", "#52525b", "#78716c", "#334155", "#57534e"];

function drawCar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  body: string,
  roof: string
) {
  // Top-down: the body, the glass, a roof panel, wheels and lamps.
  box(ctx, x, y + 2, w, 12, P.outline);
  box(ctx, x + 1, y + 3, w - 2, 10, body);
  box(ctx, x + 5, y + 4, w - 10, 8, roof);
  box(ctx, x + 4, y + 4, 1, 8, P.graphite);
  box(ctx, x + w - 5, y + 4, 1, 8, P.graphite);
  box(ctx, x + 3, y + 1, 4, 2, P.outline);
  box(ctx, x + w - 7, y + 1, 4, 2, P.outline);
  box(ctx, x + 3, y + 13, 4, 2, P.outline);
  box(ctx, x + w - 7, y + 13, 4, 2, P.outline);
  box(ctx, x + w - 2, y + 4, 1, 2, P.paper);
  box(ctx, x + w - 2, y + 10, 1, 2, P.paper);
  box(ctx, x + 1, y + 4, 1, 2, P.red);
  box(ctx, x + 1, y + 10, 1, 2, P.red);
}

type DeskKind = "data" | "binders" | "stats" | "writing" | "code" | "plain";

/** What a room's desks carry, so each department reads at a glance. */
function deskKindFor(room: RoomId | undefined): DeskKind {
  switch (room) {
    case "dataManagement":
      return "data";
    case "regulatory":
    case "regulatoryFiles":
      return "binders";
    case "biostatistics":
      return "stats";
    case "medicalWriting":
    case "piOffice":
      return "writing";
    case "programming":
      return "code";
    default:
      return "plain";
  }
}

function drawMonitor(ctx: Ctx, x: number, y: number, kind: DeskKind) {
  box(ctx, x, y, 8, 6, P.outline);
  box(ctx, x + 1, y + 1, 6, 4, P.screen);
  switch (kind) {
    case "data":
      box(ctx, x + 1, y + 1, 4, 1, P.emerald);
      box(ctx, x + 1, y + 3, 5, 1, P.emeraldDim);
      break;
    case "stats":
      box(ctx, x + 1, y + 4, 1, 1, P.amber);
      box(ctx, x + 3, y + 3, 1, 2, P.amber);
      box(ctx, x + 5, y + 2, 1, 3, P.amber);
      break;
    case "code":
      box(ctx, x + 1, y + 1, 3, 1, P.emerald);
      box(ctx, x + 2, y + 2, 4, 1, P.steel);
      box(ctx, x + 2, y + 3, 2, 1, P.emeraldDim);
      break;
    case "binders":
      box(ctx, x + 1, y + 1, 5, 1, P.steel);
      box(ctx, x + 1, y + 3, 3, 1, P.steelDim);
      break;
    default:
      box(ctx, x + 1, y + 2, 5, 1, P.screenLight);
  }
  box(ctx, x + 3, y + 6, 2, 1, P.metal);
}

function drawDesk(
  ctx: Ctx,
  r: Rect,
  room: RoomId | undefined,
  clutter: number
) {
  const x = r.x * TILE;
  const y = r.y * TILE;
  const w = r.w * TILE;
  const h = r.h * TILE;
  const kind = deskKindFor(room);
  box(ctx, x + 1, y + 3, w - 2, h - 6, P.outline);
  box(ctx, x + 2, y + 4, w - 4, h - 8, P.wood);
  box(ctx, x + 2, y + 4, w - 4, 1, P.woodLight);
  box(ctx, x + 2, y + h - 5, w - 4, 1, P.woodDark);
  for (let i = 0; i < r.w; i += 1) {
    const tx = x + i * TILE;
    drawMonitor(ctx, tx + 4, y + 5, kind);
    if (kind === "code") drawMonitor(ctx, tx + 4 + 0, y + 5, "code");
    // A chair pushed in below the desk.
    box(ctx, tx + 5, y + h, 6, 1, P.outline);
    box(ctx, tx + 5, y + h + 1, 6, 3, P.metal);
    box(ctx, tx + 6, y + h + 1, 4, 1, P.metalLight);
  }
  if (kind === "binders") {
    box(ctx, x + w - 9, y + 6, 2, 4, P.red);
    box(ctx, x + w - 7, y + 6, 2, 4, P.steel);
    box(ctx, x + w - 5, y + 6, 2, 4, P.amber);
  } else if (kind === "writing") {
    box(ctx, x + w - 9, y + 7, 6, 4, P.paper);
    box(ctx, x + w - 9, y + 10, 6, 1, P.paperShade);
  } else if (kind === "stats") {
    box(ctx, x + w - 8, y + 7, 4, 3, P.paper);
    box(ctx, x + w - 7, y + 8, 2, 1, P.steelDim);
  }
  // Paper piles on the desk grow with the room's clutter.
  const piles = Math.round(clamp(clutter, 0, 1) * 3);
  for (let i = 0; i < piles; i += 1) {
    box(ctx, x + w - 8 - i * 4, y + h - 10 - i, 3, 4 + i, P.paper);
    box(ctx, x + w - 8 - i * 4, y + h - 8, 3, 1, P.paperShade);
  }
}

function chair(ctx: Ctx, x: number, y: number) {
  box(ctx, x, y, 5, 4, P.outline);
  box(ctx, x + 1, y + 1, 3, 2, P.metal);
}

function drawTable(ctx: Ctx, r: Rect, room: RoomId | undefined) {
  const x = r.x * TILE;
  const y = r.y * TILE;
  const w = r.w * TILE;
  const h = r.h * TILE;
  if (room === "lab") {
    // A lab bench: steel top, a rack of tubes and a beaker.
    box(ctx, x + 1, y + 3, w - 2, h - 5, P.outline);
    box(ctx, x + 2, y + 4, w - 4, h - 7, P.metalLight);
    box(ctx, x + 2, y + 4, w - 4, 1, P.steel);
    for (let i = 0; i < Math.floor(w / 12); i += 1) {
      box(ctx, x + 6 + i * 12, y + 6, 1, 4, P.emerald);
      box(ctx, x + 8 + i * 12, y + 6, 1, 4, P.steel);
      box(ctx, x + 10 + i * 12, y + 6, 1, 4, P.amber);
    }
    return;
  }
  if (room === "conference") {
    // The long table with a chair tucked in at every other place.
    for (let i = 0; i < 6; i += 1) {
      const cx = x + 8 + i * ((w - 20) / 5);
      chair(ctx, cx, y - 1);
      chair(ctx, cx, y + h - 3);
    }
  } else {
    // A small table with a chair on each side.
    chair(ctx, x + w / 2 - 2, y - 1);
    chair(ctx, x + w / 2 - 2, y + h - 3);
    chair(ctx, x - 3, y + h / 2 - 2);
    chair(ctx, x + w - 2, y + h / 2 - 2);
  }
  box(ctx, x + 2, y + 3, w - 4, h - 5, P.outline);
  box(ctx, x + 3, y + 4, w - 6, h - 7, P.wood);
  box(ctx, x + 3, y + 4, w - 6, 1, P.woodLight);
  box(ctx, x + 3, y + h - 4, w - 6, 1, P.woodDark);
}

function drawWhiteboard(ctx: Ctx, r: Rect, room: RoomId | undefined) {
  const x = r.x * TILE;
  const y = r.y * TILE;
  const w = r.w * TILE;
  box(ctx, x + 1, y + 1, w - 2, 12, P.metalLight);
  box(ctx, x + 2, y + 2, w - 4, 10, "#d8d6d0");
  box(ctx, x + 2, y + 12, w - 4, 1, P.metal);
  if (room === "biostatistics") {
    // Axes and a curve.
    box(ctx, x + 5, y + 4, 1, 6, P.steelDim);
    box(ctx, x + 5, y + 9, w - 12, 1, P.steelDim);
    for (let i = 0; i < 6; i += 1)
      box(
        ctx,
        x + 7 + i * 3,
        y + 8 - Math.min(i, 5 - i) * 1 - (i > 2 ? 1 : 0),
        2,
        1,
        P.red
      );
  } else {
    box(ctx, x + 5, y + 4, w - 12, 1, P.steelDim);
    box(ctx, x + 5, y + 7, w - 18, 1, P.steelDim);
    box(ctx, x + 5, y + 10, w - 14, 1, P.amberDim);
  }
}

const SPINES = [
  P.red,
  P.steel,
  P.amber,
  P.emeraldDim,
  P.paperShade,
  P.steelDim,
];

function drawShelf(ctx: Ctx, r: Rect) {
  const x = r.x * TILE;
  const y = r.y * TILE;
  const w = r.w * TILE;
  box(ctx, x + 1, y + 1, w - 2, 13, P.outline);
  box(ctx, x + 2, y + 2, w - 4, 11, P.woodDark);
  for (let row = 0; row < 2; row += 1) {
    const top = y + 3 + row * 5;
    for (let bx = x + 3; bx < x + w - 4; bx += 2) {
      const n = Math.floor(tileNoise(bx, top, 9) * SPINES.length);
      const tall = 3 + Math.floor(tileNoise(bx, top, 8) * 2);
      box(ctx, bx, top + (4 - tall), 1, tall, SPINES[n]);
    }
    box(ctx, x + 2, top + 4, w - 4, 1, P.wood);
  }
}

function drawReception(ctx: Ctx, r: Rect) {
  const x = r.x * TILE;
  const y = r.y * TILE;
  const w = r.w * TILE;
  box(ctx, x + 1, y + 3, w - 2, 11, P.outline);
  box(ctx, x + 2, y + 4, w - 4, 6, P.woodLight);
  box(ctx, x + 2, y + 10, w - 4, 3, P.woodDark);
  box(ctx, x + 2, y + 4, w - 4, 1, "#5a4d3f");
  // A visitor sign-in book and a small monitor.
  box(ctx, x + 5, y + 5, 7, 4, P.paper);
  box(ctx, x + 8, y + 5, 1, 4, P.paperShade);
  drawMonitor(ctx, x + w - 12, y + 3, "plain");
}

function drawPlant(ctx: Ctx, x: number, y: number) {
  box(ctx, x + 5, y + 10, 6, 5, P.outline);
  box(ctx, x + 6, y + 10, 4, 4, "#7c5a3a");
  box(ctx, x + 6, y + 10, 4, 1, "#9a7a55");
  box(ctx, x + 4, y + 5, 3, 5, P.emeraldDim);
  box(ctx, x + 7, y + 3, 3, 7, P.emerald);
  box(ctx, x + 10, y + 6, 3, 4, P.emeraldDim);
  box(ctx, x + 7, y + 6, 1, 3, P.emeraldDim);
}

function drawFridge(ctx: Ctx, x: number, y: number) {
  box(ctx, x + 2, y + 1, 12, 14, P.outline);
  box(ctx, x + 3, y + 2, 10, 12, "#9ca3af");
  box(ctx, x + 3, y + 7, 10, 1, P.metal);
  box(ctx, x + 4, y + 4, 1, 2, P.metal);
  box(ctx, x + 4, y + 9, 1, 3, P.metal);
}

/** All furniture, in the room's own dress. */
export function drawFurniture(
  ctx: Ctx,
  map: WorldMap,
  conditions: Partial<Record<RoomId, RoomCondition>>
) {
  for (const r of furnitureRects(map)) {
    const room = roomOf(map, r.x, r.y)?.id;
    switch (r.glyph) {
      case "D":
        drawDesk(ctx, r, room, room ? (conditions[room]?.clutter ?? 0) : 0);
        break;
      case "T":
        drawTable(ctx, r, room);
        break;
      case "R":
        drawReception(ctx, r);
        break;
      case "B":
        drawShelf(ctx, r);
        break;
      case "W":
        drawWhiteboard(ctx, r, room);
        break;
      case "C": {
        const body = CAR_COLORS[(r.x * 7 + r.y * 3) % CAR_COLORS.length];
        drawCar(
          ctx,
          r.x * TILE + 2,
          r.y * TILE,
          r.w * TILE - 4,
          body,
          P.graphite
        );
        break;
      }
      default:
        break;
    }
  }
  for (let y = 0; y < map.height; y += 1)
    for (let x = 0; x < map.width; x += 1) {
      const glyph = map.rows[y][x];
      if (glyph === "P") drawPlant(ctx, x * TILE, y * TILE);
      else if (glyph === "G") drawFridge(ctx, x * TILE, y * TILE);
    }
}

// ---------------------------------------------------------------------------
// Characters.

/**
 * One character on a tile. `x`,`y` are the tile's top-left corner in logical
 * pixels and are rounded so a glide never lands between pixels.
 */
export function drawSprite(
  ctx: Ctx,
  look: Look,
  facing: Facing,
  frame: WalkFrame,
  posture: Posture,
  x: number,
  y: number
) {
  const ox = Math.round(x) + Math.floor((TILE - SPRITE_W) / 2);
  const oy = Math.round(y);
  const rects = spriteRects(look, facing, frame, posture);
  // A one-pixel dark edge first, then the colours over it.
  ctx.fillStyle = P.outline;
  for (const r of rects)
    ctx.fillRect(ox + r.x - 1, oy + r.y - 1, r.w + 2, r.h + 2);
  for (const r of rects) {
    ctx.fillStyle = r.color;
    ctx.fillRect(ox + r.x, oy + r.y, r.w, r.h);
  }
}

/** The small icon above a strained person's head. */
export function drawStrainIcon(
  ctx: Ctx,
  icon: "none" | "sweat" | "alarm",
  x: number,
  y: number
) {
  const ox = Math.round(x) + 12;
  const oy = Math.round(y) + 1;
  if (icon === "sweat") {
    box(ctx, ox, oy, 1, 1, P.steel);
    box(ctx, ox - 1, oy + 1, 3, 2, P.steel);
  } else if (icon === "alarm") {
    box(ctx, ox, oy - 1, 2, 4, P.amber);
    box(ctx, ox, oy + 4, 2, 1, P.amber);
  }
}

/** The Study Director's FINE mug, held at their side. */
export function drawMug(ctx: Ctx, x: number, y: number) {
  box(ctx, Math.round(x) + 12, Math.round(y) + 9, 4, 4, P.outline);
  box(ctx, Math.round(x) + 12, Math.round(y) + 10, 3, 3, P.paper);
  box(ctx, Math.round(x) + 13, Math.round(y) + 10, 1, 1, P.amberDim);
}

/** A small prop beside a person that says what they are doing (#1688). */
export function drawActivity(
  ctx: Ctx,
  x: number,
  y: number,
  activity: PersonPlacement["activity"]
) {
  const ox = Math.round(x);
  const oy = Math.round(y);
  if (activity === "coffee" || activity === "outside") {
    box(ctx, ox + 12, oy + 10, 4, 4, P.outline);
    box(ctx, ox + 12, oy + 11, 3, 3, P.paper);
    box(ctx, ox + 13, oy + 8, 1, 2, P.inkSoft);
  } else if (activity === "lunchAtDesk" || activity === "lunch") {
    box(ctx, ox + 11, oy + 12, 5, 3, P.outline);
    box(
      ctx,
      ox + 12,
      oy + 12,
      3,
      2,
      activity === "lunchAtDesk" ? P.amber : P.paper
    );
  }
}

// ---------------------------------------------------------------------------
// Stations.

function standingPerson(ctx: Ctx, id: StationId, x: number, y: number) {
  const look = SITE_STAFF_LOOKS[id];
  if (look) drawSprite(ctx, look, "down", 0, "upright", x, y);
}

function drawStation(ctx: Ctx, id: StationId, x: number, y: number) {
  switch (id) {
    case "edc":
      box(ctx, x + 1, y + 7, 14, 7, P.outline);
      box(ctx, x + 2, y + 8, 12, 5, P.wood);
      // A tall glowing screen over a keyboard.
      box(ctx, x + 3, y + 1, 10, 8, P.outline);
      box(ctx, x + 4, y + 2, 8, 6, P.screen);
      box(ctx, x + 5, y + 3, 5, 1, P.emerald);
      box(ctx, x + 5, y + 5, 6, 1, P.screenLight);
      box(ctx, x + 5, y + 6, 3, 1, P.emeraldDim);
      box(ctx, x + 4, y + 11, 8, 2, P.metalLight);
      break;
    case "phone":
      box(ctx, x + 2, y + 6, 12, 9, P.outline);
      box(ctx, x + 3, y + 7, 10, 7, P.metal);
      // The handset across the top, buttons below.
      box(ctx, x + 3, y + 5, 10, 3, P.outline);
      box(ctx, x + 4, y + 6, 8, 1, P.metalLight);
      for (let i = 0; i < 3; i += 1)
        for (let j = 0; j < 2; j += 1)
          box(ctx, x + 5 + i * 2, y + 9 + j * 2, 1, 1, P.paperShade);
      box(ctx, x + 12, y + 8, 1, 1, P.amber);
      break;
    case "etmf":
      box(ctx, x + 2, y + 1, 12, 14, P.outline);
      box(ctx, x + 3, y + 2, 10, 12, P.metal);
      for (let d = 0; d < 3; d += 1) {
        box(ctx, x + 3, y + 2 + d * 4, 10, 1, P.metalLight);
        box(ctx, x + 6, y + 3 + d * 4, 4, 1, P.amber);
        box(ctx, x + 7, y + 4 + d * 4, 2, 1, P.inkSoft);
      }
      break;
    case "coffee":
      box(ctx, x + 2, y + 1, 12, 14, P.outline);
      box(ctx, x + 3, y + 2, 10, 12, P.metal);
      box(ctx, x + 4, y + 3, 8, 3, P.graphite);
      box(ctx, x + 10, y + 3, 1, 1, P.amber);
      box(ctx, x + 7, y + 7, 2, 2, P.metalLight);
      box(ctx, x + 5, y + 10, 6, 1, P.metalLight);
      box(ctx, x + 6, y + 11, 3, 3, P.paper);
      box(ctx, x + 7, y + 11, 1, 1, P.amberDim);
      break;
    case "exit":
      // Your car, nose out, with an amber roof stripe.
      drawCar(ctx, x, y - 1, 16, "#a16207", P.amberDim);
      break;
    case "siteReception":
      box(ctx, x + 1, y + 7, 14, 7, P.outline);
      box(ctx, x + 2, y + 8, 12, 5, P.woodLight);
      // The service bell.
      box(ctx, x + 6, y + 5, 4, 3, P.amber);
      box(ctx, x + 5, y + 8, 6, 1, P.amberDim);
      box(ctx, x + 7, y + 4, 2, 1, P.amberDim);
      break;
    case "coordinator":
    case "pi":
      standingPerson(ctx, id, x, y);
      break;
    case "consentForms":
      box(ctx, x + 4, y + 1, 8, 14, P.outline);
      box(ctx, x + 5, y + 2, 6, 11, P.paper);
      box(ctx, x + 6, y + 1, 4, 2, P.amber);
      for (let l = 0; l < 3; l += 1)
        box(ctx, x + 6, y + 5 + l * 2, 4, 1, P.paperShade);
      break;
    case "screeningLog":
      box(ctx, x + 2, y + 5, 12, 9, P.outline);
      box(ctx, x + 3, y + 6, 10, 7, P.woodLight);
      box(ctx, x + 4, y + 4, 8, 6, P.paper);
      box(ctx, x + 8, y + 4, 1, 6, P.paperShade);
      box(ctx, x + 5, y + 6, 2, 1, P.steelDim);
      box(ctx, x + 10, y + 6, 1, 1, P.red);
      break;
    case "sourceDocuments":
      box(ctx, x + 2, y + 8, 12, 7, P.outline);
      box(ctx, x + 3, y + 9, 10, 5, "#6b5b45");
      box(ctx, x + 3, y + 9, 10, 1, "#8a775c");
      box(ctx, x + 4, y + 2, 9, 7, P.outline);
      box(ctx, x + 5, y + 3, 7, 5, "#7a6850");
      box(ctx, x + 7, y + 5, 3, 1, P.paper);
      break;
    case "regulatoryBinder":
      box(ctx, x + 2, y + 1, 12, 14, P.outline);
      box(ctx, x + 3, y + 2, 10, 12, P.woodDark);
      for (let b = 0; b < 4; b += 1) {
        box(ctx, x + 4 + b * 2, y + 3, 2, 5, SPINES[b]);
        box(ctx, x + 4 + b * 2, y + 9, 2, 4, SPINES[b + 1]);
      }
      box(ctx, x + 3, y + 8, 10, 1, P.wood);
      break;
    case "drugAccountability":
      box(ctx, x + 2, y + 1, 12, 14, P.outline);
      box(ctx, x + 3, y + 2, 10, 12, P.metalLight);
      box(ctx, x + 7, y + 4, 2, 6, P.emerald);
      box(ctx, x + 5, y + 6, 6, 2, P.emerald);
      box(ctx, x + 11, y + 11, 1, 2, P.amber);
      break;
    case "temperatureLog":
      box(ctx, x + 3, y + 1, 10, 14, P.outline);
      box(ctx, x + 4, y + 2, 8, 12, P.metal);
      box(ctx, x + 5, y + 3, 6, 3, P.graphite);
      box(ctx, x + 6, y + 4, 1, 1, P.emerald);
      box(ctx, x + 8, y + 4, 2, 1, P.emerald);
      box(ctx, x + 7, y + 8, 2, 5, P.steel);
      box(ctx, x + 7, y + 10, 2, 3, P.red);
      break;
    default:
      break;
  }
}

export function drawStations(ctx: Ctx, map: WorldMap) {
  for (const s of map.stations) drawStation(ctx, s.id, s.x * TILE, s.y * TILE);
}

/** Room names along each room's lower edge. */
export function drawLabels(ctx: Ctx, map: WorldMap) {
  ctx.font = gameFont(7, 600);
  ctx.fillStyle = P.inkSoft;
  ctx.textBaseline = "bottom";
  for (const room of map.rooms) {
    if (HALL_ROOMS.has(room.id)) continue;
    const b = room.bounds;
    ctx.fillText(
      room.name.toUpperCase(),
      b.x * TILE + 3,
      (b.y + b.height) * TILE - 2
    );
  }
}

// ---------------------------------------------------------------------------
// Set dressing: the office decaying from calm to a smoking bin (#1827).

function sheet(
  ctx: Ctx,
  x: number,
  y: number,
  tilt: number,
  color: string = P.paper
) {
  const sx = Math.round(x);
  const sy = Math.round(y);
  box(ctx, sx - 3, sy - 4, 6, 8, P.outline);
  box(ctx, sx - 2, sy - 3, 4, 6, color);
  box(ctx, sx - 1, sy - 1, 2, 1, P.paperShade);
  if (tilt > 0.2) box(ctx, sx + 2, sy - 4, 1, 1, P.outline);
}

function cup(ctx: Ctx, x: number, y: number) {
  const cx = Math.round(x);
  const cy = Math.round(y);
  box(ctx, cx - 2, cy - 2, 5, 5, P.outline);
  box(ctx, cx - 1, cy - 1, 3, 3, P.paper);
  box(ctx, cx, cy - 1, 1, 1, P.amberDim);
  box(ctx, cx + 3, cy - 1, 1, 2, P.paperShade);
}

function lamp(ctx: Ctx, x: number, y: number) {
  const lx = Math.round(x);
  const ly = Math.round(y);
  box(ctx, lx - 2, ly + 2, 5, 1, P.metal);
  box(ctx, lx, ly, 1, 2, P.metalLight);
  box(ctx, lx - 2, ly - 2, 5, 2, P.amber);
  box(ctx, lx - 1, ly - 3, 3, 1, P.amberDim);
}

/** Where your waste bin stands: by the right-hand wall of your office. */
function binSpot(map: WorldMap): { x: number; y: number } | null {
  const office = getRoom(map, "office");
  if (!office) return null;
  const b = office.bounds;
  return {
    x: (b.x + b.width - 1) * TILE + TILE / 2,
    y: (b.y + 1) * TILE + 5,
  };
}

function drawBin(
  ctx: Ctx,
  x: number,
  y: number,
  smoke: boolean,
  fire: boolean
) {
  const bx = Math.round(x);
  const by = Math.round(y);
  box(ctx, bx - 5, by, 10, 10, P.outline);
  box(ctx, bx - 4, by + 1, 8, 8, P.metal);
  box(ctx, bx - 4, by + 1, 8, 1, P.metalLight);
  box(ctx, bx - 3, by + 4, 6, 1, P.metalLight);
  if (smoke && !fire) {
    // A thin wisp rising from the paper.
    ctx.save();
    ctx.globalAlpha = 0.7;
    box(ctx, bx - 1, by - 2, 2, 2, P.inkSoft);
    box(ctx, bx, by - 5, 2, 2, P.inkSoft);
    box(ctx, bx - 1, by - 8, 2, 2, P.inkFaint);
    ctx.restore();
  }
}

/** The flames in the bin, one of three frames from the 0 to 1 phase. */
export function drawFire(
  ctx: Ctx,
  map: WorldMap,
  conditions: Partial<Record<RoomId, RoomCondition>>,
  flame: number
) {
  if (countMarks(conditions.office, "fire") <= 0) return;
  const spot = binSpot(map);
  if (!spot) return;
  const bx = Math.round(spot.x);
  const by = Math.round(spot.y);
  const frameIndex = Math.floor(clamp(flame, 0, 0.999) * 3);
  const tall = [6, 8, 7][frameIndex];
  const lean = [-1, 0, 1][frameIndex];
  box(ctx, bx - 4, by - 1, 8, 2, P.red);
  box(ctx, bx - 3 + lean, by - 1 - tall + 2, 3, tall, P.amber);
  box(ctx, bx + 1 - lean, by - tall + 3, 2, tall - 2, P.red);
  box(ctx, bx - 1, by - 3, 2, 3, P.paper);
  // Smoke above the flames.
  ctx.save();
  ctx.globalAlpha = 0.7;
  box(ctx, bx - 1 + lean, by - tall - 3, 2, 2, P.inkSoft);
  box(ctx, bx + 1, by - tall - 6, 2, 2, P.inkFaint);
  ctx.restore();
}

/**
 * The office telling the story of the study (#1691): each room's marks drawn
 * as set dressing in the same pixel art as the furniture. Rooms a map does not
 * have are skipped, so a site map draws only what it holds. The fire itself
 * is drawn each frame by `drawFire`.
 */
export function drawDressing(
  ctx: Ctx,
  map: WorldMap,
  conditions: Partial<Record<RoomId, RoomCondition>>
) {
  const n = (room: RoomId, mark: SetDressingMark) =>
    countMarks(conditions[room], mark);

  for (const room of map.rooms) {
    const lamps = n(room.id, "lateLamp");
    rectsIn(map, room, "D")
      .slice(0, lamps)
      .forEach((r) => lamp(ctx, r.x * TILE + 4, r.y * TILE + 6));
  }

  // Query printouts on the data manager's desk, spilling to the floor.
  const dm = getRoom(map, "dataManagement");
  const dmDesk = dm ? rectsIn(map, dm, "D")[0] : undefined;
  if (dmDesk) {
    const count = n("dataManagement", "printout");
    for (let i = 0; i < count; i += 1) {
      const onDesk = i < 2;
      const px = dmDesk.x * TILE + 8 + i * 6;
      const py = onDesk ? dmDesk.y * TILE + 9 : (dmDesk.y + 1) * TILE + 9;
      sheet(ctx, px, py, onDesk ? 0 : 0.4 * (i - 1), P.paper);
      if (onDesk) sheet(ctx, px + 1, py - 2, 0.1, P.paper);
    }
  }

  // The monitor's travel board, pinned on the wall above Monitoring.
  const mon = getRoom(map, "monitoring");
  if (mon) {
    const bx = mon.bounds.x * TILE + 2;
    const by = (mon.bounds.y - 1) * TILE + 2;
    const bw = 3 * TILE - 4;
    box(ctx, bx, by, bw, 13, P.outline);
    box(ctx, bx + 1, by + 1, bw - 2, 11, "#8a775c");
    const pins = n("monitoring", "travelPin");
    const spots: Array<[number, number]> = [];
    for (let i = 0; i < pins; i += 1)
      spots.push([bx + 5 + (i % 4) * 11, by + 4 + Math.floor(i / 4) * 5]);
    // The route: a thread between pins.
    for (let i = 1; i < spots.length; i += 1) {
      const [ax, ay] = spots[i - 1];
      const [cx, cy] = spots[i];
      box(
        ctx,
        Math.min(ax, cx),
        Math.min(ay, cy),
        Math.abs(cx - ax) + 1,
        1,
        P.inkSoft
      );
      box(ctx, cx, Math.min(ay, cy), 1, Math.abs(cy - ay) + 1, P.inkSoft);
    }
    for (const [sx, sy] of spots) {
      box(ctx, sx - 1, sy - 1, 3, 3, P.red);
      box(ctx, sx, sy, 1, 1, P.amber);
    }
  }

  // Folders spilling out of the regulatory filing cabinet.
  const etmf = getStation(map, "etmf");
  if (etmf) {
    const count = n(etmf.room, "fileOverflow");
    for (let i = 0; i < count; i += 1)
      sheet(
        ctx,
        (etmf.x + 1) * TILE + 3 + (i % 2) * 7,
        etmf.y * TILE + 5 + Math.floor(i / 2) * 6,
        i % 2 ? 0.5 : 0,
        P.amber
      );
  }

  // Sponsor mail at reception: envelopes on the counter, then on the floor.
  const lobby = getRoom(map, "lobby");
  const desk = lobby ? rectsIn(map, lobby, "R")[0] : undefined;
  if (desk) {
    const count = n("lobby", "sponsorMail");
    for (let i = 0; i < count; i += 1) {
      const onDesk = i < 3;
      const ex = desk.x * TILE + 6 + (onDesk ? i * 12 : (i - 3) * 10);
      const ey = onDesk ? desk.y * TILE + 8 : (desk.y + 1) * TILE + 8;
      box(ctx, ex - 4, ey - 3, 9, 6, P.outline);
      box(ctx, ex - 3, ey - 2, 7, 4, P.paper);
      box(ctx, ex - 3, ey - 2, 7, 1, P.paperShade);
      box(ctx, ex, ey - 1, 1, 1, P.red);
    }
  }

  // Crisis meetings: chairs pulled up, papers across the table, an easel.
  const conf = getRoom(map, "conference");
  const table = conf ? rectsIn(map, conf, "T")[0] : undefined;
  if (conf && table) {
    const meetings = n("conference", "crisisMeeting");
    const left = table.x * TILE;
    const width = table.w * TILE;
    for (let i = 0; i < meetings * 4; i += 1) {
      const top = i % 2 === 0;
      const slot = Math.floor(i / 2);
      const cx = left + 8 + slot * ((width - 20) / 5);
      chair(ctx, cx, top ? table.y * TILE - 5 : (table.y + table.h) * TILE + 1);
    }
    for (let i = 0; i < meetings * 2; i += 1)
      sheet(
        ctx,
        left + 14 + i * 20,
        table.y * TILE + 9,
        i % 2 ? 0.3 : 0,
        i % 2 ? P.paper : P.red
      );
    if (meetings > 0) {
      // A crisis whiteboard on an easel in the corner, covered in scrawl.
      const b = conf.bounds;
      const ex = (b.x + b.width - 3) * TILE;
      const ey = (b.y + 1) * TILE;
      box(ctx, ex, ey, 24, 18, P.outline);
      box(ctx, ex + 1, ey + 1, 22, 14, "#d8d6d0");
      box(ctx, ex + 4, ey + 4, 10, 1, P.red);
      box(ctx, ex + 4, ey + 7, 14, 1, P.steelDim);
      box(ctx, ex + 4, ey + 10, 7, 1, P.red);
      box(ctx, ex + 14, ey + 9, 5, 4, P.amber);
      box(ctx, ex + 3, ey + 15, 2, 3, P.metal);
      box(ctx, ex + 19, ey + 15, 2, 3, P.metal);
    }
  }

  // Your office: cups gather around the desk; the bin stands by the wall.
  const office = getRoom(map, "office");
  if (office) {
    const officeDesk = rectsIn(map, office, "D")[0];
    if (officeDesk) {
      const count = n("office", "cup");
      for (let i = 0; i < count; i += 1) {
        const onDesk = i < 3;
        const cx = officeDesk.x * TILE + 6 + i * 7 - (onDesk ? 0 : 18);
        const cy = onDesk
          ? officeDesk.y * TILE + 11
          : (officeDesk.y + 1) * TILE + 9;
        cup(ctx, cx, cy);
      }
    }
    const spot = binSpot(map);
    if (spot)
      drawBin(
        ctx,
        spot.x,
        spot.y,
        n("office", "smoke") > 0,
        n("office", "fire") > 0
      );
  }

  // The break room: lunches on the table, or nobody at all.
  const brk = getRoom(map, "breakRoom");
  const brkTable = brk ? rectsIn(map, brk, "T")[0] : undefined;
  if (brkTable) {
    const lunches = n("breakRoom", "lunch");
    for (let i = 0; i < lunches; i += 1) {
      const lx = brkTable.x * TILE + 7 + (i % 2) * 14;
      const ly = brkTable.y * TILE + 8 + Math.floor(i / 2) * 14;
      box(ctx, lx - 3, ly - 2, 7, 5, P.outline);
      box(ctx, lx - 2, ly - 1, 5, 3, P.paper);
      box(ctx, lx - 1, ly, 3, 1, P.emerald);
    }
  }
}

// ---------------------------------------------------------------------------
// Light.

/**
 * One composited tint over the scene for the minute of the day, plus a hard
 * edged pool of lamplight under every desk lamp once the office is dim. No
 * blur and no glow washes: flat rectangles at a low opacity.
 */
export function drawLight(
  ctx: Ctx,
  map: WorldMap,
  conditions: Partial<Record<RoomId, RoomCondition>>,
  minute: number
) {
  const tint = lightTint(minute);
  if (tint.alpha > 0) {
    ctx.save();
    ctx.globalAlpha = tint.alpha;
    box(
      ctx,
      0,
      0,
      map.width * TILE,
      map.height * TILE,
      `rgb(${tint.color.join(",")})`
    );
    ctx.restore();
  }
  if (!isAfterHours(minute)) return;
  ctx.save();
  ctx.globalAlpha = 0.14;
  for (const room of map.rooms) {
    const lamps = countMarks(conditions[room.id], "lateLamp");
    rectsIn(map, room, "D")
      .slice(0, lamps)
      .forEach((r) => {
        box(
          ctx,
          (r.x - 1) * TILE,
          (r.y - 1) * TILE + 8,
          (r.w + 2) * TILE,
          3 * TILE,
          P.amber
        );
        box(
          ctx,
          r.x * TILE - 8,
          r.y * TILE - 2,
          r.w * TILE + 16,
          2 * TILE + 4,
          P.amber
        );
      });
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Station glow.

/**
 * A station you can use right now glows: a one-pixel amber frame, drawn at
 * reduced opacity. Opacity only, never animated.
 */
export function drawStationGlow(
  ctx: Ctx,
  x: number,
  y: number,
  strong: boolean
) {
  ctx.save();
  ctx.globalAlpha = strong ? 0.9 : 0.4;
  frame(ctx, x * TILE, y * TILE, TILE, TILE, P.amber);
  ctx.restore();
}
