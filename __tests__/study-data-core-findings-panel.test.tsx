/**
 * The Study Data page's CDISC CORE section (#2992): CORE's recorded findings
 * for a run that matches a recorded view, and a plain note for any other.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  coreViewReport,
  loadRecordedCoreFindings,
} from "@/lib/study-data";
import { CoreFindingsPanel } from "@/components/study-data/CoreFindingsPanel";

const defaults = { seed: DEFAULT_SEED, nSubjects: DEFAULT_SUBJECT_COUNT };

afterEach(cleanup);

describe("CDISC CORE findings panel", () => {
  it("lists the default run's findings with the reason each is accepted", async () => {
    const report = coreViewReport(await loadRecordedCoreFindings(), "default");
    render(
      <CoreFindingsPanel
        report={report}
        loading={false}
        failed={false}
        defaults={defaults}
      />
    );
    const rows = within(screen.getByRole("table")).getAllByRole("row");
    expect(rows).toHaveLength(report.findings.length + 1);
    const first = report.findings[0];
    expect(
      screen.getAllByRole("rowheader", {
        name: new RegExp(`^${first.coreId}`),
      }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Not yet explained")).toBeNull();
    expect(
      screen.getByText(new RegExp(`Of ${report.ruleCount} SDTMIG rules`))
    ).toBeTruthy();
    expect(
      screen.getByText(/nothing here runs CORE in your browser/)
    ).toBeTruthy();
  });

  it("puts what an injected issue adds first", async () => {
    const report = coreViewReport(
      await loadRecordedCoreFindings(),
      "impossible-date"
    );
    render(
      <CoreFindingsPanel
        report={report}
        loading={false}
        failed={false}
        defaults={defaults}
      />
    );
    const firstRow = within(screen.getByRole("table")).getAllByRole("row")[1];
    expect(
      within(firstRow).getByText("Raised by the injected issue")
    ).toBeTruthy();
    expect(screen.getByText(/The injected issue adds 1 finding/)).toBeTruthy();
  });

  it("says when CORE never saw the run, is loading, or failed to load", () => {
    const { rerender } = render(
      <CoreFindingsPanel
        report={null}
        loading={false}
        failed={false}
        defaults={defaults}
      />
    );
    expect(
      screen.getByText(/only the local rules above checked it/)
    ).toBeTruthy();
    rerender(
      <CoreFindingsPanel
        report={null}
        loading
        failed={false}
        defaults={defaults}
      />
    );
    expect(screen.getByRole("status").textContent).toMatch(/Loading/);
    rerender(
      <CoreFindingsPanel
        report={null}
        loading={false}
        failed
        defaults={defaults}
      />
    );
    expect(screen.getByRole("status").textContent).toMatch(
      /could not be loaded/
    );
  });
});
