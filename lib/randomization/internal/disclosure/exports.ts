/**
 * Pure multi-format export bundle serializers for the Clinical Study Studio
 * randomization work area (ADR 0073).
 *
 * Every serializer passes through `decideRandomizationExport` before building
 * any output, so exploration runs, unacknowledged full-disclosure requests,
 * and masked requests for allocation-sensitive formats fail closed. No React,
 * Next.js, browser DOM, or binary spreadsheet/PDF packages are imported here.
 */

import {
  RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
  RANDOMIZATION_CONTRACT_VERSION,
  RANDOMIZATION_PLAN_SCHEMA_VERSION,
  type AllocationRow,
  type RandomizationArtifact,
  type RandomizationRequest,
} from "../../types";
import {
  buildImmutableArtifact,
  canonicalizeAuditValue,
  computeEventProvenanceDigest,
  computePlanDigest,
} from "../integrity/canonical-digest";
import type { SimulationReport } from "../simulation/monte-carlo";
import {
  BLINDED_TREATMENT_MARKER,
  decideRandomizationExport,
  presentAllocationRows,
  presentTreatmentSummary,
  resolvePresentation,
  sanitizeDisplayLabel,
  type DisclosureDenialCode,
  type DisclosureMode,
  type RandomizationDisclosureMetadata,
  type RandomizationLifecycle,
  type TreatmentSummaryEntry,
} from "./policy";

/** The five text and JSON export formats offered in the governed export bundle. */
export const TEXT_RANDOMIZATION_EXPORT_KINDS = [
  "csv",
  "allocation-json",
  "seed-config",
  "executable-code",
  "validation-manifest",
] as const;

/** One of the five text or JSON export formats. */
export type TextRandomizationExportKind =
  (typeof TEXT_RANDOMIZATION_EXPORT_KINDS)[number];

/** Host study metadata written into export headers and manifests. */
export interface RandomizationStudyMetadata {
  readonly protocolId: string;
  readonly studyName: string;
  readonly phase: string;
}

/** Summary of a run's schedule counts included in validation manifests. */
export interface RandomizationScheduleManifestCounts {
  readonly allocatedCount: number;
  readonly enrollmentTarget: number;
  readonly shortfall: number;
  readonly partialBlockCount: number;
  readonly exhaustedStrataCount: number;
}

/** Input to serialize one governed randomization export format. */
export interface SerializeRandomizationExportInput {
  readonly kind: TextRandomizationExportKind;
  readonly lifecycle: RandomizationLifecycle;
  readonly disclosure: DisclosureMode;
  readonly fullDisclosureAcknowledged: boolean;
  readonly useNoticeAcknowledged: boolean;
  readonly request: RandomizationRequest;
  readonly reducedRatios: readonly number[];
  readonly rows: readonly AllocationRow[];
  readonly studyMetadata: RandomizationStudyMetadata;
  readonly counts?: RandomizationScheduleManifestCounts;
  readonly simulationReport?: SimulationReport | null;
  readonly now?: () => Date;
}

/** Successful serialization result with filename, MIME type, digests, and text. */
export interface SerializedRandomizationExport {
  readonly ok: true;
  readonly kind: TextRandomizationExportKind;
  readonly filename: string;
  readonly mimeType: string;
  readonly content: string;
  readonly metadata: RandomizationDisclosureMetadata;
  readonly planDigest: string;
  readonly contentDigest: string;
  readonly eventProvenanceDigest: string;
}

/** Result of attempting to serialize a randomization export. */
export type SerializeRandomizationExportResult =
  | SerializedRandomizationExport
  | {
      readonly ok: false;
      readonly code: DisclosureDenialCode;
    };

function slugifyFilename(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "schedule";
}

function cleanHeaderLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Neutralizes spreadsheet formula prefixes per CWE-1236 while leaving negative
 * numbers untouched, then applies RFC 4180 CSV quoting.
 */
