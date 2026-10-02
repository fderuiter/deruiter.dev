// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  adjustAuditorSuspicion,
  appendRuleViolation,
  applyCorrectionScore,
  applySubmissionScore,
  autoCleanSubject,
  breakCombo,
  buildInspectionReport,
  canActivatePowerUp,
  ClinicalTrialChaosEngine,
  createInitialAuditorState,
  createInitialPowerUpInventory,
  createInitialScoreState,
  createRuleViolation,
  describePowerUpRefusal,
  describeSponsorEvent,
  endCoffeeBreak,
  extendSubjectDeadlines,
  formatNextDossierCue,
  getAmendmentIntervalSeconds,
  getComboMultiplier,
  getFastTrackDomain,
  getNextShiftScoreState,
  getPhaseLockTarget,
  getPhaseProgress,
  getPowerUpRefusal,
  getSAEChance,
  getStationsForPhase,
  getSubjectErrorChance,
  getShiftTickSeconds,
  getSubmissionCharge,
  getViolationBreakdown,
  isPhaseCleared,
  isShiftClockHalted,
  PHASE_TARGETS,
  raiseAuditorSuspicion,
  recordStationSubmission,
  replaceObservation,
  scoreSubmission,
  selectNextDossier,
  settleSubmission,
  SHIFT_END_LOGS,
  spendPowerUp,
  startCoffeeBreak,
  tickShiftClocks,
} from "@/lib/clinical-trial-chaos";
import type {
  ClinicalObservation,
  ClinicalSubject,
  PowerUpInventory,
  ProtocolAmendment,
  SponsorRequest,
} from "@/lib/clinical-trial-chaos";

// #901: the component and ClinicalTrialChaosEngine share these rules, so
// they are covered here as plain functions, without a DOM.

function observation(
  overrides: Partial<ClinicalObservation> = {}
): ClinicalObservation {
  return {
    id: "obs-1",
    field: "Weight",
    rawValue: "154 lbs",
    currentValue: "154 lbs",
    correctedValue: "70 kg",
    destination: "VS",
    isResolved: false,
    ...overrides,
  };
}

function subject(overrides: Partial<ClinicalSubject> = {}): ClinicalSubject {
  return {
    id: "subj-1",
    subjectLabel: "SUBJ-1001",
    studySite: "Site 001",
    observations: [observation()],
    status: "queued",
    timeRemaining: 30,
    maxTime: 60,
    createdAt: 1,
    ...overrides,
  };
}

function amendment(timeRemaining: number): ProtocolAmendment {
  return {
    id: "amd-1",
    version: "Protocol v3.2.1",
    title: "Station Scramble",
    description: "",
    type: "station-scramble",
    durationSeconds: 20,
    timeRemaining,
    active: true,
  };
}

function charged(inventory: PowerUpInventory): PowerUpInventory {
  const next = { ...inventory };
  for (const key of Object.keys(next) as (keyof PowerUpInventory)[]) {
    next[key] = { ...next[key], charge: next[key].maxCharge };
  }
  return next;
}

describe("auditor and combo rules", () => {
  it("steps the multiplier every three combos and caps it at 4x", () => {
    expect([0, 2, 3, 5, 6, 9, 30].map(getComboMultiplier)).toEqual([
      1, 1, 2, 2, 3, 4, 4,
    ]);
  });

  it("raises suspicion to a cap of 100 and writes a 483 there", () => {
    const auditor = { ...createInitialAuditorState(), suspicion: 70 };
    expect(raiseAuditorSuspicion(auditor, 20)).toMatchObject({
      suspicion: 90,
      behavior: "suspicious",
    });
    expect(raiseAuditorSuspicion(auditor, 45)).toMatchObject({
      suspicion: 100,
      behavior: "issuing_483",
    });
    expect(auditor.suspicion).toBe(70);
  });

  it("cools suspicion without going below zero or changing behavior", () => {
    const auditor = {
      ...createInitialAuditorState(),
      suspicion: 3,
      behavior: "inspecting" as const,
    };
    expect(adjustAuditorSuspicion(auditor, -5)).toMatchObject({
      suspicion: 0,
      behavior: "inspecting",
    });
  });

  it("breaks the combo and counts each failure as a violation", () => {
    const score = {
      ...createInitialScoreState(),
      combo: 5,
      multiplier: 2,
      auditViolations: 1,
    };
    expect(breakCombo(score)).toMatchObject({
      combo: 0,
      multiplier: 1,
      auditViolations: 2,
    });
    expect(breakCombo(score, 3).auditViolations).toBe(4);
  });
});

