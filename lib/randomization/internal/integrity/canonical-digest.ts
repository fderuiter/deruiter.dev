import {
  RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
  RANDOMIZATION_CONTRACT_VERSION,
  RANDOMIZATION_PLAN_SCHEMA_VERSION,
  type ArtifactContentInput,
  type ArtifactDigest,
  type BuildArtifactInput,
  type RandomizationArtifact,
  type StudyProvenanceRef,
} from "../../types";
import { sha256Utf8Hex } from "../engines/sha256";

function serializeCanonical(value: unknown, path: string): string {
  if (value === null) return "null";

  const valueType = typeof value;
  if (valueType === "boolean") {
    return value ? "true" : "false";
  }
  if (valueType === "string") {
    return JSON.stringify(value);
  }
  if (valueType === "number") {
    if (!Number.isFinite(value as number)) {
      throw new Error(
        `Cannot canonicalize non-finite number at "${path || "<root>"}".`
      );
    }
    const normalized = Object.is(value, -0) ? 0 : (value as number);
    return JSON.stringify(normalized);
  }
  if (valueType !== "object") {
    throw new Error(
      `Unsupported value type "${valueType}" at "${path || "<root>"}".`
    );
  }

  if (Array.isArray(value)) {
    const items = value.map((item, idx) => {
      if (item === undefined) {
        throw new Error(
          `Unsupported undefined array element at "${path}[${idx}]".`
        );
      }
      return serializeCanonical(item, `${path}[${idx}]`);
    });
    return `[${items.join(",")}]`;
  }

  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) {
    throw new Error(`Unsupported non-plain object at "${path || "<root>"}".`);
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const pairs: string[] = [];
  for (const key of keys) {
    const entryValue = record[key];
    if (entryValue === undefined) continue;
    const childPath = path ? `${path}.${key}` : key;
    pairs.push(
      `${JSON.stringify(key)}:${serializeCanonical(entryValue, childPath)}`
    );
  }
  return `{${pairs.join(",")}}`;
}

/**
 * Serializes a JSON-compatible audit value into a deterministic canonical JSON
 * string with recursively sorted object keys, preserved array order, and full
 * finite numeric precision. Rejects non-finite numbers and unsupported types.
 */
export function canonicalizeAuditValue(value: unknown): string {
  return serializeCanonical(value, "");
}

/**
 * Computes the versioned SHA-256 numerical content digest over resolved inputs,
 * reduced ratios, versions, and authoritative rows. Explicitly excludes
 * `generatedAtIso` so identical requests yield equal numerical identity across
 * different generation times.
 */
export function computeContentDigest(
  input: ArtifactContentInput
): ArtifactDigest {
  const canonicalPayload = canonicalizeAuditValue({
    artifactSchemaVersion: RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
    contractVersion: RANDOMIZATION_CONTRACT_VERSION,
    planSchemaVersion: RANDOMIZATION_PLAN_SCHEMA_VERSION,
    algorithmId: input.request.algorithmId,
    request: input.request,
    reducedRatios: input.reducedRatios,
    rows: input.rows,
  });

  return Object.freeze({
    algorithm: "SHA-256",
    hex: sha256Utf8Hex(canonicalPayload),
    canonicalPayloadVersion: RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
  });
}

/**
 * Computes a separate SHA-256 event provenance digest binding the numerical
 * content digest to a UTC ISO generation timestamp and host study provenance.
 */
export function computeEventProvenanceDigest(
  contentDigestHex: string,
  generatedAtIso: string,
  study: StudyProvenanceRef
): string {
  const payload = canonicalizeAuditValue({
    canonicalPayloadVersion: RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
    contentDigestHex,
    generatedAtIso,
    study,
  });
  return sha256Utf8Hex(payload);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
  } else {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      deepFreeze(entry);
    }
  }
  return Object.freeze(value);
}

/**
 * Builds an immutable, deeply frozen randomization artifact with a versioned
 * content digest and UTC ISO generation timestamp (via injectable clock).
 * Subsequent mutations to caller draft objects cannot alter the artifact.
 */
export function buildImmutableArtifact(
  input: BuildArtifactInput
): RandomizationArtifact {
  const clock = input.now ?? (() => new Date());
  const generatedAtIso = clock().toISOString();

  // Deep-clone via canonical JSON validation so caller drafts are detached
  const clonedRequest = JSON.parse(
    canonicalizeAuditValue(input.request)
  ) as BuildArtifactInput["request"];
  const clonedRatios = [...input.reducedRatios];
  const clonedRows = JSON.parse(
    canonicalizeAuditValue(input.rows)
  ) as BuildArtifactInput["rows"];

  const digest = computeContentDigest({
    request: clonedRequest,
    reducedRatios: clonedRatios,
    rows: clonedRows,
  });

  const artifact: RandomizationArtifact = {
    provenance: {
      contractVersion: RANDOMIZATION_CONTRACT_VERSION,
      planSchemaVersion: RANDOMIZATION_PLAN_SCHEMA_VERSION,
      artifactSchemaVersion: RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
      algorithmId: clonedRequest.algorithmId,
      generatedAtIso,
      study: clonedRequest.provenance,
    },
    request: clonedRequest,
    reducedRatios: clonedRatios,
    rows: clonedRows,
    digest,
  };

  return deepFreeze(artifact);
}
