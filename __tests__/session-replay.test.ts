// The session replay helper's own tests (#2708): recording is repeatable,
// inputs change the result, fixtures are written only on request, and a
// mismatch names what changed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArcadeEngine, ArcadeGameLoop, SESSION_STEP_MS } from "@/lib/arcade";
import {
  REPLAY_EPOCH_MS,
  REPLAY_FIXTURE_FORMAT,
  expectReplayFixture,
  isReplayUpdateRequested,
  recordReplay,
  replayFixturesRoot,
  toReplayValue,
  type ReplayAction,
  type ReplaySession,
} from "./helpers/session-replay";
import {
  createCounterRunSession,
  type CounterAction,
  type CounterRunState,
} from "./fixtures/three-view-game/run-session";

/** Press Add every 20 steps, as a steady player would. */
function steadyAdds(steps: number): ReplayAction<CounterAction>[] {
  const actions: ReplayAction<CounterAction>[] = [];
  for (let at = 20; at < steps; at += 20) actions.push({ at, intent: "add" });
  return actions;
}

function recordCounter(
  seed: number,
  actions: readonly ReplayAction<CounterAction>[] = steadyAdds(300),
  steps = 300
) {
  return recordReplay(() => createCounterRunSession(seed), actions, {
    seed,
    steps,
  });
}

/** A pre-seam engine: its own rAF loop, and Math.random for game state. */
interface TickState {
  readonly updates: number;
  readonly total: number;
  readonly frameTimes: readonly number[];
}

class TickEngine extends ArcadeEngine<TickState, TickState> {
  constructor() {
    super({ updates: 0, total: 0, frameTimes: [] });
  }
  init(): void {}
  update(): void {
    this.state = {
      updates: this.state.updates + 1,
      total: this.state.total + Math.floor(Math.random() * 100),
      frameTimes: [...this.state.frameTimes, performance.now()].slice(-3),
    };
  }
  render(): void {}
  createSnapshot(): TickState {
    return this.state;
  }
}