describe("observation corrections", () => {
  it("credits a correct fix", () => {
    const score = applyCorrectionScore(createInitialScoreState(), 120);
    expect(score).toMatchObject({ score: 120, correctionsMade: 1 });
  });

  it("replaces one observation on one subject without mutating the queue", () => {
    const queue = [subject(), subject({ id: "subj-2" })];
    const fixed = observation({ currentValue: "70 kg", isResolved: true });
    const next = replaceObservation(queue, "subj-1", fixed);
    expect(next[0].observations[0]).toBe(fixed);
    expect(next[1]).toBe(queue[1]);
    expect(queue[0].observations[0].isResolved).toBe(false);
  });

  it("builds a deterministic violation record from an injected clock", () => {
    const violation = createRuleViolation(
      observation(),
      "154 kg",
      { explanation: "Wrong unit", ruleName: "Weight unit" },
      "SUBJ-1001",
      Date.UTC(2026, 8, 30),
      () => 0.5
    );
    expect(violation).toEqual({
      id: `viol_${Date.UTC(2026, 8, 30)}_i`,
      type: "cdisc_conformance",
      subjectLabel: "SUBJ-1001",
      field: "Weight",
      selectedChoice: "154 kg",
      ruleName: "Weight unit",
      message: "Wrong unit",
      domain: "VS",
      timestamp: "2026-09-30T00:00:00.000Z",
    });
  });

  it("appends a violation to a new array so it is recorded once (#1553)", () => {
    const first = createRuleViolation(
      observation(),
      "a",
      { explanation: "x" },
      "SUBJ-1001",
      1,
      () => 0.1
    );
    const recorded = [first];
    const next = appendRuleViolation(recorded, first);
    expect(next).toHaveLength(2);
    expect(recorded).toHaveLength(1);
    expect(next).not.toBe(recorded);
  });
});

describe("submission scoring", () => {
  const cleanSubject = subject({
    observations: [observation({ isResolved: true })],
    timeRemaining: 30,
    maxTime: 60,
  });

  it("scores with the multiplier held going in, then grows the combo", () => {
    const score = { ...createInitialScoreState(), combo: 2, multiplier: 1 };
    // 200 base + 60 per observation + 60 speed + 150 clean = 470
    expect(scoreSubmission(score, cleanSubject, true)).toEqual({
      points: 470,
      combo: 3,
      multiplier: 2,
    });
    const doubled = { ...score, multiplier: 2 };
    expect(scoreSubmission(doubled, cleanSubject, true).points).toBe(940);
  });

  it("lets the caller adjust the points, as the office does", () => {
    const submission = scoreSubmission(
      createInitialScoreState(),
      cleanSubject,
      true,
      (points) => points * 10
    );
    expect(submission.points).toBe(4700);
  });

  it("applies a submission to the score and its tallies", () => {
    const before = {
      ...createInitialScoreState(),
      score: 1000,
      highScore: 1200,
      maxCombo: 7,
      subjectsSubmitted: 4,
      cleanSubmissions: 2,
    };
    const submission = { points: 300, combo: 1, multiplier: 1 };
    expect(applySubmissionScore(before, submission, true)).toMatchObject({
      score: 1300,
      highScore: 1300,
      combo: 1,
      maxCombo: 7,
      multiplier: 1,
      subjectsSubmitted: 5,
      cleanSubmissions: 3,
    });
    expect(
      applySubmissionScore(before, { ...submission, points: 100 }, false)
    ).toMatchObject({ highScore: 1200, cleanSubmissions: 2 });
  });

  it("charges lifelines double for a clean submission", () => {
    expect(getSubmissionCharge(true)).toBe(2);
    expect(getSubmissionCharge(false)).toBe(1);
  });

  it("counts the CRF at its station only", () => {
    const stations = getStationsForPhase(1, "campaign");
    const next = recordStationSubmission(stations, stations[0].id);
    expect(next[0].processedCount).toBe(stations[0].processedCount + 1);
    expect(next.slice(1)).toEqual(stations.slice(1));
  });
});

