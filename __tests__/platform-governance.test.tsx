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
import {
  DataQuality,
  type DqScenarioEffect,
} from "@/components/platform/governance/DataQuality";
import { GovernancePolicies } from "@/components/platform/governance/GovernancePolicies";
import { StewardshipModel } from "@/components/platform/governance/StewardshipModel";
import {
  DQ_STATUS_LABEL,
  RACI_LABEL,
  catalogAnchor,
  dqIssueAnchor,
  dqProductAnchor,
  dqRuleAnchor,
  percent,
} from "@/components/platform/governance/labels";
import {
  DATA_QUALITY_RULES,
  DEFAULT_PORTFOLIO_SEED,
  DQ_ISSUE_LOG,
  DQ_SCENARIOS,
  GOVERNANCE_DECISIONS,
  GOVERNANCE_POLICIES,
  REPORT_PACK,
  STEWARDSHIP_ROLES,
  applyDqScenario,
  assessDataQuality,
  buildWarehouse,
  businessGlossary,
  checkDataContracts,
  contractData,
  dataCatalog,
  dataCatalogFacets,
  dataContracts,
  dataProducts,
  dataQualityTrend,
  dqIssues,
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
 * The /platform/governance page (#2638, #2636): the data catalog, data
 * quality scorecard, business glossary, stewardship model and policies,
 * each read from the platform's own definitions.
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
const quality = assessDataQuality(warehouse, run);
const catalog = dataCatalog({
  products,
  contracts,
  contractResults: checkDataContracts(contracts, contractData(warehouse, run), {
    loadedAt: warehouse.asOf,
  }),
  quality,
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
  it("shows the five sections, the catalog and a passing stewardship check", async () => {
    const { container } = render(<PlatformGovernancePage />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Govern the data" })
    ).toBeTruthy();
    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent);
    expect(headings).toEqual([
      "Data catalog",
      "Data quality",
      "Business glossary",
      "Stewardship",
      "Policies",
    ]);
    const nav = screen.getByRole("navigation", { name: "On this page" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href"))
    ).toEqual([
      "#catalog",
      "#quality",
      "#glossary",
      "#stewardship",
      "#policies",
    ]);
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

describe("the data quality section", () => {
  const trend = dataQualityTrend(warehouse, run, DQ_ISSUE_LOG);
  const issues = dqIssues(DQ_ISSUE_LOG);
  const catalogIds = new Set(catalog.map((e) => e.id));
  // The table's oracle: each defect's rules, failing rows before and with it.
  const before = new Map(quality.results.map((r) => [r.ruleId, r]));
  const effects: DqScenarioEffect[] = DQ_SCENARIOS.map((scenario) => {
    const after = new Map(
      assessDataQuality(
        applyDqScenario(warehouse, scenario.id),
        run
      ).results.map((r) => [r.ruleId, r])
    );
    return {
      scenario,
      rules: scenario.ruleIds.map((ruleId) => ({
        ruleId,
        failedBefore: before.get(ruleId)!.failed,
        failedAfter: after.get(ruleId)!.failed,
        status: after.get(ruleId)!.status,
      })),
    };
  });

  const renderQuality = () =>
    render(
      <DataQuality
        assessment={quality}
        trend={trend}
        issues={issues}
        effects={effects}
        rules={DATA_QUALITY_RULES}
        productNames={Object.fromEntries(
          quality.byProduct.map((p) => [p.key, p.label])
        )}
        catalogIds={catalogIds}
      />
    );

  /** The body rows of the table a region holds, as their cells' text. */
  const rowsOf = (label: string) =>
    within(screen.getByRole("region", { name: label }))
      .getAllByRole("row")
      .slice(1)
      .map((row) =>
        [...row.querySelectorAll("th, td")].map((cell) => cell.textContent)
      );

  it("shows the overall score and every dimension and product as a table", async () => {
    const { container } = renderQuality();
    const tile = (term: string) =>
      screen.getByText(term, { selector: "dt" }).nextElementSibling!
        .textContent;
    expect(tile("Overall score")).toBe(percent(quality.overall.score!));
    expect(tile("Rules passing")).toBe(
      `${quality.overall.passing} of ${quality.overall.rules}`
    );
    expect(tile("Data cut")).toBe(quality.dataCut);

    expect(rowsOf("Data quality score by dimension")).toEqual(
      quality.byDimension.map((d) => [
        d.label,
        String(d.rules),
        String(d.passing),
        percent(d.score!),
      ])
    );
    const products = rowsOf("Data quality score by data product");
    expect(products.map((row) => row[0])).toEqual(
      quality.byProduct.map((p) => p.label)
    );
    for (const product of quality.byProduct) {
      const row = document.getElementById(dqProductAnchor(product.key))!;
      const link = row.querySelector("a");
      // A product links to its catalog entry exactly when the catalog holds one.
      expect(link?.getAttribute("href") ?? null).toBe(
        catalogIds.has(product.key) ? `#${catalogAnchor(product.key)}` : null
      );
    }
    expect(await violations(container)).toEqual([]);
  }, 60_000);

  it("shows each of the last twelve weeks with its failing rules and open issues", () => {
    renderQuality();
    const weeks = rowsOf("Weekly data quality scorecard");
    expect(weeks).toHaveLength(12);
    expect(weeks.map((row) => row[0])).toEqual(trend.map((p) => p.weekEnding));
    expect(weeks.at(-1)![0]).toBe(warehouse.asOf);
    weeks.forEach((row, i) => {
      expect(row[1]).toBe(percent(trend[i].overall.score!));
      expect(row[2]).toBe(
        `${trend[i].failingRuleIds.length}${trend[i].failingRuleIds.join(", ")}`
      );
      expect(row[3]).toBe(
        trend[i].openIssueIds.length === 0
          ? "None"
          : trend[i].openIssueIds.join(", ")
      );
    });
    // Some week carried a defect the rules caught, so the trend is not flat.
    expect(
      new Set(trend.map((p) => p.failingRuleIds.length)).size
    ).toBeGreaterThan(1);
    const region = screen.getByRole("region", {
      name: "Weekly data quality scorecard",
    });
    const hrefs = [...region.querySelectorAll("a")].map((a) =>
      a.getAttribute("href")
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href).toMatch(/^#dq-(rule|issue)-/);
      expect(document.getElementById(href!.slice(1))).not.toBeNull();
    }
  });

  it("logs every issue with its history, and counts the ones still in the data", () => {
    const { container } = renderQuality();
    const cards = [...container.querySelectorAll("li[id^='dq-issue-']")];
    expect(cards.map((card) => card.id)).toEqual(
      issues.map((issue) => dqIssueAnchor(issue.issueId))
    );
    const open = issues.filter((issue) => issue.fixedOn === null);
    expect(open.length).toBeGreaterThan(0);
    expect(open.length).toBeLessThan(issues.length);
    expect(
      screen.getByText("Open issues", { selector: "dt" }).nextElementSibling!
        .textContent
    ).toBe(String(open.length));
    for (const issue of issues) {
      const card = document.getElementById(dqIssueAnchor(issue.issueId))!;
      expect(card.querySelectorAll("ol > li")).toHaveLength(
        issue.history.length
      );
      expect(card.textContent).toContain(
        issue.fixedOn === null ? "still in the data" : `fixed ${issue.fixedOn}`
      );
      const scenario = DQ_SCENARIOS.find((s) => s.id === issue.scenarioId)!;
      expect(within(card as HTMLElement).getByRole("heading").textContent).toBe(
        `${issue.issueId} ${scenario.name}`
      );
    }
  });

  it("shows what each defect does to its rules, including one the threshold absorbs", () => {
    renderQuality();
    for (const effect of effects) {
      expect(rowsOf(`Rules ${effect.scenario.name} trips`)).toEqual(
        effect.rules.map((rule) => [
          rule.ruleId,
          String(rule.failedBefore),
          String(rule.failedAfter),
          DQ_STATUS_LABEL[rule.status].glyph +
            " " +
            DQ_STATUS_LABEL[rule.status].label,
        ])
      );
    }
    // A late backlog raises DQ-T01's failing rows and still meets its threshold.
    const late = effects.find((e) => e.scenario.id === "late-edc-entry")!;
    expect(late.rules).toEqual([
      expect.objectContaining({ ruleId: "DQ-T01", status: "pass" }),
    ]);
    expect(late.rules[0].failedAfter).toBeGreaterThan(
      late.rules[0].failedBefore
    );
    // Every other defect fails a rule it trips: none of them goes unseen.
    for (const effect of effects.filter((e) => e !== late)) {
      expect(effect.rules.some((rule) => rule.status !== "pass")).toBe(true);
    }
  }, 60_000);

  it("lists every rule, opening the dimensions that hold a rule to look at", () => {
    const { container } = renderQuality();
    expect(
      [...container.querySelectorAll("tr[id^='dq-rule-']")].map((tr) => tr.id)
    ).toEqual(
      quality.byDimension.flatMap((d) =>
        DATA_QUALITY_RULES.filter((r) => r.dimension === d.key).map((r) =>
          dqRuleAnchor(r.id)
        )
      )
    );
    expect(container.querySelectorAll("tr[id^='dq-rule-']")).toHaveLength(
      DATA_QUALITY_RULES.length
    );
    const status = new Map(quality.results.map((r) => [r.ruleId, r.status]));
    const groups = [...container.querySelectorAll("details")];
    expect(groups).toHaveLength(quality.byDimension.length);
    const opened = groups.map((group) =>
      [...group.querySelectorAll("tr[id^='dq-rule-']")].some((tr) => {
        const s = status.get(tr.id.slice("dq-rule-".length));
        return s === "fail" || s === "warn";
      })
    );
    expect(groups.map((group) => group.open)).toEqual(opened);
    // Both states occur, so the rule is exercised either way.
    expect(new Set(opened).size).toBe(2);

    for (const result of quality.results.filter((r) => r.status === "fail")) {
      const row = document.getElementById(dqRuleAnchor(result.ruleId))!;
      expect(row.textContent).toContain(DQ_STATUS_LABEL.fail.label);
      expect(row.textContent).toContain(
        `${result.failed} of ${result.checked} rows fail, for example`
      );
    }
  });

  it("opens a closed rule group when a link points into it", () => {
    const { container } = renderQuality();
    // DQI-004's rule passes today, so its group starts closed.
    const issue = document.getElementById(dqIssueAnchor("DQI-004"))!;
    const link = issue.querySelector<HTMLAnchorElement>(
      `a[href="#${dqRuleAnchor("DQ-K04")}"]`
    )!;
    const rule = document.getElementById(dqRuleAnchor("DQ-K04"))!;
    const group = rule.closest("details")!;
    expect(group.open).toBe(false);

    act(() => {
      window.location.hash = link.getAttribute("href")!;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(group.open).toBe(true);
    expect(document.activeElement).toBe(rule);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

    // A link into an open group, or elsewhere, is left to the browser.
    rule.blur();
    act(() => {
      window.location.hash = `#${catalogAnchor("gold.fct_visit")}`;
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(container.querySelectorAll("details[open]").length).toBe(3);
    expect(document.activeElement).toBe(document.body);
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
