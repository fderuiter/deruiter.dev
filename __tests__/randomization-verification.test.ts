// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MAX_VERIFICATION_DIFFS,
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  RANDOMIZATION_RESOURCE_LIMITS,
  buildImmutableArtifact,
  decideRandomizationExport,
  generateBlockSchedule,
  generateMinimizationSchedule,
  presentAllocationRows,
  resolvePresentation,
  verifyArtifact,
  type BlockRandomizationRequest,
  type MinimizationRandomizationRequest,
  type RandomizationRequest,
} from "@/lib/randomization";
import {
  RANDOMIZATION_PROTOCOL_VERSION,
  parseRandomizationCommand,
} from "@/components/randomization/protocol";
import { createRandomizationClient } from "@/components/randomization/randomization-client";

/** Local artifact reverification (#4009, RND-VERIF-001 to 005). */

const PROVENANCE = {
  studyId: "study-1",
  studyVersionId: "v1",
  studyDesignId: "d1",
  workspaceRevisionId: "r1",
  usdmSha256: "0".repeat(64),
};

function blockPlan(): BlockRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-block",
    name: "Synthetic block plan",
    provenance: PROVENANCE,
    method: "BLOCK",
    algorithmId: MT19937_BLOCK_ALGORITHM_ID,
    arms: [
      { id: "arm-a", code: "A", label: "Active", allocationRatio: 2 },
      { id: "arm-p", code: "P", label: "Placebo", allocationRatio: 1 },
    ],
    sites: [
      { id: "site-1", code: "S01", label: "North", recruitmentWeight: 1 },
      { id: "site-2", code: "S02", label: "South", recruitmentWeight: 1 },
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
    seed: { value: "VerifySeed2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:4}" },
    enrollmentTarget: 40,
    caps: {
      strategy: "manual",
      capScope: "per-site",
      intersectionCaps: [
        { stratumKey: '[["sex","sex-f"]]', cap: 10 },
        { stratumKey: '[["sex","sex-m"]]', cap: 10 },
      ],
    },
    blockSettings: {
      defaultRule: { mode: "random-pool", sizes: [3, 6] },
      trackingScope: "per-intersection",
      allowPartialFinalBlock: true,
    },
  };
}

function minimizationPlan(): MinimizationRandomizationRequest {
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "plan-min",
    name: "Synthetic minimization plan",
    provenance: PROVENANCE,
    method: "MINIMIZATION",
    algorithmId: MT19937_MINIMIZATION_ALGORITHM_ID,
    arms: blockPlan().arms,
    sites: [blockPlan().sites[0]],
    factors: blockPlan().factors,
    seed: { value: "VerifyMin2026", source: "custom" },
    subjectIdMask: { pattern: "{SITE}-{SEQ:5}" },
    enrollmentTarget: 24,
    caps: {
      strategy: "marginal",
      capScope: "study-wide",
      levelCaps: [],
      totalEnrollment: 24,
    },
    minimizationSettings: { virtualCohortSize: 24, biasedCoinProbability: 0.8 },
  };
}

const FULL = (() => {
  const decision = decideRandomizationExport({
    kind: "allocation-json",
    lifecycle: "promoted",
    disclosure: "full",
    fullDisclosureAcknowledged: true,
    useNoticeAcknowledged: true,
  });
  if (!decision.allowed) throw new Error(decision.code);
  return decision.metadata;
})();

/** A golden artifact file, as text, with full-disclosure metadata. */
function artifactFile(plan: RandomizationRequest): Record<string, unknown> {
  const generated =
    plan.method === "BLOCK"
      ? generateBlockSchedule(plan)
      : generateMinimizationSchedule(plan);
  if (!generated.ok) throw new Error(generated.findings[0]?.code);
  const artifact = buildImmutableArtifact({
    request: plan,
    reducedRatios: generated.reducedRatios,
    rows: generated.rows,
    now: () => new Date("2026-11-24T00:00:00.000Z"),
  });
  return JSON.parse(JSON.stringify({ ...artifact, disclosure: FULL }));
}

const text = (value: unknown) => JSON.stringify(value);

