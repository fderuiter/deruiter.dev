import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  consumableName,
  ACT_I,
  ACT_I_CRISES,
  ActSchema,
  BossBlindModifierSchema,
  CPU_COSTS,
  CrisisCardSchema,
  DEFAULT_SEED,
  DEMOGRAPHICS_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  FIREWALL_ALERT,
  FIREWALL_CELL,
  SPONSOR_SAFETY_SCENARIO,
  advanceRun,
  advanceTable,
  cpuReducer,
  createRunState,
  createTableState,
  deriveRunView,
  deriveTableView,
  drawInt,
  isFreeCrisisChoice,
  runBlinds,
  uniformAt,
  type Act,
  type BossBlindModifier,
  type CrisisCard,
  type FootnoteSeal,
  type RunAction,
  type RunState,
  type Scenario,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

const SMALL = DEMOGRAPHICS_SCENARIO;
const BIG = SPONSOR_SAFETY_SCENARIO;
const BOSS = DOSE_ESCALATION_SCENARIO;

const crisisById = (id: string) =>
  ACT_I_CRISES.find((c) => c.id === id) as CrisisCard;
const AUDIT = crisisById("CR-SITE-AUDIT");
const AMENDMENT = crisisById("CR-AMENDMENT-2");
const MIGRATION = crisisById("CR-DB-MIGRATION");
const EMERGENCY = crisisById("CR-EMERGENCY-REVIEW");

const easy = <T extends Scenario>(b: T): T => ({
  ...b,
  blind: { ...b.blind, quota: 1 },
});
/** Act I with every target at 1, so any played hand clears a Blind. */
const QUICK: Act = {
  ...ACT_I,
  blinds: ACT_I.blinds.map(easy),
  bossPool: (ACT_I.bossPool ?? []).map(easy),
};

const step = (act: Act, run: RunState, ...actions: RunAction[]) =>
  actions.reduce((r, a) => advanceRun(act, r, a), run);
/**
 * Plays the first single card that clears a quick Blind (some tables score
 * zero until inspected), then moves on. The reducers are pure, so trying
 * each card from the same state spends nothing.
 */
const clearAndNext = (act: Act, run: RunState) => {
  const cleared = run.table.hand
    .map((cardId) =>
      step(act, run, { type: "TOGGLE_SELECT", cardId }, { type: "PLAY_HAND" })
    )
    .find((r) => r.table.status === "CLEARED");
  return step(act, cleared ?? run, { type: "NEXT_BLIND" });
};
const table = (
  scenario: Scenario,
  crisis: CrisisCard | null,
  ...actions: TableAction[]
): TableState =>
  actions.reduce(
    (s, a) => advanceTable(scenario, s, a),
    createTableState(scenario, undefined, undefined, crisis)
  );
const resolve = (choiceId: string) => ({
  type: "RESOLVE_CRISIS" as const,
  choiceId,
});

const modifier = (
  over: Partial<BossBlindModifier> & Pick<BossBlindModifier, "debuffType">
): BossBlindModifier => ({
  id: `MOD-${over.debuffType}`,
  name: over.debuffType,
  description: "Test modifier.",
  ...over,
});
const crisisWith = (effect: CrisisCard["choices"][number]["effect"]) =>
  ({
    id: "CR-TEST",
    name: "Test Crisis",
    description: "A crisis for tests.",
    choices: [
      { id: "take", label: "Take it", consequence: "Effect.", effect },
      { id: "free", label: "Walk away", consequence: "Nothing.", effect: {} },
    ],
  }) satisfies CrisisCard;

