// @vitest-environment jsdom
//
// #2841 (playtest N1): when the run ended, the room's objective line and the
// last tool's side-effect strip still showed behind the run-complete card.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fromAny } from "@total-typescript/shoehorn";
import type { DungeonRoom } from "@/lib/dungeon";

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

// A two-room run of open rooms, each exit one step right of the start.
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
      const room = (index: number): DungeonRoom => ({
        ...base,
        index,
        grid: grid.map((row) => [...row]),
        startX: 12,
        startY: 7,
        exitX: 13,
        exitY: 7,
        enemies: [],
        items: [],
        boss: undefined,
        tspNodes: [],
        tspMovingWalls: [],
      });
      return [room(1), room(2)];
    },
  };
});

import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { STORAGE_KEY_PROFILE } from "@/lib/dungeon";
import { safeRemoveItem } from "@/lib/safe-storage";

describe("Retro Labyrinth's run-complete screen (#2841)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  beforeEach(() => {
    // Freeze the animation loop, so the side effect stays until the run ends.
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame"],
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

  async function press(key: string) {
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

  const objective = () =>
    container.querySelector('[data-testid="labyrinth-objective"]');
  const sideEffect = () =>
    container.querySelector('[data-testid="labyrinth-side-effect"]');

  it("clears the objective and the side-effect strip behind the card", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    await press("ArrowRight");
    await clickButton(/^Next Room$/);
    expect(container.textContent).toContain("Room 2 of 2");

    // npm install leaves a side effect on the board.
    await press("1");
    expect(objective()).not.toBeNull();
    expect(sideEffect()).not.toBeNull();

    await press("ArrowRight");
    expect(container.textContent).toContain("RUN COMPLETE");
    expect(objective()).toBeNull();
    expect(container.textContent).not.toContain("OBJECTIVE");
    expect(sideEffect()).toBeNull();
  });

  it("keeps both while a room short of the last is cleared", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    await press("1");
    expect(sideEffect()).not.toBeNull();
    await press("ArrowRight");
    expect(container.textContent).toContain("MAINFRAME TIER BREACHED");
    expect(container.textContent).not.toContain("RUN COMPLETE");
    expect(objective()).not.toBeNull();
    expect(sideEffect()).not.toBeNull();
  });
});
