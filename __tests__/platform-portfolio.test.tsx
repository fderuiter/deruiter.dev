/**
 * @vitest-environment jsdom
 */

import React from "react";
import {
  act,
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
import { operationsHash } from "@/components/platform/operations/OperationsView";
import { createPortfolioClient } from "@/components/platform/portfolio/portfolio-client";
import type { PortfolioResponse } from "@/components/platform/portfolio/protocol";
import {
  DEFAULT_PORTFOLIO_SEED,
  buildWarehouse,
  generatePortfolio,
  portfolioDashboard,
  portfolioForecast,
  type EnrollmentWhatIf,
  type PortfolioForecast,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const dashboard = portfolioDashboard(warehouse);

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
      "$46,506,401",
      "$69,977,656",
      "$2,856,406",
    ]);
    expect(within(section()).getByText("Forecast overrun")).toBeTruthy();
    expect(section().textContent).toContain(
      "The forecast is 104.3% of the budget at completion. Forecast to overrun: DEMO-302, by $4,628,681 (115.4% of budget). Vendors forecast to overrun across their studies: Quillfeather Clinical Research, by $4,935,420 (129.4% of budget)."
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

describe("the enrollment forecast and its what-if (#2913)", () => {
  const card = (studyId: string) =>
    screen
      .getByRole("heading", { level: 3, name: new RegExp(`^${studyId} `) })
      .closest("article")!;
  /** Answers a what-if the way the worker does, from the same warehouse. */
  const answer = (studyId: string, whatIf: EnrollmentWhatIf) =>
    Promise.resolve(portfolioForecast(warehouse, studyId, whatIf));
  const ask = (
    studyId: string,
    fields: { country?: string; sites?: string; days?: string } = {}
  ) => {
    const form = within(card(studyId));
    if (fields.country !== undefined) {
      fireEvent.change(form.getByLabelText("Country"), {
        target: { value: fields.country },
      });
    }
    if (fields.sites !== undefined) {
      fireEvent.change(form.getByLabelText(/^Sites to add/), {
        target: { value: fields.sites },
      });
    }
    if (fields.days !== undefined) {
      fireEvent.change(form.getByLabelText(/^Days until they recruit/), {
        target: { value: fields.days },
      });
    }
    fireEvent.click(form.getByRole("button", { name: "Run the what-if" }));
  };

  it("forecasts each study still enrolling, with the plan in words", () => {
    view();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "When the last subject is in",
      })
    ).toBeTruthy();
    const late = within(card("DEMO-302"));
    expect(late.getAllByRole("definition").map((d) => d.textContent)).toEqual([
      "Planned date passed",
      "2027-09-25",
      "2027-08-23 to 2027-11-01",
    ]);
    expect(card("DEMO-302").textContent).toContain(
      "350 of 600 subjects are enrolled. The planned last subject in, 2026-06-14, passed before the data cut, so no run can meet it"
    );
    expect(
      within(card("DEV-402")).getAllByRole("definition")[0].textContent
    ).toBe("0.2%");
    expect(card("DEV-402").textContent).toContain(
      "279 of 350 subjects are enrolled. 4 of 2,000 simulated runs enroll the last subject by the planned 2026-12-13."
    );
    // Without a way to ask the worker, the baseline is shown alone.
    expect(
      screen.queryByRole("button", { name: "Run the what-if" })
    ).toBeNull();
  });

  it("shows the assumptions and the runs with every forecast", () => {
    view();
    for (const studyId of ["DEMO-302", "DEV-402"]) {
      const text = card(studyId).textContent;
      expect(text).toContain(
        "Sites still in start-up at the data cut are left out"
      );
      expect(text).toContain(
        "2,000 simulated runs from seed 2632, so the same inputs always give the same forecast."
      );
    }
  });

  it("tabulates the weekly curve the chart draws", () => {
    view();
    const forecast = dashboard.forecasts[1].forecast;
    const table = within(card("DEV-402")).getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(forecast.curve.length);
    expect(
      rows.map((row) => within(row).getByRole("rowheader").textContent)
    ).toEqual(forecast.curve.map((point) => point.on));
    expect(within(rows[rows.length - 1]).getByRole("cell").textContent).toBe(
      `${Math.round(forecast.curve[forecast.curve.length - 1].completed * 100)}%`
    );
  });

  it("reads each week of the curve aloud from the keyboard", () => {
    view();
    const chart = within(card("DEV-402")).getByRole("group", {
      name: /Use the arrow keys to read each week/,
    });
    fireEvent.keyDown(chart, { key: "Home" });
    const live = chart.querySelector("[aria-live]")!;
    expect(live.textContent).toBe("2026-09-30: 0% of runs complete.");
    fireEvent.keyDown(chart, { key: "End" });
    const last = dashboard.forecasts[1].forecast.curve.at(-1)!;
    expect(live.textContent).toBe(
      `${last.on}: ${Math.round(last.completed * 100)}% of runs complete.`
    );
  });

  it("runs a what-if in the worker and compares it with the baseline", async () => {
    const onWhatIf = vi.fn(answer);
    render(
      <main>
        <PortfolioView dashboard={dashboard} onWhatIf={onWhatIf} />
      </main>
    );
    ask("DEMO-302", { country: "DE", sites: "5", days: "90" });
    expect(onWhatIf).toHaveBeenCalledWith("DEMO-302", {
      countryCode: "DE",
      sites: 5,
      activationDelayDays: 90,
    });
    const expected = portfolioForecast(warehouse, "DEMO-302", {
      countryCode: "DE",
      sites: 5,
      activationDelayDays: 90,
    });
    expect(
      await within(card("DEMO-302")).findByRole("heading", {
        level: 4,
        name: "With 5 sites in Germany from day 90",
      })
    ).toBeTruthy();
    expect(card("DEMO-302").textContent).toContain(
      `With 5 sites in Germany from day 90, the median moves from 2027-09-25 to ${expected.forecast.quantiles.p50},`
    );
    expect(
      within(within(card("DEMO-302")).getByRole("table")).getByRole(
        "columnheader",
        { name: "With the what-if" }
      )
    ).toBeTruthy();
    // The other study keeps its baseline.
    expect(card("DEV-402").textContent).toContain(
      "Add sites below to see how much sooner"
    );
    expect(await violations(screen.getByRole("main"))).toEqual([]);
  });

  it("reads the weeks after a shorter curve ends as all, or at least, its last share", async () => {
    render(<PortfolioView dashboard={dashboard} onWhatIf={answer} />);
    ask("DEMO-302", { country: "DE", sites: "20", days: "90" });
    await within(card("DEMO-302")).findByRole("heading", {
      level: 4,
      name: "With 20 sites in Germany from day 90",
    });
    const shorter = portfolioForecast(warehouse, "DEMO-302", {
      countryCode: "DE",
      sites: 20,
      activationDelayDays: 90,
    }).forecast.curve;
    const baseline = dashboard.forecasts[0].forecast.curve;
    expect(shorter.length).toBeLessThan(baseline.length);
    const end = shorter[shorter.length - 1].completed;
    const after = end >= 1 ? "100%" : `${Math.floor(end * 100)}% or more`;
    const rows = within(
      within(card("DEMO-302")).getByRole("table")
    ).getAllByRole("row");
    expect(rows).toHaveLength(baseline.length + 1);
    const cells = (row: number) =>
      within(rows[row])
        .getAllByRole("cell")
        .map((cell) => cell.textContent);
    expect(cells(shorter.length)[1]).toBe(`${Math.round(end * 100)}%`);
    expect(cells(shorter.length + 1)[1]).toBe(after);
    expect(cells(baseline.length)[1]).toBe(after);
    expect(after).not.toBe("100% or more");
  });

  it("checks the what-if before it asks", () => {
    const onWhatIf = vi.fn(answer);
    render(<PortfolioView dashboard={dashboard} onWhatIf={onWhatIf} />);
    ask("DEV-402", { sites: "0", days: "400" });
    expect(onWhatIf).not.toHaveBeenCalled();
    const form = within(card("DEV-402"));
    const sites = form.getByLabelText(/^Sites to add/);
    expect(sites.getAttribute("aria-invalid")).toBe("true");
    expect(
      form.getByText("Enter a whole number of sites from 1 to 50.")
    ).toBeTruthy();
    expect(
      form.getByText("Enter a whole number of days from 0 to 365.")
    ).toBeTruthy();
    ask("DEV-402", { sites: "2.5", days: "30" });
    expect(onWhatIf).not.toHaveBeenCalled();
    ask("DEV-402", { sites: "2", days: "30" });
    expect(onWhatIf).toHaveBeenCalledTimes(1);
    expect(sites.getAttribute("aria-invalid")).toBe("false");
  });

  it("never lets a stale answer replace a newer one", async () => {
    const answers: ((value: PortfolioForecast) => void)[] = [];
    const onWhatIf = vi.fn(
      () =>
        new Promise<PortfolioForecast>((resolve) => {
          answers.push(resolve);
        })
    );
    render(<PortfolioView dashboard={dashboard} onWhatIf={onWhatIf} />);
    ask("DEV-402", { country: "US", sites: "3" });
    ask("DEV-402", { country: "US", sites: "10" });
    const ten = portfolioForecast(warehouse, "DEV-402", {
      countryCode: "US",
      sites: 10,
      activationDelayDays: 90,
    });
    answers[1](ten);
    expect(
      await within(card("DEV-402")).findByRole("heading", {
        level: 4,
        name: "With 10 sites in United States from day 90",
      })
    ).toBeTruthy();
    // The first answer arrives last and is dropped.
    await act(async () => {
      answers[0](
        portfolioForecast(warehouse, "DEV-402", {
          countryCode: "US",
          sites: 3,
          activationDelayDays: 90,
        })
      );
    });
    expect(
      within(card("DEV-402")).queryByRole("heading", {
        level: 4,
        name: "With 3 sites in United States from day 90",
      })
    ).toBeNull();

    // Back to the baseline drops an answer still on its way, too.
    ask("DEV-402", { sites: "4" });
    fireEvent.click(
      within(card("DEV-402")).getByRole("button", {
        name: "Back to the baseline",
      })
    );
    await act(async () => {
      answers[2](ten);
    });
    expect(
      within(card("DEV-402")).queryByRole("heading", {
        level: 4,
        name: /^With /,
      })
    ).toBeNull();
  });

  it("says what failed when the worker cannot answer", async () => {
    render(
      <PortfolioView
        dashboard={dashboard}
        onWhatIf={() => Promise.reject(new Error("worker gone"))}
      />
    );
    ask("DEV-402");
    expect(
      (await within(card("DEV-402")).findByRole("alert")).textContent
    ).toBe("The what-if could not be run: worker gone");
  });

  it("says so when no study is enrolling", () => {
    render(<PortfolioView dashboard={{ ...dashboard, forecasts: [] }} />);
    expect(
      screen.getByText("No study is enrolling at the data cut.")
    ).toBeTruthy();
  });
});

