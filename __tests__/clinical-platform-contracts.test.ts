// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  METRIC_REGISTRY,
  ODCS_API_VERSION,
  STUDY_DATA_PRODUCT_ID,
  WAREHOUSE_SCHEMA,
  buildWarehouse,
  checkContractChange,
  checkDataContract,
  checkDataContracts,
  checkDataProducts,
  contractChangeLevel,
  contractData,
  contractDifferences,
  dataContracts,
  dataProducts,
  generatePortfolio,
  toOdcs,
  type ContractColumn,
  type ContractObjectRows,
  type DataContract,
} from "@/lib/clinical-platform";
import { DEMO_301_STUDY, runPipeline } from "@/lib/study-data";
import { readOdcsSchemaBytes, validateOdcs } from "./helpers/odcs-schema";
import {
  CONTRACT_LOCK_FILE,
  CONTRACT_REFERENCE_PAGE,
  contractArtifacts,
  nextContractReleases,
  odcsFile,
  referenceRun,
  type ContractLockFile,
} from "../scripts/generate-data-contracts";

const root = process.cwd();
const run = referenceRun();
const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const contracts = dataContracts(run);
const products = dataProducts(run);
const data = contractData(warehouse, run);
const loaded = { loadedAt: warehouse.asOf };

function contract(productId: string): DataContract {
  const found = contracts.find((c) => c.productId === productId);
  if (found === undefined) throw new Error(`no contract for ${productId}`);
  return found;
}

function product(productId: string) {
  const found = products.find((p) => p.id === productId);
  if (found === undefined) throw new Error(`no product ${productId}`);
  return found;
}

function column(c: DataContract, object: string, name: string): ContractColumn {
  const found = c.objects
    .find((o) => o.name === object)
    ?.columns.find((col) => col.name === name);
  if (found === undefined) throw new Error(`no column ${object}.${name}`);
  return found;
}

/** A contract with one column of one object changed. */
function editColumn(
  c: DataContract,
  object: string,
  name: string,
  change: Partial<ContractColumn>,
  version = c.version
): DataContract {
  return {
    ...c,
    version,
    objects: c.objects.map((o) =>
      o.name !== object
        ? o
        : {
            ...o,
            columns: o.columns.map((col) =>
              col.name === name ? { ...col, ...change } : col
            ),
          }
    ),
  };
}

/** One object's rows with one row edited, for a failing contract check. */
function rowsWith(
  rows: ContractObjectRows,
  edit: (row: Record<string, unknown>) => Record<string, unknown>,
  index = 0
): ContractObjectRows {
  return {
    columns: rows.columns,
    rows: rows.rows.map((row, i) =>
      i === index ? (edit({ ...row }) as typeof row) : row
    ),
  };
}

const messages = (findings: readonly { message: string }[]) =>
  findings.map((f) => f.message);

