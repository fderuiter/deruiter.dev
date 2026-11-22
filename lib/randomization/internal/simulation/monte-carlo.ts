/**
 * Reproducible Monte Carlo allocation QA (ticket #4007, RND-SIMUL-001 to
 * RND-SIMUL-011).
 *
 * A simulation repeats one complete randomization request under seeds derived
 * from a master seed, then applies attrition from a separate stream. Every
 * repetition is counted: it succeeds, fails with a safe code, or is canceled.
 * The report describes how allocations behaved in this sample. It is not a
 * test of significance, of unbiasedness or power, and not clinical or
 * regulatory validation.
 */

import {
  RANDOMIZATION_RESOURCE_LIMITS,
  type AllocationRow,
  type RandomizationRequest,
  type RandomizationResourceLimits,
  type ValidationFinding,
} from "../../types";
import { checkResourcePreflight, reduceAllocationRatios } from "../contracts";
import { toSafeRandomizationErrorReport } from "../disclosure/privacy";
import type { RandomizationSafeErrorCode } from "../disclosure/privacy";
import { generateBlockSchedule } from "../engines/block";
import { generateMinimizationSchedule } from "../engines/minimization";
import { createMt19937Stream } from "../engines/mt19937";
import { deriveSeedComponents, validateSeedValue } from "../engines/seed";
import { sha256Utf8Hex } from "../engines/sha256";
import { computePlanDigest } from "../integrity/canonical-digest";
import { validateRandomizationPlan } from "../validate-plan";

/** Version of the seed derivation and report shape. */
export const MONTE_CARLO_SIMULATION_VERSION = 1 as const;

/** Repetitions used when the author does not choose a count. */
export const DEFAULT_SIMULATION_REPETITIONS = 50;

/** Highest attrition percentage a simulation accepts. */
export const MAX_SIMULATION_ATTRITION_PERCENT = 50;

/** Relative deviation above which retained counts carry a warning. */
export const RETAINED_DEVIATION_WARNING = 0.02;

/** A complete, frozen simulation request. */
export interface SimulationRequest {
  readonly simulationVersion: typeof MONTE_CARLO_SIMULATION_VERSION;
  /** ASCII alphanumeric master seed, at most 128 characters. */
  readonly masterSeed: string;
  /** Whole number from 1 to the repetition limit (200). */
  readonly repetitions: number;
  /** Percentage of allocated subjects removed after allocation, 0 to 50. */
  readonly attritionPercent: number;
  readonly plan: RandomizationRequest;
}

/** Seeds of one repetition, derived from the master seed and its index. */
export interface RepetitionSeeds {
  readonly index: number;
  readonly allocationSeed: string;
  readonly attritionSeed: string;
}

/** Descriptive band of an absolute relative deviation. */
export type DeviationBand = "below-0.1%" | "below-1%" | "1%-or-more" | "n/a";

/** Count statistics of one arm over the successful repetitions. */
export interface ArmCountStatistics {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  /** Sample variance (n - 1 denominator); 0 with fewer than two runs. */
  readonly variance: number;
  readonly standardDeviation: number;
  /** Mean total times the arm's reduced-ratio share. */
  readonly expectedMean: number;
  /** |mean - expectedMean| / expectedMean, or null when expectedMean is 0. */
  readonly absoluteRelativeDeviation: number | null;
  readonly band: DeviationBand;
}

/** Statistics of one arm before and after attrition. */
export interface SimulationArmReport {
  readonly armId: string;
  readonly reducedRatio: number;
  readonly expectedShare: number;
  readonly allocated: ArmCountStatistics;
  readonly retained: ArmCountStatistics;
  /** Retained deviation is above the 2% descriptive setting. */
  readonly retainedWarning: boolean;
}

/** One repetition that did not succeed. */
export interface SimulationRepetitionFailure {
  readonly index: number;
  readonly code: RandomizationSafeErrorCode;
}

/** What the report may be read as. */
export type SimulationInterpretation =
  /** Every repetition succeeded; the figures describe this sample only. */
  | "descriptive"
  /** Some repetitions failed or were canceled; the figures cover the rest. */
  | "incomplete"
  /** No repetition succeeded, so there is nothing to describe. */
  | "no-successful-repetitions";

