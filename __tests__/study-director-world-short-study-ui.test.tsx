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
import { SharePanel } from "@/components/study-director/ShareCard";
import {
  WORLD_SAVE_KEY,
  newWorld,
  parseWorld,
  serializeWorld,
  startDay,
} from "@/lib/study-director-world";
import {
  beginStudy,
  createStudy,
  endDay,
  finalizeStudy,
  studyPreset,
  type StudyLength,
} from "@/lib/study-director";

const INTRO_KEY = "study_director_world_intro_seen";

function savedWorld() {
  return parseWorld(globalThis.localStorage.getItem(WORLD_SAVE_KEY));
}

function finished(length: StudyLength) {
  const preset = studyPreset(length);
  let s = beginStudy(
    createStudy(`card-${length}`, preset.setup, preset.sites, preset.team)
  );
  for (let i = 0; i < 200 && s.status === "running"; i += 1) s = endDay(s);
  return finalizeStudy(s);
}

beforeEach(() => {
  globalThis.localStorage?.clear?.();
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("office: choosing the study length", () => {
  it("offers Short and Full in the first-run intro, next to the difficulty", () => {
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    const intro = screen.getByTestId("world-intro");
    const lengths = within(intro).getByTestId("sd-intro-length-picker");
    expect(
      within(lengths).getByRole("radio", { name: /Full study/ })
    ).toHaveProperty("checked", true);
    fireEvent.click(within(intro).getByRole("radio", { name: /Rescue study/ }));
    fireEvent.click(
      within(lengths).getByRole("radio", { name: /Short study/ })
    );
    // A short rescue starts proportionally fewer days behind.
    expect(within(intro).getByText(/Three days behind/)).toBeTruthy();
    fireEvent.click(
      within(intro).getByRole("button", { name: "Start the day" })
    );
    const saved = savedWorld();
    expect(saved?.study.setup.length).toBe("short");
    expect(saved?.study.setup.durationDays).toBe(35);
    expect(saved?.study.difficulty).toBe("rescue");
  });

  it("offers it beside the floor until the run is touched", () => {
    globalThis.localStorage.setItem(INTRO_KEY, "1");
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    const conditions = screen.getByTestId("world-conditions");
    const seed = savedWorld()?.study.seed;
    fireEvent.click(
      within(conditions).getByRole("radio", { name: /Short study/ })
    );
    expect(savedWorld()?.study.seed).toBe(seed);
    expect(savedWorld()?.study.setup.length).toBe("short");
    expect(
      screen
        .getAllByRole("status")
        .some((s) => s.textContent === "Short study chosen.")
    ).toBe(true);
    fireEvent.click(
      within(screen.getByTestId("world-conditions")).getByRole("radio", {
        name: /Calm protocol/,
      })
    );
    // Changing the difficulty keeps the length.
    expect(savedWorld()?.study.setup.length).toBe("short");
    expect(savedWorld()?.study.difficulty).toBe("calm");
  });
});

describe("office: delegating the day", () => {
  it("asks first, then hands the day to the team and reports what it cost", () => {
    globalThis.localStorage.setItem(INTRO_KEY, "1");
    globalThis.localStorage.setItem(
      WORLD_SAVE_KEY,
      serializeWorld(startDay(newWorld("ui-del", "standard", "short")).world)
    );
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    const box = screen.getByTestId("world-delegate");
    fireEvent.click(
      within(box).getByRole("button", { name: "Delegate the day" })
    );
    expect(box.textContent).toMatch(/trusts you a little less/);
    fireEvent.click(within(box).getByRole("button", { name: "Keep working" }));
    expect(savedWorld()?.location).not.toBe("home");

    fireEvent.click(
      within(box).getByRole("button", { name: "Delegate the day" })
    );
    fireEvent.click(
      within(box).getByRole("button", { name: "Hand the day to the team" })
    );
    const report = screen.getByTestId("world-overnight");
    expect(
      within(report).getByText("What the team did with your day")
    ).toBeTruthy();
    expect(report.textContent).toMatch(/trust -3 with everyone/);
    expect(screen.queryByTestId("world-delegate")).toBeNull();
    expect(savedWorld()?.location).toBe("home");
    expect(savedWorld()?.study.day).toBe(2);

    fireEvent.click(screen.getByRole("button", { name: /Drive in for day 2/ }));
    expect(screen.getByTestId("world-delegate")).toBeTruthy();
  });

  it("gives the delegate buttons touch-sized targets", () => {
    globalThis.localStorage.setItem(INTRO_KEY, "1");
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    const open = within(screen.getByTestId("world-delegate")).getByRole(
      "button",
      { name: "Delegate the day" }
    );
    expect(open.className).toMatch(/min-h-11/);
  });
});

describe("share card: study length", () => {
  it("names the length of the study", () => {
    const { unmount } = render(
      <SharePanel report={finished("short")} news={null} office />
    );
    expect(screen.getByTestId("share-card-length").textContent).toBe(
      "Short study · 35 planned days"
    );
    unmount();
    render(<SharePanel report={finished("full")} news={null} office />);
    expect(screen.getByTestId("share-card-length").textContent).toBe(
      "Full study · 77 planned days"
    );
  });
});
