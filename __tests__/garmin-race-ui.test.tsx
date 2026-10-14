import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { renderWatchFace } from "@/components/garmin-watch/watch-face-art";
import { GAME_MANUALS } from "@/lib/game-manuals";
import {
  FIXED_STEP_MS,
  SATURDAY_SEED,
  raceSetup,
  type RaceSetup,
} from "@/lib/garmin-race";
import { loadBoard, RACE_MODE_KEY } from "@/lib/garmin-race-store";
import { safeClear, safeGetRawItem, safeSetRawItem } from "@/lib/safe-storage";
import { copyToClipboard } from "@/lib/clipboard";
import {
  createInitialState,
  pauseGame,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin-engine";
import { BASE_HEIGHT } from "@/lib/garmin-powerups";
import { GROUND_Y } from "@/lib/garmin-engine";

const frame = vi.hoisted(() => ({
  cb: null as null | ((deltaMs: number) => void),
}));

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
vi.mock("@/hooks/useAnimationFrame", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useAnimationFrame")>();
  return {
    ...actual,
    // The frame loop is driven by hand, so a test sets the delta it wants.
    useAnimationFrame: (callback: (deltaMs: number) => void) => {
      frame.cb = callback;
    },
  };
});
vi.mock("@/lib/clipboard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/clipboard")>();
  return { ...actual, copyToClipboard: vi.fn(async () => {}) };
});
vi.mock("@/lib/garmin-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin-engine")>();
  return {
    ...actual,
    startGame: vi.fn(actual.startGame),
    updateGameSimulation: vi.fn(actual.updateGameSimulation),
  };
});

const saturday: RaceSetup = raceSetup(
  "saturday5k",
  "any",
  new Date(2026, 9, 14)
);

/** A race on the lane, standing at the start, with no foes or obstacles. */
const raceRun = (over: Partial<GameEngineState> = {}): GameEngineState => ({
  ...startGame(createInitialState("fenix", 0), "fenix", undefined, saturday),
  obstacles: [],
  lastObstacleTime: Date.now() + 60_000,
  lastAllocTime: Date.now() + 60_000,
  gpsMs: 0,
  isGrounded: true,
  playerY: GROUND_Y - BASE_HEIGHT,
  distanceMeters: 0,
  ...over,
});

const watch = () => {
  const el = document.querySelector('[data-keyboard-boundary="true"]');
  if (!el) throw new Error("watch keyboard boundary missing");
  return el;
};

const announced = () =>
  mockAnnounce.mock.calls.map((c) => c[0] as string).join(" | ");

/** Picks Race Mode in the companion panel, as a player does. */
const pickRaceMode = () =>
  fireEvent.click(screen.getByRole("radio", { name: "Race Mode" }));

