// Monkey C Mayhem Running Buddy and Medicine Ball UI (#2024): the art draws
// lane medicine balls, a thrown ball, a carried ball, a ridden buddy with its
// leash and a runaway buddy that blinks; the action key announces the pick-up,
// the throw and the mount; and the field manual covers both new rules.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { fromAny } from "@total-typescript/shoehorn";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { renderWatchFace } from "@/components/garmin-watch/watch-face-art";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { EMPTY_COURSE } from "@/lib/garmin-course";
import type { ThrownBall } from "@/lib/garmin-medball";
import {
  createInitialState,
  pressAction,
  startGame,
  GROUND_Y,
  PLAYER_X,
  type GameEngineState,
} from "@/lib/garmin-engine";
import { BASE_HEIGHT, PICKUP_SIZE } from "@/lib/garmin-powerups";

const mockAnnounce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: mockAnnounce }),
}));
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));
vi.mock("@/lib/garmin-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin-engine")>();
  return { ...actual, pressAction: vi.fn(actual.pressAction) };
});

const announced = () =>
  mockAnnounce.mock.calls.map((c) => c[0] as string).join(" | ");

/** A fitness run on the ground, standing on the lane. */
const onLane = (over: Partial<GameEngineState> = {}): GameEngineState => ({
  ...startGame(createInitialState("fenix", 0), "fenix"),
  rules: "fitness",
  obstacles: [],
  lastObstacleTime: Date.now() + 60_000,
  lastAllocTime: Date.now() + 60_000,
  gpsMs: 0,
  isGrounded: true,
  playerY: GROUND_Y - BASE_HEIGHT,
  ...over,
});

/** A recording 2D context: every draw call is logged with its arguments. */
function recordingCtx() {
  const calls: string[] = [];
  const trace: string[] = [];
  const target: Record<string, unknown> = {};
  const gradient = { addColorStop: () => {} };
  const ctx = fromAny<CanvasRenderingContext2D, unknown>(
    new Proxy(target, {
      get(t, key: string) {
        if (key in t) return t[key];
        if (key === "measureText") {
          return (value: string) => ({ width: value.length * 6 });
        }
        if (key === "createLinearGradient" || key === "createRadialGradient") {
          return () => gradient;
        }
        return (...args: unknown[]) => {
          calls.push(key);
          trace.push(`${key}(${args.join(",")})`);
        };
      },
      set(t, key: string, value) {
        t[key] = value;
        return true;
      },
    })
  );
  return { ctx, calls, trace };
}

/** The draw trace of one frame of `state`. */
function traceOf(state: GameEngineState) {
  const rec = recordingCtx();
  renderWatchFace(rec.ctx, state);
  return rec.trace;
}

/** Medicine balls are drawn with radius MEDBALL_SIZE / 2 = 5 arcs. */
const radiusArcs = (trace: string[], r: number) =>
  trace.filter((t) => t.startsWith("arc(") && t.split(",")[2] === String(r));

/** A lane ball placed on screen, ahead of the runner. */
const laneBall = {
  id: 7,
  x: PLAYER_X + 160,
  y: GROUND_Y - 10,
};

const thrown: ThrownBall = {
  id: 9,
  x: PLAYER_X + 140,
  y: GROUND_Y - 40,
  vx: 5,
  vy: -2.5,
};

const buddyPickup = (ttlMs?: number) => ({
  id: 3,
  kind: "buddy" as const,
  x: PLAYER_X + 160,
  y: GROUND_Y - PICKUP_SIZE,
  vx: 0,
  vy: 0,
  emergeMs: 0,
  ...(ttlMs === undefined ? {} : { ttlMs }),
});

afterEach(() => {
  cleanup();
  mockAnnounce.mockClear();
  vi.mocked(pressAction).mockClear();
});

describe("Medicine ball art (#2024)", () => {
  it("draws the lane medicine balls only when the course has them", () => {
    const base = onLane({ course: EMPTY_COURSE });
    const withBalls = onLane({
      course: { ...EMPTY_COURSE, medBalls: [laneBall] },
    });
    const without = traceOf(base);
    const withTrace = traceOf(withBalls);
    expect(withTrace).not.toEqual(without);
    expect(radiusArcs(withTrace, 5).length).toBe(
      radiusArcs(without, 5).length + 1
    );
  });

  it("draws a thrown ball in flight, and nothing when none is in flight", () => {
    const flying = traceOf(onLane({ thrownBall: thrown }));
    const none = traceOf(onLane({ thrownBall: null }));
    expect(flying).not.toEqual(none);
    expect(radiusArcs(flying, 5).length).toBe(radiusArcs(none, 5).length + 1);
  });

  it("holds a carried ball at the front hand", () => {
    const carrying = traceOf(onLane({ carrying: true }));
    const empty = traceOf(onLane({ carrying: false }));
    expect(carrying).not.toEqual(empty);
    expect(radiusArcs(carrying, 4).length).toBe(
      radiusArcs(empty, 4).length + 1
    );
  });

  it("draws a Running Buddy pickup on the lane, but not when there is none", () => {
    const none = traceOf(onLane({ pickups: [] }));
    const hatched = traceOf(onLane({ pickups: [buddyPickup()] }));
    expect(hatched).not.toEqual(none);
  });
});

