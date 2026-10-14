import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETUP,
  PAR_SECONDS,
  assistInput,
  bestTimeFor,
  bestTimeKey,
  clockLabel,
  createLevel,
  isNewBestTime,
  minutesUnderPar,
  parFor,
  parseBestTimes,
  recordBestTime,
  serializeBestTimes,
  stepGame,
  type Frame,
  type GameState,
  type PlayerInput,
  type Setup,
} from "@/lib/for-better-or-bulk";

const RELAXED: Setup = { ...DEFAULT_SETUP, relaxed: true };

describe("par lookup (#2056)", () => {
  it("gives the standard and relaxed pars for the default plan on the standard day", () => {
    expect(parFor(DEFAULT_SETUP)).toBe(PAR_SECONDS.standard);
    expect(parFor(RELAXED)).toBe(PAR_SECONDS.relaxed);
    expect(clockLabel(PAR_SECONDS.standard, 200)).toBe("1:12");
    expect(clockLabel(PAR_SECONDS.relaxed, 330)).toBe("12:36");
  });

  it("is the same whoever plays and whatever order the features were picked in", () => {
    expect(parFor({ ...DEFAULT_SETUP, assist: true })).toBe(120);
    expect(parFor({ ...DEFAULT_SETUP, capabilities: ["admin", "faq"] })).toBe(
      120
    );
  });

  it("has no par on a seeded day or another plan", () => {
    expect(parFor({ ...DEFAULT_SETUP, seed: 4242 })).toBeNull();
    expect(parFor({ ...RELAXED, seed: 4242 })).toBeNull();
    expect(
      parFor({
        ...DEFAULT_SETUP,
        cart: { ...DEFAULT_SETUP.cart, roses: "yes" },
      })
    ).toBeNull();
    expect(
      parFor({ ...DEFAULT_SETUP, capabilities: ["faq", "registry"] })
    ).toBeNull();
  });
});

describe("best time keys (#2056)", () => {
  it("keeps each timer, each seed and each plan apart", () => {
    const keys = new Set([
      bestTimeKey(DEFAULT_SETUP),
      bestTimeKey(RELAXED),
      bestTimeKey({ ...DEFAULT_SETUP, seed: 4242 }),
      bestTimeKey({ ...RELAXED, seed: 4242 }),
      bestTimeKey({ ...DEFAULT_SETUP, seed: 12345 }),
      bestTimeKey({
        ...DEFAULT_SETUP,
        cart: { ...DEFAULT_SETUP.cart, lanterns: false },
      }),
    ]);
    expect(keys.size).toBe(6);
  });

  it("ignores the helper, and treats a missing seed as the standard day", () => {
    const { seed: _seed, ...noSeed } = DEFAULT_SETUP;
    expect(bestTimeKey({ ...DEFAULT_SETUP, assist: true })).toBe(
      bestTimeKey(DEFAULT_SETUP)
    );
    expect(bestTimeKey(noSeed)).toBe(bestTimeKey(DEFAULT_SETUP));
    expect(
      bestTimeKey({ ...DEFAULT_SETUP, capabilities: ["admin", "faq"] })
    ).toBe(bestTimeKey(DEFAULT_SETUP));
  });

  it("reads a seeded day's best only for that seed", () => {
    const seeded: Setup = { ...DEFAULT_SETUP, seed: 4242 };
    const { times } = recordBestTime({}, seeded, 130);
    expect(bestTimeFor(times, seeded)).toBe(130);
    expect(bestTimeFor(times, { ...DEFAULT_SETUP, seed: 9999 })).toBeNull();
    expect(bestTimeFor(times, DEFAULT_SETUP)).toBeNull();
    expect(bestTimeFor(times, { ...seeded, relaxed: true })).toBeNull();
  });
});

