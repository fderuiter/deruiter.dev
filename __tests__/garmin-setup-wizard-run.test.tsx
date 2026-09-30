/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
//
// Regression for #1209: completing the Pre-Game Setup Wizard on
// /arcade/garmin-watch used to close the wizard and leave the watch idle,
// ignoring difficulty, loadout, shake and CRT choices. This drives the real
// cabinet, wizard and simulator together: launch -> setup -> play.
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
import { PlayCabinet } from "@/components/arcade/PlayCabinet";
import { GarminWatchSimulator } from "@/components/GarminWatchSimulator";

global.ResizeObserver = class {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
} as any;

const mockCtx = new Proxy(
  {
    measureText: () => ({ width: 40 }),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  } as Record<string, unknown>,
  { get: (t, k: string) => t[k] ?? vi.fn(), set: () => true }
);
HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx as any);

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({ useAnnouncer: () => ({ announce }) }));
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playSuccess: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playKeystroke: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

const status = () =>
  screen
    .getByRole("img", { name: /Smartwatch display simulator/ })
    .getAttribute("aria-label")
    ?.match(/Status: (\w+)/)?.[1];

async function launch() {
  render(
    <PlayCabinet
      gameId="garmin-watch"
      title="Monkey C Mayhem"
      icon={<span />}
      instructions="x"
      controls={[]}
      importComponent={() => Promise.resolve({})}
    >
      <GarminWatchSimulator />
    </PlayCabinet>
  );
  const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });
  await act(async () => {
    fireEvent.mouseEnter(launchBtn);
    await Promise.resolve();
  });
  await act(async () => {
    fireEvent.click(launchBtn);
    await Promise.resolve();
  });
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

async function pickOption(name: RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name }));
  });
}

async function next() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));
  });
}

describe("Garmin cabinet setup wizard starts the run (#1209)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    announce.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("START GAME moves the watch from idle to playing and focuses the controls", async () => {
    await launch();
    expect(status()).toBe("idle");

    await act(async () => {
      fireEvent.click(screen.getByTitle("Pre-Game Setup Wizard"));
    });
    await pickOption(/Hard/);
    await next();
    await pickOption(/Heavy Scanlines/);
    await next();
    expect(
      screen.getByTestId("wizard-summary-difficulty-effect")
    ).toBeDefined();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start Game/i }));
    });
    act(() => {
      vi.advanceTimersByTime(10);
    });

    expect(status()).toBe("playing");
    expect(screen.queryByText(/START SIMULATION/i)).toBeNull();
    expect(document.activeElement?.getAttribute("data-keyboard-boundary")).toBe(
      "true"
    );
    expect(
      screen.getByTestId("garmin-crt-overlay").getAttribute("data-garmin-crt")
    ).toBe("scanlines");
  });

  it("reopening Setup mid-run pauses, and skipping resumes the same run", async () => {
    await launch();
    await act(async () => {
      fireEvent.click(screen.getByText(/START SIMULATION/i));
    });
    expect(status()).toBe("playing");

    await act(async () => {
      fireEvent.click(screen.getByTitle("Pre-Game Setup Wizard"));
    });
    expect(status()).toBe("paused");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Skip Setup/i }));
    });
    expect(status()).toBe("playing");
  });

  it("reopening Setup mid-run and confirming restarts with the new options", async () => {
    await launch();
    await act(async () => {
      fireEvent.click(screen.getByText(/START SIMULATION/i));
    });
    await act(async () => {
      fireEvent.click(screen.getByTitle("Pre-Game Setup Wizard"));
    });
    expect(status()).toBe("paused");
    await next();
    await next();
    expect(screen.getByTestId("wizard-apply-note").textContent).toMatch(
      /fresh run/i
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Start Game/i }));
    });
    expect(status()).toBe("playing");
  });
});
