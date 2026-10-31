import fc from "fast-check";
import { fromAny } from "@total-typescript/shoehorn";
import { describe, expect, it } from "vitest";
import {
  CONFORMANCE_RULES,
  DEMO_301_STUDY,
  MESSY_DATA_SCENARIOS,
  runConformance,
  runPipeline,
  type ConformanceRule,
  type Dataset,
  type VariableMeta,
} from "@/lib/study-data";

const datasets = runPipeline(DEMO_301_STUDY, {
  seed: 301,
  nSubjects: 90,
}).datasets;
function mini(
  name: string,
  layer: "sdtm" | "adam",
  row: Record<string, string | number | null>
): Dataset {
  const variables: VariableMeta[] = Object.keys(row).map((variable) => ({
    name: variable,
    label: variable,
    type: typeof row[variable] === "number" ? "float" : "text",
    origin: "Assigned",
  }));
  return {
    name,
    label: name,
    layer,
    class: layer === "adam" ? "ADaM" : "Special Purpose",
    keys: ["USUBJID"],
    variables,
    columns: Object.fromEntries(
      Object.entries(row).map(([variable, value]) => [variable, [value]])
    ),
    rowCount: 1,
  };
}
function set(
  dataset: Dataset,
  variable: string,
  row: number,
  value: string | number | null
): Dataset {
  return {
    ...dataset,
    columns: {
      ...dataset.columns,
      [variable]: dataset.columns[variable].map((old, index) =>
        index === row ? value : old
      ),
    },
  };
}
function baseFor(rule: ConformanceRule): {
  good: Dataset;
  context: readonly Dataset[];
} {
  if (rule.kind === "lineage") {
    const good = datasets.find(
      (item) =>
        item.layer === rule.scope.layer && item.name === rule.scope.domain
    )!;
    return { good, context: datasets };
  }
  if (rule.scope.layer === "sdtm") {
    const domain = datasets.find(
      (item) => item.layer === "sdtm" && item.name === rule.scope.domain
    )!;
    if (rule.kind === "exception") {
      if (rule.id === "SD-031")
        return {
          good: {
            ...domain,
            columns: {
              ...domain.columns,
              SVSTDY: domain.columns.SVSTDY.map(() => null),
            },
          },
          context: datasets,
        };
      if (rule.id === "SD-032")
        return {
          good: {
            ...domain,
            columns: {
              ...domain.columns,
              LBNRIND: domain.columns.LBNRIND.map(() => "NORMAL"),
            },
          },
          context: datasets,
        };
      if (rule.id === "SD-033")
        return {
          good: {
            ...domain,
            columns: {
              ...domain.columns,
              AESTDTC: domain.columns.AESTDTC.map(() => "2030-01-01"),
            },
          },
          context: datasets,
        };
      return {
        good: {
          ...domain,
          columns: {
            ...domain.columns,
            AESTDY: domain.columns.AESTDY.map(() => 1),
          },
        },
        context: datasets,
      };
    }
    return { good: domain, context: datasets };
  }
  if (rule.scope.domain === "ADSL") {
    const good = mini("ADSL", "adam", {
      STUDYID: "DEMO-301",
      USUBJID: "01",
      TRTSDT: "2030-01-01",
    });
    return { good, context: [good] };
  }
  if (rule.kind === "exception") {
    // The ADEG review rules: the seed-301 run has no QTcF outlier and no
    // ECG without an RR.
    const good = datasets.find(
      (item) => item.layer === "adam" && item.name === rule.scope.domain
    )!;
    return { good, context: datasets };
  }
  if (rule.scope.domain === "ADVS" || rule.scope.domain === "ADEG") {
    const change = rule.id === "AD-004" || rule.id === "AD-012";
    const good = mini(rule.scope.domain, "adam", {
      USUBJID: "01",
      ABLFL: "Y",
      AVAL: 10,
      BASE: change ? 8 : 10,
      CHG: change ? 2 : 0,
    });
    return { good, context: [good] };
  }
  if (rule.scope.domain === "ADCM") {
    // The seed-301 ADCM, whose flags agree with its dates.
    const good = datasets.find(
      (item) => item.layer === "adam" && item.name === "ADCM"
    )!;
    return { good, context: datasets };
  }
  const good = mini("ADAE", "adam", {
    USUBJID: "01",
    ASTDT: "2030-01-02",
    TRTSDT: "2030-01-01",
    TRTEDT: "2030-01-10",
    LSTALVDT: "2030-01-24",
    TRTEMFL: "Y",
  });
  return { good, context: [good] };
}
function negative(rule: ConformanceRule, good: Dataset): Dataset {
  switch (rule.kind) {
    case "required": {
      const variable = good.variables[0].name;
      const { [variable]: removed, ...columns } = good.columns;
      void removed;
      return {
        ...good,
        variables: good.variables.filter((meta) => meta.name !== variable),
        columns,
      };
    }
    case "unique":
    case "duplicate": {
      const columns = Object.fromEntries(
        Object.entries(good.columns).map(([name, values]) => [
          name,
          [...values, values[0]],
        ])
      );
      return { ...good, columns, rowCount: good.rowCount + 1 };
    }
    case "iso":
    case "ct":
      return set(good, rule.variable!, 0, "INVALID");
    case "study-day": {
      const date = rule.variable!.replace(/DY$/, "DTC");
      const row = good.columns[date].findIndex(
        (value) =>
          typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
      );
      return set(good, rule.variable!, row, 0);
    }
    case "visit":
      return set(good, "VISIT", 0, "WRONG VISIT");
    case "epoch":
      return set(good, "EPOCH", 0, "WRONG EPOCH");
    case "baseline": {
      const row = good.columns.LBLOBXFL.findIndex((value) => value === "Y");
      return set(good, "LBDY", row, 2);
    }
    case "exception": {
      if (rule.id === "SD-031") return set(good, "SVSTDY", 0, 999);
      if (rule.id === "SD-032") return set(good, "LBNRIND", 0, "HIGH");
      if (rule.id === "SD-033") return set(good, "AESTDTC", 0, "2030-01");
      const qtcf = good.columns.PARAMCD?.indexOf("QTCFAG") ?? -1;
      if (rule.id === "AD-014") return set(good, "CRIT1FL", qtcf, "Y");
      // Dropping a QTcF's code leaves its QT without a QTcF.
      if (rule.id === "AD-015") return set(good, "PARAMCD", qtcf, "XX");
      return set(good, "AESTDY", 0, -1);
    }
    case "unit":
      return set(good, rule.variable!, 0, "mg/dL");
    case "eligibility":
      // A criterion not met, recorded for an enrolled subject.
      return set(good, "USUBJID", 0, "DEMO-301-0002");
    case "relationship":
      // A relationship that names an AESEQ the subject does not have.
      return set(good, "IDVARVAL", 0, "999");
    case "lineage":
      return rule.scope.layer === "sdtm"
        ? {
            ...good,
            lineage: good.lineage!.map((sources, index) =>
              index === 0 ? ["DEMO-301:XX:0000:missing"] : sources
            ),
          }
        : set(good, "SRCDOM", 0, "ZZ");
    case "adam": {
      if (rule.id === "AD-003" || rule.id === "AD-011")
        return set(good, "BASE", 0, 9);
      if (rule.id === "AD-004" || rule.id === "AD-012")
        return set(good, "CHG", 0, 3);
      // ADCM's first record is a prior medication still taken on treatment.
      if (rule.id === "AD-016") return set(good, "PREFL", 0, null);
      if (rule.id === "AD-017") return set(good, "ONTRTFL", 0, null);
      return set(good, "TRTEMFL", 0, "N");
    }
  }
}

