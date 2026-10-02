// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ACT_I,
  ACT_II,
  ACT_II_DEVIATIONS,
  ACT_III,
  ACT_III_DEVIATIONS,
  ActSchema,
  BIOSTAT_OPS_CAMPAIGN,
  DeviationEventSchema,
  advanceRun,
  advanceTable,
  createRunState,
  createTableState,
  deriveTableView,
  replayRun,
  runBlinds,
  type Act,
  type DeviationEvent,
  type LoggedAction,
  type RunState,
  type Scenario,
  type ScheduledDeviation,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

/** Act II with a deviation certain to fire, so every seed exercises one. */
const CERTAIN: Act = {
  ...ACT_II,
  crisisDeck: undefined,
  deviations: { chancePercent: 100, deck: ACT_II_DEVIATIONS },
};
/**
 * Act II's Small Blind with a quota no hand reaches and CPU to spare, so it
 * stays open long enough for a deviation to land.
 */
const SMALL: Scenario = {
  ...ACT_II.blinds[0],
  blind: { ...ACT_II.blinds[0].blind, quota: 1_000_000 },
  table: { ...ACT_II.blinds[0].table, startingCpu: 40 },
};
const SEEDS = ["fold-change", "e2e-4", "alpha", "bravo", "charlie", "delta"];

/** The table's actions up to and including its first played hand. */
function firstHand(scenario: Scenario, state: TableState): TableAction[] {
  const actions: TableAction[] = [];
  for (const action of playBlind(scenario, state, "MEDIAN").actions) {
    if (action.type === "RESET") continue;
    actions.push(action);
    if (action.type === "PLAY_HAND") break;
  }
  return actions;
}

const run = (
  scenario: Scenario,
  actions: TableAction[],
  from: TableState
): TableState => actions.reduce((s, a) => advanceTable(scenario, s, a), from);

const scheduled = (
  event: DeviationEvent,
  afterHands = 1
): ScheduledDeviation => ({ event, afterHands });

describe("deviations as data", () => {
  it("authors Act II and Act III decks that validate with their acts", () => {
    for (const event of [...ACT_II_DEVIATIONS, ...ACT_III_DEVIATIONS]) {
      expect(DeviationEventSchema.parse(event)).toEqual(event);
    }
    expect(ActSchema.safeParse(ACT_II).success).toBe(true);
    expect(ActSchema.safeParse(ACT_III).success).toBe(true);
    expect(ACT_II.deviations?.deck).toBe(ACT_II_DEVIATIONS);
    expect(ACT_III.deviations?.deck).toBe(ACT_III_DEVIATIONS);
  });

  it("refuses an enrollment, another reason and repeated hands", () => {
    const [event] = ACT_II_DEVIATIONS;
    const refused = (patch: Partial<DeviationEvent>) =>
      DeviationEventSchema.safeParse({ ...event, ...patch }).success;
    expect(
      refused({
        transition: { ...event.transition, reason: "DROPOUT" },
      })
    ).toBe(false);
    expect(
      refused({
        transition: {
          ...event.transition,
          change: "ENROLL",
          subject: ACT_II.blinds[0].populationSnapshot.subjects[0],
        },
      })
    ).toBe(false);
    expect(refused({ afterHands: [1, 1] })).toBe(false);
    expect(refused({ afterHands: [] })).toBe(false);
    expect(refused({})).toBe(true);
  });

  it("refuses an act whose deviation names an unknown subject or repeats an id", () => {
    const [event] = ACT_II_DEVIATIONS;
    const unknown = {
      ...event,
      transition: { ...event.transition, subjectId: "S-999" },
    };
    expect(
      ActSchema.safeParse({
        ...ACT_II,
        deviations: { chancePercent: 50, deck: [unknown] },
      }).success
    ).toBe(false);
    expect(
      ActSchema.safeParse({
        ...ACT_II,
        deviations: { chancePercent: 50, deck: [event, event] },
      }).success
    ).toBe(false);
  });

  it("leaves Act I unchanged: no deck and no deviation draws", () => {
    expect(ACT_I.deviations).toBeUndefined();
    for (const seed of SEEDS) {
      const campaign = createRunState(BIOSTAT_OPS_CAMPAIGN, seed);
      expect(campaign.draws.some((d) => d.kind === "DEVIATION")).toBe(false);
      expect(campaign.table.deviation ?? null).toBeNull();
    }
  });
});