describe("phase completion", () => {
  it("clears a campaign phase on the submission that reaches its target", () => {
    expect(isPhaseCleared("campaign", 1, PHASE_TARGETS[1] - 2)).toBe(false);
    expect(isPhaseCleared("campaign", 1, PHASE_TARGETS[1] - 1)).toBe(true);
    expect(isPhaseCleared("campaign", 3, PHASE_TARGETS[3] - 1)).toBe(true);
  });

  it("never clears a phase in endless mode", () => {
    expect(isPhaseCleared("endless", 1, 1000)).toBe(false);
  });

  it("loads the most urgent other dossier, or none once the phase clears", () => {
    const submitted = subject({ id: "done", isSAE: true, timeRemaining: 1 });
    const calm = subject({ id: "calm", timeRemaining: 40 });
    const urgent = subject({ id: "urgent", timeRemaining: 5 });
    const queue = [submitted, calm, urgent];
    expect(selectNextDossier(queue, "done", false)?.id).toBe("urgent");
    expect(selectNextDossier(queue, "done", true)).toBeNull();
    expect(selectNextDossier([submitted], "done", false)).toBeNull();
  });

  it("names SAE dossiers in the next-dossier cue", () => {
    expect(formatNextDossierCue(subject({ isSAE: true }))).toBe(
      "Next dossier loaded: SUBJ-1001 (SAE)"
    );
    expect(formatNextDossierCue(subject())).toBe(
      "Next dossier loaded: SUBJ-1001"
    );
  });

  it("reports no clean rate when nothing was submitted (#1553)", () => {
    const report = buildInspectionReport(
      createInitialScoreState(),
      createInitialAuditorState(),
      [],
      [],
      null,
      []
    );
    expect(report.cleanRate).toBeNull();
    expect(report.complianceRate).toBeNull();
  });

  it("grades a phase clear on the tallies after the final submission (#1609)", () => {
    const clean = (id: string) =>
      subject({ id, observations: [observation({ isResolved: true })] });
    let score = createInitialScoreState();
    let outcome = settleSubmission(score, clean("s-0"), true, "campaign", 1);
    for (let i = 1; i < PHASE_TARGETS[1]; i++) {
      expect(outcome.phaseCleared).toBe(false);
      score = outcome.scoreState;
      outcome = settleSubmission(score, clean(`s-${i}`), true, "campaign", 1);
    }

    expect(outcome.phaseCleared).toBe(true);
    expect(outcome.scoreState).toMatchObject({
      subjectsSubmitted: PHASE_TARGETS[1],
      cleanSubmissions: PHASE_TARGETS[1],
    });
    const report = buildInspectionReport(
      outcome.scoreState,
      createInitialAuditorState(),
      [],
      [],
      null,
      []
    );
    expect(report.cleanRate).toBe(100);
  });

  it("settles a submission exactly as scoreSubmission and applySubmissionScore do", () => {
    const score = {
      ...createInitialScoreState(),
      combo: 2,
      subjectsSubmitted: 3,
    };
    const dirty = subject();
    const adjust = (points: number) => points * 2;
    const submission = scoreSubmission(score, dirty, false, adjust);
    expect(settleSubmission(score, dirty, false, "endless", 1, adjust)).toEqual(
      {
        submission,
        scoreState: applySubmissionScore(score, submission, false),
        phaseCleared: false,
      }
    );
  });

  it("adds the sponsor's skeletons to the inspection report", () => {
    const score = {
      ...createInitialScoreState(),
      subjectsSubmitted: 5,
      cleanSubmissions: 5,
    };
    const auditor = createInitialAuditorState();
    const plain = buildInspectionReport(score, auditor, [], [], null, []);
    const withSkeleton = buildInspectionReport(score, auditor, [], [], null, [
      {
        id: "sk-1",
        category: "Data Integrity",
        severity: "Critical",
        description: "Backdated a signature",
        regulation: "21 CFR 11.50",
      },
    ]);
    expect(plain.cleanRate).toBe(100);
    expect(withSkeleton.findings.length).toBe(plain.findings.length + 1);
    expect(withSkeleton.verdict).toMatch(/^OAI/);
  });
});

