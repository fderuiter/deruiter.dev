/**
 * Local reverification of a randomization artifact file (#4009,
 * RND-VERIF-001 to RND-VERIF-005).
 *
 * The verifier reads the text of a JSON file the visitor chose. Nothing is
 * uploaded or logged. It answers five independent questions, and a full
 * pass needs every one of them:
 *
 * 1. Shape: is the file within the import limits, well formed, and on a
 *    supported contract, plan, artifact, engine and canonicalization
 *    version? Size and nesting are checked before parsing.
 * 2. Integrity: does the recorded SHA-256 content digest match the
 *    digest recomputed over the file's own request, ratios and rows?
 * 3. Regeneration: does running the embedded request again, on the
 *    declared engine, produce the same rows in the same order, field by
 *    field (sequence, subject ID, site, stratum key and every factor
 *    level, arm ID and code, block number, size and position)?
 * 4. Invariants: do the rows keep their own rules (unique IDs, known
 *    sites and arms, arm codes that match their IDs, stratum keys that
 *    match their levels, complete blocks in exact ratio, caps)?
 * 5. Provenance: do the provenance block, the request and the digest
 *    metadata agree with each other?
 *
 * Digest success and regeneration success are reported separately: a
 * file can be internally consistent and still not be what the engine
 * produces, or the reverse. A masked or incomplete file reports
 * insufficient evidence with the checks that could run; it is never
 * called corrupt or fully verified for lack of assignments.
 */
import {
  RANDOMIZATION_ARTIFACT_SCHEMA_VERSION,
  RANDOMIZATION_CONTRACT_VERSION,
  RANDOMIZATION_PLAN_SCHEMA_VERSION,
  RANDOMIZATION_RESOURCE_LIMITS,
  MT19937_BLOCK_ALGORITHM_ID,
  MT19937_MINIMIZATION_ALGORITHM_ID,
  type AllocationRow,
  type RandomizationRequest,
  type RandomizationResourceLimits,
} from "../../types";
import { reduceAllocationRatios } from "../contracts";
import { validateRandomizationPlan } from "../validate-plan";
import { generateBlockSchedule } from "../engines/block";
import { generateMinimizationSchedule } from "../engines/minimization";
import {
  canonicalizeAuditValue,
  computeContentDigest,
} from "../integrity/canonical-digest";
import { serializeStructuralStratumKey } from "../identity/stratum-identity";
import { assessVerificationEvidence } from "../disclosure/policy";
import type { VerificationEvidenceAssessment } from "../disclosure/policy";

/** Version of the verification report format. */
export const VERIFICATION_REPORT_VERSION = 1 as const;

/** Most row differences a report lists. The total is always counted. */
export const MAX_VERIFICATION_DIFFS = 50;

/** Most invariant or provenance findings a report lists. */
export const MAX_VERIFICATION_FINDINGS = 50;

/** Overall result of one verification. */
export type VerificationOutcome =
  /** Every check ran and passed. */
  | "verified"
  /** At least one check ran and failed. */
  | "failed"
  /** The file is masked or lacks assignments; only some checks ran. */
  | "insufficient-evidence"
  /** The file could not be read as a supported artifact. */
  | "rejected";

/** Result of one check. */
export type VerificationCheckStatus = "pass" | "fail" | "not-run";

/** Stable reasons a file is rejected before any check runs. */
export type VerificationRejectionCode =
  | "FILE_TOO_LARGE"
  | "NESTING_TOO_DEEP"
  | "INVALID_JSON"
  | "NOT_AN_ARTIFACT"
  | "MISSING_FIELD"
  | "UNSUPPORTED_VERSION"
  | "UNSUPPORTED_ALGORITHM"
  | "TOO_MANY_ROWS"
  | "INVALID_REQUEST";

/** The authoritative row fields compared during regeneration. */
export type VerificationRowField =
  | "sequence"
  | "subjectId"
  | "siteId"
  | "stratumKey"
  | "stratumLevels"
  | "armId"
  | "armCode"
  | "blockIndex"
  | "blockSize"
  | "positionInBlock";

