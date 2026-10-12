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
import { TOUCH_NARROW_QUERY } from "../components/arcade/mobile/immersive";

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

/** Installs matchMedia with the given queries matching; all others do not. */
function installMatchMedia(matching: string[]) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matching.includes(query),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
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

describe("PlayCabinet immersive touch mode (ADR 0061)", () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.style.overflow = "";
    document.documentElement.style.overscrollBehavior = "";
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.matchMedia = originalMatchMedia;
    document.body.style.overflow = "";
    document.documentElement.style.overscrollBehavior = "";
  });

  it("goes immersive on a coarse, narrow device and locks the page", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    renderCabinet();
    // Before launch the attract screen has no immersive state.
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

  it("restores page scroll and overscroll when the cabinet is powered off", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    document.body.style.overflow = "scroll";
    renderCabinet();
    await launch();
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(screen.getByTitle("Reset / Power Off Cabinet"));

    expect(document.querySelector("[data-arcade-cabinet]")).toBeNull();
    expect(document.body.style.overflow).toBe("scroll");
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

  it("shows the rotate prompt when a landscape game is held in portrait", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY, ORIENTATION_PORTRAIT]);
    renderCabinet({ mobileOrientation: "landscape" });
    await launch();

    const prompt = screen.getByTestId("rotate-device-prompt");
    expect(prompt.textContent).toContain("landscape");
  });

  it("shows no rotate prompt for a portrait game held in landscape", async () => {
    installMatchMedia([TOUCH_NARROW_QUERY]);
    renderCabinet({ mobileOrientation: "portrait" });
    await launch();

    expect(screen.getByTestId("rotate-device-prompt").textContent).toContain(
      "portrait"
    );
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

  it("lets the player leave from the rotate prompt", async () => {
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

    expect(onAutoPause).not.toHaveBeenCalled();
  });
});
