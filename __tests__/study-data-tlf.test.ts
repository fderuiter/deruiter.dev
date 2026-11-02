import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ARS_REPORTING_EVENT_PATH,
  ARS_RESULT_LINEAGE_PATH,
  DEMO_301_STUDY,
  MAX_RAW_DECIMALS,
  MESSY_DATA_SCENARIOS,
  REPORTING_EVENT_RULES,
  STATISTIC_PRECISION,
  SYNTHETIC_DATA_NOTICE,
  TLF_OUTPUT_DIR,
  adamRowId,
  buildStudyDataPackage,
  buildTlfOutputs,
  checkReportingEvent,
  descriptiveStatistics,
  escapeHtml,
  escapeRtf,
  formatDecimal,
  formatPercent,
  indexAdamRows,
  inferDecimalPlaces,
  resolveResultRows,
  runPipeline,
  selectAdamRows,
  statisticDecimals,
  writeArsJson,
  writeArsLineageJson,
  writeTableHtml,
  writeTableRtf,
  writeTlfFiles,
  type ArsComparator,
  type ArsOperationResult,
  type ArsReportingEvent,
  type ArsWhereClause,
  type CellValue,
  type Dataset,
  type PipelineRun,
  type ScenarioId,
  type TlfCell,
  type TlfTable,
} from "@/lib/study-data";

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
const outputs = buildTlfOutputs(DEMO_301_STUDY, run);
const event = outputs.reportingEvent;
const rows = indexAdamRows(run.datasets);
const results = new Map(
  event.analyses.flatMap((analysis) =>
    analysis.results.map((result) => [result.id, result] as const)
  )
);
const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const sha256 = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");

function adam(source: PipelineRun, name: string): Dataset {
  const found = source.datasets.find(
    (dataset) => dataset.name === name && dataset.layer === "adam"
  );
  if (!found) throw new Error(`No ${name}`);
  return found;
}

function records(dataset: Dataset): Record<string, CellValue>[] {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [
        name,
        dataset.columns[name]?.[index] ?? null,
      ])
    )
  );
}

function table(number: string, source = outputs): TlfTable {
  const found = source.tables.find((item) => item.number === number);
  if (!found) throw new Error(`No table ${number}`);
  return found;
}

function cells(source: TlfTable): TlfCell[] {
  return source.sections.flatMap((section) => [
    ...(section.cells ?? []),
    ...section.rows.flatMap((row) => row.cells),
  ]);
}

function row(source: TlfTable, section: string, label: string): string[] {
  const block = source.sections.find((item) => item.label === section);
  const found = block?.rows.find((item) => item.label === label);
  if (!found) throw new Error(`No row ${section} / ${label}`);
  return found.cells.map((cell) => cell.text);
}

function result(id: string): ArsOperationResult {
  const found = results.get(id);
  if (!found) throw new Error(`No result ${id}`);
  return found;
}