/** One difference between the file and the regenerated schedule. */
export interface VerificationRowDiff {
  /** Zero-based row position in generated order. */
  readonly index: number;
  readonly category: "field" | "missing-row" | "extra-row";
  /** The field that differs, for a `field` difference. */
  readonly field?: VerificationRowField;
  /** Expected (regenerated) value as canonical JSON, cut to 200 characters. */
  readonly expected: string;
  /** Actual (file) value as canonical JSON, cut to 200 characters. */
  readonly actual: string;
}

/** Stable codes for invariant and provenance findings. */
export type VerificationFindingCode =
  | "DUPLICATE_SUBJECT_ID"
  | "SEQUENCE_OUT_OF_ORDER"
  | "UNKNOWN_SITE"
  | "UNKNOWN_ARM"
  | "ARM_CODE_MISMATCH"
  | "UNKNOWN_FACTOR_LEVEL"
  | "STRATUM_KEY_MISMATCH"
  | "BLOCK_SIZE_NOT_ALLOWED"
  | "BLOCK_RATIO_BROKEN"
  | "BLOCK_OVERFILLED"
  | "CAP_EXCEEDED"
  | "ROW_COUNT_ABOVE_TARGET"
  | "REDUCED_RATIO_MISMATCH"
  | "ALGORITHM_MISMATCH"
  | "STUDY_MISMATCH"
  | "VERSION_MISMATCH"
  | "DIGEST_METADATA_INVALID"
  | "GENERATED_AT_INVALID";

/** One invariant or provenance finding. */
export interface VerificationFinding {
  readonly code: VerificationFindingCode;
  /** First row involved, when one is. */
  readonly index?: number;
  readonly message: string;
}

/** The verification report. */
export interface VerificationReport {
  readonly reportVersion: typeof VERIFICATION_REPORT_VERSION;
  readonly outcome: VerificationOutcome;
  /** Set when the outcome is `rejected`. */
  readonly rejection: VerificationRejectionCode | null;
  readonly evidence: VerificationEvidenceAssessment | null;
  /** Rows in the file; null when the file was rejected. */
  readonly rowCount: number | null;
  readonly method: RandomizationRequest["method"] | null;
  readonly algorithmId: string | null;
  readonly digest: {
    readonly status: VerificationCheckStatus;
    readonly recorded: string | null;
    readonly computed: string | null;
  };
  readonly regeneration: {
    readonly status: VerificationCheckStatus;
    readonly expectedRows: number | null;
    readonly actualRows: number | null;
    /** Every difference found, even when only some are listed. */
    readonly diffCount: number;
    readonly diffs: readonly VerificationRowDiff[];
  };
  readonly invariants: {
    readonly status: VerificationCheckStatus;
    readonly findingCount: number;
    readonly findings: readonly VerificationFinding[];
  };
  readonly provenance: {
    readonly status: VerificationCheckStatus;
    readonly findingCount: number;
    readonly findings: readonly VerificationFinding[];
  };
}

/** Options, mainly for tests. */
export interface VerifyArtifactOptions {
  readonly limits?: RandomizationResourceLimits;
}

const NOT_RUN = Object.freeze({
  digest: Object.freeze({ status: "not-run", recorded: null, computed: null }),
  regeneration: Object.freeze({
    status: "not-run",
    expectedRows: null,
    actualRows: null,
    diffCount: 0,
    diffs: Object.freeze([]),
  }),
  invariants: Object.freeze({
    status: "not-run",
    findingCount: 0,
    findings: Object.freeze([]),
  }),
  provenance: Object.freeze({
    status: "not-run",
    findingCount: 0,
    findings: Object.freeze([]),
  }),
} as const);

