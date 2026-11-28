import type { CanonicalCrfDocument } from "../../types";
import {
  exportUniversalCrfJson,
  exportUniversalCrfYaml,
  isUniversalCrfSchemaUrl,
  parseUniversalCrf,
  parseUniversalCrfYaml,
} from "../universal-schema";
import { isCdiscSpecCsv, isRedcapCsv } from "../csv-spec-parser";
import {
  fromCanonicalCrfDocument,
  toCanonicalCrfDocument,
} from "./canonical-document";
import { CodecDetectInput, CodecValidationError, FormatCodec } from "./types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parses a trimmed JSON object candidate without throwing, returning `null` if
 * the payload is not a JSON object.
 */
export function inspectJsonRecord(raw: string): Record<string, unknown> | null {
  const trimmed = (raw || "").trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Checks whether raw input belongs to the XML grammar partition.
 */
export function isXmlCandidate(input: CodecDetectInput): boolean {
  const trimmed = (input.raw || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("<")) return true;
  const lowerName = (input.fileName || "").toLowerCase();
  return (
    lowerName.endsWith(".xml") &&
    !trimmed.startsWith("{") &&
    !trimmed.startsWith("[")
  );
}

/**
 * Checks whether a parsed JSON object carries an HL7 FHIR `resourceType`.
 */
export function isFhirResourceRecord(record: Record<string, unknown>): boolean {
  return record.resourceType !== undefined && record.resourceType !== null;
}

/**
 * Checks whether a parsed JSON object matches CDISC USDM v4 structural markers.
 */
export function isUsdmV4Record(record: Record<string, unknown>): boolean {
  if (isFhirResourceRecord(record)) return false;
  if (isUniversalCrfSchemaUrl(record.$schema as string | undefined)) {
    return false;
  }
  if (
    typeof record.usdmVersion === "string" &&
    record.usdmVersion.trim().startsWith("4")
  ) {
    return true;
  }
  if (
    isPlainObject(record.study) &&
    Array.isArray((record.study as Record<string, unknown>).versions)
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether a parsed JSON object matches CDISC USDM v3 structural markers.
 */
export function isUsdmV3Record(record: Record<string, unknown>): boolean {
  if (isFhirResourceRecord(record)) return false;
  if (isUniversalCrfSchemaUrl(record.$schema as string | undefined)) {
    return false;
  }
  if (isUsdmV4Record(record)) return false;
  const hasExplicitUsdmEnvelope =
    isPlainObject(record.study) ||
    Array.isArray(record.studyDesigns) ||
    typeof record.usdmVersion === "string";
  if (
    !hasExplicitUsdmEnvelope &&
    (typeof record.protocolNumber === "string" ||
      typeof record.protocolId === "string")
  ) {
    return false;
  }
  return Boolean(hasExplicitUsdmEnvelope || typeof record.$schema === "string");
}

/**
 * Checks whether a parsed JSON object matches native Universal CRF JSON markers
 * (`$schema`, `protocolNumber`, or `protocolId`).
 */
export function isUniversalJsonRecord(
  record: Record<string, unknown>
): boolean {
  if (
    isFhirResourceRecord(record) ||
    isUsdmV4Record(record) ||
    isUsdmV3Record(record)
  ) {
    return false;
  }
  return Boolean(
    isUniversalCrfSchemaUrl(record.$schema as string | undefined) ||
    typeof record.protocolNumber === "string" ||
    typeof record.protocolId === "string" ||
    (typeof record.id === "string" && Array.isArray(record.forms))
  );
}

function hasUniversalYamlSignature(raw: string): boolean {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => {
      const t = line.trim();
      return t.length > 0 && !t.startsWith("#") && t !== "---" && t !== "...";
    });
  if (lines.length === 0) return false;

  const topKeys = new Set<string>();
  let schemaValue = "";
  for (const line of lines) {
    const match = /^([A-Za-z0-9_$]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    topKeys.add(match[1]);
    if (match[1] === "$schema") {
      schemaValue = match[2].replace(/^['"]|['"]$/g, "").trim();
    }
  }

  if (schemaValue && isUniversalCrfSchemaUrl(schemaValue)) {
    return true;
  }
  const hasIdentifier =
    topKeys.has("protocolNumber") || topKeys.has("protocolId");
  const hasStructure =
    topKeys.has("forms") ||
    topKeys.has("studyName") ||
    topKeys.has("schemaVersion");
  return hasIdentifier && hasStructure;
}

/**
 * Symmetric codec for Universal CRF JSON (`.crf.json` / `.json`).
 * Validates `CanonicalCrfDocument` invariants on both decode and encode.
 */
export const UniversalJsonCodec: FormatCodec<string> = {
  id: "json_universal",
  ingestionFormat: "json_universal",
  formatLabel: "Universal CRF JSON",
  extensions: [".crf.json", ".json"],

  canDecode(input: CodecDetectInput): boolean {
    if (isXmlCandidate(input)) return false;
    const lowerName = (input.fileName || "").toLowerCase();
    const record = inspectJsonRecord(input.raw);
    if (!record) {
      return (
        lowerName.endsWith(".crf.json") && Boolean((input.raw || "").trim())
      );
    }
    if (
      lowerName.endsWith(".crf.json") &&
      !isFhirResourceRecord(record) &&
      !isUsdmV4Record(record) &&
      !isUsdmV3Record(record)
    ) {
      return true;
    }
    return isUniversalJsonRecord(record);
  },

  decode(raw: string): CanonicalCrfDocument {
    try {
      const study = parseUniversalCrf(raw);
      return toCanonicalCrfDocument(study, { mode: "strict" });
    } catch (err: unknown) {
      if (err instanceof CodecValidationError) throw err;
      throw new CodecValidationError(
        "json_universal",
        err instanceof Error ? err.message : String(err)
      );
    }
  },

  encode(doc: CanonicalCrfDocument): string {
    const study = fromCanonicalCrfDocument(doc);
    toCanonicalCrfDocument(study, { mode: "strict" });
    return exportUniversalCrfJson(study);
  },
};

/**
 * Symmetric codec for Universal CRF YAML (`.crf.yaml` / `.yaml` / `.yml`).
 * Uses the pure YAML AST lexer and validates `CanonicalCrfDocument` invariants
 * on both decode and encode.
 */
export const UniversalYamlCodec: FormatCodec<string> = {
  id: "yaml_universal",
  ingestionFormat: "yaml_universal",
  formatLabel: "Universal CRF YAML",
  extensions: [".crf.yaml", ".crf.yml", ".yaml", ".yml"],

  canDecode(input: CodecDetectInput): boolean {
    if (isXmlCandidate(input)) return false;
    const trimmed = (input.raw || "").trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
    if (isRedcapCsv(trimmed) || isCdiscSpecCsv(trimmed)) return false;

    const lowerName = (input.fileName || "").toLowerCase();
    if (lowerName.endsWith(".yaml") || lowerName.endsWith(".yml")) {
      return true;
    }
    return hasUniversalYamlSignature(trimmed);
  },

  decode(raw: string): CanonicalCrfDocument {
    try {
      const study = parseUniversalCrfYaml(raw);
      return toCanonicalCrfDocument(study, { mode: "strict" });
    } catch (err: unknown) {
      if (err instanceof CodecValidationError) throw err;
      throw new CodecValidationError(
        "yaml_universal",
        err instanceof Error ? err.message : String(err)
      );
    }
  },

  encode(doc: CanonicalCrfDocument): string {
    const study = fromCanonicalCrfDocument(doc);
    toCanonicalCrfDocument(study, { mode: "strict" });
    return exportUniversalCrfYaml(study);
  },
};
