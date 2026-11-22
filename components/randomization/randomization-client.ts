/**
 * Connects the randomization work area to the engine (#4004,
 * RND-EXECU-001 to RND-EXECU-007, RND-PLATF-001). In a browser generation
 * runs in a dedicated Web Worker, created on the first request. Where a
 * worker cannot be constructed, or fails before it answers once (a CSP or
 * script-load failure), the same host runs on the main thread from a lazily
 * loaded module, with a smaller row budget.
 *
 * One operation is active at a time. Each answer carries the operation id,
 * the worker or fallback session id, the plan digest and the workspace
 * revision; the client publishes it only while all four still match the
 * active operation, so a late answer for a replaced plan is dropped.
 * Starting a generation, cancelling, or disposing settles the previous
 * operation at once. A running worker is terminated; the fallback is told
 * to stop at its next phase boundary and its answer is dropped.
 *
 * This client owns its worker. It never shares one with the study-data
 * pipeline, so cancelling here never stops a pipeline run. Monte Carlo QA
 * (#4007) uses `simulate` on its own client instance, so a simulation and a
 * generation never cancel each other.
 */
import {
  computePlanDigest,
  type SimulationReport,
  type ValidationFinding,
} from "@/lib/randomization";
import { clamp } from "@/lib/utils";
import {
  MAIN_THREAD_ROW_BUDGET,
  MAX_RANDOMIZATION_PAGE_ROWS,
  RANDOMIZATION_PROTOCOL_VERSION,
  parseRandomizationResponse,
  sameOperation,
  type RandomizationCommand,
  type RandomizationGenerationSummary,
  type RandomizationOperationErrorCode,
  type RandomizationOperationIdentity,
  type RandomizationProgressPhase,
  type RandomizationRowPage,
} from "./protocol";

/** Status of the client's current operation. */
type RandomizationRunStatus =
  "ready" | "running" | "complete" | "failed" | "canceled";

/** Where generation runs. */
type RandomizationExecutionMode = "worker" | "main-thread" | "idle";

/** Snapshot of the client, replaced on every change. */
interface RandomizationClientState {
  readonly status: RandomizationRunStatus;
  readonly mode: RandomizationExecutionMode;
  readonly identity: RandomizationOperationIdentity | null;
  readonly phase: RandomizationProgressPhase | null;
  readonly summary: RandomizationGenerationSummary | null;
  /** The report of a completed simulation. */
  readonly report: SimulationReport | null;
  /** Repetitions finished, while a simulation runs. */
  readonly progress: {
    readonly completed: number;
    readonly total: number;
  } | null;
  readonly errorCode: RandomizationOperationErrorCode | null;
  readonly findings: readonly ValidationFinding[];
}

/** How an operation ended without a result. */
type UnfinishedOutcome =
  | {
      readonly status: "failed";
      readonly identity: RandomizationOperationIdentity | null;
      readonly code: RandomizationOperationErrorCode;
      readonly findings: readonly ValidationFinding[];
    }
  | {
      readonly status: "canceled";
      readonly identity: RandomizationOperationIdentity | null;
      readonly reason: "canceled" | "superseded" | "disposed";
    };

/** How a generation ended. A generation never rejects. */
type RandomizationOutcome =
  | {
      readonly status: "complete";
      readonly identity: RandomizationOperationIdentity;
      readonly summary: RandomizationGenerationSummary;
    }
  | UnfinishedOutcome;

/** How a simulation ended. A simulation never rejects. */
type SimulationOutcome =
  | {
      readonly status: "complete";
      readonly identity: RandomizationOperationIdentity;
      readonly report: SimulationReport;
    }
  | UnfinishedOutcome;

type AnyOutcome = RandomizationOutcome | SimulationOutcome;

/** Raised by `page` with a safe code only. */
export class RandomizationClientError extends Error {
  readonly code: RandomizationOperationErrorCode;

  constructor(code: RandomizationOperationErrorCode) {
    super(code);
    this.name = "RandomizationClientError";
    this.code = code;
  }
}

/** Options, mainly for tests. */
interface RandomizationClientOptions {
  /** Builds the worker; return null when workers are unavailable. */
  readonly createWorker?: () => Worker | null;
  /** Row budget of the main-thread fallback. */
  readonly fallbackRowBudget?: number;
}

