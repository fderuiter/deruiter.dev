/**
 * The silver layer: each bronze feed conformed to snake-case columns,
 * standard keys, ISO 8601 dates and UTC timestamps, and de-duplicated on its
 * primary key.
 */
import type { Portfolio, SiteStaffAssignment, WarehouseRow } from "../../types";
import { siteStaffFeed } from "../portfolio/staff";

/** Silver rows per table name (without the `silver.` prefix). */
export type SilverTables = Readonly<Record<string, readonly WarehouseRow[]>>;

/**
 * Keeps one row per key. A later record for a key replaces the earlier one,
 * as a resent record supersedes the first delivery; the row keeps the
 * position of the key's first appearance.
 */
export function dedupe(
  rows: readonly WarehouseRow[],
  keyColumns: readonly string[]
): WarehouseRow[] {
  const byKey = new Map<string, WarehouseRow>();
  for (const row of rows) {
    byKey.set(JSON.stringify(keyColumns.map((name) => row[name])), row);
  }
  return [...byKey.values()];
}

/** First day of a `YYYY-Qn` quarter, as an ISO 8601 date. */
export function quarterStart(period: string): string {
  const match = /^(\d{4})-Q([1-4])$/.exec(period);
  if (!match) throw new RangeError(`"${period}" is not a YYYY-Qn quarter`);
  const month = (Number(match[2]) - 1) * 3 + 1;
  return `${match[1]}-${String(month).padStart(2, "0")}-01`;
}

const UTC_SECONDS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/** Normalises an ISO 8601 UTC timestamp to `YYYY-MM-DDTHH:MM:SSZ`. */
export function utcTimestamp(value: string | null): string | null {
  if (value === null) return null;
  if (UTC_SECONDS.test(value)) return value;
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new RangeError(`"${value}" is not a timestamp`);
  return `${new Date(ms).toISOString().slice(0, 19)}Z`;
}

/**
 * Conforms every bronze feed of a portfolio to its silver columns. The rows
 * are not yet de-duplicated: the caller keeps one row per primary key with
 * `dedupe`, reading the key from the schema.
 *
 * @param portfolio - The portfolio, from `generatePortfolio`.
 * @param staff - Site staff assignments; defaults to `siteStaffFeed(portfolio)`.
 * @returns Conformed rows per silver table.
 */
