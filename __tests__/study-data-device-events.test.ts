import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DEMO_301_STUDY,
  prepareStudyHandoff,
  runConformance,
  runPipeline,
  type Dataset,
} from "@/lib/study-data";
import { TAVR_SAVR_USDM } from "@/lib/study-workspace";

/**
 * Device deaths and adjudicated clinical events (#3417). The TAVR versus SAVR
 * study schedules a clinical events committee (CE) activity, so the
 * generator draws deaths, which end follow-up, and the committee's disabling
 * strokes and rehospitalisations. A study with no CE activity is generated
 * exactly as before.
 */

type Cell = string | number | null;

function find(
  datasets: readonly Dataset[],
  layer: Dataset["layer"],
  name: string
): Dataset | undefined {
  return datasets.find((each) => each.layer === layer && each.name === name);
}

function rows(dataset: Dataset | undefined): Record<string, Cell>[] {
  if (!dataset) return [];
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map((variable) => [
        variable.name,
        dataset.columns[variable.name][index] as Cell,
      ])
    )
  );
}

const handoff = prepareStudyHandoff(TAVR_SAVR_USDM);
const device = handoff.definition;
const run = runPipeline(device, { seed: 3417, nSubjects: 240 });

const deathBySubject = new Map(
  rows(find(run.datasets, "sdtm", "DS"))
    .filter((row) => row.DSDECOD === "DEATH")
    .map((row) => [row.USUBJID, String(row.DSSTDTC)])
);

describe("device deaths", () => {
  it("draws deaths in the device study", () => {
    expect(deathBySubject.size).toBeGreaterThan(3);
    expect(deathBySubject.size).toBeLessThan(40);
  });

  it("records no visit after a subject's death", () => {
    const visits = rows(find(run.datasets, "sdtm", "SV")).filter((row) =>
      deathBySubject.has(row.USUBJID)
    );
    expect(visits.length).toBeGreaterThan(0);
    for (const visit of visits) {
      const death = deathBySubject.get(visit.USUBJID)!;
      if (typeof visit.SVSTDTC === "string")
        expect(visit.SVSTDTC <= death, String(visit.USUBJID)).toBe(true);
    }
  });

  it("ends every dated record of a dead subject by the death", () => {
    for (const name of ["EX", "AE", "VS", "LB", "CE"]) {
      for (const row of rows(find(run.datasets, "sdtm", name))) {
        const death = deathBySubject.get(row.USUBJID);
        if (!death) continue;
        for (const [variable, value] of Object.entries(row))
          if (/DTC$/.test(variable) && typeof value === "string")
            expect(
              value.slice(0, 10) <= death,
              `${name}.${variable} ${String(row.USUBJID)}`
            ).toBe(true);
      }
    }
  });

  it("flags the death in DM", () => {
    const dm = rows(find(run.datasets, "sdtm", "DM"));
    for (const [subject, date] of deathBySubject) {
      const record = dm.find((row) => row.USUBJID === subject)!;
      expect(record.DTHFL).toBe("Y");
      expect(record.DTHDTC).toBe(date);
    }
  });
});

describe("adjudicated clinical events", () => {
  const ce = find(run.datasets, "sdtm", "CE");
  const ceRows = rows(ce);

  it("tabulates the CE activity in the handoff", () => {
    expect(handoff.report.notTabulatedDomains).not.toContain("CE");
    expect(
      device.design.activities.map((activity) => activity.domain)
    ).toContain("CE");
  });

  it("records disabling strokes and rehospitalisations", () => {
    expect(ce).toBeDefined();
    const terms = new Set(ceRows.map((row) => row.CEDECOD));
    expect(terms).toEqual(new Set(["DISABLING STROKE", "REHOSPITALISATION"]));
    for (const row of ceRows)
      expect(row.CECAT).toBe("CLINICAL EVENTS COMMITTEE ADJUDICATED");
  });

  it("traces every CE row to a collected CE record", () => {
    const ceSources = new Set(
      rows(find(run.datasets, "collected", "CE")).map((row) => row.SRCID)
    );
    const allSources = new Set(
      run.datasets
        .filter((dataset) => dataset.layer === "collected")
        .flatMap((dataset) => dataset.columns.SRCID ?? [])
    );
    expect(ceSources.size).toBe(ceRows.length);
    // Each row names its own CE record, and the exposure its study day and
    // epoch come from; every source it names exists.
    for (let row = 0; row < ce!.rowCount; row += 1) {
      const lineage = ce!.lineage?.[row] ?? [];
      expect(lineage.filter((source) => ceSources.has(source))).toHaveLength(1);
      for (const source of lineage) expect(allSources.has(source)).toBe(true);
    }
    const lineageRule = runConformance(run.datasets).findings.filter(
      (finding) => finding.ruleId === "SD-089"
    );
    expect(lineageRule).toEqual([]);
  });

  it("gives each subject's events their own sequence and study day", () => {
    const seen = new Set<string>();
    for (const row of ceRows) {
      const key = `${String(row.USUBJID)}#${String(row.CESEQ)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(typeof row.CESTDY).toBe("number");
      expect(row.CESTDY as number).toBeGreaterThan(0);
    }
  });

  it("keeps earlier subjects' events and deaths when the run is extended", () => {
    const shorter = runPipeline(device, { seed: 3417, nSubjects: 120 });
    const subjects = new Set(
      rows(find(shorter.datasets, "sdtm", "DM")).map((row) => row.USUBJID)
    );
    for (const name of ["CE", "DS"]) {
      const longer = rows(find(run.datasets, "collected", name)).filter((row) =>
        subjects.has(row.USUBJID)
      );
      expect(longer).toEqual(rows(find(shorter.datasets, "collected", name)));
    }
  });
});

describe("a study with no CE activity", () => {
  it("generates DEMO-301 byte for byte as before, with no deaths or CE", () => {
    const { datasets } = runPipeline(DEMO_301_STUDY, {
      seed: 301,
      nSubjects: 90,
    });
    expect(
      createHash("sha256").update(JSON.stringify(datasets)).digest("hex")
    ).toBe("29e9f35df2f6de37fc9c48dc6c3ba17dfa63b085d4a0f3c6fd22d19f4f2c1574");
    expect(datasets.some((dataset) => dataset.name === "CE")).toBe(false);
  });
});
