import {
  BIOSTAT_OPS_CAMPAIGN,
  type Act,
  type Campaign,
  type RunPlan,
  type Scenario,
} from "@/lib/trial-and-error";

/**
 * Written-order deals for UI tests (#2055). A run shuffles each Blind's deck
 * from its seed, and `CardTable` picks a fresh seed when none is given; these
 * helpers pin every card of every deck, so a test that drives known cards
 * finds them in hand on any seed. Seeded shuffling itself is covered by
 * trial-and-error-deal.test.ts.
 */

/** The scenario with its whole deck pinned: it deals in written order. */
export function authored<T extends Scenario>(scenario: T): T {
  return { ...scenario, pinned: scenario.deck.map((card) => card.id) };
}

function authoredAct(act: Act): Act {
  return {
    ...act,
    blinds: act.blinds.map(authored),
    ...(act.bossPool && { bossPool: act.bossPool.map(authored) }),
  };
}

/** The plan with every deck, boss pool and post-marketing study pinned. */
export function authoredPlan<T extends RunPlan>(plan: T): T {
  if (!("acts" in plan)) return authoredAct(plan) as T;
  const campaign: Campaign = {
    ...plan,
    acts: plan.acts.map(authoredAct),
    ...(plan.endless && {
      endless: {
        ...plan.endless,
        studies: plan.endless.studies.map(authoredAct),
      },
    }),
  };
  return campaign as T;
}

/** The campaign `CardTable` plays by default, dealt in written order. */
export const AUTHORED_CAMPAIGN = authoredPlan(BIOSTAT_OPS_CAMPAIGN);

/**
 * `AUTHORED_CAMPAIGN` with the Small Blind at its pre-#2055 quota of 450, so
 * a single corrected Draft A and its listing (828) clears it, for UI tests
 * that walk one hand from review to the next Blind.
 */
export const ONE_PAIR_CAMPAIGN: Campaign = {
  ...AUTHORED_CAMPAIGN,
  acts: AUTHORED_CAMPAIGN.acts.map((act, i) =>
    i === 0
      ? {
          ...act,
          blinds: act.blinds.map((b, j) =>
            j === 0 ? { ...b, blind: { ...b.blind, quota: 450 } } : b
          ),
        }
      : act
  ),
};
