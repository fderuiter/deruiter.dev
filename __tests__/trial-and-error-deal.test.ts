// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  ACT_I,
  ACT_II,
  ACT_III,
  BIOSTAT_OPS_CAMPAIGN,
  CSR_LOCK_SCENARIO,
  DEFAULT_SEED,
  DEMOGRAPHICS_SCENARIO,
  DMC_MILESTONE_SCENARIO,
  FDA_IR_SCENARIO,
  GUIDED_BLIND_SCENARIO,
  RUN_SAVE_VERSION,
  RunSaveSchema,
  SPONSOR_SAFETY_SCENARIO,
  ScenarioSchema,
  advanceRun,
  advanceTable,
  createRunState,
  createTableState,
  dealSeed,
  parseRunSave,
  replayRun,
  serializeRun,
  shuffledDeckOrder,
  type Act,
  type RunAction,
  type RunPlan,
  type Scenario,
} from "@/lib/trial-and-error";

/**
 * Seeded deal order (#2055): each Blind of a run deals its deck in an order
 * shuffled from the run seed on a stream of its own, its scripted setup
 * pinned to the top, and saves recorded before the shuffle replay in
 * written order.
 */

const SEEDS = Array.from({ length: 24 }, (_, i) => `deal-${i}`);
const SAVED_AT = new Date("2026-10-14T00:00:00Z");
/** A one-Blind plan around a scenario with nothing pinned. */
const BIG_ONLY: Act = {
  ...ACT_I,
  blinds: [SPONSOR_SAFETY_SCENARIO],
  bossPool: undefined,
  crisisDeck: undefined,
};
const ids = (scenario: Scenario, order: readonly number[]) =>
  order.map((i) => scenario.deck[i].id);

describe("shuffledDeckOrder", () => {
  it("is a permutation of the deck, reproduced exactly by the same seed", () => {
    const deck = SPONSOR_SAFETY_SCENARIO.deck;
    for (const seed of SEEDS) {
      const order = shuffledDeckOrder(SPONSOR_SAFETY_SCENARIO, seed);
      expect([...order].sort((a, b) => a - b)).toEqual(deck.map((_, i) => i));
      expect(shuffledDeckOrder(SPONSOR_SAFETY_SCENARIO, seed)).toEqual(order);
    }
  });

  it("deals different orders for different seeds", () => {
    const orders = new Set(
      SEEDS.map((seed) =>
        shuffledDeckOrder(SPONSOR_SAFETY_SCENARIO, seed).join(",")
      )
    );
    expect(orders.size).toBe(SEEDS.length);
    // Not merely rotated: the written order is not what a seed deals.
    expect(
      orders.has(SPONSOR_SAFETY_SCENARIO.deck.map((_, i) => i).join(","))
    ).toBe(false);
  });

  it("deals the pinned setup first, in deck order, and shuffles the rest", () => {
    const pinned = DEMOGRAPHICS_SCENARIO.pinned!;
    const tails = new Set<string>();
    for (const seed of SEEDS) {
      const order = ids(
        DEMOGRAPHICS_SCENARIO,
        shuffledDeckOrder(DEMOGRAPHICS_SCENARIO, seed)
      );
      expect(order.slice(0, pinned.length)).toEqual(pinned);
      tails.add(order.slice(pinned.length).join(","));
    }
    expect(tails.size).toBeGreaterThan(1);
  });

  it("keeps a wholly pinned deck, and a one-card deck, in written order", () => {
    expect(shuffledDeckOrder(GUIDED_BLIND_SCENARIO, "any")).toEqual(
      GUIDED_BLIND_SCENARIO.deck.map((_, i) => i)
    );
    expect(shuffledDeckOrder(DMC_MILESTONE_SCENARIO, "any")).toEqual(
      DMC_MILESTONE_SCENARIO.deck.map((_, i) => i)
    );
    const single = {
      ...SPONSOR_SAFETY_SCENARIO,
      deck: [SPONSOR_SAFETY_SCENARIO.deck[0]],
    };
    expect(shuffledDeckOrder(single, "any")).toEqual([0]);
  });

  it("gives each Blind of a run its own stream", () => {
    expect(dealSeed("e2e-4", 1, 2)).toBe("e2e-4/deal/1/2");
    const a = shuffledDeckOrder(SPONSOR_SAFETY_SCENARIO, dealSeed("s", 0, 0));
    const b = shuffledDeckOrder(SPONSOR_SAFETY_SCENARIO, dealSeed("s", 0, 1));
    expect(a).not.toEqual(b);
  });
});

