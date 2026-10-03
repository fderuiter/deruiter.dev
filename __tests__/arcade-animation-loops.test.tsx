// @vitest-environment jsdom
//
// Parity coverage for #1624: the Duck, Clinical Trial Chaos, Retro Labyrinth,
// Garmin and Meme Vault loops now run through useAnimationFrame, and Duck's
// keys through useHotkeys. Each test pins a behaviour the hand-rolled loops
// had: when a loop runs, which clock it reads, how it clamps, and how it
// stops and restarts around a lost canvas context.
import React, { Profiler } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, act, cleanup } from "@testing-library/react";
import { fromAny, fromPartial } from "@total-typescript/shoehorn";

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playNote: vi.fn(),
      playSuccess: vi.fn(),
      playHover: vi.fn(),
      volume: 0.8,
      muted: true,
      profile: "8-bit",
      setVolume: vi.fn(),
      setMuted: vi.fn(),
      setProfile: vi.fn(),
    }),
    AudioProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

vi.mock("@/lib/working-with-duck-engine", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/working-with-duck-engine")>();
  return { ...actual, stepDuckGame: vi.fn(actual.stepDuckGame) };
});

vi.mock("@/lib/garmin-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/garmin-engine")>();
  return {
    ...actual,
    updateGameSimulation: vi.fn(actual.updateGameSimulation),
  };
});

// Clinical Chaos timer-bar scenario (#1639): when set, the first sponsor
// email arrives after one second and the next amendment as soon as the
// office allows, so every timer bar is on the board within a few seconds.
const chaosClocks = vi.hoisted(() => ({ fastEvents: false }));

vi.mock("@/lib/clinical-trial-chaos", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/clinical-trial-chaos")>();
  return {
    ...actual,
    tickShiftClocks: vi.fn(actual.tickShiftClocks),
    createInitialSponsorState: (firstRequestDelay?: number) =>
      actual.createInitialSponsorState(
        chaosClocks.fastEvents ? 1 : firstRequestDelay
      ),
    getAmendmentIntervalSeconds: (
      phase: Parameters<typeof actual.getAmendmentIntervalSeconds>[0]
    ) =>
      chaosClocks.fastEvents ? 1 : actual.getAmendmentIntervalSeconds(phase),
  };
});

// Retro Labyrinth hover scenario (#1628): when set, each run is three open
// rooms whose exit sits beside the start, and only runs after the first put
// a TSP room at index 2, the room the player reaches last.
// `lastRoomId` names that third room.
const labyrinthCampaign = vi.hoisted(() => ({
  openRuns: false,
  runs: 0,
  lastRoomId: "tsp",
}));

// Retro Labyrinth: a stationary drone beside the start, and an enemy AI that
// never hurts the player, so the loop can be stepped without ending the run.
vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    generateRoguelikeCampaign: () => {
      const rooms = actual.generateRoguelikeCampaign();
      if (labyrinthCampaign.openRuns) {
        labyrinthCampaign.runs += 1;
        const base = rooms[2];
        const openGrid = base.grid.map((row, y) =>
          row.map((cell, x) =>
            y === 0 || x === 0 || y === base.grid.length - 1 || x === 14
              ? "#"
              : " "
          )
        );
        const openRoom = (index: number) => ({
          ...base,
          index,
          grid: openGrid.map((row) => [...row]),
          startX: 12,
          startY: 7,
          enemies: [],
          items: [],
          boss: undefined,
          tspNodes: [],
          tspMovingWalls: [],
        });
        return [
          openRoom(0),
          openRoom(1),
          {
            ...openRoom(2),
            id:
              labyrinthCampaign.runs > 1
                ? labyrinthCampaign.lastRoomId
                : base.id,
          },
        ];
      }
      const first = rooms[0];
      const droneX = first.startX + 1;
      const grid = first.grid.map((row) => [...row]);
      grid[first.startY][droneX] = " ";
      rooms[0] = {
        ...first,
        grid,
        enemies: [
          fromPartial({
            id: "test-drone",
            type: "drone",
            name: "Test Drone",
            x: droneX,
            y: first.startY,
            hp: 40,
            maxHp: 40,
            state: "patrol",
            patrolDir: "right",
            minX: droneX,
            maxX: droneX,
            symbol: "D",
            color: "#38bdf8",
          }),
        ],
      };
      return rooms;
    },
    updateEnemyAI: vi.fn(
      (enemies: Parameters<typeof actual.updateEnemyAI>[0]) => ({
        updatedEnemies: enemies,
        damageToPlayer: 0,
        contactedPlayer: false,
      })
    ),
  };
});