describe("descriptive statistics", () => {
  it("matches the textbook SD example 2, 4, 4, 4, 5, 5, 7, 9", () => {
    const stats = descriptiveStatistics([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(stats).toMatchObject({
      n: 8,
      rawDecimals: 0,
      mean: 5,
      median: 4.5,
      min: 2,
      max: 9,
    });
    // Sample SD: the squared deviations sum to 32, divided by n - 1 = 7.
    expect(stats.sd).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(stats.sd).toBeCloseTo(2.13809, 5);
  });

  it("matches Anscombe's quartet, set I (Anscombe 1973)", () => {
    const x = descriptiveStatistics([10, 8, 13, 9, 11, 14, 6, 4, 12, 7, 5]);
    expect(x).toMatchObject({ n: 11, mean: 9, median: 9, min: 4, max: 14 });
    expect(x.sd! ** 2).toBeCloseTo(11, 12);

    const y = descriptiveStatistics([
      8.04, 6.95, 7.58, 8.81, 8.33, 9.96, 7.24, 4.26, 10.84, 4.82, 5.68,
    ]);
    expect(y.rawDecimals).toBe(2);
    expect(y.mean).toBeCloseTo(82.51 / 11, 12);
    expect(y.sd! ** 2).toBeCloseTo(4.127269, 6);
    expect(y.median).toBe(7.58);
    expect(formatDecimal(y.mean!, statisticDecimals("mean", 2))).toBe("7.501");
    expect(formatDecimal(y.sd!, statisticDecimals("sd", 2))).toBe("2.0316");
    expect(formatDecimal(y.median!, statisticDecimals("median", 2))).toBe(
      "7.580"
    );
    expect(formatDecimal(y.min!, statisticDecimals("min", 2))).toBe("4.26");
    expect(formatDecimal(y.max!, statisticDecimals("max", 2))).toBe("10.84");
  });

  it("uses the n - 1 denominator for the SD", () => {
    // Population SD of 1 and 3 is 1; the sample SD is the square root of 2.
    expect(descriptiveStatistics([1, 3]).sd).toBeCloseTo(Math.SQRT2, 12);
    expect(descriptiveStatistics([7]).sd).toBeNull();
  });

  it("averages the two middle values for an even count", () => {
    expect(descriptiveStatistics([4, 1, 3, 2]).median).toBe(2.5);
    expect(descriptiveStatistics([3, 1]).median).toBe(2);
    expect(descriptiveStatistics([5, 1, 3]).median).toBe(3);
    expect(descriptiveStatistics([1.1, 1.2]).median).toBe(1.15);
  });

  it("returns n = 0 and no other statistic for no values", () => {
    expect(descriptiveStatistics([])).toEqual({
      n: 0,
      rawDecimals: 0,
      mean: null,
      sd: null,
      median: null,
      min: null,
      max: null,
    });
  });

  it("sums at the data's precision, so a half-way mean rounds away from zero", () => {
    // 4.7 / 4 = 1.175. toFixed(2) reads the binary value and prints 1.17.
    const stats = descriptiveStatistics([1.1, 1.2, 1.2, 1.2]);
    expect(stats.mean).toBe(1.175);
    expect(formatDecimal(stats.mean!, 2)).toBe("1.18");
    expect(formatDecimal(descriptiveStatistics([0, 1, 0, 0]).mean!, 1)).toBe(
      "0.3"
    );
    expect(formatDecimal(descriptiveStatistics([0, -1, 0, 0]).mean!, 1)).toBe(
      "-0.3"
    );
  });

  it("rounds values to the stated precision first", () => {
    expect(descriptiveStatistics([-1.4000000000000057, 0.2], 1)).toMatchObject({
      mean: -0.6,
      min: -1.4,
      max: 0.2,
    });
  });

  it("rejects values and precisions it cannot use", () => {
    expect(() => descriptiveStatistics([1, Number.NaN])).toThrow(RangeError);
    expect(() => descriptiveStatistics([1], -1)).toThrow(RangeError);
    expect(() => descriptiveStatistics([1], MAX_RAW_DECIMALS + 1)).toThrow(
      RangeError
    );
  });

  const decimalValues = fc
    .array(fc.integer({ min: -1_000_000, max: 1_000_000 }), {
      minLength: 1,
      maxLength: 60,
    })
    .map((integers) => integers.map((value) => value / 10));

  it("keeps the mean and median between the minimum and maximum", () => {
    fc.assert(
      fc.property(decimalValues, (values) => {
        const stats = descriptiveStatistics(values, 1);
        expect(stats.n).toBe(values.length);
        expect(stats.min).toBe(Math.min(...values));
        expect(stats.max).toBe(Math.max(...values));
        expect(stats.mean!).toBeGreaterThanOrEqual(stats.min!);
        expect(stats.mean!).toBeLessThanOrEqual(stats.max!);
        expect(stats.median!).toBeGreaterThanOrEqual(stats.min!);
        expect(stats.median!).toBeLessThanOrEqual(stats.max!);
      })
    );
  });

  it("gives a non-negative SD that does not depend on order or a shift", () => {
    fc.assert(
      fc.property(
        decimalValues,
        fc.integer({ min: -1000, max: 1000 }),
        (values, shift) => {
          const stats = descriptiveStatistics(values, 1);
          if (values.length < 2) {
            expect(stats.sd).toBeNull();
            return;
          }
          expect(stats.sd!).toBeGreaterThanOrEqual(0);
          const reversed = descriptiveStatistics([...values].reverse(), 1);
          expect(reversed).toEqual(stats);
          const shifted = descriptiveStatistics(
            values.map((value) => (Math.round(value * 10) + shift * 10) / 10),
            1
          );
          expect(shifted.sd!).toBeCloseTo(stats.sd!, 6);
          expect(shifted.mean!).toBeCloseTo(stats.mean! + shift, 6);
        }
      )
    );
  });

  it("is zero for identical values", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -10_000, max: 10_000 }),
        fc.integer({ min: 2, max: 30 }),
        (value, count) => {
          const stats = descriptiveStatistics(Array(count).fill(value));
          expect(stats.sd).toBe(0);
          expect(stats.mean).toBe(value);
        }
      )
    );
  });
});

describe("display precision", () => {
  it("states and applies the rule: data decimals, mean and median plus one, SD plus two, percentages one", () => {
    expect(STATISTIC_PRECISION).toEqual({
      n: { relativeTo: "integer", decimals: 0 },
      min: { relativeTo: "data", decimals: 0 },
      max: { relativeTo: "data", decimals: 0 },
      mean: { relativeTo: "data", decimals: 1 },
      median: { relativeTo: "data", decimals: 1 },
      sd: { relativeTo: "data", decimals: 2 },
      percent: { relativeTo: "fixed", decimals: 1 },
    });
    expect(
      (["n", "min", "max", "mean", "median", "sd", "percent"] as const).map(
        (kind) => statisticDecimals(kind, 1)
      )
    ).toEqual([0, 1, 1, 2, 2, 3, 1]);
    expect(statisticDecimals("percent", 4)).toBe(1);
  });

  it.each([
    [[146, 141.1], 1],
    [[32, 68], 0],
    [[8.04, 10.84], 2],
    [[0.30000000000000004], MAX_RAW_DECIMALS],
    [[1e-7], MAX_RAW_DECIMALS],
    [[1.5e21], 0],
    [[], 0],
  ])("infers the decimals of %j as %i", (values, expected) => {
    expect(inferDecimalPlaces(values)).toBe(expected);
  });

  it.each([
    [2.5, 0, "3"],
    [-2.5, 0, "-3"],
    [1.005, 2, "1.01"],
    [0.125, 2, "0.13"],
    [-0.04, 1, "0.0"],
    [-0, 2, "0.00"],
    [141.3, 2, "141.30"],
    [4.645, 3, "4.645"],
    [1e-7, 3, "0.000"],
    [12345678.9, 1, "12345678.9"],
  ])("formats %s to %i decimals as %s", (value, decimals, expected) => {
    expect(formatDecimal(value, decimals)).toBe(expected);
  });

  it("rejects values it cannot print", () => {
    expect(() => formatDecimal(Infinity, 1)).toThrow(RangeError);
    expect(() => formatDecimal(1, 1.5)).toThrow(RangeError);
  });

  it.each([
    [1, 3, "33.3"],
    [2, 3, "66.7"],
    [1, 8, "12.5"],
    [1, 16, "6.3"],
    [1, 80, "1.3"],
    [0, 5, "0.0"],
    [5, 5, "100.0"],
    [1, 0, null],
  ])("formats %i of %i as %s percent", (count, denominator, expected) => {
    expect(formatPercent(count, denominator)).toBe(expected);
  });

  it("rejects counts that are not non-negative integers", () => {
    expect(() => formatPercent(-1, 3)).toThrow(RangeError);
    expect(() => formatPercent(1.5, 3)).toThrow(RangeError);
  });
});