describe("pinned setups stay playable on every seed", () => {
  const scenarios = [
    ...ACT_I.blinds,
    ...(ACT_I.bossPool ?? []),
    ...ACT_II.blinds,
    ...(ACT_II.bossPool ?? []),
    ...ACT_III.blinds,
    ...(ACT_III.bossPool ?? []),
    GUIDED_BLIND_SCENARIO,
  ];

  it("pins the scripted Blinds", () => {
    for (const scenario of [
      GUIDED_BLIND_SCENARIO,
      CSR_LOCK_SCENARIO,
      DMC_MILESTONE_SCENARIO,
      FDA_IR_SCENARIO,
    ]) {
      expect(scenario.pinned?.length, scenario.id).toBeGreaterThan(0);
    }
  });

  it("deals every pinned card into the opening hand", () => {
    for (const scenario of scenarios.filter((s) => s.pinned)) {
      const pinned = scenario.pinned!;
      const fits = pinned.slice(0, scenario.table.handSize);
      for (const seed of SEEDS) {
        const state = createTableState(
          scenario,
          undefined,
          undefined,
          null,
          null,
          shuffledDeckOrder(scenario, seed)
        );
        expect(state.hand.slice(0, fits.length), scenario.id).toEqual(fits);
      }
    }
  });

  it("refuses a pinned card the deck does not hold", () => {
    const parsed = ScenarioSchema.safeParse({
      ...SPONSOR_SAFETY_SCENARIO,
      pinned: ["C-NOT-IN-DECK"],
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.map((i) => i.path.join("."))).toEqual([
      "pinned.0",
    ]);
  });
});

describe("a run deals each Blind from its seed", () => {
  it("deals the first Blind on its deal stream, the same way every time", () => {
    const run = createRunState(BIG_ONLY, "alpha");
    const order = shuffledDeckOrder(
      SPONSOR_SAFETY_SCENARIO,
      dealSeed("alpha", 0, 0)
    );
    expect(run.table.deckOrder).toEqual(order);
    expect(run.table.hand).toEqual(
      ids(SPONSOR_SAFETY_SCENARIO, order).slice(0, 8)
    );
    expect(run.dealing).toBeUndefined();
    expect(createRunState(BIG_ONLY, "alpha")).toEqual(run);
    expect(createRunState(BIG_ONLY, "bravo").table.hand).not.toEqual(
      run.table.hand
    );
  });

  it("never moves the Boss, crisis or deviation draws", () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const shuffled = createRunState(BIOSTAT_OPS_CAMPAIGN, seed);
      const authored = createRunState(
        BIOSTAT_OPS_CAMPAIGN,
        seed,
        {},
        "AUTHORED"
      );
      expect(shuffled.draws).toEqual(authored.draws);
      expect(shuffled.drawIndex).toBe(authored.drawIndex);
      expect(shuffled.bossIds).toEqual(authored.bossIds);
    }
  });

  it("deals in written order for a run that asks for it", () => {
    const run = createRunState(BIG_ONLY, "alpha", {}, "AUTHORED");
    expect(run.dealing).toBe("AUTHORED");
    expect(run.table.deckOrder).toBeUndefined();
    expect(run.table.hand).toEqual(
      SPONSOR_SAFETY_SCENARIO.deck.slice(0, 8).map((c) => c.id)
    );
  });

  it("deals the next Blind on its own stream", () => {
    const easy = <T extends Scenario>(b: T): T => ({
      ...b,
      blind: { ...b.blind, quota: 1 },
    });
    const quick: RunPlan = {
      ...ACT_I,
      crisisDeck: undefined,
      blinds: ACT_I.blinds.map(easy),
      bossPool: (ACT_I.bossPool ?? []).map(easy),
    };
    let run = createRunState(quick, "beta");
    run = [
      { type: "TOGGLE_SELECT", cardId: "C-T14.1.1-C" },
      { type: "PLAY_HAND" },
      { type: "NEXT_BLIND" },
    ].reduce((r, a) => advanceRun(quick, r, a as RunAction), run);
    expect(run.blindIndex).toBe(1);
    const big = easy(SPONSOR_SAFETY_SCENARIO);
    expect(run.table.deckOrder).toEqual(
      shuffledDeckOrder(big, dealSeed("beta", 0, 1))
    );
  });

  it("keeps the Blind's deal on a RESET, and restarts a written-order run shuffled", () => {
    const run = createRunState(BIG_ONLY, "alpha");
    const played = advanceTable(SPONSOR_SAFETY_SCENARIO, run.table, {
      type: "TOGGLE_SELECT",
      cardId: run.table.hand[0],
    });
    const reset = advanceTable(SPONSOR_SAFETY_SCENARIO, played, {
      type: "RESET",
    });
    expect(reset.deckOrder).toEqual(run.table.deckOrder);
    expect(reset.hand).toEqual(run.table.hand);

    const old = createRunState(BIG_ONLY, "alpha", {}, "AUTHORED");
    const restarted = advanceRun(BIG_ONLY, old, { type: "RESTART_RUN" });
    expect(restarted.dealing).toBeUndefined();
    expect(restarted.table.hand).toEqual(run.table.hand);
  });
});

