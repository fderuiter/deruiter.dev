import {
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  RANDOMIZATION_RESOURCE_LIMITS,
  type PlanValidationResult,
  type RandomizationResourceLimits,
  type ValidationFinding,
} from "../types";
import {
  checkResourcePreflight,
  isSupportedContractVersion,
  reduceAllocationRatios,
} from "./contracts";
import { validateSeedValue } from "./engines/seed";
import { parseSubjectIdMask } from "./identity/subject-id";

const VALID_CAP_SCOPES = new Set(["study-wide", "per-site"]);
const VALID_BLOCK_CAP_STRATEGIES = new Set([
  "manual",
  "proportional",
  "marginal",
]);
const VALID_MINIMIZATION_CAP_STRATEGIES = new Set(["manual", "marginal"]);
const VALID_TRACKING_SCOPES = new Set([
  "global",
  "per-site",
  "per-intersection",
]);
const VALID_BLOCK_MODES = new Set(["random-pool", "fixed-sequence"]);
const VALID_SEED_SOURCES = new Set(["custom", "generated"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validateUniqueIdentifiers(
  items: readonly unknown[],
  collectionPath: string,
  findings: ValidationFinding[]
): void {
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!isRecord(item) || !isNonEmptyString(item.id)) {
      findings.push({
        code: "EMPTY_IDENTIFIER",
        severity: "error",
        fieldPath: `${collectionPath}[${i}].id`,
        message: "Identifier must be a non-empty string.",
      });
      continue;
    }
    if (seen.has(item.id)) {
      findings.push({
        code: "DUPLICATE_IDENTIFIER",
        severity: "error",
        fieldPath: `${collectionPath}[${i}].id`,
        message: `Duplicate identifier "${item.id}".`,
      });
    } else {
      seen.add(item.id);
    }
  }
}

function validateProvenance(
  provenance: unknown,
  findings: ValidationFinding[]
): void {
  if (!isRecord(provenance)) {
    findings.push({
      code: "INVALID_PROVENANCE",
      severity: "error",
      fieldPath: "provenance",
      message: "Study provenance metadata is required.",
    });
    return;
  }

  for (const key of [
    "studyId",
    "studyVersionId",
    "studyDesignId",
    "workspaceRevisionId",
    "usdmSha256",
  ] as const) {
    if (!isNonEmptyString(provenance[key])) {
      findings.push({
        code: "INVALID_PROVENANCE",
        severity: "error",
        fieldPath: `provenance.${key}`,
        message: `provenance.${key} must be a non-empty string.`,
      });
    }
  }
}

function validateBlockRule(
  rule: unknown,
  basePath: string,
  findings: ValidationFinding[]
): void {
  if (
    !isRecord(rule) ||
    typeof rule.mode !== "string" ||
    !VALID_BLOCK_MODES.has(rule.mode) ||
    !Array.isArray(rule.sizes) ||
    rule.sizes.length === 0
  ) {
    findings.push({
      code: "INVALID_BLOCK_SETTINGS",
      severity: "error",
      fieldPath: basePath,
      message: `${basePath} requires a valid mode and at least one block size.`,
    });
    return;
  }

  for (let i = 0; i < rule.sizes.length; i += 1) {
    if (!isPositiveSafeInteger(rule.sizes[i])) {
      findings.push({
        code: "INVALID_BLOCK_SETTINGS",
        severity: "error",
        fieldPath: `${basePath}.sizes[${i}]`,
        message: "Each block size must be a positive safe integer.",
      });
    }
  }

  if (Array.isArray(rule.softUsageLimits)) {
    for (let i = 0; i < rule.softUsageLimits.length; i += 1) {
      const entry = rule.softUsageLimits[i];
      if (
        !isRecord(entry) ||
        !isPositiveSafeInteger(entry.blockSize) ||
        !isPositiveSafeInteger(entry.maxUses) ||
        entry.exhaustionPolicy !== "fallback-to-original-pool"
      ) {
        findings.push({
          code: "INVALID_BLOCK_SETTINGS",
          severity: "error",
          fieldPath: `${basePath}.softUsageLimits[${i}]`,
          message:
            'Soft block-size limits require positive integer blockSize/maxUses and exhaustionPolicy "fallback-to-original-pool".',
        });
      }
    }
  }
}

/** Checks a percentage with at most four decimals and returns it scaled to an integer. */
function scaledPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const scaled = Math.round(value * 10_000);
  return Math.abs(scaled - value * 10_000) > 1e-6 ? null : scaled;
}

/**
 * Validates expected level distributions (RND-MINIM-003): percentages per
 * factor that name exactly that factor's levels, have at most four decimals,
 * add up to exactly 100 and leave at least one level above zero. A factor
 * without an entry samples its levels evenly.
 */