describe("the seeded deviation draw", () => {
  it("schedules the same deviation, after the same hand, for the same seed", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 12 }), (seed) => {
        const first = createRunState(CERTAIN, seed);
        expect(createRunState(CERTAIN, seed)).toEqual(first);
        const deviation = first.table.deviation!;
        expect(ACT_II_DEVIATIONS).toContain(deviation.event);
        expect(deviation.event.afterHands).toContain(deviation.afterHands);
        expect(first.draws.filter((d) => d.kind === "DEVIATION")).toEqual([
          expect.objectContaining({
            id: deviation.event.id,
            afterHands: deviation.afterHands,
            actIndex: 0,
            blindIndex: 0,
          }),
        ]);
      })
    );
  });

  it("fires at the act's odds and consumes the same draws either way", () => {
    const seeds = Array.from({ length: 60 }, (_, i) => `odds-${i}`);
    const fired = seeds.filter(
      (seed) => createRunState(ACT_II, seed).table.deviation
    );
    expect(fired.length).toBeGreaterThan(15);
    expect(fired.length).toBeLessThan(45);
    for (const seed of seeds) {
      expect(createRunState(ACT_II, seed).drawIndex).toBe(
        createRunState(CERTAIN, seed).drawIndex
      );
    }
  });

  it("draws for Small and Big Blinds without replacement, and never for the Boss", () => {
    let r: RunState = createRunState(CERTAIN, "alpha");
    const tables: TableState[] = [r.table];
    while (runBlinds(CERTAIN, r)[r.blindIndex].blind.tier !== "BOSS_BLIND") {
      const blind = runBlinds(CERTAIN, r)[r.blindIndex];
      for (const action of playBlind(blind, r.table, "PERFECT").actions) {
        if (r.table.status !== "REVIEWING") break;
        if (action.type === "RESET") continue;
        r = advanceRun(CERTAIN, r, action);
      }
      expect(r.table.status).toBe("CLEARED");
      r = advanceRun(CERTAIN, r, { type: "NEXT_BLIND" });
      tables.push(r.table);
    }
    const ids = r.draws
      .filter((d) => d.kind === "DEVIATION")
      .map((d) => [d.blindIndex, d.id]);
    expect(ids.map(([b]) => b)).toEqual([0, 1]);
    expect(new Set(ids.map(([, id]) => id)).size).toBe(2);
    expect(tables.at(-1)!.deviation ?? null).toBeNull();
  });
});

