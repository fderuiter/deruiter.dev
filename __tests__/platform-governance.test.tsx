/**
 * @vitest-environment jsdom
 */

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
import PlatformGovernancePage, {
  metadata,
} from "@/app/platform/governance/page";
import { BusinessGlossary } from "@/components/platform/governance/BusinessGlossary";
import { DataCatalog } from "@/components/platform/governance/DataCatalog";
import { GovernancePolicies } from "@/components/platform/governance/GovernancePolicies";
import { StewardshipModel } from "@/components/platform/governance/StewardshipModel";
import {
  RACI_LABEL,
  catalogAnchor,
  percent,
} from "@/components/platform/governance/labels";
import {
  DEFAULT_PORTFOLIO_SEED,
  GOVERNANCE_DECISIONS,
  GOVERNANCE_POLICIES,
  REPORT_PACK,
  STEWARDSHIP_ROLES,
  assessDataQuality,
  buildWarehouse,
  businessGlossary,
  checkDataContracts,
  contractData,
  dataCatalog,
  dataCatalogFacets,
  dataContracts,
  dataProducts,
  generatePortfolio,
  operationsReportSpecs,
  platformLineage,
  searchBusinessGlossary,
  searchDataCatalog,
  type DataCatalogProduct,
} from "@/lib/clinical-platform";
import {
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  runPipeline,
} from "@/lib/study-data";

/**
 * The /platform/governance page (#2638): the data catalog, business
 * glossary, stewardship model and policies, each read from the platform's
 * own definitions.
 */

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const run = runPipeline(DEMO_301_STUDY, {
  seed: DEFAULT_SEED,
  nSubjects: DEFAULT_SUBJECT_COUNT,
});
const products = dataProducts(run);
const contracts = dataContracts(run);
const reports = [...REPORT_PACK, ...operationsReportSpecs(warehouse)];
const catalog = dataCatalog({
  products,
  contracts,
  contractResults: checkDataContracts(contracts, contractData(warehouse, run), {
    loadedAt: warehouse.asOf,
  }),
  quality: assessDataQuality(warehouse, run),
  lineage: platformLineage(run, reports),
  reports,
});
const reportTitles = Object.fromEntries(reports.map((r) => [r.id, r.title]));
const glossary = businessGlossary();
const metricNames = Object.fromEntries(
  catalog.filter((e) => e.kind === "metric").map((e) => [e.id, e.name])
);

async function violations(container: HTMLElement) {
  const result = await axe.run(container, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
  });
  return result.violations.map((violation) => violation.id);
}

/** Ids of the catalog entries shown, in order. */
function shownIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll("li[id^='catalog-']")].map((li) =>
    li.id.slice("catalog-".length)
  );
}

const catalogSearch = () =>
  screen.getByRole("searchbox", { name: "Search the catalog" });

// jsdom cannot compute pseudo-element styles; answer with the element's own.
beforeEach(() => {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) =>
    computed(element)
  );
  window.history.replaceState(null, "", "/platform/governance");
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the governance page", () => {
  it("shows the four sections, the catalog and a passing stewardship check", async () => {
    const { container } = render(<PlatformGovernancePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Govern the data" })
    ).toBeTruthy();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "Data catalog",
      "Business glossary",
      "Stewardship",
      "Policies",
    ]);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href"))
    ).toEqual(["#catalog", "#glossary", "#stewardship", "#policies"]);
    expect(shownIds(container)).toEqual(catalog.map((e) => e.id));
    expect(container.textContent).toContain("The stewardship check passes");
    expect(container.textContent).toContain(
      "37 data products and 53 governed metrics"
    );
    expect(String(metadata.title)).toContain(
      "Clinical Data Governance & Catalog"
    );
    expect(await violations(container)).toEqual([]);
  }, 60_000);

  it("links only to anchors the page holds", () => {
    const { container } = render(<PlatformGovernancePage />);
    const ids = new Set(
      [...container.querySelectorAll("[id]")].map((element) => element.id)
    );
    const fragments = [...container.querySelectorAll("a[href^='#']")].map((a) =>
      a.getAttribute("href")!.slice(1)
    );
    expect(fragments.length).toBeGreaterThan(100);
    expect(fragments.filter((id) => !ids.has(id))).toEqual([]);
  }, 60_000);
});

