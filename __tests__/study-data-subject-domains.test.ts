import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_301_STUDY, runPipeline, type Dataset } from "@/lib/study-data";

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
const source = run.datasets.filter((dataset) => dataset.layer === "collected");
const sdtm = run.datasets.filter(
  (dataset) => dataset.layer === "sdtm" && dataset.class !== "Trial Design"
);
const get = (name: string) => sdtm.find((dataset) => dataset.name === name)!;
const records = (dataset: Dataset) =>
  Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [name, dataset.columns[name][index]])
    )
  );

describe("SDTM subject tabulation", () => {
  it("matches the seed-301 golden file for all eight subject domains", () => {
    const expected = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "__tests__/fixtures/study-data/subject-domains/seed-301.json"
        ),
        "utf8"
      )
    );
    const actual = Object.fromEntries(
      sdtm.map((dataset) => [
        dataset.name,
        {
          rows: dataset.rowCount,
          sha256: createHash("sha256")
            .update(JSON.stringify(dataset))
            .digest("hex"),
        },
      ])
    );
    expect(actual).toEqual(expected);
  });

  it("preserves row lineage in metadata and keeps analysis variables out of SDTM", () => {
    const ids = new Set(
      source.flatMap((dataset) => dataset.columns.SRCID as string[])
    );
    for (const dataset of sdtm) {
      expect(dataset.lineage).toHaveLength(dataset.rowCount);
      expect(
        dataset.lineage!.every(
          (sources) => sources.length > 0 && sources.every((id) => ids.has(id))
        )
      ).toBe(true);
      expect(
        dataset.variables.every(
          (variable) =>
            !["SRCID", "BASE", "CHG", "AVAL", "TRTEMFL"].includes(variable.name)
        )
      ).toBe(true);
    }
  });

  it("maps screen failures without reference treatment dates or exposure", () => {
    const dm = records(get("DM"));
    const failures = dm.filter((record) => record.ARMNRS === "SCREEN FAILURE");
    expect(failures.length).toBeGreaterThan(0);
    expect(
      failures.every(
        (record) => record.RFSTDTC === null && record.RFXSTDTC === null
      )
    ).toBe(true);
    const exposed = new Set(get("EX").columns.USUBJID);
    expect(failures.every((record) => !exposed.has(record.USUBJID))).toBe(true);
  });

  it("leaves a screen failure's arms null and says why in ARMNRS (#2802)", () => {
    const dm = records(get("DM"));
    const collectedDm = records(source.find((d) => d.name === "DM")!);
    const failed = new Set(
      collectedDm
        .filter((record) => record.SCREENFL === "FAIL")
        .map((record) => record.USUBJID)
    );
    const randomized = new Map(
      records(source.find((d) => d.name === "RAND")!).map((record) => [
        record.USUBJID,
        record,
      ])
    );
    expect(failed.size).toBeGreaterThan(0);
    for (const record of dm) {
      expect(record.ARMCD).not.toBe("SCRNFAIL");
      expect(record.ACTARMCD).not.toBe("SCRNFAIL");
      const rand = randomized.get(record.USUBJID);
      if (rand) {
        // Every randomized subject here is dosed with their planned arm.
        expect(record).toMatchObject({
          ARMCD: rand.ARMCD,
          ARM: rand.ARM,
          ACTARMCD: rand.ARMCD,
          ACTARM: rand.ARM,
          ARMNRS: null,
          ACTARMUD: null,
        });
      } else {
        // Only a failed screening leaves a subject unrandomized.
        expect(failed.has(record.USUBJID)).toBe(true);
        expect(record).toMatchObject({
          ARMCD: null,
          ARM: null,
          ACTARMCD: null,
          ACTARM: null,
          ARMNRS: "SCREEN FAILURE",
          ACTARMUD: null,
        });
      }
    }

    const names = get("DM").variables.map((variable) => variable.name);
    expect(names.indexOf("ARMNRS")).toBe(names.indexOf("ACTARM") + 1);
    expect(names.indexOf("ACTARMUD")).toBe(names.indexOf("ARMNRS") + 1);
    expect(
      get("DM").variables.find((variable) => variable.name === "ARMNRS")
    ).toMatchObject({
      role: "Record Qualifier",
      origin: "Derived",
      method: "ARM_NULL_REASON",
      codelist: "ARMNULRS",
    });
  });

  it("gives every subject the site and site country the EDC recorded (#2801)", () => {
    const dm = records(get("DM"));
    const collectedDm = source.find((dataset) => dataset.name === "DM")!;
    const recorded = new Map(
      records(collectedDm).map((record) => [record.USUBJID, record])
    );
    const countryBySite = new Map<unknown, unknown>();
    for (const record of dm) {
      expect(record.SITEID).toMatch(/^\d{3}$/);
      expect(record.COUNTRY).toMatch(/^[A-Z]{3}$/);
      expect(record.SITEID).toBe(recorded.get(record.USUBJID)!.SITEID);
      expect(record.COUNTRY).toBe(recorded.get(record.USUBJID)!.COUNTRY);
      // A country belongs to the site, so one site never has two.
      expect(countryBySite.get(record.SITEID) ?? record.COUNTRY).toBe(
        record.COUNTRY
      );
      countryBySite.set(record.SITEID, record.COUNTRY);
    }
    expect(countryBySite.size).toBeGreaterThan(1);
    expect(
      [...countryBySite.values()].every((country) =>
        ["USA", "CAN"].includes(String(country))
      )
    ).toBe(true);

    const names = get("DM").variables.map((variable) => variable.name);
    const at = (name: string) => names.indexOf(name);
    expect(at("SITEID")).toBe(at("DTHFL") + 1);
    expect(at("SITEID")).toBeLessThan(at("AGE"));
    // SDTMIG 3.4 puts the arm null reasons between ACTARM and COUNTRY.
    expect(at("COUNTRY")).toBe(at("ACTARMUD") + 1);
    for (const name of ["SITEID", "COUNTRY"]) {
      expect(
        get("DM").variables.find((variable) => variable.name === name)
      ).toMatchObject({
        role: "Record Qualifier",
        origin: "Collected",
        source: `DM.${name}`,
      });
    }
  });

  it("records no death for a study in which nobody died (#2787)", () => {
    const deaths = records(get("DS")).filter(
      (record) => record.DSDECOD === "DEATH"
    );
    expect(deaths).toEqual([]);
    const dm = get("DM");
    expect(dm.columns.DTHDTC.every((value) => value === null)).toBe(true);
    expect(dm.columns.DTHFL.every((value) => value === null)).toBe(true);

    // SDTMIG 3.4 order: RFXENDTC, RFICDTC, RFPENDTC, DTHDTC, DTHFL, SITEID.
    // RFICDTC is out of place and RFPENDTC missing (#2804), so the death
    // variables sit between the reference dates and SITEID.
    const names = dm.variables.map((variable) => variable.name);
    expect(names.indexOf("DTHDTC")).toBe(names.indexOf("RFXENDTC") + 1);
    expect(names.indexOf("DTHFL")).toBe(names.indexOf("DTHDTC") + 1);
    const meta = (name: string) =>
      dm.variables.find((variable) => variable.name === name);
    expect(meta("DTHDTC")).toMatchObject({
      label: "Date/Time of Death",
      role: "Record Qualifier",
      origin: "Derived",
      method: "DEATH_DATE",
    });
    expect(meta("DTHFL")).toMatchObject({
      label: "Subject Death Flag",
      role: "Record Qualifier",
      origin: "Derived",
      method: "DEATH_FLAG",
      codelist: "NY",
    });
  });

  it("has ISO partial AE dates, no study day zero, and sequential per-subject records", () => {
    const ae = records(get("AE"));
    expect(
      ae.some(
        (record) =>
          typeof record.AESTDTC === "string" &&
          /^\d{4}-\d{2}$/.test(record.AESTDTC)
      )
    ).toBe(true);
    expect(
      ae
        .filter(
          (record) =>
            typeof record.AESTDTC === "string" &&
            /^\d{4}-\d{2}$/.test(record.AESTDTC)
        )
        .every((record) => record.AESTDY === null)
    ).toBe(true);
    for (const dataset of sdtm) {
      for (const variable of dataset.variables.filter((column) =>
        column.name.endsWith("DY")
      ))
        expect(dataset.columns[variable.name]).not.toContain(0);
      const seq = `${dataset.name}SEQ`;
      if (!dataset.columns[seq]) continue;
      const bySubject = new Map<string, number[]>();
      for (const record of records(dataset)) {
        const subject = String(record.USUBJID);
        bySubject.set(subject, [
          ...(bySubject.get(subject) ?? []),
          Number(record[seq]),
        ]);
      }
      for (const values of bySubject.values())
        expect(values).toEqual(values.map((_, index) => index + 1));
    }
  });

  it("uses TV visits and TA epochs, including unscheduled visits", () => {
    const sv = records(get("SV"));
    const tv = run.datasets.find((dataset) => dataset.name === "TV")!;
    const planned = new Map(
      records(tv).map((record) => [record.VISITNUM, record.VISIT])
    );
    expect(
      sv.some(
        (record) => record.VISIT === "UNSCHEDULED" && record.VISITNUM === 99
      )
    ).toBe(true);
    expect(
      sv
        .filter((record) => record.VISITNUM !== 99)
        .every((record) => record.VISIT === planned.get(record.VISITNUM))
    ).toBe(true);
    const epochs = new Set(
      run.datasets.find((dataset) => dataset.name === "TA")!.columns.EPOCH
    );
    expect(
      sv.every((record) => record.EPOCH === null || epochs.has(record.EPOCH))
    ).toBe(true);
  });

  it("flags the last pre-dose observation per subject and test", () => {
    for (const domain of ["VS", "LB"] as const) {
      const data = records(get(domain));
      const flagged = data.filter(
        (record) => record[`${domain}LOBXFL`] === "Y"
      );
      expect(flagged.length).toBeGreaterThan(0);
      const keys = flagged.map(
        (record) => `${record.USUBJID}|${record[`${domain}TESTCD`]}`
      );
      expect(new Set(keys).size).toBe(keys.length);
      expect(
        flagged.every((record) => Number(record[`${domain}DY`]) <= 1)
      ).toBe(true);
    }
  });
});
