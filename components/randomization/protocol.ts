/**
 * Messages between the randomization client and its worker or main-thread
 * fallback (#4004, RND-EXECU-001 to RND-EXECU-007).
 *
 * The worker keeps the generated rows. The page receives a small summary
 * and asks for rows in bounded pages, so a 100,000-row schedule is never
 * cloned across the boundary on every interaction. Every command and answer
 * carries the operation identity (operation id, session id, plan digest and
 * workspace revision); the client publishes an answer only while that
 * identity is still the active one.
 */
import {
  MAX_RESULT_FILTER_LENGTH,
  RANDOMIZATION_RESOURCE_LIMITS,
} from "@/lib/randomization";
import type {
  AllocationBlockGroupPage,
  AllocationQuery,
  AllocationQueryPage,
  AllocationRow,
  AllocationSummaryProjection,
  RandomizationRequest,
  RandomizationSafeErrorCode,
  SimulationReport,
  ValidationFinding,
  VerificationReport,
} from "@/lib/randomization";

/** Version of this message protocol. A mismatch is a protocol violation. */
export const RANDOMIZATION_PROTOCOL_VERSION = 1 as const;

/** Most rows one page may carry. */
export const MAX_RANDOMIZATION_PAGE_ROWS = 500;

/**
 * Most rows the main-thread fallback generates. Work beyond it would block
 * the page, so the fallback refuses it with `FALLBACK_BUDGET_EXCEEDED`.
 */
export const MAIN_THREAD_ROW_BUDGET = 20_000;

/** Codes the client and its worker add to the engine's safe codes. */
type RandomizationExecutionErrorCode =
  | "PLAN_NOT_SERIALIZABLE"
  | "PLAN_DIGEST_MISMATCH"
  | "FALLBACK_BUDGET_EXCEEDED"
  | "WORKER_FAILED"
  | "WORKER_MESSAGE_FAILED"
  | "POST_MESSAGE_FAILED"
  | "PROTOCOL_VIOLATION"
  | "RESULT_RELEASED"
  | "PAGE_OUT_OF_RANGE"
  | "NO_COMPLETED_RESULT";

/** Every code a failed operation can carry. None holds study content. */
export type RandomizationOperationErrorCode =
  RandomizationSafeErrorCode | RandomizationExecutionErrorCode;

/** Identity that binds an answer to the request that asked for it. */
export interface RandomizationOperationIdentity {
  readonly operationId: number;
  /** The worker or fallback instance; a replaced one never publishes. */
  readonly sessionId: string;
  readonly planDigest: string;
  readonly workspaceRevision: number;
}

/** Phases reported while a generation or simulation runs. */
export type RandomizationProgressPhase =
  "validating" | "generating" | "hashing" | "simulating";

/** Counts and identity of a completed schedule. Rows come by page. */
export interface RandomizationGenerationSummary {
  readonly method: RandomizationRequest["method"];
  readonly rowCount: number;
  readonly requestedRows: number;
  readonly shortfall: number;
  readonly reducedRatios: readonly number[];
  /** Rows per arm, in the plan's arm order. */
  readonly armCounts: readonly {
    readonly armId: string;
    readonly count: number;
  }[];
  /** SHA-256 numerical content digest over request, ratios and rows. */
  readonly contentDigest: string;
  /** Present when the engine reported one. */
  readonly stopReason?: string;
  readonly partialBlockCount?: number;
}

/** One bounded window of a completed schedule. */
export interface RandomizationRowPage {
  readonly offset: number;
  readonly totalRows: number;
  readonly rows: readonly AllocationRow[];
}

/**
 * A read-only projection of the completed schedule (#4008). The host
 * applies the query to the rows it holds and answers with one bounded
 * page, so filtering and sorting never move the whole schedule.
 */
export type RandomizationViewRequest =
  | {
      readonly kind: "rows" | "blocks";
      readonly query: AllocationQuery;
      readonly offset: number;
      readonly limit: number;
      readonly maskTreatment: boolean;
    }
  | {
      readonly kind: "summary";
      readonly query: AllocationQuery;
      readonly maskTreatment: boolean;
    };

/** The answer to a {@link RandomizationViewRequest}. */
export type RandomizationViewResult =
  | { readonly kind: "rows"; readonly page: AllocationQueryPage }
  | { readonly kind: "blocks"; readonly page: AllocationBlockGroupPage }
  | { readonly kind: "summary"; readonly summary: AllocationSummaryProjection };