describe("the seeded draw", () => {
  it("is a pure function of seed and draw index", () => {
    expect(uniformAt("a", 3)).toBe(uniformAt("a", 3));
    expect(drawInt("a", 3, 10)).toBe(drawInt("a", 3, 10));
    expect(uniformAt("a", 3)).not.toBe(uniformAt("a", 4));
    expect(uniformAt("a", 3)).not.toBe(uniformAt("b", 3));
  });

  it("stays in range for any seed, index and bound", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 40 }),
        fc.nat({ max: 10_000 }),
        fc.integer({ min: 1, max: 1000 }),
        (seed, index, bound) => {
          const u = uniformAt(seed, index);
          expect(u).toBeGreaterThanOrEqual(0);
          expect(u).toBeLessThan(1);
          const n = drawInt(seed, index, bound);
          expect(Number.isInteger(n)).toBe(true);
          expect(n).toBeGreaterThanOrEqual(0);
          expect(n).toBeLessThan(bound);
        }
      )
    );
  });

  it("spreads draws over every outcome", () => {
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[drawInt("spread", i, 4)] += 1;
    for (const count of counts) {
      expect(count).toBeGreaterThan(850);
      expect(count).toBeLessThan(1150);
    }
  });

  it("refuses a bad bound or draw index", () => {
    expect(() => drawInt("a", 0, 0)).toThrow(RangeError);
    expect(() => drawInt("a", 0, 1.5)).toThrow(RangeError);
    expect(() => drawInt("a", -1, 3)).toThrow(RangeError);
    expect(() => drawInt("a", 0.5, 3)).toThrow(RangeError);
  });
});

describe("boss pools", () => {
  it("fixes a pool of one without consuming a draw", () => {
    const run = createRunState(ACT_I, "any");
    expect(run).toMatchObject({
      seed: "any",
      drawIndex: 0,
      draws: [],
      bossIds: [BOSS.id],
    });
    expect(runBlinds(ACT_I, run).map((b) => b.id)).toEqual([
      SMALL.id,
      BIG.id,
      BOSS.id,
    ]);
    expect(createRunState(ACT_I).seed).toBe(DEFAULT_SEED);
  });

  it("draws the Boss from a larger pool at draw 0 and logs it", () => {
    const other: Scenario = {
      ...BOSS,
      id: "other-boss",
      blind: { ...BOSS.blind, name: "Boss Blind: Another Committee" },
    };
    const act: Act = { ...ACT_I, bossPool: [BOSS, other] };
    expect(ActSchema.safeParse(act).success).toBe(true);
    const seen = new Set<string>();
    for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"]) {
      const run = createRunState(act, seed);
      expect(run.drawIndex).toBe(1);
      expect(run.draws).toEqual([
        {
          drawIndex: 0,
          kind: "BOSS",
          id: run.bossIds[0],
          actIndex: 0,
          blindIndex: 2,
        },
      ]);
      expect(run.bossIds[0]).toBe([BOSS, other][drawInt(seed, 0, 2)].id);
      expect(runBlinds(act, run)[2].id).toBe(run.bossIds[0]);
      seen.add(run.bossIds[0] as string);
    }
    expect(seen).toEqual(new Set([BOSS.id, other.id]));
  });

  it("selects the same Boss for the same seed, for any seed", () => {
    const pool = [0, 1, 2].map((i) => ({ ...BOSS, id: `boss-${i}` }));
    const act: Act = { ...ACT_I, bossPool: pool };
    fc.assert(
      fc.property(fc.string({ maxLength: 24 }), (seed) => {
        const a = createRunState(act, seed);
        expect(createRunState(act, seed)).toEqual(a);
        expect(pool.map((b) => b.id)).toContain(a.bossIds[0]);
      })
    );
  });

  it("rejects a Boss among the Blinds, a non-Boss in the pool, or a duplicate", () => {
    const paths = (act: Act) =>
      ActSchema.safeParse(act).error?.issues.map((i) => i.path.join("."));
    expect(paths({ ...ACT_I, blinds: [SMALL, BIG, BOSS] })).toEqual([
      "blinds.2.blind.tier",
    ]);
    expect(paths({ ...ACT_I, bossPool: [BIG] })).toEqual([
      "bossPool.0.blind.tier",
    ]);
    expect(paths({ ...ACT_I, bossPool: [BOSS, BOSS] })).toEqual([
      "bossPool.1.id",
    ]);
    const elsewhere = {
      ...BOSS,
      populationSnapshot: { ...BOSS.populationSnapshot, id: "SNAP-OTHER" },
      drawPile: BOSS.drawPile.map((d) => ({
        ...d,
        populationSnapshotId: "SNAP-OTHER",
      })),
    };
    expect(paths({ ...ACT_I, bossPool: [elsewhere] })).toEqual([
      "bossPool.0.populationSnapshot.id",
    ]);
  });
});

