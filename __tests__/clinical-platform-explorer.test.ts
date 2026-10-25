// @vitest-environment node
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  EXPLORATION_HASH_MAX_LENGTH,
  EXPLORATION_OWNER,
  EXPLORER_MAX_BARS,
  EXPLORER_VISUALS,
  METRIC_DIMENSIONS,
  METRIC_REGISTRY,
  REPORT_PACK,
  buildWarehouse,
  checkExploration,
  checkRegulatoryWording,
  checkReportSpec,
  decodeExploration,
  encodeExploration,
  evaluateMetric,
  explorationChoices,
  explorationCsv,
  explorationSpec,
  explorerMetrics,
  findClinicalClaims,
  generatePortfolio,
  normalizeExploration,
  promotionSteps,
  runExploration,
  startExploration,
  suggestVisual,
  type Exploration,
  type MetricDefinition,
  type MetricDimensionId,
  type ReportSpec,
} from "@/lib/clinical-platform";

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const DIMENSIONS = METRIC_DIMENSIONS.map((d) => d.id);

function metric(id: string): MetricDefinition {
  const found = METRIC_REGISTRY.find((m) => m.id === id);
  if (found === undefined) throw new Error(`no metric ${id}`);
  return found;
}

const explore = (overrides: Partial<Exploration> & { metricId: string }) => ({
  ...startExploration(overrides.metricId),
  ...overrides,
});

/** Whether the semantic layer's rules allow grouping a metric this way. */
function allowed(m: MetricDefinition, dims: readonly MetricDimensionId[]) {
  return (
    dims.length <= 2 &&
    new Set(dims).size === dims.length &&
    dims.every((d) => m.allowedDimensions.includes(d)) &&
    (m.grain !== "study" || dims.includes("study"))
  );
}

/** Every grouping the explorer offers a metric, by walking its choices from the start. */
function offered(m: MetricDefinition): MetricDimensionId[][] {
  const seen = new Map<string, MetricDimensionId[]>();
  const visit = (dims: MetricDimensionId[]) => {
    if (seen.has(dims.join(","))) return;
    seen.set(dims.join(","), dims);
    const choices = explorationChoices({
      metricId: m.id,
      dimensions: dims,
      filters: [],
      visual: null,
    });
    for (const d of choices.addDimensions) visit([...dims, d]);
    for (const d of choices.removeDimensions) {
      visit(dims.filter((other) => other !== d));
    }
  };
  visit(startExploration(m.id).dimensions as MetricDimensionId[]);
  return [...seen.values()];
}

describe("metrics the explorer offers", () => {
  it("offers every registry metric that is not deprecated, in registry order", () => {
    expect(explorerMetrics().map((m) => m.id)).toEqual(
      METRIC_REGISTRY.filter((m) => m.status !== "deprecated").map((m) => m.id)
    );
    const retired: MetricDefinition = {
      ...metric("subjects_enrolled"),
      status: "deprecated",
    };
    const registry = METRIC_REGISTRY.map((m) =>
      m.id === retired.id ? retired : m
    );
    expect(explorerMetrics(registry).map((m) => m.id)).not.toContain(
      retired.id
    );
    expect(checkExploration(startExploration(retired.id), [retired])).toEqual([
      {
        field: "metric",
        message:
          "The explorer does not offer a metric called subjects_enrolled.",
      },
    ]);
  });

  it("starts each metric at one total, or by study when it is defined per study", () => {
    for (const m of METRIC_REGISTRY) {
      const start = startExploration(m.id);
      expect(start.dimensions, m.id).toEqual(
        m.grain === "study" ? ["study"] : []
      );
      expect(checkExploration(start), m.id).toEqual([]);
    }
    expect(() => startExploration("no_such_metric")).toThrow(
      "the explorer does not offer metric no_such_metric"
    );
  });
});

