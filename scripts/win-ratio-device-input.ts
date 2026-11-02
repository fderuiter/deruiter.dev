/**
 * Writes the input of the device win-ratio reference fixture: the Full
 * Analysis Set of the seeded TAVR versus SAVR study, one record per
 * subject with its arm, randomisation stratum and ADHCE value on each
 * component of the hierarchy, read straight from ADSL and ADHCE.
 *
 * scripts/r/win-ratio-reference.R reads this file and writes the reference
 * values next to it. __tests__/study-data-device-win.test.ts checks that
 * this input is still what the pipeline produces, so a change to the
 * device data fails the test until both files are regenerated:
 *
 *   npx tsx scripts/win-ratio-device-input.ts
 *   Rscript scripts/r/win-ratio-reference.R
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareStudyHandoff,
  runPipeline,
  type CellValue,
  type Dataset,
} from "../lib/study-data";
import { TAVR_SAVR_USDM } from "../lib/study-workspace";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Where the input is written, relative to the repository root. */
export const DEVICE_WIN_INPUT =
  "__tests__/fixtures/study-data/win-ratio-device/tavr-savr-input.json";

/** The seed and size of the device run the fixture comes from. */
export const DEVICE_WIN_RUN = { seed: 3424, nSubjects: 240 } as const;

/** The ADHCE components, in priority order, in WINS terms. */
const COMPONENTS = [
  { paramcd: "HCEDTH", kind: "tte", better: "larger", margin: 0 },
  { paramcd: "HCESTRK", kind: "tte", better: "larger", margin: 0 },
  { paramcd: "HCEREHOS", kind: "tte", better: "larger", margin: 0 },
  { paramcd: "HCEVSFS", kind: "continuous", better: "larger", margin: 5 },
] as const;

type Row = Record<string, CellValue>;

function rows(dataset: Dataset): Row[] {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [name, dataset.columns[name][index]])
    )
  );
}

/** The input document: the run, the settings and the subjects. */
export function deviceWinInput() {
  const definition = prepareStudyHandoff(TAVR_SAVR_USDM).definition;
  const run = runPipeline(definition, DEVICE_WIN_RUN);
  const adam = (name: string) =>
    run.datasets.find(
      (dataset) => dataset.layer === "adam" && dataset.name === name
    )!;
  const arms = definition.design.arms;
  const control = arms.find((arm) => /comparator/i.test(arm.type.decode))!;
  const treatment = arms.find((arm) => arm !== control)!;
  const factor = definition.design.randomisation!.strata[0];
  const adhce = rows(adam("ADHCE"));
  const subjects = rows(adam("ADSL"))
    .filter(
      (row) =>
        row.ITTFL === "Y" &&
        (row.TRT01P === treatment.name || row.TRT01P === control.name)
    )
    .map((row, index) => {
      const records = COMPONENTS.map((component) =>
        adhce.find(
          (record) =>
            record.USUBJID === row.USUBJID &&
            record.PARAMCD === component.paramcd
        )
      );
      return {
        id: index + 1,
        usubjid: row.USUBJID,
        arm: row.TRT01P === treatment.name ? 1 : 2,
        stratum: factor.levels.indexOf(String(row[factor.adslVariable])) + 1,
        values: records.map((record) =>
          typeof record?.AVAL === "number" ? record.AVAL : null
        ),
        events: records.map((record, at) =>
          COMPONENTS[at].kind === "tte" ? (record?.CNSR === 0 ? 1 : 0) : null
        ),
      };
    });
  return {
    name: "tavr-savr-stratified-mh",
    generator: "scripts/win-ratio-device-input.ts",
    study: definition.studyId,
    run: DEVICE_WIN_RUN,
    treatment: treatment.name,
    control: control.name,
    stratification: {
      variable: factor.adslVariable,
      levels: factor.levels,
    },
    settings: { weighting: "MH-type", alpha: 0.05, sided: "two-sided" },
    components: COMPONENTS.map(({ paramcd, kind, better, margin }) => ({
      paramcd,
      kind,
      better,
      margin,
      horizon: null,
    })),
    subjects,
  };
}

const invoked = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;
if (invoked) {
  const file = path.join(ROOT, DEVICE_WIN_INPUT);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(deviceWinInput(), null, 2)}\n`);
  console.log(`Wrote ${DEVICE_WIN_INPUT}`);
}
