// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  evaluateIncidentDebrief,
  compileShiftSummary,
  derivePlayfulStats,
  createPatrolShiftEngine,
  calculateDebriefScore,
  DEBRIEF_DIMENSION_ORDER,
  type PatrolEvent,
  type OetMetrics,
} from "@/lib/patrol";

/**
 * Pure Vitest suite for the M7 Contextual Debrief Engine (Issue #753).
 *
 * Every fixture below is a synthetic `PatrolEvent[]` history — this suite
 * never touches the FSM or scenario content packages, matching the
 * ADR 0042 purity invariant the engine itself is held to.
 */

const SMOOTH_OET_METRICS: OetMetrics = {
  excessiveSpeedTime: 0,
  abruptDirectionChanges: 0,
  boundaryViolations: 0,
  collisions: 0,
  controlledStops: 2,
  routeEfficiency: 95,
  judgmentScore: 95,
};

const ROUGH_OET_METRICS: OetMetrics = {
  excessiveSpeedTime: 12,
  abruptDirectionChanges: 6,
  boundaryViolations: 1,
  collisions: 0,
  controlledStops: 0,
  routeEfficiency: 40,
  judgmentScore: 35,
};

describe("Patrol Shift — M7 Contextual Debrief Engine (Issue #753)", () => {
  describe("1. Exemplary performance fixture", () => {
    const events: PatrolEvent[] = [
      {
        timestamp: 1,
        scenarioId: "wrist-injury-lower-park",
        action: "assess-scene-safety",
        context: {
          label: "Assess & Secure Scene Safety",
          category: "assessment",
        },
      },
      {
        timestamp: 2,
        scenarioId: "wrist-injury-lower-park",
        action: "secondary-assessment",
        context: {
          label: "Focused Wrist Exam & PMS Check",
          category: "assessment",
        },
      },
      {
        timestamp: 3,
        scenarioId: "wrist-injury-lower-park",
        action: "splint-wrist",
        context: {
          label: "Splint the Wrist & Re-verify PMS",
          category: "treatment",
        },
      },
      {
        timestamp: 4,
        scenarioId: "wrist-injury-lower-park",
        action: "package-for-transport",
        context: {
          label: "Sling the Arm & Prepare for Toboggan",
          category: "transport",
        },
      },
      {
        timestamp: 5,
        scenarioId: "wrist-injury-lower-park",
        action: "DIALOGUE_CHOICE",
        type: "DIALOGUE_CHOICE",
        context: {
          momentId: "delegate-to-casey",
          speaker: "Casey (Second-Year Patroller)",
          optionId: "delegate-directive-closed-loop",
          style: "directive",
          clarity: "high",
          closesLoop: true,
        },
      },
    ];

    const result = evaluateIncidentDebrief(
      "wrist-injury-lower-park",
      events,
      SMOOTH_OET_METRICS
    );

    it("scores every dimension at the top of the scale", () => {
      for (const dimension of DEBRIEF_DIMENSION_ORDER) {
        expect(result.dimensions[dimension].score).toBeGreaterThanOrEqual(9);
        expect(result.dimensions[dimension].rating).toBe("exemplary");
      }
      expect(result.overallRating).toMatch(/Exemplary/i);
    });

    it("surfaces only positive observations", () => {
      expect(result.observations.length).toBeGreaterThan(0);
      for (const observation of result.observations) {
        expect(observation.sentiment).toBe("positive");
      }
      expect(
        result.observations.some((o) =>
          o.detail.includes(
            "You established scene control and marked uphill hazards before patient contact."
          )
        )
      ).toBe(true);
    });

    it("reports smooth ride comfort in the OET summary", () => {
      expect(result.oetSummary).toBeDefined();
      expect(result.oetSummary?.rideComfort).toBe("smooth");
      expect(result.oetSummary?.controlledStops).toBe(2);
    });
  });

  describe("2. Neglected safety / near-miss fixture", () => {
    const events: PatrolEvent[] = [
      {
        timestamp: 1,
        scenarioId: "wrist-injury-lower-park",
        action: "splint-wrist",
        context: {
          label: "Splint the Wrist & Re-verify PMS",
          category: "treatment",
        },
      },
      {
        timestamp: 2,
        scenarioId: "wrist-injury-lower-park",
        action: "HAZARD_ALERT",
        type: "HAZARD_ALERT",
        severity: "warning",
        description:
          "Patient care was initiated before uphill skier traffic was diverted.",
        context: {
          neglectedAction: "splint-wrist",
          patientCondition: "worsened",
        },
      },
    ];

    const result = evaluateIncidentDebrief("wrist-injury-lower-park", events);

    it("lowers the Scene Management (and Operational Judgment) score", () => {
      expect(result.dimensions.sceneManagement.score).toBeLessThan(5);
      expect(result.dimensions.sceneManagement.rating).toBe("needs-attention");
      expect(result.dimensions.operationalJudgment.rating).toBe(
        "needs-attention"
      );
    });

    it("emits a constructive safety observation naming the near-miss", () => {
      const sceneObservation = result.observations.find(
        (o) => o.dimension === "sceneManagement"
      );
      expect(sceneObservation).toBeDefined();
      expect(sceneObservation?.sentiment).toBe("constructive");
      expect(sceneObservation?.detail).toContain(
        "Patient care was initiated before uphill skier traffic was diverted."
      );
    });

    it("flags the missing pre-splint neurovascular check", () => {
      const careObservation = result.observations.find(
        (o) => o.dimension === "patientCare"
      );
      expect(careObservation).toBeDefined();
      expect(careObservation?.sentiment).toBe("constructive");
    });
  });

  describe("3. Abrupt / high-speed transport fixture", () => {
    const events: PatrolEvent[] = [
      {
        timestamp: 1,
        scenarioId: "cat-track-collision",
        action: "assess-scene-safety",
        context: {
          label: "Assess & Secure Scene Safety",
          category: "assessment",
        },
      },
      {
        timestamp: 2,
        scenarioId: "cat-track-collision",
        action: "package-for-transport",
        context: { label: "Package in Toboggan", category: "transport" },
      },
    ];

    const result = evaluateIncidentDebrief(
      "cat-track-collision",
      events,
      ROUGH_OET_METRICS
    );

    it("flags Transportation for rough ride comfort", () => {
      expect(result.dimensions.transportation.rating).toBe("needs-attention");
      expect(result.oetSummary?.rideComfort).toBe("rough");
    });

    it("emits a transportation observation calling out speed/steering control", () => {
      const transportObservation = result.observations.find(
        (o) => o.dimension === "transportation"
      );
      expect(transportObservation).toBeDefined();
      expect(transportObservation?.detail).toMatch(/speed|steering/i);
    });
  });

  describe("4. Diagnostic escalation fixture (ambiguous-patient)", () => {
    const events: PatrolEvent[] = [
      {
        timestamp: 1,
        scenarioId: "ambiguous-glade-fall",
        action: "assess-scene-safety",
        context: {
          label: "Assess & Secure Scene Safety",
          category: "assessment",
        },
      },
      {
        timestamp: 2,
        scenarioId: "ambiguous-glade-fall",
        action: "secondary-assessment",
        context: { label: "Focused Neuro Check", category: "assessment" },
      },
      {
        timestamp: 3,
        scenarioId: "ambiguous-glade-fall",
        action: "reassess-patient-status",
        context: {
          label: "Reassess After a Few Minutes",
          category: "assessment",
        },
      },
      {
        timestamp: 4,
        scenarioId: "ambiguous-glade-fall",
        action: "DIALOGUE_CHOICE",
        type: "DIALOGUE_CHOICE",
        context: {
          momentId: "escalate-to-dispatch",
          speaker: "Base Dispatch",
          optionId: "escalate-candid-request",
          style: "candid",
          clarity: "high",
          closesLoop: true,
        },
      },
      {
        timestamp: 5,
        scenarioId: "ambiguous-glade-fall",
        action: "package-for-transport",
        context: {
          label: "Package for Toboggan Transport",
          category: "transport",
        },
      },
    ];

    const result = evaluateIncidentDebrief("ambiguous-glade-fall", events);

    it("scores Operational Judgment and Communication highly", () => {
      expect(
        result.dimensions.operationalJudgment.score
      ).toBeGreaterThanOrEqual(7);
      expect(result.dimensions.communication.score).toBeGreaterThanOrEqual(7);
    });

    it("credits the serial reassessment in Patient Care", () => {
      expect(result.dimensions.patientCare.score).toBeGreaterThan(5);
      expect(
        result.observations.some((o) =>
          o.detail.includes(
            "Patient status was re-checked over time rather than accepted at first pass."
          )
        )
      ).toBe(true);
    });
  });

  describe("5. Empty / minimal history boundary defense (AGENTS.md #11)", () => {
    it("returns a safe, non-crashing fallback for zero events", () => {
      const result = evaluateIncidentDebrief("no-op-scenario", []);

      for (const dimension of DEBRIEF_DIMENSION_ORDER) {
        const dimensionScore = result.dimensions[dimension];
        expect(Number.isFinite(dimensionScore.score)).toBe(true);
        expect(dimensionScore.score).toBe(5);
        expect(dimensionScore.rating).toBe("developing");
      }
      expect(result.observations.length).toBeGreaterThan(0);
      expect(result.observations[0].headline).toBe(
        "Baseline Protocols Maintained"
      );
      expect(result.oetSummary).toBeUndefined();
    });

    it("never throws or produces NaN when handed malformed metrics", () => {
      const malformedMetrics = {
        excessiveSpeedTime: Number.NaN,
        abruptDirectionChanges: Number.NaN,
        boundaryViolations: Number.NaN,
        collisions: Number.NaN,
        controlledStops: Number.NaN,
        routeEfficiency: Number.NaN,
        judgmentScore: Number.NaN,
      } as OetMetrics;

      expect(() =>
        evaluateIncidentDebrief("no-op-scenario", [], malformedMetrics)
      ).not.toThrow();

      const result = evaluateIncidentDebrief(
        "no-op-scenario",
        [],
        malformedMetrics
      );
      for (const dimension of DEBRIEF_DIMENSION_ORDER) {
        expect(Number.isFinite(result.dimensions[dimension].score)).toBe(true);
      }
      expect(Number.isFinite(result.oetSummary?.judgmentScore)).toBe(true);
    });

    it("tolerates a non-array events argument defensively", () => {
      expect(() =>
        evaluateIncidentDebrief(
          "no-op-scenario",
          fromAny<PatrolEvent[], null>(null)
        )
      ).not.toThrow();
    });

    it("compiles a safe shift summary for a shift with no incidents", () => {
      const summary = compileShiftSummary([], 0);
      expect(summary.totalIncidents).toBe(0);
      expect(summary.incidentResults).toEqual([]);
      expect(summary.chronologicalHighlights).toEqual([]);
      for (const dimension of DEBRIEF_DIMENSION_ORDER) {
        expect(summary.compositeDimensions[dimension].rating).toBe(
          "developing"
        );
      }
      expect(summary.playfulStats.callsHandled).toBe(0);
      expect(summary.playfulStats.communicationRating).toBe(
        "No Delegation Logged"
      );
    });
  });

  describe("6. Playful stats calculation (no double-counting)", () => {
    const events: PatrolEvent[] = [
      {
        timestamp: 1,
        scenarioId: "wrist-injury-lower-park",
        action: "PHASE_TRANSITION:PATROL_MAP->DISPATCH",
        context: { from: "PATROL_MAP", to: "DISPATCH" },
      },
      {
        timestamp: 2,
        scenarioId: "wrist-injury-lower-park",
        action: "assess-scene-safety",
        context: {
          label: "Assess & Secure Scene Safety",
          category: "assessment",
        },
      },
      {
        timestamp: 3,
        scenarioId: "wrist-injury-lower-park",
        action: "radio-request-assist",
        context: {
          label: "Radio Base for Additional Traffic Control",
          category: "communication",
        },
      },
      {
        timestamp: 4,
        scenarioId: "wrist-injury-lower-park",
        action: "secondary-assessment",
        context: {
          label: "Focused Wrist Exam & PMS Check",
          category: "assessment",
        },
      },
      {
        timestamp: 5,
        scenarioId: "wrist-injury-lower-park",
        action: "check-vitals",
        context: {
          label: "Measure Baseline Vital Signs",
          category: "assessment",
        },
      },
      {
        timestamp: 6,
        scenarioId: "wrist-injury-lower-park",
        action: "VITALS_CHECK",
        context: { vitals: { heartRate: 82 } },
      },
      {
        timestamp: 7,
        scenarioId: "wrist-injury-lower-park",
        action: "splint-wrist",
        context: {
          label: "Splint the Wrist & Re-verify PMS",
          category: "treatment",
        },
      },
      {
        timestamp: 8,
        scenarioId: "wrist-injury-lower-park",
        action: "DIALOGUE_CHOICE",
        context: { closesLoop: true, style: "directive", speaker: "Casey" },
      },
      {
        timestamp: 9,
        scenarioId: "wrist-injury-lower-park",
        action: "package-for-transport",
        context: {
          label: "Sling the Arm & Prepare for Toboggan",
          category: "transport",
        },
      },
      {
        timestamp: 10,
        scenarioId: "wrist-injury-lower-park",
        action: "OET_TRANSPORT_COMPLETED",
        payload: { judgmentScore: 90, metrics: { judgmentScore: 90 } },
      },
      {
        timestamp: 11,
        scenarioId: "cat-track-collision",
        action: "PHASE_TRANSITION:PATROL_MAP->DISPATCH",
        context: { from: "PATROL_MAP", to: "DISPATCH" },
      },
      {
        timestamp: 12,
        scenarioId: "cat-track-collision",
        action: "assess-scene-safety",
        context: {
          label: "Assess & Secure Scene Safety",
          category: "assessment",
        },
      },
      {
        timestamp: 13,
        scenarioId: "cat-track-collision",
        action: "manage-crowd",
        context: { label: "Manage the Crowd", category: "decision" },
      },
      {
        timestamp: 14,
        scenarioId: "cat-track-collision",
        action: "reassess-patient-status",
        context: {
          label: "Reassess After a Few Minutes",
          category: "assessment",
        },
      },
      {
        timestamp: 15,
        scenarioId: "cat-track-collision",
        action: "DIALOGUE_CHOICE",
        context: {
          closesLoop: false,
          style: "deferential",
          clarity: "low",
          speaker: "Morgan",
        },
      },
    ];

    const stats = derivePlayfulStats(events);

    it("derives every counter exactly once per qualifying event", () => {
      expect(stats.callsHandled).toBe(2);
      expect(stats.radioTransmissions).toBe(1);
      expect(stats.patientsAssisted).toBe(2);
      expect(stats.sledTransports).toBe(1);
      expect(stats.trailsChecked).toBe(2);
      expect(stats.hazardsMarked).toBe(3);
      expect(stats.pmsChecksPerformed).toBe(2);
      expect(stats.reassessmentsLogged).toBe(1);
      expect(stats.closedLoopDelegations).toBe(1);
      expect(stats.communicationRating).toBe("Clear & Confirmed");
    });

    it("does not let a phase-transition event masquerade as a radio call", () => {
      // "PHASE_TRANSITION:PATROL_MAP->DISPATCH" contains the substring
      // "DISPATCH" but must never be counted as a radio transmission.
      const onlyPhaseTransitions = events.filter((e) =>
        String(e.action).startsWith("PHASE_TRANSITION")
      );
      expect(onlyPhaseTransitions).toHaveLength(2);
      expect(derivePlayfulStats(onlyPhaseTransitions).radioTransmissions).toBe(
        0
      );
    });

    it("compiles a whole-shift summary whose composite reflects both incidents", () => {
      const summary = compileShiftSummary(events, 42);
      expect(summary.totalIncidents).toBe(2);
      expect(summary.elapsedShiftMinutes).toBe(42);
      expect(summary.incidentResults.map((r) => r.scenarioId)).toEqual([
        "wrist-injury-lower-park",
        "cat-track-collision",
      ]);
      expect(summary.playfulStats).toEqual(stats);
      expect(summary.chronologicalHighlights.length).toBeGreaterThan(0);
    });
  });

  describe("7. Incident replay isolation (engine event history)", () => {
    it("purges prior events for replayed scenario to provide a clean debrief slate", () => {
      const engine = createPatrolShiftEngine();
      engine.dispatch({ type: "START_SHIFT" });
      engine.dispatch({ type: "COMPLETE_BRIEFING" });

      const scenarioId = "wrist-injury";
      engine.dispatch({ type: "RECEIVE_DISPATCH", scenarioId });
      engine.dispatch({ type: "ACCEPT_DISPATCH" });
      engine.dispatch({ type: "ARRIVE_ON_SCENE" });

      // Run 1: log an error action (hazard_alert)
      engine.dispatch({
        type: "PUSH_EVENT",
        event: {
          id: "hazard-1",
          timestamp: 100,
          scenarioId,
          action: "hazard_alert",
          title: "Near-Miss",
          description: "Safety compromised",
        },
      });

      // Move to debrief
      engine.dispatch({ type: "COMPLETE_SCENE" });
      engine.dispatch({ type: "BEGIN_TRANSPORT" });
      engine.dispatch({ type: "ARRIVE_AT_BASE" });
      engine.dispatch({ type: "COMPLETE_HANDOFF" });

      expect(engine.getState().phase).toBe("DEBRIEF");
      const debrief1 = evaluateIncidentDebrief(
        scenarioId,
        engine.getIncidentEvents(scenarioId)
      );
      // Run 1 should have negative scene safety impact
      expect(
        debrief1.observations.some(
          (o) => o.relatedEventAction === "hazard_alert"
        )
      ).toBe(true);

      // Replay the incident
      engine.dispatch({ type: "REPLAY_INCIDENT" });
      expect(engine.getState().phase).toBe("SCENE");

      // Event history for this scenario should be purged of prior run errors
      const debriefAfterReplay = evaluateIncidentDebrief(
        scenarioId,
        engine.getIncidentEvents(scenarioId)
      );
      expect(
        debriefAfterReplay.observations.some(
          (o) => o.relatedEventAction === "hazard_alert"
        )
      ).toBe(false);
    });
  });

  describe("8. calculateDebriefScore with various performance inputs", () => {
    it("returns expected percentage and grade outputs for raw numeric scores", () => {
      const scoreA = calculateDebriefScore(95);
      expect(scoreA.percentage).toBe(95);
      expect(scoreA.grade).toBe("A");
      expect(scoreA.rating).toBe("exemplary");

      const scoreB = calculateDebriefScore(85);
      expect(scoreB.percentage).toBe(85);
      expect(scoreB.grade).toBe("B");
      expect(scoreB.rating).toBe("proficient");

      const scoreC = calculateDebriefScore(75);
      expect(scoreC.percentage).toBe(75);
      expect(scoreC.grade).toBe("C");
      expect(scoreC.rating).toBe("developing");

      const scoreD = calculateDebriefScore(62);
      expect(scoreD.percentage).toBe(62);
      expect(scoreD.grade).toBe("D");
      expect(scoreD.rating).toBe("developing");

      const scoreF = calculateDebriefScore(45);
      expect(scoreF.percentage).toBe(45);
      expect(scoreF.grade).toBe("F");
      expect(scoreF.rating).toBe("needs-attention");
    });

    it("calculates percentage and grade from passed vs total rule counts", () => {
      expect(calculateDebriefScore(10, 10)).toEqual({
        score: 100,
        percentage: 100,
        grade: "A",
        rating: "exemplary",
        summary: "Exemplary Field Performance",
      });

      expect(calculateDebriefScore(8, 10)).toEqual({
        score: 80,
        percentage: 80,
        grade: "B",
        rating: "proficient",
        summary: "Proficient Patrol Response",
      });

      expect(calculateDebriefScore(7, 10)).toEqual({
        score: 70,
        percentage: 70,
        grade: "C",
        rating: "developing",
        summary: "Developing Judgment: On Track",
      });

      expect(calculateDebriefScore(4, 10)).toEqual({
        score: 40,
        percentage: 40,
        grade: "F",
        rating: "needs-attention",
        summary: "Needs Attention Before Next Call",
      });
    });

    it("evaluates debrief score from an options object input", () => {
      const objScore = calculateDebriefScore({
        passedRules: 9,
        totalRules: 10,
      });
      expect(objScore.percentage).toBe(90);
      expect(objScore.grade).toBe("A");

      const rawObjScore = calculateDebriefScore({ rawScore: 82 });
      expect(rawObjScore.percentage).toBe(82);
      expect(rawObjScore.grade).toBe("B");
    });

    it("evaluates debrief score from PatrolEvent[] history inputs", () => {
      const exemplaryEvents: PatrolEvent[] = [
        {
          timestamp: 1,
          scenarioId: "test-scenario",
          action: "assess-scene-safety",
          context: { label: "Assess Scene Safety", category: "assessment" },
        },
        {
          timestamp: 2,
          scenarioId: "test-scenario",
          action: "secondary-assessment",
          context: { label: "PMS Check", category: "assessment" },
        },
        {
          timestamp: 3,
          scenarioId: "test-scenario",
          action: "splint-wrist",
          context: { label: "Splint & Re-verify PMS", category: "treatment" },
        },
      ];

      const scoreResult = calculateDebriefScore(
        exemplaryEvents,
        SMOOTH_OET_METRICS
      );
      expect(scoreResult.percentage).toBeGreaterThanOrEqual(80);
      expect(["A", "B"]).toContain(scoreResult.grade);
      expect(scoreResult.summary).toBeTruthy();
    });

    it("handles boundary, empty, and out-of-range inputs defensively", () => {
      expect(calculateDebriefScore(undefined)).toMatchObject({
        percentage: 50,
        grade: "F",
      });

      expect(calculateDebriefScore(-20)).toMatchObject({
        percentage: 0,
        grade: "F",
      });

      expect(calculateDebriefScore(150)).toMatchObject({
        percentage: 100,
        grade: "A",
      });
    });
  });
});
