// @vitest-environment jsdom
//
// Parity coverage for #1624: the Duck, Clinical Trial Chaos, Retro Labyrinth,
// Garmin and Meme Vault loops now run through useAnimationFrame, and Duck's
// keys through useHotkeys. Each test pins a behaviour the hand-rolled loops
// had: when a loop runs, which clock it reads, how it clamps, and how it
// stops and restarts around a lost canvas context.
import React from "react";
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

vi.mock("@/lib/clinical-trial-chaos", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/clinical-trial-chaos")>();
  return { ...actual, tickShiftClocks: vi.fn(actual.tickShiftClocks) };
});

// Retro Labyrinth: a stationary drone beside the start, and an enemy AI that
// never hurts the player, so the loop can be stepped without ending the run.
vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    generateRoguelikeCampaign: () => {
      const rooms = actual.generateRoguelikeCampaign();
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
        caughtPlayer: false,
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
import { updateEnemyAI } from "@/lib/dungeon";

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
    // Enemy AI runs on 5% of frames; make every frame one of them.
    vi.spyOn(Math, "random").mockReturnValue(0);
    return canvas;
  }

  const enemyDeltas = () =>
    vi.mocked(updateEnemyAI).mock.calls.map((call) => call[4]);

  it("skips enemy AI on the zero-delta first frame and clamps later deltas to 40 ms", () => {
    renderLabyrinth();
    scheduler.tick(1000);
    scheduler.tick(1016);
    scheduler.tick(1216);
    expect(enemyDeltas()).toEqual([16, 40]);
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
    scheduler.tick(9020);
    expect(enemyDeltas()).toEqual([16, 20]);
  });
});

describe("MemeVaultClient spectrum loop on useAnimationFrame (#1624)", () => {
  function barScales(container: HTMLElement) {
    return Array.from(
      container.querySelectorAll<HTMLElement>('[style*="--bar-scale"]')
    ).map((el) => el.style.getPropertyValue("--bar-scale"));
  }

  // The waveform is a function of time. The hook passes elapsed time rather
  // than the frame timestamp, so the visualizer anchors its clock on
  // performance.now() at the first frame; the phase advances by exactly the
  // frame-to-frame gap, as it did with raw timestamps.
  it("animates the idle breath on the frame clock", () => {
    vi.spyOn(performance, "now").mockReturnValue(4000);
    const { container } = render(<MemeVaultClient />);
    expect(scheduler.pendingCount()).toBeGreaterThan(0);

    scheduler.tick(100);
    const breath = (t: number, i: number) =>
      (0.1 + Math.sin(t * 0.002 + i * 0.3) * 0.06).toFixed(4);
    expect(barScales(container).slice(0, 2)).toEqual([
      breath(4000, 0),
      breath(4000, 1),
    ]);

    scheduler.tick(350);
    expect(barScales(container).slice(0, 2)).toEqual([
      breath(4250, 0),
      breath(4250, 1),
    ]);
  });

  it("holds the bars still and runs no loop under reduced motion", () => {
    mockReducedMotion(true);
    const { container } = render(<MemeVaultClient />);
    expect(scheduler.pendingCount()).toBe(0);
    const scales = barScales(container);
    expect(scales.length).toBe(24);
    expect(new Set(scales)).toEqual(new Set(["0.15"]));
  });
});
