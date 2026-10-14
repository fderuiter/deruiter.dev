// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  advanceInspection,
  answerInspectionQuestion,
  applyInspectionToReport,
  applySponsorSkeletonsToReport,
  buildInspectionReport,
  createInitialAuditorState,
  createInitialScoreState,
  createInspectionRecord,
  createInspectionRound,
  extendInspectionTimer,
  generateBIMOReport,
  getCurrentInspectionQuestion,
  getInspectionSeed,
  getSkeletonDispositions,
  INSPECTION_EXTENSION_SECONDS,
  INSPECTION_MAX_RECORDS,
  INSPECTION_MIN_RECORDS,
  INSPECTION_MISS_PENALTY,
  INSPECTION_RECORD_SECONDS,
  INSPECTION_SKELETON_SECONDS,
  isInspectionComplete,
  setInspectionTimerEnabled,
  summarizeInspection,
  tickInspectionTimer,
  type ClinicalObservation,
  type ClinicalSubject,
  type InspectionOptionOutcome,
  type InspectionRecord,
  type InspectionRound,
  type SponsorSkeleton,
} from "@/lib/clinical-trial-chaos";
import { createSeededRandom } from "@/lib/game-utils";
import * as folderIndex from "@/lib/clinical-trial-chaos/index";

const NOW = new Date("2026-10-14T12:00:00Z");

function observation(
  overrides: Partial<ClinicalObservation> = {}
): ClinicalObservation {
  return {
    id: "obs-1",
    field: "Weight",
    rawValue: "180 lbs",
    correctedValue: "81.6 kg",
    currentValue: "81.6 kg",
    destination: "VS",
    errorType: "unit-error",
    isResolved: true,
    ...overrides,
  };
}

function subject(
  id: number,
  observations: ClinicalObservation[]
): ClinicalSubject {
  return {
    id: `s-${id}`,
    subjectLabel: `SUBJ-${1000 + id}`,
    studySite: "Site 014",
    observations,
    status: "submitted",
    timeRemaining: 30,
    maxTime: 30,
    createdAt: 0,
  };
}

function records(count: number): InspectionRecord[] {
  return Array.from({ length: count }, (_, i) =>
    createInspectionRecord(
      subject(i, [
        observation({ id: `obs-${i}`, rawValue: `${170 + i} lbs` }),
        observation({
          id: `clean-${i}`,
          field: "Sex",
          rawValue: "F",
          currentValue: "F",
          correctedValue: undefined,
          errorType: undefined,
          destination: "DM",
        }),
      ]),
      i % 2 === 0 ? "VS" : "DM",
      i % 3 === 0
        ? { method: "routine", reason: "Intent to Submit", signatures: 0 }
        : { method: "signed", reason: "Author Verification", signatures: 1 }
    )
  );
}

const skeleton = (
  severity: SponsorSkeleton["severity"],
  id = "skel"
): SponsorSkeleton => ({
  id,
  category: "Data Integrity",
  severity,
  description: `Shortcut ${id}`,
  regulation: "21 CFR § 11.10(e) - Audit trail of operator actions",
});

function round(
  recs: InspectionRecord[],
  skeletons: SponsorSkeleton[] = [],
  seed = getInspectionSeed(recs)
): InspectionRound {
  return createInspectionRound(recs, skeletons, createSeededRandom(seed));
}

/** Answers every question with the first option matching `pick`, else the first option. */
function play(
  start: InspectionRound,
  pick: (outcomes: InspectionOptionOutcome[]) => InspectionOptionOutcome | null
): InspectionRound {
  let r = start;
  while (!isInspectionComplete(r)) {
    const q = getCurrentInspectionQuestion(r)!;
    const want = pick(q.options.map((o) => o.outcome));
    const option =
      want === null ? null : q.options.find((o) => o.outcome === want)!;
    r = advanceInspection(answerInspectionQuestion(r, option?.id ?? null));
  }
  return r;
}

const honest = (outcomes: InspectionOptionOutcome[]) =>
  outcomes.includes("correct") ? "correct" : "disclosed";

describe("inspection records", () => {
  it("records only the values the player corrected", () => {
    const [record] = records(1);
    expect(record.corrections).toEqual([
      {
        field: "Weight",
        from: "170 lbs",
        to: "81.6 kg",
        errorType: "unit-error",
      },
    ]);
    expect(record.station).toBe("VS");
    expect(record.signature.method).toBe("routine");
  });

  it("is exported through both public entry points", () => {
    expect(folderIndex.createInspectionRound).toBe(createInspectionRound);
  });
});

