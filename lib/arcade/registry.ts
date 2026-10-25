/**
 * The arcade game registry (#2353, ADR 0062): one list of every game, with
 * where it is listed and which of its three views are ready.
 *
 * The hub's game ring and count, the previous/next links, the hub's "Desktop
 * only" badges and the Arcade Daily's badges all derive from this list, so
 * they cannot disagree. Full titles and genres stay in `ARCADE_GAMES_METADATA`.
 *
 * `views.phone` alone decides whether a game is gated on phones: PlayCabinet
 * wraps a gated game in `DesktopOnlyGate`, and the hub, the daily panel and
 * the gate's phone picks read the same flag (#2368).
 */

/** Whether a game's view is shipped, or still behind `DesktopOnlyGate`. */
export type ArcadeViewReadiness = "ready" | "gated";

/** The orientation a game's phone view plays in (ADR 0062). */
export type ArcadePhoneOrientation = "portrait" | "landscape" | "both";

/**
 * Where a game is listed.
 *
 * - `hub`: a card in the arcade hub's game grid, counted in the game count
 *   and part of the previous/next ring.
 * - `room`: an arcade page outside the grid (Meme Vault is a page, not a
 *   cabinet).
 * - `simulators`: listed with the simulators (Protocol Drift, #1841), but its
 *   trophies and daily stay with the arcade.
 */
export type ArcadeListing = "hub" | "room" | "simulators";

/** One game in the registry. */
export interface ArcadeRegistryEntry {
  readonly slug: string;
  /**
   * The game's short name in running text, such as the phone notice and the
   * phone picks. The full title stays in `ARCADE_GAMES_METADATA`.
   */
  readonly name: string;
  readonly route: string;
  readonly listing: ArcadeListing;
  readonly views: {
    readonly desktop: ArcadeViewReadiness;
    readonly tablet: ArcadeViewReadiness;
    readonly phone: ArcadeViewReadiness;
  };
  /** Set once the game has a dedicated phone view. */
  readonly phoneOrientation?: ArcadePhoneOrientation;
  /** Takes part in the Arcade Daily (`lib/arcade/daily.ts`). */
  readonly daily: boolean;
}

const GATED_ON_PHONE = {
  desktop: "ready",
  tablet: "ready",
  phone: "gated",
} as const;

const READY_EVERYWHERE = {
  desktop: "ready",
  tablet: "ready",
  phone: "ready",
} as const;

/** Every arcade game, in hub order. */
export const ARCADE_REGISTRY = [
  {
    slug: "working-with-duck",
    name: "Working With Duck",
    route: "/arcade/working-with-duck",
    listing: "hub",
    views: GATED_ON_PHONE,
    daily: false,
  },
  {
    slug: "laser-loon",
    name: "Laser Loon",
    route: "/arcade/laser-loon",
    listing: "hub",
    views: GATED_ON_PHONE,
    daily: false,
  },
  {
    slug: "quasi-puzzler",
    name: "Quasi-Perfect Puzzler",
    route: "/arcade/quasi-puzzler",
    listing: "hub",
    views: GATED_ON_PHONE,
    daily: false,
  },
  {
    slug: "garmin-watch",
    name: "Monkey C Mayhem",
    route: "/arcade/garmin-watch",
    listing: "hub",
    views: GATED_ON_PHONE,
    daily: false,
  },
  {
    slug: "clinical-chaos",
    name: "Clinical Trial Chaos",
    route: "/arcade/clinical-chaos",
    listing: "hub",
    views: GATED_ON_PHONE,
    daily: false,
  },
  {
    slug: "trial-and-error",
    name: "Trial & Error",
    route: "/arcade/trial-and-error",
    listing: "hub",
    views: READY_EVERYWHERE,
    daily: true,
  },
  {
    slug: "study-director",
    name: "Study Director",
    route: "/arcade/study-director",
    listing: "hub",
    views: GATED_ON_PHONE,
    daily: true,
  },
  {
    slug: "patty-drive-thru",
    name: "Patty's Drive-Thru",
    route: "/arcade/patty-drive-thru",
    listing: "hub",
    views: GATED_ON_PHONE,
    daily: true,
  },
  {
    slug: "for-better-or-bulk",
    name: "For Better or Bulk",
    route: "/arcade/for-better-or-bulk",
    listing: "hub",
    views: GATED_ON_PHONE,
    daily: true,
  },
  {
    slug: "retro-labyrinth",
    name: "Retro Labyrinth",
    route: "/arcade/retro-labyrinth",
    listing: "hub",
    views: GATED_ON_PHONE,
    daily: false,
  },
  {
    slug: "meme-vault",
    name: "Meme Vault",
    route: "/arcade/meme-vault",
    listing: "room",
    views: READY_EVERYWHERE,
    daily: false,
  },
  {
    slug: "protocol-drift",
    name: "Protocol Drift",
    route: "/protocol-drift",
    listing: "simulators",
    views: GATED_ON_PHONE,
    daily: true,
  },
] as const satisfies readonly ArcadeRegistryEntry[];

/** The slug of a game in the registry. */
export type ArcadeGameSlug = (typeof ARCADE_REGISTRY)[number]["slug"];

/** The registry entry for a slug. Throws on an unknown slug. */
export function getArcadeRegistryEntry(slug: string): ArcadeRegistryEntry {
  const entry = ARCADE_REGISTRY.find((game) => game.slug === slug);
  if (!entry) throw new Error(`Unknown arcade game: ${slug}`);
  return entry;
}

/**
 * Whether a game still shows the desktop-only notice on phones. An unknown
 * slug is not gated, so a typo never hides a game.
 */
export function isPhoneGated(slug: string): boolean {
  const entry = ARCADE_REGISTRY.find((game) => game.slug === slug);
  return entry?.views.phone === "gated";
}

/**
 * The games that play on a phone, in registry order: the gate's phone picks
 * and the hub's phone note (#2368).
 */
export function phoneReadyGames(): readonly ArcadeRegistryEntry[] {
  return ARCADE_REGISTRY.filter((game) => game.views.phone === "ready");
}
