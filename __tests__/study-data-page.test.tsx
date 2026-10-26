import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import StudyDataPage from "@/app/study-data/page";
import { StudyDataWorkbench } from "@/components/study-data/StudyDataWorkbench";
import { findClinicalClaims } from "@/lib/clinical-platform";
import { DEMO_301_STUDY, SUBJECT_COUNT_LIMITS } from "@/lib/study-data";

const { design } = DEMO_301_STUDY;
const RUN_TIMEOUT = { timeout: 30_000 };

/** Words the page must never use about itself (issue #2594). */
const FORBIDDEN_CLAIMS =
  /\bcompliant\b|\bvalidated\b|\bPart\s*11\b|\b21\s*CFR\b|100\s*%\s*CDISC/i;

const scheduleDesign = {
  studyId: DEMO_301_STUDY.studyId,
  title: DEMO_301_STUDY.title,
  phase: design.phase,
  blinding: design.blinding,
  arms: design.arms.map((arm) => ({ id: arm.id, name: arm.name })),
  visits: design.visits.map((visit) => ({
    id: visit.id,
    name: visit.name,
    visitNum: visit.visitNum,
    targetDay: visit.targetDay,
    windowBefore: visit.windowBefore,
    windowAfter: visit.windowAfter,
  })),
  activities: design.activities.map((activity) => ({
    id: activity.id,
    name: activity.name,
    domain: activity.domain,
    tests: activity.assessments.map((assessment) => assessment.testCode),
  })),
  schedule: design.schedule.map((cell) => ({
    visitId: cell.visitId,
    activityId: cell.activityId,
  })),
};

function renderWorkbench() {
  return render(
    <StudyDataWorkbench
      design={scheduleDesign}
      definitionCounts={{
        arms: design.arms.length,
        visits: design.visits.length,
        activities: design.activities.length,
        scheduled: design.schedule.length,
      }}
      limits={SUBJECT_COUNT_LIMITS}
      defaults={{ seed: 301, nSubjects: 30 }}
    />
  );
}

async function renderFinishedRun() {
  const view = renderWorkbench();
  await waitFor(
    () => expect(screen.getByText(/^Run 1: 30 subjects/)).toBeTruthy(),
    RUN_TIMEOUT
  );
  return view;
}

function lineageStatus(): HTMLElement {
  const section = screen
    .getByRole("heading", { name: "Lineage explorer" })
    .closest("section");
  if (!section) throw new Error("No lineage section");
  return within(section).getByRole("status");
}

function firstTlfGrid(): HTMLElement {
  return screen.getAllByRole("grid")[0];
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
  if (typeof window.matchMedia !== "function") {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }),
    });
  }
});

afterEach(() => {
  cleanup();
});