describe("lifelines", () => {
  const inventory = charged(createInitialPowerUpInventory());

  it("fires only when charged, running and, if needed, with a dossier open", () => {
    const empty = createInitialPowerUpInventory();
    expect(canActivatePowerUp(empty, "fda-coffee-break", true, subject())).toBe(
      false
    );
    expect(
      canActivatePowerUp(inventory, "fda-coffee-break", false, subject())
    ).toBe(false);
    expect(canActivatePowerUp(inventory, "fda-coffee-break", true, null)).toBe(
      true
    );
    expect(canActivatePowerUp(inventory, "query-extension", true, null)).toBe(
      true
    );
    expect(canActivatePowerUp(inventory, "auto-clean", true, null)).toBe(false);
    expect(canActivatePowerUp(inventory, "fast-sign", true, null)).toBe(false);
    expect(canActivatePowerUp(inventory, "fast-sign", true, subject())).toBe(
      true
    );
  });

  it("empties the fired lifeline and starts its duration", () => {
    const next = spendPowerUp(inventory, "fda-coffee-break");
    expect(next["fda-coffee-break"]).toMatchObject({
      charge: 0,
      activeSecondsRemaining: 8,
    });
    expect(next["auto-clean"]).toBe(inventory["auto-clean"]);
  });

  it("sends the auditor on a coffee break and brings it back", () => {
    const onBreak = startCoffeeBreak({
      ...createInitialAuditorState(),
      suspicion: 10,
    });
    expect(onBreak).toMatchObject({
      behavior: "coffee_break",
      isPaused: true,
      suspicion: 0,
    });
    expect(endCoffeeBreak(onBreak)).toMatchObject({
      behavior: "patrolling",
      isPaused: false,
    });
  });

  it("resumes patrol even if a wrong fix raised suspicion during the break (#1610)", () => {
    const suspicious = raiseAuditorSuspicion(
      startCoffeeBreak(createInitialAuditorState()),
      10
    );
    expect(endCoffeeBreak(suspicious)).toMatchObject({
      behavior: "patrolling",
      isPaused: false,
      suspicion: 10,
    });
  });

  it("leaves an auditor writing a Form 483 alone", () => {
    const issuing = raiseAuditorSuspicion(
      startCoffeeBreak(createInitialAuditorState()),
      100
    );
    expect(issuing.behavior).toBe("issuing_483");
    expect(endCoffeeBreak(issuing)).toBe(issuing);
  });

  it("extends every deadline by 12 seconds, capped 10 over full time", () => {
    const next = extendSubjectDeadlines([
      subject({ timeRemaining: 5, maxTime: 60 }),
      subject({ timeRemaining: 55, maxTime: 60 }),
    ]);
    expect(next.map((s) => s.timeRemaining)).toEqual([17, 67]);
    expect(
      extendSubjectDeadlines([subject({ timeRemaining: 65, maxTime: 60 })])[0]
        .timeRemaining
    ).toBe(70);
  });

  it("auto-cleans every observation on a subject", () => {
    const cleaned = autoCleanSubject(
      subject({
        observations: [observation(), observation({ id: "obs-2" })],
      })
    );
    expect(cleaned.observations.every((o) => o.isResolved)).toBe(true);
    expect(cleaned.observations[0].currentValue).toBe("70 kg");
  });

  it("fast-tracks to the first station on the floor the subject belongs to", () => {
    // Phase 1 opens DM, VS, AE and LB; MH is not on the floor yet.
    const stations = getStationsForPhase(1, "campaign");
    const routed = subject({
      observations: [
        observation({ destination: "MH" }),
        observation({ id: "obs-2", destination: "LB" }),
      ],
    });
    expect(getFastTrackDomain(routed, stations)).toBe("LB");
    expect(
      getFastTrackDomain(
        subject({ observations: [observation({ destination: "MH" })] }),
        stations
      )
    ).toBe("MH");
    expect(getFastTrackDomain(subject({ observations: [] }), stations)).toBe(
      "DM"
    );
  });
});

