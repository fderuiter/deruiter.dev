/**
 * Runs randomization commands for one worker or one main-thread fallback
 * (#4004). It owns the immutable result of the latest completed generation
 * and answers bounded page requests from it. The worker and the fallback
 * share this host, so both produce the same rows and digests.
 *
 * Generation runs in phases (validate, generate, hash) with a yield between
 * them. A cancel command, or a newer generate, marks the running operation
 * stale; it stops at the next yield and answers `canceled`. Work inside one
 * engine phase cannot be interrupted, so the fallback refuses plans above
 * its row budget instead.
 *
 * This module never imports the client that constructs the worker
 * (chunk cycle guard, #853).
 */
import {
  RANDOMIZATION_RESOURCE_LIMITS,
  computeContentDigest,
  computePlanDigest,
  generateBlockSchedule,
  generateMinimizationSchedule,
  toSafeRandomizationErrorReport,
  validateRandomizationPlan,
  type AllocationRow,
  type RandomizationRequest,
  type RandomizationResourceLimits,
  type ValidationFinding,
} from "@/lib/randomization";
import {
  RANDOMIZATION_PROTOCOL_VERSION,
  parseRandomizationCommand,
  sameOperation,
  type RandomizationCommand,
  type RandomizationGenerationSummary,
  type RandomizationOperationErrorCode,
  type RandomizationOperationIdentity,
  type RandomizationResponse,
} from "./protocol";

/** Options for a host. */
interface RandomizationHostOptions {
  /** Engine limits. Defaults to the published resource limits. */
  readonly limits?: RandomizationResourceLimits;
  /**
   * Most rows this host may generate. Set for the main-thread fallback; a
   * larger plan fails with `FALLBACK_BUDGET_EXCEEDED`.
   */
  readonly rowBudget?: number;
  /** Yields between phases. Defaults to a zero-delay timer. */
  readonly yieldControl?: () => Promise<void>;
}

/** A host that receives commands and posts responses. */
interface RandomizationHost {
  receive(data: unknown): void;
  /** Drops the held result and stops any running operation. */
  dispose(): void;
}

type GenerateCommand = Extract<RandomizationCommand, { kind: "generate" }>;
type PageCommand = Extract<RandomizationCommand, { kind: "page" }>;

class Stale extends Error {}

class OperationFailure extends Error {
  constructor(
    readonly code: RandomizationOperationErrorCode,
    readonly findings?: readonly ValidationFinding[]
  ) {
    super(code);
  }
}

interface HeldResult {
  readonly identity: RandomizationOperationIdentity;
  readonly rows: readonly AllocationRow[];
}

const defaultYield = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

function findingCode(
  findings: readonly ValidationFinding[]
): RandomizationOperationErrorCode {
  const errors = findings.filter((f) => f.severity === "error");
  if (errors.some((f) => f.code === "RESOURCE_LIMIT_EXCEEDED")) {
    return "RESOURCE_LIMIT_EXCEEDED";
  }
  return errors[0]?.code ?? findings[0]?.code ?? "INVALID_PLAN_SHAPE";
}

function summarize(
  request: RandomizationRequest,
  reducedRatios: readonly number[],
  rows: readonly AllocationRow[],
  contentDigest: string,
  extra: {
    readonly shortfall: number;
    readonly stopReason?: string;
    readonly partialBlockCount?: number;
  }
): RandomizationGenerationSummary {
  const counts = new Map(request.arms.map((a) => [a.id, 0]));
  for (const row of rows) {
    counts.set(row.armId, (counts.get(row.armId) ?? 0) + 1);
  }
  return {
    method: request.method,
    rowCount: rows.length,
    requestedRows: request.enrollmentTarget,
    shortfall: extra.shortfall,
    reducedRatios: [...reducedRatios],
    armCounts: request.arms.map((a) => ({
      armId: a.id,
      count: counts.get(a.id) ?? 0,
    })),
    contentDigest,
    ...(extra.stopReason !== undefined ? { stopReason: extra.stopReason } : {}),
    ...(extra.partialBlockCount !== undefined
      ? { partialBlockCount: extra.partialBlockCount }
      : {}),
  };
}

/**
 * Creates a host. `post` delivers each response; the worker passes its own
 * `postMessage`, the fallback passes the client's receiver.
 */
