// @vitest-environment node
/**
 * Campaign balance with synergy relics and a shop per act (#2083), in the
 * style of the Act I balance test (#2055). A greedy bot plays every Blind
 * with the balance bot's MEDIAN style, and between Blinds it shops greedily:
 * it buys the dearest relic it can afford while the rack has room, so it
 * leans on the rarer, stronger stock of the later acts' shops. Each Blind it
 * reaches must still clear at a fair rate, and the relics it buys must fire.
 *
 * To see the rates, run with TE_BALANCE_REPORT=1.
 */
import { beforeAll, describe, it, expect } from "vitest";
import {
  BIOSTAT_OPS_CAMPAIGN,
  CLASSIC_SHOP,
  advanceRun,
  createRunState,
  deriveRunView,
  shopEntryId,
  type LoggedAction,
  type RunState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

const C = BIOSTAT_OPS_CAMPAIGN;
const SEEDS = Array.from({ length: 24 }, (_, i) => `relics-${i}`);

/** The least share of the seeds reaching a Blind on which it must clear. */
const MIN_CLEAR_RATE: Record<string, number> = {
  "demographics-small-blind": 0.9,
  "sponsor-safety-big-blind": 0.7,
  "dose-escalation-boss-blind": 0.5,
  "phase-two-internal-qc-small-blind": 0.6,
  "dmc-open-session-big-blind": 0.6,
  "blinded-data-review-small-blind": 0.6,
  "sponsor-topline-big-blind": 0.6,
  "dmc-milestone-boss-blind": 0.5,
  "fda-information-request-boss-blind": 0.5,
  "csr-lock-boss-blind": 0.5,
};

const CLASSIC_RELICS = new Set(
  CLASSIC_SHOP.entries.filter((e) => e.kind === "RELIC").map(shopEntryId)
);

interface Outcome {
  blindId: string;
  seed: string;
  cleared: boolean;
}

interface Played {
  outcomes: Outcome[];
  bought: string[];
  /** Ledger lines a bought synergy relic added to a played hand. */
  synergyFired: number;
}

/** Buys the dearest affordable relic while the rack has room, then leaves. */
function shop(
  current: () => RunState,
  act: (a: LoggedAction) => void,
  bought: string[]
) {
  for (;;) {
    const run = current();
    const view = deriveRunView(C, run).shop;
    if (!view) return;
    const best = run
      .shop!.slots.map((slot, i) => ({ slot, i, item: view.items[i] }))
      .filter(
        ({ slot, item }) =>
          slot.entry.kind === "RELIC" && !slot.sold && item.refusal === null
      )
      .sort((a, b) => b.slot.entry.price - a.slot.entry.price)[0];
    if (!best) return;
    const before = run.shop;
    act({ type: "BUY", slot: best.i });
    if (current().shop === before) return;
    bought.push(shopEntryId(best.slot.entry));
  }
}

/** Plays the campaign greedily on one seed, until a Blind is lost or it is won. */
function playCampaign(seed: string): Played {
  let run: RunState = createRunState(C, seed);
  const outcomes: Outcome[] = [];
  const bought: string[] = [];
  let synergyFired = 0;
  const act = (action: LoggedAction) => {
    run = advanceRun(C, run, action);
  };
  for (;;) {
    const view = deriveRunView(C, run);
    for (const action of playBlind(view.blind, run.table, "MEDIAN").actions) {
      if (run.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      const before = run.table.plays.length;
      act(action);
      if (run.table.plays.length > before) {
        synergyFired += run.table.lastPlay!.evaluation.ledger.filter(
          (l) =>
            l.sourceId.startsWith("REL-") &&
            !CLASSIC_RELICS.has(l.sourceId.split("@")[0])
        ).length;
      }
    }
    const cleared = run.table.status === "CLEARED";
    outcomes.push({ blindId: view.blind.id, seed, cleared });
    if (!cleared || !view.nextBlind) break;
    const reward = deriveRunView(C, run).table.reward;
    if (reward && reward.claimed === null) {
      act({ type: "CLAIM_RELIC", relicId: reward.choices[0].id });
    }
    act({ type: "CASH_OUT" });
    shop(() => run, act, bought);
    act({ type: "NEXT_BLIND" });
  }
  return { outcomes, bought, synergyFired };
}

let PLAYED: Played[] = [];
const outcomes = () => PLAYED.flatMap((p) => p.outcomes);

describe("campaign balance with synergy relics (#2083)", () => {
  beforeAll(() => {
    PLAYED = SEEDS.map(playCampaign);
    if (process.env.TE_BALANCE_REPORT) {
      const ids = [...new Set(outcomes().map((o) => o.blindId))];
      for (const id of ids) {
        const reached = outcomes().filter((o) => o.blindId === id);
        const clears = reached.filter((o) => o.cleared).length;
        console.log(`${id}: ${clears}/${reached.length}`);
      }
    }
  }, 300_000);

  it.each(Object.entries(MIN_CLEAR_RATE))(
    "clears %s at a fair rate",
    (blindId, minRate) => {
      const reached = outcomes().filter((o) => o.blindId === blindId);
      expect(reached.length).toBeGreaterThanOrEqual(SEEDS.length / 4);
      const rate = reached.filter((o) => o.cleared).length / reached.length;
      expect(rate, `${blindId} clears ${rate}`).toBeGreaterThanOrEqual(minRate);
    }
  );

  it("buys synergy relics, and they fire in played hands", () => {
    const bought = PLAYED.flatMap((p) => p.bought);
    expect(bought.some((id) => !CLASSIC_RELICS.has(id))).toBe(true);
    expect(PLAYED.reduce((n, p) => n + p.synergyFired, 0)).toBeGreaterThan(0);
  });

  it("still loses some runs: relics help, but do not win every campaign", () => {
    const won = PLAYED.filter((p) =>
      p.outcomes.some((o) => o.blindId === "csr-lock-boss-blind" && o.cleared)
    ).length;
    expect(won).toBeGreaterThan(SEEDS.length / 2);
    expect(won).toBeLessThan(SEEDS.length);
  });

  it("is deterministic from seed", () => {
    expect(playCampaign(SEEDS[0])).toEqual(PLAYED[0]);
  });
});