describe("tickShiftClocks", () => {
  const clocks = {
    subjects: [subject()],
    auditor: createInitialAuditorState(),
    scoreState: createInitialScoreState(),
    powerUps: createInitialPowerUpInventory(),
    amendment: null,
  };

  it("does nothing observable while paused at zero delta", () => {
    const tick = tickShiftClocks(clocks, 0);
    expect(tick.subjects[0].timeRemaining).toBe(30);
    expect(tick.expired).toEqual([]);
    expect(tick.suspicionMaxed).toBe(false);
    expect(tick.coffeeBreakEnded).toBe(false);
  });

  it("expires overdue subjects, raising suspicion and breaking the combo", () => {
    const tick = tickShiftClocks(
      {
        ...clocks,
        subjects: [
          subject({ id: "a", timeRemaining: 0.05 }),
          subject({ id: "b", timeRemaining: 0.05 }),
          subject({ id: "c", timeRemaining: 30 }),
        ],
        scoreState: { ...createInitialScoreState(), combo: 4, multiplier: 2 },
      },
      0.1
    );
    expect(tick.expired.map((s) => s.id)).toEqual(["a", "b"]);
    expect(tick.subjects.map((s) => s.id)).toEqual(["c"]);
    expect(tick.scoreState).toMatchObject({
      combo: 0,
      multiplier: 1,
      auditViolations: 2,
    });
    // +40 from two expiries, less a little passive decay
    expect(tick.auditor.suspicion).toBeCloseTo(40 - 0.05, 5);
    expect(clocks.subjects[0].timeRemaining).toBe(30);
  });

  it("does not raise suspicion for expiries during a coffee break", () => {
    const tick = tickShiftClocks(
      {
        ...clocks,
        subjects: [subject({ timeRemaining: 0.05 })],
        auditor: startCoffeeBreak(createInitialAuditorState()),
        powerUps: spendPowerUp(
          createInitialPowerUpInventory(),
          "fda-coffee-break"
        ),
      },
      0.1
    );
    expect(tick.expired).toHaveLength(1);
    expect(tick.auditor.suspicion).toBe(0);
    expect(tick.scoreState.auditViolations).toBe(1);
  });

  it("flags a maxed auditor after the patrol step", () => {
    const tick = tickShiftClocks(
      {
        ...clocks,
        subjects: [subject({ timeRemaining: 0.05 })],
        auditor: {
          ...createInitialAuditorState(),
          suspicion: 100,
          suspicionDecayRate: 0,
        },
      },
      0.1
    );
    expect(tick.suspicionMaxed).toBe(true);
  });

  it("ends the coffee break when its duration runs out", () => {
    const powerUps = spendPowerUp(
      createInitialPowerUpInventory(),
      "fda-coffee-break"
    );
    const tick = tickShiftClocks(
      {
        ...clocks,
        auditor: startCoffeeBreak(createInitialAuditorState()),
        powerUps,
      },
      8
    );
    expect(tick.coffeeBreakEnded).toBe(true);
    expect(tick.auditor).toMatchObject({
      behavior: "patrolling",
      isPaused: false,
    });
  });

  it("un-freezes the auditor after a wrong fix during a coffee break (#1610)", () => {
    const powerUps = spendPowerUp(
      createInitialPowerUpInventory(),
      "fda-coffee-break"
    );
    const onBreak = startCoffeeBreak(createInitialAuditorState());
    const afterWrongFix = raiseAuditorSuspicion(onBreak, 10);

    const tick = tickShiftClocks(
      { ...clocks, auditor: afterWrongFix, powerUps },
      9
    );
    expect(tick.coffeeBreakEnded).toBe(true);
    expect(tick.auditor).toMatchObject({
      behavior: "patrolling",
      isPaused: false,
    });

    const patrolled = tickShiftClocks(
      { ...clocks, auditor: tick.auditor, powerUps: tick.powerUps },
      1
    );
    expect(patrolled.auditor.x).not.toBe(tick.auditor.x);
  });

  it("counts an amendment down and concludes it", () => {
    const running = tickShiftClocks(
      { ...clocks, amendment: amendment(5.05) },
      0.1
    );
    expect(running.amendment?.timeRemaining).toBeCloseTo(4.95, 5);
    expect(running.amendmentSecondChanged).toBe(true);
    expect(running.concludedAmendment).toBeNull();

    const same = tickShiftClocks({ ...clocks, amendment: amendment(4.9) }, 0.1);
    expect(same.amendmentSecondChanged).toBe(false);

    const done = tickShiftClocks(
      { ...clocks, amendment: amendment(0.05) },
      0.1
    );
    expect(done.amendment).toBeNull();
    expect(done.concludedAmendment?.id).toBe("amd-1");
  });
});