function reject(code: VerificationRejectionCode): VerificationReport {
  return {
    reportVersion: VERIFICATION_REPORT_VERSION,
    outcome: "rejected",
    rejection: code,
    evidence: null,
    rowCount: null,
    method: null,
    algorithmId: null,
    ...NOT_RUN,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** UTF-8 byte length without allocating an encoded copy. */
function utf8Length(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

/** Deepest bracket nesting outside strings, stopping early past `limit`. */
function nestingDepth(text: string, limit: number): number {
  let depth = 0;
  let deepest = 0;
  let inString = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    if (inString) {
      if (ch === 0x5c) i += 1;
      else if (ch === 0x22) inString = false;
    } else if (ch === 0x22) inString = true;
    else if (ch === 0x7b || ch === 0x5b) {
      depth += 1;
      if (depth > deepest) {
        deepest = depth;
        if (deepest > limit) return deepest;
      }
    } else if (ch === 0x7d || ch === 0x5d) depth -= 1;
  }
  return deepest;
}

function clip(value: unknown): string {
  let text: string;
  try {
    text = value === undefined ? "undefined" : canonicalizeAuditValue(value);
  } catch {
    text = String(value);
  }
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

const ROW_FIELDS: readonly VerificationRowField[] = [
  "sequence",
  "subjectId",
  "siteId",
  "stratumKey",
  "stratumLevels",
  "armId",
  "armCode",
  "blockIndex",
  "blockSize",
  "positionInBlock",
];

const REQUIRED_ROW_FIELDS: readonly VerificationRowField[] = ROW_FIELDS;

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return canonicalizeAuditValue(a) === canonicalizeAuditValue(b);
  } catch {
    return false;
  }
}

/** Collects findings up to the list bound while counting all of them. */
class Findings {
  readonly listed: VerificationFinding[] = [];
  count = 0;
  add(code: VerificationFindingCode, message: string, index?: number): void {
    this.count += 1;
    if (this.listed.length < MAX_VERIFICATION_FINDINGS) {
      this.listed.push(
        index === undefined ? { code, message } : { code, index, message }
      );
    }
  }
  result() {
    return {
      status: (this.count === 0 ? "pass" : "fail") as VerificationCheckStatus,
      findingCount: this.count,
      findings: this.listed,
    };
  }
}

function checkRowShape(rows: readonly unknown[]): rows is AllocationRow[] {
  return rows.every(
    (row) =>
      isRecord(row) &&
      REQUIRED_ROW_FIELDS.every((field) => field in row) &&
      typeof row.sequence === "number" &&
      typeof row.subjectId === "string" &&
      typeof row.siteId === "string" &&
      typeof row.stratumKey === "string" &&
      isRecord(row.stratumLevels) &&
      typeof row.armId === "string" &&
      typeof row.armCode === "string"
  );
}

function checkInvariants(
  request: RandomizationRequest,
  ratios: readonly number[],
  rows: readonly AllocationRow[],
  armsAuthoritative: boolean
): Findings {
  const findings = new Findings();
  const sites = new Set(request.sites.map((s) => s.id));
  const arms = new Map(
    request.arms.map((a, i) => [a.id, { code: a.code, index: i }])
  );
  const levels = new Map(
    request.factors.map((f) => [f.id, new Set(f.levels.map((l) => l.id))])
  );
  const subjects = new Set<string>();
  rows.forEach((row, index) => {
    if (row.sequence !== index + 1) {
      findings.add(
        "SEQUENCE_OUT_OF_ORDER",
        `Row ${index + 1} has sequence ${row.sequence}.`,
        index
      );
    }
    if (subjects.has(row.subjectId)) {
      findings.add(
        "DUPLICATE_SUBJECT_ID",
        `Subject ID ${clip(row.subjectId)} appears more than once.`,
        index
      );
    }
    subjects.add(row.subjectId);
    if (!sites.has(row.siteId)) {
      findings.add(
        "UNKNOWN_SITE",
        `Row ${index + 1} names a site the plan doesn't have.`,
        index
      );
    }
    if (armsAuthoritative) {
      const arm = arms.get(row.armId);
      if (!arm) {
        findings.add(
          "UNKNOWN_ARM",
          `Row ${index + 1} names an arm the plan doesn't have.`,
          index
        );
      } else if (arm.code !== row.armCode) {
        findings.add(
          "ARM_CODE_MISMATCH",
          `Row ${index + 1} pairs arm ${clip(row.armId)} with code ${clip(row.armCode)}.`,
          index
        );
      }
    }
    const entries: { factorId: string; levelId: string }[] = [];
    let levelsOk =
      Object.keys(row.stratumLevels).length === request.factors.length;
    for (const factor of request.factors) {
      const levelId = row.stratumLevels[factor.id];
      if (typeof levelId !== "string" || !levels.get(factor.id)?.has(levelId)) {
        levelsOk = false;
        break;
      }
      entries.push({ factorId: factor.id, levelId });
    }
    if (!levelsOk) {
      findings.add(
        "UNKNOWN_FACTOR_LEVEL",
        `Row ${index + 1} has a factor level the plan doesn't have.`,
        index
      );
    } else if (serializeStructuralStratumKey(entries) !== row.stratumKey) {
      findings.add(
        "STRATUM_KEY_MISMATCH",
        `Row ${index + 1} has a stratum key that doesn't match its levels.`,
        index
      );
    }
  });

  if (rows.length > request.enrollmentTarget) {
    findings.add(
      "ROW_COUNT_ABOVE_TARGET",
      `The file has ${rows.length} rows, more than the enrollment target of ${request.enrollmentTarget}.`
    );
  }

  if (request.method === "BLOCK") {
    const allowed = new Set<number>([
      ...request.blockSettings.defaultRule.sizes,
      ...(request.blockSettings.siteOverrides ?? []).flatMap(
        (o) => o.rule.sizes
      ),
      ...(request.blockSettings.intersectionOverrides ?? []).flatMap(
        (o) => o.rule.sizes
      ),
    ]);
    const ratioTotal = ratios.reduce((a, b) => a + b, 0);
    const blocks = new Map<
      string,
      { size: number | null; count: number; arms: number[]; first: number }
    >();
    rows.forEach((row, index) => {
      const key = JSON.stringify([row.siteId, row.stratumKey, row.blockIndex]);
      let block = blocks.get(key);
      if (!block) {
        block = {
          size: row.blockSize,
          count: 0,
          arms: ratios.map(() => 0),
          first: index,
        };
        blocks.set(key, block);
        if (row.blockSize === null || !allowed.has(row.blockSize)) {
          findings.add(
            "BLOCK_SIZE_NOT_ALLOWED",
            `Row ${index + 1} opens a block of a size the plan doesn't allow.`,
            index
          );
        }
      }
      block.count += 1;
      const arm = arms.get(row.armId);
      if (arm) block.arms[arm.index] += 1;
    });
    for (const block of blocks.values()) {
      if (block.size === null) continue;
      if (block.count > block.size) {
        findings.add(
          "BLOCK_OVERFILLED",
          `The block opened at row ${block.first + 1} holds more rows than its size.`,
          block.first
        );
      } else if (
        armsAuthoritative &&
        block.count === block.size &&
        ratioTotal > 0
      ) {
        const per = block.size / ratioTotal;
        if (ratios.some((ratio, i) => block.arms[i] !== ratio * per)) {
          findings.add(
            "BLOCK_RATIO_BROKEN",
            `The complete block opened at row ${block.first + 1} doesn't hold its arms in the planned ratio.`,
            block.first
          );
        }
      }
    }
  }

  if (request.caps.strategy === "manual") {
    const perSite = request.caps.capScope === "per-site";
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = perSite
        ? JSON.stringify([row.siteId, row.stratumKey])
        : row.stratumKey;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const cap of request.caps.intersectionCaps) {
      const scoped =
        cap.siteId !== undefined
          ? [JSON.stringify([cap.siteId, cap.stratumKey])]
          : perSite
            ? request.sites.map((s) => JSON.stringify([s.id, cap.stratumKey]))
            : [cap.stratumKey];
      for (const key of scoped) {
        const count =
          cap.siteId !== undefined && !perSite
            ? rows.filter(
                (r) =>
                  r.siteId === cap.siteId && r.stratumKey === cap.stratumKey
              ).length
            : (counts.get(key) ?? 0);
        if (count > cap.cap) {
          findings.add(
            "CAP_EXCEEDED",
            `A stratum holds ${count} rows, above its cap of ${cap.cap}.`
          );
        }
      }
    }
  }
  return findings;
}

