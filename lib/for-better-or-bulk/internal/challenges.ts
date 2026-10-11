/**
 * The game challenges for For Better or Bulk. Each one reads a fact the
 * engine already keeps (burnt batches, the finish time, the brothers' call)
 * and is about game play only. None of them judges the real wedding, and the
 * stars they add up to are a game score, not a grade.
 */

import type { ChallengeId, ChallengeResult, GameState } from "../types";
import { clockLabel } from "./views";

/** The line every receipt prints above the challenges. */
export const CHALLENGE_COPY = "Game challenges. Not a grade on the wedding.";

/** The challenges in display order. */
export const CHALLENGE_IDS: readonly ChallengeId[] = [
  "no-burnt",
  "set-by-three",
  "fred-stayed",
];

const CHALLENGE_LABELS: Readonly<Record<ChallengeId, string>> = {
  "no-burnt": "No burnt batches",
  "set-by-three": "Everything set by 3:00",
  "fred-stayed": "Fred stayed",
};

/**
 * The level time of 3:00. The level runs 7 hours from 9:00 to 4:00, so 3:00
 * is six sevenths of the way through.
 */
function threeOClock(duration: number): number {
  return (duration * 6) / 7;
}

/** Whether Fred went out with his brothers, by the decision he made. */
function fredLeft(state: GameState): boolean {
  const presence = state.presence;
  return Boolean(presence && presence.choice !== "stay");
}

/** What Fred did when the brothers texted, in plain words. */
function fredDetail(state: GameState): string {
  const presence = state.presence;
  if (!presence) return "The brothers never called him away.";
  if (presence.choice === "stay") return "Fred stayed for the setup.";
  if (presence.choice === "break") {
    return "Fred took a break, so he did not stay on the lawn.";
  }
  return "Fred went out with his brothers.";
}

/**
 * The three challenges for a run, each met or not with the evidence. The
 * result is derived from the level state alone, so a replay reproduces it.
 */
export function evaluateChallenges(
  state: GameState
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
      id: "fred-stayed",
      label: CHALLENGE_LABELS["fred-stayed"],
      met: !fredLeft(state),
      detail: fredDetail(state),
    },
  ];
}

/** The number of stars: one for each challenge the run met. */
export function countStars(challenges: readonly ChallengeResult[]): number {
  return challenges.filter((challenge) => challenge.met).length;
}
