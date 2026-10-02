// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  ClinicalTrialChaosEngine,
  getRoutingReadiness,
  getSubmissionMode,
} from "@/lib/clinical-trial-chaos";
import type { ClinicalSubject } from "@/lib/clinical-trial-chaos/types";

describe("ClinicalTrialChaosEngine", () => {
  it("quick-dispatches only clean routine packets outside phase locks and amendments", () => {
    const subject: ClinicalSubject = {
      id: "routine-subject",
      subjectLabel: "SUBJ-ROUTINE",
      studySite: "Site 001",
      observations: [
        {
          id: "routine-observation",
          field: "Height",
          rawValue: "180 cm",
          currentValue: "180 cm",
          destination: "DM",
          isResolved: true,
        },
      ],
      status: "queued",
      timeRemaining: 30,
      maxTime: 30,
      createdAt: 0,
    };
    const stations = [{ id: "DM" }, { id: "AE" }] as const;
    const context = {
      gameMode: "campaign" as const,
      submittedCount: 2,
      phaseTarget: 5,
      amendmentActive: false,
    };

    expect(getSubmissionMode(subject, "DM", stations, context)).toBe("quick");
    expect(
      getSubmissionMode({ ...subject, isSAE: true }, "DM", stations, context)
    ).toBe("full");
    expect(
      getSubmissionMode(
        {
          ...subject,
          observations: subject.observations.map((observation) => ({
            ...observation,
            isResolved: false,
          })),
        },
        "DM",
        stations,
        context
      )
    ).toBe("full");
    expect(getSubmissionMode(subject, "AE", stations, context)).toBe("full");
    expect(getSubmissionMode(subject, "DM", [{ id: "AE" }], context)).toBe(
      "full"
    );
    expect(
      getSubmissionMode(subject, "DM", stations, {
        ...context,
        submittedCount: 4,
      })
    ).toBe("full");
    expect(
      getSubmissionMode(subject, "DM", stations, {
        ...context,
        amendmentActive: true,
      })
    ).toBe("full");
    expect(
      getSubmissionMode(subject, "DM", stations, {
        ...context,
        gameMode: "endless",
        submittedCount: 4,
      })
    ).toBe("quick");
  });

  it("keeps matching stations visible while observations still need fixing", () => {
    const subject: ClinicalSubject = {
      id: "routing-subject",
      subjectLabel: "SUBJ-ROUTE",
      studySite: "Site 001",
      observations: [
        {
          id: "dm-observation",
          field: "Subject ID",
          rawValue: "123",
          currentValue: "123",
          destination: "DM",
          isResolved: false,
        },
        {
          id: "vs-observation",
          field: "Height",
          rawValue: "180 cm",
          currentValue: "180 cm",
          destination: "VS",
          isResolved: true,
        },
      ],
      status: "queued",
      timeRemaining: 30,
      maxTime: 30,
      createdAt: 0,
    };
    const stations = [{ id: "DM" }, { id: "AE" }] as const;

    expect(getRoutingReadiness(subject, stations)).toEqual({
      matchingDomains: ["DM"],
      unresolvedCount: 1,
    });
    expect(getRoutingReadiness(null, stations)).toEqual({
      matchingDomains: [],
      unresolvedCount: 0,
    });
    expect(
      getRoutingReadiness(
        {
          ...subject,
          observations: subject.observations.map((observation) => ({
            ...observation,
            isResolved: true,
          })),
        },
        stations
      )
    ).toEqual({ matchingDomains: ["DM"], unresolvedCount: 0 });
  });

  it("initializes score, auditor, and conveyor state", () => {
    const engine = new ClinicalTrialChaosEngine();
    const snapshot = engine.getSnapshot();

    expect(snapshot.scoreState.score).toBe(0);
    expect(snapshot.auditorState.behavior).toBe("patrolling");
    expect(snapshot.isPaused).toBe(false);
    expect(snapshot.isModalPaused).toBe(false);
  });

  it("activates FDA Coffee Break power-up and freezes suspicion", () => {
    const engine = new ClinicalTrialChaosEngine();
    engine.activatePowerUp("fda-coffee-break");

    const snapshot = engine.getSnapshot();
    expect(
      snapshot.powerUps["fda-coffee-break"].activeSecondsRemaining
    ).toBeGreaterThan(0);
    expect(snapshot.auditorState.isPaused).toBe(true);
  });

  it("advances simulation tick and conveyor progression", () => {
    const engine = new ClinicalTrialChaosEngine();
    engine.update(1 / 60);

    const snapshot = engine.getSnapshot();
    expect(snapshot.auditorState).toBeDefined();
  });

  it("freezes simulation ticks during active modal pause while allowing rendering", () => {
    const engine = new ClinicalTrialChaosEngine();
    const mockSubject: ClinicalSubject = {
      id: "SUBJ-TEST",
      subjectLabel: "101-001",
      studySite: "Site 001",
      observations: [],
      status: "queued",
      timeRemaining: 10,
      maxTime: 10,
      createdAt: Date.now(),
    };
    engine.addSubject(mockSubject);

    engine.setModalPause(true);
    expect(engine.isModalPaused()).toBe(true);

    const initialCount = engine.getSnapshot().subjectCount;
    engine.update(1.0); // 1 second tick

    // Snapshot count and state should remain intact because modal is paused
    expect(engine.getSnapshot().subjectCount).toBe(initialCount);

    // Resume modal pause
    engine.setModalPause(false);
    engine.update(1.0);
    expect(engine.getSnapshot().subjectCount).toBe(initialCount);
  });

  it("emits typed events on score, auditor, and powerup changes", () => {
    const engine = new ClinicalTrialChaosEngine();
    const scoreListener = vi.fn();
    const auditorListener = vi.fn();
    const logListener = vi.fn();

    engine.on("scoreChange", scoreListener);
    engine.on("auditorUpdate", auditorListener);
    engine.on("auditLog", logListener);

    const mockSubject: ClinicalSubject = {
      id: "SUBJ-EVT",
      subjectLabel: "102-002",
      studySite: "Site 002",
      observations: [
        {
          id: "obs-evt",
          field: "Weight",
          rawValue: "154 lbs",
          currentValue: "154 lbs",
          destination: "VS",
          correctedValue: "70 kg",
          isResolved: false,
        },
      ],
      status: "queued",
      timeRemaining: 20,
      maxTime: 20,
      createdAt: Date.now(),
    };
    engine.addSubject(mockSubject);

    const res = engine.resolveObservation("SUBJ-EVT", "obs-evt", "70 kg");
    expect(res.isValid).toBe(true);
    expect(scoreListener).toHaveBeenCalled();
    expect(logListener).toHaveBeenCalled();
  });

  it("verifies 21 CFR submissions and updates submitted history", () => {
    const engine = new ClinicalTrialChaosEngine();
    const submissionListener = vi.fn();
    engine.on("submissionVerified", submissionListener);

    const mockSubject: ClinicalSubject = {
      id: "SUBJ-CFR",
      subjectLabel: "103-003",
      studySite: "Site 003",
      observations: [
        {
          id: "obs-cfr",
          field: "Heart Rate",
          rawValue: "72 bpm",
          currentValue: "72 bpm",
          destination: "VS",
          isResolved: true,
        },
      ],
      status: "queued",
      timeRemaining: 30,
      maxTime: 30,
      createdAt: Date.now(),
    };
    engine.addSubject(mockSubject);

    const subRes = engine.verifyAndSubmit("SUBJ-CFR", "Intent to Submit", "VS");
    expect(subRes.success).toBe(true);
    expect(submissionListener).toHaveBeenCalled();
    expect(engine.getSnapshot().submittedCount).toBe(1);
    expect(engine.getSnapshot().subjectCount).toBe(0);
  });
});
