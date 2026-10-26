/**
 * @vitest-environment jsdom
 */

import React, { useMemo, useState } from "react";
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
import { Explorer } from "@/components/platform/explore/Explorer";
import {
  ExplorerView,
  type HistoryMode,
} from "@/components/platform/explore/ExplorerView";
import { createExploreClient } from "@/components/platform/explore/explore-client";
import type { ExploreResponse } from "@/components/platform/explore/protocol";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_DIMENSIONS,
  buildWarehouse,
  checkExploration,
  encodeExploration,
  explorationChoices,
  explorationCsv,
  explorerMetrics,
  generatePortfolio,
  normalizeExploration,
  promotionSteps,
  runExploration,
  startExploration,
  type Exploration,
  type MetricDimensionId,
} from "@/lib/clinical-platform";

/**
 * The /platform/explore self-service explorer (#2634): it offers only what
 * the semantic layer allows, and every result is `runExploration`'s.
 */

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const run = (exploration: Exploration) =>
  runExploration(warehouse, exploration);
const metrics = explorerMetrics();
const START: Exploration = {
  metricId: "subjects_screened",
  dimensions: ["study"],
  filters: [],
  visual: null,
};
const screened = metrics.find((m) => m.id === START.metricId)!;
const label = (id: MetricDimensionId) =>
  METRIC_DIMENSIONS.find((d) => d.id === id)!.label;

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
  });
  return result.violations.map((violation) => violation.id);
}

/** The view over a live exploration, run synchronously, with each change logged. */
function Harness({
  initial,
  log = [],
  seen = [],
}: {
  initial: Exploration;
  log?: HistoryMode[];
  seen?: Exploration[];
}) {
  const [exploration, setExploration] = useState(initial);
  const result = useMemo(() => run(exploration), [exploration]);
  return (
    <main>
      <ExplorerView
        exploration={exploration}
        result={result}
        busy={false}
        error={null}
        linkError={null}
        hash={encodeExploration(exploration)}
        onChange={(next, mode) => {
          log.push(mode);
          seen.push(next);
          setExploration(normalizeExploration(next));
        }}
      />
    </main>
  );
}

const reportHeading = () =>
  screen
    .getAllByRole("heading", { level: 2 })
    .map((h) => h.textContent)
    .find((text) => text !== "Build an exploration" && !/^Promote/.test(text!));

/** The data table's rows as text, without the header row. */
function tableText() {
  const region = screen.getByRole("region", { name: / data$/ });
  return [...region.querySelectorAll("tbody tr")].map((row) =>
    [...row.querySelectorAll("th, td")].map((cell) => cell.textContent)
  );
}

const expectedText = (exploration: Exploration) =>
  run(exploration).report.rows.map((row) => [
    ...row.labels,
    ...row.cells.map((cell) => cell.text),
  ]);

function selectOptions(name: string | RegExp) {
  return within(screen.getByRole("combobox", { name }))
    .getAllByRole("option")
    .filter((option) => !(option as HTMLOptionElement).disabled)
    .map((option) => option.textContent);
}

