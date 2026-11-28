import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLINDED_TREATMENT_MARKER,
  MONTE_CARLO_SIMULATION_VERSION,
  TEXT_RANDOMIZATION_EXPORT_KINDS,
  computeEventProvenanceDigest,
  createSimulationRunner,
  generateBlockSchedule,
  reduceAllocationRatios,
  serializeRandomizationExport,
  verifyArtifact,
  type RandomizationRequest,
} from "@/lib/randomization";
import { createRandomizationPreset } from "@/lib/randomization/presets";

function sampleRequest(
  overrides?: Partial<RandomizationRequest>
): RandomizationRequest {
  const preset = createRandomizationPreset("simple");
  return {
    contractVersion: 1,
    planSchemaVersion: 1,
    id: "RandomizationPlan_1",
    name: "Primary Allocation Plan",
    method: "BLOCK",
    algorithmId: preset.algorithmId,
    arms: preset.arms,
    sites: preset.sites,
    factors: preset.factors,
    blockSettings: preset.blockSettings!,
    caps: preset.caps,
    seed: {
      value: "BundleSeed2026",
      source: "custom",
    },
    subjectIdMask: preset.subjectIdMask,
    enrollmentTarget: preset.enrollmentTarget,
    provenance: {
      studyId: "Study_1",
      studyVersionId: "StudyVersion_1",
      studyDesignId: "StudyDesign_1",
      workspaceRevisionId: "R2",
      usdmSha256: "a".repeat(64),
    },
    ...overrides,
  } as RandomizationRequest;
}

