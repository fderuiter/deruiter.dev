import type {
  BoothFacing,
  Dilemma,
  DilemmaId,
  LookPreset,
  MenuItemId,
  ModifierId,
  PosNode,
  RushWindow,
  ShiftConfig,
  ShiftScenario,
  WeekdayId,
} from "./types";

/**
 * Orders turn yellow after this many seconds, and red after RED_AFTER_SEC.
 * A real kitchen display uses about a minute per band; the shift compresses
 * four hours into three minutes, so the bands are compressed with it.
 */
export const YELLOW_AFTER_SEC = 25;
export const RED_AFTER_SEC = 50;
/** An order this old is abandoned by the customer and counted as expired. */
export const EXPIRE_AFTER_SEC = 75;

export const DEFAULT_SHIFT_CONFIG: ShiftConfig = {
  seed: "first-job",
  durationSec: 180,
};

export const METER_START = { sos: 80, dignity: 70, idle: 0 } as const;

/** Seconds of standing still before the manager starts to notice. */
export const IDLE_GRACE_SEC = 6;
/** Idle meter points gained per second once the grace period is over. */
export const IDLE_RATE_PER_SEC = 12;
/** Idle meter points removed by any valid action. */
export const IDLE_RELIEF_ON_ACTION = 15;
/** Idle meter points removed by wiping, and the wipe cooldown. */
export const IDLE_RELIEF_ON_WIPE = 40;
export const WIPE_COOLDOWN_SEC = 3;
/** Idle meter value right after the manager yells. */
export const IDLE_AFTER_YELL = 40;

export const DIGNITY_LOSS_YELL = 10;
export const DIGNITY_LOSS_LOCKED = 3;
export const DIGNITY_LOSS_WRONG_ENTRY = 4;
export const SOS_LOSS_EXPIRED = 15;
export const SOS_LOSS_LATE = 5;
export const SOS_GAIN_ON_TIME = 2;
export const SOS_GAIN_FAST = 3;

/** Chance that the automatic drink dispenser drops a drink as it is rung up. */
export const DISPENSER_FAIL_CHANCE = 0.4;
/** Seconds a coworker needs to brew coffee for an under-age player. */
export const COWORKER_DELAY_SEC = 4;

/** Shift time of the first order. */
export const FIRST_ARRIVAL_SEC = 2;
/** The longest frame step the engine simulates at once. */
export const MAX_STEP_SEC = 0.5;
/**
 * Orders arrive between these two gaps, in seconds, at clock-in. Tightened
 * from 7-15 s with the shift ramp (#2138), so a quick player is not left
 * waiting for half the shift.
 */
export const ARRIVAL_GAP_MIN_SEC = 6;
export const ARRIVAL_GAP_MAX_SEC = 12;
/**
 * The shift ramp (#2138): arrival gaps shrink steadily by this fraction from
 * clock-in to close, so the shift builds instead of staying flat. A practice
 * scenario that sets its own gaps keeps them exactly (#1938).
 */
export const SHIFT_RAMP = 0.3;
/**
 * The lunch rush (#1938): between these fractions of a standard shift, the
 * arrival gaps shrink by `RUSH_GAP_SCALE`, so a quick player has work.
 */
export const RUSH_START_FRACTION = 0.35;
export const RUSH_END_FRACTION = 0.7;
export const RUSH_GAP_SCALE = 0.5;
/** The dinner rush at close (#2138), on top of the lunch rush. */
export const CLOSING_RUSH_START_FRACTION = 0.88;
/** The orders open at once never exceed this many. */
export const MAX_OPEN_ORDERS = 6;
export const MAX_ITEMS_PER_ORDER = 4;
/** Chance a burger order carries the buried "no pickles" request. */
export const NO_PICKLES_CHANCE = 0.3;

export const ORDERABLE_ITEMS: readonly MenuItemId[] = [
  "burger",
  "cheeseburger",
  "fries",
  "nuggets",
  "soda",
  "shake",
  "coffee",
];

/** Drinks poured by the automatic dispenser, which drops orders it was sent. */
export const DISPENSER_ITEMS: readonly MenuItemId[] = ["soda", "shake"];

/** Items an under-18 crew member is not allowed to make. */
export const AGE_LOCKED_ITEMS: readonly MenuItemId[] = ["coffee"];

