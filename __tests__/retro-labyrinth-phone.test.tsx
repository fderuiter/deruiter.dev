/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup, act } from "@testing-library/react";
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

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

/** A 2D context stub: every method is a no-op, so the loop can run in jsdom. */
function stubCanvas() {
  const ctx: Record<string, unknown> = new Proxy(
    {} as Record<PropertyKey, unknown>,
    {
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
    }
  );
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx as any);
}

/** Reports the coarse pointer (touch) or the fine pointer (desktop). */
function stubPointer(coarse: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: coarse && query.includes("pointer: coarse"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as any;
}

function renderGame(options: { touch: boolean; autoPauseCount?: number }) {
  const element = (count: number) => (
    <CabinetTouchContext.Provider value={options.touch}>
      <RetroLabyrinth isMounted autoPauseCount={count} />
    </CabinetTouchContext.Provider>
  );
  const view = render(element(options.autoPauseCount ?? 0));
  return {
    ...view,
    rerenderWithPause: (count: number) => view.rerender(element(count)),
  };
}

describe("RetroLabyrinth on a phone cabinet (ADR 0061)", () => {
  beforeEach(() => {
    stubCanvas();
    stubPointer(true);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("lays out the phone HUD, the d-pad and the actions, and moves options to a sheet", () => {
    const { container } = renderGame({ touch: true });

    expect(screen.getByTestId("labyrinth-phone-floor").textContent).toBe(
      "ROOM 01"
    );
    expect(screen.getByTestId("labyrinth-phone-score")).toBeTruthy();
    expect(container.querySelector("[data-hold-dpad]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Move Up" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fire EMP burst" })).toBeTruthy();
    // The inline disclosure is desktop only. The phone opens options as a sheet.
    expect(container.querySelector(".arcade-labyrinth-options")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tap" })).toBeNull();
  });

  it("keeps the desktop disclosure and HUD on a fine pointer", () => {
    stubPointer(false);
    const { container } = renderGame({ touch: false });

    expect(container.querySelector(".arcade-labyrinth-options")).not.toBeNull();
    expect(screen.queryByTestId("labyrinth-phone-floor")).toBeNull();
    expect(container.querySelector("[data-hold-dpad]")).toBeNull();
  });

  it("the closed desktop disclosure is inert, so its controls cannot take focus", () => {
    stubPointer(false);
    const { container } = renderGame({ touch: false });
    const inertWrapper = container.querySelector(
      ".arcade-labyrinth-options > div"
    );
    expect(inertWrapper?.hasAttribute("inert")).toBe(true);
  });

  it("pauses a running room when the cabinet reports an auto-pause, and says to tap to resume", () => {
    const { rerenderWithPause } = renderGame({
      touch: true,
      autoPauseCount: 0,
    });
    expect(screen.queryByText("PAUSED")).toBeNull();

    act(() => {
      rerenderWithPause(1);
    });

    expect(screen.getByText("PAUSED")).toBeTruthy();
    expect(screen.getByText("Tap Resume")).toBeTruthy();
    const resume = screen.getByRole("button", { name: "Resume" });
    expect(resume.className).toContain("min-h-11");
  });

  it("the same pause count does not pause again after the player resumes", () => {
    const { rerenderWithPause } = renderGame({
      touch: true,
      autoPauseCount: 0,
    });
    act(() => {
      rerenderWithPause(1);
    });
    act(() => {
      screen.getByRole("button", { name: "Resume" }).click();
    });
    expect(screen.queryByText("PAUSED")).toBeNull();

    act(() => {
      rerenderWithPause(1);
    });
    expect(screen.queryByText("PAUSED")).toBeNull();
  });
});