describe("data products (#2626)", () => {
  it("registers every silver and gold table and the Study Data Pipeline output", () => {
    const tables = WAREHOUSE_SCHEMA.tables.map((t) => `${t.layer}.${t.name}`);
    expect(tables.filter((t) => t.startsWith("gold."))).not.toHaveLength(0);
    expect(products.map((p) => p.id)).toEqual([
      ...tables,
      STUDY_DATA_PRODUCT_ID,
    ]);
    expect(contracts.map((c) => c.productId)).toEqual(
      products.map((p) => p.id)
    );
    for (const p of products) {
      expect(contract(p.id).id, p.id).toBe(p.contractId);
    }
    expect(checkDataProducts(products, contracts)).toEqual([]);
  });

  it("gives every SDTM and ADaM dataset a place in the study data contract", () => {
    const study = contract(STUDY_DATA_PRODUCT_ID);
    const published = run.datasets.filter((d) => d.layer !== "collected");
    expect(published.length).toBeGreaterThan(10);
    expect(study.objects.map((o) => o.name)).toEqual(
      published.map((d) => d.name)
    );
    for (const dataset of published) {
      const object = study.objects.find((o) => o.name === dataset.name)!;
      expect(
        object.columns.map((c) => c.name),
        dataset.name
      ).toEqual(dataset.variables.map((v) => v.name));
      expect(object.primaryKey, dataset.name).toEqual(dataset.keys);
    }
    // The collected layer is the pipeline's input stage, read into bronze.
    expect(study.objects.some((o) => o.name === "RAND")).toBe(false);
  });

  it("reads the study data contract from metadata, not from the seed", () => {
    const other = runPipeline(DEMO_301_STUDY, { seed: 7, nSubjects: 24 });
    expect(dataContracts(other)).toEqual(contracts);
  });

  it("labels classification and personal health data as the real data would be", () => {
    expect(product("silver.irt_randomization").classification).toBe(
      "restricted"
    );
    expect(
      column(contract("silver.irt_randomization"), "irt_randomization", "arm")
        .classification
    ).toBe("restricted");
    expect(product("silver.edc_subject")).toMatchObject({
      classification: "confidential",
      personalHealthData: true,
    });
    expect(product("silver.site").personalHealthData).toBe(false);
    expect(product("gold.dim_date")).toMatchObject({
      classification: "public",
      personalHealthData: false,
    });
    const study = contract(STUDY_DATA_PRODUCT_ID);
    // The arm a subject is on is restricted; the arms of the design are not.
    expect(column(study, "DM", "ARM").classification).toBe("restricted");
    expect(column(study, "ADSL", "TRT01A").classification).toBe("restricted");
    expect(column(study, "TA", "ARM").classification).toBe("internal");
    expect(column(study, "DM", "STUDYID").classification).toBe("internal");
    expect(column(study, "DM", "AGE").classification).toBe("confidential");
    expect(product(STUDY_DATA_PRODUCT_ID)).toMatchObject({
      layer: "gold",
      classification: "restricted",
      personalHealthData: true,
      upstream: ["usdm.DEMO-301"],
    });
  });

  it("keeps SDTM dates as ISO 8601 text, partial dates allowed, and ADaM dates as dates", () => {
    const study = contract(STUDY_DATA_PRODUCT_ID);
    const aestdtc = column(study, "AE", "AESTDTC");
    expect(aestdtc.type).toBe("string");
    const pattern = new RegExp(aestdtc.pattern!);
    for (const ok of ["2026", "2026-05", "2026-05-01"]) {
      expect(pattern.test(ok), ok).toBe(true);
    }
    expect(pattern.test("05/01/2026")).toBe(false);
    expect(column(study, "ADAE", "ASTDT").type).toBe("date");
    expect(column(study, "DM", "USUBJID").nullable).toBe(false);
  });

  it("traces upstream sources and known consumers", () => {
    expect(product("gold.fct_visit").upstream).toContain("silver.edc_visit");
    expect(product("silver.edc_visit").upstream).toEqual(["bronze.edc.visits"]);
    expect(product("silver.edc_visit").consumers).toContainEqual({
      kind: "product",
      id: "gold.fct_visit",
    });
    expect(product("gold.fct_visit").consumers).toContainEqual({
      kind: "metric",
      id: "data_entry_lag_median",
    });
    const consumed = new Set(
      products.flatMap((p) =>
        p.consumers.filter((c) => c.kind === "metric").map((c) => c.id)
      )
    );
    expect([...consumed].sort()).toEqual(
      METRIC_REGISTRY.map((m) => m.id).sort()
    );
  });

  it("finds registry mistakes", () => {
    const broken = contracts.map((c) =>
      c.productId === "silver.site"
        ? {
            ...c,
            version: "1.0",
            sla: { ...c.sla, freshnessHours: 0, availability: 1.5 },
          }
        : c
    );
    const unowned = products.map((p) =>
      p.id === "silver.site" ? { ...p, owner: " " } : p
    );
    expect(messages(checkDataProducts(unowned, broken))).toEqual([
      "the product names no owner",
      "version 1.0 is not x.y.z",
      "the freshness target must be a whole number of hours, at least 1",
      "the availability target must be a share above 0 and at most 1",
    ]);
    expect(
      messages(
        checkDataProducts(
          products.filter((p) => p.id !== "gold.dim_date"),
          contracts
        )
      )
    ).toEqual(["gold.dim_date is not a data product"]);
  });
});

