// @vitest-environment node
/**
 * Act I balance under the seeded shuffle (#2055). A greedy bot (the balance
 * bot's MEDIAN style: it plays the best hand the preview shows, inspecting
 * and correcting the cards in it) plays Act I on many seeds through the
 * public run reducer, and each Blind must be clearable at a fair rate. The
 * full four-style harness is trial-and-error-balance.test.ts; this one is
 * quick enough to run on every change to a deck or quota.
 */
import { beforeAll, describe, it, expect } from "vitest";
import {
  ACT_I,
  advanceRun,
  createRunState,
  deriveRunView,
  type RunState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

const SEEDS = Array.from({ length: 40 }, (_, i) => `act-i-${i}`);

/** The least share of the seeds reaching a Blind on which it must clear. */
const MIN_CLEAR_RATE: Record<string, number> = {
  "demographics-small-blind": 0.95,
  "sponsor-safety-big-blind": 0.75,
  "dose-escalation-boss-blind": 0.6,
};

interface Outcome {
  blindId: string;
  seed: string;
  quota: number;
  score: number;
  cleared: boolean;
}

/** Plays Act I greedily on one seed, until a Blind is lost or the act won. */
function playAct(seed: string): Outcome[] {
  const outcomes: Outcome[] = [];
  let run: RunState = createRunState(ACT_I, seed);
  for (;;) {
    const view = deriveRunView(ACT_I, run);
    for (const action of playBlind(view.blind, run.table, "MEDIAN").actions) {
      if (run.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      run = advanceRun(ACT_I, run, action);
    }
    const cleared = run.table.status === "CLEARED";
    outcomes.push({
      blindId: view.blind.id,
      seed,
      quota: view.blind.blind.quota,
      score: run.table.roundScore,
      cleared,
    });
    if (!cleared || !view.nextBlind) return outcomes;
    run = advanceRun(ACT_I, run, { type: "NEXT_BLIND" });
  }
}

let OUTCOMES: Outcome[] = [];

describe("Act I balance under the seeded shuffle (#2055)", () => {
  beforeAll(() => {
    OUTCOMES = SEEDS.flatMap(playAct);
  }, 60_000);

  it("ramps the quotas Small, Big, Boss without a spike", () => {
    const quotas = ["demographics-small-blind", "sponsor-safety-big-blind"]
      .map((id) => OUTCOMES.find((o) => o.blindId === id)!.quota)
      .concat(
        OUTCOMES.find((o) => o.blindId === "dose-escalation-boss-blind")!.quota
      );
    expect(quotas).toEqual([...quotas].sort((a, b) => a - b));
    // No step more than triples the last.
    expect(quotas[1] / quotas[0]).toBeLessThanOrEqual(3);
    expect(quotas[2] / quotas[1]).toBeLessThanOrEqual(3);
  });

  it.each(Object.entries(MIN_CLEAR_RATE))(
    "clears %s at a fair rate",
    (blindId, minRate) => {
      const reached = OUTCOMES.filter((o) => o.blindId === blindId);
      // Enough seeds reach it for the rate to mean something.
      expect(reached.length).toBeGreaterThanOrEqual(SEEDS.length / 2);
      const rate = reached.filter((o) => o.cleared).length / reached.length;
      expect(rate, `${blindId} clears ${rate}`).toBeGreaterThanOrEqual(minRate);
    }
  );

  it("still loses some runs: the shuffle makes deals that greedy play fails", () => {
    const won = SEEDS.filter((seed) =>
      OUTCOMES.some(
        (o) =>
          o.seed === seed &&
          o.blindId === "dose-escalation-boss-blind" &&
          o.cleared
      )
    );
    expect(won.length).toBeGreaterThan(SEEDS.length / 2);
    expect(won.length).toBeLessThan(SEEDS.length);
  });

  it("deals differently across seeds", () => {
    const opening = new Set(
      SEEDS.map((seed) => createRunState(ACT_I, seed).table.hand.join(","))
    );
    expect(opening.size).toBeGreaterThan(1);
  });
});
