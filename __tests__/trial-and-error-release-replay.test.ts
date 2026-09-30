import { describe, it, expect, beforeAll } from "vitest";
import {
  BIOSTAT_OPS_CAMPAIGN,
  advanceRun,
  createRunState,
  deriveRunView,
  parseRunSave,
  replayRun,
  serializeRun,
  type LoggedAction,
  type RunState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

/**
 * #925 release hardening: "a full seeded run replays identically end to
 * end". The campaign test in trial-and-error-campaign.test.ts replays a
 * whole campaign that skips the shop; this one records every move of a
 * campaign that also spends in the shop between Blinds (cash-out, buys, a
 * pack, a reroll), so the shop's own seeded stream is part of the replay.
 */
const C = BIOSTAT_OPS_CAMPAIGN;
const SEED = "alpha";

interface Recorded {
  run: RunState;
  actions: LoggedAction[];
  /** The Blinds reached, in order. */
  path: string[];
  /** Shop moves the reducer accepted: they changed the shop or the tray. */
  shopMoves: number;
}

/** Plays the campaign with the balance bot, shopping between every Blind. */
function playWithShop(seed: string): Recorded {
  let run = createRunState(C, seed);
  const actions: LoggedAction[] = [];
  const path: string[] = [];
  let shopMoves = 0;
  const act = (action: LoggedAction) => {
    actions.push(action);
    run = advanceRun(C, run, action);
  };
  const shopAct = (action: LoggedAction) => {
    const before = run.shop;
    act(action);
    if (run.shop !== before) shopMoves += 1;
  };
  for (;;) {
    const view = deriveRunView(C, run);
    path.push(view.blind.id);
    for (const action of playBlind(view.blind, run.table, "PERFECT").actions) {
      if (run.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      act(action);
    }
    const after = deriveRunView(C, run);
    if (after.phase !== "BLIND_CLEARED") break;
    const reward = after.table.reward;
    if (reward && reward.claimed === null) {
      act({ type: "CLAIM_RELIC", relicId: reward.choices[0].id });
    }
    act({ type: "CASH_OUT" });
    if (run.shop) {
      shopAct({ type: "BUY_PACK", slot: 0 });
      const opened = run.shop?.opened;
      if (opened && opened.cards.length > 0) {
        shopAct({ type: "PICK_PACK_CARD", cardId: opened.cards[0].id });
      }
      if (run.shop?.opened) shopAct({ type: "SKIP_PACK" });
      shopAct({ type: "BUY", slot: 0 });
      shopAct({ type: "REROLL" });
      shopAct({ type: "BUY", slot: 1 });
    }
    act({ type: "NEXT_BLIND" });
    if (deriveRunView(C, run).phase === "RUN_WON") break;
  }
  return { run, actions, path, shopMoves };
}

describe("a full seeded campaign with the shop replays identically (#925)", () => {
  let first: Recorded;

  beforeAll(() => {
    first = playWithShop(SEED);
  }, 300_000);

  it("plays through the shop and every later Blind to a won run", () => {
    // Every Blind of the three studies, ending on CSR Lock.
    expect(first.path).toHaveLength(9);
    expect(deriveRunView(C, first.run).phase).toBe("RUN_WON");
    expect(first.shopMoves).toBeGreaterThan(0);
    expect(first.actions.filter((a) => a.type === "CASH_OUT").length).toBe(
      first.path.length - 1
    );
  });

  it("makes the same moves and ends in the same state when played again", () => {
    const again = playWithShop(SEED);
    expect(again.actions).toEqual(first.actions);
    expect(again.path).toEqual(first.path);
    expect(again.run).toEqual(first.run);
  }, 300_000);

  it("replays from its seed and move log to the identical run", () => {
    const log = { actId: C.id, seed: SEED, actions: first.actions };
    expect(replayRun(C, log)).toEqual(first.run);
  });

  it("resumes identically from a save cut at every Blind boundary", () => {
    const cuts = first.actions
      .map((a, i) => (a.type === "NEXT_BLIND" ? i + 1 : -1))
      .filter((i) => i > 0);
    expect(cuts.length).toBeGreaterThan(0);
    for (const cut of cuts) {
      const partial = {
        actId: C.id,
        seed: SEED,
        actions: first.actions.slice(0, cut),
      };
      const restored = parseRunSave(serializeRun(partial, new Date(0)), [C]);
      if (restored === null) {
        // Only an ended run has nothing to resume.
        expect(deriveRunView(C, replayRun(C, partial)).phase).toMatch(
          /^RUN_(WON|FAILED)$/
        );
        continue;
      }
      const resumed = first.actions
        .slice(cut)
        .reduce((run, a) => advanceRun(C, run, a), restored.run);
      expect(resumed).toEqual(first.run);
    }
  });
});
