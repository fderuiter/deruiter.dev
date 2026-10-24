/**
 * Connects the /platform/operations page to the dashboard engine. In a
 * browser the engine runs in a Web Worker, created on the first request so
 * it loads outside the route's shell bundle. Where Workers are unavailable
 * (jsdom tests, very old browsers) the same session module is loaded on
 * demand and runs on the main thread.
 */
import type {
  OperationsDashboard,
  OperationsScope,
} from "@/lib/clinical-platform";
import type { OperationsRequest, OperationsResponse } from "./protocol";

/** Asynchronous handle to the dashboard engine. */
export interface OperationsClient {
  /** The dashboard at a scope. */
  dashboard(scope: OperationsScope): Promise<OperationsDashboard>;
  /** Releases the worker and rejects every pending request. */
  dispose(): void;
}

interface Waiter {
  resolve(value: OperationsDashboard): void;
  reject(error: Error): void;
}

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./operations.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

/** Creates the client. Nothing loads until the first request. */
export function createOperationsClient(): OperationsClient {
  let worker: Worker | null = null;
  let inThread: Promise<{
    handle(request: OperationsRequest): Promise<OperationsDashboard>;
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
    worker.onmessage = (message: MessageEvent<OperationsResponse>) => {
      const waiter = pending.get(message.data.id);
      if (!waiter) return;
      pending.delete(message.data.id);
      if (message.data.ok) waiter.resolve(message.data.result);
      else waiter.reject(new Error(message.data.error));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      rejectAll(new Error(event.message || "The dashboard worker failed."));
      worker?.terminate();
      worker = null;
    };
    return worker;
  };

  return {
    dashboard(scope) {
      const request: OperationsRequest = {
        id: nextId++,
        type: "dashboard",
        scope,
      };
      const target = ensureWorker();
      if (!target) {
        inThread ??= import("./operations-session").then((module) =>
          module.createOperationsSession()
        );
        return inThread.then((session) => session.handle(request));
      }
      return new Promise<OperationsDashboard>((resolve, reject) => {
        pending.set(request.id, { resolve, reject });
        target.postMessage(request);
      });
    },
    dispose() {
      worker?.terminate();
      worker = null;
      rejectAll(new Error("The dashboard was closed."));
    },
  };
}
