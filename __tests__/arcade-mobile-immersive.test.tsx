// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { PlayCabinet } from "../components/arcade/PlayCabinet";
import { TOUCH_NARROW_QUERY } from "../components/arcade/mobile";

const lockMock = vi.hoisted(() => vi.fn(() => () => {}));

vi.mock("@/components/arcade/mobile/orientation", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/components/arcade/mobile/orientation")
    >();
  return { ...actual, lockScreenOrientation: lockMock };
});

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

const ORIENTATION_PORTRAIT = "(orientation: portrait)";

type Listener = () => void;

/**
 * Installs a live matchMedia. The returned `set` changes which queries match
 * and fires their change listeners, as a rotation or a window resize does.
 */
function installMatchMedia(initial: string[]) {
  let matching = [...initial];
  const listeners = new Set<Listener>();
  window.matchMedia = vi.fn((query: string) => ({
    get matches() {
      return matching.includes(query);
    },
    media: query,
    onchange: null,
    addEventListener: (_type: string, fn: Listener) => {
      listeners.add(fn);
    },
    removeEventListener: (_type: string, fn: Listener) => {
      listeners.delete(fn);
    },
    addListener: (fn: Listener) => {
      listeners.add(fn);
    },
    removeListener: (fn: Listener) => {
      listeners.delete(fn);
    },
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
  return {
    set(next: string[]) {
      matching = [...next];
      act(() => {
        listeners.forEach((fn) => fn());
      });
    },
  };
}

/** Puts `element` into (or takes it out of) real Fullscreen API state. */
function setRealFullscreen(element: Element | null) {
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => element,
  });
  act(() => {
    fireEvent(document, new Event("fullscreenchange"));
  });
}

function renderCabinet(
  props: Partial<React.ComponentProps<typeof PlayCabinet>> = {}
) {
  return render(
    <PlayCabinet
      gameId="test-game"
      title="Test Arcade Game"
      icon={<span>🎮</span>}
      instructions="Test instructions"
      controls={[{ key: "Space", action: "Jump" }]}
      importComponent={() => Promise.resolve({})}
      controlDock={<div data-testid="test-control-dock">Dock</div>}
      {...props}
    >
      <div data-testid="game-content">Active Game Running</div>
    </PlayCabinet>
  );
}

/** Presses Launch and runs the warm-up timers until the game is mounted. */
async function launch() {
  const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });
  await act(async () => {
    fireEvent.mouseEnter(launchBtn);
    await Promise.resolve();
    fireEvent.click(launchBtn);
    await Promise.resolve();
  });
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

function cabinetEl(): HTMLElement {
  const el = document.querySelector<HTMLElement>("[data-arcade-cabinet]");
  if (!el) throw new Error("cabinet not rendered");
  return el;
}

function powerOff() {
  fireEvent.click(screen.getByTitle("Reset / Power Off Cabinet"));
}

