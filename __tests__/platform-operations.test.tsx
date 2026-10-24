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
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
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

  it("shows a device study's own milestones and its CEC gap", () => {
    view({ study: "DEV-402" }, "milestones");
    const table = screen.getByRole("table", {
      name: "DEV-402 milestones, planned and actual",
    });
    expect(
      within(table).getByRole("rowheader", { name: "IDE approval" })
    ).toBeTruthy();
    const gaps = screen.getByRole("complementary", {
      name: "Milestones: not in the governed model yet",
    });
    expect(within(gaps).getByText(/CEC adjudication backlog/)).toBeTruthy();
    expect(
      within(gaps).getByRole("link", { name: "Planned in #2760" })
    ).toHaveProperty(
      "href",
      "https://github.com/fderuiter/deruiter.dev/issues/2760"
    );
  });

  it("says why a scope was cut back", () => {
    view({ study: "NOPE" });
    expect(screen.getByRole("status").textContent).toBe(
      "No study NOPE in the portfolio. Showing the whole portfolio."
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
