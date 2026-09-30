import { describe, it, expect } from "vitest";
import {
  MOCK_OBSERVATION_TEMPLATES,
  SEEDED_SCENARIOS,
  createInitialAuditorState,
  createInitialScoreState,
  generateBIMOReport,
  validateObservationChoice,
  type ClinicalObservation,
  type RecordedRuleViolation,
} from "@/lib/clinical-trial-chaos";

const wrongPick = (idx: number): RecordedRuleViolation => ({
  id: `viol_${idx}`,
  type: "cdisc_conformance",
  subjectLabel: "SUBJ-1001",
  field: "Height",
  selectedChoice: "1.80 m",
  message: "Invalid regulatory code",
  domain: "DM",
  timestamp: "2026-09-30T00:00:00.000Z",
});

// #1553: the report showed a 100% clean rate with nothing submitted, and a
// compliance score that ignored the wrong fixes it listed as findings.
describe("generateBIMOReport numbers (#1553)", () => {
  it("reports no clean rate when no CRFs were submitted", () => {
    const report = generateBIMOReport(
      createInitialScoreState(),
      createInitialAuditorState(),
      []
    );
    expect(report.submittedCRFs).toBe(0);
    expect(report.cleanRate).toBeNull();
    expect(report.complianceRate).toBeNull();
    expect(report.findings.some((f) => f.id === "FND-003")).toBe(false);
  });

  it("still reports the clean rate once CRFs were submitted", () => {
    const report = generateBIMOReport(
      {
        ...createInitialScoreState(),
        subjectsSubmitted: 4,
        cleanSubmissions: 3,
      },
      createInitialAuditorState(),
      []
    );
    expect(report.cleanRate).toBe(75);
    expect(report.complianceRate).toBe(75);
  });

  it("charges the compliance score for the wrong fixes the report lists", () => {
    const auditor = createInitialAuditorState();
    const clean = generateBIMOReport(createInitialScoreState(), auditor, []);
    const oneWrong = generateBIMOReport(
      createInitialScoreState(),
      auditor,
      [],
      [wrongPick(1)]
    );
    const manyWrong = generateBIMOReport(
      createInitialScoreState(),
      auditor,
      [],
      Array.from({ length: 13 }, (_, i) => wrongPick(i))
    );

    expect(oneWrong.findings).toHaveLength(1);
    expect(oneWrong.overallScore).toBeLessThan(clean.overallScore);
    expect(oneWrong.overallScore).toBe(clean.overallScore - 15);
    // The violation penalty keeps its 60-point cap.
    expect(manyWrong.overallScore).toBe(clean.overallScore - 60);
  });

  it("reproduces the playtest: 13 wrong picks at full suspicion no longer score 70/100", () => {
    const report = generateBIMOReport(
      createInitialScoreState(),
      { ...createInitialAuditorState(), suspicion: 100 },
      [],
      Array.from({ length: 13 }, (_, i) => wrongPick(i))
    );
    expect(report.verdict).toContain("OAI");
    expect(report.cleanRate).toBeNull();
    expect(report.overallScore).toBe(10);
  });

  it("counts audit and rule violations together", () => {
    const report = generateBIMOReport(
      { ...createInitialScoreState(), auditViolations: 1 },
      createInitialAuditorState(),
      [],
      [wrongPick(1)]
    );
    expect(report.overallScore).toBe(70);
  });

  it("does not repeat a phrase in the VAI summary", () => {
    const report = generateBIMOReport(
      createInitialScoreState(),
      { ...createInitialAuditorState(), suspicion: 40 },
      []
    );
    expect(report.verdict).toContain("VAI");
    expect(report.summary).toContain(
      "corrective and preventive action (CAPA) plans for Controlled Terminology validation."
    );
    expect(report.summary).not.toContain("Corrective Action plans for");
  });
});