describe("crisis draws", () => {
  it("draws no crisis for the first Blind, then one per Blind without replacement", () => {
    const start = createRunState(QUICK, "e2e-3");
    expect(start.table.crisis).toBeNull();
    let run = clearAndNext(QUICK, start);
    expect(run.blindIndex).toBe(1);
    expect(run.table.crisis?.id).toBe(AMENDMENT.id);
    expect(run.draws).toEqual([
      {
        drawIndex: 0,
        kind: "CRISIS",
        id: AMENDMENT.id,
        actIndex: 0,
        blindIndex: 1,
      },
    ]);
    expect(run.table.lastEvent?.message).toBe(
      `Big Blind: Sponsor Safety Review. Target 1. Crisis: ${AMENDMENT.name}. ${AMENDMENT.description}`
    );
    run = step(QUICK, run, resolve("defer"));
    run = clearAndNext(QUICK, run);
    expect(run.table.crisis?.id).toBe(AUDIT.id);
    expect(run.drawIndex).toBe(2);
    expect(run.draws.map((d) => [d.drawIndex, d.id])).toEqual([
      [0, AMENDMENT.id],
      [1, AUDIT.id],
    ]);
  });

  it("draws nothing, and consumes no index, once the deck is spent", () => {
    const act: Act = { ...QUICK, crisisDeck: [EMERGENCY] };
    let run = clearAndNext(act, createRunState(act, "x"));
    expect(run.table.crisis?.id).toBe(EMERGENCY.id);
    run = clearAndNext(act, step(act, run, resolve("decline")));
    expect(run.blindIndex).toBe(2);
    expect(run.table.crisis).toBeNull();
    expect(run.drawIndex).toBe(1);
  });

  it("replays any seed and move sequence identically, and restarts on the same seed", () => {
    type Move =
      RunAction | { kind: "select"; i: number } | { kind: "answer"; i: number };
    const moves = fc.array<Move>(
      fc.oneof<fc.Arbitrary<Move>[]>(
        fc.constant<RunAction>({ type: "NEXT_BLIND" }),
        fc.constant<RunAction>({ type: "PLAY_HAND" }),
        fc.constant<RunAction>({ type: "DISCARD" }),
        fc.nat({ max: 7 }).map((i) => ({ kind: "select" as const, i })),
        fc.nat({ max: 2 }).map((i) => ({ kind: "answer" as const, i }))
      ),
      { maxLength: 30 }
    );
    const run = (seed: string, script: Move[]) => {
      let r = createRunState(QUICK, seed);
      for (const move of script) {
        const action: RunAction =
          "type" in move
            ? move
            : move.kind === "select"
              ? {
                  type: "TOGGLE_SELECT",
                  cardId: r.table.hand[move.i] ?? "none",
                }
              : {
                  type: "RESOLVE_CRISIS",
                  choiceId: r.table.crisis?.choices[move.i]?.id ?? "none",
                };
        r = advanceRun(QUICK, r, action);
      }
      return r;
    };
    fc.assert(
      fc.property(fc.string({ maxLength: 16 }), moves, (seed, script) => {
        const once = run(seed, script);
        expect(run(seed, script)).toEqual(once);
        expect(JSON.parse(JSON.stringify(once))).toEqual(once);
        expect(once.drawIndex).toBe(once.draws.length);
        expect(new Set(once.draws.map((d) => d.id)).size).toBe(
          once.draws.length
        );
        const again = advanceRun(QUICK, once, { type: "RESTART_RUN" });
        expect({ ...again, table: null }).toEqual({
          ...createRunState(QUICK, seed),
          table: null,
        });
      }),
      { numRuns: 60 }
    );
  });

  it("restarts on a new seed when the restart carries one", () => {
    const run = clearAndNext(QUICK, createRunState(QUICK, "e2e-3"));
    const fresh = advanceRun(QUICK, run, { type: "RESTART_RUN", seed: "t1" });
    expect(fresh).toMatchObject({
      seed: "t1",
      blindIndex: 0,
      drawIndex: 0,
      draws: [],
    });
    expect(fresh.table.lastEvent?.message).toBe(
      "Run restarted. Small Blind: Internal QC."
    );
    expect(clearAndNext(QUICK, fresh).table.crisis?.id).toBe(EMERGENCY.id);
  });

  it("exposes the seed and draw log on the run view", () => {
    const run = clearAndNext(QUICK, createRunState(QUICK, "e2e-4"));
    expect(deriveRunView(QUICK, run)).toMatchObject({
      seed: "e2e-4",
      draws: [{ kind: "CRISIS", id: AUDIT.id }],
    });
  });
});

