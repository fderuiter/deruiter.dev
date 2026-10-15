/**
 * Patty's Drive-Thru: type contracts for the headless booth-shift engine
 * (ADR 0059). Every value here is plain data, so a shift can be snapshotted,
 * replayed from its seed and actions, and rendered by any front end.
 */

/** What the player can order or ring up at the POS. */
export type MenuItemId =
  "burger" | "cheeseburger" | "fries" | "nuggets" | "soda" | "shake" | "coffee";

/** A request that is buried deep in the POS menu tree. */
export type ModifierId = "no-pickles";

/** Kitchen-display colour band, driven by an order's age. */
export type KdsBand = "green" | "yellow" | "red";

/** How a shift ended; `playing` until it does. */
export type ShiftOutcome = "playing" | "completed" | "docked" | "breakdown";

/** One line of an order as the customer speaks it through the headset. */
export interface OrderItem {
  readonly itemId: MenuItemId;
  readonly modifier: ModifierId | null;
  /** True once the item was rung up at the POS. */
  readonly rung: boolean;
  /** True once the requested modifier was rung up. Always true without one. */
  readonly modifierDone: boolean;
  /** True when the drink dispenser dropped this drink and it must be re-entered. */
  readonly dropped: boolean;
}

export interface Order {
  readonly id: number;
  /** Shift time in seconds at which the order arrived. */
  readonly arrivedAt: number;
  readonly items: readonly OrderItem[];
  /** Shift time at which a flagged coworker can brew this order's coffee, or null. */
  readonly coworkerReadyAt: number | null;
}

/** The meters the player is managing. Standing meters die at 0; idle dies at 100. */
export interface Meters {
  /** Drive-thru standing with the manager and corporate. 0 ends the shift as docked. */
  readonly sos: number;
  /** What is left of the player's dignity. 0 ends the shift as a breakdown. */
  readonly dignity: number;
  /** How long the manager has watched the player standing idle. */
  readonly idle: number;
}

/** Where the player is in the POS menu tree. */
export interface PosCursor {
  /** Node ids from the root to the open screen; empty means the home screen. */
  readonly path: readonly string[];
  /** The order the next ring-up lands on, or null when none is selected. */
  readonly activeOrderId: number | null;
  /** Taps spent since the last completed ring-up, for telemetry and UI. */
  readonly taps: number;
}

/**
 * The dials a named scenario turns. Every one is optional and falls back to
 * the standard shift's value; the engine clamps whatever it is given.
 */
export interface ShiftScenario {
  /** Shortest gap between car arrivals, in seconds. */
  readonly arrivalGapMinSec?: number;
  /** Longest gap between car arrivals, in seconds. */
  readonly arrivalGapMaxSec?: number;
  /** Shift time of the first order, in seconds. */
  readonly firstArrivalSec?: number;
  /** Standing lost when an order expires. */
  readonly sosLossExpired?: number;
  /** Standing lost when a late order is bumped. */
  readonly sosLossLate?: number;
  /** Standing gained when an on-time order is bumped. */
  readonly sosGainOnTime?: number;
  /** Standing gained when a fast order is bumped. */
  readonly sosGainFast?: number;
  /** Seconds of standing still before the manager starts to notice. */
  readonly idleGraceSec?: number;
  /** Idle meter points gained per second once the grace period is over. */
  readonly idleRatePerSec?: number;
  /** Chance the drink dispenser drops a drink, from 0 to 1. */
  readonly dispenserFailChance?: number;
}

/**
 * A stretch of the shift when cars come faster (#1938, #2086), as fractions
 * of the shift from 0 to 1. The start is inclusive and the end exclusive.
 */
export type RushWindow = readonly [startFraction: number, endFraction: number];

/** The standing meters a shift can start from, for a week's carry-over (#2086). */
export interface StartMeters {
  readonly sos: number;
  readonly dignity: number;
  /**
   * The hidden Solidarity value (#2087), carried whole from the day before.
   * Left out, a shift starts from the usual value; saves from before #2087
   * have none.
   */
  readonly solidarity?: number;
}

/** The hand-written micro-dilemmas a shift can put to the player (#2087). */
export type DilemmaId =
  | "stale-fries"
  | "short-till"
  | "shake-machine"
  | "long-break"
  | "free-drink"
  | "swap-saturday"
  | "upsell-day"
  | "onion-name"
  | "ice-machine"
  | "cold-burger"
  | "bathrooms"
  | "new-kid"
  | "early-bump"
  | "eighteen-close"
  | "fry-box";

