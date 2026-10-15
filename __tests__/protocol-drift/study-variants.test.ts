// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEED,
  FULL_SUBMISSIONS,
  TRACER_GRAPH,
  createProtocolDriftEngine,
  isoToMinute,
  studyPlan,
  studyVariant,
  trialDayOf,
} from "@/lib/protocol-drift";
import { arcadeDailyNumber } from "@/lib/arcade/daily";
import {
  ok,
  playFullLevel,
  publish,
  runUntil,
  WAVE_END_MINUTES,
} from "./helpers";

const SEEDS = [
  1,
  7,
  1234,
  99_999,
  arcadeDailyNumber("2026-10-15", "protocol-drift"),
  arcadeDailyNumber("2026-12-25", "protocol-drift"),
];

function engineFor(seed: number, scenario: "full" | "tracer" = "full") {
  const engine = createProtocolDriftEngine({ seed, scenario });
  ok(engine, { type: "ACCEPT_BRIEF" });
  return engine;
}

describe("seeded study variants (#2169)", () => {
  it("plays the authored study unchanged on the default seed", () => {
    expect(studyVariant(FULL_SUBMISSIONS, DEFAULT_SEED)).toBe(FULL_SUBMISSIONS);
  });

  it("gives other seeds a different timeline or different vitals", () => {
    for (const seed of SEEDS) {
      const variant = studyVariant(FULL_SUBMISSIONS, seed);
      const changed = variant.some(
        (f, i) =>
          f.submittedAt !== FULL_SUBMISSIONS[i].submittedAt ||
          JSON.stringify(f.payload) !==
            JSON.stringify(FULL_SUBMISSIONS[i].payload)
      );
      expect(changed, `seed ${seed}`).toBe(true);
    }
  });

  it("keeps every submission in its day and its order within a session", () => {
    const dayOf = (iso: string) => trialDayOf(isoToMinute(iso));
    for (const seed of SEEDS) {
      // Site B's late Day 24 backlog lands on the plan's day (#2275).
      const lateDay = studyPlan(seed).lateBacklogDay;
      const variant = studyVariant(FULL_SUBMISSIONS, seed);
      variant.forEach((f, i) => {
        const before = FULL_SUBMISSIONS[i];
        const late = before.sessionId === "sess-b-day27-backlog";
        expect(dayOf(f.submittedAt)).toBe(
          late ? lateDay : dayOf(before.submittedAt)
        );
        expect(f.submittedAt.slice(11) >= before.submittedAt.slice(11)).toBe(
          true
        );
        expect(f.assessedAt).toBe(before.assessedAt);
      });
    }
  });

  it("two different seeds play two different studies", () => {
    const a = studyVariant(FULL_SUBMISSIONS, SEEDS[0]);
    const b = studyVariant(FULL_SUBMISSIONS, SEEDS[1]);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it.each(SEEDS)("seed %i locks clean with the reference pipelines", (seed) => {
    const engine = engineFor(seed);
    playFullLevel(engine);
    const review = ok(engine, { type: "REQUEST_LOCK" });
    const audit = review.find((e) => e.type === "LOCK_AUDIT");
    expect(
      audit && audit.type === "LOCK_AUDIT" ? audit.result.discrepancies : null
    ).toEqual([]);
    ok(engine, { type: "CONFIRM_LOCK" });
    expect(engine.view().fsmState).toBe("LOCKED");
  });

  it.each(SEEDS)("seed %i finishes the tracer", (seed) => {
    const engine = engineFor(seed, "tracer");
    publish(engine, TRACER_GRAPH, "t1");
    runUntil(engine, WAVE_END_MINUTES[1]);
    expect(engine.view().completedWaves).toContain(1);
  });
});
