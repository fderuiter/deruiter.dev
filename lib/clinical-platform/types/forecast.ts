/**
 * Clinical Data Platform: Poisson-gamma enrollment forecast and what-if types.
 */

/**
 * A gamma distribution of recruitment rates, in subjects per site-day:
 * shape α and rate β, with mean α / β (#2632).
 */
export interface RecruitmentRate {
  readonly shape: number;
  readonly rate: number;
}

/** One recruiting site at the data cut, with its posterior rate (#2632). */
export interface SiteRecruitment {
  readonly siteId: string;
  readonly countryCode: string;
  /** Subjects enrolled at the site up to the data cut. */
  readonly enrolled: number;
  /** Days from the site's activation to the data cut. */
  readonly exposureDays: number;
  /** The site's rate given the study's prior and its own enrollment. */
  readonly posterior: RecruitmentRate;
}

/** Sites to add in a what-if, all activating on the same day (#2632). */
export interface EnrollmentWhatIf {
  /** ISO 3166-1 alpha-2 country the sites open in. */
  readonly countryCode: string;
  /** How many sites to add, from 1 to 50. */
  readonly sites: number;
  /** Days from the data cut until the new sites start recruiting, from 0 to 365. */
  readonly activationDelayDays: number;
}

/** A recruitment process to simulate: the input of `simulateEnrollmentCompletion` (#2632). */
export interface EnrollmentSimulationInput {
  /** Subjects still to enroll, 1 or more. */
  readonly remaining: number;
  /** Rates of the sites recruiting from day 0. */
  readonly sites: readonly RecruitmentRate[];
  /** Rates of sites that start recruiting later, with their first day. */
  readonly laterSites: readonly (RecruitmentRate & {
    readonly startDay: number;
  })[];
  /** Number of simulated runs, from 100 to 20,000. */
  readonly runs: number;
  /** Key of the random stream; the same key gives the same runs. */
  readonly streamKey: string;
}

/** Share of runs that have enrolled the last subject by a date (#2632). */
export interface EnrollmentForecastPoint {
  /** ISO 8601 date. */
  readonly on: string;
  /** Share of runs complete by that date, from 0 to 1. */
  readonly completed: number;
}

/** A Monte Carlo enrollment forecast for one study at a data cut (#2632). */
export interface EnrollmentForecast {
  readonly studyId: string;
  /** ISO 8601 data cut of the warehouse. */
  readonly dataCut: string;
  /** Enrollment target of the study. */
  readonly target: number;
  /** Subjects enrolled up to the data cut. */
  readonly enrolled: number;
  /** ISO 8601 planned last-subject-in date, from the study's milestones. */
  readonly plannedLastSubjectIn: string;
  /** The study's prior, fitted to its sites by maximum likelihood. */
  readonly prior: RecruitmentRate;
  /** Recruiting sites at the data cut, in id order. */
  readonly sites: readonly SiteRecruitment[];
  /** The what-if applied, or `null` for the baseline. */
  readonly whatIf: EnrollmentWhatIf | null;
  /** Rate a new site in the what-if's country recruits at, or `null` without a what-if. */
  readonly whatIfSiteRate: RecruitmentRate | null;
  readonly runs: number;
  readonly seed: number;
  /** Share of runs that enroll the last subject on or before the planned date. */
  readonly probabilityByPlan: number;
  /** ISO 8601 dates by which 10%, 50% and 90% of runs are complete. */
  readonly quantiles: {
    readonly p10: string;
    readonly p50: string;
    readonly p90: string;
  };
  /** Share of runs complete by each week from the data cut until 99% are. */
  readonly curve: readonly EnrollmentForecastPoint[];
}
