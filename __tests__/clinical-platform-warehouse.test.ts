// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  SCD2_OPEN_END,
  SYNTHETIC_DATA_NOTICE,
  WAREHOUSE_SCHEMA,
  buildWarehouse,
  checkLayerFlow,
  checkRegulatoryWording,
  checkWarehouse,
  emitDdl,
  exportWarehouse,
  findClinicalClaims,
  generatePortfolio,
  renderWarehouseErd,
  renderWarehouseReference,
  siteStaffFeed,
  warehouseLineage,
  type Portfolio,
  type SqlDialect,
  type Warehouse,
  type WarehouseRow,
  type WarehouseSchema,
  type WarehouseTable,
} from "@/lib/clinical-platform";
import {
  WAREHOUSE_DDL_GOLDENS,
  WAREHOUSE_REFERENCE_PAGE,
  warehouseArtifacts,
} from "../scripts/generate-warehouse-artifacts";

/**
 * SHA-256 of `JSON.stringify(buildWarehouse(generatePortfolio({ seed: 301 })))`.
 * A change to the portfolio, the schema or the build that alters any row
 * changes it. Update it deliberately, with `GOLDEN_ROW_COUNTS`, and say why.
 *
 * #2879: `silver.edc_subject` and `gold.fct_enrollment` gained
 * `screen_failure_reason`. With that column left out the hash is the
 * previous golden, ee7c3ef4, so no other value moved.
 *
 * #2880: `silver.site` gained the three CTMS start-up stages, and
 * `gold.dim_site` those plus `initiated_on` and `first_subject_in_on`. With
 * those five columns left out the hash is the previous golden, e4bd17a7.
 *
 * #2881: `gold.fct_cec_adjudication` is new. With that table left out the
 * hash is the previous golden, 14ee6464, so no other value moved.
 *
 * #2912: `silver.finance_plan_line` and `gold.fct_spend_forecast` are new.
 * With those two tables left out the hash is the previous golden, 6922ab5e,
 * so no other value moved.
 *
 * #2955: `gold.fct_visit` gained `entry_hour`. With that column left out the
 * hash is the previous golden, 9c976355, so no other value moved.
 *
 * #2956: `silver.edc_adverse_event` and `gold.fct_adverse_event` are new.
 * With those two tables left out the hash is the previous golden, 5258dfe3,
 * so no other value moved.
 *
 * #2957: `silver.edc_vital_sign` and `gold.fct_vital_sign` are new. With
 * those two tables left out the hash is the previous golden, 140be786, so
 * no other value moved.
 *
 * #2806: DEMO-301's subjects attend the sites DM.SITEID names, and six of
 * its sites activate earlier, a week before their first consent. Its
 * queries (+19), deviations (+3), monitoring visits (+5) and KRI snapshots
 * (+12) move with it; no other study's rows change.
 */
const GOLDEN_SHA256 =
  "81bb95dd8ea8a85c3fc8bb8b0ce5d2e68e2190896e803e0f5c112cd87fc6154d";

/** Rows per table for the default seed: the readable half of the golden. */
const GOLDEN_ROW_COUNTS = {
  "silver.study": 8,
  "silver.planned_visit": 56,
  "silver.site": 120,
  "silver.vendor": 7,
  "silver.edc_subject": 1808,
  "silver.edc_visit": 7727,
  "silver.edc_query": 3578,
  "silver.edc_adverse_event": 2084,
  "silver.edc_vital_sign": 27836,
  "silver.ctms_milestone": 72,
  "silver.ctms_monitoring_plan": 8,
  "silver.ctms_monitoring_visit": 1128,
  "silver.ctms_deviation": 332,
  "silver.ctms_site_staff": 129,
  "silver.irt_randomization": 1098,
  "silver.irt_kit": 3342,
  "silver.etmf_document": 656,
  "silver.finance_line": 363,
  "silver.finance_plan_line": 504,
  "silver.cec_adjudication": 39,
  "gold.dim_study": 8,
  "gold.dim_site": 265,
  "gold.dim_country": 12,
  "gold.dim_date": 1827,
  "gold.dim_vendor": 8,
  "gold.dim_milestone": 9,
  "gold.dim_monitoring_plan": 8,
  "gold.fct_enrollment": 3727,
  "gold.fct_visit": 7727,
  "gold.fct_query": 3578,
  "gold.fct_deviation": 332,
  "gold.fct_cec_adjudication": 39,
  "gold.fct_adverse_event": 2084,
  "gold.fct_vital_sign": 6959,
  "gold.fct_monitoring_visit": 1128,
  "gold.fct_planned_monitoring_visit": 1082,
  "gold.fct_milestone": 72,
  "gold.fct_spend": 1089,
  "gold.fct_spend_forecast": 48,
  "gold.fct_kri_snapshot": 7956,
};

const portfolio = generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED });
const warehouse = buildWarehouse(portfolio);
const root = process.cwd();

function rows(name: string, w: Warehouse = warehouse): readonly WarehouseRow[] {
  const found = w.tables[name];
  if (found === undefined) throw new Error(`no table ${name}`);
  return found;
}

function table(name: string): WarehouseTable {
  const found = WAREHOUSE_SCHEMA.tables.find(
    (t) => `${t.layer}.${t.name}` === name
  );
  if (found === undefined) throw new Error(`no table ${name}`);
  return found;
}

function withRows(
  name: string,
  edit: (current: readonly WarehouseRow[]) => readonly WarehouseRow[]
): Warehouse {
  return {
    ...warehouse,
    tables: { ...warehouse.tables, [name]: edit(rows(name)) },
  };
}

/** The `dim_site` version a site was in on a day. */
function siteVersionOn(
  w: Warehouse,
  siteId: string,
  day: string
): WarehouseRow | undefined {
  return rows("gold.dim_site", w).find(
    (v) =>
      v.site_id === siteId &&
      String(v.valid_from) <= day &&
      day < String(v.valid_to)
  );
}

