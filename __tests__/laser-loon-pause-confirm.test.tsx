// @vitest-environment jsdom
//
// #1551: a stray fire click landed on EXIT TO CABINET MENU and dropped a
// scored run with no confirmation. Restart and Exit now ask first once the
// run has a score, and the question keeps focus trapped with Esc cancelling.
import React from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { PauseMenu } from "@/components/laser-loon/PauseMenu";
import { LaserLoon } from "@/components/LaserLoon";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playLaser: vi.fn(),
  }),
}));

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));

vi.mock("@/hooks/useTelemetry", () => ({
  useTelemetry: () => ({ recordEvent: vi.fn().mockResolvedValue(true) }),
}));

function renderMenu(score: number) {
  const handlers = {
    onResume: vi.fn(),
    onRestart: vi.fn(),
    onExit: vi.fn(),
  };
  render(<PauseMenu score={score} actNum={2} {...handlers} />);
  return handlers;
}

describe("Laser Loon pause menu confirmation (#1551)", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("exits at once when the run has no score", () => {
    const { onExit } = renderMenu(0);
    fireEvent.click(
      screen.getByRole("button", { name: /EXIT TO CABINET MENU/i })
    );
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("asks before exiting a scored run", () => {
    const { onExit } = renderMenu(1570);
    fireEvent.click(
      screen.getByRole("button", { name: /EXIT TO CABINET MENU/i })
    );

    expect(onExit).not.toHaveBeenCalled();
    expect(screen.getByText("END THIS RUN?")).toBeDefined();
    expect(screen.getByText(/score of 1570 will be lost/i)).toBeDefined();

    fireEvent.click(
      screen.getByRole("button", { name: /YES, EXIT TO CABINET MENU/i })
    );
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it("asks before restarting a scored run", () => {
    const { onRestart } = renderMenu(40);
    fireEvent.click(screen.getByRole("button", { name: /^RESTART CAMPAIGN/i }));
    expect(onRestart).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: /YES, RESTART CAMPAIGN/i })
    );
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it("focuses Keep this run, and Esc cancels without resuming", () => {
    const { onExit, onResume } = renderMenu(300);
    const exit = screen.getByRole("button", { name: /EXIT TO CABINET MENU/i });
    fireEvent.click(exit);

    const keep = screen.getByRole("button", { name: /KEEP THIS RUN/i });
    expect(document.activeElement).toBe(keep);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", cancelable: true })
      );
    });

    expect(screen.queryByText("END THIS RUN?")).toBeNull();
    expect(screen.getByText("GAME PAUSED")).toBeDefined();
    expect(onExit).not.toHaveBeenCalled();
    expect(onResume).not.toHaveBeenCalled();
    // Focus returns to the button that asked.
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /EXIT TO CABINET MENU/i })
    );

    // A second Esc, with no question open, resumes.
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", cancelable: true })
      );
    });
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("keeps Tab inside the confirmation", () => {
    renderMenu(300);
    fireEvent.click(
      screen.getByRole("button", { name: /EXIT TO CABINET MENU/i })
    );
    const confirm = screen.getByRole("button", {
      name: /YES, EXIT TO CABINET MENU/i,
    });
    confirm.focus();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", cancelable: true })
      );
    });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /KEEP THIS RUN/i })
    );
  });
});

describe("Laser Loon Pause control placement (#1551)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders Pause outside the playfield, not over the canvas", () => {
    render(<LaserLoon />);
    fireEvent.click(
      screen.getAllByRole("button", { name: /START CAMPAIGN/i })[0]
    );
    fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));

    const canvas = screen.getByRole("application", {
      name: /Laser Loon Arcade Game/i,
    });
    const playfield = canvas.parentElement as HTMLElement;
    const pause = screen.getByRole("button", { name: /Pause Game/i });
    expect(playfield.contains(pause)).toBe(false);
  });

  it("activates a pause-dialog button with Enter instead of resuming", () => {
    render(<LaserLoon />);
    fireEvent.click(
      screen.getAllByRole("button", { name: /START CAMPAIGN/i })[0]
    );
    fireEvent.click(screen.getByRole("button", { name: /ENGAGE STAGE/i }));
    fireEvent.click(screen.getByRole("button", { name: /Pause Game/i }));

    const restart = screen.getByRole("button", { name: /^RESTART CAMPAIGN/i });
    fireEvent.keyDown(restart, { key: "Enter" });
    // The playfield handler leaves Enter alone inside the dialog, so the
    // game stays paused for the button's own activation.
    expect(screen.getByText("GAME PAUSED")).toBeDefined();
  });
});
