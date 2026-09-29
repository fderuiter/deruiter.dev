/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// #1310: walking into a drone ended the run at once, although the objective
// says drones cost HP, and RETRY BREACH kept the HP the player died with.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

// The first room gets a single stationary drone right next to the start, and
// no other enemies, so each step right is exactly one drone contact.
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
          {
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
          } as any,
        ],
      };
      return rooms;
    },
  };
});

import { RetroLabyrinth } from "@/components/RetroLabyrinth";

describe("RetroLabyrinth drone contact and retry HP (#1310)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    // Freeze the animation loop. The drone patrol runs on it and, under a
    // loaded CI runner, would step onto the player between the test's own
    // moves and after RETRY BREACH (#1420). Contact then only happens when
    // the player walks into the drone, which is what these tests check.
    vi.useFakeTimers({
      toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"],
    });
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
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx as any);
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

  function hp(): number {
    const label = Array.from(container.querySelectorAll("span")).find(
      (s) => s.textContent === "HP"
    );
    return Number(label?.parentElement?.lastElementChild?.textContent);
  }

  async function stepRight() {
    const boundary = container.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    await act(async () => {
      boundary.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        })
      );
    });
  }

  it("takes HP on drone contact instead of ending the run", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    const startHp = hp();
    expect(startHp).toBeGreaterThan(25);

    await stepRight();

    expect(hp()).toBe(startHp - 25);
    expect(container.textContent).not.toContain("IP TRACE INTERCEPTED");
  });

  it("retries the room with the HP the player entered it with", async () => {
    await act(async () => {
      root.render(<RetroLabyrinth isMounted={true} />);
    });
    const startHp = hp();

    for (let i = 0; i < 10 && hp() > 0; i++) {
      await stepRight();
    }
    expect(hp()).toBe(0);
    expect(container.textContent).toContain("IP TRACE INTERCEPTED");

    const retry = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("RETRY BREACH")
    );
    await act(async () => {
      retry?.click();
    });

    expect(container.textContent).not.toContain("IP TRACE INTERCEPTED");
    expect(hp()).toBe(startHp);
  });
});
