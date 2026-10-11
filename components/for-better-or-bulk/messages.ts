/**
 * Turns engine events into the short lines the cabinet shows as toasts and
 * reads to screen readers. Only events a player needs to react to get a
 * line; routine pick-ups and put-downs stay silent.
 */

import {
  BLOCKED_TOASTS,
  bankText,
  CATEGORY_LABELS,
  clockLabel,
  FLOOR_FULL_REPEAT_SECONDS,
  INTERRUPTIONS,
  type Category,
  type GameEvent,
  type PlayerId,
  type GameState,
  type SeededEventId,
} from "@/lib/for-better-or-bulk";

const NAMES = { fred: "Fred", abbi: "Abbi" } as const;

/** The toast that opens each seeded event, from the line bank. */
const SEEDED_LINES: Readonly<Record<SeededEventId, string>> = {
  shower: bankText("shower-start"),
  "guest-rush": bankText("rush-start"),
};

/**
 * Each seeded event as the setup screen and the status line describe it. The
 * status line is what is on right now; the note says what it does.
 */
export const SEEDED_EVENT_NOTES: Readonly<
  Record<SeededEventId, { readonly note: string; readonly status: string }>
> = {
  shower: {
    note: "Shower: wet grass slows walking on the lawn for a while.",
    status: "Shower: the lawn is slow",
  },
  "guest-rush": {
    note: "Guest rush: guests come early, and food on the grill burns faster for a while.",
    status: "Guest rush: food burns faster",
  },
};

/**
 * The day's name for the cabinet header: the standard day, today's seed, or
 * the seed number a shared link or the setup chose. Pure.
 */
export function seedName(seed: number, todaysSeed: number): string {
  if (seed === 0) return "Standard day";
  if (seed === todaysSeed) return "Today's seed";
  return `Seed ${seed}`;
}

/** The short header name for each seeded event. */
const SEEDED_EVENT_HEADER: Readonly<Record<SeededEventId, string>> = {
  shower: "shower",
  "guest-rush": "rush",
};

/**
 * The header's seed line: the day's name, then its seeded events by clock time,
 * such as "Seed 12345 · shower at 1:10, rush at 2:30". A standard day has none.
 */
export function seedHeader(state: GameState, todaysSeed: number): string {
  const name = seedName(state.setup.seed ?? 0, todaysSeed);
  if (state.seeded.length === 0) return name;
  const events = state.seeded
    .map(
      (event) =>
        `${SEEDED_EVENT_HEADER[event.id]} at ${clockLabel(event.at, state.duration)}`
    )
    .join(", ");
  return `${name} · ${events}`;
}

/** The status lines for the seeded events on at the level's current time. */
export function activeEventLines(state: GameState): string[] {
  return state.seeded
    .filter((event) => state.time >= event.at && state.time < event.until)
    .map((event) => SEEDED_EVENT_NOTES[event.id].status);
}

/** The checklist rows the side panel lists, in order. */
export const CHECKLIST: readonly Category[] = [
  "bouquets",
  "centerpieces",
  "petals",
  "chairs",
  "lanterns",
  "buffet",
];

/** Planned targets in one category, and how many of them are filled. */
export function checklistLine(
  state: GameState,
  category: Category
): { done: number; planned: number } | null {
  const planned = state.targets.filter(
    (t) => t.category === category && t.status !== "unplanned"
  );
  if (planned.length === 0) return null;
  const counted = planned.filter((t) => t.status !== "simplified");
  return {
    done: counted.filter((t) => t.status === "filled").length,
    planned: counted.length,
  };
}

/** A category whose planned targets are all filled or simplified this step. */
function isComplete(state: GameState, category: Category): boolean {
  const line = checklistLine(state, category);
  return line !== null && line.done === line.planned;
}

/**
 * The categories that became complete between two states. The engine has no
 * event for this, so the cabinet derives it from the step's before and after.
 */
export function completedCategories(
  before: GameState,
  after: GameState
): Category[] {
  return CHECKLIST.filter(
    (category) => !isComplete(before, category) && isComplete(after, category)
  );
}

