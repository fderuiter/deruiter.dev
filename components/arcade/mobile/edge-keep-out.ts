/**
 * The edge keep-out (#2545): in landscape, a drag that starts this close to
 * the left or right screen edge can be taken by the browser as a back swipe
 * (iOS Safari) or a back gesture (Android). Interactive drag origins, such as
 * a dock's stick, sit at least this far in from both edges, measured inside
 * the safe area.
 *
 * The dock presets (#2359) and the mobile harness's thumb-zone check (#2365)
 * read this one value. Until they land, it is the number they start from.
 */
export const EDGE_KEEP_OUT_PX = 24;

/**
 * Whether a point is inside the edge keep-out of a viewport `width` wide.
 *
 * @param x - The point's x in CSS px, from the viewport's left edge.
 * @param width - The viewport width in CSS px.
 * @param insetLeft - The left safe-area inset in CSS px. Defaults to 0.
 * @param insetRight - The right safe-area inset in CSS px. Defaults to 0.
 * @returns True when a drag starting there could be taken as a back swipe.
 */
export function inEdgeKeepOut(
  x: number,
  width: number,
  insetLeft = 0,
  insetRight = 0
): boolean {
  return (
    x < insetLeft + EDGE_KEEP_OUT_PX ||
    x > width - insetRight - EDGE_KEEP_OUT_PX
  );
}
