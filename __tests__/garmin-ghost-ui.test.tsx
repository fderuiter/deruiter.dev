import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { renderWatchFace } from "@/components/garmin-watch/watch-face-art";
import { GAME_MANUALS } from "@/lib/game-manuals";
import { raceSetup, type RaceSetup } from "@/lib/garmin/race";
import {
  GHOST_FLAG,
  GHOST_SAMPLE_MS,
  type GhostTrack,
} from "@/lib/garmin/ghost";
import {
  GHOST_ON_KEY,
  GHOST_TARGET_KEY,
  loadGhost,
  saveGhost,
} from "@/lib/garmin/ghost-store";
import { safeClear, safeGetRawItem } from "@/lib/safe-storage";
import {
  GROUND_Y,
  createInitialState,
  startGame,
  updateGameSimulation,
  type GameEngineState,
} from "@/lib/garmin/engine";
import { BASE_HEIGHT } from "@/lib/garmin/powerups";

// The Virtual Partner in the simulator (#2020): the options, the ghost and
// gap on the face, the lap banner gap, saving a new best as the ghost, and
// the report row.

const frame = vi.hoisted(() => ({
  cb: null as null | ((deltaMs: number) => void),
}));
const motion = vi.hoisted(() => ({ reduced: false }));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
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
vi.mock("@/hooks/useAnimationFrame", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/hooks/useAnimationFrame")>();
  return {
    ...actual,
    useAnimationFrame: (callback: (deltaMs: number) => void) => {
      frame.cb = callback;
    },
  };
});
vi.mock("@/lib/garmin/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin/engine")>();
  return {
    ...actual,
    // Races start on a clear lane with GPS locked, so the clock runs at once.
    startGame: vi.fn((...args: Parameters<typeof actual.startGame>) => ({
      ...actual.startGame(...args),
      gpsMs: 0,
      obstacles: [],
      foes: [],
      lastObstacleTime: Date.now() + 600_000,
      lastAllocTime: Date.now() + 600_000,
      isGrounded: true,
      playerY: GROUND_Y - BASE_HEIGHT,
    })),
    updateGameSimulation: vi.fn(actual.updateGameSimulation),
  };
});
vi.mock("@/components/garmin-watch/watch-face-art", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/garmin-watch/watch-face-art")
    >();
  return { ...actual, renderWatchFace: vi.fn(actual.renderWatchFace) };
});

const SATURDAY: RaceSetup = raceSetup("saturday5k", "any", new Date());

/** A ghost running 1 m per sample on stage 1, finishing at `timeMs`. */
function ghost(timeMs = 200_000, lapEndsMs: number[] = []): GhostTrack {
  return {
    intervalMs: GHOST_SAMPLE_MS,
    samples: Array.from({ length: timeMs / GHOST_SAMPLE_MS + 1 }, (_, i) => ({
      d: i,
      y: GROUND_Y - BASE_HEIGHT,
      stage: 1,
      power: "base",
      flags: GHOST_FLAG.grounded,
    })),
    lapEndsMs,
    timeMs,
  };
}

const watch = () => {
  const el = document.querySelector('[data-keyboard-boundary="true"]');
  if (!el) throw new Error("watch keyboard boundary missing");
  return el;
};

/** Picks Race Mode and starts a race, as a player does. */
function startRace() {
  fireEvent.click(screen.getByRole("radio", { name: "Race Mode" }));
  fireEvent.keyDown(watch(), { key: "Enter" });
}

/** Runs `n` frames of 1/60 s. */
function frames(n: number) {
  for (let i = 0; i < n; i++) act(() => frame.cb?.(1000 / 60));
}

type FaceOptions = Parameters<typeof renderWatchFace>[3];

/** The options of the last face drawn. */
const lastOptions = (): FaceOptions =>
  vi.mocked(renderWatchFace).mock.calls.at(-1)?.[3];

/** The state of the last face drawn. */
const lastState = (): GameEngineState | undefined =>
  vi.mocked(renderWatchFace).mock.calls.at(-1)?.[1];

beforeEach(() => {
  frame.cb = null;
  motion.reduced = false;
  safeClear();
  vi.mocked(renderWatchFace).mockClear();
  vi.mocked(updateGameSimulation).mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Virtual Partner options (#2020)", () => {
  it("shows the ghost options in Race Mode only, on and against your PR", () => {
    render(<GarminWatchSimulator />);
    expect(
      screen.queryByRole("radiogroup", { name: "Virtual Partner" })
    ).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "Race Mode" }));
    expect(
      screen
        .getByRole("radio", { name: "Ghost on" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen
        .getByRole("radio", { name: "Your PR" })
        .getAttribute("aria-checked")
    ).toBe("true");
    expect(
      screen
        .getByRole("radiogroup", { name: "Race against" })
        .getAttribute("aria-describedby")
    ).toBe("ghost-target-note");
  });

  it("stores the options and hides the target with the ghost off", () => {
    render(<GarminWatchSimulator />);
    fireEvent.click(screen.getByRole("radio", { name: "Race Mode" }));
    fireEvent.click(screen.getByRole("radio", { name: "Course record" }));
    expect(safeGetRawItem(GHOST_TARGET_KEY)).toBe("cr");
    fireEvent.click(screen.getByRole("radio", { name: "Ghost off" }));
    expect(safeGetRawItem(GHOST_ON_KEY)).toBe("0");
    expect(
      screen.queryByRole("radiogroup", { name: "Race against" })
    ).toBeNull();
  });
});

