/**
 * Record emitters shared by both ways a study's subjects are produced: the
 * portfolio's own simulation and a Study Data Pipeline run. Whatever drives
 * the subjects, their EDC visits, queries, IRT records, deviations and site
 * activity are written here the same way, and nothing dated after the data
 * cut is written at all.
 */
import type {
  CecAdjudication,
  DeviationImportance,
  EdcQuery,
  EdcSubject,
  EdcVisit,
  IrtKit,
  IrtRandomization,
  ProtocolDeviation,
} from "../../types";
import type { StudyBlueprint } from "./blueprint";
import { MINUTES_PER_DAY, isoDate, isoMinute } from "./calendar";
import type { SitePlan } from "./sites";
import { Stream } from "./stream";

/** Records and enrollment facts produced for one study. */
export interface StudySimulation {
  readonly subjects: EdcSubject[];
  readonly visits: EdcVisit[];
  readonly queries: EdcQuery[];
  readonly randomizations: IrtRandomization[];
  readonly kits: IrtKit[];
  readonly deviations: ProtocolDeviation[];
  readonly cec: CecAdjudication[];
  /** Enrollment day numbers, ascending. */
  readonly enrollDays: number[];
  /** Day the last subject was enrolled, or `null` while enrollment is open. */
  readonly lastSubjectInDay: number | null;
  /** Day the last enrolled subject finished, or `null` while any is ongoing. */
  readonly lastSubjectLastVisitDay: number | null;
  /** Last visit day per site id, for close-out timing. */
  readonly lastActivityBySite: Map<string, number>;
}

/** A kind of protocol deviation and its ICH E3 importance. */
export interface DeviationType {
  readonly category: string;
  readonly importance: DeviationImportance;
  /** Whether the deviation happens at enrollment rather than on treatment. */
  readonly atEnrollment: boolean;
}

/** Deviation category for a visit outside its window. */
export const OUT_OF_WINDOW_DEVIATION: DeviationType = {
  category: "Visit out of window",
  importance: "not-important",
  atEnrollment: false,
};

/** Deviation category for a visit that did not take place. */
export const MISSED_ASSESSMENT_DEVIATION: DeviationType = {
  category: "Missed assessment",
  importance: "not-important",
  atEnrollment: false,
};

/** Deviations that do not depend on the visit record. */
export const SUBJECT_DEVIATION_TYPES: readonly DeviationType[] = [
  {
    category: "Eligibility criteria not met",
    importance: "important",
    atEnrollment: true,
  },
  {
    category: "Informed consent process",
    importance: "important",
    atEnrollment: true,
  },
  {
    category: "Investigational product dosing error",
    importance: "important",
    atEnrollment: false,
  },
  {
    category: "Prohibited concomitant medication",
    importance: "important",
    atEnrollment: false,
  },
  {
    category: "Sample handling",
    importance: "not-important",
    atEnrollment: false,
  },
];

/**
 * Why screening failed: a short, fictional controlled list with weights
 * roughly in the order sponsors report them, eligibility first (#2879).
 */
const SCREEN_FAILURE_REASONS: readonly (readonly [string, number])[] = [
  ["Inclusion criterion not met", 45],
  ["Exclusion criterion met", 30],
  ["Consent withdrawn", 12],
  ["Lost before randomisation", 5],
  ["Other", 8],
];

/**
 * Draws screen failure reasons for one study, in subject order, from a
 * stream of their own: adding the reasons moved no other generated value.
 *
 * @param seed - Portfolio seed.
 * @param studyId - The study's id.
 * @returns A function giving the next screen failure's reason.
 */
export function screenFailureReasons(
  seed: number,
  studyId: string
): () => string {
  const rng = new Stream(seed, `${studyId}/screen-failure-reasons`);
  const weights = SCREEN_FAILURE_REASONS.map(([, weight]) => weight);
  return () => SCREEN_FAILURE_REASONS[rng.weighted(weights)][0];
}

