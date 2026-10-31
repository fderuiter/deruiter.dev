import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CDASH_STANDARD_VARIABLES,
  CDISC_CT_PACKAGE_VERSION,
  STANDARD_CODELISTS,
  USDM_V4_VERSION,
} from "@/lib/crf";
import { ILLUSTRATIVE_CT_CODES } from "@/lib/clinical-trial-chaos";
import {
  CLINICAL_STANDARDS_PROFILE,
  CONTROLLED_TERMINOLOGY,
  DEFINE_XML_VERSION,
  DEMO_301_STUDY,
  STANDARD_VERSIONS,
  controlledTerminologyCitation,
  runPipeline,
  standardCitation,
} from "@/lib/study-data";

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)
      ? [path]
      : [];
  });
}

describe("clinical standards profile", () => {
  it("is frozen and declares the CT scope honestly", () => {
    expect(Object.isFrozen(CLINICAL_STANDARDS_PROFILE)).toBe(true);
    expect(Object.isFrozen(CLINICAL_STANDARDS_PROFILE.CT)).toBe(true);
    expect(CLINICAL_STANDARDS_PROFILE.CT.scope).toBe("local subset");
    expect(CLINICAL_STANDARDS_PROFILE.CT.verifiedAgainst).toBe(
      `NCI EVS CDISC SDTM, ADaM and DDF Terminology ${CLINICAL_STANDARDS_PROFILE.CT.packageDate}`
    );
  });

  it("is where every consumer's version comes from", () => {
    const P = CLINICAL_STANDARDS_PROFILE;
    expect(STANDARD_VERSIONS).toEqual({
      USDM: P.USDM,
      SDTM: P.SDTM,
      SDTMIG: P.SDTMIG,
      ADaM: P.ADaM,
      ADaMIG: P.ADaMIG,
      OCCDS: P.OCCDS,
      "ADaM-CR": P["ADaM-CR"],
      "Define-XML": P["Define-XML"],
      "Dataset-JSON": P["Dataset-JSON"],
      ARS: P.ARS,
      "NCI-EVS-CT": P.CT.packageDate,
    });
    expect(USDM_V4_VERSION).toBe(P.USDM);
    expect(DEFINE_XML_VERSION).toBe(`${P["Define-XML"]}.0`);
    expect(CDISC_CT_PACKAGE_VERSION).toBe(controlledTerminologyCitation());
    expect(controlledTerminologyCitation()).toBe(`SDTM CT ${P.CT.packageDate}`);
    expect(standardCitation("OCCDS")).toBe(`ADaM OCCDS ${P.OCCDS}`);
  });

  it("leaves no other literal version declaration in the code", () => {
    // Prose about other projects and search aliases name versions as
    // facts about something else, not as this site's declarations.
    const exempt = new Set([
      "lib/clinical-standards/profile.ts",
      "lib/case-studies-data.ts",
      "lib/term-glossary.ts",
    ]);
    const version =
      /(CDASH(IG)?|SDTMIG|SDTM-IG|ADaMIG|Define-XML|Dataset-JSON|USDM|ODM(-XML)?|ARS) ?v?\d+\.\d|2026-09-25|"1\.3\.2"|"4\.0\.0"/;
    const comment = /^\s*(\*|\/\/|\/\*|\{\/\*)/;
    const offenders = ["lib", "components", "app", "hooks", "types"]
      .flatMap((dir) => sourceFiles(resolve(ROOT, dir)))
      .flatMap((file) => {
        const path = relative(ROOT, file).replace(/\\/g, "/");
        if (exempt.has(path) || path.startsWith("lib/case-studies/")) return [];
        return readFileSync(file, "utf8")
          .split("\n")
          .flatMap((line, index) =>
            !comment.test(line) && version.test(line)
              ? [`${path}:${index + 1}: ${line.trim()}`]
              : []
          );
      });
    expect(offenders).toEqual([]);
  });
});

describe("arcade controlled terminology", () => {
  const local = new Set<string>();
  for (const codelist of STANDARD_CODELISTS) {
    if (codelist.nciCodelistCode) local.add(codelist.nciCodelistCode);
    for (const option of codelist.options) {
      if (option.nciCode) local.add(option.nciCode);
    }
  }
  for (const codelist of CONTROLLED_TERMINOLOGY) {
    if (codelist.nciCode) local.add(codelist.nciCode);
    for (const term of codelist.terms) {
      if (term.nciCode) local.add(term.nciCode);
    }
  }
  const gameCodes = new Set(
    sourceFiles(resolve(ROOT, "lib/clinical-trial-chaos")).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/ctCode: "(C\d+)"/g)].map(
        (match) => match[1]!
      )
    )
  );

  it("finds the codes the game cites", () => {
    expect(gameCodes.size).toBeGreaterThan(10);
  });

  it("resolves every code in the local subset or marks it illustrative", () => {
    const unresolved = [...gameCodes].filter(
      (code) => !local.has(code) && !(code in ILLUSTRATIVE_CT_CODES)
    );
    expect(unresolved).toEqual([]);
  });

  it("marks only codes that the game uses and the subset lacks", () => {
    for (const code of Object.keys(ILLUSTRATIVE_CT_CODES)) {
      expect(gameCodes.has(code)).toBe(true);
      expect(local.has(code)).toBe(false);
    }
  });
});

