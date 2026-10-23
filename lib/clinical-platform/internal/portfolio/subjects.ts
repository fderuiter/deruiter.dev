/**
 * Subject-level simulation for a study the portfolio models itself:
 * screening, enrollment and disposition, then the EDC, IRT, protocol
 * deviation and CEC records that follow from them. Nothing after the data
 * cut is emitted.
 */
import type { SubjectStatus } from "../../types";
import type { StudyBlueprint } from "./blueprint";
import { isoDate } from "./calendar";
import {
  OUT_OF_WINDOW_DEVIATION,
  MISSED_ASSESSMENT_DEVIATION,
  StudyRecorder,
  SUBJECT_DEVIATION_TYPES,
  type StudySimulation,
} from "./records";
import type { SitePlan } from "./sites";
import { Stream } from "./stream";

/** Every deviation kind a simulated subject can have. */
const SIMULATED_DEVIATION_TYPES = [
  ...SUBJECT_DEVIATION_TYPES,
  OUT_OF_WINDOW_DEVIATION,
  MISSED_ASSESSMENT_DEVIATION,
];

const CEC_EVENT_TYPES: readonly string[] = [
  "Stroke",
  "Major bleeding",
  "Major vascular complication",
  "Myocardial infarction",
  "Device embolisation",
  "Rehospitalisation for heart failure",
];

/** One screening attempt before outcomes are drawn. */
interface Candidate {
  readonly day: number;
  readonly siteIndex: number;
  readonly order: number;
}

function screeningCandidates(
  rng: Stream,
  study: StudyBlueprint,
  sites: readonly SitePlan[],
  asOfDay: number,
  pace: number
): Candidate[] {
  const candidates: Candidate[] = [];
  sites.forEach((site, siteIndex) => {
    if (site.activationDay === null) return;
    const perDay =
      (site.plannedEnrollment /
        study.enrollmentDays /
        (1 - study.screenFailRate)) *
      site.speed *
      pace;
    const meanGap = 1 / Math.max(perDay, 1e-6);
    const cap = site.plannedEnrollment * 6 + 10;
    let day = site.activationDay + 7 + rng.expInt(meanGap);
    let order = 0;
    while (day <= asOfDay && order < cap) {
      candidates.push({ day, siteIndex, order });
      order += 1;
      day += rng.expInt(meanGap);
    }
  });
  return candidates.sort(
    (a, b) => a.day - b.day || a.siteIndex - b.siteIndex || a.order - b.order
  );
}

/**
 * Simulates one study's subjects and their records.
 *
 * @param seed - Portfolio seed.
 * @param study - Study blueprint.
 * @param sites - The study's planned sites.
 * @param asOfDay - Day number of the data cut.
 * @param pace - Study-wide multiplier on screening rates.
 */
