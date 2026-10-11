/**
 * For Better or Bulk: type contracts for the real-time wedding-setup engine
 * (ADR 0060). Every value is plain data, so a level can be snapshotted and
 * replayed from its setup and recorded input frames.
 */

/** A website feature built months before the wedding. */
export type CapabilityId = "faq" | "admin" | "registry" | "intro3d";

/** How many Kirkland roses went in the car. "yes" is the whole pallet. */
export type RoseTier = "modest" | "full" | "yes";

/** How much food went in the car; drinks and the sheet cake are included. */
export type FoodTier = "enough" | "lots" | "feed-rochester";

/** The two people setting up. Either can be played; both in co-op. */
export type PlayerId = "fred" | "abbi";

/** What the warehouse run put in the car. */
export interface Cart {
  readonly roses: RoseTier;
  readonly food: FoodTier;
  readonly lanterns: boolean;
}

/** Everything decided before the clock starts. */
export interface Setup {
  readonly capabilities: readonly CapabilityId[];
  readonly cart: Cart;
  /** Stretches the clock for players who want more time. */
  readonly relaxed: boolean;
  /**
   * Solo play only: a deterministic helper moves the partner the player is
   * not controlling. Co-op ignores it, and it never acts for Fred while away.
   * Off when absent, so setups saved before the helper existed still load.
   */
  readonly assist?: boolean;
  /**
   * The day's seed: 0 (the default, also when absent, so older shared runs
   * replay unchanged) schedules no events; any other seed schedules a shower
   * and a guest rush, the same for everyone who has that seed.
   */
  readonly seed?: number;
}

/** The seeded events a level can schedule. */
export type SeededEventId = "shower" | "guest-rush";

/** A seeded event, in level seconds: it is on from `at` up to `until`. */
export interface SeededEvent {
  readonly id: SeededEventId;
  readonly at: number;
  readonly until: number;
}

/** Things a person can carry. Burnt food cannot be served. */
export type ItemKind =
  | "roses"
  | "arrangement"
  | "petals"
  | "hotdogs-raw"
  | "hotdogs"
  | "wings-raw"
  | "wings"
  | "mac"
  | "quinoa"
  | "burnt"
  | "lantern"
  | "chairs";

export interface Item {
  readonly kind: ItemKind;
  /** Who did the work that made this item, if anyone. */
  readonly madeBy: PlayerId | null;
}

/** What a crate in the car or shed hands out, from a shared stock. */
export type SupplyKind =
  | "roses"
  | "hotdogs-raw"
  | "wings-raw"
  | "mac"
  | "quinoa"
  | "lantern"
  | "chairs";

/** A work surface that changes what is put on it. */
export type StationKind = "arrange" | "petals" | "grill" | "bin";

/** A place in the venue that wants one item. */
export type TargetKind =
  "basket" | "table" | "aisle" | "chair-spot" | "hook" | "buffet";

/** The groups the receipt reports on. */
export type Category =
  "bouquets" | "centerpieces" | "petals" | "chairs" | "lanterns" | "buffet";

export interface Tile {
  readonly x: number;
  readonly y: number;
}

/** A crate tile; crates of one kind share a stock. */
export interface Supply extends Tile {
  readonly id: string;
  readonly kind: SupplyKind;
}

export interface Station extends Tile {
  readonly id: string;
  readonly kind: StationKind;
  readonly item: Item | null;
  /** Seconds of work or cooking spent on the current item. */
  readonly progress: number;
}

/** How a target stands. Simplified means removed from the plan on purpose. */
export type TargetStatus = "unplanned" | "open" | "filled" | "simplified";

export interface Target extends Tile {
  readonly id: string;
  readonly kind: TargetKind;
  readonly category: Category;
  /** The item this target accepts. */
  readonly wants: ItemKind;
  /** How many items it takes to fill; the basket takes two. */
  readonly capacity: number;
  readonly filled: readonly Item[];
  readonly filledBy: readonly PlayerId[];
  readonly status: TargetStatus;
  /** Seconds of held work toward simplifying it. */
  readonly simplifyProgress: number;
}

