import { clamp, lerp } from "@/lib/game-utils";
import type {
  AuditorState,
  CDISCDomain,
  ClinicalSubject,
  OfficeId,
  PlayState,
} from "@/lib/clinical-trial-chaos";

/**
 * Pure geometry and state-to-visual mappings for the Clinical Trial Chaos
 * floor scene (#1521). Everything here is deterministic so the drawing code
 * stays thin and the layout can be unit tested without a canvas.
 */

/** Logical size of the desktop floor scene. */
export const FLOOR_LOGICAL_WIDTH = 760;
export const FLOOR_LOGICAL_HEIGHT = 260;

/** Fraction of the canvas width the player's desk takes on the left. */
export const DESK_FRACTION = 0.1;

/** Widest display that still gets the compact phone strip. */
const COMPACT_MAX_DISPLAY_WIDTH = 500;
/** Narrowest display that gets the fixed desktop logical size. */
const DESKTOP_MIN_DISPLAY_WIDTH = 640;

/**
 * Logical canvas size for a display width. Desktop (640px and up) uses one
 * fixed size, scaled to fit, so the art and hit-testing never depend on the
 * cabinet's exact width; phones keep the 13:5 compact strip they have always
 * had; tablets scale the desktop aspect to their own width.
 */
export function getConveyorLogicalSize(displayWidth: number): {
  width: number;
  height: number;
} {
  const w = Math.max(1, Math.floor(displayWidth));
  if (w >= DESKTOP_MIN_DISPLAY_WIDTH) {
    return { width: FLOOR_LOGICAL_WIDTH, height: FLOOR_LOGICAL_HEIGHT };
  }
  if (w <= COMPACT_MAX_DISPLAY_WIDTH) {
    return { width: w, height: Math.round((w * 5) / 13) };
  }
  return {
    width: w,
    height: Math.round((w * FLOOR_LOGICAL_HEIGHT) / FLOOR_LOGICAL_WIDTH),
  };
}

/** Layout of the conveyor canvas at a given logical size. */
export interface ConveyorGeometry {
  /** Phone strip: no chutes, auditor or player, just the folders. */
  compact: boolean;
  narrow: boolean;
  visibleSlots: number;
  /** Top surface of the belt; folders rest on it. */
  beltY: number;
  beltHeight: number;
  beltLeft: number;
  beltRight: number;
  subjectTop: number;
  subjectHeight: number;
  slotWidth: number;
  /** Width of one folder; it sits inside its slot with a gutter. */
  folderWidth: number;
  /** Floor line of the auditor's catwalk. */
  catwalkY: number;
  /** Top of the chute mouths below the belt. */
  chuteTop: number;
  /** Top of the visible office floor. */
  floorY: number;
}

/**
 * Layout of the conveyor canvas. The compact branch keeps the phone strip's
 * historical geometry, which the touch hit tests rely on.
 */
export function getConveyorGeometry(
  width: number,
  height: number
): ConveyorGeometry {
  const compact = width <= COMPACT_MAX_DISPLAY_WIDTH;
  if (compact) {
    const narrow = width < 280;
    const visibleSlots = narrow ? 2 : 3;
    const subjectHeight = Math.min(52, height - 36);
    const subjectTop = Math.max(30, (height - subjectHeight) / 2 + 8);
    const beltY = subjectTop + subjectHeight / 2;
    const slotWidth = (width - 70) / visibleSlots;
    return {
      compact,
      narrow,
      visibleSlots,
      beltY,
      beltHeight: Math.min(44, height - beltY - 4),
      beltLeft: 20,
      beltRight: width - 20,
      subjectTop,
      subjectHeight,
      slotWidth,
      folderWidth: slotWidth - 10,
      catwalkY: 0,
      chuteTop: height,
      floorY: height,
    };
  }

  const visibleSlots = 5;
  const beltY = Math.round(height * 0.6);
  const subjectHeight = Math.round(height * 0.19);
  const beltLeft = Math.round(width * DESK_FRACTION);
  const beltRight = width - 14;
  const slotWidth = (beltRight - beltLeft - 8) / visibleSlots;
  return {
    compact,
    narrow: false,
    visibleSlots,
    beltY,
    beltHeight: Math.round(height * 0.07),
    beltLeft,
    beltRight,
    subjectTop: beltY - subjectHeight - 1,
    subjectHeight,
    slotWidth,
    folderWidth: slotWidth - 14,
    catwalkY: Math.round(height * 0.34),
    chuteTop: beltY + Math.round(height * 0.11),
    floorY: height - Math.round(height * 0.12),
  };
}

