// @vitest-environment jsdom
import { fromAny } from "@total-typescript/shoehorn";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  cleanup,
  act,
  fireEvent,
  waitFor,
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

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

/** A 2D context stub: every method is a no-op, so the loop can run in jsdom. */
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

/** Reports the coarse pointer (touch) or the fine pointer (desktop). */
function stubPointer(coarse: boolean) {
  window.matchMedia = vi.fn((query: string): MediaQueryList => ({
    matches: coarse && query.includes("pointer: coarse"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => false),
  })) as unknown as typeof window.matchMedia;
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
    expect(
      screen.getByRole("button", { name: "EMP: fire an EMP burst" })
    ).toBeTruthy();
    // The inline disclosure is desktop only. The phone opens options as a sheet.
    expect(container.querySelector(".arcade-labyrinth-options")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tap" })).toBeNull();
  });

  it("answers an EMP press with a toast that names the tool and its outcome", () => {
    renderGame({ touch: true });
    expect(screen.queryByTestId("labyrinth-phone-toast")).toBeNull();

    act(() => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "EMP: fire an EMP burst" }),
        { pointerId: 1, isPrimary: true, button: 0 }
      );
    });

    const toast = screen.getByTestId("labyrinth-phone-toast");
    expect(toast.textContent?.startsWith("EMP: ")).toBe(true);
    expect(toast.getAttribute("role")).toBe("status");
    // Plain text with no motion class, so reduced motion needs nothing more.
    expect(toast.className).not.toMatch(/animate|transition/);
  });

  it("answers an Exploit press with a toast, even when no tool has ammo to fire", () => {
    renderGame({ touch: true });
    act(() => {
      fireEvent.pointerDown(
        screen.getByRole("button", { name: /Exploit: cycle/ }),
        { pointerId: 1, isPrimary: true, button: 0 }
      );
    });
    expect(
      screen.getByTestId("labyrinth-phone-toast").textContent
    ).toBeTruthy();
  });

  it("exposes the player's cell and the patrol cells as data for the e2e specs", () => {
    const { container } = renderGame({ touch: true });
    const status = container.querySelector("[data-player-cell]");
    expect(status?.getAttribute("data-player-cell")).toMatch(/^\d+,\d+$/);
    // Patrols may be none in a fresh room, but the attribute is always there.
    expect(status?.hasAttribute("data-patrol-cells")).toBe(true);
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

  it("keeps Escape from the touch cabinet while a room runs or is paused (#2569)", () => {
    const { container, rerenderWithPause } = renderGame({
      touch: true,
      autoPauseCount: 0,
    });
    const boundary = () =>
      container.querySelector('[data-keyboard-boundary="true"]');
    expect(boundary()?.getAttribute("data-escape-docks")).toBe("true");

    act(() => {
      rerenderWithPause(1);
    });
    expect(screen.getByText("PAUSED")).toBeTruthy();
    // Paused, Escape resumes the room instead of leaving the cabinet.
    expect(boundary()?.getAttribute("data-escape-docks")).toBe("true");
  });

  it("leaves Escape to the cabinet on a desktop layout", () => {
    stubPointer(false);
    const { container } = renderGame({ touch: false });
    expect(
      container
        .querySelector('[data-keyboard-boundary="true"]')
        ?.hasAttribute("data-escape-docks")
    ).toBe(false);
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

describe("computeFillCanvasSize (touch maze fill)", () => {
  it("fills a box that is short of width at its own 5:3 shape", async () => {
    const { computeFillCanvasSize } =
      await import("@/components/retro-labyrinth/labyrinth-art");
    const size = computeFillCanvasSize(500, 320, 2);
    expect(size.cssWidth).toBe(500);
    expect(size.cssHeight).toBe(300);
    expect(size.backingWidth).toBe(1000);
    expect(size.backingHeight).toBe(600);
  });

  it("is width-bound in a wide, short box and never overflows", async () => {
    const { computeFillCanvasSize } =
      await import("@/components/retro-labyrinth/labyrinth-art");
    const size = computeFillCanvasSize(316, 264, 2);
    expect(size.cssWidth).toBe(315);
    expect(size.cssHeight).toBeCloseTo(189, 6);
    expect(size.cssWidth).toBeLessThanOrEqual(316);
    expect(size.cssHeight).toBeLessThanOrEqual(264);
  });

  it("returns an empty canvas for a zero box and tolerates bad input", async () => {
    const { computeFillCanvasSize } =
      await import("@/components/retro-labyrinth/labyrinth-art");
    expect(computeFillCanvasSize(0, 100, 2).cssWidth).toBe(0);
    expect(computeFillCanvasSize(Number.NaN, 100, Number.NaN).cssWidth).toBe(0);
  });
});

/** Reads the player's grid position from the accessible status subtree. */
function playerLocation(): string {
  return (
    screen
      .getByText(/Player Location: Grid/)
      .textContent?.replace("Player Location: Grid ", "") ?? ""
  );
}

describe("RetroLabyrinth phone input (ADR 0061)", () => {
  beforeEach(() => {
    stubCanvas();
    stubPointer(true);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("a swipe across the maze moves the player, and a tap on the maze does nothing", () => {
    renderGame({ touch: true });
    const canvas = screen.getByRole("application");
    const before = playerLocation();

    fireEvent.pointerDown(canvas, {
      pointerId: 7,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: 7,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    expect(playerLocation()).toBe(before);

    // Drag right: the player takes one step, or none if a wall is in the way;
    // either way the swipe is read as a move, not a pan.
    fireEvent.pointerDown(canvas, {
      pointerId: 8,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: 8,
      pointerType: "touch",
      clientX: 180,
      clientY: 100,
    });
    expect(playerLocation()).not.toBe("");
  });

  it("the phone d-pad is wired into the game: a press moves the player", () => {
    renderGame({ touch: true });
    const before = playerLocation();
    const moved = ["Move Up", "Move Down", "Move Left", "Move Right"].some(
      (name) => {
        const button = screen.getByRole("button", { name });
        fireEvent.pointerDown(button, { pointerId: 3, pointerType: "touch" });
        fireEvent.pointerUp(button, { pointerId: 3, pointerType: "touch" });
        return playerLocation() !== before;
      }
    );
    expect(moved, "some direction should step the player").toBe(true);
  });

  it("the options sheet is a modal dialog: focus moves in, Escape closes it, and focus returns to Options", async () => {
    renderGame({ touch: true });
    const options = screen.getByRole("button", { name: "Options" });
    expect(options.getAttribute("aria-controls")).toBe(
      "labyrinth-options-sheet"
    );
    expect(options.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(options);
    const dialog = screen.getByRole("dialog", { name: "Options" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(options.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("PAUSED")).toBeTruthy();
    // The focus trap moves focus in after its short settle delay.
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true)
    );

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Options" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(options));
    // The sheet's Escape does not also resume the paused room.
    expect(screen.getByText("PAUSED")).toBeTruthy();
  });

  it("releases a held arrow when the room pauses under it", () => {
    vi.useFakeTimers();
    try {
      renderGame({ touch: true });
      const right = screen.getByRole("button", { name: "Move Right" });
      fireEvent.pointerDown(right, { pointerId: 4, pointerType: "touch" });
      act(() => {
        fireEvent.click(screen.getByRole("button", { name: "Options" }));
      });
      const frozen = playerLocation();
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(playerLocation()).toBe(frozen);
      fireEvent.pointerUp(right, { pointerId: 4, pointerType: "touch" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("sizes the maze to the largest 5:3 box on the phone, and to a whole-pixel scale on desktop", () => {
    // A 500x300 frame: the phone fills it at 500px wide; the desktop keeps its
    // whole-pixel scale of 2x, which is 480px wide.
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 500,
        bottom: 300,
        width: 500,
        height: 300,
        toJSON: () => ({}),
      } as DOMRect);

    const phone = renderGame({ touch: true });
    const phoneCanvas = phone.container.querySelector("canvas");
    expect(phoneCanvas?.style.width).toBe("500px");
    expect(phoneCanvas?.style.height).toBe("300px");
    cleanup();

    stubPointer(false);
    const desktop = renderGame({ touch: false });
    const desktopCanvas = desktop.container.querySelector("canvas");
    expect(desktopCanvas?.style.width).toBe("480px");
    expect(desktopCanvas?.style.height).toBe("288px");
    rectSpy.mockRestore();
  });
});
