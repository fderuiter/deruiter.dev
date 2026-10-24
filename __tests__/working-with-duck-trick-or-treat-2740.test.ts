// @vitest-environment node
// #2740: in Halloween mode, trick-or-treaters ring at the back door in the
// package's place. A Sit sends them off happy and pays what signing for the
// package pays, so a sprint is worth the same in or out of Halloween mode.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createInitialDuckGameState,
  performTrick,
  stepDuckGame,
  TRICK_OR_TREAT_SIT_POINTS,
  type WorkingWithDuckState,
} from "@/lib/working-with-duck-engine";
import { drawTrickOrTreaters } from "@/components/working-with-duck/halloween-art";
import { drawOfficeScene } from "@/components/working-with-duck/office-art";

/** The campaign's surprise roll comes due on this tick (sprint 1). */
const SURPRISE_TICK = 520;

/** A calm, running sprint 1 one tick before the surprise roll. */
function beforeSurprise(halloween?: boolean): WorkingWithDuckState {
  const base = createInitialDuckGameState(1);
  return {
    ...base,
    status: "running",
    ticks: SURPRISE_TICK - 1,
    lastImpulseTick: SURPRISE_TICK - 1,
    excitement: 0,
    bladder: 0,
    thirst: 0,
    hunger: 0,
    duck: { ...base.duck, state: "IDLE_ROAM", stateTimer: 200 },
    ...(halloween === undefined ? {} : { halloween }),
  };
}

/** Deterministic Math.random so each seed replays the same sprint. */
function seedRandom(seed: number) {
  let value = seed;
  vi.spyOn(Math, "random").mockImplementation(() => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  });
}

/** Plays sprint 1 with no input, counting the door visits it saw. */
function playIdle(halloween: boolean) {
  let state: WorkingWithDuckState = {
    ...createInitialDuckGameState(1),
    status: "running",
    halloween,
  };
  let visits = 0;
  for (let t = 0; t < 60 * 300 && state.status === "running"; t++) {
    const before = state.activeSurpriseEvent;
    state = stepDuckGame(state);
    if (!before && state.activeSurpriseEvent?.type === "trick-or-treat") {
      visits += 1;
    }
  }
  return { state, visits };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Working With Duck trick-or-treaters (#2740)", () => {
  it("rings the trick-or-treaters in Halloween mode where the package would knock", () => {
    // A roll under one half is the package's slot on sprint 1.
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const halloween = stepDuckGame(beforeSurprise(true));
    expect(halloween.activeSurpriseEvent).toMatchObject({
      type: "trick-or-treat",
      timer: 300,
      maxTimer: 300,
    });
    expect(halloween.soundCueQueue).toContain("door-knock");
    expect(
      halloween.floatingAlerts.some((a) => a.text.includes("Trick-or-treaters"))
    ).toBe(true);

    for (const off of [beforeSurprise(false), beforeSurprise()]) {
      expect(stepDuckGame(off).activeSurpriseEvent?.type).toBe(
        "amazon-delivery"
      );
    }
  });

  it("leaves the squirrel's slot to the squirrel", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    expect(stepDuckGame(beforeSurprise(true)).activeSurpriseEvent?.type).toBe(
      "squirrel-window"
    );
  });

  it("pays a Sit at the door in full and sends the kids off", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const atDoor = stepDuckGame(beforeSurprise(true));
    const sat = performTrick(atDoor, "SIT");
    expect(sat.activeSurpriseEvent).toBeNull();
    expect(sat.soundCueQueue).toContain("combo-fanfare");
    // A calm Duck's Sit pays almost nothing on its own; the visit pays the rest.
    const plainSit = performTrick(
      { ...atDoor, activeSurpriseEvent: null },
      "SIT"
    );
    expect(sat.totalScore - plainSit.totalScore).toBeGreaterThanOrEqual(
      TRICK_OR_TREAT_SIT_POINTS
    );
    expect(sat.comboStreak).toBe(atDoor.comboStreak + 1);
  });

  it("lets the kids leave unanswered with no penalty, as an unsigned package", () => {
    const leaving: WorkingWithDuckState = {
      ...beforeSurprise(true),
      ticks: 100,
      naughtyVsGood: 50,
      activeSurpriseEvent: {
        type: "trick-or-treat",
        timer: 1,
        maxTimer: 300,
        resolved: false,
      },
    };
    const after = stepDuckGame(leaving);
    expect(after.activeSurpriseEvent).toBeNull();
    expect(after.naughtyVsGood).toBe(
      stepDuckGame({ ...leaving, activeSurpriseEvent: null }).naughtyVsGood
    );
  });

  it("plays an idle sprint to the same result in and out of Halloween mode", () => {
    let visits = 0;
    for (const seed of [1, 7, 42]) {
      seedRandom(seed);
      const plain = playIdle(false).state;
      vi.restoreAllMocks();
      seedRandom(seed);
      const run = playIdle(true);
      const spooky = run.state;
      visits += run.visits;
      vi.restoreAllMocks();
      expect(spooky.status).toBe(plain.status);
      expect(spooky.ticks).toBe(plain.ticks);
      expect(spooky.totalScore).toBe(plain.totalScore);
      expect(spooky.workProgress).toBe(plain.workProgress);
    }
    // The comparison means something only if the kids came to the door.
    expect(visits).toBeGreaterThan(0);
  });
});

/** A canvas context that records each call with its arguments. */
function recordingContext() {
  const calls: Array<[string, unknown[]]> = [];
  const ctx = new Proxy(
    {},
    {
      get(_target, prop: string) {
        // No drawImage, so the office paints its flat floor, not a cached room.
        if (prop === "drawImage") return undefined;
        if (
          prop === "createRadialGradient" ||
          prop === "createLinearGradient"
        ) {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === "measureText") return () => ({ width: 8 });
        return (...args: unknown[]) => {
          calls.push([prop, args]);
        };
      },
      set() {
        return true;
      },
    }
  ) as CanvasRenderingContext2D;
  return { ctx, calls };
}

describe("Trick-or-treater art (#2740)", () => {
  it("draws the kids, and holds them still under reduced motion", () => {
    const at = (ticks: number, calm: boolean) => {
      const { ctx, calls } = recordingContext();
      drawTrickOrTreaters(ctx, 690, 466, ticks, calm);
      return calls.filter(([name]) => name === "translate");
    };
    expect(at(0, false).length).toBeGreaterThanOrEqual(3);
    expect(at(10, true)).toEqual(at(40, true));
    expect(at(10, false)).not.toEqual(at(40, false));
  });

  it("names Sit at the door, by key off touch and in words on touch", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    const state = stepDuckGame(beforeSurprise(true));
    const texts = (touchHints: boolean) => {
      const { ctx, calls } = recordingContext();
      drawOfficeScene(ctx, state, 1, touchHints, true);
      return calls
        .filter(([name]) => name === "fillText")
        .map(([, args]) => args[0]);
    };
    expect(texts(false)).toContain("Q: Sit for the trick-or-treaters");
    expect(texts(true)).toContain("Sit for the trick-or-treaters");
    expect(texts(false)).not.toContain("D: sign for the package");
  });
});
