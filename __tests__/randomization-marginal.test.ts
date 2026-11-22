// @vitest-environment node
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MT19937_BLOCK_ALGORITHM_ID,
  buildImmutableArtifact,
  createBlockAllocationSession,
  generateBlockSchedule,
  resolveMarginalCaps,
  validateRandomizationPlan,
  type AllocationRow,
  type BlockRandomizationRequest,
  type BlockSizeRule,
  type MarginalCapConfig,
  type MarginalLevelCap,
  type SiteSpec,
  type StratificationFactorSpec,
} from "@/lib/randomization";

const binary = (id: string): StratificationFactorSpec => ({
  id,
  code: id.toUpperCase(),
  label: id,
  levels: [
    { id: `${id}-1`, code: "L1", label: `${id} one` },
    { id: `${id}-2`, code: "L2", label: `${id} two` },
  ],
});

const site = (n: number): SiteSpec => ({
  id: `site-${n}`,
  code: `S0${n}`,
  label: `Site ${n}`,
  recruitmentWeight: 1,
});

function request(
  caps: Partial<MarginalCapConfig> & Pick<MarginalCapConfig, "levelCaps">,
  options: {
    factors?: readonly StratificationFactorSpec[];
    sites?: readonly SiteSpec[];
    enrollmentTarget?: number;
    rule?: BlockSizeRule;
    trackingScope?: "global" | "per-site" | "per-intersection";
    allowPartialFinalBlock?: boolean;
    seed?: string;
  } = {}
): BlockRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-marginal",
    name: "Synthetic marginal plan",
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
    sites: options.sites ?? [site(1), site(2)],
    factors: options.factors ?? [binary("a"), binary("b")],
    seed: { value: options.seed ?? "MarginalSeed2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:4}" },
    enrollmentTarget: options.enrollmentTarget ?? 20,
    caps: {
      strategy: "marginal",
      capScope: "study-wide",
      sitePolicy: "round-robin-v1",
      ...caps,
    },
    blockSettings: {
      defaultRule: options.rule ?? { mode: "fixed-sequence", sizes: [2] },
      trackingScope: options.trackingScope ?? "per-intersection",
      allowPartialFinalBlock: options.allowPartialFinalBlock ?? true,
    },
  };
}

const capsOn = (
  factorId: string,
  caps: readonly number[],
  siteId?: string
): MarginalLevelCap[] =>
  caps.map((cap, index) => ({
    factorId,
    levelId: `${factorId}-${index + 1}`,
    cap,
    ...(siteId ? { siteId } : {}),
  }));

/** Counts rows per (scope, factor, level), computed independently from the rows. */
function levelCounts(
  rows: readonly AllocationRow[],
  perSite: boolean
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const [factorId, levelId] of Object.entries(row.stratumLevels)) {
      const key = JSON.stringify([
        perSite ? row.siteId : "",
        factorId,
        levelId,
      ]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
}

function bySite(rows: readonly AllocationRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) out[row.siteId] = (out[row.siteId] ?? 0) + 1;
  return out;
}

