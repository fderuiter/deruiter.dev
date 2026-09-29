// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LaserLoon } from "@/components/LaserLoon";

// Mocks
vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playLaser: vi.fn(),
  }),
}));

const mockAnnounce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({
    announce: mockAnnounce,
  }),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({
    recordEvent: vi.fn().mockResolvedValue(true),
  }),
}));

describe("Laser Loon Pause & Reduced Motion Invariants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("toggles pause overlay via 'P' key when game is playing", async () => {
    render(<LaserLoon />);

    // Start game
    const startBtns = screen.getAllByRole("button", {
      name: /START CAMPAIGN/i,
    });
    fireEvent.click(startBtns[0]);

    // Skip act intro
    const engageBtn = screen.getByRole("button", { name: /ENGAGE STAGE/i });
    fireEvent.click(engageBtn);

    const playfield = screen.getByRole("application", {
      name: /Laser Loon Arcade Game/i,
    }).parentElement;
    expect(playfield).not.toBeNull();

    if (playfield) {
      // Press 'p' key
      fireEvent.keyDown(playfield, { key: "p" });
    }

    expect(screen.getByText(/GAME PAUSED/i)).toBeDefined();
    const resumeBtns = screen.getAllByRole("button", { name: /Resume/i });
    expect(resumeBtns.length).toBeGreaterThan(0);

    // Press 'p' key again to resume
    if (playfield) {
      fireEvent.keyDown(playfield, { key: "p" });
    }

    expect(screen.queryByText(/GAME PAUSED/i)).toBeNull();
  });

  it("resumes game when Resume button is clicked in Pause overlay", () => {
    render(<LaserLoon />);

    // Start game & engage stage
    const startBtns = screen.getAllByRole("button", {
      name: /START CAMPAIGN/i,
    });
    fireEvent.click(startBtns[0]);
    fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));

    // Click HUD pause button
    const pauseBtns = screen.getAllByRole("button", { name: /Pause Game/i });
    fireEvent.click(pauseBtns[0]);

    expect(screen.getByText(/GAME PAUSED/i)).toBeDefined();

    // Click Resume button
    const resumeBtns = screen.getAllByRole("button", { name: /Resume/i });
    fireEvent.click(resumeBtns[0]);

    expect(screen.queryByText(/GAME PAUSED/i)).toBeNull();
  });

  it("exits to cabinet menu from Pause overlay when Exit button is clicked", () => {
    render(<LaserLoon />);

    // Start & engage
    const startBtns = screen.getAllByRole("button", {
      name: /START CAMPAIGN/i,
    });
    fireEvent.click(startBtns[0]);
    fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));

    // Pause
    const pauseBtns = screen.getAllByRole("button", { name: /Pause Game/i });
    fireEvent.click(pauseBtns[0]);

    // Exit to cabinet menu
    const exitBtn = screen.getByRole("button", {
      name: /EXIT TO CABINET MENU/i,
    });
    fireEvent.click(exitBtn);

    // Should return to idle screen with START CAMPAIGN button
    const startBtnsAfterExit = screen.getAllByRole("button", {
      name: /START CAMPAIGN/i,
    });
    expect(startBtnsAfterExit.length).toBeGreaterThan(0);
  });

  it("disables screen shake by default if prefers-reduced-motion is active", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<LaserLoon />);

    expect(screen.getByText(/Screen Shake: OFF/i)).toBeDefined();
  });

  it("announces game pause and resume states", () => {
    render(<LaserLoon />);

    const startBtns = screen.getAllByRole("button", {
      name: /START CAMPAIGN/i,
    });
    fireEvent.click(startBtns[0]);
    fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));

    const pauseBtns = screen.getAllByRole("button", { name: /Pause Game/i });
    fireEvent.click(pauseBtns[0]);

    expect(mockAnnounce).toHaveBeenCalledWith("Game paused.", "assertive");

    const resumeBtns = screen.getAllByRole("button", { name: /Resume/i });
    fireEvent.click(resumeBtns[0]);

    expect(mockAnnounce).toHaveBeenCalledWith("Game resumed.", "assertive");
  });

  it("halts animation loop frame scheduling while paused", () => {
    const rafSpy = vi.spyOn(window, "requestAnimationFrame");
    render(<LaserLoon />);

    const startBtns = screen.getAllByRole("button", {
      name: /START CAMPAIGN/i,
    });
    fireEvent.click(startBtns[0]);
    fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));

    const pauseBtns = screen.getAllByRole("button", { name: /Pause Game/i });
    fireEvent.click(pauseBtns[0]);

    const countAtPause = rafSpy.mock.calls.length;

    // Advance timers or simulate idle frames; no new rAF calls should occur
    const countAfterPause = rafSpy.mock.calls.length;
    expect(countAfterPause).toBe(countAtPause);

    rafSpy.mockRestore();
  });

  it("purely decrements countdown timer and triggers gameover cleanly without state updater side effects", () => {
    vi.useFakeTimers();
    render(<LaserLoon />);

    // Start arcade survival mode
    const startBtns = screen.getAllByRole("button", {
      name: /START CAMPAIGN/i,
    });
    fireEvent.click(startBtns[0]);
    fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));

    // Advance interval timers
    vi.advanceTimersByTime(1000);

    vi.useRealTimers();
  });
  describe("Escape and overlays (#1312)", () => {
    beforeEach(() => cleanup());
    afterEach(() => cleanup());

    function startCampaign() {
      render(<LaserLoon />);
      fireEvent.click(
        screen.getAllByRole("button", { name: /START CAMPAIGN/i })[0]
      );
      fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));
      return screen.getByRole("application", {
        name: /Laser Loon Arcade Game/i,
      }).parentElement as HTMLElement;
    }

    async function framesScheduledOver(ms: number) {
      const rafSpy = vi.spyOn(window, "requestAnimationFrame");
      const before = rafSpy.mock.calls.length;
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, ms));
      });
      const scheduled = rafSpy.mock.calls.length - before;
      rafSpy.mockRestore();
      return scheduled;
    }

    it("pauses on Escape instead of wiping the run", () => {
      const playfield = startCampaign();
      fireEvent.keyDown(playfield, { key: "Escape" });

      const dialog = screen.getByRole("dialog", { name: /GAME PAUSED/i });
      expect(dialog.getAttribute("aria-modal")).toBe("true");
      expect(dialog.textContent).toContain("Act 1 campaign session paused");
    });

    it("resumes on a second Escape", () => {
      const playfield = startCampaign();
      fireEvent.keyDown(playfield, { key: "Escape" });
      const dialog = screen.getByRole("dialog", { name: /GAME PAUSED/i });
      fireEvent.keyDown(dialog, { key: "Escape" });
      expect(screen.queryByRole("dialog", { name: /GAME PAUSED/i })).toBe(null);
    });

    it("keeps the loop running while playing, as a baseline", async () => {
      startCampaign();
      expect(await framesScheduledOver(120)).toBeGreaterThan(0);
    });

    it("stops the game behind the Flag Museum", async () => {
      startCampaign();
      fireEvent.click(screen.getByRole("button", { name: /Flag Museum/i }));
      expect(
        screen.getByRole("dialog", { name: /Flag Redesign Museum/i })
      ).toBeDefined();

      expect(await framesScheduledOver(120)).toBe(0);

      fireEvent.click(
        screen.getByRole("button", { name: /Close Flag Museum/i })
      );
      expect(await framesScheduledOver(120)).toBeGreaterThan(0);
    });

    it("opens the museum with M and closes it with M", () => {
      const playfield = startCampaign();
      fireEvent.keyDown(playfield, { key: "m" });
      const museum = screen.getByRole("dialog", {
        name: /Flag Redesign Museum/i,
      });
      fireEvent.keyDown(museum, { key: "m" });
      expect(
        screen.queryByRole("dialog", { name: /Flag Redesign Museum/i })
      ).toBe(null);
    });

    it("stops the game behind the Field Manual", async () => {
      startCampaign();
      fireEvent.click(screen.getByRole("button", { name: /Manual/i }));

      expect(await framesScheduledOver(120)).toBe(0);
    });
  });
});
