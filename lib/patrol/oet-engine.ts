import {
  ArcadeEngine,
  ArcadeGameLoop,
  ArcadeViewport,
  ArcadeInputManager,
  ObjectPool,
  clamp,
} from "@/lib/arcade";
import type {
  OETEngineState,
  PatrolScenario,
  ScenarioAction,
  PatrolEvent,
  BriefingState,
  OetMetrics,
  OetObstacle,
  OetGate,
  SnowSprayParticle,
  OetSledState,
  OetDescentState,
  OetDescentSnapshot,
  OetDescentEngineOptions,
  DebriefRule,
  VitalsData,
  PatientState,
} from "./types";

/**
 * Creates legacy initial OET engine state for backward compatibility.
 */
export function createOETEngineState(): OETEngineState {
  return {
    evaluatedCount: 0,
    rulesPassed: 0,
    rulesFailed: 0,
  };
}

/**
 * Generates initial mutable simulation state for the OET toboggan descent engine.
 */
export function createInitialOetDescentState(
  options?: OetDescentEngineOptions
): OetDescentState {
  const conditions: BriefingState = options?.conditions ?? {
    snowCondition: "hardpack",
    narrowTrails: false,
    treeHazards: false,
  };

  const isNarrow = Boolean(conditions.narrowTrails);
  const trailWidth = isNarrow ? 360 : (options?.trailWidth ?? 580);
  const baseCanvasWidth = 800;
  const trailLeft = Math.round((baseCanvasWidth - trailWidth) / 2);
  const trailRight = trailLeft + trailWidth;
  const totalDistance = options?.totalDistance ?? 1500;

  const initialSled: OetSledState = {
    x: Math.round((trailLeft + trailRight) / 2),
    y: 0,
    vx: 0,
    vy: 0,
    speedMph: 0,
    steering: 0,
    chainBrakeEngaged: true, // Standard OET: chain brake deployed before descent starts
    tailRopeBraking: false,
    isStopped: true,
  };

  const initialMetrics: OetMetrics = {
    excessiveSpeedTime: 0,
    abruptDirectionChanges: 0,
    boundaryViolations: 0,
    collisions: 0,
    controlledStops: 0,
    routeEfficiency: 100,
    judgmentScore: 100,
  };

  // Seed fall-line guide gates at regular vertical intervals
  const gates: OetGate[] = [];
  const gateInterval = 220;
  const gateCount = Math.floor((totalDistance - 100) / gateInterval);
  const gateWidth = isNarrow ? 140 : 200;

  for (let i = 1; i <= gateCount; i++) {
    const y = i * gateInterval;
    // Alternate gentle slalom offset while staying well within trail boundaries
    const offset = (i % 2 === 0 ? 1 : -1) * (isNarrow ? 25 : 55);
    const centerX = (trailLeft + trailRight) / 2 + offset;
    const xMin = Math.max(trailLeft + 20, centerX - gateWidth / 2);
    const xMax = Math.min(trailRight - 20, centerX + gateWidth / 2);

    gates.push({
      id: `gate-${i}`,
      y,
      xMin,
      xMax,
    });
  }

  // Seed deterministic terrain obstacles
  const obstacles: OetObstacle[] = [
    {
      id: "obs-tree-1",
      x: trailLeft + (isNarrow ? 40 : 70),
      y: 180,
      radius: 16,
      type: "tree",
    },
    {
      id: "obs-rock-1",
      x: (trailLeft + trailRight) / 2 + (isNarrow ? 30 : 60),
      y: 360,
      radius: 14,
      type: "rock",
    },
    {
      id: "obs-ice-1",
      x: (trailLeft + trailRight) / 2 - (isNarrow ? 25 : 45),
      y: 580,
      radius: 20,
      type: "ice_patch",
    },
    {
      id: "obs-mogul-1",
      x: trailRight - (isNarrow ? 45 : 80),
      y: 820,
      radius: 16,
      type: "mogul",
    },
    {
      id: "obs-rock-2",
      x: trailLeft + (isNarrow ? 50 : 90),
      y: 1060,
      radius: 14,
      type: "rock",
    },
    {
      id: "obs-tree-2",
      x: (trailLeft + trailRight) / 2 + (isNarrow ? 35 : 70),
      y: 1280,
      radius: 16,
      type: "tree",
    },
  ];

  // If tree hazards modifier is active, populate extra tree hazards along margins and inside trail
  if (conditions.treeHazards) {
    obstacles.push(
      {
        id: "hazard-tree-edge-1",
        x: trailLeft + 25,
        y: 280,
        radius: 16,
        type: "tree",
      },
      {
        id: "hazard-tree-mid-1",
        x: (trailLeft + trailRight) / 2 - 20,
        y: 470,
        radius: 16,
        type: "tree",
      },
      {
        id: "hazard-tree-edge-2",
        x: trailRight - 25,
        y: 720,
        radius: 16,
        type: "tree",
      },
      {
        id: "hazard-tree-mid-2",
        x: (trailLeft + trailRight) / 2 + 30,
        y: 940,
        radius: 16,
        type: "tree",
      },
      {
        id: "hazard-tree-edge-3",
        x: trailLeft + 30,
        y: 1180,
        radius: 16,
        type: "tree",
      }
    );
  }

  return {
    sled: initialSled,
    status: "ready",
    conditions,
    trailWidth,
    trailLeft,
    trailRight,
    totalDistance,
    distanceTraveled: 0,
    obstacles,
    gates,
    metrics: initialMetrics,
    elapsedTime: 0,
    activeWarnings: [],
  };
}

