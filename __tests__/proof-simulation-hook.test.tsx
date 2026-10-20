import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  SIMULATION_FLUSH_MS,
  SIMULATION_WATCHDOG_MS,
  useProofSimulation,
} from "@/app/proof/useProofSimulation";
import type { TerminalLog } from "@/components/proof/ProofTerminalConsole";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  emit(data: unknown) {
    act(() => this.onmessage?.({ data }));
  }
}

const latestWorker = () => FakeWorker.instances.at(-1)!;

function setup() {
  const logs: TerminalLog[] = [];
  const appendLogs = vi.fn((...entries: TerminalLog[]) => {
    logs.push(...entries);
  });
  const announce = vi.fn();
  const hook = renderHook(() => useProofSimulation({ appendLogs, announce }));
  return { ...hook, logs, appendLogs, announce };
}

function start(result: ReturnType<typeof setup>["result"]) {
  act(() =>
    result.current.startSimulation({
      mode: "normal",
      theoremId: "modus-ponens",
    })
  );
  return latestWorker().postMessage.mock.calls.at(-1)![0].requestId as number;
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useProofSimulation", () => {
  it("starts idle with one worker", () => {
    const { result } = setup();
    expect(result.current.isSimulating).toBe(false);
    expect(result.current.simulationProgress).toBeNull();
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("posts a numbered start request and shows the boot step", () => {
    const { result } = setup();
    act(() =>
      result.current.startSimulation({
        mode: "loop",
        theoremId: "custom",
        customFormulas: ["P", "P -> Q", "Q -> R", "R"],
      })
    );
    expect(latestWorker().postMessage).toHaveBeenCalledWith({
      type: "START_SIMULATION",
      requestId: 1,
      mode: "loop",
      theoremId: "custom",
      customFormulas: ["P", "P -> Q", "Q -> R", "R"],
    });
    expect(result.current.isSimulating).toBe(true);
    expect(result.current.simulationProgress).toEqual({
      step: 1,
      total: 10,
      log: "Booting Proof Simulation Engine...",
    });
  });

  it("batches progress lines and tracks the latest step", () => {
    const { result, logs, announce } = setup();
    const requestId = start(result);
    latestWorker().emit({ type: "progress", requestId, log: "warming up" });
    latestWorker().emit({
      type: "progress",
      requestId,
      log: "[Step 3/7] Discharging C",
    });
    latestWorker().emit({
      type: "progress",
      requestId,
      log: "[Step 4/7] Linking E",
    });
    expect(logs).toHaveLength(0);
    expect(announce).toHaveBeenCalledWith("Simulation update: warming up");

    act(() => vi.advanceTimersByTime(SIMULATION_FLUSH_MS));
    expect(logs.map((l) => l.text)).toEqual([
      "warming up",
      "[Step 3/7] Discharging C",
      "[Step 4/7] Linking E",
    ]);
    expect(result.current.simulationProgress).toEqual({
      step: 4,
      total: 7,
      log: "Linking E",
    });
  });

  it("leaves progress alone when a batch has no step line", () => {
    const { result } = setup();
    const requestId = start(result);
    latestWorker().emit({ type: "progress", requestId, log: "no step here" });
    act(() => vi.advanceTimersByTime(SIMULATION_FLUSH_MS));
    expect(result.current.simulationProgress?.step).toBe(1);
  });

  it("finishes on done", () => {
    const { result, logs, announce } = setup();
    const requestId = start(result);
    latestWorker().emit({ type: "done", requestId, stepsCompleted: 6 });
    expect(result.current.isSimulating).toBe(false);
    expect(result.current.simulationProgress).toBeNull();
    expect(logs.at(-1)).toMatchObject({
      type: "success",
      text: "✔ Background Simulation completed successfully with 6 steps.",
    });
    expect(announce).toHaveBeenLastCalledWith(
      "Background proof simulation completed successfully."
    );
    // The watchdog was cleared, so nothing fires later.
    act(() => vi.advanceTimersByTime(SIMULATION_WATCHDOG_MS * 2));
    expect(logs).toHaveLength(1);
  });

  it("reports a worker error", () => {
    const { result, logs } = setup();
    const requestId = start(result);
    latestWorker().emit({ type: "error", requestId, message: "bad AST" });
    expect(result.current.isSimulating).toBe(false);
    expect(logs.at(-1)).toMatchObject({
      type: "error",
      text: "Background Simulation error: bad AST",
    });
  });

  it("ignores empty messages and replies to an aborted request", () => {
    const { result, logs } = setup();
    const staleId = start(result);
    act(() => result.current.abortSimulation());
    expect(latestWorker().postMessage).toHaveBeenLastCalledWith({
      type: "ABORT",
    });
    expect(result.current.isSimulating).toBe(false);

    latestWorker().emit(null);
    latestWorker().emit({
      type: "done",
      requestId: staleId,
      stepsCompleted: 1,
    });
    expect(logs).toHaveLength(0);
  });

  it("ignores unknown message types but still feeds the watchdog", () => {
    const { result, logs } = setup();
    const requestId = start(result);
    act(() => vi.advanceTimersByTime(SIMULATION_WATCHDOG_MS - 100));
    latestWorker().emit({ type: "heartbeat", requestId });
    act(() => vi.advanceTimersByTime(SIMULATION_WATCHDOG_MS - 100));
    expect(logs).toHaveLength(0);
    expect(result.current.isSimulating).toBe(true);
  });

  it("restarts a silent worker after the watchdog limit", () => {
    const { result, logs, announce } = setup();
    start(result);
    const stuck = latestWorker();
    act(() => vi.advanceTimersByTime(SIMULATION_WATCHDOG_MS));
    expect(stuck.terminate).toHaveBeenCalled();
    expect(FakeWorker.instances).toHaveLength(2);
    expect(result.current.isSimulating).toBe(false);
    expect(logs.at(-1)?.text).toMatch(/terminated by watchdog/);
    expect(announce).toHaveBeenLastCalledWith(
      "Background calculation terminated by watchdog: execution exceeded 5-second limit."
    );
  });

  it("terminates the worker on unmount", () => {
    const { unmount } = setup();
    const worker = latestWorker();
    unmount();
    expect(worker.terminate).toHaveBeenCalled();
  });

  it("still tracks state when Worker is unavailable", () => {
    vi.stubGlobal("Worker", undefined);
    const { result } = setup();
    expect(FakeWorker.instances).toHaveLength(0);
    act(() =>
      result.current.startSimulation({
        mode: "normal",
        theoremId: "modus-ponens",
      })
    );
    expect(result.current.isSimulating).toBe(true);
    act(() => result.current.abortSimulation());
    expect(result.current.isSimulating).toBe(false);
  });
});