describe("marginal cap resolution (RND-CAPS-007, -008)", () => {
  it("takes the smallest fully capped factor total as the termination bound", () => {
    const resolved = resolveMarginalCaps(
      request({ levelCaps: [...capsOn("a", [6, 4]), ...capsOn("b", [3, 3])] })
    );
    expect(resolved).toMatchObject({
      ok: true,
      terminationBound: 6,
      boundingFactorIds: ["a", "b"],
      sitePolicy: "round-robin-v1",
    });
  });

  it("refuses an unbounded design before generating anything", () => {
    // b-2 is uncapped, and factor a has no caps at all.
    const unbounded = request({
      levelCaps: [{ factorId: "b", levelId: "b-1", cap: 5 }],
    });
    expect(resolveMarginalCaps(unbounded)).toMatchObject({
      ok: false,
      findings: [{ code: "INVALID_CAP_STRATEGY", fieldPath: "caps.levelCaps" }],
    });
    expect(generateBlockSchedule(unbounded).ok).toBe(false);

    // A separately serialized hard total bounds the same caps.
    const withTotal = resolveMarginalCaps(
      request({
        levelCaps: [{ factorId: "b", levelId: "b-1", cap: 5 }],
        totalEnrollment: 8,
      })
    );
    expect(withTotal).toMatchObject({
      ok: true,
      terminationBound: 8,
      boundingFactorIds: [],
    });
  });

  it("requires every site to be bounded under per-site scope", () => {
    const partial = request({
      capScope: "per-site",
      levelCaps: capsOn("a", [2, 2], "site-1"),
    });
    expect(resolveMarginalCaps(partial)).toMatchObject({
      ok: false,
      findings: [{ message: expect.stringContaining("site-2") }],
    });
    const general = resolveMarginalCaps(
      request({
        capScope: "per-site",
        levelCaps: [...capsOn("a", [2, 2]), ...capsOn("a", [1, 0], "site-2")],
      })
    );
    // site-1 uses the general caps (4), site-2 its own (1).
    expect(general).toMatchObject({ ok: true, terminationBound: 5 });
  });

  it("refuses bad entries, a missing site policy and site names on study-wide caps", () => {
    const bad = resolveMarginalCaps(
      request({
        sitePolicy: undefined,
        totalEnrollment: -1,
        levelCaps: [
          { factorId: "a", levelId: "nope", cap: 1 },
          { factorId: "a", levelId: "a-1", cap: 1.5 },
          { factorId: "a", levelId: "a-2", cap: -1 },
          { factorId: "b", levelId: "b-1", cap: 1 },
          { factorId: "b", levelId: "b-1", cap: 2 },
          { factorId: "b", levelId: "b-2", siteId: "site-1", cap: 2 },
        ],
      })
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    const paths = bad.findings.map((f) => f.fieldPath);
    expect(paths).toEqual(
      expect.arrayContaining([
        "caps.sitePolicy",
        "caps.totalEnrollment",
        "caps.levelCaps[0]",
        "caps.levelCaps[1].cap",
        "caps.levelCaps[2].cap",
        "caps.levelCaps[4]",
        "caps.levelCaps[5].siteId",
      ])
    );
    expect(bad.findings.some((f) => f.code === "INVALID_CAP_SCOPE")).toBe(true);
  });

  it("refuses a bound past the row limit before expanding it", () => {
    const result = generateBlockSchedule(
      request({ levelCaps: capsOn("a", [60_000, 60_000]) })
    );
    expect(result).toMatchObject({
      ok: false,
      findings: [{ code: "RESOURCE_LIMIT_EXCEEDED" }],
    });
  });
});

describe("marginal block schedules (RND-CAPS-007, -009)", () => {
  const shared = {
    levelCaps: [...capsOn("a", [5, 5]), ...capsOn("b", [5, 5])],
  };

  it("shares study-wide capacity across sites under round-robin-v1", () => {
    const result = generateBlockSchedule(request(shared));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(10);
    expect(bySite(result.rows)).toEqual({ "site-1": 5, "site-2": 5 });
    // Turns alternate while both sites can take a subject.
    expect(result.rows.slice(0, 4).map((r) => r.siteId)).toEqual([
      "site-1",
      "site-2",
      "site-1",
      "site-2",
    ]);
    expect(result.marginal).toEqual({
      sitePolicy: "round-robin-v1",
      terminationBound: 10,
      requestedRows: 20,
      emittedRows: 10,
      shortfall: 10,
      stopReason: "MARGINAL_CAPACITY_EXHAUSTED",
    });
  });

  it("reproduces first-site consumption only under site-major-v1", () => {
    const result = generateBlockSchedule(
      request({ ...shared, sitePolicy: "site-major-v1" })
    );
    expect(result.ok && bySite(result.rows)).toEqual({ "site-1": 10 });
  });

  it("is deterministic for a seed and changes with the seed", () => {
    const one = generateBlockSchedule(request(shared));
    const two = generateBlockSchedule(request(shared));
    const other = generateBlockSchedule(request(shared, { seed: "OtherSeed" }));
    expect(one).toEqual(two);
    expect(one.ok && other.ok && one.rows).not.toEqual(other.ok && other.rows);
  });

  it("terminates with an empty result and an explicit reason at zero capacity", () => {
    const result = generateBlockSchedule(
      request({ levelCaps: capsOn("a", [0, 0]) })
    );
    expect(result).toMatchObject({
      ok: true,
      rows: [],
      partialBlocks: [],
      marginal: {
        terminationBound: 0,
        emittedRows: 0,
        stopReason: "ZERO_CAPACITY",
      },
    });
  });

  it("stops at the smaller of two conflicting factor totals without inventing subjects", () => {
    // Factor a allows 12, factor b only 4.
    const result = generateBlockSchedule(
      request(
        { levelCaps: [...capsOn("a", [6, 6]), ...capsOn("b", [4, 0])] },
        { enrollmentTarget: 12 }
      )
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((r) => r.stratumLevels.b === "b-1")).toBe(true);
    expect(result.marginal).toMatchObject({
      terminationBound: 4,
      emittedRows: 4,
      shortfall: 8,
      stopReason: "MARGINAL_CAPACITY_EXHAUSTED",
    });
  });

  it("treats incomplete cap maps as uncapped levels", () => {
    // Only a is bounded; b-1 is capped at 1 and b-2 is open.
    const result = generateBlockSchedule(
      request(
        {
          levelCaps: [
            ...capsOn("a", [4, 4]),
            { factorId: "b", levelId: "b-1", cap: 1 },
          ],
        },
        { enrollmentTarget: 8 }
      )
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(8);
    expect(
      result.rows.filter((r) => r.stratumLevels.b === "b-1").length
    ).toBeLessThanOrEqual(1);
    expect(result.marginal?.stopReason).toBe("BOUND_REACHED");
  });

  it("keeps per-site caps per site", () => {
    const result = generateBlockSchedule(
      request({
        capScope: "per-site",
        levelCaps: [
          ...capsOn("a", [1, 1], "site-1"),
          ...capsOn("a", [3, 3], "site-2"),
        ],
      })
    );
    expect(result.ok && bySite(result.rows)).toEqual({
      "site-1": 2,
      "site-2": 6,
    });
  });

  it("reports the unfinished blocks and refuses them when partial blocks are off", () => {
    const options = { rule: { mode: "fixed-sequence", sizes: [4] } as const };
    const result = generateBlockSchedule(
      request({ levelCaps: capsOn("a", [3, 2]) }, options)
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const emittedByCell = new Map<string, number>();
    for (const row of result.rows) {
      const key = JSON.stringify([row.siteId, row.stratumKey, row.blockIndex]);
      emittedByCell.set(key, (emittedByCell.get(key) ?? 0) + 1);
    }
    for (const partial of result.partialBlocks) {
      const key = JSON.stringify([
        partial.siteId,
        partial.stratumKey,
        partial.blockIndex,
      ]);
      expect(emittedByCell.get(key)).toBe(partial.emittedSlots);
      expect(partial.emittedSlots).toBeLessThan(partial.blockSize);
    }
    expect(result.partialBlocks.length).toBeGreaterThan(0);

    const refused = generateBlockSchedule(
      request(
        { levelCaps: capsOn("a", [3, 2]) },
        { ...options, allowPartialFinalBlock: false }
      )
    );
    expect(refused).toMatchObject({
      ok: false,
      findings: [{ fieldPath: "blockSettings.allowPartialFinalBlock" }],
    });
  });

  it("never lets a level pass its cap, for any caps, sites and scope", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 6 }), {
          minLength: 2,
          maxLength: 2,
        }),
        fc.array(
          fc.option(fc.integer({ min: 0, max: 6 }), { nil: undefined }),
          {
            minLength: 2,
            maxLength: 2,
          }
        ),
        fc.integer({ min: 1, max: 3 }),
        fc.boolean(),
        fc.constantFrom("round-robin-v1", "site-major-v1"),
        fc.constantFrom("global", "per-site", "per-intersection"),
        fc.stringMatching(/^[A-Za-z0-9]{1,12}$/),
        (aCaps, bCaps, siteCount, perSite, sitePolicy, trackingScope, seed) => {
          const sites = Array.from({ length: siteCount }, (_, i) =>
            site(i + 1)
          );
          const levelCaps: MarginalLevelCap[] = [...capsOn("a", aCaps)];
          bCaps.forEach((cap, index) => {
            if (cap !== undefined) {
              levelCaps.push({ factorId: "b", levelId: `b-${index + 1}`, cap });
            }
          });
          const plan = request(
            {
              capScope: perSite ? "per-site" : "study-wide",
              sitePolicy,
              levelCaps,
            },
            {
              sites,
              trackingScope,
              rule: { mode: "random-pool", sizes: [2, 4] },
              seed,
            }
          );
          const result = generateBlockSchedule(plan);
          if (!result.ok) return false;
          const counts = levelCounts(result.rows, perSite);
          const scopes = perSite ? sites.map((s) => s.id) : [""];
          for (const scope of scopes) {
            for (const cap of levelCaps) {
              const used =
                counts.get(
                  JSON.stringify([scope, cap.factorId, cap.levelId])
                ) ?? 0;
              if (used > cap.cap) return false;
            }
          }
          // With only marginal caps the bound is always reached.
          const bound = scopes.length * (aCaps[0] + aCaps[1]);
          const boundB = bCaps.every((c) => c !== undefined)
            ? scopes.length * ((bCaps[0] ?? 0) + (bCaps[1] ?? 0))
            : Infinity;
          return result.rows.length === Math.min(bound, boundB);
        }
      ),
      { numRuns: 150 }
    );
  });
});

