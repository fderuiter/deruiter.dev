// @vitest-environment node
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  MT19937_MINIMIZATION_ALGORITHM_ID,
  createMinimizationSession,
  createRandomizationStreams,
  generateMinimizationSchedule,
  serializeStructuralStratumKey,
  validateRandomizationPlan,
  type ArmSpec,
  type MinimizationCapConfig,
  type MinimizationRandomizationRequest,
  type ParticipantProfile,
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

const site = (n: number, recruitmentWeight = 1): SiteSpec => ({
  id: `site-${n}`,
  code: `S0${n}`,
  label: `Site ${n}`,
  recruitmentWeight,
});

const ARMS_2_TO_1: readonly ArmSpec[] = [
  { id: "arm-a", code: "A", label: "Active", allocationRatio: 2 },
  { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
];

const open = (n: number): MinimizationCapConfig => ({
  strategy: "marginal",
  capScope: "study-wide",
  levelCaps: [],
  totalEnrollment: n,
});

function request(
  overrides: Partial<MinimizationRandomizationRequest> & {
    p?: number;
    n?: number;
    distributions?: Record<string, Record<string, number>>;
  } = {}
): MinimizationRandomizationRequest {
  const { p, n, distributions, ...rest } = overrides;
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-min",
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
    arms: ARMS_2_TO_1,
    sites: [site(1)],
    factors: [binary("a")],
    seed: { value: "MinSeed2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:4}" },
    enrollmentTarget: n ?? 12,
    caps: open(1000),
    minimizationSettings: {
      virtualCohortSize: n ?? 12,
      biasedCoinProbability: p ?? 0.8,
      ...(distributions ? { expectedLevelDistributions: distributions } : {}),
    },
    ...rest,
  };
}

const profile = (
  n: number,
  levels: Record<string, string>,
  siteId = "site-1"
): ParticipantProfile => ({
  subjectId: `subj-${n}`,
  siteId,
  stratumLevels: levels,
});

function assignAll(
  plan: MinimizationRandomizationRequest,
  profiles: readonly ParticipantProfile[]
): string[] {
  const opened = createMinimizationSession(plan);
  if (!opened.ok) throw new Error(JSON.stringify(opened.findings));
  return profiles.map((pr) => {
    const outcome = opened.session.assign(pr);
    return outcome.status === "assigned" ? outcome.armCode : outcome.status;
  });
}

