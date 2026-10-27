// @vitest-environment node
/**
 * Table 14.2.3 and its ARS analyses (epic #3101, step 4): the win ratio,
 * net benefit and win odds of the DEMO-301 hierarchical composite, each
 * active arm against placebo. The results must match the engine run
 * directly on ADHCE, reproduce from the reporting event, and name the
 * ADHCE rows each one was decided on.
 */
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  buildTlfOutputs,
  checkReportingEvent,
  indexAdamRows,
  resolveResultRows,
  runPipeline,
  winStatistics,
  writeArsJson,
  type ArsAnalysis,
  type CellValue,
  type Dataset,
  type PipelineRun,
  type StudyDefinition,
  type TlfTable,
  type WinRatioComponent,
  type WinRatioSubject,
} from "@/lib/study-data";

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
const outputs = buildTlfOutputs(DEMO_301_STUDY, run);
const event = outputs.reportingEvent;

const COMPONENTS: readonly WinRatioComponent[] = [
  { id: "HCEDTH", label: "Death", kind: "time-to-event", better: "higher" },
  { id: "HCESAE", label: "SAE", kind: "time-to-event", better: "higher" },
  { id: "HCERESC", label: "Rescue", kind: "time-to-event", better: "higher" },
  {
    id: "HCESBP",
    label: "SBP",
    kind: "continuous",
    better: "lower",
    margin: 5,
  },
];

function adam(source: PipelineRun, name: string): Dataset {
  return source.datasets.find(
    (dataset) => dataset.layer === "adam" && dataset.name === name
  )!;
}

function rowsOf(dataset: Dataset): Record<string, CellValue>[] {
  return Array.from({ length: dataset.rowCount }, (_, row) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [name, dataset.columns[name][row]])
    )
  );
}

function table(): TlfTable {
  return outputs.tables.find((item) => item.number === "14.2.3")!;
}

function analysis(id: string): ArsAnalysis {
  return event.analyses.find((item) => item.id === id)!;
}

function value(analysisId: string, operationId: string, groupId?: string) {
  return analysis(analysisId).results.find(
    (result) =>
      result.operationId === operationId &&
      (groupId === undefined
        ? result.resultGroups.length === 0
        : result.resultGroups.some((group) => group.groupId === groupId))
  )!;
}

