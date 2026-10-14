// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  EFFICIENCY_METRIC_IDS,
  EFFICIENCY_PARS,
  FULL_GRAPH,
  buildScorecard,
  efficiencyPoints,
  evaluateEfficiency,
  minuteAt,
  parseEfficiencyBests,
  protocolDriftScore,
  recordEfficiencyBests,
  restoreProtocolDriftEngine,
  serializeEfficiencyBests,
  type ProtocolDriftEngine,
  type ProtocolDriftSaveFile,
  type Scorecard,
  type ScorecardInput,
} from "@/lib/protocol-drift";
import { ok, playFullLevel, startEngine } from "./helpers";

function lock(engine: ProtocolDriftEngine): Scorecard {
  ok(engine, { type: "REQUEST_LOCK" });
  const locked = ok(engine, { type: "CONFIRM_LOCK" }).find(
    (e) => e.type === "LOCKED"
  );
  if (!locked || locked.type !== "LOCKED") throw new Error("not locked");
  return locked.scorecard;
}

function saveOf(engine: ProtocolDriftEngine): ProtocolDriftSaveFile {
  const event = engine
    .dispatch({ type: "EXPORT_SAVE", savedAt: "2026-01-01T00:00:00Z" })
    .find((e) => e.type === "SAVE_EXPORTED");
  if (!event || event.type !== "SAVE_EXPORTED") throw new Error("no save");
  return event.save;
}

const site = {
  goodwill: 60,
  attention: 100,
  version: "v2",
  latencyHours: 4,
  openQueries: 0,
} as const;

function input(overrides: Partial<ScorecardInput> = {}): ScorecardInput {
  return {
    lockedAtMinute: minuteAt(28, 10, 0),
    queries: [],
    sites: {
      "SITE-A": { ...site, siteId: "SITE-A" },
      "SITE-B": { ...site, siteId: "SITE-B" },
      "SITE-C": { ...site, siteId: "SITE-C" },
    },
    regexSplitBeforeNarrative: true,
    sleuthResolvedWithEvidence: true,
    lateBacklogRoutedV1: true,
    applicabilityErrors: 0,
    integrityPassed: true,
    chipCount: 13,
    wireCount: 21,
    rejectedCommands: 0,
    fabricatedBits: 0,
    ...overrides,
  };
}

describe("efficiency par calibration (#2054)", () => {
  it("matches every par to the reference solve exactly", () => {
    const engine = startEngine();
    playFullLevel(engine);
    const card = lock(engine);
    const actual = Object.fromEntries(
      card.efficiency.map((m) => [m.id, m.actual])
    );
    // If this fails the engine or the reference solve changed: re-derive the
    // pars in EFFICIENCY_PARS from these numbers on purpose.
    expect(actual).toEqual({
      chips: FULL_GRAPH.nodes.length,
      wires: FULL_GRAPH.edges.length,
      lockDay: 28,
      rejectedCommands: 0,
      fabricatedBits: 0,
    });
    expect(FULL_GRAPH.nodes.length).toBe(13);
    expect(FULL_GRAPH.edges.length).toBe(21);
    for (const id of EFFICIENCY_METRIC_IDS) {
      expect(actual[id]).toBe(EFFICIENCY_PARS[id].par);
    }
    expect(card.medals).toBe(5);
    expect(card.efficiencyScore).toBe(500);
    expect(card.score).toBe(
      100 + 300 + Math.round(card.meanGoodwill) + card.efficiencyScore
    );
  });

  it("counts rejected commands, ignores clock ticks, and keeps them across a save", () => {
    const engine = startEngine();
    expect(
      engine
        .dispatch({ type: "REQUEST_LOCK" })
        .some((e) => e.type === "COMMAND_REJECTED")
    ).toBe(true);
    engine.dispatch({ type: "STEP_TICK" });
    engine.dispatch({ type: "TICK", realMs: 1000 });
    expect(engine.view().rejectedCommands).toBe(2);

    const save = saveOf(engine);
    expect(save.rejectedCommands).toBe(2);
    const restored = restoreProtocolDriftEngine(save);
    expect(restored.view().rejectedCommands).toBe(2);

    playFullLevel(restored);
    const card = lock(restored);
    expect(card.rejectedCommands).toBe(2);
    const metric = card.efficiency.find((m) => m.id === "rejectedCommands");
    expect(metric).toMatchObject({ actual: 2, par: 0, medal: false });
    expect(metric?.points).toBe(80);
  });

  it("restores older saves without a rejection count as none", () => {
    const engine = startEngine();
    engine.dispatch({ type: "REQUEST_LOCK" });
    const { rejectedCommands: _dropped, ...legacy } = saveOf(engine);
    expect(_dropped).toBe(1);
    expect(restoreProtocolDriftEngine(legacy).view().rejectedCommands).toBe(0);
  });
});