type Rows = { [key: string]: unknown }[];
const rowsOf = (file: Record<string, unknown>) => file.rows as Rows;

describe("golden artifacts", () => {
  it("verifies a block artifact on every check", () => {
    const report = verifyArtifact(text(artifactFile(blockPlan())));
    expect(report.outcome).toBe("verified");
    expect(report.digest.status).toBe("pass");
    expect(report.regeneration).toMatchObject({ status: "pass", diffCount: 0 });
    expect(report.regeneration.expectedRows).toBeGreaterThan(0);
    expect(report.invariants.status).toBe("pass");
    expect(report.provenance.status).toBe("pass");
    expect(report.evidence).toEqual({ status: "sufficient" });
  });

  it("verifies a minimization artifact", () => {
    const report = verifyArtifact(text(artifactFile(minimizationPlan())));
    expect(report.outcome).toBe("verified");
    expect(report.rowCount).toBe(24);
  });
});

describe("tampering", () => {
  /** Changes one row field and re-signs the digest, so only regeneration can tell. */
  function resigned(
    change: (file: Record<string, unknown>) => void
  ): Record<string, unknown> {
    const file = artifactFile(blockPlan());
    change(file);
    const rebuilt = buildImmutableArtifact({
      request: file.request as RandomizationRequest,
      reducedRatios: file.reducedRatios as number[],
      rows: file.rows as never,
      now: () => new Date("2026-11-24T00:00:00.000Z"),
    });
    return { ...file, digest: JSON.parse(JSON.stringify(rebuilt.digest)) };
  }

  it.each([
    [
      "site",
      (r: Rows) =>
        (r[0].siteId = r[0].siteId === "site-1" ? "site-2" : "site-1"),
      "siteId",
    ],
    [
      "block size",
      (r: Rows) => (r[0].blockSize = (r[0].blockSize as number) === 3 ? 6 : 3),
      "blockSize",
    ],
    ["block number", (r: Rows) => (r[0].blockIndex = 9), "blockIndex"],
    [
      "stratum value",
      (r: Rows) => {
        const female =
          (r[0].stratumLevels as Record<string, string>).sex === "sex-f";
        r[0].stratumLevels = { sex: female ? "sex-m" : "sex-f" };
        r[0].stratumKey = JSON.stringify([["sex", female ? "sex-m" : "sex-f"]]);
      },
      "stratumLevels",
    ],
    ["subject ID", (r: Rows) => (r[0].subjectId = "X-9999"), "subjectId"],
    [
      "arm",
      (r: Rows) => {
        const active = r[0].armId === "arm-a";
        r[0].armId = active ? "arm-p" : "arm-a";
        r[0].armCode = active ? "P" : "A";
      },
      "armId",
    ],
  ])(
    "detects a changed %s through regeneration even with a re-signed digest",
    (_name, change, field) => {
      const report = verifyArtifact(
        text(resigned((file) => change(rowsOf(file))))
      );
      expect(report.digest.status).toBe("pass");
      expect(report.regeneration.status).toBe("fail");
      expect(report.regeneration.diffs.map((d) => d.field)).toContain(field);
      expect(report.outcome).toBe("failed");
    }
  );

  it("detects swapped row order and a dropped row", () => {
    const swapped = verifyArtifact(
      text(
        resigned((file) => {
          const rows = rowsOf(file);
          [rows[0], rows[1]] = [rows[1], rows[0]];
        })
      )
    );
    expect(swapped.regeneration.status).toBe("fail");
    expect(swapped.invariants.findings.map((f) => f.code)).toContain(
      "SEQUENCE_OUT_OF_ORDER"
    );

    const dropped = verifyArtifact(
      text(resigned((file) => void rowsOf(file).pop()))
    );
    expect(dropped.regeneration.actualRows).toBe(
      (dropped.regeneration.expectedRows ?? 0) - 1
    );
    expect(dropped.regeneration.diffs.at(-1)?.category).toBe("missing-row");
    expect(dropped.outcome).toBe("failed");
  });

  it("detects a changed arm label through the digest", () => {
    const file = artifactFile(blockPlan());
    (file.request as { arms: { label: string }[] }).arms[0].label = "Renamed";
    const report = verifyArtifact(text(file));
    expect(report.digest.status).toBe("fail");
    expect(report.regeneration.status).toBe("pass");
    expect(report.outcome).toBe("failed");
  });

  it("detects a tampered digest and tampered metadata", () => {
    const digestFile = artifactFile(blockPlan());
    (digestFile.digest as { hex: string }).hex = "f".repeat(64);
    expect(verifyArtifact(text(digestFile))).toMatchObject({
      outcome: "failed",
      digest: { status: "fail" },
      regeneration: { status: "pass" },
    });

    const studyFile = artifactFile(blockPlan());
    (studyFile.provenance as { study: { studyId: string } }).study.studyId =
      "other";
    const study = verifyArtifact(text(studyFile));
    expect(study.provenance.findings.map((f) => f.code)).toContain(
      "STUDY_MISMATCH"
    );
    expect(study.outcome).toBe("failed");

    const timeFile = artifactFile(blockPlan());
    (timeFile.provenance as { generatedAtIso: string }).generatedAtIso =
      "yesterday";
    expect(verifyArtifact(text(timeFile)).provenance.findings[0].code).toBe(
      "GENERATED_AT_INVALID"
    );

    const ratioFile = artifactFile(blockPlan());
    ratioFile.reducedRatios = [1, 1];
    const ratio = verifyArtifact(text(ratioFile));
    expect(ratio.provenance.findings.map((f) => f.code)).toContain(
      "REDUCED_RATIO_MISMATCH"
    );
    expect(ratio.outcome).toBe("failed");
  });

  it("bounds the listed differences but counts them all", () => {
    const file = artifactFile(blockPlan());
    for (const row of rowsOf(file))
      row.subjectId = `Z-${String(row.subjectId)}`;
    const report = verifyArtifact(text(file));
    expect(report.regeneration.diffCount).toBe(rowsOf(file).length);
    expect(report.regeneration.diffs.length).toBeLessThanOrEqual(
      MAX_VERIFICATION_DIFFS
    );
  });
});

