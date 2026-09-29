import { describe, it, expect, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  createPatrolShiftEngine,
  checkActionPreconditions,
  getAvailableActions,
  deriveRevealedPatientState,
  deriveRevealedEnvironmentState,
  deriveRevealedActors,
  type PatrolScenario,
  type ScenarioAction,
} from "@/lib/patrol";
import { SceneInteraction } from "@/components/patrol/SceneInteraction";
import { PatientCard } from "@/components/patrol/PatientCard";
import { HandoffPanel } from "@/components/patrol/HandoffPanel";
import { PatrolShiftContainer } from "@/components/patrol/PatrolShiftContainer";

// PLACEHOLDER — needs OEC/NSP content review, see #744
const testClinicalScenario: PatrolScenario = {
  id: "test-tib-fib-scenario",
  title: "Lower Extremity Trauma On-Scene",
  subtitle: "Downhill skier collision and fall",
  description:
    "Skier down on Lower Glade with sharp lower leg pain after high-speed fall.",
  difficulty: "intermediate",
  location: "Tower 8 - Lower Glades",
  environment: {
    weather: "20°F, light snow",
    snowConditions: "Firm hardpack",
    hazards: ["Oncoming skier traffic", "Blind drop uphill"],
    sceneSafetyNotes: "Uphill crossed skis required to protect scene",
  },
  patient: {
    complaint: "Severe pain in lower left leg",
    mechanism:
      "High-speed edge catch and rotational tumble; binding failed to release",
    levelOfConsciousness: "Alert & Oriented x4 (GCS 15)",
    findings: [
      "Deformity at mid-shaft tibia",
      "Distal pedal pulse present and strong",
    ],
    interventions: ["Rigid SAM splint applied", "Wool blanket wrap"],
    vitals: {
      heartRate: 76,
      respiration: 16,
      bpSystolic: 122,
      bpDiastolic: 80,
      spo2: 98,
      temperature: 98.4,
      gcs: 15,
    },
  },
  actors: [
    {
      id: "actor-alex",
      name: "Alex",
      role: "Ski Partner",
      notes: "Witnessed the entire fall sequence",
      statement:
        "They caught their outside ski edge carving fast, then took a violent tumble.",
    },
  ],
  initialVitals: {
    heartRate: 76,
    respiration: 16,
    bpSystolic: 122,
    bpDiastolic: 80,
    spo2: 98,
    temperature: 98.4,
    gcs: 15,
  },
  actions: [
    {
      id: "sec-safety",
      label: "Establish Uphill Scene Safety",
      description: "Plant crossed skis 25ft uphill to divert oncoming traffic.",
      category: "assessment",
      costMinutes: 2,
      securesSceneSafety: true,
      reveals: {
        environment: {
          hazards: ["Downhill traffic diverted"],
          sceneSafetyNotes: "Scene secured: perimeter established.",
        },
      },
    },
    {
      id: "interview-partner",
      label: "Interview Ski Partner",
      description: "Ask Alex about speed, mechanism, and head impact.",
      category: "assessment",
      costMinutes: 2,
      reveals: {
        actors: [
          {
            id: "actor-alex",
            name: "Alex",
            role: "Ski Partner",
            notes: "Witnessed the entire fall sequence",
            statement:
              "They caught their outside ski edge carving fast, then took a violent tumble.",
          },
        ],
        patient: {
          mechanism:
            "High-speed edge catch and rotational tumble; binding failed to release",
        },
      },
    },
    {
      id: "primary-survey",
      label: "Conduct Primary Survey (ABCs)",
      description: "Check airway, breathing, radial pulse, and LOC.",
      category: "assessment",
      costMinutes: 3,
      preconditions: ["sec-safety"],
      reveals: {
        patient: {
          complaint: "Severe pain in lower left leg",
          levelOfConsciousness: "Alert & Oriented x4 (GCS 15)",
          findings: ["Airway patent", "Breathing normal at 16 /min"],
        },
      },
    },
    {
      id: "check-vitals-action",
      label: "Measure Vital Signs",
      description: "Record pulse, respiration, BP, and skin temp.",
      category: "assessment",
      costMinutes: 3,
      preconditions: ["primary-survey"],
      vitalsCheck: {
        heartRate: 76,
        respiration: 16,
        bpSystolic: 122,
        bpDiastolic: 80,
        spo2: 98,
        temperature: 98.4,
        gcs: 15,
      },
      reveals: {
        patient: {
          vitals: {
            heartRate: 76,
            respiration: 16,
            bpSystolic: 122,
            bpDiastolic: 80,
            spo2: 98,
            temperature: 98.4,
            gcs: 15,
          },
        },
      },
    },
    {
      id: "secondary-survey",
      label: "Focused Secondary Exam & Check PMS",
      description:
        "Palpate extremity and check distal pulse, motor, and sensory.",
      category: "assessment",
      costMinutes: 4,
      preconditions: ["primary-survey"],
      reveals: {
        patient: {
          findings: [
            "Point tenderness and swelling at mid-shaft tibia",
            "Distal PMS verified intact",
          ],
        },
      },
    },
    {
      id: "apply-sam-splint",
      label: "Apply Rigid SAM Splint",
      description: "Immobilize injured extremity joint-to-joint.",
      category: "treatment",
      costMinutes: 5,
      preconditions: ["secondary-survey"],
      requiresSceneSafety: true,
      reveals: {
        patient: {
          interventions: ["SAM splint applied to lower left extremity"],
        },
      },
    },
  ],
  debriefRules: [],
};

