// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  FULL_GRAPH,
  WAVE1_GRAPH,
  buildScorecard,
  minuteAt,
  recordEfficiencyBests,
  restoreProtocolDriftEngine,
  type ProtocolDriftEngine,
  type Scorecard,
} from "@/lib/protocol-drift";
import {
  WAVE_END_MINUTES,
  ok,
  playFullLevel,
  resolveAll,
  runUntil,
  startEngine,
} from "./helpers";

function lock(engine: ProtocolDriftEngine): Scorecard {
  ok(engine, { type: "REQUEST_LOCK" });
  const locked = ok(engine, { type: "CONFIRM_LOCK" }).find(
    (e) => e.type === "LOCKED"
  );
  if (!locked || locked.type !== "LOCKED") throw new Error("not locked");
  return locked.scorecard;
}

/** The full level with the Wave 1 pipeline loaded as a reference. */
function playAssisted(engine: ProtocolDriftEngine): void {
  ok(engine, { type: "LOAD_GRAPH", ...WAVE1_GRAPH, reference: "wave1" });
  ok(engine, { type: "VALIDATE_GRAPH", ...WAVE1_GRAPH });
  ok(engine, { type: "PUBLISH_REVISION", revisionId: "p1", ...WAVE1_GRAPH });
  runUntil(engine, WAVE_END_MINUTES[1]);
  resolveAll(engine);
  runUntil(engine, minuteAt(20, 8, 0));
  ok(engine, { type: "VALIDATE_GRAPH", ...FULL_GRAPH });
  ok(engine, { type: "PUBLISH_REVISION", revisionId: "p2", ...FULL_GRAPH });
  runUntil(engine, WAVE_END_MINUTES[2]);
  resolveAll(engine);
  runUntil(engine, WAVE_END_MINUTES[3]);
  resolveAll(engine);
  if (engine.view().fsmState === "WAVE_REVIEW")
    ok(engine, { type: "SET_PAUSED", isPaused: true });
}

describe("assisted runs (#2168)", () => {
  it("an unassisted run is not marked and keeps its design medals", () => {
    const engine = startEngine();
    playFullLevel(engine);
    expect(engine.view().assisted).toBe(false);
    const card = lock(engine);
    expect(card.assisted).toBe(false);
    expect(card.efficiency.some((m) => m.waived)).toBe(false);
    expect(card.medals).toBe(5);
  });

  it("loading a reference marks the run and waives chip and wire par", () => {
    const engine = startEngine();
    playAssisted(engine);
    expect(engine.view().assisted).toBe(true);
    const card = lock(engine);
    expect(card.assisted).toBe(true);
    const byId = Object.fromEntries(card.efficiency.map((m) => [m.id, m]));
    for (const id of ["chips", "wires"] as const) {
      expect(byId[id]).toMatchObject({ medal: false, points: 0, waived: true });
    }
    expect(byId.lockDay.waived).toBeUndefined();
    expect(card.medals).toBe(3);
    expect(card.efficiencyScore).toBe(
      card.efficiency.reduce((sum, m) => sum + m.points, 0)
    );
  });

  it("survives a save and restore through the command log", () => {
    const engine = startEngine();
    ok(engine, { type: "LOAD_GRAPH", ...WAVE1_GRAPH, reference: "wave1" });
    const save = ok(engine, {
      type: "EXPORT_SAVE",
      savedAt: "2026-01-01T00:00:00Z",
    }).find((e) => e.type === "SAVE_EXPORTED");
    if (!save || save.type !== "SAVE_EXPORTED") throw new Error("no save");
    expect(restoreProtocolDriftEngine(save.save).view().assisted).toBe(true);
  });

  it("a plain canvas edit does not mark the run", () => {
    const engine = startEngine();
    ok(engine, { type: "LOAD_GRAPH", ...WAVE1_GRAPH });
    expect(engine.view().assisted).toBe(false);
  });

  it("waived measures never set a best", () => {
    const card = buildScorecard({
      lockedAtMinute: minuteAt(28, 10, 0),
      queries: [],
      sites: lockSites(),
      regexSplitBeforeNarrative: true,
      sleuthResolvedWithEvidence: true,
      lateBacklogRoutedV1: true,
      applicabilityErrors: 0,
      integrityPassed: true,
      chipCount: 2,
      wireCount: 1,
      rejectedCommands: 0,
      fabricatedBits: 0,
      assisted: true,
    });
    const { bests, improved } = recordEfficiencyBests({}, card);
    expect(bests.chips).toBeUndefined();
    expect(bests.wires).toBeUndefined();
    expect(improved).not.toContain("chips");
    expect(improved).toContain("lockDay");
  });
});

function lockSites() {
  const site = {
    goodwill: 60,
    attention: 100,
    version: "v2",
    latencyHours: 4,
    openQueries: 0,
  } as const;
  return {
    "SITE-A": { ...site, siteId: "SITE-A" },
    "SITE-B": { ...site, siteId: "SITE-B" },
    "SITE-C": { ...site, siteId: "SITE-C" },
  } as const;
}

describe("assisted design badges (#2276)", () => {
  it("waives the two design badges a reference earned, never the player's own", () => {
    const own = startEngine();
    playFullLevel(own);
    const earned = lock(own).badges;
    const engine = startEngine();
    playAssisted(engine);
    const badges = lock(engine).badges;
    for (const id of ["PREVENTATIVE_ARCHITECT", "AMENDMENT_NAVIGATOR"]) {
      const badge = badges.find((b) => b.id === id)!;
      expect(badge.earned).toBe(false);
      expect(badge.reason).toMatch(/Waived: a reference pipeline/);
    }
    const sleuth = badges.find((b) => b.id === "FORENSIC_SLEUTH")!;
    expect(sleuth.reason).not.toMatch(/Waived/);
    expect(earned.every((b) => !/Waived/.test(b.reason))).toBe(true);
  });
});
