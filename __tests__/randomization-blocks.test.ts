// @vitest-environment node
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { fromAny } from "@total-typescript/shoehorn";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  buildPermutedBlock,
  createBlockAllocationSession,
  createRandomizationStreams,
  generateBlockSchedule,
  previewBlockComposition,
  serializeStructuralStratumKey,
  type BlockRandomizationRequest,
  type BlockSettings,
  type BlockCapConfig,
  type PrngStream,
  type StratificationFactorSpec,
} from "@/lib/randomization";

const UNSTRATIFIED = serializeStructuralStratumKey([]);

function stub(values: readonly number[]): PrngStream & { draws: number } {
  let index = 0;
  const stream = {
    draws: 0,
    nextFloat() {
      stream.draws += 1;
      const value = values[index % values.length];
      index += 1;
      return value;
    },
    nextUint32() {
      return Math.floor(stream.nextFloat() * 2 ** 32);
    },
  };
  return stream;
}

function blockRequest(
  overrides: {
    arms?: BlockRandomizationRequest["arms"];
    sites?: BlockRandomizationRequest["sites"];
    factors?: readonly StratificationFactorSpec[];
    caps?: BlockCapConfig;
    blockSettings?: Partial<BlockSettings>;
    seed?: string;
  } = {}
): BlockRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-1",
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
    arms: overrides.arms ?? [
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 1 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: overrides.sites ?? [
      { id: "site-1", code: "S01", label: "Site one", recruitmentWeight: 1 },
      { id: "site-2", code: "S02", label: "Site two", recruitmentWeight: 5 },
    ],
    factors: overrides.factors ?? [],
    seed: { value: overrides.seed ?? "BlockSeed2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:3}" },
    enrollmentTarget: 100,
    caps: overrides.caps ?? {
      strategy: "manual",
      capScope: "study-wide",
      intersectionCaps: [{ stratumKey: UNSTRATIFIED, cap: 8 }],
    },
    blockSettings: {
      defaultRule: { mode: "fixed-sequence", sizes: [4] },
      trackingScope: "per-intersection",
      allowPartialFinalBlock: true,
      ...overrides.blockSettings,
    },
  };
}

function countBy<T>(
  items: readonly T[],
  key: (item: T) => string
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) out[key(item)] = (out[key(item)] ?? 0) + 1;
  return out;
}

describe("block composition and shuffle (RND-BLOCK-001, -002, -009, -010)", () => {
  it("reduces 2:2 so sizes 2 and 4 are legal, and previews 2:1 size 6 as four and two", () => {
    const twoTwo = [{ allocationRatio: 2 }, { allocationRatio: 2 }];
    expect(previewBlockComposition(twoTwo, 2)).toEqual({
      blockSize: 2,
      legal: true,
      slotsPerArm: [1, 1],
      remainderSlots: 0,
    });
    expect(previewBlockComposition(twoTwo, 4).slotsPerArm).toEqual([2, 2]);
    const twoOne = [{ allocationRatio: 2 }, { allocationRatio: 1 }];
    expect(previewBlockComposition(twoOne, 6).slotsPerArm).toEqual([4, 2]);
    expect(previewBlockComposition(twoOne, 4)).toEqual({
      blockSize: 4,
      legal: false,
      slotsPerArm: [],
      remainderSlots: 1,
    });
    expect(previewBlockComposition(twoOne, Number.NaN).legal).toBe(false);
  });

  it("shuffles backward with j = floor(U * (i + 1)) against a hand-derived permutation", () => {
    // Base [A, A, P, P]. i=3: j=floor(0.9*4)=3, no change. i=2: j=floor(0.1*3)=0,
    // swap 2 and 0 -> [P, A, A, P]. i=1: j=floor(0.5*2)=1, no change.
    const stream = stub([0.9, 0.1, 0.5]);
    expect(buildPermutedBlock(["A", "P"], [1, 1], 4, stream)).toEqual([
      "P",
      "A",
      "A",
      "P",
    ]);
    expect(stream.draws).toBe(3);
  });

  it("rejects a block size that is not a multiple of the reduced ratio sum", () => {
    expect(() =>
      buildPermutedBlock(["A", "P"], [2, 1], 4, stub([0.5]))
    ).toThrow(RangeError);
  });

  it("keeps exact composition in every complete block for any stream", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 4 }), {
          minLength: 1,
          maxLength: 4,
        }),
        fc.integer({ min: 1, max: 4 }),
        fc.array(fc.double({ min: 0, max: 0.999999, noNaN: true }), {
          minLength: 1,
          maxLength: 16,
        }),
        (ratios, multiplier, draws) => {
          const ids = ratios.map((_, i) => `arm-${i}`);
          const size = ratios.reduce((a, b) => a + b, 0) * multiplier;
          const block = buildPermutedBlock(ids, ratios, size, stub(draws));
          const counts = countBy(block, (id) => id);
          return ids.every((id, i) => counts[id] === ratios[i] * multiplier);
        }
      )
    );
  });
});

