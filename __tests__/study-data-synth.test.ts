import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEMO_301_STUDY, runPipeline, type Dataset } from "@/lib/study-data";

function records(dataset: Dataset): Record<string, string | number | null>[] {
  return Array.from({ length: dataset.rowCount }, (_, index) =>
    Object.fromEntries(
      dataset.variables.map((variable) => [
        variable.name,
        dataset.columns[variable.name][index],
      ])
    )
  );
}

function collected(
  seed: number,
  nSubjects: number
): Map<string, Record<string, string | number | null>[]> {
  return new Map(
    runPipeline(DEMO_301_STUDY, { seed, nSubjects }).datasets.map((dataset) => [
      dataset.name,
      records(dataset),
    ])
  );
}

describe("seeded synthetic collection", () => {
  it("has a stable golden hash for DEMO-301, seed 301 and 90 screened subjects", () => {
    const datasets = runPipeline(DEMO_301_STUDY, {
      seed: 301,
      nSubjects: 90,
    }).datasets;
    const digest = createHash("sha256")
      .update(JSON.stringify(datasets))
      .digest("hex");
    expect(digest).toBe(
      "ec43ff5f21261270a652a806545e488768321638385e520da57ff084a88ff9a8"
    );
  });

  it("generates traceable CDASH-shaped source records and expected seeded exceptions", () => {
    const data = collected(301, 90);
    const dm = data.get("DM")!;
    const rand = data.get("RAND")!;
    const sv = data.get("SV")!;
    const lb = data.get("LB")!;
    const ae = data.get("AE")!;
    const ds = data.get("DS")!;
    expect(dm).toHaveLength(90);
    expect(rand.length).toBeLessThan(dm.length);
    expect(rand.length).toBeGreaterThan(0);
    expect(sv.some((row) => row.STATUS === "MISSED")).toBe(true);
    expect(sv.some((row) => row.STATUS === "OUT OF WINDOW")).toBe(true);
    expect(sv.some((row) => row.STATUS === "UNSCHEDULED")).toBe(true);
    expect(lb.some((row) => row.LBNRIND === "HIGH")).toBe(true);
    expect(
      ae.some(
        (row) => typeof row.AESTDTC === "string" && row.AESTDTC.length === 7
      )
    ).toBe(true);
    expect(ae.some((row) => row.AEREL === "NOT RELATED")).toBe(true);
    expect(ds.some((row) => row.DSDECOD === "SCREEN FAILURE")).toBe(true);
    expect(ds.some((row) => row.DSDECOD === "ADVERSE EVENT")).toBe(true);
    const ids = [...data.values()].flatMap((rows) =>
      rows.map((row) => row.SRCID)
    );
    expect(
      ids.every((id) => typeof id === "string" && id.startsWith("DEMO-301:"))
    ).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps earlier subjects byte-identical when the subject count grows", () => {
    const smaller = collected(301, 10);
    const larger = collected(301, 11);
    for (const [domain, rows] of smaller) {
      expect(
        larger
          .get(domain)!
          .filter((row) => !String(row.USUBJID).endsWith("0011"))
      ).toEqual(rows);
    }
  });

  it("keeps visits after consent and exposure restricted to randomized subjects for arbitrary seeds", () => {
    fc.assert(
      fc.property(
        fc.nat(0xffffffff),
        fc.integer({ min: 1, max: 40 }),
        (seed, nSubjects) => {
          const data = collected(seed, nSubjects);
          const consentBySubject = new Map(
            data.get("DM")!.map((row) => [row.USUBJID, row.CONSENTDTC])
          );
          const randomized = new Set(
            data.get("RAND")!.map((row) => row.USUBJID)
          );
          for (const visit of data.get("SV")!) {
            if (visit.SVDTC !== null) {
              expect(
                String(visit.SVDTC) >=
                  String(consentBySubject.get(visit.USUBJID))
              ).toBe(true);
            }
          }
          for (const exposure of data.get("EX")!) {
            expect(randomized.has(exposure.USUBJID)).toBe(true);
          }
          expect(data.get("DM")!.length).toBe(nSubjects);
        }
      ),
      { numRuns: 50 }
    );
  });
});