describe("createInspectionRound", () => {
  it("pulls 4 to 6 records from the run and asks only about them", () => {
    const recs = records(12);
    const labels = new Set(recs.map((r) => r.subjectLabel));
    for (let seed = 0; seed < 40; seed++) {
      const r = round(recs, [], seed);
      expect(r.questions.length).toBeGreaterThanOrEqual(INSPECTION_MIN_RECORDS);
      expect(r.questions.length).toBeLessThanOrEqual(INSPECTION_MAX_RECORDS);
      const asked = r.questions.map((q) => q.subjectLabel!);
      expect(new Set(asked).size).toBe(asked.length);
      asked.forEach((label) => expect(labels.has(label)).toBe(true));
    }
  });

  it("asks fewer questions only when fewer CRFs locked", () => {
    expect(round(records(2)).questions).toHaveLength(2);
  });

  it("adds no skeleton questions without skeletons and one per skeleton", () => {
    const recs = records(12);
    const none = round(recs);
    expect(none.questions.some((q) => q.kind === "skeleton")).toBe(false);

    const two = round(recs, [skeleton("Major", "a"), skeleton("Minor", "b")]);
    const asked = two.questions.filter((q) => q.kind === "skeleton");
    expect(asked).toHaveLength(2);
    expect(asked.map((q) => q.skeletonIndex)).toEqual([0, 1]);
    expect(asked[0].timeLimitSeconds).toBe(INSPECTION_SKELETON_SECONDS);
    expect(two.questions.length).toBe(none.questions.length + 2);
  });

  it("is repeatable for the same seed", () => {
    const recs = records(12);
    expect(round(recs, [skeleton("Major")])).toEqual(
      round(recs, [skeleton("Major")])
    );
  });

  it("gives every question exactly one right answer drawn from the record", () => {
    const recs = records(12);
    for (let seed = 0; seed < 30; seed++) {
      const r = round(recs, [skeleton("Critical")], 1000 + seed);
      for (const q of r.questions) {
        const right = q.options.filter(
          (o) => o.outcome === "correct" || o.outcome === "disclosed"
        );
        expect(right).toHaveLength(1);
        expect(new Set(q.options.map((o) => o.label)).size).toBe(
          q.options.length
        );
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        const record = recs.find((x) => x.subjectLabel === q.subjectLabel);
        if (q.kind === "station") {
          expect(right[0].label.startsWith(record!.station)).toBe(true);
        }
        if (q.kind === "correction") {
          expect(right[0].label).toContain(record!.corrections[0].from);
        }
        if (q.kind === "signature") {
          expect(right[0].label).toMatch(
            record!.signature.method === "routine"
              ? /routine dispatch/
              : /Author Verification/
          );
        }
      }
    }
  });

  it("only asks a correction question about a CRF with a correction", () => {
    const clean = createInspectionRecord(
      subject(1, [
        observation({
          correctedValue: undefined,
          currentValue: "180 lbs",
        }),
      ]),
      "VS",
      { method: "signed", reason: "Intent to Submit", signatures: 2 }
    );
    expect(clean.corrections).toHaveLength(0);
    for (let seed = 0; seed < 20; seed++) {
      const r = round([clean, clean, clean, clean], [], 2000 + seed);
      expect(r.questions.every((q) => q.kind !== "correction")).toBe(true);
    }
  });
});

describe("answering and the timer", () => {
  const start = () => round(records(8), [skeleton("Major")]);

  it("records an answer, waits, then moves to the next question", () => {
    const r0 = start();
    const q = getCurrentInspectionQuestion(r0)!;
    const r1 = answerInspectionQuestion(r0, q.options[0].id);
    expect(r1.awaitingNext).toBe(true);
    expect(r1.answers).toHaveLength(1);
    // A second answer while waiting is ignored, as is an unknown option.
    expect(answerInspectionQuestion(r1, q.options[1].id)).toBe(r1);
    expect(answerInspectionQuestion(r0, "nope")).toBe(r0);
    const r2 = advanceInspection(r1);
    expect(r2.current).toBe(1);
    expect(r2.awaitingNext).toBe(false);
    expect(r2.timeRemaining).toBe(r2.questions[1].timeLimitSeconds);
    expect(advanceInspection(r2)).toBe(r2);
  });

  it("times a question out as unanswered", () => {
    const r0 = start();
    expect(r0.timeRemaining).toBe(INSPECTION_RECORD_SECONDS);
    const r1 = tickInspectionTimer(r0, 10);
    expect(r1.timeRemaining).toBe(INSPECTION_RECORD_SECONDS - 10);
    const r2 = tickInspectionTimer(r1, 10);
    expect(r2.awaitingNext).toBe(true);
    expect(r2.answers[0]).toMatchObject({
      optionId: null,
      outcome: "unanswered",
    });
    expect(tickInspectionTimer(r2, 5)).toBe(r2);
    expect(tickInspectionTimer(r0, 0)).toBe(r0);
  });

  it("can extend the timer or turn it off (WCAG 2.2.1)", () => {
    const r0 = start();
    expect(extendInspectionTimer(r0).timeRemaining).toBe(
      INSPECTION_RECORD_SECONDS + INSPECTION_EXTENSION_SECONDS
    );
    const off = setInspectionTimerEnabled(r0, false);
    expect(tickInspectionTimer(off, 999)).toBe(off);
    const answered = answerInspectionQuestion(r0, null);
    expect(extendInspectionTimer(answered)).toBe(answered);
  });

  it("finishes after the last question", () => {
    const done = play(start(), honest);
    expect(isInspectionComplete(done)).toBe(true);
    expect(getCurrentInspectionQuestion(done)).toBeNull();
    expect(answerInspectionQuestion(done, null)).toBe(done);
    expect(tickInspectionTimer(done, 1)).toBe(done);
    expect(extendInspectionTimer(done)).toBe(done);
  });
});

