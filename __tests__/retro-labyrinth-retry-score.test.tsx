// @vitest-environment jsdom
//
// #1552: RETRY BREACH kept the score, so dying and retrying farmed route-node
// points, and a run that ended in a trace never recorded a high score.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import type { Enemy } from "@/lib/dungeon";

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

// Room 1 gets a route node one step right of the start and a stationary drone
// one step further, with no moving walls. Right collects the node; each
// further step right bumps the drone for HP and leaves the player in place.
vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    generateRoguelikeCampaign: () => {
      const rooms = actual.generateRoguelikeCampaign();
      const first = rooms[0];
      const nodeX = first.startX + 1;
      const droneX = first.startX + 2;
      const grid = first.grid.map((row) => [...row]);
      grid[first.startY][nodeX] = " ";
      grid[first.startY][droneX] = " ";
      const drone: Enemy = {
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
      };
      rooms[0] = {
        ...first,
        grid,
        enemies: [drone],
        items: [],
        tspMovingWalls: [],
        tspNodes: [
          { id: 1, x: nodeX, y: first.startY, visited: false },
          ...(first.tspNodes ?? []).slice(1),
        ],
      };
      return rooms;
    },
  };
});

import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { RETRO_LABYRINTH_HIGH_SCORE_KEY } from "@/lib/dungeon";
import { safeRemoveItem, safeSetRawItem } from "@/lib/safe-storage";

describe("RetroLabyrinth retry score and high score on death (#1552)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  beforeEach(() => {
    // Freeze the animation loop. The drone patrol runs on it and, under a
    // loaded CI runner, would step onto the player between the test's own
    // moves and after RETRY BREACH (#1420). Contact then only happens when
    // the player walks into the drone, which is what these tests check.
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
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
    // safe-storage keeps a module-level memory cache; drop the key so one
    // test's high score doesn't leak into the next.
    safeRemoveItem(RETRO_LABYRINTH_HIGH_SCORE_KEY);
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
    vi.useRealTimers();
  });

  function score(): number {
    const match = container.textContent?.match(/SCORE: (\d+)/);
    return Number(match?.[1]);
  }

  function isCaught(): boolean {
    return container.textContent?.includes("IP TRACE INTERCEPTED") ?? false;
  }

  async function step(key: "ArrowRight") {
    const boundary = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
      );
    });
  }

  // Collect the node, then bounce off the drone until the trace lands.
  async function scoreThenDie() {
    await step("ArrowRight");
    const earned = score();
    for (let i = 0; i < 20 && !isCaught(); i++) {
      await step("ArrowRight");
    }
    return earned;
  }

  async function retry() {
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("RETRY BREACH")
    );
    await act(async () => {
      button?.click();
    });
  }

  it("resets the score to its room-entry value on retry", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    expect(score()).toBe(0);

    const earned = await scoreThenDie();
    expect(earned).toBeGreaterThan(0);
    expect(isCaught()).toBe(true);

    await retry();
    expect(isCaught()).toBe(false);
    expect(score()).toBe(0);

    // Revisiting the node earns its points once, not on top of the last run.
    await step("ArrowRight");
    expect(score()).toBe(earned);
  });

  it("records the high score when a run ends by death", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    const earned = await scoreThenDie();
    expect(isCaught()).toBe(true);
    expect(store[RETRO_LABYRINTH_HIGH_SCORE_KEY]).toBe(String(earned));
  });

  it("keeps a higher saved high score after a death", async () => {
    safeSetRawItem(RETRO_LABYRINTH_HIGH_SCORE_KEY, "99999");
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });

    await scoreThenDie();
    expect(isCaught()).toBe(true);
    expect(store[RETRO_LABYRINTH_HIGH_SCORE_KEY]).toBe("99999");
  });
});
