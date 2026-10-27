import { sha256HexOfText } from "./internal/sha256";

/**
 * One envelope for passing a USDM study between the clinical tools (#3083).
 *
 * Every hand-off carries the whole USDM document plus a few facts about it:
 * which tool sent it, which tool should open it, what study it is, and the
 * SHA-256 of its canonical JSON. The hash lets the receiving tool check the
 * document arrived intact, and later lets run records name the exact study
 * version they came from. The envelope never chooses a study version or
 * design on the reader's behalf: it lists every version identifier.
 */

/** Version of the envelope shape. Bump it when the fields change. */
export const USDM_HANDOFF_ENVELOPE_VERSION = 1;

/** The tools that send or receive a USDM hand-off. */
export type ClinicalTool = "crf-studio" | "study-data";

const CLINICAL_TOOLS: readonly ClinicalTool[] = ["crf-studio", "study-data"];

/** What the envelope says about the study it carries. */
export interface UsdmHandoffStudy {
  /** `study.id`, which USDM v4 allows to be null. */
  readonly id: string | null;
  /** `study.name`, or null when absent. */
  readonly name: string | null;
  /** `usdmVersion` of the wrapper, or null when absent. */
  readonly usdmVersion: string | null;
  /** `versionIdentifier` of every study version, in document order. */
  readonly versionIdentifiers: readonly string[];
}

/** A USDM document on its way from one clinical tool to another. */
export interface UsdmHandoffEnvelope {
  readonly envelopeVersion: typeof USDM_HANDOFF_ENVELOPE_VERSION;
  readonly source: ClinicalTool;
  readonly target: ClinicalTool;
  readonly study: UsdmHandoffStudy;
  /** Lowercase hex SHA-256 of `canonicalUsdmJson(usdm)`. */
  readonly sha256: string;
  readonly usdm: unknown;
}

/** Why an envelope could not be read. */
export type UsdmHandoffProblem =
  | "not-an-envelope"
  | "unsupported-version"
  | "unknown-tool"
  | "wrong-target"
  | "hash-mismatch";

/** The result of reading an envelope. */
export type ReadUsdmHandoffResult =
  | { readonly status: "ok"; readonly envelope: UsdmHandoffEnvelope }
  | { readonly status: "invalid"; readonly problem: UsdmHandoffProblem };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort())
    sorted[key] = sortKeys(value[key]);
  return sorted;
}

/**
 * The canonical JSON text of a USDM document: object keys sorted by code
 * point at every level, no whitespace, array order kept. Two documents
 * that differ only in key order or formatting give the same text.
 */
export function canonicalUsdmJson(usdm: unknown): string {
  return JSON.stringify(sortKeys(usdm)) ?? "null";
}

/** Lowercase hex SHA-256 of a USDM document's canonical JSON. */
export function usdmContentHash(usdm: unknown): string {
  return sha256HexOfText(canonicalUsdmJson(usdm));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function describeStudy(usdm: unknown): UsdmHandoffStudy {
  const wrapper = isRecord(usdm) ? usdm : {};
  const study = isRecord(wrapper.study) ? wrapper.study : {};
  const versions = Array.isArray(study.versions) ? study.versions : [];
  return {
    id: stringOrNull(study.id),
    name: stringOrNull(study.name),
    usdmVersion: stringOrNull(wrapper.usdmVersion),
    versionIdentifiers: versions.flatMap((version) =>
      isRecord(version) && typeof version.versionIdentifier === "string"
        ? [version.versionIdentifier]
        : []
    ),
  };
}

/** Wraps a USDM document for the hand-off from `source` to `target`. */
export function createUsdmHandoff(
  usdm: unknown,
  route: { readonly source: ClinicalTool; readonly target: ClinicalTool }
): UsdmHandoffEnvelope {
  return {
    envelopeVersion: USDM_HANDOFF_ENVELOPE_VERSION,
    source: route.source,
    target: route.target,
    study: describeStudy(usdm),
    sha256: usdmContentHash(usdm),
    usdm,
  };
}

function isTool(value: unknown): value is ClinicalTool {
  return CLINICAL_TOOLS.includes(value as ClinicalTool);
}

/**
 * Reads an envelope that arrived at `target`, for example after
 * `JSON.parse` of stored text. It checks the shape, the version, both tool
 * names, that this tool is the intended target, and that the document
 * still matches its hash. The study summary is recomputed from the
 * document rather than trusted.
 */
export function readUsdmHandoff(
  value: unknown,
  target: ClinicalTool
): ReadUsdmHandoffResult {
  if (
    !isRecord(value) ||
    !("usdm" in value) ||
    typeof value.sha256 !== "string"
  ) {
    return { status: "invalid", problem: "not-an-envelope" };
  }
  if (value.envelopeVersion !== USDM_HANDOFF_ENVELOPE_VERSION) {
    return { status: "invalid", problem: "unsupported-version" };
  }
  if (!isTool(value.source) || !isTool(value.target)) {
    return { status: "invalid", problem: "unknown-tool" };
  }
  if (value.target !== target) {
    return { status: "invalid", problem: "wrong-target" };
  }
  if (usdmContentHash(value.usdm) !== value.sha256) {
    return { status: "invalid", problem: "hash-mismatch" };
  }
  return {
    status: "ok",
    envelope: createUsdmHandoff(value.usdm, {
      source: value.source,
      target: value.target,
    }),
  };
}
