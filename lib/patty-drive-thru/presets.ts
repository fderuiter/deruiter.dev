import type {
  BoothFacing,
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
/** Orders arrive between these two gaps, in seconds. */
export const ARRIVAL_GAP_MIN_SEC = 7;
export const ARRIVAL_GAP_MAX_SEC = 15;
/**
 * The lunch rush (#1938): between these fractions of a standard shift, the
 * arrival gaps shrink by `RUSH_GAP_SCALE`, so a quick player has work.
 */
export const RUSH_START_FRACTION = 0.35;
export const RUSH_END_FRACTION = 0.7;
export const RUSH_GAP_SCALE = 0.5;
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
  "standard" | "lunchRush" | "failingDispenser" | "strictManagement";

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
    config.startMeters === undefined
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
    blurb: "Nothing special. One lunch rush, the usual cars.",
    dials: {},
    rushWindows: [STANDARD_RUSH],
  },
  {
    id: "tuesday",
    label: "Tuesday",
    title: "The dispenser is broken",
    blurb: "The drink machine is worse than usual. Ring the drinks twice.",
    dials: { dispenserFailChance: 0.8 },
    rushWindows: [STANDARD_RUSH],
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
    rushWindows: [STANDARD_RUSH],
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
    rushWindows: [[0.25, 0.8]],
    ageUnlocked: true,
  },
];
