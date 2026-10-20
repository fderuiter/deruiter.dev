// Monkey C Mayhem move UI (#2023): Down slams in mid-air in fitness runs and
// still enters a Water Station or jettisons in Dev Mode, the runner art draws
// the slam, spin jump and wall slide poses, and the field manual covers the
// three moves.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { fromAny } from "@total-typescript/shoehorn";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { renderWatchFace } from "@/components/garmin-watch/watch-face-art";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { MOVE_TOASTS } from "@/lib/garmin/moves";
import {
  allocateVariable,
  createInitialState,
  pressSlam,
  startGame,
  GROUND_Y,
  PLAYER_X,
  type GameEngineState,
} from "@/lib/garmin/engine";
import { BASE_HEIGHT } from "@/lib/garmin/powerups";
import { safeRemoveItem } from "@/lib/safe-storage";

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
vi.mock("@/lib/garmin/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin/engine")>();
  return { ...actual, pressSlam: vi.fn(actual.pressSlam) };
});

const announced = () =>
  mockAnnounce.mock.calls.map((c) => c[0] as string).join(" | ");

const watch = () => {
  const el = document.querySelector('[data-keyboard-boundary="true"]');
  if (!el) throw new Error("watch keyboard boundary missing");
  return el;
};

/** A fitness run in mid-air, well above the lane. */
const airborneFitness = (
  over: Partial<GameEngineState> = {}
): GameEngineState => ({
  ...startGame(createInitialState("fenix", 0), "fenix"),
  rules: "fitness",
  obstacles: [],
  lastObstacleTime: Date.now() + 60_000,
  lastAllocTime: Date.now() + 60_000,
  gpsMs: 0,
  isGrounded: false,
  playerY: GROUND_Y - BASE_HEIGHT * 3,
  ...over,
});

/** A fitness run standing on a Water Station's table top. */
const onStation = (): GameEngineState => {
  const base = airborneFitness();
  return {
    ...base,
    isGrounded: true,
    playerY: GROUND_Y - BASE_HEIGHT * 2,
    props: {
      stations: [
        {
          id: 1,
          x: PLAYER_X - 10,
          width: 60,
          height: BASE_HEIGHT,
          enterable: true,
          exitX: 900,
        },
      ],
      plyos: [],
      belts: [],
      switches: [],
    },
  };
};

/** A recording 2D context: every call is logged, text drawn is kept. */
function recordingCtx() {
  const calls: string[] = [];
  const texts: string[] = [];
  // Every draw call with its arguments, to tell two poses apart.
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
          if (key === "fillText" && typeof args[0] === "string") {
            texts.push(args[0]);
          }
        };
      },
      set(t, key: string, value) {
        t[key] = value;
        return true;
      },
    })
  );
  return { ctx, calls, texts, trace };
}

describe("Burpee Slam on the Down button (#2023)", () => {
  beforeEach(() => {
    mockAnnounce.mockClear();
    vi.mocked(pressSlam).mockClear();
    safeRemoveItem("garmin_dev_mode");
  });
  afterEach(() => cleanup());

  it("Down in a fitness run mid-air calls the slam and sets slamming", () => {
    render(<GarminWatchSimulator initialState={airborneFitness()} />);
    fireEvent.keyDown(watch(), { key: "ArrowDown" });
    expect(pressSlam).toHaveBeenCalledTimes(1);
    const result = vi.mocked(pressSlam).mock.results[0]?.value as
      GameEngineState | undefined;
    expect(result?.slamming).toBe(true);
  });

  it("the DOWN accessible button in a fitness run also slams and says so", () => {
    render(<GarminWatchSimulator initialState={airborneFitness()} />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "DOWN / Water Station or Burpee Slam Button",
      })
    );
    expect(pressSlam).toHaveBeenCalledTimes(1);
    expect(announced()).toContain("Burpee slam.");
  });

  it("the DOWN button title describes the slam and the station", () => {
    render(<GarminWatchSimulator initialState={airborneFitness()} />);
    const titled = document.querySelector('[title*="Burpee Slam in mid-air"]');
    expect(titled).not.toBeNull();
    expect(titled?.getAttribute("title")).toContain("Water Station");
  });

  it("on a Water Station, Down still enters the bonus room and does not slam", () => {
    render(<GarminWatchSimulator initialState={onStation()} />);
    fireEvent.keyDown(watch(), { key: "ArrowDown" });
    expect(pressSlam).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Read Telemetry" }));
    expect(announced()).toContain("bonus room");
  });

  it("in Dev Mode Down still jettisons and never slams", () => {
    window.localStorage.setItem("garmin_dev_mode", "1");
    const devRun = {
      ...airborneFitness(),
      rules: "dev" as const,
    };
    const state = allocateVariable(devRun, "array", "probe").state;
    render(<GarminWatchSimulator initialState={state} />);
    fireEvent.click(
      screen.getByRole("button", { name: "DOWN / Jettison Variable Button" })
    );
    expect(pressSlam).not.toHaveBeenCalled();
    expect(announced()).toContain("Jettisoned oldest variable.");
  });

  it("the action button names the Spin Jump in a fitness run", () => {
    render(<GarminWatchSimulator initialState={airborneFitness()} />);
    expect(
      screen.getByRole("button", {
        name: "X / Throw Heat Bolt, Cape Spin or Spin Jump Button",
      })
    ).toBeTruthy();
    const action = document.querySelector('[title*="Spin Jump in mid-air"]');
    expect(action).not.toBeNull();
  });

  it("leaves the action button enabled in Dev Mode with no power, for the spin", () => {
    render(
      <GarminWatchSimulator
        initialState={airborneFitness({ rules: "dev", power: "base" })}
      />
    );
    const button = screen.getByRole<HTMLButtonElement>("button", {
      name: "X / Throw Heat Bolt, Cape Spin or Spin Jump Button",
    });
    expect(button.disabled).toBe(false);
  });
});