describe("the risk heatmap (#2914)", () => {
  const region = () => screen.getByRole("region", { name: "Risk heatmap" });
  const cell = (studyId: string, column: number) => {
    const row = within(region())
      .getByRole("rowheader", { name: studyId })
      .closest("tr")!;
    return within(row).getAllByRole("link")[column];
  };

  it("rates every study on schedule, budget and quality in words", () => {
    view();
    const table = within(region()).getByRole("table");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent)
    ).toEqual(["Study", "Schedule", "Budget", "Quality"]);
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((h) => h.textContent)
    ).toEqual(dashboard.risk.rows.map((r) => r.studyId));
    const label = { green: "On track", amber: "Watch", red: "At risk" };
    for (const row of dashboard.risk.rows) {
      const cells = [row.schedule, row.budget, row.quality];
      cells.forEach((rated, column) => {
        const link = cell(row.studyId, column);
        expect(link.textContent, `${row.studyId} ${column}`).toContain(
          label[rated.rating]
        );
        // The reason travels with the link, for a screen reader and on hover.
        expect(link.textContent).toContain(rated.reason);
        expect(link.getAttribute("title")).toBe(rated.reason);
      });
    }
  });

  it("links each rating to the evidence behind it", () => {
    const { container } = view();
    const target = (href: string) =>
      container.querySelector(`[id="${href.slice(1)}"]`);
    // Still enrolling: the study's forecast card.
    const late = cell("DEMO-302", 0).getAttribute("href")!;
    expect(late).toBe("#forecast-DEMO-302");
    expect(target(late)?.tagName).toBe("ARTICLE");
    // Enrollment over: the milestones.
    const done = cell("DEMO-101", 0).getAttribute("href")!;
    expect(done).toBe("#portfolio-milestones");
    expect(target(done)).not.toBeNull();
    const money = cell("DEMO-302", 1).getAttribute("href")!;
    expect(money).toBe("#portfolio-finance");
    expect(target(money)).not.toBeNull();
    // The study's Risk tab, at the address the operations dashboard uses.
    expect(cell("DEMO-203", 2).getAttribute("href")).toBe(
      `/platform/operations${operationsHash({ study: "DEMO-203" }, "risk")}`
    );
  });

  it("lists what needs attention, at risk first, with each reason", () => {
    view();
    const list = screen.getByRole("heading", { name: "What needs attention" })
      .nextElementSibling as HTMLElement;
    const items = within(list)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(items.map((text) => text!.split(":")[0])).toEqual([
      "▲DEMO-203 quality, at risk",
      "▲DEMO-302 schedule, at risk",
      "▲DEMO-302 budget, at risk",
      "▲DEV-402 schedule, at risk",
      "◆DEMO-302 quality, watch",
    ]);
    const quality = dashboard.risk.rows.find(
      (r) => r.studyId === "DEMO-302"
    )!.quality;
    expect(items[4]).toContain(quality.reason);
    expect(
      within(list)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual([
      "See the risk assessment",
      "See the enrollment forecast",
      "See budget at completion",
      "See the enrollment forecast",
      "See the risk assessment",
    ]);
  });

  it("says so when every study is on track", () => {
    const green = (row: (typeof dashboard.risk.rows)[number]) => ({
      ...row,
      schedule: { ...row.schedule, rating: "green" as const },
      budget: { ...row.budget, rating: "green" as const },
      quality: { ...row.quality, rating: "green" as const },
    });
    render(
      <PortfolioView
        dashboard={{
          ...dashboard,
          risk: { ...dashboard.risk, rows: dashboard.risk.rows.map(green) },
        }}
      />
    );
    expect(
      screen.getByText("Every study is on track on every dimension.")
    ).toBeTruthy();
  });

  it("states each column's rule and why", () => {
    view();
    const rules = screen
      .getByText("How each column is rated")
      .closest("details")!;
    for (const rule of dashboard.risk.rules) {
      const heading = within(rules).getByRole("heading", { name: rule.name });
      const block = heading.parentElement!;
      expect(block.textContent).toContain(rule.green);
      expect(block.textContent).toContain(rule.amber);
      expect(block.textContent).toContain(rule.red);
      expect(block.textContent).toContain(`Why: ${rule.reason}`);
    }
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
    // Each what-if form has its own status line too (#2913).
    expect(
      screen.getAllByRole("status").map((status) => status.textContent)
    ).toContain("Showing the portfolio dashboard.");
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

  it("sends a what-if to the worker as a forecast request (#2913)", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createPortfolioClient();
    const whatIf = { countryCode: "DE", sites: 5, activationDelayDays: 90 };
    const answer = client.forecast("DEMO-302", whatIf);
    const worker = FakeWorker.last!;
    expect(worker.posted).toEqual([
      { id: 1, type: "forecast", studyId: "DEMO-302", whatIf },
    ]);
    const result = portfolioForecast(warehouse, "DEMO-302", whatIf);
    worker.onmessage!({
      data: { id: 1, ok: true, result },
    } as MessageEvent<PortfolioResponse>);
    await expect(answer).resolves.toBe(result);
    client.dispose();
  });

  it("answers a what-if on the main thread only where Workers are missing (#2913)", async () => {
    vi.stubGlobal("Worker", undefined);
    const client = createPortfolioClient();
    const whatIf = { countryCode: "US", sites: 2, activationDelayDays: 0 };
    await expect(client.forecast("DEV-402", whatIf)).resolves.toEqual(
      portfolioForecast(warehouse, "DEV-402", whatIf)
    );
    client.dispose();
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
