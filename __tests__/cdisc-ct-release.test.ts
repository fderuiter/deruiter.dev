// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STANDARD_CODELISTS } from "@/lib/clinical-standards";
import { STUDY_PRESETS } from "@/lib/crf/presets";
import { exportStudyToUsdmObject } from "@/lib/crf/usdm-adapter";
import type { CodelistDefinition } from "@/lib/crf/types";
import {
  CONTROLLED_TERMINOLOGY,
  DEMO_301_USDM,
} from "@/lib/study-data/presets";
import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import {
  CT_SOURCES,
  NCIT_ONLY_CODES,
  RETIRED_CODES,
  SUBSET_FILE,
  buildSubset,
  citedCodes,
  parseEvsExport,
  serializeSubset,
  type CtSubset,
} from "../scripts/cdisc-ct-subset";

// #2992 step 3d: every CDISC code in the repository is checked against the
// pinned NCI EVS release, through the subset scripts/cdisc-ct-subset.ts
// derives from it.

const root = process.cwd();
const subset = JSON.parse(
  readFileSync(path.join(root, SUBSET_FILE), "utf8")
) as CtSubset;
const CDISC_SYSTEM = "http://www.cdisc.org";

/** Every codelist CRF Studio offers: the standard ones and each preset's. */
const crfCodelists = (): { where: string; codelist: CodelistDefinition }[] => [
  ...STANDARD_CODELISTS.map((codelist) => ({ where: "standard", codelist })),
  ...STUDY_PRESETS.flatMap((preset) =>
    (preset.study.codelists ?? []).map((codelist) => ({
      where: preset.id,
      codelist,
    }))
  ),
];

/** Every USDM Code object in a document, with where it was found. */
function usdmCodes(
  value: unknown,
  where: string,
  out: { where: string; code: string; decode: string; system: string }[] = []
) {
  if (Array.isArray(value)) {
    for (const item of value) usdmCodes(item, where, out);
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (record.instanceType === "Code") {
      out.push({
        where,
        code: String(record.code),
        decode: String(record.decode),
        system: String(record.codeSystem),
      });
    }
    for (const inner of Object.values(record)) usdmCodes(inner, where, out);
  }
  return out;
}

describe("the CDISC CT subset (#2992)", () => {
  it("is pinned to the release the standards profile declares", () => {
    const release = CLINICAL_STANDARDS_PROFILE.CT.packageDate;
    expect(subset.package).toContain(release);
    expect(subset.sources).toEqual(CT_SOURCES);
    for (const source of CT_SOURCES) {
      expect(decodeURIComponent(source.url)).toContain(
        `/${source.id}/Archive/${source.id} Terminology ${release}.txt`
      );
    }
    expect(subset.ncitOnly).toEqual(NCIT_ONLY_CODES);
    expect(subset.retired).toEqual(RETIRED_CODES);
  });

  it("resolves every NCI code written in lib, components and app", () => {
    const unresolved = [...citedCodes(root)]
      .filter(
        ([code]) =>
          !(code in subset.codelists) &&
          !(code in subset.concepts) &&
          !(code in subset.ncitOnly) &&
          !(code in subset.retired)
      )
      .map(([code, files]) => `${code} in ${files.join(", ")}`);
    // A new code is either missing from the subset (run
    // `npx tsx scripts/cdisc-ct-subset.ts write`) or not a CDISC code.
    expect(unresolved).toEqual([]);
  });

  it("holds nothing the code no longer cites", () => {
    const cited = citedCodes(root);
    const held = [
      ...Object.keys(subset.codelists),
      ...Object.keys(subset.concepts),
    ].filter((code) => !cited.has(code));
    expect(held).toEqual([]);
  });

  it("is what the generator writes from the exports", () => {
    const evs = [
      "Code\tCodelist Code\tCodelist Extensible (Yes/No)\tCodelist Name\tCDISC Submission Value\tCDISC Synonym(s)\tCDISC Definition\tNCI Preferred Term",
      "C66731\t\tNo\tSex\tSEX\tSex\tA definition the subset leaves out.\tCDISC SDTM Sex of Individual Terminology",
      "C16576\tC66731\t\tSex\tF\tFemale\tFemale.\tFemale",
      "C20197\tC66731\t\tSex\tM\tMale\tMale.\tMale",
      "C25150\tC66741\t\tVital Signs Test Code\tAGE\tAge\tAge.\tAge",
    ].join("\n");
    const built = buildSubset(
      parseEvsExport("SDTM", evs),
      new Set(["C66731", "C25150"])
    );
    expect(built.codelists).toEqual({
      C66731: {
        publishingSet: "SDTM",
        submissionValue: "SEX",
        name: "Sex",
        extensible: false,
        terms: { F: "C16576", M: "C20197" },
      },
    });
    expect(built.concepts).toEqual({
      C25150: { names: ["age"], memberOf: { C66741: "AGE" } },
    });
    expect(serializeSubset(built)).not.toContain(
      "A definition the subset leaves out"
    );
    expect(() =>
      buildSubset(parseEvsExport("SDTM", evs), new Set(["C99999"]))
    ).toThrow(/publishes C99999/);
    expect(() => parseEvsExport("SDTM", "<!doctype html>\n<html>")).toThrow(
      /no "Code" column/
    );
  });
});

