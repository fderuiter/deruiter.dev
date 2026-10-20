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

/**
 * Opener pools (#2413): the scripted setups a run's first Blind may be
 * dealt, by scenario id. The first entry is the Blind's own `pinned` setup,
 * which the pool was written against; the rest are its alternatives. Every
 * Small Blind opener keeps Draft A of Table 14.1.1 and its supporting
 * Listing 16.2.4, the TLF Pair the Blind teaches, so skipping QC on the
 * draft's fatal denominator still costs the hand. Each pins five cards, as
 * the Blind's own setup does, so the opening hand still has three shuffled
 * cards.
 */
const OPENER_POOLS: Readonly<Record<string, readonly (readonly string[])[]>> = {
  "demographics-small-blind": [
    // The Blind's own setup: the three drafts, their listing, disposition.
    ["C-T14.1.1-A", "C-L16.2.4", "C-T14.1.2", "C-T14.1.1-B", "C-T14.1.1-C"],
    // Disposition with its discontinued-subjects listing, and the blank
    // demographics shell to compile.
    ["C-T14.1.1-A", "C-L16.2.4", "C-T14.1.2", "C-L16.1.1", "C-T14.1.3"],
    // Two drafts beside a preview of the adverse-event pair.
    ["C-T14.1.1-A", "C-L16.2.4", "C-T14.3.1", "C-L16.2.7", "C-T14.1.1-B"],
    // The faulty and the clean draft, disposition and the blank shell.
    ["C-T14.1.1-A", "C-L16.2.4", "C-T14.1.2", "C-T14.1.1-C", "C-T14.1.3"],
  ],
};

/**
 * How a run deals its first Blind's scripted setup (#2413). POOL is the
 * default: the run's seed picks one of the Blind's openers. FIXED always
 * deals the Blind's own `pinned` setup, as runs did before #2413, so a save
 * recorded then still replays move for move.
 */
export type OpenerDealing = "POOL" | "FIXED";

/** Whether two setups pin the same cards, in any order. */
function sameSetup(a: readonly string[], b: readonly string[]): boolean {
  const ids = new Set(a);
  return (
    a.length === b.length &&
    ids.size === a.length &&
    b.every((id) => ids.has(id))
  );
}

/**
 * The setups a Blind may open a run on: its own `pinned` setup first, then
 * the alternatives in its opener pool. A Blind with no pool has one opener,
 * and so does one whose own setup is not the one its pool was written
 * against, such as a rewritten or wholly pinned deck: it keeps its setup.
 * An alternative naming a card the deck does not hold, as a rewritten deck
 * might, is left out, so every opener returned is a legal deal.
 */
export function openerPool(scenario: Scenario): readonly (readonly string[])[] {
  const own = scenario.pinned ?? [];
  const [base, ...alternatives] = OPENER_POOLS[scenario.id] ?? [];
  if (!base || !sameSetup(base, own)) return [own];
  const deck = new Set(scenario.deck.map((card) => card.id));
  const fits = (opener: readonly string[]) =>
    opener.length <= scenario.table.handSize &&
    new Set(opener).size === opener.length &&
    opener.every((id) => deck.has(id));
  return [own, ...alternatives.filter(fits)];
}

/**
 * The Blind as it opens on opener `index` of its pool: its `pinned` setup
 * replaced by that opener. Index 0, or one outside the pool, is the Blind
 * itself, unchanged.
 */
export function withOpener(scenario: Scenario, index: number): Scenario {
  if (index === 0) return scenario;
  const opener = openerPool(scenario)[index];
  return opener ? { ...scenario, pinned: [...opener] } : scenario;
}
