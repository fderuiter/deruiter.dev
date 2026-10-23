// @vitest-environment jsdom
//
// Clinical Trial Chaos on the iPad (#2105): the touch cabinet moves the
// station and lifeline keys into a dock, turns the stress drawer into a sheet,
// pauses when the app is backgrounded and keeps Escape inside the game. The
// desktop markup stays as it was.
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CabinetTouchContext } from "@/components/arcade/mobile";
import {
  CLINICAL_CHAOS_AUTO_PAUSE_EVENT,
  requestClinicalChaosAutoPause,
} from "@/components/clinical-trial-chaos/auto-pause";
import { ClinicalTrialChaos } from "@/components/ClinicalTrialChaos";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playSuccess: vi.fn(),
    playNote: vi.fn(),
    playHover: vi.fn(),
    muted: true,
  }),
}));
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));
vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

function renderGame(touch: boolean) {
  return render(
    <CabinetTouchContext.Provider value={touch}>
      <ClinicalTrialChaos />
    </CabinetTouchContext.Provider>
  );
}

/** Starts the campaign and skips the first-shift calibration. */
function startShift() {
  fireEvent.click(
    screen.getByRole("button", { name: /Start 3-Phase Campaign/i })
  );
  fireEvent.click(screen.getByRole("button", { name: /Skip calibration/i }));
}

/** The last input was a finger, so the dock is shown. */
function touchInput() {
  act(() => {
    window.dispatchEvent(
      new PointerEvent("pointerdown", { pointerType: "touch" })
    );
  });
}

const board = (container: HTMLElement) =>
  container.querySelector<HTMLElement>("[data-keyboard-boundary]")!;

describe("Clinical Trial Chaos on the desktop cabinet (#2105)", () => {
  afterEach(() => cleanup());

  it("keeps the station strip, the side-rail lifelines and the drawer", () => {
    const { container } = renderGame(false);
    startShift();
    expect(container.querySelector(".cc-touch")).toBeNull();
    expect(screen.getByRole("region", { name: "EDC stations" })).toBeDefined();
    expect(screen.getByRole("region", { name: "Lifelines" })).toBeDefined();
    expect(screen.queryByTestId("cc-touch-dock")).toBeNull();
    expect(board(container).hasAttribute("data-escape-docks")).toBe(false);
    fireEvent.click(
      screen.getByRole("button", { name: /^Stress & BIMO Stream/ })
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      container.querySelector("aside[aria-label*='Stress Control']")
    ).not.toBeNull();
  });
});

describe("Clinical Trial Chaos in the touch cabinet (#2105)", () => {
  afterEach(() => cleanup());

  it("moves the stations and lifelines into the dock", () => {
    const { container } = renderGame(true);
    expect(container.querySelector(".cc-touch")).not.toBeNull();
    startShift();
    touchInput();
    const dock = screen.getByTestId("cc-touch-dock");
    expect(dock).toBeDefined();
    expect(screen.queryByRole("region", { name: "EDC stations" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Lifelines" })).toBeNull();
    for (const n of [1, 2, 3, 4]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^Station ${n}:`) })
      ).toBeDefined();
    }
    for (const key of ["Q", "W", "E", "R"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^Lifeline ${key}:`) })
      ).toBeDefined();
    }
  });

  it("a station key routes the open dossier like its number key", () => {
    renderGame(true);
    startShift();
    touchInput();
    fireEvent.click(screen.getByRole("button", { name: /^Station 2:/ }));
    // The first dossier still has a flagged field, so routing is refused.
    expect(screen.getByText(/Resolve 1 flagged observation/i)).toBeDefined();
  });

  it("hands Escape to the game while a shift runs", () => {
    const { container } = renderGame(true);
    expect(board(container).hasAttribute("data-escape-docks")).toBe(false);
    startShift();
    expect(board(container).getAttribute("data-escape-docks")).toBe("true");
  });

  it("pauses a running shift when the app is backgrounded, and Escape resumes it", () => {
    const { container } = renderGame(true);
    // Idle: nothing to pause.
    act(() => requestClinicalChaosAutoPause());
    expect(screen.queryByRole("dialog")).toBeNull();
    startShift();
    act(() => {
      window.dispatchEvent(new Event(CLINICAL_CHAOS_AUTO_PAUSE_EVENT));
    });
    expect(screen.getByRole("dialog", { name: /Shift paused/i })).toBeDefined();
    // Escape on the board before focus has moved into the dialog.
    fireEvent.keyDown(board(container), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape right after Enter opens the fix dialog closes it again", () => {
    const { container } = renderGame(true);
    startShift();
    const boardEl = board(container);
    boardEl.focus();
    fireEvent.keyDown(boardEl, { key: "Enter" });
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/Controlled Terminology/i);
    fireEvent.keyDown(boardEl, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Escape with nothing open pauses the shift instead of leaving the cabinet", () => {
    const { container } = renderGame(true);
    startShift();
    fireEvent.keyDown(board(container), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: /Shift paused/i })).toBeDefined();
  });

  it("a fix dialog hides behind a pause and returns on resume", () => {
    const { container } = renderGame(true);
    startShift();
    const boardEl = board(container);
    fireEvent.keyDown(boardEl, { key: "Enter" });
    act(() => requestClinicalChaosAutoPause());
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].textContent).toMatch(/Shift paused/i);
    fireEvent.keyDown(boardEl, { key: "Escape" });
    expect(screen.getByRole("dialog").textContent).toMatch(
      /Controlled Terminology/i
    );
  });

  it("the stress drawer is a modal sheet that Escape closes", () => {
    const { container } = renderGame(true);
    startShift();
    fireEvent.click(
      screen.getByRole("button", { name: /^Stress & BIMO Stream/ })
    );
    const sheet = screen.getByTestId("cc-stress-sheet");
    expect(sheet.getAttribute("role")).toBe("dialog");
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    fireEvent.keyDown(board(container), { key: "Escape" });
    expect(screen.queryByTestId("cc-stress-sheet")).toBeNull();
  });
});
