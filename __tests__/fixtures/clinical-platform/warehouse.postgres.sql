-- Clinical Data Platform warehouse, schema 1.3.0, PostgreSQL dialect.
-- Generated from WAREHOUSE_SCHEMA in lib/clinical-platform; do not edit by hand.
-- Synthetic data for demonstration. Every study, site, subject and vendor is fictional.

CREATE SCHEMA IF NOT EXISTS "silver";
CREATE SCHEMA IF NOT EXISTS "gold";

CREATE TABLE "silver"."study" (
  "study_id"              VARCHAR(64) NOT NULL,
  "study_title"           VARCHAR(200) NOT NULL,
  "therapeutic_area"      VARCHAR(64) NOT NULL,
  "product_type"          VARCHAR(64) NOT NULL,
  "phase"                 VARCHAR(64) NOT NULL,
  "regulatory_path"       VARCHAR(64) NOT NULL,
  "operating_model"       VARCHAR(64) NOT NULL,
  "cro_vendor_id"         VARCHAR(64),
  "study_status"          VARCHAR(64) NOT NULL,
  "start_on"              DATE NOT NULL,
  "planned_enrollment"    INTEGER NOT NULL,
  "is_randomized"         BOOLEAN NOT NULL,
  "arm_count"             INTEGER NOT NULL,
  "schedule_source"       VARCHAR(64) NOT NULL,
  "has_cec_adjudication"  BOOLEAN NOT NULL,
  "study_data_product_id" VARCHAR(64),
  "is_synthetic"          BOOLEAN NOT NULL,
  CONSTRAINT "pk_study" PRIMARY KEY ("study_id")
);
COMMENT ON TABLE "silver"."study" IS 'Studies in the portfolio, one row per protocol. Grain: One row per study.';
COMMENT ON COLUMN "silver"."study"."study_id" IS 'Protocol id, for example DEMO-301.';
COMMENT ON COLUMN "silver"."study"."study_title" IS 'Short title.';
COMMENT ON COLUMN "silver"."study"."therapeutic_area" IS 'Therapeutic area.';
COMMENT ON COLUMN "silver"."study"."product_type" IS 'Investigational product type: drug, biologic or device.';
COMMENT ON COLUMN "silver"."study"."phase" IS 'Development phase or device study stage.';
COMMENT ON COLUMN "silver"."study"."regulatory_path" IS 'US regulatory pathway, IND or IDE.';
COMMENT ON COLUMN "silver"."study"."operating_model" IS 'Who runs the study: sponsor or CRO.';
COMMENT ON COLUMN "silver"."study"."cro_vendor_id" IS 'Vendor id of the CRO, for CRO-run studies.';
COMMENT ON COLUMN "silver"."study"."study_status" IS 'Lifecycle status at the data cut.';
COMMENT ON COLUMN "silver"."study"."start_on" IS 'Date the protocol was finalised.';
COMMENT ON COLUMN "silver"."study"."planned_enrollment" IS 'Enrollment target across all sites.';
COMMENT ON COLUMN "silver"."study"."is_randomized" IS 'Whether subjects are randomised through IRT.';
COMMENT ON COLUMN "silver"."study"."arm_count" IS 'Number of treatment arms.';
COMMENT ON COLUMN "silver"."study"."schedule_source" IS 'Where the visit schedule comes from: usdm or blueprint.';
COMMENT ON COLUMN "silver"."study"."has_cec_adjudication" IS 'Whether a clinical events committee adjudicates events.';
COMMENT ON COLUMN "silver"."study"."study_data_product_id" IS 'Study Data Pipeline product that supplies the study''s SDTM and ADaM.';
COMMENT ON COLUMN "silver"."study"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."planned_visit" (
  "study_id"          VARCHAR(64) NOT NULL,
  "planned_visit_id"  VARCHAR(64) NOT NULL,
  "visit_sequence"    INTEGER NOT NULL,
  "visit_name"        VARCHAR(64) NOT NULL,
  "planned_day"       INTEGER NOT NULL,
  "window_days"       INTEGER NOT NULL,
  "dispenses_product" BOOLEAN NOT NULL,
  "is_synthetic"      BOOLEAN NOT NULL,
  CONSTRAINT "pk_planned_visit" PRIMARY KEY ("study_id", "planned_visit_id")
);
COMMENT ON TABLE "silver"."planned_visit" IS 'Planned visit schedule of each study. Grain: One row per study and planned visit.';
COMMENT ON COLUMN "silver"."planned_visit"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."planned_visit"."planned_visit_id" IS 'Planned visit id within the study.';
COMMENT ON COLUMN "silver"."planned_visit"."visit_sequence" IS 'Position of the visit in the schedule, from 1.';
COMMENT ON COLUMN "silver"."planned_visit"."visit_name" IS 'Display name of the visit.';
COMMENT ON COLUMN "silver"."planned_visit"."planned_day" IS 'Planned day relative to enrollment, which is day 0.';
COMMENT ON COLUMN "silver"."planned_visit"."window_days" IS 'Allowed deviation from the planned day, either side.';
COMMENT ON COLUMN "silver"."planned_visit"."dispenses_product" IS 'Whether investigational product is dispensed.';
COMMENT ON COLUMN "silver"."planned_visit"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."site" (
  "site_id"            VARCHAR(64) NOT NULL,
  "study_id"           VARCHAR(64) NOT NULL,
  "site_number"        VARCHAR(64) NOT NULL,
  "country_code"       VARCHAR(2) NOT NULL,
  "site_name"          VARCHAR(120) NOT NULL,
  "planned_enrollment" INTEGER NOT NULL,
  "activated_on"       DATE,
  "is_synthetic"       BOOLEAN NOT NULL,
  CONSTRAINT "pk_site" PRIMARY KEY ("site_id")
);
COMMENT ON TABLE "silver"."site" IS 'Investigator sites, one row per site in one study. Grain: One row per site.';
COMMENT ON COLUMN "silver"."site"."site_id" IS 'Site id, unique within the portfolio.';
COMMENT ON COLUMN "silver"."site"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."site"."site_number" IS 'Site number within the study.';
COMMENT ON COLUMN "silver"."site"."country_code" IS 'ISO 3166-1 alpha-2 country code, upper case.';
COMMENT ON COLUMN "silver"."site"."site_name" IS 'Fictional site name.';
COMMENT ON COLUMN "silver"."site"."planned_enrollment" IS 'Enrollment target for the site.';
COMMENT ON COLUMN "silver"."site"."activated_on" IS 'Activation date, or null before activation.';
COMMENT ON COLUMN "silver"."site"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."vendor" (
  "vendor_id"    VARCHAR(64) NOT NULL,
  "vendor_name"  VARCHAR(120) NOT NULL,
  "service"      VARCHAR(64) NOT NULL,
  "is_synthetic" BOOLEAN NOT NULL,
  CONSTRAINT "pk_vendor" PRIMARY KEY ("vendor_id")
);
COMMENT ON TABLE "silver"."vendor" IS 'Fictional vendors the studies use. Grain: One row per vendor.';
COMMENT ON COLUMN "silver"."vendor"."vendor_id" IS 'Vendor id.';
COMMENT ON COLUMN "silver"."vendor"."vendor_name" IS 'Fictional vendor name.';
COMMENT ON COLUMN "silver"."vendor"."service" IS 'Service the vendor provides.';
COMMENT ON COLUMN "silver"."vendor"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."edc_subject" (
  "subject_id"            VARCHAR(64) NOT NULL,
  "study_id"              VARCHAR(64) NOT NULL,
  "site_id"               VARCHAR(64) NOT NULL,
  "screened_on"           DATE NOT NULL,
  "enrolled_on"           DATE,
  "completed_on"          DATE,
  "discontinued_on"       DATE,
  "subject_status"        VARCHAR(64) NOT NULL,
  "screen_failure_reason" VARCHAR(40),
  "source_system"         VARCHAR(64) NOT NULL,
  "is_synthetic"          BOOLEAN NOT NULL,
  CONSTRAINT "pk_edc_subject" PRIMARY KEY ("subject_id")
);
COMMENT ON TABLE "silver"."edc_subject" IS 'EDC subjects with their screening, enrollment and disposition dates. Grain: One row per subject.';
COMMENT ON COLUMN "silver"."edc_subject"."subject_id" IS 'Subject id, unique within the portfolio.';
COMMENT ON COLUMN "silver"."edc_subject"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."edc_subject"."site_id" IS 'Site id.';
COMMENT ON COLUMN "silver"."edc_subject"."screened_on" IS 'Date of the screening visit.';
COMMENT ON COLUMN "silver"."edc_subject"."enrolled_on" IS 'Enrollment date, or null when not enrolled.';
COMMENT ON COLUMN "silver"."edc_subject"."completed_on" IS 'Date the subject completed the study.';
COMMENT ON COLUMN "silver"."edc_subject"."discontinued_on" IS 'Date the subject discontinued.';
COMMENT ON COLUMN "silver"."edc_subject"."subject_status" IS 'Status at the data cut.';
COMMENT ON COLUMN "silver"."edc_subject"."screen_failure_reason" IS 'Why screening failed, from a short fictional controlled list; null unless the subject failed screening.';
COMMENT ON COLUMN "silver"."edc_subject"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."edc_subject"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."edc_visit" (
  "visit_id"         VARCHAR(64) NOT NULL,
  "subject_id"       VARCHAR(64) NOT NULL,
  "study_id"         VARCHAR(64) NOT NULL,
  "site_id"          VARCHAR(64) NOT NULL,
  "planned_visit_id" VARCHAR(64) NOT NULL,
  "visit_date"       DATE,
  "day_offset"       INTEGER,
  "data_entered_at"  TIMESTAMPTZ,
  "visit_status"     VARCHAR(64) NOT NULL,
  "source_system"    VARCHAR(64) NOT NULL,
  "is_synthetic"     BOOLEAN NOT NULL,
  CONSTRAINT "pk_edc_visit" PRIMARY KEY ("visit_id")
);
COMMENT ON TABLE "silver"."edc_visit" IS 'EDC visit records with their data entry times. Grain: One row per subject visit record.';
COMMENT ON COLUMN "silver"."edc_visit"."visit_id" IS 'Visit record id.';
COMMENT ON COLUMN "silver"."edc_visit"."subject_id" IS 'Subject id.';
COMMENT ON COLUMN "silver"."edc_visit"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."edc_visit"."site_id" IS 'Site id.';
COMMENT ON COLUMN "silver"."edc_visit"."planned_visit_id" IS 'Planned visit id from the schedule.';
COMMENT ON COLUMN "silver"."edc_visit"."visit_date" IS 'Visit date, or null for a missed visit.';
COMMENT ON COLUMN "silver"."edc_visit"."day_offset" IS 'Actual minus planned day, or null for a missed visit.';
COMMENT ON COLUMN "silver"."edc_visit"."data_entered_at" IS 'UTC time the site entered the visit''s data.';
COMMENT ON COLUMN "silver"."edc_visit"."visit_status" IS 'Entry state: entered, pending-entry or missed.';
COMMENT ON COLUMN "silver"."edc_visit"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."edc_visit"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."edc_query" (
  "query_id"      VARCHAR(64) NOT NULL,
  "visit_id"      VARCHAR(64) NOT NULL,
  "subject_id"    VARCHAR(64) NOT NULL,
  "study_id"      VARCHAR(64) NOT NULL,
  "site_id"       VARCHAR(64) NOT NULL,
  "queried_field" VARCHAR(64) NOT NULL,
  "query_origin"  VARCHAR(64) NOT NULL,
  "opened_at"     TIMESTAMPTZ NOT NULL,
  "answered_at"   TIMESTAMPTZ,
  "closed_at"     TIMESTAMPTZ,
  "query_status"  VARCHAR(64) NOT NULL,
  "source_system" VARCHAR(64) NOT NULL,
  "is_synthetic"  BOOLEAN NOT NULL,
  CONSTRAINT "pk_edc_query" PRIMARY KEY ("query_id")
);
COMMENT ON TABLE "silver"."edc_query" IS 'EDC data queries with their open, answer and close times. Grain: One row per query.';
COMMENT ON COLUMN "silver"."edc_query"."query_id" IS 'Query id.';
COMMENT ON COLUMN "silver"."edc_query"."visit_id" IS 'Visit record id the query is raised on.';
COMMENT ON COLUMN "silver"."edc_query"."subject_id" IS 'Subject id.';
COMMENT ON COLUMN "silver"."edc_query"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."edc_query"."site_id" IS 'Site id.';
COMMENT ON COLUMN "silver"."edc_query"."queried_field" IS 'Queried field, as DOMAIN.VARIABLE.';
COMMENT ON COLUMN "silver"."edc_query"."query_origin" IS 'How the query was raised: edit-check or manual.';
COMMENT ON COLUMN "silver"."edc_query"."opened_at" IS 'UTC time the query was opened.';
COMMENT ON COLUMN "silver"."edc_query"."answered_at" IS 'UTC time the site answered.';
COMMENT ON COLUMN "silver"."edc_query"."closed_at" IS 'UTC time the query was closed.';
COMMENT ON COLUMN "silver"."edc_query"."query_status" IS 'State at the data cut.';
COMMENT ON COLUMN "silver"."edc_query"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."edc_query"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."ctms_milestone" (
  "study_id"        VARCHAR(64) NOT NULL,
  "milestone_kind"  VARCHAR(64) NOT NULL,
  "milestone_label" VARCHAR(120) NOT NULL,
  "planned_on"      DATE NOT NULL,
  "actual_on"       DATE,
  "source_system"   VARCHAR(64) NOT NULL,
  "is_synthetic"    BOOLEAN NOT NULL,
  CONSTRAINT "pk_ctms_milestone" PRIMARY KEY ("study_id", "milestone_kind")
);
COMMENT ON TABLE "silver"."ctms_milestone" IS 'CTMS study milestones, planned and actual. Grain: One row per study and milestone kind.';
COMMENT ON COLUMN "silver"."ctms_milestone"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."ctms_milestone"."milestone_kind" IS 'Milestone kind.';
COMMENT ON COLUMN "silver"."ctms_milestone"."milestone_label" IS 'Label in the study''s own vocabulary.';
COMMENT ON COLUMN "silver"."ctms_milestone"."planned_on" IS 'Planned date.';
COMMENT ON COLUMN "silver"."ctms_milestone"."actual_on" IS 'Actual date, or null when not reached.';
COMMENT ON COLUMN "silver"."ctms_milestone"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."ctms_milestone"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."ctms_monitoring_plan" (
  "monitoring_plan_id"    VARCHAR(64) NOT NULL,
  "study_id"              VARCHAR(64) NOT NULL,
  "plan_version"          VARCHAR(16) NOT NULL,
  "effective_on"          DATE NOT NULL,
  "interim_interval_days" INTEGER NOT NULL,
  "visit_window_days"     INTEGER NOT NULL,
  "report_due_days"       INTEGER NOT NULL,
  "source_system"         VARCHAR(64) NOT NULL,
  "is_synthetic"          BOOLEAN NOT NULL,
  CONSTRAINT "pk_ctms_monitoring_plan" PRIMARY KEY ("monitoring_plan_id")
);
COMMENT ON TABLE "silver"."ctms_monitoring_plan" IS 'CTMS monitoring plans: the interim visit cadence and report deadline each study''s plan sets. Grain: One row per monitoring plan version.';
COMMENT ON COLUMN "silver"."ctms_monitoring_plan"."monitoring_plan_id" IS 'Monitoring plan id.';
COMMENT ON COLUMN "silver"."ctms_monitoring_plan"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."ctms_monitoring_plan"."plan_version" IS 'Plan version.';
COMMENT ON COLUMN "silver"."ctms_monitoring_plan"."effective_on" IS 'Date the plan took effect.';
COMMENT ON COLUMN "silver"."ctms_monitoring_plan"."interim_interval_days" IS 'Planned days from one monitoring visit at a site to the next interim visit.';
COMMENT ON COLUMN "silver"."ctms_monitoring_plan"."visit_window_days" IS 'Days an interim visit may fall after its planned date and still be on time.';
COMMENT ON COLUMN "silver"."ctms_monitoring_plan"."report_due_days" IS 'Days from a visit by which its report must be final.';
COMMENT ON COLUMN "silver"."ctms_monitoring_plan"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."ctms_monitoring_plan"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."ctms_monitoring_visit" (
  "monitoring_visit_id" VARCHAR(64) NOT NULL,
  "study_id"            VARCHAR(64) NOT NULL,
  "site_id"             VARCHAR(64) NOT NULL,
  "visit_type"          VARCHAR(64) NOT NULL,
  "visit_mode"          VARCHAR(64) NOT NULL,
  "visit_date"          DATE NOT NULL,
  "report_final_on"     DATE,
  "sdv_pages_due"       INTEGER NOT NULL,
  "sdv_pages_verified"  INTEGER NOT NULL,
  "action_items"        INTEGER NOT NULL,
  "source_system"       VARCHAR(64) NOT NULL,
  "is_synthetic"        BOOLEAN NOT NULL,
  CONSTRAINT "pk_ctms_monitoring_visit" PRIMARY KEY ("monitoring_visit_id")
);
COMMENT ON TABLE "silver"."ctms_monitoring_visit" IS 'CTMS monitoring visits with source data verification counts. Grain: One row per monitoring visit.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."monitoring_visit_id" IS 'Monitoring visit id.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."site_id" IS 'Site id.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."visit_type" IS 'SIV, IMV or COV.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."visit_mode" IS 'On-site or remote.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."visit_date" IS 'Visit date.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."report_final_on" IS 'Date the visit report was finalised.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."sdv_pages_due" IS 'CRF pages due for source data verification.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."sdv_pages_verified" IS 'CRF pages source-verified.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."action_items" IS 'Action items raised.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."ctms_monitoring_visit"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."ctms_deviation" (
  "deviation_id"       VARCHAR(64) NOT NULL,
  "study_id"           VARCHAR(64) NOT NULL,
  "site_id"            VARCHAR(64) NOT NULL,
  "subject_id"         VARCHAR(64) NOT NULL,
  "deviation_category" VARCHAR(80) NOT NULL,
  "importance"         VARCHAR(64) NOT NULL,
  "occurred_on"        DATE NOT NULL,
  "identified_on"      DATE NOT NULL,
  "source_system"      VARCHAR(64) NOT NULL,
  "is_synthetic"       BOOLEAN NOT NULL,
  CONSTRAINT "pk_ctms_deviation" PRIMARY KEY ("deviation_id")
);
COMMENT ON TABLE "silver"."ctms_deviation" IS 'Protocol deviations logged in CTMS. Grain: One row per deviation.';
COMMENT ON COLUMN "silver"."ctms_deviation"."deviation_id" IS 'Deviation id.';
COMMENT ON COLUMN "silver"."ctms_deviation"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."ctms_deviation"."site_id" IS 'Site id.';
COMMENT ON COLUMN "silver"."ctms_deviation"."subject_id" IS 'Subject id.';
COMMENT ON COLUMN "silver"."ctms_deviation"."deviation_category" IS 'Deviation category.';
COMMENT ON COLUMN "silver"."ctms_deviation"."importance" IS 'Importance per ICH E3: important or not-important.';
COMMENT ON COLUMN "silver"."ctms_deviation"."occurred_on" IS 'Date the deviation occurred.';
COMMENT ON COLUMN "silver"."ctms_deviation"."identified_on" IS 'Date the deviation was identified.';
COMMENT ON COLUMN "silver"."ctms_deviation"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."ctms_deviation"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."ctms_site_staff" (
  "assignment_id"   VARCHAR(64) NOT NULL,
  "study_id"        VARCHAR(64) NOT NULL,
  "site_id"         VARCHAR(64) NOT NULL,
  "staff_role"      VARCHAR(64) NOT NULL,
  "investigator_id" VARCHAR(64) NOT NULL,
  "start_on"        DATE NOT NULL,
  "end_on"          DATE,
  "source_system"   VARCHAR(64) NOT NULL,
  "is_synthetic"    BOOLEAN NOT NULL,
  CONSTRAINT "pk_ctms_site_staff" PRIMARY KEY ("assignment_id"),
  CONSTRAINT "uq_ctms_site_staff_1" UNIQUE ("site_id", "start_on")
);
COMMENT ON TABLE "silver"."ctms_site_staff" IS 'Principal investigator assignments per site, from the CTMS site staff feed. Grain: One row per site staff assignment.';
COMMENT ON COLUMN "silver"."ctms_site_staff"."assignment_id" IS 'Assignment id.';
COMMENT ON COLUMN "silver"."ctms_site_staff"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."ctms_site_staff"."site_id" IS 'Site id.';
COMMENT ON COLUMN "silver"."ctms_site_staff"."staff_role" IS 'Staff role.';
COMMENT ON COLUMN "silver"."ctms_site_staff"."investigator_id" IS 'Fictional investigator id.';
COMMENT ON COLUMN "silver"."ctms_site_staff"."start_on" IS 'First day in the role.';
COMMENT ON COLUMN "silver"."ctms_site_staff"."end_on" IS 'Last day in the role, or null while still in it.';
COMMENT ON COLUMN "silver"."ctms_site_staff"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."ctms_site_staff"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."irt_randomization" (
  "randomization_id" VARCHAR(64) NOT NULL,
  "subject_id"       VARCHAR(64) NOT NULL,
  "study_id"         VARCHAR(64) NOT NULL,
  "site_id"          VARCHAR(64) NOT NULL,
  "randomized_at"    TIMESTAMPTZ NOT NULL,
  "arm"              VARCHAR(80) NOT NULL,
  "source_system"    VARCHAR(64) NOT NULL,
  "is_synthetic"     BOOLEAN NOT NULL,
  CONSTRAINT "pk_irt_randomization" PRIMARY KEY ("randomization_id"),
  CONSTRAINT "uq_irt_randomization_1" UNIQUE ("subject_id")
);
COMMENT ON TABLE "silver"."irt_randomization" IS 'IRT randomisations. The arm is restricted to unblinded roles. Grain: One row per randomisation.';
COMMENT ON COLUMN "silver"."irt_randomization"."randomization_id" IS 'Randomisation number.';
COMMENT ON COLUMN "silver"."irt_randomization"."subject_id" IS 'Subject id.';
COMMENT ON COLUMN "silver"."irt_randomization"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."irt_randomization"."site_id" IS 'Site id.';
COMMENT ON COLUMN "silver"."irt_randomization"."randomized_at" IS 'UTC time of randomisation.';
COMMENT ON COLUMN "silver"."irt_randomization"."arm" IS 'Assigned arm. Blinded consumers must not read it.';
COMMENT ON COLUMN "silver"."irt_randomization"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."irt_randomization"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."irt_kit" (
  "kit_id"        VARCHAR(64) NOT NULL,
  "study_id"      VARCHAR(64) NOT NULL,
  "site_id"       VARCHAR(64) NOT NULL,
  "subject_id"    VARCHAR(64),
  "received_on"   DATE NOT NULL,
  "dispensed_on"  DATE,
  "expires_on"    DATE NOT NULL,
  "kit_status"    VARCHAR(64) NOT NULL,
  "source_system" VARCHAR(64) NOT NULL,
  "is_synthetic"  BOOLEAN NOT NULL,
  CONSTRAINT "pk_irt_kit" PRIMARY KEY ("kit_id")
);
COMMENT ON TABLE "silver"."irt_kit" IS 'IRT investigational product kits. Grain: One row per kit.';
COMMENT ON COLUMN "silver"."irt_kit"."kit_id" IS 'Kit number.';
COMMENT ON COLUMN "silver"."irt_kit"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."irt_kit"."site_id" IS 'Site holding the kit.';
COMMENT ON COLUMN "silver"."irt_kit"."subject_id" IS 'Subject the kit was dispensed to.';
COMMENT ON COLUMN "silver"."irt_kit"."received_on" IS 'Date the site received the kit.';
COMMENT ON COLUMN "silver"."irt_kit"."dispensed_on" IS 'Dispensing date.';
COMMENT ON COLUMN "silver"."irt_kit"."expires_on" IS 'Expiry date.';
COMMENT ON COLUMN "silver"."irt_kit"."kit_status" IS 'State at the data cut.';
COMMENT ON COLUMN "silver"."irt_kit"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."irt_kit"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."etmf_document" (
  "document_id"     VARCHAR(64) NOT NULL,
  "study_id"        VARCHAR(64) NOT NULL,
  "site_id"         VARCHAR(64),
  "tmf_zone"        VARCHAR(80) NOT NULL,
  "artifact"        VARCHAR(120) NOT NULL,
  "due_on"          DATE NOT NULL,
  "filed_on"        DATE,
  "document_status" VARCHAR(64) NOT NULL,
  "source_system"   VARCHAR(64) NOT NULL,
  "is_synthetic"    BOOLEAN NOT NULL,
  CONSTRAINT "pk_etmf_document" PRIMARY KEY ("document_id")
);
COMMENT ON TABLE "silver"."etmf_document" IS 'eTMF expected documents, filed against the TMF Reference Model. Grain: One row per expected document.';
COMMENT ON COLUMN "silver"."etmf_document"."document_id" IS 'Document id.';
COMMENT ON COLUMN "silver"."etmf_document"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."etmf_document"."site_id" IS 'Site id, or null for a trial-level document.';
COMMENT ON COLUMN "silver"."etmf_document"."tmf_zone" IS 'TMF Reference Model zone.';
COMMENT ON COLUMN "silver"."etmf_document"."artifact" IS 'Artifact name.';
COMMENT ON COLUMN "silver"."etmf_document"."due_on" IS 'Date the document is due.';
COMMENT ON COLUMN "silver"."etmf_document"."filed_on" IS 'Filing date.';
COMMENT ON COLUMN "silver"."etmf_document"."document_status" IS 'Filed, missing or expected.';
COMMENT ON COLUMN "silver"."etmf_document"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."etmf_document"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."finance_line" (
  "study_id"         VARCHAR(64) NOT NULL,
  "vendor_id"        VARCHAR(64),
  "cost_category"    VARCHAR(64) NOT NULL,
  "fiscal_quarter"   VARCHAR(7) NOT NULL,
  "quarter_start_on" DATE NOT NULL,
  "budget_usd"       INTEGER NOT NULL,
  "actual_usd"       INTEGER NOT NULL,
  "source_system"    VARCHAR(64) NOT NULL,
  "is_synthetic"     BOOLEAN NOT NULL,
  CONSTRAINT "pk_finance_line" PRIMARY KEY ("study_id", "cost_category", "fiscal_quarter")
);
COMMENT ON TABLE "silver"."finance_line" IS 'Budget against actual per study, cost category and calendar quarter. Grain: One row per study, cost category and quarter.';
COMMENT ON COLUMN "silver"."finance_line"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."finance_line"."vendor_id" IS 'Vendor id, or null for investigator grants.';
COMMENT ON COLUMN "silver"."finance_line"."cost_category" IS 'Cost category.';
COMMENT ON COLUMN "silver"."finance_line"."fiscal_quarter" IS 'Calendar quarter, for example 2026-Q3.';
COMMENT ON COLUMN "silver"."finance_line"."quarter_start_on" IS 'First day of the quarter.';
COMMENT ON COLUMN "silver"."finance_line"."budget_usd" IS 'Budgeted amount, whole US dollars.';
COMMENT ON COLUMN "silver"."finance_line"."actual_usd" IS 'Actual spend, whole US dollars.';
COMMENT ON COLUMN "silver"."finance_line"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."finance_line"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "silver"."cec_adjudication" (
  "event_id"            VARCHAR(64) NOT NULL,
  "study_id"            VARCHAR(64) NOT NULL,
  "site_id"             VARCHAR(64) NOT NULL,
  "subject_id"          VARCHAR(64) NOT NULL,
  "site_event_type"     VARCHAR(80) NOT NULL,
  "site_device_related" BOOLEAN NOT NULL,
  "occurred_on"         DATE NOT NULL,
  "reported_on"         DATE NOT NULL,
  "adjudicated_on"      DATE,
  "cec_event_type"      VARCHAR(80),
  "cec_device_related"  BOOLEAN,
  "source_system"       VARCHAR(64) NOT NULL,
  "is_synthetic"        BOOLEAN NOT NULL,
  CONSTRAINT "pk_cec_adjudication" PRIMARY KEY ("event_id")
);
COMMENT ON TABLE "silver"."cec_adjudication" IS 'Clinical events committee adjudications of site-reported events. Grain: One row per adjudicated event.';
COMMENT ON COLUMN "silver"."cec_adjudication"."event_id" IS 'Event id.';
COMMENT ON COLUMN "silver"."cec_adjudication"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "silver"."cec_adjudication"."site_id" IS 'Site id.';
COMMENT ON COLUMN "silver"."cec_adjudication"."subject_id" IS 'Subject id.';
COMMENT ON COLUMN "silver"."cec_adjudication"."site_event_type" IS 'Event type as reported by the site.';
COMMENT ON COLUMN "silver"."cec_adjudication"."site_device_related" IS 'Whether the site judged the event device-related.';
COMMENT ON COLUMN "silver"."cec_adjudication"."occurred_on" IS 'Date the event occurred.';
COMMENT ON COLUMN "silver"."cec_adjudication"."reported_on" IS 'Date the site reported the event.';
COMMENT ON COLUMN "silver"."cec_adjudication"."adjudicated_on" IS 'Adjudication date, or null while pending.';
COMMENT ON COLUMN "silver"."cec_adjudication"."cec_event_type" IS 'Event type as adjudicated.';
COMMENT ON COLUMN "silver"."cec_adjudication"."cec_device_related" IS 'Whether the committee judged the event device-related.';
COMMENT ON COLUMN "silver"."cec_adjudication"."source_system" IS 'Source system the record came from.';
COMMENT ON COLUMN "silver"."cec_adjudication"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."dim_study" (
  "study_key"             INTEGER NOT NULL,
  "study_id"              VARCHAR(64) NOT NULL,
  "study_title"           VARCHAR(200) NOT NULL,
  "therapeutic_area"      VARCHAR(64) NOT NULL,
  "product_type"          VARCHAR(64) NOT NULL,
  "phase"                 VARCHAR(64) NOT NULL,
  "regulatory_path"       VARCHAR(64) NOT NULL,
  "operating_model"       VARCHAR(64) NOT NULL,
  "cro_vendor_id"         VARCHAR(64),
  "study_status"          VARCHAR(64) NOT NULL,
  "start_on"              DATE NOT NULL,
  "planned_enrollment"    INTEGER NOT NULL,
  "is_randomized"         BOOLEAN NOT NULL,
  "arm_count"             INTEGER NOT NULL,
  "has_cec_adjudication"  BOOLEAN NOT NULL,
  "study_data_product_id" VARCHAR(64),
  "is_synthetic"          BOOLEAN NOT NULL,
  CONSTRAINT "pk_dim_study" PRIMARY KEY ("study_key"),
  CONSTRAINT "uq_dim_study_1" UNIQUE ("study_id")
);
COMMENT ON TABLE "gold"."dim_study" IS 'Conformed study dimension. Grain: One row per study.';
COMMENT ON COLUMN "gold"."dim_study"."study_key" IS 'Surrogate key.';
COMMENT ON COLUMN "gold"."dim_study"."study_id" IS 'Protocol id, the natural key.';
COMMENT ON COLUMN "gold"."dim_study"."study_title" IS 'Short title.';
COMMENT ON COLUMN "gold"."dim_study"."therapeutic_area" IS 'Therapeutic area.';
COMMENT ON COLUMN "gold"."dim_study"."product_type" IS 'Investigational product type.';
COMMENT ON COLUMN "gold"."dim_study"."phase" IS 'Development phase or device study stage.';
COMMENT ON COLUMN "gold"."dim_study"."regulatory_path" IS 'IND or IDE.';
COMMENT ON COLUMN "gold"."dim_study"."operating_model" IS 'Sponsor or CRO.';
COMMENT ON COLUMN "gold"."dim_study"."cro_vendor_id" IS 'Vendor id of the CRO.';
COMMENT ON COLUMN "gold"."dim_study"."study_status" IS 'Lifecycle status at the data cut.';
COMMENT ON COLUMN "gold"."dim_study"."start_on" IS 'Date the protocol was finalised.';
COMMENT ON COLUMN "gold"."dim_study"."planned_enrollment" IS 'Enrollment target.';
COMMENT ON COLUMN "gold"."dim_study"."is_randomized" IS 'Whether subjects are randomised.';
COMMENT ON COLUMN "gold"."dim_study"."arm_count" IS 'Number of treatment arms.';
COMMENT ON COLUMN "gold"."dim_study"."has_cec_adjudication" IS 'Whether a clinical events committee adjudicates events.';
COMMENT ON COLUMN "gold"."dim_study"."study_data_product_id" IS 'Study Data Pipeline product id.';
COMMENT ON COLUMN "gold"."dim_study"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."dim_site" (
  "site_key"                  INTEGER NOT NULL,
  "site_id"                   VARCHAR(64) NOT NULL,
  "version_number"            INTEGER NOT NULL,
  "study_id"                  VARCHAR(64) NOT NULL,
  "site_number"               VARCHAR(64) NOT NULL,
  "site_name"                 VARCHAR(120) NOT NULL,
  "country_code"              VARCHAR(2) NOT NULL,
  "planned_enrollment"        INTEGER NOT NULL,
  "activated_on"              DATE,
  "site_status"               VARCHAR(64) NOT NULL,
  "principal_investigator_id" VARCHAR(64),
  "valid_from"                DATE NOT NULL,
  "valid_to"                  DATE NOT NULL,
  "is_current"                BOOLEAN NOT NULL,
  "is_synthetic"              BOOLEAN NOT NULL,
  CONSTRAINT "pk_dim_site" PRIMARY KEY ("site_key"),
  CONSTRAINT "uq_dim_site_1" UNIQUE ("site_id", "version_number"),
  CONSTRAINT "uq_dim_site_2" UNIQUE ("site_id", "valid_from")
);
COMMENT ON TABLE "gold"."dim_site" IS 'Conformed site dimension, slowly changing type 2 on site status and principal investigator. Grain: One row per site version: a new row each time the status or the principal investigator changes.';
COMMENT ON COLUMN "gold"."dim_site"."site_key" IS 'Surrogate key of the version.';
COMMENT ON COLUMN "gold"."dim_site"."site_id" IS 'Site id, the natural key.';
COMMENT ON COLUMN "gold"."dim_site"."version_number" IS 'Version of the site, from 1.';
COMMENT ON COLUMN "gold"."dim_site"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "gold"."dim_site"."site_number" IS 'Site number within the study.';
COMMENT ON COLUMN "gold"."dim_site"."site_name" IS 'Fictional site name.';
COMMENT ON COLUMN "gold"."dim_site"."country_code" IS 'ISO 3166-1 alpha-2 country code.';
COMMENT ON COLUMN "gold"."dim_site"."planned_enrollment" IS 'Enrollment target for the site.';
COMMENT ON COLUMN "gold"."dim_site"."activated_on" IS 'Activation date.';
COMMENT ON COLUMN "gold"."dim_site"."site_status" IS 'Status during the version: start-up, active or closed.';
COMMENT ON COLUMN "gold"."dim_site"."principal_investigator_id" IS 'Fictional id of the principal investigator during the version, or null when none is on file.';
COMMENT ON COLUMN "gold"."dim_site"."valid_from" IS 'First day the version is in force (inclusive).';
COMMENT ON COLUMN "gold"."dim_site"."valid_to" IS 'Day the next version takes over (exclusive), or 9999-12-31.';
COMMENT ON COLUMN "gold"."dim_site"."is_current" IS 'Whether this is the latest version.';
COMMENT ON COLUMN "gold"."dim_site"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."dim_country" (
  "country_key"  INTEGER NOT NULL,
  "country_code" VARCHAR(2) NOT NULL,
  "country_name" VARCHAR(64) NOT NULL,
  "region"       VARCHAR(64) NOT NULL,
  CONSTRAINT "pk_dim_country" PRIMARY KEY ("country_key"),
  CONSTRAINT "uq_dim_country_1" UNIQUE ("country_code")
);
COMMENT ON TABLE "gold"."dim_country" IS 'Conformed country dimension. Grain: One row per country with a site.';
COMMENT ON COLUMN "gold"."dim_country"."country_key" IS 'Surrogate key.';
COMMENT ON COLUMN "gold"."dim_country"."country_code" IS 'ISO 3166-1 alpha-2 country code.';
COMMENT ON COLUMN "gold"."dim_country"."country_name" IS 'English short name.';
COMMENT ON COLUMN "gold"."dim_country"."region" IS 'Operational region.';

