/**
 * The enrollment forecast for one study at its data cut (#2632): the
 * Poisson-gamma model fitted to the study's recruiting sites, simulated to
 * the enrollment target, and read against the planned last-subject-in date.
 *
 * Assumptions, each shown with the forecast:
 * - Sites active at the data cut keep recruiting at their own rate until
 *   the study's target is met; no site closes or caps out early. A site
 *   activated on the data cut has no history yet and recruits at the prior.
 * - Sites still in start-up at the data cut are left out, since the
 *   warehouse holds no planned activation date for them; a what-if adds
 *   them.
 * - A what-if site recruits like the study's sites in its country: shape α
 *   from the study's prior and a mean equal to the country's sites pooled
 *   and shrunk to the prior, (α + Σn) / (β + Στ). A country with no sites
 *   gets the prior unchanged.
 */
import type {
  EnrollmentForecast,
  EnrollmentForecastPoint,
  EnrollmentWhatIf,
  RecruitmentRate,
  SiteRecruitment,
  Warehouse,
  WarehouseRow,
} from "../../types";
import { addDays, daysBetween } from "../warehouse/dates";
import { fitRecruitmentPrior, posteriorRate } from "./fit";
import { simulateEnrollmentCompletion } from "./simulate";

/** Runs a forecast takes unless told otherwise. */
export const FORECAST_DEFAULT_RUNS = 2000;
/** Seed a forecast uses unless told otherwise. */
export const FORECAST_DEFAULT_SEED = 2632;
const MAX_WHAT_IF_SITES = 50;
const MAX_ACTIVATION_DELAY = 365;
/** The curve stops after ten years even if 1% of runs are still enrolling. */
const MAX_CURVE_WEEKS = 520;

function rows(warehouse: Warehouse, table: string): readonly WarehouseRow[] {
  const found = warehouse.tables[table];
  if (found === undefined) throw new Error(`the warehouse has no ${table}`);
  return found;
}

/** `20240603` as `2024-06-03`. */
function isoDate(key: unknown): string {
  const text = String(key);
  return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
}

function checkWhatIf(whatIf: EnrollmentWhatIf): void {
  if (!/^[A-Z]{2}$/.test(whatIf.countryCode)) {
    throw new RangeError(
      `countryCode must be two capital letters, got ${whatIf.countryCode}`
    );
  }
  if (
    !Number.isInteger(whatIf.sites) ||
    whatIf.sites < 1 ||
    whatIf.sites > MAX_WHAT_IF_SITES
  ) {
    throw new RangeError(
      `sites must be a whole number from 1 to ${MAX_WHAT_IF_SITES}, got ${whatIf.sites}`
    );
  }
  if (
    !Number.isInteger(whatIf.activationDelayDays) ||
    whatIf.activationDelayDays < 0 ||
    whatIf.activationDelayDays > MAX_ACTIVATION_DELAY
  ) {
    throw new RangeError(
      `activationDelayDays must be a whole number from 0 to ${MAX_ACTIVATION_DELAY}, got ${whatIf.activationDelayDays}`
    );
  }
}

/** Rate of a new site in a country: the prior's shape, the country's shrunken mean. */
function countryRate(
  prior: RecruitmentRate,
  sites: readonly SiteRecruitment[],
  countryCode: string
): RecruitmentRate {
  const local = sites.filter((s) => s.countryCode === countryCode);
  const enrolled = local.reduce((sum, s) => sum + s.enrolled, 0);
  const exposure = local.reduce((sum, s) => sum + s.exposureDays, 0);
  const mean = (prior.shape + enrolled) / (prior.rate + exposure);
  return { shape: prior.shape, rate: prior.shape / mean };
}

/** The first day by which a run has enrolled its last subject. */
function completionDay(time: number): number {
  return Math.max(1, Math.ceil(time));
}

/**
 * Forecasts when a study enrolls its last subject.
 *
 * @param warehouse - A warehouse from `buildWarehouse`.
 * @param studyId - A study still enrolling at the warehouse's data cut.
 * @param options - `whatIf` sites to add; `runs` (default 2000) and `seed` (default 2632).
 * @returns The forecast: the fitted prior, each site's posterior, the chance of meeting the planned date, quantiles and a weekly curve.
 * @throws Error for an unknown study or one that is not enrolling; RangeError for options outside their domain.
 */