function checkProvenance(
  artifact: Record<string, unknown>,
  request: RandomizationRequest,
  ratios: readonly number[]
): Findings {
  const findings = new Findings();
  const provenance = isRecord(artifact.provenance) ? artifact.provenance : {};
  if (provenance.algorithmId !== request.algorithmId) {
    findings.add(
      "ALGORITHM_MISMATCH",
      "The provenance names a different engine than the request."
    );
  }
  if (!sameValue(provenance.study, request.provenance)) {
    findings.add(
      "STUDY_MISMATCH",
      "The provenance names a different study revision than the request."
    );
  }
  if (
    provenance.contractVersion !== request.contractVersion ||
    provenance.planSchemaVersion !== request.planSchemaVersion
  ) {
    findings.add(
      "VERSION_MISMATCH",
      "The provenance and the request disagree on versions."
    );
  }
  const generatedAt = provenance.generatedAtIso;
  if (
    typeof generatedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(generatedAt) ||
    Number.isNaN(Date.parse(generatedAt))
  ) {
    findings.add(
      "GENERATED_AT_INVALID",
      "The generation time is not a UTC ISO timestamp."
    );
  }
  const digest = isRecord(artifact.digest) ? artifact.digest : {};
  if (
    digest.algorithm !== "SHA-256" ||
    digest.canonicalPayloadVersion !== RANDOMIZATION_ARTIFACT_SCHEMA_VERSION ||
    typeof digest.hex !== "string" ||
    !/^[0-9a-f]{64}$/.test(digest.hex)
  ) {
    findings.add(
      "DIGEST_METADATA_INVALID",
      "The digest is not a SHA-256 value on the supported canonical payload."
    );
  }
  const reduced = reduceAllocationRatios(request.arms);
  if (!reduced.ok || !sameValue(reduced.ratios, ratios)) {
    findings.add(
      "REDUCED_RATIO_MISMATCH",
      "The recorded reduced ratio doesn't match the arms' ratios."
    );
  }
  return findings;
}