CREATE TABLE "gold"."dim_date" (
  "date_key"        INTEGER NOT NULL,
  "calendar_date"   DATE NOT NULL,
  "year_number"     INTEGER NOT NULL,
  "quarter_number"  INTEGER NOT NULL,
  "month_number"    INTEGER NOT NULL,
  "month_name"      VARCHAR(9) NOT NULL,
  "day_of_month"    INTEGER NOT NULL,
  "iso_day_of_week" INTEGER NOT NULL,
  "year_month"      VARCHAR(7) NOT NULL,
  "year_quarter"    VARCHAR(7) NOT NULL,
  "is_month_end"    BOOLEAN NOT NULL,
  CONSTRAINT "pk_dim_date" PRIMARY KEY ("date_key"),
  CONSTRAINT "uq_dim_date_1" UNIQUE ("calendar_date")
);
COMMENT ON TABLE "gold"."dim_date" IS 'Conformed calendar dimension, whole years around every fact date. Grain: One row per calendar day.';
COMMENT ON COLUMN "gold"."dim_date"."date_key" IS 'Smart key, YYYYMMDD.';
COMMENT ON COLUMN "gold"."dim_date"."calendar_date" IS 'The day.';
COMMENT ON COLUMN "gold"."dim_date"."year_number" IS 'Calendar year.';
COMMENT ON COLUMN "gold"."dim_date"."quarter_number" IS 'Calendar quarter, 1 to 4.';
COMMENT ON COLUMN "gold"."dim_date"."month_number" IS 'Calendar month, 1 to 12.';
COMMENT ON COLUMN "gold"."dim_date"."month_name" IS 'English month name.';
COMMENT ON COLUMN "gold"."dim_date"."day_of_month" IS 'Day of the month.';
COMMENT ON COLUMN "gold"."dim_date"."iso_day_of_week" IS 'ISO 8601 day of the week, Monday 1 to Sunday 7.';
COMMENT ON COLUMN "gold"."dim_date"."year_month" IS 'Year and month, for example 2026-09.';
COMMENT ON COLUMN "gold"."dim_date"."year_quarter" IS 'Year and quarter, for example 2026-Q3.';
COMMENT ON COLUMN "gold"."dim_date"."is_month_end" IS 'Whether the day is the last of its month.';