describe("the data catalog", () => {
  const renderCatalog = () =>
    render(
      <main>
        <DataCatalog entries={catalog} reportTitles={reportTitles} />
      </main>
    );

  it("offers a filter only for facets the catalog holds two values of", () => {
    renderCatalog();
    const all = dataCatalogFacets(catalog);
    const legends = [...document.querySelectorAll("fieldset > legend")].map(
      (legend) => legend.textContent
    );
    const held = (counts: readonly { count: number }[]) =>
      counts.filter((c) => c.count > 0).length >= 2;
    const expected = [
      held(all.kinds) && "Kind",
      held(all.stewardshipDomains) && "Stewardship domain",
      held(all.layers) && "Layer",
      held(all.classifications) && "Classification",
      held(all.slaStatuses) && "Contract at the last check",
      held(all.metricStatuses) && "Metric status",
    ].filter(Boolean);
    expect(legends).toEqual(expected);
    // Every value offered is one some entry takes.
    const layer = screen.getByRole("group", { name: "Layer" });
    expect(
      within(layer)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")!.textContent)
    ).toEqual(
      all.layers
        .filter((c) => c.count > 0)
        .map(
          (c) => `${c.value[0].toUpperCase()}${c.value.slice(1)} (${c.count})`
        )
    );
  });

  it("searches by words and counts each facet within the search", () => {
    const { container } = renderCatalog();
    fireEvent.change(catalogSearch(), { target: { value: "enrollment" } });
    const expected = searchDataCatalog(catalog, { text: "enrollment" });
    expect(expected.length).toBeGreaterThan(0);
    expect(expected.length).toBeLessThan(catalog.length);
    expect(shownIds(container)).toEqual(expected.map((e) => e.id));
    expect(
      screen.getByText(`${expected.length} of ${catalog.length} entries`)
    ).toBeTruthy();
    const metrics = expected.filter((e) => e.kind === "metric").length;
    expect(
      within(screen.getByRole("group", { name: "Kind" }))
        .getByRole("checkbox", { name: /Metrics/ })
        .closest("label")!.textContent
    ).toBe(`Metrics (${metrics})`);
  });

  it("filters by facets, any of the values ticked within one", () => {
    const { container } = renderCatalog();
    const classification = screen.getByRole("group", {
      name: "Classification",
    });
    fireEvent.click(
      within(classification).getByRole("checkbox", { name: /Restricted/ })
    );
    expect(shownIds(container)).toEqual(
      searchDataCatalog(catalog, { classifications: ["restricted"] }).map(
        (e) => e.id
      )
    );
    fireEvent.click(
      within(classification).getByRole("checkbox", { name: /Public/ })
    );
    expect(shownIds(container)).toEqual(
      searchDataCatalog(catalog, {
        classifications: ["public", "restricted"],
      }).map((e) => e.id)
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Clear the search and filters" })
    );
    expect(shownIds(container)).toEqual(catalog.map((e) => e.id));
    expect(
      screen.queryByRole("button", { name: "Clear the search and filters" })
    ).toBeNull();
  });

  it("says so when nothing matches", () => {
    renderCatalog();
    fireEvent.change(catalogSearch(), { target: { value: "no such thing" } });
    expect(
      screen.getByText(
        "Nothing in the catalog matches. Clear a filter or try other words."
      )
    ).toBeTruthy();
  });

  it("clears the filters when a link points at an entry they hide", async () => {
    const { container } = renderCatalog();
    fireEvent.click(
      within(screen.getByRole("group", { name: "Kind" })).getByRole(
        "checkbox",
        { name: /Metrics/ }
      )
    );
    expect(shownIds(container)).not.toContain("gold.fct_enrollment");
    const screened = document.getElementById(
      catalogAnchor("subjects_screened")
    ) as HTMLElement;
    const source = within(screened).getByRole("link", { name: /enrollment/i });
    expect(source.getAttribute("href")).toBe("#catalog-gold.fct_enrollment");
    await act(async () => {
      window.location.hash = "catalog-gold.fct_enrollment";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(shownIds(container)).toEqual(catalog.map((e) => e.id));
    const target = document.getElementById("catalog-gold.fct_enrollment")!;
    expect(target.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement).toBe(target);
  });

  it("shows each product's owner, contract, quality score and retention", () => {
    renderCatalog();
    const scored = catalog.find(
      (e): e is DataCatalogProduct =>
        e.kind === "product" && e.dqScore !== null && e.dqScore < 1
    )!;
    const card = document.getElementById(
      catalogAnchor(scored.id)
    ) as HTMLElement;
    expect(card.textContent).toContain(scored.owner);
    expect(card.textContent).toContain(scored.steward);
    expect(card.textContent).toContain(
      `${percent(scored.dqScore!)} mean pass rate over ${scored.dqRules} rules`
    );
    expect(card.textContent).toContain("Met its contract");
    expect(card.textContent).toContain(`${scored.retention.years} years.`);
    const unscored = catalog.find(
      (e) => e.kind === "product" && e.dqScore === null
    )!;
    expect(
      document.getElementById(catalogAnchor(unscored.id))!.textContent
    ).toContain("No quality rule checks it yet");
    const health = catalog.find(
      (e) => e.kind === "product" && e.personalHealthData
    )!;
    expect(
      document.getElementById(catalogAnchor(health.id))!.textContent
    ).toContain("Personal health data");
  });
});

describe("the business glossary", () => {
  it("lists every term and searches them the way the engine does", () => {
    const { container } = render(
      <main>
        <BusinessGlossary entries={glossary} metricNames={metricNames} />
      </main>
    );
    const terms = () =>
      [...container.querySelectorAll("dt")].map((dt) => dt.textContent);
    expect(terms()).toEqual(glossary.map((e) => e.term));
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search the glossary" }),
      { target: { value: "screen" } }
    );
    const expected = searchBusinessGlossary(glossary, "screen");
    expect(expected.length).toBeGreaterThan(0);
    expect(terms()).toEqual(expected.map((e) => e.term));
    expect(
      screen.getByText(`${expected.length} of ${glossary.length} terms`)
    ).toBeTruthy();
  });

  it("links each term to the catalog entries of the metrics defined in it", () => {
    render(
      <main>
        <BusinessGlossary entries={glossary} metricNames={metricNames} />
      </main>
    );
    const term = glossary.find((e) => e.metrics.length > 1)!;
    const entry = document.getElementById(`glossary-${term.key}`)!;
    expect(
      within(entry)
        .getAllByRole("link")
        .map((a) => [a.textContent, a.getAttribute("href")])
    ).toEqual(
      term.metrics.map((id) => [metricNames[id], `#${catalogAnchor(id)}`])
    );
  });
});

describe("stewardship and policies", () => {
  it("shows who decides what, with one accountable role per decision", () => {
    render(<StewardshipModel />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(GOVERNANCE_DECISIONS.length);
    GOVERNANCE_DECISIONS.forEach((decision, index) => {
      const cells = within(rows[index]).getAllByRole("cell");
      const roles = cells.slice(0, STEWARDSHIP_ROLES.length);
      expect(roles.map((cell) => cell.textContent)).toEqual(
        STEWARDSHIP_ROLES.map((role) => {
          const code = decision.raci[role.id];
          return code === null ? "No part" : `${code}${RACI_LABEL[code]}`;
        })
      );
      expect(
        roles.filter((cell) => cell.textContent!.includes("Accountable"))
      ).toHaveLength(1);
    });
  });

  it("shows every policy rule and who applies it", () => {
    const { container } = render(<GovernancePolicies />);
    for (const policy of GOVERNANCE_POLICIES) {
      const card = document.getElementById(`policy-${policy.id}`)!;
      expect(card.querySelectorAll("ol > li")).toHaveLength(
        policy.rules.length
      );
      for (const rule of policy.rules) {
        if (rule.appliedBy !== null) {
          expect(card.textContent).toContain(
            `Applied in code by ${rule.appliedBy}.`
          );
        }
      }
    }
    const reviewed = GOVERNANCE_POLICIES.flatMap((p) => p.rules).filter(
      (r) => r.appliedBy === null
    ).length;
    expect(
      container.textContent!.split("Applied by a person in review.").length - 1
    ).toBe(reviewed);
  });
});

describe("percentages", () => {
  it("keeps one decimal and never rounds a shortfall up to 100%", () => {
    expect(percent(1)).toBe("100%");
    expect(percent(0.99999)).toBe("99.9%");
    expect(percent(0.7157)).toBe("71.5%");
    expect(percent(0)).toBe("0.0%");
  });
});
