/**
 * Study-level operations: CTMS milestones and monitoring visits, eTMF
 * expected documents and finance lines. Planned dates come from the
 * blueprint; actual dates come from the simulated subjects and sites.
 */
import type {
  CtmsMilestone,
  CtmsMonitoringPlan,
  CtmsMonitoringVisit,
  EtmfDocument,
  FinanceLine,
  MilestoneKind,
  StudyStatus,
} from "../../types";
import type { StudyBlueprint } from "./blueprint";
import { CATEGORY_VENDOR, OVER_BUDGET_VENDOR_ID } from "./blueprint";
import { isoDate, nextQuarterStart, quarterOf } from "./calendar";
import { Stream } from "./stream";
import { FIRST_ACTIVATION_OFFSET, type SitePlan } from "./sites";
import { SIV_LEAD_DAYS } from "./start-up";
import type { StudySimulation } from "./records";

/** Planned days from first subject in, used for the planned milestone dates. */
const PLANNED_FIRST_SUBJECT_OFFSET = FIRST_ACTIVATION_OFFSET + 50;

const DRUG_LABELS: Readonly<Record<MilestoneKind, string>> = {
  "protocol-final": "Protocol final",
  "regulatory-approval": "IND in effect",
  "first-site-activated": "First site activated",
  "first-subject-in": "First patient in",
  "fifty-percent-enrolled": "50% enrolled",
  "last-subject-in": "Last patient in",
  "last-subject-last-visit": "Last patient last visit",
  "database-lock": "Database lock",
  "final-report": "Clinical study report final",
};

const DEVICE_LABELS: Readonly<Record<MilestoneKind, string>> = {
  "protocol-final": "Clinical investigation plan final",
  "regulatory-approval": "IDE approval",
  "first-site-activated": "First site activated",
  "first-subject-in": "First subject enrolled",
  "fifty-percent-enrolled": "50% enrolled",
  "last-subject-in": "Enrollment complete",
  "last-subject-last-visit": "Follow-up complete",
  "database-lock": "Database lock",
  "final-report": "Clinical investigation report final",
};

/** Study-level operational records and the derived status. */
export interface StudyOperations {
  readonly status: StudyStatus;
  readonly milestones: CtmsMilestone[];
  readonly monitoringPlan: CtmsMonitoringPlan;
  readonly monitoringVisits: CtmsMonitoringVisit[];
  readonly documents: EtmfDocument[];
  readonly finance: FinanceLine[];
}

const STUDY_DOCUMENTS = [
  { zone: "01 Trial Management", artifact: "Trial Master File Plan", due: 30 },
  { zone: "01 Trial Management", artifact: "Monitoring Plan", due: 60 },
  { zone: "01 Trial Management", artifact: "Data Management Plan", due: 75 },
  { zone: "02 Central Trial Documents", artifact: "Protocol", due: 0 },
  {
    zone: "02 Central Trial Documents",
    artifact: "Investigator's Brochure",
    due: 0,
  },
  {
    zone: "02 Central Trial Documents",
    artifact: "Statistical Analysis Plan",
    due: 180,
  },
  { zone: "03 Regulatory", artifact: "Regulatory Authority Approval", due: 60 },
] as const;

const SITE_DOCUMENTS = [
  {
    zone: "04 IRB or IEC and other Approvals",
    artifact: "IRB or IEC Approval",
    due: -14,
  },
  {
    zone: "05 Site Management",
    artifact: "Clinical Trial Agreement",
    due: -21,
  },
  {
    zone: "05 Site Management",
    artifact: "Financial Disclosure Form",
    due: -14,
  },
  {
    zone: "05 Site Management",
    artifact: "Delegation of Authority Log",
    due: -7,
  },
  {
    zone: "05 Site Management",
    artifact: "Site Initiation Visit Report",
    due: 14,
  },
] as const;