describe("only valid combinations can be built", () => {
  it("accepts a grouping exactly when the semantic layer allows it, for every metric and pair of dimensions", () => {
    const groupings: MetricDimensionId[][] = [
      [],
      ...DIMENSIONS.map((d) => [d]),
      ...DIMENSIONS.flatMap((a) => DIMENSIONS.map((b) => [a, b])),
    ];
    let accepted = 0;
    for (const m of METRIC_REGISTRY) {
      for (const dims of groupings) {
        const findings = checkExploration({
          metricId: m.id,
          dimensions: dims,
          filters: [],
          visual: null,
        });
        expect(findings.length === 0, `${m.id} by ${dims.join(",")}`).toBe(
          allowed(m, dims)
        );
        if (findings.length === 0) accepted += 1;
      }
    }
    expect(accepted).toBeGreaterThan(METRIC_REGISTRY.length * 10);
  });

  it("offers exactly the allowed groupings, and nothing it cannot build", () => {
    for (const m of METRIC_REGISTRY) {
      const reached = offered(m)
        .map((dims) => dims.join(","))
        .sort();
      const expected = [
        [],
        ...m.allowedDimensions.map((d) => [d]),
        ...m.allowedDimensions.flatMap((a) =>
          m.allowedDimensions.map((b) => [a, b])
        ),
      ]
        // A study grain metric keeps study as its first grouping.
        .filter(
          (dims) =>
            allowed(m, dims) && (m.grain !== "study" || dims[0] === "study")
        )
        .map((dims) => dims.join(","))
        .sort();
      expect(reached, m.id).toEqual(expected);
    }
  });

  it("offers only the visuals that pass the reporting rules for the grouping", () => {
    for (const m of METRIC_REGISTRY) {
      for (const dims of offered(m)) {
        const base = { metricId: m.id, dimensions: dims, filters: [] };
        const choices = explorationChoices({ ...base, visual: null });
        for (const visual of EXPLORER_VISUALS) {
          const spec = explorationSpec({ ...base, visual }, visual);
          const fits = checkReportSpec(spec).every((f) => f.rule !== "visual");
          expect(
            choices.visuals.includes(visual),
            `${m.id} ${dims} ${visual}`
          ).toBe(fits);
          expect(
            checkExploration({ ...base, visual }).some(
              (f) => f.field === "visual"
            ),
            `${m.id} ${dims} ${visual}`
          ).toBe(!fits);
        }
      }
    }
  });

  it("keeps the grouping a study grain metric needs", () => {
    const m = METRIC_REGISTRY.find((d) => d.grain === "study")!;
    const choices = explorationChoices(explore({ metricId: m.id }));
    expect(choices.removeDimensions).toEqual([]);
    expect(
      explorationChoices(
        explore({ metricId: m.id, dimensions: ["study", "phase"] })
      ).removeDimensions
    ).toEqual(["phase"]);
  });

  it("names what is wrong in words a visitor can act on", () => {
    expect(
      checkExploration(
        explore({ metricId: "enrollment_vs_plan", dimensions: ["month"] })
      )
    ).toEqual([
      {
        field: "dimensions",
        message: "Enrollment vs plan cannot be grouped by month.",
      },
    ]);
    expect(
      checkExploration(explore({ metricId: "fpi_to_lpi_days", dimensions: [] }))
    ).toEqual([
      {
        field: "dimensions",
        message: `${metric("fpi_to_lpi_days").name} is defined per study, so group it by study.`,
      },
    ]);
    expect(
      checkExploration(
        explore({
          metricId: "subjects_enrolled",
          dimensions: ["study", "site", "country"],
        })
      )
    ).toEqual([
      {
        field: "dimensions",
        message: "Group by at most 2 dimensions; this groups by 3.",
      },
    ]);
    expect(
      checkExploration(
        explore({ metricId: "subjects_enrolled", dimensions: ["site", "site"] })
      )
    ).toEqual([
      { field: "dimensions", message: "Group by each dimension once." },
    ]);
    expect(
      checkExploration(
        explore({
          metricId: "subjects_enrolled",
          filters: [
            { dimension: "vendor", operator: "in", values: ["x"] },
            { dimension: "region", operator: "in", values: [] },
            { dimension: "country", operator: "in", values: ["US"] },
            { dimension: "country", operator: "in", values: ["DE"] },
          ],
        })
      )
    ).toEqual([
      { field: "filters", message: "Filter each dimension once." },
      {
        field: "filters",
        message: "Subjects enrolled cannot be filtered by vendor.",
      },
      { field: "filters", message: "The region filter lists no values." },
    ]);
    expect(
      checkExploration(
        explore({ metricId: "subjects_enrolled", visual: "bar" })
      )
    ).toEqual([
      {
        field: "visual",
        message: "A bar cannot draw this grouping. Choose one of: stat, table.",
      },
    ]);
  });
});

