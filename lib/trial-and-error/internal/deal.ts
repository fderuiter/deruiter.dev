import type { Scenario } from "../types";
import { drawInt } from "./rng";

/**
 * Seeded deal order (#2055). Each Blind of a run deals its deck in an order
 * shuffled from the run seed, on a stream of its own per act and Blind, so
 * the shuffle never shifts the run's Boss, crisis, deviation, shop or
 * Form 483 draws. The same seed deals the same order every time, which keeps
 * the Daily Protocol and challenge links reproducible.
 */

/**
 * How a run deals its Blinds. SHUFFLED is the default; AUTHORED deals every
 * deck in its written order, as runs did before #2055, so a save recorded
 * then still replays move for move.
 */
export type DeckDealing = "SHUFFLED" | "AUTHORED";

/** The deal stream's seed for one Blind of a run. */
export const dealSeed = (seed: string, actIndex: number, blindIndex: number) =>
  `${seed}/deal/${actIndex}/${blindIndex}`;

/**
 * The order a Blind deals its deck in, as indices into `scenario.deck`. The
 * cards `scenario.pinned` names are a scripted setup the Blind depends on:
 * they are dealt first, in deck order. The rest follow in a Fisher-Yates
 * shuffle on `seed`, one draw per position.
 */
export function shuffledDeckOrder(scenario: Scenario, seed: string): number[] {
  const pinned = new Set(scenario.pinned ?? []);
  const indices = scenario.deck.map((_, index) => index);
  const head = indices.filter((i) => pinned.has(scenario.deck[i].id));
  const rest = indices.filter((i) => !pinned.has(scenario.deck[i].id));
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = drawInt(seed, i, i + 1);
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...head, ...rest];
}