const SUPPLY_LABELS = {
  roses: "roses",
  "hotdogs-raw": "hot dogs",
  "wings-raw": "wings",
  mac: "mac and cheese",
  quinoa: "quinoa salad",
  lantern: "lanterns",
  chairs: "chair stacks",
} as const;

/**
 * Keeps the events to show, dropping a floor-full line the same person was
 * already shown less than FLOOR_FULL_REPEAT_SECONDS of game time ago. `shown`
 * records when each person last saw one and is updated in place.
 */
export function throttleFloorFull(
  events: readonly GameEvent[],
  time: number,
  shown: Partial<Record<PlayerId, number>>
): GameEvent[] {
  return events.filter((event) => {
    if (event.type !== "floor-full") return true;
    const last = shown[event.player];
    if (last !== undefined && time - last < FLOOR_FULL_REPEAT_SECONDS) {
      return false;
    }
    shown[event.player] = time;
    return true;
  });
}

/** The line for one event, or null when it needs none. */
export function describeEvent(event: GameEvent): string | null {
  switch (event.type) {
    case "interruption": {
      if (event.blockedBy) return BLOCKED_TOASTS[event.blockedBy];
      const call = INTERRUPTIONS.find((c) => c.id === event.id);
      return `${NAMES[event.player]}'s phone: "${call?.text ?? "Quick question?"}"`;
    }
    case "cooked":
      return event.item === "hotdogs"
        ? "The hot dogs are done."
        : "The wings are done.";
    case "burnt":
      return "Something on the grill is now charcoal.";
    case "supply-empty":
      return `That was the last of the ${SUPPLY_LABELS[event.supply]}.`;
    case "simplified":
      return `Left one ${CATEGORY_LABELS[event.category].toLowerCase()} spot bare. Restraint. Very adult.`;
    case "floor-full":
      return "No room on the floor. Find a counter or a target.";
    case "brothers-text":
      return "Fred's brothers are texting.";
    case "fred-returned":
      return "Fred is back, and noticeably calmer.";
    case "shoes-retied":
      return "Fred is re-tying his shoes. Again.";
    case "seeded-start":
      return SEEDED_LINES[event.id];
    case "level-finished":
      return event.early
        ? "Everything is set. Early, even."
        : "It's 4:00. Time to get married.";
    default:
      return null;
  }
}

/** What the cabinet can give feedback for: engine events plus one derived here. */
export type FeedbackEvent =
  | GameEvent
  | { readonly type: "category-complete"; readonly category: Category };

/** The named sounds the cabinet can play; see sfx.ts for the recipes. */
export type SoundKey =
  | "place"
  | "category"
  | "cooked"
  | "burnt"
  | "brothers"
  | "fred"
  | "finish"
  | "refused";

/** The sound for one event, or null when it plays none. */
export function soundFor(event: FeedbackEvent): SoundKey | null {
  switch (event.type) {
    case "target-filled":
      return "place";
    case "category-complete":
      return "category";
    case "cooked":
      return "cooked";
    case "burnt":
      return "burnt";
    case "brothers-text":
      return "brothers";
    case "fred-returned":
      return "fred";
    case "level-finished":
      return "finish";
    case "floor-full":
      return "refused";
    case "interruption":
      return event.blockedBy ? "refused" : null;
    default:
      return null;
  }
}

/**
 * Plays one step's sounds through the play callback: at most one per sound
 * key, and no "place" tick when a category completes in the same step, since
 * the category chime stands for that moment. A step can carry several events
 * (a background-tab catch-up runs up to eight), so this keeps them from
 * stacking into noise.
 */
export function playStepSounds(
  events: readonly FeedbackEvent[],
  play: (key: SoundKey) => void
): void {
  const hasCategory = events.some(
    (event) => event.type === "category-complete"
  );
  const keys = new Set<SoundKey>();
  for (const event of events) {
    const key = soundFor(event);
    if (key && !(key === "place" && hasCategory)) keys.add(key);
  }
  for (const key of keys) play(key);
}
