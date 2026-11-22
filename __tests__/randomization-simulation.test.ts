// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SIMULATION_REPETITIONS,
  MONTE_CARLO_SIMULATION_VERSION,
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  createSimulationRunner,
  deriveRepetitionSeeds,
  generateBlockSchedule,
  generateMinimizationSchedule,
  isSimulationReportCurrent,
  reproduceRepetitionRequest,
  serializeStructuralStratumKey,
  validateSimulationRequest,
  type BlockRandomizationRequest,
  type MinimizationRandomizationRequest,
  type SimulationReport,
  type SimulationRequest,
} from "@/lib/randomization";
import {
  createRandomizationClient,
  type RandomizationClient,
} from "@/components/randomization/randomization-client";

/**
 * Monte Carlo allocation QA (#4007, RND-SIMUL-001 to RND-SIMUL-010). Every
 * case uses synthetic plans. The figures describe allocation behavior only.
 */

function minimizationPlan(n = 24): MinimizationRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-mc",
    name: "Synthetic minimization plan",
    provenance: {
      studyId: "study-1",
      studyVersionId: "v1",
      studyDesignId: "d1",
      workspaceRevisionId: "r1",
      usdmSha256: "0".repeat(64),
    },
    method: "MINIMIZATION",
    algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
    arms: [
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 2 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      { id: "site-1", code: "S01", label: "Site 1", recruitmentWeight: 3 },
      { id: "site-2", code: "S02", label: "Site 2", recruitmentWeight: 1 },
    ],
    factors: [
      {
        id: "sex",
        code: "SEX",
        label: "Sex",
        levels: [
          { id: "sex-f", code: "F", label: "Female" },
          { id: "sex-m", code: "M", label: "Male" },
        ],
      },
    ],
    seed: { value: "PlanSeed", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:5}" },
    enrollmentTarget: n,
    caps: {
      strategy: "marginal",
      capScope: "study-wide",
      levelCaps: [],
      totalEnrollment: n,
    },
    minimizationSettings: { virtualCohortSize: n, biasedCoinProbability: 0.8 },
  };
}

function blockPlan(cap = 40): BlockRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-mc-block",
    name: "Synthetic block plan",
    provenance: {
      studyId: "study-1",
      studyVersionId: "v1",
      studyDesignId: "d1",
      workspaceRevisionId: "r1",
      usdmSha256: "0".repeat(64),
    },
    method: "BLOCK",
    algorithmId: MT19937_BLOCK_ALGORITHM_ID,
    arms: [
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 1 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      { id: "site-1", code: "S01", label: "Site 1", recruitmentWeight: 1 },
    ],
    factors: [],
    seed: { value: "BlockPlanSeed", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:4}" },
    enrollmentTarget: cap,
    caps: {
      strategy: "manual",
      capScope: "study-wide",
      intersectionCaps: [
        { stratumKey: serializeStructuralStratumKey([]), cap },
      ],
    },
    blockSettings: {
      defaultRule: { mode: "random-pool", sizes: [2, 4] },
      trackingScope: "per-intersection",
      allowPartialFinalBlock: true,
    },
  };
}

function simulation(
  overrides: Partial<SimulationRequest> = {}
): SimulationRequest {
  return {
    simulationVersion: MONTE_CARLO_SIMULATION_VERSION,
    masterSeed: "MasterSeed2026",
    repetitions: 20,
    attritionPercent: 0,
    plan: minimizationPlan(),
    ...overrides,
  };
}

function run(request: unknown): SimulationReport {
  const opened = createSimulationRunner(request);
  if (!opened.ok) throw new Error(opened.findings[0].code);
  while (!opened.runner.step(3));
  return opened.runner.report();
}