// #1554: "13/25/1990" accepted only 1990-12-25, which no reading of the raw
// value produces.
describe("Date of Birth fix puzzle (#1554)", () => {
  const dobTemplate = MOCK_OBSERVATION_TEMPLATES.find(
    (t) => t.field === "Date of Birth"
  );
  const seededDob = SEEDED_SCENARIOS.flatMap((s) => s.observations).filter(
    (o) => o.field === "Date of Birth"
  );

  const asObservation = (
    c: NonNullable<typeof dobTemplate>["corruptions"][number]
  ): ClinicalObservation => ({
    id: `dob-${c.rawValue}`,
    field: "Date of Birth",
    rawValue: c.rawValue,
    correctedValue: c.correctedValue,
    currentValue: c.rawValue,
    destination: "DM",
    errorType: c.errorType,
    hint: c.hint,
    explanation: c.explanation,
    options: c.options,
    isResolved: false,
  });

  const observations = [
    ...(dobTemplate?.corruptions ?? []).map(asObservation),
    ...seededDob,
  ];

  it("no longer offers the unsolvable 13/25/1990 entry", () => {
    expect(observations.length).toBeGreaterThan(0);
    for (const obs of observations) {
      expect(obs.rawValue).not.toBe("13/25/1990");
    }
  });

  it("accepts exactly one option, and it is the raw date in ISO 8601 order", () => {
    const usDates = observations.filter((o) =>
      /^\d{2}\/\d{2}\/\d{4}$/.test(o.rawValue)
    );
    expect(usDates.length).toBeGreaterThan(0);
    for (const obs of usDates) {
      const [mm, dd, yyyy] = obs.rawValue.split("/");
      const iso = `${yyyy}-${mm}-${dd}`;
      expect(obs.correctedValue).toBe(iso);
      expect(obs.hint).toContain("ISO 8601 YYYY-MM-DD");

      const accepted = (obs.options ?? []).filter(
        (opt) => validateObservationChoice(obs, opt).isValid
      );
      expect(accepted).toEqual([iso]);
    }
  });

  it("uses the same hint wherever the puzzle appears", () => {
    const hints = new Set(
      observations
        .filter((o) => o.correctedValue === "1990-12-25")
        .map((o) => o.hint)
    );
    expect(hints.size).toBe(1);
  });
});

// #1670: expired subjects were worded as "submitted with unresolved raw data",
// could outnumber the CRFs processed, and sat beside a 100% clean rate.
describe("generateBIMOReport with expired subjects (#1670)", () => {
  const phase1 = {
    ...createInitialScoreState(),
    subjectsSubmitted: 5,
    cleanSubmissions: 5,
    auditViolations: 4,
    expiredSubjects: 4,
  };

  it("reports a phase with expiries and no bad submissions as expiries", () => {
    const report = generateBIMOReport(phase1, createInitialAuditorState(), []);
    expect(report.submittedCRFs).toBe(5);
    expect(report.cleanRate).toBe(100);
    // The expired count sits beside the clean rate, so the two cannot
    // contradict each other.
    expect(report.expiredCRFs).toBe(4);
    expect(report.findings.map((f) => f.description)).toEqual([
      "4 subjects expired on the conveyor before source data verification.",
    ]);
    expect(report.findings.some((f) => f.id === "FND-001")).toBe(false);
  });

  it("never counts more submitted CRFs than were processed", () => {
    const report = generateBIMOReport(
      {
        ...createInitialScoreState(),
        subjectsSubmitted: 8,
        cleanSubmissions: 8,
        auditViolations: 12,
        expiredSubjects: 12,
      },
      { ...createInitialAuditorState(), suspicion: 100 },
      []
    );
    for (const finding of report.findings) {
      const submitted = finding.description.match(/(\d+) .*submitted/);
      if (submitted) {
        expect(Number(submitted[1])).toBeLessThanOrEqual(report.submittedCRFs);
      }
    }
    expect(report.expiredCRFs).toBe(12);
  });

  it("names misrouted CRFs separately from expired ones", () => {
    const report = generateBIMOReport(
      { ...phase1, auditViolations: 5 },
      createInitialAuditorState(),
      [],
      [wrongPick(1)]
    );
    const text = report.findings.map((f) => f.description).join("\n");
    expect(text).toContain(
      "1 Case Report Form was rejected at an EDC station that does not match its domain."
    );
    expect(text).toContain(
      "4 subjects expired on the conveyor before source data verification."
    );
  });

  it("keeps the verdict rules unchanged (#899)", () => {
    // Four violations still meet the Form 483 threshold, whatever their kind.
    expect(
      generateBIMOReport(phase1, createInitialAuditorState(), []).verdict
    ).toMatch(/^OAI/);
    // Two expiries alone stay voluntary action.
    expect(
      generateBIMOReport(
        { ...phase1, auditViolations: 2, expiredSubjects: 2 },
        createInitialAuditorState(),
        []
      ).verdict
    ).toMatch(/^VAI/);
  });
});
