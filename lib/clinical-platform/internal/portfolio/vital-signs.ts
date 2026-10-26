/**
 * The EDC vital signs feed of a portfolio study (#2957). Readings are drawn
 * after the study's visits, from a stream of their own, so adding them moved
 * no other generated value.
 */
import { clamp } from "@/lib/game-utils";
import type { EdcVitalSign, VitalSignTest } from "../../types";
import type { StudySimulation } from "./records";
import type { SitePlan } from "./sites";
import { Stream } from "./stream";

/** How one vital sign varies, in its unit. */
interface VitalSignModel {
  readonly test: VitalSignTest;
  readonly unit: string;
  /** Mean and spread of subjects' usual values. */
  readonly mean: number;
  readonly betweenSd: number;
  /** Spread of one subject's readings from visit to visit. */
  readonly withinSd: number;
  /** Plausible range; readings are held inside it. */
  readonly min: number;
  readonly max: number;
  /** Recorded precision: 1 for whole numbers, 0.1 for one decimal. */
  readonly step: number;
}

/** Vital signs taken at every visit, in the order a site records them. */
const VITAL_SIGN_MODELS: readonly VitalSignModel[] = [
  {
    test: "SYSBP",
    unit: "mmHg",
    mean: 128,
    betweenSd: 14,
    withinSd: 8,
    min: 85,
    max: 200,
    step: 1,
  },
  {
    test: "DIABP",
    unit: "mmHg",
    mean: 80,
    betweenSd: 9,
    withinSd: 6,
    min: 50,
    max: 120,
    step: 1,
  },
  {
    test: "PULSE",
    unit: "beats/min",
    mean: 72,
    betweenSd: 10,
    withinSd: 7,
    min: 45,
    max: 130,
    step: 1,
  },
  {
    test: "WEIGHT",
    unit: "kg",
    mean: 78,
    betweenSd: 15,
    withinSd: 1,
    min: 40,
    max: 160,
    step: 0.1,
  },
];

/**
 * Share of the usual visit-to-visit spread a site with a data integrity
 * signal shows: readings copied forward or invented vary too little.
 */
const INTEGRITY_WITHIN_SHARE = 0.3;

/**
 * What a site with a data integrity signal rounds its readings to: blood
 * pressure and pulse to the nearest 5, so every value ends in 0 or 5, and
 * weight to the whole kilogram.
 */
const INTEGRITY_STEP: Readonly<Record<VitalSignTest, number>> = {
  SYSBP: 5,
  DIABP: 5,
  PULSE: 5,
  WEIGHT: 1,
};

/** Diastolic pressure stays at least this far below systolic. */
const MIN_PULSE_PRESSURE = 20;

function round(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  return step < 1 ? Number(rounded.toFixed(1)) : rounded;
}

/**
 * Draws one study's vital signs. Each subject has a usual value for each
 * sign, and every entered visit records one reading of each, scattered
 * around it.
 *
 * @param seed - Portfolio seed.
 * @param studyId - The study's id.
 * @param plans - The study's sites.
 * @param sim - The study's subjects and visits.
 * @returns The study's readings, in visit order and then in the order of
 *   `VITAL_SIGN_MODELS`.
 */
export function vitalSigns(
  seed: number,
  studyId: string,
  plans: readonly SitePlan[],
  sim: StudySimulation
): EdcVitalSign[] {
  const rng = new Stream(seed, `${studyId}/vital-signs`);
  const integrity = new Set(plans.filter((p) => p.integrity).map((p) => p.id));
  const usual = new Map<string, readonly number[]>();
  const readings: EdcVitalSign[] = [];
  for (const visit of sim.visits) {
    const measuredOn = visit.visitDate;
    if (visit.status !== "entered" || measuredOn === null) continue;
    let baseline = usual.get(visit.subjectId);
    if (baseline === undefined) {
      baseline = VITAL_SIGN_MODELS.map((m) => rng.normal(m.mean, m.betweenSd));
      usual.set(visit.subjectId, baseline);
    }
    const flagged = integrity.has(visit.siteId);
    const values = VITAL_SIGN_MODELS.map((m, i) => {
      const spread = m.withinSd * (flagged ? INTEGRITY_WITHIN_SHARE : 1);
      const value = clamp(rng.normal(baseline[i], spread), m.min, m.max);
      return round(value, flagged ? INTEGRITY_STEP[m.test] : m.step);
    });
    // values[0] is systolic and values[1] diastolic.
    const ceiling = values[0] - MIN_PULSE_PRESSURE;
    if (values[1] > ceiling) {
      values[1] = flagged ? Math.floor(ceiling / 5) * 5 : ceiling;
    }
    VITAL_SIGN_MODELS.forEach((m, i) => {
      readings.push({
        synthetic: true,
        source: "EDC",
        vitalSignId: `${visit.visitId}-${m.test}`,
        visitId: visit.visitId,
        subjectId: visit.subjectId,
        studyId: visit.studyId,
        siteId: visit.siteId,
        test: m.test,
        value: values[i],
        unit: m.unit,
        measuredOn,
      });
    });
  }
  return readings;
}
