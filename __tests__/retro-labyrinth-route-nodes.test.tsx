// @vitest-environment jsdom
import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
} from "@testing-library/react";
import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { CabinetTouchContext } from "@/components/arcade/mobile";

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
  };
});

// Route nodes live in the TSP room, the fourth room since #2048. Start the
// run there so the walker meets node 1 two steps from the spawn.
vi.mock("@/lib/dungeon", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dungeon")>();
  return {
    ...actual,
    generateRoguelikeCampaign: () => {
      const rooms = actual.generateRoguelikeCampaign();
      const tsp = rooms.findIndex((room) => room.id === "tsp");
      return [rooms[tsp], ...rooms.filter((_, i) => i !== tsp)];
    },
  };
});

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

/** A 2D context stub so the maze loop can run in jsdom. */
function stubCanvas() {
  const ctx = fromAny<CanvasRenderingContext2D, unknown>(
    new Proxy({} as Record<PropertyKey, unknown>, {
      get(target, key) {
        if (key in target) return target[key];
        if (key === "measureText")
          return (text: string) => ({ width: (text || "").length * 4 });
        if (key === "createImageData")
          return (w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4),
          });
        if (key === "createRadialGradient" || key === "createLinearGradient")
          return () => ({ addColorStop: vi.fn() });
        return vi.fn();
      },
    })
  );
  HTMLCanvasElement.prototype.getContext = fromAny<
    HTMLCanvasElement["getContext"],
    unknown
  >(vi.fn(() => ctx));
}

function renderPhoneRoom() {
  const view = render(
    <CabinetTouchContext.Provider value={true}>
      <RetroLabyrinth isMounted />
    </CabinetTouchContext.Provider>
  );
  const canvas = view.container.querySelector("canvas") as HTMLCanvasElement;
  const read = () =>
    view.container.querySelector("[data-nodes]")?.getAttribute("data-nodes") ??
    "";
  return { ...view, canvas, read };
}

/** Presses and releases a touch control the way a finger does. */
function tap(button: HTMLElement) {
  act(() => {
    const touch = {
      pointerId: 1,
      pointerType: "touch",
      isPrimary: true,
      button: 0,
    };
    fireEvent.pointerDown(button, touch);
    fireEvent.pointerUp(button, touch);
  });
}

describe("Route nodes are collected the same way by touch and keyboard (#2003)", () => {
  beforeEach(() => {
    stubCanvas();
    window.localStorage.clear();
    window.matchMedia = vi.fn((query: string): MediaQueryList => ({
      matches: query.includes("pointer: coarse"),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    cleanup();
  });

  it("a d-pad tap onto the first node marks it visited", () => {
    const { read } = renderPhoneRoom();
    expect(read().startsWith("3,1:0")).toBe(true);

    // The player starts at (1,1); node 1 is at (3,1), two steps right.
    tap(screen.getByRole("button", { name: "Move Right" }));
    tap(screen.getByRole("button", { name: "Move Right" }));

    expect(read().startsWith("3,1:1")).toBe(true);
  });

  it("a keyboard move onto the first node marks it visited", () => {
    const { canvas, read } = renderPhoneRoom();
    expect(read().startsWith("3,1:0")).toBe(true);

    act(() => {
      fireEvent.keyDown(canvas, { key: "ArrowRight" });
    });
    act(() => {
      fireEvent.keyDown(canvas, { key: "ArrowRight" });
    });

    expect(read().startsWith("3,1:1")).toBe(true);
  });
});
