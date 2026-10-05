import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";

const INTRO_KEY = "study_director_world_intro_seen";
const MODE_KEY = "study_director_mode";

function reset() {
  globalThis.localStorage?.clear?.();
  globalThis.localStorage?.setItem?.(INTRO_KEY, "1");
  window.history.replaceState(null, "", "/");
}

describe("Study Director opens in the office (#1817)", () => {
  beforeEach(() => {
    reset();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("opens the walkable office first when the page asks for it", async () => {
    render(<StudyDirectorGame officeFirst />);
    expect(await screen.findByTestId("world-hud")).toBeTruthy();
    expect(screen.queryByTestId("study-briefing")).toBeNull();
    expect(screen.queryByText(/^Preview$/)).toBeNull();
  });

  it("keeps the classic desk as the default for the bare component", () => {
    render(<StudyDirectorGame />);
    expect(screen.getByTestId("study-briefing")).toBeTruthy();
  });

  it("lets a link choose the desk, and an old world link still works", async () => {
    window.history.replaceState(null, "", "/#mode=desk");
    render(<StudyDirectorGame officeFirst />);
    expect(screen.getByTestId("study-briefing")).toBeTruthy();
    act(() => {
      window.location.hash = "mode=world";
    });
    expect(await screen.findByTestId("world-hud")).toBeTruthy();
  });

  it("remembers the last choice and offers the office from the desk", async () => {
    render(<StudyDirectorGame officeFirst />);
    await screen.findByTestId("world-hud");
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: "Switch to the classic desk" })
      );
    });
    expect(globalThis.localStorage.getItem(MODE_KEY)).toBe("desk");
    expect(screen.getByTestId("study-briefing")).toBeTruthy();
    cleanup();
    render(<StudyDirectorGame officeFirst />);
    expect(screen.getByTestId("study-briefing")).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Walk the office" }));
    });
    expect(globalThis.localStorage.getItem(MODE_KEY)).toBe("world");
    expect(await screen.findByTestId("world-hud")).toBeTruthy();
  });
});

describe("Study Director first-run help (#1819)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    window.history.replaceState(null, "", "/#mode=world");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("shows the controls once, closes with Escape, and can be reopened", async () => {
    render(<StudyDirectorGame officeFirst />);
    const dialog = await screen.findByRole("dialog", {
      name: /Welcome to the CRO floor/,
    });
    expect(dialog.textContent).toMatch(/W A S D/);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(globalThis.localStorage.getItem(INTRO_KEY)).toBe("1");
    cleanup();
    render(<StudyDirectorGame officeFirst />);
    await screen.findByTestId("world-hud");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Controls" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("shows a first-day goal that clears after the first action", async () => {
    globalThis.localStorage.setItem(INTRO_KEY, "1");
    render(<StudyDirectorGame officeFirst />);
    const goal = await screen.findByTestId("world-goal");
    expect(goal.textContent).toMatch(/EDC workstation/);
  });
});

describe("Study Director discovery copy (#1818)", () => {
  it("describes the walkable office, not only the attention budget", () => {
    const card = ARCADE_GAMES_METADATA.find((g) => g.id === "study-director");
    expect(card?.description).toMatch(/Walk the floor/);
    expect(card?.description).not.toMatch(/five attention points/i);
    for (const file of [
      "components/arcade/ArcadeHubClient.tsx",
      "components/CommandPalette.tsx",
      "components/arcade/StudyDirectorClient.tsx",
    ]) {
      const text = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(text, file).not.toMatch(/five attention points a day/i);
    }
  });

  it("opens the page in the office", () => {
    const client = readFileSync(
      path.resolve(process.cwd(), "components/arcade/StudyDirectorClient.tsx"),
      "utf8"
    );
    expect(client).toMatch(/<StudyDirectorGame officeFirst \/>/);
  });
});