const PHASES = [1, 2, 3] as const;

describe("phase pacing and shift events", () => {
  it("speeds up amendments and errors in later phases", () => {
    expect(PHASES.map((p) => getAmendmentIntervalSeconds(p))).toEqual([
      40, 28, 20,
    ]);
    expect(PHASES.map((p) => getSubjectErrorChance(p))).toEqual([
      0.45, 0.65, 0.8,
    ]);
    expect(PHASES.map((p) => getSAEChance(p))).toEqual([0.1, 0.3, 0.3]);
  });

  it("logs and sounds each sponsor inbox event", () => {
    const request: SponsorRequest = {
      id: "req-1",
      from: "Dana",
      role: "VP Clinical Ops",
      subject: "Quick favor",
      body: "",
      deadlineSeconds: 30,
      choices: [],
    };
    expect(describeSponsorEvent({ type: "request_arrived", request })).toEqual({
      message:
        '[SPONSOR] 📧 New email from Dana (VP Clinical Ops): "Quick favor"',
      level: "WARN",
      sound: "chute",
    });
    expect(
      describeSponsorEvent({ type: "follow_up", request, subjectLine: "RE:" })
    ).toMatchObject({ level: "WARN", sound: "error" });
    expect(
      describeSponsorEvent({ type: "request_dropped", request, moodDelta: -12 })
    ).toMatchObject({ level: "CRITICAL", sound: null });
    expect(describeSponsorEvent({ type: "contract_terminated" })).toEqual({
      message: SHIFT_END_LOGS.sponsor,
      level: "CRITICAL",
      sound: "alarm",
    });
  });
});

describe("ClinicalTrialChaosEngine delegates to the shift rules", () => {
  it("scores a verified submission exactly as the component does", () => {
    const engine = new ClinicalTrialChaosEngine();
    const clean = subject({
      observations: [observation({ isResolved: true })],
    });
    engine.addSubject(clean);
    const before = engine.getSnapshot().scoreState;

    expect(engine.verifyAndSubmit(clean.id, "Intent to Submit", "VS")).toEqual(
      expect.objectContaining({ success: true })
    );
    const expected = applySubmissionScore(
      before,
      scoreSubmission(before, clean, true),
      true
    );
    expect(engine.getSnapshot().scoreState).toEqual(expected);
  });

  it("records each wrong fix once in a fresh array (#1553)", () => {
    const engine = new ClinicalTrialChaosEngine();
    engine.addSubject(subject());
    engine.resolveObservation("subj-1", "obs-1", "999 lbs");
    engine.resolveObservation("subj-1", "obs-1", "998 lbs");
    expect(engine.getSnapshot().ruleViolationsCount).toBe(2);
  });

  it("breaks the combo on a rejected submission", () => {
    const engine = new ClinicalTrialChaosEngine();
    engine.addSubject(subject());
    const result = engine.verifyAndSubmit("subj-1", "Intent to Submit", "VS");
    expect(result.success).toBe(false);
    expect(engine.getSnapshot().scoreState).toMatchObject({
      combo: 0,
      auditViolations: 1,
    });
    expect(engine.getSnapshot().auditorState.behavior).toBe("suspicious");
  });
});