export function simulateStudy(
  seed: number,
  study: StudyBlueprint,
  sites: readonly SitePlan[],
  asOfDay: number,
  pace: number
): StudySimulation {
  const rng = new Stream(seed, `${study.id}/subjects`);
  const out = new StudyRecorder(study, rng, asOfDay);
  const enrollDays: number[] = [];
  const screening = study.plannedVisits[0];
  const anchorIndex = study.plannedVisits.findIndex((v) => v.day === 0);
  const lastPlanned = study.plannedVisits[study.plannedVisits.length - 1];
  const siteSeq = sites.map(() => 0);
  const blockQueue = sites.map((): string[] => []);
  const isDevice = study.productType === "device";
  let accepted = 0;
  let ongoing = false;
  let lastFinish = 0;

  for (const candidate of screeningCandidates(
    rng,
    study,
    sites,
    asOfDay,
    pace
  )) {
    if (accepted >= study.plannedEnrollment) break;
    const site = sites[candidate.siteIndex];
    siteSeq[candidate.siteIndex] += 1;
    const subjectId = `${study.id}-${site.siteNumber}-${String(siteSeq[candidate.siteIndex]).padStart(3, "0")}`;
    const screenDay = candidate.day;
    const failed = rng.chance(study.screenFailRate);
    const enrollDay = failed
      ? null
      : screenDay + rng.int(3, Math.max(3, -screening.day));
    if (!failed) accepted += 1;
    out.recordVisit(site, subjectId, screening.id, screenDay, 0);

    let status: SubjectStatus = failed ? "screen-failed" : "screening";
    let completedOn: string | null = null;
    let discontinuedOn: string | null = null;

    if (enrollDay !== null && enrollDay <= asOfDay) {
      enrollDays.push(enrollDay);
      const dropDay = rng.chance(study.dropoutRate)
        ? enrollDay + rng.int(1, lastPlanned.day)
        : null;
      let lastDoneDay = enrollDay;
      let finished = true;

      if (study.randomized) {
        if (blockQueue[candidate.siteIndex].length === 0) {
          blockQueue[candidate.siteIndex] = rng.shuffle([
            ...study.arms,
            ...study.arms,
          ]);
        }
        const arm = blockQueue[candidate.siteIndex].shift() ?? study.arms[0];
        out.randomize(site, subjectId, enrollDay, arm);
      }

      for (let v = anchorIndex; v < study.plannedVisits.length; v += 1) {
        const planned = study.plannedVisits[v];
        const target = enrollDay + planned.day;
        if (dropDay !== null && target > dropDay) break;
        if (target > asOfDay) {
          finished = false;
          break;
        }
        let jitter = 0;
        if (planned.day !== 0 && !site.integrity) {
          const roll = rng.next();
          if (roll < 0.03) {
            out.missVisit(site, subjectId, planned.id);
            continue;
          }
          jitter =
            roll < 0.08
              ? (rng.chance(0.5) ? 1 : -1) *
                (planned.windowDays + rng.int(1, 7))
              : rng.int(-planned.windowDays, planned.windowDays);
        }
        // Never before the previous visit, never after the data cut.
        const notBefore = Math.max(target + jitter, lastDoneDay);
        const day = Math.min(notBefore, asOfDay);
        out.recordVisit(site, subjectId, planned.id, day, day - target);
        lastDoneDay = day;
        if (planned.dispensesProduct && !isDevice) {
          out.dispenseKit(site, subjectId, day);
        }
      }

      if (dropDay !== null && dropDay <= asOfDay) {
        status = "discontinued";
        discontinuedOn = isoDate(Math.max(dropDay, lastDoneDay));
        lastFinish = Math.max(lastFinish, dropDay, lastDoneDay);
      } else if (finished && dropDay === null) {
        status = "completed";
        completedOn = isoDate(lastDoneDay);
        lastFinish = Math.max(lastFinish, lastDoneDay);
      } else {
        status = "enrolled";
        ongoing = true;
      }
      const endDay =
        discontinuedOn !== null || completedOn !== null
          ? Math.max(lastDoneDay, dropDay ?? 0)
          : asOfDay;

      out.drawDeviations(
        site,
        subjectId,
        SIMULATED_DEVIATION_TYPES,
        0.25,
        enrollDay,
        endDay
      );

      // Endpoint events sent to the clinical events committee.
      if (study.cecAdjudication && rng.chance(0.18)) {
        const occurred = rng.int(
          enrollDay,
          Math.min(endDay, asOfDay, enrollDay + 365)
        );
        const reported = occurred + rng.int(0, 10);
        if (reported <= asOfDay) {
          const adjudicated = reported + rng.int(14, 60);
          const done = adjudicated <= asOfDay;
          const siteType = rng.pick(CEC_EVENT_TYPES);
          const siteRelated = rng.chance(0.35);
          const agrees = rng.chance(0.85);
          out.cec.push({
            synthetic: true,
            source: "CEC",
            eventId: `${subjectId}-CE1`,
            studyId: study.id,
            siteId: site.id,
            subjectId,
            siteEventType: siteType,
            siteDeviceRelated: siteRelated,
            occurredOn: isoDate(occurred),
            reportedOn: isoDate(reported),
            adjudicatedOn: done ? isoDate(adjudicated) : null,
            cecEventType: done
              ? agrees
                ? siteType
                : rng.pick(CEC_EVENT_TYPES)
              : null,
            cecDeviceRelated: done
              ? agrees
                ? siteRelated
                : !siteRelated
              : null,
          });
        }
      }
    }

    out.subjects.push({
      synthetic: true,
      source: "EDC",
      subjectId,
      studyId: study.id,
      siteId: site.id,
      screenedOn: isoDate(screenDay),
      enrolledOn:
        enrollDay !== null && enrollDay <= asOfDay ? isoDate(enrollDay) : null,
      completedOn,
      discontinuedOn,
      status,
    });
  }

  if (!isDevice && accepted < study.plannedEnrollment) {
    out.addSiteStock(sites);
  }

  enrollDays.sort((a, b) => a - b);
  const full = enrollDays.length >= study.plannedEnrollment;
  return {
    subjects: out.subjects,
    visits: out.visits,
    queries: out.queries,
    randomizations: out.randomizations,
    kits: out.kits,
    deviations: out.deviations,
    cec: out.cec,
    enrollDays,
    lastSubjectInDay: full ? enrollDays[study.plannedEnrollment - 1] : null,
    lastSubjectLastVisitDay: full && !ongoing ? lastFinish : null,
    lastActivityBySite: out.lastActivityBySite,
  };
}
