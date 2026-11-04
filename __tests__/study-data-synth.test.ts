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
      "5be96e4d9db47d2adbb096943e6e76d07a8734e4b8aa26aec57d96f2018a4c46"
    );
    // Also pin the datasets without the independently drawn comments form.
    const beforeComments = datasets.filter((dataset) => dataset.name !== "CO");
    expect(
      createHash("sha256").update(JSON.stringify(beforeComments)).digest("hex")
    ).toBe("5f8dfee0d496056532e61331cb08e9a3e25ed1c228471ad997faf36b51552b20");
    // #3019 changes randomized subjects' VS and screening LB values to
    // agree with eligibility. Pin their regenerated records separately
    // from screen failures and the independently drawn IE and CO domains.
    const dm = datasets.find((dataset) => dataset.name === "DM")!;
    const failed = new Set(
      dm.columns.USUBJID.filter(
        (_, index) => dm.columns.SCREENFL[index] === "FAIL"
      )
    );
    const enrolledOnly = beforeComments
      .filter((dataset) => dataset.name !== "IE")
      .map((dataset) => {
        const keep = dataset.columns.USUBJID.map(
          (subject) => !failed.has(subject)
        );
        return {
          ...dataset,
          columns: Object.fromEntries(
            Object.entries(dataset.columns).map(([name, values]) => [
              name,
              values.filter((_, index) => keep[index]),
            ])
          ),
          rowCount: keep.filter(Boolean).length,
        };
      });
    expect(
      createHash("sha256").update(JSON.stringify(enrolledOnly)).digest("hex")
    ).toBe("355097e6c8e88686d61357e8c7d04fcce2756878232db577ef2cfb2885e955b2");
    // All collected domains other than VS and LB retain their pre-#3019 hash.
    expect(
      createHash("sha256")
        .update(
          JSON.stringify(
            datasets.filter((data) => !["VS", "LB"].includes(data.name))
          )
        )
        .digest("hex")
    ).toBe("352497657c17e69cdee416e899fb5c1a23539b082b201fb31cc7b11854a6cf93");
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
