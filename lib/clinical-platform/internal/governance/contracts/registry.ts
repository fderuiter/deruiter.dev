/**
 * Who owns each data product and what it promises. Ownership, service
 * levels and retention are decisions, not facts the schema can supply, so
 * each product's are written down here once. Everything else in a contract
 * (columns, types, keys, classification, lineage) is read from the
 * warehouse schema or the Study Data Pipeline's metadata.
 */
import { STUDY_DATA_PRODUCT_ID } from "../../../presets";
import type { DataRetention } from "../../../types";

/**
 * Retention of trial records: the content of the trial master file, which
 * subject data, monitoring, deviations, randomisation and adjudication
 * records belong to.
 */
export const TRIAL_RECORD_RETENTION: DataRetention = {
  years: 25,
  basis:
    "Regulation (EU) No 536/2014, Article 58: the trial master file is archived for at least 25 years after the end of the trial.",
  regulatory: true,
};

/** Retention of operational and derived data that no regulation sets a period for. */
export const OPERATIONAL_RETENTION: DataRetention = {
  years: 10,
  basis:
    "Sponsor records policy for operational and derived data: a policy choice, not a regulatory minimum.",
  regulatory: false,
};

/** The decisions recorded for one data product. */
export interface ProductRegistration {
  readonly name: string;
  readonly domain: string;
  readonly owner: string;
  readonly steward: string;
  readonly freshnessHours: number;
  readonly availability: number;
  readonly retention: DataRetention;
  /** Contract version in force. */
  readonly version: string;
}

const PORTFOLIO = {
  owner: "Portfolio Management Lead",
  steward: "Portfolio Data Steward",
} as const;
const OPERATIONS = {
  owner: "Clinical Operations Lead",
  steward: "Clinical Operations Data Steward",
} as const;
const DATA_MANAGEMENT = {
  owner: "Clinical Data Management Lead",
  steward: "Clinical Data Steward",
} as const;
const MONITORING = {
  owner: "Clinical Monitoring Lead",
  steward: "Clinical Operations Data Steward",
} as const;
const QUALITY = {
  owner: "Clinical Quality Lead",
  steward: "Clinical Quality Data Steward",
} as const;
const SUPPLY = {
  owner: "Clinical Supply Lead",
  steward: "IRT Data Steward",
} as const;
const OUTSOURCING = {
  owner: "Clinical Outsourcing Lead",
  steward: "Vendor Data Steward",
} as const;
const SAFETY = {
  owner: "Medical Safety Lead",
  steward: "Safety Data Steward",
} as const;
const FINANCE = {
  owner: "Clinical Finance Lead",
  steward: "Finance Data Steward",
} as const;

/** Daily loads: operational feeds and the marts built from them. */
const DAILY = 24;
/** Weekly: reference data that changes rarely. */
const WEEKLY = 168;
/** After each monthly finance close. */
const MONTHLY_CLOSE = 744;
/** After each monthly study data transfer. */
const MONTHLY_TRANSFER = 720;

const SILVER_AVAILABILITY = 0.99;
const GOLD_AVAILABILITY = 0.995;

const silver = (
  name: string,
  domain: string,
  roles: { readonly owner: string; readonly steward: string },
  freshnessHours: number,
  retention: DataRetention
): ProductRegistration => ({
  name,
  domain,
  ...roles,
  freshnessHours,
  availability: SILVER_AVAILABILITY,
  retention,
  version: "1.0.0",
});

const gold = (
  name: string,
  domain: string,
  roles: { readonly owner: string; readonly steward: string },
  freshnessHours = DAILY
): ProductRegistration => ({
  name,
  domain,
  ...roles,
  freshnessHours,
  availability: GOLD_AVAILABILITY,
  retention: OPERATIONAL_RETENTION,
  version: "1.0.0",
});

const TRIAL = TRIAL_RECORD_RETENTION;
const OPERATIONAL = OPERATIONAL_RETENTION;

/**
 * Every data product's registration, by product id. A test fails when a
 * warehouse table has no registration or a registration names no table.
 */