import { WorkingWithDuck } from "@/components/WorkingWithDuck";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";
import { ClinicalTrialChaos } from "@/components/ClinicalTrialChaos";
import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { MemeVaultClient } from "@/components/arcade/MemeVaultClient";
import { stepDuckGame } from "@/lib/working-with-duck-engine";
import {
  createInitialState,
  startGame,
  updateGameSimulation,
} from "@/lib/garmin-engine";
import { tickShiftClocks } from "@/lib/clinical-trial-chaos";
import { ENEMY_STEP_INTERVAL_MS, updateEnemyAI } from "@/lib/dungeon";

/**
 * Frame scheduler driven by the test: frames run only on `tick(timestamp)`,
 * so every delta a loop sees is exact.
 */
function installFrameScheduler() {
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: FrameRequestCallback) => {
      const id = nextId++;
      pending.set(id, cb);
      return id;
    })
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((id: number) => {
      pending.delete(id);
    })
  );
  return {
    pendingCount: () => pending.size,
    tick(timestamp: number) {
      const batch = [...pending.values()];
      pending.clear();
      act(() => {
        for (const cb of batch) cb(timestamp);
      });
    },
  };
}

function installCanvasContext() {
  const ctx = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === "measureText") {
          return (text: string) => ({ width: (text || "").length * 8 });
        }
        if (
          prop === "createRadialGradient" ||
          prop === "createLinearGradient"
        ) {
          return () => ({ addColorStop: () => {} });
        }
        if (prop === "getImageData" || prop === "createImageData") {
          return () => ({
            width: 1,
            height: 1,
            data: new Uint8ClampedArray(4),
          });
        }
        if (prop === "getLineDash") return () => [];
        return () => {};
      },
      set: () => true,
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() =>
    fromAny(ctx)
  );
}

/**
 * Replaces the canvas context with one that remembers its fill style and
 * counts the Retro Labyrinth hover highlight's fills.
 */
function countLabyrinthHoverFills() {
  const hoverFill = "rgba(34, 211, 238, 0.2)";
  let hoverFills = 0;
  const style: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(style, {
    get: (target, prop) => {
      if (prop === "fillRect") {
        return () => {
          if (target.fillStyle === hoverFill) hoverFills += 1;
        };
      }
      if (prop === "measureText") {
        return (text: string) => ({ width: (text || "").length * 8 });
      }
      if (prop === "createRadialGradient" || prop === "createLinearGradient") {
        return () => ({ addColorStop: () => {} });
      }
      if (prop === "getImageData" || prop === "createImageData") {
        return () => ({
          width: 1,
          height: 1,
          data: new Uint8ClampedArray(4),
        });
      }
      if (prop === "getLineDash") return () => [];
      if (prop in target) return target[prop];
      return () => {};
    },
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  });
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() =>
    fromAny(ctx)
  );
  return {
    count: () => hoverFills,
    reset: () => {
      hoverFills = 0;
    },
  };
}

function installStorage() {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {},
      key: () => null,
      length: 0,
    },
  });
}

function mockReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: reduced && query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

function clickButton(container: HTMLElement, text: string | RegExp) {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    typeof text === "string"
      ? b.textContent?.trim() === text
      : text.test(b.textContent ?? "")
  );
  if (!button) throw new Error(`button not found: ${String(text)}`);
  fireEvent.click(button);
}

