import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import {
  render,
  screen,
  within,
  fireEvent,
  cleanup,
} from "@testing-library/react";
import { ConformancePanel } from "@/components/study-data/ConformancePanel";
import { createStudyDataSession } from "@/components/study-data/pipeline-session";
import type { RunSummary } from "@/components/study-data/protocol";

/**
 * The conformance panel rendered from runs the real pipeline session made
 * (#3482): one clean run and one with an injected messy-data scenario. The
 * engine is not mocked.
 */

const STATUS_TEXT: Record<string, string> = {
  pass: "Pass",
  warning: "Warnings",
  failed: "Errors",
};

let clean: RunSummary;
let messy: RunSummary;

beforeAll(async () => {
  const session = createStudyDataSession();
  clean = (await session.handle({
    id: 1,
    type: "run",
    seed: 301,
    nSubjects: 12,
  })) as RunSummary;
  messy = (await session.handle({
    id: 2,
    type: "run",
    seed: 301,
    nSubjects: 12,
    scenario: "impossible-date",
  })) as RunSummary;
}, 60_000);

afterEach(cleanup);

const CORE_IDLE = {
  report: null,
  loading: false,
  failed: false,
  defaults: { seed: 301, nSubjects: 12 },
  twins: {},
};

function renderPanel(
  run: RunSummary,
  overrides: Partial<Parameters<typeof ConformancePanel>[0]> = {}
) {
  const onTrace = vi.fn();
  render(
    <ConformancePanel
      report={run.conformance}
      findings={run.findings}
      onTrace={onTrace}
      core={CORE_IDLE}
      {...overrides}
    />
  );
  return onTrace;
}

function findingsText(total: number, shown: number): string {
  if (total === 0) return "The run raised no findings.";
  return total > shown
    ? `Showing the first ${shown.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} findings. Select one to trace its record.`
    : `${total.toLocaleString("en-US")} findings. Select one to trace its record.`;
}

describe("ConformancePanel", () => {
  it("shows the gate status and findings count of a clean run", () => {
    renderPanel(clean);
    expect(
      screen.getByText(
        STATUS_TEXT[clean.conformance.status] ?? clean.conformance.status
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        findingsText(clean.findings.total, clean.findings.items.length)
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        `Rules ${clean.conformance.rulesVersion} · Terminology ${clean.conformance.terminologyVersion}`
      )
    ).toBeTruthy();
  });

  it("shows the status, the count and a row per finding for a run with findings", () => {
    expect(messy.findings.total).toBeGreaterThan(clean.findings.total);
    renderPanel(messy);
    expect(
      screen.getByText(
        STATUS_TEXT[messy.conformance.status] ?? messy.conformance.status
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        findingsText(messy.findings.total, messy.findings.items.length)
      )
    ).toBeTruthy();
    const grid = screen.getByRole("grid", { name: "Conformance findings" });
    // A header row plus one row per finding shown.
    expect(within(grid).getAllByRole("row")).toHaveLength(
      messy.findings.items.length + 1
    );
  });

  it("lists every rule checked and only the datasets with outcomes", () => {
    renderPanel(messy);
    const rules = screen.getByRole("table", { name: "Rules checked" });
    expect(within(rules).getAllByRole("row")).toHaveLength(
      messy.conformance.ruleResults.length + 1
    );
    const domains = screen.getByRole("table", {
      name: "Rule outcomes by dataset",
    });
    const withOutcomes = messy.conformance.domains.filter(
      (d) => d.pass + d.warning + d.error > 0
    );
    expect(within(domains).getAllByRole("row")).toHaveLength(
      withOutcomes.length + 1
    );
  });

  it("traces a finding to its record when it is selected", () => {
    const finding = messy.findings.items.find(
      (item) => item.dataset !== undefined && item.row !== undefined
    )!;
    const onTrace = renderPanel(messy);
    const grid = screen.getByRole("grid", { name: "Conformance findings" });
    const index = messy.findings.items.indexOf(finding);
    const row = within(grid).getAllByRole("row")[index + 1];
    fireEvent.click(within(row).getAllByRole("gridcell")[0]);
    expect(onTrace).toHaveBeenCalledWith(
      finding.layer,
      finding.dataset,
      finding.row
    );
  });

  it("words the count for no findings and for a sample of more findings", () => {
    renderPanel(clean, {
      findings: { ...clean.findings, total: 0, items: [] },
    });
    expect(screen.getByText("The run raised no findings.")).toBeTruthy();
    expect(screen.queryByRole("grid")).toBeNull();
    cleanup();

    const shown = messy.findings.items.slice(0, 1);
    renderPanel(messy, {
      findings: { ...messy.findings, total: 1200, items: shown },
    });
    expect(
      screen.getByText(
        "Showing the first 1 of 1,200 findings. Select one to trace its record."
      )
    ).toBeTruthy();
  });

  it("names the CDISC CORE rules that also catch a local rule", () => {
    const [first, second] = messy.conformance.ruleResults;
    renderPanel(messy, {
      core: {
        ...CORE_IDLE,
        twins: {
          [first.ruleId]: { coverage: "same-defect", core: ["CORE-000001"] },
          [second.ruleId]: { coverage: "related", core: ["CORE-000002"] },
        },
      },
    });
    expect(
      screen.getAllByText("CDISC CORE also catches this: CORE-000001.").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("CDISC CORE flags a consequence: CORE-000002.").length
    ).toBeGreaterThan(0);
  });
});
