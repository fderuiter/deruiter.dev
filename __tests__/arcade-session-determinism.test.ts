// @vitest-environment node
//
// Deterministic arcade sessions (#2544): a seeded gameplay stream, a fixed
// step clock and the stream's state in the run snapshot. A small fixture
// session plays the part of a game: meteors spawn per step from session.rng,
// fall at a constant dt and cost a life on contact, and a view paints
// cosmetic sparks from its own randomness.
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  SESSION_STEP_MS,
  SESSION_STEP_SECONDS,
  createRng,
  createSeededRandom,
  createStepClock,
  isRngState,
  readRunSnapshot,
  rngStateFromSeed,
  stepChance,
  writeRunSnapshot,
  type RunSnapshotStorage,
  type SessionRng,
  type StepClock,
} from "@/lib/arcade";
import { courseRandom } from "@/lib/garmin/course";

const LANES = 8;
const FLOOR = 10;

const meteorState = z.object({
  lane: z.number().int(),
  lives: z.number().int(),
  score: z.number().int(),
  meteors: z.array(
    z.object({ lane: z.number().int(), y: z.number(), speed: z.number() })
  ),
});

type MeteorState = z.infer<typeof meteorState>;
type Intent = "left" | "right";

interface MeteorSession {
  readonly rng: SessionRng;
  readonly clock: StepClock;
  readonly getState: () => MeteorState;
  readonly dispatch: (intent: Intent) => void;
  /** Runs one fixed step and counts it on the clock. */
  readonly step: () => void;
  /** Runs one fixed step the clock has already counted. */
  readonly runCountedStep: () => void;
  readonly snapshot: () => MeteorState;
  readonly restore: (data: unknown) => void;
}

function createMeteorSession(seed: number): MeteorSession {
  const rng = createRng(seed);
  const clock = createStepClock();
  let state: MeteorState = { lane: 4, lives: 3, score: 0, meteors: [] };

  const advance = () => {
    const dt = clock.dt;
    const meteors = state.meteors
      .map((m) => ({ ...m, y: m.y + m.speed * dt }))
      .filter((m) => m.y < FLOOR);
    let lives = state.lives;
    const kept = meteors.filter((m) => {
      const hit = m.lane === state.lane && m.y >= FLOOR - 1;
      if (hit) lives -= 1;
      return !hit;
    });
    // A per-step chance from the gameplay stream, never `rate * frameDt`.
    if (rng.chance(stepChance(3))) {
      kept.push({ lane: rng.int(LANES), y: 0, speed: rng.range(4, 9) });
    }
    state = {
      ...state,
      lives,
      score: state.score + (lives > 0 ? 1 : 0),
      meteors: kept,
    };
  };

  return {
    rng,
    clock,
    getState: () => state,
    dispatch(intent) {
      const lane = state.lane + (intent === "left" ? -1 : 1);
      state = { ...state, lane: Math.min(LANES - 1, Math.max(0, lane)) };
    },
    step() {
      advance();
      clock.tick();
    },
    runCountedStep: advance,
    snapshot: () => state,
    restore(data) {
      state = meteorState.parse(data);
    },
  };
}

/** The action stream: which intent the player sends before a given step. */
function actionAt(step: number): Intent | null {
  if (step % 37 === 0) return "left";
  if (step % 23 === 0) return "right";
  return null;
}

/** Plays `steps` fixed steps from the session's current step. */
function play(session: MeteorSession, steps: number): void {
  for (let i = 0; i < steps; i += 1) {
    const action = actionAt(session.clock.getStep());
    if (action) session.dispatch(action);
    session.step();
  }
}

/**
 * Plays one frame of `elapsedSeconds`: the clock says how many fixed steps it
 * covers, and each step still gets the action for its own step number.
 */
function playFrame(session: MeteorSession, elapsedSeconds: number): number {
  const steps = session.clock.advance(elapsedSeconds);
  const first = session.clock.getStep() - steps;
  for (let i = 0; i < steps; i += 1) {
    const action = actionAt(first + i);
    if (action) session.dispatch(action);
    session.runCountedStep();
  }
  return steps;
}

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