describe("results", () => {
  it("equal the governed metric's own values for a seeded sample of combinations", () => {
    const combos = METRIC_REGISTRY.flatMap((m) =>
      offered(m).map((dims) => ({ m, dims }))
    );
    const sample = fc.sample(fc.constantFrom(...combos), {
      numRuns: 40,
      seed: 2634,
    });
    for (const { m, dims } of sample) {
      const result = runExploration(
        warehouse,
        explore({ metricId: m.id, dimensions: dims })
      );
      const expected = evaluateMetric(warehouse, m, { dimensions: dims }).rows;
      expect(
        result.report.rows.map((row) => [row.labels, row.cells[0].value]),
        `${m.id} by ${dims.join(",")}`
      ).toEqual(
        expected.map((row) => [
          dims.map((d) => row.dimensions[d] ?? ""),
          row.value,
        ])
      );
    }
  });

  it("counts enrolled subjects by region as the enrollment rows do", () => {
    const regions = new Map(
      warehouse.tables["gold.dim_country"].map((c) => [
        c.country_key,
        String(c.region),
      ])
    );
    const counts = new Map<string, number>();
    for (const row of warehouse.tables["gold.fct_enrollment"]) {
      if (row.event_type !== "enrolled") continue;
      const region = regions.get(row.country_key) ?? "";
      counts.set(region, (counts.get(region) ?? 0) + 1);
    }
    const result = runExploration(
      warehouse,
      explore({ metricId: "subjects_enrolled", dimensions: ["region"] })
    );
    expect(
      Object.fromEntries(
        result.report.rows.map((r) => [r.labels[0], r.cells[0].value])
      )
    ).toEqual(Object.fromEntries(counts));
    expect(result.report.rows.length).toBe(4);
  });

  it("applies a filter and replaces the metric's default filter on the same dimension", () => {
    const m = metric("open_query_count");
    expect(m.defaultFilters).toEqual([
      { dimension: "study_status", operator: "not-in", values: ["closed"] },
    ]);
    const kept = runExploration(
      warehouse,
      explore({ metricId: m.id, dimensions: ["study"] })
    );
    expect(kept.defaultFilters).toEqual(m.defaultFilters);
    expect(kept.replacedDefaults).toEqual([]);
    const all = runExploration(
      warehouse,
      explore({
        metricId: m.id,
        dimensions: ["study"],
        filters: [
          {
            dimension: "study_status",
            operator: "in",
            values: kept.filterValues.study_status ?? [],
          },
        ],
      })
    );
    expect(all.defaultFilters).toEqual([]);
    expect(all.replacedDefaults).toEqual(m.defaultFilters);
    expect(all.report.rows.length).toBeGreaterThanOrEqual(
      kept.report.rows.length
    );
    expect(all.report.calculations[0].sql).not.toMatch(/NOT IN \('closed'\)/);
    expect(kept.report.calculations[0].sql).toMatch(/NOT IN \('closed'\)/);
    const europe = runExploration(
      warehouse,
      explore({
        metricId: "subjects_enrolled",
        dimensions: ["country"],
        filters: [{ dimension: "region", operator: "in", values: ["Europe"] }],
      })
    );
    const european = new Set(
      warehouse.tables["gold.dim_country"]
        .filter((c) => c.region === "Europe")
        .map((c) => c.country_code)
    );
    expect(europe.report.rows.length).toBeGreaterThan(0);
    for (const row of europe.report.rows)
      expect(european.has(row.labels[0])).toBe(true);
  });

  it("lists the values each filterable dimension takes, sorted", () => {
    const result = runExploration(
      warehouse,
      explore({ metricId: "budget_burn_vs_plan", dimensions: ["vendor"] })
    );
    expect(Object.keys(result.filterValues)).toEqual(
      DIMENSIONS.filter((d) =>
        metric("budget_burn_vs_plan").allowedDimensions.includes(d)
      )
    );
    for (const values of Object.values(result.filterValues)) {
      expect(values).toEqual([...new Set(values)].sort());
      expect(values?.length).toBeGreaterThan(0);
    }
    expect(result.filterValues.region).toBeUndefined();
    expect(result.filterValues.vendor).toContain(
      "Not applicable (investigator grants)"
    );
  });

  it("shows the definition, version, tier and SQL behind every result", () => {
    const result = runExploration(
      warehouse,
      explore({ metricId: "screen_failure_rate", dimensions: ["phase"] })
    );
    const m = metric("screen_failure_rate");
    expect(result.spec.tier).toBe("exploratory");
    expect(result.report.columns).toEqual([
      {
        metricId: m.id,
        name: m.name,
        unit: m.unit,
        version: m.version,
        status: m.status,
      },
    ]);
    expect(result.report.calculations[0]).toMatchObject({
      metricId: m.id,
      version: m.version,
      description: m.description,
    });
    expect(result.report.calculations[0].sql).toMatch(/GROUP BY/);
    expect(result.report.dataCut).toBe(warehouse.asOf);
  });
});

