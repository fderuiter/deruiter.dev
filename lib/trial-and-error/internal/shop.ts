import type {
  BlindTier,
  Pack,
  PopulationTransition,
  SapRulebook,
  ShopCatalog,
  ShopEntry,
  Site,
} from "../types";
import { POPULATION_LABELS, shopEntryId } from "../types";
import { amendedRule } from "./amendments";
import { drawInt } from "./rng";

/**
 * The Procurement Shop's economy (#948): the Study Budget the
 * sponsor pays at each Blind's cash-out, and the seeded stock the shop
 * offers between Blinds. Pure: every draw comes from the seeded PRNG, on a
 * stream of its own so shopping never shifts the run's crisis draws.
 */

/** The sponsor's base payout at cash-out, by Blind tier, in $k. */
export const CASH_OUT_BASE: Readonly<Record<BlindTier, number>> = Object.freeze(
  { SMALL_BLIND: 3, BIG_BLIND: 4, BOSS_BLIND: 5 }
);

/** Interest pays $1k per this much held at cash-out. */
export const INTEREST_STEP = 5;

/** Interest never pays more than this at one cash-out. */
export const INTEREST_CAP = 5;

/** The first reroll's price; each later reroll in a visit costs $1k more. */
export const REROLL_BASE_PRICE = 5;

/** Single-item slots per shop visit. */
export const SHOP_SLOTS = 2;

/** Booster pack slots per shop visit. */
export const PACK_SLOTS = 2;

/** One line of a cash-out breakdown. */
export interface CashOutLine {
  id: "BASE" | "CPU" | "INTEREST";
  label: string;
  amount: number;
}

/** A Blind's cash-out: the lines in the order they tick in, and their total. */
export interface CashOutReport {
  lines: CashOutLine[];
  total: number;
}

/**
 * The sponsor's payout for a cleared Blind: a base by tier, $1k per unspent
 * Hand-equivalent of CPU, and interest of $1k per $5k already held, capped.
 * Every amount is a whole, non-negative number of $k.
 */
