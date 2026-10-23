/**
 * The CTMS site staff feed: who served as principal investigator at each
 * site, and from when.
 *
 * The feed is derived from a portfolio rather than written by
 * `generatePortfolio`, so adding it left the portfolio, and its golden hash,
 * byte-identical. It reads only the portfolio's seed, studies, sites and
 * close-out visits, and draws from its own stream, so it is as reproducible
 * as the portfolio itself. Investigators are identified by an id, never by a
 * name.
 */
import type { Portfolio, SiteStaffAssignment } from "../../types";
import { isoDate, toDay } from "./calendar";
import { Stream } from "./stream";

/** Share of long-running sites whose principal investigator changes once. */
const PI_CHANGE_SHARE = 0.08;

/** Minimum days a site must run, activation to close-out or data cut, to change PI. */
const MIN_SPAN_DAYS = 240;

/**
 * Derives the principal investigator assignments of every site. Each site
 * starts with one investigator from its study's start; about one long-running
 * site in twelve, and at least one when any qualifies, hands over to a second
 * investigator between 90 days after activation and 60 days before its
 * close-out or the data cut.
 *
 * @param portfolio - The portfolio, from `generatePortfolio`.
 * @returns Assignments in site order, each site's in date order.
 */
export function siteStaffFeed(portfolio: Portfolio): SiteStaffAssignment[] {
  const rng = new Stream(portfolio.seed, "site-staff");
  const asOfDay = toDay(portfolio.asOf);
  const startOf = new Map(portfolio.studies.map((s) => [s.id, s.startOn]));
  const closeOut = new Map<string, number>();
  for (const visit of portfolio.feeds.ctms.monitoringVisits) {
    if (visit.type === "COV")
      closeOut.set(visit.siteId, toDay(visit.visitDate));
  }
  const endDay = (siteId: string) => closeOut.get(siteId) ?? asOfDay;

  const eligible = portfolio.sites
    .filter(
      (site) =>
        site.activatedOn !== null &&
        endDay(site.id) - toDay(site.activatedOn) >= MIN_SPAN_DAYS
    )
    .map((site) => site.id);
  const count =
    eligible.length === 0
      ? 0
      : Math.max(1, Math.round(eligible.length * PI_CHANGE_SHARE));
  const changing = new Set(rng.shuffle(eligible).slice(0, count));

  const assignments: SiteStaffAssignment[] = [];
  for (const site of portfolio.sites) {
    const base = {
      synthetic: true as const,
      source: "CTMS" as const,
      studyId: site.studyId,
      siteId: site.id,
      role: "principal-investigator" as const,
    };
    const first = {
      ...base,
      assignmentId: `${site.id}-PI1`,
      investigatorId: `INV-${site.id}-1`,
      startOn: startOf.get(site.studyId) ?? portfolio.asOf,
    };
    if (!changing.has(site.id) || site.activatedOn === null) {
      assignments.push({ ...first, endOn: null });
      continue;
    }
    const activation = toDay(site.activatedOn);
    const changeDay =
      activation + rng.int(90, endDay(site.id) - activation - 60);
    assignments.push(
      { ...first, endOn: isoDate(changeDay - 1) },
      {
        ...base,
        assignmentId: `${site.id}-PI2`,
        investigatorId: `INV-${site.id}-2`,
        startOn: isoDate(changeDay),
        endOn: null,
      }
    );
  }
  return assignments;
}