describe("suggested visual", () => {
  it("suggests by the shape of the data", () => {
    expect(suggestVisual([], 1)).toBe("stat");
    expect(suggestVisual(["month"], 24)).toBe("line");
    expect(suggestVisual(["month"], 1)).toBe("bar");
    expect(suggestVisual(["phase"], EXPLORER_MAX_BARS)).toBe("bar");
    expect(suggestVisual(["site"], EXPLORER_MAX_BARS + 1)).toBe("table");
    expect(suggestVisual(["study", "site"], 3)).toBe("table");
  });

  it("draws the suggestion unless a visual is chosen, and every suggestion passes the rules", () => {
    for (const [dims, visual] of [
      [[], "stat"],
      [["month"], "line"],
      [["region"], "bar"],
      [["site"], "table"],
      [["study", "region"], "table"],
    ] as const) {
      const result = runExploration(
        warehouse,
        explore({ metricId: "subjects_enrolled", dimensions: [...dims] })
      );
      expect(result.suggestedVisual, dims.join(",")).toBe(visual);
      expect(result.spec.visual).toBe(visual);
      expect(checkReportSpec(result.spec)).toEqual([]);
    }
    const chosen = runExploration(
      warehouse,
      explore({
        metricId: "subjects_enrolled",
        dimensions: ["month"],
        visual: "table",
      })
    );
    expect(chosen.suggestedVisual).toBe("line");
    expect(chosen.spec.visual).toBe("table");
    expect(chosen.report.scale).toBeNull();
    const bar = runExploration(
      warehouse,
      explore({ metricId: "subjects_enrolled", dimensions: ["region"] })
    );
    expect(bar.report.scale?.ticks.length).toBeGreaterThan(1);
  });

  it("refuses to run an exploration the rules reject", () => {
    expect(() =>
      runExploration(
        warehouse,
        explore({ metricId: "subjects_enrolled", visual: "line" })
      )
    ).toThrow("A line cannot draw this grouping. Choose one of: stat, table.");
  });
});

describe("exploratory report spec", () => {
  it("is an unreviewed, unowned draft that passes the reporting rules", () => {
    const spec = explorationSpec(
      explore({ metricId: "query_aging_mean", dimensions: ["study", "site"] }),
      "table"
    );
    expect(spec).toMatchObject({
      id: "exploration-query-aging-mean",
      title: `${metric("query_aging_mean").name} by study and site`,
      tier: "exploratory",
      owner: EXPLORATION_OWNER,
      version: "0.1.0",
      signOff: null,
    });
    expect(checkReportSpec(spec)).toEqual([]);
    expect(
      explorationSpec(explore({ metricId: "subjects_enrolled" }), "stat").title
    ).toBe("Subjects enrolled");
    const copy = `${spec.audience} ${spec.purpose}`;
    expect(checkRegulatoryWording(copy)).toEqual([]);
    expect(findClinicalClaims(copy)).toEqual([]);
  });
});

