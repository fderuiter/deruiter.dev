import { ArcadeEngine, applyCanvasScale } from "@/lib/arcade";
import { clamp } from "@/lib/game-utils";
import {
  countMarks,
  getRoom,
  getStation,
  stepFrom,
  tileAt,
  type Facing,
  type PersonPlacement,
  type PlayerState,
  type RoomCondition,
  type Room,
  type RoomId,
  type SetDressingMark,
  type StationId,
  type TilePoint,
  type WorldMap,
} from "@/lib/study-director-world";

/** Logical pixels per tile. The canvas is drawn in logical units. */
export const TILE = 20;

/** Seconds a glide between two tiles takes. */
const GLIDE_SECONDS = 0.11;

const INK = "#d4d4d8";
const INK_SOFT = "#71717a";
const INK_FAINT = "#3f3f46";
const AMBER = "#f59e0b";
const STEEL = "#94a3b8";
const GRAPHITE = "#0d0e11";
const FLOOR = "#13151a";
const CORRIDOR = "#161920";
const WALL = "#1c1f26";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const PAPER = "#e7e5e4";
const RED = "#ef4444";
/** Seconds per flicker cycle of the bin fire. */
const FLAME_SECONDS = 0.6;

/** Everything the floor view draws. */
export interface FloorScene {
  map: WorldMap;
  player: PlayerState;
  people: readonly PersonPlacement[];
  conditions: Partial<Record<RoomId, RoomCondition>>;
  /** The tile the player is facing, highlighted when it holds a target. */
  target: TilePoint | null;
}

interface Glide {
  from: TilePoint;
  progress: number;
  /** Where each person who moved one tile started, by member id. */
  people?: Map<string, TilePoint>;
}

interface Rect {
  glyph: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const MERGED = new Set(["D", "T", "R", "B", "C", "W"]);

/** Rooms drawn as outdoors and as corridors, on the floor and the site maps. */
const OUTDOORS = new Set<RoomId>(["parking", "siteParking"]);
const HALLS = new Set<RoomId>(["corridor", "siteHall"]);

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

function strokeRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color = INK
) {
  ctx.strokeStyle = color;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function line(
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>,
  color = INK
) {
  ctx.strokeStyle = color;
  ctx.beginPath();
  points.forEach(([px, py], i) =>
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  );
  ctx.stroke();
}

function drawGround(ctx: CanvasRenderingContext2D, map: WorldMap) {
  ctx.fillStyle = GRAPHITE;
  ctx.fillRect(0, 0, map.width * TILE, map.height * TILE);
  for (const room of map.rooms) {
    const b = room.bounds;
    ctx.fillStyle = OUTDOORS.has(room.id)
      ? GRAPHITE
      : HALLS.has(room.id)
        ? CORRIDOR
        : FLOOR;
    ctx.fillRect(b.x * TILE, b.y * TILE, b.width * TILE, b.height * TILE);
  }
  // Parking bays.
  const parking = map.rooms.find((r) => OUTDOORS.has(r.id));
  if (parking) {
    ctx.lineWidth = 1;
    for (let y = 0; y < map.height; y += 1)
      for (let x = 0; x < map.width; x += 1)
        if (map.rows[y][x] === "C" && map.rows[y][x - 1] !== "C") {
          line(
            ctx,
            [
              [x * TILE - 4, y * TILE - 2],
              [x * TILE - 4, (y + 1) * TILE + 2],
            ],
            INK_FAINT
          );
          line(
            ctx,
            [
              [(x + 2) * TILE + 4, y * TILE - 2],
              [(x + 2) * TILE + 4, (y + 1) * TILE + 2],
            ],
            INK_FAINT
          );
        }
  }
}

function drawWalls(ctx: CanvasRenderingContext2D, map: WorldMap) {
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const kind = tileAt(map, x, y);
      if (kind === "wall") {
        ctx.fillStyle = WALL;
        ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        const px = x * TILE;
        const py = y * TILE;
        // Ink only the faces that look into a room, like a floor plan.
        if (y > 0 && tileAt(map, x, y - 1) !== "wall")
          line(ctx, [
            [px, py],
            [px + TILE, py],
          ]);
        if (y < map.height - 1 && tileAt(map, x, y + 1) !== "wall")
          line(ctx, [
            [px, py + TILE],
            [px + TILE, py + TILE],
          ]);
        if (x > 0 && tileAt(map, x - 1, y) !== "wall")
          line(ctx, [
            [px, py],
            [px, py + TILE],
          ]);
        if (x < map.width - 1 && tileAt(map, x + 1, y) !== "wall")
          line(ctx, [
            [px + TILE, py],
            [px + TILE, py + TILE],
          ]);
      } else if (kind === "door") {
        const px = x * TILE;
        const py = y * TILE;
        ctx.fillStyle = FLOOR;
        ctx.fillRect(px, py, TILE, TILE);
        // A door swing: the leaf and its quarter arc.
        ctx.lineWidth = 1;
        line(
          ctx,
          [
            [px + 2, py + TILE],
            [px + 2, py + 2],
          ],
          INK_SOFT
        );
        ctx.strokeStyle = INK_FAINT;
        ctx.beginPath();
        ctx.arc(px + 2, py + TILE, TILE - 4, -Math.PI / 2, 0);
        ctx.stroke();
        ctx.lineWidth = 1.5;
      }
    }
  }
}

