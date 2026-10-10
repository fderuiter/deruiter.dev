import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  beginStudy,
  createStudy,
  endDay,
  finalizeStudy,
  type FinalReport,
} from "@/lib/study-director";
import {
  CAREER_KEY,
  PROFILES,
  emptyCareer,
  importCareer,
  loadCareer,
  mergeCareers,
  parseCareer,
  recordRun,
  recordStart,
} from "@/components/study-director/career";
import { SharePanel, seedLink } from "@/components/study-director/ShareCard";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

function finished(seed: string): FinalReport {
  let s = beginStudy(
    createStudy(seed, STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM)
  );
  for (let i = 0; i < 200 && s.status === "running"; i += 1) s = endDay(s);
  return finalizeStudy(s);
}

function withGrade(
  report: FinalReport,
  grade: "A" | "B" | "C" | "D" | "F",
  stars: 1 | 2 | 3 | 4 | 5
): FinalReport {
  return {
    ...report,
    evaluations: {
      ...report.evaluations,
      regulatory: { grade, gaps: 0 },
      sponsor: { ...report.evaluations.sponsor, stars },
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("career file", () => {
  it("records a finished study once, however often it is filed", () => {
    const report = finished("career-a");
    const first = recordRun(recordStart(emptyCareer()), report, "Fine.");
    expect(first.career.started).toBe(1);
    expect(first.career.finished).toBe(1);
    expect(first.career.titles[report.profile.profile]?.count).toBe(1);
    expect(first.news.newTitle).toBe(true);
    const again = recordRun(first.career, report, "Fine.");
    expect(again.career).toBe(first.career);
    expect(again.news).toEqual({
      newTitle: false,
      newBestGrade: false,
      newBestStars: false,
    });
  });

  it("keeps the best grade and stars and flags a new best", () => {
    const base = finished("career-b");
    const { career } = recordRun(emptyCareer(), withGrade(base, "C", 2), "x");
    const better = recordRun(
      career,
      withGrade(finished("career-c"), "A", 4),
      "y"
    );
    expect(better.career.bestGrade).toBe("A");
    expect(better.career.bestStars).toBe(4);
    expect(better.news.newBestGrade).toBe(true);
    const worse = recordRun(
      better.career,
      withGrade(finished("career-d"), "D", 1),
      "z"
    );
    expect(worse.career.bestGrade).toBe("A");
    expect(worse.news.newBestGrade).toBe(false);
    expect(worse.career.history.map((r) => r.seed)).toEqual([
      "career-d",
      "career-c",
      "career-b",
    ]);
  });

  it("rejects files that are not a version 1 career and cleans bad fields", () => {
    expect(parseCareer(null)).toBeNull();
    expect(parseCareer({ version: 2 })).toBeNull();
    expect(importCareer("{not json")).toBeNull();
    const cleaned = parseCareer({
      version: 1,
      started: -3,
      finished: "lots",
      bestGrade: "Z",
      bestStars: 99,
      titles: { scientist: { title: "The Scientist", count: 2 }, hacker: {} },
      history: [{ seed: 1 }, "x"],
    });
    expect(cleaned).toEqual({
      version: 1,
      started: 0,
      finished: 0,
      bestGrade: null,
      bestStars: 5,
      titles: { scientist: { title: "The Scientist", count: 2 } },
      history: [],
    });
  });

  it("falls back to an empty career when storage holds garbage", () => {
    window.localStorage.setItem(CAREER_KEY, "{oops");
    expect(loadCareer()).toEqual(emptyCareer());
  });

  it("merges two careers, keeping the best of each", () => {
    const a = recordRun(
      emptyCareer(),
      withGrade(finished("m-a"), "B", 3),
      "a"
    ).career;
    const b = recordRun(
      { ...emptyCareer(), started: 9 },
      withGrade(finished("m-b"), "A", 2),
      "b"
    ).career;
    const merged = mergeCareers(a, b);
    expect(merged.started).toBe(9);
    expect(merged.bestGrade).toBe("A");
    expect(merged.bestStars).toBe(3);
    expect(merged.history.map((r) => r.seed).sort()).toEqual(["m-a", "m-b"]);
    expect(mergeCareers(merged, merged).history).toHaveLength(2);
  });

  it("builds a replay link from the seed", () => {
    expect(seedLink("sd-abc", "https://deruiter.dev")).toBe(
      "https://deruiter.dev/arcade/study-director#seed=sd-abc"
    );
  });
});

describe("saving on the desk", () => {
  it("shows the personnel file with every title redacted at first", () => {
    render(<StudyDirectorGame />);
    const file = screen.getByTestId("study-personnel-file");
    expect(
      within(file).getByText(`Titles earned, 0 of ${PROFILES.length}`)
    ).toBeTruthy();
    expect(within(file).getAllByText("Not yet earned")).toHaveLength(
      PROFILES.length
    );
  });

  it("says it saved, and abandons only after a confirm", () => {
    render(<StudyDirectorGame />);
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
    expect(screen.getByTestId("study-save-note").textContent).toBe(
      "Saved, day 1"
    );
    fireEvent.click(screen.getByRole("button", { name: "Abandon study" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep going" }));
    expect(screen.queryByTestId("study-briefing")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abandon study" }));
    fireEvent.click(screen.getByRole("button", { name: "Abandon" }));
    expect(screen.getByTestId("study-briefing")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Resume day/ })).toBeNull();
  });

  it("starts a shared seed, files the finished study and offers the card", () => {
    window.history.replaceState(null, "", "/#seed=shared-seed-1");
    render(<StudyDirectorGame />);
    expect(screen.getByText("shared-seed-1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
    expect(window.location.hash).toBe("");
    const root = document.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    for (let i = 0; i < 150 && !screen.queryByTestId("study-report"); i += 1) {
      fireEvent.keyDown(root, { key: "e" });
    }
    expect(screen.getByTestId("study-share")).toBeTruthy();
    expect(screen.getByText("New title for your personnel file")).toBeTruthy();
    const career = loadCareer();
    expect(career.started).toBe(1);
    expect(career.finished).toBe(1);
    expect(career.history[0].seed).toBe("shared-seed-1");
  });
});

describe("Study Director share card: office runs", () => {
  afterEach(cleanup);

  it("names an office run on the card and says where the link goes", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const { container } = render(
      <SharePanel report={finished("office-1")} news={null} office />
    );
    expect(container.textContent).toMatch(/office run · seed office-1/);
    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));
    expect(
      await screen.findByText(/same seed at the classic desk/)
    ).toBeTruthy();
  });

  it("leaves desk runs without the office tag", () => {
    const { container } = render(
      <SharePanel report={finished("desk-1")} news={null} />
    );
    expect(container.textContent).not.toMatch(/office run/);
  });
});