describe("the inspection in the report", () => {
  const cleanScore = {
    ...createInitialScoreState(),
    subjectsSubmitted: 12,
    cleanSubmissions: 12,
  };
  const auditor = createInitialAuditorState();
  const recs = records(12);

  const report = (r: InspectionRound, skeletons: SponsorSkeleton[]) =>
    buildInspectionReport(cleanScore, auditor, [], [], null, skeletons, {
      inspection: r,
      now: NOW,
    });

  it("gives the same report for the same run state and answers", () => {
    const skeletons = [skeleton("Major")];
    const a = report(play(round(recs, skeletons), honest), skeletons);
    const b = report(play(round(recs, skeletons), honest), skeletons);
    expect(a).toEqual(b);
    expect(a.runId).toBe(`BIMO-${NOW.getTime().toString(36).toUpperCase()}`);
  });

  it("keeps NAI for a clean run answered from the record", () => {
    const r = report(play(round(recs), honest), []);
    expect(r.verdict).toMatch(/^NAI/);
    expect(r.inspection).toMatchObject({ clean: true, skeletonQuestions: 0 });
    expect(r.overallScore).toBe(
      generateBIMOReport(cleanScore, auditor, [], [], null, NOW).overallScore
    );
  });

  it("drops to VAI on a missed record question and adds a Major finding at three", () => {
    const misses = (n: number) => {
      let missed = 0;
      return play(round(recs), (outcomes) => {
        if (missed < n) {
          missed++;
          return "wrong";
        }
        return honest(outcomes);
      });
    };
    const one = report(misses(1), []);
    expect(one.verdict).toMatch(/^VAI/);
    expect(
      one.findings.filter((f) => f.id.startsWith("FND-INSP"))
    ).toHaveLength(1);
    expect(one.inspection?.clean).toBe(false);

    const two = report(misses(2), []);
    expect(two.findings.some((f) => f.id === "FND-INSP-TRAIL")).toBe(false);

    const three = report(misses(3), []);
    expect(three.verdict).toMatch(/^VAI/);
    const trail = three.findings.find((f) => f.id === "FND-INSP-TRAIL");
    expect(trail?.severity).toBe("Major");
    expect(trail?.description).toMatch(/^Audit trail incomplete/);
    expect(three.overallScore).toBe(
      one.overallScore - 2 * INSPECTION_MISS_PENALTY
    );
  });

  it("lowers a disclosed skeleton's penalty and severity", () => {
    const skeletons = [skeleton("Critical")];
    const silent = buildInspectionReport(
      cleanScore,
      auditor,
      [],
      [],
      null,
      skeletons,
      { now: NOW }
    );
    const disclosed = report(play(round(recs, skeletons), honest), skeletons);
    expect(silent.verdict).toMatch(/^OAI/);
    expect(disclosed.verdict).toMatch(/^VAI/);
    expect(disclosed.overallScore).toBeGreaterThan(silent.overallScore);
    expect(
      disclosed.findings.find((f) => f.id === "FND-SPONSOR-1")?.severity
    ).toBe("Major");
    expect(disclosed.inspection).toMatchObject({
      skeletonsDisclosed: 1,
      clean: true,
    });
  });

  it("escalates an evaded skeleton and keeps a misidentified one", () => {
    const skeletons = [skeleton("Major", "a"), skeleton("Minor", "b")];
    let skeletonAnswers = 0;
    const r = play(round(recs, skeletons), (outcomes) => {
      if (outcomes.includes("correct")) return "correct";
      skeletonAnswers++;
      return skeletonAnswers === 1 ? "evasive" : "misidentified";
    });
    expect(getSkeletonDispositions(r, 2)).toEqual(["evasive", "misidentified"]);
    const out = report(r, skeletons);
    const sponsor = out.findings.filter((f) => f.id.startsWith("FND-SPONSOR"));
    expect(sponsor.map((f) => f.severity)).toEqual(["Critical", "Minor"]);
    expect(out.verdict).toMatch(/^OAI/);
    expect(summarizeInspection(r).clean).toBe(false);
  });

  it("counts a timed-out skeleton as unanswered at full penalty", () => {
    const skeletons = [skeleton("Major")];
    const r = play(round(recs, skeletons), (outcomes) =>
      outcomes.includes("correct") ? "correct" : null
    );
    expect(getSkeletonDispositions(r, 1)).toEqual(["unanswered"]);
    const withAnswers = report(r, skeletons);
    const plain = buildInspectionReport(
      cleanScore,
      auditor,
      [],
      [],
      null,
      skeletons,
      { now: NOW }
    );
    expect(withAnswers.overallScore).toBe(plain.overallScore);
  });

  describe("skeletons already charged in Phases 1-2", () => {
    const earlier = [skeleton("Critical", "p1"), skeleton("Major", "p2")];
    const charged = (pick: InspectionOptionOutcome) => {
      const r = play(round(recs, earlier), (outcomes) =>
        outcomes.includes("correct") ? "correct" : pick
      );
      return buildInspectionReport(cleanScore, auditor, [], [], null, earlier, {
        inspection: r,
        now: NOW,
        chargedSkeletons: earlier.length,
      });
    };
    const base = generateBIMOReport(cleanScore, auditor, [], [], null, NOW);
    const sponsorFindings = (r: ReturnType<typeof charged>) =>
      r.findings.filter((f) => f.id.startsWith("FND-SPONSOR"));

    it("adds nothing more when disclosed", () => {
      const r = charged("disclosed");
      expect(sponsorFindings(r)).toHaveLength(0);
      expect(r.overallScore).toBe(base.overallScore);
      expect(r.verdict).toMatch(/^NAI/);
      expect(r.inspection?.clean).toBe(true);
    });

    it("adds a Minor finding for a wrong regulation or no answer", () => {
      for (const pick of ["misidentified", null] as const) {
        const r = play(round(recs, earlier), (outcomes) =>
          outcomes.includes("correct") ? "correct" : pick
        );
        const out = buildInspectionReport(
          cleanScore,
          auditor,
          [],
          [],
          null,
          earlier,
          { inspection: r, now: NOW, chargedSkeletons: earlier.length }
        );
        expect(sponsorFindings(out).map((f) => f.severity)).toEqual([
          "Minor",
          "Minor",
        ]);
        expect(out.verdict).toMatch(/^VAI/);
        expect(out.overallScore).toBe(base.overallScore - 8);
      }
    });

    it("adds a Major finding for a denial, never a second Critical", () => {
      const r = charged("evasive");
      expect(sponsorFindings(r).map((f) => f.severity)).toEqual([
        "Major",
        "Major",
      ]);
      expect(r.verdict).toMatch(/^VAI/);
      expect(r.overallScore).toBe(base.overallScore - 20);
    });

    it("keeps the full rules for Phase 3 skeletons alongside them", () => {
      const all = [...earlier, skeleton("Critical", "p3")];
      const r = play(round(recs, all), (outcomes) =>
        outcomes.includes("correct") ? "correct" : "evasive"
      );
      const out = buildInspectionReport(
        cleanScore,
        auditor,
        [],
        [],
        null,
        all,
        {
          inspection: r,
          now: NOW,
          chargedSkeletons: earlier.length,
        }
      );
      expect(sponsorFindings(out).map((f) => f.severity)).toEqual([
        "Major",
        "Major",
        "Critical",
      ]);
      expect(out.verdict).toMatch(/^OAI/);
    });
  });

  it("leaves the report alone when there is nothing to apply", () => {
    const base = generateBIMOReport(cleanScore, auditor, [], [], null, NOW);
    expect(applySponsorSkeletonsToReport(base, [])).toBe(base);
    const empty = createInspectionRound([], [], createSeededRandom(1));
    expect(isInspectionComplete(empty)).toBe(true);
    expect(applyInspectionToReport(base, empty).verdict).toBe(base.verdict);
  });
});
