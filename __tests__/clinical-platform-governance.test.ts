import fc from "fast-check";
import { describe, expect, it } from "vitest";
import * as platform from "@/lib/clinical-platform";
import {
  BUSINESS_GLOSSARY_EXTRA_TERMS,
  DEFAULT_PORTFOLIO_SEED,
  GOVERNANCE_DECISIONS,
  GOVERNANCE_DOMAINS,
  GOVERNANCE_POLICIES,
  METRICS_DATASET,
  METRIC_REGISTRY,
  REPORT_PACK,
  STEWARDSHIP_ROLES,
  STUDY_DATA_PRODUCT_ID,
  assessDataQuality,
  buildWarehouse,
  businessGlossary,
  checkDataContracts,
  checkRegulatoryWording,
  checkStewardship,
  contractData,
  dataCatalog,
  dataCatalogFacets,
  dataContracts,
  dataProducts,
  findClinicalClaims,
  generatePortfolio,
  operationsReportSpecs,
  platformLineage,
  searchBusinessGlossary,
  searchDataCatalog,
  stewardshipDomainOf,
  type DataCatalogEntry,
  type DataCatalogMetric,
  type DataCatalogProduct,
  type GovernanceDecision,
  type GovernancePolicy,
} from "@/lib/clinical-platform";
import {
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  DEMO_301_STUDY,
  runPipeline,
} from "@/lib/study-data";
import { compileTerms } from "@/lib/term-compiler";
import { CANONICAL_GLOSSARY } from "@/lib/term-glossary";

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
const contractResults = checkDataContracts(
  contracts,
  contractData(warehouse, run),
  { loadedAt: warehouse.asOf }
);
const quality = assessDataQuality(warehouse, run);
const lineage = platformLineage(run, reports);
const catalog = dataCatalog({
  products,
  contracts,
  contractResults,
  quality,
  lineage,
  reports,
});

const productEntries = catalog.filter(
  (e): e is DataCatalogProduct => e.kind === "product"
);
const metricEntries = catalog.filter(
  (e): e is DataCatalogMetric => e.kind === "metric"
);
const ids = (entries: readonly DataCatalogEntry[]) => entries.map((e) => e.id);
const product = (id: string) => {
  const found = productEntries.find((e) => e.id === id);
  if (found === undefined) throw new Error(`no product ${id}`);
  return found;
};

/** Every exported name of the platform module. */
const EXPORTS = new Set(Object.keys(platform));