function dateOfKey(key: unknown): string {
  const text = String(key);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

describe("buildWarehouse: determinism and budget", () => {
  it("matches the golden hash and row counts for the default seed", () => {
    const counts = Object.fromEntries(
      Object.entries(warehouse.tables).map(([name, r]) => [name, r.length])
    );
    expect(counts).toEqual(GOLDEN_ROW_COUNTS);
    expect(
      createHash("sha256").update(JSON.stringify(warehouse)).digest("hex")
    ).toBe(GOLDEN_SHA256);
  });

  it("gives byte-identical output for the same portfolio", () => {
    expect(JSON.stringify(buildWarehouse(portfolio))).toBe(
      JSON.stringify(warehouse)
    );
  });

  it("builds the default warehouse in well under 500 ms", () => {
    // Best of five: a slower algorithm fails it, a busy machine does not.
    const runs = Array.from({ length: 5 }, () => {
      const start = performance.now();
      buildWarehouse(portfolio);
      return performance.now() - start;
    });
    expect(Math.min(...runs)).toBeLessThan(500);
  });

  it("holds every table of the schema, in schema order", () => {
    expect(Object.keys(warehouse.tables)).toEqual(
      WAREHOUSE_SCHEMA.tables.map((t) => `${t.layer}.${t.name}`)
    );
    expect(warehouse.portfolioId).toBe(portfolio.id);
    expect(warehouse.asOf).toBe(portfolio.asOf);
    for (const [name, tableRows] of Object.entries(warehouse.tables)) {
      expect(tableRows.length, name).toBeGreaterThan(0);
    }
  });
});

describe("buildWarehouse: integrity", () => {
  it("passes every schema check for the default seed", () => {
    expect(checkWarehouse(WAREHOUSE_SCHEMA, warehouse)).toEqual([]);
  });

  it("dates each site's initiation and first subject from the CTMS and EDC (#2880)", () => {
    const earliest = (
      table: string,
      column: string,
      keep = (_: WarehouseRow) => true
    ) => {
      const found = new Map<string, string>();
      for (const row of rows(table)) {
        const day = row[column];
        if (typeof day !== "string" || !keep(row)) continue;
        const site = String(row.site_id);
        if (!found.has(site) || day < found.get(site)!) found.set(site, day);
      }
      return found;
    };
    const siv = earliest(
      "silver.ctms_monitoring_visit",
      "visit_date",
      (v) => v.visit_type === "SIV"
    );
    const fsi = earliest("silver.edc_subject", "enrolled_on");
    const silverSites = new Map(rows("silver.site").map((s) => [s.site_id, s]));
    for (const site of rows("gold.dim_site")) {
      const id = String(site.site_id);
      expect(site.initiated_on, id).toBe(siv.get(id) ?? null);
      expect(site.first_subject_in_on, id).toBe(fsi.get(id) ?? null);
      for (const stage of ["selected_on", "contracted_on", "irb_approved_on"]) {
        expect(site[stage], `${id} ${stage}`).toBe(
          silverSites.get(site.site_id)?.[stage]
        );
      }
    }
  });

  it("reports a site whose start-up stages are out of order (#2880)", () => {
    const swapped = rows("gold.dim_site").map((site, index) =>
      index === 0 ? { ...site, contracted_on: null } : site
    );
    const findings = checkWarehouse(WAREHOUSE_SCHEMA, {
      ...warehouse,
      tables: { ...warehouse.tables, "gold.dim_site": swapped },
    });
    expect(findings).toEqual([
      {
        rule: "sequence",
        table: "gold.dim_site",
        message: expect.stringMatching(
          /^irb_approved_on = "\d{4}-\d{2}-\d{2}" without contracted_on on or before it \(null\)\.$/
        ),
      },
    ]);
  });

  it("keeps one adjudication fact per event, from the committee's own dates (#2881)", () => {
    const events = rows("silver.cec_adjudication");
    const facts = new Map(
      rows("gold.fct_cec_adjudication").map((f) => [f.event_id, f])
    );
    expect(facts.size).toBe(events.length);
    const key = (day: unknown) =>
      typeof day === "string" ? Number(day.replaceAll("-", "")) : null;
    const studyKeys = new Map(
      rows("gold.dim_study").map((s) => [s.study_key, s])
    );
    for (const event of events) {
      const fact = facts.get(event.event_id)!;
      const id = String(event.event_id);
      expect(studyKeys.get(fact.study_key)?.has_cec_adjudication, id).toBe(
        true
      );
      expect(fact.occurred_date_key, id).toBe(key(event.occurred_on));
      expect(fact.reported_date_key, id).toBe(key(event.reported_on));
      expect(fact.adjudicated_date_key, id).toBe(key(event.adjudicated_on));
      expect(fact.days_to_adjudicate === null, id).toBe(
        event.adjudicated_on === null
      );
    }
  });

  it("reports an event adjudicated before it was reported (#2881)", () => {
    const early = rows("silver.cec_adjudication").map((event, index) =>
      index === 0 ? { ...event, adjudicated_on: "2000-01-01" } : event
    );
    const findings = checkWarehouse(WAREHOUSE_SCHEMA, {
      ...warehouse,
      tables: { ...warehouse.tables, "silver.cec_adjudication": early },
    });
    expect(findings).toEqual([
      {
        rule: "sequence",
        table: "silver.cec_adjudication",
        message: expect.stringMatching(
          /^adjudicated_on = "2000-01-01" without reported_on on or before it \("\d{4}-\d{2}-\d{2}"\)\.$/
        ),
      },
    ]);
  });

  it("keeps one adverse event fact per event, keyed by the site version that reported it (#2956)", () => {
    const events = rows("silver.edc_adverse_event");
    const facts = new Map(
      rows("gold.fct_adverse_event").map((f) => [f.ae_id, f])
    );
    expect(facts.size).toBe(events.length);
    const key = (day: unknown) => Number(String(day).replaceAll("-", ""));
    const siteKeys = new Map(rows("gold.dim_site").map((s) => [s.site_key, s]));
    for (const event of events) {
      const fact = facts.get(event.ae_id)!;
      const id = String(event.ae_id);
      const reported = String(event.reported_on);
      expect(siteKeys.get(fact.site_key), id).toBe(
        siteVersionOn(warehouse, String(event.site_id), reported)
      );
      expect(fact.onset_date_key, id).toBe(key(event.onset_on));
      expect(fact.reported_date_key, id).toBe(key(reported));
      expect(fact.days_to_report, id).toBe(
        (Date.parse(reported) - Date.parse(String(event.onset_on))) / 86_400_000
      );
      expect(fact.is_serious, id).toBe(event.is_serious);
    }
  });

  it("reports an adverse event reported before it began (#2956)", () => {
    const early = rows("silver.edc_adverse_event").map((event, index) =>
      index === 0 ? { ...event, reported_on: "2000-01-01" } : event
    );
    const findings = checkWarehouse(WAREHOUSE_SCHEMA, {
      ...warehouse,
      tables: { ...warehouse.tables, "silver.edc_adverse_event": early },
    });
    expect(findings).toEqual([
      {
        rule: "sequence",
        table: "silver.edc_adverse_event",
        message: expect.stringMatching(
          /^reported_on = "2000-01-01" without onset_on on or before it \("\d{4}-\d{2}-\d{2}"\)\.$/
        ),
      },
    ]);
  });

  it("pivots each visit's vital signs onto one fact, keyed by the site version on the day (#2957)", () => {
    const readings = rows("silver.edc_vital_sign");
    const facts = new Map(
      rows("gold.fct_vital_sign").map((f) => [f.visit_id, f])
    );
    expect(facts.size).toBe(rows("gold.fct_vital_sign").length);
    expect(facts.size * 4).toBe(readings.length);
    const column: Record<string, string> = {
      SYSBP: "systolic_bp_mmhg",
      DIABP: "diastolic_bp_mmhg",
      PULSE: "pulse_bpm",
      WEIGHT: "weight_kg",
    };
    const siteKeys = new Map(rows("gold.dim_site").map((s) => [s.site_key, s]));
    for (const reading of readings) {
      const fact = facts.get(reading.visit_id)!;
      const id = String(reading.vital_sign_id);
      const measured = String(reading.measured_on);
      expect(fact[column[String(reading.vs_test_code)]], id).toBe(
        reading.vs_value
      );
      expect(fact.subject_id, id).toBe(reading.subject_id);
      expect(fact.measured_date_key, id).toBe(
        Number(measured.replaceAll("-", ""))
      );
      expect(siteKeys.get(fact.site_key), id).toBe(
        siteVersionOn(warehouse, String(reading.site_id), measured)
      );
    }
  });

  it("leaves a sign the site did not record empty in its visit's fact (#2957)", () => {
    const [first] = portfolio.feeds.edc.vitalSigns;
    const fact = rows(
      "gold.fct_vital_sign",
      buildWarehouse({
        ...portfolio,
        feeds: {
          ...portfolio.feeds,
          edc: {
            ...portfolio.feeds.edc,
            vitalSigns: portfolio.feeds.edc.vitalSigns.filter(
              (r) => r.visitId !== first.visitId || r.test !== "WEIGHT"
            ),
          },
        },
      })
    ).find((f) => f.visit_id === first.visitId);
    expect(fact?.weight_kg).toBeNull();
    expect(fact?.systolic_bp_mmhg).toBe(first.value);
  });

  it("carries each subject's screen failure reason into every enrollment fact (#2879)", () => {
    const reasons = new Map(
      rows("silver.edc_subject").map((s) => [
        s.subject_id,
        s.screen_failure_reason,
      ])
    );
    for (const subject of rows("silver.edc_subject")) {
      expect(
        subject.screen_failure_reason === null,
        String(subject.subject_id)
      ).toBe(subject.subject_status !== "screen-failed");
    }
    for (const fact of rows("gold.fct_enrollment")) {
      expect(fact.screen_failure_reason).toBe(reasons.get(fact.subject_id));
    }
  });

  it("carries the UTC hour each visit's data was entered (#2955)", () => {
    const entered = new Map(
      rows("silver.edc_visit").map((v) => [v.visit_id, v.data_entered_at])
    );
    const hours = new Set<number>();
    for (const visit of rows("gold.fct_visit")) {
      const at = entered.get(visit.visit_id);
      if (at === null) {
        expect(visit.entry_hour).toBeNull();
        continue;
      }
      expect(visit.entry_hour).toBe(new Date(String(at)).getUTCHours());
      hours.add(Number(visit.entry_hour));
    }
    // Sites enter data through the working day.
    expect(Math.min(...hours)).toBe(8);
    expect(Math.max(...hours)).toBe(19);
  });

  it("names each query's form by the CDASH domain of its field (#2759)", () => {
    const forms = new Set<string>();
    for (const query of rows("gold.fct_query")) {
      const [domain, variable] = String(query.queried_field).split(".");
      expect(variable, String(query.queried_field)).toBeTruthy();
      expect(query.queried_form).toBe(domain);
      forms.add(String(query.queried_form));
    }
    expect([...forms].sort()).toEqual([
      "AE",
      "CM",
      "DM",
      "EX",
      "LB",
      "MH",
      "VS",
    ]);
  });

  it("passes every schema check for other seeds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const w = buildWarehouse(generatePortfolio({ seed }));
        expect(checkWarehouse(WAREHOUSE_SCHEMA, w)).toEqual([]);
      }),
      { numRuns: 2, seed: 2623 }
    );
  });

  it("is unique at every fact's declared grain", () => {
    for (const t of WAREHOUSE_SCHEMA.tables.filter((x) => x.kind === "fact")) {
      const r = rows(`gold.${t.name}`);
      const keys = new Set(
        r.map((row) => JSON.stringify(t.primaryKey.map((c) => row[c])))
      );
      expect(keys.size, t.name).toBe(r.length);
      expect(t.grain, t.name).toMatch(/^One row per /);
    }
  });

  it("resolves every foreign key to its dimension", () => {
    let checked = 0;
    for (const t of WAREHOUSE_SCHEMA.tables) {
      for (const column of t.columns) {
        if (column.references === null) continue;
        const target = new Set(
          rows(column.references.table).map(
            (r) => r[column.references?.column ?? ""]
          )
        );
        for (const row of rows(`${t.layer}.${t.name}`)) {
          const value = row[column.name];
          if (value === null) continue;
          expect(target.has(value), `${t.name}.${column.name}`).toBe(true);
          checked += 1;
        }
      }
    }
    expect(checked).toBeGreaterThan(100_000);
  });

  it("ties every fact to every conformed dimension it declares", () => {
    const declared = (name: string) =>
      new Set(
        table(`gold.${name}`)
          .columns.filter((c) => c.references !== null)
          .map((c) => c.references?.table)
      );
    for (const name of [
      "fct_enrollment",
      "fct_visit",
      "fct_query",
      "fct_deviation",
      "fct_monitoring_visit",
      "fct_kri_snapshot",
    ]) {
      for (const dim of ["dim_study", "dim_site", "dim_country", "dim_date"]) {
        expect(declared(name).has(`gold.${dim}`), `${name} ${dim}`).toBe(true);
      }
    }
    expect(declared("fct_spend")).toEqual(
      new Set(["gold.dim_study", "gold.dim_vendor", "gold.dim_date"])
    );
    expect(declared("fct_milestone")).toEqual(
      new Set(["gold.dim_study", "gold.dim_milestone", "gold.dim_date"])
    );
  });

  it("keeps one fct_spend row per study, vendor and month, summing to finance", () => {
    const spend = rows("gold.fct_spend");
    const sum = (r: readonly WarehouseRow[], c: string) =>
      r.reduce((acc, row) => acc + Number(row[c]), 0);
    expect(sum(spend, "budget_usd")).toBe(
      portfolio.feeds.finance.reduce((acc, f) => acc + f.budgetUsd, 0)
    );
    expect(sum(spend, "actual_usd")).toBe(
      portfolio.feeds.finance.reduce((acc, f) => acc + f.actualUsd, 0)
    );
    expect(spend.every((r) => String(r.month_date_key).endsWith("01"))).toBe(
      true
    );
    expect(spend.some((r) => r.vendor_key === 0)).toBe(true);
    expect(
      spend.every(
        (r) => r.variance_usd === Number(r.actual_usd) - Number(r.budget_usd)
      )
    ).toBe(true);
  });

  it("covers every fact date with whole calendar years in dim_date", () => {
    const dates = rows("gold.dim_date");
    expect(String(dates[0].calendar_date)).toMatch(/-01-01$/);
    expect(String(dates[dates.length - 1].calendar_date)).toMatch(/-12-31$/);
    const first = dates.find((d) => d.calendar_date === "2026-09-30");
    expect(first).toMatchObject({
      date_key: 20260930,
      year_number: 2026,
      quarter_number: 3,
      month_number: 9,
      month_name: "September",
      iso_day_of_week: 3,
      year_quarter: "2026-Q3",
      is_month_end: true,
    });
    const leap = dates.find((d) => d.calendar_date === "2028-02-29");
    expect(leap?.is_month_end).toBe(true);
    expect(
      dates.find((d) => d.calendar_date === "2025-01-05")?.iso_day_of_week
    ).toBe(7);
  });

  it("snapshots four KRIs per active site month, cumulative and never decreasing", () => {
    const kri = rows("gold.fct_kri_snapshot");
    expect(new Set(kri.map((r) => r.kri_id))).toEqual(
      new Set([
        "query-rate",
        "missed-visit-rate",
        "important-deviation-rate",
        "entry-lag-days",
      ])
    );
    const site = new Map(
      rows("gold.dim_site").map((s) => [s.site_key, s.site_id])
    );
    const series = new Map<string, WarehouseRow[]>();
    for (const row of kri) {
      const id = `${String(site.get(row.site_key))}|${String(row.kri_id)}`;
      series.set(id, [...(series.get(id) ?? []), row]);
    }
    for (const [id, points] of series) {
      for (let i = 1; i < points.length; i += 1) {
        expect(Number(points[i].denominator), id).toBeGreaterThanOrEqual(
          Number(points[i - 1].denominator)
        );
        expect(Number(points[i].snapshot_date_key)).toBeGreaterThan(
          Number(points[i - 1].snapshot_date_key)
        );
      }
    }
    expect(
      kri.every((r) =>
        r.denominator === 0
          ? r.kri_value === null
          : r.kri_value ===
            Math.round((Number(r.numerator) / Number(r.denominator)) * 10_000) /
              10_000
      )
    ).toBe(true);
    expect(kri.every((r) => Number(r.snapshot_date_key) <= 20260930)).toBe(
      true
    );
  });
});

