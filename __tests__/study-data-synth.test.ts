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
    runPipeline(DEMO_301_STUDY, { seed, nSubjects })
      .datasets.filter((dataset) => dataset.layer === "collected")
      .map((dataset) => [dataset.name, records(dataset)])
  );
}

describe("seeded synthetic collection", () => {
  it("has a stable golden hash for DEMO-301, seed 301 and 90 screened subjects", () => {
    const datasets = runPipeline(DEMO_301_STUDY, {
      seed: 301,
      nSubjects: 90,
    }).datasets.filter((dataset) => dataset.layer === "collected");
    const digest = createHash("sha256")
      .update(JSON.stringify(datasets))
      .digest("hex");
    expect(digest).toBe(
      "9def1c38db1d4cc265e126cac141658b8e312e2f438ae931347d89f6c0cec0c2"
    );
    // Adding medication collection (#2961) left every other domain's bytes
    // alone: without CM the run hashes as it did before.
    expect(
      createHash("sha256")
        .update(
          JSON.stringify(datasets.filter((dataset) => dataset.name !== "CM"))
        )
        .digest("hex")
    ).toBe("fa790cc10afe1c4539b634f8f28f90807439b25b245c0ae2fc6e0a85f68d8116");
    // Adding ECG collection (#2941) left every other domain's bytes alone.
    expect(
      createHash("sha256")
        .update(
          JSON.stringify(
            datasets.filter(
              (dataset) => dataset.name !== "EG" && dataset.name !== "CM"
            )
          )
        )
        .digest("hex")
    ).toBe("d0ad7aae03f8c7e6e59bc0c2d7ad24f934a6d1e5d05d6fab11939b0c0757baa0");
  });

  it("collects consistent 12-lead ECG intervals at the ECG visits (#2941)", () => {
    const eg = collected(301, 90).get("EG")!;
    const byEcg = new Map<string, Map<string, number>>();
    for (const record of eg) {
      const key = `${record.USUBJID}|${record.VISITNUM}`;
      const tests = byEcg.get(key) ?? new Map<string, number>();
      tests.set(String(record.EGTESTCD), Number(record.EGORRES));
      byEcg.set(key, tests);
      expect(record.EGORRESU).toBe(
        record.EGTESTCD === "EGHRMN" ? "beats/min" : "ms"
      );
    }
    expect([...new Set(eg.map((record) => record.VISIT))].sort()).toEqual([
      "BASELINE",
      "SCREENING",
      "WEEK 12",
      "WEEK 4",
    ]);
    expect(byEcg.size).toBeGreaterThan(200);
    for (const [key, tests] of byEcg) {
      expect([...tests.keys()].sort(), key).toEqual([
        "EGHRMN",
        "PRAG",
        "QRSAG",
        "QTAG",
        "RRAG",
      ]);
      const heartRate = tests.get("EGHRMN")!;
      const rr = tests.get("RRAG")!;
      expect(rr, key).toBe(Math.round(60000 / heartRate));
      const qtcf = tests.get("QTAG")! / Math.cbrt(rr / 1000);
      expect(qtcf, key).toBeGreaterThan(370);
      expect(qtcf, key).toBeLessThan(440);
      expect(tests.get("PRAG")!, key).toBeGreaterThan(120);
      expect(tests.get("QRSAG")!, key).toBeLessThan(120);
    }
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