describe("seed derivation", () => {
  it("is versioned, deterministic and separates the two streams", () => {
    const a = deriveRepetitionSeeds("MasterSeed2026", 7);
    expect(a).toEqual(deriveRepetitionSeeds("MasterSeed2026", 7));
    expect(a.allocationSeed).toMatch(/^[0-9a-f]{32}$/);
    expect(a.attritionSeed).not.toBe(a.allocationSeed);
    expect(deriveRepetitionSeeds("MasterSeed2026", 8).allocationSeed).not.toBe(
      a.allocationSeed
    );
    expect(() => deriveRepetitionSeeds("bad seed!", 0)).toThrow();
  });

  it("reproduces one repetition's full request and allocation", () => {
    const request = simulation({ repetitions: 5 });
    const repeated = reproduceRepetitionRequest(request, 3);
    expect(repeated).toEqual({
      ...request.plan,
      seed: {
        value: deriveRepetitionSeeds(request.masterSeed, 3).allocationSeed,
        source: "custom",
      },
    });
    const once = generateMinimizationSchedule(
      repeated as MinimizationRandomizationRequest
    );
    const twice = generateMinimizationSchedule(
      reproduceRepetitionRequest(request, 3) as MinimizationRandomizationRequest
    );
    expect(once).toEqual(twice);
  });
});

describe("validation and budgets", () => {
  it("defaults to 50 repetitions and accepts the documented bounds", () => {
    expect(DEFAULT_SIMULATION_REPETITIONS).toBe(50);
    for (const attritionPercent of [0, 50]) {
      expect(
        validateSimulationRequest(
          simulation({ attritionPercent, repetitions: 200 })
        ).ok
      ).toBe(true);
    }
  });

  it("refuses out-of-range settings with the field path", () => {
    const cases: [Partial<SimulationRequest>, string][] = [
      [{ attritionPercent: 50.5 }, "attritionPercent"],
      [{ attritionPercent: -1 }, "attritionPercent"],
      [{ attritionPercent: Number.NaN }, "attritionPercent"],
      [{ repetitions: 0 }, "repetitions"],
      [{ repetitions: 2.5 }, "repetitions"],
      [{ masterSeed: "not alphanumeric" }, "masterSeed"],
    ];
    for (const [override, fieldPath] of cases) {
      const result = validateSimulationRequest(simulation(override));
      expect(result.ok).toBe(false);
      expect(result.findings.map((f) => f.fieldPath)).toContain(fieldPath);
    }
  });

  it("enforces the repetition and aggregate row limits before running", () => {
    const tooMany = validateSimulationRequest(simulation({ repetitions: 201 }));
    expect(tooMany.findings).toContainEqual(
      expect.objectContaining({
        code: "RESOURCE_LIMIT_EXCEEDED",
        fieldPath: "simulationRepetitions",
      })
    );
    const tooLarge = validateSimulationRequest(
      simulation({ repetitions: 200, plan: minimizationPlan(60_000) })
    );
    expect(tooLarge.findings).toContainEqual(
      expect.objectContaining({
        code: "RESOURCE_LIMIT_EXCEEDED",
        fieldPath: "simulationAggregateRows",
        estimatedValue: "12000000",
      })
    );
  });

  it("prefixes plan findings with the plan path", () => {
    const result = validateSimulationRequest(
      simulation({ plan: { ...minimizationPlan(), arms: [] } })
    );
    expect(result.ok).toBe(false);
    expect(result.findings.every((f) => f.fieldPath.startsWith("plan"))).toBe(
      true
    );
  });
});

