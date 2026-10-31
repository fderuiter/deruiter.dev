import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  DEFAULT_SEED,
  DEFAULT_SUBJECT_COUNT,
  PIPELINE_STAGES,
  STANDARD_VERSIONS,
  SUBJECT_COUNT_LIMITS,
  SYNTHETIC_DATA_NOTICE,
  runPipeline,
  type StudyDefinition,
} from "@/lib/study-data";

const definition: StudyDefinition = DEMO_301_STUDY;

describe("study-data presets", () => {
  it("pins the standard versions ADR 0065 records", () => {
    expect(STANDARD_VERSIONS).toEqual({
      USDM: "4.0.0",
      SDTM: "2.0",
      SDTMIG: "3.4",
      ADaM: "2.1",
      ADaMIG: "1.3",
      OCCDS: "1.0",
      "ADaM-CR": "5.0",
      "Define-XML": "2.1",
      "Dataset-JSON": "1.1",
      ARS: "1.0",
      "NCI-EVS-CT": "2026-09-25",
    });
    expect(Object.isFrozen(STANDARD_VERSIONS)).toBe(true);
  });

  it("lists each stage once, from the study definition to lineage", () => {
    const ids = PIPELINE_STAGES.map((stage) => stage.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("usdm");
    expect(ids.at(-1)).toBe("lineage");
    expect(ids.indexOf("sdtm")).toBeLessThan(ids.indexOf("adam"));
  });

  it("keeps the default subject count inside the accepted limits", () => {
    expect(DEFAULT_SUBJECT_COUNT).toBeGreaterThanOrEqual(
      SUBJECT_COUNT_LIMITS.min
    );
    expect(DEFAULT_SUBJECT_COUNT).toBeLessThanOrEqual(SUBJECT_COUNT_LIMITS.max);
    expect(SYNTHETIC_DATA_NOTICE).toMatch(/synthetic/i);
  });
});

describe("runPipeline", () => {
  const options = { seed: DEFAULT_SEED, nSubjects: DEFAULT_SUBJECT_COUNT };

  it("returns a manifest that records the inputs and pinned standards", () => {
    const run = runPipeline(definition, options);
    expect(run.datasets.map((dataset) => dataset.name)).toEqual([
      "DM",
      "RAND",
      "SV",
      "EX",
      "VS",
      "LB",
      "EG",
      "AE",
      "CM",
      "DS",
      "MH",
      "IE",
      "CO",
      "TA",
      "TE",
      "TV",
      "TI",
      "TS",
      "DM",
      "SV",
      "EX",
      "CM",
      "AE",
      "MH",
      "IE",
      "VS",
      "LB",
      "EG",
      "DS",
      "SUPPDM",
      "RELREC",
      "SE",
      "CO",
      "ADSL",
      "ADVS",
      "ADLB",
      "ADEG",
      "ADAE",
      "ADCM",
      "ADTTE",
      "ADHCE",
    ]);
    expect(
      run.datasets.filter((dataset) => dataset.layer === "collected")
    ).toHaveLength(13);
    expect(
      run.datasets.filter((dataset) => dataset.layer === "sdtm")
    ).toHaveLength(20);
    expect(
      run.datasets.filter((dataset) => dataset.layer === "adam")
    ).toHaveLength(8);
    expect(run.conformance?.status).toBe("warning");
    expect(run.findings.length).toBeGreaterThan(0);
    expect(
      run.findings.every((finding) => finding.ruleId && finding.citation)
    ).toBe(true);
    expect(run.manifest).toEqual({
      studyId: "DEMO-301",
      seed: DEFAULT_SEED,
      nSubjects: DEFAULT_SUBJECT_COUNT,
      standards: STANDARD_VERSIONS,
      stages: ["usdm", "synth", "sdtm", "conformance", "adam"],
      outputs: [],
    });
  });

  it("is deterministic for the same inputs", () => {
    expect(JSON.stringify(runPipeline(definition, options))).toBe(
      JSON.stringify(runPipeline(definition, options))
    );
  });

  it.each([
    { seed: -1, nSubjects: 10 },
    { seed: 1.5, nSubjects: 10 },
    { seed: 0x100000000, nSubjects: 10 },
    { seed: 1, nSubjects: 0 },
    { seed: 1, nSubjects: SUBJECT_COUNT_LIMITS.max + 1 },
    { seed: 1, nSubjects: Number.NaN },
  ])("rejects out-of-range options %o", (bad) => {
    expect(() => runPipeline(definition, bad)).toThrow(RangeError);
  });

  it("rejects an empty study id", () => {
    expect(() => runPipeline({ ...definition, studyId: " " }, options)).toThrow(
      /studyId/
    );
  });
});