describe("Patrol Shift — M5 OEC Scene & Patient Interaction System", () => {
  afterEach(cleanup);

  describe("1. Progressive Information Reveal & Clipboard Evolution", () => {
    it("renders unassessed state initially and reveals clinical facts progressively", () => {
      const engine = createPatrolShiftEngine([testClinicalScenario], {
        initialPhase: "SCENE",
      });

      const { rerender } = render(
        <SceneInteraction
          scenario={testClinicalScenario}
          actionHistory={engine.getState().actionHistory}
          vitalsHistory={engine.getState().vitalsHistory}
          revealedPatient={engine.getState().revealedPatient}
          revealedEnvironment={engine.getState().revealedEnvironment}
          revealedActors={engine.getState().revealedActors}
          sceneSafetyStatus={engine.getState().sceneSafetyStatus}
          patientCondition={engine.getState().patientCondition}
          onExecuteAction={(action) =>
            engine.dispatch({ type: "RECORD_ACTION", action })
          }
          onPrepareTransport={() => {}}
        />
      );

      // Initial state: complaint, MOI, and vitals are unassessed placeholders
      expect(screen.getByText(/Pending primary assessment/i)).toBeDefined();
      expect(screen.getByText(/Pending witness interview/i)).toBeDefined();
      expect(screen.getByTestId("vitals-hr").textContent).toBe("--");

      // 1. Execute interview witness: reveals MOI and Alex's statement
      const interviewBtn = screen.getByTestId("action-card-interview-partner");
      fireEvent.click(interviewBtn);

      rerender(
        <SceneInteraction
          scenario={testClinicalScenario}
          actionHistory={engine.getState().actionHistory}
          vitalsHistory={engine.getState().vitalsHistory}
          revealedPatient={engine.getState().revealedPatient}
          revealedEnvironment={engine.getState().revealedEnvironment}
          revealedActors={engine.getState().revealedActors}
          sceneSafetyStatus={engine.getState().sceneSafetyStatus}
          patientCondition={engine.getState().patientCondition}
          onExecuteAction={(action) =>
            engine.dispatch({ type: "RECORD_ACTION", action })
          }
          onPrepareTransport={() => {}}
        />
      );

      expect(
        screen.getByText(/High-speed edge catch and rotational tumble/i)
      ).toBeDefined();
      expect(screen.getByText(/Scene Witnesses & Responders/i)).toBeDefined();
      const actorsPanel = screen.getByTestId("revealed-actors-panel");
      expect(actorsPanel.textContent).toContain("Alex");
      expect(
        screen.getByText(/They caught their outside ski edge carving fast/i)
      ).toBeDefined();

      // 2. Execute scene safety
      const safetyBtn = screen.getByTestId("action-card-sec-safety");
      fireEvent.click(safetyBtn);

      rerender(
        <SceneInteraction
          scenario={testClinicalScenario}
          actionHistory={engine.getState().actionHistory}
          vitalsHistory={engine.getState().vitalsHistory}
          revealedPatient={engine.getState().revealedPatient}
          revealedEnvironment={engine.getState().revealedEnvironment}
          revealedActors={engine.getState().revealedActors}
          sceneSafetyStatus={engine.getState().sceneSafetyStatus}
          patientCondition={engine.getState().patientCondition}
          onExecuteAction={(action) =>
            engine.dispatch({ type: "RECORD_ACTION", action })
          }
          onPrepareTransport={() => {}}
        />
      );

      // Primary survey is now unlocked and can be clicked
      const primaryBtn = screen.getByTestId("action-card-primary-survey");
      fireEvent.click(primaryBtn);

      rerender(
        <SceneInteraction
          scenario={testClinicalScenario}
          actionHistory={engine.getState().actionHistory}
          vitalsHistory={engine.getState().vitalsHistory}
          revealedPatient={engine.getState().revealedPatient}
          revealedEnvironment={engine.getState().revealedEnvironment}
          revealedActors={engine.getState().revealedActors}
          sceneSafetyStatus={engine.getState().sceneSafetyStatus}
          patientCondition={engine.getState().patientCondition}
          onExecuteAction={(action) =>
            engine.dispatch({ type: "RECORD_ACTION", action })
          }
          onPrepareTransport={() => {}}
        />
      );

      expect(screen.getByText(/Severe pain in lower left leg/i)).toBeDefined();
      expect(screen.getByText(/Airway patent/i)).toBeDefined();

      // 3. Execute vitals check: reveals numeric heart rate and blood pressure
      const vitalsBtn = screen.getByTestId("action-card-check-vitals-action");
      fireEvent.click(vitalsBtn);

      rerender(
        <SceneInteraction
          scenario={testClinicalScenario}
          actionHistory={engine.getState().actionHistory}
          vitalsHistory={engine.getState().vitalsHistory}
          revealedPatient={engine.getState().revealedPatient}
          revealedEnvironment={engine.getState().revealedEnvironment}
          revealedActors={engine.getState().revealedActors}
          sceneSafetyStatus={engine.getState().sceneSafetyStatus}
          patientCondition={engine.getState().patientCondition}
          onExecuteAction={(action) =>
            engine.dispatch({ type: "RECORD_ACTION", action })
          }
          onPrepareTransport={() => {}}
        />
      );

      expect(screen.getByTestId("vitals-hr").textContent).toContain("76 bpm");
      expect(screen.getByTestId("vitals-rr").textContent).toContain("16 /min");
      expect(screen.getByTestId("vitals-bp").textContent).toContain("122/80");
    });

    it("pure helper functions correctly derive revealed states from history", () => {
      const history: ScenarioAction[] = [
        testClinicalScenario.actions[1], // interview
        testClinicalScenario.actions[0], // safety
        testClinicalScenario.actions[2], // primary
      ];

      const patient = deriveRevealedPatientState(testClinicalScenario, history);
      expect(patient.mechanism).toContain("High-speed edge catch");
      expect(patient.complaint).toContain("Severe pain in lower left leg");
      expect(patient.findings).toContain("Airway patent");

      const env = deriveRevealedEnvironmentState(testClinicalScenario, history);
      expect(env.hazards).toContain("Downhill traffic diverted");

      const actors = deriveRevealedActors(testClinicalScenario, history);
      expect(actors).toHaveLength(1);
      expect(actors[0].name).toBe("Alex");
    });
  });

  describe("2. Action Preconditions & Gating", () => {
    it("locks actions whose preconditions are not met and prevents execution", () => {
      const engine = createPatrolShiftEngine([testClinicalScenario], {
        initialPhase: "SCENE",
      });

      render(
        <SceneInteraction
          scenario={testClinicalScenario}
          actionHistory={engine.getState().actionHistory}
          onExecuteAction={(action) =>
            engine.dispatch({ type: "RECORD_ACTION", action })
          }
          onPrepareTransport={() => {}}
        />
      );

      // Primary survey requires sec-safety; SAM splint requires secondary-survey
      const primaryBtn = screen.getByTestId("action-card-primary-survey");
      const splintBtn = screen.getByTestId("action-card-apply-sam-splint");

      expect(primaryBtn.getAttribute("aria-disabled")).toBe("true");
      expect(splintBtn.getAttribute("aria-disabled")).toBe("true");
      expect(
        screen.getByText(/Requires: Establish Uphill Scene Safety/i)
      ).toBeDefined();

      // Attempting to click locked primary survey does nothing
      fireEvent.click(primaryBtn);
      expect(engine.getState().actionHistory).toHaveLength(0);
      expect(
        checkActionPreconditions(testClinicalScenario.actions[2], [])
      ).toBe(false);

      // Executing prerequisite unlocks primary survey
      const safetyBtn = screen.getByTestId("action-card-sec-safety");
      fireEvent.click(safetyBtn);
      expect(engine.getState().actionHistory).toHaveLength(1);
      expect(
        checkActionPreconditions(
          testClinicalScenario.actions[2],
          engine.getState().actionHistory
        )
      ).toBe(true);

      // Reducer also protects engine level when dispatched directly
      engine.dispatch({
        type: "RECORD_ACTION",
        action: testClinicalScenario.actions[5], // splint requires secondary-survey
      });
      // Splint should not be in history because secondary survey was not performed
      expect(
        engine.getState().actionHistory.some((a) => a.id === "apply-sam-splint")
      ).toBe(false);
    });

    it("getAvailableActions returns only actions whose preconditions are fulfilled", () => {
      const availableInitial = getAvailableActions(
        testClinicalScenario.actions,
        []
      );
      const initialIds = availableInitial.map((a) => a.id);
      expect(initialIds).toContain("sec-safety");
      expect(initialIds).toContain("interview-partner");
      expect(initialIds).not.toContain("primary-survey");
      expect(initialIds).not.toContain("apply-sam-splint");
    });
  });

  describe("3. Non-Linear Ordering", () => {
    it("allows independent actions with satisfied preconditions to be performed in any sequence", () => {
      // Sequence A: Interview witness first, then scene safety
      const engineA = createPatrolShiftEngine([testClinicalScenario], {
        initialPhase: "SCENE",
      });
      engineA.dispatch({
        type: "RECORD_ACTION",
        action: testClinicalScenario.actions[1], // interview
      });
      engineA.dispatch({
        type: "RECORD_ACTION",
        action: testClinicalScenario.actions[0], // safety
      });
      expect(engineA.getState().actionHistory[0].id).toBe("interview-partner");
      expect(engineA.getState().actionHistory[1].id).toBe("sec-safety");

      // Sequence B: Scene safety first, then interview witness
      const engineB = createPatrolShiftEngine([testClinicalScenario], {
        initialPhase: "SCENE",
      });
      engineB.dispatch({
        type: "RECORD_ACTION",
        action: testClinicalScenario.actions[0], // safety
      });
      engineB.dispatch({
        type: "RECORD_ACTION",
        action: testClinicalScenario.actions[1], // interview
      });
      expect(engineB.getState().actionHistory[0].id).toBe("sec-safety");
      expect(engineB.getState().actionHistory[1].id).toBe("interview-partner");

      // Both sequences unlock primary survey identically
      expect(
        checkActionPreconditions(
          testClinicalScenario.actions[2],
          engineA.getState().actionHistory
        )
      ).toBe(true);
      expect(
        checkActionPreconditions(
          testClinicalScenario.actions[2],
          engineB.getState().actionHistory
        )
      ).toBe(true);
    });
  });

  describe("4. Dynamic State Transitions & Scene Safety Neglect", () => {
    it("causes patient condition to worsen when invasive treatment is attempted without scene safety", () => {
      // Create an action that attempts splinting without scene safety
      const unsafeSplintAction: ScenarioAction = {
        id: "unsafe-splint",
        label: "Quick Splint without Scene Marking",
        category: "treatment",
        requiresSceneSafety: true,
        costMinutes: 3,
      };

      const engine = createPatrolShiftEngine(
        [
          {
            ...testClinicalScenario,
            actions: [unsafeSplintAction],
          },
        ],
        { initialPhase: "SCENE" }
      );

      expect(engine.getState().patientCondition).toBe("stable");
      expect(engine.getState().sceneSafetyStatus).toBe("unassessed");

      engine.dispatch({ type: "RECORD_ACTION", action: unsafeSplintAction });

      // Condition worsens and hazard alert is generated
      expect(engine.getState().patientCondition).toBe("worsened");
      expect(engine.getState().sceneSafetyStatus).toBe("compromised");
      expect(
        engine
          .getState()
          .activeEvents.some(
            (e) => e.type === "HAZARD_ALERT" || e.action === "HAZARD_ALERT"
          )
      ).toBe(true);
      // Verify HAZARD_ALERT is recorded into event history audit log
      expect(
        engine
          .getEventHistory()
          .some((e) => e.type === "HAZARD_ALERT" || e.action === "HAZARD_ALERT")
      ).toBe(true);

      // Subsequent vital check reflects elevated tachycardia
      engine.dispatch({
        type: "CHECK_VITALS",
        vitals: { heartRate: 76, respiration: 16 },
      });
      expect(engine.getState().currentVitals?.heartRate).toBe(96); // 76 + 20
      expect(engine.getState().currentVitals?.respiration).toBe(22); // 16 + 6

      // Condition monitoring: reassess and stabilize patient
      engine.dispatch({
        type: "REASSESS_PATIENT",
        payload: { condition: "stable" },
      });
      expect(engine.getState().patientCondition).toBe("stable");

      // Critical and deteriorating conditions also adjust vitals appropriately
      engine.dispatch({
        type: "REASSESS_PATIENT",
        payload: { condition: "critical" },
      });
      engine.dispatch({
        type: "CHECK_VITALS",
        vitals: { heartRate: 80, respiration: 18 },
      });
      expect(engine.getState().currentVitals?.heartRate).toBe(100);
      expect(engine.getState().currentVitals?.respiration).toBe(24);
    });

    it("secures scene safety when uphill hazard marking action is executed", () => {
      const engine = createPatrolShiftEngine([testClinicalScenario], {
        initialPhase: "SCENE",
      });

      expect(engine.getState().sceneSafetySecured).toBe(false);

      engine.dispatch({
        type: "RECORD_ACTION",
        action: testClinicalScenario.actions[0], // sec-safety
      });

      expect(engine.getState().sceneSafetySecured).toBe(true);
      expect(engine.getState().sceneSafetyStatus).toBe("safe");

      // Scene safety re-assessment confirms safety
      engine.dispatch({ type: "ASSESS_SCENE_SAFETY" });
      expect(engine.getState().sceneSafetyStatus).toBe("safe");
    });
  });

  describe("5. PatrolEvent Logging & Comprehensive Audit Trail", () => {
    it("records every action, vital check, and safety assessment into event history", () => {
      const engine = createPatrolShiftEngine([testClinicalScenario], {
        initialPhase: "SCENE",
      });

      // 1. Record scene action
      engine.dispatch({
        type: "RECORD_ACTION",
        action: testClinicalScenario.actions[0], // sec-safety
      });

      // 2. Explicit vital check dispatch
      engine.dispatch({
        type: "CHECK_VITALS",
        vitals: {
          heartRate: 72,
          respiration: 14,
          bpSystolic: 120,
          bpDiastolic: 80,
        },
      });

      // 3. Scene safety re-assessment
      engine.dispatch({ type: "ASSESS_SCENE_SAFETY" });

      // 4. Condition re-assessment
      engine.dispatch({ type: "REASSESS_PATIENT" });

      const history = engine.getEventHistory();
      const actionTypes = history.map((e) => e.action);

      expect(actionTypes).toContain("sec-safety");
      expect(actionTypes).toContain("VITALS_CHECK");
      expect(actionTypes).toContain("SCENE_SAFETY_ASSESSMENT");
      expect(actionTypes).toContain("REASSESS_PATIENT");

      const vitalsEvent = history.find((e) => e.action === "VITALS_CHECK");
      expect(vitalsEvent?.context?.vitals).toBeDefined();
    });
  });

  describe("6. Boundary Values & Edge Case Defenses", () => {
    it("handles null scenario, empty histories, and undefined values gracefully", () => {
      expect(deriveRevealedPatientState(null, [])).toEqual({});
      expect(deriveRevealedEnvironmentState(null, [])).toEqual({});
      expect(deriveRevealedActors(null, [])).toEqual([]);

      // Render PatientCard with null scenario
      render(<PatientCard scenario={null} />);
      expect(screen.getByTestId("patient-card")).toBeDefined();
      expect(screen.getByText(/Pending primary assessment/i)).toBeDefined();
      expect(screen.getByText(/Pending witness interview/i)).toBeDefined();
    });

    it("accumulates multiple sequential vitals readings without mutation bugs", () => {
      const engine = createPatrolShiftEngine([testClinicalScenario], {
        initialPhase: "SCENE",
      });

      engine.dispatch({
        type: "CHECK_VITALS",
        vitals: { heartRate: 72, respiration: 14 },
      });
      engine.dispatch({
        type: "CHECK_VITALS",
        vitals: { heartRate: 76, respiration: 16 },
      });
      engine.dispatch({
        type: "CHECK_VITALS",
        vitals: { heartRate: 80, respiration: 18 },
      });

      expect(engine.getState().vitalsHistory).toHaveLength(3);
      expect(engine.getState().currentVitals?.heartRate).toBe(80);
    });

    it("verifies minimum 44x44px touch targets on all interactive scene buttons", () => {
      render(
        <SceneInteraction
          scenario={testClinicalScenario}
          actionHistory={[]}
          onExecuteAction={() => {}}
          onPrepareTransport={() => {}}
          onAssessSceneSafety={() => {}}
        />
      );

      const actionCards = screen.getAllByRole("button");
      for (const btn of actionCards) {
        expect(btn.className).toMatch(/min-h-\[44px\]/);
        expect(btn.className).toMatch(/min-w-\[44px\]/);
      }
    });
  });

  describe("7. HandoffPanel Care Transfer & Evaluated Facts", () => {
    it("displays unassessed placeholder notices when facts were not evaluated on hill", () => {
      const completeSpy = () => {};
      render(
        <HandoffPanel
          scenario={testClinicalScenario}
          actionHistory={[]}
          timeElapsedMinutes={8}
          patientCondition="stable"
          onCompleteHandoff={completeSpy}
        />
      );

      expect(screen.getByText(/Mechanism unconfirmed on scene/i)).toBeDefined();
      expect(
        screen.getByText(
          /Detailed secondary physical exam was not completed on scene/i
        )
      ).toBeDefined();
      expect(
        screen.getByText(
          /No vital signs obtained on scene: priority triage handover/i
        )
      ).toBeDefined();
      expect(
        screen.getByText(
          /No splints, bandages, or active interventions applied on hill/i
        )
      ).toBeDefined();
      expect(screen.getByTestId("handoff-condition").textContent).toContain(
        "stable"
      );
    });

    it("displays evaluated facts when patient was assessed and treated on scene", () => {
      render(
        <HandoffPanel
          scenario={testClinicalScenario}
          actionHistory={testClinicalScenario.actions}
          vitalsHistory={[
            {
              heartRate: 78,
              respiration: 16,
              bpSystolic: 122,
              bpDiastolic: 80,
              spo2: 98,
            },
          ]}
          revealedPatient={{
            complaint: "Sharp pain in lower tibia",
            mechanism: "Caught edge at 30mph, rotational tumble",
            findings: [
              "Point tenderness over mid-shaft tibia",
              "Distal PMS intact",
            ],
            interventions: [
              "SAM splint applied to lower leg",
              "Wool blanket wrapped",
            ],
          }}
          timeElapsedMinutes={22}
          patientCondition="critical"
          onCompleteHandoff={() => {}}
        />
      );

      expect(screen.getByText(/Caught edge at 30mph/i)).toBeDefined();
      expect(screen.getByText(/Sharp pain in lower tibia/i)).toBeDefined();
      expect(
        screen.getByText(/Point tenderness over mid-shaft tibia/i)
      ).toBeDefined();
      expect(
        screen.getByText(/SAM splint applied to lower leg/i)
      ).toBeDefined();
      expect(screen.getByText(/78 bpm/i)).toBeDefined();
      expect(screen.getByTestId("handoff-condition").textContent).toContain(
        "critical"
      );
      expect(screen.getByTestId("handoff-condition").className).toContain(
        "text-rose-400"
      );
    });

    it("allows toggling report attestation and triggers care transfer callback", () => {
      let handedOver = false;
      render(
        <HandoffPanel
          scenario={testClinicalScenario}
          actionHistory={[]}
          timeElapsedMinutes={15}
          onCompleteHandoff={() => {
            handedOver = true;
          }}
        />
      );

      const checkbox = screen.getByTestId(
        "handoff-attest-checkbox"
      ) as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);

      const transferBtn = screen.getByRole("button", {
        name: /Transfer Care & Complete Log/i,
      });
      fireEvent.click(transferBtn);
      expect(handedOver).toBe(true);
    });
  });

  describe("8. PatrolShiftContainer Integration with OEC Scenario", () => {
    it("loads the M5 OEC scenario when initialScenarioId is provided", () => {
      render(<PatrolShiftContainer initialScenarioId="upper-ridge-injury" />);

      // Verify container renders and disclaimer is accessible
      expect(screen.getByTestId("patrol-shift-container")).toBeDefined();
      expect(screen.getByTestId("medical-disclaimer-banner")).toBeDefined();
      expect(
        screen.getByText(/Outdoor Emergency Care.*Toboggan Handling/i)
      ).toBeDefined();
    });
  });
});
