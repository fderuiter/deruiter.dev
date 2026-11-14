import { describe, expect, it } from "vitest";
import { DEMO_301_STUDY, runPipeline } from "@/lib/study-data";

const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
const sdtm = (name: string) =>
  run.datasets.find(
    (dataset) => dataset.name === name && dataset.layer === "sdtm"
  )!;
const ae = sdtm("AE");
const mh = sdtm("MH");
const supp = sdtm("SUPPAE");
const adae = run.datasets.find((dataset) => dataset.name === "ADAE")!;

describe("MH carries the SOC code from the same dictionary as AE (#3719)", () => {
  it("gives each MH body system the code AE uses for the same name", () => {
    const aeCodes = new Map<string, unknown>();
    for (let index = 0; index < ae.rowCount; index += 1) {
      const soc = ae.columns.AESOC[index];
      if (soc) aeCodes.set(String(soc), ae.columns.AESOCCD[index]);
    }
    let checked = 0;
    for (let index = 0; index < mh.rowCount; index += 1) {
      const soc = mh.columns.MHBODSYS[index];
      if (soc === null || !aeCodes.has(String(soc))) continue;
      checked += 1;
      expect(mh.columns.MHBDSYCD[index], String(soc)).toBe(
        aeCodes.get(String(soc))
      );
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("never names a body system without its code", () => {
    for (let index = 0; index < mh.rowCount; index += 1) {
      if (mh.columns.MHBODSYS[index] !== null) {
        expect(mh.columns.MHBDSYCD[index]).not.toBeNull();
      }
    }
  });
});

describe("the treatment-emergent flag is SUPPAE AETRTEM (#3719)", () => {
  it("writes one AETRTEM record per adverse event, keyed on AESEQ", () => {
    expect(supp.rowCount).toBe(ae.rowCount);
    expect(new Set(supp.columns.QNAM)).toEqual(new Set(["AETRTEM"]));
    expect(new Set(supp.columns.RDOMAIN)).toEqual(new Set(["AE"]));
    expect(new Set(supp.columns.IDVAR)).toEqual(new Set(["AESEQ"]));
    for (let index = 0; index < supp.rowCount; index += 1) {
      expect(supp.columns.IDVARVAL[index]).toBe(
        String(ae.columns.AESEQ[index])
      );
      expect(supp.columns.USUBJID[index]).toBe(ae.columns.USUBJID[index]);
    }
  });

  it("takes each value from the ADaM TRTEMFL of the same adverse event", () => {
    const flags = new Map<string, unknown>();
    for (let index = 0; index < adae.rowCount; index += 1) {
      flags.set(
        `${String(adae.columns.USUBJID[index])}|${String(adae.columns.ASEQ[index])}`,
        adae.columns.TRTEMFL[index]
      );
    }
    for (let index = 0; index < supp.rowCount; index += 1) {
      const key = `${String(supp.columns.USUBJID[index])}|${String(
        ae.columns.AESEQ[index]
      )}`;
      expect(supp.columns.QVAL[index], key).toBe(flags.get(key));
    }
    expect(new Set(supp.columns.QVAL)).toEqual(new Set(["Y", "N"]));
  });

  it("keeps AETRTEM out of AE as a collected variable", () => {
    expect(ae.variables.map((variable) => variable.name)).not.toContain(
      "AETRTEM"
    );
  });
});