function loseContext(canvas: HTMLCanvasElement) {
  act(() => {
    canvas.dispatchEvent(new Event("contextlost", { cancelable: true }));
  });
}

function restoreContext(canvas: HTMLCanvasElement) {
  act(() => {
    canvas.dispatchEvent(new Event("contextrestored"));
  });
}

let scheduler: ReturnType<typeof installFrameScheduler>;

beforeEach(() => {
  scheduler = installFrameScheduler();
  installCanvasContext();
  installStorage();
  mockReducedMotion(false);
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(stepDuckGame).mockClear();
  vi.mocked(updateGameSimulation).mockClear();
  vi.mocked(tickShiftClocks).mockClear();
  vi.mocked(updateEnemyAI).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WorkingWithDuck loop on useAnimationFrame (#1624)", () => {
  function startSprint() {
    const { container } = render(<WorkingWithDuck />);
    clickButton(container, /Start Sprint 1/);
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("duck canvas not rendered");
    return { container, canvas };
  }

  it("runs one fixed step on the first frame and replays unclamped gaps up to eight steps", () => {
    startSprint();

    scheduler.tick(1000);
    expect(stepDuckGame).toHaveBeenCalledTimes(1);

    // 120 ms is seven 60 Hz steps. A 100 ms frame clamp would give six.
    scheduler.tick(1120);
    expect(stepDuckGame).toHaveBeenCalledTimes(8);

    // A long gap is capped at eight catch-up steps.
    scheduler.tick(6120);
    expect(stepDuckGame).toHaveBeenCalledTimes(16);
  });

  it("stops while the canvas context is lost and resumes with one fixed step", () => {
    const { canvas } = startSprint();
    scheduler.tick(0);
    scheduler.tick(16);
    const before = vi.mocked(stepDuckGame).mock.calls.length;

    loseContext(canvas);
    expect(scheduler.pendingCount()).toBe(0);

    restoreContext(canvas);
    expect(scheduler.pendingCount()).toBe(1);
    scheduler.tick(90_000);
    expect(stepDuckGame).toHaveBeenCalledTimes(before + 1);
  });

  it("keeps drawing while idle without stepping the simulation", () => {
    render(<WorkingWithDuck />);
    scheduler.tick(0);
    scheduler.tick(500);
    expect(stepDuckGame).not.toHaveBeenCalled();
    expect(scheduler.pendingCount()).toBe(1);
  });
});

describe("WorkingWithDuck keys on useHotkeys (#1624)", () => {
  function renderFocused() {
    const { container } = render(<WorkingWithDuck />);
    const board = container.querySelector<HTMLElement>(
      '[data-keyboard-boundary="true"]'
    );
    if (!board) throw new Error("duck board not rendered");
    act(() => board.focus());
    return board;
  }

  function pressSpace(target: EventTarget, init: KeyboardEventInit = {}) {
    const event = new KeyboardEvent("keydown", {
      key: " ",
      code: "Space",
      bubbles: true,
      cancelable: true,
      ...init,
    });
    act(() => {
      target.dispatchEvent(event);
    });
    return event;
  }

  it("handles a key from inside the game's keyboard boundary", () => {
    const board = renderFocused();
    expect(pressSpace(board).defaultPrevented).toBe(true);
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Meta", { metaKey: true }],
    ["Shift", { shiftKey: true }],
    ["Ctrl+Alt+Meta", { ctrlKey: true, altKey: true, metaKey: true }],
  ])(
    "still accepts the key with %s held, as the old listener did",
    (_, mods) => {
      const board = renderFocused();
      expect(pressSpace(board, mods).defaultPrevented).toBe(true);
    }
  );

  it("ignores keys while focus is outside the game", () => {
    renderFocused();
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(pressSpace(document.body).defaultPrevented).toBe(false);
  });

  it("leaves keys to a focused button inside the game", () => {
    const board = renderFocused();
    const button = board.querySelector("button");
    if (!button) throw new Error("no button in the duck board");
    act(() => button.focus());
    expect(pressSpace(button).defaultPrevented).toBe(false);
  });
});

describe("GarminWatchSimulator loop on useAnimationFrame (#1624)", () => {
  function renderPlaying() {
    const started = startGame(createInitialState("fenix", 0), "fenix");
    const seed = { ...started, obstacles: [], lastObstacleTime: Date.now() };
    const { container } = render(<GarminWatchSimulator initialState={seed} />);
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("garmin canvas not rendered");
    return canvas;
  }

  const deltas = () =>
    vi.mocked(updateGameSimulation).mock.calls.map(([, dt]) => dt);

  it("starts with a zero delta and clamps each delta to 40 ms", () => {
    renderPlaying();
    scheduler.tick(1000);
    scheduler.tick(1016);
    scheduler.tick(1116);
    expect(deltas()).toEqual([0, 16, 40]);
  });

  // The old loop re-anchored on performance.now() at the restore event, so
  // its first delta after a restore was the gap to the next frame's
  // timestamp, clamped to 40 ms (negative when the frame began earlier).
  // A restarted useAnimationFrame loop starts at zero instead.
  it("stops while the canvas context is lost and restarts with a zero delta", () => {
    const canvas = renderPlaying();
    scheduler.tick(0);
    scheduler.tick(16);

    loseContext(canvas);
    expect(scheduler.pendingCount()).toBe(0);

    restoreContext(canvas);
    scheduler.tick(5000);
    scheduler.tick(5016);
    expect(deltas()).toEqual([0, 16, 0, 16]);
  });
});

describe("ClinicalTrialChaos loop on useAnimationFrame (#1624)", () => {
  let now = 0;

  beforeEach(() => {
    now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
  });

  function startShift() {
    const { container } = render(<ClinicalTrialChaos />);
    expect(scheduler.pendingCount()).toBe(0);
    clickButton(container, "Start Phase 1");
    clickButton(container, "Skip calibration");
    const canvas = container.querySelector<HTMLCanvasElement>(
      'canvas[role="application"]'
    );
    if (!canvas) throw new Error("conveyor canvas not rendered");
    vi.mocked(tickShiftClocks).mockClear();
    return canvas;
  }

  const deltaSeconds = () =>
    vi.mocked(tickShiftClocks).mock.calls.map(([, dt]) => dt);

  it("runs only while a shift plays, on the Date.now() clock clamped to 100 ms", () => {
    startShift();
    expect(scheduler.pendingCount()).toBeGreaterThan(0);

    now += 50;
    scheduler.tick(16);
    now += 500;
    scheduler.tick(32);
    expect(deltaSeconds()).toEqual([0.05, 0.1]);
  });

  it("stops while the canvas context is lost and resumes from the restore time", () => {
    const canvas = startShift();
    now += 20;
    scheduler.tick(16);

    loseContext(canvas);
    expect(scheduler.pendingCount()).toBe(0);

    now += 60_000;
    restoreContext(canvas);
    now += 30;
    scheduler.tick(32);
    expect(deltaSeconds()).toEqual([0.02, 0.03]);
  });
});

describe("RetroLabyrinth loop on useAnimationFrame (#1624)", () => {
  function renderLabyrinth() {
    const { container } = render(<RetroLabyrinth isMounted={true} />);
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("labyrinth canvas not rendered");
    return canvas;
  }

  const enemyDeltas = () =>
    vi.mocked(updateEnemyAI).mock.calls.map((call) => call[4]);

  // #1665: enemies step once per ENEMY_STEP_INTERVAL_MS of play, and each
  // step is handed the play time since the previous one.
  it("skips the zero-delta first frame and steps enemies on clamped play time", () => {
    renderLabyrinth();
    scheduler.tick(1000);
    for (let i = 1; i <= 8; i++) scheduler.tick(1000 + i * 200);
    // 8 frames clamped to 40 ms is 320 ms of play, short of one step.
    expect(enemyDeltas()).toEqual([]);
    scheduler.tick(1000 + 9 * 200);
    expect(enemyDeltas()).toEqual([ENEMY_STEP_INTERVAL_MS + 27]);
  });

  it("steps enemies as often on a 144 Hz display as on a 60 Hz one (#1665)", () => {
    const stepsInOneSecond = (hz: number) => {
      vi.mocked(updateEnemyAI).mockClear();
      // Before #1665 a 5% roll per frame gated each step; pin it so the
      // frame-count dependence shows.
      vi.spyOn(Math, "random").mockReturnValue(0);
      const { unmount } = render(<RetroLabyrinth isMounted={true} />);
      const frameMs = 1000 / hz;
      for (let frame = 0; frame <= hz; frame++) scheduler.tick(frame * frameMs);
      const steps = vi.mocked(updateEnemyAI).mock.calls.length;
      unmount();
      return steps;
    };
    const at60 = stepsInOneSecond(60);
    const at144 = stepsInOneSecond(144);
    expect(at60).toBe(Math.floor(1000 / ENEMY_STEP_INTERVAL_MS));
    expect(at144).toBe(at60);
  });

  // As with Garmin, the first delta after a restore is now zero rather than
  // the performance.now()-relative gap the old loop measured.
  it("stops while the canvas context is lost and restarts with a zero delta", () => {
    const canvas = renderLabyrinth();
    scheduler.tick(0);
    scheduler.tick(16);

    loseContext(canvas);
    expect(scheduler.pendingCount()).toBe(0);

    restoreContext(canvas);
    scheduler.tick(9000);
    for (let i = 1; i <= 8; i++) scheduler.tick(9000 + i * 40);
    // 16 ms before the loss, nothing for the restore frame, then 8 x 40 ms.
    expect(enemyDeltas()).toEqual([336]);
  });
});

// #1526 replaced the always-on spectrum bars with an oscilloscope that only
// animates while a pad is playing. At rest no frame is ever requested.
describe("MemeVaultClient oscilloscope loop (#1624, #1526)", () => {
  it("requests no animation frames at rest", () => {
    const { container } = render(<MemeVaultClient />);
    expect(scheduler.pendingCount()).toBe(0);
    const scope = container.querySelector('[data-testid="meme-oscilloscope"]');
    expect(scope?.getAttribute("data-live")).toBe("false");
  });

  it("stays still when a pad is pressed with sound off", () => {
    const { container } = render(<MemeVaultClient />);
    const pad = container.querySelector<HTMLButtonElement>(
      "button[aria-label^='Play ']"
    );
    if (!pad) throw new Error("pad not rendered");
    fireEvent.click(pad);
    expect(pad.getAttribute("data-lit")).toBe("true");
    expect(scheduler.pendingCount()).toBe(0);
  });

  it("runs no loop under reduced motion", () => {
    mockReducedMotion(true);
    render(<MemeVaultClient />);
    expect(scheduler.pendingCount()).toBe(0);
  });
});

// #1628: three loop reads that went stale once the loops moved onto
// useAnimationFrame. Each test fails against the loops that shipped in #1627.
describe("arcade loops read current state (#1628)", () => {
  afterEach(() => {
    labyrinthCampaign.openRuns = false;
    labyrinthCampaign.runs = 0;
    labyrinthCampaign.lastRoomId = "tsp";
  });

  function labyrinthBoard(container: HTMLElement) {
    const board = container.querySelector<HTMLElement>(
      '[data-keyboard-boundary="true"]'
    );
    if (!board) throw new Error("labyrinth keyboard boundary not rendered");
    return board;
  }

  it("ends a Retro Labyrinth side effect after its stated duration", () => {
    let now = 1_800_000_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const { container } = render(<RetroLabyrinth isMounted={true} />);
    // Keep enemy AI and cursor steering out of the way.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    scheduler.tick(1000);

    // Slot 1 is npm install, whose dependency bloat lasts 4 seconds.
    fireEvent.keyDown(labyrinthBoard(container), { key: "1" });
    expect(container.textContent).toContain("DEPENDENCY_BLOAT.LOG");

    now += 3900;
    scheduler.tick(4900);
    expect(container.textContent).toContain("DEPENDENCY_BLOAT.LOG");

    now += 200;
    scheduler.tick(5100);
    expect(container.textContent).not.toContain("DEPENDENCY_BLOAT.LOG");
  });

  it("draws the TSP hover highlight from the current run's rooms", () => {
    labyrinthCampaign.openRuns = true;
    const hover = countLabyrinthHoverFills();

    const { container } = render(<RetroLabyrinth isMounted={true} />);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    scheduler.tick(0);

    // Clear rooms 0 and 1: each exit is one step right of the start, and
    // every room load generates a fresh run.
    const board = labyrinthBoard(container);
    for (let room = 0; room < 2; room++) {
      fireEvent.keyDown(board, { key: "ArrowRight" });
      fireEvent.keyDown(board, { key: "Enter" });
    }
    // Only the runs generated after mount have a TSP room at index 2.
    expect(labyrinthCampaign.runs).toBeGreaterThan(2);

    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("labyrinth canvas not rendered");
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
      fromPartial({ left: 0, top: 0, width: 300, height: 150 })
    );
    fireEvent.mouseMove(canvas, { clientX: 30, clientY: 30 });

    hover.reset();
    scheduler.tick(16);
    expect(hover.count()).toBe(1);
  });

  it("re-renders Clinical Trial Chaos only when a visible second changes", () => {
    let now = 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    let commits = 0;
    const { container } = render(
      <Profiler
        id="clinical-trial-chaos"
        onRender={() => {
          commits += 1;
        }}
      >
        <ClinicalTrialChaos />
      </Profiler>
    );
    clickButton(container, "Start Phase 1");
    clickButton(container, "Skip calibration");

    // Run the shift clocks past a displayed second.
    for (let frame = 1; frame <= 12; frame++) {
      now += 100;
      scheduler.tick(frame * 100);
    }

    // Ten 5 ms frames: at most one displayed second can roll over.
    commits = 0;
    for (let frame = 1; frame <= 10; frame++) {
      now += 5;
      scheduler.tick(2000 + frame * 5);
    }
    expect(commits).toBeLessThanOrEqual(1);

    // A second later the countdowns have moved, so the board renders.
    commits = 0;
    for (let frame = 1; frame <= 11; frame++) {
      now += 100;
      scheduler.tick(3000 + frame * 100);
    }
    expect(commits).toBeGreaterThan(0);
  });
});

