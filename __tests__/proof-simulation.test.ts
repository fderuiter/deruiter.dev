// @vitest-environment node
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  SIMULATION_FLUSH_MS,
  SIMULATION_WATCHDOG_MS,
} from "@/app/proof/useProofSimulation";

/**
 * Wiring checks for the /proof background simulation (#3800). Behaviour
 * (batching, watchdog restarts, attempt boundaries) is covered by
 * proof-simulation-hook.test.tsx; these only pin what a bundler or a reader
 * depends on and a rendered hook test cannot see.
 */
const root = path.resolve(__dirname, "..");
const read = (file: string) =>
  fs.readFileSync(path.join(root, file), "utf-8");

describe("proof simulation wiring", () => {
  it("keeps the Worker URL literal the bundler needs to emit the worker chunk", () => {
    expect(read("app/proof/useProofSimulation.ts")).toContain(
      'new Worker(new URL("./proof-worker.ts", import.meta.url))'
    );
  });

  it("uses a 5 second watchdog and a 100 ms log flush", () => {
    expect(SIMULATION_WATCHDOG_MS).toBe(5000);
    expect(SIMULATION_FLUSH_MS).toBe(100);
  });

  it("renders the running badge in the proof canvas", () => {
    const canvas = read("components/proof/ProofCanvas.tsx");
    expect(canvas).toContain("Background Tactic Simulation Running...");
    expect(canvas).toContain("THREAD: WEB WORKER (60FPS UI SAFE)");
  });
});
