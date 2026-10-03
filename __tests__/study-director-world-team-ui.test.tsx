import React from "react";
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
  WORLD_SAVE_KEY,
  newWorld,
  parseWorld,
  phoneCalls,
  serializeWorld,
  startDay,
  type PlayerState,
  type WorldState,
} from "@/lib/study-director-world";

function saved(patch: Partial<WorldState> = {}): WorldState {
  const world = {
    ...startDay(newWorld("ui-team", "standard")).world,
    ...patch,
  };
  globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(world));
  return world;
}

function renderAt(player: PlayerState, patch: Partial<WorldState> = {}) {
  const world = saved({ player, location: "office", ...patch });
  render(<StudyDirectorWorld onExit={vi.fn()} />);
  return { world, playfield: screen.getByTestId("world-playfield") };
}

const current = () =>
  parseWorld(globalThis.localStorage.getItem(WORLD_SAVE_KEY));

describe("Study Director world: team, phone and desk", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("talks to the person you face, with a relationship card and delegation", () => {
    // Maya sits at (9, 3); stand to her left, facing her.
    const { playfield, world } = renderAt({ x: 8, y: 3, facing: "right" });
    expect(screen.getByTestId("world-people-here").textContent).toMatch(
      /Maya is at the desk/
    );
    fireEvent.keyDown(playfield, { key: "e" });
    const dialog = screen.getByRole("dialog", { name: "Maya" });
    const card = within(dialog).getByTestId("relationship-card");
    expect(card.textContent).toMatch(/Trust/);
    expect(card.textContent).not.toMatch(/\d+%/);
    expect(current()?.minute).toBe(world.minute + 10);
    fireEvent.click(within(dialog).getByRole("button", { name: /Coach/ }));
    expect(dialog.textContent).toMatch(/sits up straighter/);
    expect(current()?.minute).toBe(world.minute + 55);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("rings the phone when its time comes; answering turns options into choices", () => {
    const base = startDay(newWorld("ui-team", "standard")).world;
    const [call] = phoneCalls(base);
    renderAt(
      { x: 20, y: 8, facing: "left" },
      { minute: call.ringAt, location: "corridor" }
    );
    const phone = screen.getByRole("alertdialog", {
      name: "The phone is ringing",
    });
    expect(phone.textContent).toMatch(/Arcadia Therapeutics/);
    fireEvent.click(within(phone).getByRole("button", { name: "Answer" }));
    const dialog = screen.getByRole("dialog", {
      name: /Arcadia Therapeutics: Exploratory biomarkers/,
    });
    fireEvent.keyDown(dialog, { key: "2" });
    expect(dialog.textContent).toMatch(/Decided: Add them after an impact/);
    expect(current()?.study.log.at(-1)?.optionId).toBe("assess");
    expect(current()?.minute).toBe(call.ringAt + 10);
  });

  it("returns a call from the desk and writes the decision up there", () => {
    const { playfield, world } = renderAt({ x: 4, y: 3, facing: "up" });
    fireEvent.keyDown(playfield, { key: "e" });
    const desk = screen.getByRole("dialog", { name: "Your desk" });
    fireEvent.click(
      within(desk).getByRole("button", { name: /Call: Arcadia/ })
    );
    const dialog = screen.getByRole("dialog", { name: /Exploratory/ });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Decline: not in this/ })
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Write it up now/ })
    );
    expect(
      screen.getByRole("dialog", { name: "Your desk" }).textContent
    ).toMatch(/Written up and filed: Exploratory biomarkers/);
    const after = current();
    expect(after?.study.log.at(-1)?.documented).toBe(true);
    expect(after?.minute).toBe(world.minute + 30);
  });

  it("shows the EDC dashboard beside what you have seen", () => {
    const { playfield } = renderAt({ x: 4, y: 5, facing: "up" });
    fireEvent.keyDown(playfield, { key: "e" });
    const edc = screen.getByRole("dialog", { name: "EDC workstation" });
    expect(
      within(edc).getByRole("columnheader", { name: "You have seen" })
    ).toBeTruthy();
    expect(within(edc).getAllByText("Nothing yet").length).toBeGreaterThan(0);
  });

  it("holds a meeting in the conference room with the people present", () => {
    renderAt({ x: 15, y: 10, facing: "down" }, { location: "conference" });
    const room = screen.getByTestId("world-meeting");
    fireEvent.click(within(room).getByRole("checkbox", { name: "Lee" }));
    fireEvent.click(within(room).getByRole("button", { name: /Team meeting/ }));
    expect(screen.getByTestId("world-meeting").textContent).toMatch(
      /At the table: Lee/
    );
    fireEvent.click(screen.getByRole("button", { name: "End the meeting" }));
    const report = screen.getByRole("dialog", { name: "Meeting over" });
    expect(report.textContent).toMatch(/90 person-minutes/);
  });
});
