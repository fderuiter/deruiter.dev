/**
 * The game challenges for For Better or Bulk. Each one reads a fact the
 * engine already keeps (burnt batches, the finish time, the brothers' call)
 * and is about game play only. None of them judges the real wedding, and the
 * stars they add up to are a game score, not a grade.
 */

import { COMMITMENT_CATEGORIES } from "../presets";
import type {
  ChallengeId,
  ChallengeResult,
  GameState,
  ReadinessLine,
} from "../types";
import { clockLabel } from "./views";

/** The line every receipt prints above the challenges. */
export const CHALLENGE_COPY = "Game challenges. Not a grade on the wedding.";

/** The challenges in display order. */
export const CHALLENGE_IDS: readonly ChallengeId[] = [
  "no-burnt",
  "set-by-three",
  "every-promise-kept",
];

const CHALLENGE_LABELS: Readonly<Record<ChallengeId, string>> = {
  "no-burnt": "No burnt batches",
  "set-by-three": "Everything set by 3:00",
  "every-promise-kept": "Every promise kept",
};

/**
 * The level time of 3:00. The level runs 7 hours from 9:00 to 4:00, so 3:00
 * is six sevenths of the way through.
 */
function threeOClock(duration: number): number {
  return (duration * 6) / 7;
}

/**
 * Whether the run kept its promise. Staying keeps it. A break keeps it when
 * the category promised for the return was finished by the end. Leaving does
 * not. A run where the brothers never called has nothing to break, so it is kept.
 */
function promiseKept(
  state: GameState,
  readiness: readonly ReadinessLine[]
): boolean {
  const presence = state.presence;
  if (!presence || presence.choice === "stay") return true;
  if (presence.choice === "leave") return false;
  const covered = COMMITMENT_CATEGORIES[presence.commitment ?? "chairs"];
  return readiness
    .filter((line) => covered.includes(line.category))
    .every((line) => line.status !== "unfinished");
}

/** What Fred did when the brothers texted, and whether the promise held, in plain words. */
function promiseDetail(
  state: GameState,
  readiness: readonly ReadinessLine[]
): string {
  const presence = state.presence;
  if (!presence) return "The brothers never called him away.";
  if (presence.choice === "stay")
    return "Fred stayed, so there was no promise to break.";
  if (presence.choice === "leave") {
    return "Fred went out with his brothers instead of staying for the setup.";
  }
  const promise = presence.commitment ?? "chairs";
  const outcome = promiseKept(state, readiness)
    ? "That work was done by 4:00."
    : "That work was not done by 4:00.";
  return `Fred took a break and promised to come back for the ${promise}. ${outcome}`;
}

/**
 * The three challenges for a run, each met or not with the evidence. The
 * result is derived from the level state and its readiness lines alone, so a
 * replay reproduces it.
 */
export function evaluateChallenges(
  state: GameState,
  readiness: readonly ReadinessLine[]
): readonly ChallengeResult[] {
  const burnt = state.burntBatches;
  const finished = state.finishedAt;
  const setBy = threeOClock(state.duration);
  return [
    {
      id: "no-burnt",
      label: CHALLENGE_LABELS["no-burnt"],
      met: burnt === 0,
      detail:
        burnt === 0
          ? "Not one batch went up in smoke."
          : `${burnt} ${burnt === 1 ? "batch" : "batches"} burnt on the grill.`,
    },
    {
      id: "set-by-three",
      label: CHALLENGE_LABELS["set-by-three"],
      met: finished !== null && finished <= setBy,
      detail:
        finished === null
          ? "Something was still open at 4:00."
          : `Everything was ready at ${clockLabel(finished, state.duration)}.`,
    },
    {
      id: "every-promise-kept",
      label: CHALLENGE_LABELS["every-promise-kept"],
      met: promiseKept(state, readiness),
      detail: promiseDetail(state, readiness),
    },
  ];
}

/** The number of stars: one for each challenge the run met. */
export function countStars(challenges: readonly ChallengeResult[]): number {
  return challenges.filter((challenge) => challenge.met).length;
}
