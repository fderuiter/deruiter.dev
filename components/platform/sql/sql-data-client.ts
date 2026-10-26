/**
 * Fetches the SQL workbench's warehouse load. In a browser the warehouse is
 * built in a Web Worker, created on the first request so it loads only once
 * the visitor starts the engine. Where Workers are unavailable (jsdom tests,
 * very old browsers) the same session module is loaded on demand and runs
 * on the main thread.
 */
import type { WorkbenchLoad } from "@/lib/clinical-platform";
import type { SqlDataRequest, SqlDataResponse } from "./protocol";

/** Asynchronous handle to the warehouse load. */
interface SqlDataClient {
  /** The gold tables as CSV and the statements that load them. */
  load(): Promise<WorkbenchLoad>;
  /** Releases the worker and rejects every pending request. */
  dispose(): void;
}

interface Waiter {
  resolve(value: WorkbenchLoad): void;
  reject(error: Error): void;
}

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./sql-data.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

/** Creates the client. Nothing loads until the first request. */
export function createSqlDataClient(): SqlDataClient {
  let worker: Worker | null = null;
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
    worker.onmessage = (message: MessageEvent<SqlDataResponse>) => {
      const waiter = pending.get(message.data.id);
      if (!waiter) return;
      pending.delete(message.data.id);
      if (message.data.ok) waiter.resolve(message.data.load);
      else waiter.reject(new Error(message.data.error));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      rejectAll(new Error(event.message || "The data worker failed."));
      worker?.terminate();
      worker = null;
    };
    return worker;
  };

  return {
    load() {
      const request: SqlDataRequest = { id: nextId++, type: "load" };
      const target = ensureWorker();
      if (!target) {
        return import("./sql-data-session").then((module) =>
          module.createSqlDataSession().load()
        );
      }
      return new Promise<WorkbenchLoad>((resolve, reject) => {
        pending.set(request.id, { resolve, reject });
        target.postMessage(request);
      });
    },
    dispose() {
      worker?.terminate();
      worker = null;
      rejectAll(new Error("The workbench was closed."));
    },
  };
}
