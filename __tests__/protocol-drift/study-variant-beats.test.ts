// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SEED,
  FULL_SUBMISSIONS,
  SCRIPTED_TRANSPOSITIONS,
  SITE_CLARIFICATIONS,
  SITE_IDS,
  SITE_PROFILES,
  SOURCE_WORKSHEETS,
  createProtocolDriftEngine,
  restoreProtocolDriftEngine,
  scriptedTranspositions,
  studyPlan,
  studyVariant,
  type ProtocolDriftEngine,
  type Scorecard,
  type StudyPlan,
} from "@/lib/protocol-drift";
import { ok, playFullLevel } from "./helpers";

/**
 * #2275: a seed other than the default plays a different arrangement of the
 * authored beats, not just the same study with shifted times. Every variant
 * must stay winnable with the reference pipelines and replay exactly.
 */

const SWEEP = Array.from({ length: 50 }, (_, i) => i + 1);

function engineFor(seed: number): ProtocolDriftEngine {
  const engine = createProtocolDriftEngine({ seed, scenario: "full" });
  ok(engine, { type: "ACCEPT_BRIEF" });
  return engine;
}

/** The careful reference play, through to a confirmed lock. */
function playAndLock(seed: number): {
  engine: ProtocolDriftEngine;
  scorecard: Scorecard;
} {
  const engine = engineFor(seed);
  playFullLevel(engine);
  const review = ok(engine, { type: "REQUEST_LOCK" });
  const audit = review.find((e) => e.type === "LOCK_AUDIT");
  expect(
    audit && audit.type === "LOCK_AUDIT" ? audit.result.discrepancies : null,
    `seed ${seed} lock discrepancies`
  ).toEqual([]);
  const locked = ok(engine, { type: "CONFIRM_LOCK" }).find(
    (e) => e.type === "LOCKED"
  );
  if (!locked || locked.type !== "LOCKED") throw new Error("no LOCKED event");
  return { engine, scorecard: locked.scorecard };
}

/** Where each issue code landed, as "code@submission". */
function issueSites(engine: ProtocolDriftEngine): string[] {
  return engine
    .view()
    .issues.map((i) => `${i.code}@${i.submissionId}`)
    .sort();
}

function subjectOf(submissionId: string): string {
  const f = FULL_SUBMISSIONS.find((x) => x.submissionId === submissionId);
  return f?.subjectId ?? "";
}

function carriers(plan: StudyPlan): string {
  return [
    plan.partialDateSubmissionId,
    plan.narrativeSubmissionId,
    plan.transpositionSubmissionId,
  ].join("|");
}

