// @vitest-environment node
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  allocateLargestRemainder,
  enumerateStratumIntersections,
  generateBlockSchedule,
  isProportionalMatrixCurrent,
  resolveBlockCapacities,
  serializeStructuralStratumKey,
  type BlockCapConfig,
  type BlockRandomizationRequest,
  type StratificationFactorSpec,
} from "@/lib/randomization";

const binary = (id: string): StratificationFactorSpec => ({
  id,
  code: id.toUpperCase(),
  label: id,
  levels: [
    { id: `${id}-1`, code: "L1", label: "Level one" },
    { id: `${id}-2`, code: "L2", label: "Level two" },
  ],
});

function request(
  factors: readonly StratificationFactorSpec[],
  caps: BlockCapConfig,
  sites = [
    { id: "site-1", code: "S01", label: "Site one", recruitmentWeight: 1 },
  ]
): BlockRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-caps",
    name: "Synthetic caps plan",
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
    sites,
    factors,
    seed: { value: "CapsSeed2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:4}" },
    enrollmentTarget: 100,
    caps,
    blockSettings: {
      defaultRule: { mode: "fixed-sequence", sizes: [2] },
      trackingScope: "per-intersection",
      allowPartialFinalBlock: true,
    },
  };
}

function proportional(
  total: number,
  factorLevelPercentages: Record<string, Record<string, number>>,
  capScope: "study-wide" | "per-site" = "study-wide"
): BlockCapConfig {
  return {
    strategy: "proportional",
    capScope,
    totalEnrollment: total,
    factorLevelPercentages,
  };
}

describe("stratum intersections", () => {
  it("expands factors in Cartesian order with structural keys, first factor slowest", () => {
    const intersections = enumerateStratumIntersections([
      binary("a"),
      binary("b"),
    ]);
    expect(intersections.map((i) => i.stratumKey)).toEqual([
      '[["a","a-1"],["b","b-1"]]',
      '[["a","a-1"],["b","b-2"]]',
      '[["a","a-2"],["b","b-1"]]',
      '[["a","a-2"],["b","b-2"]]',
    ]);
    expect(enumerateStratumIntersections([]).map((i) => i.stratumKey)).toEqual([
      "[]",
    ]);
  });

  it("keys counters by structural IDs, not display labels", () => {
    const sameLabels: StratificationFactorSpec = {
      id: "f",
      code: "F",
      label: "F",
      levels: [
        { id: "x", code: "X", label: "Same" },
        { id: "y", code: "Y", label: "Same" },
      ],
    };
    const keys = enumerateStratumIntersections([sameLabels]).map(
      (i) => i.stratumKey
    );
    expect(new Set(keys).size).toBe(2);
  });
});

describe("proportional caps (RND-CAPS-003 to -005)", () => {
  it("gives N=11 with one 50/50 factor 6 and 5", () => {
    const resolved = resolveBlockCapacities(
      request([binary("a")], proportional(11, { a: { "a-1": 50, "a-2": 50 } }))
    );
    expect(resolved.ok && resolved.caps.map((c) => c.cap)).toEqual([6, 5]);
  });

  it("gives N=10 with two independent 50/50 factors 3, 3, 2, 2", () => {
    const resolved = resolveBlockCapacities(
      request(
        [binary("a"), binary("b")],
        proportional(10, {
          a: { "a-1": 50, "a-2": 50 },
          b: { "b-1": 50, "b-2": 50 },
        })
      )
    );
    expect(resolved.ok && resolved.caps.map((c) => c.cap)).toEqual([
      3, 3, 2, 2,
    ]);
  });

  it("assigns leftover seats by largest remainder before Cartesian order", () => {
    // 7 x (70, 30): exact 4.9 and 2.1 -> floors 4, 2; one seat left goes to 0.9.
    const factor = binary("a");
    const result = allocateLargestRemainder(
      7,
      enumerateStratumIntersections([factor]),
      { a: { "a-1": 70, "a-2": 30 } },
      [factor]
    );
    expect(result).toEqual({ ok: true, counts: [5, 2] });
  });

  it("always sums to N for any valid percentages", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5000 }),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (n, pA, pB) => {
          const factors = [binary("a"), binary("b")];
          const result = allocateLargestRemainder(
            n,
            enumerateStratumIntersections(factors),
            {
              a: { "a-1": pA, "a-2": 100 - pA },
              b: { "b-1": pB, "b-2": 100 - pB },
            },
            factors
          );
          return result.ok && result.counts.reduce((x, y) => x + y, 0) === n;
        }
      )
    );
  });

  it("refuses percentages that do not add to 100, are negative, missing or too precise", () => {
    const cases: Record<string, Record<string, number>>[] = [
      { a: { "a-1": 50, "a-2": 49 } },
      { a: { "a-1": -10, "a-2": 110 } },
      { a: { "a-1": 100 } },
      { a: { "a-1": 33.33333, "a-2": 66.66667 } },
      { a: { "a-1": Number.NaN, "a-2": 50 } },
      { a: { "a-1": 50, "a-2": 50, ghost: 0 } },
      {},
    ];
    for (const percentages of cases) {
      const resolved = resolveBlockCapacities(
        request([binary("a")], proportional(10, percentages))
      );
      expect(resolved.ok).toBe(false);
      if (!resolved.ok) {
        expect(
          resolved.findings.every((f) => f.code === "INVALID_CAP_STRATEGY")
        ).toBe(true);
      }
    }
  });

  it("generates exactly the proportional total", () => {
    const result = generateBlockSchedule(
      request([binary("a")], proportional(11, { a: { "a-1": 50, "a-2": 50 } }))
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(11);
    // 6 fills three blocks of two; 5 leaves one block cut to a single slot.
    expect(result.partialBlocks).toEqual([
      {
        siteId: "site-1",
        stratumKey: '[["a","a-2"]]',
        blockIndex: 3,
        blockSize: 2,
        emittedSlots: 1,
      },
    ]);
  });

  it("marks a saved matrix stale once its total, percentages, levels or sites change", () => {
    const base = request(
      [binary("a")],
      proportional(10, { a: { "a-1": 50, "a-2": 50 } })
    );
    const resolved = resolveBlockCapacities(base);
    if (!resolved.ok) throw new Error("did not resolve");
    expect(isProportionalMatrixCurrent(base, resolved.sourceFingerprint)).toBe(
      true
    );
    const changed = [
      request([binary("a")], proportional(12, { a: { "a-1": 50, "a-2": 50 } })),
      request([binary("a")], proportional(10, { a: { "a-1": 60, "a-2": 40 } })),
      request([binary("z")], proportional(10, { z: { "z-1": 50, "z-2": 50 } })),
      request(
        [binary("a")],
        proportional(10, { a: { "a-1": 50, "a-2": 50 } }),
        [{ id: "site-9", code: "S09", label: "Other", recruitmentWeight: 1 }]
      ),
    ];
    for (const next of changed) {
      expect(
        isProportionalMatrixCurrent(next, resolved.sourceFingerprint)
      ).toBe(false);
    }
  });
});