describe("stewardship model", () => {
  it("places every product and metric in a domain with its owner and steward", () => {
    expect(checkStewardship({ products })).toEqual([]);
    for (const item of [...products, ...METRIC_REGISTRY]) {
      const domain = GOVERNANCE_DOMAINS.find(
        (d) => d.id === stewardshipDomainOf(item.owner)
      );
      expect(domain?.owners, item.id).toContain(item.owner);
      expect(domain?.stewards, item.id).toContain(item.steward);
    }
  });

  it("covers the clinical data, operations, safety and finance domains", () => {
    expect(GOVERNANCE_DOMAINS.map((d) => d.id)).toEqual([
      "clinical-data",
      "clinical-operations",
      "safety",
      "finance",
      "data-platform",
    ]);
    expect(stewardshipDomainOf("Medical Safety Lead")).toBe("safety");
    expect(stewardshipDomainOf("Finance Data Steward")).toBe("finance");
    expect(() => stewardshipDomainOf("Chief Vibes Officer")).toThrow(
      "no stewardship domain holds the role Chief Vibes Officer"
    );
  });

  it("defines the owner, steward, custodian and consumer roles", () => {
    expect(STEWARDSHIP_ROLES.map((r) => r.id)).toEqual([
      "owner",
      "steward",
      "custodian",
      "consumer",
    ]);
    for (const role of STEWARDSHIP_ROLES) {
      expect(role.duties.length, role.id).toBeGreaterThan(0);
    }
  });

  it("gives each key decision one accountable owner and a responsible role", () => {
    expect(GOVERNANCE_DECISIONS.map((d) => d.id)).toEqual([
      "new-metric",
      "contract-break",
      "access-request",
      "retention-change",
    ]);
    for (const decision of GOVERNANCE_DECISIONS) {
      const codes = Object.values(decision.raci);
      expect(
        codes.filter((c) => c === "A"),
        decision.id
      ).toEqual(["A"]);
      expect(decision.raci.owner, decision.id).toBe("A");
      expect(codes, decision.id).toContain("R");
      expect(
        GOVERNANCE_POLICIES.map((p) => p.id),
        decision.id
      ).toContain(decision.policy);
    }
  });

  it("finds roles, owners and stewards outside the domains", () => {
    const [first] = products;
    const findings = checkStewardship({
      products: [
        { ...first, owner: "Unknown Lead" },
        { ...first, id: "x.wrong_steward", steward: "Finance Data Steward" },
      ],
      metrics: [],
      domains: [
        ...GOVERNANCE_DOMAINS,
        {
          id: "finance",
          name: "Again",
          summary: "A second home for a role.",
          owners: ["Clinical Operations Lead"],
          stewards: [],
        },
      ],
    });
    expect(findings.map((f) => f.message)).toEqual([
      "Clinical Operations Lead is in both clinical-operations and finance",
      `product ${first.id} is owned by Unknown Lead, which no domain lists as an owner`,
      `product x.wrong_steward is stewarded by Finance Data Steward, which is not a steward of ${stewardshipDomainOf(first.owner)}`,
    ]);
    expect(new Set(findings.map((f) => f.rule))).toEqual(new Set(["domain"]));
  });

  it("finds a decision without one accountable or any responsible role", () => {
    const base = GOVERNANCE_DECISIONS[0];
    const decisions: GovernanceDecision[] = [
      {
        ...base,
        raci: { owner: "A", steward: "A", custodian: "R", consumer: null },
      },
      {
        ...base,
        id: "access-request",
        raci: { owner: "C", steward: "C", custodian: "I", consumer: "I" },
      },
      { ...base, id: "retention-change", policy: "retention" },
    ];
    const messages = checkStewardship({
      products,
      decisions,
      policies: GOVERNANCE_POLICIES.filter((p) => p.id !== "retention"),
    }).map((f) => f.message);
    expect(messages).toEqual([
      "new-metric has 2 accountable roles; it needs exactly one",
      "access-request has 0 accountable roles; it needs exactly one",
      "access-request has no responsible role",
      "retention-change applies policy retention, which does not exist",
    ]);
  });

  it("finds a repeated, empty or overclaiming policy", () => {
    const base = GOVERNANCE_POLICIES[0];
    const policies: GovernancePolicy[] = [
      ...GOVERNANCE_POLICIES,
      { ...base, rules: [] },
      {
        ...base,
        id: "access",
        rules: [{ text: "The platform is validated.", appliedBy: null }],
      },
    ];
    const findings = checkStewardship({ products, policies });
    expect(findings.map((f) => f.message)).toEqual([
      "policy classification is listed twice",
      "policy classification has no rules",
      "policy access is listed twice",
      '"validated" makes a claim; say "designed to these controls" instead.',
    ]);
    expect(new Set(findings.map((f) => f.rule))).toEqual(new Set(["policy"]));
  });
});

describe("governance policies", () => {
  it("covers classification, retention, access, certification and change control", () => {
    expect(GOVERNANCE_POLICIES.map((p) => p.id)).toEqual([
      "classification",
      "retention",
      "access",
      "metric-certification",
      "change-control",
    ]);
  });

  it("names only platform exports as what applies a rule", () => {
    const applied = GOVERNANCE_POLICIES.flatMap((p) =>
      p.rules.flatMap((r) => (r.appliedBy === null ? [] : [r.appliedBy]))
    );
    expect(applied.length).toBeGreaterThan(0);
    for (const name of applied) expect(EXPORTS.has(name), name).toBe(true);
  });

  it("states the retention periods the product registrations record", () => {
    const years = new Set(contracts.map((c) => c.retention.years));
    expect(years).toEqual(new Set([25, 10]));
    const retention = GOVERNANCE_POLICIES.find((p) => p.id === "retention");
    const text = retention?.rules.map((r) => r.text).join(" ") ?? "";
    for (const contract of contracts) {
      expect(text, contract.id).toContain(`${contract.retention.years} years`);
    }
    expect(text).toContain("Regulation (EU) No 536/2014");
  });
});