function drawFurniture(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  conditions: Partial<Record<RoomId, RoomCondition>>
) {
  ctx.lineWidth = 1.25;
  for (const r of furnitureRects(map)) {
    const x = r.x * TILE;
    const y = r.y * TILE;
    const w = r.w * TILE;
    const h = r.h * TILE;
    switch (r.glyph) {
      case "D": {
        ctx.fillStyle = "#1a1d24";
        ctx.fillRect(x + 2, y + 3, w - 4, h - 6);
        strokeRect(ctx, x + 2, y + 3, w - 4, h - 6);
        // A monitor on each desk tile.
        for (let i = 0; i < r.w; i += 1)
          strokeRect(ctx, x + i * TILE + 6, y + 6, 8, 5, INK_SOFT);
        const room = map.rooms.find(
          (m) =>
            r.x >= m.bounds.x &&
            r.x < m.bounds.x + m.bounds.width &&
            r.y >= m.bounds.y &&
            r.y < m.bounds.y + m.bounds.height
        );
        const clutter = room ? (conditions[room.id]?.clutter ?? 0) : 0;
        const stacks = Math.round(clamp(clutter, 0, 1) * 3);
        for (let i = 0; i < stacks; i += 1)
          line(
            ctx,
            [
              [x + w - 7 - i * 4, y + h - 6],
              [x + w - 7 - i * 4, y + h - 10 - i],
            ],
            "#e7e5e4"
          );
        break;
      }
      case "T":
        ctx.fillStyle = "#1a1d24";
        ctx.beginPath();
        ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 6);
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
        break;
      case "R":
        ctx.fillStyle = "#1a1d24";
        ctx.fillRect(x + 1, y + 4, w - 2, h - 8);
        strokeRect(ctx, x + 1, y + 4, w - 2, h - 8);
        line(ctx, [
          [x + 1, y + h - 8],
          [x + w - 1, y + h - 8],
        ]);
        break;
      case "B":
        strokeRect(ctx, x + 1, y + 1, w - 2, h - 8);
        for (let bx = x + 5; bx < x + w - 2; bx += 4)
          line(
            ctx,
            [
              [bx, y + 3],
              [bx, y + h - 9],
            ],
            INK_SOFT
          );
        break;
      case "W":
        strokeRect(ctx, x + 2, y + 1, w - 4, 6);
        line(
          ctx,
          [
            [x + 6, y + 5],
            [x + 12, y + 3],
            [x + 18, y + 5],
            [x + 26, y + 3],
          ],
          AMBER
        );
        break;
      case "C":
        ctx.beginPath();
        ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 5);
        ctx.strokeStyle = INK_SOFT;
        ctx.stroke();
        line(
          ctx,
          [
            [x + 12, y + 5],
            [x + 12, y + h - 5],
          ],
          INK_FAINT
        );
        break;
      default:
        break;
    }
  }
  for (let y = 0; y < map.height; y += 1)
    for (let x = 0; x < map.width; x += 1) {
      const glyph = map.rows[y][x];
      const px = x * TILE;
      const py = y * TILE;
      if (glyph === "P") {
        ctx.strokeStyle = INK_SOFT;
        ctx.beginPath();
        ctx.arc(px + 10, py + 13, 4, 0, Math.PI * 2);
        ctx.stroke();
        line(
          ctx,
          [
            [px + 10, py + 9],
            [px + 6, py + 3],
          ],
          "#10b981"
        );
        line(
          ctx,
          [
            [px + 10, py + 9],
            [px + 14, py + 4],
          ],
          "#10b981"
        );
      } else if (glyph === "G") {
        strokeRect(ctx, px + 3, py + 1, 14, 18);
        line(ctx, [
          [px + 3, py + 8],
          [px + 17, py + 8],
        ]);
      }
    }
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

