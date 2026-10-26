/**
 * Site start-up before activation: when each site was selected, when its
 * clinical trial agreement was executed, and when its IRB or ethics
 * committee approved the study. The CTMS records these stages; the site
 * initiation visit and the activation that follow them come from the
 * monitoring visits and the site plan (#2880).
 */
import type { StudyBlueprint } from "./blueprint";
import type { SitePlan } from "./sites";
import { Stream } from "./stream";

/** Most days a site initiation visit precedes its site's activation. */
export const SIV_LEAD_DAYS = 7;

/** A site's start-up stage days, each `null` until it is reached. */
export interface StartUpDays {
  readonly selected: number | null;
  readonly contracted: number | null;
  readonly irbApproved: number | null;
}

/**
 * Draws the start-up stages of a study's sites from a stream of their own,
 * so adding them moved no other generated value. The stages run backwards
 * from each site's planned activation: IRB approval comes before the
 * earliest day its initiation visit can fall, and no stage comes before
 * protocol finalisation. A site that activates soon after finalisation has
 * its gaps shortened in proportion to fit. A stage after the data cut has
 * not been reached, even for a site that never activates by then.
 *
 * @param seed - Portfolio seed.
 * @param study - Study blueprint.
 * @param sites - The study's sites, in order.
 * @param startDay - Day number of protocol finalisation.
 * @param asOfDay - Day number of the data cut.
 * @returns Stage days by site id.
 */
export function startUpStages(
  seed: number,
  study: StudyBlueprint,
  sites: readonly SitePlan[],
  startDay: number,
  asOfDay: number
): Map<string, StartUpDays> {
  const rng = new Stream(seed, `${study.id}/site-start-up`);
  const reached = (day: number) => (day <= asOfDay ? day : null);
  const stages = new Map<string, StartUpDays>();
  for (const site of sites) {
    // Approval to the latest day before initiation, agreement to approval,
    // selection to agreement.
    const gaps = [rng.int(3, 30), rng.int(10, 45), rng.int(20, 60)];
    const latest = site.plannedActivationDay - SIV_LEAD_DAYS - 1;
    const total = gaps.reduce((sum, gap) => sum + gap, 0);
    const room = Math.max(0, latest - startDay);
    const scale = total > room ? room / total : 1;
    const [approval, agreement, selection] = gaps.map((gap) =>
      Math.floor(gap * scale)
    );
    const irbApproved = latest - approval;
    const contracted = irbApproved - agreement;
    const selected = contracted - selection;
    stages.set(site.id, {
      selected: reached(selected),
      contracted: reached(contracted),
      irbApproved: reached(irbApproved),
    });
  }
  return stages;
}
