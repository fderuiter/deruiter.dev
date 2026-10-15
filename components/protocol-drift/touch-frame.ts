/**
 * Touch canvas framing (#2045). The canvas frames the chips, never the empty
 * world: Fit and the resize fit frame the chips (or the tabulation lane when
 * there are none), and after a toolbox add the view fits the chips when they
 * all fit at a legible zoom, or pans the least needed to show the new chip.
 */
import type { Viewport } from "@xyflow/react";
import { LANE_GEOMETRY, type ChipKind } from "@/lib/protocol-drift";
import {
  CHIP_WIDTH,
  chipHeight,
  touchZoomFloor,
  type ChipNode,
} from "./graph-model";

/** Canvas width of the lane world (chips and lane bands). */
export const WORLD_WIDTH = 1340;
/** Screen margin kept around framed chips. */
const PAD = 24;
/** Screen space kept clear under the touch canvas for the wire bar. */
const BOTTOM_PAD = 64;
/**
 * Desktop: the lowest zoom the automatic framing uses. Chip titles still
 * render at about 10px, so the whole tracer pipeline stays in view on the
 * docked 1024 canvas beside the open toolbox (#2274).
 */
export const DESKTOP_FRAME_FLOOR = 0.65;

/** The zoom floor the automatic framing respects. */
function frameFloor(touch: boolean): number {
  return touch ? touchZoomFloor() : DESKTOP_FRAME_FLOOR;
}

/** Screen space kept clear under the canvas: the wire bar only on touch. */
function bottomPad(touch: boolean): number {
  return touch ? BOTTOM_PAD : PAD;
}

interface FrameSize {
  width: number;
  height: number;
}

/** The part of the React Flow instance the framing uses. */
export interface FrameFlow {
  fitView(options: {
    nodes?: { id: string }[];
    padding?: number;
    duration?: number;
    minZoom?: number;
    maxZoom?: number;
  }): unknown;
  setViewport(viewport: Viewport, options?: { duration?: number }): unknown;
  getViewport(): Viewport;
}

/** The on-screen size of a canvas element (zero when it is not laid out). */
export function sizeOf(el: Element | null): FrameSize {
  if (!(el instanceof HTMLElement)) return { width: 0, height: 0 };
  return { width: el.clientWidth, height: el.clientHeight };
}

/** The smallest of a list of numbers. */
function lowest(values: number[]): number {
  return values.reduce((a, b) => (b < a ? b : a));
}

function usable(size: FrameSize): boolean {
  return size.width >= 10 && size.height >= 10;
}

/** The box that holds every chip, in canvas units. */
function chipsBox(nodes: ChipNode[]): {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
} {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const node of nodes) {
    x0 = Math.min(x0, node.position.x);
    y0 = Math.min(y0, node.position.y);
    x1 = Math.max(x1, node.position.x + CHIP_WIDTH);
    y1 = Math.max(y1, node.position.y + chipHeight(node.data.kind));
  }
  return { x0, y0, x1, y1 };
}

/** The zoom at which every chip fits on screen, capped at 1. */
export function fitZoomFor(
  nodes: ChipNode[],
  size: FrameSize,
  touch = true
): number {
  if (nodes.length === 0 || !usable(size)) return 0;
  const box = chipsBox(nodes);
  return lowest([
    1,
    (size.width - PAD * 2) / Math.max(box.x1 - box.x0, 1),
    (size.height - PAD - bottomPad(touch)) / Math.max(box.y1 - box.y0, 1),
  ]);
}

/** Frames the chips at a legible zoom; centres on them when they do not fit. */
export function frameChips(
  flow: FrameFlow,
  nodes: ChipNode[],
  touch = true
): void {
  if (nodes.length === 0) return;
  flow.fitView({
    nodes: nodes.map((node) => ({ id: node.id })),
    padding: 0.06,
    duration: 0,
    minZoom: frameFloor(touch),
    maxZoom: 1,
  });
}

/** Frames the tabulation lane when the pipeline is empty. */
export function frameLane(
  flow: FrameFlow,
  size: FrameSize,
  touch = true
): void {
  if (!usable(size)) return;
  const top = LANE_GEOMETRY.tabulationTop - 16;
  const bottom = LANE_GEOMETRY.conservationWallY + 16;
  const fit = lowest([
    1,
    (size.width - PAD * 2) / WORLD_WIDTH,
    (size.height - PAD - bottomPad(touch)) / (bottom - top),
  ]);
  const zoom = Math.max(frameFloor(touch), fit);
  // Centre the lane when it fits; otherwise keep its top-left corner, where
  // the lane label sits and the first chip goes, on screen.
  const centredX = size.width / 2 - (WORLD_WIDTH / 2) * zoom;
  const centredY =
    (size.height - bottomPad(touch)) / 2 - ((top + bottom) / 2) * zoom;
  flow.setViewport(
    {
      x: Math.max(centredX, PAD),
      y: Math.max(centredY, PAD - top * zoom),
      zoom,
    },
    { duration: 0 }
  );
}

/** Pans the least needed to bring a chip fully on screen, at the same zoom. */
export function ensureVisible(
  flow: FrameFlow,
  size: FrameSize,
  chip: { x: number; y: number; kind: ChipKind },
  touch = true
): void {
  const viewport = flow.getViewport();
  const zoom = viewport.zoom;
  const width = CHIP_WIDTH * zoom;
  const height = chipHeight(chip.kind) * zoom;
  const left = chip.x * zoom + viewport.x;
  const top = chip.y * zoom + viewport.y;
  let dx = 0;
  let dy = 0;
  if (left < PAD) dx = PAD - left;
  else if (left + width > size.width - PAD)
    dx = size.width - PAD - (left + width);
  if (top < PAD) dy = PAD - top;
  else if (top + height > size.height - bottomPad(touch))
    dy = size.height - bottomPad(touch) - (top + height);
  if (dx !== 0 || dy !== 0) {
    flow.setViewport(
      { x: viewport.x + dx, y: viewport.y + dy, zoom },
      { duration: 0 }
    );
  }
}

/**
 * After a toolbox add: fit the chips when they all fit at a legible zoom,
 * otherwise pan just enough to show the new chip at the current zoom.
 */
export function frameAfterAdd(
  flow: FrameFlow,
  size: FrameSize,
  nodes: ChipNode[],
  added: { kind: ChipKind; x: number; y: number },
  touch = true
): void {
  if (!usable(size)) {
    frameChips(flow, nodes, touch);
    return;
  }
  if (fitZoomFor(nodes, size, touch) >= frameFloor(touch)) {
    frameChips(flow, nodes, touch);
    return;
  }
  ensureVisible(flow, size, added, touch);
}