describe("saved in the URL hash", () => {
  const sample: Exploration = {
    metricId: "open_query_count",
    dimensions: ["study", "site"],
    filters: [],
    visual: "table",
  };

  it("writes a readable, canonical hash", () => {
    expect(encodeExploration(sample)).toBe(
      "metric=open_query_count&by=study&by=site&visual=table"
    );
    expect(
      encodeExploration({
        metricId: "subjects_enrolled",
        dimensions: ["country"],
        filters: [
          {
            dimension: "region",
            operator: "in",
            values: ["Europe", "Asia-Pacific", "Europe"],
          },
          { dimension: "study", operator: "not-in", values: ["DEMO-401"] },
        ],
        visual: null,
      })
    ).toBe(
      "metric=subjects_enrolled&by=country&out.study=DEMO-401&in.region=Asia-Pacific&in.region=Europe"
    );
  });

  it("reads back every exploration it writes", () => {
    const values = (id: MetricDimensionId) =>
      runExploration(warehouse, startExploration("subjects_enrolled"))
        .filterValues[id] ?? [];
    const exploration = fc
      .record({
        m: fc.constantFrom(...METRIC_REGISTRY),
        pick: fc.nat(),
        filter: fc.option(
          fc.record({
            index: fc.nat(),
            out: fc.boolean(),
            take: fc.integer({ min: 1, max: 3 }),
          }),
          { nil: null }
        ),
        visual: fc.boolean(),
      })
      .map(({ m, pick, filter, visual }): Exploration => {
        const groupings = offered(m);
        const dims = groupings[pick % groupings.length];
        const filterable = m.allowedDimensions;
        const filters =
          filter === null
            ? []
            : (() => {
                const dimension = filterable[filter.index % filterable.length];
                const pool = values(dimension);
                return [
                  {
                    dimension,
                    operator: filter.out
                      ? ("not-in" as const)
                      : ("in" as const),
                    values: pool.slice(0, filter.take),
                  },
                ].filter((f) => f.values.length > 0);
              })();
        const visuals = explorationChoices({
          metricId: m.id,
          dimensions: dims,
          filters,
          visual: null,
        }).visuals;
        return {
          metricId: m.id,
          dimensions: dims,
          filters,
          visual: visual ? visuals[visuals.length - 1] : null,
        };
      });
    fc.assert(
      fc.property(exploration, (e) => {
        const decoded = decodeExploration(`#${encodeExploration(e)}`);
        expect(decoded).toEqual({
          ok: true,
          exploration: normalizeExploration(e),
        });
      }),
      { numRuns: 150, seed: 2634 }
    );
  });

  it("keeps values with spaces, commas and symbols intact", () => {
    const e: Exploration = {
      metricId: "budget_burn_vs_plan",
      dimensions: ["vendor"],
      filters: [
        {
          dimension: "vendor",
          operator: "in",
          values: ["Not applicable (investigator grants)", "A, B & C=1+2"],
        },
      ],
      visual: null,
    };
    expect(decodeExploration(encodeExploration(e))).toEqual({
      ok: true,
      exploration: normalizeExploration(e),
    });
  });

  it.each([
    ["", "The link must name exactly one metric."],
    ["by=study", "The link must name exactly one metric."],
    ["metric=a&metric=b", "The link must name exactly one metric."],
    ["metric=no_such", "The explorer does not offer a metric called no_such."],
    [
      "metric=subjects_enrolled&by=planet",
      "The link groups by planet, which is not a dimension.",
    ],
    [
      "metric=subjects_enrolled&in.planet=x",
      "The link filters by planet, which is not a dimension.",
    ],
    [
      "metric=subjects_enrolled&sort=desc",
      "The link has a part the explorer does not know: sort.",
    ],
    [
      "metric=subjects_enrolled&in.region.x=1",
      "The link has a part the explorer does not know: in.region.x.",
    ],
    [
      "metric=subjects_enrolled&in.region=",
      "The link's region filter has an empty value.",
    ],
    [
      "metric=subjects_enrolled&in.region=Europe&out.region=Asia-Pacific",
      "The link both keeps and drops values of region.",
    ],
    [
      "metric=subjects_enrolled&visual=pie",
      "The link asks for a pie visual, which the explorer does not draw.",
    ],
    [
      "metric=subjects_enrolled&visual=stat&visual=table",
      "The link names more than one visual.",
    ],
    [
      "metric=enrollment_vs_plan&by=month",
      "Enrollment vs plan cannot be grouped by month.",
    ],
    [
      "metric=subjects_enrolled&visual=line",
      "A line cannot draw this grouping. Choose one of: stat, table.",
    ],
  ])("refuses %j", (hash, error) => {
    expect(decodeExploration(hash)).toEqual({ ok: false, error });
  });

  it("refuses a hash too long to be a real exploration, without parsing it", () => {
    const long = `metric=subjects_enrolled&${"in.region=Europe&".repeat(400)}`;
    expect(long.length).toBeGreaterThan(EXPLORATION_HASH_MAX_LENGTH);
    expect(decodeExploration(long)).toEqual({
      ok: false,
      error: `The link is longer than ${EXPLORATION_HASH_MAX_LENGTH} characters, so the explorer did not read it.`,
    });
  });
});