describe("contract checks on generated data (#2626)", () => {
  it("passes every product on the default seed", () => {
    const results = checkDataContracts(contracts, data, loaded);
    expect(results.filter((r) => !r.passed)).toEqual([]);
    for (const r of results) {
      expect(r, r.productId).toMatchObject({
        completeness: 1,
        ageHours: 0,
        available: true,
      });
      expect(r.rowCount, r.productId).toBeGreaterThan(0);
    }
  });

  it("passes every product on another portfolio and pipeline seed", () => {
    const other = buildWarehouse(generatePortfolio({ seed: 9 }));
    const otherRun = runPipeline(DEMO_301_STUDY, { seed: 11, nSubjects: 40 });
    const results = checkDataContracts(
      dataContracts(otherRun),
      contractData(other, otherRun),
      { loadedAt: other.asOf }
    );
    expect(results.filter((r) => !r.passed)).toEqual([]);
  });

  const visits = contract("silver.edc_visit");
  const visitRows = data["silver.edc_visit"].edc_visit;
  const check = (rows: ContractObjectRows, c = visits) =>
    checkDataContract(c, { edc_visit: rows }, loaded);

  it("fails a dataset whose columns, types or keys break the contract", () => {
    const missing: ContractObjectRows = {
      columns: visitRows.columns.filter((c) => c !== "visit_date"),
      rows: visitRows.rows.map((row) => {
        const { visit_date: _, ...rest } = row;
        return rest;
      }),
    };
    expect(messages(check(missing).findings)).toEqual([
      "edc_visit has no column visit_date",
    ]);
    const extra = rowsWith(
      { columns: [...visitRows.columns, "notes"], rows: visitRows.rows },
      (row) => ({ ...row, notes: "x" })
    );
    expect(messages(check(extra).findings)).toEqual([
      "edc_visit has column notes, which the contract does not declare",
    ]);
    const retyped = rowsWith(
      visitRows,
      (row) => ({ ...row, visit_date: 20260101 }),
      4
    );
    expect(messages(check(retyped).findings)).toEqual([
      "edc_visit.visit_date: 1 value breaks the contract (first: row 5, 20260101, is not a YYYY-MM-DD date)",
    ]);
    const long = rowsWith(visitRows, (row) => ({
      ...row,
      subject_id: "S".repeat(65),
    }));
    expect(messages(check(long).findings)).toEqual([
      `edc_visit.subject_id: 1 value breaks the contract (first: row 1, "${"S".repeat(65)}", is longer than 64 characters)`,
    ]);
    const repeated: ContractObjectRows = {
      columns: visitRows.columns,
      rows: [...visitRows.rows, visitRows.rows[0]],
    };
    const result = check(repeated);
    expect(messages(result.findings)).toEqual([
      "edc_visit: 1 row repeats a primary key (visit_id)",
    ]);
    expect(result.findings[0]).toMatchObject({
      rule: "schema",
      productId: "silver.edc_visit",
      object: "edc_visit",
    });
    expect(result.passed).toBe(false);
  });

  it("checks SDTM partial-date text against its pattern", () => {
    const study = contract(STUDY_DATA_PRODUCT_ID);
    const ae = data[STUDY_DATA_PRODUCT_ID].AE;
    const bad = rowsWith(ae, (row) => ({ ...row, AESTDTC: "01-05-2026" }));
    const result = checkDataContract(
      study,
      { ...data[STUDY_DATA_PRODUCT_ID], AE: bad },
      loaded
    );
    expect(messages(result.findings)).toEqual([
      `AE.AESTDTC: 1 value breaks the contract (first: row 1, "01-05-2026", does not match ${column(study, "AE", "AESTDTC").pattern})`,
    ]);
  });

  it("measures completeness, freshness and availability against the service levels", () => {
    const gap = rowsWith(visitRows, (row) => ({ ...row, subject_id: null }));
    const incomplete = check(gap);
    expect(incomplete.completeness).toBeLessThan(1);
    expect(incomplete.findings.map((f) => f.rule)).toEqual(["completeness"]);
    expect(incomplete.findings[0].message).toMatch(
      /^1 of \d+ required values is missing: 99\.99% present, below the 100% the contract promises$/
    );
    const stale = checkDataContract(
      visits,
      { edc_visit: visitRows },
      { loadedAt: "2026-09-30", evaluatedAt: "2026-10-02T06:00:00Z" }
    );
    expect(stale.ageHours).toBe(54);
    expect(messages(stale.findings)).toEqual([
      "the latest load is 54 hours old; the contract promises at most 24",
    ]);
    expect(
      checkDataContract(
        visits,
        { edc_visit: visitRows },
        { loadedAt: "2026-09-30", evaluatedAt: "2026-10-01T00:00:00Z" }
      ).passed
    ).toBe(true);
    const unpublished = checkDataContract(visits, {}, loaded);
    expect(unpublished).toMatchObject({ available: false, passed: false });
    expect(messages(unpublished.findings)).toEqual([
      "edc_visit was not published",
    ]);
  });

  it("refuses timestamps it cannot read and a check before the load", () => {
    expect(() =>
      checkDataContract(visits, { edc_visit: visitRows }, { loadedAt: "soon" })
    ).toThrow(RangeError);
    expect(() =>
      checkDataContract(
        visits,
        { edc_visit: visitRows },
        { loadedAt: "2026-09-30", evaluatedAt: "2026-09-29" }
      )
    ).toThrow(/is before loadedAt/);
  });
});

