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
  it("matches the seed-301 golden file for every SDTM subject domain", () => {
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
    // RFICDTC is out of place (CORE-000852), so the death variables follow
    // RFPENDTC (#2804).
    const names = dm.variables.map((variable) => variable.name);
    expect(names.indexOf("DTHDTC")).toBe(names.indexOf("RFPENDTC") + 1);
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

  it("gives every complete end date its study day (#2804)", () => {
    const fullDate = (value: unknown) =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value
        : null;
    const reference = new Map(
      records(get("DM")).map((record) => [
        record.USUBJID,
        fullDate(record.RFSTDTC),
      ])
    );
    const studyDay = (date: string, start: string) => {
      const days = (Date.parse(date) - Date.parse(start)) / 86400000;
      return days >= 0 ? days + 1 : days;
    };
    let derived = 0;
    for (const [domain, start] of [
      ["AE", "AESTDY"],
      ["EX", "EXSTDY"],
      ["SV", "SVSTDY"],
    ] as const) {
      const dataset = get(domain);
      const names = dataset.variables.map((variable) => variable.name);
      expect(names.indexOf(`${domain}ENDY`)).toBe(names.indexOf(start) + 1);
      expect(
        dataset.variables.find(({ name }) => name === `${domain}ENDY`)
      ).toMatchObject({
        role: "Timing",
        type: "integer",
        origin: "Derived",
        method: "STUDY_DAY",
      });
      for (const record of records(dataset)) {
        const end = fullDate(record[`${domain}ENDTC`]);
        const rfstdtc = reference.get(record.USUBJID) ?? null;
        expect(record[`${domain}ENDY`]).toBe(
          end && rfstdtc ? studyDay(end, rfstdtc) : null
        );
        if (end && rfstdtc) derived += 1;
      }
    }
    // Every dosed subject has an exposure end and visits, so the check is
    // not vacuous.
    expect(derived).toBeGreaterThan(get("EX").rowCount);
  });

  it("collects RACE as Race As Collected and carries it to ADSL (#2804)", () => {
    const races = new Set([
      "AMERICAN INDIAN OR ALASKA NATIVE",
      "ASIAN",
      "BLACK OR AFRICAN AMERICAN",
      "NATIVE HAWAIIAN OR PACIFIC ISLANDER",
      "WHITE",
    ]);
    const collected = new Map(
      records(source.find((dataset) => dataset.name === "DM")!).map(
        (record) => [record.USUBJID, record.RACE]
      )
    );
    const dm = get("DM");
    for (const record of records(dm)) {
      expect(races.has(record.RACE as string)).toBe(true);
      expect(record.RACE).toBe(collected.get(record.USUBJID));
    }
    const names = dm.variables.map((variable) => variable.name);
    expect(names.indexOf("RACE")).toBe(names.indexOf("SEX") + 1);
    expect(dm.variables.find(({ name }) => name === "RACE")).toMatchObject({
      label: "Race",
      role: "Record Qualifier",
      origin: "Collected",
      source: "DM.RACE",
      codelist: "RACEC",
    });

    const adsl = run.datasets.find((dataset) => dataset.name === "ADSL")!;
    const dmRace = new Map(
      records(dm).map((record) => [record.USUBJID, record.RACE])
    );
    for (const record of records(adsl))
      expect(record.RACE).toBe(dmRace.get(record.USUBJID));
  });

  it("ends each subject's participation on their last complete date (#2804)", () => {
    const fullDate = (value: unknown) =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? value
        : null;
    const last = new Map<unknown, { date: string; sources: Set<unknown> }>();
    for (const dataset of source) {
      const dates = dataset.variables
        .filter((variable) => variable.type === "date")
        .map((variable) => variable.name);
      for (const record of records(dataset)) {
        for (const name of dates) {
          const date = fullDate(record[name]);
          if (!date) continue;
          const latest = last.get(record.USUBJID);
          if (!latest || date > latest.date)
            last.set(record.USUBJID, {
              date,
              sources: new Set([record.SRCID]),
            });
          else if (date === latest.date) latest.sources.add(record.SRCID);
        }
      }
    }
    const dm = get("DM");
    records(dm).forEach((record, index) => {
      const expected = last.get(record.USUBJID)!;
      expect(record.RFPENDTC).toBe(expected.date);
      expect(record.RFPENDTC! >= (record.RFICDTC as string)).toBe(true);
      if (record.RFENDTC)
        expect(record.RFPENDTC! >= (record.RFENDTC as string)).toBe(true);
      // The lineage names a record dated on the last day of participation.
      expect(dm.lineage![index].some((id) => expected.sources.has(id))).toBe(
        true
      );
    });
    const names = dm.variables.map((variable) => variable.name);
    expect(names.indexOf("RFPENDTC")).toBe(names.indexOf("RFICDTC") + 1);
    expect(dm.variables.find(({ name }) => name === "RFPENDTC")).toMatchObject({
      label: "Date/Time of End of Participation",
      role: "Record Qualifier",
      type: "date",
      origin: "Derived",
      method: "LAST_PARTICIPATION",
    });
  });

  it("records why each serious AE is serious, and nothing for the rest (#2803)", () => {
    const criteria = [
      "AESCONG",
      "AESDISAB",
      "AESDTH",
      "AESHOSP",
      "AESLIFE",
      "AESMIE",
    ];
    const ae = records(get("AE"));
    const serious = ae.filter((record) => record.AESER === "Y");
    expect(serious.length).toBeGreaterThan(0);
    for (const record of serious) {
      const answers = criteria.map((name) => record[name]);
      expect(answers.every((answer) => answer === "Y" || answer === "N")).toBe(
        true
      );
      expect(answers).toContain("Y");
    }
    // The criteria follow a "Yes" to serious, so a non-serious AE has none.
    for (const record of ae.filter((record) => record.AESER === "N"))
      for (const name of criteria) expect(record[name]).toBeNull();
    // An AE results in death only for a subject whose disposition is death.
    const died = new Set(
      records(get("DS"))
        .filter((record) => record.DSDECOD === "DEATH")
        .map((record) => record.USUBJID)
    );
    expect(
      ae.filter((record) => record.AESDTH === "Y" && !died.has(record.USUBJID))
    ).toEqual([]);

    const variables = get("AE").variables;
    const names = variables.map((variable) => variable.name);
    expect(
      names.slice(names.indexOf("AEREL") + 1, names.indexOf("AEREL") + 7)
    ).toEqual(criteria);
    for (const name of criteria)
      expect(
        variables.find((variable) => variable.name === name)
      ).toMatchObject({
        role: "Record Qualifier",
        origin: "Collected",
        source: `AE.${name}`,
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
    // SDTMIG 3.4 defines no EPOCH for SV (#2869).
    expect(get("SV").variables.map(({ name }) => name)).not.toContain("EPOCH");
    const epochs = new Set(
      run.datasets.find((dataset) => dataset.name === "TA")!.columns.EPOCH
    );
    expect(
      records(get("VS")).every(
        (record) => record.EPOCH === null || epochs.has(record.EPOCH)
      )
    ).toBe(true);
  });

  it("says whether each visit was planned and whether it happened (#2886)", () => {
    const sv = records(get("SV"));
    const unscheduled = sv.filter((record) => record.VISITNUM === 99);
    const planned = sv.filter((record) => record.VISITNUM !== 99);
    expect(unscheduled.length).toBeGreaterThan(0);
    expect(
      unscheduled.every(
        (record) => record.SVPRESP === null && record.SVOCCUR === null
      )
    ).toBe(true);
    expect(planned.every((record) => record.SVPRESP === "Y")).toBe(true);
    const missed = planned.filter((record) => record.SVOCCUR === "N");
    expect(missed.length).toBeGreaterThan(0);
    expect(missed.every((record) => record.SVSTDTC === null)).toBe(true);
    expect(
      planned
        .filter((record) => record.SVOCCUR === "Y")
        .every((record) => record.SVSTDTC !== null)
    ).toBe(true);
  });

  it("writes the dose form and lab ranges that agree with LBNRIND", () => {
    expect(
      records(get("EX")).every((record) => record.EXDOSFRM === "TABLET")
    ).toBe(true);
    const lb = records(get("LB"));
    expect(lb.length).toBeGreaterThan(0);
    for (const record of lb) {
      expect(["CHEMISTRY", "HEMATOLOGY"]).toContain(record.LBCAT);
      const value = record.LBSTRESN as number;
      const low = record.LBSTNRLO as number;
      const high = record.LBSTNRHI as number;
      expect(record.LBORNRLO).toBe(String(low));
      expect(record.LBORNRHI).toBe(String(high));
      if (record.LBNRIND === "NORMAL") {
        expect(value).toBeGreaterThanOrEqual(low);
        expect(value).toBeLessThanOrEqual(high);
      } else {
        expect(record.LBNRIND).toBe("HIGH");
        expect(value).toBeGreaterThan(high);
      }
    }
  });

  it("codes every adverse event to the fictional dictionary's five levels", () => {
    const ae = records(get("AE"));
    expect(ae.length).toBeGreaterThan(0);
    for (const record of ae) {
      expect(record.AESOC).toBe(record.AEBODSYS);
      expect(record.AELLT).toBe(record.AEDECOD);
      expect(record.AELLTCD).toBe(record.AEPTCD);
      expect(record.AEBDSYCD).toBe(record.AESOCCD);
      expect(record.AEHLT).toMatch(/^Fictional /);
      expect(record.AEHLGT).toMatch(/^Fictional /);
      for (const code of [
        "AELLTCD",
        "AEPTCD",
        "AEHLTCD",
        "AEHLGTCD",
        "AESOCCD",
      ])
        expect(record[code], code).toBeGreaterThanOrEqual(99000000);
    }
  });

  it("flags the last pre-dose observation per subject and test", () => {
    for (const domain of ["VS", "LB", "EG"] as const) {
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

  it("tabulates each collected ECG interval as one EG record (#2942)", () => {
    const collectedEg = source.find((dataset) => dataset.name === "EG")!;
    const eg = get("EG");
    expect(eg.rowCount).toBe(collectedEg.rowCount);
    expect(eg.lineage!.map((sources) => sources[0])).toEqual(
      collectedEg.columns.SRCID
    );
    const data = records(eg);
    expect(new Set(data.map((record) => record.EGTESTCD))).toEqual(
      new Set(["EGHRMN", "PRAG", "QRSAG", "QTAG", "RRAG"])
    );
    const names = Object.fromEntries(
      data.map((record) => [record.EGTESTCD, record.EGTEST])
    );
    expect(names).toEqual({
      EGHRMN: "ECG Mean Heart Rate",
      PRAG: "PR Interval, Aggregate",
      QRSAG: "QRS Duration, Aggregate",
      QTAG: "QT Interval, Aggregate",
      RRAG: "RR Interval, Aggregate",
    });
    for (const record of data) {
      expect(record.DOMAIN).toBe("EG");
      expect(record.EGSTRESU).toBe(
        record.EGTESTCD === "EGHRMN" ? "beats/min" : "ms"
      );
      expect(record.EGORRESU).toBe(record.EGSTRESU);
      expect(record.EGSTRESN).toBe(Number(record.EGORRES));
      expect(record.EGSTRESC).toBe(record.EGORRES);
      expect(record.EGDY).not.toBe(0);
    }
    const sequence = new Map<unknown, number[]>();
    for (const record of data)
      sequence.set(record.USUBJID, [
        ...(sequence.get(record.USUBJID) ?? []),
        Number(record.EGSEQ),
      ]);
    for (const numbers of sequence.values())
      expect(numbers).toEqual(numbers.map((_, index) => index + 1));
  });
});
