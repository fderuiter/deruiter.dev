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

/** Raised for a request the page cancelled by starting another run. */
export class PipelineCancelledError extends Error {
  constructor() {
    super("The pipeline run was cancelled.");
    this.name = "PipelineCancelledError";
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
  /** Releases the worker, if any. */
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
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  };

  const ensureWorker = (): Worker | null => {
    if (worker) return worker;
    worker = createWorker();
    if (!worker) return null;
    worker.onmessage = (message: MessageEvent<StudyDataResponse>) => {
      const waiter = pending.get(message.data.id);
      if (!waiter) return;
      pending.delete(message.data.id);
      if (message.data.ok) waiter.resolve(message.data.result);
      else waiter.reject(new Error(message.data.error));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      rejectAll(new Error(event.message || "The pipeline worker failed."));
      worker?.terminate();
      worker = null;
    };
    return worker;
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
      worker.terminate();
      worker = null;
      rejectAll(new PipelineCancelledError());
    },
    dispose() {
      worker?.terminate();
      worker = null;
      pending.clear();
    },
    mode() {
      if (worker) return "worker";
      return inThread ? "main-thread" : "idle";
    },
  };
}
