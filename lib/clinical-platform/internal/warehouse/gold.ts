/**
 * The gold layer: a Kimball star schema built from the silver layer, with
 * conformed dimensions, surrogate keys, SCD type 2 on `dim_site`, and facts
 * at a declared grain.
 */
import type {
  MilestoneKind,
  Scd2Change,
  WarehouseRow,
  WarehouseValue,
} from "../../types";
import {
  addDays,
  dayNumber,
  daysBetween,
  isoDay,
  isoWeekday,
  monthEnd,
} from "./dates";
import { buildScd2Versions, versionOn } from "./scd2";
import type { SilverTables } from "./silver";

/** Gold rows per table name (without the `gold.` prefix). */
export type GoldTables = Readonly<Record<string, readonly WarehouseRow[]>>;

/** Countries the portfolio can place sites in, with their region. */
const COUNTRIES: Readonly<Record<string, { name: string; region: string }>> = {
  AU: { name: "Australia", region: "Asia-Pacific" },
  BR: { name: "Brazil", region: "Latin America" },
  CA: { name: "Canada", region: "North America" },
  DE: { name: "Germany", region: "Europe" },
  ES: { name: "Spain", region: "Europe" },
  FR: { name: "France", region: "Europe" },
  GB: { name: "United Kingdom", region: "Europe" },
  IT: { name: "Italy", region: "Europe" },
  JP: { name: "Japan", region: "Asia-Pacific" },
  NL: { name: "Netherlands", region: "Europe" },
  PL: { name: "Poland", region: "Europe" },
  US: { name: "United States", region: "North America" },
};

/** Milestone kinds in lifecycle order, with a name that suits drug and device studies. */
const MILESTONES: readonly (readonly [MilestoneKind, string])[] = [
  ["protocol-final", "Protocol final"],
  ["regulatory-approval", "Regulatory approval"],
  ["first-site-activated", "First site activated"],
  ["first-subject-in", "First subject in"],
  ["fifty-percent-enrolled", "50% enrolled"],
  ["last-subject-in", "Last subject in"],
  ["last-subject-last-visit", "Last subject last visit"],
  ["database-lock", "Database lock"],
  ["final-report", "Final report"],
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Key of the `dim_vendor` member for spend with no vendor. */
export const NOT_APPLICABLE_VENDOR_KEY = 0;

/** The key risk indicators `fct_kri_snapshot` records, in row order. */
export const KRI_IDS = [
  "query-rate",
  "missed-visit-rate",
  "important-deviation-rate",
  "entry-lag-days",
] as const;

/** Smart date key `YYYYMMDD` of an ISO 8601 date. */
export function dateKey(iso: string): number {
  return Number(iso.slice(0, 10).replaceAll("-", ""));
}

function minutesBetween(from: string, to: string | null): number | null {
  if (to === null) return null;
  return Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
}

/** Splits a whole amount into three whole parts that sum to it, larger parts first. */
function splitInThree(amount: number): [number, number, number] {
  const base = Math.floor(amount / 3);
  const rest = amount - base * 3;
  return [base + (rest > 0 ? 1 : 0), base + (rest > 1 ? 1 : 0), base];
}

function str(row: WarehouseRow, column: string): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new TypeError(`expected text in ${column}, got ${String(value)}`);
  }
  return value;
}

function optStr(row: WarehouseRow, column: string): string | null {
  const value = row[column];
  return typeof value === "string" ? value : null;
}

function num(row: WarehouseRow, column: string): number {
  const value = row[column];
  if (typeof value !== "number") {
    throw new TypeError(`expected a number in ${column}, got ${String(value)}`);
  }
  return value;
}

function optNum(row: WarehouseRow, column: string): number | null {
  const value = row[column];
  return typeof value === "number" ? value : null;
}

/** Looks a natural key up in a dimension's key map, or throws. */
function lookup<K>(
  map: ReadonlyMap<K, number>,
  value: K,
  what: string
): number {
  const found = map.get(value);
  if (found === undefined) throw new Error(`no ${what} for ${String(value)}`);
  return found;
}

