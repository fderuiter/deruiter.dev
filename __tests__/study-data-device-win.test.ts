import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  buildTlfOutputs,
  prepareStudyHandoff,
  runPipeline,
  winStatistics,
  writeTableHtml,
  writeTableRtf,
  type CellValue,
  type Dataset,
  type WinRatioComponent,
  type WinRatioSubject,
} from "@/lib/study-data";
import { TAVR_SAVR_USDM } from "@/lib/study-workspace";
import {
  DEVICE_WIN_INPUT,
  DEVICE_WIN_RUN,
  deviceWinInput,
} from "../scripts/win-ratio-device-input";

/**
 * Stratified win statistics for the device study (#3424). The TAVR versus
 * SAVR study's 1-year hierarchical composite is compared within each
 * surgical-risk stratum and the strata are combined with Mantel-Haenszel
 * type weights. The reference values come from R: WINS::win.stat for the
 * statistics, and a separate Finkelstein-Schoenfeld test and pair-by-pair
 * stratum counts, run by scripts/r/win-ratio-reference.R over the seeded
 * study's Full Analysis Set.
 */

const FIXTURE_DIR = path.resolve(
  process.cwd(),
  "__tests__/fixtures/study-data/win-ratio-device"
);

type Input = ReturnType<typeof deviceWinInput>;

interface Reference {
  readonly settings: { readonly weighting: "MH-type" };
  readonly expected: {
    readonly per_endpoint: readonly { wins: number; losses: number }[];
    readonly strata: readonly {
      stratum: number;
      treatment: number;
      control: number;
      pairs: number;
      wins: number;
      losses: number;
      ties: number;
    }[];
    readonly win_ratio: Record<"WR" | "WR_L" | "WR_U", number>;
    readonly net_benefit: Record<"NB" | "NB_L" | "NB_U", number>;
    readonly win_odds: Record<"WO" | "WO_L" | "WO_U", number>;
    readonly z: Record<"zstat_WR" | "zstat_NB" | "zstat_WO", number>;
    readonly p: Record<"pvalue_WR" | "pvalue_NB" | "pvalue_WO", number>;
    readonly finkelstein_schoenfeld: {
      readonly statistic: number;
      readonly variance: number;
      readonly z: number;
      readonly p_two_sided: number;
    };
  };
}

const input: Input = JSON.parse(
  readFileSync(path.resolve(process.cwd(), DEVICE_WIN_INPUT), "utf8")
);
const reference: Reference = JSON.parse(
  readFileSync(path.join(FIXTURE_DIR, "tavr-savr-stratified-mh.json"), "utf8")
);
const { expected } = reference;

/** Relative tolerance against WINS, as in study-data-win-ratio.test.ts. */
const RELATIVE_TOLERANCE = 1e-12;

function expectClose(actual: number | null, value: number): void {
  expect(actual).not.toBeNull();
  const scale = Math.max(1, Math.abs(value));
  expect(Math.abs((actual ?? NaN) - value)).toBeLessThanOrEqual(
    RELATIVE_TOLERANCE * scale
  );
}

const COMPONENTS: WinRatioComponent[] = input.components.map((component) => ({
  id: component.paramcd,
  label: component.paramcd,
  kind: component.kind === "tte" ? "time-to-event" : "continuous",
  better: "higher",
  margin: component.margin,
}));

const SUBJECTS: WinRatioSubject[] = input.subjects.map((subject) => ({
  id: String(subject.usubjid),
  group: subject.arm === 1 ? "treatment" : "control",
  stratum: String(subject.stratum),
  outcomes: COMPONENTS.map((component, index) =>
    component.kind === "time-to-event"
      ? { value: subject.values[index], event: subject.events[index] === 1 }
      : { value: subject.values[index] }
  ),
}));

describe("the reference input", () => {
  it("is the seeded device study's Full Analysis Set as the pipeline derives it", () => {
    expect(deviceWinInput()).toEqual(input);
  });

  it("has both arms in both surgical-risk strata, and some missing 1-year scores", () => {
    expect(input.stratification).toEqual({
      variable: "STRAT1R",
      levels: ["STS-PROM below 4%", "STS-PROM 4% or above"],
    });
    for (const stratum of [1, 2]) {
      for (const arm of [1, 2]) {
        expect(
          input.subjects.filter(
            (subject) => subject.stratum === stratum && subject.arm === arm
          ).length
        ).toBeGreaterThan(20);
      }
    }
    expect(input.subjects.some((subject) => subject.values[3] === null)).toBe(
      true
    );
  });
});