export const PRODUCT_REGISTRATIONS: Readonly<
  Record<string, ProductRegistration>
> = {
  "silver.study": silver(
    "Studies",
    "Portfolio",
    PORTFOLIO,
    WEEKLY,
    OPERATIONAL
  ),
  "silver.planned_visit": silver(
    "Planned visits",
    "Portfolio",
    PORTFOLIO,
    WEEKLY,
    OPERATIONAL
  ),
  "silver.site": {
    ...silver("Sites", "Site management", OPERATIONS, DAILY, OPERATIONAL),
    // 1.1.0 (#2880): the start-up stages before activation.
    version: "1.1.0",
  },
  "silver.vendor": silver(
    "Vendors",
    "Vendor management",
    OUTSOURCING,
    WEEKLY,
    OPERATIONAL
  ),
  "silver.edc_subject": {
    ...silver("EDC subjects", "EDC", DATA_MANAGEMENT, DAILY, TRIAL),
    // 1.1.0 (#2879): the screen failure reason.
    version: "1.1.0",
  },
  "silver.edc_visit": silver(
    "EDC visits",
    "EDC",
    DATA_MANAGEMENT,
    DAILY,
    TRIAL
  ),
  "silver.edc_query": silver(
    "EDC queries",
    "EDC",
    DATA_MANAGEMENT,
    DAILY,
    TRIAL
  ),
  // 1.0.0 (#2956): adverse events at every portfolio study but DEMO-301.
  "silver.edc_adverse_event": silver(
    "EDC adverse events",
    "EDC",
    SAFETY,
    DAILY,
    TRIAL
  ),
  // 1.0.0 (#2957): vital signs at every portfolio study but DEMO-301.
  "silver.edc_vital_sign": silver(
    "EDC vital signs",
    "EDC",
    DATA_MANAGEMENT,
    DAILY,
    TRIAL
  ),
  "silver.ctms_milestone": silver(
    "Study milestones",
    "CTMS",
    PORTFOLIO,
    DAILY,
    OPERATIONAL
  ),
  "silver.ctms_monitoring_plan": silver(
    "Monitoring plans",
    "CTMS",
    MONITORING,
    WEEKLY,
    TRIAL
  ),
  "silver.ctms_monitoring_visit": silver(
    "Monitoring visits",
    "CTMS",
    MONITORING,
    DAILY,
    TRIAL
  ),
  "silver.ctms_deviation": silver(
    "Protocol deviations",
    "CTMS",
    QUALITY,
    DAILY,
    TRIAL
  ),
  "silver.ctms_site_staff": silver(
    "Site staff assignments",
    "CTMS",
    OPERATIONS,
    DAILY,
    TRIAL
  ),
  "silver.irt_randomization": silver(
    "Randomisations",
    "IRT",
    SUPPLY,
    DAILY,
    TRIAL
  ),
  "silver.irt_kit": silver("Drug kits", "IRT", SUPPLY, DAILY, TRIAL),
  "silver.etmf_document": silver(
    "TMF documents",
    "eTMF",
    { owner: "Trial Master File Lead", steward: "TMF Data Steward" },
    DAILY,
    TRIAL
  ),
  "silver.finance_line": silver(
    "Finance lines",
    "Finance",
    FINANCE,
    MONTHLY_CLOSE,
    OPERATIONAL
  ),
  // 1.0.0 (#2912): the approved budget plan, quarter by quarter.
  "silver.finance_plan_line": silver(
    "Budget plan lines",
    "Finance",
    FINANCE,
    MONTHLY_CLOSE,
    OPERATIONAL
  ),
  "silver.cec_adjudication": silver(
    "Event adjudications",
    "Clinical events committee",
    SAFETY,
    DAILY,
    TRIAL
  ),
  "gold.dim_study": gold("Study dimension", "Conformed dimensions", PORTFOLIO),
  "gold.dim_site": {
    ...gold("Site dimension", "Conformed dimensions", OPERATIONS),
    // 1.1.0 (#2880): the start-up stages, initiation and first subject in.
    version: "1.1.0",
  },
  "gold.dim_country": gold(
    "Country dimension",
    "Conformed dimensions",
    OPERATIONS
  ),
  "gold.dim_date": gold("Date dimension", "Conformed dimensions", {
    owner: "Data Platform Lead",
    steward: "Platform Data Steward",
  }),
  "gold.dim_vendor": gold(
    "Vendor dimension",
    "Conformed dimensions",
    OUTSOURCING
  ),
  "gold.dim_milestone": gold(
    "Milestone dimension",
    "Conformed dimensions",
    PORTFOLIO
  ),
  "gold.dim_monitoring_plan": gold(
    "Monitoring plan dimension",
    "Conformed dimensions",
    MONITORING,
    WEEKLY
  ),
  "gold.fct_enrollment": {
    ...gold("Enrollment facts", "Operations mart", OPERATIONS),
    // 1.1.0 (#2879): the screen failure reason.
    version: "1.1.0",
  },
  "gold.fct_visit": {
    ...gold("Visit facts", "Operations mart", DATA_MANAGEMENT),
    // 1.1.0 (#2955): the entry hour.
    version: "1.1.0",
  },
  "gold.fct_query": {
    ...gold("Query facts", "Operations mart", DATA_MANAGEMENT),
    // 1.1.0 (#2759): the queried form.
    version: "1.1.0",
  },
  "gold.fct_deviation": gold("Deviation facts", "Operations mart", QUALITY),
  // 1.0.0 (#2881): the device studies' adjudication backlog.
  "gold.fct_cec_adjudication": gold(
    "Event adjudication facts",
    "Safety mart",
    SAFETY
  ),
  // 1.0.0 (#2956): adverse events, for safety reporting and monitoring.
  "gold.fct_adverse_event": gold("Adverse event facts", "Safety mart", SAFETY),
  // 1.0.0 (#2957): vital signs, for central monitoring.
  "gold.fct_vital_sign": gold("Vital sign facts", "RBQM mart", DATA_MANAGEMENT),
  "gold.fct_monitoring_visit": {
    ...gold("Monitoring visit facts", "Operations mart", MONITORING),
    // 1.1.0 (#2736): the plan in force and the report due date.
    version: "1.1.0",
  },
  "gold.fct_planned_monitoring_visit": gold(
    "Planned monitoring visit facts",
    "Operations mart",
    MONITORING
  ),
  "gold.fct_milestone": gold("Milestone facts", "Portfolio mart", PORTFOLIO),
  "gold.fct_spend": gold("Spend facts", "Finance mart", FINANCE, MONTHLY_CLOSE),
  // 1.0.0 (#2912): budget and forecast at completion.
  "gold.fct_spend_forecast": gold(
    "Spend forecast facts",
    "Finance mart",
    FINANCE,
    MONTHLY_CLOSE
  ),
  "gold.fct_kri_snapshot": gold("KRI snapshots", "RBQM mart", QUALITY),
  [STUDY_DATA_PRODUCT_ID]: {
    name: "Study data: SDTM and ADaM",
    domain: "Study data",
    owner: "Biostatistics Lead",
    steward: "Clinical Data Standards Steward",
    freshnessHours: MONTHLY_TRANSFER,
    availability: GOLD_AVAILABILITY,
    retention: TRIAL,
    // 2.5.0 (#2942): the SDTM EG dataset.
    // 2.6.0 (#2943): the ADaM ADEG dataset.
    // 2.7.0 (#2961): the SDTM CM dataset.
    // 2.8.0 (#2963): the SDTM MH dataset.
    // 2.9.0 (#2964): the SDTM IE dataset.
    // 2.10.0 (#2962): the ADaM ADCM dataset.
    // 2.11.0 (#3101): the ADaM ADHCE dataset.
    // 2.12.0 (#2807): SITEID and COUNTRY in ADaM ADSL.
    // 2.13.0 (#3414): the SDTM RELREC dataset.
    version: "2.13.0",
  },
};
