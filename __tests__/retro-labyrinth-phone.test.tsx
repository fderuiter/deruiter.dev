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
import { setDeviceSettings } from "@/lib/arcade";
import { RetroLabyrinth } from "@/components/RetroLabyrinth";
import { CabinetTouchContext } from "@/components/arcade/mobile";
import {
  CabinetPauseProvider,
  createPauseController,
} from "@/components/arcade/pause";

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

function renderGame(options: { touch: boolean }) {
  // The cabinet's pause service (#2357): an auto-pause is a pause with an
  // automatic reason, such as a hidden tab.
  const controller = createPauseController();
  const view = render(
    <CabinetTouchContext.Provider value={options.touch}>
      <CabinetPauseProvider controller={controller}>
        <RetroLabyrinth isMounted />
      </CabinetPauseProvider>
    </CabinetTouchContext.Provider>
  );
  return {
    ...view,
    autoPause: () => controller.pause("hidden"),
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
      "01Room"
    );
    // The score is in the status subtree; the phone HUD leaves it out (#2918).
    expect(container.querySelector('output[for="retro-score"]')).not.toBeNull();
    expect(container.querySelector('[data-dock-preset="dpad"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Move up" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "EMP" })).toBeTruthy();
    // The inline disclosure is desktop only. The phone opens options as a sheet.
    expect(container.querySelector(".arcade-labyrinth-options")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tap" })).toBeNull();
  });

  it("plays a phone on the phone stage with a one-row HUD and 12px keys (#2918)", () => {
    window.history.replaceState(null, "", "/?view=phone");
    try {
      const { container } = renderGame({ touch: true });
      const stage = container.querySelector(".arcade-stage");
      expect(stage?.getAttribute("data-stage")).toBe("phone");
      expect(stage?.getAttribute("data-stage-orientation")).toBe("landscape");

      const hud = screen.getByTestId("phone-hud");
      expect(hud.getAttribute("aria-label")).toBe("Room status");
      expect(screen.getByTestId("labyrinth-phone-floor").textContent).toBe(
        "01Room"
      );
      expect(screen.getByTestId("labyrinth-phone-hp")).toBeTruthy();
      expect(screen.getByTestId("labyrinth-phone-crypto")).toBeTruthy();
      expect(screen.getByTestId("labyrinth-phone-ram")).toBeTruthy();
      expect(
        hud.querySelector("button[aria-controls='labyrinth-options-sheet']")
          ?.textContent
      ).toBe("Options");
      // The tablet's route and objective cards stay off the phone.
      expect(screen.queryByTestId("labyrinth-tablet-route")).toBeNull();
      expect(screen.queryByTestId("labyrinth-room-panel")).toBeNull();

      // No key label is set below 12px.
      const keys = container.querySelectorAll("[data-touch-button]");
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(key.outerHTML).not.toMatch(/text-\[(9|10|11)px\]/);
      }
    } finally {
      window.history.replaceState(null, "", "/");
    }
  });

  it("answers an EMP press with a toast that names the tool and its outcome", () => {
    renderGame({ touch: true });
    expect(screen.queryByTestId("labyrinth-phone-toast")).toBeNull();

    act(() => {
      fireEvent.pointerDown(screen.getByRole("button", { name: "EMP" }), {
        pointerId: 1,
        isPrimary: true,
        button: 0,
      });
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
      fireEvent.pointerDown(screen.getByRole("button", { name: "Exploit" }), {
        pointerId: 1,
        isPrimary: true,
        button: 0,
      });
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
    expect(container.querySelector("[data-dock-preset]")).toBeNull();
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
    const { autoPause } = renderGame({ touch: true });
    expect(screen.queryByText("PAUSED")).toBeNull();

    act(() => {
      autoPause();
    });

    expect(screen.getByText("PAUSED")).toBeTruthy();
    expect(screen.getByText("Tap Resume")).toBeTruthy();
    const resume = screen.getByRole("button", { name: "Resume" });
    expect(resume.className).toContain("min-h-11");
  });

  it("keeps Escape from the touch cabinet while a room runs or is paused (#2569)", () => {
    const { container, autoPause } = renderGame({ touch: true });
    const boundary = () =>
      container.querySelector('[data-keyboard-boundary="true"]');
    expect(boundary()?.getAttribute("data-escape-docks")).toBe("true");

    act(() => {
      autoPause();
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

  it("an auto-pause after the player resumes pauses the room again", () => {
    const { autoPause } = renderGame({ touch: true });
    act(() => {
      autoPause();
    });
    act(() => {
      screen.getByRole("button", { name: "Resume" }).click();
    });
    expect(screen.queryByText("PAUSED")).toBeNull();

    act(() => {
      autoPause();
    });
    expect(screen.getByText("PAUSED")).toBeTruthy();
  });
});

/** The touch maze fit (#2358): the largest 5:3 box, following the device. */
async function computeFillCanvasSize(
  width: number,
  height: number,
  dpr: number
) {
  const { computeStageFit } = await import("@/lib/arcade");
  return computeStageFit({ width, height }, dpr, {
    aspect: { width: 240, height: 144 },
    scale: "fractional",
    maxDpr: Number.POSITIVE_INFINITY,
  });
}

describe("computeFillCanvasSize (touch maze fill)", () => {
  it("fills a box that is short of width at its own 5:3 shape", async () => {
    const size = await computeFillCanvasSize(500, 320, 2);
    expect(size.cssWidth).toBe(500);
    expect(size.cssHeight).toBe(300);
    expect(size.backingWidth).toBe(1000);
    expect(size.backingHeight).toBe(600);
  });

  it("is width-bound in a wide, short box and never overflows", async () => {
    const size = await computeFillCanvasSize(316, 264, 2);
    expect(size.cssWidth).toBe(315);
    expect(size.cssHeight).toBeCloseTo(189, 6);
    expect(size.cssWidth).toBeLessThanOrEqual(316);
    expect(size.cssHeight).toBeLessThanOrEqual(264);
  });

  it("returns an empty canvas for a zero box and tolerates bad input", async () => {
    expect((await computeFillCanvasSize(0, 100, 2)).cssWidth).toBe(0);
    expect(
      (await computeFillCanvasSize(Number.NaN, 100, Number.NaN)).cssWidth
    ).toBe(0);
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
    const moved = ["Move up", "Move down", "Move left", "Move right"].some(
      (name) => {
        const button = screen.getByRole("button", { name });
        fireEvent.pointerDown(button, { pointerId: 3, pointerType: "touch" });
        fireEvent.pointerUp(button, { pointerId: 3, pointerType: "touch" });
        return playerLocation() !== before;
      }
    );
    expect(moved, "some direction should step the player").toBe(true);
  });

  it("the action cluster holds the first tools and EMP, and More opens a sheet with tools 4 and 5 and the Market (#2919)", async () => {
    const { container } = renderGame({ touch: true });
    const cluster = container.querySelector('[data-dock-preset="cluster"]');
    expect(cluster).not.toBeNull();
    const clusterKeys = Array.from(cluster!.querySelectorAll("button")).map(
      (key) => key.getAttribute("aria-label") ?? key.textContent
    );
    expect(clusterKeys.length).toBeLessThanOrEqual(4);
    expect(clusterKeys.at(-1)).toBe("EMP");
    expect(screen.getByRole("button", { name: "Exploit" })).toBeTruthy();
    // The d-pad names its arrows from the action map.
    expect(
      container
        .querySelector('[data-dock-preset="dpad"]')
        ?.getAttribute("aria-label")
    ).toBe("Directional pad");

    const more = screen.getByRole("button", { name: "More" });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    more.focus();
    fireEvent.click(more);
    const sheet = screen.getByRole("dialog", { name: "More" });
    expect(more.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", { name: /tool 4/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /tool 5/ })).toBeTruthy();
    // Room 01 of a run is not the rest stop, so the Market is shut.
    const market = screen.getByRole("button", { name: /^Market: / });
    expect((market as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() =>
      expect(sheet.contains(document.activeElement)).toBe(true)
    );

    fireEvent.keyDown(sheet, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "More" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(more));
  });

  it("takes the dominant hand from the device settings, live, and leaves the choice to the cabinet's Setup sheet (#2862)", () => {
    window.history.replaceState(null, "", "/?view=phone");
    try {
      const { container } = renderGame({ touch: true });
      const hands = () =>
        [".arcade-stage", '[data-dock-preset="cluster"]'].map((selector) =>
          container.querySelector(selector)?.getAttribute("data-handedness")
        );
      expect(hands()).toEqual(["right", "right"]);

      // A change made in the cabinet's Setup sheet applies live.
      act(() => {
        setDeviceSettings({ handedness: "left" });
      });
      expect(hands()).toEqual(["left", "left"]);

      // The game's own Options sheet no longer offers the hand.
      fireEvent.click(screen.getByRole("button", { name: "Options" }));
      expect(screen.getByTestId("labyrinth-options-sheet")).toBeTruthy();
      expect(screen.queryByRole("group", { name: "Dominant hand" })).toBeNull();
    } finally {
      window.history.replaceState(null, "", "/");
    }
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
      const right = screen.getByRole("button", { name: "Move right" });
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