describe("/study-data workbench", () => {
  it("runs the pipeline on the main thread when Workers are unavailable and fills the stage rail", async () => {
    expect(typeof Worker).toBe("undefined");
    await renderFinishedRun();
    expect(screen.getByText(/on the main thread\.$/)).toBeTruthy();

    const rail = screen.getByRole("list", { name: "Pipeline stages" });
    const stages = within(rail).getAllByRole("listitem");
    expect(stages).toHaveLength(7);
    expect(within(rail).getAllByText("Best practice shown here")).toHaveLength(
      7
    );
    expect(within(rail).queryByText("—")).toBeNull();
    expect(
      within(stages[0]).getByText(String(design.schedule.length))
    ).toBeTruthy();
    expect(within(stages[1]).getByText(/30 screened subjects/)).toBeTruthy();
  });

  it("marks every result cell with the ARS results it shows", async () => {
    await renderFinishedRun();
    const grid = firstTlfGrid();
    const cells = grid.querySelectorAll<HTMLElement>("[data-ars-results]");
    expect(cells.length).toBeGreaterThan(10);
    for (const cell of Array.from(cells)) {
      expect(cell.dataset.arsResults?.trim().length).toBeGreaterThan(0);
    }
  });

  it("moves through a table with the arrow keys and keeps one tab stop", async () => {
    await renderFinishedRun();
    const grid = firstTlfGrid();
    const stops = grid.querySelectorAll('[tabindex="0"]');
    expect(stops).toHaveLength(1);
    const start = stops[0] as HTMLElement;
    act(() => start.focus());
    fireEvent.keyDown(start, { key: "ArrowRight" });
    const right = document.activeElement as HTMLElement;
    expect(right).not.toBe(start);
    expect(right.dataset.c).toBe("1");
    fireEvent.keyDown(right, { key: "ArrowDown" });
    expect((document.activeElement as HTMLElement).dataset.r).toBe("1");
    expect(grid.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  it("traces a table cell back to its analysis rows when it is clicked", async () => {
    await renderFinishedRun();
    expect(lineageStatus().textContent).toBe("Nothing traced yet.");
    const cell = firstTlfGrid().querySelector<HTMLElement>(
      "td[data-ars-results]"
    );
    if (!cell) throw new Error("No result cell");
    fireEvent.click(cell);
    await waitFor(
      () => expect(lineageStatus().textContent).toMatch(/^Tracing Table/),
      RUN_TIMEOUT
    );
    expect(cell.getAttribute("aria-selected")).toBe("true");
    const levels = screen.getByRole("heading", { name: "ADaM Analysis rows" });
    expect(levels).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /^Trace ADSL/ }).length
    ).toBeGreaterThan(0);
  });

  it("traces the example Week 12 mean with the keyboard and walks back to the protocol", async () => {
    await renderFinishedRun();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Trace an example: the Week 12 mean, Placebo",
      })
    );
    await waitFor(
      () =>
        expect(lineageStatus().textContent).toMatch(
          /Table 14\.2\.1 · Week 12, observed.*Placebo/
        ),
      RUN_TIMEOUT
    );
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Lineage explorer" })
    );
    expect(
      screen.getByRole("button", { name: /^Trace forward: VS .*Vital signs/i })
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /^Trace VS · / }).length
    ).toBeGreaterThan(0);

    const view = screen.getAllByRole("button", {
      name: /^View VS row \d+ in the dataset viewer$/,
    })[0];
    fireEvent.click(view);
    await waitFor(() =>
      expect(
        screen
          .getByRole("tab", { name: "Datasets" })
          .getAttribute("aria-selected")
      ).toBe("true")
    );
  });

  it("traces forward from a scheduled activity in the study definition", async () => {
    await renderFinishedRun();
    fireEvent.click(screen.getByRole("tab", { name: "Study definition" }));
    const planned = screen.getByRole("gridcell", {
      name: /^Vital signs planned at WEEK 12$/i,
    });
    fireEvent.keyDown(planned, { key: "Enter" });
    await waitFor(
      () =>
        expect(lineageStatus().textContent).toMatch(/Vital signs · WEEK 12/i),
      RUN_TIMEOUT
    );
  });

  it("shows the run's reviewer guides, as the package ships them", async () => {
    const { container } = await renderFinishedRun();
    fireEvent.click(screen.getByRole("tab", { name: "Reviewer guides" }));
    const region = screen.getByRole("region", {
      name: "cSDRG (SDTM) reviewer guide",
    });
    expect(
      within(region).getByRole("heading", { level: 2 }).textContent
    ).toMatch(/Clinical Study Data Reviewer's Guide/);
    expect(within(region).getByText(/5\. Conformance/)).toBeTruthy();
    expect(
      screen.getByText("m5/datasets/tabulations/sdtm/csdrg.html")
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ADRG (ADaM)" }));
    const adrg = screen.getByRole("region", {
      name: "ADRG (ADaM) reviewer guide",
    });
    expect(within(adrg).getByText(/7\. Analysis outputs/)).toBeTruthy();
    expect(
      within(adrg).getByRole("table", { name: "ARS output index" })
    ).toBeTruthy();

    const text = container.textContent ?? "";
    expect(findClinicalClaims(text)).toEqual([]);
    expect(text).not.toMatch(FORBIDDEN_CLAIMS);
  });

  it("injects an issue and shows where the gate caught it", async () => {
    await renderFinishedRun();
    expect(screen.queryByRole("region", { name: /^Injected:/ })).toBeNull();
    fireEvent.change(screen.getByLabelText("Inject an issue"), {
      target: { value: "impossible-date" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run pipeline" }));
    const panel = await screen.findByRole(
      "region",
      { name: "Injected: Impossible date" },
      RUN_TIMEOUT
    );
    expect(within(panel).getByText(/^Changed subject /)).toBeTruthy();
    expect(within(panel).getByText(/^The gate caught it: /)).toBeTruthy();
    fireEvent.click(
      within(panel).getAllByRole("button", { name: "Show row" })[0]
    );
    expect(
      screen
        .getByRole("tab", { name: "Datasets" })
        .getAttribute("aria-selected")
    ).toBe("true");
  });

  it("explains an injected issue that the derivation, not the gate, handles", async () => {
    await renderFinishedRun();
    fireEvent.change(screen.getByLabelText("Inject an issue"), {
      target: { value: "missing-baseline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Run pipeline" }));
    const panel = await screen.findByRole(
      "region",
      { name: "Injected: Missing baseline" },
      RUN_TIMEOUT
    );
    expect(
      within(panel).getByText(/^The gate raises no finding for this one/)
    ).toBeTruthy();
  });

  it.each([
    ["qtcf-outlier", "QTcF outlier on treatment"],
    ["ecg-missing-rr", "ECG without an RR interval"],
  ])(
    "injects the ECG scenario %s and shows the gate catching it",
    async (id, title) => {
      await renderFinishedRun();
      fireEvent.change(screen.getByLabelText("Inject an issue"), {
        target: { value: id },
      });
      fireEvent.click(screen.getByRole("button", { name: "Run pipeline" }));
      const panel = await screen.findByRole(
        "region",
        { name: `Injected: ${title}` },
        RUN_TIMEOUT
      );
      expect(within(panel).getByText(/^The gate caught it: /)).toBeTruthy();
    }
  );

  it("explains invalid run settings next to the field", async () => {
    await renderFinishedRun();
    const seed = screen.getByLabelText("Seed");
    fireEvent.change(seed, { target: { value: "twelve" } });
    fireEvent.click(screen.getByRole("button", { name: "Run pipeline" }));
    expect(seed.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/^Enter a whole number from 0 to/)).toBeTruthy();
  });

  it("makes no compliance or validation claims in what it renders", async () => {
    const { container } = await renderFinishedRun();
    const text = container.textContent ?? "";
    expect(findClinicalClaims(text)).toEqual([]);
    expect(text).not.toMatch(FORBIDDEN_CLAIMS);
  });
});

describe("/study-data page copy", () => {
  it("makes no compliance or validation claims in the page or its source", () => {
    const html = renderToStaticMarkup(<StudyDataPage />);
    const text = html.replace(/<[^>]+>/g, " ");
    expect(findClinicalClaims(text)).toEqual([]);
    expect(text).not.toMatch(FORBIDDEN_CLAIMS);

    const root = process.cwd();
    const sources = [
      path.resolve(root, "app/study-data/page.tsx"),
      path.resolve(root, "app/study-data/opengraph-image.tsx"),
      ...readdirSync(path.resolve(root, "components/study-data")).map((file) =>
        path.resolve(root, "components/study-data", file)
      ),
    ];
    for (const file of sources) {
      const source = readFileSync(file, "utf8");
      expect(findClinicalClaims(source), file).toEqual([]);
      expect(source, file).not.toMatch(FORBIDDEN_CLAIMS);
    }
  });

  it("states that the data are synthetic and names the route without CDISC", () => {
    const html = renderToStaticMarkup(<StudyDataPage />);
    expect(html).toContain("Study Data Pipeline");
    expect(html).toMatch(/synthetic/i);
    expect(html).not.toMatch(/CDISC Pipeline|CDISC Studio/i);
  });
});