describe("answering a crisis", () => {
  it("refuses play, discard, inspect, recompile, allocate and seals until answered", () => {
    const pending = table(BIG, AUDIT);
    const alert = `${AUDIT.name}: answer the crisis first.`;
    const card = pending.hand[0];
    for (const action of [
      { type: "PLAY_HAND" },
      { type: "DISCARD" },
      { type: "INSPECT_CARD", cardId: card },
      { type: "RECOMPILE", cardId: card },
      { type: "ALLOCATE", cardId: card, population: "SAFETY" },
      { type: "APPLY_SEAL", consumableId: "x", cardId: card },
      { type: "INSPECT_CELL", row: 0, col: 0 },
      { type: "CORRECT_FINDING", findingId: "x" },
    ] as TableAction[]) {
      const next = advanceTable(BIG, pending, action);
      expect(next.lastEvent).toMatchObject({ kind: "REFUSED", message: alert });
      expect({ ...next, lastEvent: null }).toEqual({
        ...pending,
        lastEvent: null,
      });
    }
    const view = deriveTableView(BIG, pending);
    expect(view).toMatchObject({
      canPlay: false,
      canDiscard: false,
      canInspect: false,
      canRecompile: false,
    });
    expect(view.crisis?.crisis.id).toBe(AUDIT.id);
  });

  it("still lets the player select, reorder and sell while deciding", () => {
    const pending = table(
      BIG,
      AUDIT,
      { type: "TOGGLE_SELECT", cardId: "C-L16.2.7" },
      { type: "MOVE_CARD", cardId: "C-L16.2.7", toIndex: 0 }
    );
    expect(pending.selected).toEqual(["C-L16.2.7"]);
    expect(pending.hand[0]).toBe("C-L16.2.7");
    // Selling the tray seal funds the remote audit.
    const funded = advanceTable(
      BIG,
      { ...pending, budget: 1 },
      { type: "SELL_CONSUMABLE", consumableId: pending.consumables[0].id }
    );
    expect(funded.budget).toBe(2);
    expect(
      deriveTableView(BIG, funded).crisis?.choices.map((c) => c.refusal)
    ).toEqual([null, null, "Needs a footnote seal in the tray."]);
    const answered = advanceTable(BIG, funded, resolve("remote"));
    expect(answered.budget).toBe(0);
    expect(answered.crisis).toBeNull();
    expect(answered.crisisResolution).toEqual({
      crisisId: AUDIT.id,
      choiceId: "remote",
    });
  });

  it("refuses an unknown or unaffordable choice, and an answer with no crisis", () => {
    const pending = table(BIG, AUDIT);
    expect(advanceTable(BIG, pending, resolve("nope")).lastEvent).toMatchObject(
      { kind: "REFUSED", message: "Site Audit has no such choice." }
    );
    expect(
      advanceTable(BIG, pending, resolve("remote")).lastEvent
    ).toMatchObject({
      kind: "REFUSED",
      message: "Pay for a remote audit: Needs $2k study budget; $0k left.",
    });
    const broke = {
      ...table(BIG, AMENDMENT),
      cpu: { available: 0, spent: 10 },
    };
    expect(advanceTable(BIG, broke, resolve("defer")).lastEvent).toMatchObject({
      kind: "REFUSED",
      message: "Defer it to the next study: Needs 1 CPU; 0 left.",
    });
    const trayless = { ...pending, consumables: [] };
    expect(
      advanceTable(BIG, trayless, resolve("footnote")).lastEvent
    ).toMatchObject({
      kind: "REFUSED",
      message: "Document it in a footnote: Needs a footnote seal in the tray.",
    });
    expect(
      advanceTable(BIG, table(BIG, null), resolve("host")).lastEvent
    ).toMatchObject({
      kind: "REFUSED",
      message: "There is no crisis to answer.",
    });
    const over = { ...pending, status: "FAILED" as const };
    expect(advanceTable(BIG, over, resolve("host")).lastEvent?.message).toBe(
      "The Blind is over. Restart to play again."
    );
  });

  it("spends a CPU cost, and never below zero", () => {
    const state = table(BIG, MIGRATION, resolve("migrate"));
    expect(state.cpu).toEqual({ available: 8, spent: 2 });
    expect(state.lastEvent).toMatchObject({
      kind: "CRISIS_RESOLVED",
      message:
        "Database Migration: Migrate now. Rerun the extracts on the new build: −2 CPU.",
    });
    expect(
      cpuReducer({ available: 1, spent: 0 }, { type: "ADJUST", delta: -3 })
    ).toEqual({ available: 0, spent: 1 });
    expect(
      cpuReducer({ available: 1, spent: 4 }, { type: "ADJUST", delta: 2 })
    ).toEqual({ available: 3, spent: 4 });
  });

  it("spends the first tray seal to document an audit", () => {
    const before = table(BIG, AUDIT);
    const state = advanceTable(BIG, before, resolve("footnote"));
    expect(state.consumables).toEqual(before.consumables.slice(1));
    expect(state.lastEvent?.message).toContain(
      `${consumableName(before.consumables[0])} spent.`
    );
  });

  it("grants a seal into a free slot, or loses it when the tray is full", () => {
    // The Big Blind's Guidance card fills the second slot, so it is used first.
    const guide = createTableState(BIG).consumables.find(
      (c) => c.kind === "GUIDANCE"
    )!.id;
    const granted = table(
      BIG,
      MIGRATION,
      { type: "USE_GUIDANCE", consumableId: guide },
      resolve("freeze")
    );
    expect(granted.consumables.map((c) => c.id)).toContain(
      "FN-DATA-CUTOFF@CR-DB-MIGRATION"
    );
    expect(granted.lastEvent?.message).toContain(
      "Data cutoff added to the tray."
    );
    const last = granted.consumables.at(-1);
    const seal = (last?.kind === "SEAL" ? last.seal : null) as FootnoteSeal;
    const full = advanceTable(
      BIG,
      {
        ...table(BIG, MIGRATION),
        consumables: [
          { id: "a", kind: "SEAL", seal },
          { id: "b", kind: "SEAL", seal },
        ],
      },
      resolve("freeze")
    );
    expect(full.consumables.map((c) => c.id)).toEqual(["a", "b"]);
    expect(full.lastEvent?.message).toContain(
      "The tray is full, so Data cutoff is lost."
    );
  });

  it("routes an amendment through snapshot invalidation: Per-Protocol outputs go stale", () => {
    // Discard to Per-Protocol cards first, so one is in hand.
    const base = createTableState(BIG);
    const state = advanceTable(
      BIG,
      { ...base, crisis: AMENDMENT },
      resolve("adopt")
    );
    expect(state.snapshots.map((s) => s.id)).toEqual([
      "SNAP-P1-v1",
      "SNAP-P1-v2",
    ]);
    expect(state.invalidations).toHaveLength(1);
    expect(state.invalidations[0]).toMatchObject({
      transitionId: "CR-P1-S011-AMENDMENT",
      subjectId: "S-011",
      reason: "PROTOCOL_AMENDMENT",
      populations: ["PER_PROTOCOL"],
    });
    const view = deriveTableView(BIG, state);
    const pp = view.hand.filter((h) => h.card.population === "PER_PROTOCOL");
    expect(state.invalidations[0].staleCardIds).toEqual(
      pp.map((h) => h.card.id)
    );
    for (const h of pp) expect(h.stale).toBe(true);
    for (const h of view.hand.filter(
      (c) => c.card.population !== "PER_PROTOCOL"
    )) {
      expect(h.stale).toBe(false);
    }
    expect(state.lastEvent?.message).toContain(
      "Protocol Amendment 2: S-011 missed the Day 3 dose and leaves the Per-Protocol set."
    );
  });

  it("ignores a transition that no longer changes membership", () => {
    const moved = table(BIG, AMENDMENT, resolve("adopt"));
    const again = advanceTable(
      BIG,
      { ...moved, crisis: AMENDMENT },
      resolve("adopt")
    );
    expect(again.snapshots).toHaveLength(2);
    expect(again.crisis).toBeNull();
  });

  it("restores the Blind's crisis on RESET", () => {
    const answered = table(BIG, EMERGENCY, resolve("accept"));
    const reset = advanceTable(BIG, answered, { type: "RESET" });
    expect(reset.crisis?.id).toBe(EMERGENCY.id);
    expect(reset.modifiers).toEqual([]);
    expect(reset.budget).toBe(0);
  });
});

