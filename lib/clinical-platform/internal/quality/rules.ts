/**
 * The platform's data quality rules (#2636): business rules over the
 * operational data products, by DAMA dimension. The warehouse check
 * (`checkWarehouse`) already enforces the schema, so types, nullability,
 * keys, foreign keys and SCD type 2 versions are not repeated here; these
 * rules check what a schema cannot say. Each rule carries a fault, the
 * smallest edit to a warehouse that breaks it, so every rule can be shown
 * catching a real defect.
 */
import type {
  DqDimension,
  DqRule,
  DqSeverity,
  Warehouse,
  WarehouseRow,
  WarehouseValue,
} from "../../types";
import { PRODUCT_REGISTRATIONS } from "../governance/contracts/registry";
import { addDays } from "../warehouse/dates";
import {
  addRow,
  day,
  dropRow,
  editRow,
  type DqCheck,
  type DqContext,
} from "./context";

/** A platform rule with its check and its fault. */
export interface PlatformDqRule extends DqRule {
  readonly check: (ctx: DqContext) => DqCheck;
  readonly fault: (warehouse: Warehouse) => Warehouse;
}

interface RuleText {
  readonly id: string;
  readonly productId: string;
  readonly dimension: DqDimension;
  readonly name: string;
  readonly expression: string;
  readonly severity: DqSeverity;
  readonly threshold: number;
  readonly rationale: string;
  readonly fault: (warehouse: Warehouse) => Warehouse;
}

function owner(productId: string): string {
  const registration = PRODUCT_REGISTRATIONS[productId];
  if (registration === undefined) {
    throw new Error(`data quality rule on unregistered product ${productId}`);
  }
  return registration.steward;
}

function rule(
  text: RuleText,
  check: (ctx: DqContext) => DqCheck
): PlatformDqRule {
  return {
    ...text,
    dataset: null,
    owner: owner(text.productId),
    source: "platform",
    citation: null,
    check,
  };
}

/** Key of a row: its values for the key columns, joined by `|`. */
function keyOf(row: WarehouseRow, columns: readonly string[]): string {
  return columns.map((c) => String(row[c])).join("|");
}

/** A rule tested row by row over the rows it applies to. */
function rowRule(
  text: RuleText,
  spec: {
    readonly key: readonly string[];
    readonly applies?: (row: WarehouseRow, ctx: DqContext) => boolean;
    readonly ok: (row: WarehouseRow, ctx: DqContext) => boolean;
  }
): PlatformDqRule {
  return rule(text, (ctx) => {
    let checked = 0;
    const failing: string[] = [];
    for (const row of ctx.rows(text.productId)) {
      if (spec.applies !== undefined && !spec.applies(row, ctx)) continue;
      checked += 1;
      if (!spec.ok(row, ctx)) failing.push(keyOf(row, spec.key));
    }
    return { checked, failing };
  });
}

/** A rule that no two rows share values for some columns. */
function uniqueRule(
  text: RuleText,
  spec: { readonly key: readonly string[]; readonly columns: readonly string[] }
): PlatformDqRule {
  return rule(text, (ctx) => {
    const rows = ctx.rows(text.productId);
    const counts = new Map<string, number>();
    for (const row of rows) {
      const k = keyOf(row, spec.columns);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const failing = rows
      .filter((row) => (counts.get(keyOf(row, spec.columns)) ?? 0) > 1)
      .map((row) => keyOf(row, spec.key));
    return { checked: rows.length, failing };
  });
}

/** A rule tested once per study, keyed by study id. */
function studyRule(
  text: RuleText,
  ok: (studyId: string, ctx: DqContext, study: WarehouseRow) => boolean
): PlatformDqRule {
  return rule(text, (ctx) => {
    const studies = ctx.rows("silver.study");
    const failing = studies
      .filter((s) => !ok(String(s.study_id), ctx, s))
      .map((s) => String(s.study_id));
    return { checked: studies.length, failing };
  });
}

const isNull = (value: WarehouseValue) => value === null;
const count = (rows: readonly WarehouseRow[] | undefined) => rows?.length ?? 0;

/** Officially assigned ISO 3166-1 alpha-2 codes. */
const ISO_COUNTRIES = new Set(
  (
    "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI " +
    "BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN " +
    "CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK " +
    "FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM " +
    "HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN " +
    "KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK " +
    "ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP " +
    "NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW " +
    "SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF " +
    "TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI " +
    "VN VU WF WS YE YT ZA ZM ZW"
  ).split(" ")
);

const VISIT_STATUSES = new Set(["entered", "missed", "pending-entry"]);
const QUERY_STATUSES = new Set(["open", "answered", "closed"]);
const QUERY_ORIGINS = new Set(["edit-check", "manual"]);
const KIT_STATUSES = new Set(["available", "dispensed", "expired"]);
const DEVIATION_CATEGORIES = new Set([
  "Eligibility criteria not met",
  "Informed consent process",
  "Investigational product dosing error",
  "Missed assessment",
  "Prohibited concomitant medication",
  "Sample handling",
  "Visit out of window",
]);
const PAST_SCREENING = new Set(["enrolled", "completed", "discontinued"]);
const MILESTONE_KINDS = 9;

const VISIT = "silver.edc_visit";
const SUBJECT = "silver.edc_subject";
const QUERY = "silver.edc_query";
const SITE = "silver.site";
const KIT = "silver.irt_kit";
const RANDOMIZATION = "silver.irt_randomization";
const DEVIATION = "silver.ctms_deviation";
const MONITORING = "silver.ctms_monitoring_visit";
const PLAN = "silver.ctms_monitoring_plan";
const TMF = "silver.etmf_document";
const FINANCE = "silver.finance_line";
const CEC = "silver.cec_adjudication";

const entered = (r: WarehouseRow) => r.visit_status === "entered";
const dispensed = (r: WarehouseRow) => r.kit_status === "dispensed";
const notClosed = (r: WarehouseRow) => r.query_status !== "closed";

/** Whole days from one ISO date to another. */
function daysFrom(from: WarehouseValue, to: WarehouseValue): number | null {
  const a = day(from);
  const b = day(to);
  if (a === null || b === null) return null;
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000
  );
}