describe("versioned dataset conformance", () => {
  it.each(CONFORMANCE_RULES)(
    "$id passes a valid example and identifies an invalid one",
    (rule) => {
      const { good, context } = baseFor(rule);
      expect(rule.check(good, context)).toEqual([]);
      const bad = negative(rule, good);
      const violations = rule.check(bad, context);
      expect(violations.length).toBeGreaterThan(0);
      expect(rule.citation).toMatch(/^.+https:\/\//);
    }
  );

  it("reports seeded exceptions with rule ids, row pointers, and domain counts", () => {
    const result = runConformance(datasets);
    expect(result.report.status).toBe("warning");
    expect(result.report.terminologyVersion).toBe("2026-09-25");
    expect(result.report.scopeNotice).toMatch(/subset/);
    expect(result.report.coreUrl).toBe("https://www.cdisc.org/core");
    expect(new Set(result.findings.map((finding) => finding.ruleId))).toEqual(
      new Set(["SD-031", "SD-032", "SD-033", "SD-034"])
    );
    expect(
      result.findings.every(
        (finding) =>
          finding.dataset && finding.row !== undefined && finding.citation
      )
    ).toBe(true);
    expect(
      result.report.domains.find((summary) => summary.dataset === "LB")!.warning
    ).toBeGreaterThan(0);
  });

  it("returns failed status for a rule error while retaining datasets", () => {
    const dm = datasets.find(
      (dataset) => dataset.layer === "sdtm" && dataset.name === "DM"
    )!;
    const bad = set(dm, "SEX", 0, "INVALID");
    const outcome = runConformance([bad]);
    expect(outcome.report.status).toBe("failed");
    expect(
      outcome.findings.some(
        (finding) => finding.ruleId === "SD-021" && finding.row === 0
      )
    ).toBe(true);
  });

  it("traces every SDTM and ADaM record to its source across seeds and scenarios (#2930)", () => {
    const lineageRules = new Set(
      CONFORMANCE_RULES.filter((rule) => rule.kind === "lineage").map(
        (rule) => rule.id
      )
    );
    const runs = [
      ...[1, 2, 302, 999].map((seed) => ({ seed, scenarios: [] })),
      {
        seed: 301,
        scenarios: MESSY_DATA_SCENARIOS.map((scenario) => scenario.id),
      },
    ];
    for (const options of runs) {
      const { findings } = runPipeline(DEMO_301_STUDY, {
        ...options,
        nSubjects: 60,
      });
      expect(
        findings.filter((finding) => lineageRules.has(finding.ruleId))
      ).toEqual([]);
    }
  });

  it("reports an ADaM record whose SRCSEQ matches no SDTM record (#2930)", () => {
    const adae = datasets.find((dataset) => dataset.name === "ADAE")!;
    const rule = CONFORMANCE_RULES.find(
      (candidate) =>
        candidate.kind === "lineage" && candidate.scope.domain === "ADAE"
    )!;
    const issues = rule.check(set(adae, "SRCSEQ", 0, 9999), datasets);
    expect(issues).toEqual([
      expect.objectContaining({ row: 0, variable: "SRCSEQ" }),
    ]);
  });

  it("reports an SDTM record with no lineage (#2930)", () => {
    const vs = datasets.find(
      (dataset) => dataset.layer === "sdtm" && dataset.name === "VS"
    )!;
    const rule = CONFORMANCE_RULES.find(
      (candidate) =>
        candidate.kind === "lineage" && candidate.scope.domain === "VS"
    )!;
    const orphan = {
      ...vs,
      lineage: vs.lineage!.map((sources, index) =>
        index === 3 ? [] : sources
      ),
    };
    expect(rule.check(orphan, datasets)).toEqual([
      expect.objectContaining({ row: 3 }),
    ]);
  });

  it("never throws on malformed dataset structures", () => {
    fc.assert(
      fc.property(fc.array(fc.jsonValue(), { maxLength: 5 }), (items) => {
        const malformed = items.map((item) => ({
          name: "AE",
          layer: "sdtm",
          rowCount: 2,
          variables: item,
          columns: item,
          class: "Events",
        }));
        expect(() => runConformance(fromAny(malformed))).not.toThrow();
      }),
      { numRuns: 100 }
    );
  });
});
