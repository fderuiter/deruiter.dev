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
import {
  PreGameSetupWizard,
  getSavedSetupConfig,
  saveSetupConfig,
} from "@/components/arcade/PreGameSetupWizard";
import { PlayCabinet } from "@/components/arcade/PlayCabinet";

// Mock A11yProvider & AudioProvider hooks
const mockAnnounce = vi.fn();
const mockPlayNote = vi.fn();
const mockPlayHover = vi.fn();
const mockPlaySubmit = vi.fn();
const mockPlayKeystroke = vi.fn();

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
    playKeystroke: mockPlayKeystroke,
    volume: 0.3,
    muted: false,
  }),
}));

describe("Standardized Pre-Game Setup Wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  describe("PreGameSetupWizard Component Unit Tests", () => {
    it("renders Step 1 (Gameplay) initially when opened", () => {
      render(
        <PreGameSetupWizard
          gameId="laser-loon"
          gameTitle="Laser Loon"
          isOpen={true}
          onComplete={vi.fn()}
        />
      );

      expect(screen.getByTestId("wizard-step-1")).toBeTruthy();
      expect(screen.getByText(/Step 1: Gameplay Parameters/i)).toBeTruthy();
      expect(screen.getByText(/Difficulty Mode/i)).toBeTruthy();
      expect(screen.getByText(/Initial Starting Loadout/i)).toBeTruthy();
    });

    it("navigates through Step 1 -> Step 2 -> Step 3", () => {
      render(
        <PreGameSetupWizard
          gameId="working-with-duck"
          gameTitle="Working With Duck"
          isOpen={true}
          onComplete={vi.fn()}
        />
      );

      // Verify initial Step 1
      expect(screen.getByTestId("wizard-step-1")).toBeTruthy();

      // Click Next Step -> Step 2
      fireEvent.click(screen.getByText(/Next Step/i));
      expect(screen.getByTestId("wizard-step-2")).toBeTruthy();
      expect(
        screen.getByText(/Step 2: Visual & Cabinet Configuration/i)
      ).toBeTruthy();
      expect(screen.getByText(/Screen Shake Intensity/i)).toBeTruthy();
      expect(screen.getByText(/CRT Filter Effect/i)).toBeTruthy();

      // Click Next Step -> Step 3
      fireEvent.click(screen.getByText(/Next Step/i));
      expect(screen.getByTestId("wizard-step-3")).toBeTruthy();
      expect(
        screen.getByText(/Step 3: Setup Summary & Confirmation/i)
      ).toBeTruthy();
      expect(screen.getByRole("button", { name: /Start Game/i })).toBeTruthy();
    });

    it("persists selections to localStorage and triggers completion callback on Start Game", () => {
      const onCompleteMock = vi.fn();
      render(
        <PreGameSetupWizard
          gameId="quasi-puzzler"
          gameTitle="Quasi-Perfect Puzzler"
          isOpen={true}
          onComplete={onCompleteMock}
        />
      );

      // Select Hard difficulty button in step 1
      const hardBtn = screen
        .getAllByRole("button")
        .find((b) => b.textContent?.includes("Hard"));
      expect(hardBtn).toBeDefined();
      if (hardBtn) fireEvent.click(hardBtn);

      // Go to Step 2
      fireEvent.click(screen.getByText(/Next Step/i));

      // Select None screen shake
      fireEvent.click(screen.getByText(/None \(Off\)/i));

      // Go to Step 3
      fireEvent.click(screen.getByText(/Next Step/i));

      // Click Start Game
      fireEvent.click(screen.getByRole("button", { name: /Start Game/i }));

      expect(onCompleteMock).toHaveBeenCalledTimes(1);
      const saved = getSavedSetupConfig("quasi-puzzler");
      expect(saved.difficulty).toBe("hard");
      expect(saved.screenShake).toBe("none");
      expect(mockPlaySubmit).toHaveBeenCalled();
      expect(mockAnnounce).toHaveBeenCalledWith(
        expect.stringContaining("Starting active gameplay"),
        "assertive"
      );
    });

    it("pre-populates wizard with saved preferences from localStorage", () => {
      saveSetupConfig("garmin-watch", {
        difficulty: "hard",
        loadout: "overclocked",
        screenShake: "none",
        crtFilter: "scanlines",
        bezelStyle: "neon",
      });

      render(
        <PreGameSetupWizard
          gameId="garmin-watch"
          gameTitle="Garmin Connect IQ"
          isOpen={true}
          onComplete={vi.fn()}
        />
      );

      // Step 1: Check selected loadout is overclocked
      expect(screen.getByText(/Overclocked Speedster/i)).toBeTruthy();

      // Go to Step 2: Check selected CRT filter is Heavy Scanlines
      fireEvent.click(screen.getByText(/Next Step/i));
      expect(screen.getByText(/Heavy Scanlines/i)).toBeTruthy();

      // Go to Step 3: Check summary matches pre-populated values
      fireEvent.click(screen.getByText(/Next Step/i));
      const summaryDiff = screen.getByText(/Hard/i);
      expect(summaryDiff).toBeTruthy();
      expect(screen.getByText(/Cyber Neon/i)).toBeTruthy();
    });

    it("supports keyboard navigation (ArrowLeft & ArrowRight)", () => {
      render(
        <PreGameSetupWizard
          gameId="clinical-chaos"
          gameTitle="Clinical Trial Chaos"
          isOpen={true}
          onComplete={vi.fn()}
        />
      );

      expect(screen.getByTestId("wizard-step-1")).toBeTruthy();

      // Press ArrowRight to move to Step 2
      fireEvent.keyDown(window, { key: "ArrowRight" });
      expect(screen.getByTestId("wizard-step-2")).toBeTruthy();

      // Press ArrowLeft to return to Step 1
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      expect(screen.getByTestId("wizard-step-1")).toBeTruthy();
    });

    it("renders for the Garmin watch without errors", () => {
      render(
        <PreGameSetupWizard
          gameId="garmin-watch"
          gameTitle="Garmin Watch"
          isOpen={true}
          onComplete={vi.fn()}
        />
      );

      const overlay = screen.getByTestId("pregame-setup-wizard-overlay");
      expect(overlay).toBeTruthy();
      expect(screen.getByText(/Garmin Watch/i)).toBeTruthy();
    });
  });

  describe("Integration Across All 6 Arcade Games via PlayCabinet", () => {
    const arcadeGames = [
      { id: "working-with-duck", title: "Working With Duck" },
      { id: "laser-loon", title: "Laser Loon: Quest for the State Flag" },
      { id: "quasi-puzzler", title: "Quasi-Perfect Puzzler" },
      { id: "garmin-watch", title: "Monkey C Mayhem: Garmin Schvitz App" },
      { id: "clinical-chaos", title: "Clinical Trial Chaos: CDISC Compliance" },
      { id: "retro-labyrinth", title: "Retro Labyrinth: Graveyard Roguelike" },
    ];

    arcadeGames.forEach((game) => {
      it(`displays 3-step setup modal when launching ${game.title}`, async () => {
        vi.useFakeTimers();
        const importMock = vi.fn().mockResolvedValue({});
        render(
          <PlayCabinet
            gameId={game.id}
            title={game.title}
            accentColor="amber"
            icon={<div data-testid="game-icon" />}
            instructions="Test Instructions"
            controls={[]}
            importComponent={importMock}
          >
            <div data-testid="game-content">Active Gameplay Loaded</div>
          </PlayCabinet>
        );

        // Click Launch Cabinet
        const launchBtn = screen.getByText(/Launch Cabinet/i);
        await act(async () => {
          fireEvent.click(launchBtn);
        });

        // Fast-forward boot animation interval
        await act(async () => {
          vi.advanceTimersByTime(2000);
        });

        // Open setup wizard via cabinet frame setup button
        const setupBtn = screen.getByTitle(/Pre-Game Setup Wizard/i);
        fireEvent.click(setupBtn);

        // Setup wizard is visible
        expect(screen.getByTestId("pregame-setup-wizard-overlay")).toBeTruthy();
        expect(screen.getByText(/Step 1: Gameplay Parameters/i)).toBeTruthy();

        // The panel stays a rectangle: a round one over the Garmin face
        // clipped the title and the Next Step button (#1401).
        const panel = screen.getByTestId("pregame-setup-wizard-overlay")
          .firstElementChild as HTMLElement;
        expect(panel.className).not.toContain("rounded-full");

        // Complete Step 1
        fireEvent.click(screen.getByText(/Next Step/i));

        // Complete Step 2
        fireEvent.click(screen.getByText(/Next Step/i));

        // Complete Step 3
        fireEvent.click(screen.getByRole("button", { name: /Start Game/i }));

        // Wizard closes and gameplay is active
        expect(screen.queryByTestId("pregame-setup-wizard-overlay")).toBeNull();
        expect(screen.getByTestId("game-content")).toBeTruthy();

        vi.useRealTimers();
      });
    });
  });
});
