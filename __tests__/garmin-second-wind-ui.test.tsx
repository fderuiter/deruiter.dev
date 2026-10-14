// Monkey C Mayhem Second Wind UI (#2026): the art draws the four events (the
// lane tilt on Hill Repeats, the Fun Run spectators, the Night Run headlamp,
// the Taper Week float trail and the HUD line); the simulator announces each
// event's start, goal and end and passes reduced motion to the renderer; and
// the field manual covers the rules.
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  fireEvent,
  screen,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { fromAny } from "@total-typescript/shoehorn";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import {
  renderWatchFace,
  secondWindHudText,
} from "@/components/garmin-watch/watch-face-art";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { EMPTY_COURSE } from "@/lib/garmin-course";
import {
  hillTilt,
  startSecondWind,
  type SecondWind,
} from "@/lib/garmin-second-wind";
import {
  createInitialState,
  pressAction,
  startGame,
  GROUND_Y,
  PLAYER_X,
  type GameEngineState,
} from "@/lib/garmin-engine";
import type { Foe } from "@/lib/garmin-foes";
import { BASE_HEIGHT } from "@/lib/garmin-powerups";

const motion = vi.hoisted(() => ({ reduced: false }));

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
vi.mock("@/hooks/useMediaQuery", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useMediaQuery")>();
  return { ...actual, usePrefersReducedMotion: () => motion.reduced };
});
vi.mock("@/lib/garmin-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin-engine")>();
  return { ...actual, pressAction: vi.fn(actual.pressAction) };
});
vi.mock("@/components/garmin-watch/watch-face-art", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/garmin-watch/watch-face-art")
    >();
  return { ...actual, renderWatchFace: vi.fn(actual.renderWatchFace) };
});

const announced = () =>
  mockAnnounce.mock.calls.map((c) => c[0] as string).join(" | ");

/** A fitness run on the ground, standing on the lane, at the stage start. */
const onLane = (over: Partial<GameEngineState> = {}): GameEngineState => ({
  ...startGame(createInitialState("fenix", 0), "fenix"),
  rules: "fitness",
  obstacles: [],
  lastObstacleTime: Date.now() + 60_000,
  lastAllocTime: Date.now() + 60_000,
  gpsMs: 0,
  isGrounded: true,
  playerY: GROUND_Y - BASE_HEIGHT,
  distanceMeters: 0,
  ...over,
});

/**
 * A recording 2D context. Every draw call is logged in `trace`; `rotate` and
 * `createRadialGradient` are spies, so their arguments can be checked.
 */
function recordingCtx() {
  const trace: string[] = [];
  const rotate = vi.fn();
  const gradient = { addColorStop: () => {} };
  const createRadialGradient = vi.fn(() => gradient);
  const target: Record<string, unknown> = { rotate, createRadialGradient };
  const ctx = fromAny<CanvasRenderingContext2D, unknown>(
    new Proxy(target, {
      get(t, key: string) {
        if (key in t) return t[key];
        if (key === "measureText") {
          return (value: string) => ({ width: value.length * 6 });
        }
        if (key === "createLinearGradient") {
          return () => gradient;
        }
        return (...args: unknown[]) => {
          trace.push(`${key}(${args.join(",")})`);
        };
      },
      set(t, key: string, value) {
        t[key] = value;
        return true;
      },
    })
  );
  return { ctx, trace, rotate, createRadialGradient };
}

/** One frame of `state`, drawn into a recording context. */
function frameOf(state: GameEngineState, reducedMotion = false) {
  const rec = recordingCtx();
  renderWatchFace(rec.ctx, state, undefined, { reducedMotion });
  return rec;
}

/** The draw trace of one frame of `state`. */
const traceOf = (state: GameEngineState) => frameOf(state).trace;

/** A plain sync block on the lane, ahead of the runner. */
const syncBlock = {
  id: 1,
  x: PLAYER_X + 160,
  y: GROUND_Y - 60,
  kind: "sync" as const,
  used: false,
};