/** Commands sent to the worker or fallback host. */
export type RandomizationCommand =
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "generate";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
      readonly plan: unknown;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "page";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
      readonly offset: number;
      readonly limit: number;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      /** Reads a filtered, sorted or aggregated view (#4008). */
      readonly kind: "view";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
      readonly view: RandomizationViewRequest;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      /**
       * Verifies the text of a local artifact file (#4009). It holds no
       * operation identity: it never touches a held schedule, and the
       * client drops answers to a replaced verification.
       */
      readonly kind: "verify";
      readonly requestId: number;
      readonly text: string;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      /** Runs a Monte Carlo simulation request (#4007). */
      readonly kind: "simulate";
      readonly requestId: number;
      /** Its plan digest covers the whole simulation request. */
      readonly identity: RandomizationOperationIdentity;
      readonly request: unknown;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "cancel";
      readonly requestId: number;
      readonly operationId: number;
    };

/** Answers from the worker or fallback host. */
export type RandomizationResponse =
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "progress";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
      readonly phase: RandomizationProgressPhase;
      /** Repetitions finished so far, while simulating. */
      readonly completed?: number;
      readonly total?: number;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "complete";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
      readonly summary: RandomizationGenerationSummary;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "simulation-complete";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
      readonly report: SimulationReport;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "page";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
      readonly page: RandomizationRowPage;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "view";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
      readonly result: RandomizationViewResult;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "verified";
      readonly requestId: number;
      readonly report: VerificationReport;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "verify-failed";
      readonly requestId: number;
      readonly code: RandomizationOperationErrorCode;
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "failed";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity | null;
      readonly code: RandomizationOperationErrorCode;
      /** Validation findings, when the plan was refused. Stay in the browser. */
      readonly findings?: readonly ValidationFinding[];
    }
  | {
      readonly protocolVersion: typeof RANDOMIZATION_PROTOCOL_VERSION;
      readonly kind: "canceled";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** True for a well-formed operation identity. */
function isOperationIdentity(
  value: unknown
): value is RandomizationOperationIdentity {
  return (
    isRecord(value) &&
    isCount(value.operationId) &&
    typeof value.sessionId === "string" &&
    value.sessionId.length > 0 &&
    value.sessionId.length <= 64 &&
    typeof value.planDigest === "string" &&
    /^[0-9a-f]{64}$/.test(value.planDigest) &&
    isCount(value.workspaceRevision)
  );
}

const SORT_DIRECTIONS = new Set(["ascending", "descending"]);
const FIXED_SORT_COLUMNS = new Set([
  "sequence",
  "subjectId",
  "site",
  "block",
  "treatment",
]);
const FIXED_DIMENSIONS = new Set(["site", "treatment", "stratum"]);

function isShortText(value: unknown, max = MAX_RESULT_FILTER_LENGTH): boolean {
  return typeof value === "string" && value.length <= max;
}

function isFactorName(value: string): boolean {
  return value.startsWith("factor:") && value.length > 7 && value.length <= 72;
}

/** True for a bounded, well-formed query. */
function isAllocationQuery(value: unknown): value is AllocationQuery {
  if (!isRecord(value)) return false;
  const { sort, filters, category } = value;
  if (sort !== undefined && sort !== null) {
    if (
      !isRecord(sort) ||
      typeof sort.column !== "string" ||
      !(FIXED_SORT_COLUMNS.has(sort.column) || isFactorName(sort.column)) ||
      !SORT_DIRECTIONS.has(sort.direction as string)
    ) {
      return false;
    }
  }
  if (filters !== undefined) {
    if (!isRecord(filters)) return false;
    for (const key of ["subjectId", "site", "treatment"] as const) {
      if (filters[key] !== undefined && !isShortText(filters[key]))
        return false;
    }
    if (filters.factors !== undefined) {
      if (!isRecord(filters.factors)) return false;
      const entries = Object.entries(filters.factors);
      if (entries.length > 64) return false;
      if (!entries.every(([k, v]) => isShortText(k, 64) && isShortText(v))) {
        return false;
      }
    }
  }
  if (category !== undefined && category !== null) {
    if (
      !isRecord(category) ||
      typeof category.dimension !== "string" ||
      !(
        FIXED_DIMENSIONS.has(category.dimension) ||
        isFactorName(category.dimension)
      ) ||
      !isShortText(category.key, 4096)
    ) {
      return false;
    }
  }
  return true;
}

function isViewRequest(value: unknown): value is RandomizationViewRequest {
  if (
    !isRecord(value) ||
    typeof value.maskTreatment !== "boolean" ||
    !isAllocationQuery(value.query)
  ) {
    return false;
  }
  if (value.kind === "summary") return true;
  return (
    (value.kind === "rows" || value.kind === "blocks") &&
    isCount(value.offset) &&
    isCount(value.limit) &&
    value.limit > 0 &&
    value.limit <= MAX_RANDOMIZATION_PAGE_ROWS
  );
}

/** Two identities name the same operation of the same session and plan. */
export function sameOperation(
  a: RandomizationOperationIdentity,
  b: RandomizationOperationIdentity
): boolean {
  return (
    a.operationId === b.operationId &&
    a.sessionId === b.sessionId &&
    a.planDigest === b.planDigest &&
    a.workspaceRevision === b.workspaceRevision
  );
}

/** Validates a command envelope before the host acts on it. */
export function parseRandomizationCommand(
  value: unknown
): RandomizationCommand | null {
  if (
    !isRecord(value) ||
    value.protocolVersion !== RANDOMIZATION_PROTOCOL_VERSION ||
    !isCount(value.requestId)
  ) {
    return null;
  }
  switch (value.kind) {
    case "generate":
      return isOperationIdentity(value.identity) && "plan" in value
        ? (value as RandomizationCommand)
        : null;
    case "simulate":
      return isOperationIdentity(value.identity) && "request" in value
        ? (value as RandomizationCommand)
        : null;
    case "page":
      return isOperationIdentity(value.identity) &&
        isCount(value.offset) &&
        isCount(value.limit) &&
        value.limit > 0 &&
        value.limit <= MAX_RANDOMIZATION_PAGE_ROWS
        ? (value as RandomizationCommand)
        : null;
    case "view":
      return isOperationIdentity(value.identity) && isViewRequest(value.view)
        ? (value as RandomizationCommand)
        : null;
    case "verify":
      return typeof value.text === "string" &&
        value.text.length <= RANDOMIZATION_RESOURCE_LIMITS.maxImportBytes
        ? (value as RandomizationCommand)
        : null;
    case "cancel":
      return isCount(value.operationId)
        ? (value as RandomizationCommand)
        : null;
    default:
      return null;
  }
}

/** Validates a response envelope before the client trusts it. */
export function parseRandomizationResponse(
  value: unknown
): RandomizationResponse | null {
  if (
    !isRecord(value) ||
    value.protocolVersion !== RANDOMIZATION_PROTOCOL_VERSION ||
    !isCount(value.requestId)
  ) {
    return null;
  }
  switch (value.kind) {
    case "progress":
      return isOperationIdentity(value.identity) &&
        (value.phase === "validating" ||
          value.phase === "generating" ||
          value.phase === "hashing" ||
          value.phase === "simulating") &&
        (value.completed === undefined || isCount(value.completed)) &&
        (value.total === undefined || isCount(value.total))
        ? (value as RandomizationResponse)
        : null;
    case "simulation-complete": {
      const report = value.report;
      return isOperationIdentity(value.identity) &&
        isRecord(report) &&
        isCount(report.attempted) &&
        isCount(report.succeeded) &&
        Array.isArray(report.arms)
        ? (value as RandomizationResponse)
        : null;
    }
    case "complete": {
      const summary = value.summary;
      return isOperationIdentity(value.identity) &&
        isRecord(summary) &&
        isCount(summary.rowCount) &&
        typeof summary.contentDigest === "string" &&
        Array.isArray(summary.armCounts)
        ? (value as RandomizationResponse)
        : null;
    }
    case "page": {
      const page = value.page;
      return isOperationIdentity(value.identity) &&
        isRecord(page) &&
        isCount(page.offset) &&
        isCount(page.totalRows) &&
        Array.isArray(page.rows) &&
        page.rows.length <= MAX_RANDOMIZATION_PAGE_ROWS
        ? (value as RandomizationResponse)
        : null;
    }
    case "view": {
      const result = value.result;
      if (!isOperationIdentity(value.identity) || !isRecord(result)) {
        return null;
      }
      const ok =
        result.kind === "summary"
          ? isRecord(result.summary) &&
            Array.isArray(result.summary.categories) &&
            isRecord(result.summary.balance)
          : (result.kind === "rows" &&
              isRecord(result.page) &&
              Array.isArray(result.page.rows) &&
              result.page.rows.length <= MAX_RANDOMIZATION_PAGE_ROWS) ||
            (result.kind === "blocks" &&
              isRecord(result.page) &&
              Array.isArray(result.page.groups) &&
              result.page.groups.length <= MAX_RANDOMIZATION_PAGE_ROWS);
      return ok ? (value as RandomizationResponse) : null;
    }
    case "verified":
      return isRecord(value.report) &&
        typeof value.report.outcome === "string" &&
        isRecord(value.report.regeneration)
        ? (value as RandomizationResponse)
        : null;
    case "verify-failed":
      return typeof value.code === "string" &&
        /^[A-Z][A-Z0-9_]{2,63}$/.test(value.code)
        ? (value as RandomizationResponse)
        : null;
    case "failed":
      return (value.identity === null || isOperationIdentity(value.identity)) &&
        typeof value.code === "string" &&
        /^[A-Z][A-Z0-9_]{2,63}$/.test(value.code)
        ? (value as RandomizationResponse)
        : null;
    case "canceled":
      return isOperationIdentity(value.identity)
        ? (value as RandomizationResponse)
        : null;
    default:
      return null;
  }
}
