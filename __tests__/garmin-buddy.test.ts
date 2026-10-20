// @vitest-environment node
import { describe, it, expect } from "vitest";
import { BUDDY_SPEED, isEdibleFoe } from "@/lib/garmin/buddy";
import {
  EMPTY_COURSE,
  generateStage,
  type CourseLayout,
} from "@/lib/garmin/course";
import type { FoeKind, FoeMode } from "@/lib/garmin/foes";
import {
  PICKUP_EMERGE_MS,
  blockReward,
  collectTier,
  emergePickup,
  stepPickups,
  type Pickup,
  type PowerTier,
} from "@/lib/garmin/powerups";
import { themeForStage, isWaterTheme } from "@/lib/garmin/themes";

/** Lane top used by the engine (GROUND_Y in lib/garmin/engine.ts). */
const GROUND_Y = 205;
const STAGES = [1, 2, 3, 4, 5];
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);
const FRAME_MS = 16.666;
const CANVAS_SIZE = 240;

const ALL_KINDS: FoeKind[] = [
  "kettlebell",
  "alert",
  "box",
  "lap",
  "repmax",
  "jellyfish",
  "goggles",
];
const ALL_MODES: FoeMode[] = [
  "walk",
  "shell",
  "kicked",
  "fly",
  "idle",
  "drift",
];
const EDIBLE: readonly FoeKind[] = ["kettlebell", "alert", "box", "lap"];
const TIERS: (PowerTier | undefined)[] = [
  undefined,
  "base",
  "buff",
  "heatmap",
  "cape",
  "trisuit",
];

const pickup = (over: Partial<Pickup> = {}): Pickup => ({
  id: 1,
  kind: "buddy",
  x: 100,
  y: GROUND_Y - 12,
  vx: 0,
  vy: 0,
  emergeMs: 0,
  ...over,
});

describe("isEdibleFoe", () => {
  it("eats the small foes on every mode except drift", () => {
    for (const kind of ALL_KINDS) {
      for (const mode of ALL_MODES) {
        const expected = mode !== "drift" && EDIBLE.includes(kind);
        expect(isEdibleFoe({ kind, mode })).toBe(expected);
      }
    }
  });

  it("eats a kettlebell, alert, box and lap on a walking or flying foe", () => {
    expect(isEdibleFoe({ kind: "kettlebell", mode: "walk" })).toBe(true);
    expect(isEdibleFoe({ kind: "alert", mode: "fly" })).toBe(true);
    expect(isEdibleFoe({ kind: "box", mode: "walk" })).toBe(true);
    expect(isEdibleFoe({ kind: "lap", mode: "idle" })).toBe(true);
  });

  it("never eats a Rep Max", () => {
    for (const mode of ALL_MODES) {
      expect(isEdibleFoe({ kind: "repmax", mode })).toBe(false);
    }
  });

  it("never eats a jellyfish or goggles, whatever the mode", () => {
    for (const mode of ALL_MODES) {
      expect(isEdibleFoe({ kind: "jellyfish", mode })).toBe(false);
      expect(isEdibleFoe({ kind: "goggles", mode })).toBe(false);
    }
  });

  it("never eats a drifting foe", () => {
    expect(isEdibleFoe({ kind: "kettlebell", mode: "drift" })).toBe(false);
  });
});

describe("blockReward buddy", () => {
  it("hatches a buddy from a buddy block at every tier", () => {
    for (const tier of TIERS) {
      expect(blockReward("buddy", tier)).toBe("buddy");
    }
  });
});

describe("emergePickup buddy", () => {
  it("runs off at the buddy speed after emerging", () => {
    const block = {
      id: 5,
      x: 300,
      y: 160,
      kind: "sync" as const,
      contents: "buddy" as const,
      used: true,
    };
    const p = emergePickup("buddy", block, 9);
    expect(p.kind).toBe("buddy");
    expect(p.vx).toBe(BUDDY_SPEED);
    expect(p.emergeMs).toBe(PICKUP_EMERGE_MS);
    expect(p.ttlMs).toBeUndefined();
  });
});

