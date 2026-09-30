import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  decisionMarks,
  markCounts,
  verdictFor,
} from "@/components/study-director/closeout";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

function idleRun(): FinalReport {
  let s = beginStudy(
    createStudy("closeout", STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM)
  );
  for (let i = 0; i < 200 && s.status === "running"; i += 1) s = endDay(s);
  return finalizeStudy(s);
}

describe("verdictFor", () => {
  it("scores grade, sponsor, margin and schedule into one headline", () => {
    const report = idleRun();
    const best = {
      ...report,
      evaluations: {
        ...report.evaluations,
        sponsor: { ...report.evaluations.sponsor, stars: 5 as const },
        company: { marginPct: 15, timelineVarianceDays: 0 },
        regulatory: { grade: "A" as const, gaps: 0 },
      },
    };
    expect(verdictFor(best).score).toBe(11);
    expect(verdictFor(best).tone).toBe("good");
    const worst = {
      ...best,
      evaluations: {
        ...best.evaluations,
        sponsor: { ...best.evaluations.sponsor, stars: 1 as const },
        company: { marginPct: -30, timelineVarianceDays: 20 },
        regulatory: { grade: "F" as const, gaps: 9 },
      },
    };
    expect(verdictFor(worst).score).toBe(0);
    expect(verdictFor(worst).headline).toBe("Everything is not fine.");
  });
});

describe("decisionMarks", () => {
  it("marks every unanswered message as lapsed in an idle run", () => {
    const report = idleRun();
    const counts = markCounts(decisionMarks(report.state));
    expect(counts.lapsed).toBeGreaterThan(0);
    expect(counts.documented + counts.undocumented + counts.audit).toBe(0);
  });
});

describe("Study Director briefing and closeout", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens on a dossier with the team, sites and five rules", () => {
    render(<StudyDirectorGame />);
    expect(
      screen.getByRole("region", { name: "Protocol cover sheet" })
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "Your team" })).toBeTruthy();
    expect(screen.getByText("The dashboard is hearsay")).toBeTruthy();
    expect(
      screen.getByRole("img", { name: /Complexity: 4 of 5/ })
    ).toBeTruthy();
  });

  it("closes with a verdict, a grade stamp and the decision timeline", () => {
    render(<StudyDirectorGame />);
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
    const root = document.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    for (let i = 0; i < 150 && !screen.queryByTestId("study-report"); i += 1) {
      fireEvent.keyDown(root, { key: "e" });
    }
    expect(screen.getByRole("region", { name: "Verdict" })).toBeTruthy();
    expect(
      screen.getByRole("img", { name: /Inspection readiness grade [A-F]/ })
    ).toBeTruthy();
    expect(screen.getByTestId("study-decision-timeline")).toBeTruthy();
    expect(screen.getByText(/Run seed/)).toBeTruthy();
  });
});
