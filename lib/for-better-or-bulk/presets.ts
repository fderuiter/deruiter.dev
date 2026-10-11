/**
 * For Better or Bulk: the level, the game's numbers and its copy (ADR 0060).
 *
 * Every price here is a game price against a fictional budget. The real
 * wedding's costs were approximate and appear only in `REAL_WEDDING_FACTS`,
 * which the engine never reads.
 */

import type {
  CapabilityId,
  Category,
  Commitment,
  FoodTier,
  InterruptionId,
  ItemKind,
  PlayerId,
  RoseTier,
  Setup,
  SupplyKind,
} from "./types";

/** The fictional spending cap, in whole dollars. */
export const BUDGET = 3400;

/** Venue, tux rental and dress, paid before the level starts. */
export const FIXED_COSTS: readonly {
  readonly id: string;
  readonly label: string;
  readonly dollars: number;
}[] = [
  { id: "venue", label: "Plummer House (publicly owned)", dollars: 1200 },
  { id: "tux", label: "Tux rental", dollars: 200 },
  { id: "dress", label: "Dress", dollars: 200 },
];

/** Game prices for each rose tier. */
export const ROSE_PRICES: Readonly<Record<RoseTier, number>> = {
  modest: 150,
  full: 350,
  yes: 600,
};

/** Game prices for each food tier, drinks and sheet cake included. */
export const FOOD_PRICES: Readonly<Record<FoodTier, number>> = {
  enough: 950,
  lots: 1200,
  "feed-rochester": 1450,
};

/** Game price of the bulk pack of paper lanterns. */
export const LANTERN_PRICE = 60;

/** Rose bunches in the car for each tier: exactly what its plan needs. */
export const ROSE_BUNCHES: Readonly<Record<RoseTier, number>> = {
  modest: 2,
  full: 6,
  yes: 11,
};

/** Batches of each dish in the car for each food tier. Spares are insurance. */
export const FOOD_BATCHES: Readonly<Record<FoodTier, number>> = {
  enough: 1,
  lots: 2,
  "feed-rochester": 3,
};

/** Lanterns in the bulk pack, and chair stacks the venue provides. */
export const LANTERN_COUNT = 4;
export const CHAIR_STACKS = 8;

/** A sensible starting setup: the one the tutorial text describes. */
export const DEFAULT_SETUP: Setup = {
  capabilities: ["faq", "admin"],
  cart: { roses: "full", food: "enough", lanterns: true },
  relaxed: false,
};

/** How many website features the prologue allows. */
export const CAPABILITY_PICKS = 2;

/** The four website features and what each does in the level. */
export const CAPABILITIES: Readonly<
  Record<CapabilityId, { readonly label: string; readonly summary: string }>
> = {
  faq: {
    label: "FAQ",
    summary: 'Answers "what does garden formal mean?" before anyone calls.',
  },
  admin: {
    label: "Admin page for Abbi",
    summary: "Abbi edits the site herself, so nobody phones Fred about it.",
  },
  registry: {
    label: "Registry scraper",
    summary:
      "Paste any store link; guests stop calling to ask what to get you.",
  },
  intro3d: {
    label: "Ambitious 3D intro",
    summary:
      "Rings orbit and merge into a heart. Fred's estimate: one evening.",
  },
};

/**
 * The venue, one character per tile, 20 by 12. The car is on the left, the
 * patio across the top, the lawn and ceremony on the right.
 *
 * Legend: `#` hedge, `.` ground, `H` `W` `M` `Q` hot dogs, wings, mac and
 * cheese and quinoa salad crates, `R` roses, `L` lanterns, `C` chair stacks,
 * `G` grill, `X` bin, `A` rose table, `P` petal bucket, `B` buffet, `T`
 * reception table, `S` aisle spot, `O` chair spot, `N` lantern hook, `K`
 * bouquet basket, `1` and `2` Fred's and Abbi's starting spots.
 */