describe("a deviation landing mid-Blind", () => {
  const [neverDosed] = ACT_II_DEVIATIONS;

  it("stays hidden until its hand, then makes a new snapshot and stales exactly the outputs that depend on it", () => {
    const start = createTableState(
      SMALL,
      undefined,
      undefined,
      null,
      scheduled(neverDosed)
    );
    expect(deriveTableView(SMALL, start).deviation).toBeNull();
    const played = run(SMALL, firstHand(SMALL, start), start);
    expect(played.handsPlayed).toBe(1);
    expect(played.snapshots).toHaveLength(2);
    const [before, after] = played.snapshots;
    expect(after.version).toBe(before.version + 1);
    // It lands a day after the snapshot in force.
    expect(after.capturedAt).toBe("2026-01-16T09:00:00Z");
    expect(
      after.subjects.find((s) => s.id === "S-006")!.populations
    ).not.toContain("SAFETY");

    const [record] = played.invalidations;
    expect(record).toMatchObject({
      transitionId: neverDosed.transition.id,
      reason: "PROTOCOL_DEVIATION",
      populations: ["SAFETY", "PER_PROTOCOL"],
    });
    const view = deriveTableView(SMALL, played);
    const stale = view.hand.filter((h) => h.stale).map((h) => h.card.id);
    expect(record.staleCardIds.length).toBeGreaterThan(0);
    expect(stale).toEqual(record.staleCardIds);
    // Only Safety outputs went stale.
    for (const h of view.hand) {
      expect(h.stale).toBe(
        h.card.population === "SAFETY" &&
          record.staleCardIds.includes(h.card.id)
      );
    }
    expect(view.deviation).toMatchObject({
      name: neverDosed.name,
      afterHands: 1,
      subjectId: "S-006",
      populations: ["SAFETY", "PER_PROTOCOL"],
      snapshot: { version: 2 },
      fresh: true,
    });
    expect(view.deviation!.staled).toHaveLength(record.staleCardIds.length);
    expect(played.lastEvent?.message).toContain(
      `Protocol deviation: ${neverDosed.name}.`
    );
  });

  it("waits for its hand, and the card stops showing after the next one", () => {
    const start = createTableState(
      SMALL,
      undefined,
      undefined,
      null,
      scheduled(neverDosed, 2)
    );
    const one = run(SMALL, firstHand(SMALL, start), start);
    expect(one.handsPlayed).toBe(1);
    expect(one.snapshots).toHaveLength(1);
    expect(deriveTableView(SMALL, one).deviation).toBeNull();
    const two = run(SMALL, firstHand(SMALL, one), one);
    expect(two.handsPlayed).toBe(2);
    expect(deriveTableView(SMALL, two).deviation?.fresh).toBe(true);
    const three = run(SMALL, firstHand(SMALL, two), two);
    expect(three.handsPlayed).toBe(3);
    expect(deriveTableView(SMALL, three).deviation).toMatchObject({
      afterHands: 2,
      fresh: false,
    });
  });

  it("never lands once the Blind is over", () => {
    // One hand clears a Blind whose quota is 1.
    const easy: Scenario = { ...SMALL, blind: { ...SMALL.blind, quota: 1 } };
    const start = createTableState(
      easy,
      undefined,
      undefined,
      null,
      scheduled(neverDosed)
    );
    const cleared = run(easy, firstHand(easy, start), start);
    expect(cleared.status).toBe("CLEARED");
    expect(cleared.snapshots).toHaveLength(1);
    expect(deriveTableView(easy, cleared).deviation).toBeNull();
  });

  it("is scheduled again when the Blind restarts", () => {
    const start = createTableState(
      SMALL,
      undefined,
      undefined,
      null,
      scheduled(neverDosed)
    );
    const played = run(SMALL, firstHand(SMALL, start), start);
    const reset = advanceTable(SMALL, played, { type: "RESET" });
    expect(reset.snapshots).toHaveLength(1);
    expect(reset.deviation).toEqual(scheduled(neverDosed));
    expect(run(SMALL, firstHand(SMALL, reset), reset).snapshots).toHaveLength(
      2
    );
  });

  it("changes nothing when its subject has already left every named population", () => {
    const gone = {
      ...neverDosed,
      transition: { ...neverDosed.transition, populations: ["FAS" as const] },
    };
    const start = createTableState(
      SMALL,
      {
        snapshots: [
          {
            ...SMALL.populationSnapshot,
            subjects: SMALL.populationSnapshot.subjects.map((s) =>
              s.id === "S-006"
                ? {
                    ...s,
                    populations: s.populations.filter((p) => p !== "FAS"),
                  }
                : s
            ),
          },
        ],
        invalidations: [],
      },
      undefined,
      null,
      scheduled(gone)
    );
    const played = run(SMALL, firstHand(SMALL, start), start);
    expect(played.snapshots).toHaveLength(1);
    expect(deriveTableView(SMALL, played).deviation).toBeNull();
  });

  it("replays identically from the run's action log", () => {
    const act: Act = { ...CERTAIN, blinds: [SMALL, ACT_II.blinds[1]] };
    let r = createRunState(act, "bravo");
    const actions: LoggedAction[] = [];
    for (const action of playBlind(SMALL, r.table, "MEDIAN").actions) {
      if (r.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      r = advanceRun(act, r, action);
      actions.push(action);
    }
    expect(r.table.snapshots.length).toBeGreaterThan(1);
    expect(replayRun(act, { actId: act.id, seed: "bravo", actions })).toEqual(
      r
    );
  });
});
