/**
 * Chip placement for the workbench. Pure: no React, no store, no DOM. The
 * desktop and touch views share one search, `findChipSpot`, and differ only
 * in the mode they pass (#2471).
 */
import { CHIP_SPECS, LANE_GEOMETRY, type ChipKind } from "@/lib/protocol-drift";
import {
  CHIP_WIDTH,
  chipHeight,
  clampChip,
  type ChipNode,
} from "../graph-model";
import { WORLD_WIDTH } from "../touch-frame";

/** Where a clicked or keyboard-added chip lands. */
function suggestPosition(
  kind: ChipKind,
  nodes: ChipNode[]
): { x: number; y: number } {
  const lane = CHIP_SPECS[kind].lane;
  const n = nodes.filter(
    (node) => CHIP_SPECS[node.data.kind].lane === lane
  ).length;
  const x = 40 + ((n * 190) % 1100);
  if (lane === "ANALYSIS")
    return { x, y: LANE_GEOMETRY.conservationWallY + 90 };
  if (lane === "WALL")
    return { x, y: LANE_GEOMETRY.conservationWallY - chipHeight(kind) - 4 };
  return { x, y: LANE_GEOMETRY.tabulationTop + 30 + (n % 3) * 40 };
}

/** Empty space kept between chips when a new one is placed on touch. */
const CHIP_GAP = 16;

/** True when a chip of this kind at this spot would touch a chip already there. */
function clashes(
  kind: ChipKind,
  spot: { x: number; y: number },
  nodes: ChipNode[]
): boolean {
  const h = chipHeight(kind);
  return nodes.some((node) => {
    const other = node.data.kind;
    const otherH = chipHeight(other);
    return (
      spot.x < node.position.x + CHIP_WIDTH + CHIP_GAP &&
      node.position.x < spot.x + CHIP_WIDTH + CHIP_GAP &&
      spot.y < node.position.y + otherH + CHIP_GAP &&
      node.position.y < spot.y + h + CHIP_GAP
    );
  });
}

/**
 * Touch: the first spot for a new chip that clears every existing chip's box.
 * It steps along the lane's row, then down to the next row, until it is clear
 * (#2045). Desktop uses desktopChipSpot.
 */
export function touchChipSpot(
  kind: ChipKind,
  nodes: ChipNode[]
): { x: number; y: number } {
  const base = suggestPosition(kind, nodes);
  const stepX = CHIP_WIDTH + CHIP_GAP;
  const stepY = chipHeight(kind) + CHIP_GAP;
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const spot = clampChip(kind, {
        x: base.x + col * stepX,
        y: base.y + row * stepY,
      });
      if (!clashes(kind, spot, nodes)) return spot;
    }
  }
  // The 6 by 7 grid is full, so fall back to the desktop scan, which keeps
  // going down and across the lane. Clamping the base here could land a chip
  // on top of one already placed (found by the placement property test).
  return desktopChipSpot(kind, nodes);
}

/** Vertical step of the desktop spot search, in canvas pixels. */
const DESKTOP_SCAN_STEP_Y = 8;
/** Columns tried past the lane world before giving up on a clear spot. */
const DESKTOP_EXTRA_COLUMNS = 24;

/**
 * Desktop: the first spot for a new chip that clears every existing chip's
 * box (#2324). It scans the chip's lane top to bottom, one column of chips at
 * a time across the lane world, so the chips fill the lane in rows. When the
 * lane is full it continues to the right of the world, never on top of a
 * chip; a player can still drag any chip anywhere.
 */
function desktopChipSpot(
  kind: ChipKind,
  nodes: ChipNode[]
): { x: number; y: number } {
  const base = clampChip(kind, suggestPosition(kind, []));
  const lowest = clampChip(kind, {
    x: base.x,
    y: LANE_GEOMETRY.analysisBottom,
  }).y;
  const stepX = CHIP_WIDTH + CHIP_GAP;
  const columns = Math.floor((WORLD_WIDTH - base.x - CHIP_WIDTH) / stepX) + 1;
  for (let y = base.y; y <= lowest; y += DESKTOP_SCAN_STEP_Y) {
    for (let col = 0; col < columns; col++) {
      const spot = clampChip(kind, { x: base.x + col * stepX, y });
      if (!clashes(kind, spot, nodes)) return spot;
    }
  }
  for (let col = columns; col < columns + DESKTOP_EXTRA_COLUMNS; col++) {
    const spot = clampChip(kind, { x: base.x + col * stepX, y: base.y });
    if (!clashes(kind, spot, nodes)) return spot;
  }
  return clampChip(kind, suggestPosition(kind, nodes));
}

/** The two placement searches: touch steps along rows, desktop fills lanes. */
export type ChipSpotMode = "touch" | "desktop";

/**
 * The first clear spot for a new chip of this kind, in the given mode. The
 * result never overlaps a chip already in `nodes`, unless the lane is full.
 */
export function findChipSpot(
  kind: ChipKind,
  nodes: ChipNode[],
  options: { mode: ChipSpotMode }
): { x: number; y: number } {
  return options.mode === "touch"
    ? touchChipSpot(kind, nodes)
    : desktopChipSpot(kind, nodes);
}