/** Who puts a dilemma to the player, which sets its caption and voice. */
export type DilemmaSpeaker = "manager" | "coworker" | "customer";

/** One answer to a dilemma and what it costs (#2087). */
export interface DilemmaOption {
  readonly id: string;
  /** The button text, a few words. */
  readonly label: string;
  /** Meter changes, applied at once and clamped like every other change. */
  readonly sos: number;
  readonly dignity: number;
  /** The change to the hidden Solidarity value. */
  readonly solidarity: number;
  /** Whole cents taken out of the pay stub as a till shortage. */
  readonly payCents: number;
  /** The diary line this answer leaves, in the first person. */
  readonly diary: string;
}

/** A dilemma as written: the prompt, two answers and the default. */
export interface Dilemma {
  readonly id: DilemmaId;
  readonly speaker: DilemmaSpeaker;
  /** What is said or seen, one or two sentences. */
  readonly prompt: string;
  readonly options: readonly [DilemmaOption, DilemmaOption];
  /** The option taken when the timer runs out. */
  readonly defaultOptionId: string;
  /** The diary line when the timer ran out, said in place of the option's. */
  readonly timeoutDiary: string;
}

/** When a planned dilemma is put to the player during a shift (#2087). */
export interface DilemmaSlot {
  /** Shift time in seconds at which it is offered. */
  readonly at: number;
  readonly dilemmaId: DilemmaId;
}

/** The dilemma waiting for an answer. The booth keeps running meanwhile. */
export interface OpenDilemma {
  readonly dilemmaId: DilemmaId;
  readonly offeredAt: number;
  /** Shift time at which the default option is taken. */
  readonly closesAt: number;
}

/** One dilemma answered, by the player or by the clock (#2087). */
export interface DilemmaChoice {
  readonly dilemmaId: DilemmaId;
  readonly optionId: string;
  /** Shift time of the answer. */
  readonly at: number;
  /** True when the timer ran out and the default was taken. */
  readonly timedOut: boolean;
}

/**
 * How a shift ended in the diary (#2087): the meter failures, or at close
 * one of three endings chosen from Solidarity and Dignity.
 */
export type ShiftEndingId =
  "docked" | "breakdown" | "company-man" | "silent-exit" | "walkout";

export interface ShiftConfig extends ShiftScenario {
  /** Any string; the same seed and actions replay to the same shift. */
  readonly seed: string;
  /** Real seconds the shift lasts. */
  readonly durationSec: number;
  /**
   * The shift's rushes (#2086). Left out, a standard shift has the one lunch
   * rush and a scenario that sets its own arrival gaps has none; an empty
   * list means no rush at all.
   */
  readonly rushWindows?: readonly RushWindow[];
  /** True once the player is eighteen, so age-locked items ring up (#2086). */
  readonly ageUnlocked?: boolean;
  /** Where Dignity and SOS start, carried from the day before (#2086). */
  readonly startMeters?: StartMeters;
  /**
   * Seconds the player has to answer a dilemma (#2087). Left out, the usual
   * window; the booth passes a longer one for players who ask for more time.
   */
  readonly dilemmaWindowSec?: number;
  /**
   * The dilemmas this shift puts to the player, in order (#2139). A week
   * deals each day its own so no dilemma repeats; left out, the shift draws
   * from every dilemma a single shift can.
   */
  readonly dilemmaDeck?: readonly DilemmaId[];
}

/** The days of the week mode (#2086), Monday to Friday. */
export type WeekdayId =
  "monday" | "tuesday" | "wednesday" | "thursday" | "friday";

/** What a finished day of the week leaves behind (#2086). */
export interface WeekDayResult {
  readonly day: WeekdayId;
  /** The seed the day was played with, derived from the week seed. */
  readonly seed: string;
  readonly outcome: Exclude<ShiftOutcome, "playing">;
  /** The day's `scoreShift` result. */
  readonly score: number;
  readonly netCents: number;
  readonly served: number;
  readonly late: number;
  readonly expired: number;
  readonly drinksDropped: number;
  readonly yells: number;
  /** The standing meters when the day ended, before any carry-over. */
  readonly endMeters: StartMeters;
  /** How the day ended in the diary; missing from saves before #2087. */
  readonly ending?: ShiftEndingId;
  /** The dilemmas answered that day, in order; missing before #2087. */
  readonly choices?: readonly DayChoice[];
}