describe("contract evolution (#2626)", () => {
  const fixture = JSON.parse(
    readFileSync(
      path.join(
        root,
        "__tests__/fixtures/clinical-platform/data-contract-breaking-change.json"
      ),
      "utf8"
    )
  ) as { previous: DataContract; next: DataContract };

  it("fails the fixture's breaking change released without a major bump", () => {
    expect(contractChangeLevel(fixture.previous, fixture.next)).toBe("major");
    expect(checkContractChange(fixture.previous, fixture.next)).toEqual([
      {
        rule: "version",
        productId: "silver.edc_visit",
        object: null,
        message:
          "a breaking change needs a major version bump (1.0.0 to 1.1.0): edc_visit.visit_date changes type from date to string; edc_visit.data_entered_at is removed",
      },
    ]);
    expect(
      checkContractChange(fixture.previous, {
        ...fixture.next,
        version: "2.0.0",
      })
    ).toEqual([]);
  });

  const base = contract("silver.edc_visit");

  it("grades each kind of change", () => {
    const grade = (next: DataContract) => contractChangeLevel(base, next);
    expect(grade(base)).toBe("none");
    expect(
      grade(
        editColumn(base, "edc_visit", "visit_date", { description: "When." })
      )
    ).toBe("patch");
    expect(
      grade(editColumn(base, "edc_visit", "subject_id", { nullable: true }))
    ).toBe("major");
    expect(
      grade(editColumn(base, "edc_visit", "subject_id", { maxLength: 128 }))
    ).toBe("minor");
    expect(
      grade(editColumn(base, "edc_visit", "subject_id", { maxLength: 32 }))
    ).toBe("major");
    expect(
      grade(
        editColumn(base, "edc_visit", "subject_id", {
          classification: "restricted",
        })
      )
    ).toBe("major");
    const added = {
      ...base,
      objects: base.objects.map((o) => ({
        ...o,
        columns: [...o.columns, { ...o.columns[0], name: "visit_notes" }],
      })),
    };
    expect(grade(added)).toBe("minor");
    expect(grade({ ...base, sla: { ...base.sla, freshnessHours: 48 } })).toBe(
      "major"
    );
    expect(grade({ ...base, sla: { ...base.sla, freshnessHours: 12 } })).toBe(
      "minor"
    );
    expect(grade({ ...base, retention: { ...base.retention, years: 5 } })).toBe(
      "major"
    );
    expect(
      contractDifferences(base, { ...base, objects: [] }).map((d) => d.message)
    ).toEqual(["edc_visit is removed"]);
  });

  it("asks for the bump each change needs, and never a lower or reused version", () => {
    const describe = editColumn(base, "edc_visit", "visit_date", {
      description: "When.",
    });
    expect(
      messages(checkContractChange(base, { ...describe, version: "1.0.1" }))
    ).toEqual([]);
    expect(messages(checkContractChange(base, describe))).toEqual([
      "version 1.0.0 changed without a new version number: edc_visit.visit_date has a new description",
    ]);
    const widened = editColumn(
      base,
      "edc_visit",
      "subject_id",
      { maxLength: 128 },
      "1.0.1"
    );
    expect(messages(checkContractChange(base, widened))).toEqual([
      "an additive change needs at least a minor version bump (1.0.0 to 1.0.1): edc_visit.subject_id widens maxLength from 64 to 128",
    ]);
    expect(
      messages(checkContractChange(base, { ...widened, version: "1.1.0" }))
    ).toEqual([]);
    expect(
      messages(checkContractChange(base, { ...base, version: "0.9.0" }))
    ).toEqual(["version 0.9.0 is lower than 1.0.0"]);
  });
});

