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
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";
import {
  CRO_FLOOR,
  WORLD_SAVE_KEY,
  parseWorld,
} from "@/lib/study-director-world";

function renderWorld() {
  const onExit = vi.fn();
  render(<StudyDirectorWorld onExit={onExit} />);
  return { onExit, playfield: screen.getByTestId("world-playfield") };
}

/** Opens the collapsed directory, if it is not open already. */
function openDirectory() {
  const toggle = screen
    .getAllByRole("button", { name: /directory/i })
    .find((b) => b.getAttribute("aria-expanded") === "false");
  if (toggle) fireEvent.click(toggle);
}

describe("StudyDirectorWorld", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("shows day, clock, energy, focus, budget, timeline and enrollment only", () => {
    renderWorld();
    const hud = screen.getByTestId("world-hud");
    for (const label of [
      "Day",
      "Clock",
      "Energy",
      "Focus",
      "Budget",
      "Timeline",
      "Enrollment",
    ])
      expect(within(hud).getByText(label)).toBeTruthy();
    expect(hud.textContent).toMatch(/1 · Monday/);
    expect(hud.textContent).toMatch(/AM/);
    expect(hud.textContent).not.toMatch(/Integrity|Compliance|Team/);
    expect(within(hud).getAllByRole("meter")).toHaveLength(2);
  });

  it("lists every room, person and station in the directory", () => {
    renderWorld();
    openDirectory();
    const nav = screen.getByRole("navigation", { name: "Office directory" });
    const buttons = within(nav)
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-expanded") === null);
    expect(buttons).toHaveLength(
      CRO_FLOOR.rooms.length + 6 + CRO_FLOOR.stations.length
    );
    expect(
      within(nav).getByRole("button", { name: /Walk to Coffee machine/ })
    ).toBeTruthy();
    expect(
      within(nav).getByRole("button", { name: /Walk to Maya/ })
    ).toBeTruthy();
    expect(
      within(nav).getByRole("button", { name: /Walk to Data Management/ })
    ).toBeTruthy();
  });

  it("describes the current room on the canvas and in text", () => {
    renderWorld();
    const canvas = screen.getByRole("img", { name: /^The lobby/ });
    expect(canvas.tagName).toBe("CANVAS");
    expect(screen.getByTestId("world-room").textContent).toMatch(/^The lobby/);
  });

  it("walks with the arrow keys and WASD, and saves the position", () => {
    const { playfield } = renderWorld();
    fireEvent.keyDown(playfield, { key: "ArrowUp" });
    fireEvent.keyDown(playfield, { key: "w" });
    fireEvent.keyDown(playfield, { key: "W" });
    fireEvent.keyDown(playfield, { key: "ArrowUp" });
    expect(screen.getByTestId("world-room").textContent).toMatch(
      /^The corridor/
    );
    const saved = parseWorld(globalThis.localStorage.getItem(WORLD_SAVE_KEY));
    expect(saved?.player.y).toBe(CRO_FLOOR.spawn.y - 4);
    expect(saved?.minute).toBe(8 * 60 + 1);
  });

  it("walks to the coffee machine from the directory and drinks at E", () => {
    vi.useFakeTimers();
    const { playfield } = renderWorld();
    openDirectory();
    fireEvent.click(
      screen.getByRole("button", { name: /Walk to Coffee machine/ })
    );
    for (let i = 0; i < 25; i += 1)
      act(() => {
        vi.advanceTimersByTime(120);
      });
    expect(screen.getByTestId("world-room").textContent).toMatch(
      /You are facing the Coffee machine/
    );
    expect(document.activeElement).toBe(playfield);
    fireEvent.keyDown(playfield, { key: "e" });
    const outcome = screen.getByTestId("world-outcome");
    expect(outcome.textContent).toMatch(/Cup 1 today/);
  });

  it("offers to go home at the car and starts the next morning", () => {
    vi.useFakeTimers();
    const { playfield } = renderWorld();
    openDirectory();
    fireEvent.click(screen.getByRole("button", { name: /Walk to Your car/ }));
    for (let i = 0; i < 40; i += 1)
      act(() => {
        vi.advanceTimersByTime(120);
      });
    fireEvent.keyDown(playfield, { key: "E" });
    fireEvent.click(screen.getByRole("button", { name: "Go home" }));
    expect(screen.getByText(/Overnight, day 1/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Drive in for day 2/ }));
    expect(screen.getByTestId("world-hud").textContent).toMatch(/2 · Tuesday/);
  });
});

describe("Study Director world entry points", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState(null, "", "/");
  });

  it("opens the world from the briefing and returns to the desk", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
    render(<StudyDirectorGame />);
    expect(screen.getByTestId("study-briefing")).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Walk the office" }));
    });
    expect(window.location.hash).toBe("#mode=world");
    expect(await screen.findByTestId("world-hud")).toBeTruthy();
    act(() => {
      fireEvent.click(
        screen.getAllByRole("button", { name: "Switch to the classic desk" })[0]
      );
    });
    expect(window.location.hash).toBe("");
    expect(screen.getByTestId("study-briefing")).toBeTruthy();
  });
});
