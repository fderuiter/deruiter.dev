import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { Finding, RunDiff } from "@/lib/study-data";
import { RunDiffPanel } from "@/components/study-data/RunDiffPanel";

afterEach(cleanup);

const finding = (row?: number, dataset?: string): Finding => ({
  ruleId: "SD1001",
  severity: "warning",
  layer: "sdtm",
  ...(dataset ? { dataset } : {}),
  ...(row === undefined ? {} : { row }),
  message: "The visit is outside its window.",
});

describe("RunDiffPanel (#3160)", () => {
  it("says so when nothing changed", () => {
    render(
      <RunDiffPanel diff={{ findings: [], rowCounts: [], tlfValues: [] }} />
    );
    expect(screen.getByText("No change from the last run.")).toBeTruthy();
  });

  it("lists each kind of change", () => {
    const diff: RunDiff = {
      findings: [
        { change: "added", finding: finding(6, "SV") },
        { change: "removed", finding: finding() },
      ],
      rowCounts: [
        { layer: "sdtm", dataset: "SV", before: 40, after: 38 },
        { layer: "adam", dataset: "ADVS", before: null, after: 1200 },
      ],
      tlfValues: [],
    };
    render(<RunDiffPanel diff={diff} />);
    const panel = screen.getByTestId("run-diff-panel").textContent ?? "";
    expect(panel).toContain("Added SD1001 · SV · row 7");
    expect(panel).toContain("Removed SD1001");
    expect(panel).toContain("SV (SDTM): 40 → 38");
    expect(panel).toContain("ADVS (ADAM): absent → 1,200");
    expect(screen.getByText("Table values (0)")).toBeTruthy();
    expect(screen.getByText("No change.")).toBeTruthy();
  });

  it("counts the changes past the first twenty", () => {
    const diff: RunDiff = {
      findings: [],
      rowCounts: [],
      tlfValues: Array.from({ length: 23 }, (_, index) => ({
        table: "14.1.1",
        location: `Row ${index}`,
        before: index === 0 ? null : "1",
        after: index === 1 ? null : "2",
      })),
    };
    render(<RunDiffPanel diff={diff} />);
    expect(screen.getByText("And 3 more.")).toBeTruthy();
    const panel = screen.getByTestId("run-diff-panel").textContent ?? "";
    expect(panel).toContain("Table 14.1.1 · Row 0: absent → 2");
    expect(panel).toContain("Table 14.1.1 · Row 1: 1 → absent");
  });
});
