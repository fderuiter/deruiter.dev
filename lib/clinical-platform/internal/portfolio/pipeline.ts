/**
 * Bronze records for a study whose subjects come from the Study Data
 * Pipeline (ADR 0065), as ADR 0066 asks: the platform runs `runPipeline`
 * through `@/lib/study-data` and never reaches into its stages.
 *
 * The pipeline's collected layer is the raw data a site enters, so it is
 * what the bronze EDC and IRT feeds are read from: DM gives the subjects,
 * RAND the randomisations, SV the visits, EX the treatment period and DS the
 * disposition. Its SDTM and ADaM output stays in the gold layer, so nothing
 * flows from gold back into bronze. Each subject attends the site DM.SITEID
 * names, matched to the study's site plan by site number, so `/platform`
 * and `/study-data` agree on who is where (#2806). The portfolio adds only
 * what an operational system knows and the pipeline does not: data entry
 * times, queries, kits and deviations.
 *
 * Pipeline dates are moved by one whole number of days so the first consent
 * falls a week after the study's first site activation. Study days, visit
 * order and visit windows are unchanged. A site the pipeline consents a
 * subject at before the site plan activates it is activated a week before
 * that first consent instead, with its planned activation moved to the same
 * day so its start-up milestones still come first. The shift is not moved:
 * it already puts the study's first consent a week after its first
 * activation.
 */
import {
  runPipeline,
  type CellValue,
  type Dataset,
  type PipelineRun,
  type StudyDefinition,
} from "@/lib/study-data";
import type { StudyDataRunReference, SubjectStatus } from "../../types";
import { STUDY_DATA_PRODUCT_ID } from "../../presets";
import { studyDayToOffset, type StudyBlueprint } from "./blueprint";
import { isoDate, toDay } from "./calendar";
import {
  MISSED_ASSESSMENT_DEVIATION,
  OUT_OF_WINDOW_DEVIATION,
  StudyRecorder,
  SUBJECT_DEVIATION_TYPES,
  screenFailureReasons,
  type StudySimulation,
} from "./records";
import type { SitePlan } from "./sites";
import { Stream } from "./stream";

/** Collected-layer datasets the bronze feeds are read from. */
const SOURCE_DATASETS: readonly string[] = ["DM", "RAND", "SV", "EX", "DS"];

/**
 * The bronze columns each collected variable feeds, as `readSubjects` and
 * `studyFromPipeline` read them, for studies whose subjects come from the
 * pipeline. Kept beside the code it describes so the two change together;
 * the lineage tests check every reference resolves.
 */