export function createRandomizationHost(
  post: (response: RandomizationResponse) => void,
  options: RandomizationHostOptions = {}
): RandomizationHost {
  const limits = options.limits ?? RANDOMIZATION_RESOURCE_LIMITS;
  const budget = options.rowBudget;
  const engineLimits: RandomizationResourceLimits =
    budget !== undefined && budget < limits.maxRows
      ? { ...limits, maxRows: budget }
      : limits;
  const pause = options.yieldControl ?? defaultYield;
  let active: number | null = null;
  let held: HeldResult | null = null;
  let disposed = false;

  const send = (response: RandomizationResponse) => {
    if (!disposed) post(response);
  };

  const generate = async (command: GenerateCommand) => {
    const { identity, requestId } = command;
    const operationId = identity.operationId;
    // A newer generation supersedes the older one and releases its rows.
    active = operationId;
    held = null;
    const checkpoint = async () => {
      await pause();
      if (disposed || active !== operationId) throw new Stale();
    };
    try {
      send({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "progress",
        requestId,
        identity,
        phase: "validating",
      });
      let digest: string;
      try {
        digest = computePlanDigest(command.plan);
      } catch {
        throw new OperationFailure("PLAN_NOT_SERIALIZABLE");
      }
      if (digest !== identity.planDigest) {
        throw new OperationFailure("PLAN_DIGEST_MISMATCH");
      }
      const validation = validateRandomizationPlan(command.plan, limits);
      if (!validation.ok) {
        throw new OperationFailure(
          findingCode(validation.findings),
          validation.findings
        );
      }
      const request = command.plan as RandomizationRequest;

      await checkpoint();
      send({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "progress",
        requestId,
        identity,
        phase: "generating",
      });
      const generated =
        request.method === "BLOCK"
          ? generateBlockSchedule(request, engineLimits)
          : generateMinimizationSchedule(request, engineLimits);
      if (!generated.ok) {
        const code = findingCode(generated.findings);
        throw new OperationFailure(
          code === "RESOURCE_LIMIT_EXCEEDED" && engineLimits !== limits
            ? "FALLBACK_BUDGET_EXCEEDED"
            : code,
          generated.findings
        );
      }
      const extra =
        "summary" in generated
          ? {
              shortfall: generated.summary.shortfall,
              stopReason: generated.summary.stopReason,
            }
          : {
              shortfall: generated.marginal?.shortfall ?? 0,
              ...(generated.marginal
                ? { stopReason: generated.marginal.stopReason }
                : {}),
              partialBlockCount: generated.partialBlocks.length,
            };

      await checkpoint();
      send({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "progress",
        requestId,
        identity,
        phase: "hashing",
      });
      const contentDigest = computeContentDigest({
        request,
        reducedRatios: generated.reducedRatios,
        rows: generated.rows,
      }).hex;

      await checkpoint();
      held = { identity, rows: generated.rows };
      active = null;
      send({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "complete",
        requestId,
        identity,
        summary: summarize(
          request,
          generated.reducedRatios,
          generated.rows,
          contentDigest,
          extra
        ),
      });
    } catch (error) {
      if (error instanceof Stale) {
        send({
          protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
          kind: "canceled",
          requestId,
          identity,
        });
        return;
      }
      if (active === operationId) active = null;
      send({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "failed",
        requestId,
        identity,
        ...(error instanceof OperationFailure
          ? {
              code: error.code,
              ...(error.findings ? { findings: error.findings } : {}),
            }
          : { code: toSafeRandomizationErrorReport(error).code }),
      });
    }
  };

  const page = (command: PageCommand) => {
    const { identity, requestId } = command;
    const fail = (code: RandomizationOperationErrorCode) =>
      send({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "failed",
        requestId,
        identity,
        code,
      });
    if (!held || !sameOperation(held.identity, identity)) {
      fail("RESULT_RELEASED");
      return;
    }
    const total = held.rows.length;
    if (command.offset > total) {
      fail("PAGE_OUT_OF_RANGE");
      return;
    }
    send({
      protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
      kind: "page",
      requestId,
      identity,
      page: {
        offset: command.offset,
        totalRows: total,
        rows: held.rows.slice(command.offset, command.offset + command.limit),
      },
    });
  };

  return {
    receive(data) {
      if (disposed) return;
      const command = parseRandomizationCommand(data);
      if (!command) {
        const requestId =
          typeof data === "object" &&
          data !== null &&
          Number.isSafeInteger((data as { requestId?: unknown }).requestId)
            ? (data as { requestId: number }).requestId
            : 0;
        send({
          protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
          kind: "failed",
          requestId: requestId >= 0 ? requestId : 0,
          identity: null,
          code: "PROTOCOL_VIOLATION",
        });
        return;
      }
      if (command.kind === "generate") {
        void generate(command);
      } else if (command.kind === "page") {
        page(command);
      } else if (active === command.operationId) {
        active = null;
      }
    },
    dispose() {
      disposed = true;
      active = null;
      held = null;
    },
  };
}
