import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  StudyDefinitionError,
  prepareStudyHandoff,
  runPipeline,
  type Dataset,
} from "@/lib/study-data";
import { TAVR_SAVR_USDM } from "@/lib/study-workspace";

/**
 * Device-study randomisation (#3416): the TAVR versus SAVR study declares a
 * 1:1 ratio by permuted blocks within one stratification factor, in its
 * randomisation extension. The generator allocates by it and records the
 * stratum; a study with no extension is generated exactly as before.
 */

const RANDOMISATION_URL = "https://deruiter.dev/usdm/extensions/randomisation";
const TAVR = "arm_rct_tavr";
const SAVR = "arm_rct_savr";
const LEVELS = ["STS-PROM below 4%", "STS-PROM 4% or above"];

/** The device study with its randomisation extension replaced. */
function withRandomisation(value: unknown): unknown {
  const doc = structuredClone(TAVR_SAVR_USDM) as unknown as {
    study: {
      versions: {
        studyDesigns: { extensionAttributes?: Record<string, unknown>[] }[];
      }[];
    };
  };
  const design = doc.study.versions[0].studyDesigns[0];
  design.extensionAttributes = (design.extensionAttributes ?? []).map((ext) =>
    ext.url === RANDOMISATION_URL
      ? { ...ext, valueString: JSON.stringify(value) }
      : ext
  );
  return doc;
}

function find(datasets: readonly Dataset[], name: string): Dataset {
  const dataset = datasets.find((each) => each.name === name);
  if (!dataset) throw new Error(`no ${name} dataset`);
  return dataset;
}

function rows(dataset: Dataset): Record<string, string | number | null>[] {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map((variable) => [
        variable.name,
        dataset.columns[variable.name][index],
      ])
    )
  );
}

const device = prepareStudyHandoff(TAVR_SAVR_USDM).definition;
const armCode = new Map(device.design.arms.map((arm) => [arm.id, arm.armCode]));

/** Runs the pipeline and returns the collected randomisation records, in order. */
function allocation(definition: typeof device, nSubjects: number) {
  const { datasets } = runPipeline(definition, { seed: 3416, nSubjects });
  const rand = rows(find(datasets, "RAND"));
  return { datasets, rand };
}

describe("reading the randomisation extension", () => {
  it("reads the device study's ratio, method and stratum", () => {
    expect(device.design.randomisation).toEqual({
      ratio: { [TAVR]: 1, [SAVR]: 1 },
      method: "Permuted blocks within strata",
      strata: [
        {
          factor: "Surgical risk (STS-PROM)",
          adslVariable: "STRAT1R",
          levels: LEVELS,
        },
      ],
    });
  });

  it("leaves a study with no extension unrandomised", () => {
    expect(DEMO_301_STUDY.design.randomisation).toBeUndefined();
  });

  it.each([
    [{ ratio: { [TAVR]: 1, arm_other: 1 } }, /unknown arm arm_other/],
    [{ ratio: { [TAVR]: 1 } }, /omits arm arm_rct_savr/],
    [{ ratio: { [TAVR]: 0, [SAVR]: 1 } }, /not a positive whole number/],
    [{ ratio: { [TAVR]: 1.5, [SAVR]: 1 } }, /not a positive whole number/],
    [
      {
        ratio: { [TAVR]: 1, [SAVR]: 1 },
        strata: [{ factor: "Risk", adslVariable: "RISK", levels: ["a"] }],
      },
      /no ADSL STRATnR variable/,
    ],
    [
      {
        ratio: { [TAVR]: 1, [SAVR]: 1 },
        strata: [{ factor: "Risk", adslVariable: "STRAT1R", levels: [] }],
      },
      /needs distinct levels/,
    ],
  ])("rejects %j", (value, message) => {
    expect(() => prepareStudyHandoff(withRandomisation(value))).toThrow(
      StudyDefinitionError
    );
    expect(() => prepareStudyHandoff(withRandomisation(value))).toThrow(
      message
    );
  });
});

describe("allocating the device study", () => {
  const { datasets, rand } = allocation(device, 240);

  it("fills each stratum in balanced blocks of four", () => {
    for (const level of LEVELS) {
      const arms = rand
        .filter((row) => row.STRAT1R === level)
        .map((row) => row.ARMCD);
      expect(arms.length).toBeGreaterThan(40);
      // After every complete block the stratum is exactly 1:1.
      for (let end = 4; end <= arms.length; end += 4) {
        const block = arms.slice(0, end);
        expect(block.filter((arm) => arm === armCode.get(TAVR)).length).toBe(
          end / 2
        );
      }
    }
    const tavr = rand.filter((row) => row.ARMCD === armCode.get(TAVR)).length;
    const savr = rand.length - tavr;
    // At most half an open block of imbalance in each stratum.
    expect(Math.abs(tavr - savr)).toBeLessThanOrEqual(2 * LEVELS.length);
  });

  it("allocates by an unequal ratio when one is declared", () => {
    const twoToOne = prepareStudyHandoff(
      withRandomisation({
        ...device.design.randomisation,
        ratio: { [TAVR]: 2, [SAVR]: 1 },
      })
    ).definition;
    const result = allocation(twoToOne, 240).rand;
    for (const level of LEVELS) {
      const arms = result
        .filter((row) => row.STRAT1R === level)
        .map((row) => row.ARMCD);
      expect(arms.length).toBeGreaterThan(40);
      const complete = arms.slice(0, arms.length - (arms.length % 6));
      const tavr = complete.filter((arm) => arm === armCode.get(TAVR)).length;
      expect(tavr).toBe((complete.length * 2) / 3);
    }
  });

  it("records one declared stratum per randomised subject in SUPPDM", () => {
    const suppdm = rows(find(datasets, "SUPPDM"));
    const strata = suppdm.filter((row) => row.QNAM === "STRAT1R");
    const randomised = new Set(rand.map((row) => row.USUBJID));
    expect(strata.map((row) => row.USUBJID).sort()).toEqual(
      [...randomised].sort()
    );
    for (const row of strata) {
      expect(LEVELS).toContain(row.QVAL);
      expect(row.QVAL).toBe(
        rand.find((each) => each.USUBJID === row.USUBJID)?.STRAT1R
      );
    }
    // Both levels occur, so the stratum is drawn rather than fixed.
    expect(new Set(strata.map((row) => row.QVAL)).size).toBe(LEVELS.length);
  });

  it("keeps earlier subjects' arms and strata when the run is extended", () => {
    const shorter = allocation(device, 120).rand;
    expect(rand.slice(0, shorter.length)).toEqual(shorter);
  });
});

describe("a study without the extension", () => {
  it("generates DEMO-301 byte for byte as before", () => {
    // Every layer, collected to ADaM, hashed as it was on main before #3416.
    const { datasets } = runPipeline(DEMO_301_STUDY, {
      seed: 301,
      nSubjects: 90,
    });
    expect(
      createHash("sha256").update(JSON.stringify(datasets)).digest("hex")
    ).toBe("29e9f35df2f6de37fc9c48dc6c3ba17dfa63b085d4a0f3c6fd22d19f4f2c1574");
    expect(rows(find(datasets, "SUPPDM")).map((row) => row.QNAM)).not.toContain(
      "STRAT1R"
    );
    expect(find(datasets, "RAND").variables.map((v) => v.name)).not.toContain(
      "STRAT1R"
    );
  });
});
