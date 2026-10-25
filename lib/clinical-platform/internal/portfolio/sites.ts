/**
 * Site planning: sites per study, their countries, invented names, targets
 * and activation days, and the sites that carry a planted signal.
 */
import type { StudyBlueprint } from "./blueprint";
import {
  BEHIND_PLAN_STUDY_ID,
  DATA_INTEGRITY_STUDY_ID,
  NAME_ENDINGS,
  NAME_STEMS,
  SITE_KINDS,
  SLOW_SITE_STUDY_IDS,
} from "./blueprint";
import { Stream } from "./stream";

/** A site with the hidden traits that drive its operational data. */
export interface SitePlan {
  readonly id: string;
  readonly studyId: string;
  readonly siteNumber: string;
  readonly country: string;
  readonly name: string;
  readonly plannedEnrollment: number;
  /** Activation day number, or `null` when not activated by the data cut. */
  readonly activationDay: number | null;
  /** Day the site is planned to activate, even after the data cut. */
  readonly plannedActivationDay: number;
  /** Multiplier on the planned screening rate. */
  readonly speed: number;
  /** Mean days from visit to data entry. */
  readonly entryLagDays: number;
  /** Planted slow-enrolling site. */
  readonly slow: boolean;
  /** Planted data integrity signal. */
  readonly integrity: boolean;
}

/** Days from protocol finalisation to the first planned site activation. */
export const FIRST_ACTIVATION_OFFSET = 60;

/** Extra activation delay of the study planted behind plan. */
const BEHIND_PLAN_DELAY = 75;

/** Splits a total into integer parts proportional to the weights (largest remainder). */
function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let rest = total - parts.reduce((acc, p) => acc + p, 0);
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (const { index } of order) {
    if (rest === 0) break;
    parts[index] += 1;
    rest -= 1;
  }
  return parts;
}

function inventName(rng: Stream, taken: Set<string>): string {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const name = `${rng.pick(NAME_STEMS)}${rng.pick(NAME_ENDINGS)} ${rng.pick(SITE_KINDS)}`;
    if (!taken.has(name)) {
      taken.add(name);
      return name;
    }
  }
  const fallback = `${rng.pick(NAME_STEMS)}${rng.pick(NAME_ENDINGS)} Research Site ${taken.size + 1}`;
  taken.add(fallback);
  return fallback;
}

/**
 * Plans the sites of one study.
 *
 * @param seed - Portfolio seed.
 * @param study - Study blueprint.
 * @param startDay - Day number of the study start.
 * @param asOfDay - Day number of the data cut.
 * @param takenNames - Site names already used in the portfolio; updated.
 */
export function planSites(
  seed: number,
  study: StudyBlueprint,
  startDay: number,
  asOfDay: number,
  takenNames: Set<string>
): SitePlan[] {
  const rng = new Stream(seed, `${study.id}/sites`);
  const weights = Array.from({ length: study.siteCount }, () =>
    rng.real(0.6, 1.4)
  );
  const targets = apportion(study.plannedEnrollment, weights);
  const delay = study.id === BEHIND_PLAN_STUDY_ID ? BEHIND_PLAN_DELAY : 0;
  const drafts = targets.map((plannedEnrollment, index) => {
    const country = study.countries[index % study.countries.length];
    const siteNumber = String(101 + index);
    const offset =
      index === 0 ? rng.int(0, 10) : rng.int(10, study.activationSpreadDays);
    const activation = startDay + FIRST_ACTIVATION_OFFSET + delay + offset;
    return {
      id: `${study.id}-${country}-${siteNumber}`,
      studyId: study.id,
      siteNumber,
      country,
      name: inventName(rng, takenNames),
      plannedEnrollment,
      activationDay: activation <= asOfDay ? activation : null,
      plannedActivationDay: activation,
      speed: rng.real(0.7, 1.4),
      entryLagDays: rng.real(1.5, 6),
      slow: false,
      integrity: false,
    };
  });

  // Signals go to sites active for at least six months, so they show.
  const mature = drafts
    .filter(
      (site) =>
        site.activationDay !== null && site.activationDay <= asOfDay - 180
    )
    .map((site) => site.id);
  const shuffled = rng.shuffle(mature);
  const slowIds = new Set(
    SLOW_SITE_STUDY_IDS.includes(study.id) ? shuffled.slice(0, 2) : []
  );
  const integrityId =
    study.id === DATA_INTEGRITY_STUDY_ID ? (shuffled[2] ?? null) : null;

  return drafts.map((site) => {
    if (slowIds.has(site.id)) {
      return {
        ...site,
        slow: true,
        speed: rng.real(0.12, 0.25),
        entryLagDays: rng.real(8, 14),
      };
    }
    if (site.id === integrityId) {
      return { ...site, integrity: true, speed: rng.real(1.1, 1.4) };
    }
    return site;
  });
}