/**
 * Builds the study-level operational records.
 *
 * @param seed - Portfolio seed.
 * @param study - Study blueprint.
 * @param sites - The study's planned sites.
 * @param sim - The study's subject simulation.
 * @param startDay - Day number of the study start.
 * @param asOfDay - Day number of the data cut.
 */
export function studyOperations(
  seed: number,
  study: StudyBlueprint,
  sites: readonly SitePlan[],
  sim: StudySimulation,
  startDay: number,
  asOfDay: number
): StudyOperations {
  const rng = new Stream(seed, `${study.id}/operations`);
  const reached = (day: number | null) =>
    day !== null && day <= asOfDay ? day : null;

  // Milestones: planned from the blueprint, actual from what happened.
  const lastVisitDay = study.plannedVisits[study.plannedVisits.length - 1].day;
  const plannedFsi = startDay + PLANNED_FIRST_SUBJECT_OFFSET;
  const plannedLsi = plannedFsi + study.enrollmentDays;
  const plannedLslv = plannedLsi + lastVisitDay;
  const activations = sites
    .map((site) => site.activationDay)
    .filter((day): day is number => day !== null);
  const enrolled = sim.enrollDays;
  const half = Math.ceil(study.plannedEnrollment / 2);
  const lsi = sim.lastSubjectInDay;
  const lslv = sim.lastSubjectLastVisitDay;
  const dbl = reached(lslv === null ? null : lslv + rng.int(40, 80));
  const report = reached(dbl === null ? null : dbl + rng.int(80, 120));
  const plan: ReadonlyArray<readonly [MilestoneKind, number, number | null]> = [
    ["protocol-final", startDay, startDay],
    [
      "regulatory-approval",
      startDay + 45,
      reached(startDay + rng.int(30, FIRST_ACTIVATION_OFFSET)),
    ],
    [
      "first-site-activated",
      startDay + FIRST_ACTIVATION_OFFSET + 15,
      activations.length > 0 ? Math.min(...activations) : null,
    ],
    ["first-subject-in", plannedFsi, enrolled.length > 0 ? enrolled[0] : null],
    [
      "fifty-percent-enrolled",
      plannedFsi + Math.round(study.enrollmentDays / 2),
      enrolled.length >= half ? enrolled[half - 1] : null,
    ],
    ["last-subject-in", plannedLsi, lsi],
    ["last-subject-last-visit", plannedLslv, lslv],
    ["database-lock", plannedLslv + 60, dbl],
    ["final-report", plannedLslv + 150, report],
  ];
  const labels = study.productType === "device" ? DEVICE_LABELS : DRUG_LABELS;
  const milestones: CtmsMilestone[] = plan.map(([kind, planned, actual]) => ({
    synthetic: true,
    source: "CTMS",
    studyId: study.id,
    kind,
    label: labels[kind],
    plannedOn: isoDate(planned),
    actualOn: actual === null ? null : isoDate(actual),
  }));

  let status: StudyStatus = "start-up";
  if (dbl !== null) status = "closed";
  else if (lsi !== null) status = "follow-up";
  else if (activations.length > 0) status = "enrolling";

  // The monitoring plan takes effect with the protocol, before any site is
  // initiated. It draws nothing from the stream, so adding it left every
  // other generated value as it was.
  const monitoringPlan: CtmsMonitoringPlan = {
    synthetic: true,
    source: "CTMS",
    monitoringPlanId: `${study.id}-MP`,
    studyId: study.id,
    version: "1.0",
    effectiveOn: study.startOn,
    ...study.monitoring,
  };

  // Monitoring: initiation, interim visits every six to ten weeks, close-out.
  // The visits do not follow the plan exactly; measuring them against it is
  // the point of the plan.
  const monitoringVisits: CtmsMonitoringVisit[] = [];
  for (const site of sites) {
    if (site.activationDay === null) continue;
    let seq = 0;
    const push = (type: CtmsMonitoringVisit["type"], day: number) => {
      seq += 1;
      const due = type === "IMV" ? rng.int(20, 140) : 0;
      const finalDay = day + rng.int(3, 25);
      monitoringVisits.push({
        synthetic: true,
        source: "CTMS",
        monitoringVisitId: `${site.id}-MV${String(seq).padStart(2, "0")}`,
        studyId: study.id,
        siteId: site.id,
        type,
        mode: type === "IMV" && rng.chance(0.4) ? "remote" : "on-site",
        visitDate: isoDate(day),
        reportFinalOn: finalDay <= asOfDay ? isoDate(finalDay) : null,
        sdvPagesDue: due,
        sdvPagesVerified: site.integrity
          ? due
          : Math.round(due * rng.real(0.7, 1)),
        actionItems: rng.poisson(site.integrity ? 0.2 : 1.5),
      });
    };
    push(
      "SIV",
      Math.max(startDay, site.activationDay - rng.int(0, SIV_LEAD_DAYS))
    );
    const lastActivity =
      sim.lastActivityBySite.get(site.id) ?? site.activationDay;
    const stopDay =
      lslv !== null ? Math.min(asOfDay, lastActivity + 14) : asOfDay;
    for (
      let day = site.activationDay + rng.int(30, 60);
      day <= stopDay;
      day += rng.int(42, 70)
    ) {
      push("IMV", day);
    }
    if (lslv !== null) {
      const cov = Math.max(lslv, lastActivity) + rng.int(10, 40);
      if (cov <= asOfDay) push("COV", cov);
    }
  }

  // eTMF: expected documents at trial and site level.
  const documents: EtmfDocument[] = [];
  const fileDocument = (
    siteId: string | null,
    zone: string,
    artifact: string,
    dueDay: number,
    filedChance: number
  ) => {
    const filed = rng.chance(filedChance);
    const filedDay = filed ? dueDay + rng.int(-20, 25) : null;
    const isFiled = filedDay !== null && filedDay <= asOfDay;
    documents.push({
      synthetic: true,
      source: "eTMF",
      documentId: `${siteId ?? study.id}-DOC${String(documents.length + 1).padStart(3, "0")}`,
      studyId: study.id,
      siteId,
      zone,
      artifact,
      dueOn: isoDate(dueDay),
      filedOn: isFiled ? isoDate(filedDay) : null,
      status: isFiled ? "filed" : dueDay <= asOfDay ? "missing" : "expected",
    });
  };
  for (const doc of STUDY_DOCUMENTS) {
    fileDocument(null, doc.zone, doc.artifact, startDay + doc.due, 0.97);
  }
  for (const site of sites) {
    if (site.activationDay === null) continue;
    const chance = site.integrity || site.slow ? 0.75 : 0.94;
    for (const doc of SITE_DOCUMENTS) {
      fileDocument(
        site.id,
        doc.zone,
        doc.artifact,
        site.activationDay + doc.due,
        chance
      );
    }
  }

  // Finance: quarterly budget against actual per vendor category.
  const finance: FinanceLine[] = [];
  const endDay = report ?? asOfDay;
  for (const [category, annual] of Object.entries(study.annualBudgetUsd)) {
    const vendorId =
      category === "CRO"
        ? study.croVendorId
        : (CATEGORY_VENDOR[category] ?? null);
    let quarterIndex = 0;
    for (let day = startDay; day <= endDay; day = nextQuarterStart(day)) {
      const budget = Math.round(annual / 4);
      const factor =
        vendorId === OVER_BUDGET_VENDOR_ID
          ? rng.real(1.15, 1.3) + 0.02 * quarterIndex
          : rng.real(0.82, 1.06);
      finance.push({
        synthetic: true,
        source: "Finance",
        studyId: study.id,
        vendorId,
        category,
        period: quarterOf(day),
        budgetUsd: budget,
        actualUsd: Math.round(budget * factor),
      });
      quarterIndex += 1;
    }
  }

  return {
    status,
    milestones,
    monitoringPlan,
    monitoringVisits,
    documents,
    finance,
  };
}
