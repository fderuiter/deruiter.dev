import type {
  Act,
  Campaign,
  Relic,
  Scenario,
  ShopCatalog,
  SponsorId,
  Stake,
} from "../types";
import { raiseQuotas } from "./quotas";
import {
  DEFAULT_SPONSOR_ID,
  sponsorById,
  sponsorCardChips,
  sponsorHandLevels,
  sponsorHandSize,
  type Sponsor,
} from "./sponsors";
import { DEFAULT_STAKE, stakeModifiers, type StakeModifiers } from "./stakes";
import type { Inventory } from "./table";

/**
 * A run's sponsor and stake (#950) as one rewrite of the plan it plays.
 * Pure: the same plan and choice always give the same rewritten plan, and
 * the default choice gives back the plan itself, so a default run plays
 * exactly the authored data.
 */

/** The sponsor and stake a run is played under. */
export interface RunChoice {
  sponsorId: SponsorId;
  stake: Stake;
}

/** What a run is played under by default: Virtual Biotech at stake 1. */
export const DEFAULT_RUN_CHOICE: Readonly<RunChoice> = Object.freeze({
  sponsorId: DEFAULT_SPONSOR_ID,
  stake: DEFAULT_STAKE,
});

/**
 * A full choice from a partial one, defaults filled in. Throws on an unknown
 * sponsor or a stake off the ladder, which are programming errors.
 */
export function resolveRunChoice(options: Partial<RunChoice> = {}): RunChoice {
  const choice: RunChoice = {
    sponsorId: options.sponsorId ?? DEFAULT_SPONSOR_ID,
    stake: options.stake ?? DEFAULT_STAKE,
  };
  sponsorById(choice.sponsorId);
  stakeModifiers(choice.stake);
  return choice;
}

/** Whether a choice is the default, which leaves the plan untouched. */
export function isDefaultChoice(choice: RunChoice): boolean {
  return (
    choice.sponsorId === DEFAULT_SPONSOR_ID && choice.stake === DEFAULT_STAKE
  );
}

type Plan = Act | Campaign;

/** A Blind under a sponsor and stake, with its quotas raised by `quotaFactor`. */
function ruledScenario(
  scenario: Scenario,
  sponsor: Sponsor,
  modifiers: StakeModifiers,
  quotaFactor: number
): Scenario {
  const raised =
    quotaFactor === 1 ? scenario : raiseQuotas(scenario, quotaFactor);
  const penalty = modifiers.redlinePenaltyFactor;
  return {
    ...raised,
    table: {
      ...raised.table,
      handSize: sponsorHandSize(sponsor, raised.table.handSize),
    },
    deck: raised.deck.map((card) => {
      const chips = sponsorCardChips(sponsor, card);
      return chips === 0 ? card : { ...card, chips: card.chips + chips };
    }),
    rulebook:
      penalty === 1
        ? raised.rulebook
        : {
            ...raised.rulebook,
            rules: raised.rulebook.rules.map((rule) => ({
              ...rule,
              redlineMultPenalty: rule.redlineMultPenalty * penalty,
            })),
          },
  };
}

/** A shop with every price, single items and packs, raised by `surcharge`. */
function ruledShop(shop: ShopCatalog, surcharge: number): ShopCatalog {
  if (surcharge === 0) return shop;
  return {
    ...shop,
    entries: shop.entries.map((entry) => ({
      ...entry,
      price: entry.price + surcharge,
    })),
    packs: shop.packs.map((pack) => ({
      ...pack,
      price: pack.price + surcharge,
    })),
  };
}

function ruledAct(
  act: Act,
  sponsor: Sponsor,
  modifiers: StakeModifiers,
  quotaFactor: number
): Act {
  const blind = (s: Scenario) =>
    ruledScenario(s, sponsor, modifiers, quotaFactor);
  return {
    ...act,
    blinds: act.blinds.map(blind),
    ...(act.bossPool && { bossPool: act.bossPool.map(blind) }),
    ...(act.shop && { shop: ruledShop(act.shop, modifiers.shopSurcharge) }),
  };
}

function rewritePlan(plan: Plan, choice: RunChoice): Plan {
  const sponsor = sponsorById(choice.sponsorId);
  const modifiers = stakeModifiers(choice.stake);
  if (!("acts" in plan)) {
    return ruledAct(plan, sponsor, modifiers, sponsor.quotaFactor);
  }
  const { endless } = plan;
  return {
    ...plan,
    // Warning Letter compounds per act: act n's quotas × growth ^ n.
    acts: plan.acts.map((act, index) =>
      ruledAct(
        act,
        sponsor,
        modifiers,
        sponsor.quotaFactor * modifiers.actQuotaGrowth ** index
      )
    ),
    ...(endless && {
      endless: {
        ...endless,
        studies: endless.studies.map((study) =>
          ruledAct(study, sponsor, modifiers, sponsor.quotaFactor)
        ),
        // Post-marketing rounds already compound; Warning Letter steepens it.
        quotaGrowth: endless.quotaGrowth * modifiers.actQuotaGrowth,
      },
    }),
  };
}

/** Rewritten plans by authored plan and choice, so a run reuses one object. */
const rewritten = new WeakMap<Plan, Map<string, Plan>>();

/**
 * The plan a run plays under `choice`: every Blind's hand size, deck Chips,
 * quotas and redline penalties, and every shop price, rewritten by the
 * sponsor and stake. The default choice returns `plan` itself.
 */
export function ruledPlan<P extends Plan>(plan: P, choice: RunChoice): P {
  if (isDefaultChoice(choice)) return plan;
  const key = `${choice.sponsorId}/${choice.stake}`;
  let byChoice = rewritten.get(plan);
  if (!byChoice) {
    byChoice = new Map();
    rewritten.set(plan, byChoice);
  }
  let ruled = byChoice.get(key);
  if (!ruled) {
    ruled = rewritePlan(plan, choice);
    byChoice.set(key, ruled);
  }
  return ruled as P;
}

/** The relic with `id` in any shop of the plan, if one stocks it. */
function shopRelic(plan: Plan, id: string): Relic | undefined {
  const acts =
    "acts" in plan ? [...plan.acts, ...(plan.endless?.studies ?? [])] : [plan];
  for (const act of acts) {
    for (const entry of act.shop?.entries ?? []) {
      if (entry.kind === "RELIC" && entry.relic.id === id) return entry.relic;
    }
  }
  return undefined;
}

/**
 * What a sponsor starts the run with: its relic, taken from the plan's shop
 * data, its budget and its hand levels. Undefined for a sponsor with no
 * starting kit, so the first table is dealt exactly as without one. A
 * starting relic no shop in the plan stocks is left out.
 */
export function startingInventory(
  plan: Plan,
  sponsorId: SponsorId
): Inventory | undefined {
  const sponsor = sponsorById(sponsorId);
  const relic = sponsor.startingRelicId
    ? shopRelic(plan, sponsor.startingRelicId)
    : undefined;
  if (
    !relic &&
    sponsor.startingBudget === 0 &&
    Object.keys(sponsor.startingHandLevels).length === 0
  ) {
    return undefined;
  }
  return {
    consumables: [],
    budget: sponsor.startingBudget,
    handLevels: sponsorHandLevels(sponsor),
    relics: relic ? [relic] : [],
  };
}
