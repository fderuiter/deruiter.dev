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
import { PlayCabinet } from "@/components/arcade/PlayCabinet";

const mockAnnounce = vi.fn();

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: mockAnnounce,
  }),
}));

describe("PlayCabinet launch recovery and attempt lifecycle (#3794)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockAnnounce.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("recovers from rejected component import by showing accessible error UI with working Retry and Exit", async () => {
    const importError = new Error("Network error loading game module");
    const importComponent = vi.fn().mockRejectedValue(importError);

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });

    // Click launch
    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    // Advance timers through ticks
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Error alert is rendered instead of continuing warmup
    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("Failed to Load Game Module");
    expect(alert.textContent).toContain("Network error loading game module");

    // Retry and Exit buttons are available
    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    const exitBtn = screen.getByRole("button", { name: /Exit/i });
    expect(retryBtn).toBeDefined();
    expect(exitBtn).toBeDefined();

    // Warmup text and bar are gone
    expect(screen.queryByText(/Warming up CRT display/i)).toBeNull();

    // Announcer announced failure
    expect(mockAnnounce).toHaveBeenCalledWith(
      expect.stringContaining("Failed to load cabinet: Network error loading game module"),
      "assertive"
    );

    // Warmup interval is stopped: further ticks should not restart warmup or advance boot progress
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.queryByTestId("game-content")).toBeNull();
  });

  it("recovers cleanly from synchronous exception thrown by importComponent loader", async () => {
    const importComponent = vi.fn().mockImplementation(() => {
      throw new Error("Synchronous bundle evaluation failed");
    });

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });

    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("Synchronous bundle evaluation failed");

    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    expect(retryBtn).toBeDefined();
  });

  it("preserves non-Error string rejection details on failure view", async () => {
    const importComponent = vi.fn().mockRejectedValue("Failed to fetch dynamically imported module: 404");

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });

    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const alert = screen.getByRole("alert");
    expect(alert).toBeDefined();
    expect(alert.textContent).toContain("Failed to fetch dynamically imported module: 404");
  });

  it("allows Retry after failure to launch the cabinet once import resolves", async () => {
    let callCount = 0;
    const importComponent = vi.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return Promise.reject(new Error("Initial load chunk failure"));
      }
      return Promise.resolve({});
    });

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });

    // Launch -> fails
    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole("alert")).toBeDefined();

    // Click Retry
    const retryBtn = screen.getByRole("button", { name: /Retry/i });
    await act(async () => {
      fireEvent.click(retryBtn);
      await Promise.resolve();
    });

    // Warmup completes and game mounts
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("game-content")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(importComponent).toHaveBeenCalledTimes(2);
  });

  it("handles multiple sequential retries before succeeding", async () => {
    let callCount = 0;
    const importComponent = vi.fn().mockImplementation(() => {
      callCount += 1;
      if (callCount < 3) {
        return Promise.reject(new Error(`Attempt ${callCount} failed`));
      }
      return Promise.resolve({});
    });

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });

    // 1st attempt: Launch -> fails
    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("Attempt 1 failed")).toBeDefined();

    // 2nd attempt: Retry -> fails again
    const retryBtn1 = screen.getByRole("button", { name: /Retry/i });
    await act(async () => {
      fireEvent.click(retryBtn1);
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("Attempt 2 failed")).toBeDefined();

    // 3rd attempt: Retry -> succeeds
    const retryBtn2 = screen.getByRole("button", { name: /Retry/i });
    await act(async () => {
      fireEvent.click(retryBtn2);
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByTestId("game-content")).toBeDefined();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(importComponent).toHaveBeenCalledTimes(3);
  });

  it("returns to attract mode and restores focus when Exit is clicked on the failure screen", async () => {
    const importComponent = vi.fn().mockRejectedValue(new Error("Connection reset"));
    const onExit = vi.fn();

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
        onExit={onExit}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });
    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const exitBtn = screen.getByRole("button", { name: /Exit/i });
    await act(async () => {
      fireEvent.click(exitBtn);
    });

    // Cabinet is back in attract screen
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: /Launch Cabinet/i })).toBeDefined();
    expect(onExit).toHaveBeenCalledTimes(1);

    // Focus restored to Launch button
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /Launch Cabinet/i }));
  });

  it("cancels warmup when Escape is pressed from anywhere (document.body)", async () => {
    const importComponent = vi.fn().mockReturnValue(new Promise(() => {}));

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });
    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByText(/Warming up CRT display/i)).toBeDefined();

    // User presses Escape while focus is on document.body (since Launch button unmounted)
    expect(document.activeElement).toBe(document.body);
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    });

    // Warmup canceled, back to attract
    expect(screen.queryByText(/Warming up CRT display/i)).toBeNull();
    expect(screen.getByRole("button", { name: /Launch Cabinet/i })).toBeDefined();
  });

  it("handles Escape key from window/document on the failure screen to exit back to attract mode", async () => {
    const importComponent = vi.fn().mockRejectedValue(new Error("Timeout"));

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });
    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole("alert")).toBeDefined();

    // Press Escape from window
    await act(async () => {
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });
    });

    // Exited to attract mode
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: /Launch Cabinet/i })).toBeDefined();
  });

  it("discards delayed import resolution if user exits before import completes", async () => {
    let resolveImport!: (value: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolveImport = resolve;
    });
    const importComponent = vi.fn().mockReturnValue(pendingPromise);

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });

    // Start launch
    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    // Warmup is ticking up to 85%
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByText(/Warming up CRT display/i)).toBeDefined();

    // User exits during warmup via Escape or browser back
    await act(async () => {
      window.history.replaceState(null, "");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    // Back to attract screen
    expect(screen.getByRole("button", { name: /Launch Cabinet/i })).toBeDefined();

    // Now the deferred import resolves
    await act(async () => {
      resolveImport({});
      await Promise.resolve();
    });

    // Advance timers significantly
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Must REMAIN in attract mode! Must NOT relaunch!
    expect(screen.queryByTestId("game-content")).toBeNull();
    expect(screen.getByRole("button", { name: /Launch Cabinet/i })).toBeDefined();
  });

  it("discards delayed rejection if user exits before import fails", async () => {
    let rejectImport!: (reason: unknown) => void;
    const pendingPromise = new Promise((_, reject) => {
      rejectImport = reject;
    });
    const importComponent = vi.fn().mockReturnValue(pendingPromise);

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });

    // Start launch
    await act(async () => {
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // User exits during warmup
    await act(async () => {
      window.history.replaceState(null, "");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    // Deferred rejection arrives
    await act(async () => {
      rejectImport(new Error("Belated failure"));
      await Promise.resolve();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Cabinet must NOT show failure screen; it stays in attract screen
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("button", { name: /Launch Cabinet/i })).toBeDefined();
  });

  it("ignores repeated launch clicks while warming up to prevent multiple attempts or history pushes", async () => {
    const importComponent = vi.fn().mockReturnValue(new Promise(() => {}));
    const onLaunch = vi.fn();

    render(
      <PlayCabinet
        gameId="test-game"
        title="Test Arcade Game"
        icon={<span />}
        instructions="Test instructions"
        controls={[{ key: "Space", action: "Jump" }]}
        importComponent={importComponent}
        onLaunch={onLaunch}
      >
        <div data-testid="game-content">Active Game Running</div>
      </PlayCabinet>
    );

    const launchBtn = screen.getByRole("button", { name: /Launch Cabinet/i });

    await act(async () => {
      fireEvent.click(launchBtn);
      // Repeated rapid clicks
      fireEvent.click(launchBtn);
      fireEvent.click(launchBtn);
      await Promise.resolve();
    });

    expect(onLaunch).toHaveBeenCalledTimes(1);
    expect(importComponent).toHaveBeenCalledTimes(1);
  });
});
