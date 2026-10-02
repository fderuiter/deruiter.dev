/**
 * Room exit scoring for the roguelike campaign (#1668).
 */

/** Smallest speed bonus a room exit pays, however many moves it took. */
export const MIN_EXIT_SPEED_BONUS = 100;

/**
 * The score after reaching a room's exit: the score so far, a speed bonus of
 * 1000 less 20 per move (at least `MIN_EXIT_SPEED_BONUS`), and the crypto
 * earned in this room only. Crypto carried in from earlier rooms, or spent at
 * the Market, does not change the bonus, so each coin scores once.
 *
 * @param scoreBeforeExit - The score when the player steps onto the exit.
 * @param moves - Moves taken in this room, including the exit step.
 * @param roomCryptoEarned - Crypto earned in this room.
 * @returns The score to show on the room-cleared screen.
 */
export function computeRoomExitScore(
  scoreBeforeExit: number,
  moves: number,
  roomCryptoEarned: number
): number {
  const speedBonus = Math.max(MIN_EXIT_SPEED_BONUS, 1000 - moves * 20);
  return scoreBeforeExit + speedBonus + Math.max(0, roomCryptoEarned);
}