function compareRows(
  expected: readonly AllocationRow[],
  actual: readonly AllocationRow[]
) {
  const diffs: VerificationRowDiff[] = [];
  let diffCount = 0;
  const push = (diff: VerificationRowDiff) => {
    diffCount += 1;
    if (diffs.length < MAX_VERIFICATION_DIFFS) diffs.push(diff);
  };
  const shared = Math.min(expected.length, actual.length);
  for (let index = 0; index < shared; index += 1) {
    const e = expected[index];
    const a = actual[index];
    for (const field of ROW_FIELDS) {
      if (!sameValue(e[field], a[field])) {
        push({
          index,
          category: "field",
          field,
          expected: clip(e[field]),
          actual: clip(a[field]),
        });
      }
    }
  }
  for (let index = shared; index < expected.length; index += 1) {
    push({
      index,
      category: "missing-row",
      expected: clip(expected[index].subjectId),
      actual: "",
    });
  }
  for (let index = shared; index < actual.length; index += 1) {
    push({
      index,
      category: "extra-row",
      expected: "",
      actual: clip(actual[index].subjectId),
    });
  }
  return { diffs, diffCount };
}

/**
 * Verifies the text of a randomization artifact file. It never throws: an
 * unreadable or unsupported file comes back `rejected` with a stable code,
 * and nothing from the file is logged.
 */
