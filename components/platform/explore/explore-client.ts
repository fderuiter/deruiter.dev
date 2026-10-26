/**
 * Connects the /platform/explore page to the explorer engine. In a browser
 * the engine runs in a Web Worker, created on the first request so it loads
 * outside the route's shell bundle. Where Workers are unavailable (jsdom
 * tests, very old browsers) the same session module is loaded on demand and
 * runs on the main thread.
 */
import type { Exploration, ExplorationResult } from "@/lib/clinical-platform";
import type { ExploreRequest, ExploreResponse } from "./protocol";

/** Asynchronous handle to the explorer engine. */
interface ExploreClient {
  /** The result of one exploration. */
  explore(exploration: Exploration): Promise<ExplorationResult>;
  /** Releases the worker and rejects every pending request. */
  dispose(): void;
}

interface Waiter {
  resolve(value: ExplorationResult): void;
  reject(error: Error): void;
}

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./explore.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

/** Creates the client. Nothing loads until the first request. */
export function createExploreClient(): ExploreClient {
  let worker: Worker | null = null;
  let inThread: Promise<{
    handle(request: ExploreRequest): Promise<ExplorationResult>;
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
    worker.onmessage = (message: MessageEvent<ExploreResponse>) => {
      const waiter = pending.get(message.data.id);
      if (!waiter) return;
      pending.delete(message.data.id);
      if (message.data.ok) waiter.resolve(message.data.result);
      else waiter.reject(new Error(message.data.error));
    };
    worker.onerror = (event) => {
      event.preventDefault();
      rejectAll(new Error(event.message || "The explorer worker failed."));
      worker?.terminate();
      worker = null;
    };
    return worker;
  };

  return {
    explore(exploration) {
      const request: ExploreRequest = {
        id: nextId++,
        type: "explore",
        exploration,
      };
      const target = ensureWorker();
      if (!target) {
        inThread ??= import("./explore-session").then((module) =>
          module.createExploreSession()
        );
        return inThread.then((session) => session.handle(request));
      }
      return new Promise<ExplorationResult>((resolve, reject) => {
        pending.set(request.id, { resolve, reject });
        target.postMessage(request);
      });
    },
    dispose() {
      worker?.terminate();
      worker = null;
      rejectAll(new Error("The explorer was closed."));
    },
  };
}