describe("PlayCabinet immersive touch mode (ADR 0061)", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    lockMock.mockClear();
    document.body.style.overflow = "";
    document.documentElement.style.overscrollBehavior = "";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    document.body.style.overflow = "";
    document.documentElement.style.overscrollBehavior = "";
  });

  it("goes immersive on a coarse, narrow device and locks the page", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    renderCabinet();
    expect(document.querySelector("[data-immersive]")).toBeNull();

    await launch();

    const cabinet = cabinetEl();
    expect(cabinet.getAttribute("data-immersive")).toBe("true");
    expect(cabinet.getAttribute("data-fullscreen")).toBe("true");
    expect(cabinet.className).toContain("fixed inset-0");
    expect(cabinet.className).toContain("h-dvh");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.documentElement.style.overscrollBehavior).toBe("none");
    expect(screen.getByTestId("game-content")).toBeDefined();
  });

  it("gives the immersive stage overflow hidden instead of a scroll area", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    renderCabinet();
    await launch();

    const stage = document.querySelector<HTMLElement>(".arcade-cabinet-stage");
    expect(stage?.className).toContain("overflow-hidden");
    expect(stage?.className).not.toContain("overflow-y-auto");
  });

  it("restores page scroll and overscroll when the cabinet is powered off", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    document.body.style.overflow = "scroll";
    renderCabinet();
    await launch();
    expect(document.body.style.overflow).toBe("hidden");

    powerOff();

    expect(document.querySelector("[data-arcade-cabinet]")).toBeNull();
    expect(document.body.style.overflow).toBe("scroll");
    expect(document.documentElement.style.overscrollBehavior).toBe("");
  });

  it("restores page scroll and overscroll when unmounted while immersive", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    document.body.style.overflow = "auto";
    const { unmount } = renderCabinet();
    await launch();
    expect(document.body.style.overflow).toBe("hidden");

    unmount();

    expect(document.body.style.overflow).toBe("auto");
    expect(document.documentElement.style.overscrollBehavior).toBe("");
  });

  it("keeps the windowed desktop cabinet unchanged for a fine pointer", async () => {
    installMatchMedia([]);
    renderCabinet();
    await launch();

    const cabinet = cabinetEl();
    expect(cabinet.hasAttribute("data-immersive")).toBe(false);
    expect(cabinet.getAttribute("data-fullscreen")).toBe("false");
    expect(cabinet.className).toContain("relative scroll-mt-24");
    expect(cabinet.className).not.toContain("fixed inset-0");
    expect(document.body.style.overflow).toBe("");
    expect(screen.getByText("Cabinet Engaged")).toBeDefined();
    expect(screen.getByTestId("cabinet-header-controls")).toBeDefined();
  });

  it("renders the desktop markup as it was before the kit", async () => {
    installMatchMedia([]);
    const { container } = renderCabinet();

    // Pre-launch: the preview wrapper has no kit attributes.
    const preview = container.firstElementChild as HTMLElement;
    expect(preview.getAttributeNames().sort()).toEqual(["class", "data-game"]);
    expect(preview.className).toBe("w-full");

    await launch();

    const cabinet = cabinetEl();
    expect(cabinet.getAttributeNames().sort()).toEqual([
      "class",
      "data-arcade-cabinet",
      "data-fullscreen",
      "data-game",
      "style",
      "tabindex",
    ]);
    expect(cabinet.className).toBe(
      "arcade-cabinet w-full flex flex-col items-center max-w-full min-w-0 @container relative scroll-mt-24"
    );
    const stage = document.querySelector<HTMLElement>(".arcade-cabinet-stage");
    expect(stage?.hasAttribute("inert")).toBe(false);
    expect(stage?.className).toContain("overflow-y-auto overflow-x-hidden");
    expect(
      screen
        .getByTestId("test-control-dock")
        .parentElement?.hasAttribute("inert")
    ).toBe(false);
  });

  it("latches immersive at launch so a rotation across 1024px keeps it", async () => {
    const media = installMatchMedia([TOUCH_NARROW_QUERY]);
    renderCabinet();
    await launch();
    expect(cabinetEl().getAttribute("data-immersive")).toBe("true");

    // An iPad turns to a wide landscape mid-game.
    media.set([]);
    expect(cabinetEl().getAttribute("data-immersive")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("scrolls the preview back into view when leaving immersive", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderCabinet();
    await launch();
    expect(scrollIntoView).not.toHaveBeenCalled();

    powerOff();

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("does not scroll the preview on desktop", async () => {
    installMatchMedia([]);
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    renderCabinet();
    await launch();

    powerOff();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("shows the prompt for a landscape game held in portrait", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY, ORIENTATION_PORTRAIT]);
    renderCabinet({ mobileOrientation: "landscape" });
    await launch();

    const prompt = screen.getByTestId("rotate-device-prompt");
    expect(prompt.getAttribute("role")).toBe("alertdialog");
    expect(prompt.textContent).toContain("landscape");
  });

  it("shows the prompt for a portrait game held in landscape", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    renderCabinet({ mobileOrientation: "portrait" });
    await launch();

    expect(screen.getByTestId("rotate-device-prompt").textContent).toContain(
      "portrait"
    );
  });

  it("shows no prompt for a portrait game held in portrait", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY, "(orientation: portrait)"]);
    renderCabinet({ mobileOrientation: "portrait" });
    await launch();

    expect(screen.queryByTestId("rotate-device-prompt")).toBeNull();
    expect(cabinetEl().getAttribute("data-immersive")).toBe("true");
  });

  it("blocks the cabinet behind the prompt and frees it when the phone matches", async () => {
    const media = installMatchMedia([TOUCH_NARROW_QUERY, ORIENTATION_PORTRAIT]);
    renderCabinet({ mobileOrientation: "landscape" });
    await launch();

    const stage = document.querySelector<HTMLElement>(".arcade-cabinet-stage");
    const dock = screen.getByTestId("test-control-dock").parentElement;
    expect(stage?.hasAttribute("inert")).toBe(true);
    expect(dock?.hasAttribute("inert")).toBe(true);

    media.set([TOUCH_NARROW_QUERY, "(orientation: landscape)"]);
    // The landscape phone matches: no prompt and nothing inert.
    expect(screen.queryByTestId("rotate-device-prompt")).toBeNull();
    expect(stage?.hasAttribute("inert")).toBe(false);
    expect(dock?.hasAttribute("inert")).toBe(false);
  });

  it("moves focus into the prompt on show and clears it when the phone matches", async () => {
    const media = installMatchMedia([TOUCH_NARROW_QUERY, ORIENTATION_PORTRAIT]);
    renderCabinet({ mobileOrientation: "landscape" });
    await launch();

    const leave = screen.getByRole("button", { name: "Leave cabinet" });
    expect(document.activeElement).toBe(leave);

    media.set([TOUCH_NARROW_QUERY, "(orientation: landscape)"]);
    expect(screen.queryByTestId("rotate-device-prompt")).toBeNull();
  });

  it("never prompts a game that declares either orientation", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY, ORIENTATION_PORTRAIT]);
    renderCabinet({ mobileOrientation: "either" });
    await launch();

    expect(screen.queryByTestId("rotate-device-prompt")).toBeNull();
    expect(cabinetEl().getAttribute("data-immersive")).toBe("true");
  });

  it("never prompts on desktop, even for a landscape game", async () => {
    installMatchMedia([ORIENTATION_PORTRAIT]);
    renderCabinet({ mobileOrientation: "landscape" });
    await launch();

    expect(screen.queryByTestId("rotate-device-prompt")).toBeNull();
  });

  it("lets the player leave from the prompt", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY, ORIENTATION_PORTRAIT]);
    const onExit = vi.fn();
    renderCabinet({ mobileOrientation: "landscape", onExit });
    await launch();

    fireEvent.click(screen.getByRole("button", { name: "Leave cabinet" }));

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-arcade-cabinet]")).toBeNull();
  });

  it("auto-pauses the game on blur and page hide while immersive", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    const onAutoPause = vi.fn();
    renderCabinet({ onAutoPause });
    await launch();

    fireEvent(window, new Event("blur"));
    fireEvent(window, new Event("pagehide"));

    expect(onAutoPause).toHaveBeenCalledTimes(2);
  });

  it("auto-pauses once on a rotation while immersive", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    const onAutoPause = vi.fn();
    renderCabinet({ onAutoPause });
    await launch();

    fireEvent(window, new Event("orientationchange"));

    expect(onAutoPause).toHaveBeenCalledTimes(1);
  });

  it("auto-pauses when the tab is hidden", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    const onAutoPause = vi.fn();
    renderCabinet({ onAutoPause });
    await launch();

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    try {
      fireEvent(document, new Event("visibilitychange"));
    } finally {
      Reflect.deleteProperty(document, "visibilityState");
    }

    expect(onAutoPause).toHaveBeenCalledTimes(1);
  });

  it("never auto-pauses a desktop cabinet, even with a handler", async () => {
    installMatchMedia([]);
    const onAutoPause = vi.fn();
    renderCabinet({ onAutoPause });
    await launch();

    fireEvent(window, new Event("blur"));
    fireEvent(window, new Event("pagehide"));
    fireEvent(window, new Event("orientationchange"));

    expect(onAutoPause).not.toHaveBeenCalled();
  });

  it("locks the orientation for a touch cabinet in real fullscreen", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    renderCabinet({ mobileOrientation: "landscape" });
    await launch();

    setRealFullscreen(cabinetEl());

    expect(lockMock).toHaveBeenCalledWith("landscape");
  });

  it("never asks for an orientation lock on desktop fullscreen", async () => {
    installMatchMedia([]);
    renderCabinet({ mobileOrientation: "landscape" });
    await launch();

    setRealFullscreen(cabinetEl());

    expect(lockMock).not.toHaveBeenCalled();
  });

  it("never locks an either-orientation game", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    renderCabinet({ mobileOrientation: "either" });
    await launch();

    setRealFullscreen(cabinetEl());

    expect(lockMock).not.toHaveBeenCalled();
  });
});