describe("buildWarehouse: SCD type 2 on dim_site", () => {
  const sites = rows("gold.dim_site");
  const changed = sites.find(
    (s) =>
      s.version_number !== 1 &&
      String(s.principal_investigator_id).endsWith("-2")
  );

  it("opens a new version on each status and principal investigator change", () => {
    expect(new Set(sites.map((s) => s.site_id)).size).toBe(
      portfolio.sites.length
    );
    const changes = sites.filter((s) =>
      String(s.principal_investigator_id).endsWith("-2")
    );
    const changedSites = new Set(changes.map((s) => s.site_id));
    expect(changedSites.size).toBeGreaterThan(0);
    expect(changedSites.size).toBe(
      siteStaffFeed(portfolio).filter((a) => a.investigatorId.endsWith("-2"))
        .length
    );
    expect(sites.filter((s) => s.is_current).length).toBe(
      portfolio.sites.length
    );
    expect(sites.filter((s) => s.site_status === "closed").length).toBe(
      new Set(
        portfolio.feeds.ctms.monitoringVisits
          .filter((m) => m.type === "COV")
          .map((m) => m.siteId)
      ).size
    );
  });

  it("closes the old version the day the new principal investigator starts", () => {
    expect(changed).toBeDefined();
    const versions = sites
      .filter((s) => s.site_id === changed?.site_id)
      .sort((a, b) => Number(a.version_number) - Number(b.version_number));
    const index = versions.findIndex((v) => v.site_key === changed?.site_key);
    const before = versions[index - 1];
    expect(before.valid_to).toBe(changed?.valid_from);
    expect(String(before.principal_investigator_id)).toMatch(/-1$/);
    expect(before.is_current).toBe(false);
    expect(versions[versions.length - 1].valid_to).toBe(SCD2_OPEN_END);
    const assignment = siteStaffFeed(portfolio).find(
      (a) => a.siteId === changed?.site_id && a.investigatorId.endsWith("-2")
    );
    expect(assignment?.startOn).toBe(changed?.valid_from);
  });

  it("joins each fact to the version in force on the fact's date", () => {
    const siteOf = new Map(sites.map((s) => [s.site_key, s]));
    const visitSite = new Map(
      portfolio.feeds.edc.visits.map((v) => [v.visitId, v.siteId])
    );
    let before = 0;
    let after = 0;
    for (const visit of rows("gold.fct_visit")) {
      const day = dateOfKey(visit.visit_date_key ?? visit.planned_date_key);
      const siteId = String(visitSite.get(String(visit.visit_id)));
      const expected = siteVersionOn(warehouse, siteId, day);
      expect(siteOf.get(visit.site_key)?.site_key).toBe(expected?.site_key);
      if (siteId === changed?.site_id) {
        if (day < String(changed.valid_from)) before += 1;
        else after += 1;
      }
    }
    expect(before).toBeGreaterThan(0);
    expect(after).toBeGreaterThan(0);
    const querySite = new Map(
      portfolio.feeds.edc.queries.map((q) => [q.queryId, q.siteId])
    );
    for (const query of rows("gold.fct_query")) {
      const expected = siteVersionOn(
        warehouse,
        String(querySite.get(String(query.query_id))),
        dateOfKey(query.opened_date_key)
      );
      expect(query.site_key).toBe(expected?.site_key);
    }
  });

  it("creates a new row for a principal investigator change given as a fixture", () => {
    const site = portfolio.sites.find(
      (s) =>
        !siteStaffFeed(portfolio).some(
          (a) => a.siteId === s.id && a.investigatorId.endsWith("-2")
        ) &&
        portfolio.feeds.edc.visits.filter((v) => v.siteId === s.id).length > 20
    );
    if (site === undefined) throw new Error("no fixture site");
    const visitDates = portfolio.feeds.edc.visits
      .filter((v) => v.siteId === site.id && v.visitDate !== null)
      .map((v) => String(v.visitDate))
      .sort();
    const changeOn = visitDates[Math.floor(visitDates.length / 2)];
    const staff = siteStaffFeed(portfolio).flatMap((a) =>
      a.siteId !== site.id
        ? [a]
        : [
            { ...a, endOn: "2000-01-01" },
            {
              ...a,
              assignmentId: `${site.id}-FIXTURE`,
              investigatorId: "INV-FIXTURE",
              startOn: changeOn,
              endOn: null,
            },
          ]
    );
    const w = buildWarehouse(portfolio, { siteStaff: staff });
    expect(checkWarehouse(WAREHOUSE_SCHEMA, w)).toEqual([]);
    expect(rows("gold.dim_site", w).length).toBe(sites.length + 1);
    const versions = rows("gold.dim_site", w).filter(
      (v) => v.site_id === site.id
    );
    const fresh = versions.find(
      (v) => v.principal_investigator_id === "INV-FIXTURE"
    );
    expect(fresh).toMatchObject({ valid_from: changeOn });
    const previous = versions.find(
      (v) => v.version_number === Number(fresh?.version_number) - 1
    );
    expect(previous).toMatchObject({ valid_to: changeOn, is_current: false });
    expect(previous?.principal_investigator_id).not.toBe("INV-FIXTURE");

    const piOf = new Map(
      rows("gold.dim_site", w).map((v) => [
        v.site_key,
        v.principal_investigator_id,
      ])
    );
    const visitDateOf = new Map(
      portfolio.feeds.edc.visits.map((v) => [v.visitId, v.visitDate])
    );
    let joined = 0;
    for (const visit of rows("gold.fct_visit", w)) {
      const date = visitDateOf.get(String(visit.visit_id));
      if (
        !portfolio.feeds.edc.visits.some(
          (v) => v.visitId === visit.visit_id && v.siteId === site.id
        ) ||
        date === null ||
        date === undefined
      )
        continue;
      expect(piOf.get(visit.site_key), String(visit.visit_id)).toBe(
        date < changeOn ? previous?.principal_investigator_id : "INV-FIXTURE"
      );
      joined += 1;
    }
    expect(joined).toBe(visitDates.length);
  });
});