describe("ADaM row identity", () => {
  it("names a row by dataset and its keys other than STUDYID", () => {
    const adsl = adam(run, "ADSL");
    const advs = adam(run, "ADVS");
    expect(adamRowId(adsl, 0)).toBe(`ADSL:${adsl.columns.USUBJID[0]}`);
    expect(adamRowId(advs, 3)).toBe(
      `ADVS:${advs.columns.USUBJID[3]}:${advs.columns.ASEQ[3]}`
    );
    expect(() => adamRowId(adsl, adsl.rowCount)).toThrow(RangeError);
  });

  it("gives every ADaM row of a run a unique id", () => {
    const total = run.datasets
      .filter((dataset) => dataset.layer === "adam")
      .reduce((sum, dataset) => sum + dataset.rowCount, 0);
    expect(rows.size).toBe(total);
    for (const location of rows.values()) {
      const dataset = adam(run, location.dataset);
      expect(adamRowId(dataset, location.rowIndex)).toBe(location.rowId);
    }
  });
});

describe("ARS reporting event", () => {
  it("resolves every result to a non-empty set of ADaM rows", () => {
    expect(results.size).toBeGreaterThan(300);
    for (const item of results.values()) {
      const resolved = resolveResultRows(event, rows, item);
      expect(resolved.length, item.id).toBeGreaterThan(0);
      for (const location of resolved) {
        if (location.role === "population") {
          expect(location.dataset).toBe("ADSL");
        }
      }
    }
  });

  it("resolves every displayed cell, header N included, through its results", () => {
    for (const source of outputs.tables) {
      for (const column of source.columns) {
        const linked = resolveResultRows(
          event,
          rows,
          result(column.bigNResultId)
        );
        for (const role of ["population", "analysis"] as const) {
          expect(linked.filter((item) => item.role === role)).toHaveLength(
            column.bigN
          );
        }
      }
      for (const cell of cells(source)) {
        expect(cell.resultIds.length).toBeGreaterThan(0);
        for (const id of cell.resultIds) {
          expect(
            resolveResultRows(event, rows, result(id)).length
          ).toBeGreaterThan(0);
        }
      }
    }
  });

  it("holds for other seeds, and in tiny runs for every group with subjects", () => {
    for (const [seed, nSubjects] of [
      [302, 90],
      [303, 90],
      [1, 6],
      [9, 12],
      [5, 1],
    ] as const) {
      const other = runPipeline(DEMO_301_STUDY, { seed, nSubjects });
      const built = buildTlfOutputs(DEMO_301_STUDY, other);
      const index = indexAdamRows(other.datasets);
      const emptyGroups = new Set(
        built.tables.flatMap((source) =>
          source.columns
            .filter((column) => column.bigN === 0)
            .map((column) => column.groupId)
        )
      );
      // A win-ratio analysis groups by treatment without results by group,
      // so it has no rows when neither of the arms it compares has subjects.
      const fas = records(adam(other, "ADSL")).filter(
        (subject) => subject.ITTFL === "Y"
      );
      const emptyComparisons = new Set(
        DEMO_301_STUDY.design.arms
          .filter(
            (arm) =>
              !fas.some(
                (subject) =>
                  subject.TRT01P === arm.name || subject.TRT01P === "Placebo"
              )
          )
          .map((arm) => arm.armCode)
      );
      for (const analysis of built.reportingEvent.analyses) {
        for (const item of analysis.results) {
          const resolved = resolveResultRows(built.reportingEvent, index, item);
          const inEmptyGroup =
            item.resultGroups.some(
              (group) => group.groupId && emptyGroups.has(group.groupId)
            ) ||
            emptyComparisons.has(analysis.id.replace(/^An_14_2_3_\w+?_/, ""));
          expect(resolved.length > 0, `${seed}/${item.id}`).toBe(!inEmptyGroup);
        }
      }
    }
  });

  it("links a count to its denominator and to the records it counted", () => {
    const zeroRun = runPipeline(DEMO_301_STUDY, { seed: 302, nSubjects: 90 });
    const built = buildTlfOutputs(DEMO_301_STUDY, zeroRun);
    const index = indexAdamRows(zeroRun.datasets);
    const lookup = new Map(
      built.reportingEvent.analyses.flatMap((analysis) =>
        analysis.results.map((item) => [item.id, item] as const)
      )
    );
    const zero = cells(table("14.3.1", built)).find(
      (cell) => cell.text === "0"
    );
    expect(zero).toBeDefined();
    for (const id of zero!.resultIds) {
      const resolved = resolveResultRows(
        built.reportingEvent,
        index,
        lookup.get(id)!
      );
      expect(resolved.length).toBeGreaterThan(0);
      expect(resolved.every((item) => item.role === "population")).toBe(true);
    }
  });

  it("declares the analysis sets, methods and percentage denominators as data", () => {
    expect(event.analysisSets.map((set) => set.id)).toEqual([
      "AnalysisSet_SAF",
      "AnalysisSet_FAS",
    ]);
    const percent = event.methods
      .find((method) => method.id === "Mth_CountPct")!
      .operations.find((operation) => operation.id === "Mth_CountPct_Pct")!;
    expect(
      percent.referencedOperationRelationships?.map((relation) => [
        relation.referencedOperationRole.controlledTerm,
        relation.operationId,
      ])
    ).toEqual([
      ["NUMERATOR", "Mth_CountPct_n"],
      ["DENOMINATOR", "Mth_Count_N"],
    ]);
    const pt = event.analyses.find(
      (analysis) => analysis.id === "An_14_3_1_PT"
    )!;
    expect(pt.referencedAnalysisOperations).toContainEqual({
      referencedOperationRelationshipId: "Mth_CountPct_Pct_DEN",
      analysisId: "An_14_3_1_N",
    });
    const soc = event.analysisGroupings.find(
      (grouping) => grouping.id === "AnlsGrouping_AEBODSYS"
    )!;
    expect(soc).toMatchObject({ dataDriven: true, groups: [] });
    expect(
      event.analysisGroupings
        .find((grouping) => grouping.id === "AnlsGrouping_TRT01A")!
        .groups.map((group) => group.name)
    ).toEqual(DEMO_301_STUDY.design.arms.map((arm) => arm.name));
    expect(
      event.analyses.find((analysis) => analysis.id === "An_14_2_1_CHG")
    ).toMatchObject({ rawDecimals: 1, dataSubsetId: "Dss_SYSBP_ANL_POST" });
  });

  it("lists every output with the analyses it displays", () => {
    const items = event.mainListOfContents.contentsList.listItems;
    expect(items.map((item) => item.outputId)).toEqual([
      "Out_14_1_1",
      "Out_14_2_1",
      "Out_14_2_3",
      "Out_14_3_1",
      "Out_14_2_2",
    ]);
    const analysisIds = new Set(event.analyses.map((analysis) => analysis.id));
    for (const item of items) {
      for (const child of item.sublist?.listItems ?? []) {
        expect(analysisIds.has(child.analysisId!)).toBe(true);
      }
    }
    expect(
      event.outputs
        .slice(0, outputs.tables.length)
        .map((item) => item.fileSpecifications)
    ).toEqual(
      outputs.tables.map((source) => [
        {
          name: `${source.fileBase}.html`,
          fileType: { sponsorTermId: "SponsorTerm_FileType_HTML" },
          location: `${source.fileBase}.html`,
        },
        {
          name: `${source.fileBase}.rtf`,
          fileType: { controlledTerm: "rtf" },
          location: `${source.fileBase}.rtf`,
        },
      ])
    );
  });

  it("refuses a run of another study", () => {
    expect(() =>
      buildTlfOutputs({ ...DEMO_301_STUDY, studyId: "OTHER-1" }, run)
    ).toThrow(RangeError);
  });
});

