import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  EMPTY_RUN_TAGS,
  arcadeCoreSlice,
  assistLabel,
  compareRunTags,
  createRunFairness,
  isUnassisted,
  mergeArcadeProgress,
  noteRunInput,
  noteRunView,
  parseRunTags,
  readRunSnapshot,
  runAssists,
  startRunTags,
  writeRunSnapshot,
  type ArcadeProgress,
  type FairnessPolicy,
  type RunSnapshotStorage,
  type RunTags,
} from "@/lib/arcade";
import {
  getArcadeProgress,
  recordArcadeScore,
} from "@/lib/arcade-achievements";

// The run-fairness contract (#2547): tuning keys on the input, assists
// ratchet within a run, and the run records every view and input it used.

/** Laser Loon's shape from #2446: touch aims for you and fires on hold. */
const policy: FairnessPolicy = {
  levels: {
    aimAssist: ["off", "light", "strong"],
    autoFire: [false, true],
  },
  assistsFor: (input): Record<string, string | boolean> =>
    input === "touch"
      ? { aimAssist: "strong", autoFire: true }
      : input === "pen"
        ? { aimAssist: "light" }
        : {},
};

describe("run tags: the ratchet", () => {
  it("starts a touch run with the touch assists and a keyboard run with none", () => {
    expect(startRunTags("phone", "touch", policy)).toEqual({
      views: ["phone"],
      inputs: ["touch"],
      assists: { aimAssist: "strong", autoFire: true },
    });
    expect(startRunTags("desktop", "keyboard", policy)).toEqual({
      views: ["desktop"],
      inputs: ["keyboard"],
      assists: {},
    });
  });

  it("touch to keys keeps the assists", () => {
    const touch = startRunTags("tablet", "touch", policy);
    const keys = noteRunInput(touch, "keyboard", policy);
    expect(keys.assists).toEqual(touch.assists);
    expect(keys.inputs).toEqual(["touch", "keyboard"]);
    expect(runAssists(keys, policy)).toEqual({
      aimAssist: "strong",
      autoFire: true,
    });
  });

  it("keys to touch adds the assists and records the touch", () => {
    const keys = startRunTags("tablet", "keyboard", policy);
    const touch = noteRunInput(keys, "touch", policy);
    expect(touch.assists).toEqual({ aimAssist: "strong", autoFire: true });
    expect(touch.inputs).toEqual(["keyboard", "touch"]);
    expect(isUnassisted(keys)).toBe(true);
    expect(isUnassisted(touch)).toBe(false);
  });

  it("raises one assist at a time and never lowers it", () => {
    const pen = startRunTags("tablet", "pen", policy);
    expect(pen.assists).toEqual({ aimAssist: "light" });
    const touch = noteRunInput(pen, "touch", policy);
    expect(touch.assists).toEqual({ aimAssist: "strong", autoFire: true });
    const backToPen = noteRunInput(touch, "pen", policy);
    expect(backToPen.assists).toEqual(touch.assists);
  });

  it("a view swap alone changes nothing but the views", () => {
    const keys = startRunTags("desktop", "keyboard", policy);
    const narrowed = noteRunView(keys, "phone");
    expect(narrowed.assists).toEqual({});
    expect(narrowed.inputs).toEqual(["keyboard"]);
    expect(narrowed.views).toEqual(["desktop", "phone"]);
    expect(runAssists(narrowed, policy)).toEqual({
      aimAssist: "off",
      autoFire: false,
    });
  });

  it("returns the same record when nothing changes", () => {
    const tags = startRunTags("phone", "touch", policy);
    expect(noteRunView(tags, "phone")).toBe(tags);
    expect(noteRunInput(tags, "touch", policy)).toBe(tags);
    expect(noteRunInput(tags, "keyboard", policy)).not.toBe(tags);
  });

  it("ignores a setting the policy does not list", () => {
    const odd: FairnessPolicy = {
      levels: { aimAssist: ["off", "on"] },
      assistsFor: () => ({ aimAssist: "turbo", unknown: true }),
    };
    expect(startRunTags("phone", "touch", odd).assists).toEqual({});
  });
});

describe("run tags: labels and order", () => {
  it("labels an unassisted run and an assisted one", () => {
    expect(assistLabel(EMPTY_RUN_TAGS)).toBe("Unassisted");
    expect(assistLabel(startRunTags("phone", "touch", policy))).toBe(
      "Assisted: aim assist strong, auto fire"
    );
  });

  it("orders the less assisted record first, whichever side it is on", () => {
    const keys = startRunTags("desktop", "keyboard", policy);
    const touch = startRunTags("phone", "touch", policy);
    expect(compareRunTags(keys, touch)).toBeLessThan(0);
    expect(compareRunTags(touch, keys)).toBeGreaterThan(0);
    expect(compareRunTags(touch, { ...touch })).toBe(0);
  });
});

describe("run tags: parsing", () => {
  it("reads a well-formed record", () => {
    const tags = startRunTags("tablet", "touch", policy);
    expect(parseRunTags(JSON.parse(JSON.stringify(tags)))).toEqual(tags);
  });

  it.each([
    ["not an object", 7],
    ["an unknown view", { views: ["watch"], inputs: [], assists: {} }],
    [
      "a repeated input",
      { views: [], inputs: ["touch", "touch"], assists: {} },
    ],
    ["an unknown input", { views: [], inputs: ["gamepad"], assists: {} }],
    ["a numeric assist", { views: [], inputs: [], assists: { aim: 2 } }],
    ["assists that are a list", { views: [], inputs: [], assists: [] }],
    [
      "a prototype key",
      JSON.parse('{"views":[],"inputs":[],"assists":{"__proto__":true}}'),
    ],
  ])("drops %s", (_name, value) => {
    expect(parseRunTags(value)).toBeNull();
  });
});

