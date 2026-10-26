/**
 * Connects the /platform/portfolio page to the dashboard engine. In a
 * browser the engine runs in a Web Worker, created on the first request so
 * it loads outside the route's shell bundle. Where Workers are unavailable
 * (jsdom tests, very old browsers) the same session module is loaded on
 * demand and runs on the main thread.
 */
import type { PortfolioDashboard } from "@/lib/clinical-platform";
import type { PortfolioRequest, PortfolioResponse } from "./protocol";

/** Asynchronous handle to the dashboard engine. */
interface PortfolioClient {
  /** The portfolio dashboard. */
  dashboard(): Promise<PortfolioDashboard>;
  /** Releases the worker and rejects every pending request. */
  dispose(): void;
}

interface Waiter {
  resolve(value: PortfolioDashboard): void;
  reject(error: Error): void;
}

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./portfolio.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

/** Creates the client. Nothing loads until the first request. */
export function createPortfolioClient(): PortfolioClient {
  let worker: Worker | null = null;
  let inThread: Promise<{
    handle(request: PortfolioRequest): Promise<PortfolioDashboard>;
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
    worker.onmessage = (message: MessageEvent<PortfolioResponse>) => {
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
    dashboard() {
      const request: PortfolioRequest = { id: nextId++, type: "dashboard" };
      const target = ensureWorker();
      if (!target) {
        inThread ??= import("./portfolio-session").then((module) =>
          module.createPortfolioSession()
        );
        return inThread.then((session) => session.handle(request));
      }
      return new Promise<PortfolioDashboard>((resolve, reject) => {
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