describe("minimization scoring (RND-MINIM-005, -006, -007)", () => {
  it("matches a hand-calculated 2:1 cohort with p = 1", () => {
    // q = [2, 1], L = 2, m = [1, 2]. All subjects carry a-1 at one site.
    // n1 counts [0,0]: A -> [1,0] range 1, P -> [0,2] range 2      -> A
    // n2 counts [1,0]: A -> [2,0] range 2, P -> [1,2] range 1      -> P
    // n3 counts [1,1]: A -> [2,2] range 0, P -> [1,4] range 3      -> A
    // n4 counts [2,1]: A -> [3,2] range 1, P -> [2,4] range 2      -> A
    // n5 counts [3,1]: A -> [4,2] range 2, P -> [3,4] range 1      -> P
    // n6 counts [3,2]: A -> [4,4] range 0, P -> [3,6] range 3      -> A
    const plan = request({ p: 1 });
    const opened = createMinimizationSession(plan);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const seen: [string, readonly number[]][] = [];
    for (let i = 1; i <= 6; i += 1) {
      const outcome = opened.session.assign(profile(i, { a: "a-1" }));
      expect(outcome.status).toBe("assigned");
      const decision = opened.session.lastDecision()!;
      seen.push([decision.armId, decision.scores]);
    }
    expect(seen).toEqual([
      ["arm-a", [1, 2]],
      ["arm-p", [2, 1]],
      ["arm-a", [0, 3]],
      ["arm-a", [1, 2]],
      ["arm-p", [2, 1]],
      ["arm-a", [0, 3]],
    ]);
  });

  it("draws a full tie by ratio with exactly one draw per subject", () => {
    // No factors: every score is 0, so each subject is floor(U * 3) < 2 ? A : P.
    const plan = request({ factors: [] });
    const reference = createRandomizationStreams("MinSeed2026").allocation;
    const expected = Array.from({ length: 40 }, () =>
      Math.floor(reference.nextFloat() * 3) < 2 ? "A" : "P"
    );
    const actual = assignAll(
      plan,
      Array.from({ length: 40 }, (_, i) => profile(i, {}))
    );
    expect(actual).toEqual(expected);
  });

  it("uses two draws, coin then arm, for every non-tied decision", () => {
    // Independent reference for one factor, one level, ratio 2:1, p = 0.8.
    const plan = request({ p: 0.8 });
    const stream = createRandomizationStreams("MinSeed2026").allocation;
    const counts = [0, 0];
    const m = [1, 2];
    const expected: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      const scores = [0, 1].map((k) => {
        const h = counts.map((c, a) => (c + (a === k ? 1 : 0)) * m[a]);
        return Math.max(...h) - Math.min(...h);
      });
      let arm: number;
      if (scores[0] === scores[1]) {
        arm = Math.floor(stream.nextFloat() * 3) < 2 ? 0 : 1;
      } else {
        const best = scores[0] < scores[1] ? 0 : 1;
        const preferred =
          Math.floor(stream.nextFloat() * 1e12) < Math.round(0.8 * 1e12);
        stream.nextFloat(); // the arm draw inside a one-arm group
        arm = preferred ? best : 1 - best;
      }
      counts[arm] += 1;
      expected.push(arm === 0 ? "A" : "P");
    }
    const actual = assignAll(
      plan,
      Array.from({ length: 30 }, (_, i) => profile(i, { a: "a-1" }))
    );
    expect(actual).toEqual(expected);
  });

  it("scores with the subject's own site counts only", () => {
    const plan = request({ p: 1, sites: [site(1), site(2)] });
    // site-1 first takes A; a global count would now prefer P at site-2.
    expect(
      assignAll(plan, [
        profile(1, { a: "a-1" }, "site-1"),
        profile(2, { a: "a-1" }, "site-2"),
      ])
    ).toEqual(["A", "A"]);
  });

  it("never picks the nonpreferred group when p = 1, and accepts p = 0.5", () => {
    const result = generateMinimizationSchedule(
      request({ p: 1, factors: [binary("a"), binary("b")], n: 200 })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.decisions.some((d) => d.group === "nonpreferred")).toBe(
      false
    );
    expect(generateMinimizationSchedule(request({ p: 0.5 })).ok).toBe(true);
  });
});

