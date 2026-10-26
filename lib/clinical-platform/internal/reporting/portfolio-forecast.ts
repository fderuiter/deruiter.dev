/**
 * The enrollment forecast on /platform/portfolio (#2913): each study still
 * enrolling, forecast by `forecastEnrollment` from the same warehouse, with
 * the countries a what-if can open sites in and the chance of meeting the
 * plan in words.
 */
import type {
  EnrollmentWhatIf,
  PortfolioForecast,
  PortfolioForecastCountry,
  PortfolioLane,
  Warehouse,
  WarehouseRow,
} from "../../types";
import { forecastEnrollment } from "../forecast/enrollment";

/**
 * The bounds `forecastEnrollment` checks a what-if against, so a form can
 * check them before it asks (#2913).
 */
export const PORTFOLIO_WHAT_IF_LIMITS = {
  sites: { min: 1, max: 50 },
  activationDelayDays: { min: 0, max: 365 },
} as const;

/**
 * The model's assumptions in plain words, shown with every forecast
 * (#2913). They restate those of `forecastEnrollment`.
 */
export const PORTFOLIO_FORECAST_ASSUMPTIONS: readonly string[] = [
  "Sites recruiting at the data cut keep recruiting at their own rate until the target is met. None closes or stops early.",
  "Sites still in start-up at the data cut are left out, because the warehouse has no planned activation date for them. A what-if adds sites instead.",
  "A what-if site recruits like the study's sites in its country. In a country where the study has no sites, it recruits like the study's sites overall.",
];

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

function rows(warehouse: Warehouse, table: string): readonly WarehouseRow[] {
  const found = warehouse.tables[table];
  if (found === undefined) throw new Error(`the warehouse has no ${table}`);
  return found;
}

/** Whether a lane has its first subject in and its last subject still to come. */
export function isEnrolling(lane: PortfolioLane): boolean {
  const reached = (kind: string) =>
    lane.milestones.find((m) => m.kind === kind)?.actual != null;
  return reached("first-subject-in") && !reached("last-subject-in");
}

/**
 * One study's enrollment forecast as the portfolio page shows it.
 *
 * @param warehouse - A warehouse from `buildWarehouse`.
 * @param studyId - A study still enrolling at the warehouse's data cut.
 * @param whatIf - Sites to add, or `null` for the baseline.
 * @returns The forecast from `forecastEnrollment` with its default runs and
 * seed, the chance of meeting the plan in words, and the countries a
 * what-if can open sites in.
 * @throws What `forecastEnrollment` throws: Error for an unknown study or
 * one that is not enrolling, RangeError for a what-if outside its bounds.
 */
export function portfolioForecast(
  warehouse: Warehouse,
  studyId: string,
  whatIf: EnrollmentWhatIf | null = null
): PortfolioForecast {
  const forecast = forecastEnrollment(warehouse, studyId, { whatIf });
  const study = rows(warehouse, "gold.dim_study").find(
    (s) => s.study_id === studyId
  );
  const recruiting = new Map<string, number>();
  for (const site of forecast.sites) {
    recruiting.set(
      site.countryCode,
      (recruiting.get(site.countryCode) ?? 0) + 1
    );
  }
  const countries: PortfolioForecastCountry[] = rows(
    warehouse,
    "gold.dim_country"
  )
    .map((c) => ({
      code: String(c.country_code),
      name: String(c.country_name),
      sites: recruiting.get(String(c.country_code)) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const planPassed = forecast.plannedLastSubjectIn <= forecast.dataCut;
  return {
    studyId,
    title: String(study?.study_title),
    forecast,
    planPassed,
    probabilityText: planPassed
      ? "Planned date passed"
      : percent.format(forecast.probabilityByPlan),
    runsByPlan: Math.round(forecast.probabilityByPlan * forecast.runs),
    countries,
  };
}
