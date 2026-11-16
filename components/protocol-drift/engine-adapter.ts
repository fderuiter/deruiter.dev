/**
 * Connects the store to the simulation engine. In a browser the engine runs
 * inside a Web Worker; where Workers are unavailable (jsdom tests, very old
 * browsers) an in-thread adapter runs the same engine with the same protocol.
 */
import type { PDCommand } from "@/lib/protocol-drift";
import {
  answerRequest,
  createEngineHost,
  type EngineRequest,
  type EngineResponse,
} from "./engine-core";

/**
 * Raised for a request still pending when its adapter was disposed (#3799).
 * The store treats it as expected: the session it belonged to has ended.
 */
export class EngineDisposedError extends Error {
  constructor() {
    super("The simulation engine was disposed.");
    this.name = "EngineDisposedError";
  }
}

/** Asynchronous handle to a running engine. */
export interface EngineAdapter {
  /** Sends one command and resolves with its events and a fresh view. */
  request(command: PDCommand): Promise<EngineResponse>;
  /**
   * Releases the worker, if any, and rejects every pending request once with
   * {@link EngineDisposedError}. A reply that arrives afterwards is ignored.
   */
  dispose(): void;
  /** "worker" when the engine runs off the main thread. */
  readonly mode: "worker" | "in-thread";
}

function createInThreadAdapter(): EngineAdapter {
  const engine = createEngineHost();
  let nextId = 1;
  return {
    mode: "in-thread",
    request(command) {
      const request: EngineRequest = { id: nextId++, command };
      return Promise.resolve(answerRequest(engine, request));
    },
    dispose() {},
  };
}

function createWorkerAdapter(): EngineAdapter | null {
  if (typeof Worker === "undefined") return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL("./engine.worker.ts", import.meta.url));
  } catch {
    return null;
  }
  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (r: EngineResponse) => void; reject: (e: Error) => void }
  >();
  let disposed = false;
  worker.onmessage = (message: MessageEvent<EngineResponse>) => {
    if (disposed) return;
    const waiter = pending.get(message.data.id);
    if (!waiter) return;
    pending.delete(message.data.id);
    waiter.resolve(message.data);
  };
  const rejectAll = (error: Error) => {
    // Clear first so a waiter that throws cannot leave others behind.
    const waiters = [...pending.values()];
    pending.clear();
    for (const waiter of waiters) waiter.reject(error);
  };
  worker.onerror = (event) => {
    if (disposed) return;
    rejectAll(new Error(event.message || "Simulation worker failed"));
  };
  return {
    mode: "worker",
    request(command) {
      const id = nextId++;
      if (disposed) return Promise.reject(new EngineDisposedError());
      return new Promise<EngineResponse>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, command } satisfies EngineRequest);
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      worker.onmessage = null;
      worker.onerror = null;
      worker.terminate();
      rejectAll(new EngineDisposedError());
    },
  };
}

/** Creates the worker adapter when possible, otherwise the in-thread one. */
export function createEngineAdapter(): EngineAdapter {
  return createWorkerAdapter() ?? createInThreadAdapter();
}
