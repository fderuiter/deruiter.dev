/**
 * For Better or Bulk: the level, the game's numbers and its copy (ADR 0060).
 *
 * Every price here is a game price against a fictional budget. The real
 * wedding's costs were approximate and are not in this module; the engine
 * never reads the real facts beyond the line bank's [Real] lines.
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

/** Lanterns in the bulk pack, and the chairs the venue provides (one per chair spot). */
export const LANTERN_COUNT = 4;
export const CHAIR_COUNT = 8;
/** Chairs one carry takes off the crate: a stack of two, or one when only one is left. */
export const CHAIRS_PER_CARRY = 2;

/** A sensible starting setup: the one the tutorial text describes. */
export const DEFAULT_SETUP: Setup = {
  capabilities: ["faq", "admin"],
  cart: { roses: "full", food: "enough", lanterns: true },
  relaxed: false,
  assist: false,
  seed: 0,
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
 * cheese and quinoa salad crates, `R` roses, `L` lanterns, `C` chairs,
 * `G` grill, `X` bin, `A` rose table, `P` petal bucket, `B` buffet, `T`
 * reception table, `S` aisle spot, `O` chair spot, `N` lantern hook, `K`
 * bouquet basket, `1` and `2` Fred's and Abbi's starting spots.
 */
export const VENUE_MAP: readonly string[] = [
  "####################",
  "#HWMQ..BBBB...N..NL#",
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

/**
 * Tiles people can walk over: ground, the two aisle spots, and nothing else.
 * Chair spots (O) are solid (ADR 0060 amendment, 2026-10-12): a person walking
 * into an empty one stays on the floor and faces it.
 */
export const WALKABLE_TILES = ".12S";

/**
 * Level length in game seconds: 9:00 to 4:00. Relaxed mode stretches it.
 * 240 was too loose: an efficient pair finished at about 70 s (balance.md).
 */
export const LEVEL_SECONDS = 200;
export const RELAXED_LEVEL_SECONDS = 330;

/**
 * Scales a time written for the standard 200 second clock to a level of
 * `duration` seconds, so the brothers' window and Fred's time away keep their
 * place on the relaxed clock. Exact for the relaxed clock's 330 seconds.
 */
export function onLevelClock(seconds: number, duration: number): number {
  return (seconds * duration) / LEVEL_SECONDS;
}

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

/**
 * Ticks E must stay held facing open floor with something in hand before the
 * item is set down there (ADR 0060 amendment, 2026-10-12). 12 ticks is 0.4 s
 * of game time, so a tap does nothing.
 */
export const FLOOR_HOLD_TICKS = 12;

/**
 * How many items the floor takes before a put-down is refused. Fred's drop
 * when he leaves ignores the cap, so the floor can briefly hold one more.
 */
export const FLOOR_CAP = 3;

/** Game seconds between two floor-full toasts for the same person. */
export const FLOOR_FULL_REPEAT_SECONDS = 3;

/**
 * The brothers' text lands at the later of the earliest time and the first
 * full target, and never after the latest time, which keeps it ahead of the
 * standard clock's calls at 130 s and later. Seconds on the standard clock;
 * scale with `onLevelClock` for a relaxed level, where the 130 s call lands
 * first. These replace the old fixed 50 s.
 */
export const BROTHERS_EARLIEST_AT = 90;
export const BROTHERS_LATEST_AT = 110;

/**
 * How long each answer keeps Fred away, in seconds on the standard clock. A
 * leave at the latest text returns him at 180 s, with time left to help.
 */
export const BREAK_SECONDS = 40;
export const LEAVE_SECONDS = 70;

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
  admin: "Abbi fixed it herself. The admin page made it quick.",
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
  chairs: "a chair",
};

/** The prompt that marks a bin hold; it names the hold, and the cabinet adds the key. */
export const THROW_OUT_PROMPT = "Hold to throw it out";

/** The line a run prints when Fred leaves while the plan depends on him. */
export const LEFT_LINE =
  "The website was up, and the setup carried on while Fred was with his brothers.";

/**
 * Seeded events, in standard-clock seconds (scaled for a relaxed clock with
 * `onLevelClock`). A nonzero seed draws each start from its range.
 */
export const SHOWER_STARTS = { earliest: 40, latest: 100 } as const;
export const SHOWER_SECONDS = 24;
/** Walking speed on lawn tiles while the shower is on: wet grass. */
export const SHOWER_WALK_FACTOR = 0.6;
export const RUSH_STARTS = { earliest: 70, latest: 150 } as const;
export const RUSH_SECONDS = 15;
/**
 * While guests are early, food on the grill has half of its remaining pickup
 * window: time already spent cooked counts at double speed during the rush.
 */
export const RUSH_BURN_FACTOR = 0.5;
/**
 * The paving rows at the top of the venue. Every row below them is lawn, in
 * the engine (where the shower wets the lawn) and on the canvas alike.
 */
export const PATIO_ROWS = 4;

/** Fixed receipt lines. The real weather line comes from the line bank. */
export const RECEIPT_COPY = {
  leftovers: "Some. They went to the Rochester warming shelter.",
  suit: "Fred wore the rented tux. The free suit from The Suit Wherehouse (not the real shop's name): acquired, yes. Worn, no.",
  disclaimer:
    "Game prices, not the real wedding's costs. Explanations describe this game's rules, not what would have happened at the real wedding.",
} as const;

/** The ids of the [Real] lines in the bank, one per fact in the design doc. */
export type RealFactId =
  | "date"
  | "prep"
  | "tables"
  | "suit"
  | "morning"
  | "weather"
  | "dinner"
  | "leftovers"
  | "goal"
  | "website";

/** One line the game can say. Real lines quote a fact; fiction lines quote none. */
export interface BankLine {
  readonly id: string;
  readonly tag: "Real" | "Fiction";
  readonly fact: RealFactId | null;
  readonly text: string;
}

/**
 * Every line the game may show, each tagged [Real] or [Fiction] as in the
 * design doc. A real line quotes its fact from section 1 of the design doc
 * word for word (the repo checks this against a copy of that section, in
 * `__tests__/fixtures/for-better-or-bulk-real-facts.ts`); a fiction line claims
 * nothing about the real wedding.
 */
export const LINE_BANK: readonly BankLine[] = [
  {
    id: "date",
    tag: "Real",
    fact: "date",
    text: "Friday, 10/10/25, at the Plummer House in Rochester, a publicly owned venue. The ceremony is at 4:00 and the buffet at 5:30.",
  },
  {
    id: "prep",
    tag: "Real",
    fact: "prep",
    text: 'Two weeks out she "wasn\'t really thinking about it that much". She arrived and did the vast majority of the work on Wednesday and Thursday, with all of Thursday spent getting things ready. Friday was setup. Friends helped.',
  },
  {
    id: "tables",
    tag: "Real",
    fact: "tables",
    text: "They set up all the tables and chairs themselves.",
  },
  {
    id: "suit",
    tag: "Real",
    fact: "suit",
    text: "The Suit Wherehouse (a fictional homage name) lost Fred's suit and gave him a free one. He wore the rented tux anyway.",
  },
  {
    id: "morning",
    tag: "Real",
    fact: "morning",
    text: "Fred was anxious and went out with his brothers. Abbi kept things moving without him.",
  },
  {
    id: "weather",
    tag: "Real",
    fact: "weather",
    text: "The weather was perfect.",
  },
  {
    id: "dinner",
    tag: "Real",
    fact: "dinner",
    text: "Hot dogs, wings, mac and cheese and quinoa salad from Costco, plus a Kirkland sheet cake for the guests. Abbi's sister made the cake they cut.",
  },
  {
    id: "leftovers",
    tag: "Real",
    fact: "leftovers",
    text: "Leftovers went to the Rochester warming shelter.",
  },
  {
    id: "goal",
    tag: "Real",
    fact: "goal",
    text: 'Abbi\'s goal was for the wedding to be "successful and fun".',
  },
  {
    id: "website",
    tag: "Real",
    fact: "website",
    text: 'The website was built months earlier: FAQ, registry scraper, admin page for Abbi, 3D heart (the rings-into-heart intro "looked awful"). RSVPs went through iCloud, never the site. Registry gifts were never part of the wedding budget.',
  },
  {
    id: "game-weather",
    tag: "Fiction",
    fact: null,
    text: "Game weather, not the real day",
  },
  {
    id: "shower-start",
    tag: "Fiction",
    fact: null,
    text: "A shower rolls across the lawn. Wet grass slows walking on the lawn until it passes.",
  },
  {
    id: "rush-start",
    tag: "Fiction",
    fact: null,
    text: "Guests are early and the buffet is calling. Food on the grill burns faster until it passes.",
  },
  {
    id: "shower-end",
    tag: "Fiction",
    fact: null,
    text: "The shower moves off across the lawn. The grass dries enough to walk on.",
  },
  {
    id: "rush-end",
    tag: "Fiction",
    fact: null,
    text: "The early guests have eaten. The grill is back to its usual pace.",
  },
  {
    id: "signature-tables-food",
    tag: "Fiction",
    fact: null,
    text: "Every table set, and the food on time.",
  },
  {
    id: "signature-neutral",
    tag: "Fiction",
    fact: null,
    text: "The day, as far as it got.",
  },
  {
    id: "joke-roses",
    tag: "Fiction",
    fact: null,
    text: 'Quantity: "Yes". The car is behind the roses.',
  },
  {
    id: "joke-leaving",
    tag: "Fiction",
    fact: null,
    text: "Production: healthy. All systems operational.",
  },
  {
    id: "joke-suit",
    tag: "Fiction",
    fact: null,
    text: "The free suit hangs in the coat room.",
  },
  {
    id: "joke-suit-tip",
    tag: "Fiction",
    fact: null,
    text: "Acquired: yes. Worn: no.",
  },
  {
    id: "joke-sink",
    tag: "Fiction",
    fact: null,
    text: "One guest in stilettos sinks gently into the lawn.",
  },
  {
    id: "joke-faq",
    tag: "Fiction",
    fact: null,
    text: "The FAQ answered the garden question before anyone had to call.",
  },
  {
    id: "guests-seated",
    tag: "Fiction",
    fact: null,
    text: "The guests find their seats.",
  },
  {
    id: "joke-lanterns",
    tag: "Fiction",
    fact: null,
    text: "Paper lanterns glow over the patio at dusk.",
  },
  {
    id: "scene-ceremony",
    tag: "Fiction",
    fact: null,
    text: "4:00. The ceremony.",
  },
  {
    id: "scene-tux",
    tag: "Fiction",
    fact: null,
    text: "The rented tux.",
  },
  {
    id: "scene-coat",
    tag: "Fiction",
    fact: null,
    text: "The coat room.",
  },
  {
    id: "scene-guests",
    tag: "Fiction",
    fact: null,
    text: "The guests.",
  },
  {
    id: "scene-buffet",
    tag: "Fiction",
    fact: null,
    text: "5:30. The buffet.",
  },
  {
    id: "scene-dusk",
    tag: "Fiction",
    fact: null,
    text: "Dusk.",
  },
  {
    id: "scene-after",
    tag: "Fiction",
    fact: null,
    text: "After.",
  },
  {
    id: "scene-summary",
    tag: "Fiction",
    fact: null,
    text: "The rest of the real day, in brief.",
  },
  {
    id: "actual-heading",
    tag: "Fiction",
    fact: null,
    text: "What actually happened",
  },
  {
    id: "actual-link",
    tag: "Fiction",
    fact: null,
    text: "Read the real wedding page",
  },
];

/** The text of one line in the bank, by its id. */
export function bankText(id: string): string {
  return LINE_BANK.find((line) => line.id === id)?.text ?? "";
}

/** The receipt's line when the solo helper was on (ADR 0060, F6). */
export const ASSIST_LINE = "A helper kept the other lane going.";

/**
 * The [Real] lines the receipt's "What actually happened" note quotes, in
 * order. Only fixture facts that describe the day itself: the date and times,
 * the weather and the goal. Nothing here characterizes the couple.
 */
export const ACTUAL_NOTE_IDS: readonly string[] = ["date", "weather", "goal"];

/** Where the "What actually happened" note links: the real wedding page. */
export const WEDDING_PATH = "/wedding";
