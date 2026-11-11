import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";
import {
  CabinetTutorialContext,
  type CabinetTutorialValue,
} from "@/components/arcade/tutorial";
import {
  WORLD_SAVE_KEY,
  formatClock,
  newWorld,
  parseWorld,
  passTime,
  serializeWorld,
  startDay,
  type WorldState,
} from "@/lib/study-director-world";
import {
  STUDY_DIRECTOR_TUTORIAL,
  STUDY_DIRECTOR_TUTORIAL_SEED,
  STUDY_DIRECTOR_TUTORIAL_SIGNALS as S,
} from "@/lib/study-director";

/**
 * Study Director's guided tutorial (#3457): the cabinet's offer stands in
 * for the office's first-run help, and the tutorial plays a practice morning
 * whose clock stands still, that is never saved, and that hands the real run
 * back as it was.
 */

function savedWorld(): WorldState | null {
  return parseWorld(globalThis.localStorage.getItem(WORLD_SAVE_KEY));
}

/** A run under way, half an hour into its first morning. */
function realRun(): WorldState {
  const morning = startDay(newWorld("real-run", "standard")).world;
  const later = passTime(morning, 30);
  if (!later.ok) throw new Error("could not pass time");
  return later.world;
}

beforeEach(() => {
  globalThis.localStorage?.clear?.();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Office({ value }: { value: CabinetTutorialValue }) {
  return (
    <CabinetTutorialContext.Provider value={value}>
      <StudyDirectorWorld onExit={vi.fn()} />
    </CabinetTutorialContext.Provider>
  );
}

describe("Study Director tutorial", () => {
  it("leaves the first-run help to the cabinet's offer", () => {
    const signal = vi.fn();
    render(
      <Office
        value={{ active: false, stepId: null, signal, available: true }}
      />
    );
    expect(screen.queryByTestId("world-intro")).toBeNull();
    // The Controls button still opens it.
    fireEvent.click(screen.getByRole("button", { name: "Controls" }));
    expect(screen.getByTestId("world-intro")).toBeTruthy();
  });

  it("plays a still-clock practice morning, signals what the player does, then hands the run back", () => {
    const real = realRun();
    globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(real));
    const signal = vi.fn();
    const idle = { active: false, stepId: null, signal, available: true };
    const { rerender } = render(<Office value={idle} />);
    const clock = () => screen.getByTestId("world-clock").textContent;
    expect(clock()).toBe(formatClock(real.minute));

    rerender(<Office value={{ ...idle, active: true, stepId: "move" }} />);
    const practice = startDay(
      newWorld(STUDY_DIRECTOR_TUTORIAL_SEED, "standard", "short")
    ).world;
    expect(clock()).toBe(formatClock(practice.minute));
    // Swapping in the practice morning is not news.
    expect(screen.queryByTestId("world-feedback")?.textContent ?? "").toBe("");

    const floor = screen.getByTestId("world-playfield");
    for (const key of ["ArrowLeft", "ArrowLeft", "ArrowUp", "ArrowLeft"]) {
      act(() => {
        fireEvent.keyDown(floor, { key });
      });
    }
    expect(signal).toHaveBeenCalledWith(S.move);
    act(() => {
      fireEvent.keyDown(floor, { key: "f" });
    });
    expect(signal).toHaveBeenCalledWith(S.self);
    // The clock stood still, and the real run's save is untouched.
    expect(clock()).toBe(formatClock(practice.minute));
    expect(savedWorld()?.study.seed).toBe("real-run");
    expect(savedWorld()?.minute).toBe(real.minute);
    // The practice morning cannot be handed to the team.
    expect(screen.queryByTestId("world-delegate")).toBeNull();

    rerender(<Office value={idle} />);
    expect(clock()).toBe(formatClock(real.minute));
    expect(savedWorld()?.study.seed).toBe("real-run");
    expect(savedWorld()?.player).toEqual(real.player);
  });

  it("practises each thing the office does", () => {
    const practised = STUDY_DIRECTOR_TUTORIAL.steps
      .map((step) => step.practice?.signal)
      .filter(Boolean);
    expect(practised).toEqual(Object.values(S));
  });
});