function validateExpectedDistributions(
  distributions: unknown,
  factors: readonly unknown[],
  findings: ValidationFinding[]
): void {
  if (distributions === undefined) return;
  const path = "minimizationSettings.expectedLevelDistributions";
  const fail = (fieldPath: string, message: string) =>
    findings.push({
      code: "INVALID_MINIMIZATION_SETTINGS",
      severity: "error",
      fieldPath,
      message,
    });
  if (!isRecord(distributions)) {
    fail(path, "Expected level distributions must be an object.");
    return;
  }
  const levelsByFactor = new Map<string, string[]>();
  for (const factor of factors) {
    if (isRecord(factor) && typeof factor.id === "string") {
      const levels = Array.isArray(factor.levels) ? factor.levels : [];
      levelsByFactor.set(
        factor.id,
        levels.flatMap((l) =>
          isRecord(l) && typeof l.id === "string" ? [l.id] : []
        )
      );
    }
  }
  for (const [factorId, entry] of Object.entries(distributions)) {
    const factorPath = `${path}.${factorId}`;
    const levels = levelsByFactor.get(factorId);
    if (!levels) {
      fail(factorPath, "Distribution names an unknown factor.");
      continue;
    }
    if (!isRecord(entry)) {
      fail(factorPath, "A factor distribution must be an object.");
      continue;
    }
    const keys = Object.keys(entry);
    if (
      keys.length !== levels.length ||
      !levels.every((levelId) => keys.includes(levelId))
    ) {
      fail(
        factorPath,
        "A factor distribution must give a percentage for exactly that factor's levels."
      );
      continue;
    }
    let total = 0;
    let valid = true;
    for (const levelId of levels) {
      const scaled = scaledPercent(entry[levelId]);
      if (scaled === null) {
        fail(
          `${factorPath}.${levelId}`,
          "A level percentage must be a non-negative number with at most four decimals."
        );
        valid = false;
      } else {
        total += scaled;
      }
    }
    if (valid && total !== 1_000_000) {
      fail(factorPath, "A factor's level percentages must add up to 100.");
    }
  }
}

function validateMinimizationSettings(
  settings: unknown,
  factors: readonly unknown[],
  findings: ValidationFinding[]
): void {
  if (!isRecord(settings)) {
    findings.push({
      code: "INVALID_MINIMIZATION_SETTINGS",
      severity: "error",
      fieldPath: "minimizationSettings",
      message: "MINIMIZATION designs require minimizationSettings.",
    });
    return;
  }

  if (!isPositiveSafeInteger(settings.virtualCohortSize)) {
    findings.push({
      code: "INVALID_MINIMIZATION_SETTINGS",
      severity: "error",
      fieldPath: "minimizationSettings.virtualCohortSize",
      message: "virtualCohortSize must be a positive safe integer.",
    });
  }

  const prob = settings.biasedCoinProbability;
  if (
    typeof prob !== "number" ||
    !Number.isFinite(prob) ||
    prob < 0.5 ||
    prob > 1
  ) {
    findings.push({
      code: "INVALID_MINIMIZATION_SETTINGS",
      severity: "error",
      fieldPath: "minimizationSettings.biasedCoinProbability",
      message:
        "biasedCoinProbability must be a finite number from 0.5 to 1.0 inclusive.",
    });
  }

  validateExpectedDistributions(
    settings.expectedLevelDistributions,
    factors,
    findings
  );
}

/**
 * Validates an untrusted or JSON-imported randomization plan against versioned
 * contract rules, method eligibility, cap scope, and overflow-safe resource limits.
 */