describe("evidence", () => {
  it("calls a masked file insufficient evidence, never verified or corrupt", () => {
    const file = artifactFile(blockPlan());
    const masked = presentAllocationRows(
      rowsOf(file) as never,
      resolvePresentation({
        persona: "TrialManager",
        segment: "Sponsor",
        unblindRequested: false,
      })
    );
    const report = verifyArtifact(
      text({
        ...file,
        rows: masked,
        disclosure: {
          ...FULL,
          disclosure: "masked",
          label: "masked-presentation",
          containsAuthoritativeAssignments: false,
        },
      })
    );
    expect(report.outcome).toBe("insufficient-evidence");
    expect(report.evidence).toEqual({
      status: "insufficient-evidence",
      code: "MASKED_PRESENTATION",
    });
    expect(report.digest.status).toBe("not-run");
    expect(report.regeneration.status).toBe("not-run");
    expect(report.invariants.status).toBe("pass");
    expect(report.provenance.status).toBe("pass");
  });

  it("treats a file without disclosure metadata as insufficient evidence", () => {
    const file = artifactFile(blockPlan());
    delete file.disclosure;
    expect(verifyArtifact(text(file)).outcome).toBe("insufficient-evidence");
  });

  it("fails masked rows that claim full disclosure", () => {
    const file = artifactFile(blockPlan());
    const masked = presentAllocationRows(
      rowsOf(file) as never,
      resolvePresentation({
        persona: "TrialManager",
        segment: "Sponsor",
        unblindRequested: false,
      })
    );
    const report = verifyArtifact(text({ ...file, rows: masked }));
    expect(report.outcome).toBe("failed");
  });
});

