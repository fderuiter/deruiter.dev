import { describe, expect, it } from "vitest";
import {
  CONFORMANCE_RULES,
  DEMO_301_STUDY,
  runPipeline,
  type CellValue,
  type Dataset,
  type PipelineRun,
} from "@/lib/study-data";

/**
 * SDTM RELREC (#3414): each adverse event and the concomitant medication
 * given for it, related by RELID through AESEQ and CMSEQ.
 */

type Row = Record<string, CellValue>;

function dataset(run: PipelineRun, layer: string, name: string): Dataset {
  return run.datasets.find((d) => d.layer === layer && d.name === name)!;
}

function records(data: Dataset): Row[] {
  return Array.from({ length: data.rowCount }, (_, index) =>
    Object.fromEntries(
      data.variables.map(({ name }) => [name, data.columns[name][index]])
    )
  );
}

const SEEDS = [301, 7, 42, 999];

describe("SDTM RELREC", () => {
  it.each(SEEDS)(
    "relates every medication given for an AE to that AE (seed %i)",
    (seed) => {
      const run = runPipeline(DEMO_301_STUDY, { seed, nSubjects: 90 });
      const relrec = dataset(run, "sdtm", "RELREC");
      const ae = records(dataset(run, "sdtm", "AE"));
      const cm = records(dataset(run, "sdtm", "CM"));
      const collectedCm = records(dataset(run, "collected", "CM"));
      const rows = records(relrec);

      // One relationship per collected medication that names its AE.
      const linkedMedications = collectedCm.filter((row) => row.CMAENO).length;
      expect(rows).toHaveLength(linkedMedications * 2);

      const byRelationship = new Map<string, Row[]>();
      for (const row of rows) {
        const key = `${row.USUBJID}|${row.RELID}`;
        byRelationship.set(key, [...(byRelationship.get(key) ?? []), row]);
      }
      for (const [key, pair] of byRelationship) {
        expect(
          pair.map((row) => row.RDOMAIN),
          key
        ).toEqual(["AE", "CM"]);
        const [aeLink, cmLink] = pair;
        const event = ae.find(
          (row) =>
            row.USUBJID === aeLink.USUBJID &&
            String(row.AESEQ) === aeLink.IDVARVAL
        );
        const medication = cm.find(
          (row) =>
            row.USUBJID === cmLink.USUBJID &&
            String(row.CMSEQ) === cmLink.IDVARVAL
        );
        expect(event, key).toBeDefined();
        expect(medication, key).toBeDefined();
        // The medication's indication is the event it was given for.
        expect(medication!.CMINDC).toBe(event!.AEDECOD);
        expect(aeLink.IDVAR).toBe("AESEQ");
        expect(cmLink.IDVAR).toBe("CMSEQ");
        expect(aeLink.RELTYPE).toBeNull();
        expect(aeLink.STUDYID).toBe(DEMO_301_STUDY.studyId);
      }
    }
  );

  it("relates at least one pair on the default run, with SDTMIG metadata", () => {
    const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
    const relrec = dataset(run, "sdtm", "RELREC");
    expect(relrec.rowCount).toBeGreaterThan(0);
    expect(relrec.class).toBe("Relationships");
    expect(relrec.variables.map((variable) => variable.name)).toEqual([
      "STUDYID",
      "RDOMAIN",
      "USUBJID",
      "IDVAR",
      "IDVARVAL",
      "RELTYPE",
      "RELID",
    ]);
    expect(
      relrec.variables.find((variable) => variable.name === "RELID")
    ).toMatchObject({ origin: "Derived", method: "RELATED_RECORDS" });
    // SDTMIG 3.4 roles, which Define-XML writes and CORE-001081 compares
    // with the IG: the keys that identify the related record are
    // Identifiers, the relationship's type and id Record Qualifiers.
    expect(
      Object.fromEntries(
        relrec.variables.map((variable) => [variable.name, variable.role])
      )
    ).toEqual({
      STUDYID: "Identifier",
      RDOMAIN: "Identifier",
      USUBJID: "Identifier",
      IDVAR: "Identifier",
      IDVARVAL: "Identifier",
      RELTYPE: "Record Qualifier",
      RELID: "Record Qualifier",
    });
  });

  it("traces each row to both collected records of its pair", () => {
    const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
    const relrec = dataset(run, "sdtm", "RELREC");
    for (const sources of relrec.lineage ?? []) {
      expect(sources.some((id) => id.includes(":AE:"))).toBe(true);
      expect(sources.some((id) => id.includes(":CM:"))).toBe(true);
    }
  });

  it("passes its conformance rules on the default run", () => {
    const run = runPipeline(DEMO_301_STUDY, { seed: 301, nSubjects: 90 });
    const ids = CONFORMANCE_RULES.filter(
      (rule) => rule.scope.domain === "RELREC"
    ).map((rule) => rule.id);
    expect(ids).toEqual(["SD-076", "SD-077", "SD-078"]);
    for (const id of ids) {
      const result = run.conformance.ruleResults.find(
        (item) => item.ruleId === id
      );
      expect(result?.status, id).toBe("pass");
    }
  });
});
