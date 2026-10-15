// @vitest-environment jsdom
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { VictoryModal } from "@/components/QuasiPerfectPuzzler/VictoryModal";
import { TheoryBriefingModal } from "@/components/QuasiPerfectPuzzler/TheoryBriefingModal";
import { CabinetTouchContext } from "@/components/arcade/mobile/CabinetTouchContext";
import { puzzleLevels } from "@/lib/quasi-perfect/levels";
import type { LevelScore } from "@/lib/quasi-perfect/types";

const level = puzzleLevels[0];

const score: LevelScore = {
  levelId: level.id,
  completed: true,
  usedSorry: false,
  remainingRam: 3,
  stars: 2,
  morality: 100,
  timestamp: 1700000000000,
};

function renderVictory(inCabinet: boolean, onDismiss = vi.fn()) {
  return render(
    <CabinetTouchContext.Provider value={inCabinet}>
      <VictoryModal
        score={score}
        level={level}
        totalLevels={puzzleLevels.length}
        currentLevelIndex={0}
        leanCode="-- proof"
        ramUsed={1}
        onNextLevel={vi.fn()}
        onRestartLevel={vi.fn()}
        onRestartCampaign={vi.fn()}
        onDismiss={onDismiss}
      />
    </CabinetTouchContext.Provider>
  );
}

describe("Quasi-Puzzler modals on the touch cabinet (#2042)", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("caps the victory card to the screen on the touch cabinet and scrolls it", () => {
    renderVictory(true);
    const dialog = screen.getByRole("dialog");
    const card = dialog.firstElementChild as HTMLElement;
    expect(card.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(card.className).toContain("overflow-y-auto");
  });

  it("keeps the desktop victory card inside the viewport too (#2201)", () => {
    // The Lean text now shows in full, so the card scrolls on every screen.
    renderVictory(false);
    const card = screen.getByRole("dialog").firstElementChild as HTMLElement;
    expect(card.className).toContain("max-h-[calc(100dvh-2rem)]");
    expect(card.className).toContain("overflow-y-auto");
  });

  it("traps focus inside the victory dialog and closes it with Escape", async () => {
    const onDismiss = vi.fn();
    renderVictory(true, onDismiss);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
    // Tab from the last control wraps to the first, and Shift+Tab back.
    const stops = Array.from(
      dialog.querySelectorAll<HTMLElement>("button:not([disabled])")
    );
    expect(stops.length).toBeGreaterThan(1);
    stops[stops.length - 1].focus();
    act(() => {
      fireEvent.keyDown(window, { key: "Tab" });
    });
    expect(document.activeElement).toBe(stops[0]);
    act(() => {
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    });
    expect(document.activeElement).toBe(stops[stops.length - 1]);
    act(() => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("keeps the theory briefing a focus-trapped dialog that closes with Escape", async () => {
    const onClose = vi.fn();
    render(
      <CabinetTouchContext.Provider value={true}>
        <TheoryBriefingModal
          level={level}
          gameMode="story"
          isOpen={true}
          onClose={onClose}
          onToggleMode={vi.fn()}
        />
      </CabinetTouchContext.Provider>
    );
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true);
    });
    act(() => {
      fireEvent.keyDown(dialog, { key: "Escape" });
    });
    expect(onClose).toHaveBeenCalled();
  });
});
