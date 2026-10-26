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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axe from "axe-core";
import { PortfolioDashboard } from "@/components/platform/portfolio/PortfolioDashboard";
import { PortfolioView } from "@/components/platform/portfolio/PortfolioView";
import { createPortfolioClient } from "@/components/platform/portfolio/portfolio-client";
import type { PortfolioResponse } from "@/components/platform/portfolio/protocol";
import {
  DEFAULT_PORTFOLIO_SEED,
  buildWarehouse,
  generatePortfolio,
  portfolioDashboard,
} from "@/lib/clinical-platform";

const dashboard = portfolioDashboard(
  buildWarehouse(generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED }))
);

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
  });
  return result.violations.map((violation) => violation.id);
}

function view() {
  return render(
    <main>
      <PortfolioView dashboard={dashboard} />
    </main>
  );
}

// jsdom cannot compute pseudo-element styles and reports every attempt as
// "Not implemented". axe asks for them, so answer with the element's own
// style, which is all jsdom can give anyway.
beforeEach(() => {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    computed(element)
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("PortfolioView (#2911)", () => {
  it("has no WCAG A or AA violations", async () => {
    const { container } = view();
    expect(await violations(container)).toEqual([]);
  });

  it("tabulates every study's milestones with how each stands", () => {
    view();
    const table = screen.getByRole("table", {
      name: /^Milestones by study, planned against actual/,
    });
    const rows = within(table).getAllByRole("row");
    // A header row and one row per study.
    expect(rows).toHaveLength(9);
    const demo302 = within(table).getByRole("rowheader", {
      name: /DEMO-302/,
    }).parentElement!;
    expect(demo302.textContent).toContain("2026-06-14");
    expect(demo302.textContent).toContain("108 days overdue");
    expect(demo302.textContent).toContain("Last patient in");
    const dev402 = within(table).getByRole("rowheader", {
      name: /DEV-402/,
    }).parentElement!;
    // A device study's own milestone names stand beside the conformed ones.
    expect(dev402.textContent).toContain("IDE approval");
    expect(dev402.textContent).toContain("1 day early");
  });

  it("counts the slips in words", () => {
    view();
    expect(
      screen.getByText(
        /17 milestones reached late and 1 overdue across 8 studies\./
      )
    ).toBeTruthy();
  });

  it("reads each milestone aloud from the keyboard", () => {
    view();
    const chart = screen.getByRole("group", { name: /^Milestone swimlane/ });
    // The first arrow lands on the first study's first milestone.
    fireEvent.keyDown(chart, { key: "ArrowDown" });
    const live = chart.querySelector('[aria-live="polite"]')!;
    expect(live.textContent).toBe(
      "DEMO-101, Protocol final: reached 2025-01-06, planned 2025-01-06. On plan."
    );
    fireEvent.keyDown(chart, { key: "End" });
    expect(live.textContent).toBe(
      "DEMO-101, Clinical study report final: reached 2026-03-22, planned 2026-03-20. 2 days late."
    );
    for (let i = 0; i < 5; i += 1)
      fireEvent.keyDown(chart, { key: "ArrowDown" });
    fireEvent.keyDown(chart, { key: "Home" });
    for (let i = 0; i < 5; i += 1) {
      fireEvent.keyDown(chart, { key: "ArrowRight" });
    }
    expect(live.textContent).toBe(
      "DEMO-302, Last patient in: planned 2026-06-14. 108 days overdue."
    );
  });

  it("summarises each cycle time and says whether its furthest study is an outlier", () => {
    view();
    const start = screen
      .getByRole("heading", {
        level: 3,
        name: "Protocol final to first subject in",
      })
      .closest("li")!;
    expect(start.textContent).toContain("103.5");
    expect(start.textContent).toContain("90.0 to 135.8");
    expect(start.textContent).toContain(
      "Furthest from the median: DEMO-302, at 185 days, 81.5 days slower than the median."
    );
    expect(start.textContent).toContain("no study is an outlier by that rule");
    // Each comparison has its governed report, with a data table.
    for (const title of [
      "Protocol final to first subject in by study",
      "First subject in to last subject in by study",
      "Last subject last visit to database lock by study",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name: title })
      ).toBeTruthy();
    }
  });
});

