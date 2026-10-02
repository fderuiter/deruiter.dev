// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import {
  createPatrolShiftEngine,
  reduceShiftState,
  createInitialShiftState,
  type PatrolScenario,
  type ShiftState,
  type ShiftEngineEvent,
} from "@/lib/patrol";

const dummyScenario: PatrolScenario = {
  id: "test-scenario-alpha",
  title: "Test Wrist Sprain",
  subtitle: "Simple beginner incident test fixture",
  description: "A skier with a mild wrist injury near lower mountain.",
  difficulty: "beginner",
  estimatedMinutes: 10,
  location: "Lower Chair 1",
  actions: [
    {
      id: "assess-scene",
      label: "Assess Scene Safety",
      category: "assessment",
      costMinutes: 2,
    },
    {
      id: "splint-wrist",
      label: "Apply SAM Splint",
      category: "treatment",
      costMinutes: 5,
    },
  ],
  debriefRules: [
    {
      id: "rule-safety",
      title: "Scene Safety",
      category: "protocol",
      passed: true,
      score: 100,
      feedback: "Scene verified safe before approach.",
    },
  ],
};

const dummyScenarioBeta: PatrolScenario = {
  id: "test-scenario-beta",
  title: "Test Lost Skier",
  subtitle: "Trail search incident fixture",
  description: "A guest reports an overdue skier in the glades.",
  difficulty: "intermediate",
  estimatedMinutes: 15,
  location: "North Glade Boundary",
  actions: [
    {
      id: "contact-dispatch",
      label: "Report Boundary Search",
      category: "communication",
      costMinutes: 3,
    },
  ],
  debriefRules: [],
};

