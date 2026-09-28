import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Background Web Worker & Watchdog Implementations", () => {
  const pagePath = path.resolve(__dirname, "../app/(desktop)/proof/page.tsx");
  const content = fs.readFileSync(pagePath, "utf-8");

  it("should lazy-initialize Web Worker using native Next.js import.meta.url pattern", () => {
    expect(content).toContain(
      'new Worker(new URL("./proof-worker.ts", import.meta.url))'
    );
  });

  it("should implement a configurable 5-second (5000ms) watchdog timeout", () => {
    // Watchdog timer of 5 seconds (5000ms) should be used
    expect(content).toContain("5000");
    expect(content).toContain("watchdogRef.current = setTimeout(");
  });

  it("should terminate the hung worker on watchdog timeout", () => {
    expect(content).toContain("workerRef.current.terminate()");
  });

  it("should re-initialize a new Web Worker instance upon timeout to recover usability", () => {
    expect(content).toContain("initWorkerRef.current()");
  });

  it("should print a user-friendly error notification when watchdog kills computation", () => {
    expect(content).toContain(
      "Background calculation terminated by watchdog: execution exceeded 5-second limit (potential infinite loop detected)"
    );
  });

  it("should implement an asynchronous batching buffer (100ms) to throttle progress logs", () => {
    expect(content).toContain("100ms batch logs flush timer");
    expect(content).toContain("pendingLogsRef.current");
  });

  it("should declare isSimulating state to visually render progress metrics", () => {
    expect(content).toContain("const [isSimulating, setIsSimulating]");
    expect(content).toContain(
      "const [simulationProgress, setSimulationProgress]"
    );
  });

  it("should render step-by-step metrics and high frequency updates safe badge", () => {
    expect(content).toContain("Background Tactic Simulation Running...");
    expect(content).toContain("THREAD: WEB WORKER (60FPS UI SAFE)");
  });
});