/** A kettlebell foe on the lane, ahead of the runner. */
const foe: Foe = {
  id: 1,
  kind: "kettlebell",
  mode: "walk",
  x: PLAYER_X + 120,
  y: GROUND_Y - 16,
  width: 16,
  height: 16,
  vx: 0,
  vy: 0,
  timerMs: 0,
  hp: 1,
  graceMs: 0,
};

/** A Rep Max on the lane, ahead of the runner. */
const repMax: Foe = {
  ...foe,
  kind: "repmax",
  width: 24,
  height: 30,
  y: GROUND_Y - 30,
};

afterEach(() => {
  cleanup();
  mockAnnounce.mockClear();
  motion.reduced = false;
  vi.mocked(pressAction).mockClear();
  vi.mocked(renderWatchFace).mockClear();
});

describe("Second Wind announcements in the simulator (#2026)", () => {
  const actionName = "X / Throw Heat Bolt, Cape Spin or Spin Jump Button";
  const clickAction = () =>
    fireEvent.click(screen.getByRole("button", { name: actionName }));

  it("announces the start of an event with its name, goal and time limit", () => {
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      secondWind: startSecondWind("taper", 1),
    }));
    render(<GarminWatchSimulator initialState={onLane()} />);
    clickAction();
    expect(announced()).toContain(
      "Second Wind: Taper Week. Grab 6 Kudos in 15 seconds."
    );
  });

  it("names each of the four events when it starts", () => {
    const cases: [SecondWind["kind"], string][] = [
      ["hills", "Second Wind: Hill Repeats. Run 100 m in 15 seconds."],
      ["funrun", "Second Wind: Fun Run. High-five 2 fans in 15 seconds."],
      ["night", "Second Wind: Night Run. Take no hits in 15 seconds."],
    ];
    for (const [kind, line] of cases) {
      cleanup();
      mockAnnounce.mockClear();
      vi.mocked(pressAction).mockImplementationOnce((state) => ({
        ...state,
        secondWind: startSecondWind(kind, 1),
      }));
      render(<GarminWatchSimulator initialState={onLane()} />);
      clickAction();
      expect(announced()).toContain(line);
    }
  });

  it("announces the goal once it is met", () => {
    render(
      <GarminWatchSimulator
        initialState={onLane({
          secondWind: startSecondWind("taper", 1),
        })}
      />
    );
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      secondWind: {
        ...startSecondWind("taper", 1),
        progress: 8,
        cleared: true,
      },
    }));
    clickAction();
    expect(announced()).toContain("Second Wind goal met.");
  });

  it("announces the end of the event when it is over", () => {
    render(
      <GarminWatchSimulator
        initialState={onLane({ secondWind: startSecondWind("hills", 1) })}
      />
    );
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      secondWind: null,
    }));
    clickAction();
    expect(announced()).toContain("Second Wind over.");
    expect(announced()).not.toContain("goal met");
  });

  it("announces the goal of a Night Run with no hits when it ends", () => {
    render(
      <GarminWatchSimulator
        initialState={onLane({ secondWind: startSecondWind("night", 1) })}
      />
    );
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      secondWind: null,
      banner: { text: "NIGHT RUN OVER", ttlMs: 2200, tone: "good" },
    }));
    clickAction();
    expect(announced()).toContain("Second Wind goal met.");
    expect(announced()).toContain("Second Wind over.");
  });

  it("announces a goal met on an event's last tick", () => {
    render(
      <GarminWatchSimulator
        initialState={onLane({
          secondWind: { ...startSecondWind("taper", 1), progress: 5 },
        })}
      />
    );
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      secondWind: null,
      banner: { text: "TAPER WEEK OVER", ttlMs: 2200, tone: "good" },
    }));
    clickAction();
    expect(announced()).toContain("Second Wind goal met.");
    expect(announced()).toContain("Second Wind over.");
  });

  it("does not announce a Night Run goal when it ends on a warning banner", () => {
    render(
      <GarminWatchSimulator
        initialState={onLane({ secondWind: startSecondWind("night", 1) })}
      />
    );
    vi.mocked(pressAction).mockImplementationOnce((state) => ({
      ...state,
      secondWind: null,
      banner: { text: "NIGHT RUN OVER", ttlMs: 2200, tone: "warn" },
    }));
    clickAction();
    expect(announced()).not.toContain("goal met");
    expect(announced()).toContain("Second Wind over.");
  });

  it("does not announce an event already running on mount", () => {
    render(
      <GarminWatchSimulator
        initialState={onLane({
          secondWind: {
            ...startSecondWind("funrun", 1),
            progress: 3,
            cleared: true,
          },
        })}
      />
    );
    clickAction();
    expect(announced()).not.toContain("Second Wind");
  });

  it("announces none of the Second Wind lines when no event changes", () => {
    render(<GarminWatchSimulator initialState={onLane()} />);
    clickAction();
    expect(announced()).not.toContain("Second Wind");
  });

  it("passes the reduced-motion preference to the renderer", async () => {
    motion.reduced = true;
    render(<GarminWatchSimulator initialState={onLane()} />);
    await waitFor(() =>
      expect(vi.mocked(renderWatchFace).mock.calls.length).toBeGreaterThan(0)
    );
    const options = vi.mocked(renderWatchFace).mock.calls.at(-1)?.[3];
    expect(options).toEqual({ reducedMotion: true });
  });

  it("passes no reduced motion when the preference is off", async () => {
    render(<GarminWatchSimulator initialState={onLane()} />);
    await waitFor(() =>
      expect(vi.mocked(renderWatchFace).mock.calls.length).toBeGreaterThan(0)
    );
    const options = vi.mocked(renderWatchFace).mock.calls.at(-1)?.[3];
    expect(options).toEqual({ reducedMotion: false });
  });
});

