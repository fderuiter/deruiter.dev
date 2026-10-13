/** The room's logical aspect: the 800x500 canvas it is drawn on. */
export const ROOM_ASPECT = 800 / 500;

/**
 * The largest room box that fits a stage on both axes, the way `object-fit:
 * contain` does: the width is the stage's, or the stage height times the
 * aspect when the stage is shorter, and the height follows the aspect. Both
 * sides are floored, so the room never exceeds the stage (#2039).
 *
 * @param stageWidth - The stage's width in CSS px.
 * @param stageHeight - The stage's height in CSS px.
 * @param aspect - The room's width over height.
 * @returns The room's width and height in CSS px, or zero for an empty stage.
 */
export function fitRoomToStage(
  stageWidth: number,
  stageHeight: number,
  aspect: number = ROOM_ASPECT
): { width: number; height: number } {
  const maxWidth = Math.floor(stageWidth);
  const maxHeight = Math.floor(stageHeight);
  if (!(maxWidth > 0) || !(maxHeight > 0) || !(aspect > 0)) {
    return { width: 0, height: 0 };
  }
  const width = Math.floor(Math.min(maxWidth, maxHeight * aspect));
  return { width, height: Math.floor(width / aspect) };
}
