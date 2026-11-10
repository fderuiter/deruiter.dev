// @vitest-environment jsdom
/**
 * The study summary card on /study-data (#3159): every field renders from
 * fixed input, and its counts are the ones the stage rail shows.
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  coreSummaryStatus,
  StudySummaryCard,
  type CoreSummaryStatus,
} from "@/components/study-data/StudySummaryCard";
import { StageRail } from "@/components/study-data/StageRail";
import type { StageCounts } from "@/components/study-data/protocol";

afterEach(cleanup);

const COUNTS: StageCounts = {
  collected: { records: 9_120, datasets: 9, subjects: 330 },
  sdtm: { records: 12_345, datasets: 14 },
  conformance: { checks: 80, pass: 78, warning: 2, error: 0, findings: 3 },
  adam: { records: 4_567, datasets: 5 },
  define: { datasets: 19, variables: 310, codelists: 40, methods: 12 },
  tlf: { tables: 6, figures: 1, results: 140 },
};

const VERSIONS = { package: "1.0", rules: "1.9.1" };

function card(core: CoreSummaryStatus = "passed", counts = COUNTS) {
  render(
    <StudySummaryCard
      studyId="DEMO-301"
      counts={counts}
      versions={VERSIONS}
      core={core}
    />
  );
  return screen.getByRole("region", { name: "Study summary" });
}

/** The value and detail lines under a card term. */
function field(region: HTMLElement, term: string): string[] {
  const dt = within(region).getByText(term, { selector: "dt" });
  return Array.from(dt.parentElement!.querySelectorAll("dd")).map(
    (dd) => dd.textContent ?? ""
  );
}

describe("StudySummaryCard (#3159)", () => {
  it("shows the study id and the synthetic data label", () => {
    const region = card();
    expect(within(region).getByText("DEMO-301")).toBeTruthy();
    expect(within(region).getByText("Synthetic data")).toBeTruthy();
  });

  it("counts datasets and tables and figures, with the split", () => {
    const region = card();
    expect(field(region, "Datasets")).toEqual([
      "19 datasets",
      "14 SDTM · 5 ADaM",
    ]);
    expect(field(region, "Tables and figures")).toEqual([
      "7 TLFs",
      "6 tables · 1 figure",
    ]);
  });

  it("shows the package format and local rules versions", () => {
    expect(field(card(), "Versions")).toEqual([
      "Package format 1.0",
      "Local rules 1.9.1",
    ]);
  });

  it.each([
    ["passed", "Passed: no issues reported"],
    ["flagged", "Flagged: issues reported"],
    ["loading", "Recorded; loading"],
    ["unavailable", "Recorded; could not load"],
    ["not-run", "Not run for this run"],
  ] as const)("states CORE status %s in words", (status, text) => {
    expect(field(card(status), "CDISC CORE")).toEqual([text]);
  });

  it("waits for the run before showing counts", () => {
    render(
      <StudySummaryCard
        studyId="DEMO-301"
        counts={null}
        versions={VERSIONS}
        core="not-run"
      />
    );
    const region = screen.getByRole("region", { name: "Study summary" });
    expect(field(region, "Datasets")).toEqual(["—", "waiting for the run"]);
  });

  it("matches the counts the stage rail shows for the same run", () => {
    render(
      <StageRail
        definition={{ arms: 2, visits: 9, activities: 20, scheduled: 120 }}
        counts={COUNTS}
        onOpen={vi.fn()}
      />
    );
    const rail = screen.getByRole("list", { name: "Pipeline stages" });
    expect(rail.textContent).toContain("14 datasets");
    expect(rail.textContent).toContain("5 datasets");
    expect(rail.textContent).toContain("6 tables · 1 figure");
    cleanup();
    const region = card();
    expect(field(region, "Datasets")[1]).toBe("14 SDTM · 5 ADaM");
    expect(field(region, "Tables and figures")[1]).toBe("6 tables · 1 figure");
  });
});

describe("coreSummaryStatus (#3159)", () => {
  it("is not run when CORE has no view of the run", () => {
    expect(coreSummaryStatus(false, null, false)).toBe("not-run");
    expect(coreSummaryStatus(false, 3, true)).toBe("not-run");
  });

  it("is loading, then unavailable if the recorded findings fail to load", () => {
    expect(coreSummaryStatus(true, null, false)).toBe("loading");
    expect(coreSummaryStatus(true, null, true)).toBe("unavailable");
  });

  it("is flagged when any rule reported an issue, otherwise passed", () => {
    expect(coreSummaryStatus(true, 2, false)).toBe("flagged");
    expect(coreSummaryStatus(true, 0, false)).toBe("passed");
  });
});
