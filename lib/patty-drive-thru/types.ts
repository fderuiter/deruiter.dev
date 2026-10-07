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

export interface ShiftScenarioConfig {
  /** Any string; the same seed and actions replay to the same shift. */
  readonly seed: string;
  /** Real seconds the shift lasts. */
  readonly durationSec: number;
  /** Minimum gap between car arrivals in seconds. */
  readonly arrivalGapMinSec?: number;
  /** Maximum gap between car arrivals in seconds. */
  readonly arrivalGapMaxSec?: number;
  /** Shift time of first order arrival. */
  readonly firstArrivalSec?: number;
  /** Meter loss on expired order. */
  readonly sosLossExpired?: number;
  /** Meter loss on late order bump. */
  readonly sosLossLate?: number;
  /** Meter gain on on-time order bump. */
  readonly sosGainOnTime?: number;
  /** Meter gain on fast order bump. */
  readonly sosGainFast?: number;
  /** Seconds of idle before manager notices. */
  readonly idleGraceSec?: number;
  /** Points gained per second when idle after grace period. */
  readonly idleRatePerSec?: number;
  /** Chance automatic drink dispenser drops drink (0-1). */
  readonly dispenserFailChance?: number;
  /** Custom root node of the POS menu tree. */
  readonly posMenu?: PosNode;
}

export type ShiftConfig = ShiftScenarioConfig;

export interface ShiftActionEntry {
  readonly at: number;
  readonly action: ShiftAction;
}

export interface ShiftTallies {
  readonly served: number;
  readonly late: number;
  readonly expired: number;
  readonly lockedAttempts: number;
  readonly wrongEntries: number;
  readonly drinksDropped: number;
  readonly yells: number;
}

export interface ShiftState {
  readonly config: ShiftScenarioConfig;
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
  /** Recorded action history for replay and telemetry export. */
  readonly history?: readonly ShiftActionEntry[];
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
  | { readonly type: "wipe" };

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
  | { readonly type: "shift-ended"; readonly outcome: ShiftOutcome };

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

/** The parts of a shift the kitchen display reads. */
export type TicketSource = Pick<ShiftState, "time" | "orders" | "pos">;

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