/** A sheet of paper, slightly turned. */
function sheet(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tilt: number,
  color = PAPER
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.fillStyle = GRAPHITE;
  ctx.fillRect(-3, -4, 6, 8);
  strokeRect(ctx, -3, -4, 6, 8, color);
  ctx.restore();
}

function cup(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.lineWidth = 1;
  strokeRect(ctx, x - 2, y - 2, 5, 5, PAPER);
  ctx.strokeStyle = PAPER;
  ctx.beginPath();
  ctx.arc(x + 3.5, y + 0.5, 1.5, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
}

/** A lamp left on: a small amber shade over the desk's corner. */
function lamp(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.lineWidth = 1.25;
  line(
    ctx,
    [
      [x - 3, y + 2],
      [x - 1.5, y - 2],
      [x + 1.5, y - 2],
      [x + 3, y + 2],
      [x - 3, y + 2],
    ],
    AMBER
  );
  line(
    ctx,
    [
      [x, y + 2],
      [x, y + 5],
    ],
    INK_SOFT
  );
}

/**
 * The waste bin in your office, by the right-hand wall. `flame` is the
 * flicker phase, 0 to 1; a still fire (reduced motion) is drawn at 0.
 */
function drawBin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  smoke: boolean,
  fire: boolean,
  flame: number
) {
  ctx.lineWidth = 1.25;
  line(
    ctx,
    [
      [x - 4, y],
      [x - 3, y + 8],
      [x + 3, y + 8],
      [x + 4, y],
      [x - 4, y],
    ],
    INK
  );
  if (fire) {
    const sway = Math.sin(flame * Math.PI * 2) * 1.5;
    const lift = Math.cos(flame * Math.PI * 2) * 1;
    line(
      ctx,
      [
        [x - 4, y],
        [x - 3 + sway, y - 5 - lift],
        [x - 1, y - 2],
        [x + sway * 0.5, y - 9 + lift],
        [x + 1.5, y - 2],
        [x + 3 - sway, y - 6 - lift],
        [x + 4, y],
      ],
      AMBER
    );
    line(
      ctx,
      [
        [x - 1.5, y],
        [x + sway * 0.3, y - 4 + lift],
        [x + 1.5, y],
      ],
      RED
    );
  }
  if (smoke) {
    const top = fire ? y - 11 : y - 3;
    ctx.lineWidth = 1;
    line(
      ctx,
      [
        [x, top],
        [x - 2, top - 3],
        [x + 1, top - 6],
        [x - 1, top - 9],
      ],
      INK_SOFT
    );
  }
}

/**
 * The office telling the story of the study (#1691): each room's marks
 * drawn as set dressing in the same ink line as the furniture. Rooms a map
 * does not have are skipped, so a site map draws only what it holds.
 */
