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

// Mock hooks
const mockAnnounce = vi.fn();
const mockPlayNote = vi.fn();
const mockPlayHover = vi.fn();
const mockPlaySubmit = vi.fn();

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: mockAnnounce,
  }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: mockPlayNote,
    playHover: mockPlayHover,
    playSubmit: mockPlaySubmit,
    volume: 0.3,
    muted: false,
  }),
}));

describe("PlayCabinet - Viewport Budgeting & Responsive Container Suite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAnnounce.mockClear();
    mockPlayNote.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders pre-launch cabinet preview with instructions and launch CTA", () => {
    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        subtitle="Responsive Test Engine"
        icon={<span data-testid="test-icon">🎮</span>}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={() => Promise.resolve({})}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    expect(screen.getByText("Test Arcade Game")).toBeDefined();
    expect(
      screen.getByRole("button", { name: /Launch Cabinet/i })
    ).toBeDefined();
  });

  it("launches game with single-screen viewport budgeting container and aria-live state region", async () => {
    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span>🎮</span>}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={() => Promise.resolve({})}
        statusAnnouncement="Boss Encounter Approaching"
        controlDock={
          <div data-testid="test-control-dock">Virtual Controls</div>
        }
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    // Hover to prefetch and resolve promise
    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });
    await act(async () => {
      fireEvent.mouseEnter(launchBtn);
      await Promise.resolve();
    });

    // Click launch
    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    // Fast forward warming timers
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Verify active game content is rendered
    expect(screen.getByTestId("game-content")).toBeDefined();

    // Verify control dock slot is rendered
    expect(screen.getByTestId("test-control-dock")).toBeDefined();

    // Verify aria-live polite announcer mirror exists and has status text
    const liveRegion = screen.getByRole("region", {
      name: /Game Telemetry & Status Announcements/i,
    });
    expect(liveRegion).toBeDefined();
    expect(liveRegion.textContent).toContain("Boss Encounter Approaching");
  });

  it("resets cabinet back to pre-launch state when reset button is triggered", async () => {
    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span>🎮</span>}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={() => Promise.resolve({})}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

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

    expect(screen.getByTestId("game-content")).toBeDefined();

    // Click Reset Cabinet
    const resetBtn = screen.getByRole("button", { name: /Reset Cabinet/i });
    fireEvent.click(resetBtn);

    expect(
      screen.getByRole("button", { name: /Launch Cabinet/i })
    ).toBeDefined();
  });
  it("exits fallback fullscreen before a game can swallow Escape", async () => {
    render(
      <PlayCabinet
        title="Keyboard game"
        icon={<span />}
        instructions="Play"
        controls={[]}
        importComponent={() => Promise.resolve({})}
      >
        <button onKeyDown={(event) => event.stopPropagation()}>
          Game control
        </button>
      </PlayCabinet>
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Launch Cabinet/i }));
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: /Enter Fullscreen/i })
      );
    });
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => {
      fireEvent.keyDown(screen.getByRole("button", { name: "Game control" }), {
        key: "Escape",
      });
    });
    expect(
      screen.getByRole("button", { name: /Enter Fullscreen/i })
    ).toBeDefined();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
  describe("keyboard focus", () => {
    function GameWithStartButton() {
      const [started, setStarted] = React.useState(false);
      return (
        <div data-keyboard-boundary="true" tabIndex={0} data-testid="game">
          {started ? (
            <span>Running</span>
          ) : (
            <button type="button" onClick={() => setStarted(true)}>
              Start
            </button>
          )}
        </div>
      );
    }

    async function launch() {
      render(
        <PlayCabinet
          gameId="focus-game"
          title="Focus Game"
          icon={<span>🎮</span>}
          instructions="Test instructions"
          controls={[{ key: "Space", action: "Jump" }]}
          importComponent={() => Promise.resolve({})}
        >
          <GameWithStartButton />
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
      act(() => {
        vi.advanceTimersByTime(200);
      });
    }

    it("focuses the game's keyboard boundary when the cabinet launches", async () => {
      await launch();
      expect(document.activeElement).toBe(screen.getByTestId("game"));
    });

    it("returns focus to the game when a focused start button unmounts", async () => {
      await launch();
      const start = screen.getByRole("button", { name: "Start" });
      act(() => {
        start.focus();
      });
      await act(async () => {
        fireEvent.click(start);
        await Promise.resolve();
      });
      // jsdom, like Chromium, leaves focus on <body> when the focused node is removed.
      await act(async () => {
        await Promise.resolve();
      });
      expect(document.activeElement).toBe(screen.getByTestId("game"));
    });

    it("puts focus on the game, not the toolbar, when entering and leaving fullscreen", async () => {
      await launch();
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /Enter Fullscreen/i })
        );
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(document.activeElement).toBe(screen.getByTestId("game"));

      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /Exit Fullscreen/i })
        );
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(document.activeElement).toBe(screen.getByTestId("game"));
    });
  });

  describe("Escape in fullscreen", () => {
    function GameWithDialog({ closesOnEscape }: { closesOnEscape: boolean }) {
      const [open, setOpen] = React.useState(true);
      return (
        <div
          data-keyboard-boundary="true"
          tabIndex={0}
          data-testid="game"
          onKeyDown={(event) => {
            if (event.key === "Escape" && closesOnEscape) setOpen(false);
          }}
        >
          {open && (
            <div role="dialog" aria-modal="true" aria-label="Fix dialog">
              <button type="button">Option 1</button>
            </div>
          )}
        </div>
      );
    }

    async function launchFullscreen(closesOnEscape: boolean) {
      render(
        <PlayCabinet
          title="Dialog game"
          icon={<span />}
          instructions="Play"
          controls={[]}
          importComponent={() => Promise.resolve({})}
        >
          <GameWithDialog closesOnEscape={closesOnEscape} />
        </PlayCabinet>
      );
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /Launch Cabinet/i })
        );
      });
      act(() => {
        vi.advanceTimersByTime(2000);
      });
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /Enter Fullscreen/i })
        );
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    it("closes the game's dialog first and stays in fullscreen", async () => {
      await launchFullscreen(true);
      await act(async () => {
        fireEvent.keyDown(screen.getByTestId("game"), { key: "Escape" });
      });
      act(() => {
        vi.advanceTimersByTime(10);
      });
      expect(screen.queryByRole("dialog", { name: "Fix dialog" })).toBeNull();
      expect(
        screen.getByRole("button", { name: /Exit Fullscreen/i })
      ).toBeDefined();
    });

    it("leaves fullscreen when the game's dialog ignores Escape", async () => {
      await launchFullscreen(false);
      await act(async () => {
        fireEvent.keyDown(screen.getByTestId("game"), { key: "Escape" });
      });
      await act(async () => {
        vi.advanceTimersByTime(10);
      });
      expect(screen.getByRole("dialog", { name: "Fix dialog" })).toBeDefined();
      expect(
        screen.getByRole("button", { name: /Enter Fullscreen/i })
      ).toBeDefined();
    });
  });
});
