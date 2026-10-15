// @vitest-environment jsdom
//
// #2048: runsCompleted went up on every room exit, so a seven-room run
// counted seven times. It counts once per run: when the last room is cleared,
// or when the run is first lost.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import type { DungeonRoom, Enemy } from "@/lib/dungeon";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

vi.mock("@/components/providers/AudioProvider", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/providers/AudioProvider")
    >();
  return {
    ...actual,
    useAudio: () => ({
      playSuccess: vi.fn(),
      playNote: vi.fn(),
      playHover: vi.fn(),
    }),
    AudioProvider: ({ children }: { children: React.ReactNode }) => children,
  };
});

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

// A two-room run of open rooms. Each exit is one step right of the start, and
// room 1 has a stationary drone one step left of it, so Left bumps the drone
// for HP until the trace lands.
vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    generateRoguelikeCampaign: (): DungeonRoom[] => {
      const base = actual.generateRoguelikeCampaign()[0];
      const grid = base.grid.map((row, y) =>
        row.map((_, x) =>
          y === 0 || x === 0 || y === base.grid.length - 1 || x === 14
            ? "#"
            : " "
        )
      );
      const drone: Enemy = {
        id: "test-drone",
        type: "drone",
        name: "Test Drone",
        x: 11,
        y: 7,
        hp: 40,
        maxHp: 40,
        state: "patrol",
        patrolDir: "right",
        minX: 11,
        maxX: 11,
        symbol: "D",
        color: "#38bdf8",
      };
      const room = (index: number, enemies: Enemy[]): DungeonRoom => ({
        ...base,
        index,
        grid: grid.map((row) => [...row]),
        startX: 12,
        startY: 7,
        exitX: 13,
        exitY: 7,
        enemies,
        items: [],
        boss: undefined,
        tspNodes: [],
        tspMovingWalls: [],
      });
      return [room(1, [drone]), room(2, [])];
    },
  };
});

let contactSkew = 0;

import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { STORAGE_KEY_PROFILE } from "@/lib/dungeon";
import { safeRemoveItem } from "@/lib/safe-storage";

describe("Retro Labyrinth counts each run once (#2048)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  beforeEach(() => {
    // Freeze the animation loop so the drone only matters when walked into.
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
    // A contact hit protects the player for a moment (#2176). Each key
    // press here moves the contact clock past it, without running frames,
    // so repeated bumps each land.
    contactSkew = 0;
    const fakeNow = performance.now.bind(performance);
    vi.spyOn(performance, "now").mockImplementation(
      () => fakeNow() + contactSkew
    );
    store = {};
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
      },
    });
    safeRemoveItem(STORAGE_KEY_PROFILE);
    const ctx = new Proxy(
      {},
      {
        get: (_target, prop) =>
          prop === "measureText"
            ? () => ({ width: 8 })
            : prop === "createRadialGradient" || prop === "createLinearGradient"
              ? () => ({ addColorStop: () => {} })
              : () => {},
        set: () => true,
      }
    );
    HTMLCanvasElement.prototype.getContext = fromAny(
      vi.fn(() => fromAny<CanvasRenderingContext2D, unknown>(ctx))
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    safeRemoveItem(STORAGE_KEY_PROFILE);
    vi.useRealTimers();
  });

  function runsCompleted(): number {
    const raw = store[STORAGE_KEY_PROFILE];
    return raw
      ? (JSON.parse(raw) as { runsCompleted: number }).runsCompleted
      : 0;
  }

  function isCaught(): boolean {
    return container.textContent?.includes("IP TRACE INTERCEPTED") ?? false;
  }

  async function step(key: "ArrowRight" | "ArrowLeft") {
    contactSkew += 1000;
    const boundary = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
    });
  }

  async function clickButton(label: RegExp) {
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      label.test(b.textContent ?? "")
    );
    expect(button, String(label)).toBeDefined();
    await act(async () => {
      button!.click();
    });
  }

  async function dieOnTheDrone() {
    for (let i = 0; i < 20 && !isCaught(); i++) await step("ArrowLeft");
    expect(isCaught()).toBe(true);
  }

  it("counts a cleared run once, on its last room", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    expect(container.textContent).toContain("Room 1 of 2");

    await step("ArrowRight");
    expect(container.textContent).toContain("MAINFRAME TIER BREACHED");
    expect(runsCompleted()).toBe(0);

    await clickButton(/^Next Room$/);
    expect(container.textContent).toContain("Room 2 of 2");
    await step("ArrowRight");
    expect(container.textContent).toContain("RUN COMPLETE");
    expect(runsCompleted()).toBe(1);
  });

  it("counts a lost run once, however often its room is retried", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    await dieOnTheDrone();
    expect(runsCompleted()).toBe(1);

    await clickButton(/RETRY BREACH/);
    await dieOnTheDrone();
    expect(runsCompleted()).toBe(1);

    // Retrying and then clearing the run doesn't count it a second time.
    await clickButton(/RETRY BREACH/);
    await step("ArrowRight");
    await clickButton(/^Next Room$/);
    await step("ArrowRight");
    expect(container.textContent).toContain("RUN COMPLETE");
    expect(runsCompleted()).toBe(1);
  });
});
