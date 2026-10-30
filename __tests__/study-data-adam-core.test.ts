import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  ADAM_METHODS,
  DEMO_301_STUDY,
  runPipeline,
  type Dataset,
} from "@/lib/study-data";

function records(dataset: Dataset) {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map(({ name }) => [name, dataset.columns[name][index]])
    )
  );
}

function analysis(seed: number, nSubjects: number) {
  const run = runPipeline(DEMO_301_STUDY, { seed, nSubjects });
  const get = (name: string) =>
    run.datasets.find(
      (dataset) =>
        dataset.name === name &&
        dataset.layer === (name.startsWith("AD") ? "adam" : "sdtm")
    )!;
  return { run, get };
}

describe("ADSL, ADVS, ADLB and ADEG", () => {
  it("matches the seed-301 golden file", () => {
    const { get } = analysis(301, 90);
    const expected = JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "__tests__/fixtures/study-data/adam/seed-301-core.json"
        ),
        "utf8"
      )
    );
    const actual = Object.fromEntries(
      ["ADSL", "ADVS", "ADLB", "ADEG"].map((name) => {
        const dataset = get(name);
        return [
          name,
          {
            rows: dataset.rowCount,
            sha256: createHash("sha256")
              .update(JSON.stringify(dataset))
              .digest("hex"),
          },
        ];
      })
    );
    expect(actual).toEqual(expected);
  });

  it("carries each subject's SITEID and COUNTRY from DM, in ADaMIG order (#2807)", () => {
    for (const seed of [301, 7, 999]) {
      const { get } = analysis(seed, 60);
      const dm = new Map(
        records(get("DM")).map((row) => [row.USUBJID, row] as const)
      );
      const adsl = get("ADSL");
      for (const row of records(adsl)) {
        const subject = dm.get(row.USUBJID);
        expect(row.SITEID, `${seed} ${row.USUBJID}`).toBe(subject?.SITEID);
        expect(row.COUNTRY, `${seed} ${row.USUBJID}`).toBe(subject?.COUNTRY);
        expect(row.SITEID).not.toBeNull();
      }
      const names = adsl.variables.map((variable) => variable.name);
      expect(names.slice(0, 3)).toEqual(["STUDYID", "USUBJID", "SITEID"]);
      expect(names.indexOf("COUNTRY")).toBe(names.indexOf("RACE") + 1);
      const origin = (name: string) =>
        adsl.variables.find((variable) => variable.name === name);
      expect(origin("SITEID")).toMatchObject({ origin: "Predecessor" });
      expect(origin("COUNTRY")).toMatchObject({ origin: "Predecessor" });
    }
  });

  it("has one ADSL row per screened subject and uses observed exposure for treatment", () => {
    const { get } = analysis(301, 90);
    const adsl = records(get("ADSL"));
    expect(adsl).toHaveLength(get("DM").rowCount);
    expect(new Set(adsl.map((row) => row.USUBJID)).size).toBe(adsl.length);
    const screenFailures = adsl.filter((row) => row.TRTSDT === null);
    expect(screenFailures.length).toBeGreaterThan(0);
    expect(
      screenFailures.every((row) => row.SAFFL === "N" && row.ITTFL === "N")
    ).toBe(true);
    expect(adsl.some((row) => row.EFFFL === "Y" && row.BSYSBP !== null)).toBe(
      true
    );
    const exposure = new Map(
      records(get("EX")).map((row) => [row.USUBJID, row.EXTRT])
    );
    expect(
      adsl
        .filter((row) => row.SAFFL === "Y")
        .every((row) => row.TRT01A === exposure.get(row.USUBJID))
    ).toBe(true);
    expect(get("ADSL").lineage?.every((links) => links.length > 0)).toBe(true);
  });

  it("stores method identifiers that resolve to derivation text", () => {
    const { get } = analysis(301, 2);
    for (const name of ["ADSL", "ADVS", "ADLB"]) {
      for (const variable of get(name).variables) {
        if (variable.origin !== "Derived") continue;
        expect(variable.method).toBeDefined();
        expect(
          ADAM_METHODS[variable.method as keyof typeof ADAM_METHODS]
        ).toBeTruthy();
      }
    }
  });

  it("preserves SDTM pointers and flags LOCF only as sensitivity rows", () => {
    const { get } = analysis(301, 90);
    for (const domain of ["ADVS", "ADLB"] as const) {
      const source = get(domain === "ADVS" ? "VS" : "LB");
      const sequences = new Set(
        records(source).map(
          (row) => `${row.USUBJID}|${row[`${source.name}SEQ`]}`
        )
      );
      const data = records(get(domain));
      expect(
        data.every((row) => sequences.has(`${row.USUBJID}|${row.SRCSEQ}`))
      ).toBe(true);
      expect(data.filter((row) => row.DTYPE === "LOCF").length).toBeGreaterThan(
        0
      );
      expect(
        data
          .filter((row) => row.DTYPE === "LOCF")
          .every((row) => row.ANL01FL === null && row.ABLFL === null)
      ).toBe(true);
      expect(get(domain).lineage).toHaveLength(data.length);
    }
  });

  it("maintains arithmetic and uniqueness properties across seeds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000 }), (seed) => {
        const { get } = analysis(seed, 24);
        for (const domain of ["ADVS", "ADLB"]) {
          const data = records(get(domain));
          const baselineCounts = new Map<string, number>();
          const analysisCounts = new Map<string, number>();
          for (const row of data) {
            const key = `${row.USUBJID}|${row.PARAMCD}`;
            if (row.ABLFL === "Y")
              baselineCounts.set(key, (baselineCounts.get(key) ?? 0) + 1);
            if (row.ANL01FL === "Y") {
              const visitKey = `${key}|${row.AVISIT}`;
              analysisCounts.set(
                visitKey,
                (analysisCounts.get(visitKey) ?? 0) + 1
              );
            }
            if (typeof row.AVAL === "number" && typeof row.BASE === "number") {
              expect(row.CHG).toBeCloseTo(row.AVAL - row.BASE, 10);
              if (row.BASE === 0) expect(row.PCHG).toBeNull();
            }
          }
          expect(
            [...baselineCounts.values()].every((count) => count === 1)
          ).toBe(true);
          expect(
            [...analysisCounts.values()].every((count) => count <= 1)
          ).toBe(true);
        }
      }),
      { numRuns: 30 }
    );
  });
});