describe("reproducible aggregates", () => {
  it("gives identical reports for the same master seed and request", () => {
    expect(run(simulation())).toEqual(run(simulation()));
    expect(run(simulation({ masterSeed: "Other" }))).not.toEqual(
      run(simulation())
    );
  });

  it("counts every repetition and binds the report to the request", () => {
    const request = simulation();
    const report = run(request);
    expect(report).toMatchObject({
      attempted: 20,
      succeeded: 20,
      failed: 0,
      canceled: 0,
      interpretation: "descriptive",
      meanAllocated: 24,
      meanRetained: 24,
    });
    expect(report.identity).toMatchObject({
      simulationVersion: 1,
      masterSeed: "MasterSeed2026",
      repetitions: 20,
      attritionPercent: 0,
      algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
    });
    const [active, placebo] = report.arms;
    expect(active.expectedShare).toBeCloseTo(2 / 3);
    expect(active.allocated.mean + placebo.allocated.mean).toBe(24);
    expect(active.allocated.expectedMean).toBeCloseTo(16);
    expect(active.allocated.min).toBeLessThanOrEqual(active.allocated.max);
    expect(report.limitations.join(" ")).toMatch(/not significance tests/);
  });

  it("computes the documented deviation bands from hand-checked counts", () => {
    // Block size 2 with 1:1 ratios fills 40 rows as exactly 20 and 20.
    const report = run(
      simulation({
        plan: {
          ...blockPlan(40),
          blockSettings: {
            ...blockPlan().blockSettings,
            defaultRule: { mode: "fixed-sequence", sizes: [2] },
          },
        },
      })
    );
    for (const arm of report.arms) {
      expect(arm.allocated).toMatchObject({
        min: 20,
        max: 20,
        mean: 20,
        variance: 0,
        expectedMean: 20,
        absoluteRelativeDeviation: 0,
        band: "below-0.1%",
      });
      expect(arm.retainedWarning).toBe(false);
    }
  });

  it("runs block schedules with random block pools through the engine", () => {
    const report = run(simulation({ plan: blockPlan(40), repetitions: 10 }));
    expect(report.succeeded).toBe(10);
    const direct = generateBlockSchedule(
      reproduceRepetitionRequest(
        simulation({ plan: blockPlan(40), repetitions: 10 }),
        0
      ) as BlockRandomizationRequest
    );
    expect(direct.ok).toBe(true);
  });
});

describe("independent attrition", () => {
  it("retains everyone at 0% and never changes allocations", () => {
    const none = run(simulation({ attritionPercent: 0 }));
    const half = run(simulation({ attritionPercent: 50 }));
    expect(none.meanRetained).toBe(none.meanAllocated);
    for (let i = 0; i < none.arms.length; i += 1) {
      // Allocation statistics are identical whatever the attrition rate.
      expect(half.arms[i].allocated).toEqual(none.arms[i].allocated);
    }
    expect(half.meanRetained).toBeLessThan(half.meanAllocated);
    expect(half.meanRetained).toBeGreaterThan(half.meanAllocated * 0.35);
    expect(half.meanRetained).toBeLessThan(half.meanAllocated * 0.65);
    expect(half.identity.attritionPercent).toBe(50);
  });

  it("uses the retained total for retained expectations", () => {
    const report = run(simulation({ attritionPercent: 30 }));
    for (const arm of report.arms) {
      expect(arm.retained.expectedMean).toBeCloseTo(
        report.meanRetained * arm.expectedShare
      );
    }
  });
});

