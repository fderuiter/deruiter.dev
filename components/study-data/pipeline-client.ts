/**
 * Connects the /study-data page to the pipeline. In a browser the pipeline
 * runs in a Web Worker, created on the first request so the engine loads
 * only when needed and outside the route's shell bundle. Where Workers are
 * unavailable (jsdom tests, very old browsers) the same session module is
 * loaded on demand and runs on the main thread.
 */
import type {
  StudyDataRequest,
  StudyDataResponse,
  StudyDataResults,
} from "./protocol";

/** Any request without its id, kept as a union so that adding one back types. */
type AnyRequestWithoutId = StudyDataRequest extends infer R
  ? R extends StudyDataRequest
    ? Omit<R, "id">
    : never
  : never;

type RequestOf<T extends StudyDataRequest["type"]> = Extract<
  AnyRequestWithoutId,
  { type: T }
>;

/**
 * Raised for a request that was stopped on purpose rather than failed: the
 * page cancelled it by starting another run, or (as the subclass
 * {@link PipelineDisposedError}) its client was disposed. Callers treat it as
 * expected and show no error.
 */
export class PipelineCancelledError extends Error {
  constructor(message = "The pipeline run was cancelled.") {
    super(message);
    this.name = "PipelineCancelledError";
  }
}

/**
 * Raised for a request still pending when its client was disposed (#3798).
 * It extends {@link PipelineCancelledError}, so handlers that already treat
 * cancellation as expected treat disposal the same way.
 */
export class PipelineDisposedError extends PipelineCancelledError {
  constructor() {
    super("The pipeline client was disposed.");
    this.name = "PipelineDisposedError";
  }
}

/** Asynchronous handle to the pipeline. */
export interface PipelineClient {
  /** Sends one request and resolves with its result. */
  request<T extends StudyDataRequest["type"]>(
    request: RequestOf<T>
  ): Promise<StudyDataResults[T]>;
  /**
   * Stops the worker and rejects every pending request with
   * {@link PipelineCancelledError}. The next request starts a fresh worker,
   * which holds no run until it is asked for one.
   */
  cancel(): void;
  /**
   * Releases the worker, if any, and rejects every pending worker request
   * with {@link PipelineDisposedError}. Calling it again does nothing. The
   * client stays usable: the next request starts a fresh worker, so an owner
   * that sets up again (as React Strict Mode does) can keep the same client.
   */
  dispose(): void;
  /** Where requests run: in a worker, on the main thread, or not yet known. */
  mode(): "worker" | "main-thread" | "idle";
}

interface Waiter {
  resolve(value: unknown): void;
  reject(error: Error): void;
}

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./pipeline.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

/** Creates the pipeline client. Nothing loads until the first request. */
export function createPipelineClient(): PipelineClient {
  let worker: Worker | null = null;
  let inThread: Promise<{
    handle(request: StudyDataRequest): Promise<unknown>;
  }> | null = null;
  let nextId = 1;
  const pending = new Map<number, Waiter>();

  const rejectAll = (error: Error) => {
    // Clear first so a waiter that throws cannot leave others behind.
    const waiters = [...pending.values()];
    pending.clear();
    for (const waiter of waiters) waiter.reject(error);
  };

  /** Terminates the current worker, if any, and settles its waiters. */
  const release = (error: Error) => {
    const released = worker;
    worker = null;
    released?.terminate();
    rejectAll(error);
  };

  const ensureWorker = (): Worker | null => {
    if (worker) return worker;
    const created = createWorker();
    if (!created) return null;
    worker = created;
    // A released worker may still deliver a message or error; only the
    // current one may settle waiters or tear the client down.
    created.onmessage = (message: MessageEvent<StudyDataResponse>) => {
      if (worker !== created) return;
      const waiter = pending.get(message.data.id);
      if (!waiter) return;
      pending.delete(message.data.id);
      if (message.data.ok) waiter.resolve(message.data.result);
      else waiter.reject(new Error(message.data.error));
    };
    created.onerror = (event) => {
      event.preventDefault();
      if (worker !== created) return;
      release(new Error(event.message || "The pipeline worker failed."));
    };
    return created;
  };

  const runInThread = async (request: StudyDataRequest) => {
    inThread ??= import("./pipeline-session").then((module) =>
      module.createStudyDataSession()
    );
    const session = await inThread;
    return session.handle(request);
  };

  return {
    request<T extends StudyDataRequest["type"]>(
      partial: RequestOf<T>
    ): Promise<StudyDataResults[T]> {
      const id = nextId++;
      const base: AnyRequestWithoutId = partial;
      const request: StudyDataRequest = { ...base, id };
      const target = ensureWorker();
      if (!target) {
        return runInThread(request) as Promise<StudyDataResults[T]>;
      }
      return new Promise<StudyDataResults[T]>((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => resolve(value as StudyDataResults[T]),
          reject,
        });
        target.postMessage(request);
      });
    },
    cancel() {
      if (!worker) return;
      release(new PipelineCancelledError());
    },
    dispose() {
      release(new PipelineDisposedError());
    },
    mode() {
      if (worker) return "worker";
      return inThread ? "main-thread" : "idle";
    },
  };
}