describe("the outlier sentence (#2911)", () => {
  const [start] = dashboard.benchmarks;
  const sentence = (benchmark: typeof start) => {
    render(
      <main>
        <PortfolioView dashboard={{ ...dashboard, benchmarks: [benchmark] }} />
      </main>
    );
    return screen
      .getByRole("heading", { level: 3, name: start.report.columns[0].name })
      .closest("li")!.textContent;
  };

  it("names a study beyond the other fence when the furthest is within its own", () => {
    // In a skewed spread the lower fence can sit nearer the median than
    // the study furthest above it.
    expect(sentence({ ...start, beyondFences: ["DEMO-101"] })).toContain(
      "That is within Tukey's fences, 1.5 interquartile ranges past the quartiles, but DEMO-101 lies beyond them."
    );
  });

  it("calls the furthest study an outlier when it is beyond its fence", () => {
    expect(
      sentence({
        ...start,
        outlier: { ...start.outlier!, beyondFence: true },
        beyondFences: ["DEMO-302", "DEMO-203"],
      })
    ).toContain("so it is an outlier by that rule, as DEMO-203 is.");
  });
});

describe("budget against forecast at completion (#2912)", () => {
  const section = () =>
    screen
      .getByRole("heading", {
        level: 2,
        name: "Budget against forecast at completion",
      })
      .closest("section")!;

  it("totals the portfolio and names the study and vendor forecast to overrun", () => {
    view();
    const figures = within(section()).getAllByRole("definition");
    expect(figures.map((f) => f.textContent)).toEqual([
      "$67,121,250",
      "$46,465,932",
      "$69,930,442",
      "$2,809,192",
    ]);
    expect(within(section()).getByText("Forecast overrun")).toBeTruthy();
    expect(section().textContent).toContain(
      "The forecast is 104.2% of the budget at completion. Forecast to overrun: DEMO-302, by $4,628,681 (115.4% of budget). Vendors forecast to overrun across their studies: Quillfeather Clinical Research, by $4,935,420 (129.4% of budget)."
    );
  });

  it("follows the totals with the four governed finance reports", () => {
    view();
    for (const title of [
      "Budget, actual and forecast at completion by study",
      "Budget, actual and forecast at completion by vendor",
      "Variance at completion and cost per enrolled subject by study",
      "Variance at completion by vendor",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name: title })
      ).toBeTruthy();
    }
  });

  it("says so when nobody is forecast to overrun, and calls an underrun one", () => {
    render(
      <main>
        <PortfolioView
          dashboard={{
            ...dashboard,
            finance: {
              ...dashboard.finance,
              varianceAtCompletion: -1000,
              varianceAtCompletionText: "-$1,000",
              studyOverruns: [],
              vendorOverruns: [],
            },
          }}
        />
      </main>
    );
    expect(within(section()).getByText("Forecast underrun")).toBeTruthy();
    expect(within(section()).getByText("$1,000")).toBeTruthy();
    expect(section().textContent).toContain(
      "No study is forecast to overrun its budget. No vendor is forecast to overrun across its studies."
    );
  });
});

describe("PortfolioDashboard (#2911)", () => {
  it("shows a placeholder, then the dashboard computed off the page", async () => {
    render(<PortfolioDashboard />);
    expect(screen.getByTestId("portfolio-loading")).toBeTruthy();
    expect(
      await screen.findByRole(
        "heading",
        { level: 2, name: "Milestones across the portfolio" },
        { timeout: 20_000 }
      )
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "Showing the portfolio dashboard."
    );
  });
});

describe("createPortfolioClient (#2911)", () => {
  class FakeWorker {
    static last: FakeWorker | null = null;
    onmessage: ((message: MessageEvent<PortfolioResponse>) => void) | null =
      null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    posted: unknown[] = [];
    terminated = false;
    constructor(readonly url: URL) {
      FakeWorker.last = this;
    }
    postMessage(message: unknown) {
      this.posted.push(message);
    }
    terminate() {
      this.terminated = true;
    }
  }

  it("asks the worker, never the main thread, where Workers exist", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createPortfolioClient();
    const answer = client.dashboard();
    const worker = FakeWorker.last!;
    expect(String(worker.url)).toMatch(/portfolio\.worker\.ts/);
    expect(worker.posted).toEqual([{ id: 1, type: "dashboard" }]);
    worker.onmessage!({
      data: { id: 1, ok: true, result: dashboard },
    } as MessageEvent<PortfolioResponse>);
    await expect(answer).resolves.toBe(dashboard);
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it("rejects what the worker could not answer", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createPortfolioClient();
    const answer = client.dashboard();
    FakeWorker.last!.onmessage!({
      data: { id: 1, ok: false, error: "no warehouse" },
    } as MessageEvent<PortfolioResponse>);
    await expect(answer).rejects.toThrow("no warehouse");
    const pending = client.dashboard();
    client.dispose();
    await expect(pending).rejects.toThrow("The dashboard was closed.");
  });
});