/**
 * Headless Outdoor Emergency Transportation (OET) Descent Engine.
 *
 * Implements deterministic 60Hz physics modeling a Cascade 100 rescue toboggan
 * carrying a packaged patient down a 24° fall-line slope. Rewards operator control,
 * snowplow/sideslip edge discipline, and chain-brake management over raw descent speed.
 *
 * Adheres to ADR 0026 and ADR 0019. Testable in pure Node.js/Vitest without DOM dependencies.
 */
export class OetDescentEngine extends ArcadeEngine<
  OetDescentState,
  OetDescentSnapshot
> {
  private readonly snowSprayPool: ObjectPool<SnowSprayParticle>;
  private readonly viewport: ArcadeViewport;
  private readonly options: OetDescentEngineOptions;

  private inputManager: ArcadeInputManager | null = null;
  private isBraking = false;
  private prevSteering = 0;
  private wasOutOfBounds = false;
  private lastCollisionTime = -10;
  private highestSpeedSinceLastStop = 0;
  private accumulatedSmoothnessDeltas = 0;
  private totalSteeringUpdates = 0;

  constructor(options: OetDescentEngineOptions = {}) {
    super(createInitialOetDescentState(options));
    this.options = options;

    this.viewport = new ArcadeViewport({
      baseWidth: 800,
      baseHeight: 500,
      mode: "safe-zone",
    });

    this.inputManager = null;

    this.snowSprayPool = new ObjectPool<SnowSprayParticle>({
      initialCapacity: 60,
      maxCapacity: 150,
      overflowPolicy: "fifo",
      factory: () => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 3,
        alpha: 1,
        life: 0,
        maxLife: 0.5,
      }),
      reset: (item) => {
        item.active = false;
        item.life = 0;
      },
    });

    this.subscribe = this.subscribe.bind(this);
    this.getSnapshot = this.getSnapshot.bind(this);
  }

  public override init(): void {
    this.state = createInitialOetDescentState(this.options);
    this.snowSprayPool.clear();
    this.isBraking = false;
    this.prevSteering = 0;
    this.wasOutOfBounds = false;
    this.lastCollisionTime = -10;
    this.highestSpeedSinceLastStop = 0;
    this.accumulatedSmoothnessDeltas = 0;
    this.totalSteeringUpdates = 0;
    this.notifySubscribers();
  }

  /**
   * Advances deterministic physics by fixed delta time dt (in seconds).
   *
   * @param dt Physics delta time in seconds. Clamped defensively against frame spikes.
   */
  public override update(dt: number): void {
    // Defensive clamping against spiral of death or negative time
    const clampedDt = clamp(dt, 0, 0.1);
    if (clampedDt <= 0) return;

    if (this.state.status === "completed" || this.state.status === "crashed") {
      return;
    }

    this.state.elapsedTime += clampedDt;

    // 1. Surface Condition Modifiers
    const snowCondition =
      this.state.conditions.snowCondition?.toLowerCase() ?? "hardpack";
    let friction = 0.05;
    let terminalGlideSpeed = 22.0;
    let brakeDeceleration = 22.0;
    let chainBrakeDeceleration = 18.0;
    let sprayMultiplier = 1.0;
    let lateralResponse = 8.0;

    if (snowCondition.includes("fresh") || snowCondition.includes("powder")) {
      friction = 0.15;
      terminalGlideSpeed = 13.5;
      brakeDeceleration = 34.0;
      chainBrakeDeceleration = 22.0;
      sprayMultiplier = 2.5;
      lateralResponse = 7.0;
    } else if (snowCondition.includes("ice")) {
      friction = 0.018;
      terminalGlideSpeed = 26.0;
      brakeDeceleration = 12.0;
      chainBrakeDeceleration = 13.0;
      sprayMultiplier = 0.6;
      lateralResponse = 4.0;
    }

    // 2. Slope & Gravity Acceleration
    // 24° Fall line slope gravity component scaled to mph/s
    const slopeGravity = 8.5;

    // 3. Drag & Braking Resistances
    let totalBrakingForce = 0;
    if (this.isBraking) {
      totalBrakingForce += brakeDeceleration;
    }
    if (this.state.sled.chainBrakeEngaged) {
      totalBrakingForce += chainBrakeDeceleration;
    }
    if (this.state.sled.tailRopeBraking) {
      totalBrakingForce += 14.0;
    }

    const naturalDrag = this.state.sled.speedMph * friction * 1.5;
    const netAcceleration = slopeGravity - (totalBrakingForce + naturalDrag);

    // 4. Longitudinal Speed Integration
    if (this.state.sled.isStopped && netAcceleration <= 0) {
      this.state.sled.speedMph = 0;
    } else {
      this.state.sled.isStopped = false;
      this.state.status = "descending";
      this.state.sled.speedMph = clamp(
        this.state.sled.speedMph + netAcceleration * clampedDt,
        0,
        terminalGlideSpeed
      );

      if (this.state.sled.speedMph > this.highestSpeedSinceLastStop) {
        this.highestSpeedSinceLastStop = this.state.sled.speedMph;
      }

      // Check for smooth controlled stop
      if (
        this.state.sled.speedMph <= 0.25 &&
        (this.isBraking || this.state.sled.chainBrakeEngaged)
      ) {
        this.state.sled.speedMph = 0;
        this.state.sled.isStopped = true;
        this.state.status = "stopped";
        this.isBraking = false; // Release wedge brake latch; chain brake holds the toboggan stationary

        if (
          this.highestSpeedSinceLastStop >= 4.0 &&
          this.state.elapsedTime - this.lastCollisionTime > 1.5
        ) {
          this.state.metrics.controlledStops++;
          this.highestSpeedSinceLastStop = 0;
          this.emit("controlledStop", {
            stops: this.state.metrics.controlledStops,
          });
        }
      }
    }

    // 5. Lateral Steering & Abrupt Movement Detection
    // Sled must have forward momentum to generate lateral ski carve/sideslip velocity
    const targetVx =
      this.state.sled.speedMph > 0.1
        ? this.state.sled.steering *
          140 *
          Math.min(1.2, this.state.sled.speedMph / 8 + 0.1)
        : 0;

    this.state.sled.vx =
      this.state.sled.speedMph > 0.1
        ? this.state.sled.vx +
          (targetVx - this.state.sled.vx) *
            Math.min(1, lateralResponse * clampedDt)
        : 0;

    const steeringDelta = Math.abs(
      this.state.sled.steering - this.prevSteering
    );
    if (
      clampedDt > 0 &&
      steeringDelta / clampedDt > 5.5 &&
      this.state.sled.speedMph > 2.5
    ) {
      this.state.metrics.abruptDirectionChanges++;
      this.emit("abruptMotion", {
        count: this.state.metrics.abruptDirectionChanges,
      });
    }

    this.accumulatedSmoothnessDeltas += steeringDelta;
    this.totalSteeringUpdates++;
    this.prevSteering = this.state.sled.steering;

    // 6. Kinematic Position Updates
    const prevY = this.state.sled.y;
    this.state.sled.x += this.state.sled.vx * clampedDt;

    // 12px down-track per mph
    const forwardPixelsPerSec = this.state.sled.speedMph * 12;
    this.state.sled.y += forwardPixelsPerSec * clampedDt;
    this.state.distanceTraveled = this.state.sled.y;

    // 7. Trail Boundaries & Excursions
    const halfWidth = 16;
    if (
      this.state.sled.x - halfWidth < this.state.trailLeft ||
      this.state.sled.x + halfWidth > this.state.trailRight
    ) {
      if (!this.wasOutOfBounds) {
        this.state.metrics.boundaryViolations++;
        this.wasOutOfBounds = true;
        this.emit("boundaryViolation", {
          violations: this.state.metrics.boundaryViolations,
        });
      }

      // Off-piste deep snow / edge friction drag
      this.state.sled.speedMph = Math.max(
        0,
        this.state.sled.speedMph - 24 * clampedDt
      );

      // Clamp sled so it does not fly off screen
      this.state.sled.x = clamp(
        this.state.sled.x,
        this.state.trailLeft - 20,
        this.state.trailRight + 20
      );
    } else {
      this.wasOutOfBounds = false;
    }

    // 8. Safe Speed Ceiling (15 mph)
    if (this.state.sled.speedMph > 15.0) {
      this.state.metrics.excessiveSpeedTime += clampedDt;
    }

    // 9. Obstacle Collisions
    const sledCollisionRadius = 18;
    for (const obs of this.state.obstacles) {
      if (Math.abs(this.state.sled.y - obs.y) <= 40) {
        const dx = this.state.sled.x - obs.x;
        const dy = this.state.sled.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < sledCollisionRadius + obs.radius && !obs.hit) {
          obs.hit = true;
          this.state.metrics.collisions++;
          this.lastCollisionTime = this.state.elapsedTime;

          // Impact shock
          this.state.sled.speedMph = Math.max(
            0,
            this.state.sled.speedMph * 0.2
          );
          this.state.sled.vx = -this.state.sled.vx * 0.6;

          this.emit("collision", {
            obstacle: obs,
            collisions: this.state.metrics.collisions,
          });

          if (this.state.metrics.collisions >= 4) {
            this.state.status = "crashed";
          }
        }
      }
    }

    // 10. Gate Traversal
    for (const gate of this.state.gates) {
      if (prevY < gate.y && this.state.sled.y >= gate.y) {
        if (this.state.sled.x >= gate.xMin && this.state.sled.x <= gate.xMax) {
          gate.cleared = true;
          this.emit("gateCleared", { gateId: gate.id });
        } else {
          gate.missed = true;
          this.emit("gateMissed", { gateId: gate.id });
        }
      }
    }

    // 11. Route Efficiency & Judgment Scoring
    const clearedGates = this.state.gates.filter((g) => g.cleared).length;
    const evaluatedGates = this.state.gates.filter(
      (g) => g.cleared || g.missed
    ).length;
    const gateRatio = evaluatedGates > 0 ? clearedGates / evaluatedGates : 1.0;

    const avgSmoothness =
      this.totalSteeringUpdates > 0
        ? this.accumulatedSmoothnessDeltas / this.totalSteeringUpdates
        : 0;
    const pathSmoothnessScore = Math.max(0, 1 - avgSmoothness * 2.5);

    this.state.metrics.routeEfficiency = Math.round(
      gateRatio * 80 + pathSmoothnessScore * 20
    );

    // Judgment scoring: rewards control, penalty on speed/collisions/jerks
    let score = 100;
    score -= this.state.metrics.collisions * 25;
    score -= this.state.metrics.boundaryViolations * 10;
    score -= this.state.metrics.abruptDirectionChanges * 5;
    score -= Math.floor(this.state.metrics.excessiveSpeedTime * 3);
    score += Math.min(2, this.state.metrics.controlledStops) * 5;
    if (
      this.state.metrics.routeEfficiency >= 80 &&
      this.state.metrics.collisions === 0
    ) {
      score += 5;
    }

    this.state.metrics.judgmentScore = clamp(score, 0, 100);

    // 12. Snow Spray Particles
    if (this.state.sled.speedMph > 0.8) {
      const spawnCount = Math.ceil(1.5 * sprayMultiplier);
      for (let i = 0; i < spawnCount; i++) {
        // Left runner spray
        const pLeft = this.snowSprayPool.acquire();
        if (pLeft) {
          pLeft.active = true;
          pLeft.x = this.state.sled.x - 12 + (Math.random() * 4 - 2);
          pLeft.y = this.state.sled.y - 12;
          pLeft.vx = -15 - Math.random() * 25 + this.state.sled.vx * 0.3;
          pLeft.vy = -(10 + Math.random() * 20);
          pLeft.size =
            2 + Math.random() * (snowCondition.includes("powder") ? 4 : 2);
          pLeft.alpha = 0.8;
          pLeft.life = 0;
          pLeft.maxLife = 0.4 + Math.random() * 0.2;
        }

        // Right runner spray
        const pRight = this.snowSprayPool.acquire();
        if (pRight) {
          pRight.active = true;
          pRight.x = this.state.sled.x + 12 + (Math.random() * 4 - 2);
          pRight.y = this.state.sled.y - 12;
          pRight.vx = 15 + Math.random() * 25 + this.state.sled.vx * 0.3;
          pRight.vy = -(10 + Math.random() * 20);
          pRight.size =
            2 + Math.random() * (snowCondition.includes("powder") ? 4 : 2);
          pRight.alpha = 0.8;
          pRight.life = 0;
          pRight.maxLife = 0.4 + Math.random() * 0.2;
        }

        // Chain brake center friction spray
        if (this.state.sled.chainBrakeEngaged) {
          const pCenter = this.snowSprayPool.acquire();
          if (pCenter) {
            pCenter.active = true;
            pCenter.x = this.state.sled.x + (Math.random() * 6 - 3);
            pCenter.y = this.state.sled.y;
            pCenter.vx = Math.random() * 20 - 10;
            pCenter.vy = -(15 + Math.random() * 25);
            pCenter.size = 3;
            pCenter.alpha = 0.9;
            pCenter.life = 0;
            pCenter.maxLife = 0.35;
          }
        }
      }
    }

    // Update active particles
    const toRelease: SnowSprayParticle[] = [];
    this.snowSprayPool.forEachActive((p) => {
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;
      p.life += clampedDt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        toRelease.push(p);
      }
    });

    for (const p of toRelease) {
      this.snowSprayPool.release(p);
    }

    // 13. Active Warnings List
    const warnings: string[] = [];
    if (this.state.sled.speedMph > 15.0) {
      warnings.push("EXCESS SPEED: PATIENT RE-INJURY RISK (>15 MPH)");
    }
    if (this.wasOutOfBounds) {
      warnings.push("TRAIL BOUNDARY VIOLATION: GLADE RUNNER RISK");
    }
    if (this.state.elapsedTime - this.lastCollisionTime < 1.5) {
      warnings.push("TERRAIN OBSTACLE COLLISION DETECTED");
    }
    this.state.activeWarnings = warnings;

    // 14. Descent Completion Check
    if (this.state.distanceTraveled >= this.state.totalDistance) {
      this.state.status = "completed";
      this.state.sled.speedMph = 0;
      this.state.sled.isStopped = true;
      this.emit("descentCompleted", this.createSnapshot());
    }

    this.notifySubscribers();
  }

  // --- Control Actions ---

  public setSteering(val: number): void {
    this.state.sled.steering = clamp(val, -1, 1);
    this.notifySubscribers();
  }

  public setBraking(braking: boolean): void {
    this.isBraking = braking;
    this.notifySubscribers();
  }

  public setChainBrake(engaged: boolean): void {
    this.state.sled.chainBrakeEngaged = engaged;
    if (!engaged && this.state.sled.isStopped) {
      this.isBraking = false;
    }
    this.notifySubscribers();
  }

  public toggleChainBrake(): void {
    this.setChainBrake(!this.state.sled.chainBrakeEngaged);
  }

  public setTailRope(active: boolean): void {
    this.state.sled.tailRopeBraking = active;
    this.notifySubscribers();
  }

  public toggleTailRope(): void {
    this.setTailRope(!this.state.sled.tailRopeBraking);
  }

  public performControlledStop(): void {
    this.setBraking(true);
    this.setChainBrake(true);
    this.setSteering(0);
  }

  /**
   * Step-through deterministic simulation helper for accessibility and test suites.
   */
  public stepSimulation(
    stepSeconds = 0.5,
    input?: {
      steering?: number;
      brake?: boolean;
      chainBrake?: boolean;
      tailRope?: boolean;
    }
  ): void {
    if (typeof input?.steering === "number") {
      this.setSteering(input.steering);
    }
    if (typeof input?.brake === "boolean") {
      this.setBraking(input.brake);
    }
    if (typeof input?.chainBrake === "boolean") {
      this.setChainBrake(input.chainBrake);
    }
    if (typeof input?.tailRope === "boolean") {
      this.setTailRope(input.tailRope);
    }

    // Step in 1/60s fixed timesteps
    const fixedDt = 1 / 60;
    let remaining = Math.max(0, stepSeconds);
    while (remaining > 0.001) {
      const dt = Math.min(remaining, fixedDt);
      this.update(dt);
      remaining -= dt;
    }
  }

  /**
   * Returns the viewport instance configuring camera bounds and resolution scaling.
   */
  public getViewport(): ArcadeViewport {
    return this.viewport;
  }

  /**
   * Creates or returns a unified ArcadeInputManager instance bound to the engine.
   */
  public getInputManager(): ArcadeInputManager {
    if (!this.inputManager) {
      this.inputManager = new ArcadeInputManager();
    }
    return this.inputManager;
  }

  /**
   * Instantiates a deterministic fixed-timestep game loop for the OET engine.
   */
  public createGameLoop(
    getContext?: () => CanvasRenderingContext2D | null
  ): ArcadeGameLoop {
    return new ArcadeGameLoop(this, getContext, {
      fixedDt: this.options.fixedDt ?? 1 / 60,
    });
  }

  public override destroy(): void {
    if (this.inputManager) {
      this.inputManager.detach();
      this.inputManager = null;
    }
    super.destroy();
  }

  /**
   * Evaluates patient injury severity and transport triage priority for OET response.
   */
  public evaluatePatientTransport(
    patient?: Partial<PatientState>,
    vitals?: VitalsData,
    environment?: BriefingState
  ): {
    severity: InjurySeverityResult;
    priority: TransportPriorityAssignment;
  } {
    const combinedVitals = vitals ?? patient?.vitals;
    const combinedPatient: Partial<PatientState> = {
      ...patient,
      vitals: combinedVitals,
    };
    const severity = calculateInjurySeverity(
      combinedPatient,
      combinedVitals,
      environment ?? this.state.conditions
    );
    const priority = assignTransportPriority(combinedPatient, combinedVitals);
    return { severity, priority };
  }

  /**
   * Compiles an immutable PatrolEvent snapshot documenting OET judgment metrics
   * for debrief and telemetry ingestion (M7).
   */
  public createPatrolEventSnapshot(
    scenarioId = "pine-ridge-sweep"
  ): PatrolEvent {
    return {
      timestamp: Date.now(),
      scenarioId,
      action: "OET_TRANSPORT_COMPLETED",
      title: "OET Toboggan Transport Run",
      description: `Fall-line descent completed with judgment score ${this.state.metrics.judgmentScore}%.`,
      severity: this.state.metrics.judgmentScore >= 70 ? "info" : "warning",
      context: {
        metrics: { ...this.state.metrics },
        conditions: { ...this.state.conditions },
        totalDistance: this.state.totalDistance,
        distanceTraveled: this.state.distanceTraveled,
        elapsedTime: this.state.elapsedTime,
      },
      payload: {
        metrics: { ...this.state.metrics },
        judgmentScore: this.state.metrics.judgmentScore,
      },
    };
  }

  public override createSnapshot(): OetDescentSnapshot {
    return {
      sled: { ...this.state.sled },
      status: this.state.status,
      conditions: { ...this.state.conditions },
      trailWidth: this.state.trailWidth,
      trailLeft: this.state.trailLeft,
      trailRight: this.state.trailRight,
      totalDistance: this.state.totalDistance,
      distanceTraveled: this.state.distanceTraveled,
      metrics: { ...this.state.metrics },
      elapsedTime: this.state.elapsedTime,
      activeWarnings: [...this.state.activeWarnings],
      activeParticleCount: this.snowSprayPool.getActiveCount(),
      isChainBrakeEngaged: this.state.sled.chainBrakeEngaged,
      isTailRopeBraking: this.state.sled.tailRopeBraking,
      isStopped: this.state.sled.isStopped,
      currentSpeedMph: Math.round(this.state.sled.speedMph * 10) / 10,
      judgmentScore: this.state.metrics.judgmentScore,
    };
  }

  /**
   * High-assurance 2D Canvas rendering for sled, fall-line slope, gates, and snow spray.
   */
  public override render(ctx: CanvasRenderingContext2D, _alpha: number): void {
    if (!ctx) return;

    const canvasWidth = 800;
    const canvasHeight = 500;

    // Clear background: snowy mountain piste gradient
    ctx.save();
    ctx.fillStyle = "#0c131d"; // Deep alpine twilight background
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Camera vertically centers the sled in upper 35% so upcoming fall line is visible
    const cameraY = this.state.sled.y - canvasHeight * 0.35;

    ctx.save();
    ctx.translate(0, -cameraY);

    // 1. Groomed Corduroy Snow Piste
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(
      this.state.trailLeft,
      cameraY,
      this.state.trailWidth,
      canvasHeight
    );

    // Corduroy groomer lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;
    const lineSpacing = 24;
    for (
      let lx = this.state.trailLeft + 12;
      lx < this.state.trailRight;
      lx += lineSpacing
    ) {
      ctx.beginPath();
      ctx.moveTo(lx, cameraY);
      ctx.lineTo(lx, cameraY + canvasHeight);
      ctx.stroke();
    }

    // Trail border boundary rope lines
    ctx.strokeStyle = "rgba(245, 158, 11, 0.6)"; // High-vis amber border rope
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);

    // Left boundary
    ctx.beginPath();
    ctx.moveTo(this.state.trailLeft, cameraY);
    ctx.lineTo(this.state.trailLeft, cameraY + canvasHeight);
    ctx.stroke();

    // Right boundary
    ctx.beginPath();
    ctx.moveTo(this.state.trailRight, cameraY);
    ctx.lineTo(this.state.trailRight, cameraY + canvasHeight);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Guide Gates
    for (const gate of this.state.gates) {
      if (gate.y >= cameraY - 40 && gate.y <= cameraY + canvasHeight + 40) {
        // Gate pole color: green if cleared, red if missed, cyan/orange if pending
        const gateColor = gate.cleared
          ? "#10b981"
          : gate.missed
            ? "#ef4444"
            : "#06b6d4";

        // Left pole
        ctx.fillStyle = gateColor;
        ctx.beginPath();
        ctx.arc(gate.xMin, gate.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Right pole
        ctx.beginPath();
        ctx.arc(gate.xMax, gate.y, 4, 0, Math.PI * 2);
        ctx.fill();

        // Guide banner line across gate
        ctx.strokeStyle = gateColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(gate.xMin, gate.y);
        ctx.lineTo(gate.xMax, gate.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // 3. Terrain Obstacles
    for (const obs of this.state.obstacles) {
      if (obs.y >= cameraY - 50 && obs.y <= cameraY + canvasHeight + 50) {
        ctx.save();
        if (obs.type === "tree") {
          // Pine tree with snow cap
          ctx.fillStyle = "#064e3b";
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
          ctx.fill();

          // Snow cap
          ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
          ctx.beginPath();
          ctx.arc(obs.x, obs.y - 3, obs.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.type === "rock") {
          // Boulder
          ctx.fillStyle = "#475569";
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
          ctx.beginPath();
          ctx.arc(obs.x - 2, obs.y - 2, obs.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.type === "ice_patch") {
          // Ice sheet
          ctx.fillStyle = "rgba(56, 189, 248, 0.35)";
          ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(
            obs.x,
            obs.y,
            obs.radius * 1.3,
            obs.radius * 0.8,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.stroke();
        } else {
          // Mogul bump
          ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
          ctx.fill();
        }

        // Impact flash if hit
        if (obs.hit) {
          ctx.strokeStyle = "#ef4444";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(obs.x, obs.y, obs.radius + 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    // 4. Snow Spray Particles from ObjectPool
    this.snowSprayPool.forEachActive((p) => {
      ctx.fillStyle = `rgba(224, 242, 254, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // 5. Cascade 100 Rescue Toboggan & Operators
    const sledX = this.state.sled.x;
    const sledY = this.state.sled.y;

    ctx.save();
    ctx.translate(sledX, sledY);

    // Tail rope line extending uphill
    if (this.state.sled.tailRopeBraking) {
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -25);
      ctx.lineTo(0, -85);
      ctx.stroke();
    }

    // Cascade 100 Hull: Red/Orange rescue litter
    ctx.fillStyle = "#dc2626"; // Rescue red
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-14, -22, 28, 44, 6);
    ctx.fill();
    ctx.stroke();

    // Packaged Patient: Mummy wrap & 4-point harness (Head Uphill per OET protocol)
    ctx.fillStyle = "#fbbf24"; // High-vis yellow insulated blanket
    ctx.beginPath();
    ctx.roundRect(-9, -16, 18, 30, 4);
    ctx.fill();

    // Harness cross straps
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-9, -8);
    ctx.lineTo(9, 6);
    ctx.moveTo(9, -8);
    ctx.lineTo(-9, 6);
    ctx.stroke();

    // Patient head (top / uphill end)
    ctx.fillStyle = "#fef08a";
    ctx.beginPath();
    ctx.arc(0, -12, 4, 0, Math.PI * 2);
    ctx.fill();

    // Front Operator Handles extending downhill (forward)
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 22);
    ctx.lineTo(-8, 42);
    ctx.moveTo(10, 22);
    ctx.lineTo(8, 42);
    ctx.stroke();

    // Front Patroller: In handles, skis oriented per steering/wedge
    const steerAngle = this.state.sled.steering * 0.35;
    ctx.save();
    ctx.translate(0, 44);
    ctx.rotate(steerAngle);

    // Patroller red jacket with white cross
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-1.5, -4, 3, 8);
    ctx.fillRect(-4, -1.5, 8, 3);

    // Skis (Snowplow / Wedge if braking, or parallel sideslip)
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    if (this.isBraking || this.state.sled.isStopped) {
      // Wedge snowplow ski tips close together, tails apart
      ctx.beginPath();
      ctx.moveTo(-2, 10);
      ctx.lineTo(-10, -10);
      ctx.moveTo(2, 10);
      ctx.lineTo(10, -10);
      ctx.stroke();
    } else {
      // Parallel skis
      ctx.beginPath();
      ctx.moveTo(-6, 8);
      ctx.lineTo(-6, -10);
      ctx.moveTo(6, 8);
      ctx.lineTo(6, -10);
      ctx.stroke();
    }
    ctx.restore();

    // Chain brake indicator underneath center hull
    if (this.state.sled.chainBrakeEngaged) {
      ctx.fillStyle = "#475569";
      ctx.fillRect(-5, -2, 10, 4);
    }

    ctx.restore(); // Restore sled translation
    ctx.restore(); // Restore camera translation
    ctx.restore(); // Restore root canvas
  }
}

/**
 * Convenience alias for OetDescentEngine.
 */
export const OetEngine = OetDescentEngine;

/**
 * Evaluates OET compliance score and debrief rules.
 *
 * Checks scenario debrief rules alongside live descent metrics when available.
 */
export function evaluateOETCompliance(
  scenario: PatrolScenario,
  _actionsTaken: ScenarioAction[],
  eventsOrMetrics?: PatrolEvent | PatrolEvent[] | OetMetrics
): {
  score: number;
  passedCount: number;
  failedCount: number;
  evaluatedRules: DebriefRule[];
} {
  let liveOetScore: number | null = null;

  // Extract judgment score from live metrics or event history if present
  if (eventsOrMetrics) {
    if ("judgmentScore" in eventsOrMetrics) {
      liveOetScore = eventsOrMetrics.judgmentScore;
    } else {
      const events = Array.isArray(eventsOrMetrics)
        ? eventsOrMetrics
        : [eventsOrMetrics];
      const oetEvent = events.find(
        (e) =>
          e.action === "OET_TRANSPORT_COMPLETED" ||
          (e.context && typeof e.context.metrics === "object")
      );
      if (
        oetEvent?.payload &&
        typeof oetEvent.payload.judgmentScore === "number"
      ) {
        liveOetScore = oetEvent.payload.judgmentScore;
      } else if (
        oetEvent?.context &&
        typeof (oetEvent.context.metrics as Record<string, unknown>)
          ?.judgmentScore === "number"
      ) {
        liveOetScore = (oetEvent.context.metrics as Record<string, unknown>)
          .judgmentScore as number;
      }
    }
  }

  // Clone debrief rules so evaluation does not mutate shared scenario references
  const rawRules: DebriefRule[] = scenario.debriefRules
    ? scenario.debriefRules.map((rule) => ({ ...rule }))
    : [];

  // Dynamically evaluate OET debrief rules if live descent metrics were captured
  if (liveOetScore !== null) {
    const oetPassed = liveOetScore >= 70;
    for (const rule of rawRules) {
      if (rule.category === "oet" || rule.id.toLowerCase().includes("oet")) {
        rule.passed = oetPassed;
        rule.feedback = oetPassed
          ? `Controlled descent down fall line maintained passing standard (${liveOetScore}%).`
          : `Descent control below passing standard (${liveOetScore}%). Excessive speed or collisions.`;
      }
    }
  }

  if (rawRules.length === 0) {
    return {
      score: liveOetScore ?? 100,
      passedCount: 0,
      failedCount: 0,
      evaluatedRules: [],
    };
  }

  const totalPossible = rawRules.reduce((acc, rule) => acc + rule.score, 0);

  const evaluatedPassed = rawRules.filter((rule) => rule.passed);
  const earnedScore = evaluatedPassed.reduce(
    (acc, rule) => acc + rule.score,
    0
  );

  const ruleScore =
    totalPossible > 0 ? Math.round((earnedScore / totalPossible) * 100) : 100;

  // If live OET descent score exists, blend 60% OET control score + 40% debrief rule score
  const finalScore =
    liveOetScore !== null
      ? Math.round(liveOetScore * 0.6 + ruleScore * 0.4)
      : ruleScore;

  return {
    score: finalScore,
    passedCount: evaluatedPassed.length,
    failedCount: rawRules.length - evaluatedPassed.length,
    evaluatedRules: rawRules,
  };
}

export interface InjurySeverityResult {
  score: number;
  level: "minor" | "moderate" | "severe" | "critical";
  factors: string[];
  vitalsCompromised: boolean;
  spinalPrecautionRequired: boolean;
}

export interface TransportPriorityAssignment {
  priority: "RED" | "YELLOW" | "GREEN" | "BLACK";
  numericPriority: number;
  title: string;
  tobogganRequired: boolean;
  alsInterventionRequired: boolean;
  estimatedTransportTimeMinutes: number;
  rationale: string[];
}

/**
 * Calculates injury severity score (0-100), level, and physiological factors
 * based on patient complaint, mechanism of injury, vitals, and environment.
 *
 * Authoritative Clinical Sources:
 * - AVPU / GCS: National Ski Patrol (NSP) Outdoor Emergency Care (OEC) 6th Ed., Ch. 6 "Patient Assessment";
 *   Glasgow Coma Scale (Teasdale & Jennett, 1974, Lancet 304(7884):81-84).
 * - SpO2 (hypoxia < 92%, severe < 85%): NSP OEC 6th Ed., Ch. 6 "Vital Signs" & Ch. 12 "Respiratory Emergencies".
 * - Respiration (< 10 or > 30 bpm) & Heart Rate (> 130 or < 40 bpm): START Triage Protocol (Super & Benson, 1983);
 *   NSP OEC 6th Ed., Ch. 6.
 * - BP Systolic (< 90 mmHg hypotension/shock): NSP OEC 6th Ed., Ch. 9 "Shock".
 * - Neurovascular PMS (Pulse, Motor, Sensory): NSP OEC 6th Ed., Ch. 20 "Musculoskeletal Trauma".
 * - High-energy Mechanism & Trauma Suspicions: CDC Field Triage Guidelines for Injured Patients; NSP OEC 6th Ed., Ch. 15.
 */
export function calculateInjurySeverity(
  patient?: Partial<PatientState>,
  vitals?: VitalsData,
  environment?: BriefingState
): InjurySeverityResult {
  let score = 10;
  const factors: string[] = [];
  let vitalsCompromised = false;
  let spinalPrecautionRequired = false;

  const currentVitals = vitals ?? patient?.vitals;

  if (currentVitals) {
    if (currentVitals.avpu === "U") {
      score += 40;
      vitalsCompromised = true;
      factors.push("Unresponsive patient (AVPU U)");
    } else if (currentVitals.avpu === "P") {
      score += 30;
      vitalsCompromised = true;
      factors.push("Responds only to pain (AVPU P)");
    } else if (currentVitals.avpu === "V") {
      score += 15;
      factors.push("Altered mental status (AVPU V)");
    }

    if (typeof currentVitals.gcs === "number") {
      if (currentVitals.gcs <= 8) {
        score += 35;
        vitalsCompromised = true;
        factors.push(`Severe GCS impairment (${currentVitals.gcs})`);
      } else if (currentVitals.gcs <= 12) {
        score += 25;
        factors.push(`Moderate GCS impairment (${currentVitals.gcs})`);
      } else if (currentVitals.gcs <= 14) {
        score += 10;
        factors.push(`Mild GCS impairment (${currentVitals.gcs})`);
      }
    }

    if (typeof currentVitals.spo2 === "number") {
      if (currentVitals.spo2 < 85) {
        score += 30;
        vitalsCompromised = true;
        factors.push(`Critical hypoxia (SpO2 ${currentVitals.spo2}%)`);
      } else if (currentVitals.spo2 < 92) {
        score += 15;
        factors.push(`Hypoxia (SpO2 ${currentVitals.spo2}%)`);
      }
    }

    if (typeof currentVitals.respiration === "number") {
      if (currentVitals.respiration < 10 || currentVitals.respiration > 30) {
        score += 25;
        vitalsCompromised = true;
        factors.push(`Abnormal respiration (${currentVitals.respiration} bpm)`);
      } else if (currentVitals.respiration > 22) {
        score += 10;
        factors.push(`Tachypnea (${currentVitals.respiration} bpm)`);
      }
    }

    if (typeof currentVitals.heartRate === "number") {
      if (currentVitals.heartRate > 130 || currentVitals.heartRate < 40) {
        score += 20;
        vitalsCompromised = true;
        factors.push(`Critical heart rate (${currentVitals.heartRate} bpm)`);
      } else if (currentVitals.heartRate > 100) {
        score += 10;
        factors.push(`Tachycardia (${currentVitals.heartRate} bpm)`);
      }
    }

    if (typeof currentVitals.bpSystolic === "number") {
      if (currentVitals.bpSystolic < 90) {
        score += 25;
        vitalsCompromised = true;
        factors.push(
          `Decompensated shock / Hypotension (BP ${currentVitals.bpSystolic} mmHg)`
        );
      }
    }

    if (currentVitals.pms === "absent") {
      score += 30;
      vitalsCompromised = true;
      factors.push("Absent distal pulse/motor/sensory deficit");
    } else if (currentVitals.pms === "compromised") {
      score += 15;
      factors.push("Compromised neurovascular status");
    }
  }

  const mechanism = (patient?.mechanism || "").toLowerCase();
  const complaint = (patient?.complaint || "").toLowerCase();

  if (
    mechanism.includes("high-speed") ||
    mechanism.includes("collision") ||
    mechanism.includes("tree impact") ||
    mechanism.includes("fall > 15ft")
  ) {
    score += 25;
    spinalPrecautionRequired = true;
    factors.push("High-energy mechanism of injury");
  }

  if (
    complaint.includes("spinal") ||
    complaint.includes("neck") ||
    complaint.includes("back") ||
    complaint.includes("head") ||
    complaint.includes("loss of consciousness")
  ) {
    score += 25;
    spinalPrecautionRequired = true;
    factors.push("Suspected head or spinal injury");
  }

  if (
    complaint.includes("femur") ||
    complaint.includes("pelvis") ||
    complaint.includes("open fracture")
  ) {
    score += 25;
    factors.push("Major long-bone or pelvic fracture");
  } else if (
    complaint.includes("fracture") ||
    complaint.includes("dislocation") ||
    complaint.includes("deformity") ||
    complaint.includes("tibia")
  ) {
    score += 15;
    factors.push("Extremity fracture or dislocation");
  }

  if (
    complaint.includes("chest") ||
    complaint.includes("bleeding") ||
    complaint.includes("hemorrhage")
  ) {
    score += 20;
    factors.push("Severe bleeding or chest trauma");
  }

  if (environment) {
    if (
      typeof environment.temperatureFahrenheit === "number" &&
      environment.temperatureFahrenheit < 10
    ) {
      score += 10;
      factors.push(
        `Severe environmental cold stress (${environment.temperatureFahrenheit}°F)`
      );
    }
  }

  const finalScore = clamp(score, 0, 100);

  let level: "minor" | "moderate" | "severe" | "critical" = "minor";
  if (finalScore >= 70 || vitalsCompromised) {
    level = "critical";
  } else if (finalScore >= 45) {
    level = "severe";
  } else if (finalScore >= 25 || spinalPrecautionRequired) {
    level = "moderate";
  }

  return {
    score: finalScore,
    level,
    factors: factors.length > 0 ? factors : ["Minor localized discomfort"],
    vitalsCompromised,
    spinalPrecautionRequired,
  };
}

/**
 * Assigns transport triage priority (RED, YELLOW, GREEN, BLACK) based on
 * injury severity assessment or patient state.
 *
 * Authoritative Triage Framework:
 * - START Triage System Protocol (Simple Triage and Rapid Treatment - Super & Benson, 1983)
 * - National Ski Patrol Outdoor Emergency Care (OEC) 6th Ed., Ch. 35 "Multiple-Casualty Incidents"
 */
export function assignTransportPriority(
  input: InjurySeverityResult | Partial<PatientState>,
  vitalsOverride?: VitalsData
): TransportPriorityAssignment {
  let severityResult: InjurySeverityResult;
  let vitals: VitalsData | undefined = vitalsOverride;

  if ("level" in input && typeof input.score === "number") {
    severityResult = input as InjurySeverityResult;
  } else {
    const patientInput = input as Partial<PatientState>;
    vitals = vitals ?? patientInput.vitals;
    severityResult = calculateInjurySeverity(patientInput, vitals);
  }

  if (
    vitals?.respiration === 0 &&
    (vitals?.heartRate === 0 || (vitals?.avpu === "U" && vitals?.gcs === 3))
  ) {
    return {
      priority: "BLACK",
      numericPriority: 0,
      title: "Expectant / BLACK Priority",
      tobogganRequired: true,
      alsInterventionRequired: true,
      estimatedTransportTimeMinutes: 0,
      rationale: ["Apneic and pulseless patient on scene"],
    };
  }

  if (
    severityResult.level === "critical" ||
    severityResult.vitalsCompromised ||
    severityResult.score >= 65
  ) {
    return {
      priority: "RED",
      numericPriority: 1,
      title: "Immediate / RED Priority Transport",
      tobogganRequired: true,
      alsInterventionRequired: true,
      estimatedTransportTimeMinutes: 10,
      rationale: [
        "Physiological vitals compromise or critical trauma score",
        ...severityResult.factors,
      ],
    };
  }

  if (
    severityResult.level === "severe" ||
    severityResult.level === "moderate" ||
    severityResult.spinalPrecautionRequired ||
    severityResult.score >= 25
  ) {
    return {
      priority: "YELLOW",
      numericPriority: 2,
      title: "Delayed / YELLOW Priority Transport",
      tobogganRequired: true,
      alsInterventionRequired: severityResult.score >= 50,
      estimatedTransportTimeMinutes: 20,
      rationale: [
        "Inability to ambulate or spinal immobilization required",
        ...severityResult.factors,
      ],
    };
  }

  return {
    priority: "GREEN",
    numericPriority: 3,
    title: "Minimal / GREEN Priority Walking Assist",
    tobogganRequired: false,
    alsInterventionRequired: false,
    estimatedTransportTimeMinutes: 30,
    rationale: [
      "Walking wounded with stable vitals",
      ...severityResult.factors,
    ],
  };
}
