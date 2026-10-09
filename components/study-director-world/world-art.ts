import type {
  Facing,
  RoomId,
  StationId,
  TileKind,
} from "@/lib/study-director-world";
import type { TeamRole } from "@/lib/study-director";

// The look of the office, as data (#1823 to #1828): the palette, which floor
// each room gets, which art every tile and station has, the light across the
// workday and the character sprites. Everything here is pure and drawn by
// `floor-art.ts`, so the choices are testable without a canvas.

/** Logical pixels per tile. Art is drawn on this grid so it stays crisp. */
export const TILE = 16;

/** The architectural graphite palette plus the semantic accents (invariant 20). */
export const PALETTE = {
  ink: "#d4d4d8",
  inkSoft: "#71717a",
  inkFaint: "#3f3f46",
  amber: "#f59e0b",
  amberDim: "#92600a",
  emerald: "#10b981",
  emeraldDim: "#0b6b4c",
  steel: "#94a3b8",
  steelDim: "#475569",
  red: "#ef4444",
  graphite: "#0d0e11",
  paper: "#e7e5e4",
  paperShade: "#a8a29e",
  outline: "#08090b",
  wallCap: "#343944",
  wallFace: "#1c1f26",
  wallHighlight: "#454b59",
  wallBase: "#121419",
  wood: "#3a3128",
  woodLight: "#4a3f33",
  woodDark: "#2a231c",
  metal: "#3b4150",
  metalLight: "#5a6275",
  screen: "#1e3a4a",
  screenLight: "#2f6f8f",
} as const;

// ---------------------------------------------------------------------------
// Floors.

/** The surface treatments a floor can have. */
type FloorPattern =
  "carpet" | "linoleum" | "tile" | "checker" | "asphalt" | "stone" | "wood";

/** A room's floor: two close tones and how they are laid. */
export interface FloorStyle {
  pattern: FloorPattern;
  base: string;
  alt: string;
  /** The grout, joint or paint line colour, when the pattern has one. */
  line: string;
}

const CARPET_GREY: FloorStyle = {
  pattern: "carpet",
  base: "#1b1e26",
  alt: "#1f232c",
  line: "#171a21",
};

/** The floor treatment of every room on the CRO floor and the site maps. */
export const ROOM_FLOORS: Record<RoomId, FloorStyle> = {
  office: {
    pattern: "wood",
    base: "#25211d",
    alt: "#2a2520",
    line: "#1d1a17",
  },
  dataManagement: CARPET_GREY,
  regulatory: {
    pattern: "carpet",
    base: "#1d1f24",
    alt: "#22252b",
    line: "#181a1f",
  },
  biostatistics: {
    pattern: "carpet",
    base: "#1a1f27",
    alt: "#1f2530",
    line: "#161a21",
  },
  medicalWriting: {
    pattern: "carpet",
    base: "#1e1d22",
    alt: "#232229",
    line: "#19181d",
  },
  programming: {
    pattern: "carpet",
    base: "#191c24",
    alt: "#1d212b",
    line: "#15171e",
  },
  corridor: {
    pattern: "linoleum",
    base: "#20242c",
    alt: "#242830",
    line: "#1a1d24",
  },
  monitoring: {
    pattern: "carpet",
    base: "#1c2025",
    alt: "#21262c",
    line: "#171a1e",
  },
  conference: {
    pattern: "wood",
    base: "#241f1b",
    alt: "#292420",
    line: "#1c1815",
  },
  breakRoom: {
    pattern: "checker",
    base: "#272b32",
    alt: "#1f2329",
    line: "#1a1d23",
  },
  lobby: {
    pattern: "stone",
    base: "#2a2b2e",
    alt: "#262729",
    line: "#202123",
  },
  parking: {
    pattern: "asphalt",
    base: "#15171b",
    alt: "#181a1f",
    line: "#101215",
  },
  coordinatorOffice: CARPET_GREY,
  recordsRoom: {
    pattern: "linoleum",
    base: "#22262d",
    alt: "#262a32",
    line: "#1b1e24",
  },
  regulatoryFiles: {
    pattern: "carpet",
    base: "#1d2024",
    alt: "#22262b",
    line: "#181a1e",
  },
  piOffice: {
    pattern: "wood",
    base: "#27221d",
    alt: "#2c2621",
    line: "#1e1a16",
  },
  siteHall: {
    pattern: "linoleum",
    base: "#20242c",
    alt: "#242830",
    line: "#1a1d24",
  },
  siteReception: {
    pattern: "carpet",
    base: "#241f20",
    alt: "#292325",
    line: "#1c1819",
  },
  pharmacy: {
    pattern: "tile",
    base: "#272c33",
    alt: "#2b3038",
    line: "#1e2228",
  },
  lab: {
    pattern: "tile",
    base: "#222a31",
    alt: "#262f37",
    line: "#1a2127",
  },
  siteParking: {
    pattern: "asphalt",
    base: "#15171b",
    alt: "#181a1f",
    line: "#101215",
  },
};