/** Ratio to four decimal places, or `null` for a zero denominator. */
function ratio(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

/**
 * Builds the site dimension's versions from the study start, the activation
 * date, the principal investigator assignments and the close-out visit.
 */
function siteVersions(silver: SilverTables) {
  const studyStart = new Map(
    silver.study.map((s) => [str(s, "study_id"), str(s, "start_on")])
  );
  const closeOn = new Map<string, string>();
  for (const visit of silver.ctms_monitoring_visit) {
    if (visit.visit_type !== "COV") continue;
    const site = str(visit, "site_id");
    const day = str(visit, "visit_date");
    const known = closeOn.get(site);
    if (known === undefined || day < known) closeOn.set(site, day);
  }
  const staffBySite = new Map<string, WarehouseRow[]>();
  for (const row of silver.ctms_site_staff) {
    if (row.staff_role !== "principal-investigator") continue;
    const site = str(row, "site_id");
    staffBySite.set(site, [...(staffBySite.get(site) ?? []), row]);
  }

  const rows: WarehouseRow[] = [];
  const bySite = new Map<
    string,
    { key: number; validFrom: string; validTo: string }[]
  >();
  for (const site of silver.site) {
    const siteId = str(site, "site_id");
    const first = studyStart.get(str(site, "study_id"));
    if (first === undefined) throw new Error(`no study for site ${siteId}`);
    const clamp = (day: string) => (day < first ? first : day);
    const staff = [...(staffBySite.get(siteId) ?? [])].sort((a, b) => {
      const [x, y] = [str(a, "start_on"), str(b, "start_on")];
      return x < y ? -1 : x > y ? 1 : 0;
    });
    const changes: Scd2Change[] = staff.map((row) => ({
      effectiveOn: clamp(str(row, "start_on")),
      attributes: { principal_investigator_id: str(row, "investigator_id") },
    }));
    const activated = optStr(site, "activated_on");
    if (activated !== null) {
      changes.push({
        effectiveOn: clamp(activated),
        attributes: { site_status: "active" },
      });
    }
    const closed = closeOn.get(siteId);
    if (closed !== undefined) {
      changes.push({
        effectiveOn: clamp(closed),
        attributes: { site_status: "closed" },
      });
    }
    const versions = buildScd2Versions(
      {
        effectiveOn: first,
        attributes: {
          site_status: "start-up",
          principal_investigator_id: null,
        },
      },
      changes
    );
    const keyed = versions.map((version) => {
      const siteKey = rows.length + 1;
      rows.push({
        site_key: siteKey,
        site_id: siteId,
        version_number: version.version,
        study_id: site.study_id,
        site_number: site.site_number,
        site_name: site.site_name,
        country_code: site.country_code,
        planned_enrollment: site.planned_enrollment,
        activated_on: site.activated_on,
        site_status: version.attributes.site_status,
        principal_investigator_id: version.attributes.principal_investigator_id,
        valid_from: version.validFrom,
        valid_to: version.validTo,
        is_current: version.isCurrent,
        is_synthetic: site.is_synthetic,
      });
      return {
        key: siteKey,
        validFrom: version.validFrom,
        validTo: version.validTo,
      };
    });
    bySite.set(siteId, keyed);
  }
  return { rows, bySite, closeOn };
}

/** The terms of one monitoring plan, with its surrogate key. */
interface PlanTerms {
  readonly key: number;
  readonly effectiveOn: string;
  readonly intervalDays: number;
  readonly windowDays: number;
  readonly reportDueDays: number;
}

/**
 * Indexes the monitoring plans by study, so a visit can be measured against
 * the plan version in force on its date.
 */
function monitoringPlans(rows: readonly WarehouseRow[]) {
  const byStudy = new Map<string, PlanTerms[]>();
  rows.forEach((row, index) => {
    const study = str(row, "study_id");
    const terms: PlanTerms = {
      key: index + 1,
      effectiveOn: str(row, "effective_on"),
      intervalDays: num(row, "interim_interval_days"),
      windowDays: num(row, "visit_window_days"),
      reportDueDays: num(row, "report_due_days"),
    };
    const versions = [...(byStudy.get(study) ?? []), terms];
    versions.sort((a, b) =>
      a.effectiveOn < b.effectiveOn ? -1 : a.effectiveOn > b.effectiveOn ? 1 : 0
    );
    byStudy.set(study, versions);
  });
  return {
    /** The latest plan version that took effect on or before the day. */
    inForce(study: string, day: string): PlanTerms {
      const versions = byStudy.get(study) ?? [];
      const found = versions.filter((v) => v.effectiveOn <= day).at(-1);
      if (found === undefined) {
        throw new Error(`no monitoring plan of ${study} in force on ${day}`);
      }
      return found;
    },
  };
}

/** One interim visit the monitoring plan schedules at a site. */
interface PlannedVisit {
  readonly id: string;
  readonly planKey: number;
  readonly studyId: string;
  readonly siteId: string;
  readonly plannedOn: string;
  readonly dueOn: string;
  readonly visitId: string | null;
  readonly visitedOn: string | null;
}

/**
 * The interim visits each site's monitoring plan schedules. The schedule
 * rolls: the next interim visit is planned the plan's interval after the
 * previous visit actually made, starting from the initiation visit, and is
 * on time until the visit window closes. Each interim visit made meets one
 * planned visit. A site still being monitored, one with no close-out visit
 * in a study whose last subject has not had its last visit, also has its
 * next visit outstanding.
 */
function plannedMonitoringVisits(
  silver: SilverTables,
  closeOn: ReadonlyMap<string, string>,
  plans: ReturnType<typeof monitoringPlans>
): PlannedVisit[] {
  const finished = new Set(
    silver.ctms_milestone
      .filter(
        (m) =>
          m.milestone_kind === "last-subject-last-visit" &&
          optStr(m, "actual_on") !== null
      )
      .map((m) => str(m, "study_id"))
  );
  const bySite = new Map<string, WarehouseRow[]>();
  for (const visit of silver.ctms_monitoring_visit) {
    const site = str(visit, "site_id");
    bySite.set(site, [...(bySite.get(site) ?? []), visit]);
  }
  const planned: PlannedVisit[] = [];
  for (const [siteId, visits] of bySite) {
    const ordered = [...visits].sort((a, b) => {
      const [x, y] = [str(a, "visit_date"), str(b, "visit_date")];
      return x < y ? -1 : x > y ? 1 : 0;
    });
    const initiation = ordered.find((v) => v.visit_type === "SIV");
    if (initiation === undefined) continue;
    const studyId = str(initiation, "study_id");
    let previous = str(initiation, "visit_date");
    let sequence = 0;
    const schedule = (visit: WarehouseRow | null) => {
      const plan = plans.inForce(studyId, previous);
      const plannedOn = addDays(previous, plan.intervalDays);
      sequence += 1;
      planned.push({
        id: `${siteId}-PV${String(sequence).padStart(2, "0")}`,
        planKey: plan.key,
        studyId,
        siteId,
        plannedOn,
        dueOn: addDays(plannedOn, plan.windowDays),
        visitId: visit === null ? null : str(visit, "monitoring_visit_id"),
        visitedOn: visit === null ? null : str(visit, "visit_date"),
      });
      if (visit !== null) previous = str(visit, "visit_date");
    };
    for (const visit of ordered) {
      if (visit.visit_type === "IMV") schedule(visit);
    }
    if (!closeOn.has(siteId) && !finished.has(studyId)) schedule(null);
  }
  return planned;
}

/**
 * Builds the gold layer from de-duplicated silver tables.
 *
 * @param silver - Silver rows per table.
 * @param asOf - ISO 8601 data cut, the last month-end KRI snapshot.
 * @returns Gold rows per table.
 */
export function buildGold(silver: SilverTables, asOf: string): GoldTables {
  const dimStudy = silver.study.map((s, index) => ({
    study_key: index + 1,
    study_id: s.study_id,
    study_title: s.study_title,
    therapeutic_area: s.therapeutic_area,
    product_type: s.product_type,
    phase: s.phase,
    regulatory_path: s.regulatory_path,
    operating_model: s.operating_model,
    cro_vendor_id: s.cro_vendor_id,
    study_status: s.study_status,
    start_on: s.start_on,
    planned_enrollment: s.planned_enrollment,
    is_randomized: s.is_randomized,
    arm_count: s.arm_count,
    has_cec_adjudication: s.has_cec_adjudication,
    study_data_product_id: s.study_data_product_id,
    is_synthetic: s.is_synthetic,
  }));
  const studyKey = new Map(
    dimStudy.map((s) => [String(s.study_id), s.study_key])
  );

  const codes = [
    ...new Set(silver.site.map((s) => str(s, "country_code"))),
  ].sort();
  const dimCountry = codes.map((code, index) => ({
    country_key: index + 1,
    country_code: code,
    country_name: COUNTRIES[code]?.name ?? code,
    region: COUNTRIES[code]?.region ?? "Other",
  }));
  const countryKey = new Map(
    dimCountry.map((c) => [c.country_code, c.country_key])
  );
  const siteCountry = new Map(
    silver.site.map((s) => [
      str(s, "site_id"),
      lookup(countryKey, str(s, "country_code"), "country"),
    ])
  );

  const dimVendor: WarehouseRow[] = [
    {
      vendor_key: NOT_APPLICABLE_VENDOR_KEY,
      vendor_id: "N/A",
      vendor_name: "Not applicable (investigator grants)",
      vendor_service: "Not applicable",
      is_synthetic: true,
    },
    ...silver.vendor.map((v, index) => ({
      vendor_key: index + 1,
      vendor_id: v.vendor_id,
      vendor_name: v.vendor_name,
      vendor_service: v.service,
      is_synthetic: v.is_synthetic,
    })),
  ];
  const vendorKey = new Map(
    silver.vendor.map((v, index) => [str(v, "vendor_id"), index + 1])
  );

  const dimMilestone = MILESTONES.map(([kind, name], index) => ({
    milestone_key: index + 1,
    milestone_kind: kind,
    milestone_name: name,
    milestone_sequence: index + 1,
  }));
  const milestoneKey = new Map<string, number>(
    dimMilestone.map((m) => [m.milestone_kind, m.milestone_key])
  );

  const sites = siteVersions(silver);
  const siteKeyOn = (siteId: string, day: string): number => {
    const version = versionOn(sites.bySite.get(siteId) ?? [], day.slice(0, 10));
    if (version === undefined) {
      throw new Error(`no dim_site version of ${siteId} on ${day}`);
    }
    return version.key;
  };
  const dims = (row: WarehouseRow, day: string) => {
    const siteId = str(row, "site_id");
    return {
      study_key: lookup(studyKey, str(row, "study_id"), "study"),
      site_key: siteKeyOn(siteId, day),
      country_key: lookup(siteCountry, siteId, "site"),
    };
  };

  const days: string[] = [];
  const dk = (iso: string): number => {
    days.push(iso.slice(0, 10));
    return dateKey(iso);
  };
  const optDk = (iso: string | null): number | null =>
    iso === null ? null : dk(iso);

  const fctEnrollment: WarehouseRow[] = [];
  for (const s of silver.edc_subject) {
    const events: [string, string | null][] = [
      ["screened", optStr(s, "screened_on")],
      ["enrolled", optStr(s, "enrolled_on")],
      ["completed", optStr(s, "completed_on")],
      ["discontinued", optStr(s, "discontinued_on")],
    ];
    for (const [eventType, day] of events) {
      if (day === null) continue;
      fctEnrollment.push({
        subject_id: s.subject_id,
        event_type: eventType,
        ...dims(s, day),
        event_date_key: dk(day),
        subject_status: s.subject_status,
        screen_failure_reason: s.screen_failure_reason,
        event_count: 1,
        is_synthetic: s.is_synthetic,
      });
    }
  }

  const planned = new Map(
    silver.planned_visit.map((v) => [
      `${str(v, "study_id")}|${str(v, "planned_visit_id")}`,
      v,
    ])
  );
  const subjects = new Map(
    silver.edc_subject.map((s) => [str(s, "subject_id"), s])
  );
  const plannedDateOf = new Map<string, string>();
  const fctVisit = silver.edc_visit.map((v) => {
    const plan = planned.get(
      `${str(v, "study_id")}|${str(v, "planned_visit_id")}`
    );
    const subject = subjects.get(str(v, "subject_id"));
    if (plan === undefined || subject === undefined) {
      throw new Error(`visit ${String(v.visit_id)} has no plan or subject`);
    }
    const enrolled = optStr(subject, "enrolled_on");
    const plannedDate =
      enrolled === null
        ? str(subject, "screened_on")
        : addDays(enrolled, num(plan, "planned_day"));
    const visitDate = optStr(v, "visit_date");
    const offset = optNum(v, "day_offset");
    const entered = optStr(v, "data_entered_at");
    plannedDateOf.set(str(v, "visit_id"), plannedDate);
    return {
      visit_id: v.visit_id,
      subject_id: v.subject_id,
      planned_visit_id: v.planned_visit_id,
      ...dims(v, visitDate ?? plannedDate),
      visit_date_key: optDk(visitDate),
      planned_date_key: dk(plannedDate),
      visit_status: v.visit_status,
      day_offset: offset,
      is_out_of_window:
        offset !== null && Math.abs(offset) > num(plan, "window_days"),
      entry_lag_days:
        entered !== null && visitDate !== null
          ? daysBetween(visitDate, entered.slice(0, 10))
          : null,
      is_synthetic: v.is_synthetic,
    };
  });

  const fctQuery = silver.edc_query.map((q) => {
    const opened = str(q, "opened_at");
    const answered = optStr(q, "answered_at");
    const closed = optStr(q, "closed_at");
    return {
      query_id: q.query_id,
      visit_id: q.visit_id,
      subject_id: q.subject_id,
      ...dims(q, opened),
      opened_date_key: dk(opened),
      answered_date_key: optDk(answered),
      closed_date_key: optDk(closed),
      queried_field: q.queried_field,
      // The CDASH domain names the form: VS.WEIGHT is on the VS form.
      queried_form: str(q, "queried_field").split(".")[0],
      query_origin: q.query_origin,
      query_status: q.query_status,
      minutes_to_answer: minutesBetween(opened, answered),
      minutes_to_close: minutesBetween(opened, closed),
      is_synthetic: q.is_synthetic,
    };
  });

  const fctDeviation = silver.ctms_deviation.map((d) => {
    const occurred = str(d, "occurred_on");
    const identified = str(d, "identified_on");
    return {
      deviation_id: d.deviation_id,
      subject_id: d.subject_id,
      ...dims(d, occurred),
      occurred_date_key: dk(occurred),
      identified_date_key: dk(identified),
      deviation_category: d.deviation_category,
      importance: d.importance,
      is_important: d.importance === "important",
      days_to_identify: daysBetween(occurred, identified),
      is_synthetic: d.is_synthetic,
    };
  });

  const dimMonitoringPlan = silver.ctms_monitoring_plan.map((p, index) => ({
    monitoring_plan_key: index + 1,
    monitoring_plan_id: p.monitoring_plan_id,
    study_id: p.study_id,
    plan_version: p.plan_version,
    effective_date_key: dk(str(p, "effective_on")),
    interim_interval_days: p.interim_interval_days,
    visit_window_days: p.visit_window_days,
    report_due_days: p.report_due_days,
    is_synthetic: p.is_synthetic,
  }));
  const plans = monitoringPlans(silver.ctms_monitoring_plan);

  const fctMonitoringVisit = silver.ctms_monitoring_visit.map((m) => {
    const visited = str(m, "visit_date");
    const reported = optStr(m, "report_final_on");
    const plan = plans.inForce(str(m, "study_id"), visited);
    return {
      monitoring_visit_id: m.monitoring_visit_id,
      ...dims(m, visited),
      visit_date_key: dk(visited),
      report_final_date_key: optDk(reported),
      monitoring_plan_key: plan.key,
      report_due_date_key: dk(addDays(visited, plan.reportDueDays)),
      visit_type: m.visit_type,
      visit_mode: m.visit_mode,
      sdv_pages_due: m.sdv_pages_due,
      sdv_pages_verified: m.sdv_pages_verified,
      action_items: m.action_items,
      days_to_final_report:
        reported === null ? null : daysBetween(visited, reported),
      is_synthetic: m.is_synthetic,
    };
  });

  const fctPlannedMonitoringVisit = plannedMonitoringVisits(
    silver,
    sites.closeOn,
    plans
  ).map((v) => ({
    planned_visit_id: v.id,
    monitoring_plan_key: v.planKey,
    study_key: lookup(studyKey, v.studyId, "study"),
    site_key: siteKeyOn(v.siteId, v.plannedOn),
    country_key: lookup(siteCountry, v.siteId, "site"),
    planned_date_key: dk(v.plannedOn),
    due_date_key: dk(v.dueOn),
    monitoring_visit_id: v.visitId,
    actual_date_key: optDk(v.visitedOn),
    days_late:
      v.visitedOn === null
        ? null
        : Math.max(0, daysBetween(v.dueOn, v.visitedOn)),
    is_synthetic: true,
  }));

  const fctMilestone = silver.ctms_milestone.map((m) => {
    const plannedOn = str(m, "planned_on");
    const actualOn = optStr(m, "actual_on");
    return {
      study_key: lookup(studyKey, str(m, "study_id"), "study"),
      milestone_key: lookup(
        milestoneKey,
        str(m, "milestone_kind"),
        "milestone"
      ),
      milestone_label: m.milestone_label,
      planned_date_key: dk(plannedOn),
      actual_date_key: optDk(actualOn),
      variance_days:
        actualOn === null ? null : daysBetween(plannedOn, actualOn),
      is_reached: actualOn !== null,
      is_synthetic: m.is_synthetic,
    };
  });

  const spend = new Map<string, Record<string, WarehouseValue>>();
  for (const line of silver.finance_line) {
    const study = lookup(studyKey, str(line, "study_id"), "study");
    const vendorId = optStr(line, "vendor_id");
    const vendor =
      vendorId === null
        ? NOT_APPLICABLE_VENDOR_KEY
        : lookup(vendorKey, vendorId, "vendor");
    const start = str(line, "quarter_start_on");
    const budget = splitInThree(num(line, "budget_usd"));
    const actual = splitInThree(num(line, "actual_usd"));
    for (let m = 0; m < 3; m += 1) {
      const month = `${start.slice(0, 5)}${String(Number(start.slice(5, 7)) + m).padStart(2, "0")}-01`;
      const id = `${study}|${vendor}|${month}`;
      const row = spend.get(id) ?? {
        study_key: study,
        vendor_key: vendor,
        month_date_key: dk(month),
        budget_usd: 0,
        actual_usd: 0,
        variance_usd: 0,
        is_synthetic: line.is_synthetic,
      };
      const b = Number(row.budget_usd) + budget[m];
      const a = Number(row.actual_usd) + actual[m];
      spend.set(id, {
        ...row,
        budget_usd: b,
        actual_usd: a,
        variance_usd: a - b,
      });
    }
  }
  const fctSpend = [...spend.values()];

  const fctKri = kriSnapshots(
    silver,
    asOf,
    sites.closeOn,
    plannedDateOf,
    (siteId, day) => ({
      site_key: siteKeyOn(siteId, day),
      country_key: lookup(siteCountry, siteId, "site"),
    }),
    studyKey,
    dk
  );

  const dimDate = calendar(days);

  return {
    dim_study: dimStudy,
    dim_site: sites.rows,
    dim_country: dimCountry,
    dim_date: dimDate,
    dim_vendor: dimVendor,
    dim_milestone: dimMilestone,
    dim_monitoring_plan: dimMonitoringPlan,
    fct_enrollment: fctEnrollment,
    fct_visit: fctVisit,
    fct_query: fctQuery,
    fct_deviation: fctDeviation,
    fct_monitoring_visit: fctMonitoringVisit,
    fct_planned_monitoring_visit: fctPlannedMonitoringVisit,
    fct_milestone: fctMilestone,
    fct_spend: fctSpend,
    fct_kri_snapshot: fctKri,
  };
}

/** Every day of the whole calendar years that hold the given days. */
function calendar(days: readonly string[]): WarehouseRow[] {
  if (days.length === 0) return [];
  let min = days[0];
  let max = days[0];
  for (const day of days) {
    if (day < min) min = day;
    if (day > max) max = day;
  }
  const rows: WarehouseRow[] = [];
  const last = dayNumber(`${max.slice(0, 4)}-12-31`);
  for (let day = dayNumber(`${min.slice(0, 4)}-01-01`); day <= last; day += 1) {
    const iso = isoDay(day);
    const month = Number(iso.slice(5, 7));
    const quarter = Math.floor((month - 1) / 3) + 1;
    rows.push({
      date_key: dateKey(iso),
      calendar_date: iso,
      year_number: Number(iso.slice(0, 4)),
      quarter_number: quarter,
      month_number: month,
      month_name: MONTH_NAMES[month - 1],
      day_of_month: Number(iso.slice(8, 10)),
      iso_day_of_week: isoWeekday(day),
      year_month: iso.slice(0, 7),
      year_quarter: `${iso.slice(0, 4)}-Q${quarter}`,
      is_month_end: monthEnd(iso) === iso,
    });
  }
  return rows;
}

/** Groups rows by their `site_id`. */
function bySite(rows: readonly WarehouseRow[]): Map<string, WarehouseRow[]> {
  const out = new Map<string, WarehouseRow[]>();
  for (const row of rows) {
    const site = str(row, "site_id");
    const list = out.get(site);
    if (list) list.push(row);
    else out.set(site, [row]);
  }
  return out;
}

/** Dated amounts, sorted, answering "total up to and including a day". */
class Cumulative {
  private readonly days: string[] = [];
  private readonly totals: number[] = [];

  constructor(entries: readonly (readonly [string | null, number])[]) {
    const dated = entries
      .filter((entry): entry is readonly [string, number] => entry[0] !== null)
      .map(([day, amount]) => [day.slice(0, 10), amount] as const)
      .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    let total = 0;
    for (const [day, amount] of dated) {
      total += amount;
      this.days.push(day);
      this.totals.push(total);
    }
  }

  /** Total of the amounts dated on or before `day`. */
  upTo(day: string): number {
    let low = 0;
    let high = this.days.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (this.days[mid] <= day) low = mid + 1;
      else high = mid;
    }
    return low === 0 ? 0 : this.totals[low - 1];
  }
}