export function forecastEnrollment(
  warehouse: Warehouse,
  studyId: string,
  options: {
    readonly whatIf?: EnrollmentWhatIf | null;
    readonly runs?: number;
    readonly seed?: number;
  } = {}
): EnrollmentForecast {
  const runs = options.runs ?? FORECAST_DEFAULT_RUNS;
  const seed = options.seed ?? FORECAST_DEFAULT_SEED;
  if (!Number.isInteger(seed) || seed < 0) {
    throw new RangeError(
      `seed must be a whole number of 0 or more, got ${seed}`
    );
  }
  const whatIf = options.whatIf ?? null;
  if (whatIf !== null) checkWhatIf(whatIf);

  const study = rows(warehouse, "gold.dim_study").find(
    (s) => s.study_id === studyId
  );
  if (study === undefined) throw new Error(`unknown study ${studyId}`);
  const kinds = new Map(
    rows(warehouse, "gold.dim_milestone").map((m) => [
      m.milestone_key,
      m.milestone_kind,
    ])
  );
  const lastIn = rows(warehouse, "gold.fct_milestone").find(
    (m) =>
      m.study_key === study.study_key &&
      kinds.get(m.milestone_key) === "last-subject-in"
  );
  if (lastIn === undefined) {
    throw new Error(`${studyId} has no last-subject-in milestone`);
  }
  if (lastIn.is_reached === true) {
    throw new Error(
      `${studyId} enrolled its last subject on ${isoDate(lastIn.actual_date_key)}; there is nothing to forecast`
    );
  }

  const dataCut = warehouse.asOf;
  const versions = rows(warehouse, "gold.dim_site").filter(
    (s) => s.study_id === studyId
  );
  const siteOfKey = new Map(versions.map((s) => [s.site_key, s.site_id]));
  const enrolledAt = new Map<unknown, number>();
  let enrolled = 0;
  for (const event of rows(warehouse, "gold.fct_enrollment")) {
    if (event.study_key !== study.study_key || event.event_type !== "enrolled")
      continue;
    enrolled += 1;
    const siteId = siteOfKey.get(event.site_key);
    enrolledAt.set(siteId, (enrolledAt.get(siteId) ?? 0) + 1);
  }
  const target = Number(study.planned_enrollment);
  if (enrolled >= target) {
    throw new Error(
      `${studyId} has enrolled ${enrolled} of ${target}; there is nothing to forecast`
    );
  }

  const recruiting = versions
    .filter(
      (s) =>
        s.is_current === true &&
        s.site_status === "active" &&
        typeof s.activated_on === "string" &&
        daysBetween(s.activated_on, dataCut) >= 0
    )
    .map((s) => ({
      siteId: String(s.site_id),
      countryCode: String(s.country_code),
      enrolled: enrolledAt.get(s.site_id) ?? 0,
      exposureDays: daysBetween(String(s.activated_on), dataCut),
    }))
    .sort((a, b) => (a.siteId < b.siteId ? -1 : a.siteId > b.siteId ? 1 : 0));
  const prior = fitRecruitmentPrior(
    recruiting.filter((s) => s.exposureDays > 0)
  );
  const sites: SiteRecruitment[] = recruiting.map((s) => ({
    ...s,
    posterior: posteriorRate(prior, s),
  }));
  const whatIfSiteRate =
    whatIf === null ? null : countryRate(prior, sites, whatIf.countryCode);

  const times = simulateEnrollmentCompletion({
    remaining: target - enrolled,
    sites: sites.map((s) => s.posterior),
    laterSites:
      whatIf === null || whatIfSiteRate === null
        ? []
        : Array.from({ length: whatIf.sites }, () => ({
            ...whatIfSiteRate,
            startDay: whatIf.activationDelayDays,
          })),
    runs,
    streamKey: `forecast:${seed}:${studyId}`,
  });
  const days = times.map(completionDay);
  const plannedLastSubjectIn = isoDate(lastIn.planned_date_key);
  const planDay = daysBetween(dataCut, plannedLastSubjectIn);
  const share = (day: number) => {
    // `days` is sorted: count the runs complete by `day`.
    let lo = 0;
    let hi = days.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (days[mid] <= day) lo = mid + 1;
      else hi = mid;
    }
    return lo / days.length;
  };
  const quantile = (q: number) =>
    addDays(dataCut, days[Math.ceil(q * days.length) - 1]);

  const curve: EnrollmentForecastPoint[] = [];
  for (let week = 0; week <= MAX_CURVE_WEEKS; week += 1) {
    const completed = share(week * 7);
    curve.push({ on: addDays(dataCut, week * 7), completed });
    if (completed >= 0.99) break;
  }

  return {
    studyId,
    dataCut,
    target,
    enrolled,
    plannedLastSubjectIn,
    prior,
    sites,
    whatIf,
    whatIfSiteRate,
    runs,
    seed,
    probabilityByPlan: planDay < 1 ? 0 : share(planDay),
    quantiles: {
      p10: quantile(0.1),
      p50: quantile(0.5),
      p90: quantile(0.9),
    },
    curve,
  };
}