/** One dilemma answer as a day of the week keeps it (#2087). */
export interface DayChoice {
  readonly dilemmaId: DilemmaId;
  readonly optionId: string;
  readonly timedOut: boolean;
}

/**
 * A week of shifts in progress (#2086): plain data, so it can be saved
 * between days and a half-finished week resumed later.
 */
export interface WeekState {
  readonly version: 1;
  readonly seed: string;
  /** The days already worked, Monday first. */
  readonly days: readonly WeekDayResult[];
}

export interface ShiftTallies {
  readonly served: number;
  readonly late: number;
  readonly expired: number;
  readonly lockedAttempts: number;
  readonly wrongEntries: number;
  readonly drinksDropped: number;
  readonly yells: number;
  /** Orders bumped while their ticket was still green (#2057). */
  readonly fastBumps: number;
  /** Orders bumped since the last wrong entry. */
  readonly cleanStreak: number;
  /** The longest clean-order streak this shift. */
  readonly bestStreak: number;
  /** Points the clean-order streak has earned so far. */
  readonly streakPoints: number;
}

/**
 * The parts of a shift's arcade score (#2057), each already in points: late
 * cars are negative, and the closing and Dignity parts are zero unless the
 * shift reached close. `total` is their sum, never below zero.
 */
export interface ShiftScoreBreakdown {
  readonly served: number;
  readonly late: number;
  readonly speed: number;
  readonly streak: number;
  readonly closing: number;
  readonly dignity: number;
  readonly total: number;
}

export interface ShiftState {
  readonly config: ShiftConfig;
  /** Shift time in seconds, always between 0 and durationSec. */
  readonly time: number;
  readonly outcome: ShiftOutcome;
  readonly meters: Meters;
  readonly orders: readonly Order[];
  readonly pos: PosCursor;
  readonly tallies: ShiftTallies;
  /** Shift time of the player's last valid action. */
  readonly lastActionAt: number;
  /** Shift time before which the player cannot wipe again. */
  readonly wipeReadyAt: number;
  readonly nextOrderId: number;
  /** Shift time at which the next order arrives. */
  readonly nextArrivalAt: number;
  /** How many random draws this shift has consumed. */
  readonly draws: number;
  /**
   * The hidden Solidarity value (#2087), 0 to 100: how far the player has
   * stood with the crew. Dilemmas move it; the booth never shows it.
   */
  readonly solidarity: number;
  /** The dilemma waiting for an answer, or null. */
  readonly dilemma: OpenDilemma | null;
  /** Every dilemma answered so far, oldest first. */
  readonly dilemmaChoices: readonly DilemmaChoice[];
}

/** Everything the player can do. */
export type ShiftAction =
  | { readonly type: "selectOrder"; readonly orderId: number }
  | { readonly type: "posTap"; readonly nodeId: string }
  | { readonly type: "posBack" }
  | { readonly type: "posHome" }
  | { readonly type: "reenterDrink"; readonly orderId: number }
  | { readonly type: "flagCoworker"; readonly orderId: number }
  | { readonly type: "bump"; readonly orderId: number }
  | { readonly type: "wipe" }
  | { readonly type: "chooseDilemma"; readonly optionId: string };

/** One-shot facts for audio, screen effects and the diary log. */
export type ShiftEvent =
  | { readonly type: "order-arrived"; readonly orderId: number }
  | { readonly type: "order-expired"; readonly orderId: number }
  | {
      readonly type: "bumped";
      readonly orderId: number;
      readonly band: KdsBand;
    }
  | {
      readonly type: "item-rung";
      readonly orderId: number;
      readonly itemId: MenuItemId;
    }
  | { readonly type: "drink-dropped"; readonly orderId: number }
  | { readonly type: "drink-reentered"; readonly orderId: number }
  | { readonly type: "locked"; readonly orderId: number | null }
  | { readonly type: "coworker-ready"; readonly orderId: number }
  | { readonly type: "wrong-entry"; readonly nodeId: string }
  | { readonly type: "manager-yell" }
  | { readonly type: "wiped" }
  | {
      readonly type: "rush-started";
      /** Which of the shift's rushes began, counting from 0 (#2139). */
      readonly rush: number;
    }
  | { readonly type: "dilemma-offered"; readonly dilemmaId: DilemmaId }
  | {
      readonly type: "dilemma-resolved";
      readonly dilemmaId: DilemmaId;
      readonly optionId: string;
      readonly timedOut: boolean;
    }
  | { readonly type: "shift-ended"; readonly outcome: ShiftOutcome };

