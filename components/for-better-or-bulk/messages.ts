/**
 * Turns engine events into the short lines the cabinet shows as toasts and
 * reads to screen readers. Only events a player needs to react to get a
 * line; routine pick-ups and put-downs stay silent.
 */

import {
  BLOCKED_TOASTS,
  CATEGORY_LABELS,
  INTERRUPTIONS,
  type GameEvent,
} from "@/lib/for-better-or-bulk";

const NAMES = { fred: "Fred", abbi: "Abbi" } as const;

const SUPPLY_LABELS = {
  roses: "roses",
  "hotdogs-raw": "hot dogs",
  "wings-raw": "wings",
  mac: "mac and cheese",
  quinoa: "quinoa salad",
  lantern: "lanterns",
  chairs: "chair stacks",
} as const;

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
