/**
 * The reactive jokes for For Better or Bulk. Each joke is triggered by one
 * engine event (or, for the ending, by the final state), and these pure
 * helpers are the one rule the cabinet and the tests share. Canvas jokes are
 * drawn by venue-canvas.ts from the same state; nothing here runs a loop.
 */

import {
  bankText,
  type GameEvent,
  type GameState,
} from "@/lib/for-better-or-bulk";
import { describeEvent } from "./messages";

/** The reactive jokes: eight in the brief, with the phone call split in two. */
export const JOKE_IDS = [
  "roses-yes",
  "phone-blocked",
  "phone-open",
  "burning",
  "shoes",
  "leaving",
  "simplify",
  "suit",
  "no-faq",
] as const;

/** One joke, named by the event that triggers it. */
export type JokeId = (typeof JOKE_IDS)[number];

/**
 * True when the garden-formal call got through with no FAQ on the site. The
 * ceremony shows the guest in stilettos only then.
 */
export function noFaq(state: GameState): boolean {
  return state.interruptions.some(
    (record) => record.id === "garden-formal" && record.blockedBy === null
  );
}

/** True once Fred has been sent off with the laptop still open (the leave choice). */
export function laptopBadgeShown(state: GameState): boolean {
  return state.presence?.choice === "leave";
}

/** The jokes one engine event triggers, in the order they should land. */
export function jokesFor(
  event: GameEvent,
  state: GameState
): readonly JokeId[] {
  switch (event.type) {
    case "picked-up":
      return event.item === "roses" && state.setup.cart.roses === "yes"
        ? ["roses-yes"]
        : [];
    case "interruption":
      return event.blockedBy ? ["phone-blocked"] : ["phone-open"];
    case "burnt":
      return ["burning"];
    case "shoes-retied":
      return ["shoes"];
    case "presence-decided":
      return event.decision.choice === "leave" ? ["leaving"] : [];
    case "simplified":
      return ["simplify"];
    case "level-finished":
      return noFaq(state) ? ["suit", "no-faq"] : ["suit"];
    default:
      return [];
  }
}

/**
 * The line a joke puts in the toast, from the line bank, or null when the
 * joke shows through the canvas or the ending instead.
 */
export function jokeLine(id: JokeId): string | null {
  switch (id) {
    case "roses-yes":
      return bankText("joke-roses");
    case "leaving":
      return bankText("joke-leaving");
    default:
      return null;
  }
}

/**
 * The toast for one event: the joke's line when a joke has one, otherwise the
 * usual line from the messages module, or null when the event needs none.
 */
export function lineFor(event: GameEvent, state: GameState): string | null {
  for (const id of jokesFor(event, state)) {
    const line = jokeLine(id);
    if (line !== null) return line;
  }
  return describeEvent(event);
}