beforeEach(() => {
  mockAnnounce.mockClear();
  frame.cb = null;
  safeClear();
  vi.mocked(startGame).mockClear();
  vi.mocked(updateGameSimulation).mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Race Mode picker (#2019)", () => {
  it("starts on a Training Run, with the picker in a radio group", () => {
    render(<GarminWatchSimulator />);
    const group = screen.getByRole("radiogroup", { name: "Run mode" });
    expect(group).toBeTruthy();
    expect(
      screen
        .getByRole("radio", { name: "Training Run" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "Race Mode" })
        .getAttribute("aria-checked")
    ).toBe("false");
    expect(
      screen.queryByRole("radiogroup", { name: "Race course" })
    ).toBeNull();
  });

  it("shows the course and category, with the rule as help text, in Race Mode", () => {
    render(<GarminWatchSimulator />);
    pickRaceMode();
    expect(
      screen
        .getByRole("radio", { name: "Race Mode" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen.getByRole("radiogroup", { name: "Race course" })
    ).toBeTruthy();
    const categories = screen.getByRole("radiogroup", {
      name: "Race category",
    });
    expect(categories.querySelectorAll('[role="radio"]')).toHaveLength(5);
    expect(screen.getByText("Finish as fast as you can.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "All Kudos" }));
    expect(screen.getByText("Collect every Kudos on the lane.")).toBeTruthy();
    expect(
      screen
        .getByRole("radiogroup", { name: "Race category" })
        .getAttribute("aria-describedby")
    ).toBe("race-category-rule");
  });

  it("moves through the choices with the arrow keys", () => {
    render(<GarminWatchSimulator />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Training Run" }), {
      key: "ArrowRight",
    });
    expect(
      screen
        .getByRole("radio", { name: "Race Mode" })
        .getAttribute("aria-checked")
    ).toBe("true");
    fireEvent.click(screen.getByRole("radio", { name: "Race Mode" }));
    fireEvent.keyDown(screen.getByRole("radio", { name: "Saturday 5K" }), {
      key: "ArrowDown",
    });
    expect(
      screen
        .getByRole("radio", { name: "Daily Workout" })
        .getAttribute("aria-checked")
    ).toBe("true");
  });

  it("persists the picked mode, course and category on this device", () => {
    const { unmount } = render(<GarminWatchSimulator />);
    pickRaceMode();
    fireEvent.click(screen.getByRole("radio", { name: "Daily Workout" }));
    fireEvent.click(screen.getByRole("radio", { name: "Negative Split" }));
    expect(safeGetRawItem(RACE_MODE_KEY)).toBe("1");
    unmount();

    render(<GarminWatchSimulator />);
    expect(
      screen
        .getByRole("radio", { name: "Race Mode" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "Daily Workout" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "Negative Split" })
        .getAttribute("aria-checked")
    ).toBe("true");
  });

  it("greys out Dev Mode in Race Mode without flipping the stored setting", () => {
    safeSetRawItem("garmin_dev_mode", "1");
    render(<GarminWatchSimulator />);
    pickRaceMode();
    const devMode = screen.getByRole("switch", { name: /Dev Mode/ });
    expect(devMode).toHaveProperty("disabled", true);
    expect(devMode.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Races run with Dev Mode off.")).toBeTruthy();
    expect(safeGetRawItem("garmin_dev_mode")).toBe("1");
  });

  it("locks the picker while a race is playing or paused", () => {
    const race = raceRun();
    render(<GarminWatchSimulator initialState={race} />);
    expect(screen.getByRole("radio", { name: "Training Run" })).toHaveProperty(
      "disabled",
      true
    );
    expect(
      screen.getByText("Run mode changes once this run ends.")
    ).toBeTruthy();
  });
});

describe("Race start and restart (#2019)", () => {
  it("passes the picked race setup to startGame when a race starts", () => {
    render(<GarminWatchSimulator />);
    pickRaceMode();
    fireEvent.keyDown(watch(), { key: "Enter" });
    const call = vi.mocked(startGame).mock.calls.at(-1);
    expect(call?.[3]).toEqual({
      course: "saturday5k",
      category: "any",
      seed: SATURDAY_SEED,
    });
    expect(announced()).toContain(
      "Race: Saturday 5K, 5K Any%. Finish as fast as you can."
    );
  });

  it("passes no race to startGame for a Training Run", () => {
    render(<GarminWatchSimulator />);
    fireEvent.keyDown(watch(), { key: "Enter" });
    expect(vi.mocked(startGame).mock.calls.at(-1)?.[3]).toBeUndefined();
  });

  it("restarts a paused race on the same setup with Backspace", () => {
    const paused = pauseGame(raceRun());
    render(<GarminWatchSimulator initialState={paused} />);
    fireEvent.keyDown(watch(), { key: "Backspace" });
    const call = vi.mocked(startGame).mock.calls.at(-1);
    expect(call?.[3]).toEqual(saturday);
    expect(announced()).toContain("Race restarted.");
  });

  it("does not restart a race that is playing", () => {
    render(<GarminWatchSimulator initialState={raceRun()} />);
    vi.mocked(startGame).mockClear();
    fireEvent.keyDown(watch(), { key: "Backspace" });
    expect(vi.mocked(startGame)).not.toHaveBeenCalled();
    expect(announced()).not.toContain("Race restarted.");
  });
});

describe("Fixed step in a race (#2019)", () => {
  it("steps a race at FIXED_STEP_MS, carrying the rest of each frame", () => {
    render(<GarminWatchSimulator initialState={raceRun()} />);
    expect(frame.cb).not.toBeNull();
    // 60 frames of 1000 / 60 ms are exactly 60 fixed steps.
    for (let i = 0; i < 60; i++) {
      act(() => frame.cb?.(1000 / 60));
    }
    const calls = vi.mocked(updateGameSimulation).mock.calls;
    expect(calls).toHaveLength(60);
    expect(calls.every((c) => c[1] === FIXED_STEP_MS)).toBe(true);
  });

  it("runs two steps for a 33 ms frame and none for a 10 ms frame", () => {
    render(<GarminWatchSimulator initialState={raceRun()} />);
    act(() => frame.cb?.(10));
    expect(vi.mocked(updateGameSimulation)).not.toHaveBeenCalled();
    act(() => frame.cb?.(33.4));
    expect(vi.mocked(updateGameSimulation).mock.calls.map((c) => c[1])).toEqual(
      [FIXED_STEP_MS, FIXED_STEP_MS]
    );
  });

  it("keeps a Training Run on one step of the frame's own delta", () => {
    render(
      <GarminWatchSimulator
        initialState={startGame(createInitialState("fenix", 0), "fenix")}
      />
    );
    act(() => frame.cb?.(33.4));
    const calls = vi.mocked(updateGameSimulation).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBe(33.4);
  });
});

describe("Race HUD pill (#2019)", () => {
  /** A context that records every text draw, so a test can read the face's labels. */
  function textOf(state: GameEngineState): string[] {
    const drawn: string[] = [];
    const target: Record<string, unknown> = {
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      measureText: (value: string) => ({ width: value.length * 6 }),
    };
    const proxy = new Proxy(target, {
      get(t, key: string) {
        if (key in t) return t[key];
        return (...args: unknown[]) => {
          if (key === "fillText") drawn.push(String(args[0]));
        };
      },
      set(t, key: string, value) {
        t[key] = value;
        return true;
      },
    });
    const ctx = fromAny<Parameters<typeof renderWatchFace>[0], typeof proxy>(
      proxy
    );
    renderWatchFace(ctx, state);
    return drawn;
  }

  it("shows the course and category while racing", () => {
    expect(textOf(raceRun())).toContain("SAT 5K · ANY%");
    const daily = raceRun({
      race: raceSetup("daily", "nogear", new Date(2026, 9, 14)),
    });
    expect(textOf(daily)).toContain("DAILY · NO GEAR");
  });

  it("draws no race pill in a Training Run", () => {
    const drawn = textOf(startGame(createInitialState("fenix", 0), "fenix"));
    expect(drawn.some((t) => /^(SAT 5K|DAILY) · /.test(t))).toBe(false);
  });
});

describe("Race Report and board (#2019)", () => {
  const finished = (over: Partial<GameEngineState> = {}) =>
    raceRun({
      gameState: "summary",
      runClockMs: 252_330,
      lapSplits: [80_000, 85_000, 87_330],
      bonkedMs: 4_000,
      ...over,
    });

  it("shows the verdict and the race report for a finished race", () => {
    render(<GarminWatchSimulator initialState={finished()} />);
    expect(screen.getByRole("region", { name: "Race report" })).toBeTruthy();
    expect(screen.getAllByText("RACE REPORT").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4:12.33").length).toBeGreaterThan(0);
    expect(screen.getByText("Best lap")).toBeTruthy();
    expect(screen.getAllByText("1:20.00").length).toBeGreaterThan(0);
    expect(screen.getByText("4 s")).toBeTruthy();
    expect(announced()).toContain(
      "Race over: 4:12.33, place 1 on this board, course record."
    );
  });

  it("names a DNF for a race that crashed", () => {
    render(
      <GarminWatchSimulator
        initialState={raceRun({
          gameState: "crashed",
          runClockMs: 60_000,
          crashReport: {
            errorType: "Null Pointer",
            file: "run.mc",
            line: 1,
            stackTrace: [],
            heapUsedKb: 0,
            heapLimitKb: 32,
          },
        })}
      />
    );
    expect(screen.getByText("DNF · did not finish")).toBeTruthy();
    expect(announced()).toContain("Race over: DNF, did not finish.");
  });

  it("names a DNQ and its reason for a race that broke its category rule", () => {
    const allKudos = raceSetup("saturday5k", "allkudos", new Date());
    render(
      <GarminWatchSimulator
        initialState={finished({
          race: allKudos,
          kudosMissed: 2,
        } as Partial<GameEngineState>)}
      />
    );
    expect(screen.getByText("DNQ · 2 Kudos missed")).toBeTruthy();
    expect(announced()).toContain("Race over: DNQ, 2 Kudos missed.");
  });

  it("saves the result to the board once per run", () => {
    const { rerender } = render(
      <GarminWatchSimulator initialState={finished()} />
    );
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toHaveLength(1);
    rerender(<GarminWatchSimulator initialState={finished()} />);
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toHaveLength(1);
  });

  it("does not put a DNF on the board", () => {
    render(
      <GarminWatchSimulator
        initialState={raceRun({ gameState: "shutdown", runClockMs: 9_000 })}
      />
    );
    expect(loadBoard("saturday5k", "any", SATURDAY_SEED)).toEqual([]);
  });

  it("shows the board for this course and category", () => {
    render(<GarminWatchSimulator initialState={finished()} />);
    const board = screen.getByRole("list", { name: "This device's board" });
    expect(board.textContent).toContain("1. 4:12.33");
  });
});

describe("Race share (#2019)", () => {
  const finished = raceRun({
    gameState: "summary",
    runClockMs: 252_330,
    lapSplits: [80_000, 85_000, 87_330],
  });

  it("copies the plain-text result and announces it", async () => {
    render(<GarminWatchSimulator initialState={finished} />);
    fireEvent.click(screen.getByRole("button", { name: "Share result" }));
    await vi.waitFor(() => expect(copyToClipboard).toHaveBeenCalledTimes(1));
    const text = vi.mocked(copyToClipboard).mock.calls[0][0];
    expect(text).toContain("Monkey C Mayhem · Saturday 5K · Any% · 4:12.33");
    expect(await screen.findByText("Copied to the clipboard.")).toBeTruthy();
    expect(announced()).toContain("Result copied.");
  });

  it("shows the text to copy when the clipboard is unavailable", async () => {
    vi.mocked(copyToClipboard).mockRejectedValueOnce(new Error("denied"));
    render(<GarminWatchSimulator initialState={finished} />);
    fireEvent.click(screen.getByRole("button", { name: "Share result" }));
    expect(
      await screen.findByText(/Copy this result: Monkey C Mayhem/)
    ).toBeTruthy();
  });
});

describe("Race Mode manual entry (#2019)", () => {
  it("describes Race Mode in the field manual", () => {
    const manual = JSON.stringify(GAME_MANUALS["garmin-watch"]);
    expect(manual).toContain('"title":"Race Mode"');
    expect(manual).toContain("Backspace restarts it on the same course");
  });
});