/** Where someone is during the morning. */
export type PlayerPresence = "here" | "away";

export interface Player {
  readonly id: PlayerId;
  readonly x: number;
  readonly y: number;
  /** Unit vector of the last movement, snapped to four directions. */
  readonly facingX: number;
  readonly facingY: number;
  readonly holding: Item | null;
  readonly presence: PlayerPresence;
  /** Seconds left frozen on a phone call or re-tying shoes. */
  readonly busyFor: number;
  readonly busyReason: string | null;
  /** True once a break or the brothers have calmed Fred down. */
  readonly calm: boolean;
  /** Seconds the work key has been held facing the bin with an item in hand. */
  readonly binHold: number;
}

/** One person's controls for one tick. */
export interface PlayerInput {
  /** -1, 0 or 1 on each axis. */
  readonly moveX: number;
  readonly moveY: number;
  /** True on the tick the interact button went down. */
  readonly interact: boolean;
  /** True while the work button is held. */
  readonly work: boolean;
}

/** What Fred does when his brothers text. */
export type PresenceChoice = "stay" | "break" | "leave";

/** What Fred promises to come back for on a break. */
export type Commitment = "chairs" | "lanterns" | "buffet" | "flowers";

export interface PresenceDecision {
  readonly choice: PresenceChoice;
  readonly commitment: Commitment | null;
}

/** An interruption that freezes someone unless a website feature blocks it. */
export type InterruptionId =
  "garden-formal" | "parking-note" | "registry-ask" | "ceremony-time";

export interface InterruptionRecord {
  readonly id: InterruptionId;
  readonly at: number;
  readonly player: PlayerId;
  readonly blockedBy: CapabilityId | null;
}

/** The run's phase: playing, paused on the brothers' text, or over. */
export type Phase = "playing" | "brothers" | "done";

/** One floor spot holding an item someone put down. */
export interface FloorItem extends Tile {
  readonly item: Item;
}

export interface GameState {
  readonly setup: Setup;
  readonly phase: Phase;
  /** Seconds since 9:00 in game time; the level ends at `duration`. */
  readonly time: number;
  readonly duration: number;
  readonly tick: number;
  readonly players: Readonly<Record<PlayerId, Player>>;
  readonly supplies: readonly Supply[];
  /** What is left in the car and shed, by kind. */
  readonly stock: Readonly<Record<SupplyKind, number>>;
  readonly stations: readonly Station[];
  readonly targets: readonly Target[];
  readonly floor: readonly FloorItem[];
  readonly interruptions: readonly InterruptionRecord[];
  /** The seeded events this level will have, from the setup's seed. */
  readonly seeded: readonly SeededEvent[];
  readonly presence: PresenceDecision | null;
  /** When Fred is due back, in level seconds, while he is away. */
  readonly returnsAt: number | null;
  /** Level time the brothers' text landed, once it has. */
  readonly brothersAt: number | null;
  /** Level time the first target became full, if one has. */
  readonly firstFilledAt: number | null;
  readonly burntBatches: number;
  /** Level time at which everything planned was done, if before the end. */
  readonly finishedAt: number | null;
  /**
   * Ticks on which the solo assist acted for the partner. Zero means the
   * helper never mattered, so the receipt does not mention it.
   */
  readonly assistTicks: number;
}

/** The inputs for one tick, plus the brothers decision when one is made. */
export interface Frame {
  readonly inputs: Readonly<Record<PlayerId, PlayerInput>>;
  readonly decision?: PresenceDecision;
  /**
   * In solo play, the person the player is not controlling this tick. The
   * solo assist acts for them only when the setup turns it on and their input
   * here is idle.
   */
  readonly assisted?: PlayerId;
}