export const PIPELINE_BRONZE_LINEAGE: readonly {
  readonly from: string;
  readonly to: string;
  readonly transformation: string;
}[] = [
  ["DM.USUBJID", "edc.subjects.subjectId", "identity"],
  ["DM.USUBJID", "edc.visits.subjectId", "identity"],
  ["DM.USUBJID", "edc.visits.visitId", "concatenate"],
  ["DM.USUBJID", "irt.randomizations.subjectId", "identity"],
  ["DM.USUBJID", "irt.kits.subjectId", "identity"],
  ["DM.USUBJID", "ctms.deviations.subjectId", "identity"],
  ["DM.USUBJID", "ctms.deviations.deviationId", "concatenate"],
  ["DM.SITEID", "edc.subjects.siteId", "reference-lookup"],
  ["DM.CONSENTDTC", "edc.subjects.screenedOn", "date-shift"],
  ["SV.SVDTC", "edc.subjects.screenedOn", "date-shift"],
  ["SV.SVDTC", "edc.visits.visitDate", "date-shift"],
  ["SV.SVDTC", "edc.subjects.completedOn", "date-shift"],
  ["SV.SVDTC", "edc.subjects.discontinuedOn", "date-shift"],
  ["SV.SVDTC", "irt.kits.dispensedOn", "date-shift"],
  ["SV.VISITNUM", "edc.visits.plannedVisitId", "reference-lookup"],
  ["SV.VISITNUM", "edc.visits.visitId", "concatenate"],
  ["SV.PLANDY", "edc.visits.dayOffset", "subtract"],
  ["SV.ACTDY", "edc.visits.dayOffset", "subtract"],
  ["SV.STATUS", "edc.visits.status", "derive-status"],
  ["SV.STATUS", "ctms.deviations.category", "derive-status"],
  ["SV.SVDTC", "ctms.deviations.occurredOn", "date-shift"],
  ["SV.PLANDY", "ctms.deviations.occurredOn", "date-add"],
  ["RAND.RANDDTC", "ctms.deviations.occurredOn", "date-add"],
  ["RAND.RANDDTC", "edc.subjects.enrolledOn", "date-shift"],
  ["RAND.RANDDTC", "edc.subjects.status", "derive-status"],
  ["RAND.RANDDTC", "irt.randomizations.randomizedAt", "date-shift"],
  ["RAND.ARM", "irt.randomizations.arm", "identity"],
  ["EX.EXSTDTC", "irt.kits.dispensedOn", "filter"],
  ["EX.EXENDTC", "irt.kits.dispensedOn", "filter"],
  ["DS.DSDECOD", "edc.subjects.status", "derive-status"],
  ["DS.DSSTDTC", "edc.subjects.completedOn", "date-shift"],
  ["DS.DSSTDTC", "edc.subjects.discontinuedOn", "date-shift"],
].map(([from, to, transformation]) => ({
  from: `collected.${from}`,
  to: `bronze.${to}`,
  transformation,
}));

/** Days from the first site activation to the first consent. */
const FIRST_CONSENT_LAG = 7;

/** Pipeline visit number of an unscheduled visit, which has no planned visit. */
const UNSCHEDULED_VISITNUM = 99;

/** A subject's pipeline records, with dates on the portfolio calendar. */
interface PipelineSubject {
  readonly subjectId: string;
  /** The site number DM.SITEID records. */
  readonly siteNumber: string | null;
  readonly consentDay: number;
  /** Randomisation day, or `null` for a screen failure. */
  readonly randomizedDay: number | null;
  readonly arm: string | null;
  /** First and last day of exposure, from EX. */
  readonly exposure: readonly [number, number] | null;
  /** Disposition event decode and day, from DS. */
  readonly disposition: { readonly decode: string; readonly day: number };
  readonly visits: PipelineVisit[];
}

/** One scheduled visit from SV. */
interface PipelineVisit {
  readonly visitNum: number;
  readonly plannedDay: number;
  /** Actual study day, or `null` for a missed visit. */
  readonly actualDay: number | null;
  /** Visit day number on the portfolio calendar, or `null` when missed. */
  readonly day: number | null;
  readonly status: string;
}

/** The pipeline run behind a study and the records read from it. */
export interface PipelineStudy {
  readonly simulation: StudySimulation;
  readonly reference: StudyDataRunReference;
  /** The site plans, with each site active a week before its first consent. */
  readonly sites: readonly SitePlan[];
}

function collected(run: PipelineRun, name: string): Dataset {
  const dataset = run.datasets.find(
    (candidate) => candidate.layer === "collected" && candidate.name === name
  );
  if (!dataset) {
    throw new Error(
      `Study Data Pipeline run has no collected ${name} dataset.`
    );
  }
  return dataset;
}

/** Reads one row of a column-oriented dataset. */
function cell(dataset: Dataset, column: string, row: number): CellValue {
  return dataset.columns[column]?.[row] ?? null;
}

function text(dataset: Dataset, column: string, row: number): string | null {
  const value = cell(dataset, column, row);
  return value === null ? null : String(value);
}

function num(dataset: Dataset, column: string, row: number): number | null {
  const value = cell(dataset, column, row);
  return typeof value === "number" ? value : null;
}

function day(dataset: Dataset, column: string, row: number): number | null {
  const value = text(dataset, column, row);
  return value === null || value.length < 10 ? null : toDay(value);
}

