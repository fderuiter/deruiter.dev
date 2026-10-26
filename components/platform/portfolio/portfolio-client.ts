/**
 * Connects the /platform/portfolio page to the dashboard engine. In a
 * browser the engine runs in a Web Worker, created on the first request so
 * it loads outside the route's shell bundle. Where Workers are unavailable
 * (jsdom tests, very old browsers) the same session module is loaded on
 * demand and runs on the main thread.
 */
import type {
  EnrollmentWhatIf,
  PortfolioDashboard,
  PortfolioForecast,
} from "@/lib/clinical-platform";
import type {
  PortfolioRequest,
  PortfolioResponse,
  PortfolioResult,
} from "./protocol";

/** Asynchronous handle to the dashboard engine. */
interface PortfolioClient {
  /** The portfolio dashboard. */
  dashboard(): Promise<PortfolioDashboard>;
  /** One study's enrollment forecast, with sites added by a what-if or without. */
  forecast(
    studyId: string,
    whatIf: EnrollmentWhatIf | null
  ): Promise<PortfolioForecast>;
  /** Releases the worker and rejects every pending request. */
  dispose(): void;
}

/** A request without its id, which the client assigns. */
type Ask =
  | { readonly type: "dashboard" }
  | {
      readonly type: "forecast";
      readonly studyId: string;
      readonly whatIf: EnrollmentWhatIf | null;
    };

interface Waiter {
  resolve(value: PortfolioResult): void;
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
    handle(request: PortfolioRequest): Promise<PortfolioResult>;
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

  const send = (ask: Ask): Promise<PortfolioResult> => {
    const request: PortfolioRequest = { ...ask, id: nextId++ };
    const target = ensureWorker();
    if (!target) {
      inThread ??= import("./portfolio-session").then((module) =>
        module.createPortfolioSession()
      );
      return inThread.then((session) => session.handle(request));
    }
    return new Promise<PortfolioResult>((resolve, reject) => {
      pending.set(request.id, { resolve, reject });
      target.postMessage(request);
    });
  };

  return {
    dashboard() {
      return send({ type: "dashboard" }) as Promise<PortfolioDashboard>;
    },
    forecast(studyId, whatIf) {
      return send({
        type: "forecast",
        studyId,
        whatIf,
      }) as Promise<PortfolioForecast>;
    },
    dispose() {
      worker?.terminate();
      worker = null;
      rejectAll(new Error("The dashboard was closed."));
    },
  };
}
