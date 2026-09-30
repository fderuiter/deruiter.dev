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
  inbox,
  resolveEvent,
} from "@/lib/study-director";
import {
  auditFindings,
  describeChanges,
  diffStates,
  summarizeDays,
} from "@/components/study-director/consequences";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

const fresh = () =>
  beginStudy(
    createStudy(
      "consequences",
      STUDY_24_081,
      STUDY_24_081_SITES,
      STUDY_24_081_TEAM
    )
  );

describe("diffStates", () => {
  it("reports nothing when nothing changed", () => {
    const s = fresh();
    expect(diffStates(s, s)).toEqual([]);
    expect(describeChanges([])).toBe("No visible effect yet.");
  });

  it("lists the meters, money and people a decision moved", () => {
    const s = fresh();
    const event = inbox(s)[0];
    const result = resolveEvent(s, event.id, event.options[0].id, false);
    if (!result.ok) throw new Error("decision failed");
    const changes = diffStates(s, result.state);
    expect(changes.length).toBeGreaterThan(0);
    for (const c of changes) {
      expect(c.delta).not.toBe(0);
      expect(c.good).toBe(
        c.key === "spend" || c.key.startsWith("workload") || c.key === "slip"
          ? c.delta < 0
          : c.delta > 0
      );
    }
  });
});

describe("summarizeDays", () => {
  it("finds lapsed messages and phase changes across days", () => {
    let s = fresh();
    const start = s;
    for (let i = 0; i < 12; i += 1) s = endDay(s);
    const summary = summarizeDays(start, s, inbox(s).length);
    expect(summary.fromDay).toBe(1);
    expect(summary.toDay).toBe(13);
    expect(summary.phaseChange?.from).toBe("protocol");
    expect(summary.lapsed.length).toBeGreaterThan(0);
    expect(summary.lapsed[0].subject.length).toBeGreaterThan(0);
  });
});

describe("auditFindings", () => {
  it("calls a clean site clean and counts problems otherwise", () => {
    const clean = {
      siteId: "s",
      openQueries: 0,
      deviations: 0,
      unsignedSource: 0,
      eligibilityConcerns: 0,
      trainingCurrent: true,
    };
    expect(auditFindings(clean).map((c) => c.text)).toEqual([
      "Clean: nothing hidden",
    ]);
    const messy = {
      ...clean,
      openQueries: 1,
      deviations: 2,
      trainingCurrent: false,
    };
    expect(auditFindings(messy).map((c) => c.text)).toEqual([
      "1 open query",
      "2 deviations",
      "Training behind",
    ]);
  });
});

describe("Study Director outcome strip", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function start() {
    render(<StudyDirectorGame />);
    fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
  }

  it("shows what a decision did and whether it is on file", () => {
    start();
    fireEvent.click(
      screen.getByRole("button", { name: /Sure, we'll add them/ })
    );
    const strip = screen.getByTestId("study-outcome");
    expect(strip.getAttribute("data-outcome")).toBe("decision");
    expect(within(strip).getByText("Not documented")).toBeTruthy();
    expect(within(strip).getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("reports the night between days and can be dismissed", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "End day" }));
    const strip = screen.getByTestId("study-outcome");
    expect(strip.getAttribute("data-outcome")).toBe("overnight");
    expect(within(strip).getByText(/Overnight, day 1 to 2/)).toBeTruthy();
    fireEvent.click(within(strip).getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByTestId("study-outcome")).toBeNull();
  });

  it("summarises an audit's findings", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Audit Site 02" }));
    const strip = screen.getByTestId("study-outcome");
    expect(within(strip).getByText("Audited Site 02")).toBeTruthy();
  });

  it("explains a refused action in the footer", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Audit Site 01" }));
    fireEvent.click(screen.getByRole("button", { name: "Audit Site 02" }));
    const root = document.querySelector(
      '[data-keyboard-boundary="true"]'
    ) as HTMLElement;
    fireEvent.keyDown(root, { key: "2" });
    expect(
      screen.getAllByText(/Not enough attention left today/).length
    ).toBeGreaterThan(1);
  });
});
