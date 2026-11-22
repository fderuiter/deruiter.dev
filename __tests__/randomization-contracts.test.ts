// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  LEGACY_KEYED_ALGORITHM_ID,
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
  RANDOMIZATION_CONTRACT_VERSION,
  RANDOMIZATION_PLAN_SCHEMA_VERSION,
  RANDOMIZATION_RESOURCE_LIMITS,
  checkResourcePreflight,
  describeAlgorithmCompatibility,
  isSupportedContractVersion,
  reduceAllocationRatios,
  validateRandomizationPlan,
  type BlockRandomizationRequest,
  type MinimizationRandomizationRequest,
} from "@/lib/randomization";

describe("randomization versioned contracts and compatibility policy", () => {
  it("keeps legacy keyed FNV/Mulberry32 distinct from opt-in MT19937 algorithms with no seed parity claim", () => {
    const legacy = describeAlgorithmCompatibility(LEGACY_KEYED_ALGORITHM_ID);
    const block = describeAlgorithmCompatibility(MT19937_BLOCK_ALGORITHM_ID);
    const minimization = describeAlgorithmCompatibility(
      MT19937_MINIMIZATION_ALGORITHM_ID
    );

    expect(legacy.id).toBe("host-keyed-fnv-mulberry32-v1");
    expect(legacy.isLegacyDefault).toBe(true);
    expect(legacy.requiresExplicitOptIn).toBe(false);
    expect(legacy.seedParityWithLegacy).toBe(true);

    expect(block.id).toBe("mt19937-block-v1");
    expect(block.isLegacyDefault).toBe(false);
    expect(block.requiresExplicitOptIn).toBe(true);
    expect(block.seedParityWithLegacy).toBe(false);

    expect(minimization.id).toBe("mt19937-minimization-v1");
    expect(minimization.isLegacyDefault).toBe(false);
    expect(minimization.requiresExplicitOptIn).toBe(true);
    expect(minimization.seedParityWithLegacy).toBe(false);
  });

  it("validates supported contract, plan, and artifact schema versions", () => {
    expect(RANDOMIZATION_CONTRACT_VERSION).toBe(1);
    expect(RANDOMIZATION_PLAN_SCHEMA_VERSION).toBe(1);
    expect(RANDOMIZATION_ARTIFACT_SCHEMA_VERSION).toBe(1);

    expect(isSupportedContractVersion("contract", 1)).toBe(true);
    expect(isSupportedContractVersion("plan", 1)).toBe(true);
    expect(isSupportedContractVersion("artifact", 1)).toBe(true);

    expect(isSupportedContractVersion("contract", 0)).toBe(false);
    expect(isSupportedContractVersion("plan", 2)).toBe(false);
    expect(isSupportedContractVersion("artifact", -1)).toBe(false);
    expect(isSupportedContractVersion("contract", 1.5)).toBe(false);
  });

  it("exports the documented default resource limits", () => {
    expect(RANDOMIZATION_RESOURCE_LIMITS).toEqual({
      maxRows: 100_000,
      maxIntersections: 4_096,
      maxArms: 16,
      maxSites: 256,
      maxFactors: 16,
      maxLevelsPerFactor: 64,
      maxImportBytes: 8 * 1024 * 1024,
      maxImportNestingDepth: 64,
      maxSimulationRepetitions: 200,
      maxSimulationAggregateRows: 10_000_000,
    });
  });

  it("reduces positive integer arm allocation ratios by their GCD", () => {
    const reduced = reduceAllocationRatios([
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 4 },
      { id: "arm-b", code: "B", label: "Comparator", allocationRatio: 2 },
      { id: "arm-c", code: "C", label: "Placebo", allocationRatio: 6 },
    ]);
    expect(reduced).toEqual({ ok: true, gcd: 2, ratios: [2, 1, 3] });

    const coprime = reduceAllocationRatios([
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 3 },
      { id: "arm-b", code: "B", label: "Placebo", allocationRatio: 5 },
    ]);
    expect(coprime).toEqual({ ok: true, gcd: 1, ratios: [3, 5] });
  });

  it("rejects empty arm lists and non-positive or non-integer allocation ratios with stable field paths", () => {
    const empty = reduceAllocationRatios([]);
    expect(empty.ok).toBe(false);
    if (!empty.ok) {
      expect(empty.findings).toEqual([
        expect.objectContaining({
          code: "INVALID_ARM_LIST",
          severity: "error",
          fieldPath: "arms",
        }),
      ]);
    }

    const invalid = reduceAllocationRatios([
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 0 },
      { id: "arm-b", code: "B", label: "Placebo", allocationRatio: 1.5 },
      { id: "arm-c", code: "C", label: "High", allocationRatio: -2 },
    ]);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.findings.map((f) => [f.code, f.fieldPath])).toEqual([
        ["INVALID_ARM_RATIO", "arms[0].allocationRatio"],
        ["INVALID_ARM_RATIO", "arms[1].allocationRatio"],
        ["INVALID_ARM_RATIO", "arms[2].allocationRatio"],
      ]);
    }
  });

  it("enforces overflow-safe preflight resource limits before expanding intersections or simulations", () => {
    const safe = checkResourcePreflight({
      rows: 1_000,
      armCount: 3,
      siteCount: 10,
      factorLevelCounts: [2, 3, 4],
      importBytes: 1024,
      importNestingDepth: 8,
      simulationRepetitions: 50,
    });
    expect(safe.ok).toBe(true);
    expect(safe.estimatedIntersections).toBe("24");
    expect(safe.estimatedSimulationAggregateRows).toBe("50000");
    expect(safe.findings).toEqual([]);

    // 16 factors x 64 levels = 64^16 = 79228162514264337593543950336 (exceeds Number.MAX_SAFE_INTEGER)
    const hugeIntersections = checkResourcePreflight({
      factorLevelCounts: Array.from({ length: 16 }, () => 64),
    });
    expect(hugeIntersections.ok).toBe(false);
    expect(hugeIntersections.estimatedIntersections).toBe(
      "79228162514264337593543950336"
    );
    expect(hugeIntersections.findings).toContainEqual(
      expect.objectContaining({
        code: "RESOURCE_LIMIT_EXCEEDED",
        fieldPath: "factors",
        estimatedValue: "79228162514264337593543950336",
        limitValue: "4096",
      })
    );

    const overBudget = checkResourcePreflight({
      rows: 100_001,
      armCount: 17,
      siteCount: 257,
      factorLevelCounts: [65],
      importBytes: 8 * 1024 * 1024 + 1,
      importNestingDepth: 65,
      simulationRepetitions: 201,
    });
    expect(overBudget.ok).toBe(false);
    expect(overBudget.findings.map((f) => f.fieldPath)).toEqual(
      expect.arrayContaining([
        "enrollmentTarget",
        "arms",
        "sites",
        "factors[0].levels",
        "importBytes",
        "importNestingDepth",
        "simulationRepetitions",
        "simulationAggregateRows",
      ])
    );
  });

  const baseStudyFields = {
    contractVersion: RANDOMIZATION_CONTRACT_VERSION,
    planSchemaVersion: RANDOMIZATION_PLAN_SCHEMA_VERSION,
    id: "plan-001",
    name: "Phase III Stratified Plan",
    provenance: {
      studyId: "STUDY-101",
      studyVersionId: "sv-1",
      studyDesignId: "sd-1",
      workspaceRevisionId: "R1",
      usdmSha256: "a".repeat(64),
    },
    arms: [
      { id: "arm-1", code: "ACTIVE", label: "Active", allocationRatio: 2 },
      { id: "arm-2", code: "PBO", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      { id: "site-1", code: "S01", label: "Site 01", recruitmentWeight: 0.6 },
      { id: "site-2", code: "S02", label: "Site 02", recruitmentWeight: 0.4 },
    ],
    factors: [
      {
        id: "fac-age",
        code: "AGEGRP",
        label: "Age Group",
        levels: [
          { id: "lvl-lt65", code: "LT65", label: "<65" },
          { id: "lvl-ge65", code: "GE65", label: ">=65" },
        ],
      },
    ],
    seed: { value: "DEMOSEED2026", source: "custom" as const },
    subjectIdMask: {
      pattern: "{SITE}-{SEQ:4}",
      checksumAlgorithm: "none" as const,
    },
    enrollmentTarget: 120,
  };

  it("validates JSON-serializable BLOCK and MINIMIZATION plans with explicit cap scope and soft block limits", () => {
    const blockPlan: BlockRandomizationRequest = {
      ...baseStudyFields,
      method: "BLOCK",
      algorithmId: MT19937_BLOCK_ALGORITHM_ID,
      caps: {
        strategy: "proportional",
        capScope: "study-wide",
        totalEnrollment: 120,
        factorLevelPercentages: {
          "fac-age": { "lvl-lt65": 50, "lvl-ge65": 50 },
        },
      },
      blockSettings: {
        trackingScope: "per-intersection",
        allowPartialFinalBlock: true,
        defaultRule: {
          mode: "random-pool",
          sizes: [3, 6],
          softUsageLimits: [
            {
              blockSize: 3,
              maxUses: 10,
              exhaustionPolicy: "fallback-to-original-pool",
            },
          ],
        },
      },
    };

    const roundTrippedBlock = JSON.parse(JSON.stringify(blockPlan));
    expect(validateRandomizationPlan(roundTrippedBlock)).toEqual({
      ok: true,
      findings: [],
    });

    const minPlan: MinimizationRandomizationRequest = {
      ...baseStudyFields,
      method: "MINIMIZATION",
      algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
      caps: {
        strategy: "marginal",
        capScope: "per-site",
        levelCaps: [
          {
            factorId: "fac-age",
            levelId: "lvl-lt65",
            siteId: "site-1",
            cap: 40,
          },
        ],
      },
      minimizationSettings: {
        virtualCohortSize: 120,
        biasedCoinProbability: 0.8,
      },
    };

    expect(
      validateRandomizationPlan(JSON.parse(JSON.stringify(minPlan)))
    ).toEqual({
      ok: true,
      findings: [],
    });
  });

  it("rejects unknown imported method text and disallowed minimization combinations", () => {
    const unknownMethod = validateRandomizationPlan({
      ...baseStudyFields,
      method: "ADAPTIVE_RAR",
      algorithmId: MT19937_BLOCK_ALGORITHM_ID,
      caps: {
        strategy: "manual",
        capScope: "study-wide",
        intersectionCaps: [],
      },
    });
    expect(unknownMethod.ok).toBe(false);
    expect(unknownMethod.findings).toContainEqual(
      expect.objectContaining({
        code: "UNKNOWN_METHOD",
        fieldPath: "method",
      })
    );

    const invalidMinimization = validateRandomizationPlan({
      ...baseStudyFields,
      method: "MINIMIZATION",
      algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
      caps: {
        strategy: "proportional",
        capScope: "study-wide",
        totalEnrollment: 120,
        factorLevelPercentages: {},
      },
      blockSettings: {
        trackingScope: "global",
        allowPartialFinalBlock: false,
        defaultRule: { mode: "random-pool", sizes: [3, 6] },
      },
      minimizationSettings: {
        virtualCohortSize: 120,
        biasedCoinProbability: 0.49,
      },
    });
    expect(invalidMinimization.ok).toBe(false);
    expect(
      invalidMinimization.findings.map((f) => [f.code, f.fieldPath])
    ).toEqual(
      expect.arrayContaining([
        ["UNSUPPORTED_METHOD_COMBINATION", "caps.strategy"],
        ["UNSUPPORTED_METHOD_COMBINATION", "blockSettings"],
        [
          "INVALID_MINIMIZATION_SETTINGS",
          "minimizationSettings.biasedCoinProbability",
        ],
      ])
    );
  });

  it("reports duplicate IDs, missing site weights, invalid capScope, and algorithm mismatches", () => {
    const broken = validateRandomizationPlan({
      ...baseStudyFields,
      method: "BLOCK",
      algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
      arms: [
        { id: "arm-1", code: "A", label: "A", allocationRatio: 1 },
        { id: "arm-1", code: "B", label: "B", allocationRatio: 1 },
      ],
      sites: [
        { id: "site-1", code: "S01", label: "Site 1", recruitmentWeight: -1 },
      ],
      caps: {
        strategy: "manual",
        capScope: "implicit-default",
        intersectionCaps: [],
      },
      blockSettings: {
        trackingScope: "global",
        allowPartialFinalBlock: false,
        defaultRule: { mode: "random-pool", sizes: [2, 4] },
      },
    });
    expect(broken.ok).toBe(false);
    expect(broken.findings.map((f) => [f.code, f.fieldPath])).toEqual(
      expect.arrayContaining([
        ["ALGORITHM_METHOD_MISMATCH", "algorithmId"],
        ["DUPLICATE_IDENTIFIER", "arms[1].id"],
        ["INVALID_SITE_WEIGHT", "sites[0].recruitmentWeight"],
        ["INVALID_CAP_SCOPE", "caps.capScope"],
      ])
    );
  });

  it("rejects non-object plans, missing provenance, invalid block sizes, and non-finite preflight metrics", () => {
    const nonObject = validateRandomizationPlan("not-an-object");
    expect(nonObject.ok).toBe(false);
    expect(nonObject.findings[0]).toEqual(
      expect.objectContaining({
        code: "INVALID_PLAN_SHAPE",
        fieldPath: "",
      })
    );

    const badBlock = validateRandomizationPlan({
      ...baseStudyFields,
      provenance: undefined,
      method: "BLOCK",
      algorithmId: MT19937_BLOCK_ALGORITHM_ID,
      caps: {
        strategy: "manual",
        capScope: "study-wide",
        intersectionCaps: [],
      },
      blockSettings: {
        trackingScope: "global",
        allowPartialFinalBlock: false,
        defaultRule: { mode: "random-pool", sizes: [0, -2, 1.5] },
      },
    });
    expect(badBlock.ok).toBe(false);
    expect(badBlock.findings.map((f) => [f.code, f.fieldPath])).toEqual(
      expect.arrayContaining([
        ["INVALID_PROVENANCE", "provenance"],
        ["INVALID_BLOCK_SETTINGS", "blockSettings.defaultRule.sizes[0]"],
        ["INVALID_BLOCK_SETTINGS", "blockSettings.defaultRule.sizes[1]"],
        ["INVALID_BLOCK_SETTINGS", "blockSettings.defaultRule.sizes[2]"],
      ])
    );

    const badPreflight = checkResourcePreflight({
      rows: Number.NaN,
      factorLevelCounts: [Number.POSITIVE_INFINITY, -1],
    });
    expect(badPreflight.ok).toBe(false);
    expect(badPreflight.findings.map((f) => [f.code, f.fieldPath])).toEqual(
      expect.arrayContaining([
        ["INVALID_RESOURCE_METRIC", "enrollmentTarget"],
        ["INVALID_RESOURCE_METRIC", "factors[0].levels"],
        ["INVALID_RESOURCE_METRIC", "factors[1].levels"],
      ])
    );
  });

  it("maintains all 155 unique requirements with explicit evidence statuses in docs/reference/randomization-rebuild.md", () => {
    const docPath = path.resolve(
      process.cwd(),
      "docs/reference/randomization-rebuild.md"
    );
    const content = readFileSync(docPath, "utf8");
    const rowPattern =
      /^\|\s*`(RND-[A-Z]+-\d{3})`\s*\|[^|]+\|\s*`#\d+`\s*\|\s*`(Implemented|Deferred|Unsupported)`\s*\|/gm;

    const seen = new Map<string, string>();
    for (const match of content.matchAll(rowPattern)) {
      const [, id, status] = match;
      expect(seen.has(id)).toBe(false);
      seen.set(id, status);
    }

    expect(seen.size).toBe(155);
    expect(seen.get("RND-QUALI-001")).toBe("Implemented");
    expect(seen.get("RND-QUALI-004")).toBe("Implemented");
    expect(seen.get("RND-CODE-011")).toBe("Unsupported");
  });
});