describe("Table 14.1.1, demographics", () => {
  const adsl = records(adam(run, "ADSL")).filter((item) => item.SAFFL === "Y");
  const demog = table("14.1.1");

  it("has N per arm from the Safety Set by treatment received", () => {
    expect(demog.columns.map((column) => [column.label, column.bigN])).toEqual(
      DEMO_301_STUDY.design.arms.map((arm) => [
        arm.name,
        adsl.filter((item) => item.TRT01A === arm.name).length,
      ])
    );
  });

  it("matches statistics computed directly from ADSL", () => {
    const arms = DEMO_301_STUDY.design.arms.map((arm) => arm.name);
    const ages = arms.map((arm) =>
      adsl
        .filter((item) => item.TRT01A === arm)
        .map((item) => item.AGE as number)
    );
    const stats = ages.map((values) => descriptiveStatistics(values, 0));
    expect(row(demog, "Age (years)", "n")).toEqual(
      stats.map((item) => String(item.n))
    );
    expect(row(demog, "Age (years)", "Mean")).toEqual(
      stats.map((item) => formatDecimal(item.mean!, 1))
    );
    expect(row(demog, "Age (years)", "SD")).toEqual(
      stats.map((item) => formatDecimal(item.sd!, 2))
    );
    expect(row(demog, "Sex, n (%)", "Female")).toEqual(
      arms.map((arm, index) => {
        const n = adsl.filter(
          (item) => item.TRT01A === arm && item.SEX === "F"
        ).length;
        return n === 0 ? "0" : `${n} (${formatPercent(n, ages[index].length)})`;
      })
    );
  });

  it("matches the seed-301 values", () => {
    expect(row(demog, "Age (years)", "Mean")).toEqual(["49.4", "48.4", "50.6"]);
    expect(row(demog, "Age (years)", "SD")).toEqual([
      "16.14",
      "15.14",
      "13.97",
    ]);
    expect(row(demog, "Age (years)", "Median")).toEqual([
      "47.5",
      "49.0",
      "51.0",
    ]);
    expect(row(demog, "Age group (years), n (%)", "<40")).toEqual([
      "12 (35.3)",
      "9 (33.3)",
      "5 (25.0)",
    ]);
    expect(
      row(demog, "Baseline systolic blood pressure (mmHg)", "Mean")
    ).toEqual(["141.30", "142.27", "143.05"]);
  });

  it("links a percentage to the treatment group's ADSL rows and the counted subjects", () => {
    const female = demog.sections
      .find((section) => section.label === "Sex, n (%)")!
      .rows.find((item) => item.label === "Female")!.cells[0];
    const resolved = resolveResultRows(
      event,
      rows,
      result(female.resultIds[1])
    );
    const population = resolved.filter((item) => item.role === "population");
    const analysed = resolved.filter((item) => item.role === "analysis");
    expect(population).toHaveLength(demog.columns[0].bigN);
    const adslData = adam(run, "ADSL");
    expect(
      analysed.every((item) => adslData.columns.SEX[item.rowIndex] === "F")
    ).toBe(true);
    expect(String(analysed.length)).toBe(female.text.split(" ")[0]);
  });
});

