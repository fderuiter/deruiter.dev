/**
 * Single source of truth for the playable arcade games listed on the hub.
 * Public copy that states a game count derives it from this list.
 */
export const ARCADE_GAME_ROUTES = [
  "/arcade/working-with-duck",
  "/arcade/laser-loon",
  "/arcade/quasi-puzzler",
  "/arcade/garmin-watch",
  "/arcade/clinical-chaos",
  "/arcade/trial-and-error",
  "/arcade/study-director",
  "/arcade/retro-labyrinth",
] as const;

/** Number of playable games on the arcade hub. */
export const ARCADE_GAME_COUNT: number = ARCADE_GAME_ROUTES.length;