describe("silver layer", () => {
  it("conforms keys, ISO 8601 dates and UTC timestamps", () => {
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
    for (const t of WAREHOUSE_SCHEMA.tables.filter(
      (x) => x.layer === "silver"
    )) {
      for (const row of rows(`silver.${t.name}`)) {
        for (const column of t.columns) {
          const value = row[column.name];
          if (value === null) continue;
          if (column.type === "date") expect(value).toMatch(isoDate);
          if (column.type === "timestamp") expect(value).toMatch(utc);
        }
      }
    }
    expect(
      rows("silver.site").every((s) =>
        /^[A-Z]{2}$/.test(String(s.country_code))
      )
    ).toBe(true);
    expect(rows("silver.finance_line")[0]).toMatchObject({
      fiscal_quarter: portfolio.feeds.finance[0].period,
      quarter_start_on: expect.stringMatching(/^\d{4}-(01|04|07|10)-01$/),
    });
  });

  it("keeps one row per key, the later delivery winning", () => {
    const { edc } = portfolio.feeds;
    const resent = { ...edc.subjects[0], status: "discontinued" as const };
    const duplicated: Portfolio = {
      ...portfolio,
      feeds: {
        ...portfolio.feeds,
        edc: { ...edc, subjects: [...edc.subjects, resent] },
      },
    };
    const w = buildWarehouse(duplicated);
    const subjects = rows("silver.edc_subject", w);
    expect(subjects).toHaveLength(edc.subjects.length);
    expect(subjects[0]).toMatchObject({
      subject_id: resent.subjectId,
      subject_status: "discontinued",
    });
    expect(checkWarehouse(WAREHOUSE_SCHEMA, w)).toEqual([]);
  });

  it("rejects a malformed quarter or timestamp", () => {
    const badQuarter: Portfolio = {
      ...portfolio,
      feeds: {
        ...portfolio.feeds,
        finance: [{ ...portfolio.feeds.finance[0], period: "2026-Q5" }],
      },
    };
    expect(() => buildWarehouse(badQuarter)).toThrow(RangeError);
    const { edc } = portfolio.feeds;
    const badTime: Portfolio = {
      ...portfolio,
      feeds: {
        ...portfolio.feeds,
        edc: {
          ...edc,
          queries: [{ ...edc.queries[0], openedAt: "yesterday" }],
        },
      },
    };
    expect(() => buildWarehouse(badTime)).toThrow(RangeError);
  });

  it("normalises a timestamp with an offset to UTC", () => {
    const { edc } = portfolio.feeds;
    const offset: Portfolio = {
      ...portfolio,
      feeds: {
        ...portfolio.feeds,
        edc: {
          ...edc,
          queries: [
            { ...edc.queries[0], openedAt: "2025-04-16T13:25:00+02:00" },
          ],
        },
      },
    };
    expect(rows("silver.edc_query", buildWarehouse(offset))[0].opened_at).toBe(
      "2025-04-16T11:25:00Z"
    );
  });
});