describe("the stratified engine against R (WINS, MH-type weights)", () => {
  const result = winStatistics(SUBJECTS, {
    components: COMPONENTS,
    weighting: "mantel-haenszel",
  });

  it("matches the per-component win and loss counts exactly", () => {
    expect(
      result.components.map(({ wins, losses }) => ({ wins, losses }))
    ).toEqual(expected.per_endpoint);
  });

  it("matches the per-stratum counts, which sum to the overall counts", () => {
    expect(
      result.strata
        .map((stratum) => ({
          stratum: Number(stratum.stratum),
          treatment: stratum.treatmentCount,
          control: stratum.controlCount,
          pairs: stratum.pairs,
          wins: stratum.wins,
          losses: stratum.losses,
          ties: stratum.ties,
        }))
        .sort((a, b) => a.stratum - b.stratum)
    ).toEqual(expected.strata);
    const sum = (key: "pairs" | "wins" | "losses" | "ties") =>
      result.strata.reduce((total, stratum) => total + stratum[key], 0);
    expect(sum("pairs")).toBe(result.pairs);
    expect(sum("wins")).toBe(result.wins);
    expect(sum("losses")).toBe(result.losses);
    expect(sum("ties")).toBe(result.ties);
  });

  it("matches the win ratio, net benefit and win odds with their limits", () => {
    expectClose(result.winRatio.estimate, expected.win_ratio.WR);
    expectClose(result.winRatio.lower, expected.win_ratio.WR_L);
    expectClose(result.winRatio.upper, expected.win_ratio.WR_U);
    expectClose(result.netBenefit.estimate, expected.net_benefit.NB);
    expectClose(result.netBenefit.lower, expected.net_benefit.NB_L);
    expectClose(result.netBenefit.upper, expected.net_benefit.NB_U);
    expectClose(result.winOdds.estimate, expected.win_odds.WO);
    expectClose(result.winOdds.lower, expected.win_odds.WO_L);
    expectClose(result.winOdds.upper, expected.win_odds.WO_U);
  });

  it("matches the z statistics and two-sided p-values", () => {
    expectClose(result.winRatio.zStatistic, expected.z.zstat_WR);
    expectClose(result.netBenefit.zStatistic, expected.z.zstat_NB);
    expectClose(result.winOdds.zStatistic, expected.z.zstat_WO);
    expectClose(result.winRatio.pValue, expected.p.pvalue_WR);
    expectClose(result.netBenefit.pValue, expected.p.pvalue_NB);
    expectClose(result.winOdds.pValue, expected.p.pvalue_WO);
  });

  it("matches the stratified Finkelstein-Schoenfeld test", () => {
    const fs = result.finkelsteinSchoenfeld;
    expect(fs.statistic).toBe(expected.finkelstein_schoenfeld.statistic);
    expectClose(fs.variance, expected.finkelstein_schoenfeld.variance);
    expectClose(fs.zStatistic, expected.finkelstein_schoenfeld.z);
    expectClose(fs.pValue, expected.finkelstein_schoenfeld.p_two_sided);
  });
});