describe("saves and the deal (#2055)", () => {
  it("writes the current version, and records a written-order run's dealing", () => {
    // v3 (#2082) added the run deck on top of v2's shuffle.
    expect(RUN_SAVE_VERSION).toBe(3);
    const json = serializeRun(
      { actId: BIG_ONLY.id, seed: "alpha", dealing: "AUTHORED", actions: [] },
      SAVED_AT
    );
    expect(RunSaveSchema.parse(JSON.parse(json))).toMatchObject({
      version: 3,
      dealing: "AUTHORED",
    });
    const shuffled = serializeRun(
      { actId: BIG_ONLY.id, seed: "alpha", actions: [] },
      SAVED_AT
    );
    expect(JSON.parse(shuffled).dealing).toBeUndefined();
  });

  it("replays a v1 save in the written order its moves were made in", () => {
    // The first Blind's opening hand as v1 dealt it, played from the front.
    const actions = [
      { type: "TOGGLE_SELECT", cardId: SPONSOR_SAFETY_SCENARIO.deck[5].id },
      { type: "PLAY_HAND" },
    ] as const;
    const v1 = JSON.stringify({
      version: 1,
      actId: BIG_ONLY.id,
      savedAt: SAVED_AT.toISOString(),
      seed: "alpha",
      actions,
    });
    const restored = parseRunSave(v1, [BIG_ONLY]);
    expect(restored?.log.dealing).toBe("AUTHORED");
    expect(restored?.run.dealing).toBe("AUTHORED");
    expect(restored?.run.table.handsPlayed).toBe(1);
    // It migrates on through v3 (#2082), keeping its authored decks too.
    expect(restored?.log.decks).toBe("AUTHORED");
    expect(restored?.run).toEqual(
      replayRun(BIG_ONLY, {
        actId: BIG_ONLY.id,
        seed: "alpha",
        dealing: "AUTHORED",
        decks: "AUTHORED",
        actions: [...actions],
      })
    );
    // Saved again, it keeps dealing in written order.
    const again = parseRunSave(serializeRun(restored!.log, SAVED_AT), [
      BIG_ONLY,
    ]);
    expect(again?.run).toEqual(restored?.run);
  });

  it("replays a current save shuffled, from its seed", () => {
    const log = { actId: BIG_ONLY.id, seed: DEFAULT_SEED, actions: [] };
    const restored = parseRunSave(serializeRun(log, SAVED_AT), [BIG_ONLY]);
    expect(restored?.run).toEqual(createRunState(BIG_ONLY, DEFAULT_SEED));
    expect(restored?.log.dealing).toBeUndefined();
  });
});

describe("the seeded-RNG boundary (ADR 0046)", () => {
  it("draws nothing from Math.random in lib/trial-and-error", () => {
    const root = path.resolve(process.cwd(), "lib/trial-and-error");
    const files = readdirSync(root, { recursive: true, encoding: "utf8" })
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join(root, f));
    expect(files.length).toBeGreaterThan(10);
    for (const file of files) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/Math\.random/);
    }
  });
});
