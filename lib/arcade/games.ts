import { ARCADE_GAMES_METADATA } from "../arcade-data";

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
  "/arcade/patty-drive-thru",
  "/arcade/retro-labyrinth",
] as const;

/** Number of playable games on the arcade hub. */
export const ARCADE_GAME_COUNT: number = ARCADE_GAME_ROUTES.length;

/** A playable game route on the arcade hub. */
export type ArcadeGameRoute = (typeof ARCADE_GAME_ROUTES)[number];

/** A neighbouring game in the arcade's previous/next ring. */
export interface ArcadeNeighbor {
  title: string;
  href: string;
  label: string;
  tag: string;
}

function toNeighbor(route: ArcadeGameRoute, label: string): ArcadeNeighbor {
  const game = ARCADE_GAMES_METADATA.find((g) => g.route === route);
  return {
    title: game?.title ?? route,
    href: route,
    label,
    tag: game?.genre ?? "Arcade Game",
  };
}

/**
 * The previous and next games for a game page, in hub order and wrapping at
 * both ends, so every game (Trial & Error and Study Director included) sits in
 * one ring that matches the hub (#1330).
 */
export function getArcadeNeighbors(route: ArcadeGameRoute): {
  prev: ArcadeNeighbor;
  next: ArcadeNeighbor;
} {
  const index = ARCADE_GAME_ROUTES.indexOf(route);
  const count = ARCADE_GAME_ROUTES.length;
  return {
    prev: toNeighbor(
      ARCADE_GAME_ROUTES[(index - 1 + count) % count],
      "Previous Game"
    ),
    next: toNeighbor(ARCADE_GAME_ROUTES[(index + 1) % count], "Next Game"),
  };
}