/** Left edge of the folder in visible slot `index`. */
export function getSlotX(geometry: ConveyorGeometry, index: number): number {
  return geometry.compact
    ? 28 + index * geometry.slotWidth
    : geometry.beltLeft + 6 + index * geometry.slotWidth;
}

/**
 * The slice of the queue the canvas shows. The window follows the selected
 * subject so a selection past the visible slots (via the arrow keys or the
 * dossier) is still drawn, highlighted and tappable.
 */
export function getVisibleSubjects<T extends { id: string }>(
  subjects: T[],
  selectedId: string | null,
  visibleSlots: number
): T[] {
  const selectedIndex = subjects.findIndex((s) => s.id === selectedId);
  const start =
    selectedIndex >= visibleSlots ? selectedIndex - visibleSlots + 1 : 0;
  return subjects.slice(start, start + visibleSlots);
}

/** Index of the visible folder under a logical point, or -1. */
export function getFolderIndexAt(
  geometry: ConveyorGeometry,
  x: number,
  y: number,
  count: number
): number {
  if (
    y < geometry.subjectTop ||
    y > geometry.subjectTop + geometry.subjectHeight
  )
    return -1;
  for (let i = 0; i < count; i++) {
    const px = getSlotX(geometry, i);
    if (x >= px && x <= px + geometry.folderWidth) return i;
  }
  return -1;
}

/** One station's chute below the belt. */
interface ChuteSlot {
  /** Column left edge, matching the station strip under the canvas. */
  x: number;
  /** Column width. */
  w: number;
  /** Centre of the chute mouth. */
  cx: number;
  /** Width of the chute mouth. */
  mouth: number;
}

/**
 * Chute columns spread from `left` (the end of the player's desk) to the
 * right edge, one per station in hotkey order, so the DOM station strip
 * directly below, inset by the same fraction, lines up with them.
 */
export function getChuteSlots(
  width: number,
  count: number,
  left = 0
): ChuteSlot[] {
  if (count <= 0) return [];
  const w = (width - left) / count;
  const mouth = Math.min(w * 0.62, 92);
  return Array.from({ length: count }, (_, i) => ({
    x: left + i * w,
    w,
    cx: left + i * w + w / 2,
    mouth,
  }));
}

/** Chute index under a logical point, or -1 (desktop only). */
export function getChuteIndexAt(
  geometry: ConveyorGeometry,
  width: number,
  count: number,
  x: number,
  y: number
): number {
  if (geometry.compact || y < geometry.chuteTop - 6) return -1;
  const slots = getChuteSlots(width, count, geometry.beltLeft);
  return slots.findIndex(
    (slot) => x >= slot.cx - slot.mouth / 2 && x <= slot.cx + slot.mouth / 2
  );
}

/** A coloured domain tab on a folder. */
export interface FolderTab {
  domain: CDISCDomain;
  color: string;
}

/** Neutral tab colour for a domain no open station takes. */
export const STEEL = "#94a3b8";

/**
 * Domain tabs for a folder: each distinct observation domain once, in the
 * order the CRF lists them, coloured by its station. At most `max` show.
 */
export function getFolderTabs(
  subject: Pick<ClinicalSubject, "observations">,
  stations: readonly { id: CDISCDomain; color: string }[],
  max = 3
): FolderTab[] {
  const seen = new Set<CDISCDomain>();
  const tabs: FolderTab[] = [];
  for (const obs of subject.observations) {
    if (seen.has(obs.destination)) continue;
    seen.add(obs.destination);
    tabs.push({
      domain: obs.destination,
      color: stations.find((s) => s.id === obs.destination)?.color ?? STEEL,
    });
    if (tabs.length >= max) break;
  }
  return tabs;
}

/** The auditor's sight-cone, a triangle from the eye down onto the belt. */
interface SightCone {
  apexX: number;
  apexY: number;
  nearX: number;
  farX: number;
  /** Belt line the cone lands on. */
  baseY: number;
  color: string;
  /** Peak opacity at the apex. */
  alpha: number;
}

