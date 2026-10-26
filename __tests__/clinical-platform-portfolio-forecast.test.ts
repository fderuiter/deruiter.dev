import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO_SEED,
  PORTFOLIO_WHAT_IF_LIMITS,
  buildWarehouse,
  forecastEnrollment,
  generatePortfolio,
  portfolioDashboard,
  portfolioForecast,
  type EnrollmentWhatIf,
} from "@/lib/clinical-platform";

/**
 * The enrollment forecast on /platform/portfolio (#2913): the page's
 * forecasts are `forecastEnrollment`'s, with the plan in words and the
 * countries a what-if can open sites in.
 */

const warehouse = buildWarehouse(
  generatePortfolio({ seed: DEFAULT_PORTFOLIO_SEED })
);
const dashboard = portfolioDashboard(warehouse);
const germany: EnrollmentWhatIf = {
  countryCode: "DE",
  sites: 5,
  activationDelayDays: 90,
};

describe("the dashboard's enrollment forecasts (#2913)", () => {
  it("forecasts every study with its first subject in and its last still to come", () => {
    const enrolling = dashboard.swimlane.lanes
      .filter((lane) => {
        const actual = (kind: string) =>
          lane.milestones.find((m) => m.kind === kind)?.actual;
        return (
          actual("first-subject-in") != null &&
          actual("last-subject-in") == null
        );
      })
      .map((lane) => lane.studyId);
    expect(dashboard.forecasts.map((f) => f.studyId)).toEqual(enrolling);
    expect(enrolling).toEqual(["DEMO-302", "DEV-402"]);
  });

  it("shows exactly what forecastEnrollment forecasts for the same seed", () => {
    for (const shown of dashboard.forecasts) {
      expect(shown.forecast).toEqual(
        forecastEnrollment(warehouse, shown.studyId)
      );
      expect(shown.forecast.whatIf).toBeNull();
    }
  });

  it("says a plan date already passed in words, not as 0%", () => {
    const [late, open] = dashboard.forecasts;
    expect(late.forecast.plannedLastSubjectIn).toBe("2026-06-14");
    expect(late.planPassed).toBe(true);
    expect(late.probabilityText).toBe("Planned date passed");
    expect(late.runsByPlan).toBe(0);

    expect(open.forecast.plannedLastSubjectIn > warehouse.asOf).toBe(true);
    expect(open.planPassed).toBe(false);
    expect(open.probabilityText).toBe("0.2%");
    expect(open.runsByPlan).toBe(4);
    expect(open.runsByPlan / open.forecast.runs).toBe(
      open.forecast.probabilityByPlan
    );
  });

  it("offers every country with a site, by name, with the study's recruiting sites there", () => {
    const all = warehouse.tables["gold.dim_country"].map((c) =>
      String(c.country_code)
    );
    for (const shown of dashboard.forecasts) {
      expect(shown.countries.map((c) => c.code).sort()).toEqual(all.sort());
      const names = shown.countries.map((c) => c.name);
      expect(names).toEqual(
        [...names].sort((a, b) => a.localeCompare(b, "en"))
      );
      for (const country of shown.countries) {
        expect(country.sites, country.code).toBe(
          shown.forecast.sites.filter((s) => s.countryCode === country.code)
            .length
        );
      }
    }
    // DEV-402 recruits in five countries; the others are open to a what-if.
    const dev = dashboard.forecasts[1];
    expect(dev.countries.filter((c) => c.sites > 0).map((c) => c.code)).toEqual(
      ["CA", "DE", "NL", "GB", "US"]
    );
  });
});

describe("portfolioForecast with a what-if (#2913)", () => {
  it("is forecastEnrollment with the same what-if, and the same every time", () => {
    const first = portfolioForecast(warehouse, "DEMO-302", germany);
    expect(first.forecast).toEqual(
      forecastEnrollment(warehouse, "DEMO-302", { whatIf: germany })
    );
    expect(portfolioForecast(warehouse, "DEMO-302", germany)).toEqual(first);
    expect(first.forecast.whatIf).toEqual(germany);
  });

  it("brings the last subject in sooner with more sites", () => {
    const baseline = dashboard.forecasts[0].forecast.quantiles.p50;
    const five = portfolioForecast(warehouse, "DEMO-302", germany).forecast
      .quantiles.p50;
    const twenty = portfolioForecast(warehouse, "DEMO-302", {
      ...germany,
      sites: 20,
    }).forecast.quantiles.p50;
    expect(five < baseline).toBe(true);
    expect(twenty < five).toBe(true);
  });

  it("states the engine's own bounds", () => {
    const at = (whatIf: Partial<EnrollmentWhatIf>) => () =>
      portfolioForecast(warehouse, "DEV-402", { ...germany, ...whatIf });
    const { sites, activationDelayDays } = PORTFOLIO_WHAT_IF_LIMITS;
    expect(at({ sites: sites.min })).not.toThrow();
    expect(at({ sites: sites.max })).not.toThrow();
    expect(at({ sites: sites.min - 1 })).toThrow(RangeError);
    expect(at({ sites: sites.max + 1 })).toThrow(RangeError);
    expect(at({ activationDelayDays: activationDelayDays.min })).not.toThrow();
    expect(at({ activationDelayDays: activationDelayDays.max })).not.toThrow();
    expect(at({ activationDelayDays: activationDelayDays.min - 1 })).toThrow(
      RangeError
    );
    expect(at({ activationDelayDays: activationDelayDays.max + 1 })).toThrow(
      RangeError
    );
  });

  it("refuses a study that is not enrolling, as the engine does", () => {
    expect(() => portfolioForecast(warehouse, "DEMO-101")).toThrow(
      "there is nothing to forecast"
    );
  });
});