CREATE TABLE "gold"."dim_vendor" (
  "vendor_key"     INTEGER NOT NULL,
  "vendor_id"      VARCHAR(64) NOT NULL,
  "vendor_name"    VARCHAR(120) NOT NULL,
  "vendor_service" VARCHAR(64) NOT NULL,
  "is_synthetic"   BOOLEAN NOT NULL,
  CONSTRAINT "pk_dim_vendor" PRIMARY KEY ("vendor_key"),
  CONSTRAINT "uq_dim_vendor_1" UNIQUE ("vendor_id")
);
COMMENT ON TABLE "gold"."dim_vendor" IS 'Conformed vendor dimension, with key 0 for spend that has no vendor (investigator grants). Grain: One row per vendor, plus the not-applicable member.';
COMMENT ON COLUMN "gold"."dim_vendor"."vendor_key" IS 'Surrogate key; 0 is the not-applicable member.';
COMMENT ON COLUMN "gold"."dim_vendor"."vendor_id" IS 'Vendor id, or N/A.';
COMMENT ON COLUMN "gold"."dim_vendor"."vendor_name" IS 'Fictional vendor name.';
COMMENT ON COLUMN "gold"."dim_vendor"."vendor_service" IS 'Service the vendor provides.';
COMMENT ON COLUMN "gold"."dim_vendor"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."dim_milestone" (
  "milestone_key"      INTEGER NOT NULL,
  "milestone_kind"     VARCHAR(64) NOT NULL,
  "milestone_name"     VARCHAR(80) NOT NULL,
  "milestone_sequence" INTEGER NOT NULL,
  CONSTRAINT "pk_dim_milestone" PRIMARY KEY ("milestone_key"),
  CONSTRAINT "uq_dim_milestone_1" UNIQUE ("milestone_kind")
);
COMMENT ON TABLE "gold"."dim_milestone" IS 'Conformed milestone dimension: the milestone kinds in lifecycle order. Grain: One row per milestone kind.';
COMMENT ON COLUMN "gold"."dim_milestone"."milestone_key" IS 'Surrogate key.';
COMMENT ON COLUMN "gold"."dim_milestone"."milestone_kind" IS 'Milestone kind.';
COMMENT ON COLUMN "gold"."dim_milestone"."milestone_name" IS 'Neutral display name.';
COMMENT ON COLUMN "gold"."dim_milestone"."milestone_sequence" IS 'Position in the study lifecycle, from 1.';