/** Asynchronous handle to the randomization engine. */
export interface RandomizationClient {
  /**
   * Generates a schedule for `plan` at `workspaceRevision`. Supersedes any
   * running generation and releases the previous result. Resolves with the
   * outcome; it never rejects, and the plan is never modified.
   */
  generate(input: {
    readonly plan: unknown;
    readonly workspaceRevision: number;
  }): Promise<RandomizationOutcome>;
  /**
   * Runs a Monte Carlo simulation request (#4007). Same publication rules
   * as `generate`: it supersedes a running operation and never rejects.
   */
  simulate(input: {
    readonly request: unknown;
    readonly workspaceRevision: number;
  }): Promise<SimulationOutcome>;
  /** Reads a bounded window of the completed generation. */
  page(offset: number, limit?: number): Promise<RandomizationRowPage>;
  /** Cancels the running generation, if any. */
  cancel(): void;
  /**
   * Releases the worker or fallback and settles everything pending. The
   * client stays usable, so an owner that sets up again (React Strict Mode)
   * can keep it.
   */
  dispose(): void;
  getState(): RandomizationClientState;
  /** Subscribes to state changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

interface Transport {
  readonly mode: "worker" | "main-thread";
  readonly sessionId: string;
  responded: boolean;
  send(command: RandomizationCommand): void;
  release(): void;
}

interface ActiveOperation {
  readonly kind: "generate" | "simulate";
  readonly requestId: number;
  identity: RandomizationOperationIdentity;
  /** The plan, or the whole simulation request. */
  readonly payload: unknown;
  readonly resolve: (outcome: AnyOutcome) => void;
}

interface PendingPage {
  readonly identity: RandomizationOperationIdentity;
  readonly resolve: (page: RandomizationRowPage) => void;
  readonly reject: (error: RandomizationClientError) => void;
}

const INITIAL_STATE: RandomizationClientState = Object.freeze({
  status: "ready",
  mode: "idle",
  identity: null,
  phase: null,
  summary: null,
  report: null,
  progress: null,
  errorCode: null,
  findings: Object.freeze([]) as readonly ValidationFinding[],
});

/** State fields every terminal or fresh state clears. */
const CLEARED = {
  phase: null,
  summary: null,
  report: null,
  progress: null,
  errorCode: null,
  findings: INITIAL_STATE.findings,
} as const;

function defaultCreateWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./randomization.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