/** Identity that binds a report to the exact request and engine. */
export interface SimulationReportIdentity {
  readonly simulationVersion: typeof MONTE_CARLO_SIMULATION_VERSION;
  readonly planDigest: string;
  readonly contractVersion: number;
  readonly planSchemaVersion: number;
  readonly algorithmId: string;
  readonly masterSeed: string;
  readonly repetitions: number;
  readonly attritionPercent: number;
}

/** Aggregate QA report. */
export interface SimulationReport {
  readonly identity: SimulationReportIdentity;
  readonly attempted: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly canceled: number;
  readonly failures: readonly SimulationRepetitionFailure[];
  /** Mean rows allocated per successful repetition. */
  readonly meanAllocated: number;
  /** Mean rows retained after attrition (effective retained N). */
  readonly meanRetained: number;
  readonly arms: readonly SimulationArmReport[];
  readonly interpretation: SimulationInterpretation;
  readonly limitations: readonly string[];
}

/** Stepwise runner, so a worker can yield, report progress and cancel. */
export interface SimulationRunner {
  readonly total: number;
  /** Repetitions attempted so far. */
  attempted(): number;
  /** Runs up to `count` more repetitions; returns true when finished. */
  step(count?: number): boolean;
  /** Stops the run; repetitions not attempted count as canceled. */
  cancel(): void;
  report(): SimulationReport;
}

/** Result of opening a runner. */
export type SimulationRunnerResult =
  | { readonly ok: true; readonly runner: SimulationRunner }
  | { readonly ok: false; readonly findings: readonly ValidationFinding[] };

const LIMITATIONS: readonly string[] = Object.freeze([
  "Describes allocation behavior over this finite sample of repetitions only.",
  "Deviation bands are descriptive settings, not significance tests.",
  "No p-value, unbiasedness, power or clinical or regulatory approval follows from it.",
  "Attrition is removed at random from its own stream and never changes allocations.",
]);