describe("Second Wind HUD line (#2026)", () => {
  it("reads the event, its progress over the goal and the seconds left", () => {
    expect(
      secondWindHudText({
        ...startSecondWind("taper", 1),
        progress: 3,
        msLeft: 12_000,
      })
    ).toBe("TAPER WEEK 3/6 · 12s");
    expect(
      secondWindHudText({ ...startSecondWind("hills", 1), progress: 45.7 })
    ).toBe("HILL REPEATS 45/100 · 15s");
  });

  it("reads NO HITS on Night Run until a hit, then HIT", () => {
    expect(
      secondWindHudText({ ...startSecondWind("night", 1), msLeft: 9_000 })
    ).toBe("NIGHT RUN · NO HITS · 9s");
    expect(
      secondWindHudText({
        ...startSecondWind("night", 1),
        progress: 1,
        msLeft: 9_000,
      })
    ).toBe("NIGHT RUN · HIT · 9s");
  });

  it("draws the line on the face while an event runs, and not without one", () => {
    const line = "TAPER WEEK 0/6 · 15s";
    const none = traceOf(onLane());
    const running = traceOf(
      onLane({ secondWind: startSecondWind("taper", 1) })
    );
    expect(none.some((t) => t.startsWith(`fillText(${line},`))).toBe(false);
    expect(running.some((t) => t.startsWith(`fillText(${line},`))).toBe(true);
  });
});

describe("Hill Repeats lane tilt and reduced motion (#2026)", () => {
  const hills = onLane({ secondWind: startSecondWind("hills", 1) });

  it("rotates the lane on Hill Repeats by the lane's tilt at the runner", () => {
    const { rotate } = frameOf(hills);
    expect(rotate).toHaveBeenCalled();
    expect(rotate).toHaveBeenCalledWith(hillTilt(hills.secondWind, PLAYER_X));
  });

  it("draws no rotation on Hill Repeats under reduced motion", () => {
    const { rotate } = frameOf(hills, true);
    expect(rotate).not.toHaveBeenCalled();
  });

  it("rotates for no other event, reduced motion or not", () => {
    const taper = frameOf(onLane({ secondWind: startSecondWind("taper", 1) }));
    const none = frameOf(onLane());
    expect(taper.rotate).not.toHaveBeenCalled();
    expect(none.rotate).not.toHaveBeenCalled();
  });
});