describe("createRng (#2544)", () => {
  it("gives the same draws for the same seed and different ones for another", () => {
    const a = createRng(2544);
    const b = createRng(2544);
    const c = createRng(2545);
    const drawsA = Array.from({ length: 64 }, a.next);
    expect(Array.from({ length: 64 }, b.next)).toEqual(drawsA);
    expect(Array.from({ length: 64 }, c.next)).not.toEqual(drawsA);
  });

  it("is the same Mulberry32 stream as createSeededRandom and the Garmin race stream", () => {
    for (const seed of [0, 1, 2019, 0xdeadbeef, 123_456_789]) {
      const rng = createRng(seed);
      const legacy = createSeededRandom(seed);
      const race = courseRandom(seed);
      for (let i = 0; i < 32; i += 1) {
        const value = rng.next();
        expect(value).toBe(legacy());
        expect(value).toBe(race());
      }
    }
  });

  it("continues the same stream from a saved state", () => {
    const rng = createRng("arcade-daily-2026-10-20");
    Array.from({ length: 17 }, rng.next);
    const saved = rng.getState();
    expect(isRngState(saved)).toBe(true);
    const expected = Array.from({ length: 32 }, rng.next);

    const resumed = createRng(1);
    resumed.setState(saved);
    expect(Array.from({ length: 32 }, resumed.next)).toEqual(expected);
  });

  it("hashes a string seed and wraps a numeric one to 32 bits", () => {
    expect(rngStateFromSeed("loon")).toBe(rngStateFromSeed("loon"));
    expect(rngStateFromSeed("loon")).not.toBe(rngStateFromSeed("duck"));
    expect(rngStateFromSeed(-1)).toBe(0xffffffff);
    expect(rngStateFromSeed(2 ** 32 + 5)).toBe(5);
    expect(rngStateFromSeed(Number.NaN)).toBe(0);
    expect(rngStateFromSeed(7.9)).toBe(7);
  });

  it("works detached, so rng.next can replace Math.random", () => {
    const { next, int } = createRng(9);
    expect(next()).toBeGreaterThanOrEqual(0);
    expect(int(6)).toBeLessThan(6);
  });

  it("draws once per chance, whatever the probability", () => {
    const rng = createRng(3);
    const twin = createRng(3);
    rng.chance(0);
    rng.chance(1);
    rng.chance(Number.NaN);
    twin.next();
    twin.next();
    twin.next();
    expect(rng.getState()).toBe(twin.getState());
    expect(createRng(3).chance(0)).toBe(false);
    expect(createRng(3).chance(1)).toBe(true);
    expect(createRng(3).chance(5)).toBe(true);
  });

  it("rejects bad bounds, empty lists and bad states", () => {
    const rng = createRng(1);
    expect(() => rng.int(0)).toThrow(RangeError);
    expect(() => rng.int(2.5)).toThrow(RangeError);
    expect(() => rng.pick([])).toThrow(RangeError);
    expect(() => rng.setState(-1)).toThrow(RangeError);
    expect(() => rng.setState(2 ** 32)).toThrow(RangeError);
    expect(() => rng.setState(1.5)).toThrow(RangeError);
    expect(rng.pick(["only"])).toBe("only");
    expect(rng.range(4, 4)).toBe(4);
  });
});