describe("DEMO-301 collection against CRF Studio's CDASH catalog", () => {
  const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 12 });
  const collected = run.datasets.filter((d) => d.layer === "collected");
  const catalog = (domain: string) =>
    new Set(
      (CDASH_STANDARD_VARIABLES[domain] ?? []).map((v) => v.sdtmVariable)
    );

  /**
   * Collected variables that are not CDASH fields of their domain, by why.
   * A variable missing from both the catalog and this map fails the test,
   * so a new collected field must either be a catalog field or say here
   * why it is not.
   */
  const NOT_CDASH_FIELDS: Readonly<Record<string, readonly string[]>> = {
    // System and subject identifiers, assigned rather than entered.
    identifier: ["SRCID", "USUBJID"],
    // The subject's site and its country, which the EDC takes from the
    // site the subject is enrolled at rather than from a CRF page (#2801).
    site: ["SITEID", "COUNTRY"],
    // Visit tracking the EDC records against the schedule.
    visit: ["VISITNUM", "VISIT", "PLANDY", "ACTDY", "SVDTC", "STATUS"],
    // Long-format test rows: the test code and result of a catalog field
    // (VS: SYSBP, DIABP, PULSE, WEIGHT; LB: LBTEST, LBORRES, LBORRESU). The
    // catalog has no EG page yet, so the ECG intervals are machine-read
    // test rows in the same shape (#2941).
    "test row": [
      "VSTESTCD",
      "VSORRES",
      "VSORRESU",
      "LBTESTCD",
      "EGTESTCD",
      "EGORRES",
      "EGORRESU",
    ],
    // Dates the catalog collects as --DAT fields (VSDAT, LBDAT, ICDAT), the
    // ECG date a CDASHIG EG page collects as EGDAT, and the date the medical
    // history page was completed, which a CDASHIG MH page collects as MHDAT
    // (#2963), and the eligibility assessment date a CDASHIG IE page
    // collects as IEDAT (#2964).
    "collection date": [
      "VSDTC",
      "LBDTC",
      "CONSENTDTC",
      "EGDTC",
      "MHDTC",
      "IEDTC",
    ],
    // The criterion a screen failure did not meet, which a CDASHIG IE page
    // collects as IETESTCD with its category; CRF Studio's catalog has no
    // IE page yet (#2964).
    eligibility: ["IETESTCD", "IECAT"],
    // CDASHIG CM fields that CRF Studio's catalog does not list yet: the
    // category that tells rescue medication apart, the dosing frequency and
    // the number of the adverse event a medication treats (#2961).
    "medication details": ["CMCAT", "CMDOSFRQ", "CMAENO"],
    // Coded from the verbatim term with MedDRA, not entered.
    "dictionary coded": ["AEBODSYS", "AEDECOD"],
    // From randomization (IxRS) and screening outcome, not a CRF page.
    operational: ["RANDDTC", "ARMCD", "ARM", "SCREENFL", "RANDFL", "DSSCAT"],
  };
  const explained = new Set(Object.values(NOT_CDASH_FIELDS).flat());

  it("collects only catalog fields or fields with a stated reason", () => {
    const unexplained = collected.flatMap((dataset) => {
      const fields = catalog(dataset.name);
      return dataset.variables
        .map((variable) => variable.name)
        .filter((name) => !fields.has(name) && !explained.has(name))
        .map((name) => `${dataset.name}.${name}`);
    });
    expect(unexplained).toEqual([]);
  });

  it("collects vital signs the catalog has a field for", () => {
    const vs = collected.find((dataset) => dataset.name === "VS")!;
    const tests = new Set(vs.columns.VSTESTCD);
    const fields = catalog("VS");
    for (const test of tests) expect(fields.has(String(test))).toBe(true);
  });

  it("names catalog fields for the dates it collects", () => {
    expect(catalog("VS").has("VSDAT")).toBe(true);
    expect(catalog("LB").has("LBDAT")).toBe(true);
    expect(catalog("DM").has("ICDAT")).toBe(true);
    expect(catalog("LB").has("LBTEST")).toBe(true);
  });
});