// #1639: the TSP room's hover highlight never drew in the real campaign, and
// Clinical Chaos timer bars held still between once-a-second commits.
describe("arcade hover and timer bars (#1639)", () => {
  afterEach(() => {
    labyrinthCampaign.openRuns = false;
    labyrinthCampaign.runs = 0;
    labyrinthCampaign.lastRoomId = "tsp";
    chaosClocks.fastEvents = false;
  });

  function labyrinthBoard(container: HTMLElement) {
    const board = container.querySelector<HTMLElement>(
      '[data-keyboard-boundary="true"]'
    );
    if (!board) throw new Error("labyrinth keyboard boundary not rendered");
    return board;
  }

  function labyrinthCanvas(container: HTMLElement) {
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("labyrinth canvas not rendered");
    // One 16 px cell per grid square on the 240 x 144 canvas.
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue(
      fromPartial({ left: 0, top: 0, width: 240, height: 144 })
    );
    return canvas;
  }

  function playerLocation(container: HTMLElement) {
    return /Player Location: Grid \((\d+), (\d+)\)/
      .exec(container.textContent ?? "")
      ?.slice(1, 3);
  }

  it("highlights the hovered tile in the campaign's first room, the TSP room", () => {
    const hover = countLabyrinthHoverFills();
    const { container } = render(<RetroLabyrinth isMounted={true} />);
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    scheduler.tick(0);
    expect(container.textContent).toContain("Zero-Trust Enclave");

    const canvas = labyrinthCanvas(container);
    fireEvent.mouseMove(canvas, { clientX: 24, clientY: 120 });
    hover.reset();
    scheduler.tick(16);
    expect(hover.count()).toBe(1);

    // Leaving the canvas clears the highlight.
    fireEvent.mouseLeave(canvas);
    hover.reset();
    scheduler.tick(32);
    expect(hover.count()).toBe(0);
  });

  it("does not steer the player towards the cursor in the TSP room", () => {
    const { container } = render(<RetroLabyrinth isMounted={true} />);
    // Every mouse move would pass BlinkBrowse's 20% steering roll.
    vi.spyOn(Math, "random").mockReturnValue(0);
    scheduler.tick(0);
    expect(playerLocation(container)).toEqual(["1", "1"]);

    // The cursor sits on an open cell six rows below the start.
    const canvas = labyrinthCanvas(container);
    for (let i = 0; i < 5; i++) {
      fireEvent.mouseMove(canvas, { clientX: 24, clientY: 120 });
    }
    expect(playerLocation(container)).toEqual(["1", "1"]);
  });

  it("still steers the player towards the cursor in BlinkBrowse", () => {
    labyrinthCampaign.openRuns = true;
    labyrinthCampaign.lastRoomId = "blinkbrowse";
    const { container } = render(<RetroLabyrinth isMounted={true} />);
    vi.spyOn(Math, "random").mockReturnValue(0);
    scheduler.tick(0);

    const board = labyrinthBoard(container);
    for (let room = 0; room < 2; room++) {
      fireEvent.keyDown(board, { key: "ArrowRight" });
      fireEvent.keyDown(board, { key: "Enter" });
    }
    expect(playerLocation(container)).toEqual(["12", "7"]);

    // The cursor is on the player's row, to the left.
    fireEvent.mouseMove(labyrinthCanvas(container), {
      clientX: 40,
      clientY: 120,
    });
    expect(playerLocation(container)).toEqual(["11", "7"]);
  });

  it("gives each linear timer bar a transition as long as its longest hold", () => {
    chaosClocks.fastEvents = true;
    let now = 50_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const { container } = render(<ClinicalTrialChaos />);
    clickButton(container, "Start Phase 1");
    clickButton(container, "Skip calibration");

    // When each linear timer bar's width changed, by element.
    const history = new Map<Element, { width: string; at: number[] }>();
    const sample = (t: number) => {
      container
        .querySelectorAll('[class*="transition-[width]"][class*="ease-linear"]')
        .forEach((bar) => {
          const width = (bar as HTMLElement).style.width;
          const seen = history.get(bar);
          if (!seen) {
            history.set(bar, { width, at: [] });
          } else if (seen.width !== width) {
            seen.width = width;
            seen.at.push(t);
          }
        });
    };

    // Nine simulated seconds of 50 ms frames. The sponsor writes after one
    // second and the first amendment arrives at the office's five-second
    // floor; later amendments wait the phase's usual interval.
    for (let t = 50; t <= 9000; t += 50) {
      now += 50;
      scheduler.tick(t);
      if (container.textContent?.includes("Protocol amendment:")) {
        chaosClocks.fastEvents = false;
      }
      sample(t);
    }

    const checked = new Set<string>();
    for (const [bar, { at }] of history) {
      if (at.length < 3) continue;
      const kind = bar.closest('[aria-label="Sponsor email"]')
        ? "sponsor"
        : bar.closest("li")
          ? "subject"
          : "amendment";
      checked.add(kind);
      const className = bar.getAttribute("class") ?? "";
      const holds = at.slice(1).map((t, i) => t - at[i]);
      const duration = Number(/\bduration-(\d+)\b/.exec(className)?.[1]);
      // A shorter transition finishes early, and the bar then holds still
      // until the next commit.
      expect(duration, kind).toBeGreaterThanOrEqual(Math.max(...holds));
      // Reduced motion keeps the stepped bar.
      expect(className, kind).toContain("motion-reduce:transition-none");
    }
    expect(checked).toEqual(new Set(["subject", "sponsor", "amendment"]));
  });
});