describe("failures, cancellation and staleness", () => {
  it("counts canceled repetitions and labels the report incomplete", () => {
    const opened = createSimulationRunner(simulation({ repetitions: 10 }));
    if (!opened.ok) throw new Error("expected a runner");
    opened.runner.step(4);
    opened.runner.cancel();
    expect(opened.runner.step(5)).toBe(true);
    expect(opened.runner.report()).toMatchObject({
      attempted: 4,
      succeeded: 4,
      canceled: 6,
      interpretation: "incomplete",
    });
  });

  it("records failed repetitions with safe codes in the denominator", () => {
    // A block plan that forbids a partial final block fails every repetition.
    const report = run(
      simulation({
        repetitions: 3,
        plan: {
          ...blockPlan(5),
          blockSettings: {
            ...blockPlan().blockSettings,
            defaultRule: { mode: "fixed-sequence", sizes: [4] },
            allowPartialFinalBlock: false,
          },
        },
      })
    );
    expect(report).toMatchObject({
      attempted: 3,
      succeeded: 0,
      failed: 3,
      interpretation: "no-successful-repetitions",
    });
    expect(report.failures.map((f) => f.index)).toEqual([0, 1, 2]);
    expect(report.failures[0].code).toMatch(/^[A-Z_]+$/);
    for (const arm of report.arms) {
      expect(arm.allocated.band).toBe("n/a");
      expect(arm.allocated.absoluteRelativeDeviation).toBeNull();
    }
  });

  it("marks a report stale when the plan, weights or settings change", () => {
    const request = simulation({ repetitions: 2 });
    const report = run(request);
    expect(isSimulationReportCurrent(report, request)).toBe(true);
    const reweighted = {
      ...request,
      plan: {
        ...request.plan,
        sites: request.plan.sites.map((s, i) =>
          i === 0 ? { ...s, recruitmentWeight: 4 } : s
        ),
      },
    };
    expect(isSimulationReportCurrent(report, reweighted)).toBe(false);
    expect(
      isSimulationReportCurrent(report, { ...request, attritionPercent: 10 })
    ).toBe(false);
    expect(
      isSimulationReportCurrent(report, { ...request, masterSeed: "Changed" })
    ).toBe(false);
  });

  it("freezes the request at start so later draft edits do not leak in", () => {
    const request = simulation({ repetitions: 3 });
    const draft = JSON.parse(JSON.stringify(request)) as {
      plan: { enrollmentTarget: number };
    };
    const opened = createSimulationRunner(draft);
    if (!opened.ok) throw new Error("expected a runner");
    draft.plan.enrollmentTarget = 1;
    while (!opened.runner.step());
    expect(opened.runner.report()).toEqual(run(request));
  });
});

describe("simulation through the randomization client", () => {
  const clients: RandomizationClient[] = [];
  afterEach(() => {
    for (const client of clients.splice(0)) client.dispose();
  });

  it("reports monotonic progress and matches the direct report", async () => {
    const client = createRandomizationClient({ createWorker: () => null });
    clients.push(client);
    const seen: number[] = [];
    client.subscribe(() => {
      const progress = client.getState().progress;
      if (progress && seen.at(-1) !== progress.completed) {
        seen.push(progress.completed);
      }
    });
    const request = simulation({ repetitions: 40 });
    const outcome = await client.simulate({ request, workspaceRevision: 2 });
    expect(outcome.status).toBe("complete");
    if (outcome.status !== "complete") return;
    expect(outcome.report).toEqual(run(request));
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.length).toBeLessThanOrEqual(20);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(seen.at(-1)).toBe(40);
    expect(client.getState()).toMatchObject({
      status: "complete",
      summary: null,
    });
  });

  it("cancels a simulation without publishing a later answer", async () => {
    const client = createRandomizationClient({ createWorker: () => null });
    clients.push(client);
    const pending = client.simulate({
      request: simulation({ repetitions: 200 }),
      workspaceRevision: 0,
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    client.cancel();
    expect(await pending).toMatchObject({ status: "canceled" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(client.getState()).toMatchObject({
      status: "canceled",
      report: null,
    });
  });

  it("drops a superseded simulation and keeps a separate generation client", async () => {
    const qa = createRandomizationClient({ createWorker: () => null });
    const generator = createRandomizationClient({ createWorker: () => null });
    clients.push(qa, generator);
    const generation = generator.generate({
      plan: minimizationPlan(),
      workspaceRevision: 0,
    });
    const first = qa.simulate({
      request: simulation({ repetitions: 100 }),
      workspaceRevision: 1,
    });
    const second = qa.simulate({
      request: simulation({ repetitions: 2 }),
      workspaceRevision: 2,
    });
    qa.cancel();
    expect(await first).toMatchObject({ reason: "superseded" });
    expect(await second).toMatchObject({ reason: "canceled" });
    expect((await generation).status).toBe("complete");
  });

  it("refuses a simulation above the fallback budget visibly", async () => {
    const client = createRandomizationClient({
      createWorker: () => null,
      fallbackRowBudget: 10,
    });
    clients.push(client);
    const outcome = await client.simulate({
      request: simulation({ repetitions: 2 }),
      workspaceRevision: 0,
    });
    expect(outcome).toMatchObject({
      status: "failed",
      code: "FALLBACK_BUDGET_EXCEEDED",
    });
  });
});