/** One event with the shift time it happened, as the booth keeps them. */
export interface ShiftLogEntry {
  readonly time: number;
  readonly event: ShiftEvent;
}

export interface StepResult {
  readonly state: ShiftState;
  readonly events: readonly ShiftEvent[];
}

/** A node in the deliberately clunky POS menu tree. */
export interface PosNode {
  readonly id: string;
  readonly label: string;
  readonly children?: readonly PosNode[];
  /** Set on leaves that ring up a menu item. */
  readonly itemId?: MenuItemId;
  /** Set on leaves that ring up a modifier. */
  readonly modifierId?: ModifierId;
}

/** The pay stub shown at the end of a shift. All amounts are whole cents. */
export interface PayStub {
  readonly paidMinutes: number;
  readonly grossCents: number;
  readonly uniformCents: number;
  readonly breakAdjustmentCents: number;
  readonly tillShortCents: number;
  readonly netCents: number;
}

/** Where one line of a ticket stands, as the kitchen display shows it. */
export type TicketLineStatus =
  /** Not rung up yet. */
  | "to-ring"
  /** Rung up. */
  | "rung"
  /** Rung up, but the dispenser dropped it; it must be re-entered. */
  | "dropped"
  /** Age-locked and nobody old enough has been flagged. */
  | "locked"
  /** A flagged coworker is still making it. */
  | "brewing"
  /** The coworker is done; it can be rung up now. */
  | "ready-to-ring";

export interface TicketLine {
  readonly itemId: MenuItemId;
  readonly label: string;
  readonly modifier: ModifierId | null;
  /** True while the line's modifier still has to be rung up. */
  readonly modifierPending: boolean;
  readonly status: TicketLineStatus;
}

/**
 * The parts of a shift the kitchen display reads. The config is optional and
 * only says whether age-locked items have unlocked (#2086).
 */
export type TicketSource = Pick<ShiftState, "time" | "orders" | "pos"> & {
  readonly config?: Pick<ShiftConfig, "ageUnlocked">;
};

/** One order as the kitchen display and the POS ticket strip show it. */
export interface KdsTicket {
  readonly orderId: number;
  readonly ageSec: number;
  readonly band: KdsBand;
  readonly lines: readonly TicketLine[];
  /** True when the order can be bumped. */
  readonly ready: boolean;
  /** True when this is the order the POS is ringing up. */
  readonly active: boolean;
  /** True when an age-locked item is waiting and nobody has been flagged. */
  readonly needsCoworker: boolean;
  /** Seconds until a flagged coworker is done, or null. */
  readonly coworkerReadyIn: number | null;
}

/** Which part of the booth the player is facing. */
export type BoothFacing = "window" | "counter" | "kitchen";

/** The player's head: where the camera points and where it is easing to. */
export interface LookState {
  /** Radians; positive turns left toward the window. */
  readonly yaw: number;
  /** Radians; positive looks up toward the order screen. */
  readonly pitch: number;
  readonly targetYaw: number;
  readonly targetPitch: number;
}

/** Input gathered since the last look step. */
export interface LookInput {
  /** Held turn keys: 1 turns left, -1 turns right, 0 holds still. */
  readonly turn: number;
  /** Mouse drag since the last step, in radians, already scaled. */
  readonly dragYaw: number;
  readonly dragPitch: number;
}

/** A named view the camera can be aimed at. */
export interface LookPreset {
  readonly yaw: number;
  readonly pitch: number;
}

/** The written intro shown before the player clocks in. */
export interface DiaryIntro {
  readonly title: string;
  readonly dateline: string;
  readonly paragraphs: readonly string[];
}

/** The people in the booth, renamed (ADR 0059, decision 9). */
export interface BoothCrew {
  /** The player, whose diary this is. */
  readonly player: string;
  /** The shift manager who cannot stand to see anyone idle. */
  readonly manager: string;
  /** The general manager, the kind one. */
  readonly generalManager: string;
  /** The adult coworker who is allowed to brew coffee. */
  readonly coworker: string;
}