/** One-shot things that happened, for sounds, toasts and jokes. */
export type GameEvent =
  | {
      readonly type: "picked-up";
      readonly player: PlayerId;
      readonly item: ItemKind;
    }
  | {
      readonly type: "put-down";
      readonly player: PlayerId;
      readonly item: ItemKind;
    }
  | {
      readonly type: "crafted";
      readonly player: PlayerId;
      readonly item: ItemKind;
    }
  | {
      readonly type: "cooked";
      readonly station: string;
      readonly item: ItemKind;
    }
  | { readonly type: "burnt"; readonly station: string }
  | {
      readonly type: "target-filled";
      readonly player: PlayerId;
      readonly target: string;
      readonly category: Category;
    }
  | {
      readonly type: "simplified";
      readonly target: string;
      readonly category: Category;
    }
  | {
      readonly type: "interruption";
      readonly id: InterruptionId;
      readonly player: PlayerId;
      readonly blockedBy: CapabilityId | null;
    }
  | {
      readonly type: "thrown-out";
      readonly player: PlayerId;
      readonly item: ItemKind;
    }
  | { readonly type: "floor-full"; readonly player: PlayerId }
  | { readonly type: "brothers-text" }
  | { readonly type: "presence-decided"; readonly decision: PresenceDecision }
  | { readonly type: "fred-returned" }
  | { readonly type: "shoes-retied" }
  | { readonly type: "supply-empty"; readonly supply: SupplyKind }
  | { readonly type: "seeded-start"; readonly id: SeededEventId }
  | { readonly type: "seeded-end"; readonly id: SeededEventId }
  | { readonly type: "level-finished"; readonly early: boolean };

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export type Validation =
  { readonly ok: true } | { readonly ok: false; readonly reason: string };

/** Whether one fact behind an outcome was true, with the evidence. */
export interface Condition {
  readonly label: string;
  readonly met: boolean;
  readonly detail: string;
}

export type Readiness = "ready" | "simplified" | "unfinished" | "unplanned";

export interface ReadinessLine {
  readonly category: Category;
  readonly label: string;
  readonly status: Readiness;
  readonly placed: number;
  readonly planned: number;
  readonly conditions: readonly Condition[];
  readonly explanation: string;
}

export interface SpendingLine {
  readonly id: string;
  readonly label: string;
  readonly dollars: number;
}

export interface WebsiteLine {
  readonly capability: CapabilityId;
  readonly chosen: boolean;
  readonly text: string;
}

/** The title a run earns, from a fixed priority order. */
export type RunTitle =
  | "Bulk Romantic"
  | "171 Commits and a Ceremony"
  | "The Gardens Did the Decorating"
  | "Operationally Married"
  | "Is It Loading?"
  | "Operational, Not Present"
  | "Married Anyway";

/** The three game challenges a finished run is checked against. */
export type ChallengeId = "no-burnt" | "set-by-three" | "fred-stayed";

/** One game challenge: whether the run met it, and the fact behind that. */
export interface ChallengeResult {
  readonly id: ChallengeId;
  readonly label: string;
  readonly met: boolean;
  readonly detail: string;
}

/** The ending: a story artifact that explains itself. It is not a grade. */
export interface Receipt {
  readonly spending: {
    readonly lines: readonly SpendingLine[];
    readonly total: number;
    readonly budget: number;
  };
  readonly readiness: readonly ReadinessLine[];
  readonly followThrough: {
    readonly status: "kept" | "missed";
    readonly explanation: string;
  };
  readonly website: readonly WebsiteLine[];
  readonly finishedAt: string | null;
  readonly kitchen: string | null;
  readonly signatureMoment: string;
  readonly title: RunTitle;
  /** The real weather line, kept as Fred and Abbi told it. */
  readonly weather: string;
  /** Game weather, labelled as game weather; null on a standard day. */
  readonly gameWeather: string | null;
  readonly leftovers: string;
  readonly suit: string;
  /** The honest line about the solo helper, present only when it was on. */
  readonly assist: string | null;
  /** Game challenges: game play only, never a judgment of the wedding. */
  readonly challenges: readonly ChallengeResult[];
  /** How many of the challenges the run met, from 0 to 3. */
  readonly stars: number;
  readonly disclaimer: string;
}