// #1670: expired subjects were reported as CRFs "submitted with unresolved
// raw data" beside a 100% clean rate.
describe("expired subjects in the tallies and report (#1670)", () => {
  it("counts expiries apart from misrouted CRFs", () => {
    const tick = tickShiftClocks(
      {
        subjects: [
          subject({ id: "a", timeRemaining: 0.05 }),
          subject({ id: "b", timeRemaining: 0.05 }),
        ],
        auditor: createInitialAuditorState(),
        scoreState: createInitialScoreState(),
        powerUps: createInitialPowerUpInventory(),
        amendment: null,
      },
      0.1
    );
    expect(tick.scoreState.expiredSubjects).toBe(2);
    expect(tick.scoreState.auditViolations).toBe(2);

    const misrouted = breakCombo(tick.scoreState);
    expect(getViolationBreakdown(misrouted, 1)).toEqual({
      expired: 2,
      misrouted: 1,
      wrongFixes: 1,
      total: 4,
    });
  });

  it("names expiries as expired, never as submissions, and shows the count", () => {
    const score = {
      ...createInitialScoreState(),
      subjectsSubmitted: 5,
      cleanSubmissions: 5,
      auditViolations: 4,
      expiredSubjects: 4,
    };
    const report = buildInspectionReport(
      score,
      createInitialAuditorState(),
      [],
      [],
      null,
      []
    );
    expect(report.submittedCRFs).toBe(5);
    expect(report.expiredCRFs).toBe(4);
    const text = report.findings.map((f) => f.description).join(" ");
    expect(text).toContain(
      "4 subjects expired on the conveyor before source data verification"
    );
    expect(text).not.toMatch(/submitted with unresolved/);
  });

  it("carries the expired count across campaign phases", () => {
    const next = getNextShiftScoreState(
      { ...createInitialScoreState(), expiredSubjects: 3, auditViolations: 3 },
      true,
      0
    );
    expect(next.expiredSubjects).toBe(3);
  });
});

// #1673: Auto-Clean fired on a clean CRF, and later phases opened with the
// campaign total already filling their lock counter.
describe("lifelines refuse a clean dossier (#1673)", () => {
  const inventory = charged(createInitialPowerUpInventory());
  const clean = subject({
    observations: [observation({ isResolved: true })],
  });
  const flagged = subject();

  it("keeps Auto-Clean and Fast-Track for dossiers with flagged fields", () => {
    expect(canActivatePowerUp(inventory, "auto-clean", true, clean)).toBe(
      false
    );
    expect(canActivatePowerUp(inventory, "fast-sign", true, clean)).toBe(false);
    expect(canActivatePowerUp(inventory, "auto-clean", true, flagged)).toBe(
      true
    );
    expect(canActivatePowerUp(inventory, "fast-sign", true, flagged)).toBe(
      true
    );
    // The other lifelines do not act on the dossier.
    expect(canActivatePowerUp(inventory, "query-extension", true, clean)).toBe(
      true
    );
  });

  it("says why a lifeline is unavailable", () => {
    expect(getPowerUpRefusal(inventory, "auto-clean", true, clean)).toBe(
      "nothing_to_clean"
    );
    expect(getPowerUpRefusal(inventory, "auto-clean", true, null)).toBe(
      "no_dossier"
    );
    expect(
      getPowerUpRefusal(
        createInitialPowerUpInventory(),
        "auto-clean",
        true,
        flagged
      )
    ).toBe("charging");
    expect(getPowerUpRefusal(inventory, "auto-clean", false, flagged)).toBe(
      "shift_stopped"
    );
    expect(
      getPowerUpRefusal(inventory, "auto-clean", true, flagged)
    ).toBeNull();
    expect(describePowerUpRefusal("nothing_to_clean", "CDISC Auto-Clean")).toBe(
      "CDISC Auto-Clean not used: nothing to clean on this dossier. Its charge is kept."
    );
  });

  it("counts each phase's new locks from zero against its own new target", () => {
    // The campaign length is unchanged: phases clear at 5, 8 and 12 locks in
    // total, so they ask for 5, 3 and 4 new locks.
    expect(PHASE_TARGETS).toEqual({ 1: 5, 2: 8, 3: 12 });
    expect([1, 2, 3].map((p) => getPhaseLockTarget(p as 1 | 2 | 3))).toEqual([
      5, 3, 4,
    ]);

    let running = createInitialScoreState();
    const locksPerPhase: number[] = [];
    for (const phase of [1, 2, 3] as const) {
      expect(getPhaseProgress(running, "campaign", phase)).toEqual({
        locked: 0,
        target: getPhaseLockTarget(phase),
      });
      let cleared = false;
      let locks = 0;
      while (!cleared) {
        const outcome = settleSubmission(
          running,
          subject({ id: `p${phase}-${locks}` }),
          true,
          "campaign",
          phase
        );
        running = outcome.scoreState;
        cleared = outcome.phaseCleared;
        locks++;
        expect(getPhaseProgress(running, "campaign", phase).locked).toBe(locks);
      }
      locksPerPhase.push(locks);
      // Advancing a phase carries the score and total (#1325).
      running = getNextShiftScoreState(running, true, 0);
    }
    expect(locksPerPhase).toEqual([5, 3, 4]);
    expect(running.subjectsSubmitted).toBe(12);
  });

  it("has no phase target in endless mode", () => {
    expect(
      getPhaseProgress(
        {
          ...createInitialScoreState(),
          subjectsSubmitted: 7,
        },
        "endless",
        1
      )
    ).toEqual({ locked: 7, target: null });
  });
});