describe("business glossary", () => {
  const glossary = businessGlossary();

  it("links every metric to a glossary term", () => {
    for (const metric of METRIC_REGISTRY) {
      const entries = glossary.filter((e) => e.metrics.includes(metric.id));
      expect(
        entries.map((e) => e.key),
        metric.id
      ).toEqual([metric.glossaryTerm]);
    }
  });

  it("lists the terms metrics link and the extra platform terms, by name", () => {
    const keys = new Set(glossary.map((e) => e.key));
    for (const key of BUSINESS_GLOSSARY_EXTRA_TERMS) {
      expect(keys.has(key), key).toBe(true);
    }
    for (const term of [
      "Enrollment",
      "Randomisation",
      "Screen failure",
      "Important protocol deviation",
      "Database lock (DBL)",
      "Treatment-emergent adverse event (TEAE)",
    ]) {
      expect(glossary.map((e) => e.term)).toContain(term);
    }
    const names = glossary.map((e) => e.term.toLowerCase());
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it("carries definitions, synonyms and sources from the site glossary", () => {
    const enrollment = glossary.find((e) => e.key === "enrollment-term");
    expect(enrollment).toMatchObject({
      term: "Enrollment",
      synonyms: ["Enrolment", "Enrolled", "Subjects enrolled"],
      source: "CDISC Glossary",
      metrics: [
        "subjects_enrolled",
        "enrollment_vs_plan",
        "cost_per_enrolled_subject",
      ],
    });
    expect(glossary.find((e) => e.key === "budget-burn-term")?.source).toBe(
      null
    );
    for (const entry of glossary) {
      expect(entry.definition.length, entry.key).toBeGreaterThan(20);
    }
  });

  it("refuses a link to a term the glossary does not hold", () => {
    expect(() =>
      businessGlossary({
        metrics: [{ ...METRIC_REGISTRY[0], glossaryTerm: "no-such-term" }],
      })
    ).toThrow("the glossary has no term no-such-term");
  });

  it("searches terms, synonyms, definitions, sources and metric ids", () => {
    const keys = (text: string) =>
      searchBusinessGlossary(glossary, text).map((e) => e.key);
    expect(keys("")).toEqual(glossary.map((e) => e.key));
    expect(keys("DBL")).toEqual(["database-lock-term"]);
    expect(keys("ich e3")).toEqual([
      "early-termination-term",
      "important-deviation-term",
      "protocol-deviation-term",
    ]);
    expect(keys("open_query_count")).toEqual(["data-query-term"]);
    expect(keys("eligibility screening")).toEqual([
      "screen-failure-term",
      "screening-term",
    ]);
    expect(keys("no such word")).toEqual([]);
  });

  it("never wraps a business term in the site's prose", () => {
    const linked = CANONICAL_GLOSSARY.filter((t) => t.autoLink !== false);
    const platformOnly = CANONICAL_GLOSSARY.filter((t) => t.autoLink === false);
    expect(platformOnly.map((t) => t.key)).toEqual([
      "screening-term",
      "screen-failure-term",
      "enrollment-term",
      "study-start-up-term",
      "enrollment-period-term",
      "randomisation-term",
      "early-termination-term",
      "site-activation-term",
      "event-adjudication-term",
      "visit-window-term",
      "missed-visit-term",
      "data-query-term",
      "monitoring-visit-term",
      "protocol-deviation-term",
      "important-deviation-term",
      "database-lock-term",
      "teae-term",
      "budget-burn-term",
      "forecast-at-completion-term",
    ]);
    const phrases = platformOnly.flatMap((t) => [
      t.canonical,
      ...(t.aliases ?? []),
    ]);
    const others = linked.flatMap((t) => [t.canonical, ...(t.aliases ?? [])]);
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.constantFrom(...phrases),
            fc.constantFrom(...others),
            fc.constantFrom("and", "the", "per", "site", ".", "\n")
          ),
          { maxLength: 30 }
        ),
        (words) => {
          const text = words.join(" ");
          expect(compileTerms(text)).toBe(compileTerms(text, linked));
        }
      ),
      { seed: 2638, numRuns: 200 }
    );
    expect(
      compileTerms("Enrollment, queries and database lock after SDV.")
    ).toBe(
      'Enrollment, queries and database lock after <span data-key="sdv-term" data-term="record verification" data-definition="Source Document Verification. The process of cross-referencing case report forms against original medical records to ensure accuracy.">SDV</span>.'
    );
  });
});