const QUERY_FIELDS: readonly string[] = [
  "VS.SYSBP",
  "VS.DIABP",
  "VS.WEIGHT",
  "AE.AESTDTC",
  "AE.AESEV",
  "CM.CMDOSE",
  "LB.LBORRES",
  "EX.EXDOSE",
  "DM.BRTHDTC",
  "MH.MHTERM",
];

/** Writes one study's bronze records, dropping anything after the data cut. */
export class StudyRecorder {
  readonly subjects: EdcSubject[] = [];
  readonly visits: EdcVisit[] = [];
  readonly queries: EdcQuery[] = [];
  readonly randomizations: IrtRandomization[] = [];
  readonly kits: IrtKit[] = [];
  readonly deviations: ProtocolDeviation[] = [];
  readonly cec: CecAdjudication[] = [];
  readonly lastActivityBySite = new Map<string, number>();
  private readonly deviationSeq = new Map<string, number>();
  private readonly asOfEnd: number;
  private kitSeq = 0;

  constructor(
    private readonly study: StudyBlueprint,
    private readonly rng: Stream,
    private readonly asOfDay: number
  ) {
    this.asOfEnd = (asOfDay + 1) * MINUTES_PER_DAY - 1;
  }

  /** Notes site activity on a day. */
  touch(siteId: string, day: number): void {
    this.lastActivityBySite.set(
      siteId,
      Math.max(this.lastActivityBySite.get(siteId) ?? 0, day)
    );
  }

  /** Adds an IRT kit received by a site and, when given, dispensed. */
  addKit(
    site: SitePlan,
    subjectId: string | null,
    dispensedDay: number | null,
    receivedDay: number,
    shelfMin: number
  ): void {
    this.kitSeq += 1;
    const expiresDay = receivedDay + this.rng.int(shelfMin, 540);
    this.kits.push({
      synthetic: true,
      source: "IRT",
      kitId: `${this.study.id}-K${String(this.kitSeq).padStart(5, "0")}`,
      studyId: this.study.id,
      siteId: site.id,
      subjectId,
      receivedOn: isoDate(receivedDay),
      dispensedOn: dispensedDay === null ? null : isoDate(dispensedDay),
      expiresOn: isoDate(expiresDay),
      status:
        dispensedDay !== null
          ? "dispensed"
          : expiresDay < this.asOfDay
            ? "expired"
            : "available",
    });
  }

  /** Adds a kit dispensed at a visit, received some weeks before it. */
  dispenseKit(site: SitePlan, subjectId: string, day: number): void {
    const received = Math.max(
      site.activationDay ?? day,
      day - this.rng.int(7, 35)
    );
    this.addKit(site, subjectId, day, received, 365);
  }

  /** Adds undispensed stock at every active site, some past expiry. */
  addSiteStock(sites: readonly SitePlan[]): void {
    for (const site of sites) {
      if (site.activationDay === null) continue;
      const stock = this.rng.int(2, 5);
      for (let k = 0; k < stock; k += 1) {
        const received = Math.max(
          site.activationDay,
          this.asOfDay - this.rng.int(10, 200)
        );
        this.addKit(site, null, null, received, 150);
      }
    }
  }

  /** Adds an IRT randomisation on the enrollment day. */
  randomize(site: SitePlan, subjectId: string, day: number, arm: string): void {
    this.randomizations.push({
      synthetic: true,
      source: "IRT",
      randomizationId: `${this.study.id}-R${String(this.randomizations.length + 1).padStart(4, "0")}`,
      subjectId,
      studyId: this.study.id,
      siteId: site.id,
      randomizedAt: isoMinute(
        day * MINUTES_PER_DAY + this.rng.int(8 * 60, 17 * 60)
      ),
      arm,
    });
  }

  /** Adds a visit that did not take place. */
  missVisit(site: SitePlan, subjectId: string, plannedVisitId: string): void {
    this.visits.push({
      synthetic: true,
      source: "EDC",
      visitId: `${subjectId}-${plannedVisitId}`,
      subjectId,
      studyId: this.study.id,
      siteId: site.id,
      plannedVisitId,
      visitDate: null,
      dayOffset: null,
      dataEnteredAt: null,
      status: "missed",
    });
  }

