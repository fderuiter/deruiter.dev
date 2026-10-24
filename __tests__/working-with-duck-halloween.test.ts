// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DUCK_HALLOWEEN_COSTUMES,
  advanceToNextLevel,
  createInitialDuckGameState,
  equipAccessory,
  isHalloweenCostume,
  isHalloweenSeason,
  stepDuckGame,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import { DuckCommandInputSchema } from "@/lib/services";
import {
  HALLOWEEN_KEY,
  getHalloweenSnapshot,
  resolveHalloweenMode,
  setHalloweenMode,
  subscribeHalloween,
} from "@/components/working-with-duck/halloween";
import {
  drawCostumeBody,
  drawCostumeHead,
  drawHalloweenOffice,
  lanternGlow,
} from "@/components/working-with-duck/halloween-art";
import { drawDuck } from "@/components/working-with-duck/office-art";

/** A seeded stand-in for Math.random, so two runs see the same rolls. */
function seededRandom(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runSprint(state: WorkingWithDuckState, ticks: number) {
  const random = seededRandom(2737);
  const spy = vi.spyOn(Math, "random").mockImplementation(random);
  let next: WorkingWithDuckState = { ...state, status: "running" };
  for (let i = 0; i < ticks; i++) next = stepDuckGame(next);
  spy.mockRestore();
  return next;
}

describe("Working With Duck Halloween costumes (#2737)", () => {
  it("lists the duck costume, witch hat and vampire cape as costumes", () => {
    expect([...DUCK_HALLOWEEN_COSTUMES]).toEqual([
      "duck-costume",
      "witch-hat",
      "vampire-cape",
    ]);
    for (const costume of DUCK_HALLOWEEN_COSTUMES) {
      expect(isHalloweenCostume(costume)).toBe(true);
    }
    expect(isHalloweenCostume("bucket-hat")).toBe(false);
    expect(isHalloweenCostume("none")).toBe(false);
  });

  it("lets Duck wear a costume without unlocking it", () => {
    const state = createInitialDuckGameState(1);
    expect(state.unlockedAccessories).not.toContain("duck-costume");
    const dressed = equipAccessory(state, "duck-costume");
    expect(dressed.activeAccessory).toBe("duck-costume");
    expect(dressed.soundCueQueue).toContain("ding");
  });

  it("still keeps earned accessories locked until they are earned", () => {
    const state = createInitialDuckGameState(1);
    expect(state.unlockedAccessories).not.toContain("graduation-hat");
    expect(equipAccessory(state, "graduation-hat")).toBe(state);
  });

  it("keeps the costume on into the next sprint", () => {
    const won = {
      ...equipAccessory(createInitialDuckGameState(1), "vampire-cape"),
      status: "won" as const,
    };
    const next = advanceToNextLevel(won);
    expect(next.currentLevel).toBe(2);
    expect(next.activeAccessory).toBe("vampire-cape");
  });

  it("gives no perk: a costumed sprint plays exactly like a bare-coated one", () => {
    const bare = createInitialDuckGameState(2);
    for (const costume of DUCK_HALLOWEEN_COSTUMES) {
      const plain = runSprint(bare, 900);
      const dressed = runSprint(equipAccessory(bare, costume), 900);
      expect({
        ...dressed,
        activeAccessory: "none",
        soundCueQueue: [],
      }).toEqual({ ...plain, soundCueQueue: [] });
    }
  });

  it("accepts every costume through the dispatch-command contract", () => {
    const state = createInitialDuckGameState(1);
    const parse = (accessory: string) =>
      DuckCommandInputSchema.safeParse({ type: "accessory", state, accessory })
        .success;
    for (const costume of DUCK_HALLOWEEN_COSTUMES) {
      expect(parse(costume)).toBe(true);
    }
    expect(parse("ghost-sheet")).toBe(false);
  });
});

describe("Halloween mode preference (#2737)", () => {
  afterEach(() => {
    localStorage.removeItem(HALLOWEEN_KEY);
  });

  it("calls the whole of October Halloween season, and nothing either side", () => {
    expect(isHalloweenSeason(new Date(2026, 9, 1))).toBe(true);
    expect(isHalloweenSeason(new Date(2026, 9, 31, 23, 59))).toBe(true);
    expect(isHalloweenSeason(new Date(2026, 8, 30, 23, 59))).toBe(false);
    expect(isHalloweenSeason(new Date(2026, 10, 1))).toBe(false);
  });

  it("follows the calendar until the player chooses, then the choice wins", () => {
    const october = new Date(2026, 9, 24);
    const june = new Date(2026, 5, 1);
    expect(resolveHalloweenMode(null, october)).toBe(true);
    expect(resolveHalloweenMode(null, june)).toBe(false);
    expect(resolveHalloweenMode("off", october)).toBe(false);
    expect(resolveHalloweenMode("on", june)).toBe(true);
    // Anything else in storage counts as no choice.
    expect(resolveHalloweenMode("maybe", june)).toBe(false);
  });

  it("saves the choice and tells this tab's subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHalloween(listener);
    setHalloweenMode(false);
    expect(localStorage.getItem(HALLOWEEN_KEY)).toBe("off");
    expect(getHalloweenSnapshot()).toBe(false);
    setHalloweenMode(true);
    expect(localStorage.getItem(HALLOWEEN_KEY)).toBe("on");
    expect(getHalloweenSnapshot()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setHalloweenMode(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

/** A canvas context that records every call by name. */
function recordingContext() {
  const calls: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (
          prop === "createRadialGradient" ||
          prop === "createLinearGradient"
        ) {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === "measureText") return () => ({ width: 8 });
        return () => {
          calls.push(prop);
        };
      },
      set() {
        return true;
      },
    }
  ) as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe("Halloween art (#2737)", () => {
  const body = { x: 0, y: 0, rx: 28, ry: 16, tilt: 0 };

  it("paints the duck suit and cape on the body pass, and nothing for a hat", () => {
    for (const kind of ["duck-costume", "vampire-cape"] as const) {
      const { ctx, calls } = recordingContext();
      drawCostumeBody(ctx, kind, body, [21, -4]);
      expect(calls).toContain("fill");
    }
    for (const kind of ["witch-hat", "bowtie", "none"] as const) {
      const { ctx, calls } = recordingContext();
      drawCostumeBody(ctx, kind, body, [21, -4]);
      expect(calls).toEqual([]);
    }
  });

  it("puts a webbed bootie on every paw with the duck hood", () => {
    const feet: Array<[number, number]> = [
      [-20, 23],
      [14, 23],
      [-14, 22],
      [20, 22],
    ];
    const hoodOnly = recordingContext();
    drawCostumeHead(hoodOnly.ctx, "duck-costume", {
      head: [28, -16],
      headTilt: 0,
      feet: [],
    });
    const withFeet = recordingContext();
    drawCostumeHead(withFeet.ctx, "duck-costume", {
      head: [28, -16],
      headTilt: 0,
      feet,
    });
    const fills = (calls: string[]) => calls.filter((c) => c === "fill").length;
    expect(fills(withFeet.calls) - fills(hoodOnly.calls)).toBe(feet.length);
  });

  it("draws every costume on Duck in every pose without throwing", () => {
    const poses = [
      ["IDLE_ROAM", null],
      ["SNIFFING_POTTY", null],
      ["ZOOMIES", null],
      ["PERFORMING_TRICK", "SIT"],
      ["NAP_TIME", null],
    ] as const;
    for (const costume of DUCK_HALLOWEEN_COSTUMES) {
      for (const [state, trick] of poses) {
        const { ctx } = recordingContext();
        expect(() =>
          drawDuck(
            ctx,
            { x: 400, y: 250, angle: 0, state, isCarryingBall: false },
            { ticks: 120, accessory: costume, trick, trickProgress: 0.5 }
          )
        ).not.toThrow();
      }
    }
  });

  it("dresses the office with cobwebs, bats and lit lanterns", () => {
    const { ctx, calls } = recordingContext();
    drawHalloweenOffice(ctx, 60, false);
    expect(calls).toContain("quadraticCurveTo");
    expect(calls.filter((c) => c === "fill").length).toBeGreaterThan(20);
  });

  it("holds the lanterns steady under reduced motion and keeps the flicker gentle", () => {
    expect(lanternGlow(0, 1, true)).toBe(lanternGlow(500, 1, true));
    for (let t = 0; t < 600; t += 7) {
      const glow = lanternGlow(t, 1.7, false);
      expect(glow).toBeGreaterThanOrEqual(0.58);
      expect(glow).toBeLessThanOrEqual(0.98);
    }
  });
});