export function conformBronze(
  portfolio: Portfolio,
  staff: readonly SiteStaffAssignment[] = siteStaffFeed(portfolio)
): SilverTables {
  const { edc, ctms, irt, etmf, finance, financePlan, cec } = portfolio.feeds;
  return {
    study: portfolio.studies.map((s) => ({
      study_id: s.id,
      study_title: s.title,
      therapeutic_area: s.therapeuticArea,
      product_type: s.productType,
      phase: s.phase,
      regulatory_path: s.regulatoryPath,
      operating_model: s.operatingModel,
      cro_vendor_id: s.croVendorId,
      study_status: s.status,
      start_on: s.startOn,
      planned_enrollment: s.plannedEnrollment,
      is_randomized: s.randomized,
      arm_count: s.arms.length,
      schedule_source: s.scheduleSource,
      has_cec_adjudication: s.cecAdjudication,
      study_data_product_id: s.studyDataProductId,
      is_synthetic: s.synthetic,
    })),
    planned_visit: portfolio.studies.flatMap((s) =>
      s.plannedVisits.map((v, index) => ({
        study_id: s.id,
        planned_visit_id: v.id,
        visit_sequence: index + 1,
        visit_name: v.name,
        planned_day: v.day,
        window_days: v.windowDays,
        dispenses_product: v.dispensesProduct,
        is_synthetic: s.synthetic,
      }))
    ),
    site: portfolio.sites.map((s) => ({
      site_id: s.id,
      study_id: s.studyId,
      site_number: s.siteNumber,
      country_code: s.country.toUpperCase(),
      site_name: s.name,
      planned_enrollment: s.plannedEnrollment,
      selected_on: s.selectedOn,
      contracted_on: s.contractedOn,
      irb_approved_on: s.irbApprovedOn,
      activated_on: s.activatedOn,
      is_synthetic: s.synthetic,
    })),
    vendor: portfolio.vendors.map((v) => ({
      vendor_id: v.id,
      vendor_name: v.name,
      service: v.service,
      is_synthetic: v.synthetic,
    })),
    edc_subject: edc.subjects.map((s) => ({
      subject_id: s.subjectId,
      study_id: s.studyId,
      site_id: s.siteId,
      screened_on: s.screenedOn,
      enrolled_on: s.enrolledOn,
      completed_on: s.completedOn,
      discontinued_on: s.discontinuedOn,
      subject_status: s.status,
      screen_failure_reason: s.screenFailureReason,
      source_system: s.source,
      is_synthetic: s.synthetic,
    })),
    edc_visit: edc.visits.map((v) => ({
      visit_id: v.visitId,
      subject_id: v.subjectId,
      study_id: v.studyId,
      site_id: v.siteId,
      planned_visit_id: v.plannedVisitId,
      visit_date: v.visitDate,
      day_offset: v.dayOffset,
      data_entered_at: utcTimestamp(v.dataEnteredAt),
      visit_status: v.status,
      source_system: v.source,
      is_synthetic: v.synthetic,
    })),
    edc_query: edc.queries.map((q) => ({
      query_id: q.queryId,
      visit_id: q.visitId,
      subject_id: q.subjectId,
      study_id: q.studyId,
      site_id: q.siteId,
      queried_field: q.field,
      query_origin: q.origin,
      opened_at: utcTimestamp(q.openedAt),
      answered_at: utcTimestamp(q.answeredAt),
      closed_at: utcTimestamp(q.closedAt),
      query_status: q.status,
      source_system: q.source,
      is_synthetic: q.synthetic,
    })),
    edc_adverse_event: edc.adverseEvents.map((e) => ({
      ae_id: e.aeId,
      visit_id: e.visitId,
      subject_id: e.subjectId,
      study_id: e.studyId,
      site_id: e.siteId,
      ae_term: e.term,
      onset_on: e.onsetOn,
      reported_on: e.reportedOn,
      is_serious: e.serious,
      severity: e.severity,
      source_system: e.source,
      is_synthetic: e.synthetic,
    })),
    edc_vital_sign: edc.vitalSigns.map((v) => ({
      vital_sign_id: v.vitalSignId,
      visit_id: v.visitId,
      subject_id: v.subjectId,
      study_id: v.studyId,
      site_id: v.siteId,
      vs_test_code: v.test,
      vs_value: v.value,
      vs_unit: v.unit,
      measured_on: v.measuredOn,
      source_system: v.source,
      is_synthetic: v.synthetic,
    })),
    ctms_milestone: ctms.milestones.map((m) => ({
      study_id: m.studyId,
      milestone_kind: m.kind,
      milestone_label: m.label,
      planned_on: m.plannedOn,
      actual_on: m.actualOn,
      source_system: m.source,
      is_synthetic: m.synthetic,
    })),
    ctms_monitoring_plan: ctms.monitoringPlans.map((p) => ({
      monitoring_plan_id: p.monitoringPlanId,
      study_id: p.studyId,
      plan_version: p.version,
      effective_on: p.effectiveOn,
      interim_interval_days: p.interimIntervalDays,
      visit_window_days: p.visitWindowDays,
      report_due_days: p.reportDueDays,
      source_system: p.source,
      is_synthetic: p.synthetic,
    })),
    ctms_monitoring_visit: ctms.monitoringVisits.map((m) => ({
      monitoring_visit_id: m.monitoringVisitId,
      study_id: m.studyId,
      site_id: m.siteId,
      visit_type: m.type,
      visit_mode: m.mode,
      visit_date: m.visitDate,
      report_final_on: m.reportFinalOn,
      sdv_pages_due: m.sdvPagesDue,
      sdv_pages_verified: m.sdvPagesVerified,
      action_items: m.actionItems,
      source_system: m.source,
      is_synthetic: m.synthetic,
    })),
    ctms_deviation: ctms.deviations.map((d) => ({
      deviation_id: d.deviationId,
      study_id: d.studyId,
      site_id: d.siteId,
      subject_id: d.subjectId,
      deviation_category: d.category,
      importance: d.importance,
      occurred_on: d.occurredOn,
      identified_on: d.identifiedOn,
      source_system: d.source,
      is_synthetic: d.synthetic,
    })),
    ctms_site_staff: staff.map((a) => ({
      assignment_id: a.assignmentId,
      study_id: a.studyId,
      site_id: a.siteId,
      staff_role: a.role,
      investigator_id: a.investigatorId,
      start_on: a.startOn,
      end_on: a.endOn,
      source_system: a.source,
      is_synthetic: a.synthetic,
    })),
    irt_randomization: irt.randomizations.map((r) => ({
      randomization_id: r.randomizationId,
      subject_id: r.subjectId,
      study_id: r.studyId,
      site_id: r.siteId,
      randomized_at: utcTimestamp(r.randomizedAt),
      arm: r.arm,
      source_system: r.source,
      is_synthetic: r.synthetic,
    })),
    irt_kit: irt.kits.map((k) => ({
      kit_id: k.kitId,
      study_id: k.studyId,
      site_id: k.siteId,
      subject_id: k.subjectId,
      received_on: k.receivedOn,
      dispensed_on: k.dispensedOn,
      expires_on: k.expiresOn,
      kit_status: k.status,
      source_system: k.source,
      is_synthetic: k.synthetic,
    })),
    etmf_document: etmf.map((d) => ({
      document_id: d.documentId,
      study_id: d.studyId,
      site_id: d.siteId,
      tmf_zone: d.zone,
      artifact: d.artifact,
      due_on: d.dueOn,
      filed_on: d.filedOn,
      document_status: d.status,
      source_system: d.source,
      is_synthetic: d.synthetic,
    })),
    finance_line: finance.map((f) => ({
      study_id: f.studyId,
      vendor_id: f.vendorId,
      cost_category: f.category,
      fiscal_quarter: f.period,
      quarter_start_on: quarterStart(f.period),
      budget_usd: f.budgetUsd,
      actual_usd: f.actualUsd,
      source_system: f.source,
      is_synthetic: f.synthetic,
    })),
    finance_plan_line: financePlan.map((f) => ({
      study_id: f.studyId,
      vendor_id: f.vendorId,
      cost_category: f.category,
      fiscal_quarter: f.period,
      quarter_start_on: quarterStart(f.period),
      budget_usd: f.budgetUsd,
      source_system: f.source,
      is_synthetic: f.synthetic,
    })),
    cec_adjudication: cec.map((e) => ({
      event_id: e.eventId,
      study_id: e.studyId,
      site_id: e.siteId,
      subject_id: e.subjectId,
      site_event_type: e.siteEventType,
      site_device_related: e.siteDeviceRelated,
      occurred_on: e.occurredOn,
      reported_on: e.reportedOn,
      adjudicated_on: e.adjudicatedOn,
      cec_event_type: e.cecEventType,
      cec_device_related: e.cecDeviceRelated,
      source_system: e.source,
      is_synthetic: e.synthetic,
    })),
  };
}
