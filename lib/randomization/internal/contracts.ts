import {
  LEGACY_KEYED_ALGORITHM_ID,
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
  RANDOMIZATION_CONTRACT_VERSION,
  RANDOMIZATION_PLAN_SCHEMA_VERSION,
  RANDOMIZATION_RESOURCE_LIMITS,
  type AlgorithmCompatibilityInfo,
  type ArmSpec,
  type ContractVersionDomain,
  type RandomizationAlgorithmId,
  type RandomizationResourceLimits,
  type ReducedAllocationRatiosResult,
  type ResourcePreflightInput,
  type ResourcePreflightResult,
  type ValidationFinding,
} from "../types";

const ALGORITHM_COMPATIBILITY: Readonly<
  Record<RandomizationAlgorithmId, AlgorithmCompatibilityInfo>
> = Object.freeze({
  [LEGACY_KEYED_ALGORITHM_ID]: Object.freeze({
    id: LEGACY_KEYED_ALGORITHM_ID,
    method: "BLOCK",
    isLegacyDefault: true,
    requiresExplicitOptIn: false,
    seedParityWithLegacy: true,
    summary:
      "Existing host keyed FNV-1a and Mulberry32 permuted-block allocator preserved by default for DEMO-301 and device pipeline runs.",
  }),
  [MT19937_BLOCK_ALGORITHM_ID]: Object.freeze({
    id: MT19937_BLOCK_ALGORITHM_ID,
    method: "BLOCK",
    isLegacyDefault: false,
    requiresExplicitOptIn: true,
    seedParityWithLegacy: false,
    summary:
      "Explicit opt-in MT19937 permuted-block allocator. Sharing a visible seed with the legacy keyed allocator never implies row parity.",
  }),
  [MT19937_MINIMIZATION_ALGORITHM_ID]: Object.freeze({
    id: MT19937_MINIMIZATION_ALGORITHM_ID,
    method: "MINIMIZATION",
    isLegacyDefault: false,
    requiresExplicitOptIn: true,
    seedParityWithLegacy: false,
    summary:
      "Explicit opt-in MT19937 ratio-normalized minimization allocator. Sharing a visible seed with the legacy keyed allocator never implies row parity.",
  }),
});

/**
 * Returns versioned compatibility metadata for a randomization algorithm.
 */
export function describeAlgorithmCompatibility(
  algorithmId: RandomizationAlgorithmId
): AlgorithmCompatibilityInfo {
  return ALGORITHM_COMPATIBILITY[algorithmId];
}

/**
 * Checks whether a numeric schema version is supported for the given domain.
 */
export function isSupportedContractVersion(
  domain: ContractVersionDomain,
  version: number
): boolean {
  if (!Number.isInteger(version)) return false;
  switch (domain) {
    case "contract":
      return version === RANDOMIZATION_CONTRACT_VERSION;
    case "plan":
      return version === RANDOMIZATION_PLAN_SCHEMA_VERSION;
    case "artifact":
      return version === RANDOMIZATION_ARTIFACT_SCHEMA_VERSION;
  }
}

function gcdPositive(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }
  return x;
}

/**
 * Validates that every treatment arm has a positive integer allocation ratio
 * and reduces the vector by its greatest common divisor.
 */
export function reduceAllocationRatios<
  T extends Pick<ArmSpec, "allocationRatio">,
>(arms: readonly T[]): ReducedAllocationRatiosResult {
  if (arms.length === 0) {
    return {
      ok: false,
      findings: [
        {
          code: "INVALID_ARM_LIST",
          severity: "error",
          fieldPath: "arms",
          message: "At least one treatment arm is required.",
        },
      ],
    };
  }

  const findings: ValidationFinding[] = [];
  for (let i = 0; i < arms.length; i += 1) {
    const ratio = arms[i].allocationRatio;
    if (!Number.isSafeInteger(ratio) || ratio <= 0) {
      findings.push({
        code: "INVALID_ARM_RATIO",
        severity: "error",
        fieldPath: `arms[${i}].allocationRatio`,
        message: "Allocation ratio must be a positive safe integer.",
      });
    }
  }

  if (findings.length > 0) {
    return { ok: false, findings };
  }

  const gcd = arms.reduce(
    (acc, arm) => gcdPositive(acc, arm.allocationRatio),
    arms[0].allocationRatio
  );
  return {
    ok: true,
    gcd,
    ratios: arms.map((arm) => arm.allocationRatio / gcd),
  };
}