const CONE_COLORS: Record<AuditorState["behavior"], string> = {
  patrolling: STEEL,
  inspecting: "#cbd5e1",
  suspicious: "#f59e0b",
  issuing_483: "#ef4444",
  coffee_break: STEEL,
};

/** The auditor is drawn this much larger than the player sprite's units. */
export const AUDITOR_SCALE = 1.2;

/** Auditor's x on the catwalk, in logical pixels. */
export function getAuditorX(auditor: Pick<AuditorState, "x">, width: number) {
  return lerp(width * 0.14, width - 40, clamp(auditor.x, 0, 1));
}

/**
 * The cone the auditor casts onto the belt, or null on a coffee break. It
 * points the way they walk; inspecting narrows it and looks straight down,
 * and its colour and strength follow suspicion.
 */
export function getSightCone(
  auditor: Pick<AuditorState, "x" | "direction" | "behavior" | "suspicion">,
  geometry: ConveyorGeometry,
  width: number
): SightCone | null {
  if (geometry.compact || auditor.behavior === "coffee_break") return null;
  const ax = getAuditorX(auditor, width);
  const dir = auditor.direction >= 0 ? 1 : -1;
  const inspecting = auditor.behavior === "inspecting";
  const near = inspecting ? -18 : 6;
  const far = inspecting ? 46 : 150;
  return {
    apexX: ax + dir * 5 * AUDITOR_SCALE,
    apexY: geometry.catwalkY - 33 * AUDITOR_SCALE,
    nearX: ax + dir * near,
    farX: ax + dir * far,
    baseY: geometry.beltY,
    color: CONE_COLORS[auditor.behavior],
    alpha: clamp(0.16 + (auditor.suspicion / 100) * 0.24, 0.16, 0.4),
  };
}

/** True when a folder spanning x0..x1 on the belt sits inside the cone. */
export function isFolderInCone(
  cone: SightCone | null,
  x0: number,
  x1: number
): boolean {
  if (!cone) return false;
  const lo = Math.min(cone.nearX, cone.farX);
  const hi = Math.max(cone.nearX, cone.farX);
  return x1 >= lo && x0 <= hi;
}

/** Floor and wall treatment for one office. */
export interface OfficeFloorStyle {
  floor: "carpet" | "tile" | "glass" | "dock" | "wood";
  wall: "cubicle" | "cinder" | "curtain" | "garage" | "home";
  /** Wall base: the office's own floor tint. */
  wallBase: string;
  wallAlt: string;
  floorBase: string;
  floorAlt: string;
  /** Hairline and trim colour. */
  trim: string;
}

const OFFICE_FLOORS: Record<OfficeId, Omit<OfficeFloorStyle, "wallBase">> = {
  "cro-cubicle-farm": {
    floor: "carpet",
    wall: "cubicle",
    wallAlt: "#1c1e24",
    floorBase: "#1d1f25",
    floorAlt: "#23262d",
    trim: "#3a3d46",
  },
  "academic-basement": {
    floor: "tile",
    wall: "cinder",
    wallAlt: "#161c18",
    floorBase: "#18201b",
    floorAlt: "#202a23",
    trim: "#334036",
  },
  "pharma-glass-tower": {
    floor: "glass",
    wall: "curtain",
    wallAlt: "#0c1826",
    floorBase: "#141b24",
    floorAlt: "#1b2532",
    trim: "#2f4258",
  },
  "biotech-garage": {
    floor: "dock",
    wall: "garage",
    wallAlt: "#1d1810",
    floorBase: "#1f1c18",
    floorAlt: "#26221d",
    trim: "#4a3f2c",
  },
  "decentralized-wfh": {
    floor: "wood",
    wall: "home",
    wallAlt: "#1c1418",
    floorBase: "#2a1e17",
    floorAlt: "#231812",
    trim: "#4a3530",
  },
};

/** Floor and wall treatment for an office, tinted by its `floorColor`. */
export function getOfficeFloorStyle(
  officeId: OfficeId,
  floorColor: string
): OfficeFloorStyle {
  const style = OFFICE_FLOORS[officeId] ?? OFFICE_FLOORS["cro-cubicle-farm"];
  return { ...style, wallBase: floorColor };
}