describe("best time comparison (#2056)", () => {
  it("counts a first finish and a faster finish as new bests, and a tie or a slower one as not", () => {
    expect(isNewBestTime(null, 150)).toBe(true);
    expect(isNewBestTime(150, 149.9)).toBe(true);
    expect(isNewBestTime(150, 150)).toBe(false);
    expect(isNewBestTime(150, 151)).toBe(false);
  });

  it("records a faster time, and keeps the old best for a slower one", () => {
    const first = recordBestTime({}, DEFAULT_SETUP, 140);
    expect(first.record).toEqual({
      time: 140,
      previous: null,
      best: 140,
      isNew: true,
    });
    const faster = recordBestTime(first.times, DEFAULT_SETUP, 118);
    expect(faster.record).toEqual({
      time: 118,
      previous: 140,
      best: 118,
      isNew: true,
    });
    const slower = recordBestTime(faster.times, DEFAULT_SETUP, 125);
    expect(slower.record).toEqual({
      time: 125,
      previous: 118,
      best: 118,
      isNew: false,
    });
    // Unchanged bests are the same object, so the page can skip the write.
    expect(slower.times).toBe(faster.times);
  });

  it("leaves the other keys alone", () => {
    const { times } = recordBestTime({ other: 99 }, RELAXED, 160);
    expect(times).toEqual({ other: 99, [bestTimeKey(RELAXED)]: 160 });
  });

  it("measures the gap to par in the clock minutes the labels show", () => {
    // 120 s reads 1:12 and 110 s reads 12:51 on the standard clock.
    expect(minutesUnderPar(110, 120, 200)).toBe(21);
    expect(minutesUnderPar(120, 120, 200)).toBe(0);
    expect(minutesUnderPar(130, 120, 200)).toBe(-21);
    expect(minutesUnderPar(120.1, 120, 200)).toBe(0);
  });
});

describe("stored best times (#2056)", () => {
  it("round-trips through the stored string", () => {
    const { times } = recordBestTime({}, DEFAULT_SETUP, 117.5);
    expect(parseBestTimes(serializeBestTimes(times))).toEqual(times);
  });

  it("falls back to no best times for missing or malformed storage", () => {
    expect(parseBestTimes(null)).toEqual({});
    expect(parseBestTimes("")).toEqual({});
    expect(parseBestTimes("{not json")).toEqual({});
    expect(parseBestTimes("42")).toEqual({});
    expect(parseBestTimes("null")).toEqual({});
    expect(parseBestTimes("[1,2]")).toEqual({});
    expect(parseBestTimes('"text"')).toEqual({});
  });

  it("drops malformed entries and keeps the good ones", () => {
    expect(
      parseBestTimes(
        JSON.stringify({
          good: 118,
          zero: 0,
          text: "118",
          negative: -1,
          huge: 1e9,
          nested: { time: 1 },
          nothing: null,
        })
      )
    ).toEqual({ good: 118, zero: 0 });
  });
});

describe("par calibration (#2056)", () => {
  const NO_INPUT: PlayerInput = {
    moveX: 0,
    moveY: 0,
    interact: false,
    interactHeld: false,
    work: false,
  };

  /**
   * The scripted solo player the par was calibrated on: the helper's goal
   * policy for Fred at full pace, Abbi idle, no helper, staying for the call.
   */
  function scriptedFinish(setup: Setup): number | null {
    let state: GameState = createLevel(setup);
    let lastInteract = false;
    let guard = 0;
    while (state.phase !== "done" && guard++ < 40000) {
      const input = assistInput({ ...state, tick: 0 }, "fred");
      const interact = input.interact && !lastInteract;
      lastInteract = input.interact;
      const frame: Frame = {
        inputs: { fred: { ...input, interact }, abbi: NO_INPUT },
        ...(state.phase === "brothers"
          ? { decision: { choice: "stay", commitment: null } }
          : {}),
      };
      state = stepGame(state, frame).state;
    }
    return state.finishedAt;
  }

  it("is beatable by the scripted solo player on both clocks, with no more than the stated slack", () => {
    for (const setup of [DEFAULT_SETUP, RELAXED]) {
      const par = parFor(setup);
      const finish = scriptedFinish(setup);
      expect(par).not.toBeNull();
      expect(finish).not.toBeNull();
      expect(finish!).toBeLessThan(par!);
      // The standard par is the scripted time rounded up to 10 s; the relaxed
      // par is half again the scripted time, rounded up to 10 s.
      const target = setup.relaxed ? finish! * 1.5 : finish!;
      expect(par).toBe(Math.ceil(target / 10) * 10);
    }
  }, 60000);
});
