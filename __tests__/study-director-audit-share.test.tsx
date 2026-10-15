// Study Director 10/10 audit, fourth pass: a shared link opens the study it
// names, the career counts office runs, and trophies unlock the way their
// text says (#2191).
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import { type DecisionRecord, type StudyState } from "@/lib/study-director";
import {
  WORLD_SAVE_KEY,
  newWorld,
  serializeWorld,
  startDay,
} from "@/lib/study-director-world";
import { ARCADE_TROPHIES, getArcadeProgress } from "@/lib/arcade-achievements";
import {
  CAREER_KEY,
  KICKOFF_DAY,
  cleanFile,
  emptyCareer,
  parseCareer,
} from "@/components/study-director/career";
import { seedLink } from "@/components/study-director/ShareCard";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

const ORIGIN = "https://deruiter.dev";

beforeEach(() => {
  globalThis.localStorage?.clear?.();
  globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("Study Director audit: the share link (#2191)", () => {
  it("names the office and its length for an office run", () => {
    expect(
      seedLink("sdw-1", ORIGIN, "calm", { office: true, length: "short" })
    ).toBe(
      `${ORIGIN}/arcade/study-director#mode=world&seed=sdw-1&length=short&difficulty=calm`
    );
    expect(seedLink("sd-2", ORIGIN, undefined, { office: false })).toBe(
      `${ORIGIN}/arcade/study-director#mode=desk&seed=sd-2`
    );
  });

  it("opens the shared study in the office", async () => {
    window.history.replaceState(
      null,
      "",
      "/#mode=world&seed=shared-2191&length=short&difficulty=rescue"
    );
    render(<StudyDirectorGame />);
    await screen.findByTestId("world-playfield");
    const saved = JSON.parse(
      globalThis.localStorage.getItem(WORLD_SAVE_KEY) ?? "{}"
    );
    const text = JSON.stringify(saved);
    expect(text).toContain("shared-2191");
    expect(text).toContain("rescue");
    // The seed is used once, so a reload resumes the saved run.
    expect(window.location.hash).toBe("#mode=world");
  });

  it("says so when a study in progress holds the link", async () => {
    const own = startDay(newWorld("mine-2191", "standard")).world;
    const touched = {
      ...own,
      minute: own.minute + 30,
      study: { ...own.study, day: 4 },
    };
    globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(touched));
    window.history.replaceState(null, "", "/#mode=world&seed=other-2191");
    render(<StudyDirectorGame />);
    const notice = await screen.findByTestId("world-shared-ignored");
    expect(notice.textContent).toMatch(/study in progress/);
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByTestId("world-shared-ignored")).toBeNull();
  });
});

describe("Study Director audit: the career file (#2191)", () => {
  it("keeps the length and the office on a filed run", () => {
    const career = emptyCareer();
    const parsed = parseCareer({
      ...career,
      history: [
        {
          seed: "sdw-1",
          grade: "B",
          stars: 3,
          profile: "operator",
          headline: "Fine.",
          length: "short",
          office: true,
        },
      ],
    });
    expect(parsed?.history[0]).toMatchObject({
      length: "short",
      office: true,
    });
  });

  it("counts a started office run", async () => {
    const own = startDay(newWorld("count-2191", "standard")).world;
    globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(own));
    window.history.replaceState(null, "", "/#mode=world");
    render(<StudyDirectorGame />);
    const playfield = await screen.findByTestId("world-playfield");
    const ring = screen.queryByRole("button", { name: "Let it ring" });
    if (ring) fireEvent.click(ring);
    fireEvent.keyDown(playfield, { key: "ArrowDown" });
    fireEvent.keyDown(playfield, { key: "ArrowUp" });
    const career = JSON.parse(
      globalThis.localStorage.getItem(CAREER_KEY) ?? "{}"
    );
    expect(career.started).toBe(1);
  });
});

describe("Study Director audit: trophies unlock as described (#2191)", () => {
  const trophy = (id: string) => ARCADE_TROPHIES.find((t) => t.id === id);

  it("ties Study Kickoff to day 15 and FDA Replay Approved to a clean file", () => {
    expect(trophy("study_director_kickoff")).toMatchObject({
      milestone: "first_weeks",
    });
    expect(trophy("study_director_kickoff")?.targetScore).toBeUndefined();
    expect(trophy("study_director_closeout")).toMatchObject({
      milestone: "clean_file",
    });
    expect(trophy("study_director_closeout")?.targetScore).toBeUndefined();
  });

  it("unlocks Study Kickoff three weeks into an office study", async () => {
    const own = startDay(newWorld("kick-2191", "standard")).world;
    const late = { ...own, study: { ...own.study, day: KICKOFF_DAY } };
    globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(late));
    window.history.replaceState(null, "", "/#mode=world");
    render(<StudyDirectorGame />);
    await screen.findByTestId("world-playfield");
    expect(
      getArcadeProgress().unlockedTrophies.study_director_kickoff
    ).toBeTruthy();
  });

  it("calls a file clean only when every decision is written up", () => {
    const record = (r: Partial<DecisionRecord>) =>
      fromPartial<DecisionRecord>({ optionId: "a", documented: true, ...r });
    const state = (log: DecisionRecord[]) => fromPartial<StudyState>({ log });
    expect(cleanFile(state([record({}), record({})]))).toBe(true);
    expect(cleanFile(state([record({}), record({ documented: false })]))).toBe(
      false
    );
    expect(
      cleanFile(state([record({}), record({ optionId: "ignored" })]))
    ).toBe(false);
    expect(cleanFile(state([]))).toBe(false);
  });
});
