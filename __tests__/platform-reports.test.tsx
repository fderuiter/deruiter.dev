/**
 * @vitest-environment jsdom
 */

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { ReportCatalog } from "@/components/platform/ReportCatalog";
import { ReportView } from "@/components/platform/ReportView";
import {
  DEFAULT_PORTFOLIO_SEED,
  REPORT_PACK,
  SYNTHETIC_DATA_NOTICE,
  buildReport,
  buildWarehouse,
  generatePortfolio,
  reportCatalog,
  type ReportData,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const reports: readonly ReportData[] = REPORT_PACK.map((spec) =>
  buildReport(warehouse, spec)
);

function report(id: string): ReportData {
  return reports.find((item) => item.spec.id === id)!;
}

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
  });
  return result.violations.map((violation) => violation.id);
}

afterEach(cleanup);

describe("ReportView (#2625)", () => {
  it.each(REPORT_PACK.map((spec) => spec.id))(
    "renders %s with zero axe violations",
    async (id) => {
      const { container } = render(
        <main>
          <ReportView report={report(id)} />
        </main>
      );
      expect(await violations(container)).toEqual([]);
    }
  );

  it("renders a chart and the same numbers as a data table", () => {
    const data = report("study-status");
    render(<ReportView report={data} />);
    expect(
      screen.getByRole("group", {
        name: /Bar chart of Subjects screened and Subjects enrolled by study/,
      })
    ).toBeTruthy();
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(data.rows.length + 1);
    const first = within(rows[1]).getAllByRole("cell");
    expect(first.map((cell) => cell.textContent)).toEqual(
      data.rows[0].cells.map((cell) => cell.text)
    );
    expect(within(rows[1]).getByRole("rowheader").textContent).toBe(
      data.rows[0].labels[0]
    );
    expect(screen.getByText(SYNTHETIC_DATA_NOTICE)).toBeTruthy();
  });

  it("draws a table-only report without a chart", () => {
    render(<ReportView report={report("site-performance")} />);
    expect(screen.queryByRole("group", { name: /chart/ })).toBeNull();
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("reads each group's values with the arrow keys", () => {
    const data = report("monthly-portfolio-review");
    render(<ReportView report={data} />);
    const chart = screen.getByRole("group", { name: /Line chart/ });
    fireEvent.keyDown(chart, { key: "Home" });
    const live = chart.querySelector("[aria-live]")!;
    const first = data.rows[0];
    expect(live.textContent).toBe(
      `${first.labels[0]}: Subjects screened ${first.cells[0].text}; Subjects enrolled ${first.cells[1].text}.`
    );
    fireEvent.keyDown(chart, { key: "End" });
    expect(live.textContent).toContain(data.rows.at(-1)!.labels[0]);
    fireEvent.keyDown(chart, { key: "ArrowLeft" });
    expect(live.textContent).toContain(data.rows.at(-2)!.labels[0]);
  });

  it("shows the tier, its sign-off and how each number is calculated", () => {
    const data = report("study-status");
    render(<ReportView report={data} />);
    expect(screen.getByText("Certified", { selector: "span" })).toBeTruthy();
    expect(
      screen.getByText(
        /Signed off by the Clinical Operations Lead on 2026-10-24 for version 1\.0\.0/
      )
    ).toBeTruthy();
    const panel = screen.getByText(
      "How subjects enrolled is calculated"
    ).parentElement!;
    expect(panel.textContent).toContain("subjects_enrolled · version");
    expect(panel.querySelector("code")!.textContent).toBe(
      data.calculations[1].sql
    );
  });

  it("counts one view per report shown", () => {
    const onView = vi.fn();
    const { rerender } = render(
      <ReportView report={report("study-status")} onView={onView} />
    );
    rerender(<ReportView report={report("study-status")} onView={onView} />);
    expect(onView.mock.calls).toEqual([["platform-report-study-status"]]);
    rerender(
      <ReportView report={report("site-performance")} onView={onView} />
    );
    expect(onView.mock.calls.at(-1)).toEqual([
      "platform-report-site-performance",
    ]);
  });
});

describe("ReportCatalog (#2625)", () => {
  const entries = reportCatalog(REPORT_PACK, { lastRefresh: warehouse.asOf });

  it("has zero axe violations", async () => {
    const { container } = render(
      <main>
        <ReportCatalog entries={entries} hrefBase="#" />
      </main>
    );
    expect(await violations(container)).toEqual([]);
  });

  it("filters by words, tier and audience", () => {
    render(<ReportCatalog entries={entries} />);
    const titles = () =>
      screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(titles()).toHaveLength(4);
    fireEvent.click(screen.getByRole("checkbox", { name: "Certified" }));
    expect(titles()).toEqual([
      "Study status report",
      "Monthly portfolio review",
    ]);
    expect(screen.getByText("2 of 4 reports")).toBeTruthy();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search reports" }),
      {
        target: { value: "monthly" },
      }
    );
    expect(titles()).toEqual(["Monthly portfolio review"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Audience" }), {
      target: { value: "Study leadership" },
    });
    expect(screen.queryAllByRole("heading", { level: 3 })).toEqual([]);
    expect(screen.getByText(/No report matches/)).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Certified" }));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search reports" }),
      {
        target: { value: "" },
      }
    );
    expect(titles()).toEqual(["Study status report"]);
  });

  it("says when usage was not recorded", () => {
    render(<ReportCatalog entries={entries} />);
    expect(screen.getAllByText("Not recorded")).toHaveLength(4);
    expect(screen.getAllByText("2026-09-30")).toHaveLength(4);
  });
});