/** The engine run directly on ADHCE, independently of the plan. */
function direct(arm: string) {
  const grouped = new Map<string, Record<string, CellValue>[]>();
  for (const row of rowsOf(adam(run, "ADHCE"))) {
    if (row.TRT01P !== arm && row.TRT01P !== "Placebo") continue;
    const key = String(row.USUBJID);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  const subjects: WinRatioSubject[] = [...grouped.entries()].map(
    ([id, records]) => ({
      id,
      group: records[0].TRT01P === "Placebo" ? "control" : "treatment",
      outcomes: COMPONENTS.map(({ id: paramcd }) => {
        const record = records.find((item) => item.PARAMCD === paramcd)!;
        return {
          value: typeof record.AVAL === "number" ? record.AVAL : null,
          ...(record.CNSR === null ? {} : { event: record.CNSR === 0 }),
        };
      }),
    })
  );
  return winStatistics(subjects, { components: COMPONENTS });
}

describe("Table 14.2.3, win statistics for the hierarchical composite", () => {
  it("compares each active arm with placebo, in arm order", () => {
    expect(table().columns.map((column) => column.label)).toEqual([
      "Demoxacin 10 mg vs Placebo",
      "Demoxacin 20 mg vs Placebo",
    ]);
    expect(table().sections.map((section) => section.label)).toEqual([
      "1. Death from any cause",
      "2. First serious TEAE",
      "3. First rescue medication",
      "4. SBP change from baseline at Week 12",
      "All components",
    ]);
    expect(table().footnotes.join(" ")).toContain("Placebo (N=");
  });

  it("matches the engine run directly on ADHCE", () => {
    for (const [code, arm] of [
      ["DMX10", "Demoxacin 10 mg"],
      ["DMX20", "Demoxacin 20 mg"],
    ] as const) {
      const expected = direct(arm);
      const overall = `An_14_2_3_WIN_${code}`;
      expect(value(overall, "Mth_WinStat_PAIRS").rawValue).toBe(
        String(expected.pairs)
      );
      expect(value(overall, "Mth_WinStat_WINS").rawValue).toBe(
        String(expected.wins)
      );
      expect(value(overall, "Mth_WinStat_LOSSES").rawValue).toBe(
        String(expected.losses)
      );
      expect(value(overall, "Mth_WinStat_TIES").rawValue).toBe(
        String(expected.ties)
      );
      expect(Number(value(overall, "Mth_WinStat_WR").rawValue)).toBe(
        expected.winRatio.estimate
      );
      expect(Number(value(overall, "Mth_WinStat_WR_LCL").rawValue)).toBe(
        expected.winRatio.lower
      );
      expect(Number(value(overall, "Mth_WinStat_NB_UCL").rawValue)).toBe(
        expected.netBenefit.upper
      );
      expect(Number(value(overall, "Mth_WinStat_WO").rawValue)).toBe(
        expected.winOdds.estimate
      );
      expect(Number(value(overall, "Mth_WinStat_FS_Z").rawValue)).toBe(
        expected.finkelsteinSchoenfeld.zStatistic
      );
      expected.components.forEach((component) => {
        const group = `Grp_HCE_${component.componentId}`;
        const components = `An_14_2_3_COMP_${code}`;
        expect(value(components, "Mth_WinComp_WINS", group).rawValue).toBe(
          String(component.wins)
        );
        expect(value(components, "Mth_WinComp_LOSSES", group).rawValue).toBe(
          String(component.losses)
        );
        expect(value(components, "Mth_WinComp_TIES", group).rawValue).toBe(
          String(component.tiesAfter)
        );
      });
    }
  });

  it("adds up: decided pairs by component are the overall wins and losses", () => {
    for (const code of ["DMX10", "DMX20"]) {
      const components = analysis(`An_14_2_3_COMP_${code}`).results;
      const sum = (operationId: string) =>
        components
          .filter((result) => result.operationId === operationId)
          .reduce((total, result) => total + Number(result.rawValue), 0);
      const overall = (operationId: string) =>
        Number(value(`An_14_2_3_WIN_${code}`, operationId).rawValue);
      expect(sum("Mth_WinComp_WINS")).toBe(overall("Mth_WinStat_WINS"));
      expect(sum("Mth_WinComp_LOSSES")).toBe(overall("Mth_WinStat_LOSSES"));
      expect(
        Number(
          value(`An_14_2_3_COMP_${code}`, "Mth_WinComp_TIES", "Grp_HCE_HCESBP")
            .rawValue
        )
      ).toBe(overall("Mth_WinStat_TIES"));
    }
  });

  it("shows each interval as the estimate and its limits, from three results", () => {
    const row = table().sections.at(-1)!.rows[4];
    expect(row.label).toBe("Win ratio (95% CI)");
    for (const cell of row.cells) {
      expect(cell.text).toMatch(/^\d+\.\d{2} \(\d+\.\d{2}, \d+\.\d{2}\)$/);
      expect(cell.resultIds).toHaveLength(3);
    }
  });
});

describe("ARS analyses of the win statistics", () => {
  it("declares the win ratio's numerator and denominator", () => {
    const method = event.methods.find((item) => item.id === "Mth_WinStat")!;
    const ratio = method.operations.find(
      (operation) => operation.id === "Mth_WinStat_WR"
    )!;
    expect(
      ratio.referencedOperationRelationships?.map((item) => [
        item.referencedOperationRole.controlledTerm,
        item.operationId,
      ])
    ).toEqual([
      ["NUMERATOR", "Mth_WinStat_WINS"],
      ["DENOMINATOR", "Mth_WinStat_LOSSES"],
    ]);
    expect(
      analysis("An_14_2_3_WIN_DMX10").referencedAnalysisOperations
    ).toEqual([
      {
        referencedOperationRelationshipId: "Mth_WinStat_WR_NUM",
        analysisId: "An_14_2_3_WIN_DMX10",
      },
      {
        referencedOperationRelationshipId: "Mth_WinStat_WR_DEN",
        analysisId: "An_14_2_3_WIN_DMX10",
      },
    ]);
  });

  it("states the hierarchy, its order and its margins as grouping data", () => {
    const grouping = event.analysisGroupings.find(
      (item) => item.id === "AnlsGrouping_HCE_COMPONENT"
    )!;
    expect(grouping).toMatchObject({
      groupingDataset: "ADHCE",
      groupingVariable: "PARAMCD",
      dataDriven: false,
    });
    expect(grouping.groups.map((group) => [group.order, group.name])).toEqual(
      COMPONENTS.map((component, index) => [index + 1, component.id])
    );
    expect(grouping.groups.at(-1)!.label).toContain("5 mmHg or less tie");
  });

  it("restricts each comparison to its two arms", () => {
    const subset = event.dataSubsets.find(
      (item) => item.id === "Dss_HCE_DMX20"
    )!;
    expect(subset).toMatchObject({
      condition: {
        dataset: "ADHCE",
        variable: "TRT01P",
        comparator: "IN",
        value: ["Demoxacin 20 mg", "Placebo"],
      },
    });
  });

  it("names the rows a component decided pairs on, and no later component", () => {
    const index = indexAdamRows(run.datasets);
    const adhce = rowsOf(adam(run, "ADHCE"));
    const sae = analysis("An_14_2_3_COMP_DMX10").results.find(
      (result) =>
        result.operationId === "Mth_WinComp_WINS" &&
        result.resultGroups[0].groupId === "Grp_HCE_HCESAE"
    )!;
    const params = new Set(
      resolveResultRows(event, index, sae)
        .filter((row) => row.role === "analysis")
        .map((row) => {
          expect(row.dataset).toBe("ADHCE");
          return adhce[row.rowIndex].PARAMCD;
        })
    );
    expect([...params].sort()).toEqual(["HCEDTH", "HCESAE"]);
  });

  it("reproduces from the run and keeps the comparison out of the ARS file", () => {
    expect(checkReportingEvent(event, run, DEMO_301_STUDY)).toEqual([]);
    const ars = writeArsJson(event);
    expect(ars).not.toContain('"comparison"');
    expect(ars).toContain("An_14_2_3_WIN_DMX10");
  });
});

describe("a study with no comparator arm", () => {
  it("has no win-ratio table or analyses", () => {
    const study: StudyDefinition = {
      ...DEMO_301_STUDY,
      design: {
        ...DEMO_301_STUDY.design,
        arms: DEMO_301_STUDY.design.arms.map((arm) => ({
          ...arm,
          type: { code: "C174266", decode: "Experimental Arm" },
        })),
      },
    };
    const built = buildTlfOutputs(
      study,
      runPipeline(study, { seed: 301, nSubjects: 30 })
    );
    expect(built.tables.map((item) => item.number)).toEqual([
      "14.1.1",
      "14.2.1",
      "14.3.1",
    ]);
    expect(
      built.reportingEvent.analyses.some((item) =>
        item.id.startsWith("An_14_2_3")
      )
    ).toBe(false);
  });
});