describe("data catalog", () => {
  it("lists every data product and every certified metric once", () => {
    expect(ids(productEntries)).toEqual(products.map((p) => p.id));
    const certified = METRIC_REGISTRY.filter((m) => m.status === "certified");
    expect(certified.length).toBeGreaterThan(0);
    for (const metric of certified) {
      expect(
        metricEntries.filter((e) => e.id === metric.id),
        metric.id
      ).toHaveLength(1);
    }
    expect(ids(metricEntries)).toEqual(METRIC_REGISTRY.map((m) => m.id));
  });

  it("shows each product's contract, roles, classification and consumers", () => {
    for (const p of products) {
      const entry = product(p.id);
      const contract = contracts.find((c) => c.id === p.contractId);
      expect(entry).toMatchObject({
        name: p.name,
        owner: p.owner,
        steward: p.steward,
        stewardshipDomain: stewardshipDomainOf(p.owner),
        layer: p.layer,
        sourceDomain: p.domain,
        classification: p.classification,
        personalHealthData: p.personalHealthData,
        contractId: contract?.id,
        contractVersion: contract?.version,
        sla: contract?.sla,
        retention: contract?.retention,
        upstream: p.upstream,
        consumers: p.consumers,
      });
    }
    expect(product("gold.fct_monitoring_visit").contractVersion).toBe("1.1.0");
  });

  it("shows whether each product met its contract at the last check", () => {
    expect(new Set(productEntries.map((e) => e.slaStatus))).toEqual(
      new Set(["met"])
    );
    const late = dataCatalog({
      products,
      contracts,
      contractResults: checkDataContracts(
        contracts,
        contractData(warehouse, run),
        { loadedAt: warehouse.asOf, evaluatedAt: "2099-01-01T00:00:00Z" }
      ),
    }).filter((e): e is DataCatalogProduct => e.kind === "product");
    for (const entry of late) {
      expect(entry.slaStatus, entry.id).toBe("missed");
      expect(entry.slaFindings.length, entry.id).toBeGreaterThan(0);
    }
    const unchecked = dataCatalog({ products, contracts });
    for (const entry of unchecked) {
      if (entry.kind !== "product") continue;
      expect(entry).toMatchObject({
        slaStatus: "unchecked",
        slaFindings: [],
        dqScore: null,
        dqRules: 0,
        lineageDatasets: [],
      });
    }
  });

  it("shows each product's data quality score", () => {
    for (const score of quality.byProduct) {
      expect(product(score.key)).toMatchObject({
        dqScore: score.score,
        dqRules: score.rules,
      });
    }
    const scored = new Set(quality.byProduct.map((s) => s.key));
    for (const entry of productEntries.filter((e) => !scored.has(e.id))) {
      expect(entry.dqScore, entry.id).toBeNull();
    }
    expect(product(STUDY_DATA_PRODUCT_ID).dqRules).toBeGreaterThan(0);
  });

  it("links every product and metric into the lineage graph", () => {
    const datasets = new Set(lineage.nodes.map((n) => n.dataset));
    const nodes = new Set(lineage.nodes.map((n) => n.id));
    for (const entry of productEntries) {
      expect(entry.lineageDatasets.length, entry.id).toBeGreaterThan(0);
      for (const d of entry.lineageDatasets) {
        expect(datasets.has(d), d).toBe(true);
      }
    }
    expect(product("silver.edc_query").lineageDatasets).toEqual([
      "silver.edc_query",
    ]);
    const study = product(STUDY_DATA_PRODUCT_ID).lineageDatasets;
    expect(study).toContain("sdtm.DM");
    expect(study).toContain("adam.ADSL");
    expect(study.every((d) => /^(sdtm|adam)\./.test(d))).toBe(true);
    for (const entry of metricEntries) {
      expect(entry.lineageNode).toBe(`${METRICS_DATASET}.${entry.id}`);
      expect(nodes.has(entry.lineageNode ?? ""), entry.id).toBe(true);
    }
  });

  it("shows each metric's glossary term, sources and reports", () => {
    for (const metric of METRIC_REGISTRY) {
      const entry = metricEntries.find((e) => e.id === metric.id);
      const term = CANONICAL_GLOSSARY.find(
        (t) => t.key === metric.glossaryTerm
      );
      expect(entry?.glossaryTerm, metric.id).toEqual({
        key: term?.key,
        term: term?.canonical,
      });
      expect(entry?.sources, metric.id).toEqual(
        products
          .filter((p) =>
            p.consumers.some((c) => c.kind === "metric" && c.id === metric.id)
          )
          .map((p) => p.id)
      );
      expect(entry?.sources.length, metric.id).toBeGreaterThan(0);
      expect(entry?.reports, metric.id).toEqual(
        reports.filter((r) => r.metrics.includes(metric.id)).map((r) => r.id)
      );
      expect(entry).toMatchObject({
        owner: metric.owner,
        steward: metric.steward,
        status: metric.status,
        version: metric.version,
        unit: metric.unit,
      });
    }
    expect(
      metricEntries.find((e) => e.id === "enrollment_vs_plan")?.sources
    ).toEqual(["gold.dim_site", "gold.fct_enrollment"]);
  });

  it("refuses a product without a contract or a role outside the domains", () => {
    expect(() =>
      dataCatalog({ products, contracts: contracts.slice(1) })
    ).toThrow(
      `data product ${products[0].id} has no contract ${products[0].contractId}`
    );
    expect(() =>
      dataCatalog({
        products: [{ ...products[0], owner: "Unknown Lead" }],
        contracts,
        metrics: [],
      })
    ).toThrow("no stewardship domain holds the role Unknown Lead");
  });
});

