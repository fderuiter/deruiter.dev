import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  DEMO_301_USDM,
  readStudyDefinition,
  runPipeline,
} from "@/lib/study-data";

const options = { seed: 301, nSubjects: 90 };
const trial = (definition = DEMO_301_STUDY) =>
  runPipeline(definition, options).datasets.filter(
    (dataset) => dataset.class === "Trial Design"
  );

describe("USDM-derived trial design", () => {
  it("matches golden DEMO-301 datasets and carries protocol origin metadata", () => {
    for (const dataset of trial()) {
      const golden = JSON.parse(
        readFileSync(
          resolve(
            process.cwd(),
            "__tests__/fixtures/study-data/trial-design",
            `${dataset.name.toLowerCase()}.json`
          ),
          "utf8"
        )
      );
      expect(dataset).toEqual(golden);
      expect(
        dataset.variables.every((variable) => variable.origin === "Protocol")
      ).toBe(true);
      expect(
        dataset.variables.every((variable) => variable.label.length <= 40)
      ).toBe(true);
    }
    expect(trial().map((dataset) => [dataset.name, dataset.rowCount])).toEqual([
      ["TA", 9],
      ["TE", 5],
      ["TV", 7],
      ["TI", 3],
      ["TS", 11],
    ]);
  });

  it("changes TA when the USDM arm changes", () => {
    const modified = structuredClone(DEMO_301_USDM);
    modified.study.versions![0].studyDesigns![0].arms[0].label = "NEWPBO";
    const ta = trial(readStudyDefinition(modified)).find(
      (dataset) => dataset.name === "TA"
    )!;
    expect(ta.columns.ARMCD.filter((value) => value === "NEWPBO")).toHaveLength(
      3
    );
    expect(ta.columns.ARMCD).not.toContain("PBO");
  });

  it("changes TV when a USDM visit timing changes", () => {
    const modified = structuredClone(DEMO_301_USDM);
    const timings =
      modified.study.versions![0].studyDesigns![0].scheduleTimelines![0]
        .timings!;
    const weekFour = timings.find(
      (timing) => timing.id === "enc_week4_timing"
    )!;
    weekFour.value = "P29D";
    const tv = trial(readStudyDefinition(modified)).find(
      (dataset) => dataset.name === "TV"
    )!;
    expect(tv.columns.VISITDY).not.toEqual(
      trial().find((dataset) => dataset.name === "TV")!.columns.VISITDY
    );
  });
});
