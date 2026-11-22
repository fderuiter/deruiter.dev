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
import type {
  AllocationRow,
  RandomizationRequest,
  RandomizationSafeErrorCode,
  ValidationFinding,
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

/** Phases reported while a generation runs. */
export type RandomizationProgressPhase =
  "validating" | "generating" | "hashing";

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
      readonly kind: "page";
      readonly requestId: number;
      readonly identity: RandomizationOperationIdentity;
      readonly page: RandomizationRowPage;
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
    case "page":
      return isOperationIdentity(value.identity) &&
        isCount(value.offset) &&
        isCount(value.limit) &&
        value.limit > 0 &&
        value.limit <= MAX_RANDOMIZATION_PAGE_ROWS
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
          value.phase === "hashing")
        ? (value as RandomizationResponse)
        : null;
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
