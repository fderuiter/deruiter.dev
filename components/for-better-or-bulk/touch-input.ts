/**
 * The touch dock's side of the For Better or Bulk input (#2123). The dock
 * presses the same keyboard codes `input.ts` reads, so `buildFrame` and a
 * shared run code never know whether a key or a finger moved someone.
 */

import type { PlayerId } from "@/lib/for-better-or-bulk";

/** The codes one person's dock presses, and the keys it names for them. */
export interface TouchKeySet {
  readonly player: PlayerId;
  readonly up: string;
  readonly down: string;
  readonly left: string;
  readonly right: string;
  readonly interact: string;
  readonly work: string;
  readonly interactShortcut: string;
  readonly workShortcut: string;
}

/** Fred's dock presses his keyboard keys, Abbi's presses hers. */
export const TOUCH_KEYS: Readonly<Record<PlayerId, TouchKeySet>> = {
  fred: {
    player: "fred",
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    interact: "KeyE",
    work: "KeyF",
    interactShortcut: "E",
    workShortcut: "F",
  },
  abbi: {
    player: "abbi",
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    interact: "Enter",
    work: "ShiftRight",
    interactShortcut: "Enter",
    workShortcut: "Shift",
  },
};

/** How far from the centre, as a share of the pad's radius, a finger must rest to walk. */
export const STICK_DEAD_ZONE = 0.22;

/**
 * The direction keys a finger on the drag pad holds, from where it rests
 * relative to the pad's centre (in units of the pad's radius, y down). Inside
 * the dead zone it holds none. Outside, the angle is snapped to one of eight
 * directions, so a diagonal holds two keys and a near-straight drag one.
 *
 * @param x - Horizontal offset from the centre, in pad radii.
 * @param y - Vertical offset from the centre, in pad radii, positive down.
 * @param keys - The person's codes.
 * @returns The codes to hold, at most two.
 */
export function stickCodes(
  x: number,
  y: number,
  keys: TouchKeySet
): readonly string[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
  if (Math.hypot(x, y) < STICK_DEAD_ZONE) return [];
  // Eight sectors of 45 degrees, centred on the axes and the diagonals.
  const sector = Math.round(Math.atan2(y, x) / (Math.PI / 4));
  const step = ((sector % 8) + 8) % 8;
  const dx = [1, 1, 0, -1, -1, -1, 0, 1][step]!;
  const dy = [0, 1, 1, 1, 0, -1, -1, -1][step]!;
  const codes: string[] = [];
  if (dy < 0) codes.push(keys.up);
  if (dy > 0) codes.push(keys.down);
  if (dx < 0) codes.push(keys.left);
  if (dx > 0) codes.push(keys.right);
  return codes;
}