function drawDressing(
  ctx: CanvasRenderingContext2D,
  map: WorldMap,
  conditions: Partial<Record<RoomId, RoomCondition>>,
  flame: number
) {
  const n = (room: RoomId, mark: SetDressingMark) =>
    countMarks(conditions[room], mark);

  // Lamps left on wherever someone stays late.
  for (const room of map.rooms) {
    const lamps = n(room.id, "lateLamp");
    rectsIn(map, room, "D")
      .slice(0, lamps)
      .forEach((r) => lamp(ctx, r.x * TILE + 5, r.y * TILE + 2));
  }

  // Query printouts on the data manager's desk, spilling to the floor.
  const dm = getRoom(map, "dataManagement");
  const dmDesk = dm ? rectsIn(map, dm, "D")[0] : undefined;
  if (dmDesk) {
    const count = n("dataManagement", "printout");
    for (let i = 0; i < count; i += 1) {
      const onDesk = i < 2;
      const px = dmDesk.x * TILE + 8 + i * 7;
      const py = onDesk ? dmDesk.y * TILE + 12 : (dmDesk.y + 1) * TILE + 6;
      sheet(ctx, px, py, onDesk ? -0.1 * i : 0.4 * (i - 2), PAPER);
      if (onDesk) sheet(ctx, px + 1, py - 2, 0.1, PAPER);
    }
  }

  // The monitor's travel board, on the wall above Monitoring.
  const mon = getRoom(map, "monitoring");
  if (mon) {
    const bx = mon.bounds.x * TILE + 2;
    const by = (mon.bounds.y - 1) * TILE + 3;
    const bw = 3 * TILE - 4;
    ctx.fillStyle = "#1a1d24";
    ctx.fillRect(bx, by, bw, 14);
    ctx.lineWidth = 1;
    strokeRect(ctx, bx, by, bw, 14, INK);
    const pins = n("monitoring", "travelPin");
    const spots: Array<[number, number]> = [];
    for (let i = 0; i < pins; i += 1)
      spots.push([bx + 6 + (i % 3) * 18, by + 4 + Math.floor(i / 3) * 6]);
    if (spots.length > 1) line(ctx, spots, INK_SOFT);
    for (const [sx, sy] of spots) {
      ctx.fillStyle = AMBER;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Folders spilling out of the regulatory filing cabinet.
  const etmf = getStation(map, "etmf");
  if (etmf) {
    const count = n(etmf.room, "fileOverflow");
    for (let i = 0; i < count; i += 1)
      sheet(
        ctx,
        (etmf.x + 1) * TILE + 4 + (i % 2) * 8,
        etmf.y * TILE + 6 + Math.floor(i / 2) * 7,
        (i % 2 ? 0.5 : -0.35) + i * 0.1,
        AMBER
      );
  }

  // Sponsor mail at reception: envelopes on the desk, then on the floor.
  const lobby = getRoom(map, "lobby");
  const desk = lobby ? rectsIn(map, lobby, "R")[0] : undefined;
  if (desk) {
    const count = n("lobby", "sponsorMail");
    for (let i = 0; i < count; i += 1) {
      const onDesk = i < 3;
      const ex = desk.x * TILE + 8 + (onDesk ? i * 15 : (i - 3) * 12);
      const ey = onDesk ? desk.y * TILE + 9 : (desk.y + 1) * TILE + 6;
      ctx.lineWidth = 1;
      ctx.fillStyle = GRAPHITE;
      ctx.fillRect(ex - 4, ey - 3, 9, 6);
      strokeRect(ctx, ex - 4, ey - 3, 9, 6, PAPER);
      line(
        ctx,
        [
          [ex - 4, ey - 3],
          [ex + 0.5, ey + 0.5],
          [ex + 5, ey - 3],
        ],
        PAPER
      );
    }
  }

  // Crisis meetings: chairs pulled up to the table and papers across it.
  const conf = getRoom(map, "conference");
  const table = conf ? rectsIn(map, conf, "T")[0] : undefined;
  if (table) {
    const meetings = n("conference", "crisisMeeting");
    const chairs = meetings * 4;
    const left = table.x * TILE;
    const width = table.w * TILE;
    for (let i = 0; i < chairs; i += 1) {
      const top = i % 2 === 0;
      const slot = Math.floor(i / 2);
      const cx = left + 10 + slot * ((width - 20) / 5);
      const cy = top ? table.y * TILE - 3 : (table.y + table.h) * TILE + 3;
      ctx.lineWidth = 1;
      ctx.strokeStyle = INK_SOFT;
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < meetings * 2; i += 1)
      sheet(
        ctx,
        left + 16 + i * 22,
        table.y * TILE + 10,
        i % 2 ? 0.3 : -0.2,
        i % 2 ? PAPER : RED
      );
  }

  // Your office: coffee cups gather around the desk, and the bin.
  const office = getRoom(map, "office");
  if (office) {
    const officeDesk = rectsIn(map, office, "D")[0];
    if (officeDesk) {
      const count = n("office", "cup");
      for (let i = 0; i < count; i += 1) {
        const onDesk = i < 3;
        const cx = officeDesk.x * TILE + 6 + i * 8 - (onDesk ? 0 : 20);
        const cy = onDesk
          ? officeDesk.y * TILE + 13
          : (officeDesk.y + 1) * TILE + 6;
        cup(ctx, cx, cy);
      }
    }
    const b = office.bounds;
    drawBin(
      ctx,
      (b.x + b.width - 1) * TILE + TILE / 2,
      (b.y + 1) * TILE + 6,
      n("office", "smoke") > 0,
      n("office", "fire") > 0,
      flame
    );
  }

  // The break room: lunches on the table, or nobody at all.
  const brk = getRoom(map, "breakRoom");
  const brkTable = brk ? rectsIn(map, brk, "T")[0] : undefined;
  if (brkTable) {
    const lunches = n("breakRoom", "lunch");
    for (let i = 0; i < lunches; i += 1) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = PAPER;
      ctx.beginPath();
      ctx.arc(
        brkTable.x * TILE + 10 + (i % 2) * 20,
        brkTable.y * TILE + 10 + Math.floor(i / 2) * 20,
        3.5,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  }
}

/** True when a scene has a burning bin to animate. */
export function sceneHasFire(scene: Pick<FloorScene, "conditions">): boolean {
  return Object.values(scene.conditions).some((c) => countMarks(c, "fire") > 0);
}

function drawStation(
  ctx: CanvasRenderingContext2D,
  id: StationId,
  px: number,
  py: number
) {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = AMBER;
  switch (id) {
    case "edc":
      strokeRect(ctx, px + 3, py + 3, 14, 10, AMBER);
      line(
        ctx,
        [
          [px + 10, py + 13],
          [px + 10, py + 16],
        ],
        AMBER
      );
      line(
        ctx,
        [
          [px + 6, py + 17],
          [px + 14, py + 17],
        ],
        AMBER
      );
      line(
        ctx,
        [
          [px + 6, py + 7],
          [px + 14, py + 7],
        ],
        INK_SOFT
      );
      line(
        ctx,
        [
          [px + 6, py + 10],
          [px + 11, py + 10],
        ],
        INK_SOFT
      );
      break;
    case "phone":
      ctx.beginPath();
      ctx.roundRect(px + 4, py + 7, 12, 9, 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px + 10, py + 8, 6, Math.PI, 0);
      ctx.stroke();
      break;
    case "etmf":
      strokeRect(ctx, px + 4, py + 2, 12, 16, AMBER);
      line(
        ctx,
        [
          [px + 4, py + 7],
          [px + 16, py + 7],
        ],
        AMBER
      );
      line(
        ctx,
        [
          [px + 4, py + 12],
          [px + 16, py + 12],
        ],
        AMBER
      );
      break;
    case "coffee":
      strokeRect(ctx, px + 4, py + 2, 12, 16, AMBER);
      strokeRect(ctx, px + 7, py + 11, 6, 5, INK);
      line(
        ctx,
        [
          [px + 7, py + 6],
          [px + 13, py + 6],
        ],
        INK_SOFT
      );
      break;
    case "coordinator":
    case "pi":
      // Site staff stand at their station: an outlined figure with an initial.
      ctx.strokeStyle = STEEL;
      ctx.beginPath();
      ctx.arc(px + 10, py + 10, 6.5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = `700 8px ${MONO}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = STEEL;
      ctx.fillText(id === "pi" ? "P" : "C", px + 10, py + 10.5);
      ctx.textAlign = "start";
      break;
    case "siteReception":
      // A bell on the desk.
      ctx.beginPath();
      ctx.arc(px + 10, py + 13, 5, Math.PI, 0);
      ctx.stroke();
      line(
        ctx,
        [
          [px + 4, py + 14],
          [px + 16, py + 14],
        ],
        AMBER
      );
      break;
    case "temperatureLog":
      // A thermometer.
      strokeRect(ctx, px + 8, py + 2, 4, 12, AMBER);
      ctx.beginPath();
      ctx.arc(px + 10, py + 16, 3, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case "consentForms":
    case "screeningLog":
    case "sourceDocuments":
    case "regulatoryBinder":
    case "drugAccountability":
      // Paper: a page with ruled lines.
      strokeRect(ctx, px + 4, py + 2, 12, 16, AMBER);
      for (let ly = 6; ly <= 14; ly += 4)
        line(
          ctx,
          [
            [px + 7, py + ly],
            [px + 13, py + ly],
          ],
          INK_SOFT
        );
      break;
    case "exit":
      ctx.beginPath();
      ctx.roundRect(px + 1, py + 4, 18, 12, 4);
      ctx.stroke();
      line(
        ctx,
        [
          [px + 6, py + 4],
          [px + 6, py + 16],
        ],
        AMBER
      );
      break;
    default:
      break;
  }
}

function drawStations(ctx: CanvasRenderingContext2D, map: WorldMap) {
  for (const s of map.stations) drawStation(ctx, s.id, s.x * TILE, s.y * TILE);
}

function drawLabels(ctx: CanvasRenderingContext2D, map: WorldMap) {
  ctx.font = `600 8px ${MONO}`;
  ctx.fillStyle = INK_SOFT;
  ctx.textBaseline = "bottom";
  for (const room of map.rooms) {
    if (HALLS.has(room.id)) continue;
    const b = room.bounds;
    ctx.fillText(
      room.name.toUpperCase(),
      b.x * TILE + 3,
      (b.y + b.height) * TILE - 2
    );
  }
}

const FACING_VECTOR: Record<Facing, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

function drawFigure(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  facing: Facing,
  color: string,
  initial: string,
  filled: boolean,
  mug = false
) {
  const [fx, fy] = FACING_VECTOR[facing];
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = color;
  ctx.fillStyle = filled ? color : FLOOR;
  ctx.beginPath();
  ctx.arc(cx, cy, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // A short tick for the way they face.
  line(
    ctx,
    [
      [cx + fx * 7, cy + fy * 7],
      [cx + fx * 10, cy + fy * 10],
    ],
    color
  );
  ctx.font = `700 8px ${MONO}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = filled ? GRAPHITE : color;
  ctx.fillText(initial, cx, cy + 0.5);
  ctx.textAlign = "start";
  // The Study Director always carries the FINE mug.
  if (mug) cup(ctx, cx + 8, cy + 4);
}

/** A small prop beside a person that says what they are doing (#1688). */
function drawActivity(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  activity: PersonPlacement["activity"]
) {
  ctx.lineWidth = 1;
  if (activity === "coffee" || activity === "outside") {
    // A cup with a wisp of steam.
    strokeRect(ctx, cx + 6, cy - 2, 5, 6, INK);
    line(
      ctx,
      [
        [cx + 8, cy - 4],
        [cx + 9, cy - 7],
      ],
      INK_SOFT
    );
  } else if (activity === "lunchAtDesk" || activity === "lunch") {
    // A plate.
    ctx.strokeStyle = activity === "lunchAtDesk" ? AMBER : INK_SOFT;
    ctx.beginPath();
    ctx.ellipse(cx + 9, cy + 5, 3.5, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Draws the CRO floor in the ink-line style of the office illustration on a
 * Canvas 2D context, on top of the shared arcade engine. It renders on
 * demand: a frame is drawn when the scene changes, and the loop only runs
 * while the player glides between tiles. Under reduced motion there is no
 * glide, so the player steps from tile to tile and no loop runs at all.
 */
export class FloorRenderer extends ArcadeEngine<FloorScene, null> {
  private glide: Glide | null = null;
  private scale = 1;
  private reducedMotion = false;
  /** Flicker phase of the bin fire, 0 to 1. Stays 0 under reduced motion. */
  private flame = 0;

  public init(): void {}

  public createSnapshot(): null {
    return null;
  }

  /** Backing-store pixels per logical unit, from `computeCanvasResolution`. */
  public setScale(scale: number): void {
    this.scale = scale;
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    if (reduced) {
      this.glide = null;
      this.flame = 0;
    }
  }

  /**
   * Replaces the scene. A one-tile move glides unless motion is reduced;
   * anything else (a turn, a jump, a new day) is drawn in place.
   */
  public setScene(scene: FloorScene): void {
    const prev = this.state.player;
    const dist =
      Math.abs(prev.x - scene.player.x) + Math.abs(prev.y - scene.player.y);
    // People walking their schedules glide too, one tile per player step.
    const people = new Map<string, TilePoint>();
    for (const p of scene.people) {
      const was = this.state.people.find((q) => q.memberId === p.memberId);
      if (was && Math.abs(was.x - p.x) + Math.abs(was.y - p.y) === 1)
        people.set(p.memberId, { x: was.x, y: was.y });
    }
    this.glide =
      (dist === 1 || people.size > 0) && !this.reducedMotion
        ? {
            from: dist === 1 ? { x: prev.x, y: prev.y } : scene.player,
            progress: 0,
            people,
          }
        : null;
    this.state = scene;
  }

  /** True while a glide is in progress and frames are needed. */
  public isMoving(): boolean {
    return this.glide !== null;
  }

  /**
   * True while frames are needed: a glide, or a burning bin. The fire only
   * flickers when motion is allowed; under reduced motion it is drawn still
   * and the loop does not run for it.
   */
  public isAnimating(): boolean {
    return (
      this.glide !== null || (!this.reducedMotion && sceneHasFire(this.state))
    );
  }

  public update(dt: number): void {
    if (!this.reducedMotion && sceneHasFire(this.state))
      this.flame = (this.flame + dt / FLAME_SECONDS) % 1;
    if (!this.glide) return;
    this.glide.progress += dt / GLIDE_SECONDS;
    if (this.glide.progress >= 1) {
      this.glide = null;
      this.emit("settled", null);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    const { map, player, people, conditions, target } = this.state;
    applyCanvasScale(ctx, this.scale);
    drawGround(ctx, map);
    drawWalls(ctx, map);
    drawFurniture(ctx, map, conditions);
    drawDressing(ctx, map, conditions, this.flame);
    drawStations(ctx, map);
    drawLabels(ctx, map);
    if (target) {
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      strokeRect(ctx, target.x * TILE, target.y * TILE, TILE, TILE, AMBER);
      ctx.setLineDash([]);
    }
    const t = this.glide ? Math.min(1, this.glide.progress) : 1;
    for (const p of people) {
      const start = this.glide?.people?.get(p.memberId) ?? p;
      const cx = (start.x + (p.x - start.x) * t) * TILE + TILE / 2;
      const cy = (start.y + (p.y - start.y) * t) * TILE + TILE / 2;
      drawFigure(
        ctx,
        cx,
        cy,
        p.facing,
        STEEL,
        p.name.charAt(0).toUpperCase(),
        false
      );
      drawActivity(ctx, cx, cy, p.activity);
    }
    const from = this.glide?.from ?? player;
    const px = from.x + (player.x - from.x) * t;
    const py = from.y + (player.y - from.y) * t;
    drawFigure(
      ctx,
      px * TILE + TILE / 2,
      py * TILE + TILE / 2,
      player.facing,
      AMBER,
      "",
      true,
      true
    );
  }
}

/** The tile in front of the player, if it holds a person or a station. */
export function highlightedTile(
  map: WorldMap,
  player: PlayerState,
  people: readonly PersonPlacement[]
): TilePoint | null {
  const front = stepFrom(player, player.facing);
  if (people.some((p) => p.x === front.x && p.y === front.y)) return front;
  return tileAt(map, front.x, front.y) === "station" ? front : null;
}
