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
import { GAME_MANUALS } from "@/lib/game-manuals";
import { getArcadeProgress } from "@/lib/arcade-achievements";
import { BADGE_STORAGE_KEY, loadBadges } from "@/lib/garmin/badge-store";
import { RACE_MODE_KEY } from "@/lib/garmin/race-store";
import { safeClear, safeSetRawItem } from "@/lib/safe-storage";
import {
  GROUND_Y,
  createInitialState,
  startGame,
  updateGameSimulation,
} from "@/lib/garmin/engine";
import { BASE_HEIGHT } from "@/lib/garmin/powerups";

// Badges and run history in the simulator (#2021): runs are saved as they
// end, new badges show on the result card and are read out, and the badge
// case and history list in the companion panel.

const frame = vi.hoisted(() => ({
  cb: null as null | ((deltaMs: number) => void),
}));
const said = vi.hoisted(() => ({ texts: [] as string[] }));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: (text: string) => {
      said.texts.push(text);
    },
  }),
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
    useAnimationFrame: (callback: (deltaMs: number) => void) => {
      frame.cb = callback;
    },
  };
});
vi.mock("@/lib/garmin/engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin/engine")>();
  return {
    ...actual,
    // Workouts start on a clear lane with GPS locked.
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

const watch = () => {
  const el = document.querySelector('[data-keyboard-boundary="true"]');
  if (!el) throw new Error("watch keyboard boundary missing");
  return el;
};
const key = (k: string) => fireEvent.keyDown(watch(), { key: k });

/** Runs `n` frames of 1/60 s. */
function frames(n: number) {
  for (let i = 0; i < n; i++) act(() => frame.cb?.(1000 / 60));
}

const NEG_SPLITS = [60_000, 58_000, 56_000, 54_000, 52_000];

/** Ends the run on the next step: the 5K finished, or out of lives. */
function endNextStep(finished: boolean, extra = {}) {
  vi.mocked(updateGameSimulation).mockImplementationOnce((s) => ({
    ...s,
    gameState: finished ? "summary" : "crashed",
    runClockMs: 280_000,
    lapSplits: finished ? NEG_SPLITS : [],
    distanceMeters: finished ? 5000 : 1200,
    kudos: 12,
    lives: finished ? 2 : 0,
    ...extra,
  }));
  frames(1);
}

const badgeCase = () => screen.getByRole("list", { name: "Badge case" });
const badgeItem = (name: string) =>
  within(badgeCase())
    .getAllByRole("listitem")
    .find((li) => li.textContent?.startsWith(name));

beforeEach(() => {
  frame.cb = null;
  said.texts = [];
  safeClear();
  vi.mocked(startGame).mockClear();
  vi.mocked(updateGameSimulation).mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("badges and run history in the simulator (#2021)", () => {
  it("saves a finished 5K, shows its badges and reads them out", () => {
    render(<GarminWatchSimulator />);
    expect(badgeItem("First 5K")?.textContent).toContain("Not yet earned");
    key("Enter");
    frames(2);
    endNextStep(true);

    const save = loadBadges();
    expect(save.runs).toHaveLength(1);
    expect(save.runs[0]).toMatchObject({
      mode: "training",
      finished: true,
      timeMs: 280_000,
      meters: 5000,
      kudos: 12,
    });
    expect(Object.keys(save.badges).sort()).toEqual(
      ["first5k", "legday", "negsplit"].sort()
    );
    expect(said.texts).toContain(
      "3 badges earned: First 5K, Negative Splitter, Never Skip Leg Day."
    );
    const toasts = screen.getByRole("list", { name: "Badges earned" });
    expect(toasts.textContent).toContain("BADGE EARNED · FIRST 5K");
    expect(badgeItem("First 5K")?.textContent).toContain("Earned");
    expect(badgeItem("First 5K")?.textContent).toContain("New");
    expect(screen.getByText(/Badge case: 3 of 10 earned/)).toBeTruthy();
    // First 5K is the 5K Finisher trophy's milestone too.
    expect(getArcadeProgress().unlockedTrophies.garmin_gc_master).toBeDefined();

    const history = screen.getByRole("list", {
      name: "Run history, newest first",
    });
    expect(within(history).getAllByRole("listitem")).toHaveLength(1);
    // The result screen keeps drawing; the run is still saved once.
    frames(12);
    expect(loadBadges().runs).toHaveLength(1);
    expect(history.textContent).toContain("Training");
    expect(history.textContent).toContain("4:40.00");
    expect(history.textContent).toContain("5.00 km");
    expect(history.textContent).toContain("12 Kudos");
  });

  it("earns Couch to 5K after a DNF the same day, and lists both runs", () => {
    render(<GarminWatchSimulator />);
    key("Enter");
    frames(2);
    endNextStep(false);
    expect(loadBadges().runs[0].finished).toBe(false);
    expect(screen.queryByRole("list", { name: "Badges earned" })).toBeNull();

    key("Enter");
    frames(2);
    endNextStep(true);
    expect(loadBadges().badges.couch).toBeTruthy();
    const history = screen.getByRole("list", {
      name: "Run history, newest first",
    });
    const rows = within(history).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("4:40.00");
    expect(rows[1].textContent).toContain("DNF");
  });

  it("does not earn Never Skip Leg Day when sprint was held", () => {
    render(<GarminWatchSimulator />);
    key("Enter");
    frames(2);
    key("ArrowRight");
    frames(1);
    endNextStep(true);
    expect(loadBadges().badges.legday).toBeUndefined();
    expect(loadBadges().badges.first5k).toBeTruthy();
  });

  it("earns the race badges for a clean race under five minutes", () => {
    safeSetRawItem(RACE_MODE_KEY, "1");
    render(<GarminWatchSimulator />);
    key("Enter");
    frames(2);
    endNextStep(true, { kudosMissed: 0, gearTaken: false });
    const save = loadBadges();
    expect(save.runs[0].mode).toBe("race");
    expect(save.badges).toMatchObject({
      sub5: expect.any(String),
      allkudos: expect.any(String),
      nogear: expect.any(String),
    });
  });

  it("starts over from a corrupt save, and still records the next run", () => {
    safeSetRawItem(BADGE_STORAGE_KEY, "{broken");
    render(<GarminWatchSimulator />);
    expect(screen.getByText(/Badge case: 0 of 10 earned/)).toBeTruthy();
    expect(screen.getByText(/No runs yet/)).toBeTruthy();
    key("Enter");
    frames(2);
    endNextStep(false);
    expect(loadBadges().runs).toHaveLength(1);
  });

  it("does not record a finished run handed in before any run starts", () => {
    render(
      <GarminWatchSimulator
        initialState={{
          ...startGame(createInitialState("fenix", 0, []), "fenix"),
          gameState: "summary",
        }}
      />
    );
    expect(loadBadges().runs).toHaveLength(0);
  });

  it("explains every badge in the manual", () => {
    const manual = JSON.stringify(GAME_MANUALS["garmin-watch"]);
    expect(manual).toContain('"title":"Badges and Run History"');
    expect(manual).toContain("Never Skip Leg Day");
    expect(manual).toContain("Couch to 5K");
  });
});