// jsdom cannot compute pseudo-element styles and reports every attempt as
// "Not implemented". axe asks for them, so answer with the element's own
// style, which is all jsdom can give anyway.
beforeEach(() => {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    computed(element)
  );
  window.history.replaceState(null, "", "/platform/explore");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ExplorerView (#2634)", () => {
  it("draws the result with the metric's definition, version, tier and SQL", async () => {
    const { container } = render(<Harness initial={START} />);
    const result = run(START);
    expect(reportHeading()).toBe("Subjects screened by study");
    expect(screen.getByText("Exploratory")).toBeTruthy();
    const calc = result.report.calculations[0];
    const panel = screen
      .getByText(`How “${screened.name}” is calculated`)
      .closest("details")!;
    expect(panel.textContent).toContain(calc.description);
    expect(panel.textContent).toContain(`version ${calc.version}`);
    expect(
      within(panel).getByLabelText(`DuckDB SQL for ${calc.name}`).textContent
    ).toBe(calc.sql);
    expect(tableText()).toEqual(expectedText(START));
    expect(await violations(container)).toEqual([]);
  });

  it("offers only what the semantic layer allows, for every metric", () => {
    for (const metric of metrics) {
      const exploration = startExploration(metric.id);
      const choices = explorationChoices(exploration);
      render(<Harness initial={exploration} />);
      if (choices.addDimensions.length > 0) {
        expect(selectOptions("Add a dimension"), metric.id).toEqual(
          choices.addDimensions.map(label)
        );
      }
      expect(selectOptions("Add a filter"), metric.id).toEqual(
        choices.filterDimensions.map(label)
      );
      expect(
        within(screen.getByRole("group", { name: "Visual" }))
          .getAllByRole("radio")
          .map((radio) =>
            radio.closest("label")!.textContent!.replace(/\(suggested\)$/, "")
          ),
        metric.id
      ).toEqual(
        choices.visuals.map(
          (v) =>
            ({
              stat: "Number",
              bar: "Bar chart",
              line: "Line chart",
              table: "Table",
            })[v]
        )
      );
      cleanup();
    }
  });

  it("keeps the grouping and filters when the new metric allows them, as a step Back undoes", () => {
    const filtered: Exploration = {
      ...START,
      filters: [{ dimension: "study", operator: "in", values: ["DEMO-101"] }],
    };
    const next = metrics.find(
      (m) =>
        m.id !== START.metricId &&
        checkExploration({ ...filtered, metricId: m.id }).length === 0
    )!;
    const log: HistoryMode[] = [];
    render(<Harness initial={filtered} log={log} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Metric" }), {
      target: { value: next.id },
    });
    expect(log).toEqual(["push"]);
    expect(reportHeading()).toBe(`${next.name} by study`);
    expect(
      (screen.getByRole("checkbox", { name: "DEMO-101" }) as HTMLInputElement)
        .checked
    ).toBe(true);
  });

  it("starts a metric afresh when it cannot keep the grouping", () => {
    const byMonth: Exploration = { ...START, dimensions: ["month"] };
    const next = metrics.find(
      (m) =>
        checkExploration({ ...byMonth, metricId: m.id }).length > 0 &&
        checkExploration({ ...startExploration(m.id), filters: [] }).length ===
          0
    )!;
    render(<Harness initial={byMonth} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Metric" }), {
      target: { value: next.id },
    });
    expect(reportHeading()).toBe(run(startExploration(next.id)).spec.title);
  });

  it("groups by a second dimension and ungroups, editing the current step", () => {
    const log: HistoryMode[] = [];
    render(<Harness initial={START} log={log} />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Add a dimension" }),
      {
        target: { value: "month" },
      }
    );
    expect(reportHeading()).toBe("Subjects screened by study and month");
    expect(screen.getByText(/groups by at most 2 dimensions/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Study: stop grouping by it" })
    );
    expect(reportHeading()).toBe("Subjects screened by month");
    // Months draw as a line, which the explorer suggests.
    const line = screen.getByRole("radio", { name: /Line chart/ });
    expect((line as HTMLInputElement).checked).toBe(true);
    expect(line.closest("label")!.textContent).toContain("(suggested)");
    expect(log).toEqual(["replace", "replace"]);
  });

  it("keeps a metric defined per study grouped by study", () => {
    const perStudy = metrics.find((m) => m.grain === "study")!;
    render(<Harness initial={startExploration(perStudy.id)} />);
    expect(
      screen.getByText("Study, kept: the metric is defined per study")
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Study: stop grouping by it" })
    ).toBeNull();
  });

  it("filters by values it reads from the warehouse, keeping or leaving them out", () => {
    render(<Harness initial={START} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Add a filter" }), {
      target: { value: "study" },
    });
    const editor = () =>
      screen.getByRole("group", { name: "Study" }) as HTMLElement;
    const studies = run(START).filterValues.study!;
    expect(studies).toHaveLength(8);
    expect(editor().textContent).toContain("Pick at least one of 8 values.");
    expect(tableText()).toHaveLength(8);

    fireEvent.click(
      within(editor()).getByRole("checkbox", { name: "DEMO-101" })
    );
    expect(editor().textContent).toContain("1 of 8 chosen.");
    expect(tableText().map((row) => row[0])).toEqual(["DEMO-101"]);

    fireEvent.click(
      within(editor()).getByRole("radio", { name: "Leave these out" })
    );
    expect(tableText().map((row) => row[0])).toEqual(
      studies.filter((s) => s !== "DEMO-101")
    );

    // Clearing the last value drops the filter but keeps it open to pick again.
    fireEvent.click(
      within(editor()).getByRole("checkbox", { name: "DEMO-101" })
    );
    expect(tableText()).toHaveLength(8);
    expect(editor().textContent).toContain("Pick at least one of 8 values.");
    expect(
      (
        within(editor()).getByRole("radio", {
          name: "Leave these out",
        }) as HTMLInputElement
      ).checked
    ).toBe(true);

    fireEvent.click(
      within(editor()).getByRole("button", { name: "Remove the study filter" })
    );
    expect(screen.queryByRole("group", { name: "Study" })).toBeNull();
  });

  it("says which of the metric's default filters apply and which a filter replaces", () => {
    const metric = metrics.find((m) => m.defaultFilters.length > 0)!;
    const filter = metric.defaultFilters[0];
    const values = run(startExploration(metric.id)).filterValues[
      filter.dimension
    ]!;
    render(<Harness initial={startExploration(metric.id)} />);
    expect(
      screen.getByText(/^Always applied, from the metric's definition: /)
        .textContent
    ).toContain(label(filter.dimension));
    fireEvent.change(screen.getByRole("combobox", { name: "Add a filter" }), {
      target: { value: filter.dimension },
    });
    fireEvent.click(
      within(
        screen.getByRole("group", { name: label(filter.dimension) })
      ).getByRole("checkbox", { name: values[0] })
    );
    expect(
      screen.getByText(/^Your filters replace the metric's default: /)
        .textContent
    ).toContain(label(filter.dimension));
  });

  it("draws the suggested visual until another is chosen, and keeps the link clean", () => {
    const seen: Exploration[] = [];
    const latest = () => seen.at(-1)!;
    render(<Harness initial={START} seen={seen} />);
    const bar = screen.getByRole("radio", {
      name: /Bar chart/,
    }) as HTMLInputElement;
    expect(bar.checked).toBe(true);
    expect(screen.getByRole("region", { name: "Chart" })).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Table" }));
    expect(latest().visual).toBe("table");
    expect(screen.queryByRole("region", { name: "Chart" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Bar chart/ }));
    // Choosing the suggestion again stores no visual, so the link stays short.
    expect(latest().visual).toBeNull();
    expect(encodeExploration(latest())).not.toContain("visual");
  });

  it("downloads the result as CSV", () => {
    const blobs: Blob[] = [];
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: (blob: Blob) => {
          blobs.push(blob);
          return "blob:explore";
        },
        revokeObjectURL: () => {},
      })
    );
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      names.push(this.download);
    });
    render(<Harness initial={START} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Download the data as CSV" })
    );
    const result = run(START);
    expect(names).toEqual([`${result.spec.id}.csv`]);
    return blobs[0].text().then((text) => {
      expect(text).toBe(explorationCsv(result.report));
    });
  });

  it("copies a link to the exploration", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<Harness initial={START} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Copy a link to this exploration" })
      );
    });
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/platform/explore#${encodeExploration(START)}`
    );
    expect(screen.getByText("Link copied.")).toBeTruthy();
  });

  it("lists what a person must do to promote it, with each step's status in words", () => {
    render(<Harness initial={START} />);
    const steps = promotionSteps(run(START).spec);
    const section = screen
      .getByRole("heading", { name: "Promote it to a managed report" })
      .closest("section")!;
    const items = within(section).getAllByRole("listitem");
    expect(items).toHaveLength(steps.length);
    steps.forEach((step, index) => {
      expect(items[index].textContent).toContain(step.label);
      expect(items[index].textContent).toContain(step.detail);
      expect(items[index].textContent).toContain(
        step.status === "met" ? "Met" : "To do"
      );
    });
    expect(steps.some((step) => step.status === "to-do")).toBe(true);
  });

  it("shows progress, failures and an unreadable link in words", () => {
    const result = run(START);
    const { rerender } = render(
      <ExplorerView
        exploration={START}
        result={null}
        busy
        error={null}
        linkError={null}
        hash=""
        onChange={() => {}}
      />
    );
    expect(screen.getByTestId("explore-loading")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      "Running the exploration over the synthetic portfolio."
    );
    rerender(
      <ExplorerView
        exploration={START}
        result={result}
        busy
        error="worker gone"
        linkError="The link must name exactly one metric."
        hash=""
        onChange={() => {}}
      />
    );
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(alerts).toEqual([
      "This link could not be read, so the explorer starts from subjects screened by study. The link must name exactly one metric.",
      "The exploration could not run: worker gone",
    ]);
    expect(
      screen
        .getByRole("heading", { name: result.spec.title })
        .closest("[aria-busy]")!
        .getAttribute("aria-busy")
    ).toBe("true");
  });
});

