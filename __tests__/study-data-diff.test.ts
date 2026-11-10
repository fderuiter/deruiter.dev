import { describe, expect, it } from "vitest";
import {
  diffRuns,
  isEmptyRunDiff,
  type Finding,
  type RunDiffInput,
  type TlfTable,
} from "@/lib/study-data";

function table(text: string): TlfTable {
  return {
    outputId: "Out_14_1_1",
    displayId: "Disp_14_1_1",
    number: "14.1.1",
    title: "Demographics",
    population: "Safety Set",
    stubHeader: "Characteristic",
    columns: [
      {
        id: "col1",
        label: "Placebo",
        groupingId: "TRT",
        groupId: "PBO",
        bigN: 10,
        bigNResultId: "R_N",
      },
    ],
    sections: [
      {
        id: "age",
        label: "Age (years)",
        rows: [
          { id: "mean", label: "Mean", cells: [{ text, resultIds: ["R1"] }] },
        ],
      },
    ],
    footnotes: [],
    notice: "Synthetic data.",
    fileBase: "t-14-1-1",
  };
}

const AGE_MISSING: Finding = {
  ruleId: "SD0002",
  severity: "error",
  layer: "sdtm",
  dataset: "DM",
  variable: "AGE",
  row: 3,
  message: "AGE is missing.",
};

const VISIT_LATE: Finding = {
  ruleId: "SD1001",
  severity: "warning",
  layer: "sdtm",
  dataset: "SV",
  row: 7,
  message: "The visit is outside its window.",
};

const previous: RunDiffInput = {
  findings: [AGE_MISSING],
  datasets: [
    { layer: "sdtm", name: "DM", rowCount: 10 },
    { layer: "sdtm", name: "SV", rowCount: 40 },
  ],
  tables: [table("48.4")],
};

const next: RunDiffInput = {
  findings: [VISIT_LATE],
  datasets: [
    { layer: "sdtm", name: "DM", rowCount: 10 },
    { layer: "sdtm", name: "SV", rowCount: 38 },
    { layer: "adam", name: "ADVS", rowCount: 120 },
  ],
  tables: [table("49.1")],
};

describe("diffRuns (#3160)", () => {
  it("gives three empty lists for the same run", () => {
    const diff = diffRuns(previous, previous);
    expect(diff).toEqual({ findings: [], rowCounts: [], tlfValues: [] });
    expect(isEmptyRunDiff(diff)).toBe(true);
  });

  it("lists findings added and removed", () => {
    expect(diffRuns(previous, next).findings).toEqual([
      { change: "removed", finding: AGE_MISSING },
      { change: "added", finding: VISIT_LATE },
    ]);
  });

  it("counts a repeated finding once per occurrence", () => {
    const twice = { ...previous, findings: [AGE_MISSING, AGE_MISSING] };
    expect(diffRuns(previous, twice).findings).toEqual([
      { change: "added", finding: AGE_MISSING },
    ]);
  });

  it("lists changed and new row counts, not unchanged ones", () => {
    expect(diffRuns(previous, next).rowCounts).toEqual([
      { layer: "sdtm", dataset: "SV", before: 40, after: 38 },
      { layer: "adam", dataset: "ADVS", before: null, after: 120 },
    ]);
  });

  it("lists changed table values with where they sit", () => {
    expect(diffRuns(previous, next).tlfValues).toEqual([
      {
        table: "14.1.1",
        location: "Age (years) · Mean · Placebo",
        before: "48.4",
        after: "49.1",
      },
    ]);
    expect(isEmptyRunDiff(diffRuns(previous, next))).toBe(false);
  });
});