describe("Table 14.2.3 for the device study", () => {
  const device = prepareStudyHandoff(TAVR_SAVR_USDM).definition;
  const run = runPipeline(device, DEVICE_WIN_RUN);
  const outputs = buildTlfOutputs(device, run);
  const table = outputs.tables.find((each) => each.number === "14.2.3")!;
  const cell = (section: string, row: string) =>
    table.sections
      .find((each) => each.label === section)!
      .rows.find((each) => each.label === row)!.cells[0].text;

  it("compares TAVR with SAVR on the device hierarchy", () => {
    expect(table.columns.map((column) => column.label)).toEqual([
      "TAVR System vs Surgical AVR",
    ]);
    expect(table.sections.map((section) => section.label)).toEqual([
      "1. Death from any cause",
      "2. Disabling stroke",
      "3. Valve-related or heart-failure rehospitalisation",
      "4. VSFS overall summary change from baseline at 1 year",
      "All components",
      "Stratum: STS-PROM below 4%",
      "Stratum: STS-PROM 4% or above",
    ]);
  });

  it("shows the reference counts and statistics", () => {
    expected.per_endpoint.forEach(({ wins, losses }, index) => {
      const section = table.sections[index].label;
      expect(cell(section, "Wins")).toBe(String(wins));
      expect(cell(section, "Losses")).toBe(String(losses));
    });
    const wins = expected.strata.reduce((sum, s) => sum + s.wins, 0);
    const losses = expected.strata.reduce((sum, s) => sum + s.losses, 0);
    const pairs = expected.strata.reduce((sum, s) => sum + s.pairs, 0);
    expect(cell("All components", "Pairs compared")).toBe(String(pairs));
    expect(cell("All components", "Wins")).toBe(String(wins));
    expect(cell("All components", "Losses")).toBe(String(losses));
    expect(cell("All components", "Ties")).toBe(String(pairs - wins - losses));
    const { WR, WR_L, WR_U } = expected.win_ratio;
    expect(cell("All components", "Win ratio (95% CI)")).toBe(
      `${WR.toFixed(2)} (${WR_L.toFixed(2)}, ${WR_U.toFixed(2)})`
    );
    const { NB, NB_L, NB_U } = expected.net_benefit;
    expect(cell("All components", "Net benefit (95% CI)")).toBe(
      `${NB.toFixed(3)} (${NB_L.toFixed(3)}, ${NB_U.toFixed(3)})`
    );
    const { WO, WO_L, WO_U } = expected.win_odds;
    expect(cell("All components", "Win odds (95% CI)")).toBe(
      `${WO.toFixed(2)} (${WO_L.toFixed(2)}, ${WO_U.toFixed(2)})`
    );
    expect(cell("All components", "Win ratio p-value")).toBe(
      expected.p.pvalue_WR.toFixed(4)
    );
    expect(cell("All components", "Finkelstein-Schoenfeld z")).toBe(
      expected.finkelstein_schoenfeld.z.toFixed(2)
    );
  });

  it("shows per-stratum counts that sum to the overall counts", () => {
    input.stratification.levels.forEach((level, index) => {
      const stratum = expected.strata.find((s) => s.stratum === index + 1)!;
      const section = `Stratum: ${level}`;
      expect(cell(section, "Pairs compared")).toBe(String(stratum.pairs));
      expect(cell(section, "Wins")).toBe(String(stratum.wins));
      expect(cell(section, "Losses")).toBe(String(stratum.losses));
      expect(cell(section, "Ties")).toBe(String(stratum.ties));
    });
    for (const row of ["Pairs compared", "Wins", "Losses", "Ties"]) {
      const total = input.stratification.levels.reduce(
        (sum, level) => sum + Number(cell(`Stratum: ${level}`, row)),
        0
      );
      expect(total).toBe(Number(cell("All components", row)));
    }
  });

  it("footnotes the comparator N, the hierarchy, the Gehan rule and the variance method", () => {
    const savr = table.columns.length;
    expect(savr).toBe(1);
    const notes = table.footnotes.join(" ");
    expect(notes).toMatch(/compared with Surgical AVR \(N=\d+\)/);
    expect(notes).toContain("randomised in the same stratum of Surgical risk");
    expect(notes).toContain(
      "VSFS overall summary change from baseline at 1 year (a larger improvement is better, and differences of 5 points or less tie)"
    );
    expect(notes).toContain("Gehan rule");
    expect(notes).toContain("Mantel-Haenszel-type weights");
    expect(notes).toContain(
      "stratified U-statistic variances of Dong et al. (2018)"
    );
  });

  it("is written as HTML and RTF with the stratum rows", () => {
    const html = writeTableHtml(table);
    const rtf = writeTableRtf(table);
    expect(html).toContain("<th");
    expect(html).toContain("Stratum: STS-PROM 4% or above");
    expect(rtf).toContain("Stratum: STS-PROM 4% or above");
  });

  it("publishes the per-stratum analysis in the reporting event", () => {
    const analysis = outputs.reportingEvent.analyses.find(
      (each) => each.id === "An_14_2_3_STRAT_arm_rct_tavr"
    );
    expect(analysis?.methodId).toBe("Mth_WinStrata");
    expect(analysis?.results).toHaveLength(8);
    expect(analysis).not.toHaveProperty("hierarchy");
  });
});

describe("DEMO-301", () => {
  type Row = Record<string, CellValue>;
  const rows = (dataset: Dataset): Row[] =>
    Array.from({ length: dataset.rowCount }, (_, index) =>
      Object.fromEntries(
        dataset.variables.map(({ name }) => [
          name,
          dataset.columns[name][index],
        ])
      )
    );

  it("keeps its run and its table output byte for byte", () => {
    const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
    const tlf = buildTlfOutputs(DEMO_301_STUDY, run);
    const hash = (value: unknown) =>
      createHash("sha256")
        .update(typeof value === "string" ? value : JSON.stringify(value))
        .digest("hex");
    // The hashes of main before #3424.
    expect(hash(run)).toBe(
      "c0a66d6850127e6c8387cf038416b1524de99262df5604d2b06c87a6cef15dcd"
    );
    expect(hash(tlf)).toBe(
      "75f113c9d0d06d6b0db48775786647e9d5dd041d58eba9937196801aa028a4c6"
    );
    expect(hash(tlf.tables.map(writeTableHtml).join(""))).toBe(
      "00bfef862284cfa6a528c414fe6a23ed87c4c8c5e9dd33cd433f7e705a9a29f5"
    );
    expect(hash(tlf.tables.map(writeTableRtf).join(""))).toBe(
      "8cc21abedbd1d0147c8440f0bc4f519a1877d3ca3758aa97c94bef3b118714f5"
    );
    const adsl = run.datasets.find((dataset) => dataset.name === "ADSL")!;
    expect(rows(adsl)[0]).not.toHaveProperty("STRAT1R");
  });
});