// #1672: the conveyor clocks kept running behind the Field Manual, and a
// shift could not be paused.
describe("shift pause rules (#1672)", () => {
  it("halts the clocks for a pause, the manual, a dialog or calibration", () => {
    expect(isShiftClockHalted({})).toBe(false);
    expect(isShiftClockHalted({ userPaused: true })).toBe(true);
    expect(isShiftClockHalted({ manualOpen: true })).toBe(true);
    expect(isShiftClockHalted({ dialogOpen: true })).toBe(true);
    expect(isShiftClockHalted({ calibrating: true })).toBe(true);
  });

  it("advances nothing while halted and clamps a long frame", () => {
    expect(getShiftTickSeconds(5000, true)).toBe(0);
    expect(getShiftTickSeconds(50, false)).toBeCloseTo(0.05);
    expect(getShiftTickSeconds(5000, false)).toBeCloseTo(0.1);
  });

  it("keeps the engine's clocks still while paused or while the manual is open", () => {
    const engine = new ClinicalTrialChaosEngine();
    engine.addSubject(subject({ timeRemaining: 3 }));
    engine.setPaused(true);
    engine.update(5);
    expect(engine.getSnapshot().subjectCount).toBe(1);
    engine.setPaused(false);
    engine.setManualOpen(true);
    engine.update(5);
    expect(engine.getSnapshot().subjectCount).toBe(1);
    engine.setManualOpen(false);
    engine.update(5);
    // Unpaused, the subject runs out of time.
    expect(engine.getSnapshot().subjectCount).toBe(0);
    expect(engine.getSnapshot().scoreState.expiredSubjects).toBe(1);
  });
});

describe("Field Manual agrees with the shift rules (#1672, #1673)", () => {
  it("lists the pause key and each phase's own lock target", async () => {
    const { GAME_MANUALS } = await import("@/lib/game-manuals");
    const manual = GAME_MANUALS["clinical-chaos"];
    expect(manual.controls.some((c) => c.key?.startsWith("P "))).toBe(true);
    const targets = manual.rules.find(
      (r) => r.title === "Campaign Phase Targets"
    )?.detail;
    expect(targets).toContain(
      `Lock ${getPhaseLockTarget(1)} CRFs to clear Phase 1`
    );
    expect(targets).toContain(`${getPhaseLockTarget(2)} more to clear Phase 2`);
    expect(targets).toContain(`${getPhaseLockTarget(3)} more to clear Phase 3`);
    expect(targets).toContain(`${PHASE_TARGETS[3]} in all`);
  });
});
