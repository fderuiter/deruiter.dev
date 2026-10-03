// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ProtocolDriftSaveError,
  WAVE1_GRAPH,
  deserializeSave,
  restoreProtocolDriftEngine,
  serializeSave,
  type ProtocolDriftEngine,
  type ProtocolDriftSaveFile,
} from "@/lib/protocol-drift";
import { ok, publish, startEngine } from "./helpers";

function save(engine: ProtocolDriftEngine): ProtocolDriftSaveFile {
  const e = ok(engine, {
    type: "EXPORT_SAVE",
    savedAt: "2026-01-01T00:00:00Z",
  }).find((x) => x.type === "SAVE_EXPORTED");
  if (!e || e.type !== "SAVE_EXPORTED") throw new Error("no save");
  return e.save;
}

describe("save files", () => {
  const engine = startEngine();
  publish(engine, WAVE1_GRAPH, "p1");
  ok(engine, { type: "SET_PAUSED", isPaused: false });
  for (let i = 0; i < 40; i += 1)
    engine.dispatch({ type: "TICK", realMs: 1000 });
  const file = save(engine);

  it("records format, version, seed, merged commands and a state hash", () => {
    expect(file).toMatchObject({
      format: "pd-101-save-v1",
      version: 1,
      seed: 48291,
      scenario: "full",
      savedAt: "2026-01-01T00:00:00Z",
    });
    expect(file.commands.filter((c) => c.type === "TICK")).toHaveLength(1);
    expect(file.commands.some((c) => c.type === "EXPORT_SAVE")).toBe(false);
    expect(file.stateHash).toBe(engine.stateHash());
  });

  it("round-trips through JSON and replays to the same state", () => {
    const restored = restoreProtocolDriftEngine(
      deserializeSave(serializeSave(file))
    );
    expect(restored.stateHash()).toBe(engine.stateHash());
    expect(restored.view().vsLedger).toEqual(engine.view().vsLedger);
    expect(restored.view().minute).toBe(engine.view().minute);
  });

  it("rejects malformed, unsupported or tampered saves", () => {
    expect(() => deserializeSave("{")).toThrow(ProtocolDriftSaveError);
    expect(() => deserializeSave("3")).toThrow(/JSON object/);
    expect(() =>
      deserializeSave(JSON.stringify({ ...file, format: "other" }))
    ).toThrow(/format/);
    expect(() =>
      deserializeSave(JSON.stringify({ ...file, version: 2 }))
    ).toThrow(/version: 2/);
    expect(() =>
      deserializeSave(JSON.stringify({ ...file, commands: null }))
    ).toThrow(/missing/);
    expect(() =>
      restoreProtocolDriftEngine({ ...file, stateHash: "deadbeef" })
    ).toThrow(/state hash/);
  });
});