describe("serializeRandomizationExport multi-format bundle", () => {
  const request = sampleRequest();
  const schedule = generateBlockSchedule(request);
  if (!schedule.ok) {
    throw new Error(
      `Expected valid block schedule: ${JSON.stringify(schedule.findings)}`
    );
  }
  const reduced = reduceAllocationRatios(request.arms);
  if (!reduced.ok) throw new Error("Expected valid reduced ratios");
  const fixedNow = () => new Date("2026-05-01T12:00:00.000Z");

  const studyMetadata = {
    protocolId: "VALVE-2026",
    studyName: "Transcatheter vs Surgical Valve Study",
    phase: "Phase III Trial",
  };

  it("enforces disclosure policy gates across exploration, masked, and unacknowledged full modes", () => {
    for (const kind of TEXT_RANDOMIZATION_EXPORT_KINDS) {
      const blockedExploration = serializeRandomizationExport({
        kind,
        lifecycle: "exploration",
        disclosure: "masked",
        fullDisclosureAcknowledged: false,
        useNoticeAcknowledged: true,
        request,
        reducedRatios: reduced.ratios,
        rows: schedule.rows,
        studyMetadata,
        now: fixedNow,
      });
      expect(blockedExploration).toEqual({
        ok: false,
        code: "EXPLORATION_EXPORT_BLOCKED",
      });
    }

    // Masked mode blocks allocation-sensitive formats
    for (const sensitiveKind of [
      "allocation-json",
      "seed-config",
      "executable-code",
    ] as const) {
      const maskedSensitive = serializeRandomizationExport({
        kind: sensitiveKind,
        lifecycle: "promoted",
        disclosure: "masked",
        fullDisclosureAcknowledged: false,
        useNoticeAcknowledged: true,
        request,
        reducedRatios: reduced.ratios,
        rows: schedule.rows,
        studyMetadata,
        now: fixedNow,
      });
      expect(maskedSensitive).toEqual({
        ok: false,
        code: "FULL_DISCLOSURE_REQUIRED",
      });
    }

    // Full mode requires explicit fullDisclosureAcknowledged confirmation
    for (const fullKind of [
      "csv",
      "allocation-json",
      "seed-config",
      "executable-code",
    ] as const) {
      const unconfirmed = serializeRandomizationExport({
        kind: fullKind,
        lifecycle: "promoted",
        disclosure: "full",
        fullDisclosureAcknowledged: false,
        useNoticeAcknowledged: true,
        request,
        reducedRatios: reduced.ratios,
        rows: schedule.rows,
        studyMetadata,
        now: fixedNow,
      });
      expect(unconfirmed).toEqual({
        ok: false,
        code: "FULL_DISCLOSURE_NOT_ACKNOWLEDGED",
      });
    }
  });

  it("serializes masked and full CSV with study metadata headers and CWE-1236 formula neutralization", () => {
    const rowsWithFormulaTrigger = schedule.rows.map((row, idx) =>
      idx === 0 ? { ...row, siteId: '=HYPERLINK("https://evil.example")' } : row
    );

    const maskedCsv = serializeRandomizationExport({
      kind: "csv",
      lifecycle: "promoted",
      disclosure: "masked",
      fullDisclosureAcknowledged: false,
      useNoticeAcknowledged: true,
      request,
      reducedRatios: reduced.ratios,
      rows: rowsWithFormulaTrigger,
      studyMetadata,
      now: fixedNow,
    });
    expect(maskedCsv.ok).toBe(true);
    if (!maskedCsv.ok) return;

    expect(maskedCsv.content).toContain("# Protocol ID: VALVE-2026");
    expect(maskedCsv.content).toContain(
      "# Study name: Transcatheter vs Surgical Valve Study"
    );
    expect(maskedCsv.content).toContain("# Phase: Phase III Trial");
    expect(maskedCsv.content).toContain(BLINDED_TREATMENT_MARKER);
    expect(maskedCsv.content).not.toContain(
      `,${request.arms[0].id},${request.arms[0].code},`
    );
    // Formula trigger prefixed with apostrophe and RFC 4180 quoted
    expect(maskedCsv.content).toContain("\"'=HYPERLINK(");

    const fullCsv = serializeRandomizationExport({
      kind: "csv",
      lifecycle: "promoted",
      disclosure: "full",
      fullDisclosureAcknowledged: true,
      useNoticeAcknowledged: true,
      request,
      reducedRatios: reduced.ratios,
      rows: schedule.rows,
      studyMetadata,
      now: fixedNow,
    });
    expect(fullCsv.ok).toBe(true);
    if (!fullCsv.ok) return;
    expect(fullCsv.content).toContain(
      `,${request.arms[0].id},${request.arms[0].code},`
    );
    expect(fullCsv.content).not.toContain(BLINDED_TREATMENT_MARKER);
  });

  it("serializes allocation-json that verifies cleanly with verifyArtifact", () => {
    const exported = serializeRandomizationExport({
      kind: "allocation-json",
      lifecycle: "promoted",
      disclosure: "full",
      fullDisclosureAcknowledged: true,
      useNoticeAcknowledged: true,
      request,
      reducedRatios: reduced.ratios,
      rows: schedule.rows,
      studyMetadata,
      now: fixedNow,
    });
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;

    const report = verifyArtifact(exported.content);
    expect(report.outcome).toBe("verified");
    expect(report.digest.status).toBe("pass");
    expect(report.regeneration.status).toBe("pass");
    expect(report.invariants.status).toBe("pass");
    expect(report.provenance.status).toBe("pass");
  });

  it("serializes seed-config, runnable executable-code (.mjs), and validation-manifest with QA report", () => {
    const openedRunner = createSimulationRunner({
      simulationVersion: MONTE_CARLO_SIMULATION_VERSION,
      masterSeed: "QaMasterSeed99",
      repetitions: 5,
      attritionPercent: 10,
      plan: request,
    });
    expect(openedRunner.ok).toBe(true);
    if (!openedRunner.ok) return;
    while (!openedRunner.runner.step(5)) {
      // advance simulation steps
    }
    const qaReport = openedRunner.runner.report();

    const seedConfig = serializeRandomizationExport({
      kind: "seed-config",
      lifecycle: "promoted",
      disclosure: "full",
      fullDisclosureAcknowledged: true,
      useNoticeAcknowledged: true,
      request,
      reducedRatios: reduced.ratios,
      rows: schedule.rows,
      studyMetadata,
      now: fixedNow,
    });
    expect(seedConfig.ok).toBe(true);
    if (!seedConfig.ok) return;
    const parsedSeed = JSON.parse(seedConfig.content) as {
      format: string;
      seed: { value: string };
      planDigest: string;
      eventProvenanceDigest: string;
    };
    expect(parsedSeed.format).toBe("randomization-seed-config");
    expect(parsedSeed.seed.value).toBe("BundleSeed2026");
    expect(parsedSeed.planDigest).toBe(seedConfig.planDigest);

    const codeExport = serializeRandomizationExport({
      kind: "executable-code",
      lifecycle: "promoted",
      disclosure: "full",
      fullDisclosureAcknowledged: true,
      useNoticeAcknowledged: true,
      request,
      reducedRatios: reduced.ratios,
      rows: schedule.rows,
      studyMetadata,
      now: fixedNow,
    });
    expect(codeExport.ok).toBe(true);
    if (!codeExport.ok) return;

    const dir = mkdtempSync(join(tmpdir(), "rnd-repro-"));
    try {
      const scriptPath = join(dir, codeExport.filename);
      writeFileSync(scriptPath, codeExport.content, "utf8");
      const stdout = execFileSync(process.execPath, [scriptPath], {
        encoding: "utf8",
      });
      const verifiedOut = JSON.parse(stdout) as {
        verified: boolean;
        rowCount: number;
        planDigest: string;
        contentDigest: string;
        eventProvenanceDigest: string;
      };
      expect(verifiedOut).toEqual({
        verified: true,
        rowCount: schedule.rows.length,
        planDigest: codeExport.planDigest,
        contentDigest: codeExport.contentDigest,
        eventProvenanceDigest: codeExport.eventProvenanceDigest,
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }

    const manifestExport = serializeRandomizationExport({
      kind: "validation-manifest",
      lifecycle: "promoted",
      disclosure: "full",
      fullDisclosureAcknowledged: true,
      useNoticeAcknowledged: true,
      request,
      reducedRatios: reduced.ratios,
      rows: schedule.rows,
      studyMetadata,
      simulationReport: qaReport,
      now: fixedNow,
    });
    expect(manifestExport.ok).toBe(true);
    if (!manifestExport.ok) return;

    const parsedManifest = JSON.parse(manifestExport.content) as {
      format: string;
      digests: {
        planDigest: string;
        contentDigest: { hex: string };
        eventProvenanceDigest: string;
      };
      provenance: {
        generatedAtIso: string;
        study: RandomizationRequest["provenance"];
      };
      monteCarloQa: {
        masterSeed: string;
        succeededRepetitions: number;
      };
    };
    expect(parsedManifest.format).toBe("randomization-validation-manifest");
    expect(parsedManifest.digests.eventProvenanceDigest).toBe(
      computeEventProvenanceDigest(
        parsedManifest.digests.contentDigest.hex,
        parsedManifest.provenance.generatedAtIso,
        parsedManifest.provenance.study
      )
    );
    expect(parsedManifest.monteCarloQa.masterSeed).toBe("QaMasterSeed99");
    expect(parsedManifest.monteCarloQa.succeededRepetitions).toBe(5);
  });
});
