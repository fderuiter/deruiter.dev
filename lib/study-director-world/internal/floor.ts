import { SITE_GLYPHS, SITE_MAPS } from "./site-maps";
import type {
  Room,
  RoomId,
  Station,
  StationId,
  TileKind,
  TilePoint,
  WorldMap,
} from "../types";

/**
 * The CRO floor, 40 by 22 tiles. Departments along the top, the corridor,
 * shared rooms and the lobby below it, and the car park outside.
 *
 * Legend: `#` wall, `.` floor, `+` door, `D` desk, `T` conference table,
 * `W` whiteboard, `B` bookshelf, `R` reception desk, `P` plant, `C` parked
 * car, `G` fridge. Stations: `E` EDC workstation, `H` phone, `F` eTMF,
 * `K` coffee machine, `X` your car (the way home).
 */
const CRO_ROWS = [
  "########################################",
  "#......#......#F....#..WW.#BBB..#......#",
  "#.DDH..#.DD.DD#.DD..#.DD..#.DD..#.DD.DD#",
  "#......#......#.....#.....#.....#......#",
  "#...E..#.DD...#.....#.....#.....#.DD...#",
  "#......#......#.....#.....#.....#......#",
  "####+######+#####+#####+#####+#####+####",
  "#P....................................P#",
  "#......................................#",
  "####+##########+##########+########+####",
  "#........#............#K.......#.......#",
  "#.DD..DD.#..TTTTTTTT..#........#RRR....#",
  "#........#............#..TT....#.......#",
  "#.DD.....#............#..TT....#P.....P#",
  "#........#............#.......G#.......#",
  "###################################+####",
  "#......................................#",
  "#..CC....CC....CC....CC................#",
  "#......................................#",
  "#..CC....CC....CC....CC.......X........#",
  "#......................................#",
  "########################################",
] as const;

const TILE_KINDS: Record<string, TileKind> = {
  "#": "wall",
  ".": "floor",
  "+": "door",
  D: "desk",
  T: "table",
  W: "whiteboard",
  B: "shelf",
  R: "reception",
  P: "plant",
  C: "car",
  G: "fridge",
  E: "station",
  H: "station",
  F: "station",
  K: "station",
  X: "station",
  ...Object.fromEntries(
    Object.values(SITE_GLYPHS).map((glyph) => [glyph, "station" as const])
  ),
};

type CroStationId = Exclude<StationId, keyof typeof SITE_GLYPHS>;

const STATION_GLYPHS: Record<CroStationId, string> = {
  edc: "E",
  phone: "H",
  etmf: "F",
  coffee: "K",
  exit: "X",
};

function room(
  id: RoomId,
  name: string,
  bounds: [number, number, number, number],
  anchor: [number, number],
  blurb: string,
  extra: Pick<Room, "department"> & { seats?: Array<[number, number]> } = {}
): Room {
  const [x, y, width, height] = bounds;
  return {
    id,
    name,
    bounds: { x, y, width, height },
    anchor: { x: anchor[0], y: anchor[1] },
    department: extra.department,
    seats: (extra.seats ?? []).map(([sx, sy]) => ({ x: sx, y: sy })),
    blurb,
  };
}

const CRO_ROOMS: Room[] = [
  room(
    "office",
    "Your office",
    [1, 1, 6, 5],
    [4, 5],
    "Your office: a desk, a phone and the EDC workstation."
  ),
  room(
    "dataManagement",
    "Data Management",
    [8, 1, 6, 5],
    [11, 5],
    "Data Management, where queries are raised and closed.",
    {
      department: "dataManager",
      seats: [
        [9, 3],
        [12, 3],
        [11, 4],
      ],
    }
  ),
  room(
    "regulatory",
    "Regulatory",
    [15, 1, 5, 5],
    [17, 5],
    "Regulatory, home of the eTMF and the submission calendar.",
    {
      department: "regulatory",
      seats: [
        [16, 3],
        [18, 3],
        [16, 4],
      ],
    }
  ),
  room(
    "biostatistics",
    "Biostatistics",
    [21, 1, 5, 5],
    [23, 5],
    "Biostatistics, with a whiteboard of power calculations.",
    {
      department: "biostatistician",
      seats: [
        [22, 3],
        [24, 3],
        [22, 4],
      ],
    }
  ),
  room(
    "medicalWriting",
    "Medical Writing",
    [27, 1, 5, 5],
    [29, 5],
    "Medical Writing, lined with protocol binders.",
    {
      department: "medicalWriter",
      seats: [
        [28, 3],
        [30, 3],
        [28, 4],
      ],
    }
  ),
  room(
    "programming",
    "Programming",
    [33, 1, 6, 5],
    [35, 5],
    "Programming, where the datasets and tables are built.",
    {
      department: "programmer",
      seats: [
        [34, 3],
        [37, 3],
        [36, 4],
      ],
    }
  ),
  room(
    "corridor",
    "Corridor",
    [1, 7, 38, 2],
    [20, 8],
    "The corridor that joins every room on the floor."
  ),
  room(
    "monitoring",
    "Monitoring",
    [1, 10, 8, 5],
    [4, 10],
    "Monitoring, where the CRAs plan site visits.",
    {
      department: "monitor",
      seats: [
        [2, 12],
        [6, 12],
        [4, 13],
      ],
    }
  ),
  room(
    "conference",
    "Conference room",
    [10, 10, 12, 5],
    [15, 10],
    "The conference room, for sponsor calls and team meetings."
  ),
  room(
    "breakRoom",
    "Break room",
    [23, 10, 8, 5],
    [26, 10],
    "The break room: a coffee machine, a table and a fridge."
  ),
  room(
    "lobby",
    "Lobby",
    [32, 10, 7, 5],
    [35, 12],
    "The lobby, with the reception desk and the doors out."
  ),
  room(
    "parking",
    "Parking",
    [1, 16, 38, 5],
    [35, 16],
    "The car park. Your car is the way home."
  ),
];