function csvCell(value: string | number): string {
  const raw = String(value);
  const trimmedStart = raw.replace(/^[\t ]+/, "");
  const isNegativeNumber = /^-\d+(\.\d+)?$/.test(trimmedStart);
  const startsWithFormulaTrigger =
    !isNegativeNumber && /^[=+\-@\t\r]/.test(trimmedStart);
  const safe = startsWithFormulaTrigger ? `'${raw}` : raw;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

function buildPresentationForMode(disclosure: DisclosureMode) {
  return resolvePresentation(
    disclosure === "full"
      ? {
          persona: "Biostatistician",
          segment: "Sponsor",
          unblindRequested: true,
        }
      : {
          persona: "TrialManager",
          segment: "Sponsor",
          unblindRequested: false,
        }
  );
}

function serializeCsvFormat(
  artifact: RandomizationArtifact,
  planDigest: string,
  studyMetadata: RandomizationStudyMetadata,
  disclosureMetadata: RandomizationDisclosureMetadata
): string {
  const presentation = buildPresentationForMode(disclosureMetadata.disclosure);
  const presentedRows = presentAllocationRows(artifact.rows, presentation);
  const { request } = artifact;
  const headerLines = [
    `# Protocol ID: ${cleanHeaderLine(studyMetadata.protocolId) || "(none)"}`,
    `# Study name: ${cleanHeaderLine(studyMetadata.studyName) || "(none)"}`,
    `# Phase: ${cleanHeaderLine(studyMetadata.phase) || "(none)"}`,
    `# Plan: ${cleanHeaderLine(request.name)} (${cleanHeaderLine(request.id)})`,
    `# Method: ${cleanHeaderLine(request.method)} (${cleanHeaderLine(request.algorithmId)})`,
    `# Seed: ${cleanHeaderLine(request.seed.value)} (${cleanHeaderLine(request.seed.source)})`,
    `# Plan digest: ${planDigest}`,
    `# Content digest: ${artifact.digest.hex}`,
    `# Disclosure: ${disclosureMetadata.label} (policy v${disclosureMetadata.disclosurePolicyVersion})`,
    "sequence,subjectId,siteId,stratumKey,armId,armCode,blockIndex,blockSize,positionInBlock",
  ];
  const dataLines = presentedRows.map((row) =>
    [
      row.sequence,
      row.subjectId,
      row.siteId,
      row.stratumKey,
      row.armId,
      row.armCode,
      row.blockIndex ?? "",
      row.blockSize ?? "",
      row.positionInBlock ?? "",
    ]
      .map(csvCell)
      .join(",")
  );
  return `${[...headerLines, ...dataLines].join("\n")}\n`;
}

function serializeAllocationJsonFormat(
  artifact: RandomizationArtifact,
  disclosureMetadata: RandomizationDisclosureMetadata
): string {
  const payload = {
    ...artifact,
    disclosure: disclosureMetadata,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function serializeSeedConfigFormat(
  artifact: RandomizationArtifact,
  planDigest: string,
  eventProvenanceDigest: string,
  studyMetadata: RandomizationStudyMetadata,
  disclosureMetadata: RandomizationDisclosureMetadata
): string {
  const payload = {
    format: "randomization-seed-config" as const,
    schemaVersion: 1 as const,
    provenance: artifact.provenance,
    studyMetadata: {
      protocolId: sanitizeDisplayLabel(studyMetadata.protocolId),
      studyName: sanitizeDisplayLabel(studyMetadata.studyName),
      phase: sanitizeDisplayLabel(studyMetadata.phase),
    },
    planDigest,
    contentDigest: artifact.digest,
    eventProvenanceDigest,
    seed: artifact.request.seed,
    method: artifact.request.method,
    algorithmId: artifact.request.algorithmId,
    reducedRatios: artifact.reducedRatios,
    request: artifact.request,
    disclosure: disclosureMetadata,
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

function serializeExecutableCodeFormat(
  artifact: RandomizationArtifact,
  planDigest: string,
  eventProvenanceDigest: string,
  studyMetadata: RandomizationStudyMetadata,
  disclosureMetadata: RandomizationDisclosureMetadata
): string {
  const embeddedStudyMeta = {
    protocolId: sanitizeDisplayLabel(studyMetadata.protocolId),
    studyName: sanitizeDisplayLabel(studyMetadata.studyName),
    phase: sanitizeDisplayLabel(studyMetadata.phase),
  };
  const embeddedArtifact = {
    ...artifact,
    disclosure: disclosureMetadata,
  };

  return [
    "#!/usr/bin/env node",
    "/**",
    " * Deterministic Clinical Study Studio Randomization Reproduction Script",
    ` * Plan: ${cleanHeaderLine(artifact.request.name)} (${cleanHeaderLine(artifact.request.id)})`,
    ` * Algorithm: ${cleanHeaderLine(artifact.request.algorithmId)}`,
    ` * Disclosure: ${disclosureMetadata.label} (policy v${disclosureMetadata.disclosurePolicyVersion})`,
    " *",
    " * Run with Node.js (`node <file>.mjs`) to cryptographically verify the",
    " * canonical plan digest, SHA-256 content digest, and event provenance digest.",
    " */",
    'import { createHash } from "node:crypto";',
    'import { pathToFileURL } from "node:url";',
    "",
    `export const STUDY_METADATA = Object.freeze(${JSON.stringify(embeddedStudyMeta, null, 2)});`,
    "",
    `export const DISCLOSURE_METADATA = Object.freeze(${JSON.stringify(disclosureMetadata, null, 2)});`,
    "",
    `export const EXPECTED_PLAN_DIGEST = ${JSON.stringify(planDigest)};`,
    `export const EXPECTED_CONTENT_DIGEST = ${JSON.stringify(artifact.digest.hex)};`,
    `export const EXPECTED_EVENT_PROVENANCE_DIGEST = ${JSON.stringify(eventProvenanceDigest)};`,
    "",
    `export const ARTIFACT = ${JSON.stringify(embeddedArtifact, null, 2)};`,
    "",
    "export const REQUEST = ARTIFACT.request;",
    "export const REDUCED_RATIOS = ARTIFACT.reducedRatios;",
    "export const ROWS = ARTIFACT.rows;",
    "",
    "function canonicalize(value) {",
    '  if (value === null) return "null";',
    '  if (typeof value === "boolean") return value ? "true" : "false";',
    '  if (typeof value === "string") return JSON.stringify(value);',
    '  if (typeof value === "number") {',
    '    if (!Number.isFinite(value)) throw new Error("Non-finite number in canonical payload.");',
    "    return JSON.stringify(Object.is(value, -0) ? 0 : value);",
    "  }",
    "  if (Array.isArray(value)) {",
    '    return `[${value.map((entry) => canonicalize(entry)).join(",")}]`;',
    "  }",
    "  const keys = Object.keys(value).sort();",
    "  const pairs = [];",
    "  for (const key of keys) {",
    "    if (value[key] === undefined) continue;",
    "    pairs.push(`${JSON.stringify(key)}:${canonicalize(value[key])}`);",
    "  }",
    '  return `{${pairs.join(",")}}`;',
    "}",
    "",
    "function sha256Hex(text) {",
    '  return createHash("sha256").update(text, "utf8").digest("hex");',
    "}",
    "",
    "export function verifyEmbeddedSchedule() {",
    "  const recomputedPlanDigest = sha256Hex(",
    "    canonicalize({ planDigestVersion: 1, plan: ARTIFACT.request })",
    "  );",
    "  const recomputedContentDigest = sha256Hex(",
    "    canonicalize({",
    `      artifactSchemaVersion: ${RANDOMIZATION_ARTIFACT_SCHEMA_VERSION},`,
    `      contractVersion: ${RANDOMIZATION_CONTRACT_VERSION},`,
    `      planSchemaVersion: ${RANDOMIZATION_PLAN_SCHEMA_VERSION},`,
    "      algorithmId: ARTIFACT.request.algorithmId,",
    "      request: ARTIFACT.request,",
    "      reducedRatios: ARTIFACT.reducedRatios,",
    "      rows: ARTIFACT.rows,",
    "    })",
    "  );",
    "  const recomputedEventDigest = sha256Hex(",
    "    canonicalize({",
    `      canonicalPayloadVersion: ${RANDOMIZATION_ARTIFACT_SCHEMA_VERSION},`,
    "      contentDigestHex: recomputedContentDigest,",
    "      generatedAtIso: ARTIFACT.provenance.generatedAtIso,",
    "      study: ARTIFACT.provenance.study,",
    "    })",
    "  );",
    "  const verified =",
    "    recomputedPlanDigest === EXPECTED_PLAN_DIGEST &&",
    "    recomputedContentDigest === EXPECTED_CONTENT_DIGEST &&",
    "    recomputedEventDigest === EXPECTED_EVENT_PROVENANCE_DIGEST;",
    "  return {",
    "    verified,",
    "    rowCount: ARTIFACT.rows.length,",
    "    planDigest: recomputedPlanDigest,",
    "    contentDigest: recomputedContentDigest,",
    "    eventProvenanceDigest: recomputedEventDigest,",
    "  };",
    "}",
    "",
    "if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {",
    "  const report = verifyEmbeddedSchedule();",
    "  process.stdout.write(`${JSON.stringify(report, null, 2)}\\n`);",
    "  if (!report.verified) process.exitCode = 1;",
    "}",
    "",
  ].join("\n");
}

function countByArm(rows: readonly AllocationRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.armId] = (counts[row.armId] ?? 0) + 1;
  }
  return counts;
}

function serializeValidationManifestFormat(
  artifact: RandomizationArtifact,
  planDigest: string,
  eventProvenanceDigest: string,
  studyMetadata: RandomizationStudyMetadata,
  disclosureMetadata: RandomizationDisclosureMetadata,
  counts: RandomizationScheduleManifestCounts | undefined,
  simulationReport: SimulationReport | null | undefined
): string {
  const presentation = buildPresentationForMode(disclosureMetadata.disclosure);
  const armSummary: readonly TreatmentSummaryEntry[] = presentTreatmentSummary(
    artifact.request.arms,
    countByArm(artifact.rows),
    presentation
  );
  const matchingQa =
    simulationReport && simulationReport.identity.planDigest === planDigest
      ? {
          simulationVersion: simulationReport.identity.simulationVersion,
          planDigest: simulationReport.identity.planDigest,
          algorithmId: simulationReport.identity.algorithmId,
          masterSeed:
            disclosureMetadata.disclosure === "full"
              ? simulationReport.identity.masterSeed
              : BLINDED_TREATMENT_MARKER,
          repetitions: simulationReport.identity.repetitions,
          attritionPercent: simulationReport.identity.attritionPercent,
          interpretation: simulationReport.interpretation,
          attemptedRepetitions: simulationReport.attempted,
          succeededRepetitions: simulationReport.succeeded,
          failedRepetitions: simulationReport.failed,
          canceledRepetitions: simulationReport.canceled,
          meanAllocated: simulationReport.meanAllocated,
          meanRetained: simulationReport.meanRetained,
        }
      : null;

  const manifest = {
    format: "randomization-validation-manifest" as const,
    schemaVersion: 1 as const,
    provenance: artifact.provenance,
    studyMetadata: {
      protocolId: sanitizeDisplayLabel(studyMetadata.protocolId),
      studyName: sanitizeDisplayLabel(studyMetadata.studyName),
      phase: sanitizeDisplayLabel(studyMetadata.phase),
    },
    plan: {
      id: artifact.request.id,
      name: sanitizeDisplayLabel(artifact.request.name),
      method: artifact.request.method,
      algorithmId: artifact.request.algorithmId,
      armCount: artifact.request.arms.length,
      siteCount: artifact.request.sites.length,
      factorCount: artifact.request.factors.length,
      reducedRatios: artifact.reducedRatios,
    },
    digests: {
      planDigest,
      contentDigest: artifact.digest,
      eventProvenanceDigest,
    },
    scheduleSummary: {
      allocatedCount: counts?.allocatedCount ?? artifact.rows.length,
      enrollmentTarget:
        counts?.enrollmentTarget ?? artifact.request.enrollmentTarget,
      shortfall:
        counts?.shortfall ??
        Math.max(0, artifact.request.enrollmentTarget - artifact.rows.length),
      partialBlockCount: counts?.partialBlockCount ?? 0,
      exhaustedStrataCount: counts?.exhaustedStrataCount ?? 0,
      treatmentSummary: armSummary,
    },
    monteCarloQa: matchingQa,
    disclosure: disclosureMetadata,
  };

  // Validate canonicalizability before emitting formatted JSON
  canonicalizeAuditValue(manifest);
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * Evaluates the single disclosure policy gate and serializes one of the five
 * text or JSON randomization export formats (`csv`, `allocation-json`,
 * `seed-config`, `executable-code`, `validation-manifest`).
 */
export function serializeRandomizationExport(
  input: SerializeRandomizationExportInput
): SerializeRandomizationExportResult {
  const decision = decideRandomizationExport({
    kind: input.kind,
    lifecycle: input.lifecycle,
    disclosure: input.disclosure,
    fullDisclosureAcknowledged: input.fullDisclosureAcknowledged,
    useNoticeAcknowledged: input.useNoticeAcknowledged,
  });
  if (!decision.allowed) {
    return { ok: false, code: decision.code };
  }

  const artifact = buildImmutableArtifact({
    request: input.request,
    reducedRatios: input.reducedRatios,
    rows: input.rows,
    now: input.now,
  });
  const planDigest = computePlanDigest(artifact.request);
  const eventProvenanceDigest = computeEventProvenanceDigest(
    artifact.digest.hex,
    artifact.provenance.generatedAtIso,
    artifact.provenance.study
  );
  const baseName = slugifyFilename(
    input.studyMetadata.protocolId || artifact.request.name
  );
  const modeSuffix = decision.metadata.disclosure;

  switch (input.kind) {
    case "csv":
      return {
        ok: true,
        kind: "csv",
        filename: `${baseName}-${modeSuffix}.csv`,
        mimeType: "text/csv",
        content: serializeCsvFormat(
          artifact,
          planDigest,
          input.studyMetadata,
          decision.metadata
        ),
        metadata: decision.metadata,
        planDigest,
        contentDigest: artifact.digest.hex,
        eventProvenanceDigest,
      };
    case "allocation-json":
      return {
        ok: true,
        kind: "allocation-json",
        filename: `${baseName}-artifact.json`,
        mimeType: "application/json",
        content: serializeAllocationJsonFormat(artifact, decision.metadata),
        metadata: decision.metadata,
        planDigest,
        contentDigest: artifact.digest.hex,
        eventProvenanceDigest,
      };
    case "seed-config":
      return {
        ok: true,
        kind: "seed-config",
        filename: `${baseName}-seed-config.json`,
        mimeType: "application/json",
        content: serializeSeedConfigFormat(
          artifact,
          planDigest,
          eventProvenanceDigest,
          input.studyMetadata,
          decision.metadata
        ),
        metadata: decision.metadata,
        planDigest,
        contentDigest: artifact.digest.hex,
        eventProvenanceDigest,
      };
    case "executable-code":
      return {
        ok: true,
        kind: "executable-code",
        filename: `${baseName}-reproduce.mjs`,
        mimeType: "text/javascript",
        content: serializeExecutableCodeFormat(
          artifact,
          planDigest,
          eventProvenanceDigest,
          input.studyMetadata,
          decision.metadata
        ),
        metadata: decision.metadata,
        planDigest,
        contentDigest: artifact.digest.hex,
        eventProvenanceDigest,
      };
    case "validation-manifest":
      return {
        ok: true,
        kind: "validation-manifest",
        filename: `${baseName}-validation-manifest.json`,
        mimeType: "application/json",
        content: serializeValidationManifestFormat(
          artifact,
          planDigest,
          eventProvenanceDigest,
          input.studyMetadata,
          decision.metadata,
          input.counts,
          input.simulationReport
        ),
        metadata: decision.metadata,
        planDigest,
        contentDigest: artifact.digest.hex,
        eventProvenanceDigest,
      };
  }
}