/** Creates a client. Nothing loads until the first generation. */
export function createRandomizationClient(
  options: RandomizationClientOptions = {}
): RandomizationClient {
  const buildWorker = options.createWorker ?? defaultCreateWorker;
  const fallbackRowBudget = options.fallbackRowBudget ?? MAIN_THREAD_ROW_BUDGET;
  let state = INITIAL_STATE;
  const listeners = new Set<() => void>();
  let transport: Transport | null = null;
  let workerUnavailable = false;
  let sessionCounter = 0;
  let nextRequestId = 1;
  let nextOperationId = 1;
  let active: ActiveOperation | null = null;
  const pages = new Map<number, PendingPage>();

  const setState = (patch: Partial<RandomizationClientState>) => {
    state = Object.freeze({
      ...state,
      mode: transport ? transport.mode : "idle",
      ...patch,
    });
    for (const listener of [...listeners]) listener();
  };

  const rejectPages = (code: RandomizationOperationErrorCode) => {
    const waiting = [...pages.values()];
    pages.clear();
    for (const page of waiting) page.reject(new RandomizationClientError(code));
  };

  const releaseTransport = () => {
    const released = transport;
    transport = null;
    released?.release();
  };

  /** Settles the active operation and publishes its terminal state. */
  const settle = (outcome: AnyOutcome) => {
    const operation = active;
    if (!operation) return;
    active = null;
    if (outcome.status === "complete") {
      setState({
        ...CLEARED,
        status: "complete",
        identity: outcome.identity,
        ...("report" in outcome
          ? { report: outcome.report }
          : { summary: outcome.summary }),
      });
    } else if (outcome.status === "failed") {
      setState({
        ...CLEARED,
        status: "failed",
        identity: outcome.identity,
        errorCode: outcome.code,
        findings: Object.freeze([...outcome.findings]),
      });
    } else if (outcome.reason !== "superseded") {
      setState({
        ...CLEARED,
        status: outcome.reason === "disposed" ? "ready" : "canceled",
        identity: outcome.reason === "disposed" ? null : outcome.identity,
      });
    }
    operation.resolve(outcome);
  };

  const fail = (
    code: RandomizationOperationErrorCode,
    findings: readonly ValidationFinding[] = []
  ) => {
    if (!active) return;
    settle({ status: "failed", identity: active.identity, code, findings });
  };

  // Declared before the transports that deliver to it.
  const receive = (from: Transport, data: unknown) => {
    if (transport !== from) return;
    from.responded = true;
    const response = parseRandomizationResponse(data);
    if (!response) {
      const requestId = (data as { requestId?: unknown } | null)?.requestId;
      if (active && requestId === active.requestId) fail("PROTOCOL_VIOLATION");
      const page =
        typeof requestId === "number" ? pages.get(requestId) : undefined;
      if (page && typeof requestId === "number") {
        pages.delete(requestId);
        page.reject(new RandomizationClientError("PROTOCOL_VIOLATION"));
      }
      return;
    }

    const page = pages.get(response.requestId);
    if (page) {
      if (
        response.identity === null ||
        !sameOperation(response.identity, page.identity)
      ) {
        return;
      }
      pages.delete(response.requestId);
      if (response.kind === "page") page.resolve(response.page);
      else if (response.kind === "failed") {
        page.reject(new RandomizationClientError(response.code));
      } else page.reject(new RandomizationClientError("PROTOCOL_VIOLATION"));
      return;
    }

    if (!active || response.requestId !== active.requestId) return;
    if (response.identity === null) {
      if (response.kind === "failed") fail(response.code);
      return;
    }
    if (!sameOperation(response.identity, active.identity)) return;
    switch (response.kind) {
      case "progress":
        setState({
          phase: response.phase,
          ...(response.completed !== undefined && response.total !== undefined
            ? {
                progress: {
                  completed: response.completed,
                  total: response.total,
                },
              }
            : {}),
        });
        return;
      case "complete":
        if (active.kind !== "generate") fail("PROTOCOL_VIOLATION");
        else {
          settle({
            status: "complete",
            identity: active.identity,
            summary: response.summary,
          });
        }
        return;
      case "simulation-complete":
        if (active.kind !== "simulate") fail("PROTOCOL_VIOLATION");
        else {
          settle({
            status: "complete",
            identity: active.identity,
            report: response.report,
          });
        }
        return;
      case "failed":
        fail(response.code, response.findings ?? []);
        return;
      case "canceled":
        settle({
          status: "canceled",
          identity: active.identity,
          reason: "canceled",
        });
        return;
      default:
        fail("PROTOCOL_VIOLATION");
    }
  };

  const openWorker = (): Transport | null => {
    const worker = buildWorker();
    if (!worker) return null;
    const opened: Transport = {
      mode: "worker",
      sessionId: `worker-${++sessionCounter}`,
      responded: false,
      send: (command) => worker.postMessage(command),
      release: () => {
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
      },
    };
    worker.onmessage = (event: MessageEvent<unknown>) =>
      receive(opened, event.data);
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      if (transport !== opened) return;
      releaseTransport();
      if (!opened.responded) {
        // The worker never ran (CSP or script load): use the fallback.
        workerUnavailable = true;
        rejectPages("WORKER_FAILED");
        if (active) dispatch(active);
        return;
      }
      rejectPages("WORKER_FAILED");
      if (active) fail("WORKER_FAILED");
      else if (state.status === "complete") {
        setState({ status: "failed", errorCode: "WORKER_FAILED" });
      }
    };
    worker.onmessageerror = () => {
      if (transport !== opened) return;
      if (active) fail("WORKER_MESSAGE_FAILED");
    };
    return opened;
  };

  const openFallback = (): Transport => {
    let host: { receive(data: unknown): void; dispose(): void } | null = null;
    let released = false;
    const opened: Transport = {
      mode: "main-thread",
      sessionId: `main-${++sessionCounter}`,
      responded: false,
      send: (command) => {
        loading.then(
          (loaded) => {
            if (!released) loaded.receive(command);
          },
          () => {
            if (transport === opened && active) fail("WORKER_FAILED");
          }
        );
      },
      release: () => {
        released = true;
        host?.dispose();
      },
    };
    const loading = import("./randomization-session").then((module) => {
      host = module.createRandomizationHost(
        (response) => {
          // Answer asynchronously, as a worker would.
          queueMicrotask(() => receive(opened, response));
        },
        { rowBudget: fallbackRowBudget }
      );
      if (released) host.dispose();
      return host;
    });
    return opened;
  };

  const ensureTransport = (): Transport => {
    if (transport) return transport;
    transport = (!workerUnavailable && openWorker()) || openFallback();
    if (transport.mode === "main-thread") workerUnavailable = true;
    return transport;
  };

  const dispatch = (operation: ActiveOperation) => {
    const target = ensureTransport();
    operation.identity = { ...operation.identity, sessionId: target.sessionId };
    setState({ ...CLEARED, status: "running", identity: operation.identity });
    try {
      target.send(
        operation.kind === "generate"
          ? {
              protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
              kind: "generate",
              requestId: operation.requestId,
              identity: operation.identity,
              plan: operation.payload,
            }
          : {
              protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
              kind: "simulate",
              requestId: operation.requestId,
              identity: operation.identity,
              request: operation.payload,
            }
      );
    } catch {
      fail("POST_MESSAGE_FAILED");
    }
  };

  /** Stops the running generation where it runs. */
  const stopRunning = () => {
    if (!active || !transport) return;
    if (transport.mode === "worker") {
      releaseTransport();
      return;
    }
    try {
      transport.send({
        protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
        kind: "cancel",
        requestId: nextRequestId++,
        operationId: active.identity.operationId,
      });
    } catch {
      releaseTransport();
    }
  };

  /** Supersedes any running operation and starts a new one. */
  const start = (
    kind: ActiveOperation["kind"],
    payload: unknown,
    workspaceRevision: number
  ): Promise<AnyOutcome> => {
    if (active) {
      const previous = active;
      stopRunning();
      settle({
        status: "canceled",
        identity: previous.identity,
        reason: "superseded",
      });
    }
    rejectPages("RESULT_RELEASED");
    let planDigest: string;
    try {
      planDigest = computePlanDigest(payload);
    } catch {
      setState({
        ...CLEARED,
        status: "failed",
        identity: null,
        errorCode: "PLAN_NOT_SERIALIZABLE",
      });
      return Promise.resolve({
        status: "failed",
        identity: null,
        code: "PLAN_NOT_SERIALIZABLE",
        findings: [],
      });
    }
    return new Promise<AnyOutcome>((resolve) => {
      const operation: ActiveOperation = {
        kind,
        requestId: nextRequestId++,
        identity: {
          operationId: nextOperationId++,
          sessionId: "pending",
          planDigest,
          workspaceRevision,
        },
        payload,
        resolve,
      };
      active = operation;
      dispatch(operation);
    });
  };

  return {
    generate({ plan, workspaceRevision }) {
      return start(
        "generate",
        plan,
        workspaceRevision
      ) as Promise<RandomizationOutcome>;
    },

    simulate({ request, workspaceRevision }) {
      return start(
        "simulate",
        request,
        workspaceRevision
      ) as Promise<SimulationOutcome>;
    },

    page(offset, limit = MAX_RANDOMIZATION_PAGE_ROWS) {
      const identity = state.identity;
      if (state.status !== "complete" || !identity || !state.summary) {
        return Promise.reject(
          new RandomizationClientError("NO_COMPLETED_RESULT")
        );
      }
      if (!Number.isSafeInteger(offset) || offset < 0) {
        return Promise.reject(
          new RandomizationClientError("PAGE_OUT_OF_RANGE")
        );
      }
      const bounded = clamp(
        Number.isSafeInteger(limit) ? limit : MAX_RANDOMIZATION_PAGE_ROWS,
        1,
        MAX_RANDOMIZATION_PAGE_ROWS
      );
      const target = transport;
      if (!target || target.sessionId !== identity.sessionId) {
        return Promise.reject(new RandomizationClientError("RESULT_RELEASED"));
      }
      const requestId = nextRequestId++;
      return new Promise<RandomizationRowPage>((resolve, reject) => {
        pages.set(requestId, { identity, resolve, reject });
        try {
          target.send({
            protocolVersion: RANDOMIZATION_PROTOCOL_VERSION,
            kind: "page",
            requestId,
            identity,
            offset,
            limit: bounded,
          });
        } catch {
          pages.delete(requestId);
          reject(new RandomizationClientError("POST_MESSAGE_FAILED"));
        }
      });
    },

    cancel() {
      if (!active) return;
      const operation = active;
      stopRunning();
      settle({
        status: "canceled",
        identity: operation.identity,
        reason: "canceled",
      });
    },

    dispose() {
      if (active) {
        const operation = active;
        releaseTransport();
        settle({
          status: "canceled",
          identity: operation.identity,
          reason: "disposed",
        });
      }
      rejectPages("RESULT_RELEASED");
      releaseTransport();
      if (state !== INITIAL_STATE) {
        state = INITIAL_STATE;
        for (const listener of [...listeners]) listener();
      }
    },

    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
