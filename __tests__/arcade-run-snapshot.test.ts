import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fromPartial } from "@total-typescript/shoehorn";
import {
  clearRunSnapshot,
  readRunSnapshot,
  runSnapshotKey,
  writeRunSnapshot,
  type RunSnapshot,
  type RunSnapshotStorage,
} from "@/lib/arcade";

function memoryStorage(): RunSnapshotStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

const format = {
  schema: 2,
  state: z.object({ score: z.number(), wave: z.number().int() }),
};

const run: RunSnapshot<{ score: number; wave: number }> = {
  schema: 2,
  savedAt: 1_700_000_000_000,
  view: "phone",
  tuning: { aimAssist: 0.4, haptics: true },
  state: { score: 1200, wave: 3 },
};

describe("run snapshot (#2357)", () => {
  it("uses one versioned key per game", () => {
    expect(runSnapshotKey("laser-loon")).toBe("arcade_run_laser-loon_v1");
  });

  it("round-trips a run", () => {
    const storage = memoryStorage();
    expect(writeRunSnapshot(storage, "loon", run)).toBe(true);
    expect(readRunSnapshot(storage, "loon", format)).toEqual({
      status: "ok",
      snapshot: run,
    });
  });

  it("round-trips the stream state and step (#2544)", () => {
    const storage = memoryStorage();
    const seeded = { ...run, rngState: 0xfedcba98, step: 4321 };
    writeRunSnapshot(storage, "loon", seeded);
    expect(readRunSnapshot(storage, "loon", format)).toEqual({
      status: "ok",
      snapshot: seeded,
    });
  });

  it("still reads a v1 save written before rngState and step existed", () => {
    const storage = memoryStorage();
    storage.setItem(runSnapshotKey("loon"), JSON.stringify(run));
    const read = readRunSnapshot(storage, "loon", format);
    expect(read).toEqual({ status: "ok", snapshot: run });
    if (read.status !== "ok") throw new Error("expected a save");
    expect("rngState" in read.snapshot).toBe(false);
    expect("step" in read.snapshot).toBe(false);
  });

  it("reads nothing when there is no save or no storage", () => {
    expect(readRunSnapshot(memoryStorage(), "loon", format)).toEqual({
      status: "empty",
    });
    expect(readRunSnapshot(null, "loon", format)).toEqual({ status: "empty" });
    expect(writeRunSnapshot(null, "loon", run)).toBe(false);
  });

  it("discards a save from another schema version", () => {
    const storage = memoryStorage();
    writeRunSnapshot(storage, "loon", { ...run, schema: 1 });
    expect(readRunSnapshot(storage, "loon", format)).toEqual({
      status: "discarded",
      reason: "schema",
    });
    expect(storage.data.size).toBe(0);
  });

  it.each([
    ["broken JSON", "{not json"],
    ["a non-object", "42"],
    ["a missing state", JSON.stringify({ ...run, state: undefined })],
    ["an unknown view", JSON.stringify({ ...run, view: "watch" })],
    ["bad tuning", JSON.stringify({ ...run, tuning: { aim: "high" } })],
    ["a state that fails its schema", JSON.stringify({ ...run, state: {} })],
    ["a negative rngState", JSON.stringify({ ...run, rngState: -1 })],
    ["a 33-bit rngState", JSON.stringify({ ...run, rngState: 2 ** 32 })],
    ["a string rngState", JSON.stringify({ ...run, rngState: "7" })],
    ["a fractional step", JSON.stringify({ ...run, step: 1.5 })],
    ["a negative step", JSON.stringify({ ...run, step: -3 })],
  ])("discards %s without throwing", (_label, raw) => {
    const storage = memoryStorage();
    storage.setItem(runSnapshotKey("loon"), raw);
    expect(readRunSnapshot(storage, "loon", format)).toEqual({
      status: "discarded",
      reason: "parse",
    });
    expect(storage.data.size).toBe(0);
  });

  it("discards a save whose state parser throws", () => {
    const storage = memoryStorage();
    writeRunSnapshot(storage, "loon", run);
    const throwing = {
      schema: 2,
      state: fromPartial<typeof format.state>({
        safeParse: () => {
          throw new Error("boom");
        },
      }),
    };
    expect(readRunSnapshot(storage, "loon", throwing).status).toBe("discarded");
  });

  it("never throws on a storage that throws", () => {
    const blocked: RunSnapshotStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    expect(readRunSnapshot(blocked, "loon", format)).toEqual({
      status: "empty",
    });
    expect(writeRunSnapshot(blocked, "loon", run)).toBe(false);
    expect(() => clearRunSnapshot(blocked, "loon")).not.toThrow();
  });
});