describe("Table 14.3.1, TEAEs by SOC and PT", () => {
  const adae = records(adam(run, "ADAE")).filter(
    (item) => item.TRTEMFL === "Y" && item.SAFFL === "Y"
  );
  const teae = table("14.3.1");

  it("counts each subject once per SOC and once per PT, as a share of N", () => {
    for (const section of teae.sections.slice(1)) {
      teae.columns.forEach((column, index) => {
        const inArm = adae.filter(
          (item) =>
            item.TRT01A === column.label && item.AEBODSYS === section.label
        );
        const n = new Set(inArm.map((item) => item.USUBJID)).size;
        expect(section.cells![index].text).toBe(
          n === 0 ? "0" : `${n} (${formatPercent(n, column.bigN)})`
        );
        for (const term of section.rows) {
          const subjects = new Set(
            inArm
              .filter((item) => item.AEDECOD === term.label)
              .map((item) => item.USUBJID)
          ).size;
          expect(term.cells[index].text).toBe(
            subjects === 0
              ? "0"
              : `${subjects} (${formatPercent(subjects, column.bigN)})`
          );
        }
      });
    }
  });

  it("orders SOCs alphabetically and PTs by descending total", () => {
    const socs = teae.sections.slice(1).map((section) => section.label);
    expect(socs).toEqual([...socs].sort());
    expect(socs).toEqual([
      "Gastrointestinal disorders",
      "General disorders",
      "Nervous system disorders",
    ]);
    expect(
      teae.sections
        .at(-1)!
        .rows.map((term) => [
          term.label,
          ...term.cells.map((cell) => cell.text),
        ])
    ).toEqual([
      ["Headache", "5 (14.7)", "3 (11.1)", "6 (30.0)"],
      ["Dizziness", "3 (8.8)", "3 (11.1)", "1 (5.0)"],
    ]);
    expect(teae.sections[0].cells!.map((cell) => cell.text)).toEqual([
      "16 (47.1)",
      "11 (40.7)",
      "12 (60.0)",
    ]);
  });

  it("links a PT cell to every TEAE record of that term in the arm", () => {
    const headache = teae.sections.at(-1)!.rows[0].cells[0];
    const analysed = resolveResultRows(
      event,
      rows,
      result(headache.resultIds[0])
    ).filter((item) => item.role === "analysis");
    const data = adam(run, "ADAE");
    expect(analysed.length).toBeGreaterThan(0);
    for (const item of analysed) {
      expect(item.dataset).toBe("ADAE");
      expect(data.columns.AEDECOD[item.rowIndex]).toBe("Headache");
      expect(data.columns.TRTEMFL[item.rowIndex]).toBe("Y");
      expect(data.columns.TRT01A[item.rowIndex]).toBe("Placebo");
    }
    expect(
      new Set(analysed.map((item) => data.columns.USUBJID[item.rowIndex])).size
    ).toBe(5);
  });
});

describe("Table 14.2.1, change from baseline in SYSBP", () => {
  const advs = records(adam(run, "ADVS")).filter(
    (item) =>
      item.PARAMCD === "SYSBP" && item.ANL01FL === "Y" && item.ITTFL === "Y"
  );
  const cfb = table("14.2.1");

  it("reports baseline and every later visit, observed and change", () => {
    expect(cfb.sections.map((section) => section.label)).toEqual([
      "Baseline, observed value",
      "Week 2, observed value",
      "Week 2, change from baseline",
      "Week 4, observed value",
      "Week 4, change from baseline",
      "Week 8, observed value",
      "Week 8, change from baseline",
      "Week 12, observed value",
      "Week 12, change from baseline",
      "End of study, observed value",
      "End of study, change from baseline",
    ]);
    for (const section of cfb.sections) {
      expect(section.rows.map((item) => item.label)).toEqual([
        "n",
        "Mean",
        "SD",
        "Median",
        "Min",
        "Max",
      ]);
    }
  });

  it("matches statistics computed directly from ADVS ANL01FL records", () => {
    const change = cfb.columns.map((column) =>
      descriptiveStatistics(
        advs
          .filter(
            (item) => item.TRT01P === column.label && item.AVISIT === "WEEK 12"
          )
          .map((item) => item.CHG as number),
        1
      )
    );
    const label = "Week 12, change from baseline";
    expect(row(cfb, label, "n")).toEqual(change.map((item) => String(item.n)));
    expect(row(cfb, label, "Mean")).toEqual(
      change.map((item) => formatDecimal(item.mean!, 2))
    );
    expect(row(cfb, label, "SD")).toEqual(
      change.map((item) => formatDecimal(item.sd!, 3))
    );
    expect(row(cfb, label, "Median")).toEqual(
      change.map((item) => formatDecimal(item.median!, 2))
    );
    expect(row(cfb, label, "Min")).toEqual(
      change.map((item) => formatDecimal(item.min!, 1))
    );
    expect(row(cfb, "Week 2, change from baseline", "Mean")).toEqual([
      "0.46",
      "-0.73",
      "-2.68",
    ]);
  });

  it("excludes carried-forward rows", () => {
    const data = adam(run, "ADVS");
    for (const section of cfb.sections) {
      for (const item of section.rows) {
        for (const id of item.cells.flatMap((cell) => cell.resultIds)) {
          for (const location of resolveResultRows(event, rows, result(id))) {
            if (location.role !== "analysis") continue;
            expect(data.columns.DTYPE[location.rowIndex]).toBeNull();
            expect(data.columns.ANL01FL[location.rowIndex]).toBe("Y");
          }
        }
      }
    }
  });
});

