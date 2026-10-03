import React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";
import {
  WORLD_SAVE_KEY,
  getStation,
  CRO_FLOOR,
  newWorld,
  serializeWorld,
  startDay,
  type WorldState,
} from "@/lib/study-director-world";

/** A world on the study's last day, standing at the car. */
function lastDayAtTheCar(): WorldState {
  const world = startDay(newWorld("closeout-1", "standard")).world;
  const car = getStation(CRO_FLOOR, "exit");
  if (!car) throw new Error("no car on the floor");
  const { study } = world;
  return {
    ...world,
    study: { ...study, day: study.setup.durationDays + study.slipDays - 1 },
    location: "parking",
    player: { x: car.x - 1, y: car.y, facing: "right" },
  };
}

describe("Study Director world: the FINE mug", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("says everything is fine when asked, by button or F", () => {
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "How are you?" }));
    const outcome = screen.getByTestId("world-outcome");
    expect(outcome.textContent).toMatch(/It says FINE/);
    expect(outcome.textContent).toMatch(/Everything is fine\./);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(screen.getByTestId("world-playfield"), { key: "f" });
    expect(screen.getByTestId("world-outcome").textContent).toMatch(
      /Everything is fine\./
    );
  });
});

describe("Study Director world: closeout", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("ends a world run at the classic report, verdict and share card", async () => {
    globalThis.localStorage.setItem(
      WORLD_SAVE_KEY,
      serializeWorld(lastDayAtTheCar())
    );
    window.history.replaceState(null, "", "/#mode=world");
    render(<StudyDirectorGame />);
    const playfield = await screen.findByTestId("world-playfield");
    fireEvent.keyDown(playfield, { key: "e" });
    fireEvent.click(screen.getByRole("button", { name: "Go home" }));
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "See the closeout" }));
    });
    expect(window.location.hash).toBe("");
    expect(await screen.findByTestId("study-report")).toBeTruthy();
    // The desk's own save slot is left alone.
    expect(globalThis.localStorage.getItem("study_director_save_v1")).toBe(
      null
    );
  });
});