/** Whether `a <= b` for two ISO dates or timestamps, treating null as no constraint. */
const ordered = (a: WarehouseValue, b: WarehouseValue) =>
  a === null || b === null || String(a) <= String(b);

/** Sum of a column over rows. */
const sum = (rows: readonly WarehouseRow[] | undefined, column: string) =>
  (rows ?? []).reduce((total, r) => total + Number(r[column] ?? 0), 0);

/** Study id of a gold row, through the study dimension. */
function studyOfKey(ctx: DqContext, key: WarehouseValue): string {
  return String(ctx.index("gold.dim_study", "study_key").get(key)?.study_id);
}

/** Gold rows of a table grouped by study id. */
function goldByStudy(
  ctx: DqContext,
  table: string
): Map<string, WarehouseRow[]> {
  const out = new Map<string, WarehouseRow[]>();
  for (const row of ctx.rows(table)) {
    const id = studyOfKey(ctx, row.study_key);
    const list = out.get(id);
    if (list === undefined) out.set(id, [row]);
    else list.push(row);
  }
  return out;
}

export const PLATFORM_DQ_RULES: readonly PlatformDqRule[] = [
  // Completeness
  rowRule(
    {
      id: "DQ-C01",
      productId: VISIT,
      dimension: "completeness",
      name: "Entered visits have a visit date and an entry time",
      expression:
        "visit_status = 'entered' → visit_date IS NOT NULL AND data_entered_at IS NOT NULL",
      severity: "critical",
      threshold: 1,
      rationale:
        "Every visit-based metric, from entry lag to visit windows, starts from these two fields.",
      fault: (w) =>
        editRow(w, VISIT, entered, () => ({ data_entered_at: null })),
    },
    {
      key: ["visit_id"],
      applies: entered,
      ok: (r) => !isNull(r.visit_date) && !isNull(r.data_entered_at),
    }
  ),
  rowRule(
    {
      id: "DQ-C02",
      productId: SUBJECT,
      dimension: "completeness",
      name: "Subjects past screening have an enrollment date",
      expression:
        "subject_status IN ('enrolled', 'completed', 'discontinued') → enrolled_on IS NOT NULL",
      severity: "critical",
      threshold: 1,
      rationale:
        "Enrollment counts, the forecast and every per-subject denominator depend on it.",
      fault: (w) =>
        editRow(
          w,
          SUBJECT,
          (r) => r.subject_status === "enrolled",
          () => ({ enrolled_on: null })
        ),
    },
    {
      key: ["subject_id"],
      applies: (r) => PAST_SCREENING.has(String(r.subject_status)),
      ok: (r) => !isNull(r.enrolled_on),
    }
  ),
  rowRule(
    {
      id: "DQ-C03",
      productId: SUBJECT,
      dimension: "completeness",
      name: "Completed and discontinued subjects have their end date",
      expression:
        "(subject_status = 'completed' → completed_on IS NOT NULL) AND (subject_status = 'discontinued' → discontinued_on IS NOT NULL)",
      severity: "major",
      threshold: 1,
      rationale:
        "Retention and early-termination metrics count subjects by the date they left.",
      fault: (w) =>
        editRow(
          w,
          SUBJECT,
          (r) => r.subject_status === "discontinued",
          () => ({ discontinued_on: null })
        ),
    },
    {
      key: ["subject_id"],
      applies: (r) =>
        r.subject_status === "completed" || r.subject_status === "discontinued",
      ok: (r) =>
        r.subject_status === "completed"
          ? !isNull(r.completed_on)
          : !isNull(r.discontinued_on),
    }
  ),
  rowRule(
    {
      id: "DQ-C04",
      productId: "gold.dim_site",
      dimension: "completeness",
      name: "Active sites name a principal investigator",
      expression:
        "is_current AND site_status = 'active' → principal_investigator_id IS NOT NULL",
      severity: "major",
      threshold: 1,
      rationale:
        "A site may not enroll without a principal investigator on file (ICH E6(R3) 2.1).",
      fault: (w) =>
        editRow(
          w,
          "gold.dim_site",
          (r) => r.is_current === true && r.site_status === "active",
          () => ({ principal_investigator_id: null })
        ),
    },
    {
      key: ["site_id", "version_number"],
      applies: (r) => r.is_current === true && r.site_status === "active",
      ok: (r) => !isNull(r.principal_investigator_id),
    }
  ),
  rowRule(
    {
      id: "DQ-C05",
      productId: KIT,
      dimension: "completeness",
      name: "Dispensed kits name a subject and a dispensing date",
      expression:
        "kit_status = 'dispensed' → subject_id IS NOT NULL AND dispensed_on IS NOT NULL",
      severity: "critical",
      threshold: 1,
      rationale:
        "Drug accountability must trace every dispensed kit to a subject and a day.",
      fault: (w) => editRow(w, KIT, dispensed, () => ({ subject_id: null })),
    },
    {
      key: ["kit_id"],
      applies: dispensed,
      ok: (r) => !isNull(r.subject_id) && !isNull(r.dispensed_on),
    }
  ),
  rowRule(
    {
      id: "DQ-C06",
      productId: CEC,
      dimension: "completeness",
      name: "Adjudicated events carry the committee's event type and relatedness",
      expression:
        "adjudicated_on IS NOT NULL → cec_event_type IS NOT NULL AND cec_device_related IS NOT NULL",
      severity: "major",
      threshold: 1,
      rationale:
        "Safety endpoints are analysed on the committee's classification, not the site's.",
      fault: (w) =>
        editRow(
          w,
          CEC,
          (r) => !isNull(r.adjudicated_on),
          () => ({ cec_event_type: null })
        ),
    },
    {
      key: ["event_id"],
      applies: (r) => !isNull(r.adjudicated_on),
      ok: (r) => !isNull(r.cec_event_type) && !isNull(r.cec_device_related),
    }
  ),
  studyRule(
    {
      id: "DQ-C07",
      productId: "silver.study",
      dimension: "completeness",
      name: "Every study has all nine milestones in CTMS",
      expression:
        "COUNT(DISTINCT ctms_milestone.milestone_kind) = 9 for each study",
      severity: "major",
      threshold: 1,
      rationale:
        "The portfolio timeline and cycle-time benchmarks compare the same milestones across studies.",
      fault: (w) =>
        dropRow(
          w,
          "silver.ctms_milestone",
          (r) => r.milestone_kind === "database-lock"
        ),
    },
    (studyId, ctx) =>
      new Set(
        (
          ctx.groups("silver.ctms_milestone", "study_id").get(studyId) ?? []
        ).map((m) => m.milestone_kind)
      ).size === MILESTONE_KINDS
  ),
  studyRule(
    {
      id: "DQ-C08",
      productId: "silver.study",
      dimension: "completeness",
      name: "Every study has a monitoring plan",
      expression: "EXISTS ctms_monitoring_plan for each study",
      severity: "critical",
      threshold: 1,
      rationale:
        "Monitoring timeliness is measured against the plan; without one it cannot be measured.",
      fault: (w) => dropRow(w, PLAN, () => true),
    },
    (studyId, ctx) => count(ctx.groups(PLAN, "study_id").get(studyId)) > 0
  ),
  rowRule(
    {
      id: "DQ-C09",
      productId: SITE,
      dimension: "completeness",
      name: "Activated sites have a site initiation visit on record",
      expression:
        "activated_on IS NOT NULL → EXISTS ctms_monitoring_visit WHERE visit_type = 'SIV'",
      severity: "major",
      threshold: 1,
      rationale:
        "Activation without a recorded initiation visit means the site was never shown to be ready.",
      fault: (w) => dropRow(w, MONITORING, (r) => r.visit_type === "SIV"),
    },
    {
      key: ["site_id"],
      applies: (r) => !isNull(r.activated_on),
      ok: (r, ctx) =>
        (ctx.groups(MONITORING, "site_id").get(r.site_id) ?? []).some(
          (v) => v.visit_type === "SIV"
        ),
    }
  ),

  // Validity
  rowRule(
    {
      id: "DQ-V01",
      productId: VISIT,
      dimension: "validity",
      name: "Visit statuses come from the EDC's list",
      expression: "visit_status IN ('entered', 'missed', 'pending-entry')",
      severity: "critical",
      threshold: 1,
      rationale:
        "An unknown status drops the visit out of every count that filters on status.",
      fault: (w) =>
        editRow(w, VISIT, entered, () => ({ visit_status: "done" })),
    },
    {
      key: ["visit_id"],
      ok: (r) => VISIT_STATUSES.has(String(r.visit_status)),
    }
  ),
  rowRule(
    {
      id: "DQ-V02",
      productId: QUERY,
      dimension: "validity",
      name: "Query statuses and origins come from the EDC's lists",
      expression:
        "query_status IN ('open', 'answered', 'closed') AND query_origin IN ('edit-check', 'manual')",
      severity: "critical",
      threshold: 1,
      rationale:
        "Query aging and the edit-check yield both split on these two fields.",
      fault: (w) =>
        editRow(
          w,
          QUERY,
          () => true,
          () => ({ query_origin: "auto" })
        ),
    },
    {
      key: ["query_id"],
      ok: (r) =>
        QUERY_STATUSES.has(String(r.query_status)) &&
        QUERY_ORIGINS.has(String(r.query_origin)),
    }
  ),
  rowRule(
    {
      id: "DQ-V03",
      productId: DEVIATION,
      dimension: "validity",
      name: "Deviations use the study's categories and importance levels",
      expression:
        "importance IN ('important', 'not-important') AND deviation_category IN (the seven categories)",
      severity: "major",
      threshold: 1,
      rationale:
        "Important-deviation QTLs and KRIs count by importance; a free-text value escapes them.",
      fault: (w) =>
        editRow(
          w,
          DEVIATION,
          () => true,
          () => ({ importance: "Important" })
        ),
    },
    {
      key: ["deviation_id"],
      ok: (r) =>
        (r.importance === "important" || r.importance === "not-important") &&
        DEVIATION_CATEGORIES.has(String(r.deviation_category)),
    }
  ),
  rowRule(
    {
      id: "DQ-V04",
      productId: SITE,
      dimension: "validity",
      name: "Site countries are ISO 3166-1 alpha-2 codes",
      expression: "country_code IN (ISO 3166-1 alpha-2)",
      severity: "major",
      threshold: 1,
      rationale:
        "Country roll-ups and regulatory submissions key on the ISO code; 'UK' is not one.",
      fault: (w) =>
        editRow(
          w,
          SITE,
          (r) => r.country_code === "GB",
          () => ({ country_code: "UK" })
        ),
    },
    {
      key: ["site_id"],
      ok: (r) => ISO_COUNTRIES.has(String(r.country_code)),
    }
  ),
  rowRule(
    {
      id: "DQ-V05",
      productId: VISIT,
      dimension: "validity",
      name: "No visit is dated or entered after the data cut",
      expression: "visit_date <= :data_cut AND data_entered_at <= :data_cut",
      severity: "critical",
      threshold: 1,
      rationale:
        "A record from the future is a clock or keying error and inflates every to-date count.",
      fault: (w) =>
        editRow(w, VISIT, entered, () => ({
          data_entered_at: "2099-01-01T09:00:00Z",
        })),
    },
    {
      key: ["visit_id"],
      ok: (r, ctx) =>
        ordered(day(r.visit_date), ctx.asOf) &&
        ordered(day(r.data_entered_at), ctx.asOf),
    }
  ),
  rowRule(
    {
      id: "DQ-V06",
      productId: FINANCE,
      dimension: "validity",
      name: "Budget and actual amounts are zero or more",
      expression: "budget_usd >= 0 AND actual_usd >= 0",
      severity: "critical",
      threshold: 1,
      rationale:
        "A negative amount is a credit posted as a cost, and it hides overspend.",
      fault: (w) =>
        editRow(
          w,
          FINANCE,
          () => true,
          () => ({ actual_usd: -1 })
        ),
    },
    {
      key: ["study_id", "cost_category", "fiscal_quarter"],
      ok: (r) => Number(r.budget_usd) >= 0 && Number(r.actual_usd) >= 0,
    }
  ),
  rowRule(
    {
      id: "DQ-V07",
      productId: MONITORING,
      dimension: "validity",
      name: "Verified SDV pages lie between zero and the pages due",
      expression:
        "0 <= sdv_pages_verified <= sdv_pages_due AND action_items >= 0",
      severity: "major",
      threshold: 1,
      rationale: "More verified than due pages overstates SDV completion.",
      fault: (w) =>
        editRow(
          w,
          MONITORING,
          () => true,
          (r) => ({ sdv_pages_verified: Number(r.sdv_pages_due) + 1 })
        ),
    },
    {
      key: ["monitoring_visit_id"],
      ok: (r) =>
        Number(r.sdv_pages_verified) >= 0 &&
        Number(r.sdv_pages_verified) <= Number(r.sdv_pages_due) &&
        Number(r.action_items) >= 0,
    }
  ),
  rowRule(
    {
      id: "DQ-V08",
      productId: KIT,
      dimension: "validity",
      name: "Kit statuses come from the IRT's list",
      expression: "kit_status IN ('available', 'dispensed', 'expired')",
      severity: "minor",
      threshold: 1,
      rationale: "Supply forecasts count available kits by status.",
      fault: (w) => editRow(w, KIT, dispensed, () => ({ kit_status: "used" })),
    },
    { key: ["kit_id"], ok: (r) => KIT_STATUSES.has(String(r.kit_status)) }
  ),
  rowRule(
    {
      id: "DQ-V09",
      productId: QUERY,
      dimension: "validity",
      name: "Queried fields name a domain and a variable",
      expression: "queried_field LIKE 'DOMAIN.VARIABLE'",
      severity: "minor",
      threshold: 1,
      rationale:
        "Query rates by form, and the link back to the CRF, read the domain from this field.",
      fault: (w) =>
        editRow(
          w,
          QUERY,
          () => true,
          () => ({ queried_field: "weight" })
        ),
    },
    {
      key: ["query_id"],
      ok: (r) => /^[A-Z]{2}\.[A-Z0-9_]+$/.test(String(r.queried_field)),
    }
  ),

  // Uniqueness
  uniqueRule(
    {
      id: "DQ-U01",
      productId: SITE,
      dimension: "uniqueness",
      name: "One site per study and site number",
      expression: "COUNT(*) = 1 GROUP BY study_id, site_number",
      severity: "critical",
      threshold: 1,
      rationale:
        "Two CTMS instances that each register a site give it two ids; its subjects then split across both.",
      fault: (w) =>
        addRow(
          w,
          SITE,
          () => true,
          (r) => ({ site_id: `${String(r.site_id)}-CTMS2` })
        ),
    },
    { key: ["site_id"], columns: ["study_id", "site_number"] }
  ),
  uniqueRule(
    {
      id: "DQ-U02",
      productId: SITE,
      dimension: "uniqueness",
      name: "Site names are unique within a study",
      expression: "COUNT(*) = 1 GROUP BY study_id, site_name",
      severity: "minor",
      threshold: 1,
      rationale:
        "A repeated name within a study usually means the same institution registered twice.",
      fault: (w) => {
        const [a, b] = w.tables[SITE];
        return editRow(
          w,
          SITE,
          (r) => r.site_id === b.site_id,
          () => ({ site_name: a.site_name })
        );
      },
    },
    { key: ["site_id"], columns: ["study_id", "site_name"] }
  ),
  uniqueRule(
    {
      id: "DQ-U03",
      productId: RANDOMIZATION,
      dimension: "uniqueness",
      name: "Each subject is randomised once",
      expression: "COUNT(*) = 1 GROUP BY subject_id",
      severity: "critical",
      threshold: 1,
      rationale:
        "A second randomisation breaks allocation concealment and double-counts the subject.",
      fault: (w) =>
        addRow(
          w,
          RANDOMIZATION,
          () => true,
          (r) => ({ randomization_id: `${String(r.randomization_id)}-R2` })
        ),
    },
    { key: ["randomization_id"], columns: ["subject_id"] }
  ),
  uniqueRule(
    {
      id: "DQ-U04",
      productId: VISIT,
      dimension: "uniqueness",
      name: "One visit per subject per planned visit",
      expression: "COUNT(*) = 1 GROUP BY subject_id, planned_visit_id",
      severity: "major",
      threshold: 1,
      rationale:
        "A duplicated visit doubles its assessments and queries in every rate.",
      fault: (w) =>
        addRow(w, VISIT, entered, (r) => ({
          visit_id: `${String(r.visit_id)}-DUP`,
        })),
    },
    { key: ["visit_id"], columns: ["subject_id", "planned_visit_id"] }
  ),
  uniqueRule(
    {
      id: "DQ-U05",
      productId: PLAN,
      dimension: "uniqueness",
      name: "One monitoring plan per study",
      expression: "COUNT(*) = 1 GROUP BY study_id",
      severity: "major",
      threshold: 1,
      rationale:
        "Two plans in force give two report deadlines for the same visit.",
      fault: (w) =>
        addRow(
          w,
          PLAN,
          () => true,
          (r) => ({ monitoring_plan_id: `${String(r.monitoring_plan_id)}-B` })
        ),
    },
    { key: ["monitoring_plan_id"], columns: ["study_id"] }
  ),
  uniqueRule(
    {
      id: "DQ-U06",
      productId: TMF,
      dimension: "uniqueness",
      name: "One TMF document per study, site and artifact",
      expression: "COUNT(*) = 1 GROUP BY study_id, site_id, artifact",
      severity: "minor",
      threshold: 1,
      rationale:
        "A filed duplicate hides which version is the record and inflates TMF completeness.",
      fault: (w) =>
        addRow(
          w,
          TMF,
          () => true,
          (r) => ({ document_id: `${String(r.document_id)}-COPY` })
        ),
    },
    { key: ["document_id"], columns: ["study_id", "site_id", "artifact"] }
  ),

  // Consistency
  rowRule(
    {
      id: "DQ-K01",
      productId: SUBJECT,
      dimension: "consistency",
      name: "Subject dates run in order",
      expression:
        "screened_on <= enrolled_on <= COALESCE(completed_on, discontinued_on)",
      severity: "critical",
      threshold: 1,
      rationale:
        "Out-of-order dates give negative durations in exposure and retention analyses.",
      fault: (w) =>
        editRow(
          w,
          SUBJECT,
          (r) => !isNull(r.enrolled_on),
          (r) => ({ enrolled_on: addDays(String(r.screened_on), -3) })
        ),
    },
    {
      key: ["subject_id"],
      ok: (r) =>
        ordered(r.screened_on, r.enrolled_on) &&
        ordered(r.enrolled_on, r.completed_on) &&
        ordered(r.enrolled_on, r.discontinued_on),
    }
  ),
  rowRule(
    {
      id: "DQ-K02",
      productId: VISIT,
      dimension: "consistency",
      name: "No visit happens before the subject's screening consent",
      expression: "visit_date >= edc_subject.screened_on",
      severity: "critical",
      threshold: 1,
      rationale:
        "A study procedure before consent is a serious GCP breach, or a date keyed wrong.",
      fault: (w) => {
        const subjects = new Map(
          w.tables[SUBJECT].map((s) => [s.subject_id, s.screened_on])
        );
        return editRow(w, VISIT, entered, (r) => ({
          visit_date: addDays(String(subjects.get(r.subject_id)), -2),
        }));
      },
    },
    {
      key: ["visit_id"],
      applies: (r) => !isNull(r.visit_date),
      ok: (r, ctx) =>
        ordered(
          ctx.index(SUBJECT, "subject_id").get(r.subject_id)?.screened_on ??
            null,
          r.visit_date
        ),
    }
  ),
  rowRule(
    {
      id: "DQ-K03",
      productId: VISIT,
      dimension: "consistency",
      name: "Missed visits carry no visit date",
      expression: "visit_status = 'missed' → visit_date IS NULL",
      severity: "major",
      threshold: 1,
      rationale:
        "A dated missed visit is counted both as missed and as attended.",
      fault: (w) =>
        editRow(
          w,
          VISIT,
          (r) => r.visit_status === "missed",
          () => ({ visit_date: "2025-06-02" })
        ),
    },
    {
      key: ["visit_id"],
      applies: (r) => r.visit_status === "missed",
      ok: (r) => isNull(r.visit_date),
    }
  ),
  rowRule(
    {
      id: "DQ-K04",
      productId: QUERY,
      dimension: "consistency",
      name: "Queries are answered after they open and closed after that",
      expression: "opened_at <= answered_at <= closed_at",
      severity: "critical",
      threshold: 1,
      rationale:
        "A query closed before it opened gives a negative cycle time, the mark of a time zone bug.",
      fault: (w) =>
        editRow(
          w,
          QUERY,
          (r) => !isNull(r.closed_at),
          (r) => ({
            closed_at: `${addDays(String(day(r.opened_at)), -1)}T08:00:00Z`,
          })
        ),
    },
    {
      key: ["query_id"],
      ok: (r) =>
        ordered(r.opened_at, r.answered_at) &&
        ordered(r.answered_at, r.closed_at) &&
        ordered(r.opened_at, r.closed_at),
    }
  ),
  rowRule(
    {
      id: "DQ-K05",
      productId: QUERY,
      dimension: "consistency",
      name: "Query status agrees with its timestamps",
      expression:
        "closed ⇔ closed_at IS NOT NULL; answered → answered_at IS NOT NULL",
      severity: "major",
      threshold: 1,
      rationale:
        "Open-query counts read the status and aging reads the timestamps; they must tell the same story.",
      fault: (w) =>
        editRow(
          w,
          QUERY,
          (r) => r.query_status === "closed",
          () => ({ query_status: "open" })
        ),
    },
    {
      key: ["query_id"],
      ok: (r) =>
        (r.query_status === "closed") === !isNull(r.closed_at) &&
        (r.query_status !== "answered" || !isNull(r.answered_at)),
    }
  ),
  rowRule(
    {
      id: "DQ-K06",
      productId: DEVIATION,
      dimension: "consistency",
      name: "Deviations are identified on or after they occur",
      expression: "identified_on >= occurred_on",
      severity: "major",
      threshold: 1,
      rationale: "Days-to-identify must never be negative.",
      fault: (w) =>
        editRow(
          w,
          DEVIATION,
          () => true,
          (r) => ({
            identified_on: addDays(String(r.occurred_on), -1),
          })
        ),
    },
    {
      key: ["deviation_id"],
      ok: (r) => ordered(r.occurred_on, r.identified_on),
    }
  ),
  rowRule(
    {
      id: "DQ-K07",
      productId: RANDOMIZATION,
      dimension: "consistency",
      name: "Randomised subjects are enrolled in EDC at the same site",
      expression:
        "EXISTS edc_subject WHERE subject_id = r.subject_id AND site_id = r.site_id AND enrolled_on IS NOT NULL",
      severity: "critical",
      threshold: 1,
      rationale:
        "IRT and EDC must agree on who was randomised where, or the analysis population is wrong.",
      fault: (w) =>
        editRow(
          w,
          RANDOMIZATION,
          () => true,
          () => ({ site_id: "UNKNOWN-SITE" })
        ),
    },
    {
      key: ["randomization_id"],
      ok: (r, ctx) => {
        const subject = ctx.index(SUBJECT, "subject_id").get(r.subject_id);
        return (
          subject !== undefined &&
          subject.site_id === r.site_id &&
          !isNull(subject.enrolled_on)
        );
      },
    }
  ),
  rowRule(
    {
      id: "DQ-K08",
      productId: KIT,
      dimension: "consistency",
      name: "Kits are dispensed after receipt and before expiry",
      expression: "received_on <= dispensed_on <= expires_on",
      severity: "critical",
      threshold: 1,
      rationale: "An expired kit given to a subject is a dosing deviation.",
      fault: (w) =>
        editRow(w, KIT, dispensed, (r) => ({
          dispensed_on: addDays(String(r.expires_on), 5),
        })),
    },
    {
      key: ["kit_id"],
      applies: (r) => !isNull(r.dispensed_on),
      ok: (r) =>
        ordered(r.received_on, r.dispensed_on) &&
        ordered(r.dispensed_on, r.expires_on),
    }
  ),
  rowRule(
    {
      id: "DQ-K09",
      productId: SUBJECT,
      dimension: "consistency",
      name: "Subjects are screened at an activated site, after activation",
      expression:
        "site.activated_on IS NOT NULL AND screened_on >= site.activated_on",
      severity: "major",
      threshold: 1,
      rationale:
        "Screening before activation means the site worked without approval.",
      fault: (w) => {
        const sites = new Map(
          w.tables[SITE].map((s) => [s.site_id, s.activated_on])
        );
        return editRow(
          w,
          SUBJECT,
          (r) => sites.get(r.site_id) !== null,
          (r) => ({ screened_on: addDays(String(sites.get(r.site_id)), -10) })
        );
      },
    },
    {
      key: ["subject_id"],
      ok: (r, ctx) => {
        const activated = ctx
          .index(SITE, "site_id")
          .get(r.site_id)?.activated_on;
        return (
          activated !== undefined &&
          activated !== null &&
          ordered(activated, r.screened_on)
        );
      },
    }
  ),
  studyRule(
    {
      id: "DQ-K10",
      productId: "silver.study",
      dimension: "consistency",
      name: "Subjects are randomised to no more arms than the study has",
      expression:
        "COUNT(DISTINCT irt_randomization.arm) <= arm_count for each study",
      severity: "minor",
      threshold: 1,
      rationale:
        "An extra arm name is a mistyped arm, and its subjects drop out of arm-level tables.",
      fault: (w) =>
        editRow(
          w,
          RANDOMIZATION,
          () => true,
          () => ({ arm: "Placebo " })
        ),
    },
    (studyId, ctx, study) =>
      new Set(
        (ctx.groups(RANDOMIZATION, "study_id").get(studyId) ?? []).map(
          (r) => r.arm
        )
      ).size <= Number(study.arm_count)
  ),
  rowRule(
    {
      id: "DQ-K11",
      productId: "gold.fct_spend",
      dimension: "consistency",
      name: "Spend variance is actual less budget",
      expression: "variance_usd = actual_usd - budget_usd",
      severity: "major",
      threshold: 1,
      rationale:
        "Budget burn reads the variance; a stale variance misstates overspend.",
      fault: (w) =>
        editRow(
          w,
          "gold.fct_spend",
          () => true,
          (r) => ({
            variance_usd: Number(r.variance_usd) + 100,
          })
        ),
    },
    {
      key: ["study_key", "vendor_key", "month_date_key"],
      ok: (r) =>
        Number(r.variance_usd) === Number(r.actual_usd) - Number(r.budget_usd),
    }
  ),
  rowRule(
    {
      id: "DQ-K12",
      productId: "silver.ctms_site_staff",
      dimension: "consistency",
      name: "Staff assignments end on or after they start",
      expression: "end_on IS NULL OR end_on >= start_on",
      severity: "minor",
      threshold: 1,
      rationale:
        "A reversed assignment leaves the site without an investigator on any day.",
      fault: (w) =>
        editRow(
          w,
          "silver.ctms_site_staff",
          () => true,
          (r) => ({
            end_on: addDays(String(r.start_on), -1),
          })
        ),
    },
    { key: ["assignment_id"], ok: (r) => ordered(r.start_on, r.end_on) }
  ),

  // Timeliness
  rowRule(
    {
      id: "DQ-T01",
      productId: VISIT,
      dimension: "timeliness",
      name: "Visits are entered within 14 days",
      expression:
        "data_entered_at - visit_date <= 14 days, for 90% of entered visits",
      severity: "major",
      threshold: 0.9,
      rationale:
        "Late entry delays every downstream review, query and safety signal.",
      fault: (w) =>
        editRow(w, VISIT, entered, (r) => ({
          data_entered_at: `${addDays(String(r.visit_date), 40)}T09:00:00Z`,
        })),
    },
    {
      key: ["visit_id"],
      applies: (r) =>
        entered(r) && !isNull(r.visit_date) && !isNull(r.data_entered_at),
      ok: (r) => (daysFrom(r.visit_date, r.data_entered_at) ?? 0) <= 14,
    }
  ),
  rowRule(
    {
      id: "DQ-T02",
      productId: QUERY,
      dimension: "timeliness",
      name: "No unresolved query is older than 30 days",
      expression:
        "query_status <> 'closed' → :data_cut - opened_at <= 30 days, for 80% of them",
      severity: "minor",
      threshold: 0.8,
      rationale: "Old open queries hold up database lock.",
      fault: (w) =>
        editRow(w, QUERY, notClosed, () => ({
          opened_at: "2025-01-02T09:00:00Z",
        })),
    },
    {
      key: ["query_id"],
      applies: notClosed,
      ok: (r, ctx) => (daysFrom(r.opened_at, ctx.asOf) ?? 0) <= 30,
    }
  ),
  rowRule(
    {
      id: "DQ-T03",
      productId: MONITORING,
      dimension: "timeliness",
      name: "Monitoring reports are final within the plan's deadline",
      expression:
        "COALESCE(report_final_on, :data_cut) - visit_date <= plan.report_due_days, for 90% of visits",
      severity: "major",
      threshold: 0.9,
      rationale:
        "The monitoring plan sets the deadline; late reports leave findings unacted on.",
      fault: (w) =>
        editRow(
          w,
          MONITORING,
          (r) => !isNull(r.report_final_on),
          (r) => ({
            report_final_on: addDays(String(r.visit_date), 90),
          })
        ),
    },
    {
      key: ["monitoring_visit_id"],
      ok: (r, ctx) => {
        const plan = ctx.groups(PLAN, "study_id").get(r.study_id)?.[0];
        if (plan === undefined) return false;
        const end = r.report_final_on ?? ctx.asOf;
        return (
          (daysFrom(r.visit_date, end) ?? 0) <= Number(plan.report_due_days)
        );
      },
    }
  ),
  rowRule(
    {
      id: "DQ-T04",
      productId: TMF,
      dimension: "timeliness",
      name: "TMF documents are filed by their due date",
      expression:
        "COALESCE(filed_on, :data_cut) <= due_on, for 90% of documents due by the cut",
      severity: "major",
      threshold: 0.9,
      rationale:
        "An inspection-ready TMF is a contemporaneous TMF (ICH E6(R3) C.1).",
      fault: (w) =>
        editRow(
          w,
          TMF,
          (r) =>
            !isNull(r.filed_on) &&
            ordered(r.filed_on, r.due_on) &&
            String(r.due_on) <= w.asOf,
          (r) => ({ filed_on: addDays(String(r.due_on), 60) })
        ),
    },
    {
      key: ["document_id"],
      applies: (r, ctx) => String(r.due_on) <= ctx.asOf,
      ok: (r, ctx) => ordered(r.filed_on ?? ctx.asOf, r.due_on),
    }
  ),
  rowRule(
    {
      id: "DQ-T05",
      productId: DEVIATION,
      dimension: "timeliness",
      name: "Deviations are identified within 30 days",
      expression:
        "identified_on - occurred_on <= 30 days, for 90% of deviations",
      severity: "minor",
      threshold: 0.9,
      rationale:
        "A deviation found late can no longer be corrected for the subject.",
      fault: (w) =>
        editRow(
          w,
          DEVIATION,
          () => true,
          (r) => ({
            identified_on: addDays(String(r.occurred_on), 120),
          })
        ),
    },
    {
      key: ["deviation_id"],
      ok: (r) => (daysFrom(r.occurred_on, r.identified_on) ?? 0) <= 30,
    }
  ),
  rowRule(
    {
      id: "DQ-T06",
      productId: CEC,
      dimension: "timeliness",
      name: "Events reach the committee within 30 days",
      expression: "reported_on - occurred_on <= 30 days, for 90% of events",
      severity: "major",
      threshold: 0.9,
      rationale:
        "Adjudication backlogs delay the safety analyses that depend on the committee.",
      fault: (w) =>
        editRow(
          w,
          CEC,
          () => true,
          (r) => ({
            reported_on: addDays(String(r.occurred_on), 75),
          })
        ),
    },
    {
      key: ["event_id"],
      ok: (r) => (daysFrom(r.occurred_on, r.reported_on) ?? 0) <= 30,
    }
  ),

  // Accuracy
  studyRule(
    {
      id: "DQ-A01",
      productId: "gold.fct_visit",
      dimension: "accuracy",
      name: "Visit facts reconcile with EDC, study by study",
      expression:
        "COUNT(gold.fct_visit) = COUNT(silver.edc_visit) for each study",
      severity: "critical",
      threshold: 1,
      rationale:
        "A load that drops or doubles rows changes every visit metric.",
      fault: (w) => dropRow(w, VISIT, () => true),
    },
    (studyId, ctx) =>
      count(goldByStudy(ctx, "gold.fct_visit").get(studyId)) ===
      count(ctx.groups(VISIT, "study_id").get(studyId))
  ),
  studyRule(
    {
      id: "DQ-A02",
      productId: "gold.fct_query",
      dimension: "accuracy",
      name: "Query facts reconcile with EDC, study by study",
      expression:
        "COUNT(gold.fct_query) = COUNT(silver.edc_query) for each study",
      severity: "critical",
      threshold: 1,
      rationale: "Query rates are only as right as the query count under them.",
      fault: (w) => dropRow(w, QUERY, () => true),
    },
    (studyId, ctx) =>
      count(goldByStudy(ctx, "gold.fct_query").get(studyId)) ===
      count(ctx.groups(QUERY, "study_id").get(studyId))
  ),
  studyRule(
    {
      id: "DQ-A03",
      productId: "gold.fct_enrollment",
      dimension: "accuracy",
      name: "Enrollment facts reconcile with EDC, study by study",
      expression:
        "COUNT(fct_enrollment WHERE event_type = 'enrolled') = COUNT(edc_subject WHERE enrolled_on IS NOT NULL)",
      severity: "critical",
      threshold: 1,
      rationale:
        "The enrollment forecast and every per-subject rate start here.",
      fault: (w) =>
        dropRow(w, "gold.fct_enrollment", (r) => r.event_type === "enrolled"),
    },
    (studyId, ctx) =>
      (goldByStudy(ctx, "gold.fct_enrollment").get(studyId) ?? []).filter(
        (e) => e.event_type === "enrolled"
      ).length ===
      (ctx.groups(SUBJECT, "study_id").get(studyId) ?? []).filter(
        (s) => !isNull(s.enrolled_on)
      ).length
  ),
  studyRule(
    {
      id: "DQ-A04",
      productId: "gold.fct_spend",
      dimension: "accuracy",
      name: "Spend facts reconcile with finance lines, study by study",
      expression:
        "SUM(fct_spend.budget_usd, actual_usd) = SUM(finance_line.budget_usd, actual_usd) for each study",
      severity: "critical",
      threshold: 1,
      rationale:
        "Monthly spend is spread from quarterly lines; the spread must not lose or invent money.",
      fault: (w) =>
        editRow(
          w,
          FINANCE,
          () => true,
          (r) => ({
            actual_usd: Number(r.actual_usd) * 2,
          })
        ),
    },
    (studyId, ctx) => {
      const gold = goldByStudy(ctx, "gold.fct_spend").get(studyId);
      const lines = ctx.groups(FINANCE, "study_id").get(studyId);
      return (
        sum(gold, "budget_usd") === sum(lines, "budget_usd") &&
        sum(gold, "actual_usd") === sum(lines, "actual_usd")
      );
    }
  ),
  rowRule(
    {
      id: "DQ-A05",
      productId: "gold.fct_kri_snapshot",
      dimension: "accuracy",
      name: "KRI values equal their numerator over their denominator",
      expression:
        "kri_value = numerator / denominator, or NULL when denominator = 0",
      severity: "major",
      threshold: 1,
      rationale:
        "A KRI that does not recompute from its own parts cannot be trusted at a site review.",
      fault: (w) =>
        editRow(
          w,
          "gold.fct_kri_snapshot",
          (r) => Number(r.denominator) > 0,
          (r) => ({ kri_value: Number(r.kri_value) + 0.5 })
        ),
    },
    {
      key: ["site_key", "snapshot_date_key", "kri_id"],
      ok: (r) =>
        Number(r.denominator) === 0
          ? r.kri_value === null
          : r.kri_value !== null &&
            Math.abs(
              Number(r.kri_value) - Number(r.numerator) / Number(r.denominator)
            ) < 0.0005,
    }
  ),
  rowRule(
    {
      id: "DQ-A06",
      productId: "gold.dim_site",
      dimension: "accuracy",
      name: "Current site versions match the CTMS site record",
      expression:
        "is_current → (country_code, planned_enrollment, activated_on) = silver.site's",
      severity: "major",
      threshold: 1,
      rationale: "The site dimension feeds every country and site roll-up.",
      fault: (w) =>
        editRow(
          w,
          "gold.dim_site",
          (r) => r.is_current === true,
          (r) => ({ planned_enrollment: Number(r.planned_enrollment) + 5 })
        ),
    },
    {
      key: ["site_id", "version_number"],
      applies: (r) => r.is_current === true,
      ok: (r, ctx) => {
        const source = ctx.index(SITE, "site_id").get(r.site_id);
        return (
          source !== undefined &&
          source.country_code === r.country_code &&
          source.planned_enrollment === r.planned_enrollment &&
          source.activated_on === r.activated_on
        );
      },
    }
  ),
];
