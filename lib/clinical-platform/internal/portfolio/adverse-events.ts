/**
 * The EDC adverse event feed of a portfolio study (#2956). Events are drawn
 * after the study's visits, from a stream of their own, so adding them moved
 * no other generated value.
 */
import type { AdverseEventSeverity, EdcAdverseEvent } from "../../types";
import { isoDate, toDay } from "./calendar";
import type { StudySimulation } from "./records";
import type { SitePlan } from "./sites";
import { Stream } from "./stream";

/** Mean adverse events reported per entered on-study visit. */
export const AE_RATE = 0.4;

/**
 * Share of that rate a site with a data integrity signal reports: it
 * under-reports, the pattern central monitoring looks for first.
 */
export const INTEGRITY_AE_SHARE = 0.1;

/** Most days an event can begin before the visit it is reported at. */
const MAX_ONSET_LEAD_DAYS = 27;

/** Chance an event is serious. */
const SERIOUS_CHANCE = 0.06;

/**
 * Reported terms: a short fictional list of everyday events, not a coding
 * dictionary, weighted roughly as they are reported.
 */
const TERMS: readonly (readonly [string, number])[] = [
  ["Headache", 18],
  ["Nausea", 14],
  ["Fatigue", 13],
  ["Dizziness", 9],
  ["Diarrhoea", 8],
  ["Upper respiratory tract infection", 8],
  ["Back pain", 7],
  ["Rash", 6],
  ["Arthralgia", 6],
  ["Insomnia", 5],
  ["Hypertension", 4],
  ["Pyrexia", 2],
];

const SEVERITIES: readonly AdverseEventSeverity[] = [
  "mild",
  "moderate",
  "severe",
];
/** Severity weights of a non-serious event, then of a serious one. */
const SEVERITY_WEIGHTS = [60, 32, 8] as const;
const SERIOUS_SEVERITY_WEIGHTS = [10, 40, 50] as const;

/**
 * Draws one study's adverse events. Each entered visit of an enrolled
 * subject on or after enrollment reports a Poisson number of events, each
 * beginning up to four weeks before the visit but not before enrollment,
 * and reported the day the site entered the visit's data.
 *
 * @param seed - Portfolio seed.
 * @param studyId - The study's id.
 * @param plans - The study's sites.
 * @param sim - The study's subjects and visits.
 * @returns The study's adverse events, in visit order.
 */
export function adverseEvents(
  seed: number,
  studyId: string,
  plans: readonly SitePlan[],
  sim: StudySimulation
): EdcAdverseEvent[] {
  const rng = new Stream(seed, `${studyId}/adverse-events`);
  const integrity = new Set(plans.filter((p) => p.integrity).map((p) => p.id));
  const enrolledOn = new Map(
    sim.subjects.flatMap((s) =>
      s.enrolledOn === null ? [] : [[s.subjectId, s.enrolledOn] as const]
    )
  );
  const termWeights = TERMS.map(([, weight]) => weight);
  const events: EdcAdverseEvent[] = [];
  for (const visit of sim.visits) {
    const enrolled = enrolledOn.get(visit.subjectId);
    if (
      visit.status !== "entered" ||
      visit.visitDate === null ||
      visit.dataEnteredAt === null ||
      enrolled === undefined ||
      visit.visitDate < enrolled
    ) {
      continue;
    }
    const rate = integrity.has(visit.siteId)
      ? AE_RATE * INTEGRITY_AE_SHARE
      : AE_RATE;
    const count = rng.poisson(rate);
    const visitDay = toDay(visit.visitDate);
    const firstDay = toDay(enrolled);
    for (let n = 1; n <= count; n += 1) {
      const serious = rng.chance(SERIOUS_CHANCE);
      events.push({
        synthetic: true,
        source: "EDC",
        aeId: `${visit.visitId}-AE${n}`,
        visitId: visit.visitId,
        subjectId: visit.subjectId,
        studyId: visit.studyId,
        siteId: visit.siteId,
        term: TERMS[rng.weighted(termWeights)][0],
        onsetOn: isoDate(
          Math.max(firstDay, visitDay - rng.int(0, MAX_ONSET_LEAD_DAYS))
        ),
        reportedOn: visit.dataEnteredAt.slice(0, 10),
        serious,
        severity:
          SEVERITIES[
            rng.weighted(serious ? SERIOUS_SEVERITY_WEIGHTS : SEVERITY_WEIGHTS)
          ],
      });
    }
  }
  return events;
}