describe("contract lock (#2626)", () => {
  const lock = JSON.parse(
    readFileSync(path.join(root, CONTRACT_LOCK_FILE), "utf8")
  ) as ContractLockFile;

  it("keeps the lock file in step with the contracts and its history versioned", () => {
    expect(nextContractReleases(lock.releases, contracts)).toEqual(
      lock.releases
    );
    for (const c of contracts) {
      expect(
        lock.releases.some(
          (r) => r.productId === c.productId && r.version === c.version
        ),
        c.productId
      ).toBe(true);
    }
    for (const id of new Set(lock.releases.map((r) => r.productId))) {
      const history = lock.releases.filter((r) => r.productId === id);
      for (let i = 1; i < history.length; i += 1) {
        expect(checkContractChange(history[i - 1], history[i]), id).toEqual([]);
      }
    }
  });

  it("refuses to record a removed column without a major bump", () => {
    const removed = (version: string): DataContract[] =>
      contracts.map((c) =>
        c.productId !== "silver.edc_query"
          ? c
          : {
              ...c,
              version,
              objects: c.objects.map((o) => ({
                ...o,
                columns: o.columns.filter((col) => col.name !== "answered_at"),
              })),
            }
      );
    expect(() => nextContractReleases(lock.releases, removed("1.0.0"))).toThrow(
      /silver\.edc_query 1\.0\.0 changed after it was released/
    );
    expect(() => nextContractReleases(lock.releases, removed("1.1.0"))).toThrow(
      /a breaking change needs a major version bump \(1\.0\.0 to 1\.1\.0\): edc_query\.answered_at is removed/
    );
    const bumped = nextContractReleases(lock.releases, removed("2.0.0"));
    expect(
      bumped
        .filter((r) => r.productId === "silver.edc_query")
        .map((r) => r.version)
    ).toEqual(["1.0.0", "2.0.0"]);
  });
});

describe("ODCS export (#2626)", () => {
  it("pins the vendored ODCS schema", () => {
    expect(
      createHash("sha256").update(readOdcsSchemaBytes()).digest("hex")
    ).toBe("edb41f33ec46e84780e99872ab2bd67f074959d2bf3e9c9fc54e61f8982b0d93");
  });

  it("writes every contract as a document the ODCS schema accepts", () => {
    products.forEach((p, i) => {
      const doc = toOdcs(p, contracts[i]);
      expect(validateOdcs(doc), p.id).toEqual([]);
      expect(doc).toMatchObject({
        apiVersion: ODCS_API_VERSION,
        kind: "DataContract",
        id: p.contractId,
        version: contracts[i].version,
      });
    });
  });

  it("carries required, key, classification and service levels into the document", () => {
    const doc = toOdcs(
      product("silver.edc_subject"),
      contract("silver.edc_subject")
    );
    const schema = doc.schema as readonly Record<string, unknown>[];
    const props = schema[0].properties as readonly Record<string, unknown>[];
    expect(props[0]).toMatchObject({
      name: "subject_id",
      logicalType: "string",
      physicalType: "VARCHAR(64)",
      required: true,
      primaryKey: true,
      primaryKeyPosition: 1,
      classification: "confidential",
    });
    expect(props.find((p) => p.name === "enrolled_on")).toMatchObject({
      logicalType: "date",
      required: false,
    });
    expect(doc.slaProperties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: "latency", value: 24, unit: "h" }),
        expect.objectContaining({ property: "completeness", value: 100 }),
        expect.objectContaining({ property: "availability", value: 99 }),
        expect.objectContaining({
          property: "retention",
          value: 25,
          unit: "y",
          driver: "regulatory",
        }),
      ])
    );
    expect(doc.tags).toContain("personal-health-data");
    expect(() =>
      toOdcs(product("silver.site"), contract("silver.edc_subject"))
    ).toThrow(/does not govern silver\.site/);
    const invalid = { ...doc, apiVersion: "v9" };
    expect(validateOdcs(invalid)).not.toEqual([]);
  });

  it("keeps the checked-in ODCS files and catalog page in step with the contracts", () => {
    const artifacts = contractArtifacts(run);
    expect(Object.keys(artifacts).sort()).toEqual(
      [...products.map((p) => odcsFile(p.id)), CONTRACT_REFERENCE_PAGE].sort()
    );
    for (const [file, contents] of Object.entries(artifacts)) {
      expect(readFileSync(path.join(root, file), "utf8"), file).toBe(contents);
    }
    const page = artifacts[CONTRACT_REFERENCE_PAGE];
    for (const p of products) expect(page).toContain(`| \`${p.id}\` |`);
  });
});