function station(
  id: CroStationId,
  name: string,
  roomId: RoomId,
  blurb: string
): Station {
  const glyph = STATION_GLYPHS[id];
  const y = CRO_ROWS.findIndex((row) => row.includes(glyph));
  return { id, name, room: roomId, x: CRO_ROWS[y].indexOf(glyph), y, blurb };
}

const CRO_STATIONS: Station[] = [
  station(
    "edc",
    "EDC workstation",
    "office",
    "Shows the open queries the sites report."
  ),
  station("phone", "Phone", "office", "Shows the messages waiting for you."),
  station(
    "etmf",
    "eTMF",
    "regulatory",
    "Shows how much of what you decided is on file."
  ),
  station(
    "coffee",
    "Coffee machine",
    "breakRoom",
    "Restores energy and focus, up to a point."
  ),
  station("exit", "Your car", "parking", "Ends the working day."),
];

/** The CRO floor (ADR 0055): the first walkable map. */
export const CRO_FLOOR: WorldMap = {
  id: "cro-floor",
  width: 40,
  height: 22,
  rows: CRO_ROWS,
  rooms: CRO_ROOMS,
  stations: CRO_STATIONS,
  spawn: { x: 35, y: 12, facing: "up" },
};

/** Every map the world knows, by id: the CRO floor and the three sites. */
export const WORLD_MAPS: Readonly<Record<string, WorldMap>> = {
  [CRO_FLOOR.id]: CRO_FLOOR,
  ...SITE_MAPS,
};

/** What is at a tile. Anything off the map is wall. */
export function tileAt(map: WorldMap, x: number, y: number): TileKind {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return "wall";
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return "wall";
  return TILE_KINDS[map.rows[y]?.[x] ?? "#"] ?? "wall";
}

/** True for floor and doors: the only tiles anyone can stand on. */
export function isWalkable(map: WorldMap, x: number, y: number): boolean {
  const kind = tileAt(map, x, y);
  return kind === "floor" || kind === "door";
}

/** The room whose interior holds a tile, or null for walls and doorways. */
export function roomAt(map: WorldMap, x: number, y: number): Room | null {
  for (const r of map.rooms) {
    const b = r.bounds;
    if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height)
      return r;
  }
  return null;
}

/** A room by id, or null. */
export function getRoom(map: WorldMap, id: string): Room | null {
  return map.rooms.find((r) => r.id === id) ?? null;
}

/** The station drawn on a tile, or null. */
export function stationAt(map: WorldMap, x: number, y: number): Station | null {
  return map.stations.find((s) => s.x === x && s.y === y) ?? null;
}

/** A station by id, or null. */
export function getStation(map: WorldMap, id: string): Station | null {
  return map.stations.find((s) => s.id === id) ?? null;
}

/** The tile one step from `from` in a direction. */
export function stepFrom(
  from: TilePoint,
  facing: "up" | "down" | "left" | "right"
): TilePoint {
  switch (facing) {
    case "up":
      return { x: from.x, y: from.y - 1 };
    case "down":
      return { x: from.x, y: from.y + 1 };
    case "left":
      return { x: from.x - 1, y: from.y };
    default:
      return { x: from.x + 1, y: from.y };
  }
}