describe("efficiency scorecard math (#2054)", () => {
  it("scores 100 at par, steps per unit, and clamps to 0 and 150", () => {
    expect(efficiencyPoints("chips", 13)).toBe(100);
    expect(efficiencyPoints("chips", 15)).toBe(80);
    expect(efficiencyPoints("chips", 11)).toBe(120);
    expect(efficiencyPoints("chips", 1)).toBe(150);
    expect(efficiencyPoints("chips", 40)).toBe(0);
    expect(efficiencyPoints("wires", 25)).toBe(80);
    expect(efficiencyPoints("lockDay", 30)).toBe(50);
    expect(efficiencyPoints("rejectedCommands", 3)).toBe(70);
    expect(efficiencyPoints("fabricatedBits", Math.log2(31))).toBe(50);
  });

  it("awards a medal per measure at or under par", () => {
    const metrics = evaluateEfficiency({
      chips: 12,
      wires: 22,
      lockDay: 28,
      rejectedCommands: 1,
      fabricatedBits: 0,
    });
    expect(metrics.map((m) => [m.id, m.medal])).toEqual([
      ["chips", true],
      ["wires", false],
      ["lockDay", true],
      ["rejectedCommands", false],
      ["fabricatedBits", true],
    ]);
    expect(metrics.map((m) => m.par)).toEqual([13, 21, 28, 0, 0]);
  });

  it("lets a lean pipeline outscore a sprawling one with the same badges", () => {
    const lean = buildScorecard(input());
    const sprawling = buildScorecard(input({ chipCount: 20, wireCount: 34 }));
    expect(lean.integrityPassed).toBe(true);
    expect(lean.trialDurationDays).toBe(28);
    expect(lean.efficiencyScore).toBe(500);
    expect(sprawling.efficiencyScore).toBe(500 - 70 - 65);
    expect(sprawling.medals).toBe(3);
    expect(lean.score - sprawling.score).toBe(135);
    expect(lean.score).toBe(protocolDriftScore(3, 60, 500));
    expect(protocolDriftScore(0, 49.6, 0)).toBe(150);
  });

  it("copies the raw counts onto the scorecard", () => {
    const card = buildScorecard(
      input({ rejectedCommands: 4, fabricatedBits: 4.954 })
    );
    expect(card.chipCount).toBe(13);
    expect(card.wireCount).toBe(21);
    expect(card.rejectedCommands).toBe(4);
    expect(card.fabricatedBits).toBeCloseTo(4.954, 3);
    expect(card.medals).toBe(3);
  });
});

describe("efficiency bests (#2054)", () => {
  it("parses stored bests defensively", () => {
    expect(parseEfficiencyBests(null)).toEqual({});
    expect(parseEfficiencyBests("")).toEqual({});
    expect(parseEfficiencyBests("{nope")).toEqual({});
    expect(parseEfficiencyBests("[1,2]")).toEqual({});
    expect(parseEfficiencyBests("42")).toEqual({});
    expect(
      parseEfficiencyBests(
        JSON.stringify({
          chips: 12,
          wires: "21",
          lockDay: -1,
          rejectedCommands: 0,
          fabricatedBits: null,
          extra: 3,
        })
      )
    ).toEqual({ chips: 12, rejectedCommands: 0 });
  });

  it("keeps the lowest value per measure and names what improved", () => {
    const first = recordEfficiencyBests(
      {},
      buildScorecard(input({ chipCount: 15 }))
    );
    expect(first.improved).toEqual([...EFFICIENCY_METRIC_IDS]);
    expect(first.bests.chips).toBe(15);

    const second = recordEfficiencyBests(
      first.bests,
      buildScorecard(input({ chipCount: 14, wireCount: 30 }))
    );
    expect(second.improved).toEqual(["chips"]);
    expect(second.bests).toMatchObject({ chips: 14, wires: 21 });

    const same = recordEfficiencyBests(
      second.bests,
      buildScorecard(input({ chipCount: 14 }))
    );
    expect(same.improved).toEqual([]);
    expect(same.bests).toBe(second.bests);

    expect(
      parseEfficiencyBests(serializeEfficiencyBests(second.bests))
    ).toEqual(second.bests);
  });
});