describe("seeded study beats (#2275)", () => {
  it("keeps the authored study on the default seed", () => {
    const plan = studyPlan(DEFAULT_SEED);
    expect(plan.partialDateSubmissionId).toBe("sub-a02-mh");
    expect(plan.narrativeSubmissionId).toBe("sub-a01-d07");
    expect(plan.transpositionSubmissionId).toBe("sub-b01-d14");
    expect(plan.lateBacklogDay).toBe(27);
    expect(plan.worksheets).toEqual(SOURCE_WORKSHEETS);
    expect(plan.clarifications).toEqual(SITE_CLARIFICATIONS);
    for (const id of SITE_IDS) {
      expect(plan.initialGoodwill[id]).toBe(SITE_PROFILES[id].initialGoodwill);
    }
    expect(scriptedTranspositions(DEFAULT_SEED)).toBe(SCRIPTED_TRANSPOSITIONS);
    expect(studyVariant(FULL_SUBMISSIONS, DEFAULT_SEED)).toBe(FULL_SUBMISSIONS);

    const { engine } = playAndLock(DEFAULT_SEED);
    expect(issueSites(engine)).toEqual([
      "NARRATIVE_REPEAT@sub-a01-d07",
      "OUT_OF_RANGE@sub-b01-d14",
      "PARTIAL_DATE@sub-a02-mh",
    ]);
  });

  it("puts the issues on different subjects and visits for different seeds", () => {
    const one = playAndLock(1).engine;
    const four = playAndLock(4).engine;
    const authored = playAndLock(DEFAULT_SEED).engine;
    expect(issueSites(one)).not.toEqual(issueSites(four));
    expect(issueSites(one)).not.toEqual(issueSites(authored));
    expect(issueSites(four)).not.toEqual(issueSites(authored));
    // Not just times: the subjects carrying each code differ.
    const subjects = (e: ProtocolDriftEngine) =>
      e
        .view()
        .issues.map((i) => `${i.code}@${i.subjectId}/${i.visitDay}`)
        .sort();
    expect(subjects(one)).not.toEqual(subjects(four));
  });

  it("spreads every beat over several carriers across a seed sweep", () => {
    const plans = SWEEP.map(studyPlan);
    const spread = (pickId: (p: StudyPlan) => string | number) =>
      new Set(plans.map(pickId)).size;
    expect(spread((p) => p.partialDateSubmissionId)).toBeGreaterThanOrEqual(5);
    expect(spread((p) => p.narrativeSubmissionId)).toBeGreaterThanOrEqual(5);
    expect(spread((p) => p.transpositionSubmissionId)).toBe(3);
    expect(spread((p) => p.lateBacklogDay)).toBe(2);
    expect(new Set(plans.map(carriers)).size).toBeGreaterThan(25);
  });

  it.each(SWEEP)(
    "seed %i locks with every beat on its planned carrier and every badge",
    (seed) => {
      const plan = studyPlan(seed);
      const { engine, scorecard } = playAndLock(seed);
      const view = engine.view();
      expect(view.fsmState).toBe("LOCKED");
      expect(issueSites(engine)).toEqual(
        [
          `NARRATIVE_REPEAT@${plan.narrativeSubmissionId}`,
          `OUT_OF_RANGE@${plan.transpositionSubmissionId}`,
          `PARTIAL_DATE@${plan.partialDateSubmissionId}`,
        ].sort()
      );
      const partial = view.issues.find((i) => i.code === "PARTIAL_DATE");
      expect(partial?.subjectId).toBe(
        subjectOf(plan.partialDateSubmissionId)
      );
      // The transposition carries worksheet evidence and a source correction.
      const oor = view.issues.find((i) => i.code === "OUT_OF_RANGE");
      expect(oor?.evidence).toContain(
        plan.worksheets[plan.transpositionSubmissionId].hospital
      );
      expect(oor?.status).toBe("Resolved");
      // The narrative's site answers with its own reading.
      const narrativeQuery = view.queries.find(
        (q) =>
          view.issues.find((i) => i.issueId === q.issueId)?.code ===
          "NARRATIVE_REPEAT"
      );
      expect(narrativeQuery?.responseReceived).toBe(
        plan.clarifications[plan.narrativeSubmissionId]
      );
      expect(scorecard.badges.every((b) => b.earned)).toBe(true);
      expect(scorecard.trialDurationDays).toBe(28);
      for (const id of SITE_IDS) {
        expect(view.sites[id].goodwill).toBeLessThanOrEqual(
          plan.initialGoodwill[id]
        );
      }
    }
  );

  it("plans and plays the same study for the same seed", () => {
    for (const seed of [3, 17, 4242]) {
      expect(studyPlan(seed)).toEqual(studyPlan(seed));
      expect(studyVariant(FULL_SUBMISSIONS, seed)).toEqual(
        studyVariant(FULL_SUBMISSIONS, seed)
      );
      const a = playAndLock(seed);
      const b = playAndLock(seed);
      expect(a.engine.stateHash()).toBe(b.engine.stateHash());
      expect(a.scorecard).toEqual(b.scorecard);
    }
  });

  it("replays a variant save to the same state hash", () => {
    const engine = engineFor(17);
    playFullLevel(engine);
    const saved = ok(engine, { type: "EXPORT_SAVE" }).find(
      (e) => e.type === "SAVE_EXPORTED"
    );
    if (!saved || saved.type !== "SAVE_EXPORTED") throw new Error("no save");
    expect(saved.save.seed).toBe(17);
    const restored = restoreProtocolDriftEngine(saved.save);
    expect(restored.stateHash()).toBe(engine.stateHash());
  });

  it("scores the same scripted play differently on different seeds", () => {
    const scores = [1, 30, 50, DEFAULT_SEED].map(
      (seed) => playAndLock(seed).scorecard.score
    );
    expect(new Set(scores).size).toBeGreaterThan(1);
    expect(scores[0]).not.toBe(scores[2]);
  });
});