describe("Monkey C Mayhem move art (#2023)", () => {
  it("draws speed lines over a slam that a plain fall does not have", () => {
    const count = (calls: string[]) =>
      calls.filter((c) => c === "moveTo").length;
    const slam = recordingCtx();
    renderWatchFace(slam.ctx, { ...airborneFitness(), slamming: true });
    const plain = recordingCtx();
    renderWatchFace(plain.ctx, airborneFitness());
    expect(count(slam.calls)).toBeGreaterThan(count(plain.calls));
  });

  it("rotates the sprite only during a spin jump", () => {
    const spin = recordingCtx();
    renderWatchFace(spin.ctx, {
      ...airborneFitness(),
      spinJump: true,
      runClockMs: 400,
    });
    expect(spin.calls).toContain("rotate");

    const plain = recordingCtx();
    renderWatchFace(plain.ctx, { ...airborneFitness(), spinJump: false });
    expect(plain.calls).not.toContain("rotate");
  });

  it("draws a wall slide in its own pose", () => {
    const wall = recordingCtx();
    renderWatchFace(wall.ctx, {
      ...airborneFitness(),
      wallSide: true,
      wallJumpReady: true,
    });
    const plain = recordingCtx();
    renderWatchFace(plain.ctx, airborneFitness());
    expect(wall.trace).not.toEqual(plain.trace);
  });

  it("shows the move toast text from the popups mechanism", () => {
    const { ctx, texts } = recordingCtx();
    renderWatchFace(ctx, {
      ...airborneFitness(),
      popups: [{ x: PLAYER_X, y: 100, text: MOVE_TOASTS.slam, ttlMs: 800 }],
    });
    expect(texts).toContain("BURPEE SLAM!");
  });
});

describe("Monkey C Mayhem field manual covers the moves (#2023)", () => {
  const manual = GAME_MANUALS["garmin-watch"];
  const ruleTitles = manual.rules.map((r) => r.title);

  it("has a rule for each of the three moves", () => {
    expect(ruleTitles).toEqual(
      expect.arrayContaining(["Burpee Slam", "Wall Jump", "Spin Jump"])
    );
  });

  it("describes the slam's fitness-only rules and the Down control", () => {
    const slam = manual.rules.find((r) => r.title === "Burpee Slam");
    expect(slam?.detail).toMatch(/fitness run/);
    expect(slam?.detail).toMatch(/stomps/);
    expect(slam?.detail).toMatch(/PR Board/);
    expect(slam?.detail).toMatch(/Body Battery/);
    expect(slam?.detail).toMatch(/underwater/);
    const down = manual.controls.find((c) => c.key === "↓");
    expect(down?.action).toMatch(/Burpee Slam/);
    expect(down?.description).toMatch(/Dev Mode/);
  });

  it("says the spin does not break blocks and bounces off spiky foes", () => {
    const spin = manual.rules.find((r) => r.title === "Spin Jump");
    expect(spin?.detail).toMatch(/Move Alert/);
    expect(spin?.detail).toMatch(/Jellyfish/);
    expect(spin?.detail).toMatch(/does not break blocks/);
  });
});
