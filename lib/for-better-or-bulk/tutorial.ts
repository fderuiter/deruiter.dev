import type { TutorialScript } from "@/lib/arcade";
import { DEFAULT_SETUP } from "./presets";
import type { GameEvent, GameState, PlayerId, Setup } from "./types";

/**
 * The signals For Better or Bulk sends its tutorial (#3456): the person at
 * the keys walked, picked something up, put it down, finished a held job,
 * or the player swapped to the other person.
 */
export const FOR_BETTER_OR_BULK_TUTORIAL_SIGNALS = {
  move: "move",
  pickUp: "pick-up",
  putDown: "put-down",
  work: "work",
  swap: "swap",
} as const;

const S = FOR_BETTER_OR_BULK_TUTORIAL_SIGNALS;

/**
 * The plan a tutorial day runs on: the default plan, solo, with no helper,
 * so everything that happens is the player's own doing.
 */
export const TUTORIAL_SETUP: Setup = { ...DEFAULT_SETUP, assist: false };

/**
 * The signals one engine step earns for the person at the keys: a walk
 * when they moved, and one per pick up, put down or held job they finished
 * (an arrangement or a bucket of petals).
 * The other person's events are not theirs, so they never count.
 *
 * @param before - The state before the step.
 * @param after - The state after it.
 * @param events - What the step reported.
 * @param active - The person the player controls.
 * @returns The signals, each once, in a stable order.
 */
export function bulkTutorialSignals(
  before: GameState,
  after: GameState,
  events: readonly GameEvent[],
  active: PlayerId
): string[] {
  const signals = new Set<string>();
  const was = before.players[active];
  const now = after.players[active];
  if (was.x !== now.x || was.y !== now.y) signals.add(S.move);
  for (const event of events) {
    if (!("player" in event) || event.player !== active) continue;
    if (event.type === "picked-up") signals.add(S.pickUp);
    else if (event.type === "put-down") signals.add(S.putDown);
    else if (event.type === "crafted") signals.add(S.work);
  }
  return [S.move, S.pickUp, S.putDown, S.work].filter((s) => signals.has(s));
}

/**
 * Holds the venue clock where it was, so a tutorial day never reaches a
 * phone call, the brothers' text, the shower or 4:00. Everything else in
 * the step stands: people walk, carry and work, and the grill still cooks.
 *
 * @param before - The state before the step.
 * @param after - The state the engine returned.
 * @returns The step's state with the clock unmoved.
 */
export function holdTutorialClock(
  before: GameState,
  after: GameState
): GameState {
  if (after.phase !== "playing" || after.time === before.time) return after;
  return { ...after, time: before.time };
}

/**
 * For Better or Bulk's guided tutorial (#3456). It runs a practice day on
 * the default plan whose clock stands still, and teaches the loop by
 * doing: walk, pick up, put down, hold to work, and swap. The wording and
 * keys match the Field Manual.
 */
export const FOR_BETTER_OR_BULK_TUTORIAL: TutorialScript = {
  gameId: "for-better-or-bulk",
  version: 1,
  minutes: 3,
  steps: [
    {
      id: "welcome",
      chapter: "The day",
      title: "Set up by 4:00",
      body: "Fred and Abbi have from 9:00 to the 4:00 ceremony to turn a car full of warehouse supplies into a wedding. On this practice day the clock stands still.",
    },
    {
      id: "move",
      chapter: "The loop",
      title: "Walk",
      body: "You are playing Abbi. Walk her around the patio and the lawn.",
      keys: "W A S D or the arrow keys",
      touch: "The move stick",
      target: "venue",
      practice: { signal: S.move },
    },
    {
      id: "pick-up",
      chapter: "The loop",
      title: "Pick something up",
      body: "The crates from the car line the left edge and the top. Walk up to one, face it and pick something up. Roses are a good start.",
      keys: "E, Space or Enter",
      touch: "Use",
      target: "venue",
      practice: { signal: S.pickUp },
    },
    {
      id: "put-down",
      chapter: "The loop",
      title: "Put it where it goes",
      body: "Carry it there and put it down: roses to the rose table, raw meat to the grill, chairs and lanterns to their spots.",
      keys: "E, Space or Enter",
      touch: "Use",
      target: "venue",
      practice: { signal: S.putDown },
    },
    {
      id: "work",
      chapter: "The loop",
      title: "Hold to work",
      body: "Roses on the rose table become an arrangement after a moment of held work. Stand there and hold the work key until it is done.",
      keys: "Hold F or Shift",
      touch: "Hold Work",
      target: "venue",
      practice: { signal: S.work },
    },
    {
      id: "swap",
      chapter: "Two people",
      title: "Swap to Fred",
      body: "Alone, you play both of them. Swap to the other person, so neither stands idle.",
      keys: "Tab",
      touch: "Swap",
      target: "active",
      practice: { signal: S.swap },
    },
    {
      id: "checklist",
      chapter: "Scoring",
      title: "The checklist",
      body: "Every planned spot wants one thing, and the checklist counts what is done. At 4:00 the receipt explains what got done, who did it and why.",
      target: "checklist",
    },
    {
      id: "done",
      chapter: "Scoring",
      title: "The real day",
      body: "A real day adds phone calls, the brothers' text, the shower and a clock that runs. The Field Manual has the rules.",
    },
  ],
};