describe("Second Wind art (#2026)", () => {
  it("draws a Second Wind sync block exactly like a plain sync block", () => {
    const plain = traceOf(
      onLane({
        course: {
          ...EMPTY_COURSE,
          blocks: [{ ...syncBlock, contents: "kudos" as const }],
        },
      })
    );
    const windBlock = traceOf(
      onLane({
        course: {
          ...EMPTY_COURSE,
          blocks: [
            {
              ...syncBlock,
              contents: "wind" as const,
              windKind: "taper" as const,
              medalId: 11,
            },
          ],
        },
      })
    );
    expect(windBlock).toEqual(plain);
  });

  it("draws Fun Run foes as spectators, not as the foe they were", () => {
    const plain = traceOf(onLane({ foes: [foe] }));
    const cheering = traceOf(
      onLane({ foes: [foe], secondWind: startSecondWind("funrun", 1) })
    );
    expect(cheering).not.toEqual(plain);
  });

  it("leaves the Rep Max drawn as it is on Fun Run", () => {
    // The foe's own draw calls, from its translate to the save it closes.
    const foeDraw = (t: string[], x: number, y: number) => {
      const start = t.indexOf(`translate(${x},${y})`);
      let depth = 0;
      for (let i = start; i < t.length; i++) {
        if (t[i] === "save()") depth++;
        if (t[i] === "restore()") {
          if (depth === 0) return t.slice(start, i);
          depth--;
        }
      }
      return [];
    };
    const at = { x: repMax.x, y: repMax.y };
    const plain = traceOf(onLane({ foes: [repMax] }));
    const fun = traceOf(
      onLane({ foes: [repMax], secondWind: startSecondWind("funrun", 1) })
    );
    expect(foeDraw(plain, at.x, at.y).length).toBeGreaterThan(5);
    expect(foeDraw(fun, at.x, at.y)).toEqual(foeDraw(plain, at.x, at.y));
  });

  it("draws a float trail under an airborne runner on Taper Week only", () => {
    const playerY = GROUND_Y - 60;
    const feetTrail = `fillRect(${PLAYER_X - 6},${playerY + BASE_HEIGHT + 4},4,1)`;
    const airborne = { isGrounded: false, playerY };
    const taper = traceOf(
      onLane({ ...airborne, secondWind: startSecondWind("taper", 1) })
    );
    const grounded = traceOf(
      onLane({ secondWind: startSecondWind("taper", 1) })
    );
    const noEvent = traceOf(onLane({ ...airborne }));
    expect(taper).toContain(feetTrail);
    expect(grounded).not.toContain(feetTrail);
    expect(noEvent).not.toContain(feetTrail);
  });

  it("lights a headlamp cone ahead of the runner on Night Run only", () => {
    const cx = PLAYER_X + 40;
    const cy = GROUND_Y - 28;
    const night = frameOf(onLane({ secondWind: startSecondWind("night", 1) }));
    const plain = frameOf(onLane());
    expect(night.createRadialGradient).toHaveBeenCalledWith(
      cx,
      cy,
      12,
      cx,
      cy,
      104
    );
    expect(plain.createRadialGradient).not.toHaveBeenCalledWith(
      cx,
      cy,
      12,
      cx,
      cy,
      104
    );
  });
});

describe("Second Wind in the field manual (#2026)", () => {
  const rule = GAME_MANUALS["garmin-watch"].rules.find(
    (r) => r.title === "Second Wind"
  );

  it("has a rule covering all four events and their goals", () => {
    expect(rule).toBeDefined();
    expect(rule?.detail).toMatch(/Hill Repeats/);
    expect(rule?.detail).toMatch(/100 m/);
    expect(rule?.detail).toMatch(/Taper Week/);
    expect(rule?.detail).toMatch(/6 Kudos/);
    expect(rule?.detail).toMatch(/Fun Run/);
    expect(rule?.detail).toMatch(/high-five 2 fans/);
    expect(rule?.detail).toMatch(/Night Run/);
    expect(rule?.detail).toMatch(/take no hits/);
    expect(rule?.detail).toMatch(/15-second/);
  });

  it("keeps the existing rule titles", () => {
    const titles = GAME_MANUALS["garmin-watch"].rules.map((r) => r.title);
    expect(titles).toContain("Aid Station");
    expect(titles).toContain("Finisher Medals");
    expect(titles).toContain("Secret Exits");
  });
});