describe("CSV download", () => {
  it("writes one row per group with unformatted values and CRLF line ends", () => {
    const result = runExploration(
      warehouse,
      explore({ metricId: "screen_failure_rate", dimensions: ["region"] })
    );
    const csv = explorationCsv(result.report);
    const lines = csv.split("\r\n");
    expect(lines.at(-1)).toBe("");
    expect(lines[0]).toBe(
      "Region,Screen failure rate (share of screened subjects)"
    );
    expect(lines.slice(1, -1)).toEqual(
      result.report.rows.map((row) => `${row.labels[0]},${row.cells[0].value}`)
    );
    expect(csv).not.toMatch(/%/);
  });

  it("quotes text that needs it, leaves undefined values empty and never writes a formula", () => {
    const report = runExploration(
      warehouse,
      explore({ metricId: "subjects_enrolled", dimensions: ["region"] })
    ).report;
    const tricky = {
      ...report,
      dimensionLabels: ['Site, "name"'],
      rows: [
        {
          key: "a",
          labels: ["=HYPERLINK(1)"],
          cells: [{ value: null, text: "" }],
        },
        { key: "b", labels: ["-2+3"], cells: [{ value: -1.5, text: "" }] },
        { key: "c", labels: ["line\nbreak"], cells: [{ value: 0, text: "" }] },
      ],
    };
    expect(explorationCsv(tricky).split("\r\n")).toEqual([
      '"Site, ""name""",Subjects enrolled (subjects)',
      "'=HYPERLINK(1),",
      "'-2+3,-1.5",
      '"line\nbreak",0',
      "",
    ]);
  });
});

describe("promotion checklist", () => {
  it("lists what a person has to do before an exploration becomes a managed or certified report", () => {
    const spec = runExploration(
      warehouse,
      explore({ metricId: "subjects_enrolled", dimensions: ["region"] })
    ).spec;
    const steps = promotionSteps(spec);
    expect(steps.map((s) => [s.id, s.tier, s.status])).toEqual([
      ["rules", "managed", "met"],
      ["owner", "managed", "to-do"],
      ["audience", "managed", "to-do"],
      ["release", "managed", "to-do"],
      ["certified-metrics", "certified", "met"],
      ["sign-off", "certified", "to-do"],
    ]);
    for (const step of steps) {
      expect(
        checkRegulatoryWording(`${step.label} ${step.detail}`),
        step.id
      ).toEqual([]);
      expect(
        findClinicalClaims(`${step.label} ${step.detail}`),
        step.id
      ).toEqual([]);
    }
  });

  it("finds every step met on the pack's certified reports, and the managed steps on its managed ones", () => {
    const certified = REPORT_PACK.filter((r) => r.tier === "certified");
    const managed = REPORT_PACK.filter((r) => r.tier === "managed");
    expect(certified.length).toBeGreaterThan(0);
    expect(managed.length).toBeGreaterThan(0);
    for (const spec of certified) {
      expect(
        promotionSteps(spec).filter((s) => s.status !== "met"),
        spec.id
      ).toEqual([]);
    }
    for (const spec of managed) {
      expect(
        promotionSteps(spec).filter(
          (s) => s.tier === "managed" && s.status !== "met"
        ),
        spec.id
      ).toEqual([]);
    }
  });

  it("names uncertified metrics, rule findings and a stale sign-off", () => {
    const draft: MetricDefinition = {
      ...metric("subjects_enrolled"),
      status: "draft",
    };
    const registry = METRIC_REGISTRY.map((m) =>
      m.id === draft.id ? draft : m
    );
    const spec: ReportSpec = {
      ...explorationSpec(explore({ metricId: "subjects_enrolled" }), "stat"),
      version: "1.1.0",
      signOff: {
        role: "Clinical Operations Lead",
        date: "2026-09-30",
        version: "1.0.0",
      },
    };
    const steps = Object.fromEntries(
      promotionSteps(spec, registry).map((s) => [s.id, s])
    );
    expect(steps["certified-metrics"]).toMatchObject({
      status: "to-do",
      detail: "These metrics are not certified: Subjects enrolled.",
    });
    expect(steps["sign-off"].status).toBe("to-do");
    expect(steps.release.status).toBe("met");
    const broken = promotionSteps({ ...spec, visual: "line" }, registry)[0];
    expect(broken).toMatchObject({ id: "rules", status: "to-do" });
    expect(broken.detail).toMatch(
      /^Fix what the rules find: a line report groups by the month dimension alone\.$/
    );
  });
});