/** Groups the run's collected records by subject, in DM order. */
function readSubjects(run: PipelineRun): {
  subjects: Omit<PipelineSubject, "consentDay">[];
  consentDays: number[];
} {
  const dm = collected(run, "DM");
  const rand = collected(run, "RAND");
  const sv = collected(run, "SV");
  const ex = collected(run, "EX");
  const ds = collected(run, "DS");
  const byId = new Map<
    string,
    {
      randomizedDay: number | null;
      arm: string | null;
      exposure: readonly [number, number] | null;
      disposition: { decode: string; day: number } | null;
      visits: PipelineVisit[];
    }
  >();
  const ids: string[] = [];
  const siteNumbers: (string | null)[] = [];
  const consentDays: number[] = [];
  for (let row = 0; row < dm.rowCount; row += 1) {
    const id = text(dm, "USUBJID", row);
    const consent = day(dm, "CONSENTDTC", row);
    if (id === null || consent === null) continue;
    ids.push(id);
    siteNumbers.push(text(dm, "SITEID", row));
    consentDays.push(consent);
    byId.set(id, {
      randomizedDay: null,
      arm: null,
      exposure: null,
      disposition: null,
      visits: [],
    });
  }
  for (let row = 0; row < rand.rowCount; row += 1) {
    const entry = byId.get(text(rand, "USUBJID", row) ?? "");
    if (!entry) continue;
    entry.randomizedDay = day(rand, "RANDDTC", row);
    entry.arm = text(rand, "ARM", row);
  }
  for (let row = 0; row < ex.rowCount; row += 1) {
    const entry = byId.get(text(ex, "USUBJID", row) ?? "");
    const start = day(ex, "EXSTDTC", row);
    const end = day(ex, "EXENDTC", row);
    if (!entry || start === null) continue;
    entry.exposure = [start, end ?? start];
  }
  for (let row = 0; row < ds.rowCount; row += 1) {
    const entry = byId.get(text(ds, "USUBJID", row) ?? "");
    const decode = text(ds, "DSDECOD", row);
    const when = day(ds, "DSSTDTC", row);
    if (!entry || decode === null || when === null) continue;
    if (text(ds, "DSSCAT", row) === "DISPOSITION EVENT") {
      entry.disposition = { decode, day: when };
    }
  }
  for (let row = 0; row < sv.rowCount; row += 1) {
    const entry = byId.get(text(sv, "USUBJID", row) ?? "");
    const visitNum = num(sv, "VISITNUM", row);
    const plannedDay = num(sv, "PLANDY", row);
    if (
      !entry ||
      visitNum === null ||
      plannedDay === null ||
      visitNum === UNSCHEDULED_VISITNUM
    ) {
      continue;
    }
    entry.visits.push({
      visitNum,
      plannedDay,
      actualDay: num(sv, "ACTDY", row),
      day: day(sv, "SVDTC", row),
      status: text(sv, "STATUS", row) ?? "COMPLETED",
    });
  }
  const subjects = ids.map((subjectId, index) => {
    const entry = byId.get(subjectId);
    return {
      subjectId,
      siteNumber: siteNumbers[index],
      randomizedDay: entry?.randomizedDay ?? null,
      arm: entry?.arm ?? null,
      exposure: entry?.exposure ?? null,
      disposition: entry?.disposition ?? { decode: "", day: Infinity },
      visits: entry?.visits ?? [],
    };
  });
  return { subjects, consentDays };
}

/** Moves a pipeline day number onto the portfolio calendar. */
function shifted(dayNumber: number | null, shift: number): number | null {
  return dayNumber === null ? null : dayNumber + shift;
}

/**
 * The site plans with every site the pipeline consents a subject at active
 * a week before that site's first consent by the data cut. A site the plan
 * activates in time keeps its plan.
 */