export const VENUE_MAP: readonly string[] = [
  "####################",
  "#HWMQ..BBBB...N..N.#",
  "#..................#",
  "#R..GGX.AA..PP.....#",
  "#R.................#",
  "#L...1....2...OOOO.#",
  "#L.................#",
  "#C..T..T....SSSSS..#",
  "#C.................#",
  "#...T..T......OOOO.#",
  "#..N.......N.....K.#",
  "####################",
];

/** The short name painted on each crate, used on the venue and in hints. */
export const CRATE_NAMES: Readonly<Record<SupplyKind, string>> = {
  roses: "ROSE",
  "hotdogs-raw": "DOGS",
  "wings-raw": "WING",
  mac: "MAC",
  quinoa: "QUIN",
  lantern: "LAMP",
  chairs: "CHAIR",
};

/** Crate letters and what they hand out. */
export const SUPPLY_TILES: Readonly<Record<string, SupplyKind>> = {
  H: "hotdogs-raw",
  W: "wings-raw",
  M: "mac",
  Q: "quinoa",
  R: "roses",
  L: "lantern",
  C: "chairs",
};

/** What each buffet slot wants, left to right. */
export const BUFFET_ORDER: readonly ItemKind[] = [
  "hotdogs",
  "wings",
  "mac",
  "quinoa",
];

/** Tiles people can walk over. Aisle and chair spots are on the ground. */
export const WALKABLE_TILES = ".12SO";

/**
 * Level length in game seconds: 9:00 to 4:00. Relaxed mode stretches it.
 * 240 was too loose: an efficient pair finished at about 70 s (balance.md).
 */
export const LEVEL_SECONDS = 200;
export const RELAXED_LEVEL_SECONDS = 330;

/** The engine's fixed step, in seconds. */
export const TICK_SECONDS = 1 / 30;

/** Movement and reach, in tiles. */
export const MOVE_SPEED = 4.2;
export const PLAYER_RADIUS = 0.3;
export const CALM_SPEED_MULTIPLIER = 1.1;

/** Seconds of held work for each station, and the grill's timings. */
export const ARRANGE_SECONDS = 1.5;
export const PETAL_SECONDS = 1.2;
export const COOK_SECONDS = 6;
/** Was 13: a 7 s pickup window after cooking was the only cliff in the sweep. */
export const BURN_SECONDS = 16;
export const SIMPLIFY_SECONDS = 1;

/** Holding work at the bin this long throws out the item in hand. */
export const BIN_HOLD_SECONDS = 0.5;

/** At most this many items on the floor at once; Fred's drop on leaving is exempt. */
export const FLOOR_CAP = 3;

/**
 * The brothers' text lands at the later of the earliest time and the first
 * full target, and never after the latest time, which keeps it ahead of the
 * calls at 130 s and later. Level seconds. These replace the old fixed 50 s.
 */
export const BROTHERS_EARLIEST_AT = 90;
export const BROTHERS_LATEST_AT = 110;

/** How long each answer keeps Fred away, in level seconds. */
export const BREAK_SECONDS = 40;
export const LEAVE_SECONDS = 110;

/** A nervous Fred who stays re-ties his shoes this often, for this long. */
export const SHOE_INTERVAL_SECONDS = 20;
export const SHOE_SECONDS = 0.6;

/** How long a phone call freezes someone. */
export const PHONE_SECONDS = 3;

/** The interruptions: when they land, whom they freeze, and what blocks them. */
export const INTERRUPTIONS: readonly {
  readonly id: InterruptionId;
  readonly at: number;
  readonly player: PlayerId;
  readonly blockedBy: CapabilityId;
  readonly text: string;
}[] = [
  {
    id: "garden-formal",
    at: 30,
    player: "fred",
    blockedBy: "faq",
    text: "Is garden formal like... formal?",
  },
  {
    id: "parking-note",
    at: 75,
    player: "fred",
    blockedBy: "admin",
    text: "Can you change the parking note on the site?",
  },
  {
    id: "registry-ask",
    at: 95,
    player: "abbi",
    blockedBy: "registry",
    text: "What should we get you?",
  },
  {
    id: "ceremony-time",
    at: 130,
    player: "fred",
    blockedBy: "admin",
    text: "Can you fix the ceremony time on the site?",
  },
];