function settingsFinding(
  fieldPath: string,
  message: string
): ValidationFinding {
  return {
    code: "INVALID_SIMULATION_SETTINGS",
    severity: "error",
    fieldPath,
    message,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Derives the allocation and attrition seeds of one repetition. The
 * derivation is versioned: the same master seed and index always give the
 * same 32-character hex seeds, and the two never coincide.
 */
export function deriveRepetitionSeeds(
  masterSeed: string,
  index: number
): RepetitionSeeds {
  const validation = validateSeedValue(masterSeed);
  if (!validation.ok || !Number.isSafeInteger(index) || index < 0) {
    throw new Error("A repetition needs a valid master seed and index.");
  }
  const base = `mc-v${MONTE_CARLO_SIMULATION_VERSION}:${masterSeed}:${index}`;
  return Object.freeze({
    index,
    allocationSeed: sha256Utf8Hex(`${base}:allocation`).slice(0, 32),
    attritionSeed: sha256Utf8Hex(`${base}:attrition`).slice(0, 32),
  });
}

/**
 * Returns the complete randomization request one repetition ran, so it can
 * be reproduced or handed to a code package exactly.
 */
export function reproduceRepetitionRequest(
  request: SimulationRequest,
  index: number
): RandomizationRequest {
  const { allocationSeed } = deriveRepetitionSeeds(request.masterSeed, index);
  return { ...request.plan, seed: { value: allocationSeed, source: "custom" } };
}

/**
 * Validates simulation settings, the plan, and the aggregate row budget
 * (repetitions times the enrollment target) before any work starts.
 */
export function validateSimulationRequest(
  input: unknown,
  limits: RandomizationResourceLimits = RANDOMIZATION_RESOURCE_LIMITS
): { readonly ok: boolean; readonly findings: readonly ValidationFinding[] } {
  if (!isRecord(input)) {
    return {
      ok: false,
      findings: [
        settingsFinding("", "A simulation request must be an object."),
      ],
    };
  }
  const findings: ValidationFinding[] = [];
  if (input.simulationVersion !== MONTE_CARLO_SIMULATION_VERSION) {
    findings.push(
      settingsFinding("simulationVersion", "Unsupported simulation version.")
    );
  }
  if (
    typeof input.masterSeed !== "string" ||
    !validateSeedValue(input.masterSeed).ok
  ) {
    findings.push(
      settingsFinding(
        "masterSeed",
        "The master seed must be 1 to 128 ASCII letters or digits."
      )
    );
  }
  const repetitions = input.repetitions;
  if (
    typeof repetitions !== "number" ||
    !Number.isSafeInteger(repetitions) ||
    repetitions < 1
  ) {
    findings.push(
      settingsFinding(
        "repetitions",
        "Repetitions must be a whole number of at least 1."
      )
    );
  }
  const attrition = input.attritionPercent;
  if (
    typeof attrition !== "number" ||
    !Number.isFinite(attrition) ||
    attrition < 0 ||
    attrition > MAX_SIMULATION_ATTRITION_PERCENT
  ) {
    findings.push(
      settingsFinding(
        "attritionPercent",
        `Attrition must be between 0 and ${MAX_SIMULATION_ATTRITION_PERCENT} percent.`
      )
    );
  }
  const plan = validateRandomizationPlan(input.plan, limits);
  for (const finding of plan.findings) {
    findings.push({
      ...finding,
      fieldPath: finding.fieldPath ? `plan.${finding.fieldPath}` : "plan",
    });
  }
  if (plan.ok && typeof repetitions === "number") {
    const preflight = checkResourcePreflight(
      {
        rows: (input.plan as RandomizationRequest).enrollmentTarget,
        simulationRepetitions: repetitions,
      },
      limits
    );
    findings.push(...preflight.findings);
  }
  return { ok: !findings.some((f) => f.severity === "error"), findings };
}

interface Accumulator {
  min: number;
  max: number;
  sum: number;
  sumSquares: number;
}

const emptyAccumulator = (): Accumulator => ({
  min: Number.POSITIVE_INFINITY,
  max: Number.NEGATIVE_INFINITY,
  sum: 0,
  sumSquares: 0,
});

function add(acc: Accumulator, value: number): void {
  if (value < acc.min) acc.min = value;
  if (value > acc.max) acc.max = value;
  acc.sum += value;
  acc.sumSquares += value * value;
}

function band(deviation: number | null): DeviationBand {
  if (deviation === null) return "n/a";
  if (deviation < 0.001) return "below-0.1%";
  if (deviation < 0.01) return "below-1%";
  return "1%-or-more";
}

function statistics(
  acc: Accumulator,
  n: number,
  expectedMean: number
): ArmCountStatistics {
  if (n === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      variance: 0,
      standardDeviation: 0,
      expectedMean: 0,
      absoluteRelativeDeviation: null,
      band: "n/a",
    };
  }
  const mean = acc.sum / n;
  const variance =
    n < 2 ? 0 : Math.max(0, (acc.sumSquares - n * mean * mean) / (n - 1));
  const deviation =
    expectedMean > 0 ? Math.abs(mean - expectedMean) / expectedMean : null;
  return {
    min: acc.min,
    max: acc.max,
    mean,
    variance,
    standardDeviation: Math.sqrt(variance),
    expectedMean,
    absoluteRelativeDeviation: deviation,
    band: band(deviation),
  };
}

function firstErrorCode(
  findings: readonly ValidationFinding[]
): RandomizationSafeErrorCode {
  const error = findings.find((f) => f.severity === "error") ?? findings[0];
  return error?.code ?? "RANDOMIZATION_UNKNOWN_ERROR";
}

/**
 * Opens a runner for a validated simulation request. The request is deeply
 * copied first, so later edits to the caller's draft cannot change the run.
 */
export function createSimulationRunner(
  input: unknown,
  limits: RandomizationResourceLimits = RANDOMIZATION_RESOURCE_LIMITS
): SimulationRunnerResult {
  const validation = validateSimulationRequest(input, limits);
  if (!validation.ok) return { ok: false, findings: validation.findings };
  const request = JSON.parse(JSON.stringify(input)) as SimulationRequest;
  const plan = request.plan;
  const total = request.repetitions;
  const rate = request.attritionPercent / 100;
  const reduced = reduceAllocationRatios(plan.arms);
  const ratios = reduced.ok ? reduced.ratios : plan.arms.map(() => 1);
  const ratioSum = ratios.reduce((a, b) => a + b, 0);
  const armIndex = new Map(plan.arms.map((a, i) => [a.id, i]));
  const allocated = plan.arms.map(emptyAccumulator);
  const retained = plan.arms.map(emptyAccumulator);
  const failures: SimulationRepetitionFailure[] = [];
  let attempted = 0;
  let succeeded = 0;
  let canceled = false;
  let allocatedRows = 0;
  let retainedRows = 0;

  const runOne = (index: number) => {
    const repetition = reproduceRepetitionRequest(request, index);
    let rows: readonly AllocationRow[];
    try {
      const result =
        repetition.method === "BLOCK"
          ? generateBlockSchedule(repetition, limits)
          : generateMinimizationSchedule(repetition, limits);
      if (!result.ok) {
        failures.push({ index, code: firstErrorCode(result.findings) });
        return;
      }
      rows = result.rows;
    } catch (error) {
      failures.push({
        index,
        code: toSafeRandomizationErrorReport(error).code,
      });
      return;
    }
    if (allocatedRows + rows.length > limits.maxSimulationAggregateRows) {
      failures.push({ index, code: "RESOURCE_LIMIT_EXCEEDED" });
      return;
    }
    const attrition = createMt19937Stream(
      deriveSeedComponents(
        deriveRepetitionSeeds(request.masterSeed, index).attritionSeed
      ).numericSeed
    );
    const before = new Array<number>(plan.arms.length).fill(0);
    const after = new Array<number>(plan.arms.length).fill(0);
    for (const row of rows) {
      const arm = armIndex.get(row.armId);
      if (arm === undefined) continue;
      before[arm] += 1;
      // One draw per row, always, so the stream never depends on outcomes.
      if (attrition.nextFloat() >= rate) after[arm] += 1;
    }
    for (let i = 0; i < before.length; i += 1) {
      add(allocated[i], before[i]);
      add(retained[i], after[i]);
    }
    allocatedRows += rows.length;
    retainedRows += after.reduce((a, b) => a + b, 0);
    succeeded += 1;
  };

  const runner: SimulationRunner = {
    total,
    attempted: () => attempted,
    step(count = 1) {
      for (let i = 0; i < count && !canceled && attempted < total; i += 1) {
        runOne(attempted);
        attempted += 1;
      }
      return canceled || attempted >= total;
    },
    cancel() {
      canceled = true;
    },
    report() {
      const meanAllocated = succeeded > 0 ? allocatedRows / succeeded : 0;
      const meanRetained = succeeded > 0 ? retainedRows / succeeded : 0;
      const arms = plan.arms.map((arm, i) => {
        const share = ratios[i] / ratioSum;
        const retainedStats = statistics(
          retained[i],
          succeeded,
          meanRetained * share
        );
        return {
          armId: arm.id,
          reducedRatio: ratios[i],
          expectedShare: share,
          allocated: statistics(allocated[i], succeeded, meanAllocated * share),
          retained: retainedStats,
          retainedWarning:
            retainedStats.absoluteRelativeDeviation !== null &&
            retainedStats.absoluteRelativeDeviation >
              RETAINED_DEVIATION_WARNING,
        };
      });
      const canceledCount = total - attempted;
      return {
        identity: {
          simulationVersion: MONTE_CARLO_SIMULATION_VERSION,
          planDigest: computePlanDigest(plan),
          contractVersion: plan.contractVersion,
          planSchemaVersion: plan.planSchemaVersion,
          algorithmId: plan.algorithmId,
          masterSeed: request.masterSeed,
          repetitions: total,
          attritionPercent: request.attritionPercent,
        },
        attempted,
        succeeded,
        failed: failures.length,
        canceled: canceledCount,
        failures: [...failures],
        meanAllocated,
        meanRetained,
        arms,
        interpretation:
          succeeded === 0
            ? "no-successful-repetitions"
            : succeeded < total
              ? "incomplete"
              : "descriptive",
        limitations: LIMITATIONS,
      };
    },
  };
  return { ok: true, runner };
}

/**
 * True while a report still describes `request`: same plan digest, engine
 * versions and simulation settings. Any edit to the plan, its site weights
 * or the settings makes the report stale.
 */
export function isSimulationReportCurrent(
  report: SimulationReport,
  request: SimulationRequest
): boolean {
  let planDigest: string;
  try {
    planDigest = computePlanDigest(request.plan);
  } catch {
    return false;
  }
  const id = report.identity;
  return (
    id.simulationVersion === request.simulationVersion &&
    id.planDigest === planDigest &&
    id.contractVersion === request.plan.contractVersion &&
    id.planSchemaVersion === request.plan.planSchemaVersion &&
    id.algorithmId === request.plan.algorithmId &&
    id.masterSeed === request.masterSeed &&
    id.repetitions === request.repetitions &&
    id.attritionPercent === request.attritionPercent
  );
}