describe("checkWarehouse", () => {
  const rules = (w: Warehouse) =>
    checkWarehouse(WAREHOUSE_SCHEMA, w).map((f) => f.rule);

  it("finds a duplicate at a fact's grain and a duplicate natural key", () => {
    expect(rules(withRows("gold.fct_visit", (r) => [...r, r[0]]))).toContain(
      "grain"
    );
    expect(
      rules(
        withRows("gold.dim_study", (r) => [...r, { ...r[0], study_key: 99 }])
      )
    ).toContain("unique");
  });

  it("finds a foreign key with no dimension row", () => {
    expect(
      rules(
        withRows("gold.fct_query", (r) => [
          { ...r[0], study_key: 999 },
          ...r.slice(1),
        ])
      )
    ).toEqual(["foreign-key"]);
  });

  it("finds wrong types, nulls, lengths and unknown or missing columns", () => {
    const [first, ...rest] = rows("silver.site");
    const edits: [WarehouseRow, string][] = [
      [{ ...first, planned_enrollment: "nine" }, "type"],
      [{ ...first, planned_enrollment: 1.5 }, "type"],
      [{ ...first, activated_on: "2025-02-30" }, "type"],
      [{ ...first, site_name: null }, "nullability"],
      [{ ...first, country_code: "USA" }, "length"],
      [{ ...first, extra: 1 }, "column"],
    ];
    for (const [row, rule] of edits) {
      expect(
        rules(withRows("silver.site", () => [row, ...rest])),
        rule
      ).toContain(rule);
    }
    const { site_name: _dropped, ...missing } = first;
    void _dropped;
    expect(rules(withRows("silver.site", () => [missing, ...rest]))).toContain(
      "column"
    );
    const [query, ...queries] = rows("silver.edc_query");
    expect(
      rules(
        withRows("silver.edc_query", () => [
          { ...query, opened_at: "2025-04-16 11:25" },
          ...queries,
        ])
      )
    ).toContain("type");
    const [kri, ...kris] = rows("gold.fct_kri_snapshot");
    expect(
      rules(
        withRows("gold.fct_kri_snapshot", () => [
          { ...kri, kri_value: 0.12345 },
          ...kris,
        ])
      )
    ).toContain("type");
    const [flag, ...flags] = rows("gold.dim_date");
    expect(
      rules(
        withRows("gold.dim_date", () => [
          { ...flag, is_month_end: "no" },
          ...flags,
        ])
      )
    ).toContain("type");
  });

  it("finds missing and unknown tables", () => {
    const { ["gold.fct_spend"]: _spend, ...others } = warehouse.tables;
    void _spend;
    expect(rules({ ...warehouse, tables: others })).toEqual(["table"]);
    expect(
      rules({ ...warehouse, tables: { ...warehouse.tables, "gold.extra": [] } })
    ).toEqual(["table"]);
  });

  it("finds broken SCD type 2 histories", () => {
    const sites = rows("gold.dim_site");
    const multi = sites.findIndex(
      (s, i) => sites[i + 1]?.site_id === s.site_id
    );
    const breaks: ((r: WarehouseRow) => WarehouseRow)[] = [
      (r) => ({ ...r, valid_to: "2000-01-01" }),
      (r) => ({ ...r, is_current: true }),
      (r) => ({ ...r, version_number: 7 }),
    ];
    for (const edit of breaks) {
      const w = withRows("gold.dim_site", (r) =>
        r.map((row, i) => (i === multi ? edit(row) : row))
      );
      expect(rules(w)).toContain("scd2");
    }
    const lastOf = sites.findIndex(
      (s, i) => s.is_current && sites[i - 1]?.site_id === s.site_id
    );
    const open = withRows("gold.dim_site", (r) =>
      r.map((row, i) =>
        i === lastOf ? { ...row, valid_to: "2030-01-01" } : row
      )
    );
    expect(rules(open)).toContain("scd2");
    const same = withRows("gold.dim_site", (r) =>
      r.map((row, i) =>
        i === multi + 1
          ? {
              ...row,
              site_status: r[multi].site_status,
              principal_investigator_id: r[multi].principal_investigator_id,
            }
          : row
      )
    );
    expect(rules(same)).toContain("scd2");
  });
});