export function cashOut(
  tier: BlindTier,
  cpuLeft: number,
  budget: number
): CashOutReport {
  const hands = Math.floor(Math.max(0, cpuLeft) / 2);
  const interest = Math.min(
    INTEREST_CAP,
    Math.floor(Math.max(0, budget) / INTEREST_STEP)
  );
  const lines: CashOutLine[] = [
    {
      id: "BASE",
      label: "Sponsor milestone payment",
      amount: CASH_OUT_BASE[tier],
    },
    {
      id: "CPU",
      label: `Unspent CPU (${hands} ${hands === 1 ? "hand" : "hands"})`,
      amount: hands,
    },
    {
      id: "INTEREST",
      label: `Interest ($1k per $${INTEREST_STEP}k held, max $${INTEREST_CAP}k)`,
      amount: interest,
    },
  ];
  return { lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}

/** What the `rerolls`-th reroll of a visit costs, from 0. */
export function rerollPrice(rerolls: number): number {
  return REROLL_BASE_PRICE + Math.max(0, Math.trunc(rerolls));
}

/** What selling an item bought for `price` returns: half, rounded down. */
export function sellValue(price: number): number {
  return Math.floor(Math.max(0, price) / 2);
}

/**
 * Whether an entry fits the SAP rulebook in force, so the shop never sells
 * something the SAP contradicts. A waiver seal fits only a rulebook with a
 * rule it waives; a seal restricted to populations fits only a rulebook
 * whose population suit, or an alias of it, is one of them.
 */
export function fitsRulebook(entry: ShopEntry, rulebook: SapRulebook): boolean {
  if (entry.kind === "AMENDMENT") {
    return amendedRule(rulebook, entry.amendment) !== null;
  }
  if (entry.kind !== "SEAL") return true;
  const { seal } = entry;
  if (
    seal.effect.kind === "WAIVE" &&
    !rulebook.rules.some((rule) => (rule.waivableBy ?? []).includes(seal.id))
  ) {
    return false;
  }
  const populations = seal.eligible.populations;
  if (!populations) return true;
  const suit = new Set([
    rulebook.populationSuit,
    ...rulebook.populationAliases
      .filter(
        (a) =>
          a.population === rulebook.populationSuit ||
          a.equals === rulebook.populationSuit
      )
      .flatMap((a) => [a.population, a.equals]),
  ]);
  return populations.some((p) => suit.has(p));
}

/** A seeded draw on the shop's stream: the value and the next draw index. */
export interface ShopDraw {
  value: number;
  next: number;
}

/** The shop stream's seed: the run seed, kept apart from the event draws. */
export const shopSeed = (seed: string) => `${seed}/shop`;

/**
 * Draws up to `count` distinct items from `pool` without replacement on the
 * shop stream, starting at `drawIndex`. Consumes one draw per item taken.
 */
export function drawDistinct<T>(
  seed: string,
  drawIndex: number,
  pool: readonly T[],
  count: number
): { items: T[]; next: number } {
  const remaining = [...pool];
  const items: T[] = [];
  let next = drawIndex;
  while (items.length < count && remaining.length > 0) {
    const pick = drawInt(shopSeed(seed), next, remaining.length);
    items.push(remaining.splice(pick, 1)[0]);
    next += 1;
  }
  return { items, next };
}

/**
 * The single-slot stock that fits the rulebook and is not already owned:
 * relics in the rack, and amendments in force or waiting in the tray.
 */
export function stockPool(
  catalog: ShopCatalog,
  rulebook: SapRulebook,
  ownedRelicIds: readonly string[],
  ownedAmendmentIds: readonly string[] = []
): ShopEntry[] {
  const owned = new Set(ownedRelicIds);
  const amended = new Set(ownedAmendmentIds);
  return catalog.entries.filter(
    (entry) =>
      fitsRulebook(entry, rulebook) &&
      !(entry.kind === "RELIC" && owned.has(entry.relic.id)) &&
      !(entry.kind === "AMENDMENT" && amended.has(entry.amendment.id))
  );
}

/** One card a booster pack opened into. */
export type PackCard =
  | { id: string; kind: "SITE"; site: Site }
  | { id: string; kind: "ENTRY"; entry: ShopEntry };

/**
 * What a pack draws from: Site Activation packs the sites not yet active;
 * Relic packs the relics that fit and are not owned; Guidance packs the
 * Guidance cards and the SAP Amendments not already owned.
 */
export function packPool(
  catalog: ShopCatalog,
  pack: Pack,
  rulebook: SapRulebook,
  ownedRelicIds: readonly string[],
  activeSiteIds: readonly string[],
  ownedAmendmentIds: readonly string[] = []
): PackCard[] {
  if (pack.kind === "SITE_ACTIVATION") {
    const active = new Set(activeSiteIds);
    return catalog.sites
      .filter((site) => !active.has(site.id))
      .map((site) => ({ id: site.id, kind: "SITE", site }));
  }
  const kinds: ShopEntry["kind"][] =
    pack.kind === "GUIDANCE" ? ["GUIDANCE", "AMENDMENT"] : ["RELIC"];
  return stockPool(catalog, rulebook, ownedRelicIds, ownedAmendmentIds)
    .filter((entry) => kinds.includes(entry.kind))
    .map((entry) => ({ id: shopEntryId(entry), kind: "ENTRY", entry }));
}

/**
 * The enrollment transitions a site produces: one ENROLL per subject, all
 * effective at `effectiveAt`, the study time the site went live.
 */
export function siteEnrollments(
  site: Site,
  effectiveAt: string
): PopulationTransition[] {
  return site.subjects.map((subject) => ({
    id: `ENROLL-${site.id}-${subject.id}`,
    subjectId: subject.id,
    reason: "SITE_ACTIVATION",
    change: "ENROLL",
    populations: [...subject.populations],
    effectiveAt,
    description: `${site.name} enrolled ${subject.id} (${subject.populations
      .map((p) => POPULATION_LABELS[p])
      .join(", ")}).`,
    subject,
  }));
}
