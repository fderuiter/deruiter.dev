import { describe, expect, it } from "vitest";
import {
  ADAM_METHODS,
  DEMO_301_STUDY,
  buildDefine,
  deriveAdamDatasets,
  runPipeline,
  type Dataset,
} from "@/lib/study-data";

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
const sdtm = run.datasets.filter((dataset) => dataset.layer === "sdtm");
const adeg = run.datasets.find(
  (dataset) => dataset.name === "ADEG" && dataset.layer === "adam"
)!;

function records(dataset: Dataset) {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [name, dataset.columns[name][index]])
    )
  );
}

/** A copy of a dataset without the rows the predicate matches. */
function without(
  dataset: Dataset,
  drop: (row: Record<string, unknown>) => boolean
): Dataset {
  const all = records(dataset);
  const keep = all.flatMap((row, index) => (drop(row) ? [] : [index]));
  return {
    ...dataset,
    columns: Object.fromEntries(
      Object.entries(dataset.columns).map(([name, values]) => [
        name,
        keep.map((index) => values[index]),
      ])
    ),
    rowCount: keep.length,
    lineage: keep.map((index) => dataset.lineage![index]),
  };
}

describe("ADEG (#2943)", () => {
  it("analyses every collected ECG interval and a derived QTcF", () => {
    const data = records(adeg);
    expect(new Set(data.map((row) => row.PARAMCD))).toEqual(
      new Set(["EGHRMN", "PRAG", "QRSAG", "QTAG", "RRAG", "QTCFAG"])
    );
    const qtcf = data.filter((row) => row.PARAMCD === "QTCFAG");
    expect(qtcf.length).toBeGreaterThan(0);
    expect(
      qtcf.every(
        (row) =>
          row.PARAM === "QTcF Interval, Aggregate" &&
          row.PARAMTYP === "DERIVED" &&
          row.AVALU === "ms" &&
          row.DTYPE !== "DERIVED"
      )
    ).toBe(true);
    expect(
      data
        .filter((row) => row.PARAMCD !== "QTCFAG")
        .every((row) => row.PARAMTYP === null)
    ).toBe(true);
  });

  it("matches hand-computed Fridericia values", () => {
    // QTcF = QT / (RR / 1000)^(1/3), rounded to 0.1 ms.
    const subject = records(adeg).filter(
      (row) => row.USUBJID === "DEMO-301-0002" && row.DTYPE === null
    );
    const at = (visit: string, param: string) =>
      subject.find((row) => row.AVISIT === visit && row.PARAMCD === param)!
        .AVAL;
    const cases = [
      // 416 / 1.034^(1/3) = 411.389...
      { visit: "SCREENING", qt: 416, rr: 1034, qtcf: 411.4 },
      // 404 / 0.984^(1/3) = 406.178...
      { visit: "BASELINE", qt: 404, rr: 984, qtcf: 406.2 },
      // RR of exactly one second leaves QT unchanged.
      { visit: "WEEK 4", qt: 411, rr: 1000, qtcf: 411 },
    ];
    for (const { visit, qt, rr, qtcf } of cases) {
      expect(at(visit, "QTAG")).toBe(qt);
      expect(at(visit, "RRAG")).toBe(rr);
      expect(at(visit, "QTCFAG")).toBe(qtcf);
    }
  });

  it("derives no QTcF for an ECG whose RR is missing", () => {
    const eg = sdtm.find((dataset) => dataset.name === "EG")!;
    const target = records(eg).find(
      (row) => row.USUBJID === "DEMO-301-0002" && row.VISIT === "BASELINE"
    )!;
    const sameEcg = (row: Record<string, unknown>) =>
      row.USUBJID === target.USUBJID && row.EGDTC === target.EGDTC;
    const result = deriveAdamDatasets(
      DEMO_301_STUDY,
      sdtm.map((dataset) =>
        dataset === eg
          ? without(eg, (row) => sameEcg(row) && row.EGTESTCD === "RRAG")
          : dataset
      )
    );
    const data = records(
      result.datasets.find((dataset) => dataset.name === "ADEG")!
    );
    const ecg = data.filter(
      (row) =>
        row.USUBJID === target.USUBJID &&
        row.ADT === target.EGDTC &&
        row.DTYPE === null
    );
    expect(ecg.map((row) => row.PARAMCD).sort()).toEqual([
      "EGHRMN",
      "PRAG",
      "QRSAG",
      "QTAG",
    ]);
    // The baseline QTcF falls back to the latest earlier ECG, at screening.
    const qtcf = data.filter(
      (row) => row.USUBJID === target.USUBJID && row.PARAMCD === "QTCFAG"
    );
    expect(qtcf.find((row) => row.ABLFL === "Y")?.AVAL).toBe(411.4);
  });

  it("flags one baseline per subject and parameter and derives change from it", () => {
    const data = records(adeg);
    const baselines = data.filter((row) => row.ABLFL === "Y");
    const keys = baselines.map((row) => `${row.USUBJID}|${row.PARAMCD}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const row of data)
      if (row.AVAL !== null && row.BASE !== null)
        expect(row.CHG).toBeCloseTo(Number(row.AVAL) - Number(row.BASE), 9);
  });

  it("traces each QTcF to both the QT and the RR it came from", () => {
    const eg = sdtm.find((dataset) => dataset.name === "EG")!;
    const egRows = records(eg);
    const data = records(adeg);
    data.forEach((row, index) => {
      if (row.PARAMCD !== "QTCFAG") return;
      const source = egRows.findIndex(
        (candidate) =>
          candidate.USUBJID === row.USUBJID && candidate.EGSEQ === row.SRCSEQ
      );
      expect(egRows[source].EGTESTCD).toBe("QTAG");
      const rr = egRows.findIndex(
        (candidate) =>
          candidate.USUBJID === row.USUBJID &&
          candidate.EGDTC === egRows[source].EGDTC &&
          candidate.EGTESTCD === "RRAG"
      );
      expect(adeg.lineage![index]).toEqual(
        expect.arrayContaining([
          ...eg.lineage![source].slice(0, 1),
          ...eg.lineage![rr].slice(0, 1),
        ])
      );
    });
  });

  it("describes QTcF as derived in the ADaM Define-XML", () => {
    const define = buildDefine(run, {
      layer: "adam",
      createdAt: "2026-10-23T12:00:00.000Z",
    });
    const aval = define.valueLists.find(
      (list) => list.dataset === "ADEG" && list.variable === "AVAL"
    )!;
    const qtcfRef = aval.itemRefs.find((ref) =>
      ref.itemOid.endsWith("QTCFAG")
    )!;
    const qtRef = aval.itemRefs.find((ref) => ref.itemOid.endsWith(".QTAG"))!;
    const method = define.methods.find(
      (candidate) => candidate.oid === qtcfRef.methodOid
    )!;
    expect(method.id).toBe("ADEG_QTCF");
    expect(method.description).toBe(ADAM_METHODS.ADEG_QTCF);
    expect(method.description).toMatch(/Fridericia/);
    expect(qtRef.methodOid).toBeUndefined();
    const item = (oid: string) =>
      define.items.find((candidate) => candidate.oid === oid)!;
    expect(item(qtcfRef.itemOid).origin.type).toBe("Derived");
    expect(item(qtRef.itemOid).origin.type).toBe("Predecessor");
  });
});
