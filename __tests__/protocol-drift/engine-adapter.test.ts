// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createEngineAdapter } from "@/components/protocol-drift/engine-adapter";
import { createProtocolDriftEngine } from "@/lib/protocol-drift";

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

describe("engine adapter", () => {
  it("runs the engine in-thread where Worker does not exist", async () => {
    const adapter = createEngineAdapter();
    expect(adapter.mode).toBe("in-thread");
    const reference = createProtocolDriftEngine({
      seed: 7,
      scenario: "tracer",
    });
    const first = await adapter.request({
      type: "INIT",
      seed: 7,
      scenario: "tracer",
    });
    reference.dispatch({ type: "INIT", seed: 7, scenario: "tracer" });
    const next = await adapter.request({ type: "ACCEPT_BRIEF" });
    reference.dispatch({ type: "ACCEPT_BRIEF" });
    expect(first.id).toBeLessThan(next.id);
    expect(next.view).toEqual(reference.view());
    expect(next.view.fsmState).toBe("DRAFT");
    adapter.dispose();
  });

  it("reports rejected commands as events instead of throwing", async () => {
    const adapter = createEngineAdapter();
    const res = await adapter.request({ type: "STEP_TICK" });
    expect(res.events.some((e) => e.type === "COMMAND_REJECTED")).toBe(true);
  });
});

describe("worker import graph (chunk cycle guard, #853)", () => {
  it("the worker imports the engine core and lib, never the adapter that constructs it", () => {
    const worker = read("components/protocol-drift/engine.worker.ts");
    const imports = [...worker.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["./engine-core"]);
    expect(worker).not.toMatch(/engine-adapter/);
    expect(worker).not.toMatch(/new Worker/);
  });

  it("the shared core imports only lib/protocol-drift and builds no Worker", () => {
    const core = read("components/protocol-drift/engine-core.ts");
    const imports = [...core.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["@/lib/protocol-drift"]);
    expect(core).not.toMatch(/new Worker/);
  });

  it("only the adapter constructs the worker, with a literal URL", () => {
    const adapter = read("components/protocol-drift/engine-adapter.ts");
    expect(adapter).toContain(
      'new Worker(new URL("./engine.worker.ts", import.meta.url))'
    );
  });

  it("neither lib/protocol-drift nor the worker touches the DOM or Web Audio", () => {
    for (const file of [
      "components/protocol-drift/engine.worker.ts",
      "components/protocol-drift/engine-core.ts",
    ]) {
      expect(read(file)).not.toMatch(
        /\b(document|window|AudioContext|localStorage)\b/
      );
    }
  });
});
