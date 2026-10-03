import React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";
import {
  SITE_MAPS,
  WORLD_SAVE_KEY,
  parseWorld,
} from "@/lib/study-director-world";

function renderWorld() {
  render(<StudyDirectorWorld onExit={vi.fn()} />);
  return screen.getByTestId("world-playfield");
}

function tick(times: number) {
  for (let i = 0; i < times; i += 1)
    act(() => {
      vi.advanceTimersByTime(120);
    });
}

/** Walks to a directory entry and waits for the walk to finish. */
function walkTo(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
  tick(60);
}

describe("StudyDirectorWorld site visits", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("drives from the car to a site, does a check from the site directory and writes it up", () => {
    const playfield = renderWorld();
    walkTo(/Walk to Your car/);
    fireEvent.keyDown(playfield, { key: "e" });
    const car = screen.getByTestId("world-outcome");
    expect(within(car).getByRole("button", { name: "Go home" })).toBeTruthy();
    fireEvent.click(
      within(car).getByRole("button", { name: /Drive to Site 02, 40 minutes/ })
    );

    expect(
      screen.getByRole("heading", { level: 2, name: /Site 02 visit/ })
    ).toBeTruthy();
    expect(document.activeElement).toBe(playfield);
    const nav = screen.getByRole("navigation", { name: "Site directory" });
    expect(within(nav).getAllByRole("button")).toHaveLength(
      SITE_MAPS["site-02"].rooms.length + SITE_MAPS["site-02"].stations.length
    );
    const visit = screen.getByTestId("site-visit");
    expect(visit.textContent).toMatch(/Priya Lindqvist/);
    expect(visit.textContent).toMatch(/Anxious/);
    expect(visit.textContent).toMatch(/2 things about them/);

    walkTo(/Walk to Source documents/);
    expect(screen.getByTestId("world-room").textContent).toMatch(
      /You are facing the Source documents/
    );
    fireEvent.keyDown(playfield, { key: "e" });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Review source documents, 90 minutes",
      })
    );
    expect(screen.getByTestId("world-outcome").textContent).toMatch(
      /You learned: Meticulous/
    );
    expect(screen.getByTestId("site-visit").textContent).toMatch(
      /Learned: Meticulous/
    );
    const saved = parseWorld(globalThis.localStorage.getItem(WORLD_SAVE_KEY));
    expect(saved?.visit?.checks).toEqual(["sourceReview"]);

    walkTo(/Walk to Your car/);
    fireEvent.keyDown(playfield, { key: "e" });
    fireEvent.click(
      screen.getByRole("button", { name: /Drive back to the office/ })
    );
    const report = screen.getByTestId("site-report");
    expect(report.textContent).toMatch(/Site 02 visit write-up/);
    expect(
      screen.getByRole("heading", { level: 2, name: /The CRO floor/ })
    ).toBeTruthy();
    expect(
      screen.getByRole("navigation", { name: "Office directory" })
    ).toBeTruthy();
    fireEvent.click(
      within(report).getByRole("button", { name: "File the write-up" })
    );
    expect(screen.queryByTestId("site-report")).toBeNull();
  });
});
