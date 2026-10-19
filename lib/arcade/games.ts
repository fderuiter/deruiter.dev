import { ARCADE_GAMES_METADATA } from "../arcade-data";
import { ARCADE_REGISTRY } from "./registry";

type HubEntry = Extract<(typeof ARCADE_REGISTRY)[number], { listing: "hub" }>;

/** A playable game route on the arcade hub. */
export type ArcadeGameRoute = HubEntry["route"];

/**
 * The playable games listed on the hub, in hub order, derived from
 * `ARCADE_REGISTRY`. Public copy that states a game count derives it from
 * this list. Meme Vault (a page) and Protocol Drift (listed with the
 * simulators, #1841) are in the registry but not on this list.
 */
export const ARCADE_GAME_ROUTES: readonly ArcadeGameRoute[] =
  ARCADE_REGISTRY.filter(
    (game): game is HubEntry => game.listing === "hub"
  ).map((game) => game.route);

/** Number of playable games on the arcade hub. */
export const ARCADE_GAME_COUNT: number = ARCADE_GAME_ROUTES.length;

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
