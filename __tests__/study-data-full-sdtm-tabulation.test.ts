import { describe, expect, it } from "vitest";
import { STUDY_PRESETS, exportStudyToUsdmObject } from "@/lib/crf";
import {
  HANDOFF_GENERATED_DOMAINS,
  MODELLED_TESTS,
  PACKAGE_FIXED_TIMESTAMP,
  buildDefine,
  buildTlfOutputs,
  checkDefineParity,
  createLineageIndex,
  prepareStudyHandoff,
  runPipeline,
  writeDefineXml,
} from "@/lib/study-data";
import { TAVR_DEVICE_USDM, TAVR_SAVR_USDM } from "@/lib/study-workspace";

describe("full SDTM tabulation across CM, TR, PC, DI, DU, DE and expanded test codes", () => {
  it("declares CM, TR, PC, DI, DU, DE in HANDOFF_GENERATED_DOMAINS and all required test codes in MODELLED_TESTS", () => {
    for (const domain of ["CM", "TR", "PC", "DI", "DU", "DE"] as const) {
      expect(HANDOFF_GENERATED_DOMAINS).toContain(domain);
    }
    expect(MODELLED_TESTS.has("VS:HEIGHT")).toBe(true);
    expect(MODELLED_TESTS.has("VS:BMI")).toBe(true);
    expect(MODELLED_TESTS.has("VS:TEMP")).toBe(true);
    expect(MODELLED_TESTS.has("VS:RESP")).toBe(true);
    expect(MODELLED_TESTS.has("LB:NEUT")).toBe(true);
    expect(MODELLED_TESTS.has("EG:QTc")).toBe(true);
    expect(MODELLED_TESTS.has("EG:QTCBAG")).toBe(true);
    expect(MODELLED_TESTS.has("QS:PHQ-9")).toBe(true);
    expect(MODELLED_TESTS.has("QS:MMSE")).toBe(true);
  });

  it("tabulates every CRF Studio preset and TAVR study with zero domain-not-generated or test-not-modelled skips", () => {
    const studies = [
      ...STUDY_PRESETS.map((p) => ({
        id: p.id,
        usdm: exportStudyToUsdmObject(p.study),
      })),
      { id: "tavr_savr", usdm: TAVR_SAVR_USDM },
      { id: "tavr_device", usdm: TAVR_DEVICE_USDM },
    ];

    for (const { id, usdm } of studies) {
      const { definition, report } = prepareStudyHandoff(usdm);
      expect(report.notTabulatedDomains, id).toEqual([]);
      expect(
        report.activities.filter((a) => !a.tabulated),
        id
      ).toEqual([]);
      expect(
        report.activities.flatMap((a) =>
          a.skippedConcepts.filter((c) => c.reason === "test-not-modelled")
        ),
        id
      ).toEqual([]);

      const run = runPipeline(definition, { seed: 2595, nSubjects: 18 });
      const outputs = buildTlfOutputs(definition, run);
      const lineage = createLineageIndex(definition, run, outputs);
      expect(lineage).toBeDefined();

      for (const domain of report.tabulatedDomains) {
        const ds = run.datasets.find(
          (d) => d.layer === "sdtm" && d.name === domain
        );
        expect(ds, `${id}:${domain}`).toBeDefined();
        expect(ds!.rowCount, `${id}:${domain} rows`).toBeGreaterThan(0);
        expect(ds!.variables.length).toBeGreaterThan(0);
      }

      const define = buildDefine(run, {
        layer: "sdtm",
        createdAt: PACKAGE_FIXED_TIMESTAMP,
      });
      expect(checkDefineParity(define, run.datasets), id).toEqual([]);
      expect(writeDefineXml(define)).toContain("<ODM");
    }
  });
});