export function verifyArtifact(
  text: string,
  options: VerifyArtifactOptions = {}
): VerificationReport {
  const limits = options.limits ?? RANDOMIZATION_RESOURCE_LIMITS;
  if (typeof text !== "string") return reject("NOT_AN_ARTIFACT");
  // Cheap bounds first: the character count bounds the byte count from below.
  if (
    text.length > limits.maxImportBytes ||
    utf8Length(text) > limits.maxImportBytes
  ) {
    return reject("FILE_TOO_LARGE");
  }
  if (
    nestingDepth(text, limits.maxImportNestingDepth) >
    limits.maxImportNestingDepth
  ) {
    return reject("NESTING_TOO_DEEP");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return reject("INVALID_JSON");
  }
  if (!isRecord(parsed)) return reject("NOT_AN_ARTIFACT");
  for (const field of [
    "provenance",
    "request",
    "reducedRatios",
    "rows",
    "digest",
  ]) {
    if (!(field in parsed)) return reject("MISSING_FIELD");
  }
  const {
    provenance,
    request: rawRequest,
    reducedRatios,
    rows: rawRows,
    digest,
  } = parsed;
  if (
    !isRecord(provenance) ||
    !isRecord(rawRequest) ||
    !isRecord(digest) ||
    !Array.isArray(reducedRatios) ||
    !Array.isArray(rawRows)
  ) {
    return reject("NOT_AN_ARTIFACT");
  }
  if (
    provenance.artifactSchemaVersion !==
      RANDOMIZATION_ARTIFACT_SCHEMA_VERSION ||
    provenance.contractVersion !== RANDOMIZATION_CONTRACT_VERSION ||
    provenance.planSchemaVersion !== RANDOMIZATION_PLAN_SCHEMA_VERSION ||
    rawRequest.contractVersion !== RANDOMIZATION_CONTRACT_VERSION ||
    rawRequest.planSchemaVersion !== RANDOMIZATION_PLAN_SCHEMA_VERSION ||
    digest.canonicalPayloadVersion !== RANDOMIZATION_ARTIFACT_SCHEMA_VERSION ||
    digest.algorithm !== "SHA-256"
  ) {
    return reject("UNSUPPORTED_VERSION");
  }
  if (
    rawRequest.algorithmId !== MT19937_BLOCK_ALGORITHM_ID &&
    rawRequest.algorithmId !== MT19937_MINIMIZATION_ALGORITHM_ID
  ) {
    return reject("UNSUPPORTED_ALGORITHM");
  }
  if (rawRows.length > limits.maxRows) return reject("TOO_MANY_ROWS");
  if (
    !reducedRatios.every(
      (r) => typeof r === "number" && Number.isSafeInteger(r) && r > 0
    )
  ) {
    return reject("NOT_AN_ARTIFACT");
  }
  if (!checkRowShape(rawRows)) return reject("MISSING_FIELD");
  // Full plan validation also runs the resource preflight, so an oversized
  // design is refused here, before any schedule is expanded.
  const validation = validateRandomizationPlan(rawRequest, limits);
  if (!validation.ok) return reject("INVALID_REQUEST");
  const request = rawRequest as unknown as RandomizationRequest;
  const rows = rawRows;
  const ratios = reducedRatios as number[];

  const evidence = assessVerificationEvidence(parsed.disclosure);
  const authoritative = evidence.status === "sufficient";

  // 2. Integrity, independent of regeneration.
  let computed: string | null = null;
  try {
    computed = computeContentDigest({
      request,
      reducedRatios: ratios,
      rows,
    }).hex;
  } catch {
    computed = null;
  }
  const recorded = typeof digest.hex === "string" ? digest.hex : null;
  // A masked file's rows are not the rows the digest was computed over, so
  // a mismatch there says nothing about tampering; the check doesn't run.
  const digestResult = {
    status: (!authoritative
      ? "not-run"
      : computed !== null && computed === recorded
        ? "pass"
        : "fail") as VerificationCheckStatus,
    recorded,
    computed,
  };

  // 5. Provenance consistency.
  const provenanceResult = checkProvenance(parsed, request, ratios).result();

  // 4. Invariants. Arm checks need authoritative assignments.
  const invariantResult = checkInvariants(
    request,
    ratios,
    rows,
    authoritative
  ).result();

  // 3. Regeneration: only meaningful when the file carries real assignments.
  let regeneration: VerificationReport["regeneration"] = NOT_RUN.regeneration;
  if (authoritative) {
    const generated =
      request.method === "BLOCK"
        ? generateBlockSchedule(request, limits)
        : generateMinimizationSchedule(request, limits);
    if (!generated.ok) {
      regeneration = {
        status: "fail",
        expectedRows: null,
        actualRows: rows.length,
        diffCount: 0,
        diffs: [],
      };
    } else {
      const compared = compareRows(generated.rows, rows);
      regeneration = {
        status: compared.diffCount === 0 ? "pass" : "fail",
        expectedRows: generated.rows.length,
        actualRows: rows.length,
        ...compared,
      };
    }
  }

  const checks = [
    digestResult.status,
    provenanceResult.status,
    invariantResult.status,
    regeneration.status,
  ];
  const outcome: VerificationOutcome = checks.includes("fail")
    ? "failed"
    : authoritative
      ? "verified"
      : "insufficient-evidence";

  return {
    reportVersion: VERIFICATION_REPORT_VERSION,
    outcome,
    rejection: null,
    evidence,
    rowCount: rows.length,
    method: request.method,
    algorithmId: request.algorithmId,
    digest: digestResult,
    regeneration,
    invariants: invariantResult,
    provenance: provenanceResult,
  };
}