/** A short, event-driven folder animation. */
export interface FolderFx {
  kind: "drop" | "bounce" | "expire";
  subjectId: string;
  label: string;
  isSAE: boolean;
  clean: boolean;
  tabs: FolderTab[];
  /** Folder left edge when the event happened. */
  fromX: number;
  /** Chute centre for a drop or bounce. */
  toX: number;
  startedAt: number;
  duration: number;
  /** A stamp stays on the resting folder until this time. */
  stampUntil: number;
}

/** Where a folder animation puts its folder at `now`. */
interface FolderPose {
  /** Left edge. */
  x: number;
  /** Top edge. */
  y: number;
  scale: number;
  alpha: number;
  /** Draw the red REJECTED or EXPIRED stamp. */
  stamp: boolean;
  /** The motion is over; a bounce may still hold its stamp. */
  settled: boolean;
  /** Nothing left to draw for this event. */
  done: boolean;
}

/** Durations, in ms, of each folder event at full motion. */
export const FOLDER_FX_MS = {
  drop: 520,
  bounce: 720,
  expire: 620,
  /** How long a bounced folder keeps its REJECTED stamp after landing. */
  stampHold: 1300,
} as const;

/**
 * Pose of an animated folder. A drop arcs from its slot into the chute
 * mouth and sinks in; a bounce reaches the chute, is spat back to its slot
 * and keeps a stamp; an expiry slides off the belt and fades.
 */
export function getFolderFxPose(
  fx: FolderFx,
  now: number,
  geometry: ConveyorGeometry,
  folderWidth: number
): FolderPose {
  const t = clamp((now - fx.startedAt) / Math.max(1, fx.duration), 0, 1);
  const top = geometry.subjectTop;
  const mouthY = geometry.chuteTop - 4;
  const chuteLeft = fx.toX - folderWidth / 2;

  if (fx.kind === "drop") {
    const x = lerp(fx.fromX, chuteLeft, t);
    const y = top + (mouthY - top) * t * t - 44 * t * (1 - t);
    const sink = clamp((t - 0.62) / 0.38, 0, 1);
    return {
      x,
      y,
      scale: 1 - 0.5 * sink,
      alpha: 1 - clamp((t - 0.82) / 0.18, 0, 1),
      stamp: false,
      settled: t >= 1,
      done: t >= 1,
    };
  }

  if (fx.kind === "bounce") {
    const reachX = lerp(fx.fromX, chuteLeft, 0.85);
    const lowY = mouthY - 26;
    let x: number;
    let y: number;
    if (t < 0.5) {
      const u = t / 0.5;
      x = lerp(fx.fromX, reachX, u);
      y = top + (lowY - top) * u * u - 28 * u * (1 - u);
    } else {
      const u = (t - 0.5) / 0.5;
      x = lerp(reachX, fx.fromX, u);
      y = lowY + (top - lowY) * u - 36 * u * (1 - u);
    }
    return {
      x,
      y,
      scale: 1,
      alpha: 1,
      stamp: t >= 0.5,
      settled: t >= 1,
      done: t >= 1 && now >= fx.stampUntil,
    };
  }

  // expire
  return {
    x: fx.fromX - 70 * t,
    y: top + 22 * t * t,
    scale: 1,
    alpha: 1 - t,
    stamp: true,
    settled: t >= 1,
    done: t >= 1,
  };
}

/** Verdict stamp for the end of a phase or shift. */
interface VerdictStamp {
  code: string;
  caption: string;
  tone: "good" | "warn" | "bad";
}

/**
 * The stamp that slams over the floor when a phase locks or a shift ends:
 * the inspection verdict's code (NAI, VAI or OAI), or the termination.
 */
export function getVerdictStamp(
  playState: PlayState,
  verdict: string | null | undefined,
  gameOverReason: "auditor" | "sponsor"
): VerdictStamp | null {
  if (playState === "game_over" && gameOverReason === "sponsor") {
    return { code: "VOID", caption: "Contract terminated", tone: "bad" };
  }
  if (playState !== "phase_cleared" && playState !== "game_over") return null;
  const code = verdict?.slice(0, 3);
  if (code === "NAI")
    return { code: "NAI", caption: "No action indicated", tone: "good" };
  if (code === "VAI")
    return { code: "VAI", caption: "Voluntary action indicated", tone: "warn" };
  if (code === "OAI" || playState === "game_over")
    return { code: "OAI", caption: "Form 483 issued", tone: "bad" };
  return null;
}