export function validateRandomizationPlan(
  input: unknown,
  limits: RandomizationResourceLimits = RANDOMIZATION_RESOURCE_LIMITS
): PlanValidationResult {
  const findings: ValidationFinding[] = [];

  if (!isRecord(input)) {
    return {
      ok: false,
      findings: [
        {
          code: "INVALID_PLAN_SHAPE",
          severity: "error",
          fieldPath: "",
          message: "Randomization plan must be a JSON object.",
        },
      ],
    };
  }

  if (
    typeof input.contractVersion !== "number" ||
    !isSupportedContractVersion("contract", input.contractVersion)
  ) {
    findings.push({
      code: "UNSUPPORTED_CONTRACT_VERSION",
      severity: "error",
      fieldPath: "contractVersion",
      message: "Unsupported or missing contractVersion.",
    });
  }

  if (
    typeof input.planSchemaVersion !== "number" ||
    !isSupportedContractVersion("plan", input.planSchemaVersion)
  ) {
    findings.push({
      code: "UNSUPPORTED_PLAN_SCHEMA_VERSION",
      severity: "error",
      fieldPath: "planSchemaVersion",
      message: "Unsupported or missing planSchemaVersion.",
    });
  }

  if (!isNonEmptyString(input.id)) {
    findings.push({
      code: "EMPTY_IDENTIFIER",
      severity: "error",
      fieldPath: "id",
      message: "Plan id must be a non-empty string.",
    });
  }

  if (!isNonEmptyString(input.name)) {
    findings.push({
      code: "EMPTY_IDENTIFIER",
      severity: "error",
      fieldPath: "name",
      message: "Plan name must be a non-empty string.",
    });
  }

  validateProvenance(input.provenance, findings);

  const method = input.method;
  const isBlock = method === "BLOCK";
  const isMinimization = method === "MINIMIZATION";
  if (!isBlock && !isMinimization) {
    findings.push({
      code: "UNKNOWN_METHOD",
      severity: "error",
      fieldPath: "method",
      message: `Unknown randomization method "${String(method)}". Expected "BLOCK" or "MINIMIZATION".`,
    });
  }

  if (isBlock && input.algorithmId !== MT19937_BLOCK_ALGORITHM_ID) {
    findings.push({
      code: "ALGORITHM_METHOD_MISMATCH",
      severity: "error",
      fieldPath: "algorithmId",
      message: `BLOCK method requires algorithmId "${MT19937_BLOCK_ALGORITHM_ID}".`,
    });
  }
  if (
    isMinimization &&
    input.algorithmId !== MT19937_MINIMIZATION_ALGORITHM_ID
  ) {
    findings.push({
      code: "ALGORITHM_METHOD_MISMATCH",
      severity: "error",
      fieldPath: "algorithmId",
      message: `MINIMIZATION method requires algorithmId "${MT19937_MINIMIZATION_ALGORITHM_ID}".`,
    });
  }

  if (!isPositiveSafeInteger(input.enrollmentTarget)) {
    findings.push({
      code: "INVALID_ENROLLMENT_TARGET",
      severity: "error",
      fieldPath: "enrollmentTarget",
      message: "enrollmentTarget must be a positive safe integer.",
    });
  }

  if (
    !isRecord(input.seed) ||
    typeof input.seed.value !== "string" ||
    typeof input.seed.source !== "string" ||
    !VALID_SEED_SOURCES.has(input.seed.source)
  ) {
    findings.push({
      code: "INVALID_SEED",
      severity: "error",
      fieldPath: "seed",
      message:
        'Seed requires a non-empty value and source "custom" or "generated".',
    });
  } else {
    const seedValidation = validateSeedValue(input.seed.value);
    if (!seedValidation.ok) {
      findings.push(...seedValidation.findings);
    }
  }

  if (
    !isRecord(input.subjectIdMask) ||
    typeof input.subjectIdMask.pattern !== "string"
  ) {
    findings.push({
      code: "INVALID_SUBJECT_ID_MASK",
      severity: "error",
      fieldPath: "subjectIdMask.pattern",
      message: "Subject ID mask pattern must be a non-empty string.",
    });
  } else {
    const maskValidation = parseSubjectIdMask(input.subjectIdMask.pattern);
    if (!maskValidation.ok) {
      findings.push(...maskValidation.findings);
    }
  }

  const arms = Array.isArray(input.arms) ? input.arms : [];
  if (arms.length === 0) {
    findings.push({
      code: "INVALID_ARM_LIST",
      severity: "error",
      fieldPath: "arms",
      message: "At least one treatment arm is required.",
    });
  } else {
    validateUniqueIdentifiers(arms, "arms", findings);
    const ratiosResult = reduceAllocationRatios(
      arms.map((arm) => ({
        allocationRatio:
          isRecord(arm) && typeof arm.allocationRatio === "number"
            ? arm.allocationRatio
            : Number.NaN,
      }))
    );
    if (!ratiosResult.ok) {
      findings.push(...ratiosResult.findings);
    }
  }

  const sites = Array.isArray(input.sites) ? input.sites : [];
  if (sites.length === 0) {
    findings.push({
      code: "INVALID_SITE_LIST",
      severity: "error",
      fieldPath: "sites",
      message: "At least one site is required.",
    });
  } else {
    validateUniqueIdentifiers(sites, "sites", findings);
    for (let i = 0; i < sites.length; i += 1) {
      const site = sites[i];
      if (
        !isRecord(site) ||
        typeof site.recruitmentWeight !== "number" ||
        !Number.isFinite(site.recruitmentWeight) ||
        site.recruitmentWeight < 0
      ) {
        findings.push({
          code: "INVALID_SITE_WEIGHT",
          severity: "error",
          fieldPath: `sites[${i}].recruitmentWeight`,
          message:
            "Site recruitmentWeight must be a non-negative finite number.",
        });
      }
    }
    // A zero-weight site is never sampled; at least one site must be able to be.
    if (
      sites.every(
        (site) =>
          isRecord(site) &&
          typeof site.recruitmentWeight === "number" &&
          site.recruitmentWeight === 0
      )
    ) {
      findings.push({
        code: "INVALID_SITE_WEIGHT",
        severity: "error",
        fieldPath: "sites",
        message: "At least one site needs a recruitmentWeight above zero.",
      });
    }
  }

  const factors = Array.isArray(input.factors) ? input.factors : [];
  const factorLevelCounts: number[] = [];
  if (factors.length > 0) {
    validateUniqueIdentifiers(factors, "factors", findings);
    for (let i = 0; i < factors.length; i += 1) {
      const factor = factors[i];
      const levels =
        isRecord(factor) && Array.isArray(factor.levels) ? factor.levels : [];
      if (levels.length === 0) {
        findings.push({
          code: "INVALID_FACTOR_LEVELS",
          severity: "error",
          fieldPath: `factors[${i}].levels`,
          message:
            "Each stratification factor must declare at least one level.",
        });
      } else {
        validateUniqueIdentifiers(levels, `factors[${i}].levels`, findings);
      }
      factorLevelCounts.push(levels.length);
    }
  }

  if (!isRecord(input.caps)) {
    findings.push({
      code: "INVALID_CAP_STRATEGY",
      severity: "error",
      fieldPath: "caps",
      message: "Enrollment cap configuration is required.",
    });
  } else {
    if (
      typeof input.caps.capScope !== "string" ||
      !VALID_CAP_SCOPES.has(input.caps.capScope)
    ) {
      findings.push({
        code: "INVALID_CAP_SCOPE",
        severity: "error",
        fieldPath: "caps.capScope",
        message: 'caps.capScope must be explicitly "study-wide" or "per-site".',
      });
    }

    const strategy = input.caps.strategy;
    if (isBlock) {
      if (
        typeof strategy !== "string" ||
        !VALID_BLOCK_CAP_STRATEGIES.has(strategy)
      ) {
        findings.push({
          code: "INVALID_CAP_STRATEGY",
          severity: "error",
          fieldPath: "caps.strategy",
          message:
            'BLOCK designs support only "manual", "proportional", or "marginal" cap strategies.',
        });
      }
    } else if (isMinimization) {
      if (strategy === "proportional") {
        findings.push({
          code: "UNSUPPORTED_METHOD_COMBINATION",
          severity: "error",
          fieldPath: "caps.strategy",
          message:
            'MINIMIZATION does not support the "proportional" cap strategy.',
        });
      } else if (
        typeof strategy !== "string" ||
        !VALID_MINIMIZATION_CAP_STRATEGIES.has(strategy)
      ) {
        findings.push({
          code: "INVALID_CAP_STRATEGY",
          severity: "error",
          fieldPath: "caps.strategy",
          message:
            'MINIMIZATION designs support only "manual" or "marginal" cap strategies.',
        });
      }
    }
  }

  if (isBlock) {
    if (input.minimizationSettings !== undefined) {
      findings.push({
        code: "UNSUPPORTED_METHOD_COMBINATION",
        severity: "error",
        fieldPath: "minimizationSettings",
        message: "BLOCK designs cannot include minimizationSettings.",
      });
    }
    if (!isRecord(input.blockSettings)) {
      findings.push({
        code: "INVALID_BLOCK_SETTINGS",
        severity: "error",
        fieldPath: "blockSettings",
        message: "BLOCK designs require blockSettings.",
      });
    } else {
      if (
        typeof input.blockSettings.trackingScope !== "string" ||
        !VALID_TRACKING_SCOPES.has(input.blockSettings.trackingScope)
      ) {
        findings.push({
          code: "INVALID_BLOCK_SETTINGS",
          severity: "error",
          fieldPath: "blockSettings.trackingScope",
          message:
            'blockSettings.trackingScope must be "global", "per-site", or "per-intersection".',
        });
      }
      validateBlockRule(
        input.blockSettings.defaultRule,
        "blockSettings.defaultRule",
        findings
      );
    }
  } else if (isMinimization) {
    if (input.blockSettings !== undefined) {
      findings.push({
        code: "UNSUPPORTED_METHOD_COMBINATION",
        severity: "error",
        fieldPath: "blockSettings",
        message: "MINIMIZATION designs cannot include blockSettings.",
      });
    }
    validateMinimizationSettings(input.minimizationSettings, factors, findings);
  }

  const preflight = checkResourcePreflight(
    {
      rows:
        typeof input.enrollmentTarget === "number"
          ? input.enrollmentTarget
          : undefined,
      armCount: arms.length,
      siteCount: sites.length,
      factorLevelCounts,
    },
    limits
  );
  if (!preflight.ok) {
    findings.push(...preflight.findings);
  }

  return {
    ok: findings.length === 0,
    findings,
  };
}