describe("Blind modifiers", () => {
  it("fails the Blind when a hand limit is used up short of the target", () => {
    let state = table(BIG, EMERGENCY, resolve("accept"));
    expect(state.budget).toBe(2);
    let view = deriveTableView(BIG, state);
    expect(view.handsLeft).toBe(2);
    expect(view.handsAffordable).toBe(2);
    expect(view.modifiers.map((m) => m.id)).toEqual(["CR-EMERGENCY-HANDS"]);
    // Play single uninspected cards, which score nothing, skipping any the
    // first hand's snapshot change made stale.
    for (let i = 0; i < 2; i++) {
      const from = state;
      state =
        from.hand
          .map((cardId) =>
            [{ type: "TOGGLE_SELECT", cardId }, { type: "PLAY_HAND" }].reduce(
              (s, a) => advanceTable(BIG, s, a as TableAction),
              from
            )
          )
          .find((s) => s.handsPlayed === from.handsPlayed + 1) ?? from;
    }
    expect(state.handsPlayed).toBe(2);
    expect(state.status).toBe("FAILED");
    expect(state.lastEvent?.message).toContain(
      "Big Blind: Sponsor Safety Review failed: the 2-hand limit is used up."
    );
    view = deriveTableView(BIG, state);
    expect(view.handsLeft).toBe(0);
  });

  it("uses the tightest of several hand limits", () => {
    const state = {
      ...createTableState(BIG),
      modifiers: [
        modifier({ debuffType: "HAND_LIMIT", maxHandsAllowed: 3, id: "A" }),
        modifier({ debuffType: "HAND_LIMIT", maxHandsAllowed: 2, id: "B" }),
      ],
    };
    expect(deriveTableView(BIG, state).handsLeft).toBe(2);
    expect(deriveTableView(BIG, createTableState(BIG)).handsLeft).toBeNull();
  });

  it("adds a discard penalty to every discard, and refuses one it cannot pay", () => {
    let state = table(BIG, AUDIT, resolve("host"), {
      type: "TOGGLE_SELECT",
      cardId: "C-L16.2.7",
    });
    const view = deriveTableView(BIG, state);
    expect(view.discardCost).toBe(CPU_COSTS.DISCARD + 1);
    expect(view.discardsAffordable).toBe(5);
    state = advanceTable(BIG, state, { type: "DISCARD" });
    expect(state.cpu).toEqual({ available: 8, spent: 2 });
    const poor = advanceTable(
      BIG,
      {
        ...state,
        selected: [state.hand[0]],
        cpu: { available: 1, spent: 9 },
      },
      { type: "DISCARD" }
    );
    expect(poor.lastEvent).toMatchObject({
      kind: "REFUSED",
      message: "Discard needs 2 CPU.",
    });
    expect(
      deriveTableView(BIG, { ...poor, selected: [poor.hand[0]] }).canDiscard
    ).toBe(false);
  });

  it("disables a population when a crisis imposes it, as the boss does", () => {
    const state = {
      ...createTableState(BIG),
      modifiers: [
        modifier({
          debuffType: "DISABLE_POPULATION",
          disabledPopulations: ["SAFETY"],
        }),
      ],
    };
    const view = deriveTableView(BIG, state);
    const safety = view.hand.filter((h) => h.card.population === "SAFETY");
    expect(safety.length).toBeGreaterThan(0);
    for (const h of safety) expect(h.debuffed).toBe(true);
    const played = advanceTable(
      BIG,
      advanceTable(BIG, state, {
        type: "TOGGLE_SELECT",
        cardId: safety[0].card.id,
      }),
      { type: "PLAY_HAND" }
    );
    expect(played.lastPlay?.evaluation.chips.total).toBe(
      played.lastPlay?.evaluation.chips.base
    );
    expect(
      played.lastPlay?.evaluation.ruleResults.some(
        (r) => r.ruleId === "MOD-DISABLE_POPULATION"
      )
    ).toBe(true);
  });

  it("turns treatment-arm values face down under a DMC firewall, absent from the view", () => {
    const state = table(
      BIG,
      crisisWith({ modifier: modifier({ debuffType: "BLIND_FIREWALL" }) }),
      resolve("take")
    );
    const view = deriveTableView(BIG, state);
    expect(view.firewall).toBe(true);
    expect(view.canInspect).toBe(false);
    let armCells = 0;
    for (const h of view.hand) {
      for (const face of [h.face, h.card.face]) {
        if (face?.kind === "TABLE") {
          face.columns.forEach((label, c) => {
            const isArm = label !== "Total";
            for (const row of face.rows) {
              if (isArm) {
                expect(row.values[c]).toBe(FIREWALL_CELL);
                armCells += 1;
              } else {
                expect(row.values[c]).not.toBe(FIREWALL_CELL);
              }
            }
          });
        }
        if (face?.kind === "LISTING") {
          const arm = face.columns.indexOf("Arm");
          for (const row of face.rows) {
            if (arm >= 0) expect(row[arm]).toBe(FIREWALL_CELL);
            expect(row.filter((v) => v === FIREWALL_CELL)).toHaveLength(
              arm >= 0 ? 1 : 0
            );
          }
        }
      }
    }
    expect(armCells).toBeGreaterThan(0);
    // No arm-level label survives in the serialized hand.
    const serialized = JSON.stringify(view.hand);
    expect(serialized).not.toMatch(/"(PBO|ACT)"/);
    const refused = advanceTable(BIG, state, {
      type: "INSPECT_CARD",
      cardId: state.hand[0],
    });
    expect(refused.lastEvent).toMatchObject({
      kind: "REFUSED",
      message: FIREWALL_ALERT,
    });
    // Without the firewall, the same hand shows its arms.
    expect(deriveTableView(BIG, createTableState(BIG)).firewall).toBe(false);
  });
});