describe("run tags: the fairness store", () => {
  it("notes views and inputs, ratchets, and resets for a new run", () => {
    const fairness = createRunFairness(policy);
    let heard = 0;
    const stop = fairness.subscribe(() => {
      heard += 1;
    });
    fairness.noteView("desktop");
    fairness.noteInput("keyboard");
    expect(fairness.getTags()).toEqual({
      views: ["desktop"],
      inputs: ["keyboard"],
      assists: {},
    });
    fairness.noteInput("touch");
    fairness.noteInput("keyboard");
    expect(fairness.assists()).toEqual({ aimAssist: "strong", autoFire: true });
    expect(heard).toBe(3);

    fairness.reset();
    expect(fairness.getTags()).toEqual({
      views: ["desktop"],
      inputs: ["keyboard"],
      assists: {},
    });
    stop();
    fairness.noteView("phone");
    expect(heard).toBe(4);
  });

  it("restores a saved run's ratchet and records how the run carries on", () => {
    const fairness = createRunFairness(policy);
    fairness.noteView("desktop");
    fairness.noteInput("keyboard");
    fairness.restore(startRunTags("phone", "touch", policy));
    expect(fairness.getTags()).toEqual({
      views: ["phone", "desktop"],
      inputs: ["touch", "keyboard"],
      assists: { aimAssist: "strong", autoFire: true },
    });
  });
});

function memoryStorage(): RunSnapshotStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

describe("run tags in the run snapshot", () => {
  const format = { schema: 1, state: z.object({ score: z.number() }) };
  const base = {
    schema: 1,
    savedAt: 1_700_000_000_000,
    view: "phone" as const,
    tuning: {},
    state: { score: 40 },
  };

  it("round-trips the tags", () => {
    const storage = memoryStorage();
    const tags = startRunTags("phone", "touch", policy);
    writeRunSnapshot(storage, "loon", { ...base, tags });
    expect(readRunSnapshot(storage, "loon", format)).toEqual({
      status: "ok",
      snapshot: { ...base, tags },
    });
  });

  it("still reads a save written before tags existed", () => {
    const storage = memoryStorage();
    writeRunSnapshot(storage, "loon", base);
    expect(readRunSnapshot(storage, "loon", format)).toEqual({
      status: "ok",
      snapshot: base,
    });
  });

  it("discards a save whose tags are damaged", () => {
    const storage = memoryStorage();
    storage.setItem(
      "arcade_run_loon_v1",
      JSON.stringify({ ...base, tags: { views: ["watch"] } })
    );
    expect(readRunSnapshot(storage, "loon", format)).toEqual({
      status: "discarded",
      reason: "parse",
    });
  });
});

describe("run tags with a best score", () => {
  const touch: RunTags = startRunTags("phone", "touch", policy);
  const keys: RunTags = startRunTags("desktop", "keyboard", policy);
  const progress = (score: number, tags?: RunTags): ArcadeProgress => ({
    highScores: { "laser-loon": score },
    ...(tags ? { bestTags: { "laser-loon": tags } } : {}),
    unlockedTrophies: {},
    updatedAt: 1,
  });

  it("keeps the record of the higher best", () => {
    const merged = mergeArcadeProgress(
      progress(900, touch),
      progress(500, keys)
    );
    expect(merged.bestTags).toEqual({ "laser-loon": touch });
    expect(
      mergeArcadeProgress(progress(500, keys), progress(900, touch))
    ).toEqual(merged);
  });

  it("on a tie keeps a record over none, then the unassisted one", () => {
    expect(
      mergeArcadeProgress(progress(700), progress(700, touch)).bestTags
    ).toEqual({ "laser-loon": touch });
    expect(
      mergeArcadeProgress(progress(700, touch), progress(700, keys)).bestTags
    ).toEqual({ "laser-loon": keys });
  });

  it("drops a record whose best lost", () => {
    const merged = mergeArcadeProgress(progress(900), progress(500, keys));
    expect(merged).not.toHaveProperty("bestTags");
  });

  it("parses stored records and leaves a value without them unchanged", () => {
    const stored = {
      ...progress(300, touch),
      bestTags: { "laser-loon": touch, bad: 4 },
    };
    expect(arcadeCoreSlice.validate(stored)?.bestTags).toEqual({
      "laser-loon": touch,
    });
    expect(Object.keys(arcadeCoreSlice.validate(progress(300)) ?? {})).toEqual([
      "highScores",
      "unlockedTrophies",
      "updatedAt",
    ]);
  });

  describe("recordArcadeScore", () => {
    beforeEach(() => localStorage.clear());
    afterEach(() => localStorage.clear());

    it("stores the record with a new best and drops it for an untagged one", () => {
      recordArcadeScore("laser-loon", 400, undefined, touch);
      expect(getArcadeProgress().bestTags).toEqual({ "laser-loon": touch });
      recordArcadeScore("laser-loon", 300, undefined, keys);
      expect(getArcadeProgress().bestTags).toEqual({ "laser-loon": touch });
      recordArcadeScore("laser-loon", 500);
      expect(getArcadeProgress().highScores["laser-loon"]).toBe(500);
      expect(getArcadeProgress().bestTags).toBeUndefined();
    });
  });
});
