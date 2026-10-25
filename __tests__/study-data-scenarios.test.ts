// @vitest-environment node
/**
 * The messy-data scenario library (#2605). Each scenario must raise the
 * findings it declares on the subject it changed, leave every other subject
 * as generated, and drive the derivation it describes. Any composition of
 * scenarios must run, build outputs and keep every row traceable.
 */
import { fromAny } from "@total-typescript/shoehorn";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  CONFORMANCE_RULES,
  DEMO_301_STUDY,
  MESSY_DATA_SCENARIOS,
  buildReviewerGuides,
  buildTlfOutputs,
  runPipeline,
  type CellValue,
  type Dataset,
  type PipelineRun,
  type ScenarioId,
} from "@/lib/study-data";

type Row = Record<string, CellValue>;

const SEED = 301;
const SUBJECTS = 60;
const baseline = runPipeline(DEMO_301_STUDY, {
  seed: SEED,
  nSubjects: SUBJECTS,
});

function withScenarios(scenarios: readonly ScenarioId[]): PipelineRun {
  return runPipeline(DEMO_301_STUDY, {
    seed: SEED,
    nSubjects: SUBJECTS,
    scenarios,
  });
}

function dataset(run: PipelineRun, layer: string, name: string): Dataset {
  const found = run.datasets.find(
    (item) => item.layer === layer && item.name === name
  );
  if (!found) throw new Error(`No ${layer} ${name}`);
  return found;
}

function rows(data: Dataset): Row[] {
  return Array.from({ length: data.rowCount }, (_, index) =>
    Object.fromEntries(
      data.variables.map((variable) => [
        variable.name,
        data.columns[variable.name]?.[index] ?? null,
      ])
    )
  );
}

function subjectRows(
  run: PipelineRun,
  layer: string,
  name: string,
  subject: string
): Row[] {
  return rows(dataset(run, layer, name)).filter(
    (row) => row.USUBJID === subject
  );
}

