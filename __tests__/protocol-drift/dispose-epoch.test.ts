import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EngineDisposedError,
  createEngineAdapter,
} from "@/components/protocol-drift/engine-adapter";
import {
  answerRequest,
  createEngineHost,
  type EngineRequest,
} from "@/components/protocol-drift/engine-core";
import { useProtocolDriftStore } from "@/components/protocol-drift/store";
import { WAVE1_GRAPH, type ProtocolDriftSaveFile } from "@/lib/protocol-drift";
import { ok, publish, startEngine } from "./helpers";

/**
 * Disposing the engine mid-request (#3799). A worker stand-in runs the real
 * engine but answers only when the test releases it, so a tick can be held in
 * flight while the session that sent it ends.
 */

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({ isSoundAllowed: () => false, playTone: vi.fn() }),
}));
vi.mock("@/components/protocol-drift/persistence", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/components/protocol-drift/persistence")
  >()),
  writeAutosave: vi.fn(async () => {}),
}));

class HeldWorker {
  static instances: HeldWorker[] = [];
  /** Answer every request at once unless the test holds this worker. */
  hold = false;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;
  private readonly engine = createEngineHost();
  private readonly queue: EngineRequest[] = [];
  constructor() {
    HeldWorker.instances.push(this);
  }
  postMessage(request: EngineRequest) {
    this.queue.push(request);
    if (!this.hold) queueMicrotask(() => this.flush());
  }
  /** Answers every queued request, even after terminate, like a late reply. */
  flush() {
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      const data = answerRequest(this.engine, request);
      this.onmessage?.({ data } as MessageEvent);
    }
  }
  terminate() {
    this.terminated = true;
  }
}

/** A Wave 1 study, published and paused a few days in. */
function pausedStudy(): ProtocolDriftSaveFile {
  const engine = startEngine();
  publish(engine, WAVE1_GRAPH, "p1");
  if (engine.view().fsmState !== "PAUSED") {
    ok(engine, { type: "SET_PAUSED", isPaused: true });
  }
  const event = ok(engine, {
    type: "EXPORT_SAVE",
    savedAt: "2026-01-01T00:00:00Z",
  }).find((e) => e.type === "SAVE_EXPORTED");
  if (!event || event.type !== "SAVE_EXPORTED") throw new Error("no save");
  return event.save;
}

async function runningSession() {
  const store = useProtocolDriftStore.getState;
  await store().init();
  expect(await store().restoreSave(pausedStudy())).toBe(true);
  await store().togglePause();
  expect(store().snapshot?.fsmState).toBe("RUNNING");
  return HeldWorker.instances.at(-1)!;
}

async function settle() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
  HeldWorker.instances = [];
  vi.stubGlobal("Worker", HeldWorker);
});

afterEach(() => {
  useProtocolDriftStore.getState().dispose();
  vi.unstubAllGlobals();
});

describe("engine adapter disposal (#3799)", () => {
  it("rejects every pending request exactly once and ignores a late reply", async () => {
    const adapter = createEngineAdapter();
    expect(adapter.mode).toBe("worker");
    const worker = HeldWorker.instances[0]!;
    worker.hold = true;
    const outcomes: string[] = [];
    const watch = (p: Promise<unknown>) =>
      p.then(
        () => outcomes.push("resolved"),
        (error: unknown) =>
          outcomes.push(
            error instanceof EngineDisposedError ? "disposed" : "other"
          )
      );
    const first = watch(
      adapter.request({ type: "INIT", seed: 1, scenario: "full" })
    );
    const second = watch(adapter.request({ type: "ACCEPT_BRIEF" }));

    adapter.dispose();
    worker.flush();
    await Promise.all([first, second]);
    adapter.dispose();
    await settle();

    expect(worker.terminated).toBe(true);
    expect(outcomes).toEqual(["disposed", "disposed"]);
    await expect(
      adapter.request({ type: "ACCEPT_BRIEF" })
    ).rejects.toBeInstanceOf(EngineDisposedError);
  });
});

describe("Protocol Drift sessions after a disposed tick (#3799)", () => {
  it("a new session advances after the old session's tick was cut off", async () => {
    const store = useProtocolDriftStore.getState;
    const oldWorker = await runningSession();
    oldWorker.hold = true;
    const tick = store().tick(500);
    await settle();

    // The page tears down and sets up again (Strict Mode, or a remount).
    store().dispose();
    await tick;
    await runningSession();
    const before = store().snapshot?.minute ?? 0;

    await store().tick(60_000);
    expect(store().snapshot?.minute ?? 0).toBeGreaterThan(before);
  });

  it("a late reply from the old worker cannot change the new session", async () => {
    const store = useProtocolDriftStore.getState;
    const oldWorker = await runningSession();
    oldWorker.hold = true;
    const tick = store().tick(60_000);
    await settle();

    store().dispose();
    await tick;
    await store().init();
    const fresh = store().snapshot;
    oldWorker.flush();
    await settle();

    expect(store().snapshot).toBe(fresh);
    expect(store().snapshot?.fsmState).not.toBe("RUNNING");
  });

  it("an old tick's finally does not release a newer session's tick lock", async () => {
    const store = useProtocolDriftStore.getState;
    const oldWorker = await runningSession();
    oldWorker.hold = true;
    const oldTick = store().tick(500);
    await settle();
    store().dispose();

    const newWorker = await runningSession();
    newWorker.hold = true;
    const newTick = store().tick(500);
    await settle();
    await oldTick;

    // The new tick is still in flight, so another tick is refused.
    const posted = vi.spyOn(newWorker, "postMessage");
    await store().tick(500);
    expect(posted).not.toHaveBeenCalled();

    newWorker.flush();
    await newTick;
  });
});