describe("HTML, RTF and ARS JSON files", () => {
  const files = writeTlfFiles(outputs);

  it("writes each table as HTML and RTF, and the figure as HTML and SVG, next to the ARS JSON", () => {
    expect(files.map((file) => [file.path, file.mediaType])).toEqual([
      [ARS_REPORTING_EVENT_PATH, "application/json"],
      [ARS_RESULT_LINEAGE_PATH, "application/json"],
      [`${TLF_OUTPUT_DIR}/f-14-2-2.html`, "text/html"],
      [`${TLF_OUTPUT_DIR}/f-14-2-2.svg`, "image/svg+xml"],
      [`${TLF_OUTPUT_DIR}/t-14-1-1.html`, "text/html"],
      [`${TLF_OUTPUT_DIR}/t-14-1-1.rtf`, "application/rtf"],
      [`${TLF_OUTPUT_DIR}/t-14-2-1.html`, "text/html"],
      [`${TLF_OUTPUT_DIR}/t-14-2-1.rtf`, "application/rtf"],
      [`${TLF_OUTPUT_DIR}/t-14-2-3.html`, "text/html"],
      [`${TLF_OUTPUT_DIR}/t-14-2-3.rtf`, "application/rtf"],
      [`${TLF_OUTPUT_DIR}/t-14-3-1.html`, "text/html"],
      [`${TLF_OUTPUT_DIR}/t-14-3-1.rtf`, "application/rtf"],
    ]);
    expect(text(files[0].bytes)).toBe(writeArsJson(event));
    expect(text(files[1].bytes)).toBe(writeArsLineageJson(event));
  });

  it("carries the synthetic-data notice in every file", () => {
    for (const file of files) {
      expect(text(file.bytes), file.path).toContain(SYNTHETIC_DATA_NOTICE);
    }
  });

  it("holds no clock time; the RTF creation time is the fixed 1980 date", () => {
    for (const file of files) {
      expect(text(file.bytes), file.path).not.toMatch(
        /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
      );
    }
    for (const file of files.filter((item) => item.path.endsWith(".rtf"))) {
      expect(text(file.bytes)).toContain(
        "{\\creatim\\yr1980\\mo1\\dy1\\hr0\\min0}"
      );
    }
  });

  it("gives byte-identical files for the same seed and different ones for another", () => {
    const again = writeTlfFiles(
      buildTlfOutputs(
        DEMO_301_STUDY,
        runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 })
      )
    );
    expect(again.map((file) => sha256(file.bytes))).toEqual(
      files.map((file) => sha256(file.bytes))
    );
    const other = writeTlfFiles(
      buildTlfOutputs(
        DEMO_301_STUDY,
        runPipeline(DEMO_301_STUDY, { seed: 302, nSubjects: 90 })
      )
    );
    expect(sha256(other[0].bytes)).not.toBe(sha256(files[0].bytes));
    expect(writeArsJson(event)).toBe(text(files[0].bytes));
  });

  it("matches the seed-301 golden hashes", () => {
    const expected = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "__tests__/fixtures/study-data/tlf/seed-301.json"
        ),
        "utf8"
      )
    );
    expect(
      Object.fromEntries(
        files.map((file) => [
          file.path,
          { bytes: file.bytes.length, sha256: sha256(file.bytes) },
        ])
      )
    ).toEqual(expected);
  });

  it("marks up an accessible table", () => {
    const demog = table("14.1.1");
    const html = writeTableHtml(demog);
    expect(html).toMatch(/^<!DOCTYPE html>\n<html lang="en">/);
    expect(html).toContain(
      '<caption><span class="number">Table 14.1.1</span><span>Demographic and Baseline Characteristics</span><span>Safety Set</span></caption>'
    );
    expect(html.match(/<th scope="col"/g)).toHaveLength(
      demog.columns.length + 1
    );
    expect(html).toContain("Placebo <span>(N=34)</span>");
    const bodyRows = html.match(/<tbody>[\s\S]*?<\/tbody>/g)!.join("");
    const trs = bodyRows.match(/<tr>/g)!.length;
    expect(bodyRows.match(/<tr><th scope="(row|rowgroup)"/g)).toHaveLength(trs);
    expect(html).toContain('aria-describedby="t-14-1-1-notes"');
    expect(html).toContain('<div id="t-14-1-1-notes" class="notes">');
    for (const note of demog.footnotes)
      expect(html).toContain(escapeHtml(note));
    expect(html).toContain('data-ars-results="An_14_1_1_AGE.001"');
  });

  it("escapes text in HTML and RTF", () => {
    expect(escapeHtml(`<b> & "q" 'a'`)).toBe(
      "&lt;b&gt; &amp; &quot;q&quot; &#39;a&#39;"
    );
    expect(escapeRtf("a\\b{c}")).toBe("a\\\\b\\{c\\}");
    expect(escapeRtf("n − 1 ≥ é")).toBe("n \\u8722? 1 \\u8805? \\u233?");
    expect(escapeRtf("￿")).toBe("\\u-1?");
    const tricky: TlfTable = {
      ...table("14.3.1"),
      title: "Events <script> & {braces} \\ 5 µg",
    };
    expect(writeTableHtml(tricky)).toContain(
      "Events &lt;script&gt; &amp; {braces} \\ 5 µg"
    );
    expect(writeTableRtf(tricky)).toContain(
      "Events <script> & \\{braces\\} \\\\ 5 \\u181?g"
    );
  });

  it("writes plain-ASCII RTF 1.x with balanced groups and a repeating header row", () => {
    for (const source of outputs.tables) {
      const rtf = writeTableRtf(source);
      expect(rtf.startsWith("{\\rtf1\\ansi")).toBe(true);
      expect(rtf).toMatch(/^[\t\n -~]*$/);
      let depth = 0;
      for (let index = 0; index < rtf.length; index += 1) {
        if (rtf[index] === "\\") index += 1;
        else if (rtf[index] === "{") depth += 1;
        else if (rtf[index] === "}") depth -= 1;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
      expect(depth).toBe(0);
      expect(rtf.match(/\\trhdr/g)).toHaveLength(1);
      const dataRows = source.sections.reduce(
        (sum, section) => sum + 1 + section.rows.length,
        0
      );
      expect(rtf.match(/\\row/g)).toHaveLength(dataRows + 1);
      expect(rtf).toContain(`Table ${source.number}`);
    }
  });
});