describe("data catalog search and facets", () => {
  const search = (query: Parameters<typeof searchDataCatalog>[1]) =>
    ids(searchDataCatalog(catalog, query));

  it("matches every word of the text, ignoring case", () => {
    expect(search({})).toEqual(ids(catalog));
    expect(search({ text: "  " })).toEqual(ids(catalog));
    expect(search({ text: "QUERY facts" })).toEqual(["gold.fct_query"]);
    expect(search({ text: "data query" })).toEqual(
      expect.arrayContaining([
        "query_rate_per_100_visits",
        "open_query_count",
        "query_aging_mean",
        "query_resolution_time_median",
      ])
    );
    // The safety lead owns the adjudication feed, its fact and its metrics
    // (#2881), and the adverse event feed and its fact (#2956).
    expect(search({ text: "medical safety" })).toEqual([
      "silver.edc_adverse_event",
      "silver.cec_adjudication",
      "gold.fct_cec_adjudication",
      "gold.fct_adverse_event",
      "cec_events_reported",
      "cec_events_adjudicated",
      "cec_adjudication_backlog",
      "cec_adjudication_time_median",
    ]);
    // The backlog says why a waiting event matters: it holds up the lock.
    expect(search({ text: "Database lock" })).toEqual([
      "cec_adjudication_backlog",
      "lplv_to_dbl_days",
    ]);
    expect(search({ text: "eTMF documents" })).toEqual([
      "silver.etmf_document",
    ]);
    expect(search({ text: "no such thing" })).toEqual([]);
  });

  it("finds an entry by its stewardship domain name", () => {
    const finance = search({ text: "finance" });
    for (const entry of catalog.filter(
      (e) => e.stewardshipDomain === "finance"
    )) {
      expect(finance).toContain(entry.id);
    }
  });

  it("filters by each facet", () => {
    const oracle = (keep: (e: DataCatalogEntry) => boolean) =>
      ids(catalog.filter(keep));
    expect(search({ kinds: ["metric"] })).toEqual(ids(metricEntries));
    expect(search({ stewardshipDomains: ["safety", "finance"] })).toEqual(
      oracle(
        (e) =>
          e.stewardshipDomain === "safety" || e.stewardshipDomain === "finance"
      )
    );
    expect(search({ layers: ["silver"] })).toEqual(
      oracle((e) => e.kind === "product" && e.layer === "silver")
    );
    expect(search({ classifications: ["restricted"] })).toEqual(
      oracle((e) => e.kind === "product" && e.classification === "restricted")
    );
    expect(search({ classifications: ["restricted"] }).length).toBeGreaterThan(
      0
    );
    expect(search({ slaStatuses: ["met"] })).toEqual(ids(productEntries));
    expect(search({ slaStatuses: ["missed"] })).toEqual([]);
    expect(search({ metricStatuses: ["certified"] })).toEqual(
      oracle((e) => e.kind === "metric" && e.status === "certified")
    );
    expect(search({ kinds: [], layers: [] })).toEqual(ids(catalog));
  });

  it("combines text and facets", () => {
    expect(
      search({ text: "query", kinds: ["product"], layers: ["silver"] })
    ).toEqual(["silver.edc_query"]);
    expect(search({ text: "enrolled", metricStatuses: ["certified"] })).toEqual(
      expect.arrayContaining(["subjects_enrolled", "cost_per_enrolled_subject"])
    );
  });

  it("counts every facet value in order, including values nobody takes", () => {
    const facets = dataCatalogFacets(catalog);
    expect(facets.kinds).toEqual([
      { value: "product", count: productEntries.length },
      { value: "metric", count: metricEntries.length },
    ]);
    expect(facets.stewardshipDomains.map((f) => f.value)).toEqual(
      GOVERNANCE_DOMAINS.map((d) => d.id)
    );
    expect(facets.layers).toEqual([
      { value: "bronze", count: 0 },
      {
        value: "silver",
        count: productEntries.filter((e) => e.layer === "silver").length,
      },
      {
        value: "gold",
        count: productEntries.filter((e) => e.layer === "gold").length,
      },
    ]);
    expect(facets.classifications.map((f) => f.value)).toEqual([
      "public",
      "internal",
      "confidential",
      "restricted",
    ]);
    expect(facets.slaStatuses).toEqual([
      { value: "met", count: productEntries.length },
      { value: "missed", count: 0 },
      { value: "unchecked", count: 0 },
    ]);
    expect(facets.metricStatuses.map((f) => f.value)).toEqual([
      "draft",
      "certified",
      "deprecated",
    ]);
    const total = (counts: readonly { count: number }[]) =>
      counts.reduce((sum, c) => sum + c.count, 0);
    expect(total(facets.stewardshipDomains)).toBe(catalog.length);
    expect(total(facets.classifications)).toBe(productEntries.length);
    expect(total(facets.metricStatuses)).toBe(metricEntries.length);
    expect(
      dataCatalogFacets(searchDataCatalog(catalog, { text: "query" }))
    ).toMatchObject({
      kinds: [
        { value: "product", count: 2 },
        // The query rate, count, aging and resolution time, and the four
        // query age bands (#2759).
        { value: "metric", count: 8 },
      ],
    });
  });
});

describe("governance copy", () => {
  it("makes no compliance or validation claim", () => {
    const text = [
      ...GOVERNANCE_DOMAINS.flatMap((d) => [d.name, d.summary]),
      ...STEWARDSHIP_ROLES.flatMap((r) => [r.name, r.heldBy, ...r.duties]),
      ...GOVERNANCE_DECISIONS.flatMap((d) => [d.name, d.when]),
      ...GOVERNANCE_POLICIES.flatMap((p) => [
        p.title,
        p.purpose,
        ...p.rules.map((r) => r.text),
      ]),
      ...businessGlossary().map((e) => e.definition),
    ].join("\n");
    expect(checkRegulatoryWording(text)).toEqual([]);
    expect(findClinicalClaims(text)).toEqual([]);
  });
});