describe("crisis contracts", () => {
  it("ships Act I's four crises, each with a free choice", () => {
    expect(ACT_I.crisisDeck?.map((c) => c.id)).toEqual([
      "CR-SITE-AUDIT",
      "CR-AMENDMENT-2",
      "CR-DB-MIGRATION",
      "CR-EMERGENCY-REVIEW",
    ]);
    for (const crisis of ACT_I_CRISES) {
      expect(CrisisCardSchema.safeParse(crisis).success).toBe(true);
      expect(crisis.choices.some(isFreeCrisisChoice)).toBe(true);
    }
    expect(ActSchema.safeParse(ACT_I).success).toBe(true);
  });

  it("rejects a crisis with no free choice or duplicate choice ids", () => {
    const paid = {
      ...AUDIT,
      choices: AUDIT.choices.map((c) => ({ ...c, effect: { cpu: -1 } })),
    };
    expect(
      CrisisCardSchema.safeParse(paid).error?.issues.map((i) => i.message)
    ).toEqual([
      "A crisis needs at least one choice that costs no CPU, budget or seal",
    ]);
    const twins = {
      ...AUDIT,
      choices: [AUDIT.choices[0], AUDIT.choices[0]],
    };
    expect(
      CrisisCardSchema.safeParse(twins).error?.issues.map((i) =>
        i.path.join(".")
      )
    ).toEqual(["choices.1.id"]);
  });

  it("rejects duplicate crises and a transition naming an unknown subject", () => {
    const paths = (crisisDeck: CrisisCard[]) =>
      ActSchema.safeParse({ ...ACT_I, crisisDeck }).error?.issues.map((i) =>
        i.path.join(".")
      );
    expect(paths([AUDIT, AUDIT])).toEqual(["crisisDeck.1.id"]);
    const ghost = {
      ...AMENDMENT,
      choices: AMENDMENT.choices.map((c) =>
        c.effect.transition
          ? {
              ...c,
              effect: {
                transition: { ...c.effect.transition, subjectId: "S-999" },
              },
            }
          : c
      ),
    };
    expect(paths([ghost])).toEqual([
      "crisisDeck.0.choices.0.effect.transition.subjectId",
    ]);
  });

  it("requires a hand limit and a positive discard penalty", () => {
    const issues = (m: Partial<BossBlindModifier>) =>
      BossBlindModifierSchema.safeParse({
        id: "M",
        name: "M",
        description: "M",
        ...m,
      }).error?.issues.map((i) => i.message);
    expect(issues({ debuffType: "HAND_LIMIT" })).toEqual([
      "HAND_LIMIT must set maxHandsAllowed",
    ]);
    expect(issues({ debuffType: "DISCARD_PENALTY" })).toEqual([
      "DISCARD_PENALTY must add at least 1 CPU",
    ]);
    expect(
      issues({ debuffType: "DISCARD_PENALTY", discardCpuPenalty: 1 })
    ).toBeUndefined();
    expect(issues({ debuffType: "BLIND_FIREWALL" })).toBeUndefined();
  });
});