function activateForConsents(
  sites: readonly SitePlan[],
  firstConsentBySite: ReadonlyMap<string, number>
): SitePlan[] {
  return sites.map((site) => {
    const firstConsent = firstConsentBySite.get(site.siteNumber);
    if (firstConsent === undefined) return site;
    const latest = firstConsent - FIRST_CONSENT_LAG;
    if (site.activationDay !== null && site.activationDay <= latest)
      return site;
    return {
      ...site,
      activationDay: latest,
      plannedActivationDay: Math.min(site.plannedActivationDay, latest),
    };
  });
}

/**
 * Builds a study's bronze records from a Study Data Pipeline run.
 *
 * @param seed - Portfolio seed; the pipeline runs with the same seed.
 * @param study - Study blueprint, with the definition the pipeline runs.
 * @param definition - The USDM study definition.
 * @param nSubjects - Subjects the pipeline generates, screen failures included.
 * @param sites - The study's planned sites.
 * @param asOfDay - Day number of the data cut.
 */
export function studyFromPipeline(
  seed: number,
  study: StudyBlueprint,
  definition: StudyDefinition,
  nSubjects: number,
  sites: readonly SitePlan[],
  asOfDay: number
): PipelineStudy {
  const run = runPipeline(definition, { seed, nSubjects });
  const rng = new Stream(seed, `${study.id}/pipeline`);
  const out = new StudyRecorder(study, rng, asOfDay);
  // The pipeline records that screening failed, not why, so the reason is
  // drawn here the same way as for a simulated study.
  const reason = screenFailureReasons(seed, study.id);
  const { subjects, consentDays } = readSubjects(run);
  const activations = sites
    .map((site) => site.activationDay)
    .filter((value): value is number => value !== null);
  const firstConsent = Math.min(...consentDays);
  const firstOpen =
    activations.length > 0 ? Math.min(...activations) : asOfDay + 1;
  const shift = firstOpen + FIRST_CONSENT_LAG - firstConsent;
  const firstConsentBySite = new Map<string, number>();
  subjects.forEach((source, index) => {
    const consentDay = consentDays[index] + shift;
    if (source.siteNumber === null || consentDay > asOfDay) return;
    const prior = firstConsentBySite.get(source.siteNumber);
    if (prior === undefined || consentDay < prior)
      firstConsentBySite.set(source.siteNumber, consentDay);
  });
  const studySites = activateForConsents(sites, firstConsentBySite);
  const siteByNumber = new Map(
    studySites.map((site) => [site.siteNumber, site])
  );
  const plannedByNum = new Map(
    definition.design.visits.map((visit) => [visit.visitNum, visit.id])
  );
  const dispensing = new Set(
    study.plannedVisits
      .filter((visit) => visit.dispensesProduct)
      .map((visit) => visit.id)
  );
  const enrollDays: number[] = [];
  let screeningClosed = true;
  let ongoing = false;
  let lastFinish = 0;

  subjects.forEach((source, index) => {
    const consentDay = consentDays[index] + shift;
    if (consentDay > asOfDay) {
      screeningClosed = false;
      return;
    }
    const site = siteByNumber.get(source.siteNumber ?? "");
    if (site === undefined) {
      throw new Error(
        `${source.subjectId} is at site ${String(source.siteNumber)}, which ${study.id} does not plan.`
      );
    }
    const subjectId = source.subjectId;
    const randomizedDay = shifted(source.randomizedDay, shift);
    const finalDay = source.disposition.day + shift;
    const enrolled = randomizedDay !== null && randomizedDay <= asOfDay;
    const exposure = source.exposure
      ? ([source.exposure[0] + shift, source.exposure[1] + shift] as const)
      : null;
    let screenedDay = consentDay;
    let lastDoneDay = consentDay;

    for (const visit of source.visits) {
      const plannedVisitId = plannedByNum.get(visit.visitNum);
      if (plannedVisitId === undefined) continue;
      const visitDay = shifted(visit.day, shift);
      if (visit.status === "MISSED" || visitDay === null) {
        if (randomizedDay === null) continue;
        const target = randomizedDay + studyDayToOffset(visit.plannedDay);
        if (target > asOfDay) continue;
        out.missVisit(site, subjectId, plannedVisitId);
        out.deviate(site, subjectId, MISSED_ASSESSMENT_DEVIATION, target);
        continue;
      }
      if (visitDay > asOfDay) continue;
      if (visit.visitNum === definition.design.visits[0]?.visitNum) {
        screenedDay = visitDay;
      }
      const offset =
        visit.actualDay === null
          ? 0
          : studyDayToOffset(visit.actualDay) -
            studyDayToOffset(visit.plannedDay);
      out.recordVisit(site, subjectId, plannedVisitId, visitDay, offset);
      lastDoneDay = Math.max(lastDoneDay, visitDay);
      if (visit.status === "OUT OF WINDOW") {
        out.deviate(site, subjectId, OUT_OF_WINDOW_DEVIATION, visitDay);
      }
      if (
        enrolled &&
        dispensing.has(plannedVisitId) &&
        exposure !== null &&
        visitDay >= exposure[0] &&
        visitDay <= exposure[1]
      ) {
        out.dispenseKit(site, subjectId, visitDay);
      }
    }

    let status: SubjectStatus = "screening";
    let completedOn: string | null = null;
    let discontinuedOn: string | null = null;
    if (randomizedDay === null) {
      if (finalDay <= asOfDay) status = "screen-failed";
      else screeningClosed = false;
    } else if (!enrolled) {
      screeningClosed = false;
    } else {
      enrollDays.push(randomizedDay);
      if (source.arm !== null && study.randomized) {
        out.randomize(site, subjectId, randomizedDay, source.arm);
      }
      const done = finalDay <= asOfDay;
      if (done && source.disposition.decode === "COMPLETED") {
        status = "completed";
        completedOn = isoDate(Math.max(finalDay, lastDoneDay));
        lastFinish = Math.max(lastFinish, finalDay, lastDoneDay);
      } else if (done) {
        status = "discontinued";
        discontinuedOn = isoDate(Math.max(finalDay, lastDoneDay));
        lastFinish = Math.max(lastFinish, finalDay, lastDoneDay);
      } else {
        status = "enrolled";
        ongoing = true;
      }
      out.drawDeviations(
        site,
        subjectId,
        SUBJECT_DEVIATION_TYPES,
        0.12,
        randomizedDay,
        done ? Math.max(finalDay, lastDoneDay) : asOfDay
      );
    }

    out.subjects.push({
      synthetic: true,
      source: "EDC",
      subjectId,
      studyId: study.id,
      siteId: site.id,
      screenedOn: isoDate(screenedDay),
      enrolledOn: enrolled ? isoDate(randomizedDay) : null,
      completedOn,
      discontinuedOn,
      status,
      screenFailureReason: status === "screen-failed" ? reason() : null,
    });
  });

  if (!screeningClosed) out.addSiteStock(studySites);

  enrollDays.sort((a, b) => a - b);
  const lastSubjectInDay =
    screeningClosed && enrollDays.length > 0
      ? enrollDays[enrollDays.length - 1]
      : null;
  return {
    simulation: {
      subjects: out.subjects,
      visits: out.visits,
      queries: out.queries,
      randomizations: out.randomizations,
      kits: out.kits,
      deviations: out.deviations,
      cec: out.cec,
      enrollDays,
      lastSubjectInDay,
      lastSubjectLastVisitDay:
        lastSubjectInDay !== null && !ongoing ? lastFinish : null,
      lastActivityBySite: out.lastActivityBySite,
    },
    reference: {
      synthetic: true,
      studyId: study.id,
      productId: STUDY_DATA_PRODUCT_ID,
      seed: run.manifest.seed,
      nSubjects: run.manifest.nSubjects,
      sourceDatasets: SOURCE_DATASETS,
      dateShiftDays: shift,
      standards: run.manifest.standards,
    },
    sites: studySites,
  };
}