describe("minimization virtual cohorts (RND-MINIM-001, -003, -004, -008, -009)", () => {
  it("generates N rows without block semantics and replays the same arms through a session", () => {
    const plan = request({
      factors: [binary("a"), binary("b")],
      sites: [site(1, 2), site(2, 1)],
      n: 60,
    });
    const result = generateMinimizationSchedule(plan);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(60);
    expect(result.summary).toMatchObject({
      requestedRows: 60,
      emittedRows: 60,
      shortfall: 0,
      stopReason: "COHORT_COMPLETE",
    });
    for (const row of result.rows) {
      expect([row.blockIndex, row.blockSize, row.positionInBlock]).toEqual([
        null,
        null,
        null,
      ]);
    }
    const replay = assignAll(
      plan,
      result.rows.map((row, i) =>
        profile(i, { ...row.stratumLevels }, row.siteId)
      )
    );
    expect(replay).toEqual(result.rows.map((row) => row.armCode));
  });

  it("reproduces the exact ordered rows after a JSON round trip", () => {
    const plan = request({
      factors: [binary("a")],
      sites: [site(1, 0.25), site(2, 0.75)],
      distributions: { a: { "a-1": 37.5, "a-2": 62.5 } },
      n: 40,
    });
    const once = generateMinimizationSchedule(plan);
    const again = generateMinimizationSchedule(
      JSON.parse(JSON.stringify(plan))
    );
    expect(once.ok && again.ok).toBe(true);
    expect(once).toEqual(again);
  });

  it("never samples a zero-weight site or a zero-percent level", () => {
    const result = generateMinimizationSchedule(
      request({
        sites: [site(1, 0), site(2, 1)],
        distributions: { a: { "a-1": 0, "a-2": 100 } },
        n: 150,
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(new Set(result.rows.map((r) => r.siteId))).toEqual(
      new Set(["site-2"])
    );
    expect(new Set(result.rows.map((r) => r.stratumLevels.a))).toEqual(
      new Set(["a-2"])
    );
    // A zero-percent level is not a pruned one.
    expect(result.summary.renormalizedDraws.a).toBe(0);
  });

  it("stops at manual capacity, never picks a full intersection and reports the shortfall", () => {
    const key = (levelId: string) =>
      serializeStructuralStratumKey([{ factorId: "a", levelId }]);
    const result = generateMinimizationSchedule(
      request({
        caps: {
          strategy: "manual",
          capScope: "study-wide",
          intersectionCaps: [
            { stratumKey: key("a-1"), cap: 3 },
            { stratumKey: key("a-2"), cap: 5 },
          ],
        },
        n: 20,
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const byLevel = (levelId: string) =>
      result.rows.filter((r) => r.stratumLevels.a === levelId).length;
    expect([byLevel("a-1"), byLevel("a-2")]).toEqual([3, 5]);
    expect(result.summary).toMatchObject({
      emittedRows: 8,
      shortfall: 12,
      stopReason: "CAPACITY_EXHAUSTED",
    });
    // Once a-1 is full, factor a is drawn from a renormalized pool.
    expect(result.summary.renormalizedDraws.a).toBeGreaterThan(0);
  });

  it("keeps per-site marginal caps per site", () => {
    const result = generateMinimizationSchedule(
      request({
        sites: [site(1), site(2)],
        caps: {
          strategy: "marginal",
          capScope: "per-site",
          levelCaps: [
            { factorId: "a", levelId: "a-1", siteId: "site-1", cap: 2 },
            { factorId: "a", levelId: "a-2", siteId: "site-1", cap: 0 },
            { factorId: "a", levelId: "a-1", siteId: "site-2", cap: 1 },
            { factorId: "a", levelId: "a-2", siteId: "site-2", cap: 1 },
          ],
        },
        n: 10,
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const count = (siteId: string, levelId: string) =>
      result.rows.filter(
        (r) => r.siteId === siteId && r.stratumLevels.a === levelId
      ).length;
    expect([
      count("site-1", "a-1"),
      count("site-1", "a-2"),
      count("site-2", "a-1"),
      count("site-2", "a-2"),
    ]).toEqual([2, 0, 1, 1]);
    expect(result.summary.stopReason).toBe("CAPACITY_EXHAUSTED");
  });

  it("never lets a capped level or intersection go past its cap", () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 5 }), {
          minLength: 4,
          maxLength: 4,
        }),
        fc.integer({ min: 1, max: 40 }),
        fc.stringMatching(/^[A-Za-z0-9]{1,10}$/),
        (caps, n, seed) => {
          const factors = [binary("a"), binary("b")];
          const keys = [
            ["a-1", "b-1"],
            ["a-1", "b-2"],
            ["a-2", "b-1"],
            ["a-2", "b-2"],
          ].map(([a, b]) =>
            serializeStructuralStratumKey([
              { factorId: "a", levelId: a },
              { factorId: "b", levelId: b },
            ])
          );
          const result = generateMinimizationSchedule(
            request({
              factors,
              seed: { value: seed, source: "custom" },
              caps: {
                strategy: "manual",
                capScope: "study-wide",
                intersectionCaps: keys.map((stratumKey, i) => ({
                  stratumKey,
                  cap: caps[i],
                })),
              },
              n,
            })
          );
          if (!result.ok) return false;
          const total = caps.reduce((x, y) => x + y, 0);
          const used = keys.map(
            (k) => result.rows.filter((r) => r.stratumKey === k).length
          );
          return (
            used.every((u, i) => u <= caps[i]) &&
            result.rows.length === Math.min(n, total)
          );
        }
      ),
      { numRuns: 120 }
    );
  });
});

describe("minimization sessions and validation (RND-MINIM-002, -003, -010, -011)", () => {
  it("keeps the profile's own site and levels and changes nothing on a refusal", () => {
    const plan = request({
      p: 1,
      caps: {
        strategy: "marginal",
        capScope: "study-wide",
        levelCaps: [
          { factorId: "a", levelId: "a-1", cap: 1 },
          { factorId: "a", levelId: "a-2", cap: 5 },
        ],
      },
    });
    const opened = createMinimizationSession(plan);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const first = opened.session.assign(profile(1, { a: "a-1" }));
    expect(first).toMatchObject({
      status: "assigned",
      siteId: "site-1",
      stratumKey: serializeStructuralStratumKey([
        { factorId: "a", levelId: "a-1" },
      ]),
    });
    expect(opened.session.assign(profile(2, { a: "a-1" }))).toMatchObject({
      status: "cap-exhausted",
      reason: "MARGINAL_CAPACITY_EXHAUSTED",
    });
    expect(opened.session.assign(profile(3, { a: "zzz" }))).toMatchObject({
      status: "unmapped-stratum",
      missingFactorIds: ["a"],
    });
    expect(
      opened.session.assign(profile(4, { a: "a-2" }, "site-9")).status
    ).toBe("unmapped-site");
    // The refusals left a-2's counts untouched: a fresh a-2 subject scores as the first.
    opened.session.assign(profile(5, { a: "a-2" }));
    expect(opened.session.lastDecision()?.scores).toEqual([1, 2]);
  });

  it("refuses p outside 0.5 to 1, bad distributions, all-zero weights and unbounded marginal caps", () => {
    const findings = (plan: MinimizationRandomizationRequest) => {
      const result = generateMinimizationSchedule(plan);
      return result.ok ? [] : result.findings.map((f) => f.fieldPath);
    };
    expect(findings(request({ p: 0.49 }))).toContain(
      "minimizationSettings.biasedCoinProbability"
    );
    expect(findings(request({ p: 1.01 }))).toContain(
      "minimizationSettings.biasedCoinProbability"
    );
    expect(
      findings(request({ distributions: { a: { "a-1": 50, "a-2": 49 } } }))
    ).toContain("minimizationSettings.expectedLevelDistributions.a");
    expect(
      findings(request({ distributions: { a: { "a-1": 100 } } }))
    ).toContain("minimizationSettings.expectedLevelDistributions.a");
    expect(
      findings(
        request({ distributions: { a: { "a-1": 33.33333, "a-2": 66.66667 } } })
      )
    ).toContain("minimizationSettings.expectedLevelDistributions.a.a-1");
    expect(
      findings(request({ distributions: { ghost: { x: 100 } } }))
    ).toContain("minimizationSettings.expectedLevelDistributions.ghost");
    expect(findings(request({ sites: [site(1, 0), site(2, 0)] }))).toContain(
      "sites"
    );
    expect(findings(request({ sites: [site(1, Number.NaN)] }))).toContain(
      "sites[0].recruitmentWeight"
    );
    expect(
      findings(
        request({
          caps: {
            strategy: "marginal",
            capScope: "study-wide",
            levelCaps: [{ factorId: "a", levelId: "a-1", cap: 3 }],
          },
        })
      )
    ).toContain("caps.levelCaps");
  });

  it("refuses zero ratios, block settings, proportional caps and BLOCK requests", () => {
    const zeroRatio = generateMinimizationSchedule(
      request({
        arms: [
          { id: "arm-a", code: "A", label: "Active", allocationRatio: 1 },
          { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 0 },
        ],
      })
    );
    expect(zeroRatio).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "INVALID_ARM_RATIO" }),
      ]),
    });

    const withBlocks = validateRandomizationPlan({
      ...request(),
      blockSettings: {
        defaultRule: { mode: "fixed-sequence", sizes: [3] },
        trackingScope: "global",
        allowPartialFinalBlock: true,
      },
    });
    expect(withBlocks.findings.map((f) => f.fieldPath)).toContain(
      "blockSettings"
    );

    const proportional = validateRandomizationPlan({
      ...request(),
      caps: {
        strategy: "proportional",
        capScope: "study-wide",
        totalEnrollment: 10,
        factorLevelPercentages: { a: { "a-1": 50, "a-2": 50 } },
      },
    });
    expect(proportional.findings).toContainEqual(
      expect.objectContaining({
        code: "UNSUPPORTED_METHOD_COMBINATION",
        fieldPath: "caps.strategy",
      })
    );

    const block = generateMinimizationSchedule(
      JSON.parse(
        JSON.stringify({ ...request(), method: "BLOCK" })
      ) as MinimizationRandomizationRequest
    );
    expect(block.ok).toBe(false);
  });

  it("refuses a cohort larger than the row limit before generating it", () => {
    expect(generateMinimizationSchedule(request({ n: 100_001 }))).toMatchObject(
      { ok: false }
    );
  });
});