describe("Virtual Partner on the face (#2020)", () => {
  it("draws the stored ghost and the gap to it while racing", () => {
    saveGhost(SATURDAY, ghost(), new Date());
    render(<GarminWatchSimulator />);
    startRace();
    frames(30);
    const options = lastOptions();
    expect(options?.ghost?.sample.stage).toBe(1);
    expect(options?.ghost?.trail.length).toBeGreaterThan(0);
    expect(typeof options?.ghostGapMs).toBe("number");
  });

  it("draws the ghost without a trail under reduced motion", () => {
    motion.reduced = true;
    saveGhost(SATURDAY, ghost(), new Date());
    render(<GarminWatchSimulator />);
    startRace();
    frames(30);
    expect(lastOptions()?.ghost?.trail).toEqual([]);
  });

  it("draws no ghost when it is off, or the race has none, or in a Training Run", () => {
    saveGhost(SATURDAY, ghost(), new Date());
    const { unmount } = render(<GarminWatchSimulator />);
    fireEvent.click(screen.getByRole("radio", { name: "Race Mode" }));
    fireEvent.click(screen.getByRole("radio", { name: "Ghost off" }));
    fireEvent.keyDown(watch(), { key: "Enter" });
    frames(10);
    expect(lastOptions()?.ghost).toBeUndefined();
    unmount();

    safeClear();
    render(<GarminWatchSimulator />);
    startRace();
    frames(10);
    expect(lastOptions()?.ghost).toBeUndefined();
    cleanup();

    // A Training Run, with a ghost stored for the race.
    safeClear();
    saveGhost(SATURDAY, ghost(), new Date());
    render(<GarminWatchSimulator />);
    fireEvent.keyDown(watch(), { key: "Enter" });
    frames(10);
    expect(lastOptions()?.ghost).toBeUndefined();
  });

  it("adds the gap to the ghost to a lap banner", () => {
    saveGhost(SATURDAY, ghost(200_000, [60_000]), new Date());
    render(<GarminWatchSimulator />);
    startRace();
    frames(2);
    vi.mocked(updateGameSimulation).mockImplementationOnce((s) => ({
      ...s,
      stage: 2,
      lapSplits: [62_400],
      banner: { text: "LAP 1 · 1:02.40", ttlMs: 2000, tone: "good" },
    }));
    frames(1);
    expect(lastState()?.banner?.text).toBe("LAP 1 · 1:02.40 · +0:02.4");
  });

  it("draws the gap pill in red when behind and green when ahead", () => {
    const drawn: { text: string; color: string }[] = [];
    const target: Record<string, unknown> = {
      createRadialGradient: () => ({ addColorStop: () => {} }),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      measureText: (value: string) => ({ width: value.length * 6 }),
    };
    const proxy = new Proxy(target, {
      get(t, key: string) {
        if (key in t) return t[key];
        return (...args: unknown[]) => {
          if (key === "fillText") {
            drawn.push({ text: String(args[0]), color: String(t.fillStyle) });
          }
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
    const race = {
      ...startGame(
        createInitialState("fenix", 0),
        "fenix",
        undefined,
        SATURDAY
      ),
      gpsMs: 0,
    };
    renderWatchFace(ctx, race, undefined, { ghostGapMs: 2_400 });
    renderWatchFace(ctx, race, undefined, { ghostGapMs: -1_100 });
    expect(drawn.find((d) => d.text === "+0:02.4")?.color).toBe("#ef4444");
    expect(drawn.find((d) => d.text === "-0:01.1")?.color).toBe("#10b981");
  });
});

describe("Virtual Partner recording (#2020)", () => {
  /** Ends the race on the next step with `timeMs` on the clock. */
  function finishNextStep(timeMs: number) {
    vi.mocked(updateGameSimulation).mockImplementationOnce((s) => ({
      ...s,
      gameState: "summary",
      runClockMs: timeMs,
      lapSplits: [timeMs],
    }));
    frames(1);
  }

  it("keeps a race that sets the board's best as its ghost", () => {
    render(<GarminWatchSimulator />);
    startRace();
    frames(60);
    finishNextStep(250_000);
    const saved = loadGhost(SATURDAY);
    expect(saved?.timeMs).toBe(250_000);
    expect(saved?.samples.length).toBeGreaterThan(5);
  });

  it("keeps the old ghost when a race is slower, and reports the gap", () => {
    render(<GarminWatchSimulator />);
    startRace();
    frames(10);
    finishNextStep(250_000);
    cleanup();

    render(<GarminWatchSimulator />);
    startRace();
    frames(10);
    finishNextStep(252_400);
    expect(loadGhost(SATURDAY)?.timeMs).toBe(250_000);
    const report = screen.getByRole("region", { name: "Race report" });
    expect(within(report).getByText("Virtual Partner")).toBeTruthy();
    expect(within(report).getByText("+0:02.4 behind")).toBeTruthy();
  });
});

describe("Virtual Partner manual entry (#2020)", () => {
  it("describes the ghost in the field manual", () => {
    const manual = JSON.stringify(GAME_MANUALS["garmin-watch"]);
    expect(manual).toContain('"title":"Virtual Partner"');
    expect(manual).toContain("see-through");
    expect(manual).toContain("With reduced motion the ghost has no trail");
  });
});