describe("Patrol Shift Headless FSM Engine (Issue #748)", () => {
  it("executes the full happy-path transition lifecycle from INTRO to SHIFT_COMPLETE", () => {
    const engine = createPatrolShiftEngine([dummyScenario]);
    expect(engine.getState().phase).toBe("INTRO");
    expect(engine.getState().isCompleted).toBe(false);

    // 1. INTRO -> BRIEFING
    engine.dispatch({ type: "START_SHIFT" });
    expect(engine.getState().phase).toBe("BRIEFING");

    // 2. BRIEFING -> PATROL_MAP
    engine.dispatch({ type: "COMPLETE_BRIEFING" });
    expect(engine.getState().phase).toBe("PATROL_MAP");

    // 3. PATROL_MAP -> DISPATCH
    engine.dispatch({
      type: "RECEIVE_DISPATCH",
      scenarioId: dummyScenario.id,
    });
    expect(engine.getState().phase).toBe("DISPATCH");
    expect(engine.getState().currentScenarioId).toBe(dummyScenario.id);

    // 4. DISPATCH -> RESPONDING
    engine.dispatch({ type: "ACCEPT_DISPATCH" });
    expect(engine.getState().phase).toBe("RESPONDING");

    // 5. RESPONDING -> SCENE
    engine.dispatch({ type: "ARRIVE_ON_SCENE" });
    expect(engine.getState().phase).toBe("SCENE");

    // 6. Record scene action
    engine.dispatch({
      type: "RECORD_ACTION",
      action: dummyScenario.actions[0],
    });
    expect(engine.getState().timeElapsedMinutes).toBe(2);
    expect(engine.getState().actionHistory).toHaveLength(1);

    // 7. SCENE -> TRANSPORT_PREP
    engine.dispatch({ type: "COMPLETE_SCENE" });
    expect(engine.getState().phase).toBe("TRANSPORT_PREP");

    // 8. TRANSPORT_PREP -> OET
    engine.dispatch({ type: "BEGIN_TRANSPORT" });
    expect(engine.getState().phase).toBe("OET");

    // 9. OET -> HANDOFF
    engine.dispatch({ type: "ARRIVE_AT_BASE" });
    expect(engine.getState().phase).toBe("HANDOFF");

    // 10. HANDOFF -> DEBRIEF
    engine.dispatch({ type: "COMPLETE_HANDOFF" });
    expect(engine.getState().phase).toBe("DEBRIEF");

    // 11. DEBRIEF -> PATROL_MAP (Hub)
    engine.dispatch({ type: "FINISH_DEBRIEF" });
    expect(engine.getState().phase).toBe("PATROL_MAP");
    expect(engine.getState().incidentsCompleted).toBe(1);
    expect(engine.getState().currentScenarioId).toBeNull();

    // 12. PATROL_MAP -> SHIFT_COMPLETE
    engine.dispatch({ type: "COMPLETE_SHIFT" });
    expect(engine.getState().phase).toBe("SHIFT_COMPLETE");
    expect(engine.getState().isCompleted).toBe(true);
  });

  it("supports multiple dispatch cycles from the PATROL_MAP hub before shift completion", () => {
    const engine = createPatrolShiftEngine([dummyScenario, dummyScenarioBeta], {
      initialPhase: "PATROL_MAP",
    });

    expect(engine.getState().phase).toBe("PATROL_MAP");
    expect(engine.getState().incidentsCompleted).toBe(0);

    // First incident cycle (Alpha)
    engine.dispatch({ type: "RECEIVE_DISPATCH", scenarioId: dummyScenario.id });
    engine.dispatch({ type: "ACCEPT_DISPATCH" });
    engine.dispatch({ type: "ARRIVE_ON_SCENE" });
    engine.dispatch({ type: "COMPLETE_SCENE" });
    engine.dispatch({ type: "BEGIN_TRANSPORT" });
    engine.dispatch({ type: "ARRIVE_AT_BASE" });
    engine.dispatch({ type: "COMPLETE_HANDOFF" });
    engine.dispatch({ type: "FINISH_DEBRIEF" });

    expect(engine.getState().phase).toBe("PATROL_MAP");
    expect(engine.getState().incidentsCompleted).toBe(1);

    // Second incident cycle (Beta)
    engine.dispatch({
      type: "RECEIVE_DISPATCH",
      scenarioId: dummyScenarioBeta.id,
    });
    expect(engine.getState().phase).toBe("DISPATCH");
    expect(engine.getState().currentScenarioId).toBe(dummyScenarioBeta.id);

    engine.dispatch({ type: "ACCEPT_DISPATCH" });
    engine.dispatch({ type: "ARRIVE_ON_SCENE" });
    engine.dispatch({ type: "COMPLETE_SCENE" });
    engine.dispatch({ type: "BEGIN_TRANSPORT" });
    engine.dispatch({ type: "ARRIVE_AT_BASE" });
    engine.dispatch({ type: "COMPLETE_HANDOFF" });
    engine.dispatch({ type: "FINISH_DEBRIEF" });

    expect(engine.getState().phase).toBe("PATROL_MAP");
    expect(engine.getState().incidentsCompleted).toBe(2);

    // Wrap up shift
    engine.dispatch({ type: "COMPLETE_SHIFT" });
    expect(engine.getState().phase).toBe("SHIFT_COMPLETE");
    expect(engine.getState().isCompleted).toBe(true);
  });

  it("accumulates events in event history and returns defensive immutable copies", () => {
    const engine = createPatrolShiftEngine([dummyScenario]);

    engine.dispatch({ type: "START_SHIFT" });
    engine.dispatch({ type: "COMPLETE_BRIEFING" });

    const history1 = engine.getEventHistory();
    expect(history1.length).toBeGreaterThanOrEqual(2);

    // Modifying the returned array should not affect internal engine history
    history1.push({
      timestamp: Date.now(),
      scenarioId: "rogue",
      action: "ROGUE_MUTATION",
    });

    const history2 = engine.getEventHistory();
    expect(history2).not.toContainEqual(
      expect.objectContaining({ action: "ROGUE_MUTATION" })
    );
  });

  it("enforces boundary defense against invalid transitions without throwing or corrupting state", () => {
    const engine = createPatrolShiftEngine([dummyScenario]);
    expect(engine.getState().phase).toBe("INTRO");

    // Invalid transition: cannot jump directly from INTRO to SCENE
    engine.dispatch({ type: "ARRIVE_ON_SCENE" });
    expect(engine.getState().phase).toBe("INTRO");

    // Invalid transition: cannot jump from INTRO to OET
    engine.dispatch({ type: "BEGIN_TRANSPORT" });
    expect(engine.getState().phase).toBe("INTRO");

    // Invalid transition: cannot complete shift from INTRO
    engine.dispatch({ type: "COMPLETE_SHIFT" });
    expect(engine.getState().phase).toBe("INTRO");
    expect(engine.getState().isCompleted).toBe(false);
  });

  it("notifies subscribers on state changes and unmounts listeners cleanly", () => {
    const engine = createPatrolShiftEngine([dummyScenario]);
    const listener = vi.fn();

    const unsubscribe = engine.subscribe(listener);

    engine.dispatch({ type: "START_SHIFT" });
    expect(listener).toHaveBeenCalledTimes(1);

    engine.dispatch({ type: "COMPLETE_BRIEFING" });
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();

    engine.dispatch({ type: "RECEIVE_DISPATCH", scenarioId: dummyScenario.id });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("pure reducer reduceShiftState produces deterministic results", () => {
    const initial: ShiftState = createInitialShiftState(null, "INTRO");
    const step1 = reduceShiftState(initial, { type: "START_SHIFT" });
    expect(step1.phase).toBe("BRIEFING");

    // Unknown action returns same state reference
    const unchanged = reduceShiftState(
      step1,
      fromAny<ShiftEngineEvent, unknown>({ type: "UNKNOWN_ACTION" })
    );
    expect(unchanged).toBe(step1);
  });

  it("updates score dynamically on FINISH_DEBRIEF and guards against duplicate actions", () => {
    const engine = createPatrolShiftEngine([dummyScenario], {
      initialPhase: "DEBRIEF",
    });

    // Score updates from payload on finish debrief
    engine.dispatch({ type: "FINISH_DEBRIEF", payload: { score: 85 } });
    expect(engine.getState().score).toBe(85);
    expect(engine.getState().incidentsCompleted).toBe(1);

    // Duplicate action defense
    const withOneAction = reduceShiftState(engine.getState(), {
      type: "RECORD_ACTION",
      action: dummyScenario.actions[0],
    });
    expect(withOneAction.actionHistory).toHaveLength(1);
    expect(withOneAction.timeElapsedMinutes).toBe(2);

    // Recording the same action again should be ignored
    const duplicate = reduceShiftState(withOneAction, {
      type: "RECORD_ACTION",
      action: dummyScenario.actions[0],
    });
    expect(duplicate.actionHistory).toHaveLength(1);
    expect(duplicate.timeElapsedMinutes).toBe(2);
  });

  it("provides getScenarios() and clears event history on RESET", () => {
    const engine = createPatrolShiftEngine([dummyScenario, dummyScenarioBeta]);
    expect(engine.getScenarios?.()).toEqual([dummyScenario, dummyScenarioBeta]);

    engine.dispatch({ type: "START_SHIFT" });
    expect(engine.getEventHistory().length).toBeGreaterThan(0);

    engine.dispatch({ type: "RESET" });
    expect(engine.getState().phase).toBe("INTRO");
    expect(engine.getEventHistory()).toHaveLength(0);
  });
});
