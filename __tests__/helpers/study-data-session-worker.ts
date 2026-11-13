import { vi } from "vitest";
import { createStudyDataSession } from "@/components/study-data/pipeline-session";
import type { StudyDataRequest } from "@/components/study-data/protocol";

/**
 * A Worker stand-in for /study-data tests (#3798). It runs the real session,
 * as pipeline.worker.ts does, and stops replying once terminated, as a
 * browser Worker does. Only the Worker transport is faked.
 */
export class SessionWorker {
  static instances: SessionWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  private readonly session = createStudyDataSession();
  constructor() {
    SessionWorker.instances.push(this);
  }
  postMessage(request: StudyDataRequest) {
    this.session.handle(request).then(
      (result) => this.deliver({ id: request.id, ok: true, result }),
      (error: unknown) =>
        this.deliver({ id: request.id, ok: false, error: String(error) })
    );
  }
  terminate() {
    this.terminated = true;
  }
  private deliver(data: unknown) {
    if (!this.terminated) this.onmessage?.({ data } as MessageEvent);
  }
}

/** Installs {@link SessionWorker} as the global Worker, with no instances yet. */
export function useSessionWorker() {
  SessionWorker.instances = [];
  vi.stubGlobal("Worker", SessionWorker);
}

/**
 * Collects unhandled promise rejections while `body` runs, so a test can
 * assert that expected cancellation never escapes.
 */
export async function collectUnhandledRejections(
  body: () => Promise<void>
): Promise<unknown[]> {
  const reasons: unknown[] = [];
  const onRejection = (reason: unknown) => reasons.push(reason);
  process.on("unhandledRejection", onRejection);
  try {
    await body();
    // Give any rejection from the last step a turn to surface.
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    process.off("unhandledRejection", onRejection);
  }
  return reasons;
}