/**
 * The POS menu. "No pickles" sits four taps below the home screen, which is
 * the point: the terminal is built to be fought with.
 */
export const POS_MENU: PosNode = {
  id: "home",
  label: "Home",
  children: [
    {
      id: "burgers",
      label: "Burgers",
      children: [
        { id: "burger", label: "Burger", itemId: "burger" },
        { id: "cheeseburger", label: "Cheeseburger", itemId: "cheeseburger" },
      ],
    },
    {
      id: "sides",
      label: "Sides",
      children: [
        { id: "fries", label: "Fries", itemId: "fries" },
        { id: "nuggets", label: "Nuggets", itemId: "nuggets" },
      ],
    },
    {
      id: "drinks",
      label: "Drinks",
      children: [
        { id: "soda", label: "Soda", itemId: "soda" },
        { id: "shake", label: "Shake", itemId: "shake" },
        { id: "coffee", label: "Brew Coffee", itemId: "coffee" },
      ],
    },
    {
      id: "modifiers",
      label: "Modifiers",
      children: [
        {
          id: "toppings",
          label: "Toppings",
          children: [
            {
              id: "pickles",
              label: "Pickles",
              children: [
                {
                  id: "no-pickles",
                  label: "No Pickles",
                  modifierId: "no-pickles",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

/** Pay-stub constants, all in cents. */
export const WAGE_CENTS_PER_HOUR = 725;
export const SHIFT_PAID_MINUTES = 240;
export const UNIFORM_DEDUCTION_CENTS = 300;
/** The break the player never got, taken back out of the check anyway. */
export const BREAK_ADJUSTMENT_CENTS = 363;
export const TILL_SHORT_PER_EXPIRED_CENTS = 129;

/** How each menu item reads on the kitchen display and in captions. */
export const MENU_ITEM_LABELS: Readonly<Record<MenuItemId, string>> = {
  burger: "Burger",
  cheeseburger: "Cheeseburger",
  fries: "Fries",
  nuggets: "Nuggets",
  soda: "Soda",
  shake: "Shake",
  coffee: "Coffee",
};

/** How each buried modifier reads on the kitchen display. */
export const MODIFIER_LABELS: Readonly<Record<ModifierId, string>> = {
  "no-pickles": "No pickles",
};

/**
 * The player stands still and pivots: half a turn either way reaches the
 * drive-thru window on the left and the kitchen on the right.
 */
export const LOOK_YAW_LIMIT = Math.PI / 2;
export const LOOK_PITCH_MIN = -0.75;
export const LOOK_PITCH_MAX = 0.6;
/** Radians per second while a turn key is held. */
export const LOOK_TURN_SPEED = 1.9;
/**
 * How quickly the head catches up with where the player is turning it, per
 * second. Lower is a heavier, more tired head.
 */
export const LOOK_EASE_PER_SEC = 9;
/** Yaw beyond which the player counts as facing the window or the kitchen. */
export const LOOK_SIDE_THRESHOLD = Math.PI / 4;

/** Named views the camera can be aimed at. */
export const LOOK_PRESETS: Readonly<
  Record<BoothFacing | "register" | "order-screen", LookPreset>
> = {
  counter: { yaw: 0, pitch: 0 },
  register: { yaw: 0.21, pitch: -0.42 },
  "order-screen": { yaw: -0.04, pitch: 0.24 },
  window: { yaw: 1.32, pitch: -0.18 },
  kitchen: { yaw: -1.2, pitch: -0.2 },
};

/** Points per car served, the deduction for a late one, and the close-out bonus. */
export const SCORE_PER_SERVED = 10;
export const SCORE_LATE_PENALTY = 5;
export const SCORE_COMPLETED_BONUS = 50;
/** Extra points for each order bumped while its ticket is still green (#2057). */
export const SCORE_FAST_BUMP_BONUS = 5;
/**
 * The clean-order streak (#2057): every order bumped since the last wrong
 * entry extends the streak, and each one after the first earns this many
 * points per earlier link, up to `SCORE_STREAK_MAX_LINKS`. A re-entered drink
 * does not break it, because the dispenser drops drinks at random.
 */
export const SCORE_STREAK_STEP = 2;
export const SCORE_STREAK_MAX_LINKS = 10;
/** Points per Dignity point still standing when the shift reaches close (#2057). */
export const SCORE_DIGNITY_PER_POINT = 1;

/** The range each scenario dial is held to, so no input can break the shift. */
export const SCENARIO_LIMITS: Readonly<
  Record<keyof ShiftScenario, readonly [min: number, max: number]>
> = {
  arrivalGapMinSec: [1, 30],
  arrivalGapMaxSec: [1, 60],
  firstArrivalSec: [0, 30],
  sosLossExpired: [0, 50],
  sosLossLate: [0, 30],
  sosGainOnTime: [0, 20],
  sosGainFast: [0, 20],
  idleGraceSec: [0, 30],
  idleRatePerSec: [0, 60],
  dispenserFailChance: [0, 1],
};

export type ScenarioId =
  "standard" | "lunchRush" | "failingDispenser" | "strictManagement" | "custom";

export interface ScenarioPreset {
  readonly id: ScenarioId;
  readonly label: string;
  /** One line, in the diary's voice, for the picker. */
  readonly blurb: string;
  readonly dials: ShiftScenario;
}

/**
 * The shifts a player can pick before clocking in. Only the standard shift
 * counts toward the arcade score; the others are for practice and for
 * looking at the numbers. None sets a seed, so every shift stays fresh.
 */
export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    id: "standard",
    label: "Standard shift",
    blurb: "The shift as it was. Counts toward your score.",
    dials: {},
  },
  {
    id: "lunchRush",
    label: "Lunch rush",
    blurb: "Cars come two or three at a time and nobody waits kindly.",
    dials: {
      arrivalGapMinSec: 3,
      arrivalGapMaxSec: 8,
      firstArrivalSec: 1,
      sosLossExpired: 20,
      sosLossLate: 8,
      sosGainOnTime: 3,
      sosGainFast: 5,
    },
  },
  {
    id: "failingDispenser",
    label: "Failing dispenser",
    blurb: "The drink machine drops almost every cup it pours.",
    dials: { dispenserFailChance: 0.85 },
  },
  {
    id: "strictManagement",
    label: "Strict management",
    blurb: "The manager is watching. Standing still gets noticed fast.",
    dials: { idleGraceSec: 2, idleRatePerSec: 25 },
  },
  {
    id: "custom",
    label: "Custom shift",
    blurb:
      "Tune arrival gaps, dispenser breakdown and build custom order queues.",
    dials: { arrivalGapMinSec: 6, arrivalGapMaxSec: 12 },
  },
];

/**
 * True when a shift has no scenario dial set and is not a day of the week
 * mode, so its own score counts. A week's days add up to the week's score
 * instead (#2086).
 */
export function isStandardScenario(config: Partial<ShiftConfig>): boolean {
  return (
    (Object.keys(SCENARIO_LIMITS) as Array<keyof ShiftScenario>).every(
      (key) => config[key] === undefined
    ) &&
    config.rushWindows === undefined &&
    config.ageUnlocked === undefined &&
    config.startMeters === undefined &&
    config.dilemmaDeck === undefined &&
    (!config.customOrders || config.customOrders.length === 0)
  );
}

/** The dials a preset sets, ready to hand to `clockIn`. */
export function scenarioDialsFor(id: ScenarioId): ShiftScenario {
  return { ...SCENARIO_PRESETS.find((p) => p.id === id)?.dials };
}

/**
 * The week mode (#2086). Each day starts Dignity and SOS this far of the way
 * from where the day before ended back toward `METER_START`: 0.5 is halfway.
 */
export const WEEK_CARRY_RECOVERY = 0.5;
/**
 * The lowest a carried meter can start a day at, so a breakdown or a docked
 * day starts the next one worse off without losing the week.
 */
export const WEEK_CARRY_FLOOR = 25;
/** A day that ends on a breakdown or docked outcome costs this much more. */
export const WEEK_BAD_DAY_PENALTY = 10;

/** The rush every standard shift has (#1938). */
export const STANDARD_RUSH: RushWindow = [
  RUSH_START_FRACTION,
  RUSH_END_FRACTION,
];

/** The dinner rush every standard shift closes on (#2138). */
export const CLOSING_RUSH: RushWindow = [CLOSING_RUSH_START_FRACTION, 1];

export interface WeekDayPreset {
  readonly id: WeekdayId;
  /** The weekday, such as "Monday". */
  readonly label: string;
  /** What kind of day it is, such as "Fry Friday". */
  readonly title: string;
  /** One line, in the diary's voice, for the day picker and the diary page. */
  readonly blurb: string;
  readonly dials: ShiftScenario;
  /** The day's rushes; left out, the standard lunch rush. */
  readonly rushWindows?: readonly RushWindow[];
  /** True on the day the player turns eighteen and coffee unlocks. */
  readonly ageUnlocked?: boolean;
}

/**
 * Monday to Friday (#2086). Every day is built from the same scenario dials
 * as the practice shifts, plus its rushes and whether coffee is unlocked.
 * Once Thursday unlocks coffee it stays unlocked for Friday.
 */
export const WEEK_DAYS: readonly WeekDayPreset[] = [
  {
    id: "monday",
    label: "Monday",
    title: "A normal shift",
    blurb: "Nothing special. The lunch rush, the dinner crowd, the usual cars.",
    dials: {},
    rushWindows: [STANDARD_RUSH, CLOSING_RUSH],
  },
  {
    id: "tuesday",
    label: "Tuesday",
    title: "The dispenser is broken",
    blurb: "The drink machine is worse than usual. Ring the drinks twice.",
    dials: { dispenserFailChance: 0.8 },
    rushWindows: [STANDARD_RUSH, CLOSING_RUSH],
  },
  {
    id: "wednesday",
    label: "Wednesday",
    title: "Double rush",
    blurb: "A lunch rush, a breather, then the school lets out.",
    dials: {},
    rushWindows: [
      [0.15, 0.4],
      [0.6, 0.85],
    ],
  },
  {
    id: "thursday",
    label: "Thursday",
    title: "Eighteen",
    blurb: "My eighteenth birthday. I can finally brew the coffee myself.",
    dials: {},
    rushWindows: [STANDARD_RUSH, CLOSING_RUSH],
    ageUnlocked: true,
  },
  {
    id: "friday",
    label: "Friday",
    title: "Fry Friday",
    blurb: "Fred's fresh fries on Friday. The busiest day of the week.",
    dials: {
      arrivalGapMinSec: 5,
      arrivalGapMaxSec: 11,
      firstArrivalSec: 1,
    },
    rushWindows: [[0.25, 0.8], CLOSING_RUSH],
    ageUnlocked: true,
  },
];

/**
 * Micro-dilemmas (#2087). A standard three-minute shift puts this many to
 * the player, one roughly every quarter of the shift; shorter shifts get one
 * per `DILEMMA_SEC_PER` seconds, so a ten-second test shift has none.
 */
export const DILEMMAS_PER_SHIFT = 3;
export const DILEMMA_SEC_PER = 50;
/** Seconds to answer before the default is taken, and the longer window. */
export const DILEMMA_WINDOW_SEC = 8;
export const DILEMMA_WINDOW_LONG_SEC = 16;
/** The range a configured answer window is held to. */
export const DILEMMA_WINDOW_LIMITS: readonly [min: number, max: number] = [
  4, 30,
];
/** Where the hidden Solidarity value starts a shift. */
export const SOLIDARITY_START = 50;
/**
 * Endings at close (#2087): Solidarity at or above `WALKOUT_MIN_SOLIDARITY`
 * with Dignity at or above `WALKOUT_MIN_DIGNITY` walks out with the crew;
 * Solidarity at or below `COMPANY_MAN_MAX_SOLIDARITY` is the Company Man;
 * anything else clocks out quietly.
 */
export const WALKOUT_MIN_SOLIDARITY = 70;
export const WALKOUT_MIN_DIGNITY = 30;
export const COMPANY_MAN_MAX_SOLIDARITY = 30;

/**
 * The hand-written dilemmas (#2087). Each trades the meters against each
 * other and moves the hidden Solidarity value. The default, taken when the
 * timer runs out, is what happens if nobody says anything; it moves the
 * meters but not Solidarity, so a player who ignores them clocks out
 * quietly (#2139). Every dilemma has an answer worth at least 10 toward the
 * crew and one worth at least 10 toward management, so any three a shift
 * draws can reach either named ending.
 */
export const DILEMMAS: Readonly<Record<DilemmaId, Dilemma>> = {
  "stale-fries": {
    id: "stale-fries",
    speaker: "manager",
    prompt:
      "Those fries have been under the lamp for twenty minutes. They're fine. Bag them.",
    options: [
      {
        id: "serve",
        label: "Serve them",
        sos: 6,
        dignity: -6,
        solidarity: -10,
        payCents: 0,
        diary: "I served the stale fries. Nobody complained to me.",
      },
      {
        id: "toss",
        label: "Toss them",
        sos: -6,
        dignity: 4,
        solidarity: 10,
        payCents: 0,
        diary: "I tossed the old fries and Dale dropped a fresh batch with me.",
      },
    ],
    defaultOptionId: "serve",
    timeoutDiary: "I didn't say anything, so the stale fries went out.",
  },
  "short-till": {
    id: "short-till",
    speaker: "manager",
    prompt: "A drawer came up eight dollars short. Was that Dale's, or yours?",
    options: [
      {
        id: "cover",
        label: "Cover it",
        sos: 0,
        dignity: -4,
        solidarity: 20,
        payCents: 800,
        diary: "I said the drawer was mine. Eight dollars out of my check.",
      },
      {
        id: "report",
        label: "Say it was Dale's",
        sos: 4,
        dignity: -2,
        solidarity: -15,
        payCents: 0,
        diary:
          "I told Bo it was Dale's drawer. Dale didn't look at me for the rest of the shift.",
      },
    ],
    defaultOptionId: "report",
    timeoutDiary:
      "I didn't answer, so Bo checked the drawer log. It was Dale's.",
  },
  "shake-machine": {
    id: "shake-machine",
    speaker: "manager",
    prompt:
      "Car on the headset wants a shake. Tell them the machine's broken. Whoever closes has to clean it.",
    options: [
      {
        id: "broken",
        label: "Say it's broken",
        sos: 5,
        dignity: -5,
        solidarity: 10,
        payCents: 0,
        diary:
          "I told a customer the shake machine was broken. It was not. Dale didn't have to clean it.",
      },
      {
        id: "make",
        label: "Make the shake",
        sos: -5,
        dignity: 3,
        solidarity: -10,
        payCents: 0,
        diary: "I made the shake. Dale stayed late to clean the machine.",
      },
    ],
    defaultOptionId: "broken",
    timeoutDiary:
      "I hesitated, and Bo told the customer the machine was broken.",
  },
  "long-break": {
    id: "long-break",
    speaker: "manager",
    prompt: "Did you see Dale take a twenty-minute smoke break?",
    options: [
      {
        id: "cover",
        label: "Cover for Dale",
        sos: -3,
        dignity: 2,
        solidarity: 10,
        payCents: 0,
        diary:
          "I said Dale was in the walk-in the whole time. Bo didn't buy it.",
      },
      {
        id: "tell",
        label: "Tell Bo",
        sos: 3,
        dignity: -3,
        solidarity: -15,
        payCents: 0,
        diary: "I told Bo about Dale's break. Bo wrote it down.",
      },
    ],
    defaultOptionId: "cover",
    timeoutDiary: "I shrugged. Bo let it go, and so did Dale.",
  },
  "free-drink": {
    id: "free-drink",
    speaker: "customer",
    prompt: "I come here every day. Throw in a free large drink?",
    options: [
      {
        id: "give",
        label: "Throw it in",
        sos: 3,
        dignity: 2,
        solidarity: 10,
        payCents: 0,
        diary:
          "A regular asked for a free large drink and I gave it. Bo never counts the cups.",
      },
      {
        id: "charge",
        label: "Charge for it",
        sos: -2,
        dignity: 0,
        solidarity: -10,
        payCents: 0,
        diary:
          "I charged a regular for the large drink, by the book. They called me something I won't write down.",
      },
    ],
    defaultOptionId: "charge",
    timeoutDiary:
      "I didn't answer, so the drink went on their bill. They were not happy at the window.",
  },
  "swap-saturday": {
    id: "swap-saturday",
    speaker: "coworker",
    prompt: "Can you take my Saturday? My sister graduates.",
    options: [
      {
        id: "take",
        label: "Take it",
        sos: 0,
        dignity: -3,
        solidarity: 15,
        payCents: 0,
        diary: "I said I'd take Dale's Saturday. There goes my weekend.",
      },
      {
        id: "pass",
        label: "Can't do it",
        sos: 0,
        dignity: 2,
        solidarity: -10,
        payCents: 0,
        diary:
          "I told Dale I couldn't take Saturday. Dale said it was fine. It didn't sound fine.",
      },
    ],
    defaultOptionId: "pass",
    timeoutDiary: "I didn't answer in time, and Dale went to ask someone else.",
  },
  "upsell-day": {
    id: "upsell-day",
    speaker: "manager",
    prompt:
      "Corporate is counting upsells today. Offer the large combo to every car.",
    options: [
      {
        id: "push",
        label: "Push the large",
        sos: -3,
        dignity: -4,
        solidarity: -10,
        payCents: 0,
        diary:
          "I asked every car if they wanted to make it a large. Most said no. One laughed.",
      },
      {
        id: "skip",
        label: "Skip the script",
        sos: 3,
        dignity: 2,
        solidarity: 10,
        payCents: 0,
        diary:
          "I didn't push the large combos. Bo checked the numbers at close and sighed.",
      },
    ],
    defaultOptionId: "push",
    timeoutDiary:
      "I said nothing, so Bo stood behind me to make sure I asked every car.",
  },
  "onion-name": {
    id: "onion-name",
    speaker: "customer",
    prompt:
      "There were onions on my burger. I said no onions. Who made it? I want a name.",
    options: [
      {
        id: "me",
        label: "Take the blame",
        sos: -2,
        dignity: -3,
        solidarity: 10,
        payCents: 0,
        diary:
          "A customer wanted a name for the onions on their burger. I gave mine, not Dale's.",
      },
      {
        id: "dale",
        label: "Name Dale",
        sos: 2,
        dignity: -2,
        solidarity: -10,
        payCents: 0,
        diary:
          "A customer wanted a name for the onions. I said Dale. Bo heard.",
      },
    ],
    defaultOptionId: "me",
    timeoutDiary: "I didn't answer, so they asked Bo for a name instead.",
  },
  "ice-machine": {
    id: "ice-machine",
    speaker: "coworker",
    prompt:
      "The ice machine is leaking again. If we tell Bo, we're both mopping till close.",
    options: [
      {
        id: "towel",
        label: "Throw a towel on it",
        sos: 3,
        dignity: -2,
        solidarity: 10,
        payCents: 0,
        diary: "Dale and I threw towels on the ice machine leak and hoped.",
      },
      {
        id: "tell",
        label: "Tell Bo",
        sos: -3,
        dignity: 3,
        solidarity: -10,
        payCents: 0,
        diary:
          "I told Bo about the ice machine. Dale mopped next to me and didn't talk.",
      },
    ],
    defaultOptionId: "towel",
    timeoutDiary: "Neither of us said anything. Dale threw a towel on it.",
  },
  "cold-burger": {
    id: "cold-burger",
    speaker: "customer",
    prompt: "This burger is cold. Get me your manager.",
    options: [
      {
        id: "bo",
        label: "Get Bo",
        sos: -4,
        dignity: -3,
        solidarity: -10,
        payCents: 0,
        diary:
          "I got Bo for a cold burger. Bo blamed the grill, which meant Dale.",
      },
      {
        id: "remake",
        label: "Remake it yourself",
        sos: -2,
        dignity: 4,
        solidarity: 10,
        payCents: 0,
        diary:
          "I remade the cold burger myself before Bo noticed. Dale owes me one.",
      },
    ],
    defaultOptionId: "bo",
    timeoutDiary: "I froze, and the customer honked until Bo came over.",
  },
  bathrooms: {
    id: "bathrooms",
    speaker: "manager",
    prompt: "Somebody has to clean the bathrooms. Dale told me it's your turn.",
    options: [
      {
        id: "go",
        label: "Do it anyway",
        sos: -3,
        dignity: -3,
        solidarity: 10,
        payCents: 0,
        diary:
          "It was not my turn to clean the bathrooms. I cleaned them anyway, so Dale didn't have to.",
      },
      {
        id: "dale",
        label: "Say it's Dale's turn",
        sos: 0,
        dignity: 3,
        solidarity: -10,
        payCents: 0,
        diary:
          "I said it was Dale's turn for the bathrooms. It was. Dale went, slowly.",
      },
    ],
    defaultOptionId: "go",
    timeoutDiary: "I didn't argue, so the bathrooms were mine.",
  },
  "new-kid": {
    id: "new-kid",
    speaker: "coworker",
    prompt:
      "The new kid is crying in the walk-in. Cover the window so I can talk to her?",
    options: [
      {
        id: "cover",
        label: "Cover the window",
        sos: -4,
        dignity: 3,
        solidarity: 10,
        payCents: 0,
        diary:
          "I worked the window alone while Dale talked to the new kid. She came back out smiling.",
      },
      {
        id: "busy",
        label: "Not right now",
        sos: 2,
        dignity: -2,
        solidarity: -10,
        payCents: 0,
        diary:
          "I told Dale I couldn't cover the window. Bo would have noticed. The new kid came out on her own.",
      },
    ],
    defaultOptionId: "busy",
    timeoutDiary: "I didn't answer, and Dale stayed at the grill.",
  },
  "early-bump": {
    id: "early-bump",
    speaker: "manager",
    prompt:
      "Hit bump the second they pull up. The timer looks better that way.",
    options: [
      {
        id: "bump",
        label: "Bump early",
        sos: 5,
        dignity: -5,
        solidarity: -10,
        payCents: 0,
        diary:
          "I bumped orders before the food was in the bag, so the timer looked good. Dale got yelled at for being slow.",
      },
      {
        id: "honest",
        label: "Bump when it's done",
        sos: -4,
        dignity: 3,
        solidarity: 10,
        payCents: 0,
        diary:
          "I kept bumping orders when they were done. The timer looked bad. Dale noticed.",
      },
    ],
    defaultOptionId: "bump",
    timeoutDiary:
      "I didn't answer, so Bo reached over and bumped the order for me.",
  },
  "eighteen-close": {
    id: "eighteen-close",
    speaker: "manager",
    prompt:
      "You're eighteen now. Want to close tonight? Extra hours, and you clean the shake machine.",
    options: [
      {
        id: "take",
        label: "Take the hours",
        sos: 3,
        dignity: -3,
        solidarity: -10,
        payCents: 0,
        diary:
          "Bo gave me the closing hours Dale usually gets. I cleaned the shake machine at midnight.",
      },
      {
        id: "decline",
        label: "Let Dale keep them",
        sos: 0,
        dignity: 2,
        solidarity: 10,
        payCents: 0,
        diary:
          "I told Bo to give the closing hours to Dale. Dale needs them more.",
      },
    ],
    defaultOptionId: "take",
    timeoutDiary: "I didn't say no fast enough, so Bo wrote me in to close.",
  },
  "fry-box": {
    id: "fry-box",
    speaker: "coworker",
    prompt: "Bo's in the office. Want to sneak the crew a box of fries?",
    options: [
      {
        id: "sneak",
        label: "Sneak the fries",
        sos: -2,
        dignity: 4,
        solidarity: 10,
        payCents: 0,
        diary:
          "Dale and I snuck the whole crew a box of fries. Best part of the week.",
      },
      {
        id: "pass",
        label: "Not worth it",
        sos: 2,
        dignity: 0,
        solidarity: -10,
        payCents: 0,
        diary:
          "I didn't want to get caught sneaking fries. Dale ate them alone in the walk-in.",
      },
    ],
    defaultOptionId: "pass",
    timeoutDiary: "I hesitated, and Bo came out of the office before we could.",
  },
};

/**
 * The dilemmas any shift can draw, in the order they are written. A week
 * deals these out without repeats (#2139), so there are enough to fill
 * Monday to Wednesday and two slots each on Thursday and Friday.
 */
export const DILEMMA_IDS: readonly DilemmaId[] = [
  "stale-fries",
  "short-till",
  "shake-machine",
  "long-break",
  "free-drink",
  "swap-saturday",
  "upsell-day",
  "onion-name",
  "ice-machine",
  "cold-burger",
  "bathrooms",
  "new-kid",
  "early-bump",
];

/**
 * The dilemma that belongs to one day of the week (#2139), which a week
 * puts in that day's middle slot and a single shift never draws: closing
 * hours on the eighteenth birthday, and the crew's fries on Fry Friday.
 */
export const WEEK_DAY_DILEMMAS: Readonly<
  Partial<Record<WeekdayId, DilemmaId>>
> = {
  thursday: "eighteen-close",
  friday: "fry-box",
};