/** Rooms drawn as outdoors and as corridors, on the floor and the site maps. */
export const OUTDOOR_ROOMS: ReadonlySet<RoomId> = new Set<RoomId>([
  "parking",
  "siteParking",
]);
export const HALL_ROOMS: ReadonlySet<RoomId> = new Set<RoomId>([
  "corridor",
  "siteHall",
]);

/** A deterministic 0 to 1 value for a tile, so floors do not shimmer. */
export function tileNoise(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** Which of a style's two tones a tile takes. */
export function floorTone(style: FloorStyle, x: number, y: number): string {
  switch (style.pattern) {
    case "checker":
      return (x + y) % 2 === 0 ? style.base : style.alt;
    case "wood":
      return y % 2 === 0 ? style.base : style.alt;
    case "tile":
      return (x + y) % 2 === 0 ? style.base : style.alt;
    default:
      return tileNoise(x, y) < 0.78 ? style.base : style.alt;
  }
}

/** The look each clinical site gives its rooms, so the three feel different. */
interface SiteLook {
  /** A wash of colour over the floor tones, as RGB. */
  tint: readonly [number, number, number];
  tintAlpha: number;
  /** The accent of signs and posters. */
  accent: string;
}

const SITE_LOOKS: Record<string, SiteLook> = {
  // Quiet and anxious: cool and tidy.
  "site-01": { tint: [71, 85, 105], tintAlpha: 0.1, accent: "#94a3b8" },
  // Rule-bound: warm, laminated and orderly.
  "site-02": { tint: [146, 96, 10], tintAlpha: 0.08, accent: "#f59e0b" },
  // Understaffed: clinical and bare.
  "site-03": { tint: [16, 120, 90], tintAlpha: 0.08, accent: "#10b981" },
};

const NEUTRAL_SITE_LOOK: SiteLook = {
  tint: [71, 85, 105],
  tintAlpha: 0,
  accent: "#94a3b8",
};

/** How a map is dressed: the CRO floor is neutral, each site has its own look. */
export function siteLookFor(mapId: string): SiteLook {
  return SITE_LOOKS[mapId.replace(/^site:/, "")] ?? NEUTRAL_SITE_LOOK;
}

// ---------------------------------------------------------------------------
// Tiles and stations.

/** What a tile kind is drawn as. Every kind has an entry; a test checks it. */
export const TILE_ART: Record<TileKind, string> = {
  wall: "capped wall with a lit face",
  floor: "room floor pattern",
  door: "doorway with jambs and an open leaf",
  desk: "desk with monitor, chair and room-specific clutter",
  table: "conference, break room or lab bench",
  whiteboard: "wall whiteboard with a diagram",
  shelf: "bookshelf with coloured spines",
  reception: "reception counter with a bell",
  plant: "potted plant",
  car: "top-down parked car",
  fridge: "tall fridge",
  station: "the station's own prop",
};

/** What each station is drawn as. Every station has an entry; a test checks it. */
export const STATION_ART: Record<StationId, string> = {
  edc: "workstation with a glowing data-entry screen",
  phone: "desk phone with a handset",
  etmf: "filing cabinet with labelled drawers",
  coffee: "coffee machine with a cup",
  exit: "your car, nose out",
  siteReception: "front desk with a service bell",
  coordinator: "the site coordinator, standing",
  consentForms: "clipboard stand of consent forms",
  screeningLog: "ledger on a lectern",
  sourceDocuments: "stacked file boxes",
  regulatoryBinder: "shelf of regulatory binders",
  pi: "the principal investigator in a white coat",
  drugAccountability: "locked pharmacy cabinet with a log",
  temperatureLog: "fridge thermometer panel",
};

// ---------------------------------------------------------------------------
// Light across the workday.

/** An RGB tint and how strongly it covers the scene, 0 to 1. */
interface LightTint {
  color: readonly [number, number, number];
  alpha: number;
}

interface LightStop extends LightTint {
  minute: number;
}

const NIGHT: readonly [number, number, number] = [13, 14, 17];

/** Keyframes across the day; the tint is interpolated between them. */
const LIGHT_STOPS: readonly LightStop[] = [
  { minute: 0, color: NIGHT, alpha: 0.42 },
  { minute: 360, color: NIGHT, alpha: 0.4 },
  { minute: 420, color: [30, 41, 59], alpha: 0.2 },
  { minute: 480, color: [148, 163, 184], alpha: 0.06 },
  { minute: 720, color: [148, 163, 184], alpha: 0 },
  { minute: 960, color: [245, 158, 11], alpha: 0.04 },
  { minute: 1050, color: [245, 158, 11], alpha: 0.09 },
  { minute: 1110, color: NIGHT, alpha: 0.22 },
  { minute: 1200, color: NIGHT, alpha: 0.38 },
  { minute: 1440, color: NIGHT, alpha: 0.42 },
];

/** Alpha above which the office counts as after hours and lamps show. */
export const AFTER_HOURS_ALPHA = 0.2;

/**
 * The scene tint for a minute of the day: cool and soft in the morning,
 * clear at midday, amber in the late afternoon and dim once the office has
 * emptied. Pure: the same minute always gives the same tint, so reduced
 * motion just shows it unchanged.
 */
export function lightTint(minute: number): LightTint {
  const m = Number.isFinite(minute) ? ((minute % 1440) + 1440) % 1440 : 720;
  let next = LIGHT_STOPS.findIndex((s) => s.minute >= m);
  if (next <= 0) next = next === 0 ? 1 : LIGHT_STOPS.length - 1;
  const a = LIGHT_STOPS[next - 1];
  const b = LIGHT_STOPS[next];
  const t = b.minute === a.minute ? 0 : (m - a.minute) / (b.minute - a.minute);
  const mix = (i: 0 | 1 | 2) =>
    Math.round(a.color[i] + (b.color[i] - a.color[i]) * t);
  return {
    color: [mix(0), mix(1), mix(2)],
    alpha: Math.round((a.alpha + (b.alpha - a.alpha) * t) * 1000) / 1000,
  };
}

/** True when the tint is dark enough for desk lamps to read as lit. */
export function isAfterHours(minute: number): boolean {
  const tint = lightTint(minute);
  return tint.alpha >= AFTER_HOURS_ALPHA && minute >= 720;
}

// ---------------------------------------------------------------------------
// Characters.

/** Which of the three walk frames to show: 0 stands, 1 and 2 are the steps. */
export type WalkFrame = 0 | 1 | 2;

/**
 * The frame for a glide. A person who is not moving stands; a glide shows
 * one step, and the step alternates with each tile walked so a run of
 * moves reads as a walk. Reduced motion passes `moving` as false.
 */
export function walkFrame(stepCount: number, moving: boolean): WalkFrame {
  if (!moving) return 0;
  return Math.abs(Math.trunc(stepCount)) % 2 === 0 ? 1 : 2;
}

/** The hair shapes a character can have. */
type HairStyle = "short" | "long" | "bun" | "cap" | "bald" | "curly";

/** A character's colours and silhouette. */
export interface Look {
  hair: string;
  hairStyle: HairStyle;
  skin: string;
  shirt: string;
  pants: string;
  /** A second colour for a tie, lanyard, coat trim or badge. */
  accent: string;
  glasses: boolean;
  /** A white coat, for the investigator. */
  coat?: boolean;
}

/** The Study Director, in amber so the player is easy to find. */
export const PLAYER_LOOK: Look = {
  hair: "#3b2f2a",
  hairStyle: "short",
  skin: "#e0b48f",
  shirt: "#f59e0b",
  pants: "#1f2937",
  accent: "#fef3c7",
  glasses: false,
};

/** Every team role has its own silhouette and palette. */
export const ROLE_LOOKS: Record<TeamRole, Look> = {
  // Maya: data manager, long hair, emerald cardigan.
  dataManager: {
    hair: "#5b3a29",
    hairStyle: "long",
    skin: "#d9a67f",
    shirt: "#0b6b4c",
    pants: "#27303b",
    accent: "#10b981",
    glasses: true,
  },
  // Priya: biostatistician, bun, steel blouse.
  biostatistician: {
    hair: "#1c1917",
    hairStyle: "bun",
    skin: "#b57d58",
    shirt: "#475569",
    pants: "#1f2937",
    accent: "#94a3b8",
    glasses: true,
  },
  // Dana: regulatory, short hair, grey blazer with an amber lanyard.
  regulatory: {
    hair: "#7c5a3a",
    hairStyle: "short",
    skin: "#8d5a3b",
    shirt: "#52525b",
    pants: "#18181b",
    accent: "#f59e0b",
    glasses: false,
  },
  // Walt: monitor, cap, travel jacket.
  monitor: {
    hair: "#a1a1aa",
    hairStyle: "cap",
    skin: "#d6a98a",
    shirt: "#78716c",
    pants: "#3f3f46",
    accent: "#e7e5e4",
    glasses: false,
  },
  // Lee: medical writer, curly hair, mauve-free dusty blue sweater.
  medicalWriter: {
    hair: "#262626",
    hairStyle: "curly",
    skin: "#c68e68",
    shirt: "#3b5a7a",
    pants: "#27272a",
    accent: "#e7e5e4",
    glasses: true,
  },
  // Omar: programmer, bald, graphite hoodie.
  programmer: {
    hair: "#262626",
    hairStyle: "bald",
    skin: "#a8734f",
    shirt: "#3f3f46",
    pants: "#1c1917",
    accent: "#10b981",
    glasses: false,
  },
};

/** The site coordinator and the principal investigator at their stations. */
export const SITE_STAFF_LOOKS: Partial<Record<StationId, Look>> = {
  coordinator: {
    hair: "#3f2d20",
    hairStyle: "short",
    skin: "#d9a67f",
    shirt: "#3b82a0",
    pants: "#27303b",
    accent: "#e7e5e4",
    glasses: false,
  },
  pi: {
    hair: "#d4d4d8",
    hairStyle: "short",
    skin: "#d6a98a",
    shirt: "#e7e5e4",
    pants: "#27303b",
    accent: "#94a3b8",
    glasses: true,
    coat: true,
  },
};

/** How strained a person looks, from their room's clutter (0 to 1). */
export type Posture = "upright" | "slumped";

/** Clutter at or above this slumps a person's shoulders. */
export const SLUMP_CLUTTER = 0.5;
/** Clutter at or above this adds the alarm mark above their head. */
export const ALARM_CLUTTER = 0.8;

/** Posture and the small icon above the head, never a number. */
export function strainOf(clutter: number): {
  posture: Posture;
  icon: "none" | "sweat" | "alarm";
} {
  const c = Number.isFinite(clutter) ? clutter : 0;
  if (c >= ALARM_CLUTTER) return { posture: "slumped", icon: "alarm" };
  if (c >= SLUMP_CLUTTER) return { posture: "slumped", icon: "sweat" };
  return { posture: "upright", icon: "none" };
}

/** A filled rectangle of a sprite, in pixels from its top-left. */
interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

/** Sprite size in logical pixels; it stands on the bottom of a tile. */
export const SPRITE_W = 10;
export const SPRITE_H = 16;
/** Rows above the head reserved for a bun, a cap brim or a hat. */
const SPRITE_TOP = 2;

/**
 * A character as filled rectangles for a facing and walk frame. The outline
 * comes first, then legs, torso, arms, head and hair, so painting in order is
 * enough. Pure, so frame choice and silhouettes are testable.
 */
export function spriteRects(
  look: Look,
  facing: Facing,
  frame: WalkFrame,
  posture: Posture = "upright"
): SpriteRect[] {
  const rects: SpriteRect[] = [];
  const add = (x: number, y: number, w: number, h: number, color: string) =>
    rects.push({ x, y: y + SPRITE_TOP, w, h, color });
  const drop = posture === "slumped" ? 1 : 0;
  const side = facing === "left" || facing === "right";
  const dir = facing === "left" ? -1 : 1;

  // Legs: the stepping leg is a pixel shorter, the other plants.
  const legTop = 10;
  if (side) {
    const front = frame === 2 ? 0 : 1;
    const back = frame === 1 ? 0 : 1;
    add(3, legTop + front, 2, 3 - front, look.pants);
    add(5, legTop + back, 2, 3 - back, look.pants);
    add(3, 13, 2, 1, PALETTE.outline);
    add(5, 13, 2, 1, PALETTE.outline);
  } else {
    const left = frame === 1 ? 0 : 1;
    const right = frame === 2 ? 0 : 1;
    add(2, legTop + left, 3, 3 - left, look.pants);
    add(5, legTop + right, 3, 3 - right, look.pants);
    add(2, 13, 3, 1, PALETTE.outline);
    add(5, 13, 3, 1, PALETTE.outline);
  }

  // Torso.
  const torsoX = side ? 2 : 1;
  const torsoW = side ? 6 : 8;
  add(
    torsoX,
    5 + drop,
    torsoW,
    5 - drop,
    look.coat ? PALETTE.paper : look.shirt
  );
  if (look.coat) add(torsoX, 5 + drop, 1, 5 - drop, PALETTE.paperShade);
  // Accent: a tie or lanyard down the front, a back stripe from behind.
  if (facing === "down")
    add(4, 6 + drop, 2, 3 - drop, look.coat ? look.shirt : look.accent);
  else if (facing === "up") add(4, 5 + drop, 2, 1, look.accent);
  else add(dir === 1 ? 6 : 2, 6 + drop, 1, 2, look.accent);

  // Arms swing opposite the legs.
  const swing = frame === 0 ? 0 : frame === 1 ? 1 : -1;
  if (side) {
    add(4, 6 + drop + (swing > 0 ? 1 : 0), 2, 3, look.skin);
  } else {
    add(0, 6 + drop + (swing > 0 ? 1 : 0), 1, 3, look.skin);
    add(9, 6 + drop + (swing < 0 ? 1 : 0), 1, 3, look.skin);
  }

  // Head.
  const headX = side ? 2 + (dir === 1 ? 1 : 0) : 2;
  const headY = 1 + drop;
  add(headX, headY, 6, 5, look.skin);
  // Hair.
  const hairTop = (x: number, w: number, h = 2) =>
    add(x, headY - 1, w, h + 1, look.hair);
  switch (look.hairStyle) {
    case "bald":
      break;
    case "cap":
      add(headX - 1, headY - 1, 8, 2, look.accent);
      if (facing === "up") add(headX, headY - 1, 6, 4, look.hair);
      break;
    case "curly":
      hairTop(headX - 1, 8, 2);
      if (facing === "up") add(headX - 1, headY, 8, 4, look.hair);
      break;
    case "long":
      hairTop(headX, 6, 1);
      if (facing === "up") add(headX, headY, 6, 6, look.hair);
      else {
        add(headX - 1, headY, 1, 5, look.hair);
        add(headX + 6, headY, 1, 5, look.hair);
      }
      break;
    case "bun":
      hairTop(headX, 6, 1);
      add(headX + 2, headY - 3, 2, 2, look.hair);
      if (facing === "up") add(headX, headY, 6, 3, look.hair);
      break;
    default:
      hairTop(headX, 6, 1);
      if (facing === "up") add(headX, headY, 6, 3, look.hair);
  }
  // Face: eyes when facing the viewer or a side, glasses over them.
  if (facing === "down") {
    add(headX + 1, headY + 2, 1, 1, PALETTE.outline);
    add(headX + 4, headY + 2, 1, 1, PALETTE.outline);
    if (look.glasses) add(headX, headY + 2, 6, 1, PALETTE.inkSoft);
  } else if (side) {
    const eyeX = dir === 1 ? headX + 4 : headX + 1;
    add(eyeX, headY + 2, 1, 1, PALETTE.outline);
    if (look.glasses)
      add(dir === 1 ? headX + 3 : headX, headY + 2, 3, 1, PALETTE.inkSoft);
  }
  return rects;
}

/** The bounding box of a sprite's pixels, for silhouette comparisons. */
export function spriteBounds(rects: readonly SpriteRect[]): {
  width: number;
  height: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { width: maxX - minX, height: maxY - minY };
}