function checkNonNegativeFiniteMetric(
  value: number | undefined,
  maxLimit: number,
  fieldPath: string,
  label: string,
  findings: ValidationFinding[]
): bigint | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    findings.push({
      code: "INVALID_RESOURCE_METRIC",
      severity: "error",
      fieldPath,
      message: `${label} must be a non-negative finite integer.`,
      estimatedValue: String(value),
      limitValue: String(maxLimit),
    });
    return null;
  }
  if (value > maxLimit) {
    findings.push({
      code: "RESOURCE_LIMIT_EXCEEDED",
      severity: "error",
      fieldPath,
      message: `${label} (${value}) exceeds the limit of ${maxLimit}.`,
      estimatedValue: String(value),
      limitValue: String(maxLimit),
    });
  }
  return BigInt(value);
}

/**
 * Checks resource budgets before expanding stratum intersections, schedules,
 * imports, or Monte Carlo simulations using overflow-safe BigInt arithmetic.
 */
export function checkResourcePreflight(
  input: ResourcePreflightInput,
  limits: RandomizationResourceLimits = RANDOMIZATION_RESOURCE_LIMITS
): ResourcePreflightResult {
  const findings: ValidationFinding[] = [];

  const rowsBigInt = checkNonNegativeFiniteMetric(
    input.rows,
    limits.maxRows,
    "enrollmentTarget",
    "Requested rows",
    findings
  );
  checkNonNegativeFiniteMetric(
    input.armCount,
    limits.maxArms,
    "arms",
    "Treatment arm count",
    findings
  );
  checkNonNegativeFiniteMetric(
    input.siteCount,
    limits.maxSites,
    "sites",
    "Site count",
    findings
  );

  let estimatedIntersections = BigInt(1);
  if (input.factorLevelCounts !== undefined) {
    if (input.factorLevelCounts.length > limits.maxFactors) {
      findings.push({
        code: "RESOURCE_LIMIT_EXCEEDED",
        severity: "error",
        fieldPath: "factors",
        message: `Stratification factor count (${input.factorLevelCounts.length}) exceeds the limit of ${limits.maxFactors}.`,
        estimatedValue: String(input.factorLevelCounts.length),
        limitValue: String(limits.maxFactors),
      });
    }

    let validFactors = true;
    for (let i = 0; i < input.factorLevelCounts.length; i += 1) {
      const levelCountBigInt = checkNonNegativeFiniteMetric(
        input.factorLevelCounts[i],
        limits.maxLevelsPerFactor,
        `factors[${i}].levels`,
        `Factor ${i} level count`,
        findings
      );
      if (levelCountBigInt === null) {
        validFactors = false;
      } else {
        estimatedIntersections *= levelCountBigInt;
      }
    }

    if (
      validFactors &&
      estimatedIntersections > BigInt(limits.maxIntersections)
    ) {
      findings.push({
        code: "RESOURCE_LIMIT_EXCEEDED",
        severity: "error",
        fieldPath: "factors",
        message: `Stratum intersection count (${estimatedIntersections.toString()}) exceeds the limit of ${limits.maxIntersections}.`,
        estimatedValue: estimatedIntersections.toString(),
        limitValue: String(limits.maxIntersections),
      });
    }
  }

  checkNonNegativeFiniteMetric(
    input.importBytes,
    limits.maxImportBytes,
    "importBytes",
    "Imported artifact size (bytes)",
    findings
  );
  checkNonNegativeFiniteMetric(
    input.importNestingDepth,
    limits.maxImportNestingDepth,
    "importNestingDepth",
    "Imported JSON nesting depth",
    findings
  );
  const repsBigInt = checkNonNegativeFiniteMetric(
    input.simulationRepetitions,
    limits.maxSimulationRepetitions,
    "simulationRepetitions",
    "Simulation repetitions",
    findings
  );

  const aggregateRows =
    rowsBigInt !== null && repsBigInt !== null
      ? rowsBigInt * repsBigInt
      : BigInt(0);

  if (aggregateRows > BigInt(limits.maxSimulationAggregateRows)) {
    findings.push({
      code: "RESOURCE_LIMIT_EXCEEDED",
      severity: "error",
      fieldPath: "simulationAggregateRows",
      message: `Aggregate simulation rows (${aggregateRows.toString()}) exceed the limit of ${limits.maxSimulationAggregateRows}.`,
      estimatedValue: aggregateRows.toString(),
      limitValue: String(limits.maxSimulationAggregateRows),
    });
  }

  return {
    ok: findings.length === 0,
    estimatedIntersections: estimatedIntersections.toString(),
    estimatedSimulationAggregateRows: aggregateRows.toString(),
    findings,
  };
}