/**
 * Month-end KRI snapshots per site, cumulative from activation, for every
 * month end from the activation month to the close-out month or the data cut.
 */
function kriSnapshots(
  silver: SilverTables,
  asOf: string,
  closeOn: ReadonlyMap<string, string>,
  plannedDateOf: ReadonlyMap<string, string>,
  siteDims: (
    siteId: string,
    day: string
  ) => { site_key: number; country_key: number },
  studyKey: ReadonlyMap<string, number>,
  dk: (iso: string) => number
): WarehouseRow[] {
  const visits = bySite(silver.edc_visit);
  const queries = bySite(silver.edc_query);
  const deviations = bySite(silver.ctms_deviation);
  const subjects = bySite(silver.edc_subject);
  const rows: WarehouseRow[] = [];
  for (const site of silver.site) {
    const siteId = str(site, "site_id");
    const activated = optStr(site, "activated_on");
    if (activated === null) continue;
    const close = closeOn.get(siteId);
    const lastDay = close !== undefined && close < asOf ? close : asOf;
    const siteVisits = visits.get(siteId) ?? [];
    const dueOn = (v: WarehouseRow) =>
      optStr(v, "visit_date") ?? plannedDateOf.get(str(v, "visit_id")) ?? null;
    const enteredVisits = siteVisits.filter(
      (v) =>
        optStr(v, "visit_date") !== null &&
        optStr(v, "data_entered_at") !== null
    );
    const series: Record<(typeof KRI_IDS)[number], [Cumulative, Cumulative]> = {
      "query-rate": [
        new Cumulative(
          (queries.get(siteId) ?? []).map((q) => [optStr(q, "opened_at"), 1])
        ),
        new Cumulative(siteVisits.map((v) => [optStr(v, "visit_date"), 1])),
      ],
      "missed-visit-rate": [
        new Cumulative(
          siteVisits.map((v) => [dueOn(v), v.visit_status === "missed" ? 1 : 0])
        ),
        new Cumulative(siteVisits.map((v) => [dueOn(v), 1])),
      ],
      "important-deviation-rate": [
        new Cumulative(
          (deviations.get(siteId) ?? []).map((d) => [
            optStr(d, "occurred_on"),
            d.importance === "important" ? 1 : 0,
          ])
        ),
        new Cumulative(
          (subjects.get(siteId) ?? []).map((s) => [optStr(s, "enrolled_on"), 1])
        ),
      ],
      "entry-lag-days": [
        new Cumulative(
          enteredVisits.map((v) => [
            optStr(v, "data_entered_at"),
            daysBetween(str(v, "visit_date"), str(v, "data_entered_at")),
          ])
        ),
        new Cumulative(
          enteredVisits.map((v) => [optStr(v, "data_entered_at"), 1])
        ),
      ],
    };
    const study = lookup(studyKey, str(site, "study_id"), "study");
    for (
      let snapshot = monthEnd(activated);
      snapshot <= monthEnd(lastDay) && snapshot <= asOf;
      snapshot = monthEnd(addDays(snapshot, 1))
    ) {
      const keys = siteDims(siteId, snapshot);
      const snapshotKey = dk(snapshot);
      for (const kri of KRI_IDS) {
        const numerator = series[kri][0].upTo(snapshot);
        const denominator = series[kri][1].upTo(snapshot);
        rows.push({
          site_key: keys.site_key,
          snapshot_date_key: snapshotKey,
          kri_id: kri,
          study_key: study,
          country_key: keys.country_key,
          numerator,
          denominator,
          kri_value: ratio(numerator, denominator),
          is_synthetic: site.is_synthetic,
        });
      }
    }
  }
  return rows;
}
