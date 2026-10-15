// @vitest-environment jsdom
//
// #2181: Retro Labyrinth's trophies unlock from play, not from score:
// clearing FaceForge, clearing a boss room untouched, and finishing a run.
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

// A two-room run: the FaceForge room with its boss already broken, then a
// plain last room. Each exit is one step right of the start.
vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    generateRoguelikeCampaign: (): DungeonRoom[] => {
      const library = actual.generateRoguelikeCampaign();
      const faceforge = library.find((r) => r.id === "faceforge")!;
      const open = (room: DungeonRoom): DungeonRoom => ({
        ...room,
        grid: room.grid.map((row, y) =>
          row.map((_, x) =>
            y === 0 || x === 0 || y === room.grid.length - 1 || x === 14
              ? "#"
              : " "
          )
        ),
        startX: 12,
        startY: 7,
        exitX: 13,
        exitY: 7,
        enemies: [],
        items: [],
        tspNodes: [],
        tspMovingWalls: [],
      });
      return [
        {
          ...open(faceforge),
          index: 1,
          boss: { ...faceforge.boss!, hp: 0, defeated: true },
        },
        { ...open(library[1]), index: 2, boss: undefined },
      ];
    },
  };
});

import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import {
  ARCADE_TROPHIES,
  getArcadeProgress,
  recordArcadeScore,
} from "@/lib/arcade-achievements";
import { STORAGE_KEY_PROFILE } from "@/lib/dungeon";
import { safeRemoveItem } from "@/lib/safe-storage";

describe("Retro Labyrinth trophies (#2181)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: Record<string, string>;

  beforeEach(() => {
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
    vi.useRealTimers();
  });

  function unlocked(): string[] {
    return Object.keys(getArcadeProgress().unlockedTrophies);
  }

  async function step(key: string) {
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

  it("ties every new trophy to a moment in play, not a score", () => {
    for (const id of [
      "retro_labyrinth_boss",
      "retro_labyrinth_untouched",
      "retro_labyrinth_root",
    ]) {
      const trophy = ARCADE_TROPHIES.find((t) => t.id === id);
      expect(trophy?.gameId).toBe("retro-labyrinth");
      expect(trophy?.milestone).toBeDefined();
      expect(trophy?.targetScore).toBeUndefined();
    }
  });

  it("no longer hands out FaceForge Slayer for a high score", () => {
    const { newlyUnlocked } = recordArcadeScore("retro-labyrinth", 50_000);
    const ids = newlyUnlocked.map((t) => t.id);
    expect(ids).toContain("retro_labyrinth_crawler");
    expect(ids).not.toContain("retro_labyrinth_boss");
  });

  it("unlocks FaceForge Slayer, Zero Packets Lost and Root Access in play", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    expect(container.textContent).toContain("Room 1 of 2");

    await step("ArrowRight");
    expect(container.textContent).toContain("MAINFRAME TIER BREACHED");
    expect(unlocked()).toContain("retro_labyrinth_boss");
    expect(unlocked()).toContain("retro_labyrinth_untouched");
    expect(unlocked()).not.toContain("retro_labyrinth_root");

    await clickButton(/^Next Room$/);
    await step("ArrowRight");
    expect(container.textContent).toContain("RUN COMPLETE");
    expect(unlocked()).toContain("retro_labyrinth_root");
  });
});
