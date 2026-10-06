/**
 * The diary around the shift (#1814): the intro, the people, what they say,
 * how the shift ends and the closing note. The chain is fictional and every
 * real person is renamed (ADR 0059, decision 9); nothing here names a real
 * company, product or person other than the diary's author.
 */

import { drawInt } from "../../utils/prng";
import type { BoothCrew, DiaryIntro, ShiftOutcome, ShiftState } from "../types";

/** The people in the booth. */
export const BOOTH_CREW: BoothCrew = {
  player: "Fred",
  manager: "Bo",
  generalManager: "Heidi",
  coworker: "Dale",
};

/** Shown before the player clocks in. */
export const DIARY_INTRO: DiaryIntro = {
  title: "Patty's Drive-Thru",
  dateline: "A diary entry. First job, 2014 to 2017, off and on.",
  paragraphs: [
    "My first job was the drive-thru window at a fast-food place. I worked there on and off from 2014 to 2017, starting before I was old enough to press every button on the register.",
    'This is one shift, squeezed from four hours into three minutes. The headset is in your left ear and the kitchen is in your right. Orders go up on the screen over the counter and turn yellow, then red. The register hides "no pickles" four menus deep. The drink machine loses orders, so you will ring some of them in twice.',
    `You are not eighteen yet, so you are not allowed to brew coffee. Flag ${BOOTH_CREW.coworker}. ${BOOTH_CREW.coworker} is nineteen.`,
    `${BOOTH_CREW.manager} runs the shift. ${BOOTH_CREW.manager} does not like to see anyone standing still. If there is nothing to do, wipe something.`,
    "The chain is made up and the people are renamed. The shift is real enough.",
  ],
};

/** What comes through the headset when a car pulls up, one per car. */
export const HEADSET_LINES: readonly string[] = [
  "Yeah. Hi. Hold on.",
  "Hello? Is anybody in there?",
  "Just give me whatever is fastest.",
  "I said no pickles last time, too.",
  "Can you hurry it up?",
  "(They are on the phone. They order anyway.)",
];

/** What the shift manager says when the player stands still too long. */
export const MANAGER_LINES: readonly string[] = [
  "If you have time to lean, you have time to clean.",
  "Are we paying you to stand there?",
  "Grab a rag.",
];

/** Short captions for the shift's one-shot events. */
export const EVENT_CAPTIONS = {
  drinkDropped: "The dispenser lost the drink. Ring it in again.",
  drinkReentered: "Drink re-entered. Again.",
  locked: `That button needs someone who is eighteen. Flag ${BOOTH_CREW.coworker}.`,
  coworkerFlagged: `${BOOTH_CREW.coworker} sighs and starts the coffee.`,
  coworkerReady: `${BOOTH_CREW.coworker}: "Coffee's up."`,
  orderExpired: "A car gave up and drove off.",
  wrongEntry: "That is not on the ticket.",
  notReady: "That order is not done yet.",
  bumpedLate: "Bumped. Late.",
  bumped: "Bumped. Next car.",
  wiped: "You wipe the counter. It was already clean.",
} as const;

/** The closing note, the same for every ending. */
export const CLOSING_NOTE: readonly string[] = [
  `On the way out, ${BOOTH_CREW.generalManager}, the general manager, asked how I was doing and waited for the answer. ${BOOTH_CREW.generalManager} was kind to me without having to be.`,
  "I don't remember this job fondly. People talked into the speaker as if no one was on the other end. But it taught me a lot about how people treat each other, and I think it helped make me who I am.",
];

/** The blog post with the notes behind the shift. */
export const COMPANION_POST_PATH = "/blog/notes-from-my-first-job";

function pick(lines: readonly string[], seed: string, index: number): string {
  const safeIndex =
    Number.isInteger(index) && index >= 0 ? index : Math.abs(index | 0);
  return lines[drawInt(`${seed}:lines`, safeIndex, lines.length)];
}

/** The headset line for an order; the same seed and order always match. */
export function getHeadsetLine(seed: string, orderId: number): string {
  return pick(HEADSET_LINES, `${seed}:headset`, orderId);
}

/** What the manager says on the given yell of the shift. */
export function getManagerLine(seed: string, yellNumber: number): string {
  return pick(MANAGER_LINES, `${seed}:manager`, yellNumber);
}

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/**
 * How the shift ended, as a heading and one paragraph. A shift that is still
 * playing reads as if it closed now.
 */
export function getShiftEnding(state: ShiftState): {
  readonly outcome: Exclude<ShiftOutcome, "playing">;
  readonly title: string;
  readonly summary: string;
} {
  const { served, late, expired } = state.tallies;
  if (state.outcome === "docked") {
    return {
      outcome: "docked",
      title: "Pulled off the window",
      summary: `${BOOTH_CREW.manager} pulled you off the window. Corporate watches the drive-thru times, so ${BOOTH_CREW.manager} watches you.`,
    };
  }
  if (state.outcome === "breakdown") {
    return {
      outcome: "breakdown",
      title: "The walk-in cooler",
      summary:
        "You went and stood in the walk-in cooler for a while. Everyone does eventually. Nobody talks about it.",
    };
  }
  return {
    outcome: "completed",
    title: "Made it to close",
    summary: `Shift over. ${count(served, "car", "cars")} served, ${late} of them late, ${expired} gave up and drove off.`,
  };
}