describe("lineage", () => {
  const edges = warehouseLineage(WAREHOUSE_SCHEMA);
  const columns = new Set(
    WAREHOUSE_SCHEMA.tables.flatMap((t) =>
      t.columns.map((c) => `${t.layer}.${t.name}.${c.name}`)
    )
  );
  const bronze: Record<string, object | undefined> = {
    "bronze.portfolio.studies": portfolio.studies[0],
    "bronze.portfolio.sites": portfolio.sites[0],
    "bronze.portfolio.vendors": portfolio.vendors[0],
    "bronze.edc.subjects": portfolio.feeds.edc.subjects[0],
    "bronze.edc.visits": portfolio.feeds.edc.visits[0],
    "bronze.edc.queries": portfolio.feeds.edc.queries[0],
    "bronze.edc.adverseEvents": portfolio.feeds.edc.adverseEvents[0],
    "bronze.edc.vitalSigns": portfolio.feeds.edc.vitalSigns[0],
    "bronze.ctms.milestones": portfolio.feeds.ctms.milestones[0],
    "bronze.ctms.monitoringPlans": portfolio.feeds.ctms.monitoringPlans[0],
    "bronze.ctms.monitoringVisits": portfolio.feeds.ctms.monitoringVisits[0],
    "bronze.ctms.deviations": portfolio.feeds.ctms.deviations[0],
    "bronze.ctms.siteStaff": siteStaffFeed(portfolio)[0],
    "bronze.irt.randomizations": portfolio.feeds.irt.randomizations[0],
    "bronze.irt.kits": portfolio.feeds.irt.kits[0],
    "bronze.etmf": portfolio.feeds.etmf[0],
    "bronze.finance": portfolio.feeds.finance[0],
    "bronze.financePlan": portfolio.feeds.financePlan[0],
    "bronze.cec": portfolio.feeds.cec[0],
  };

  it("passes checkLayerFlow on every silver and gold edge", () => {
    expect(edges.length).toBeGreaterThan(300);
    expect(edges.map(checkLayerFlow).filter((f) => f !== null)).toEqual([]);
    expect(
      checkLayerFlow({
        from: {
          productId: "gold.fct_visit",
          layer: "gold",
          column: "visit_id",
        },
        to: {
          productId: "silver.edc_visit",
          layer: "silver",
          column: "visit_id",
        },
        transformation: "identity",
      })
    ).not.toBeNull();
  });

  it("names only columns that exist, and feeds silver from bronze and gold from silver", () => {
    for (const edge of edges) {
      const ref = `${edge.from.productId}.${edge.from.column}`;
      if (edge.from.layer === "bronze") {
        const sample = bronze[edge.from.productId];
        expect(sample, ref).toBeDefined();
        expect(Object.keys(sample ?? {}), ref).toContain(edge.from.column);
        expect(edge.to.layer, ref).toBe("silver");
      } else {
        expect(columns.has(ref), ref).toBe(true);
        expect(edge.to.layer, ref).toBe("gold");
      }
    }
  });

  it("traces every silver column to bronze and every foreign key to its dimension", () => {
    for (const t of WAREHOUSE_SCHEMA.tables) {
      for (const column of t.columns) {
        if (t.layer === "silver") {
          expect(
            column.lineage.length,
            `${t.name}.${column.name}`
          ).toBeGreaterThan(0);
        }
        if (
          column.references !== null &&
          column.references.table !== "gold.dim_date"
        ) {
          expect(column.lineage).toContain(
            `${column.references.table}.${column.references.column}`
          );
        }
      }
    }
  });
});