describe("Explorer (#2634)", () => {
  it("starts from subjects screened by study when the link names nothing", async () => {
    render(<Explorer />);
    expect(screen.getByTestId("explore-loading")).toBeTruthy();
    expect(
      await screen.findByRole(
        "heading",
        { level: 2, name: "Subjects screened by study" },
        { timeout: 20_000 }
      )
    ).toBeTruthy();
    expect(
      screen.getAllByRole("status").map((status) => status.textContent)
    ).toContain("Showing Subjects screened by study.");
  });

  it("opens the exploration a link names, with the registry's numbers", async () => {
    const named: Exploration = {
      metricId: START.metricId,
      dimensions: ["country"],
      filters: [{ dimension: "study", operator: "in", values: ["DEMO-302"] }],
      visual: "table",
    };
    window.history.replaceState(
      null,
      "",
      `/platform/explore#${encodeExploration(named)}`
    );
    render(<Explorer />);
    await screen.findByRole(
      "heading",
      { level: 2, name: "Subjects screened by country" },
      { timeout: 20_000 }
    );
    expect(tableText()).toEqual(expectedText(named));
  });

  it("says why a link could not be read and starts over", async () => {
    window.history.replaceState(null, "", "/platform/explore#metric=nope");
    render(<Explorer />);
    expect(screen.getByRole("alert").textContent).toContain(
      "The explorer does not offer a metric called nope."
    );
    expect(
      await screen.findByRole(
        "heading",
        { level: 2, name: "Subjects screened by study" },
        { timeout: 20_000 }
      )
    ).toBeTruthy();
  });

  it("writes each change to the link: a new metric is a step, an edit is not", async () => {
    render(<Explorer />);
    await screen.findByRole(
      "heading",
      { level: 2, name: "Subjects screened by study" },
      { timeout: 20_000 }
    );
    const steps = window.history.length;
    const next = metrics.find(
      (m) =>
        m.id !== START.metricId &&
        checkExploration({ ...START, metricId: m.id }).length === 0
    )!;
    act(() => {
      fireEvent.change(screen.getByRole("combobox", { name: "Metric" }), {
        target: { value: next.id },
      });
    });
    expect(window.location.hash).toBe(
      `#${encodeExploration({ ...START, metricId: next.id })}`
    );
    expect(window.history.length).toBe(steps + 1);
    act(() => {
      fireEvent.click(screen.getByRole("radio", { name: "Table" }));
    });
    expect(window.location.hash).toContain("visual=table");
    expect(window.history.length).toBe(steps + 1);
    expect(
      await screen.findByRole(
        "heading",
        { level: 2, name: `${next.name} by study` },
        { timeout: 20_000 }
      )
    ).toBeTruthy();
  });
});