CREATE TABLE "gold"."dim_monitoring_plan" (
  "monitoring_plan_key"   INTEGER NOT NULL,
  "monitoring_plan_id"    VARCHAR(64) NOT NULL,
  "study_id"              VARCHAR(64) NOT NULL,
  "plan_version"          VARCHAR(16) NOT NULL,
  "effective_date_key"    INTEGER NOT NULL,
  "interim_interval_days" INTEGER NOT NULL,
  "visit_window_days"     INTEGER NOT NULL,
  "report_due_days"       INTEGER NOT NULL,
  "is_synthetic"          BOOLEAN NOT NULL,
  CONSTRAINT "pk_dim_monitoring_plan" PRIMARY KEY ("monitoring_plan_key"),
  CONSTRAINT "uq_dim_monitoring_plan_1" UNIQUE ("monitoring_plan_id"),
  CONSTRAINT "fk_dim_monitoring_plan_effective_date_key" FOREIGN KEY ("effective_date_key") REFERENCES "gold"."dim_date" ("date_key")
);
COMMENT ON TABLE "gold"."dim_monitoring_plan" IS 'Monitoring plan dimension: the cadence and report deadline each study''s plan sets, which monitoring is measured against. Grain: One row per monitoring plan version.';
COMMENT ON COLUMN "gold"."dim_monitoring_plan"."monitoring_plan_key" IS 'Surrogate key.';
COMMENT ON COLUMN "gold"."dim_monitoring_plan"."monitoring_plan_id" IS 'Monitoring plan id.';
COMMENT ON COLUMN "gold"."dim_monitoring_plan"."study_id" IS 'Protocol id.';
COMMENT ON COLUMN "gold"."dim_monitoring_plan"."plan_version" IS 'Plan version.';
COMMENT ON COLUMN "gold"."dim_monitoring_plan"."effective_date_key" IS 'Date the plan took effect.';
COMMENT ON COLUMN "gold"."dim_monitoring_plan"."interim_interval_days" IS 'Planned days from one monitoring visit at a site to the next interim visit.';
COMMENT ON COLUMN "gold"."dim_monitoring_plan"."visit_window_days" IS 'Days an interim visit may fall after its planned date and still be on time.';
COMMENT ON COLUMN "gold"."dim_monitoring_plan"."report_due_days" IS 'Days from a visit by which its report must be final.';
COMMENT ON COLUMN "gold"."dim_monitoring_plan"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."fct_enrollment" (
  "subject_id"            VARCHAR(64) NOT NULL,
  "event_type"            VARCHAR(64) NOT NULL,
  "study_key"             INTEGER NOT NULL,
  "site_key"              INTEGER NOT NULL,
  "country_key"           INTEGER NOT NULL,
  "event_date_key"        INTEGER NOT NULL,
  "subject_status"        VARCHAR(64) NOT NULL,
  "screen_failure_reason" VARCHAR(40),
  "event_count"           INTEGER NOT NULL,
  "is_synthetic"          BOOLEAN NOT NULL,
  CONSTRAINT "pk_fct_enrollment" PRIMARY KEY ("subject_id", "event_type"),
  CONSTRAINT "fk_fct_enrollment_study_key" FOREIGN KEY ("study_key") REFERENCES "gold"."dim_study" ("study_key"),
  CONSTRAINT "fk_fct_enrollment_site_key" FOREIGN KEY ("site_key") REFERENCES "gold"."dim_site" ("site_key"),
  CONSTRAINT "fk_fct_enrollment_country_key" FOREIGN KEY ("country_key") REFERENCES "gold"."dim_country" ("country_key"),
  CONSTRAINT "fk_fct_enrollment_event_date_key" FOREIGN KEY ("event_date_key") REFERENCES "gold"."dim_date" ("date_key")
);
COMMENT ON TABLE "gold"."fct_enrollment" IS 'Subject enrollment events: screened, enrolled, completed and discontinued. Grain: One row per subject per enrollment event.';
COMMENT ON COLUMN "gold"."fct_enrollment"."subject_id" IS 'Subject id (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_enrollment"."event_type" IS 'screened, enrolled, completed or discontinued.';
COMMENT ON COLUMN "gold"."fct_enrollment"."study_key" IS 'Study.';
COMMENT ON COLUMN "gold"."fct_enrollment"."site_key" IS 'Site version in force on the event date.';
COMMENT ON COLUMN "gold"."fct_enrollment"."country_key" IS 'Country of the site.';
COMMENT ON COLUMN "gold"."fct_enrollment"."event_date_key" IS 'Date of the event.';
COMMENT ON COLUMN "gold"."fct_enrollment"."subject_status" IS 'Subject status at the data cut.';
COMMENT ON COLUMN "gold"."fct_enrollment"."screen_failure_reason" IS 'Why screening failed; null unless the subject failed screening (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_enrollment"."event_count" IS 'Always 1: the additive measure.';
COMMENT ON COLUMN "gold"."fct_enrollment"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."fct_visit" (
  "visit_id"         VARCHAR(64) NOT NULL,
  "subject_id"       VARCHAR(64) NOT NULL,
  "planned_visit_id" VARCHAR(64) NOT NULL,
  "study_key"        INTEGER NOT NULL,
  "site_key"         INTEGER NOT NULL,
  "country_key"      INTEGER NOT NULL,
  "visit_date_key"   INTEGER,
  "planned_date_key" INTEGER NOT NULL,
  "visit_status"     VARCHAR(64) NOT NULL,
  "day_offset"       INTEGER,
  "is_out_of_window" BOOLEAN NOT NULL,
  "entry_lag_days"   INTEGER,
  "is_synthetic"     BOOLEAN NOT NULL,
  CONSTRAINT "pk_fct_visit" PRIMARY KEY ("visit_id"),
  CONSTRAINT "fk_fct_visit_study_key" FOREIGN KEY ("study_key") REFERENCES "gold"."dim_study" ("study_key"),
  CONSTRAINT "fk_fct_visit_site_key" FOREIGN KEY ("site_key") REFERENCES "gold"."dim_site" ("site_key"),
  CONSTRAINT "fk_fct_visit_country_key" FOREIGN KEY ("country_key") REFERENCES "gold"."dim_country" ("country_key"),
  CONSTRAINT "fk_fct_visit_visit_date_key" FOREIGN KEY ("visit_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_visit_planned_date_key" FOREIGN KEY ("planned_date_key") REFERENCES "gold"."dim_date" ("date_key")
);
COMMENT ON TABLE "gold"."fct_visit" IS 'Subject visits against the schedule, with entry timeliness. Grain: One row per subject visit record.';
COMMENT ON COLUMN "gold"."fct_visit"."visit_id" IS 'Visit record id (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_visit"."subject_id" IS 'Subject id (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_visit"."planned_visit_id" IS 'Planned visit id.';
COMMENT ON COLUMN "gold"."fct_visit"."study_key" IS 'Study.';
COMMENT ON COLUMN "gold"."fct_visit"."site_key" IS 'Site version in force on the visit date, or the planned date of a missed visit.';
COMMENT ON COLUMN "gold"."fct_visit"."country_key" IS 'Country of the site.';
COMMENT ON COLUMN "gold"."fct_visit"."visit_date_key" IS 'Visit date, or null for a missed visit.';
COMMENT ON COLUMN "gold"."fct_visit"."planned_date_key" IS 'Planned date: enrollment plus the planned day.';
COMMENT ON COLUMN "gold"."fct_visit"."visit_status" IS 'entered, pending-entry or missed.';
COMMENT ON COLUMN "gold"."fct_visit"."day_offset" IS 'Actual minus planned day.';
COMMENT ON COLUMN "gold"."fct_visit"."is_out_of_window" IS 'Whether the visit fell outside its window.';
COMMENT ON COLUMN "gold"."fct_visit"."entry_lag_days" IS 'Days from the visit to data entry.';
COMMENT ON COLUMN "gold"."fct_visit"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."fct_query" (
  "query_id"          VARCHAR(64) NOT NULL,
  "visit_id"          VARCHAR(64) NOT NULL,
  "subject_id"        VARCHAR(64) NOT NULL,
  "study_key"         INTEGER NOT NULL,
  "site_key"          INTEGER NOT NULL,
  "country_key"       INTEGER NOT NULL,
  "opened_date_key"   INTEGER NOT NULL,
  "answered_date_key" INTEGER,
  "closed_date_key"   INTEGER,
  "queried_field"     VARCHAR(64) NOT NULL,
  "queried_form"      VARCHAR(8) NOT NULL,
  "query_origin"      VARCHAR(64) NOT NULL,
  "query_status"      VARCHAR(64) NOT NULL,
  "minutes_to_answer" INTEGER,
  "minutes_to_close"  INTEGER,
  "is_synthetic"      BOOLEAN NOT NULL,
  CONSTRAINT "pk_fct_query" PRIMARY KEY ("query_id"),
  CONSTRAINT "fk_fct_query_study_key" FOREIGN KEY ("study_key") REFERENCES "gold"."dim_study" ("study_key"),
  CONSTRAINT "fk_fct_query_site_key" FOREIGN KEY ("site_key") REFERENCES "gold"."dim_site" ("site_key"),
  CONSTRAINT "fk_fct_query_country_key" FOREIGN KEY ("country_key") REFERENCES "gold"."dim_country" ("country_key"),
  CONSTRAINT "fk_fct_query_opened_date_key" FOREIGN KEY ("opened_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_query_answered_date_key" FOREIGN KEY ("answered_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_query_closed_date_key" FOREIGN KEY ("closed_date_key") REFERENCES "gold"."dim_date" ("date_key")
);
COMMENT ON TABLE "gold"."fct_query" IS 'Data queries with their resolution times. Grain: One row per query.';
COMMENT ON COLUMN "gold"."fct_query"."query_id" IS 'Query id (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_query"."visit_id" IS 'Visit record id (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_query"."subject_id" IS 'Subject id (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_query"."study_key" IS 'Study.';
COMMENT ON COLUMN "gold"."fct_query"."site_key" IS 'Site version in force when the query opened.';
COMMENT ON COLUMN "gold"."fct_query"."country_key" IS 'Country of the site.';
COMMENT ON COLUMN "gold"."fct_query"."opened_date_key" IS 'UTC date the query opened.';
COMMENT ON COLUMN "gold"."fct_query"."answered_date_key" IS 'UTC date the site answered.';
COMMENT ON COLUMN "gold"."fct_query"."closed_date_key" IS 'UTC date the query closed.';
COMMENT ON COLUMN "gold"."fct_query"."queried_field" IS 'Queried field, as DOMAIN.VARIABLE.';
COMMENT ON COLUMN "gold"."fct_query"."queried_form" IS 'CRF form of the queried field: its CDASH domain, the part of queried_field before the dot.';
COMMENT ON COLUMN "gold"."fct_query"."query_origin" IS 'edit-check or manual.';
COMMENT ON COLUMN "gold"."fct_query"."query_status" IS 'State at the data cut.';
COMMENT ON COLUMN "gold"."fct_query"."minutes_to_answer" IS 'Minutes from opening to the site''s answer.';
COMMENT ON COLUMN "gold"."fct_query"."minutes_to_close" IS 'Minutes from opening to closing.';
COMMENT ON COLUMN "gold"."fct_query"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."fct_deviation" (
  "deviation_id"        VARCHAR(64) NOT NULL,
  "subject_id"          VARCHAR(64) NOT NULL,
  "study_key"           INTEGER NOT NULL,
  "site_key"            INTEGER NOT NULL,
  "country_key"         INTEGER NOT NULL,
  "occurred_date_key"   INTEGER NOT NULL,
  "identified_date_key" INTEGER NOT NULL,
  "deviation_category"  VARCHAR(80) NOT NULL,
  "importance"          VARCHAR(64) NOT NULL,
  "is_important"        BOOLEAN NOT NULL,
  "days_to_identify"    INTEGER NOT NULL,
  "is_synthetic"        BOOLEAN NOT NULL,
  CONSTRAINT "pk_fct_deviation" PRIMARY KEY ("deviation_id"),
  CONSTRAINT "fk_fct_deviation_study_key" FOREIGN KEY ("study_key") REFERENCES "gold"."dim_study" ("study_key"),
  CONSTRAINT "fk_fct_deviation_site_key" FOREIGN KEY ("site_key") REFERENCES "gold"."dim_site" ("site_key"),
  CONSTRAINT "fk_fct_deviation_country_key" FOREIGN KEY ("country_key") REFERENCES "gold"."dim_country" ("country_key"),
  CONSTRAINT "fk_fct_deviation_occurred_date_key" FOREIGN KEY ("occurred_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_deviation_identified_date_key" FOREIGN KEY ("identified_date_key") REFERENCES "gold"."dim_date" ("date_key")
);
COMMENT ON TABLE "gold"."fct_deviation" IS 'Protocol deviations with their time to identification. Grain: One row per protocol deviation.';
COMMENT ON COLUMN "gold"."fct_deviation"."deviation_id" IS 'Deviation id (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_deviation"."subject_id" IS 'Subject id (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_deviation"."study_key" IS 'Study.';
COMMENT ON COLUMN "gold"."fct_deviation"."site_key" IS 'Site version in force when the deviation occurred.';
COMMENT ON COLUMN "gold"."fct_deviation"."country_key" IS 'Country of the site.';
COMMENT ON COLUMN "gold"."fct_deviation"."occurred_date_key" IS 'Date the deviation occurred.';
COMMENT ON COLUMN "gold"."fct_deviation"."identified_date_key" IS 'Date the deviation was identified.';
COMMENT ON COLUMN "gold"."fct_deviation"."deviation_category" IS 'Deviation category.';
COMMENT ON COLUMN "gold"."fct_deviation"."importance" IS 'important or not-important.';
COMMENT ON COLUMN "gold"."fct_deviation"."is_important" IS 'Whether the deviation is important per ICH E3.';
COMMENT ON COLUMN "gold"."fct_deviation"."days_to_identify" IS 'Days from occurrence to identification.';
COMMENT ON COLUMN "gold"."fct_deviation"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."fct_monitoring_visit" (
  "monitoring_visit_id"   VARCHAR(64) NOT NULL,
  "study_key"             INTEGER NOT NULL,
  "site_key"              INTEGER NOT NULL,
  "country_key"           INTEGER NOT NULL,
  "visit_date_key"        INTEGER NOT NULL,
  "report_final_date_key" INTEGER,
  "monitoring_plan_key"   INTEGER NOT NULL,
  "report_due_date_key"   INTEGER NOT NULL,
  "visit_type"            VARCHAR(64) NOT NULL,
  "visit_mode"            VARCHAR(64) NOT NULL,
  "sdv_pages_due"         INTEGER NOT NULL,
  "sdv_pages_verified"    INTEGER NOT NULL,
  "action_items"          INTEGER NOT NULL,
  "days_to_final_report"  INTEGER,
  "is_synthetic"          BOOLEAN NOT NULL,
  CONSTRAINT "pk_fct_monitoring_visit" PRIMARY KEY ("monitoring_visit_id"),
  CONSTRAINT "fk_fct_monitoring_visit_study_key" FOREIGN KEY ("study_key") REFERENCES "gold"."dim_study" ("study_key"),
  CONSTRAINT "fk_fct_monitoring_visit_site_key" FOREIGN KEY ("site_key") REFERENCES "gold"."dim_site" ("site_key"),
  CONSTRAINT "fk_fct_monitoring_visit_country_key" FOREIGN KEY ("country_key") REFERENCES "gold"."dim_country" ("country_key"),
  CONSTRAINT "fk_fct_monitoring_visit_visit_date_key" FOREIGN KEY ("visit_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_monitoring_visit_report_final_date_key" FOREIGN KEY ("report_final_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_monitoring_visit_monitoring_plan_key" FOREIGN KEY ("monitoring_plan_key") REFERENCES "gold"."dim_monitoring_plan" ("monitoring_plan_key"),
  CONSTRAINT "fk_fct_monitoring_visit_report_due_date_key" FOREIGN KEY ("report_due_date_key") REFERENCES "gold"."dim_date" ("date_key")
);
COMMENT ON TABLE "gold"."fct_monitoring_visit" IS 'Monitoring visits with source data verification and report timeliness. Grain: One row per monitoring visit.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."monitoring_visit_id" IS 'Monitoring visit id (degenerate dimension).';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."study_key" IS 'Study.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."site_key" IS 'Site version in force on the visit date.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."country_key" IS 'Country of the site.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."visit_date_key" IS 'Visit date.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."report_final_date_key" IS 'Date the report was finalised.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."monitoring_plan_key" IS 'Monitoring plan in force on the visit date.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."report_due_date_key" IS 'Date the report is due: the visit date plus the plan''s report deadline.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."visit_type" IS 'SIV, IMV or COV.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."visit_mode" IS 'On-site or remote.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."sdv_pages_due" IS 'CRF pages due for source data verification.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."sdv_pages_verified" IS 'CRF pages source-verified.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."action_items" IS 'Action items raised.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."days_to_final_report" IS 'Days from the visit to the final report.';
COMMENT ON COLUMN "gold"."fct_monitoring_visit"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."fct_planned_monitoring_visit" (
  "planned_visit_id"    VARCHAR(64) NOT NULL,
  "monitoring_plan_key" INTEGER NOT NULL,
  "study_key"           INTEGER NOT NULL,
  "site_key"            INTEGER NOT NULL,
  "country_key"         INTEGER NOT NULL,
  "planned_date_key"    INTEGER NOT NULL,
  "due_date_key"        INTEGER NOT NULL,
  "monitoring_visit_id" VARCHAR(64),
  "actual_date_key"     INTEGER,
  "days_late"           INTEGER,
  "is_synthetic"        BOOLEAN NOT NULL,
  CONSTRAINT "pk_fct_planned_monitoring_visit" PRIMARY KEY ("planned_visit_id"),
  CONSTRAINT "fk_fct_planned_monitoring_visit_monitoring_plan_key" FOREIGN KEY ("monitoring_plan_key") REFERENCES "gold"."dim_monitoring_plan" ("monitoring_plan_key"),
  CONSTRAINT "fk_fct_planned_monitoring_visit_study_key" FOREIGN KEY ("study_key") REFERENCES "gold"."dim_study" ("study_key"),
  CONSTRAINT "fk_fct_planned_monitoring_visit_site_key" FOREIGN KEY ("site_key") REFERENCES "gold"."dim_site" ("site_key"),
  CONSTRAINT "fk_fct_planned_monitoring_visit_country_key" FOREIGN KEY ("country_key") REFERENCES "gold"."dim_country" ("country_key"),
  CONSTRAINT "fk_fct_planned_monitoring_visit_planned_date_key" FOREIGN KEY ("planned_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_planned_monitoring_visit_due_date_key" FOREIGN KEY ("due_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_planned_monitoring_visit_actual_date_key" FOREIGN KEY ("actual_date_key") REFERENCES "gold"."dim_date" ("date_key")
);
COMMENT ON TABLE "gold"."fct_planned_monitoring_visit" IS 'Interim monitoring visits the monitoring plan schedules at each active site, each against the visit that met it. Grain: One row per planned interim monitoring visit: one per interim visit made, plus the next one due at each site still being monitored.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."planned_visit_id" IS 'Planned visit id (degenerate dimension): the site id and its sequence.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."monitoring_plan_key" IS 'Monitoring plan the visit is scheduled under.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."study_key" IS 'Study.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."site_key" IS 'Site version in force on the planned date.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."country_key" IS 'Country of the site.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."planned_date_key" IS 'Planned date: the previous monitoring visit at the site plus the plan''s interval.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."due_date_key" IS 'Last on-time date: the planned date plus the plan''s visit window.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."monitoring_visit_id" IS 'Interim visit that met the planned visit, or null while it is outstanding.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."actual_date_key" IS 'Date of the visit that met it, or null while it is outstanding.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."days_late" IS 'Days the visit fell after its due date, 0 when on time, or null while it is outstanding.';
COMMENT ON COLUMN "gold"."fct_planned_monitoring_visit"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."fct_milestone" (
  "study_key"        INTEGER NOT NULL,
  "milestone_key"    INTEGER NOT NULL,
  "milestone_label"  VARCHAR(120) NOT NULL,
  "planned_date_key" INTEGER NOT NULL,
  "actual_date_key"  INTEGER,
  "variance_days"    INTEGER,
  "is_reached"       BOOLEAN NOT NULL,
  "is_synthetic"     BOOLEAN NOT NULL,
  CONSTRAINT "pk_fct_milestone" PRIMARY KEY ("study_key", "milestone_key"),
  CONSTRAINT "fk_fct_milestone_study_key" FOREIGN KEY ("study_key") REFERENCES "gold"."dim_study" ("study_key"),
  CONSTRAINT "fk_fct_milestone_milestone_key" FOREIGN KEY ("milestone_key") REFERENCES "gold"."dim_milestone" ("milestone_key"),
  CONSTRAINT "fk_fct_milestone_planned_date_key" FOREIGN KEY ("planned_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_milestone_actual_date_key" FOREIGN KEY ("actual_date_key") REFERENCES "gold"."dim_date" ("date_key")
);
COMMENT ON TABLE "gold"."fct_milestone" IS 'Study milestones, planned against actual. Grain: One row per study and milestone kind.';
COMMENT ON COLUMN "gold"."fct_milestone"."study_key" IS 'Study.';
COMMENT ON COLUMN "gold"."fct_milestone"."milestone_key" IS 'Milestone kind.';
COMMENT ON COLUMN "gold"."fct_milestone"."milestone_label" IS 'Label in the study''s own vocabulary.';
COMMENT ON COLUMN "gold"."fct_milestone"."planned_date_key" IS 'Planned date.';
COMMENT ON COLUMN "gold"."fct_milestone"."actual_date_key" IS 'Actual date, or null when not reached.';
COMMENT ON COLUMN "gold"."fct_milestone"."variance_days" IS 'Actual minus planned date, in days.';
COMMENT ON COLUMN "gold"."fct_milestone"."is_reached" IS 'Whether the milestone was reached by the data cut.';
COMMENT ON COLUMN "gold"."fct_milestone"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."fct_spend" (
  "study_key"      INTEGER NOT NULL,
  "vendor_key"     INTEGER NOT NULL,
  "month_date_key" INTEGER NOT NULL,
  "budget_usd"     INTEGER NOT NULL,
  "actual_usd"     INTEGER NOT NULL,
  "variance_usd"   INTEGER NOT NULL,
  "is_synthetic"   BOOLEAN NOT NULL,
  CONSTRAINT "pk_fct_spend" PRIMARY KEY ("study_key", "vendor_key", "month_date_key"),
  CONSTRAINT "fk_fct_spend_study_key" FOREIGN KEY ("study_key") REFERENCES "gold"."dim_study" ("study_key"),
  CONSTRAINT "fk_fct_spend_vendor_key" FOREIGN KEY ("vendor_key") REFERENCES "gold"."dim_vendor" ("vendor_key"),
  CONSTRAINT "fk_fct_spend_month_date_key" FOREIGN KEY ("month_date_key") REFERENCES "gold"."dim_date" ("date_key")
);
COMMENT ON TABLE "gold"."fct_spend" IS 'Budget against actual spend, with each quarter spread evenly over its three months. Grain: One row per study, vendor and calendar month.';
COMMENT ON COLUMN "gold"."fct_spend"."study_key" IS 'Study.';
COMMENT ON COLUMN "gold"."fct_spend"."vendor_key" IS 'Vendor; 0 for investigator grants.';
COMMENT ON COLUMN "gold"."fct_spend"."month_date_key" IS 'First day of the month.';
COMMENT ON COLUMN "gold"."fct_spend"."budget_usd" IS 'Budgeted amount, whole US dollars.';
COMMENT ON COLUMN "gold"."fct_spend"."actual_usd" IS 'Actual spend, whole US dollars.';
COMMENT ON COLUMN "gold"."fct_spend"."variance_usd" IS 'Actual minus budget, whole US dollars.';
COMMENT ON COLUMN "gold"."fct_spend"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';

CREATE TABLE "gold"."fct_kri_snapshot" (
  "site_key"          INTEGER NOT NULL,
  "snapshot_date_key" INTEGER NOT NULL,
  "kri_id"            VARCHAR(32) NOT NULL,
  "study_key"         INTEGER NOT NULL,
  "country_key"       INTEGER NOT NULL,
  "numerator"         INTEGER NOT NULL,
  "denominator"       INTEGER NOT NULL,
  "kri_value"         NUMERIC(12, 4),
  "is_synthetic"      BOOLEAN NOT NULL,
  CONSTRAINT "pk_fct_kri_snapshot" PRIMARY KEY ("site_key", "snapshot_date_key", "kri_id"),
  CONSTRAINT "fk_fct_kri_snapshot_site_key" FOREIGN KEY ("site_key") REFERENCES "gold"."dim_site" ("site_key"),
  CONSTRAINT "fk_fct_kri_snapshot_snapshot_date_key" FOREIGN KEY ("snapshot_date_key") REFERENCES "gold"."dim_date" ("date_key"),
  CONSTRAINT "fk_fct_kri_snapshot_study_key" FOREIGN KEY ("study_key") REFERENCES "gold"."dim_study" ("study_key"),
  CONSTRAINT "fk_fct_kri_snapshot_country_key" FOREIGN KEY ("country_key") REFERENCES "gold"."dim_country" ("country_key")
);
COMMENT ON TABLE "gold"."fct_kri_snapshot" IS 'Month-end key risk indicator snapshots per site, cumulative from activation to the snapshot date. Grain: One row per site, month-end snapshot date and key risk indicator.';
COMMENT ON COLUMN "gold"."fct_kri_snapshot"."site_key" IS 'Site version in force on the snapshot date.';
COMMENT ON COLUMN "gold"."fct_kri_snapshot"."snapshot_date_key" IS 'Month-end snapshot date.';
COMMENT ON COLUMN "gold"."fct_kri_snapshot"."kri_id" IS 'Key risk indicator: query-rate, missed-visit-rate, important-deviation-rate or entry-lag-days.';
COMMENT ON COLUMN "gold"."fct_kri_snapshot"."study_key" IS 'Study.';
COMMENT ON COLUMN "gold"."fct_kri_snapshot"."country_key" IS 'Country of the site.';
COMMENT ON COLUMN "gold"."fct_kri_snapshot"."numerator" IS 'Numerator, cumulative to the snapshot date.';
COMMENT ON COLUMN "gold"."fct_kri_snapshot"."denominator" IS 'Denominator, cumulative to the snapshot date.';
COMMENT ON COLUMN "gold"."fct_kri_snapshot"."kri_value" IS 'Numerator over denominator, to 4 places; null when the denominator is 0.';
COMMENT ON COLUMN "gold"."fct_kri_snapshot"."is_synthetic" IS 'Always true: the row describes synthetic data, nothing real.';