/** Toast shown when a website feature blocks an interruption. */
export const BLOCKED_TOASTS: Readonly<Record<CapabilityId, string>> = {
  faq: "Someone read the FAQ.",
  admin: "Abbi fixed it herself. Fred was not consulted.",
  registry: "The registry answered it.",
  intro3d: "Is it loading?",
};

/** Display labels for the receipt categories. */
export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  bouquets: "Bouquets and boutonnieres",
  centerpieces: "Centerpieces",
  petals: "Aisle petals",
  chairs: "Chairs",
  lanterns: "Lanterns",
  buffet: "Buffet",
};

/** Which receipt categories a break's promise covers. */
export const COMMITMENT_CATEGORIES: Readonly<
  Record<Commitment, readonly Category[]>
> = {
  chairs: ["chairs"],
  lanterns: ["lanterns"],
  buffet: ["buffet"],
  flowers: ["bouquets", "centerpieces", "petals"],
};

/** Display labels for carried items. */
export const ITEM_LABELS: Readonly<Record<ItemKind, string>> = {
  roses: "a bunch of Kirkland roses",
  arrangement: "a rose arrangement",
  petals: "a bucket of petals",
  "hotdogs-raw": "a pack of raw hot dogs",
  hotdogs: "a tray of hot dogs",
  "wings-raw": "a bag of raw wings",
  wings: "a tray of wings",
  mac: "a tray of mac and cheese",
  quinoa: "a bowl of quinoa salad",
  burnt: "something that used to be food",
  lantern: "a paper lantern",
  chairs: "a stack of chairs",
};

/** The prompt that marks a bin hold; the cabinet words it as a hold. */
export const THROW_OUT_PROMPT = "Throw it out";

/** The line a run prints when Fred leaves while the plan depends on him. */
export const LEFT_LINE =
  "The website was operational. My presence was requested separately.";

/** Fixed receipt lines. */
export const RECEIPT_COPY = {
  weather: "Perfect. Fred has accepted responsibility.",
  leftovers: "Some. They went to the Rochester warming shelter.",
  suit: "Fred wore the rented tux. The free suit from The Suit Wherehouse: acquired, yes. Worn, no.",
  disclaimer:
    "Game prices, not the real wedding's costs. Explanations describe this game's rules, not what would have happened at the real wedding.",
} as const;

/**
 * What really happened, as Fred and Abbi told it. These anchor the story and
 * the closing note; they never change with play.
 */
export const REAL_WEDDING_FACTS: readonly string[] = [
  "Abbi and Fred married on Friday, 10/10/25, at the Plummer House in Rochester, a publicly owned venue, for about $1,200.",
  "The whole wedding for about 100 guests came in under about $4,000, mostly from Costco: about $600 of roses and about $1,000 of food, drinks and cake.",
  "Dinner was hot dogs, wings, mac and cheese and quinoa salad, with a Kirkland sheet cake. Abbi's sister made the cake they cut.",
  "Abbi did most of the prep on Wednesday and Thursday, with friends helping, and they set up the tables and chairs themselves.",
  "The suit shop lost Fred's suit. He guilted them into a free one and wore the rented tux anyway.",
  "On Friday morning Fred was anxious and went out with his brothers, and Abbi was upset that he wasn't helping.",
  "The weather was perfect. Fred maintains this was his doing.",
  "Leftovers went to the Rochester warming shelter.",
];

/** Details the real story did not supply, filled in for play. */
export const FICTION_DEFAULTS: readonly string[] = [
  "The level squeezes Friday setup, 9:00 to 4:00, into a few minutes.",
  "The venue's layout, crates and stations are invented for play.",
  "Phone calls about the website land at made-up times.",
  "The brothers text at a made-up time, and the break and leave options are gameplay alternatives.",
  "The Suit Wherehouse is a made-up name.",
];