/** Removes string literals so their content cannot fool a structural check. */
function code(sql: string): string {
  return sql
    .split("\n")
    .filter((line) => !line.startsWith("--"))
    .join("\n")
    .replace(/N?'(?:[^']|'')*'/g, "''");
}

describe("DDL", () => {
  const dialects: SqlDialect[] = ["duckdb", "postgres", "tsql"];

  it.each(dialects)("matches the %s golden file", (dialect) => {
    expect(emitDdl(WAREHOUSE_SCHEMA, dialect)).toBe(
      readFileSync(path.join(root, WAREHOUSE_DDL_GOLDENS[dialect]), "utf8")
    );
  });

  it.each(dialects)(
    "%s DDL is balanced and declares every table and key",
    (dialect) => {
      const ddl = emitDdl(WAREHOUSE_SCHEMA, dialect);
      const body = code(ddl);
      let depth = 0;
      for (const char of body) {
        if (char === "(") depth += 1;
        if (char === ")") depth -= 1;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
      expect(depth).toBe(0);
      const q = (id: string) => (dialect === "tsql" ? `[${id}]` : `"${id}"`);
      for (const t of WAREHOUSE_SCHEMA.tables) {
        expect(body).toContain(`CREATE TABLE ${q(t.layer)}.${q(t.name)} (`);
        expect(body).toContain(
          `PRIMARY KEY (${t.primaryKey.map(q).join(", ")})`
        );
        for (const column of t.columns) {
          if (column.references === null) continue;
          const [layer, name] = column.references.table.split(".");
          expect(body).toContain(
            `FOREIGN KEY (${q(column.name)}) REFERENCES ${q(layer)}.${q(name)} (${q(column.references.column)})`
          );
        }
      }
      const names = [...body.matchAll(/CONSTRAINT [["]([^\]"]+)[\]"]/g)].map(
        (m) => m[1]
      );
      expect(new Set(names).size).toBe(names.length);
      expect(names.every((n) => n.length <= 63)).toBe(true);
      const columnCount = WAREHOUSE_SCHEMA.tables.reduce(
        (n, t) => n + t.columns.length,
        0
      );
      const described =
        dialect === "tsql"
          ? ddl.match(/sp_addextendedproperty/g)?.length
          : ddl.match(/^COMMENT ON (?:TABLE|COLUMN) /gm)?.length;
      expect(described).toBe(WAREHOUSE_SCHEMA.tables.length + columnCount);
      expect(ddl.startsWith("-- Clinical Data Platform warehouse")).toBe(true);
      expect(ddl).toContain(SYNTHETIC_DATA_NOTICE);
    }
  );

  it("uses each dialect's quoting and types", () => {
    const duck = code(emitDdl(WAREHOUSE_SCHEMA, "duckdb"));
    const pg = code(emitDdl(WAREHOUSE_SCHEMA, "postgres"));
    const tsql = code(emitDdl(WAREHOUSE_SCHEMA, "tsql"));
    for (const sql of [duck, pg]) {
      expect(sql).not.toMatch(/\[\w+\]/);
      expect(sql).toContain('"gold"."dim_site"');
      expect(sql).toContain("TIMESTAMPTZ");
    }
    expect(duck).toMatch(/"study_id"\s+VARCHAR NOT NULL/);
    expect(duck).toContain("DECIMAL(12, 4)");
    expect(pg).toMatch(/"study_id"\s+VARCHAR\(64\) NOT NULL/);
    expect(pg).toContain("NUMERIC(12, 4)");
    expect(tsql).not.toMatch(/"\w+"/);
    expect(tsql).toContain("[gold].[dim_site]");
    expect(tsql).toMatch(/\[is_current\]\s+BIT NOT NULL/);
    expect(tsql).toMatch(/\[opened_at\]\s+DATETIMEOFFSET\(0\) NOT NULL/);
    expect(tsql).toMatch(/\[study_id\]\s+NVARCHAR\(64\) NOT NULL/);
    expect(tsql.match(/^GO$/gm)?.length).toBe(
      WAREHOUSE_SCHEMA.tables.length + 1
    );
  });

  it("escapes quotes in identifiers and descriptions", () => {
    const base = table("gold.dim_country");
    const odd: WarehouseSchema = {
      version: "0.0.0",
      tables: [
        {
          ...base,
          name: 'odd"name]',
          description: "It's a test.",
          columns: [
            { ...base.columns[0], name: 'col"]', description: "O'Brien" },
          ],
          primaryKey: ['col"]'],
          uniqueKeys: [],
        },
      ],
    };
    const duck = emitDdl(odd, "duckdb");
    expect(duck).toContain('"odd""name]"');
    expect(duck).toContain("'O''Brien'");
    const tsql = emitDdl(odd, "tsql");
    expect(tsql).toContain('[odd"name]]]');
    expect(tsql).toContain("N'O''Brien'");
  });
});

describe("exports, ERD and reference page", () => {
  const { files, manifest } = exportWarehouse(WAREHOUSE_SCHEMA, warehouse);

  it("writes one CSV per table with a header, and a typed manifest", () => {
    expect(files.map((f) => f.table)).toEqual(Object.keys(warehouse.tables));
    for (const file of files) {
      const t = table(file.table);
      const lines = file.text.trimEnd().split("\n");
      expect(lines[0]).toBe(t.columns.map((c) => c.name).join(","));
      expect(lines.length - 1).toBe(file.rowCount);
      expect(file.rowCount).toBe(rows(file.table).length);
      expect(file.path).toBe(`${t.layer}/${t.name}.csv`);
    }
    expect(manifest).toMatchObject({
      notice: SYNTHETIC_DATA_NOTICE,
      schemaVersion: WAREHOUSE_SCHEMA.version,
      portfolioId: portfolio.id,
    });
    const site = manifest.tables.find((t) => t.table === "gold.dim_site");
    expect(site?.columns.find((c) => c.name === "site_key")?.parquet).toEqual({
      physicalType: "INT32",
      logicalType: "INT(32, true)",
      repetition: "REQUIRED",
    });
    expect(
      site?.columns.find((c) => c.name === "activated_on")?.parquet
    ).toEqual({
      physicalType: "INT32",
      logicalType: "DATE",
      repetition: "OPTIONAL",
    });
    const kinds = new Set(
      manifest.tables.flatMap((t) =>
        t.columns.map(
          (c) => `${c.type}:${c.parquet.physicalType}:${c.parquet.logicalType}`
        )
      )
    );
    expect(kinds).toEqual(
      new Set([
        "string:BYTE_ARRAY:STRING",
        "integer:INT32:INT(32, true)",
        "decimal:INT64:DECIMAL(12, 4)",
        "decimal:INT64:DECIMAL(6, 1)",
        "decimal:INT64:DECIMAL(5, 1)",
        "boolean:BOOLEAN:null",
        "date:INT32:DATE",
        "timestamp:INT64:TIMESTAMP(isAdjustedToUTC=true, unit=MILLIS)",
      ])
    );
  });

  it("quotes text that needs it and leaves null empty", () => {
    const base = table("silver.vendor");
    const tiny: WarehouseSchema = { version: "0.0.0", tables: [base] };
    const {
      files: [file],
    } = exportWarehouse(tiny, {
      ...warehouse,
      tables: {
        "silver.vendor": [
          {
            vendor_id: "A",
            vendor_name: 'Comma, "quoted"',
            service: "",
            is_synthetic: true,
          },
          {
            vendor_id: "B",
            vendor_name: " padded",
            service: "Multi\nline",
            is_synthetic: false,
          },
          {
            vendor_id: "C",
            vendor_name: "Plain",
            service: null,
            is_synthetic: true,
          },
        ],
      },
    });
    expect(file.text.split("\n").slice(1).join("\n")).toBe(
      'A,"Comma, ""quoted""","",true\nB," padded","Multi\nline",false\nC,Plain,,true\n'
    );
    const kri = exportWarehouse(
      { version: "0.0.0", tables: [table("gold.fct_kri_snapshot")] },
      warehouse
    ).files[0];
    expect(kri.text.split("\n")[1]).toMatch(/,\d+\.\d{4},true$|,,true$/);
  });

  it("keeps the checked-in DDL goldens and reference page in step with the schema", () => {
    for (const [file, contents] of Object.entries(warehouseArtifacts())) {
      expect(readFileSync(path.join(root, file), "utf8"), file).toBe(contents);
    }
  });

  it("draws every gold table and foreign key in the ERD", () => {
    const erd = renderWarehouseErd(WAREHOUSE_SCHEMA);
    expect(erd.startsWith("erDiagram\n")).toBe(true);
    const gold = WAREHOUSE_SCHEMA.tables.filter((t) => t.layer === "gold");
    for (const t of gold) {
      expect(erd).toContain(`  ${t.name} {`);
      for (const c of t.columns) {
        if (c.references === null) continue;
        const target = c.references.table.split(".")[1];
        expect(erd).toContain(
          `  ${target} ${c.nullable ? "|o" : "||"}--o{ ${t.name} : "${c.name}"`
        );
      }
    }
    expect(erd).not.toMatch(/silver/);
    const page = readFileSync(
      path.join(root, WAREHOUSE_REFERENCE_PAGE),
      "utf8"
    );
    expect(page).toContain("```mermaid\n" + erd + "\n```");
    expect(renderWarehouseReference(WAREHOUSE_SCHEMA)).toBe(page);
  });

  it("makes no compliance or validation claim in any generated text", () => {
    const texts = [
      ...Object.values(warehouseArtifacts()),
      ...WAREHOUSE_SCHEMA.tables.flatMap((t) => [
        t.description,
        t.grain,
        ...t.columns.map((c) => c.description),
      ]),
    ];
    for (const text of texts) {
      expect(checkRegulatoryWording(text)).toEqual([]);
      expect(findClinicalClaims(text)).toEqual([]);
    }
  });
});