describe("CRF Studio codelists against the release (#2992)", () => {
  it("cites only published codelists, by their submission value", () => {
    for (const { where, codelist } of crfCodelists()) {
      if (!codelist.nciCodelistCode) continue;
      const published = subset.codelists[codelist.nciCodelistCode];
      expect(published, `${where} ${codelist.id}`).toBeDefined();
      expect(codelist.name, `${where} ${codelist.id}`).toContain(
        `(${published.submissionValue})`
      );
    }
  });

  it("codes each option as the term of its own codelist", () => {
    for (const { where, codelist } of crfCodelists()) {
      if (!codelist.nciCodelistCode) continue;
      const published = subset.codelists[codelist.nciCodelistCode];
      for (const option of codelist.options) {
        const label = `${where} ${codelist.id} ${option.code}`;
        if (option.nciCode) {
          expect(published.terms[option.code], label).toBe(option.nciCode);
        } else {
          // An uncoded option is a sponsor extension: only an extensible
          // codelist allows one, and it must not shadow a CDISC term.
          expect(published.extensible, label).toBe(true);
          expect(published.terms[option.code], label).toBeUndefined();
        }
      }
    }
  });
});

describe("Study Data Pipeline terminology against the release (#2992)", () => {
  it("matches each CDISC codelist's code, publishing set and extensibility", () => {
    for (const codelist of CONTROLLED_TERMINOLOGY) {
      if (!codelist.nciCode) continue;
      const published = subset.codelists[codelist.nciCode];
      expect(published, codelist.id).toBeDefined();
      expect(published.publishingSet, codelist.id).toBe(codelist.publishingSet);
      expect(published.submissionValue, codelist.id).toBe(codelist.id);
      expect(published.extensible, codelist.id).toBe(codelist.extensible);
    }
  });

  it("codes each term as the term of its own codelist", () => {
    for (const codelist of CONTROLLED_TERMINOLOGY) {
      if (!codelist.nciCode) continue;
      const published = subset.codelists[codelist.nciCode];
      for (const term of codelist.terms) {
        const label = `${codelist.id} ${term.value}`;
        if (term.nciCode) {
          expect(published.terms[term.value], label).toBe(term.nciCode);
        } else {
          expect(published.extensible, label).toBe(true);
          expect(published.terms[term.value], label).toBeUndefined();
        }
      }
    }
  });
});

describe("USDM codes against the release (#2992)", () => {
  const codes = [
    ...usdmCodes(DEMO_301_USDM, "demo-301"),
    ...STUDY_PRESETS.flatMap((preset) =>
      usdmCodes(exportStudyToUsdmObject(preset.study), preset.id)
    ),
  ];

  it("finds the codes it checks", () => {
    expect(
      codes.filter((code) => code.system === CDISC_SYSTEM).length
    ).toBeGreaterThan(40);
  });

  it("decodes every CDISC code by one of the names the release gives it", () => {
    const wrong = codes
      .filter((code) => code.system === CDISC_SYSTEM)
      .filter((code) => {
        const names =
          subset.concepts[code.code]?.names ??
          (subset.codelists[code.code]
            ? [
                subset.codelists[code.code].submissionValue.toLowerCase(),
                subset.codelists[code.code].name.toLowerCase(),
              ]
            : undefined);
        return !names?.includes(code.decode.toLowerCase());
      })
      .map((code) => `${code.where}: ${code.code} "${code.decode}"`);
    expect(wrong).toEqual([]);
  });

  it("codes an NCIt-only concept under the NCI Thesaurus, never as CDISC CT", () => {
    for (const code of codes) {
      if (code.code in NCIT_ONLY_CODES) {
        expect(code.system, `${code.where} ${code.code}`).not.toBe(
          CDISC_SYSTEM
        );
      }
    }
  });
});
