/**
 * How far past its midpoint each covered card stays in view, so a click on
 * the middle of any card still lands on that card.
 */
export const CENTER_CLEARANCE_REM = 0.5;

/** The fan's tilt swings the end cards about this far past their slots. */
export const FAN_ALLOWANCE_REM = 1.5;

interface HandFit {
  /** Cards in the hand. */
  count: number;
  /** One card's width in rem (w-36 below 768px, w-40 above). */
  cardRem: number;
  /** The hand row's content width in rem; 0 when unmeasured or not fitting. */
  widthRem: number;
  /** The decorative fan may run (motion allowed at desktop widths). */
  fan: boolean;
}

/**
 * The rem each card after the first slides under its left neighbour (#1181).
 * The fan overlaps a hand past five cards a little; on top of that, a hand
 * wider than its row overlaps just enough to fit, up to half a card less
 * {@link CENTER_CLEARANCE_REM}, and only then scrolls.
 */
export function handOverlap({
  count,
  cardRem,
  widthRem,
  fan,
}: HandFit): number {
  if (count < 2) return 0;
  const fanned = fan && count > 5 ? Math.min(30, (count - 5) * 6) / 10 : 0;
  if (widthRem <= 0) return fanned;
  const room = widthRem - (fan ? FAN_ALLOWANCE_REM : 0);
  const needed = (count * cardRem - room) / (count - 1);
  const most = cardRem / 2 - CENTER_CLEARANCE_REM;
  // Round up to a tenth so the last card never pokes a pixel past the row.
  const fit = Math.min(most, Math.ceil(Math.max(0, needed) * 10) / 10);
  return Math.max(fanned, fit);
}
