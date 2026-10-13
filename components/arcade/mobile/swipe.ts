/** A cardinal direction a swipe can name. */
export type SwipeDirection = "up" | "down" | "left" | "right";

/** Shortest drag, in CSS pixels, that counts as a swipe. Shorter drags are taps. */
export const SWIPE_THRESHOLD_PX = 24;

/**
 * Names the direction of a drag. The dominant axis wins, so a mostly
 * horizontal drag with some vertical wobble still reads as a horizontal swipe.
 *
 * @param dx - Horizontal distance from pointer down to pointer up.
 * @param dy - Vertical distance, positive downwards.
 * @param threshold - Minimum distance on the dominant axis.
 * @returns The direction, or null for a tap or a drag too short to count.
 */
export function swipeDirection(
  dx: number,
  dy: number,
  threshold: number = SWIPE_THRESHOLD_PX
): SwipeDirection | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < threshold) return null;
  if (ax > ay) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}