describe("marginal profile sessions and provenance", () => {
  it("assigns actual profiles until a capped level is full, then refuses only that level", () => {
    const opened = createBlockAllocationSession(
      request({ levelCaps: capsOn("a", [2, 1]) })
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const profile = (n: number, a: string, siteId = "site-1") => ({
      subjectId: `subj-${n}`,
      siteId,
      stratumLevels: { a, b: "b-1" },
    });
    expect(opened.session.assign(profile(1, "a-2")).status).toBe("assigned");
    expect(opened.session.assign(profile(2, "a-2", "site-2"))).toMatchObject({
      status: "cap-exhausted",
      reason: "MARGINAL_CAPACITY_EXHAUSTED",
    });
    expect(opened.session.assign(profile(3, "a-1")).status).toBe("assigned");
    expect(opened.session.assign(profile(4, "a-1", "site-2")).status).toBe(
      "assigned"
    );
    expect(opened.session.assign(profile(5, "a-1")).status).toBe(
      "cap-exhausted"
    );
  });

  it("keeps the site policy and hard total through JSON and the artifact, so the bound re-derives", () => {
    const plan = request({
      levelCaps: [{ factorId: "a", levelId: "a-1", cap: 3 }],
      totalEnrollment: 7,
      sitePolicy: "site-major-v1",
    });
    const roundTripped = JSON.parse(JSON.stringify(plan));
    expect(validateRandomizationPlan(roundTripped).ok).toBe(true);
    const result = generateBlockSchedule(roundTripped);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const artifact = buildImmutableArtifact({
      request: roundTripped,
      reducedRatios: result.reducedRatios,
      rows: result.rows,
      now: () => new Date("2026-11-22T00:00:00.000Z"),
    });
    expect(artifact.request.algorithmId).toBe(MT19937_BLOCK_ALGORITHM_ID);
    expect(artifact.request.caps).toMatchObject({
      sitePolicy: "site-major-v1",
      totalEnrollment: 7,
    });
    const rederived = resolveMarginalCaps(
      artifact.request as BlockRandomizationRequest
    );
    expect(rederived).toMatchObject({ ok: true, terminationBound: 7 });
    expect(result.marginal?.terminationBound).toBe(7);
  });
});
