import type { MenuItemId, PosNode, ShiftConfig } from "./types";

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
