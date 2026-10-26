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
import { OperationsDashboard } from "@/components/platform/operations/OperationsDashboard";
import {
  OperationsView,
  operationsHash,
} from "@/components/platform/operations/OperationsView";
import {
  DEFAULT_PORTFOLIO_SEED,
  buildWarehouse,
  generatePortfolio,
  operationsDashboard,
  type OperationsScope,
  type OperationsSectionId,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const at = (scope: OperationsScope = {}) =>
  operationsDashboard(warehouse, scope);

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
  });
  return result.violations.map((violation) => violation.id);
}

function view(
  scope: OperationsScope = {},
  section: OperationsSectionId | null = null
) {
  const onView = vi.fn();
  const onRunBy = vi.fn();
  const result = render(
    <main>
      <OperationsView
        dashboard={at(scope)}
        view={section}
        onView={onView}
        onRunBy={onRunBy}
      />
    </main>
  );
  return { ...result, onView, onRunBy };
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
  window.history.replaceState(null, "", "/");
});

describe("operationsHash (#2630)", () => {
  it("writes the scope and section in one fixed order", () => {
    expect(operationsHash({}, null)).toBe("#");
    expect(
      operationsHash(
        { site: "DEMO-302-DE-103", country: "DE", study: "DEMO-302" },
        "quality"
      )
    ).toBe("#study=DEMO-302&country=DE&site=DEMO-302-DE-103&view=quality");
    expect(operationsHash({ runBy: "sponsor" }, null)).toBe("#runby=sponsor");
  });
});

