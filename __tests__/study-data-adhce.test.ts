// @vitest-environment node
/**
 * ADHCE, the hierarchical composite endpoint dataset of DEMO-301, and the
 * ADTTE parameters it reads (epic #3101, step 3): structure, traceability
 * to the source records, Define-XML value-level metadata, and that the
 * win statistics engine can analyse it as it stands.
 */
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  buildDefine,
  checkDefineParity,
  runPipeline,
  valueListOid,
  winStatistics,
  type CellValue,
  type Dataset,
  type PipelineRun,
  type WinRatioComponent,
  type WinRatioSubject,
} from "@/lib/study-data";

const CREATED_AT = "2026-10-27T12:00:00.000Z";
const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });

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

/** The DEMO-301 hierarchy as the analysis will declare it. */
const COMPONENTS: readonly WinRatioComponent[] = [
  { id: "HCEDTH", label: "Death", kind: "time-to-event", better: "higher" },
  {
    id: "HCESAE",
    label: "Serious TEAE",
    kind: "time-to-event",
    better: "higher",
  },
  {
    id: "HCERESC",
    label: "Rescue medication",
    kind: "time-to-event",
    better: "higher",
  },
  {
    id: "HCESBP",
    label: "SBP change at Week 12",
    kind: "continuous",
    better: "lower",
    margin: 5,
  },
];

/** ADHCE records of one active arm and placebo, as engine subjects. */
function subjectsFor(
  source: PipelineRun,
  treatment: string
): WinRatioSubject[] {
  const grouped = new Map<string, Record<string, CellValue>[]>();
  for (const row of rowsOf(adam(source, "ADHCE"))) {
    if (row.TRT01P !== treatment && row.TRT01P !== "Placebo") continue;
    const key = String(row.USUBJID);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.entries()].map(([id, records]) => ({
    id,
    group: records[0].TRT01P === "Placebo" ? "control" : "treatment",
    outcomes: COMPONENTS.map(({ id: paramcd }) => {
      const record = records.find((item) => item.PARAMCD === paramcd)!;
      return {
        value: typeof record.AVAL === "number" ? record.AVAL : null,
        ...(record.CNSR === null ? {} : { event: record.CNSR === 0 }),
      };
    }),
  }));
}

describe("ADTTE parameters for the hierarchical composite", () => {
  const adtte = rowsOf(adam(run, "ADTTE"));

  it("gives every dosed subject one record per parameter, in ASEQ order", () => {
    const dosed = rowsOf(adam(run, "ADSL")).filter((row) => row.SAFFL === "Y");
    expect(adtte).toHaveLength(dosed.length * 4);
    for (const subject of dosed) {
      expect(
        adtte
          .filter((row) => row.USUBJID === subject.USUBJID)
          .map((row) => [row.ASEQ, row.PARAMCD])
      ).toEqual([
        [1, "TTADISC"],
        [2, "TTDTH"],
        [3, "TTSAE"],
        [4, "TTRESC"],
      ]);
    }
  });

  it("points each event at its SDTM record", () => {
    const sdtm = (name: string) =>
      rowsOf(
        run.datasets.find(
          (dataset) => dataset.layer === "sdtm" && dataset.name === name
        )!
      );
    const ae = sdtm("AE");
    const cm = sdtm("CM");
    const events = adtte.filter(
      (row) => row.CNSR === 0 && row.PARAMCD !== "TTADISC"
    );
    expect(events.length).toBeGreaterThan(0);
    for (const row of events) {
      const source =
        row.SRCDOM === "AE"
          ? ae.find(
              (record) =>
                record.USUBJID === row.USUBJID && record.AESEQ === row.SRCSEQ
            )
          : cm.find(
              (record) =>
                record.USUBJID === row.USUBJID && record.CMSEQ === row.SRCSEQ
            );
      expect(source, `${row.USUBJID} ${row.PARAMCD}`).toBeDefined();
      if (row.PARAMCD === "TTSAE") expect(source!.AESER).toBe("Y");
      if (row.PARAMCD === "TTRESC")
        expect(source!.CMCAT).toBe("RESCUE MEDICATION");
    }
  });

  it("records a death as an event and censors the other parameters there", () => {
    const died = runPipeline(DEMO_301_STUDY, {
      seed: 301,
      nSubjects: 90,
      scenarios: ["death-during-treatment"],
    });
    const rows = rowsOf(adam(died, "ADTTE"));
    const death = rows.find((row) => row.PARAMCD === "TTDTH" && row.CNSR === 0);
    expect(death).toMatchObject({
      EVNTDESC: "Death",
      SRCDOM: "DM",
      SRCVAR: "DTHDTC",
      SRCSEQ: null,
    });
    for (const row of rows.filter(
      (item) =>
        item.USUBJID === death!.USUBJID &&
        ["TTSAE", "TTRESC"].includes(String(item.PARAMCD)) &&
        item.CNSR === 1
    )) {
      expect(String(row.ADT) <= String(death!.ADT)).toBe(true);
    }
  });
});

