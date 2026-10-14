// @vitest-environment jsdom
// #2039 playtest: the touch cabinet (no real Fullscreen) keeps Tab inside the
// game, and Escape leaves it the way Fullscreen's Escape does.
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
import { createPortal } from "react-dom";
import { PlayCabinet } from "../components/arcade/PlayCabinet";
import { TOUCH_DEVICE_QUERY } from "../components/arcade/mobile";

vi.mock("@/components/arcade/mobile", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/arcade/mobile")>();
  return { ...actual, lockScreenOrientation: vi.fn(() => () => {}) };
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

/** A matchMedia that matches only the touch-device query. */
function installTouchMedia() {
  window.matchMedia = vi.fn((query: string) => ({
    matches: query === TOUCH_DEVICE_QUERY,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function renderCabinetWithPageLink() {
  return render(
    <>
      <a href="/arcade">All Arcade Games</a>
      <PlayCabinet
        gameId="focus-game"
        title="Focus Game"
        icon={<span>🎮</span>}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={() => Promise.resolve({})}
        controlDock={<div data-testid="focus-dock">Dock</div>}
      >
        <button type="button">Game button</button>
      </PlayCabinet>
    </>
  );
}

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

describe("touch cabinet focus and Escape (#2039 playtest)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installTouchMedia();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    document.body.style.overflow = "";
    document.documentElement.style.overscrollBehavior = "";
  });

  it("keeps Tab inside the open touch cabinet instead of the page links behind it", async () => {
    renderCabinetWithPageLink();
    await launch();
    expect(cabinetEl().getAttribute("data-immersive")).toBe("true");

    const pageLink = screen.getByRole("link", { name: "All Arcade Games" });
    act(() => {
      pageLink.focus();
    });
    expect(document.activeElement).toBe(pageLink);

    act(() => {
      fireEvent.keyDown(window, { key: "Tab" });
    });
    expect(cabinetEl().contains(document.activeElement)).toBe(true);
  });

  it("cycles Tab between the cabinet's own controls, never leaving it", async () => {
    renderCabinetWithPageLink();
    await launch();

    const inside = Array.from(
      cabinetEl().querySelectorAll<HTMLElement>("button:not([disabled])")
    ).filter((el) => el.getAttribute("aria-hidden") !== "true");
    expect(inside.length).toBeGreaterThan(1);

    const last = inside[inside.length - 1];
    act(() => {
      last.focus();
    });
    act(() => {
      fireEvent.keyDown(window, { key: "Tab" });
    });
    expect(document.activeElement).toBe(inside[0]);
    expect(cabinetEl().contains(document.activeElement)).toBe(true);
  });

  it("leaves the touch cabinet on Escape, as Fullscreen's Escape does", async () => {
    renderCabinetWithPageLink();
    await launch();
    expect(cabinetEl().getAttribute("data-immersive")).toBe("true");

    act(() => {
      fireEvent.keyDown(cabinetEl(), { key: "Escape" });
    });
    expect(
      screen.getByRole("button", { name: /Launch Cabinet/i })
    ).toBeDefined();
    expect(document.querySelector("[data-immersive]")).toBeNull();
  });

  // #2042 playtest: a game's Field Manual is portaled to <body>. React still
  // bubbles its Escape through the cabinet, which must leave it to the
  // dialog instead of closing the game.
  it("lets a portaled game dialog take Escape without leaving the cabinet", async () => {
    render(
      <PlayCabinet
        gameId="focus-game"
        title="Focus Game"
        icon={<span>🎮</span>}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={() => Promise.resolve({})}
      >
        {createPortal(
          <div role="dialog" aria-modal="true" aria-label="Manual">
            <button type="button">Close manual</button>
          </div>,
          document.body
        )}
      </PlayCabinet>
    );
    await launch();
    expect(cabinetEl().getAttribute("data-immersive")).toBe("true");

    const close = screen.getByRole("button", { name: "Close manual" });
    expect(cabinetEl().contains(close)).toBe(false);
    act(() => {
      fireEvent.keyDown(close, { key: "Escape" });
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(cabinetEl().getAttribute("data-immersive")).toBe("true");
  });
});