describe("Running Buddy art (#2024)", () => {
  it("rides the dog under the runner: a lift and a leash only while riding", () => {
    const riding = traceOf(onLane({ riding: true }));
    const walking = traceOf(onLane({ riding: false }));
    expect(riding).toContain("translate(0,-6)");
    expect(walking).not.toContain("translate(0,-6)");
    expect(riding).not.toEqual(walking);
  });

  it("blinks a runaway buddy off on odd 100 ms phases in its last second", () => {
    const empty = traceOf(onLane({ pickups: [] }));
    const on = traceOf(onLane({ pickups: [buddyPickup(850)] }));
    const off = traceOf(onLane({ pickups: [buddyPickup(950)] }));
    // Off means the runaway is not drawn at all: the frame matches none.
    expect(off).toEqual(empty);
    expect(on).not.toEqual(empty);
  });

  it("always draws a runaway buddy with more than a second left", () => {
    const longRun = traceOf(onLane({ pickups: [buddyPickup(2000)] }));
    const on = traceOf(onLane({ pickups: [buddyPickup(850)] }));
    expect(longRun).toEqual(on);
  });
});

describe("Medicine Ball and Running Buddy in the simulator (#2024)", () => {
  it("announces the pick-up when the action key starts carrying a ball", () => {
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      carrying: true,
    }));
    render(<GarminWatchSimulator initialState={onLane()} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "X / Throw Heat Bolt, Cape Spin or Spin Jump Button",
      })
    );
    expect(announced()).toContain("Medicine ball picked up.");
  });

  it("announces the throw when a thrown ball appears", () => {
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      carrying: false,
      thrownBall: thrown,
    }));
    render(<GarminWatchSimulator initialState={onLane({ carrying: true })} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "X / Throw Heat Bolt, Cape Spin or Spin Jump Button",
      })
    );
    expect(announced()).toContain("Threw the medicine ball.");
  });

  it("announces the mount when riding turns on", () => {
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      riding: true,
    }));
    render(<GarminWatchSimulator initialState={onLane()} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "X / Throw Heat Bolt, Cape Spin or Spin Jump Button",
      })
    );
    expect(announced()).toContain("Riding your buddy.");
  });

  it("announces none of the new lines when the action changes nothing", () => {
    render(<GarminWatchSimulator initialState={onLane()} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "X / Throw Heat Bolt, Cape Spin or Spin Jump Button",
      })
    );
    expect(announced()).not.toContain("Medicine ball picked up.");
    expect(announced()).not.toContain("Threw the medicine ball.");
    expect(announced()).not.toContain("Riding your buddy.");
  });

  it("keeps the action button's accessible name and says medicine ball in its title", () => {
    render(<GarminWatchSimulator initialState={onLane()} />);
    expect(
      screen.getByRole("button", {
        name: "X / Throw Heat Bolt, Cape Spin or Spin Jump Button",
      })
    ).toBeTruthy();
    const action = document.querySelector('[title*="Spin Jump in mid-air"]');
    expect(action?.getAttribute("title")).toMatch(/medicine ball/);
  });
});

describe("Running Buddy and Medicine Ball in the field manual (#2024)", () => {
  const manual = GAME_MANUALS["garmin-watch"];
  const rule = (title: string) => manual.rules.find((r) => r.title === title);

  it("has a rule for the Running Buddy and one for the Medicine Ball", () => {
    expect(rule("Running Buddy")).toBeDefined();
    expect(rule("Medicine Ball")).toBeDefined();
  });

  it("describes the buddy's bark, its eating and the runaway rule", () => {
    const buddy = rule("Running Buddy");
    expect(buddy?.detail).toMatch(/Good boy!/);
    expect(buddy?.detail).toMatch(/Kettlebells/);
    expect(buddy?.detail).toMatch(/three seconds/);
    expect(buddy?.detail).toMatch(/next stage/);
  });

  it("describes picking up, carrying and throwing the ball", () => {
    const ball = rule("Medicine Ball");
    expect(ball?.detail).toMatch(/Med ball!/);
    expect(ball?.detail).toMatch(/pace meter/);
    expect(ball?.detail).toMatch(/knocks out the first foe/);
    expect(ball?.detail).toMatch(/breaks a brick/);
  });

  it("mentions the medicine ball in the Action control", () => {
    const action = manual.controls.find(
      (c) => c.action === "Action (Heat Map & Cape)"
    );
    expect(action?.description).toMatch(/medicine ball/);
    expect(action?.description).toMatch(/pick it up/);
  });
});
