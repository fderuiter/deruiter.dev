/**
 * Turns engine events into the short lines the cabinet shows as toasts and
 * reads to screen readers. Only events a player needs to react to get a
 * line; routine pick-ups and put-downs stay silent.
 */

import {
  BLOCKED_TOASTS,
  CATEGORY_LABELS,
  FLOOR_FULL_REPEAT_SECONDS,
  INTERRUPTIONS,
  type Category,
  type GameEvent,
  type PlayerId,
  type GameState,
} from "@/lib/for-better-or-bulk";

const NAMES = { fred: "Fred", abbi: "Abbi" } as const;

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