describe("OperationsView (#2630)", () => {
  it.each<[string, OperationsScope, OperationsSectionId | null]>([
    ["the portfolio", {}, null],
    ["the portfolio's milestones", {}, "milestones"],
    ["a device study's milestones", { study: "DEV-402" }, "milestones"],
    ["a country", { study: "DEMO-302", country: "DE" }, "quality"],
    [
      "a site",
      { study: "DEMO-302", site: "DEMO-302-DE-103" },
      "data-management",
    ],
    ["a study's risk tab", { study: "DEMO-302" }, "risk"],
    ["a QTL breach on the risk tab", { study: "DEMO-203" }, "risk"],
    [
      "the planted site's risk tab",
      { study: "DEMO-302", site: "DEMO-302-BR-118" },
      "risk",
    ],
  ])("renders %s with zero axe violations", async (_name, scope, section) => {
    const { container } = view(scope, section);
    expect(await violations(container)).toEqual([]);
  });

  it("shows the registry's headline numbers for the portfolio", () => {
    view();
    const glance = screen
      .getByRole("heading", { name: "At a glance" })
      .closest("section")!;
    const term = (name: string) =>
      within(glance).getByText(name).closest("div")!.querySelector("dd")!
        .textContent;
    expect(term("Subjects screened")).toContain("1,808");
    expect(term("Subjects enrolled")).toContain("1,228");
    expect(term("Enrollment vs plan")).toContain("78.8%");
    expect(term("Open queries")).toContain("36");
    expect(
      document.querySelector('time[datetime="2026-09-30"]')?.textContent
    ).toBe("2026-09-30");
  });

  it("states the freshness the data contracts promise, product by product", () => {
    view({ study: "DEV-402" }, "milestones");
    expect(document.querySelector("details > summary")?.textContent).toBe(
      "Data as of 2026-09-30 · freshness target daily"
    );
    const table = screen.getByRole("table", {
      name: "Data products behind these numbers, with their contract freshness targets",
    });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(at({ study: "DEV-402" }).sources.length);
    expect(
      within(table).getByRole("rowheader", { name: /gold\.fct_milestone/ })
    ).toBeTruthy();
    expect(rows[0].textContent).toContain("daily");
    expect(rows[0].textContent).toContain("v1.0.0");
  });

  it("links each study, then each country, then each site, keeping the section", () => {
    view({}, "quality");
    const studies = screen.getByRole("navigation", { name: "Studies" });
    expect(
      within(studies).getByRole("link", { name: /DEV-402/ })
    ).toHaveProperty("hash", "#study=DEV-402&view=quality");
    cleanup();
    view({ study: "DEMO-302" });
    const countries = screen.getByRole("navigation", {
      name: "Countries in DEMO-302",
    });
    expect(
      within(countries).getByRole("link", { name: /Germany/ })
    ).toHaveProperty("hash", "#study=DEMO-302&country=DE");
    cleanup();
    view({ study: "DEMO-302", country: "DE" });
    expect(
      screen.getByRole("navigation", { name: "Sites in DEMO-302, Germany" })
    ).toBeTruthy();
  });

  it("marks the current step in the breadcrumb trail", () => {
    view({ study: "DEMO-302", site: "DEMO-302-DE-103" });
    const trail = screen.getByRole("navigation", { name: "Dashboard level" });
    expect(
      within(trail)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Portfolio", "#"],
      ["DEMO-302", "#study=DEMO-302"],
      ["Germany", "#study=DEMO-302&country=DE"],
    ]);
    expect(within(trail).getByText("DEMO-302-DE-103")).toHaveProperty(
      "ariaCurrent",
      "page"
    );
  });

  it("moves between sections with the arrow, Home and End keys", () => {
    const { onView } = view();
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "Enrollment",
      "Site activation",
      "Data management",
      "Quality and monitoring",
      "Milestones",
    ]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    expect(tabs[1].tabIndex).toBe(-1);
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(onView).toHaveBeenLastCalledWith("activation");
    fireEvent.keyDown(tabs[0], { key: "ArrowLeft" });
    expect(onView).toHaveBeenLastCalledWith("milestones");
    fireEvent.keyDown(tabs[0], { key: "End" });
    expect(onView).toHaveBeenLastCalledWith("milestones");
    fireEvent.click(tabs[2]);
    expect(onView).toHaveBeenLastCalledWith("data-management");
  });

  it("falls back to the first section when the one asked for is not on the level", () => {
    view({ study: "DEMO-302", country: "DE" }, "milestones");
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe(
      "Enrollment"
    );
  });

  it("draws every chart with its data table", () => {
    view();
    const panel = screen.getByRole("tabpanel");
    expect(
      within(panel).getByRole("group", {
        name: /Bar chart of Enrollment vs plan by study/,
      })
    ).toBeTruthy();
    expect(
      within(panel).getByRole("table", {
        name: /Enrollment against plan by study, data as of 2026-09-30/,
      })
    ).toBeTruthy();
  });

  it("filters the portfolio by who runs the studies", () => {
    const { onRunBy } = view();
    const select = screen.getByLabelText("Studies shown");
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual([
      "All studies (8)",
      "Run by the sponsor (5)",
      "Run by Quillfeather Clinical Research (CRO) (1)",
      "Run by Bramblecote Trial Services (CRO) (2)",
    ]);
    fireEvent.change(select, { target: { value: "VEN-CRO-02" } });
    expect(onRunBy).toHaveBeenCalledWith("VEN-CRO-02");
    cleanup();
    view({ study: "DEMO-302" });
    expect(screen.queryByLabelText("Studies shown")).toBeNull();
    expect(
      screen.getByText("Quillfeather Clinical Research (CRO)")
    ).toBeTruthy();
  });

  it("shows a device study's own milestones", () => {
    view({ study: "DEV-402" }, "milestones");
    const table = screen.getByRole("table", {
      name: "DEV-402 milestones, planned and actual",
    });
    expect(
      within(table).getByRole("rowheader", { name: "IDE approval" })
    ).toBeTruthy();
    // The adjudication backlog left the gaps for the quality tab (#2881).
    expect(
      screen.queryByRole("complementary", {
        name: "Milestones: not in the governed model yet",
      })
    ).toBeNull();
  });

  it("shows the adjudication backlog for a device study only (#2881)", () => {
    const backlog = { name: "Event adjudication backlog by country" };
    view({ study: "DEV-402" }, "quality");
    expect(screen.getByRole("heading", backlog)).toBeTruthy();
    cleanup();
    view({ study: "DEMO-302" }, "quality");
    expect(screen.queryByRole("heading", backlog)).toBeNull();
  });

  it("says why a scope was cut back", () => {
    view({ study: "NOPE" });
    expect(screen.getByRole("status").textContent).toBe(
      "No study NOPE in the portfolio. Showing the whole portfolio."
    );
  });
});