describe("bounded, safe imports", () => {
  it("rejects oversized, deep and malformed files before regeneration", () => {
    const limits = { ...RANDOMIZATION_RESOURCE_LIMITS, maxImportBytes: 1024 };
    expect(verifyArtifact("x".repeat(2048), { limits }).rejection).toBe(
      "FILE_TOO_LARGE"
    );
    expect(verifyArtifact("é".repeat(600), { limits }).rejection).toBe(
      "FILE_TOO_LARGE"
    );
    expect(verifyArtifact(`${"[".repeat(65)}${"]".repeat(65)}`).rejection).toBe(
      "NESTING_TOO_DEEP"
    );
    // Brackets inside strings don't count as nesting.
    expect(
      verifyArtifact(JSON.stringify({ a: "[".repeat(100) })).rejection
    ).toBe("MISSING_FIELD");
    expect(verifyArtifact("{not json").rejection).toBe("INVALID_JSON");
    expect(verifyArtifact("[]").rejection).toBe("NOT_AN_ARTIFACT");
    expect(verifyArtifact("{}").rejection).toBe("MISSING_FIELD");
  });

  it("rejects unsupported versions and engines", () => {
    const version = artifactFile(blockPlan());
    (
      version.provenance as { artifactSchemaVersion: number }
    ).artifactSchemaVersion = 2;
    expect(verifyArtifact(text(version)).rejection).toBe("UNSUPPORTED_VERSION");
    const canonical = artifactFile(blockPlan());
    (
      canonical.digest as { canonicalPayloadVersion: number }
    ).canonicalPayloadVersion = 9;
    expect(verifyArtifact(text(canonical)).rejection).toBe(
      "UNSUPPORTED_VERSION"
    );
    const engine = artifactFile(blockPlan());
    (engine.request as { algorithmId: string }).algorithmId =
      "host-keyed-fnv-mulberry32-v1";
    expect(verifyArtifact(text(engine)).rejection).toBe(
      "UNSUPPORTED_ALGORITHM"
    );
  });

  it("rejects malformed requests and missing site weights", () => {
    const weights = artifactFile(blockPlan());
    delete (weights.request as { sites: { recruitmentWeight?: number }[] })
      .sites[0].recruitmentWeight;
    expect(verifyArtifact(text(weights)).rejection).toBe("INVALID_REQUEST");
    const rows = artifactFile(blockPlan());
    delete rowsOf(rows)[3].blockSize;
    expect(verifyArtifact(text(rows)).rejection).toBe("MISSING_FIELD");
  });

  it("refuses more rows than the engine limit before generating", () => {
    const file = artifactFile(blockPlan());
    const limits = { ...RANDOMIZATION_RESOURCE_LIMITS, maxRows: 5 };
    expect(verifyArtifact(text(file), { limits }).rejection).toBe(
      "TOO_MANY_ROWS"
    );
  });

  it("never throws on hostile input", () => {
    for (const input of [
      "null",
      "1",
      '"x"',
      '{"rows":{}}',
      '{"__proto__":{}}',
    ]) {
      expect(() => verifyArtifact(input)).not.toThrow();
      expect(verifyArtifact(input).outcome).toBe("rejected");
    }
  });
});

describe("verification through the client", () => {
  it("runs on its own session and lets a newer file supersede an older one", async () => {
    const client = createRandomizationClient();
    const first = client.verify(text(artifactFile(blockPlan())));
    const second = client.verify(text(artifactFile(minimizationPlan())));
    await expect(first).resolves.toEqual({ status: "canceled" });
    const outcome = await second;
    expect(outcome.status).toBe("complete");
    if (outcome.status === "complete") {
      expect(outcome.report.method).toBe("MINIMIZATION");
      expect(outcome.report.outcome).toBe("verified");
    }
    // Verification holds no schedule, so there is nothing to page.
    expect(client.getState().status).toBe("ready");
    client.dispose();
  });

  it("refuses a file above the main-thread budget instead of blocking", async () => {
    const client = createRandomizationClient({ fallbackRowBudget: 5 });
    const outcome = await client.verify(text(artifactFile(blockPlan())));
    expect(outcome).toEqual({
      status: "failed",
      code: "FALLBACK_BUDGET_EXCEEDED",
    });
    client.dispose();
  });

  it("rejects an oversized verify command at the protocol boundary", () => {
    expect(
      parseRandomizationCommand({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "verify",
        requestId: 1,
        text: "x".repeat(RANDOMIZATION_RESOURCE_LIMITS.maxImportBytes + 1),
      })
    ).toBeNull();
  });
});