describe("where clauses", () => {
  const adsl = adam(run, "ADSL");
  const adae = adam(run, "ADAE");
  const where = (
    dataset: string,
    variable: string,
    comparator: ArsComparator,
    ...value: string[]
  ): ArsWhereClause => ({
    condition: { dataset, variable, comparator, value },
  });
  const indexes = (
    dataset: Dataset,
    keep: (item: Record<string, CellValue>) => boolean
  ) => records(dataset).flatMap((item, index) => (keep(item) ? [index] : []));

  it.each<[ArsComparator, string[], (age: number) => boolean]>([
    ["EQ", ["50"], (age) => age === 50],
    ["NE", ["50"], (age) => age !== 50],
    ["GT", ["50"], (age) => age > 50],
    ["GE", ["50"], (age) => age >= 50],
    ["LT", ["50"], (age) => age < 50],
    ["LE", ["50"], (age) => age <= 50],
    ["IN", ["32", "68"], (age) => age === 32 || age === 68],
    ["NOTIN", ["32", "68"], (age) => age !== 32 && age !== 68],
  ])("compares a numeric variable with %s", (comparator, value, keep) => {
    expect(
      selectAdamRows(
        run.datasets,
        "ADSL",
        where("ADSL", "AGE", comparator, ...value)
      )
    ).toEqual(indexes(adsl, (item) => keep(item.AGE as number)));
  });

  it("compares text by code point and treats missing values as unequal", () => {
    expect(
      selectAdamRows(run.datasets, "ADSL", where("ADSL", "TRT01A", "GE", "P"))
    ).toEqual(indexes(adsl, (item) => item.TRT01A === "Placebo"));
    expect(
      selectAdamRows(
        run.datasets,
        "ADSL",
        where("ADSL", "TRT01A", "NE", "Placebo")
      )
    ).toEqual(indexes(adsl, (item) => item.TRT01A !== "Placebo"));
    expect(
      selectAdamRows(
        run.datasets,
        "ADSL",
        where("ADSL", "TRT01A", "IN", "Placebo")
      )
    ).toEqual(indexes(adsl, (item) => item.TRT01A === "Placebo"));
  });

  it("applies ADSL conditions to records through the subject and combines clauses", () => {
    const female = { level: 2, order: 1, ...where("ADSL", "SEX", "EQ", "F") };
    const teae = { level: 2, order: 2, ...where("ADAE", "TRTEMFL", "EQ", "Y") };
    const subjects = new Map(records(adsl).map((item) => [item.USUBJID, item]));
    expect(
      selectAdamRows(run.datasets, "ADAE", {
        compoundExpression: {
          logicalOperator: "AND",
          whereClauses: [female, teae],
        },
      })
    ).toEqual(
      indexes(
        adae,
        (item) =>
          subjects.get(item.USUBJID)?.SEX === "F" && item.TRTEMFL === "Y"
      )
    );
    expect(
      selectAdamRows(run.datasets, "ADAE", {
        compoundExpression: {
          logicalOperator: "OR",
          whereClauses: [female, teae],
        },
      })
    ).toEqual(
      indexes(
        adae,
        (item) =>
          subjects.get(item.USUBJID)?.SEX === "F" || item.TRTEMFL === "Y"
      )
    );
    expect(
      selectAdamRows(run.datasets, "ADAE", {
        compoundExpression: {
          logicalOperator: "NOT",
          whereClauses: [{ ...teae, order: 1 }],
        },
      })
    ).toEqual(indexes(adae, (item) => item.TRTEMFL !== "Y"));
  });

  it("rejects clauses it cannot evaluate", () => {
    expect(() =>
      selectAdamRows(run.datasets, "ADXX", where("ADSL", "AGE", "EQ", "1"))
    ).toThrow(RangeError);
    expect(() =>
      selectAdamRows(run.datasets, "ADSL", where("ADVS", "AVAL", "EQ", "1"))
    ).toThrow(RangeError);
    expect(() =>
      selectAdamRows(run.datasets, "ADSL", where("ADSL", "AGE", "EQ", "1", "2"))
    ).toThrow(RangeError);
    expect(() =>
      selectAdamRows(run.datasets, "ADSL", where("ADSL", "AGE", "EQ", "old"))
    ).toThrow(RangeError);
    expect(() =>
      selectAdamRows(run.datasets, "ADSL", {
        compoundExpression: { logicalOperator: "NOT", whereClauses: [] },
      })
    ).toThrow(RangeError);
  });

  it("selects the populations the reporting event declares", () => {
    for (const set of event.analysisSets) {
      const flag = set.id === "AnalysisSet_SAF" ? "SAFFL" : "ITTFL";
      expect(selectAdamRows(run.datasets, "ADSL", set)).toEqual(
        indexes(adsl, (item) => item[flag] === "Y")
      );
    }
  });
});

describe("a treatment received that no arm plans (#3673)", () => {
  const unplanned = runPipeline(DEMO_301_STUDY, {
    seed: 301,
    nSubjects: 90,
    scenarios: ["unplanned-treatment"],
  });
  const built = buildTlfOutputs(DEMO_301_STUDY, unplanned);
  const adsl = unplanned.datasets.find(
    (dataset) => dataset.layer === "adam" && dataset.name === "ADSL"
  )!;
  const safety = adsl.columns.SAFFL.filter((flag) => flag === "Y").length;
  const arms = DEMO_301_STUDY.design.arms.map((arm) => arm.name);
  // The tables whose columns are treatment received.
  const byReceived = (tables: readonly TlfTable[]) =>
    tables.filter(
      (table) =>
        table.columns.length > 0 &&
        table.columns.every(
          (column) => column.groupingId === "AnlsGrouping_TRT01A"
        )
    );

  it("gives the unplanned treatment its own column after the planned arms", () => {
    for (const table of byReceived(built.tables)) {
      expect(table.columns.map((column) => column.label)).toEqual([
        ...arms,
        "Demoxacin 40 mg",
      ]);
      expect(table.columns.at(-1)?.bigN).toBe(1);
    }
  });

  it("adds up the safety columns' N to the Safety Set", () => {
    const safetyTables = byReceived(built.tables).filter(
      (table) => table.population === "Safety Set"
    );
    expect(safetyTables.length).toBeGreaterThan(0);
    for (const table of safetyTables) {
      expect(table.columns.reduce((sum, column) => sum + column.bigN, 0)).toBe(
        safety
      );
    }
    const [figure] = built.figures;
    expect(figure.curves.map((curve) => curve.label)).toEqual([
      ...arms,
      "Demoxacin 40 mg",
    ]);
    expect(figure.curves.reduce((sum, curve) => sum + curve.bigN, 0)).toBe(
      safety
    );
  });

  it("leaves the planned-treatment grouping to the planned arms", () => {
    const planned = built.reportingEvent.analysisGroupings.find(
      (factor) => factor.groupingVariable === "TRT01P"
    )!;
    expect(planned.groups.map((group) => group.name)).toEqual(arms);
  });

  it("reproduces the reporting event it wrote", () => {
    expect(
      checkReportingEvent(built.reportingEvent, unplanned, DEMO_301_STUDY)
    ).toEqual([]);
  });

  it("adds no column to a run where every treatment is planned", () => {
    expect(byReceived(outputs.tables).length).toBeGreaterThan(1);
    for (const table of byReceived(outputs.tables)) {
      expect(table.columns.map((column) => column.label)).toEqual(arms);
    }
  });
});