describe("Risk tab (#2631)", () => {
  it("is offered below the portfolio only, between quality and milestones", () => {
    view();
    expect(screen.queryByRole("tab", { name: "Risk" })).toBeNull();
    cleanup();
    view({ study: "DEMO-302" });
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Enrollment",
      "Site activation",
      "Data management",
      "Quality and monitoring",
      "Risk",
      "Milestones",
    ]);
  });

  it("gives every KRI at every site a value and a status word, and drills into the site", () => {
    view({ study: "DEMO-302" }, "risk");
    const risk = at({ study: "DEMO-302" }).risk!;
    const table = screen.getByRole("table", {
      name: /^Key risk indicators for 36 sites/,
    });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(risk.sites.length);
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((th) => th.textContent)
    ).toEqual(["Site", ...risk.kris.map((kri) => kri.name)]);
    const planted = within(table).getByRole("link", {
      name: "DEMO-302-BR-118",
    });
    expect(planted.getAttribute("href")).toBe(
      "#study=DEMO-302&country=BR&site=DEMO-302-BR-118&view=risk"
    );
    // The status is a word as well as a color.
    const row = planted.closest("tr")!;
    const cells = within(row).getAllByRole("cell");
    const screenFailure = risk.kris[0].cells.find(
      (c) => c.siteId === "DEMO-302-BR-118"
    )!;
    expect(cells[0].textContent).toBe(`${screenFailure.text}◆ Amber`);
    for (const cell of within(table).getAllByRole("cell")) {
      expect(cell.textContent).toMatch(/(Red|Amber|Green|Too little data)$/);
    }
  });

  it("shows the sites that stand out, with their p- and q-values", () => {
    view({ study: "DEMO-302" }, "risk");
    const csm = screen
      .getByRole("heading", { name: "Central statistical monitoring" })
      .closest("section")!;
    const flagged = within(csm)
      .getAllByRole("listitem")
      .filter((li) => li.textContent?.includes("q = "));
    // BR-118 is the planted data-integrity site: queries, adverse events
    // (#2956), exact-day visits, entry hours (#2955), rounded and barely
    // varying vital signs (#2957) and its KRI profile.
    expect(flagged.map((li) => li.textContent?.split(" · ")[0])).toEqual([
      "DEMO-302-BR-118",
      "DEMO-302-BR-118",
      "DEMO-302-BR-118",
      "DEMO-302-BR-118",
      "DEMO-302-BR-118",
      "DEMO-302-BR-118",
      "DEMO-302-BR-118",
      "DEMO-302-US-101",
    ]);
    expect(within(csm).getByText(/DEMO-302-IT-106:/)).toBeTruthy();
    const grid = within(csm).getByRole("table", {
      name: /Adjusted q-values of every central monitoring test/,
    });
    expect(within(grid).getAllByText("(stands out)")).toHaveLength(8);
  });

  it("shows a QTL breach and logs the signal it raises", () => {
    view({ study: "DEMO-203" }, "risk");
    const qtls = screen.getByRole("table", {
      name: "DEMO-203 quality tolerance limits, with their values, limits and status",
    });
    const breach = within(qtls)
      .getByRole("rowheader", { name: "Subjects who end the study early" })
      .closest("tr")!;
    expect(
      within(breach)
        .getAllByRole("cell")
        .map((td) => td.textContent)
    ).toEqual(["27.8%", "18.0%", "25.0%", "▲ Breached"]);
    const log = screen.getByRole("table", {
      name: "7 entries of the DEMO-203 risk signal log, in order",
    });
    const first = within(log)
      .getByRole("rowheader", { name: "DEMO-203-SIG-001" })
      .closest("tr")!;
    expect(first.textContent).toContain("past the tolerance limit of 25.0%");
  });

  it("says when the study-level limits are not narrowed, and when nothing was raised", () => {
    view({ study: "DEMO-302", country: "DE" }, "risk");
    expect(screen.getByText(/A limit applies to the whole study/)).toBeTruthy();
    expect(
      screen.getByText("No signals in scope at the data cut.")
    ).toBeTruthy();
    cleanup();
    view({ study: "DEMO-302" }, "risk");
    expect(screen.queryByText(/A limit applies to the whole study/)).toBeNull();
  });

  it("links what cannot be watched yet to the issue that adds the data", () => {
    view({ study: "DEMO-302" }, "risk");
    const gaps = screen.getByRole("complementary", {
      name: "Risk: not in the governed model yet",
    });
    // The weekday calendar; adverse events (#2956), entry hours (#2955) and
    // vital signs (#2957) are tested now.
    expect(
      within(gaps).getAllByRole("link", { name: "Planned in #2776" })
    ).toHaveLength(1);
    const factor = screen.getByText("Adverse event reporting").closest("li")!;
    expect(factor.textContent).toContain(
      "Central monitoring compares each site's rate with its peers"
    );
    expect(
      within(factor).getByRole("link", { name: "Planned in #2980" })
    ).toHaveProperty(
      "href",
      "https://github.com/fderuiter/deruiter.dev/issues/2980"
    );
  });
});

describe("OperationsDashboard (#2630)", () => {
  it("reads the scope from the URL hash and follows it", async () => {
    window.history.replaceState(null, "", "/platform/operations#study=DEV-401");
    render(<OperationsDashboard />);
    expect(screen.getByTestId("operations-loading")).toBeTruthy();
    expect(
      await screen.findByRole("navigation", { name: "Countries in DEV-401" })
    ).toBeTruthy();
    await act(async () => {
      window.location.hash = "study=DEMO-302&country=DE";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(
      await screen.findByRole("navigation", {
        name: "Sites in DEMO-302, Germany",
      })
    ).toBeTruthy();
  });

  it("writes a section choice to the hash without a new history entry", async () => {
    window.history.replaceState(null, "", "/platform/operations");
    render(<OperationsDashboard />);
    const tab = await screen.findByRole("tab", { name: "Data management" });
    const length = window.history.length;
    fireEvent.click(tab);
    expect(window.location.hash).toBe("#view=data-management");
    expect(window.history.length).toBe(length);
    expect(screen.getByRole("tab", { selected: true }).textContent).toBe(
      "Data management"
    );
  });
});
