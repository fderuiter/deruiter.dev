// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { fromPartial, fromAny } from "@total-typescript/shoehorn";
import {
  OetDescentEngine,
  createInitialOetDescentState,
  evaluateOETCompliance,
  calculateInjurySeverity,
  assignTransportPriority,
  createOETEngineState,
  type PatrolScenario,
  type PatientState,
  type VitalsData,
  type OetDescentState,
} from "@/lib/patrol";

interface InternalEngineState {
  state: OetDescentState;
}

const dummyScenario: PatrolScenario = {
  id: "pine-ridge-sweep",
  title: "Pine Ridge Morning Sweep",
  actions: [],
  debriefRules: [
    {
      id: "rule-oet-control",
      title: "Toboggan Descent Control",
      category: "oet",
      passed: true,
      score: 100,
      feedback: "Maintained controlled descent speed down fall line.",
    },
  ],
};

describe("Patrol Shift: Headless OET Descent Engine (M4 / #750)", () => {
  it("initializes deterministic state with chain brake deployed per OET protocol", () => {
    const engine = new OetDescentEngine({
      conditions: {
        snowCondition: "hardpack",
        narrowTrails: false,
        treeHazards: false,
      },
      totalDistance: 1000,
    });

    const snapshot = engine.createSnapshot();
    expect(snapshot.status).toBe("ready");
    expect(snapshot.sled.speedMph).toBe(0);
    expect(snapshot.isStopped).toBe(true);
    expect(snapshot.isChainBrakeEngaged).toBe(true);
    expect(snapshot.isTailRopeBraking).toBe(false);
    expect(snapshot.metrics.judgmentScore).toBe(100);
    expect(snapshot.metrics.collisions).toBe(0);
    expect(snapshot.metrics.boundaryViolations).toBe(0);
    expect(snapshot.metrics.controlledStops).toBe(0);
    expect(snapshot.trailWidth).toBe(580);
    expect(snapshot.totalDistance).toBe(1000);
  });

  it("applies condition modifiers from BriefingState: hardpack vs. fresh snow braking response", () => {
    // 1. Hardpack engine: lower drag, longer stopping distance
    const hardpackEngine = new OetDescentEngine({
      conditions: { snowCondition: "hardpack" },
    });
    hardpackEngine.setChainBrake(false);

    // Accelerate down the slope for 1.5 seconds in 60Hz ticks
    const dt = 1 / 60;
    for (let i = 0; i < 90; i++) {
      hardpackEngine.update(dt);
    }
    const hardpackSpeed = hardpackEngine.createSnapshot().currentSpeedMph;
    expect(hardpackSpeed).toBeGreaterThan(5);

    // 2. Fresh/powder snow engine: higher friction drag, lower speed
    const powderEngine = new OetDescentEngine({
      conditions: { snowCondition: "fresh" },
    });
    powderEngine.setChainBrake(false);

    for (let i = 0; i < 90; i++) {
      powderEngine.update(dt);
    }
    const powderSpeed = powderEngine.createSnapshot().currentSpeedMph;
    expect(powderSpeed).toBeLessThan(hardpackSpeed);

    // Test braking response: fresh snow stops more aggressively
    hardpackEngine.setBraking(true);
    powderEngine.setBraking(true);

    for (let i = 0; i < 30; i++) {
      hardpackEngine.update(dt);
      powderEngine.update(dt);
    }

    const powderSpeedAfterBraking =
      powderEngine.createSnapshot().currentSpeedMph;
    const hardpackSpeedAfterBraking =
      hardpackEngine.createSnapshot().currentSpeedMph;
    expect(powderSpeedAfterBraking).toBeLessThan(hardpackSpeedAfterBraking);
  });

  it("applies narrowTrails and treeHazards modifiers from BriefingState", () => {
    const standardEngine = new OetDescentEngine({
      conditions: { narrowTrails: false, treeHazards: false },
    });
    const standardState = standardEngine.createSnapshot();

    const narrowEngine = new OetDescentEngine({
      conditions: { narrowTrails: true, treeHazards: true },
    });
    const narrowState = narrowEngine.createSnapshot();

    expect(narrowState.trailWidth).toBe(360);
    expect(standardState.trailWidth).toBe(580);
    expect(narrowState.trailLeft).toBeGreaterThan(standardState.trailLeft);
    expect(narrowState.trailRight).toBeLessThan(standardState.trailRight);

    // Extra tree hazards spawned when treeHazards is true
    const standardObs = createInitialOetDescentState({
      conditions: { treeHazards: false },
    }).obstacles;
    const hazardObs = createInitialOetDescentState({
      conditions: { treeHazards: true },
    }).obstacles;
    expect(hazardObs.length).toBeGreaterThan(standardObs.length);
  });

  it("tracks chain brake and tail rope belay drag forces", () => {
    const engine = new OetDescentEngine();
    engine.setChainBrake(false);

    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      engine.update(dt);
    }
    const unbrakedSpeed = engine.createSnapshot().currentSpeedMph;

    // Deploy chain brake
    engine.setChainBrake(true);
    expect(engine.createSnapshot().isChainBrakeEngaged).toBe(true);

    for (let i = 0; i < 30; i++) {
      engine.update(dt);
    }
    const brakedSpeed = engine.createSnapshot().currentSpeedMph;
    expect(brakedSpeed).toBeLessThan(unbrakedSpeed);

    // Toggle tail rope
    engine.toggleTailRope();
    expect(engine.createSnapshot().isTailRopeBraking).toBe(true);
  });

  it("detects and records trail boundary violations when steering off-piste", () => {
    const engine = new OetDescentEngine({
      conditions: { narrowTrails: true },
    });
    engine.setChainBrake(false);

    const boundarySpy = vi.fn();
    engine.on("boundaryViolation", boundarySpy);

    // Steer hard left to cross boundary
    engine.setSteering(-1);
    const dt = 1 / 60;

    // Run until sled drifts beyond trail left margin
    for (let i = 0; i < 120; i++) {
      engine.update(dt);
    }

    const snapshot = engine.createSnapshot();
    expect(snapshot.metrics.boundaryViolations).toBeGreaterThanOrEqual(1);
    expect(boundarySpy).toHaveBeenCalled();
    expect(snapshot.metrics.judgmentScore).toBeLessThan(100);
    expect(snapshot.activeWarnings).toContain(
      "TRAIL BOUNDARY VIOLATION: GLADE RUNNER RISK"
    );
  });

  it("detects obstacle collisions, jars velocity, and penalizes judgment score", () => {
    const engine = new OetDescentEngine();
    engine.setChainBrake(false);

    const collisionSpy = vi.fn();
    engine.on("collision", collisionSpy);

    // Position sled directly inline with the first obstacle
    const firstObs = createInitialOetDescentState().obstacles[0];
    engine.stepSimulation(0.01); // initialize

    // Directly steer sled towards first obstacle
    const engineInternal = fromAny<InternalEngineState, unknown>(engine);
    engineInternal.state.sled.x = firstObs.x;
    engineInternal.state.sled.y = firstObs.y - 10;
    engineInternal.state.sled.speedMph = 10;

    // Advance simulation to trigger collision
    engine.update(1 / 60);

    const snapshot = engine.createSnapshot();
    expect(snapshot.metrics.collisions).toBeGreaterThanOrEqual(1);
    expect(collisionSpy).toHaveBeenCalled();
    expect(snapshot.metrics.judgmentScore).toBeLessThanOrEqual(75); // -25 penalty
  });

  it("detects abrupt lateral direction changes and alerts operator", () => {
    const engine = new OetDescentEngine();
    engine.setChainBrake(false);

    const abruptSpy = vi.fn();
    engine.on("abruptMotion", abruptSpy);

    // Get sled up to speed
    for (let i = 0; i < 60; i++) {
      engine.update(1 / 60);
    }

    // Abruptly jerk steering from +1 to -1 in 1 frame
    engine.setSteering(1);
    engine.update(1 / 60);
    engine.setSteering(-1);
    engine.update(1 / 60);

    const snapshot = engine.createSnapshot();
    expect(snapshot.metrics.abruptDirectionChanges).toBeGreaterThanOrEqual(1);
    expect(abruptSpy).toHaveBeenCalled();
    expect(snapshot.metrics.judgmentScore).toBeLessThan(100);
  });

  it("accumulates excessiveSpeedTime when exceeding 15 mph safe ceiling", () => {
    const engine = new OetDescentEngine({
      conditions: { snowCondition: "ice" },
    });
    engine.setChainBrake(false);

    const engineInternal = fromAny<InternalEngineState, unknown>(engine);
    engineInternal.state.sled.speedMph = 18.5; // Above 15 mph limit

    const dt = 1 / 60;
    for (let i = 0; i < 60; i++) {
      engine.update(dt);
    }

    const snapshot = engine.createSnapshot();
    expect(snapshot.metrics.excessiveSpeedTime).toBeGreaterThan(0.5);
    expect(snapshot.activeWarnings).toContain(
      "EXCESS SPEED: PATIENT RE-INJURY RISK (>15 MPH)"
    );
  });

  it("rewards smooth controlled stops with score bonuses", () => {
    const engine = new OetDescentEngine();
    engine.setChainBrake(false);

    const stopSpy = vi.fn();
    engine.on("controlledStop", stopSpy);

    // 1. Accelerate down slope to > 5 mph
    for (let i = 0; i < 90; i++) {
      engine.update(1 / 60);
    }
    expect(engine.createSnapshot().currentSpeedMph).toBeGreaterThan(4);

    // 2. Perform smooth controlled stop using wedge and chain brake
    engine.performControlledStop();
    for (let i = 0; i < 90; i++) {
      engine.update(1 / 60);
    }

    const snapshot = engine.createSnapshot();
    expect(snapshot.isStopped).toBe(true);
    expect(snapshot.currentSpeedMph).toBe(0);
    expect(snapshot.metrics.controlledStops).toBe(1);
    expect(stopSpy).toHaveBeenCalledWith({ stops: 1 });
  });

  it("completes descent at totalDistance and creates valid PatrolEvent snapshot", () => {
    const engine = new OetDescentEngine({ totalDistance: 300 });
    engine.setChainBrake(false);

    const completedSpy = vi.fn();
    engine.on("descentCompleted", completedSpy);

    // Run until finish line is reached
    const dt = 1 / 60;
    for (let i = 0; i < 400; i++) {
      engine.update(dt);
      if (engine.createSnapshot().status === "completed") break;
    }

    const snapshot = engine.createSnapshot();
    expect(snapshot.status).toBe("completed");
    expect(completedSpy).toHaveBeenCalled();

    // Verify compiled PatrolEvent
    const event = engine.createPatrolEventSnapshot("pine-ridge-sweep");
    expect(event.action).toBe("OET_TRANSPORT_COMPLETED");
    expect(event.scenarioId).toBe("pine-ridge-sweep");
    expect(event.context?.metrics).toBeDefined();

    // Verify evaluateOETCompliance integrates live judgment score
    const debrief = evaluateOETCompliance(dummyScenario, [], event);
    expect(debrief.score).toBeGreaterThan(0);
  });

  it("supports stepSimulation for step-through accessibility and headless step testing", () => {
    const engine = new OetDescentEngine();
    expect(engine.createSnapshot().sled.y).toBe(0);

    engine.stepSimulation(0.5, {
      steering: 0.5,
      brake: false,
      chainBrake: false,
    });
    expect(engine.createSnapshot().sled.y).toBeGreaterThan(0);
    expect(engine.createSnapshot().sled.steering).toBe(0.5);
  });

  it("allows resuming downhill descent after a controlled check stop when releasing chain brake", () => {
    const engine = new OetDescentEngine();
    engine.setChainBrake(false);

    // 1. Accelerate down slope
    for (let i = 0; i < 90; i++) {
      engine.update(1 / 60);
    }
    expect(engine.createSnapshot().currentSpeedMph).toBeGreaterThan(4);

    // 2. Perform controlled stop
    engine.performControlledStop();
    for (let i = 0; i < 90; i++) {
      engine.update(1 / 60);
    }
    expect(engine.createSnapshot().isStopped).toBe(true);
    expect(engine.createSnapshot().currentSpeedMph).toBe(0);

    // 3. Release chain brake to resume gliding
    engine.setChainBrake(false);
    for (let i = 0; i < 60; i++) {
      engine.update(1 / 60);
    }

    // Sled should resume accelerating downhill, not remain stuck
    const resumedSnap = engine.createSnapshot();
    expect(resumedSnap.isStopped).toBe(false);
    expect(resumedSnap.currentSpeedMph).toBeGreaterThan(1.0);
  });

  it("prevents lateral sliding when sled is completely stopped", () => {
    const engine = new OetDescentEngine();
    // Engine starts stopped with chain brake engaged
    expect(engine.createSnapshot().isStopped).toBe(true);
    expect(engine.createSnapshot().currentSpeedMph).toBe(0);
    const initialX = engine.createSnapshot().sled.x;

    // Operator turns handles hard left while stopped on snow
    engine.setSteering(-1);
    for (let i = 0; i < 60; i++) {
      engine.update(1 / 60);
    }

    // Sled must not move sideways without forward momentum
    expect(engine.createSnapshot().sled.x).toBe(initialX);
    expect(engine.createSnapshot().sled.vx).toBe(0);
    expect(engine.createSnapshot().metrics.boundaryViolations).toBe(0);
  });

  it("dynamically evaluates OET debrief rules as passing or failing based on judgment score threshold (70%)", () => {
    const scenarioWithOetRule: PatrolScenario = {
      id: "oet-test-scenario",
      title: "OET Evaluation Test",
      actions: [],
      debriefRules: [
        {
          id: "rule-oet-control",
          title: "Toboggan Descent Control",
          category: "oet",
          passed: false, // initial default
          score: 100,
          feedback: "Pending descent evaluation.",
        },
      ],
    };

    // 1. Passing run (judgment score 85)
    const passingEvent = {
      timestamp: Date.now(),
      action: "OET_TRANSPORT_COMPLETED",
      payload: { judgmentScore: 85 },
    };
    const passResult = evaluateOETCompliance(
      scenarioWithOetRule,
      [],
      passingEvent
    );
    expect(passResult.score).toBe(91); // 85 * 0.6 + 100 * 0.4 = 91
    expect(passResult.passedCount).toBe(1);
    expect(passResult.failedCount).toBe(0);
    expect(passResult.evaluatedRules[0].passed).toBe(true);
    expect(passResult.evaluatedRules[0].feedback).toContain("passing standard");

    // 2. Failing run (judgment score 40 due to collisions)
    const failingEvent = {
      timestamp: Date.now(),
      action: "OET_TRANSPORT_COMPLETED",
      payload: { judgmentScore: 40 },
    };
    const failResult = evaluateOETCompliance(
      scenarioWithOetRule,
      [],
      failingEvent
    );
    expect(failResult.passedCount).toBe(0);
    expect(failResult.failedCount).toBe(1);
    expect(failResult.evaluatedRules[0].passed).toBe(false);
    expect(failResult.evaluatedRules[0].feedback).toContain(
      "below passing standard"
    );
  });

  it("transitions status to crashed and halts simulation upon reaching 4 collisions", () => {
    const engine = new OetDescentEngine();
    const engineInternal = fromAny<InternalEngineState, unknown>(engine);

    // Simulate 3 collisions
    engineInternal.state.metrics.collisions = 3;

    // Trigger 4th collision
    const obs = createInitialOetDescentState().obstacles[0];
    engineInternal.state.sled.x = obs.x;
    engineInternal.state.sled.y = obs.y - 5;
    engineInternal.state.sled.speedMph = 10;

    engine.update(1 / 60);

    expect(engine.createSnapshot().status).toBe("crashed");
    expect(engine.createSnapshot().metrics.collisions).toBe(4);
  });

  it("handles gate traversals: records cleared gates vs. missed gates", () => {
    const engine = new OetDescentEngine({ totalDistance: 1000 });
    engine.setChainBrake(false);

    const clearedSpy = vi.fn();
    const missedSpy = vi.fn();

    engine.on("gateCleared", clearedSpy);
    engine.on("gateMissed", missedSpy);

    const internal = fromAny<InternalEngineState, unknown>(engine);

    // Position sled right before gate 1 (y=220) and aligned inside gate x range
    const gate1 = internal.state.gates[0];
    internal.state.sled.y = gate1.y - 1;
    internal.state.sled.x = (gate1.xMin + gate1.xMax) / 2;
    internal.state.sled.speedMph = 10;

    engine.update(1 / 60);
    expect(clearedSpy).toHaveBeenCalledWith({ gateId: gate1.id });

    // Position sled right before gate 2 and steer outside gate x range
    const gate2 = internal.state.gates[1];
    internal.state.sled.y = gate2.y - 1;
    internal.state.sled.x = gate2.xMax + 50; // Outside gate
    internal.state.sled.speedMph = 10;

    engine.update(1 / 60);
    expect(missedSpy).toHaveBeenCalledWith({ gateId: gate2.id });
  });

  it("initializes legacy OET state correctly", () => {
    const state = createOETEngineState();
    expect(state).toEqual({
      evaluatedCount: 0,
      rulesPassed: 0,
      rulesFailed: 0,
    });
  });

  it("calculates injury severity across clinical parameters and mechanisms", () => {
    // 1. Critical patient with compromised vitals
    const criticalVitals: VitalsData = {
      avpu: "U",
      gcs: 7,
      spo2: 82,
      respiration: 8,
      heartRate: 140,
      bpSystolic: 80,
      pms: "absent",
    };
    const criticalPatient: Partial<PatientState> = {
      complaint: "Severe spinal trauma and head injury",
      mechanism: "High-speed collision with tree impact",
      vitals: criticalVitals,
    };

    const criticalResult = calculateInjurySeverity(criticalPatient);
    expect(criticalResult.level).toBe("critical");
    expect(criticalResult.score).toBe(100);
    expect(criticalResult.vitalsCompromised).toBe(true);
    expect(criticalResult.spinalPrecautionRequired).toBe(true);
    expect(criticalResult.factors.length).toBeGreaterThan(4);

    // 2. Moderate patient with extremity fracture
    const moderatePatient: Partial<PatientState> = {
      complaint: "Isolated closed tibia fracture",
      mechanism: "Catching an edge on groomed snow",
      vitals: {
        avpu: "A",
        gcs: 15,
        spo2: 98,
        respiration: 16,
        heartRate: 88,
        bpSystolic: 120,
        pms: "intact",
      },
    };
    const moderateResult = calculateInjurySeverity(moderatePatient);
    expect(moderateResult.level).toBe("moderate");
    expect(moderateResult.vitalsCompromised).toBe(false);

    // 3. Minor patient
    const minorPatient: Partial<PatientState> = {
      complaint: "Minor wrist sprain",
      vitals: { avpu: "A", gcs: 15, spo2: 99, respiration: 14, heartRate: 72 },
    };
    const minorResult = calculateInjurySeverity(minorPatient);
    expect(minorResult.level).toBe("minor");
    expect(minorResult.score).toBeLessThan(25);
  });

  it("assigns transport priority ratings (RED, YELLOW, GREEN, BLACK)", () => {
    // RED Priority
    const redPriority = assignTransportPriority({
      complaint: "Unresponsive head injury",
      mechanism: "High-speed tree impact",
      vitals: { avpu: "U", gcs: 6, spo2: 80, respiration: 6 },
    });
    expect(redPriority.priority).toBe("RED");
    expect(redPriority.numericPriority).toBe(1);
    expect(redPriority.tobogganRequired).toBe(true);
    expect(redPriority.alsInterventionRequired).toBe(true);

    // YELLOW Priority
    const yellowPriority = assignTransportPriority({
      complaint: "Femur fracture",
      mechanism: "Ski twist",
      vitals: { avpu: "A", gcs: 15, spo2: 98, respiration: 18, heartRate: 110 },
    });
    expect(yellowPriority.priority).toBe("YELLOW");
    expect(yellowPriority.numericPriority).toBe(2);
    expect(yellowPriority.tobogganRequired).toBe(true);

    // GREEN Priority
    const greenPriority = assignTransportPriority({
      complaint: "Thumb sprain",
      vitals: { avpu: "A", gcs: 15, spo2: 99, respiration: 12, heartRate: 70 },
    });
    expect(greenPriority.priority).toBe("GREEN");
    expect(greenPriority.numericPriority).toBe(3);
    expect(greenPriority.tobogganRequired).toBe(false);

    // BLACK Priority
    const blackPriority = assignTransportPriority({
      complaint: "Unresponsive",
      vitals: { avpu: "U", gcs: 3, respiration: 0, heartRate: 0 },
    });
    expect(blackPriority.priority).toBe("BLACK");
    expect(blackPriority.numericPriority).toBe(0);
  });

  it("evaluates patient transport on engine instance via evaluatePatientTransport", () => {
    const engine = new OetDescentEngine();
    const evaluation = engine.evaluatePatientTransport(
      {
        complaint: "Suspected neck pain after collision",
        mechanism: "high-speed collision",
      },
      { avpu: "A", gcs: 15, spo2: 97, respiration: 18 }
    );

    expect(evaluation.severity).toBeDefined();
    expect(evaluation.priority).toBeDefined();
    expect(evaluation.priority.tobogganRequired).toBe(true);
    expect(evaluation.severity.spinalPrecautionRequired).toBe(true);
  });

  it("evaluates patient transport end-to-end assigning BLACK priority for an apneic/pulseless patient", () => {
    const engine = new OetDescentEngine();
    const evaluation = engine.evaluatePatientTransport(
      { complaint: "Unresponsive skier found in tree well" },
      { avpu: "U", gcs: 3, respiration: 0, heartRate: 0 }
    );

    expect(evaluation.priority.priority).toBe("BLACK");
    expect(evaluation.priority.numericPriority).toBe(0);
    expect(evaluation.priority.rationale).toContain(
      "Apneic and pulseless patient on scene"
    );
  });

  it("provides viewport, input manager, game loop, and rendering without errors", () => {
    const engine = new OetDescentEngine({
      conditions: { treeHazards: true, snowCondition: "fresh" },
    });

    expect(engine.getViewport()).toBeDefined();
    const inputManager = engine.getInputManager();
    expect(inputManager).toBeDefined();
    expect(engine.createGameLoop()).toBeDefined();

    // Test render on mock canvas context
    const mockCtx = fromPartial<CanvasRenderingContext2D>({
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 1,
      setLineDash: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      roundRect: vi.fn(),
      ellipse: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
    });

    // Advance simulation to spawn particles and position elements
    engine.setChainBrake(false);
    for (let i = 0; i < 30; i++) {
      engine.update(1 / 60);
    }

    // Mark obstacles hit to exercise hit render path
    fromAny<InternalEngineState, unknown>(engine).state.obstacles[0].hit = true;

    expect(() => engine.render(mockCtx, 1)).not.toThrow();

    // Verify engine re-init and destroy
    engine.init();
    expect(engine.createSnapshot().status).toBe("ready");
    expect(() => engine.destroy()).not.toThrow();
  });
});