describe("ADHCE", () => {
  const adhce = adam(run, "ADHCE");
  const rows = rowsOf(adhce);

  it("is a BDS dataset with one record per ITT subject per component", () => {
    expect(adhce).toMatchObject({
      class: "BDS",
      structure: "One record per subject per hierarchy component",
      keys: ["STUDYID", "USUBJID", "ASEQ"],
    });
    const itt = rowsOf(adam(run, "ADSL")).filter((row) => row.ITTFL === "Y");
    expect(rows).toHaveLength(itt.length * COMPONENTS.length);
    for (const subject of itt) {
      expect(
        rows
          .filter((row) => row.USUBJID === subject.USUBJID)
          .map((row) => [row.PARAMN, row.PARAMCD])
      ).toEqual(
        COMPONENTS.map((component, index) => [index + 1, component.id])
      );
    }
  });

  it("flags exactly the records with a value for analysis", () => {
    for (const row of rows) {
      expect(row.ANL01FL).toBe(row.AVAL === null ? null : "Y");
      expect(row.CNSR === null).toBe(row.PARAMCD === "HCESBP");
    }
    expect(rows.some((row) => row.ANL01FL === null)).toBe(true);
  });

  it("keeps blood pressure changes at the collected precision", () => {
    for (const row of rows.filter((item) => item.PARAMCD === "HCESBP")) {
      if (typeof row.AVAL !== "number") continue;
      expect(Math.round(row.AVAL * 10) / 10).toBe(row.AVAL);
      expect(row).toMatchObject({ AVALU: "mmHg", SRCDOM: "VS" });
    }
  });

  it("traces every record to collected source records", () => {
    adhce.lineage!.forEach((links, row) => {
      expect(links.length, `row ${row}`).toBeGreaterThan(0);
    });
  });

  it("is described in Define-XML with a value list per parameter", () => {
    const define = buildDefine(run, { layer: "adam", createdAt: CREATED_AT });
    expect(checkDefineParity(define, run.datasets)).toEqual([]);
    const group = define.itemGroups.find((item) => item.name === "ADHCE");
    expect(group).toBeDefined();
    const list = define.valueLists.find(
      (item) => item.oid === valueListOid("ADHCE", "AVAL")
    )!;
    expect(list.itemRefs.map((ref) => ref.whereClauseOid)).toHaveLength(4);
    const methods = new Set(list.itemRefs.map((ref) => ref.methodOid));
    expect(methods.size).toBe(2);
    expect(
      define.methods.map((method) => method.description).join(" ")
    ).toContain("rounded to 0.1 mmHg");
  });

  it("is analysable by the win statistics engine for each active arm", () => {
    const arms = [...new Set(rows.map((row) => String(row.TRT01P)))].filter(
      (arm) => arm !== "Placebo"
    );
    expect(arms).toHaveLength(2);
    for (const arm of arms) {
      const subjects = subjectsFor(run, arm);
      const result = winStatistics(subjects, { components: COMPONENTS });
      expect(result.wins + result.losses + result.ties).toBe(result.pairs);
      expect(result.pairs).toBe(result.treatmentCount * result.controlCount);
      const decided = result.components.reduce(
        (sum, component) => sum + component.wins + component.losses,
        0
      );
      expect(decided).toBe(result.wins + result.losses);
      expect(result.components.at(-1)!.wins).toBeGreaterThan(0);
      expect(result.winRatio.estimate).not.toBeNull();
      expect(winStatistics(subjects, { components: COMPONENTS })).toEqual(
        result
      );
    }
  });
});