describe("checkReportingEvent (#2932)", () => {
  const event = outputs.reportingEvent;
  const ruleIds = (findings: readonly { ruleId: string }[]) =>
    findings.map((finding) => finding.ruleId);
  /** The event with one result replaced. */
  const withResult = (
    id: string,
    change: (result: ArsOperationResult) => ArsOperationResult
  ): ArsReportingEvent => ({
    ...event,
    analyses: event.analyses.map((analysis) => ({
      ...analysis,
      results: analysis.results.map((result) =>
        result.id === id ? change(result) : result
      ),
    })),
  });
  const counted = event.analyses
    .flatMap((analysis) => analysis.results)
    .find(
      (result) =>
        result.rowReferences.length === 2 &&
        result.rawValue !== undefined &&
        Number(result.rawValue) > 1
    )!;

  it("finds every seed-301 result resolves and reproduces", () => {
    expect(checkReportingEvent(event, run, DEMO_301_STUDY)).toEqual([]);
  });

  // Runs the full pipeline and reporting event once per seed and scenario.
  it("finds no gap across seeds and the messy-data scenarios", () => {
    const runs: { seed: number; scenarios?: ScenarioId[] }[] = [
      ...[1, 2, 302, 999].map((seed) => ({ seed })),
      ...MESSY_DATA_SCENARIOS.map((scenario) => ({
        seed: 301,
        scenarios: [scenario.id],
      })),
    ];
    for (const options of runs) {
      const source = runPipeline(DEMO_301_STUDY, { ...options, nSubjects: 60 });
      const built = buildTlfOutputs(DEMO_301_STUDY, source).reportingEvent;
      const findings = checkReportingEvent(built, source, DEMO_301_STUDY);
      // A rescreened subject has two ADSL records under one USUBJID until
      // the rescreen gets its own number, so its rows cannot be told apart.
      expect(ruleIds(findings), JSON.stringify(options)).toEqual(
        options.scenarios?.[0] === "rescreened-subject"
          ? [REPORTING_EVENT_RULES.rowIdDuplicate]
          : []
      );
    }
  }, 120_000);

  it("reports a result that names a row set the event does not hold", () => {
    const findings = checkReportingEvent(
      withResult(counted.id, (result) => ({
        ...result,
        rowReferences: [
          ...result.rowReferences.slice(0, 1),
          { role: "analysis", rowSetId: "RowSet_9999" },
        ],
      })),
      run
    );
    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: REPORTING_EVENT_RULES.rowSetUnresolved,
        severity: "error",
        layer: "adam",
        message: expect.stringContaining("RowSet_9999"),
      }),
    ]);
  });

  it("reports a result with no rows that is not a zero count, and allows one that is", () => {
    const empty = (rawValue: string) =>
      checkReportingEvent(
        withResult(counted.id, (result) => ({
          ...result,
          rawValue,
          rowReferences: [],
        })),
        run
      );
    expect(ruleIds(empty(counted.rawValue!))).toEqual([
      REPORTING_EVENT_RULES.rowSetEmpty,
    ]);
    expect(empty("0")).toEqual([]);
  });

  it("reports a result whose value disagrees with its rows", () => {
    const findings = checkReportingEvent(
      withResult(counted.id, (result) => ({
        ...result,
        rawValue: String(Number(result.rawValue) + 1),
        formattedValue: String(Number(result.rawValue) + 1),
      })),
      run,
      DEMO_301_STUDY
    );
    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: REPORTING_EVENT_RULES.resultNotReproduced,
        message: expect.stringContaining(
          `Result ${counted.id} does not reproduce`
        ),
      }),
    ]);
  });

  it("reports a result whose rows are another result's rows", () => {
    const other = event.analyses
      .flatMap((analysis) => analysis.results)
      .find(
        (result) =>
          result.id !== counted.id &&
          result.rowReferences.length === 2 &&
          result.rowReferences[1].rowSetId !==
            counted.rowReferences[1].rowSetId &&
          result.rowReferences[0].rowSetId === counted.rowReferences[0].rowSetId
      )!;
    const findings = checkReportingEvent(
      withResult(counted.id, (result) => ({
        ...result,
        rowReferences: other.rowReferences,
      })),
      run,
      DEMO_301_STUDY
    );
    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: REPORTING_EVENT_RULES.resultNotReproduced,
        message: expect.stringContaining("its rows differ"),
      }),
    ]);
  });

  it("reports a result the analyses produce but the event lacks", () => {
    const findings = checkReportingEvent(
      {
        ...event,
        analyses: event.analyses.map((analysis) => ({
          ...analysis,
          results: analysis.results.filter(
            (result) => result.id !== counted.id
          ),
        })),
      },
      run,
      DEMO_301_STUDY
    );
    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: REPORTING_EVENT_RULES.resultMissing,
        message: expect.stringContaining(counted.id),
      }),
    ]);
  });

  it("puts unresolved results in the package manifest", async () => {
    const pkg = await buildStudyDataPackage(run, {
      generatedAt: "2026-10-23T12:00:00.000Z",
      reportingEvent: withResult(counted.id, (result) => ({
        ...result,
        rowReferences: [{ role: "analysis", rowSetId: "RowSet_9999" }],
      })),
    });
    expect(
      ruleIds(pkg.packageManifest.findings).filter((id) =>
        id.startsWith("ARS-")
      )
    ).toEqual([REPORTING_EVENT_RULES.rowSetUnresolved]);
  });
});