describe("collectTier buddy", () => {
  it("leaves every tier as it is", () => {
    for (const tier of TIERS) {
      expect(collectTier(tier, "buddy")).toBe(tier ?? "base");
    }
  });

  it("does not turn a Base runner into a Buff runner", () => {
    expect(collectTier(undefined, "buddy")).toBe("base");
    expect(collectTier("base", "buddy")).toBe("base");
  });
});

describe("stepPickups ttlMs", () => {
  const course: CourseLayout = { ...EMPTY_COURSE };

  it("counts a runaway buddy's time down by the frame delta", () => {
    const [next] = stepPickups(
      [pickup({ ttlMs: 500, vx: 0 })],
      course,
      GROUND_Y,
      0,
      CANVAS_SIZE,
      FRAME_MS
    );
    expect(next.ttlMs).toBeCloseTo(500 - FRAME_MS);
  });

  it("drops a runaway buddy when its time reaches zero", () => {
    const next = stepPickups(
      [pickup({ ttlMs: 100 })],
      course,
      GROUND_Y,
      0,
      CANVAS_SIZE,
      100
    );
    expect(next).toEqual([]);
  });

  it("drops a runaway buddy when its time runs past zero", () => {
    const next = stepPickups(
      [pickup({ ttlMs: 10 })],
      course,
      GROUND_Y,
      0,
      CANVAS_SIZE,
      FRAME_MS
    );
    expect(next).toEqual([]);
  });

  it("keeps a pickup without a ttlMs and adds none", () => {
    const [next] = stepPickups(
      [pickup()],
      course,
      GROUND_Y,
      0,
      CANVAS_SIZE,
      FRAME_MS
    );
    expect("ttlMs" in next).toBe(false);
    expect(next.id).toBe(1);
  });

  it("counts down a runaway buddy's time while it is still rising", () => {
    const [next] = stepPickups(
      [pickup({ ttlMs: 500, emergeMs: 300 })],
      course,
      GROUND_Y,
      0,
      CANVAS_SIZE,
      FRAME_MS
    );
    expect(next.ttlMs).toBeCloseTo(500 - FRAME_MS);
  });
});

describe("generateStage Running Buddy block", () => {
  const landStages = STAGES.filter((s) => !isWaterTheme(themeForStage(s)));
  const waterStages = STAGES.filter((s) => isWaterTheme(themeForStage(s)));

  it("water stages hold no buddy block", () => {
    for (const s of waterStages) {
      for (const seed of SEEDS) {
        const layout = generateStage(s, seed, GROUND_Y, themeForStage(s));
        expect(layout.blocks.some((b) => b.contents === "buddy")).toBe(false);
      }
    }
  });

  it("land stages hold at most one buddy block, on a Sync Block", () => {
    for (const s of landStages) {
      for (const seed of SEEDS) {
        const buddies = generateStage(
          s,
          seed,
          GROUND_Y,
          themeForStage(s)
        ).blocks.filter((b) => b.contents === "buddy");
        expect(buddies.length).toBeLessThanOrEqual(1);
        for (const b of buddies) expect(b.kind).toBe("sync");
      }
    }
  });

  it("the buddy appears on some land stages across seeds but not all", () => {
    for (const s of landStages) {
      const counts = SEEDS.map(
        (seed) =>
          generateStage(s, seed, GROUND_Y, themeForStage(s)).blocks.filter(
            (b) => b.contents === "buddy"
          ).length
      );
      expect(counts).toContain(1);
      expect(counts).toContain(0);
    }
  });

  it("is deterministic for the same seed", () => {
    for (const s of landStages) {
      const a = generateStage(s, 7, GROUND_Y, themeForStage(s));
      const b = generateStage(s, 7, GROUND_Y, themeForStage(s));
      expect(a.blocks).toEqual(b.blocks);
    }
  });
});
