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
   * which holds no run until it is asked for one. On the main thread it does
   * the same with a fresh session: a request still waiting for the session
   * starts no work, and one already running finishes but its answer is
   * dropped, because main-thread work cannot be interrupted.
   */
  cancel(): void;
  /**
   * Releases the worker or the main-thread session, if any, and rejects every
   * pending request with {@link PipelineDisposedError}. Calling it again does nothing. The
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
    if (released) {
      released.onmessage = null;
      released.onerror = null;
      released.terminate();
    }
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

  // Main-thread requests have no worker to terminate, so cancel and dispose
  // end them by generation (#3805). Each request records the generation it
  // started in; cancel and dispose start a new one and settle the older
  // waiters at once. Work already running on the main thread cannot be
  // interrupted, so its answer is dropped instead of reaching the caller.
  let generation = 0;
  const inThreadWaiters = new Map<number, Waiter>();

  const endInThread = (error: Error) => {
    generation += 1;
    // A fresh session holds no run, as a fresh worker would.
    inThread = null;
    const waiters = [...inThreadWaiters.values()];
    inThreadWaiters.clear();
    for (const waiter of waiters) waiter.reject(error);
  };

  const runInThread = (id: number, request: StudyDataRequest) =>
    new Promise<unknown>((resolve, reject) => {
      const started = generation;
      inThreadWaiters.set(id, { resolve, reject });
      const settle = (outcome: () => void) => {
        if (started !== generation || !inThreadWaiters.delete(id)) return;
        outcome();
      };
      const session = (inThread ??= import("./pipeline-session").then(
        (module) => module.createStudyDataSession()
      ));
      session
        .then((loaded) => {
          // Cancelled while the session loaded: start no work.
          if (started !== generation) return undefined;
          return loaded.handle(request).then(
            (value) => settle(() => resolve(value)),
            (error: unknown) =>
              settle(() =>
                reject(
                  error instanceof Error ? error : new Error(String(error))
                )
              )
          );
        })
        .catch((error: unknown) =>
          settle(() =>
            reject(error instanceof Error ? error : new Error(String(error)))
          )
        );
    });

  return {
    request<T extends StudyDataRequest["type"]>(
      partial: RequestOf<T>
    ): Promise<StudyDataResults[T]> {
      const id = nextId++;
      const base: AnyRequestWithoutId = partial;
      const request: StudyDataRequest = { ...base, id };
      const target = ensureWorker();
      if (!target) {
        return runInThread(id, request) as Promise<StudyDataResults[T]>;
      }
      return new Promise<StudyDataResults[T]>((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => resolve(value as StudyDataResults[T]),
          reject,
        });
        try {
          target.postMessage(request);
        } catch (error) {
          pending.delete(id);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    },
    cancel() {
      if (inThread) endInThread(new PipelineCancelledError());
      if (!worker) return;
      release(new PipelineCancelledError());
    },
    dispose() {
      if (inThread) endInThread(new PipelineDisposedError());
      release(new PipelineDisposedError());
    },
    mode() {
      if (worker) return "worker";
      return inThread ? "main-thread" : "idle";
    },
  };
}