describe("standard schedule traversal and caps (RND-BLOCK-011, -012, RND-CAPS-002)", () => {
  it("shares a study-wide cap of 8 across two sites with block size 4: 4 rows each", () => {
    const result = generateBlockSchedule(blockRequest());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(8);
    expect(countBy(result.rows, (r) => r.siteId)).toEqual({
      "site-1": 4,
      "site-2": 4,
    });
    expect(result.partialBlocks).toEqual([]);
    expect(result.rows.map((r) => r.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(result.rows.slice(0, 4).map((r) => r.subjectId)).toEqual([
      "S01-001",
      "S01-002",
      "S01-003",
      "S01-004",
    ]);
    expect(result.rows[4].subjectId).toBe("S02-001");
    for (const site of ["site-1", "site-2"]) {
      const arms = countBy(
        result.rows.filter((r) => r.siteId === site),
        (r) => r.armId
      );
      expect(arms).toEqual({ "arm-a": 2, "arm-p": 2 });
    }
  });

  it("stops at a cap of 5 and marks the truncated tail without claiming balance", () => {
    const result = generateBlockSchedule(
      blockRequest({
        caps: {
          strategy: "manual",
          capScope: "study-wide",
          intersectionCaps: [{ stratumKey: UNSTRATIFIED, cap: 5 }],
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(5);
    expect(result.partialBlocks).toEqual([
      {
        siteId: "site-2",
        stratumKey: UNSTRATIFIED,
        blockIndex: 1,
        blockSize: 4,
        emittedSlots: 1,
      },
    ]);
  });

  it("refuses a truncated block when partial final blocks are not allowed", () => {
    const result = generateBlockSchedule(
      blockRequest({
        caps: {
          strategy: "manual",
          capScope: "study-wide",
          intersectionCaps: [{ stratumKey: UNSTRATIFIED, cap: 5 }],
        },
        blockSettings: { allowPartialFinalBlock: false },
      })
    );
    expect(result).toMatchObject({
      ok: false,
      findings: [
        {
          code: "INVALID_BLOCK_SETTINGS",
          fieldPath: "blockSettings.allowPartialFinalBlock",
        },
      ],
    });
  });

  it("applies a per-site cap to each site separately", () => {
    const result = generateBlockSchedule(
      blockRequest({
        caps: {
          strategy: "manual",
          capScope: "per-site",
          intersectionCaps: [
            { stratumKey: UNSTRATIFIED, cap: 8 },
            { stratumKey: UNSTRATIFIED, siteId: "site-2", cap: 4 },
          ],
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(countBy(result.rows, (r) => r.siteId)).toEqual({
      "site-1": 8,
      "site-2": 4,
    });
    expect(
      result.rows.filter((r) => r.siteId === "site-1").map((r) => r.blockIndex)
    ).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
  });

  it("visits intersections first, then sites, and a zero cap blocks an intersection", () => {
    const factors: StratificationFactorSpec[] = [
      {
        id: "fac-age",
        code: "AGE",
        label: "Age",
        levels: [
          { id: "lt65", code: "LT65", label: "<65" },
          { id: "ge65", code: "GE65", label: ">=65" },
        ],
      },
    ];
    const young = serializeStructuralStratumKey([
      { factorId: "fac-age", levelId: "lt65" },
    ]);
    const old = serializeStructuralStratumKey([
      { factorId: "fac-age", levelId: "ge65" },
    ]);
    const result = generateBlockSchedule(
      blockRequest({
        factors,
        caps: {
          strategy: "manual",
          capScope: "study-wide",
          intersectionCaps: [
            { stratumKey: young, cap: 8 },
            { stratumKey: old, cap: 0 },
          ],
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.every((r) => r.stratumKey === young)).toBe(true);
    expect(result.rows.map((r) => r.siteId)).toEqual([
      ...Array(4).fill("site-1"),
      ...Array(4).fill("site-2"),
    ]);
    expect(result.rows[0].stratumLevels).toEqual({ "fac-age": "lt65" });
  });

  it("is deterministic for one seed and ignores recruitment weights", () => {
    const first = generateBlockSchedule(blockRequest());
    const again = generateBlockSchedule(blockRequest());
    const reweighted = generateBlockSchedule(
      blockRequest({
        sites: [
          {
            id: "site-1",
            code: "S01",
            label: "Site one",
            recruitmentWeight: 9,
          },
          {
            id: "site-2",
            code: "S02",
            label: "Site two",
            recruitmentWeight: 1,
          },
        ],
      })
    );
    expect(first).toEqual(again);
    expect(reweighted.ok && first.ok && reweighted.rows).toEqual(
      first.ok && first.rows
    );
  });

  it("matches a golden vector derived independently from the MT19937 stream", () => {
    const result = generateBlockSchedule(blockRequest());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Reference: two fixed blocks of four in traversal order (site 1, then
    // site 2), each a hand-written backward Fisher-Yates over [A, A, P, P].
    const stream = createRandomizationStreams("BlockSeed2026").allocation;
    const expected: string[] = [];
    for (let block = 0; block < 2; block += 1) {
      const cells = ["arm-a", "arm-a", "arm-p", "arm-p"];
      for (let i = 3; i >= 1; i -= 1) {
        const j = Math.floor(stream.nextFloat() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      expected.push(...cells);
    }
    expect(result.rows.map((r) => r.armId)).toEqual(expected);
    expect(result.rows.map((r) => r.positionInBlock)).toEqual([
      1, 2, 3, 4, 1, 2, 3, 4,
    ]);
  });

  it("keeps every total equal to the summed caps and never overruns a cap", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 40 }),
        fc.integer({ min: 0, max: 40 }),
        fc.constantFrom<"study-wide" | "per-site">("study-wide", "per-site"),
        (capA, capB, capScope) => {
          const intersectionCaps =
            capScope === "per-site"
              ? [
                  { stratumKey: UNSTRATIFIED, siteId: "site-1", cap: capA },
                  { stratumKey: UNSTRATIFIED, siteId: "site-2", cap: capB },
                ]
              : [{ stratumKey: UNSTRATIFIED, cap: capA }];
          const result = generateBlockSchedule(
            blockRequest({
              caps: { strategy: "manual", capScope, intersectionCaps },
              blockSettings: {
                defaultRule: { mode: "random-pool", sizes: [2, 4, 6] },
              },
            })
          );
          if (!result.ok) return false;
          const expected = capScope === "per-site" ? capA + capB : capA;
          const isPartial = (siteId: string, blockIndex: number | null) =>
            result.partialBlocks.some(
              (p) => p.siteId === siteId && p.blockIndex === blockIndex
            );
          const blocks = new Map<string, string[]>();
          for (const row of result.rows) {
            if (isPartial(row.siteId, row.blockIndex)) continue;
            const key = `${row.siteId}:${row.blockIndex}`;
            blocks.set(key, [...(blocks.get(key) ?? []), row.armId]);
          }
          const balanced = [...blocks.values()].every((arms) => {
            const counts = countBy(arms, (id) => id);
            return (
              counts["arm-a"] === arms.length / 2 &&
              counts["arm-p"] === arms.length / 2
            );
          });
          return (
            result.rows.length === expected &&
            balanced &&
            result.partialBlocks.every((p) => p.emittedSlots < p.blockSize)
          );
        }
      ),
      { numRuns: 40 }
    );
  });
});

describe("block-size rules (RND-BLOCK-003 to -008)", () => {
  it("cycles a fixed sequence 2, 4, 2, 4 independently per tracking cell", () => {
    const result = generateBlockSchedule(
      blockRequest({
        caps: {
          strategy: "manual",
          capScope: "per-site",
          intersectionCaps: [{ stratumKey: UNSTRATIFIED, cap: 12 }],
        },
        blockSettings: {
          defaultRule: { mode: "fixed-sequence", sizes: [2, 4] },
          trackingScope: "per-intersection",
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const site of ["site-1", "site-2"]) {
      const sizes = [
        ...new Map(
          result.rows
            .filter((r) => r.siteId === site)
            .map((r) => [r.blockIndex, r.blockSize])
        ).values(),
      ];
      expect(sizes).toEqual([2, 4, 2, 4]);
    }
  });

  it("lets an intersection override beat a site override, which beats the default", () => {
    const result = generateBlockSchedule(
      blockRequest({
        caps: {
          strategy: "manual",
          capScope: "per-site",
          intersectionCaps: [{ stratumKey: UNSTRATIFIED, cap: 6 }],
        },
        blockSettings: {
          defaultRule: { mode: "fixed-sequence", sizes: [2] },
          siteOverrides: [
            { siteId: "site-1", rule: { mode: "fixed-sequence", sizes: [4] } },
            { siteId: "site-2", rule: { mode: "fixed-sequence", sizes: [4] } },
          ],
          intersectionOverrides: [
            {
              stratumKey: UNSTRATIFIED,
              siteId: "site-2",
              rule: { mode: "fixed-sequence", sizes: [6] },
            },
          ],
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.find((r) => r.siteId === "site-1")?.blockSize).toBe(4);
    expect(result.rows.find((r) => r.siteId === "site-2")?.blockSize).toBe(6);
  });

  it("treats usage limits as soft: once every size is used up, the full pool returns", () => {
    const result = generateBlockSchedule(
      blockRequest({
        sites: [
          {
            id: "site-1",
            code: "S01",
            label: "Site one",
            recruitmentWeight: 1,
          },
        ],
        caps: {
          strategy: "manual",
          capScope: "study-wide",
          intersectionCaps: [{ stratumKey: UNSTRATIFIED, cap: 40 }],
        },
        blockSettings: {
          defaultRule: {
            mode: "random-pool",
            sizes: [2, 4],
            softUsageLimits: [
              {
                blockSize: 2,
                maxUses: 1,
                exhaustionPolicy: "fallback-to-original-pool",
              },
              {
                blockSize: 4,
                maxUses: 1,
                exhaustionPolicy: "fallback-to-original-pool",
              },
            ],
          },
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sizes = [
      ...new Map(result.rows.map((r) => [r.blockIndex, r.blockSize])).values(),
    ];
    expect(new Set(sizes.slice(0, 2))).toEqual(new Set([2, 4]));
    expect(result.rows.length).toBe(40);
  });

  it("refuses illegal sizes, duplicates, unknown overrides and bad usage limits", () => {
    const illegal = generateBlockSchedule(
      blockRequest({
        arms: [
          { id: "arm-a", code: "A", label: "Active", allocationRatio: 2 },
          { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
        ],
        blockSettings: {
          defaultRule: {
            mode: "random-pool",
            sizes: [3, 4, 3],
            softUsageLimits: [
              {
                blockSize: 9,
                maxUses: 1,
                exhaustionPolicy: "fallback-to-original-pool",
              },
            ],
          },
          siteOverrides: [
            { siteId: "site-x", rule: { mode: "fixed-sequence", sizes: [3] } },
          ],
          intersectionOverrides: [
            {
              stratumKey: '[["nope","x"]]',
              rule: { mode: "fixed-sequence", sizes: [3] },
            },
          ],
        },
      })
    );
    expect(illegal.ok).toBe(false);
    if (illegal.ok) return;
    const paths = illegal.findings.map((f) => f.fieldPath);
    expect(paths).toContain("blockSettings.defaultRule.sizes[1]");
    expect(paths).toContain("blockSettings.defaultRule.sizes[2]");
    expect(paths).toContain("blockSettings.defaultRule.softUsageLimits[0]");
    expect(paths).toContain("blockSettings.siteOverrides[0].siteId");
    expect(paths).toContain(
      "blockSettings.intersectionOverrides[0].stratumKey"
    );
    expect(
      illegal.findings.every((f) => f.code === "INVALID_BLOCK_SETTINGS")
    ).toBe(true);
  });

  it("refuses NaN ratios and duplicate arm IDs through the shared plan validator", () => {
    const result = generateBlockSchedule(
      blockRequest({
        arms: [
          {
            id: "arm-a",
            code: "A",
            label: "Active",
            allocationRatio: Number.NaN,
          },
          { id: "arm-a", code: "B", label: "Again", allocationRatio: 1 },
        ],
      })
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain("INVALID_ARM_RATIO");
    expect(codes).toContain("DUPLICATE_IDENTIFIER");
  });
});

describe("actual-profile allocation session", () => {
  const factors: StratificationFactorSpec[] = [
    {
      id: "fac-sex",
      code: "SEX",
      label: "Sex",
      levels: [
        { id: "f", code: "F", label: "Female" },
        { id: "m", code: "M", label: "Male" },
      ],
    },
  ];
  const female = serializeStructuralStratumKey([
    { factorId: "fac-sex", levelId: "f" },
  ]);
  const male = serializeStructuralStratumKey([
    { factorId: "fac-sex", levelId: "m" },
  ]);
  const sessionRequest = () =>
    blockRequest({
      factors,
      caps: {
        strategy: "manual",
        capScope: "study-wide",
        intersectionCaps: [
          { stratumKey: female, cap: 4 },
          { stratumKey: male, cap: 2 },
        ],
      },
      blockSettings: { defaultRule: { mode: "fixed-sequence", sizes: [2] } },
    });

  it("consumes only the queue of the profile's own site and intersection", () => {
    const opened = createBlockAllocationSession(sessionRequest());
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const { session } = opened;
    const outcomes = [
      session.assign({
        subjectId: "p1",
        siteId: "site-1",
        stratumLevels: { "fac-sex": "f" },
      }),
      session.assign({
        subjectId: "p2",
        siteId: "site-2",
        stratumLevels: { "fac-sex": "m" },
      }),
      session.assign({
        subjectId: "p3",
        siteId: "site-1",
        stratumLevels: { "fac-sex": "f" },
      }),
    ];
    expect(outcomes.map((o) => o.status)).toEqual([
      "assigned",
      "assigned",
      "assigned",
    ]);
    const assigned = outcomes.filter((o) => o.status === "assigned");
    expect(assigned.map((o) => o.slotIndex)).toEqual([1, 1, 2]);
    // p1 and p3 share one block of two, so they hold one slot of each arm.
    expect(new Set([assigned[0].armId, assigned[2].armId])).toEqual(
      new Set(["arm-a", "arm-p"])
    );
  });

  it("reports unmapped and exhausted profiles without consuming a slot", () => {
    const opened = createBlockAllocationSession(sessionRequest());
    if (!opened.ok) throw new Error("session did not open");
    const { session } = opened;
    expect(
      session.assign({
        subjectId: "x",
        siteId: "site-9",
        stratumLevels: { "fac-sex": "f" },
      })
    ).toEqual({ status: "unmapped-site", subjectId: "x", siteId: "site-9" });
    expect(
      session.assign({ subjectId: "y", siteId: "site-1", stratumLevels: {} })
    ).toEqual({
      status: "unmapped-stratum",
      subjectId: "y",
      siteId: "site-1",
      missingFactorIds: ["fac-sex"],
    });
    session.assign({
      subjectId: "m1",
      siteId: "site-1",
      stratumLevels: { "fac-sex": "m" },
    });
    session.assign({
      subjectId: "m2",
      siteId: "site-2",
      stratumLevels: { "fac-sex": "m" },
    });
    expect(
      session.assign({
        subjectId: "m3",
        siteId: "site-1",
        stratumLevels: { "fac-sex": "m" },
      })
    ).toMatchObject({
      status: "cap-exhausted",
      stratumKey: male,
      reason: "CAPACITY_EXHAUSTED",
    });
    const next = session.assign({
      subjectId: "f1",
      siteId: "site-1",
      stratumLevels: { "fac-sex": "f" },
    });
    expect(next).toMatchObject({
      status: "assigned",
      slotIndex: 1,
      allocationId: "alloc-3",
    });
  });

  it("refuses a minimization request", () => {
    const opened = createBlockAllocationSession(
      fromAny({ ...sessionRequest(), method: "MINIMIZATION" })
    );
    expect(opened.ok).toBe(false);
  });
});