class FakeWorker {
  static last: FakeWorker | null = null;
  onmessage: ((message: MessageEvent<ExploreResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: { id: number; exploration: Exploration }[] = [];
  terminated = false;
  constructor(readonly url: URL) {
    FakeWorker.last = this;
  }
  postMessage(message: { id: number; exploration: Exploration }) {
    this.posted.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  answer(id: number) {
    const request = this.posted.find((p) => p.id === id)!;
    this.onmessage!({
      data: { id, ok: true, result: run(request.exploration) },
    } as MessageEvent<ExploreResponse>);
  }
}

describe("the explorer's answers (#2634)", () => {
  it("never lets an answer for an earlier exploration replace a newer one", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    render(<Explorer />);
    const worker = FakeWorker.last!;
    expect(worker.posted.map((p) => p.exploration)).toEqual([START]);
    const byCountry: Exploration = { ...START, dimensions: ["country"] };
    act(() => {
      window.history.replaceState(
        null,
        "",
        `/platform/explore#${encodeExploration(byCountry)}`
      );
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(worker.posted).toHaveLength(2);
    await act(async () => worker.answer(2));
    expect(reportHeading()).toBe("Subjects screened by country");
    await act(async () => worker.answer(1));
    expect(reportHeading()).toBe("Subjects screened by country");
  });
});

describe("createExploreClient (#2634)", () => {
  it("asks the worker, never the main thread, where Workers exist", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createExploreClient();
    const answer = client.explore(START);
    const worker = FakeWorker.last!;
    expect(String(worker.url)).toMatch(/explore\.worker\.ts/);
    expect(worker.posted).toEqual([
      { id: 1, type: "explore", exploration: START },
    ]);
    worker.answer(1);
    await expect(answer).resolves.toEqual(run(START));
    client.dispose();
    expect(worker.terminated).toBe(true);
  });

  it("runs on the main thread only where Workers are missing", async () => {
    vi.stubGlobal("Worker", undefined);
    const client = createExploreClient();
    await expect(client.explore(START)).resolves.toEqual(run(START));
    client.dispose();
  });

  it("rejects what the worker could not answer, and every request when closed", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const client = createExploreClient();
    const answer = client.explore(START);
    FakeWorker.last!.onmessage!({
      data: { id: 1, ok: false, error: "no warehouse" },
    } as MessageEvent<ExploreResponse>);
    await expect(answer).rejects.toThrow("no warehouse");
    const pending = client.explore(START);
    client.dispose();
    await expect(pending).rejects.toThrow("The explorer was closed.");
  });
});