describe("recordReplay", () => {
  const loops: ArcadeGameLoop[] = [];

  afterEach(() => {
    loops.splice(0).forEach((loop) => loop.stop());
  });

  function loopSession(): ReplaySession<TickState, "pause" | "resume"> {
    const engine = new TickEngine();
    const loop = new ArcadeGameLoop(engine);
    loops.push(loop);
    loop.start();
    return {
      getState: () => engine.createSnapshot(),
      dispatch: (intent) => (intent === "pause" ? loop.pause() : loop.resume()),
    };
  }

  it("gives an identical state for the same seed, actions and steps", () => {
    const first = recordCounter(2708);
    const second = recordCounter(2708);
    expect(second).toStrictEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(first.state).toMatchObject({ step: 300, status: "playing" });
  });

  it("gives a different state for another seed or another action stream", () => {
    const base = recordCounter(2708);
    expect(recordCounter(2709).state).not.toStrictEqual(base.state);

    expect(recordCounter(2708, []).state).not.toStrictEqual(base.state);
    const sparser = steadyAdds(300).filter((_, index) => index % 2 === 0);
    expect(recordCounter(2708, sparser).state).not.toStrictEqual(base.state);

    const paused: ReplayAction<CounterAction>[] = [
      ...steadyAdds(100),
      { at: 100, intent: "pause" },
    ];
    expect(recordCounter(2708, paused).state).toMatchObject({
      step: 100,
      status: "paused",
    });
  });

  it("sends an action at `steps` after the last step", () => {
    const run = recordCounter(2708, [{ at: 50, intent: "pause" }], 50);
    expect(run.state).toMatchObject({ step: 50, status: "paused" });
    expect(run.actions).toEqual([{ at: 50, intent: "pause" }]);
  });

  it("moves a session's own stream to the seed", () => {
    const fromFactory = recordCounter(2708);
    // A session made with another seed is reseeded, so the run is the same.
    const reseeded = recordReplay(createCounterRunSession(1), steadyAdds(300), {
      seed: 2708,
      steps: 300,
    });
    expect(reseeded.state).toStrictEqual(fromFactory.state);
  });

  it("seeds Math.random and the clock while a factory builds the session", () => {
    const realRandom = Math.random;
    const realNow = Date.now;
    const build = () => {
      const drawn = Math.random();
      const created = Date.now();
      return {
        getState: () => ({ drawn, created, perf: performance.now() }),
        dispatch: () => {},
        step: () => {},
      };
    };
    const first = recordReplay(build, [], { seed: 7, steps: 3 });
    const second = recordReplay(build, [], { seed: 7, steps: 3 });
    expect(second.state).toStrictEqual(first.state);
    expect(first.state).toMatchObject({
      created: REPLAY_EPOCH_MS,
      perf: 3 * SESSION_STEP_MS,
    });
    expect(recordReplay(build, [], { seed: 8, steps: 3 }).state).not.toEqual(
      first.state
    );
    expect(Math.random).toBe(realRandom);
    expect(Date.now).toBe(realNow);
  });

  it("drives an engine's own requestAnimationFrame loop one frame per step", () => {
    const realFrame = globalThis.requestAnimationFrame;
    const first = recordReplay(loopSession, [], { seed: 3, steps: 120 });
    const second = recordReplay(loopSession, [], { seed: 3, steps: 120 });
    expect(second.state).toStrictEqual(first.state);
    expect(globalThis.requestAnimationFrame).toBe(realFrame);

    const updates = (state: unknown): number =>
      typeof state === "object" &&
      state !== null &&
      "updates" in state &&
      typeof state.updates === "number"
        ? state.updates
        : -1;
    // The first frame sets the loop's timestamp; every later frame is one step.
    expect(updates(first.state)).toBeGreaterThanOrEqual(118);
    expect(updates(first.state)).toBeLessThanOrEqual(120);

    const paused = recordReplay(
      loopSession,
      [
        { at: 60, intent: "pause" },
        { at: 90, intent: "resume" },
      ],
      { seed: 3, steps: 120 }
    );
    expect(updates(paused.state)).toBeLessThan(updates(first.state) - 25);
  });

  it("runs only frames queued before each step and honours cancelAnimationFrame", () => {
    const calls: number[] = [];
    const session = () => {
      const cancelled = requestAnimationFrame(() => calls.push(-1));
      cancelAnimationFrame(cancelled);
      const tick = (time: number) => {
        calls.push(time);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
      return { getState: () => calls.length, dispatch: () => {} };
    };
    const run = recordReplay(session, [], { seed: 1, steps: 4 });
    expect(run.state).toBe(4);
    expect(calls).toEqual([1, 2, 3, 4].map((step) => step * SESSION_STEP_MS));
  });

  it("keeps only the selected gameplay state", () => {
    const run = recordReplay(
      () => createCounterRunSession(2708),
      steadyAdds(120),
      {
        seed: 2708,
        steps: 120,
        select: (state: CounterRunState) => ({
          count: state.count,
          lives: state.lives,
        }),
      }
    );
    expect(Object.keys(run.state ?? {})).toEqual(["count", "lives"]);
  });

  it("rejects a bad step count or action stream", () => {
    const session = createCounterRunSession(1);
    expect(() => recordReplay(session, [], { seed: 1, steps: -1 })).toThrow(
      RangeError
    );
    expect(() => recordReplay(session, [], { seed: 1, steps: 1.5 })).toThrow(
      RangeError
    );
    expect(() =>
      recordReplay(session, [{ at: 11, intent: "add" }], { seed: 1, steps: 10 })
    ).toThrow(/actions\[0\]\.at must be an integer in \[0, 10\]/);
    expect(() =>
      recordReplay(
        session,
        [
          { at: 5, intent: "add" },
          { at: 2, intent: "add" },
        ],
        { seed: 1, steps: 10 }
      )
    ).toThrow(/step order/);
  });

  it("restores every stub when the session throws", () => {
    const realRandom = Math.random;
    const realFrame = globalThis.requestAnimationFrame;
    const realPerfNow = performance.now;
    expect(() =>
      recordReplay(
        {
          getState: () => 0,
          dispatch: () => {},
          step: () => {
            throw new Error("engine fault");
          },
        },
        [],
        { seed: 1, steps: 2 }
      )
    ).toThrow("engine fault");
    expect(Math.random).toBe(realRandom);
    expect(globalThis.requestAnimationFrame).toBe(realFrame);
    expect(performance.now).toBe(realPerfNow);
  });
});

describe("toReplayValue", () => {
  it("sorts keys and drops functions, symbols and undefined properties", () => {
    const value = toReplayValue({
      b: 1,
      a: { d: [1, 2], c: "x" },
      skip: undefined,
      method: () => 1,
      tag: Symbol("t"),
    });
    expect(JSON.stringify(value)).toBe('{"a":{"c":"x","d":[1,2]},"b":1}');
  });

  it("keeps every bit of a float and tags what JSON cannot hold", () => {
    const value = toReplayValue({
      sum: 0.1 + 0.2,
      tiny: 5e-324,
      zero: -0,
      nan: Number.NaN,
      up: Number.POSITIVE_INFINITY,
      down: Number.NEGATIVE_INFINITY,
      big: BigInt(2) ** BigInt(70),
      gaps: [undefined, 1],
    });
    const parsed: unknown = JSON.parse(JSON.stringify(value));
    expect(parsed).toStrictEqual({
      big: { $bigint: "1180591620717411303424" },
      down: { $number: "-Infinity" },
      gaps: [{ $undefined: true }, 1],
      nan: { $number: "NaN" },
      sum: 0.30000000000000004,
      tiny: 5e-324,
      up: { $number: "Infinity" },
      zero: { $number: "-0" },
    });
  });

  it("serialises Maps, Sets, typed arrays, buffers and dates", () => {
    const value = toReplayValue({
      map: new Map<string, number>([
        ["z", 1],
        ["a", 2],
      ]),
      set: new Set([3, 1]),
      floats: new Float32Array([0.5, 1.25]),
      ints: new Int16Array([-2, 7]),
      wide: new BigInt64Array([BigInt(-1)]),
      buffer: new Uint8Array([1, 2]).buffer,
      view: new DataView(new Uint8Array([9, 8, 7]).buffer, 1),
      at: new Date(Date.UTC(2026, 9, 23)),
      bad: new Date(Number.NaN),
    });
    expect(value).toStrictEqual({
      at: { $date: "2026-10-23T00:00:00.000Z" },
      bad: { $date: "Invalid Date" },
      buffer: { $typed: "ArrayBuffer", values: [1, 2] },
      floats: { $typed: "Float32Array", values: [0.5, 1.25] },
      ints: { $typed: "Int16Array", values: [-2, 7] },
      map: {
        $map: [
          ["z", 1],
          ["a", 2],
        ],
      },
      set: { $set: [3, 1] },
      view: { $typed: "DataView", values: [8, 7] },
      wide: { $typed: "BigInt64Array", values: [{ $bigint: "-1" }] },
    });
  });

  it("escapes keys that start with $ so they cannot pass for a tag", () => {
    expect(toReplayValue({ $map: 1 })).toStrictEqual({ $$map: 1 });
  });

  it("reads class instances as their own data", () => {
    class Point {
      constructor(
        readonly x: number,
        readonly y: number
      ) {}
      length() {
        return Math.hypot(this.x, this.y);
      }
    }
    expect(toReplayValue(new Point(3, 4))).toStrictEqual({ x: 3, y: 4 });
  });

  it("allows a shared reference but rejects a cycle or a bare function", () => {
    const shared = { n: 1 };
    expect(toReplayValue({ a: shared, b: shared })).toStrictEqual({
      a: { n: 1 },
      b: { n: 1 },
    });

    const loop: { self?: unknown } = {};
    loop.self = { back: loop };
    expect(() => toReplayValue(loop, "state")).toThrow(
      /cycle at state\.self\.back/
    );
    expect(() => toReplayValue([() => 1], "state")).toThrow(
      /function at state\[0\]/
    );
  });
});

describe("expectReplayFixture", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "session-replay-"));
    vi.stubEnv("UPDATE_REPLAY_FIXTURES", "");
    vi.stubEnv("CI", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("resolves the fixtures folder from the workspace root", () => {
    expect(replayFixturesRoot()).toBe(
      path.join(process.cwd(), "__tests__", "fixtures", "replays")
    );
  });

  it("fails on a missing fixture without the update flag, and writes nothing", async () => {
    await expect(
      expectReplayFixture("demo-game/normal-run", recordCounter(2708), {
        root,
      })
    ).rejects.toThrow(
      /Replay fixture .*demo-game[\\/]normal-run\.json does not exist\. Record it on main.*UPDATE_REPLAY_FIXTURES=1/
    );
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it("writes the fixture on request, then matches the same run", async () => {
    const run = recordCounter(2708);
    await expectReplayFixture("demo-game/normal-run", run, {
      root,
      update: true,
    });
    const file = path.join(root, "demo-game", "normal-run.json");
    const written: unknown = JSON.parse(fs.readFileSync(file, "utf-8"));
    expect(written).toMatchObject({
      format: REPLAY_FIXTURE_FORMAT,
      name: "demo-game/normal-run",
      seed: 2708,
      steps: 300,
    });
    expect(fs.readFileSync(file, "utf-8").endsWith("\n")).toBe(true);

    await expect(
      expectReplayFixture("demo-game/normal-run", recordCounter(2708), {
        root,
      })
    ).resolves.toBeUndefined();
  });

  it("reads UPDATE_REPLAY_FIXTURES=1, and refuses to write in CI", async () => {
    vi.stubEnv("UPDATE_REPLAY_FIXTURES", "1");
    expect(isReplayUpdateRequested()).toBe(true);
    await expectReplayFixture("demo-game/env-run", recordCounter(1), { root });
    expect(fs.existsSync(path.join(root, "demo-game", "env-run.json"))).toBe(
      true
    );

    vi.stubEnv("CI", "true");
    await expect(
      expectReplayFixture("demo-game/ci-run", recordCounter(1), { root })
    ).rejects.toThrow(/Refusing to write replay fixture .* in CI/);
    expect(fs.existsSync(path.join(root, "demo-game", "ci-run.json"))).toBe(
      false
    );
  });

  it("names each differing path when a run no longer matches", async () => {
    await expectReplayFixture("demo-game/normal-run", recordCounter(2708), {
      root,
      update: true,
    });
    const changed = recordCounter(2708, []);
    const failure = await expectReplayFixture("demo-game/normal-run", changed, {
      root,
    }).then(
      () => null,
      (error: unknown) => error
    );
    expect(failure).toBeInstanceOf(Error);
    const message = failure instanceof Error ? failure.message : "";
    expect(message).toMatch(/Replay demo-game\/normal-run no longer matches/);
    expect(message).toMatch(/state\.count: fixture 7, run 0\n/);
    expect(message).toMatch(/state\.status: fixture "playing", run "lost"/);
    expect(message).toMatch(/actions: fixture has 14 items, run has 0/);
    expect(message.indexOf("state.count")).toBeLessThan(
      message.indexOf("actions:")
    );
    expect(message).toMatch(/must reproduce the fixture exactly/);
  });

  it("rejects a bad name and an unreadable fixture", async () => {
    await expect(
      expectReplayFixture("../escape", recordCounter(1), { root })
    ).rejects.toThrow(/must be "<slug>\/<run>"/);

    fs.mkdirSync(path.join(root, "demo-game"));
    fs.writeFileSync(path.join(root, "demo-game", "broken.json"), "{");
    await expect(
      expectReplayFixture("demo-game/broken", recordCounter(1), { root })
    ).rejects.toThrow(/is not valid JSON/);
  });
});