describe("manual caps (RND-CAPS-001, -002)", () => {
  const key = (levelId: string) =>
    serializeStructuralStratumKey([{ factorId: "a", levelId }]);

  it("requires a cap for every intersection, with 0 allowed", () => {
    const missing = resolveBlockCapacities(
      request([binary("a")], {
        strategy: "manual",
        capScope: "study-wide",
        intersectionCaps: [{ stratumKey: key("a-1"), cap: 4 }],
      })
    );
    expect(missing.ok).toBe(false);
    const complete = resolveBlockCapacities(
      request([binary("a")], {
        strategy: "manual",
        capScope: "study-wide",
        intersectionCaps: [
          { stratumKey: key("a-1"), cap: 4 },
          { stratumKey: key("a-2"), cap: 0 },
        ],
      })
    );
    expect(complete.ok && complete.caps.map((c) => c.cap)).toEqual([4, 0]);
  });

  it("refuses unknown keys, negative or fractional caps, duplicates and site names on study-wide caps", () => {
    const resolved = resolveBlockCapacities(
      request([binary("a")], {
        strategy: "manual",
        capScope: "study-wide",
        intersectionCaps: [
          { stratumKey: '[["a","nope"]]', cap: 1 },
          { stratumKey: key("a-1"), cap: -1 },
          { stratumKey: key("a-1"), cap: 1.5 },
          { stratumKey: key("a-2"), cap: 2 },
          { stratumKey: key("a-2"), cap: 3 },
          { stratumKey: key("a-2"), siteId: "site-1", cap: 3 },
        ],
      })
    );
    expect(resolved.ok).toBe(false);
    if (resolved.ok) return;
    const codes = resolved.findings.map((f) => f.code);
    expect(codes).toContain("INVALID_CAP_SCOPE");
    expect(
      codes.filter((c) => c === "INVALID_CAP_STRATEGY").length
    ).toBeGreaterThanOrEqual(4);
  });

  it("refuses marginal caps until the marginal engine lands", () => {
    const resolved = resolveBlockCapacities(
      request([binary("a")], {
        strategy: "marginal",
        capScope: "study-wide",
        levelCaps: [{ factorId: "a", levelId: "a-1", cap: 3 }],
      })
    );
    expect(resolved).toMatchObject({
      ok: false,
      findings: [{ code: "UNSUPPORTED_METHOD_COMBINATION" }],
    });
  });

  it("refuses a schedule whose total capacity exceeds the row limit before expanding it", () => {
    const result = generateBlockSchedule(
      request([], {
        strategy: "manual",
        capScope: "study-wide",
        intersectionCaps: [{ stratumKey: "[]", cap: 100_001 }],
      })
    );
    expect(result).toMatchObject({
      ok: false,
      findings: [{ code: "RESOURCE_LIMIT_EXCEEDED" }],
    });
  });
});