describe("createStepClock (#2544)", () => {
  it("steps at a constant 1/60 s", () => {
    const clock = createStepClock();
    expect(clock.dt).toBe(SESSION_STEP_SECONDS);
    expect(SESSION_STEP_MS).toBeCloseTo(16.667, 3);
    expect(clock.advance(1 / 60)).toBe(1);
    expect(clock.advance(1 / 120)).toBe(0);
    expect(clock.alpha()).toBeCloseTo(0.5, 6);
    expect(clock.advance(1 / 120)).toBe(1);
    expect(clock.getStep()).toBe(2);
    expect(clock.elapsedSeconds()).toBeCloseTo(2 / 60, 9);
  });

  it("runs the same steps for a second of frames at any frame rate", () => {
    for (const fps of [30, 60, 120, 144]) {
      const clock = createStepClock();
      for (let i = 0; i < fps; i += 1) clock.advance(1 / fps);
      expect(clock.getStep()).toBe(60);
    }
  });

  it("bounds a stall and ignores bad elapsed times", () => {
    const clock = createStepClock({ maxFrameSeconds: 0.1 });
    expect(clock.advance(10)).toBe(6);
    expect(clock.advance(-1)).toBe(0);
    expect(clock.advance(Number.NaN)).toBe(0);
    expect(clock.advance(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("restores a step and rejects a bad one", () => {
    const clock = createStepClock({ step: 12 });
    expect(clock.getStep()).toBe(12);
    clock.advance(1 / 120);
    clock.setStep(300);
    expect(clock.getStep()).toBe(300);
    expect(clock.alpha()).toBe(0);
    expect(() => clock.setStep(-1)).toThrow(RangeError);
    expect(() => clock.setStep(1.5)).toThrow(RangeError);
    expect(createStepClock({ dt: -1, step: -4 }).dt).toBe(SESSION_STEP_SECONDS);
    expect(createStepClock({ step: -4 }).getStep()).toBe(0);
  });

  it("turns a per-second rate into a per-step chance", () => {
    expect(stepChance(3)).toBeCloseTo(3 / 60, 12);
    expect(stepChance(3, 0.5)).toBe(1);
    expect(stepChance(-2)).toBe(0);
    expect(stepChance(Number.NaN)).toBe(0);
  });
});

describe("deterministic sessions (#2544)", () => {
  it("gives the same final state for the same seed and action stream", () => {
    const first = createMeteorSession(2544);
    const second = createMeteorSession(2544);
    play(first, 1200);
    play(second, 1200);
    expect(second.getState()).toEqual(first.getState());
    expect(first.getState().meteors.length).toBeGreaterThan(0);
    expect(first.getState().lives).toBeLessThan(3);

    const other = createMeteorSession(2545);
    play(other, 1200);
    expect(other.getState()).not.toEqual(first.getState());
  });

  it("gives the same run at any frame rate, because spawns roll per step", () => {
    const run = (frameSeconds: () => number) => {
      const session = createMeteorSession(77);
      while (session.clock.getStep() < 600) {
        expect(playFrame(session, frameSeconds())).toBeLessThanOrEqual(15);
      }
      return session;
    };
    const jitter = createRng(5);
    for (const frames of [
      () => 1 / 60,
      () => 1 / 30,
      () => 1 / 144,
      () => jitter.range(1 / 240, 1 / 20),
    ]) {
      const framed = run(frames);
      const stepped = createMeteorSession(77);
      play(stepped, framed.clock.getStep());
      expect(framed.getState()).toEqual(stepped.getState());
    }
  });

  it("continues identically after a snapshot and restore mid-run", () => {
    const uninterrupted = createMeteorSession(8080);
    play(uninterrupted, 900);

    const original = createMeteorSession(8080);
    play(original, 450);
    const storage = memoryStorage();
    writeRunSnapshot(storage, "meteor", {
      schema: 1,
      savedAt: 0,
      view: "phone",
      tuning: {},
      state: original.snapshot(),
      rngState: original.rng.getState(),
      step: original.clock.getStep(),
    });

    const read = readRunSnapshot(storage, "meteor", {
      schema: 1,
      state: meteorState,
    });
    if (read.status !== "ok")
      throw new Error(`expected a save, got ${read.status}`);
    // A fresh session with another seed, as on the next visit.
    const restored = createMeteorSession(1);
    restored.restore(read.snapshot.state);
    if (read.snapshot.rngState !== undefined) {
      restored.rng.setState(read.snapshot.rngState);
    }
    if (read.snapshot.step !== undefined) {
      restored.clock.setStep(read.snapshot.step);
    }
    play(restored, 450);

    expect(restored.clock.getStep()).toBe(900);
    expect(restored.getState()).toEqual(uninterrupted.getState());
  });

  it("re-rolls the rest of the run when a save carries no rngState", () => {
    const uninterrupted = createMeteorSession(8080);
    play(uninterrupted, 900);

    const original = createMeteorSession(8080);
    play(original, 450);
    const restored = createMeteorSession(1);
    restored.restore(original.snapshot());
    restored.clock.setStep(original.clock.getStep());
    play(restored, 450);

    expect(restored.getState()).not.toEqual(uninterrupted.getState());
  });

  it("a cosmetic draw in a view does not change gameplay", () => {
    const plain = createMeteorSession(31);
    play(plain, 900);

    // The view paints sparks between steps from its own randomness.
    const painted = createMeteorSession(31);
    const sparks: number[] = [];
    const paintSparks = () => {
      for (let i = 0; i < 5; i += 1) sparks.push(Math.random());
    };
    for (let i = 0; i < 900; i += 1) {
      paintSparks();
      play(painted, 1);
    }
    expect(sparks).toHaveLength(4500);
    expect(painted.getState()).toEqual(plain.getState());

    // The same sparks drawn from the gameplay stream would shift every
    // later spawn, which is why the two streams are kept apart.
    const shared = createMeteorSession(31);
    for (let i = 0; i < 900; i += 1) {
      shared.rng.next();
      play(shared, 1);
    }
    expect(shared.getState()).not.toEqual(plain.getState());
  });

  it("records a Math.random game repeatably by stubbing it with a seeded stream", () => {
    // The replay recording method: an engine that still calls Math.random
    // is recorded against today's code with Math.random stubbed.
    const legacyRoll = () =>
      Array.from({ length: 16 }, () => Math.floor(Math.random() * 100));
    const record = (seed: number) => {
      const spy = vi
        .spyOn(Math, "random")
        .mockImplementation(createRng(seed).next);
      try {
        return legacyRoll();
      } finally {
        spy.mockRestore();
      }
    };
    expect(record(12)).toEqual(record(12));
    expect(record(12)).not.toEqual(record(13));
  });
});