  /**
   * Adds a visit with its data entry time and the queries raised on it.
   * A visit after the data cut is not written.
   */
  recordVisit(
    site: SitePlan,
    subjectId: string,
    plannedVisitId: string,
    day: number,
    dayOffset: number
  ): void {
    if (day > this.asOfDay) return;
    const rng = this.rng;
    const visitId = `${subjectId}-${plannedVisitId}`;
    const enteredMinute = site.integrity
      ? day * MINUTES_PER_DAY + 17 * 60
      : (day + rng.expInt(site.entryLagDays)) * MINUTES_PER_DAY +
        rng.int(8 * 60, 19 * 60);
    const entered = enteredMinute <= this.asOfEnd;
    this.visits.push({
      synthetic: true,
      source: "EDC",
      visitId,
      subjectId,
      studyId: this.study.id,
      siteId: site.id,
      plannedVisitId,
      visitDate: isoDate(day),
      dayOffset,
      dataEnteredAt: entered ? isoMinute(enteredMinute) : null,
      status: entered ? "entered" : "pending-entry",
    });
    this.touch(site.id, day);
    if (!entered) return;
    const rate = site.integrity
      ? this.study.queryRate * 0.05
      : this.study.queryRate;
    const count = rng.poisson(rate);
    for (let q = 0; q < count; q += 1) {
      const editCheck = rng.chance(0.6);
      const opened =
        enteredMinute +
        (editCheck ? rng.int(0, 5) : rng.int(60, 10 * MINUTES_PER_DAY));
      if (opened > this.asOfEnd) continue;
      const answered = opened + 30 + rng.expInt(4 * MINUTES_PER_DAY);
      const closed = answered + 10 + rng.expInt(2 * MINUTES_PER_DAY);
      const isAnswered = answered <= this.asOfEnd;
      const isClosed = isAnswered && closed <= this.asOfEnd;
      this.queries.push({
        synthetic: true,
        source: "EDC",
        queryId: `${visitId}-Q${q + 1}`,
        visitId,
        subjectId,
        studyId: this.study.id,
        siteId: site.id,
        field: rng.pick(QUERY_FIELDS),
        origin: editCheck ? "edit-check" : "manual",
        openedAt: isoMinute(opened),
        answeredAt: isAnswered ? isoMinute(answered) : null,
        closedAt: isClosed ? isoMinute(closed) : null,
        status: isClosed ? "closed" : isAnswered ? "answered" : "open",
      });
    }
  }

  /**
   * Adds a protocol deviation that occurred on a day; it is written only if
   * it was identified by the data cut.
   */
  deviate(
    site: SitePlan,
    subjectId: string,
    type: DeviationType,
    occurredDay: number
  ): void {
    const identified = occurredDay + this.rng.expInt(12);
    if (identified > this.asOfDay) return;
    const seq = (this.deviationSeq.get(subjectId) ?? 0) + 1;
    this.deviationSeq.set(subjectId, seq);
    this.deviations.push({
      synthetic: true,
      source: "CTMS",
      deviationId: `${subjectId}-PD${seq}`,
      studyId: this.study.id,
      siteId: site.id,
      subjectId,
      category: type.category,
      importance: type.importance,
      occurredOn: isoDate(occurredDay),
      identifiedOn: isoDate(identified),
    });
  }

  /**
   * Draws a subject's deviations between enrollment and the end of
   * participation; under-reported at a site with a data integrity signal.
   */
  drawDeviations(
    site: SitePlan,
    subjectId: string,
    types: readonly DeviationType[],
    meanCount: number,
    enrollDay: number,
    endDay: number
  ): void {
    const count = this.rng.poisson(site.integrity ? 0.01 : meanCount);
    for (let d = 0; d < count; d += 1) {
      const type = this.rng.pick(types);
      const occurred = type.atEnrollment
        ? enrollDay
        : this.rng.int(enrollDay, Math.min(endDay, this.asOfDay));
      this.deviate(site, subjectId, type, occurred);
    }
  }
}
