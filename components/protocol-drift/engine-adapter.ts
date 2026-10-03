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

/** Asynchronous handle to a running engine. */
export interface EngineAdapter {
  /** Sends one command and resolves with its events and a fresh view. */
  request(command: PDCommand): Promise<EngineResponse>;
  /** Releases the worker, if any. */
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
  worker.onmessage = (message: MessageEvent<EngineResponse>) => {
    const waiter = pending.get(message.data.id);
    if (!waiter) return;
    pending.delete(message.data.id);
    waiter.resolve(message.data);
  };
  worker.onerror = (event) => {
    const error = new Error(event.message || "Simulation worker failed");
    for (const waiter of pending.values()) waiter.reject(error);
    pending.clear();
  };
  return {
    mode: "worker",
    request(command) {
      const id = nextId++;
      return new Promise<EngineResponse>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, command } satisfies EngineRequest);
      });
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}

/** Creates the worker adapter when possible, otherwise the in-thread one. */
export function createEngineAdapter(): EngineAdapter {
  return createWorkerAdapter() ?? createInThreadAdapter();
}