/** Finding counts keyed by rule, dataset and the subject of the row. */
function findingsBySubject(run: PipelineRun): Map<string, Map<string, number>> {
  const bySubject = new Map<string, Map<string, number>>();
  for (const finding of run.findings) {
    const data = run.datasets.find(
      (item) => item.layer === finding.layer && item.name === finding.dataset
    );
    const subject =
      finding.row === undefined
        ? ""
        : String(data?.columns.USUBJID?.[finding.row] ?? "");
    const counts = bySubject.get(subject) ?? new Map<string, number>();
    const key = `${finding.ruleId}|${finding.dataset}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    bySubject.set(subject, counts);
  }
  return bySubject;
}

function ruleIds(counts: Map<string, number> | undefined): Set<string> {
  return new Set([...(counts?.keys() ?? [])].map((key) => key.split("|")[0]));
}

function targetOf(run: PipelineRun, id: ScenarioId): string {
  const applied = run.manifest.scenarios?.find((item) => item.id === id);
  expect(applied?.subject, `${id} found no eligible subject`).toBeTruthy();
  return applied!.subject!;
}

describe("messy-data scenarios: the library", () => {
  it("declares every scenario with its expectations as data", () => {
    expect(MESSY_DATA_SCENARIOS.map((item) => item.id)).toEqual([
      "impossible-date",
      "partial-end-date",
      "ae-before-first-dose",
      "missing-baseline",
      "no-post-baseline",
      "off-codelist-extensible",
      "off-codelist-non-extensible",
      "duplicate-record",
      "unit-change",
      "lab-retest-same-day",
      "unscheduled-visit-in-window",
      "rescreened-subject",
      "death-during-treatment",
      "withdrawal-before-week-12",
    ]);
    for (const scenario of MESSY_DATA_SCENARIOS) {
      expect(scenario.title.length).toBeGreaterThan(0);
      expect(scenario.description.length).toBeGreaterThan(0);
      expect(scenario.expected.derivation.length).toBeGreaterThan(0);
    }
  });

  it("leaves a run without scenarios exactly as generated", () => {
    const again = runPipeline(DEMO_301_STUDY, {
      seed: SEED,
      nSubjects: SUBJECTS,
      scenarios: [],
    });
    expect(again).toEqual(baseline);
    expect("scenarios" in baseline.manifest).toBe(false);
  });

  it("rejects an unknown scenario", () => {
    expect(() =>
      withScenarios([fromAny<ScenarioId, string>("no-such-scenario")])
    ).toThrow(RangeError);
  });

  it("applies scenarios in library order, ignoring input order and repeats", () => {
    const forward = withScenarios(["impossible-date", "missing-baseline"]);
    const backward = withScenarios([
      "missing-baseline",
      "impossible-date",
      "missing-baseline",
    ]);
    expect(backward).toEqual(forward);
    const subjects = forward.manifest.scenarios!.map((item) => item.subject);
    expect(new Set(subjects).size).toBe(subjects.length);
  });

  it("reports a null subject and changes nothing when no subject is eligible", () => {
    const run = runPipeline(DEMO_301_STUDY, {
      seed: SEED,
      nSubjects: 1,
      scenarios: ["off-codelist-non-extensible"],
    });
    const plain = runPipeline(DEMO_301_STUDY, { seed: SEED, nSubjects: 1 });
    const applied = run.manifest.scenarios![0]!;
    if (applied.subject === null) {
      expect(run.datasets).toEqual(plain.datasets);
    } else {
      expect(subjectRows(run, "sdtm", "DM", applied.subject)[0]!.SEX).toBe(
        "FEMALE"
      );
    }
  });
});

describe.each(MESSY_DATA_SCENARIOS.map((item) => [item.id, item] as const))(
  "messy-data scenario %s",
  (id, scenario) => {
    const run = withScenarios([id]);
    const subject = targetOf(run, id);
    const before = findingsBySubject(baseline);
    const after = findingsBySubject(run);

    it("raises the declared findings on the changed subject, and no new kind", () => {
      const raised = ruleIds(after.get(subject));
      for (const rule of scenario.expected.findings)
        expect(raised.has(rule), `${rule} on ${subject}`).toBe(true);
      const allowed = new Set([
        ...scenario.expected.findings,
        ...ruleIds(before.get(subject)),
      ]);
      expect([...raised].filter((rule) => !allowed.has(rule))).toEqual([]);
    });

    it("leaves every other subject's records and findings as generated", () => {
      for (const data of baseline.datasets) {
        if (!data.variables.some((variable) => variable.name === "USUBJID"))
          continue;
        const others = (from: PipelineRun) =>
          rows(dataset(from, data.layer, data.name)).filter(
            (row) => row.USUBJID !== subject
          );
        expect(others(run), `${data.layer} ${data.name}`).toEqual(
          others(baseline)
        );
      }
      for (const [other, counts] of before) {
        if (other === subject || other === "") continue;
        expect(after.get(other), other).toEqual(counts);
      }
    });
  }
);

describe("messy-data scenarios: derivations", () => {
  it("impossible-date: no study day from a rolled-over date, no imputed ASTDT", () => {
    const run = withScenarios(["impossible-date"]);
    const subject = targetOf(run, "impossible-date");
    const ae = subjectRows(run, "sdtm", "AE", subject).find((row) =>
      String(row.AESTDTC).endsWith("-02-30")
    )!;
    expect(ae).toBeDefined();
    // `Date` reads 30 February as 2 March; the study day must stay missing.
    expect(ae.AESTDY).toBeNull();
    const adae = subjectRows(run, "adam", "ADAE", subject).find(
      (row) => row.SRCSEQ === ae.AESEQ
    )!;
    expect(adae.ASTDT).toBeNull();
    expect(adae.ASTDTF).toBeNull();
  });

  it("partial-end-date: AENDT imputed to month end, capped, and flagged", () => {
    const run = withScenarios(["partial-end-date"]);
    const subject = targetOf(run, "partial-end-date");
    const ae = subjectRows(run, "sdtm", "AE", subject).find((row) =>
      /^\d{4}-\d{2}$/.test(String(row.AEENDTC))
    )!;
    expect(ae).toBeDefined();
    const adae = subjectRows(run, "adam", "ADAE", subject).find(
      (row) => row.SRCSEQ === ae.AESEQ
    )!;
    expect(adae.AENDTF).toBe("D");
    const [year, month] = String(ae.AEENDTC).split("-").map(Number);
    const monthEnd = new Date(Date.UTC(year!, month!, 0))
      .toISOString()
      .slice(0, 10);
    const lastContact = adae.LSTALVDT as string | null;
    expect(adae.AENDT).toBe(
      lastContact && monthEnd > lastContact ? lastContact : monthEnd
    );
  });

  it("ae-before-first-dose: negative study day and not treatment-emergent", () => {
    const run = withScenarios(["ae-before-first-dose"]);
    const subject = targetOf(run, "ae-before-first-dose");
    const ae = subjectRows(run, "sdtm", "AE", subject).find(
      (row) => (row.AESTDY as number) < 1
    )!;
    expect(ae.AESTDY).toBe(-3);
    const adae = subjectRows(run, "adam", "ADAE", subject).find(
      (row) => row.SRCSEQ === ae.AESEQ
    )!;
    expect(adae.TRTEMFL).toBe("N");
  });

  it("missing-baseline: BASE and CHG missing, no baseline flag, no crash", () => {
    const run = withScenarios(["missing-baseline"]);
    const subject = targetOf(run, "missing-baseline");
    const advs = subjectRows(run, "adam", "ADVS", subject);
    expect(advs.length).toBeGreaterThan(0);
    for (const row of advs) {
      expect(row.ABLFL).not.toBe("Y");
      expect(row.BASE).toBeNull();
      expect(row.CHG).toBeNull();
    }
  });

  it("no-post-baseline: only baseline records, so no change from baseline", () => {
    const run = withScenarios(["no-post-baseline"]);
    const subject = targetOf(run, "no-post-baseline");
    const advs = subjectRows(run, "adam", "ADVS", subject);
    const firstDose = subjectRows(run, "adam", "ADSL", subject)[0]!
      .TRTSDT as string;
    expect(advs.some((row) => row.ABLFL === "Y")).toBe(true);
    expect(advs.filter((row) => String(row.ADT) > firstDose)).toEqual([]);
    const outputs = buildTlfOutputs(DEMO_301_STUDY, run);
    expect(outputs.tables.length).toBeGreaterThan(0);
  });

  it("off-codelist-extensible: kept as collected, flagged as a warning", () => {
    const run = withScenarios(["off-codelist-extensible"]);
    const subject = targetOf(run, "off-codelist-extensible");
    expect(
      subjectRows(run, "sdtm", "AE", subject).some(
        (row) => row.AEREL === "UNASSESSABLE"
      )
    ).toBe(true);
    const finding = run.findings.find(
      (item) =>
        item.ruleId === "SD-023" &&
        dataset(run, "sdtm", "AE").columns.USUBJID?.[item.row ?? -1] === subject
    );
    expect(finding?.severity).toBe("warning");
  });

  it("off-codelist-non-extensible: kept as collected, reported as an error", () => {
    const run = withScenarios(["off-codelist-non-extensible"]);
    const subject = targetOf(run, "off-codelist-non-extensible");
    expect(subjectRows(run, "sdtm", "DM", subject)[0]!.SEX).toBe("FEMALE");
    const finding = run.findings.find(
      (item) =>
        item.ruleId === "SD-021" &&
        dataset(run, "sdtm", "DM").columns.USUBJID?.[item.row ?? -1] === subject
    );
    expect(finding?.severity).toBe("error");
    expect(() => buildTlfOutputs(DEMO_301_STUDY, run)).not.toThrow();
  });
});

describe("messy-data scenarios: derivations, data management", () => {
  it("duplicate-record: both records kept, only one flagged for analysis", () => {
    const run = withScenarios(["duplicate-record"]);
    const subject = targetOf(run, "duplicate-record");
    const vs = subjectRows(run, "sdtm", "VS", subject);
    const finding = run.findings.find(
      (item) =>
        item.ruleId === "SD-036" &&
        dataset(run, "sdtm", "VS").columns.USUBJID?.[item.row ?? -1] === subject
    )!;
    expect(finding.severity).toBe("warning");
    const repeated = rows(dataset(run, "sdtm", "VS"))[finding.row!]!;
    const pair = vs.filter(
      (row) =>
        row.VSTESTCD === repeated.VSTESTCD && row.VSDTC === repeated.VSDTC
    );
    expect(pair).toHaveLength(2);
    const advs = subjectRows(run, "adam", "ADVS", subject).filter((row) =>
      pair.some((source) => source.VSSEQ === row.SRCSEQ)
    );
    expect(advs).toHaveLength(2);
    expect(advs[0]!.AVISIT).toBe(advs[1]!.AVISIT);
    expect(advs.filter((row) => row.ANL01FL === "Y")).toHaveLength(1);
  });

  it("unit-change: converted back to the standard unit, analysis unchanged", () => {
    const run = withScenarios(["unit-change"]);
    const subject = targetOf(run, "unit-change");
    const converted = subjectRows(run, "sdtm", "LB", subject).filter(
      (row) => row.LBORRESU === "mg/dL"
    );
    expect(converted.length).toBeGreaterThan(0);
    for (const row of converted) {
      expect(row.LBTESTCD).toBe("GLUC");
      expect(row.LBSTRESU).toBe("mmol/L");
      expect(row.LBSTRESC).toBe(String(row.LBSTRESN));
    }
    const glucose = (from: PipelineRun) =>
      subjectRows(from, "adam", "ADLB", subject)
        .filter((row) => row.PARAMCD === "GLUC")
        .map(({ AVAL, AVALU, BASE, CHG, ANL01FL }) => ({
          AVAL,
          AVALU,
          BASE,
          CHG,
          ANL01FL,
        }));
    expect(glucose(run)).toEqual(glucose(baseline));
  });

  it("unit-change: a unit with no conversion leaves the standard result missing", () => {
    const run = withScenarios(["unit-change"]);
    const subject = targetOf(run, "unit-change");
    const lb = dataset(run, "sdtm", "LB");
    const row = rows(lb).findIndex(
      (item) => item.USUBJID === subject && item.LBORRESU === "mg/dL"
    );
    const unconvertible: Dataset = {
      ...lb,
      columns: {
        ...lb.columns,
        LBORRESU: lb.columns.LBORRESU!.map((value, index) =>
          index === row ? "mg/L" : value
        ),
        LBSTRESN: lb.columns.LBSTRESN!.map((value, index) =>
          index === row ? null : value
        ),
      },
    };
    const rule = CONFORMANCE_RULES.find((item) => item.id === "SD-039")!;
    const issue = rule
      .check(unconvertible, run.datasets)
      .find((item) => item.row === row)!;
    expect(issue.message).toMatch(/no conversion/);
  });

  it("lab-retest-same-day: first result of the day flagged, retest kept", () => {
    const run = withScenarios(["lab-retest-same-day"]);
    const subject = targetOf(run, "lab-retest-same-day");
    const lb = subjectRows(run, "sdtm", "LB", subject);
    const retest = lb.find((row, index) =>
      lb
        .slice(0, index)
        .some(
          (earlier) =>
            earlier.LBTESTCD === row.LBTESTCD && earlier.LBDTC === row.LBDTC
        )
    )!;
    const first = lb.find(
      (row) => row.LBTESTCD === retest.LBTESTCD && row.LBDTC === retest.LBDTC
    )!;
    expect(first.LBSEQ as number).toBeLessThan(retest.LBSEQ as number);
    expect(first.LBSTRESN).not.toBe(retest.LBSTRESN);
    const adlb = subjectRows(run, "adam", "ADLB", subject);
    const flagged = (seq: CellValue) =>
      adlb.find((row) => row.SRCSEQ === seq && row.DTYPE === null)!;
    expect(flagged(first.LBSEQ).AVISIT).toBe(flagged(retest.LBSEQ).AVISIT);
    expect(flagged(first.LBSEQ).ANL01FL).toBe("Y");
    expect(flagged(retest.LBSEQ).ANL01FL).toBeNull();
  });

  it("unscheduled-visit-in-window: windowed into the analysis visit, not flagged", () => {
    const run = withScenarios(["unscheduled-visit-in-window"]);
    const subject = targetOf(run, "unscheduled-visit-in-window");
    const sv = subjectRows(run, "sdtm", "SV", subject);
    const unscheduled = sv.find((row) => row.VISITNUM === 99)!;
    expect(unscheduled.VISIT).toBe("UNSCHEDULED");
    const scheduled = sv.find(
      (row) => row.SVSTDY === (unscheduled.SVSTDY as number) - 1
    )!;
    const vs = subjectRows(run, "sdtm", "VS", subject).filter(
      (row) => row.VISITNUM === 99
    );
    expect(vs.length).toBeGreaterThan(0);
    const advs = subjectRows(run, "adam", "ADVS", subject);
    for (const record of vs) {
      const analysed = advs.find((row) => row.SRCSEQ === record.VSSEQ)!;
      expect(analysed.AVISIT).toBe(scheduled.VISIT);
      expect(analysed.ANL01FL).toBeNull();
      const onTarget = advs.find(
        (row) =>
          row.PARAMCD === analysed.PARAMCD &&
          row.AVISIT === scheduled.VISIT &&
          row.ANL01FL === "Y"
      )!;
      expect(onTarget.ADY).toBe(scheduled.SVSTDY);
    }
  });

  it("rescreened-subject: two DM and ADSL records, the run fails conformance", () => {
    const run = withScenarios(["rescreened-subject"]);
    const subject = targetOf(run, "rescreened-subject");
    expect(subjectRows(run, "sdtm", "DM", subject)).toHaveLength(2);
    expect(subjectRows(run, "adam", "ADSL", subject)).toHaveLength(2);
    expect(run.conformance.status).toBe("failed");
    expect(() => buildTlfOutputs(DEMO_301_STUDY, run)).not.toThrow();
  });
});

describe("messy-data scenarios: derivations, early end of participation", () => {
  function week12Day(): number {
    return DEMO_301_STUDY.design.visits.find(
      (visit) => visit.name === "WEEK 12"
    )!.targetDay;
  }

  it("death-during-treatment: treatment ends at death, censored in ADTTE", () => {
    const run = withScenarios(["death-during-treatment"]);
    const subject = targetOf(run, "death-during-treatment");
    const death = subjectRows(run, "sdtm", "DS", subject).find(
      (row) => row.DSDECOD === "DEATH"
    )!;
    expect(death.DSSTDY as number).toBeLessThan(week12Day());
    const adsl = subjectRows(run, "adam", "ADSL", subject)[0]!;
    expect(adsl.TRTEDT).toBe(death.DSSTDTC);
    expect(adsl.EOSSTT).toBe("DISCONTINUED");
    expect(adsl.DCSREAS).toBe("DEATH");
    const adtte = subjectRows(run, "adam", "ADTTE", subject)[0]!;
    expect(adtte.CNSR).toBe(1);
    expect(adtte.ADT).toBe(death.DSSTDTC);
    expect(adtte.CNSDTDSC).toBe("Discontinuation for another reason");
    for (const domain of ["SV", "VS", "LB"] as const)
      for (const row of subjectRows(run, "sdtm", domain, subject)) {
        const date = row[domain === "SV" ? "SVSTDTC" : `${domain}DTC`];
        if (typeof date === "string")
          expect(date <= String(death.DSSTDTC)).toBe(true);
      }
  });

  it("withdrawal-before-week-12: discontinued, later visits carried forward", () => {
    const run = withScenarios(["withdrawal-before-week-12"]);
    const subject = targetOf(run, "withdrawal-before-week-12");
    const withdrawal = subjectRows(run, "sdtm", "DS", subject).find(
      (row) => row.DSDECOD === "WITHDRAWAL BY SUBJECT"
    )!;
    expect(withdrawal.DSSTDY as number).toBeLessThan(week12Day());
    const adsl = subjectRows(run, "adam", "ADSL", subject)[0]!;
    expect(adsl.EOSSTT).toBe("DISCONTINUED");
    expect(adsl.DCSREAS).toBe("WITHDRAWAL BY SUBJECT");
    const carried = subjectRows(run, "adam", "ADVS", subject).filter(
      (row) => row.DTYPE === "LOCF"
    );
    expect(carried.some((row) => row.AVISIT === "WEEK 12")).toBe(true);
    for (const row of carried) {
      expect(row.ANL01FL).toBeNull();
      expect(String(row.ADT) <= String(withdrawal.DSSTDTC)).toBe(true);
    }
  });
});

describe("messy-data scenarios: reviewer guides", () => {
  it("explain injected findings instead of calling them defects", () => {
    const run = withScenarios(["duplicate-record", "rescreened-subject"]);
    const { csdrg, adrg } = buildReviewerGuides(run);
    for (const [guide, rule] of [
      [csdrg, "SD-036"],
      [csdrg, "SD-035"],
      [adrg, "AD-002"],
    ] as const) {
      const issue = guide.conformance.issues.find(
        (item) => item.ruleId === rule
      )!;
      expect(issue.expected, rule).toBe(true);
      expect(issue.explanation).toMatch(/Injected on purpose/);
    }
    const plain = buildReviewerGuides(baseline).csdrg.conformance.issues;
    expect(plain.every((issue) => !/Injected/.test(issue.explanation))).toBe(
      true
    );
  });
});

describe("messy-data scenarios: composition", () => {
  const ids = MESSY_DATA_SCENARIOS.map((item) => item.id);

  it("never throws and never produces an untraceable row", () => {
    fc.assert(
      fc.property(
        fc.subarray(ids),
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.integer({ min: 1, max: 40 }),
        (scenarios, seed, nSubjects) => {
          const run = runPipeline(DEMO_301_STUDY, {
            seed,
            nSubjects,
            scenarios,
          });
          buildTlfOutputs(DEMO_301_STUDY, run);
          const sources = new Set(
            run.datasets
              .filter((item) => item.layer === "collected")
              .flatMap((item) => item.columns.SRCID as string[])
          );
          for (const data of run.datasets) {
            if (data.layer === "collected") continue;
            if (data.layer === "sdtm" && !data.lineage) continue;
            expect(data.lineage, `${data.layer} ${data.name}`).toHaveLength(
              data.rowCount
            );
            for (const links of data.lineage!) {
              expect(links.length).toBeGreaterThan(0);
              if (data.layer === "sdtm")
                for (const id of links) expect(sources.has(id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 25, seed: 2605 }
    );
  }, 120_000);
});
