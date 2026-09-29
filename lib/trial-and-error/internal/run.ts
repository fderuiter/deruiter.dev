import {
  POPULATION_LABELS,
  shopEntryId,
  type Act,
  type Campaign,
  type CrisisCard,
  type Endless,
  type Pack,
  type Scenario,
  type ShopEntry,
} from "../types";
import { raiseQuotas } from "./quotas";
import { blindStartCpu } from "./relics";
import { drawInt } from "./rng";
import {
  PACK_SLOTS,
  SHOP_SLOTS,
  cashOut,
  drawDistinct,
  packPool,
  rerollPrice,
  sellValue,
  siteEnrollments,
  stockPool,
  type CashOutReport,
  type PackCard,
} from "./shop";
import {
  CONSUMABLE_SLOTS,
  RELIC_RACK_FULL,
  RELIC_SLOTS,
  advanceTable,
  carriedInventory,
  consumableName,
  consumableSellValue,
  createTableState,
  deriveTableView,
  dmcDefenseOf,
  studyHistory,
  type Consumable,
  type Inventory,
  type StudyHistory,
  type TableAction,
  type TableEvent,
  type TableState,
  type TableView,
  type ScheduledDeviation,
} from "./table";

/** One seeded draw, as the run log records it. */
export interface RunDraw {
  /** The draw index this draw consumed. */
  drawIndex: number;
  kind: "BOSS" | "CRISIS" | "DEVIATION";
  /** The boss scenario, crisis card or protocol deviation drawn. */
  id: string;
  /** For a deviation, the hands played when it lands. */
  afterHands?: number;
  /** The act it was drawn for. */
  actIndex: number;
  /** The Blind of that act it was drawn for. */
  blindIndex: number;
}

/** One single-item slot of a shop visit. */
export interface ShopSlot {
  entry: ShopEntry;
  sold: boolean;
}

/** One booster pack slot of a shop visit. */
export interface PackSlot {
  pack: Pack;
  sold: boolean;
}

/** A booster pack being opened: the cards it drew and the ones kept so far. */
export interface OpenedPack {
  pack: Pack;
  cards: PackCard[];
  picked: string[];
}

/** One visit to the Procurement Shop, between a cleared Blind and the next. */
export interface ShopState {
  slots: ShopSlot[];
  packs: PackSlot[];
  /** Rerolls bought this visit; the next one costs `rerollPrice(rerolls)`. */
  rerolls: number;
  /** The pack being opened, until every pick is made or it is skipped. */
  opened: OpenedPack | null;
  /** Items taken this visit, which keeps tray ids unique. */
  purchases: number;
}

/**
 * Serializable run state: the seed and draw log that make the run
 * replayable, which Blind of the act is being played, and that Blind's Card
 * Table. Contains no derived or browser data.
 */
export interface RunState {
  /** The plan's id: the act played on its own, or the campaign. */
  actId: string;
  /** The run seed. The same seed and the same moves replay identically. */
  seed: string;
  /** The next unused draw index. */
  drawIndex: number;
  /** Every seeded draw so far, in order. */
  draws: RunDraw[];
  /**
   * The Boss of each act reached so far, in act order: drawn from the act's
   * pool as its study starts, or its fixed Boss.
   */
  bossIds: (string | null)[];
  /** Index into the plan's acts. */
  actIndex: number;
  /** Index into the current act's Blinds, Small first. */
  blindIndex: number;
  table: TableState;
  /** The cleared Blind's cash-out, once the sponsor has paid it. */
  cashOut: CashOutReport | null;
  /** The shop visit after the cash-out, if the act has a shop. */
  shop: ShopState | null;
  /** The next unused draw index on the shop's own seeded stream. */
  shopDraws: number;
  /** The run went on into endless post-marketing rounds after winning (#1088). */
  endless: boolean;
  /** The won run was submitted and ended; nothing follows (#1088). */
  ended: boolean;
}

/** The seed a run uses when none is given. */
export const DEFAULT_SEED = "fold-change";

/**
 * Player intents the run reducer accepts. Every Card Table action except
 * RESET passes through to the current Blind; a lost Blind ends the run, so
 * the only way back is RESTART_RUN.
 */
export type RunAction =
  | Exclude<TableAction, { type: "RESET" }>
  | { type: "NEXT_BLIND" }
  /** Collects the cleared Blind's payout and opens the shop. */
  | { type: "CASH_OUT" }
  /** Redraws the shop's single slots for the escalating reroll price. */
  | { type: "REROLL" }
  /** Buys the item in a single slot. */
  | { type: "BUY"; slot: number }
  /** Buys and opens the booster pack in a pack slot. */
  | { type: "BUY_PACK"; slot: number }
  /** Keeps one card of the pack being opened. */
  | { type: "PICK_PACK_CARD"; cardId: string }
  /** Leaves the pack being opened; its remaining picks are forfeit. */
  | { type: "SKIP_PACK" }
  /** Sells a relic for half its price, rounded down. */
  | { type: "SELL_RELIC"; relicId: string }
  /** After the campaign is won, goes on into post-marketing rounds (#1088). */
  | { type: "CONTINUE_ENDLESS" }
  /** After the campaign is won, submits the package and ends the run. */
  | { type: "END_RUN" }
  /** A new run: with `seed`, a new seed; without, a replay of this one. */
  | { type: "RESTART_RUN"; seed?: string };

/**
 * Where the run stands. RUN_WON is the plan's last Blind cleared: CSR Lock,
 * in the campaign. A run that goes on into post-marketing rounds never wins
 * again; it plays until a Blind fails.
 */
export type RunPhase =
  "PLAYING" | "BLIND_CLEARED" | "SHOP" | "RUN_FAILED" | "RUN_WON";

/** An act as the run shows it: where it sits in the campaign. */
export interface RunActView {
  id: string;
  title: string;
  index: number;
  /** The campaign's act count. */
  count: number;
  /** The post-marketing round this act is, or null for a campaign act. */
  round: number | null;
}

/** Endless post-marketing mode as the run shows it (#1088). */
export interface EndlessView {
  title: string;
  /** The won campaign can still go on into post-marketing rounds. */
  canContinue: boolean;
  /** The post-marketing round being played, or null before any. */
  round: number | null;
  /** The campaign was won: the CSR locked, whatever followed. */
  campaignWon: boolean;
}

/**
 * The act card shown as a new study starts (#924): the act, the Boss it has
 * drawn, and what the new study reset and what the run kept.
 */
export interface ActIntroView {
  act: RunActView;
  /** The Boss waiting at the end of this act, e.g. "CSR Lock". */
  bossTitle: string;
  /** The Boss's intro card text. */
  bossIntro: string;
  /** What the new study started over. */
  reset: string[];
  /** What the run carried into it. */
  kept: string[];
}

/** A shop item as the shop screen shows it. */
export interface ShopItemView {
  id: string;
  name: string;
  description: string;
  price: number;
  sold: boolean;
  /** Why it cannot be bought now, or null. */
  refusal: string | null;
}

/** A pack card as the reveal shows it. */
export interface PackCardView {
  id: string;
  kind: "RELIC" | "GUIDANCE" | "SEAL" | "AMENDMENT" | "SITE";
  name: string;
  description: string;
  picked: boolean;
  /** Why it cannot be kept now, or null. */
  refusal: string | null;
  /** A site's warning: the populations its enrollment will change. */
  warning: string | null;
}

/** Everything the shop screen renders. */
export interface ShopView {
  items: ShopItemView[];
  packs: ShopItemView[];
  rerollPrice: number;
  rerollRefusal: string | null;
  opened: {
    packId: string;
    name: string;
    choose: number;
    picksLeft: number;
    cards: PackCardView[];
  } | null;
  /** What each relic in the rack sells for, by id. */
  relicSellValues: Record<string, number>;
}

/** Everything a run renders, derived purely from act and state. */
export interface RunView {
  act: RunActView;
  blind: Scenario;
  blindIndex: number;
  blindCount: number;
  isFinalBlind: boolean;
  /** The Blind that follows this one, if any. */
  nextBlind: Scenario | null;
  /** The act that follows, when the next Blind starts a new study. */
  nextAct: RunActView | null;
  /** The act card, while a new study's first Blind has not started. */
  actIntro: ActIntroView | null;
  phase: RunPhase;
  /** The Blind has just started: nothing has been played or discarded. */
  showIntro: boolean;
  table: TableView;
  seed: string;
  draws: RunDraw[];
  /** What the sponsor will pay at cash-out, until it has been paid. */
  pendingCashOut: CashOutReport | null;
  /** The cash-out paid for this Blind, once paid. */
  cashOut: CashOutReport | null;
  /** The shop visit, while the run is in it. */
  shop: ShopView | null;
  /** Endless post-marketing mode, when the plan offers it. */
  endless: EndlessView | null;
}

/** What a run plays: one act on its own, or a campaign's acts in order. */
export type RunPlan = Act | Campaign;

/** A plan's acts, in play order. */
export function planActs(plan: RunPlan): readonly Act[] {
  return "acts" in plan ? plan.acts : [plan];
}

/** The plan's endless post-marketing mode, if it has one. */
function endlessOf(plan: RunPlan): Endless | undefined {
  return "acts" in plan ? plan.endless : undefined;
}

/** The post-marketing round an act index is, or null for a campaign act. */
function endlessRound(plan: RunPlan, actIndex: number): number | null {
  const count = planActs(plan).length;
  return actIndex >= count ? actIndex - count + 1 : null;
}

/**
 * Round `round`'s post-marketing study: the study whose pool holds the
 * drawn Boss, with every quota raised by quotaGrowth ^ round.
 */
export function endlessAct(
  endless: Endless,
  bossId: string | null,
  round: number
): Act {
  const study =
    endless.studies.find((s) => s.bossPool?.some((b) => b.id === bossId)) ??
    endless.studies[0];
  const factor = endless.quotaGrowth ** round;
  return {
    ...study,
    id: `${study.id}-round-${round}`,
    title: `${endless.title} round ${round}: ${study.title}`,
    blinds: study.blinds.map((b) => raiseQuotas(b, factor)),
    bossPool: study.bossPool?.map((b) => raiseQuotas(b, factor)),
  };
}

/** The act at `index`: a campaign act, or a post-marketing round. */
function actAt(
  plan: RunPlan,
  run: Pick<RunState, "bossIds">,
  index: number
): Act {
  const acts = planActs(plan);
  const endless = endlessOf(plan);
  const round = endlessRound(plan, index);
  if (round === null || !endless) return acts[Math.min(index, acts.length - 1)];
  return endlessAct(endless, run.bossIds[index] ?? null, round);
}

/**
 * The Blinds the current act plays, in order. An act with a boss pool
 * contributes its Small and Big Blinds and the Boss the run drew.
 */
export function runBlinds(
  plan: RunPlan,
  run: Pick<RunState, "bossIds" | "actIndex">
): Scenario[] {
  const act = actAt(plan, run, run.actIndex);
  if (!act.bossPool) return act.blinds;
  const bossId = run.bossIds[run.actIndex];
  const boss = act.bossPool.find((b) => b.id === bossId) ?? act.bossPool[0];
  return [...act.blinds, boss];
}

/** Where the next Blind is: later in this act, or the next act's first. */
interface Stop {
  actIndex: number;
  blindIndex: number;
  blind: Scenario;
}

function nextStop(plan: RunPlan, run: RunState): Stop | null {
  const blinds = runBlinds(plan, run);
  if (run.blindIndex + 1 < blinds.length) {
    return {
      actIndex: run.actIndex,
      blindIndex: run.blindIndex + 1,
      blind: blinds[run.blindIndex + 1],
    };
  }
  const acts = planActs(plan);
  const actIndex = run.actIndex + 1;
  if (actIndex < acts.length) {
    return { actIndex, blindIndex: 0, blind: acts[actIndex].blinds[0] };
  }
  // In post-marketing the next round's study is drawn as a round starts.
  if (!run.endless || run.bossIds.length <= actIndex) return null;
  return {
    actIndex,
    blindIndex: 0,
    blind: actAt(plan, run, actIndex).blinds[0],
  };
}

/** The Blind's number across the whole run, from 0, e.g. for tray ids. */
function runBlindNumber(plan: RunPlan, run: RunState): number {
  let n = run.blindIndex;
  for (let i = 0; i < run.actIndex; i++) {
    const act = actAt(plan, run, i);
    n += act.blinds.length + (act.bossPool ? 1 : 0);
  }
  return n;
}

function actView(
  plan: RunPlan,
  run: Pick<RunState, "bossIds">,
  index: number
): RunActView {
  const act = actAt(plan, run, index);
  return {
    id: act.id,
    title: act.title,
    index,
    count: planActs(plan).length,
    round: endlessRound(plan, index),
  };
}

/** What a new study starts over, as the act card lists it. */
const STUDY_RESET = [
  "Subjects, populations and snapshots",
  "The SAP rulebook",
  "Every compiled output: the new study deals its own",
  "Trial sites: the last study's sites closed out",
];

/** What the run carries into a new study, as the act card lists it. */
const RUN_KEPT = [
  "SOP relics",
  "Hand levels",
  "Guidance and seals in the tray",
  "Study budget",
  "Cleared Blinds, for the final campaign score",
];

/**
 * Draws the next crisis for a Blind, without replacement across the run.
 * Returns null, consuming no draw, when the act has no crisis left.
 */
function drawCrisis(
  act: Act,
  run: Pick<RunState, "seed" | "drawIndex" | "draws">,
  actIndex: number,
  blindIndex: number
): { crisis: CrisisCard | null; drawIndex: number; draws: RunDraw[] } {
  const drawn = new Set(
    run.draws.filter((d) => d.kind === "CRISIS").map((d) => d.id)
  );
  const remaining = (act.crisisDeck ?? []).filter((c) => !drawn.has(c.id));
  if (remaining.length === 0) {
    return { crisis: null, drawIndex: run.drawIndex, draws: run.draws };
  }
  const crisis = remaining[drawInt(run.seed, run.drawIndex, remaining.length)];
  return {
    crisis,
    drawIndex: run.drawIndex + 1,
    draws: [
      ...run.draws,
      {
        drawIndex: run.drawIndex,
        kind: "CRISIS",
        id: crisis.id,
        actIndex,
        blindIndex,
      },
    ],
  };
}

/** What a relic the shop did not sell (a Boss reward) is valued at. */
const DEFAULT_RELIC_PRICE = 6;

/** The alert shown when a consumable would overfill the tray. */
const TRAY_FULL = `The tray holds ${CONSUMABLE_SLOTS}: sell or use a consumable first.`;

/** A run with a message announced on its table. */
function announce(
  run: RunState,
  kind: TableEvent["kind"],
  message: string,
  patch: Partial<RunState> = {},
  table: TableState = run.table
): RunState {
  return {
    ...run,
    ...patch,
    table: {
      ...table,
      lastEvent: {
        kind,
        message,
        sequence: (run.table.lastEvent?.sequence ?? 0) + 1,
      },
    },
  };
}

/** The SAP rulebook the shop stocks for: the next Blind's. */
function shopRulebook(plan: RunPlan, run: RunState) {
  return (nextStop(plan, run)?.blind ?? runBlinds(plan, run)[run.blindIndex])
    .rulebook;
}

/** The payout the cleared Blind earns, before it is paid. */
function payoutFor(plan: RunPlan, run: RunState): CashOutReport {
  const blind = runBlinds(plan, run)[run.blindIndex];
  return cashOut(blind.blind.tier, run.table.cpu.available, run.table.budget);
}

/** Why the cleared Blind cannot be cashed out, or null. */
function cashOutRefusal(plan: RunPlan, run: RunState): string | null {
  const blind = runBlinds(plan, run)[run.blindIndex];
  if (run.table.status !== "CLEARED") return `Clear ${blind.blind.name} first.`;
  if (!nextStop(plan, run)) return `${plan.title} is complete.`;
  if (dmcDefenseOf(blind) && !run.table.rewardClaimed) {
    return "Choose an SOP relic first.";
  }
  if (run.cashOut) return "This Blind is already cashed out.";
  return null;
}

/** Draws the shop's single slots on the shop stream. */
function drawSlots(
  plan: RunPlan,
  run: RunState,
  drawIndex: number
): { slots: ShopSlot[]; next: number } {
  const catalog = actAt(plan, run, run.actIndex).shop;
  if (!catalog) return { slots: [], next: drawIndex };
  const pool = stockPool(
    catalog,
    shopRulebook(plan, run),
    run.table.relics.map((r) => r.id),
    ownedAmendmentIds(run.table)
  );
  const { items, next } = drawDistinct(run.seed, drawIndex, pool, SHOP_SLOTS);
  return { slots: items.map((entry) => ({ entry, sold: false })), next };
}

/** What a relic sells for: half its shop price, rounded down. */
function relicSellValue(act: Act, relicId: string): number {
  const entry = act.shop?.entries.find(
    (e) => e.kind === "RELIC" && e.relic.id === relicId
  );
  return sellValue(entry?.price ?? DEFAULT_RELIC_PRICE);
}

/** Why an entry cannot join the rack or tray now, or null. */
function takeRefusal(table: TableState, entry: ShopEntry): string | null {
  if (entry.kind === "RELIC") {
    return table.relics.length >= RELIC_SLOTS ? RELIC_RACK_FULL : null;
  }
  return table.consumables.length >= CONSUMABLE_SLOTS ? TRAY_FULL : null;
}

/** The table with an entry in its rack or tray. */
function take(table: TableState, entry: ShopEntry, trayId: string): TableState {
  if (entry.kind === "RELIC") {
    return { ...table, relics: [...table.relics, entry.relic] };
  }
  const item: Consumable =
    entry.kind === "SEAL"
      ? { id: trayId, kind: "SEAL", seal: entry.seal }
      : entry.kind === "AMENDMENT"
        ? { id: trayId, kind: "AMENDMENT", amendment: entry.amendment }
        : { id: trayId, kind: "GUIDANCE", guidance: entry.guidance };
  return { ...table, consumables: [...table.consumables, item] };
}

/** An entry's printed name and one-line description. */
function describeEntry(entry: ShopEntry): {
  name: string;
  description: string;
} {
  if (entry.kind === "RELIC") {
    return { name: entry.relic.name, description: entry.relic.description };
  }
  if (entry.kind === "GUIDANCE") {
    return {
      name: entry.guidance.name,
      description: `Levels up ${entry.guidance.handType
        .toLowerCase()
        .replace(/_/g, " ")}. ${entry.guidance.flavor}`,
    };
  }
  if (entry.kind === "AMENDMENT") {
    return {
      name: entry.amendment.name,
      description: entry.amendment.description,
    };
  }
  return { name: entry.seal.name, description: entry.seal.footnote };
}

/** Amendments the run owns: in force, or waiting in the tray. */
function ownedAmendmentIds(table: TableState): string[] {
  return [
    ...(table.sapAmendments ?? []).map((a) => a.id),
    ...table.consumables.flatMap((c) =>
      c.kind === "AMENDMENT" ? [c.amendment.id] : []
    ),
  ];
}

/** The study time a site goes live: a day after the current snapshot. */
function goLiveAt(table: TableState): string {
  const current = table.snapshots[table.snapshots.length - 1];
  return new Date(Date.parse(current.capturedAt) + 86_400_000)
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z");
}

/** Shop actions a run in the shop routes to the shop reducer. */
function shopAction(plan: RunPlan, run: RunState, action: RunAction): RunState {
  const act = actAt(plan, run, run.actIndex);
  const shop = run.shop;
  const refuse = (message: string) => announce(run, "REFUSED", message);
  switch (action.type) {
    case "CASH_OUT": {
      const refusal = cashOutRefusal(plan, run);
      if (refusal) return refuse(refusal);
      const report = payoutFor(plan, run);
      const table = { ...run.table, budget: run.table.budget + report.total };
      let next: RunState = { ...run, table, cashOut: report };
      if (act.shop) {
        const slots = drawSlots(plan, next, run.shopDraws);
        // Between acts there is no study to enroll sites into yet: the next
        // study opens with its own.
        const newStudy = nextStop(plan, run)?.actIndex !== run.actIndex;
        const packs = drawDistinct(
          run.seed,
          slots.next,
          act.shop.packs.filter(
            (p) => !(newStudy && p.kind === "SITE_ACTIVATION")
          ),
          PACK_SLOTS
        );
        next = {
          ...next,
          shopDraws: packs.next,
          shop: {
            slots: slots.slots,
            packs: packs.items.map((pack) => ({ pack, sold: false })),
            rerolls: 0,
            opened: null,
            purchases: 0,
          },
        };
      }
      return announce(
        next,
        "CASHED_OUT",
        `Cash-out: $${report.total}k. Study budget $${table.budget}k.${act.shop ? " The Procurement Shop is open." : ""}`,
        {},
        table
      );
    }
    case "REROLL": {
      if (!shop) return refuse("The shop is closed.");
      if (shop.opened) return refuse("Finish opening the pack first.");
      const price = rerollPrice(shop.rerolls);
      if (run.table.budget < price) {
        return refuse(`Reroll needs $${price}k; $${run.table.budget}k left.`);
      }
      const table = { ...run.table, budget: run.table.budget - price };
      const slots = drawSlots(plan, { ...run, table }, run.shopDraws);
      return announce(
        run,
        "SHOP",
        `Rerolled for $${price}k. Next reroll $${rerollPrice(shop.rerolls + 1)}k.`,
        {
          shopDraws: slots.next,
          shop: { ...shop, slots: slots.slots, rerolls: shop.rerolls + 1 },
        },
        table
      );
    }
    case "BUY": {
      if (!shop) return refuse("The shop is closed.");
      if (shop.opened) return refuse("Finish opening the pack first.");
      const slot = shop.slots[action.slot];
      if (!slot || slot.sold) return refuse("That slot is empty.");
      const { name } = describeEntry(slot.entry);
      if (run.table.budget < slot.entry.price) {
        return refuse(
          `${name} costs $${slot.entry.price}k; $${run.table.budget}k left.`
        );
      }
      const full = takeRefusal(run.table, slot.entry);
      if (full) return refuse(full);
      const table = take(
        { ...run.table, budget: run.table.budget - slot.entry.price },
        slot.entry,
        `${shopEntryId(slot.entry)}@shop-${runBlindNumber(plan, run)}-${shop.purchases}`
      );
      return announce(
        run,
        "SHOP",
        `Bought ${name} for $${slot.entry.price}k. Study budget $${table.budget}k.`,
        {
          shop: {
            ...shop,
            purchases: shop.purchases + 1,
            slots: shop.slots.map((s, i) =>
              i === action.slot ? { ...s, sold: true } : s
            ),
          },
        },
        table
      );
    }
    case "BUY_PACK": {
      if (!shop) return refuse("The shop is closed.");
      if (shop.opened) return refuse("Finish opening the pack first.");
      const slot = shop.packs[action.slot];
      if (!slot || slot.sold) return refuse("That pack slot is empty.");
      const { pack } = slot;
      if (run.table.budget < pack.price) {
        return refuse(
          `${pack.name} costs $${pack.price}k; $${run.table.budget}k left.`
        );
      }
      const pool = packPool(
        act.shop!,
        pack,
        shopRulebook(plan, run),
        run.table.relics.map((r) => r.id),
        run.table.sites.map((s) => s.id),
        ownedAmendmentIds(run.table)
      );
      if (pool.length === 0)
        return refuse(`${pack.name} has nothing left to draw.`);
      const { items, next } = drawDistinct(
        run.seed,
        run.shopDraws,
        pool,
        pack.size
      );
      const table = { ...run.table, budget: run.table.budget - pack.price };
      return announce(
        run,
        "SHOP",
        `Opened ${pack.name}: keep ${Math.min(pack.choose, items.length)} of ${items.length}.`,
        {
          shopDraws: next,
          shop: {
            ...shop,
            packs: shop.packs.map((p, i) =>
              i === action.slot ? { ...p, sold: true } : p
            ),
            opened: { pack, cards: items, picked: [] },
          },
        },
        table
      );
    }
    case "PICK_PACK_CARD": {
      const opened = shop?.opened;
      if (!shop || !opened) return refuse("No pack is open.");
      const card = opened.cards.find((c) => c.id === action.cardId);
      if (!card) return refuse("That card is not in the pack.");
      if (opened.picked.includes(card.id))
        return refuse("You already kept it.");
      let table: TableState;
      let name: string;
      if (card.kind === "SITE") {
        name = card.site.name;
        table = {
          ...run.table,
          sites: [...run.table.sites, card.site],
          enrollments: [
            ...run.table.enrollments,
            ...siteEnrollments(card.site, goLiveAt(run.table)),
          ],
        };
      } else {
        const full = takeRefusal(run.table, card.entry);
        if (full) return refuse(full);
        name = describeEntry(card.entry).name;
        table = take(
          run.table,
          card.entry,
          `${card.id}@pack-${runBlindNumber(plan, run)}-${shop.purchases}`
        );
      }
      const picked = [...opened.picked, card.id];
      const done =
        picked.length >= Math.min(opened.pack.choose, opened.cards.length);
      return announce(
        run,
        "SHOP",
        `Kept ${name}.${done ? ` ${opened.pack.name} is done.` : ""}`,
        {
          shop: {
            ...shop,
            purchases: shop.purchases + 1,
            opened: done ? null : { ...opened, picked },
          },
        },
        table
      );
    }
    case "SKIP_PACK": {
      const opened = shop?.opened;
      if (!shop || !opened) return refuse("No pack is open.");
      return announce(run, "SHOP", `Skipped the rest of ${opened.pack.name}.`, {
        shop: { ...shop, opened: null },
      });
    }
    case "SELL_RELIC": {
      if (run.table.status !== "CLEARED") {
        return refuse("Relics are sold between Blinds.");
      }
      const relic = run.table.relics.find((r) => r.id === action.relicId);
      if (!relic) return refuse("That relic is not in your rack.");
      const value = relicSellValue(act, relic.id);
      const table = {
        ...run.table,
        budget: run.table.budget + value,
        relics: run.table.relics.filter((r) => r.id !== relic.id),
      };
      return announce(
        run,
        "SHOP",
        `Sold ${relic.name} for $${value}k. Study budget $${table.budget}k.`,
        {},
        table
      );
    }
    case "SELL_CONSUMABLE": {
      const item = run.table.consumables.find(
        (c) => c.id === action.consumableId
      );
      if (!item) return refuse("That consumable is not in your tray.");
      const value = consumableSellValue(item);
      const table = {
        ...run.table,
        budget: run.table.budget + value,
        consumables: run.table.consumables.filter((c) => c.id !== item.id),
      };
      return announce(
        run,
        "SHOP",
        `Sold ${consumableName(item)} for $${value}k. Study budget $${table.budget}k.`,
        {},
        table
      );
    }
    default:
      return run;
  }
}

/** The shop as the shop screen renders it. */
function deriveShopView(plan: RunPlan, run: RunState): ShopView | null {
  const act = actAt(plan, run, run.actIndex);
  const shop = run.shop;
  if (!shop) return null;
  const budget = run.table.budget;
  const busy = shop.opened ? "Finish opening the pack first." : null;
  const afford = (name: string, price: number) =>
    budget < price ? `${name} costs $${price}k; $${budget}k left.` : null;
  const price = rerollPrice(shop.rerolls);
  const opened = shop.opened;
  return {
    items: shop.slots.map((slot, i) => {
      const { name, description } = describeEntry(slot.entry);
      return {
        id: `slot-${i}`,
        name,
        description,
        price: slot.entry.price,
        sold: slot.sold,
        refusal: slot.sold
          ? "Sold."
          : (busy ??
            afford(name, slot.entry.price) ??
            takeRefusal(run.table, slot.entry)),
      };
    }),
    packs: shop.packs.map((slot, i) => ({
      id: `pack-${i}`,
      name: slot.pack.name,
      description: `${slot.pack.description} Choose ${slot.pack.choose} of ${slot.pack.size}.`,
      price: slot.pack.price,
      sold: slot.sold,
      refusal: slot.sold
        ? "Opened."
        : (busy ?? afford(slot.pack.name, slot.pack.price)),
    })),
    rerollPrice: price,
    rerollRefusal:
      busy ??
      (budget < price ? `Reroll needs $${price}k; $${budget}k left.` : null),
    opened: opened
      ? {
          packId: opened.pack.id,
          name: opened.pack.name,
          choose: opened.pack.choose,
          picksLeft:
            Math.min(opened.pack.choose, opened.cards.length) -
            opened.picked.length,
          cards: opened.cards.map((card): PackCardView => {
            const picked = opened.picked.includes(card.id);
            if (card.kind === "SITE") {
              const populations = [
                ...new Set(card.site.subjects.flatMap((s) => s.populations)),
              ].map((p) => POPULATION_LABELS[p]);
              return {
                id: card.id,
                kind: "SITE",
                name: card.site.name,
                description: card.site.description,
                picked,
                refusal: picked ? "Kept." : null,
                warning: `Enrolls ${card.site.subjects.length} ${card.site.subjects.length === 1 ? "subject" : "subjects"} into ${populations.join(", ")} after the next Blind's first hand: outputs in hand on those populations then go stale.`,
              };
            }
            const { name, description } = describeEntry(card.entry);
            return {
              id: card.id,
              kind: card.entry.kind,
              name,
              description,
              picked,
              refusal: picked ? "Kept." : takeRefusal(run.table, card.entry),
              warning: null,
            };
          }),
        }
      : null,
    relicSellValues: Object.fromEntries(
      run.table.relics.map((r) => [r.id, relicSellValue(act, r.id)])
    ),
  };
}

/**
 * Draws a Blind's protocol deviation (#1087): whether one fires, which one
 * (without replacement across the run) and after which hand. Only a Small or
 * Big Blind of an act with a deviation deck draws, consuming three draws
 * whether or not one fires, so the rest of the run's draws never depend on
 * the roll; one that fires is logged in `draws`.
 */
function drawDeviation(
  act: Act,
  run: Pick<RunState, "seed" | "drawIndex" | "draws">,
  actIndex: number,
  blindIndex: number
): {
  deviation: ScheduledDeviation | null;
  drawIndex: number;
  draws: RunDraw[];
} {
  const scenario = act.blinds[blindIndex];
  const deviations = act.deviations;
  if (!deviations || !scenario || scenario.blind.tier === "BOSS_BLIND") {
    return { deviation: null, drawIndex: run.drawIndex, draws: run.draws };
  }
  const drawn = new Set(
    run.draws.filter((d) => d.kind === "DEVIATION").map((d) => d.id)
  );
  const remaining = deviations.deck.filter((e) => !drawn.has(e.id));
  const at = run.drawIndex;
  const fires =
    remaining.length > 0 &&
    drawInt(run.seed, at, 100) < deviations.chancePercent;
  if (!fires) {
    return { deviation: null, drawIndex: at + 3, draws: run.draws };
  }
  const event = remaining[drawInt(run.seed, at + 1, remaining.length)];
  const afterHands =
    event.afterHands[drawInt(run.seed, at + 2, event.afterHands.length)];
  return {
    deviation: { event, afterHands },
    drawIndex: at + 3,
    draws: [
      ...run.draws,
      {
        drawIndex: at + 1,
        kind: "DEVIATION",
        id: event.id,
        afterHands,
        actIndex,
        blindIndex,
      },
    ],
  };
}

/** A fresh table for a Blind, announcing it with a sequence that follows `after`. */
function startBlind(
  scenario: Scenario,
  history: StudyHistory | undefined,
  inventory: Inventory | undefined,
  crisis: CrisisCard | null,
  after: TableEvent | null,
  kind: TableEvent["kind"],
  message: string,
  deviation: ScheduledDeviation | null = null
): TableState {
  const table = createTableState(
    scenario,
    history,
    inventory,
    crisis,
    deviation
  );
  const drawn = crisis ? ` Crisis: ${crisis.name}. ${crisis.description}` : "";
  const cpu = blindStartCpu(table.relics);
  const bonus =
    cpu > 0
      ? ` ${table.relics
          .filter((r) => r.trigger?.phase === "ON_BLIND_START")
          .map((r) => r.name)
          .join(", ")}: +${cpu} CPU.`
      : "";
  return {
    ...table,
    lastEvent: {
      kind,
      message: `${message}${bonus}${drawn}`,
      sequence: (after?.sequence ?? 0) + 1,
    },
  };
}

/**
 * An act's Boss: its fixed Boss, or one drawn from its pool with the run's
 * next draw index (a pool of one is fixed and consumes no draw).
 */
function drawBoss(
  act: Act,
  actIndex: number,
  run: Pick<RunState, "seed" | "drawIndex" | "draws">
): { bossId: string | null; drawIndex: number; draws: RunDraw[] } {
  const pool = act.bossPool;
  const fixed = (bossId: string | null) => ({
    bossId,
    drawIndex: run.drawIndex,
    draws: run.draws,
  });
  if (!pool) {
    return fixed(
      act.blinds.find((b) => b.blind.tier === "BOSS_BLIND")?.id ?? null
    );
  }
  if (pool.length === 1) return fixed(pool[0].id);
  const bossId = pool[drawInt(run.seed, run.drawIndex, pool.length)].id;
  return {
    bossId,
    drawIndex: run.drawIndex + 1,
    draws: [
      ...run.draws,
      {
        drawIndex: run.drawIndex,
        kind: "BOSS",
        id: bossId,
        actIndex,
        blindIndex: act.blinds.length,
      },
    ],
  };
}

/**
 * A post-marketing round's Boss (#1088), and with it the round's study:
 * drawn from every study's boss pool with the run's next draw index.
 */
function drawEndlessBoss(
  endless: Endless,
  actIndex: number,
  run: Pick<RunState, "seed" | "drawIndex" | "draws">
): { bossId: string | null; drawIndex: number; draws: RunDraw[] } {
  return drawBoss(
    {
      ...endless.studies[0],
      bossPool: endless.studies.flatMap((s) => s.bossPool ?? []),
    },
    actIndex,
    run
  );
}

/** Why the won run cannot go on into post-marketing or end, or null. */
function endlessRefusal(plan: RunPlan, run: RunState): string | null {
  if (!endlessOf(plan)) return `${plan.title} has no post-marketing mode.`;
  if (run.ended) return "The run has ended.";
  if (run.endless) return "The run is already in post-marketing.";
  if (run.table.status !== "CLEARED" || nextStop(plan, run) !== null) {
    return `Win ${plan.title} first.`;
  }
  return null;
}

/**
 * A fresh run for `seed`: the first act's Boss drawn from its pool, and the
 * first Blind dealt with full CPU. The first Blind draws no crisis. A later
 * act draws its Boss as its study starts, so a campaign's first act plays
 * exactly as the act does on its own.
 */
export function createRunState(
  plan: RunPlan,
  seed: string = DEFAULT_SEED
): RunState {
  const first = planActs(plan)[0];
  const boss = drawBoss(first, 0, {
    seed,
    drawIndex: 0,
    draws: [],
  });
  const { deviation, drawIndex, draws } = drawDeviation(
    first,
    { seed, ...boss },
    0,
    0
  );
  return {
    actId: plan.id,
    seed,
    drawIndex,
    draws,
    bossIds: [boss.bossId],
    actIndex: 0,
    blindIndex: 0,
    table: createTableState(
      first.blinds[0],
      undefined,
      undefined,
      null,
      deviation
    ),
    cashOut: null,
    shop: null,
    shopDraws: 0,
    endless: false,
    ended: false,
  };
}

/**
 * Pure run reducer. It composes the Card Table reducer for the current Blind
 * and moves between Blinds, drawing each later Blind's crisis from the
 * seeded event draw. After an act's Boss, the next Blind starts the next
 * act's study (#924): its subjects, snapshots, rulebook and outputs are its
 * own, and the run's relics, hand levels, tray, budget and cleared Blinds
 * come along. The draw piles are fixed and every draw is a function of the
 * seed and draw index, so the same plan, seed and action sequence always
 * yields the same state.
 */
export function advanceRun(
  plan: RunPlan,
  run: RunState,
  action: RunAction
): RunState {
  const acts = planActs(plan);
  const act = actAt(plan, run, run.actIndex);
  const blinds = runBlinds(plan, run);
  const blind = blinds[run.blindIndex];
  const refuse = (message: string): RunState => ({
    ...run,
    table: {
      ...run.table,
      lastEvent: {
        kind: "REFUSED",
        message,
        sequence: (run.table.lastEvent?.sequence ?? 0) + 1,
      },
    },
  });

  switch (action.type) {
    case "RESTART_RUN": {
      // A new run is a new study: its population history starts over, and
      // the tray and budget are empty again. The same seed replays the same
      // Bosses and crises.
      const fresh = createRunState(plan, action.seed ?? run.seed);
      const first = acts[0].blinds[0];
      return {
        ...fresh,
        table: startBlind(
          first,
          undefined,
          undefined,
          null,
          run.table.lastEvent,
          "RESET",
          `Run restarted. ${first.blind.name}.`
        ),
      };
    }
    case "CONTINUE_ENDLESS": {
      const refusal = endlessRefusal(plan, run);
      if (refusal) return refuse(refusal);
      const endless = endlessOf(plan) as Endless;
      // Round 1's study, and with it its Boss, is drawn now, so the shop
      // and the cleared Blind can name the study that follows.
      const round = drawEndlessBoss(endless, acts.length, run);
      const next: RunState = {
        ...run,
        endless: true,
        drawIndex: round.drawIndex,
        draws: round.draws,
        bossIds: [...run.bossIds, round.bossId],
      };
      const study = actAt(plan, next, acts.length);
      return announce(
        next,
        "RUN_CONTINUED",
        `The package is submitted and the compound is on the market. ${endless.title} begins: ${study.title}. Quotas rise each round; the first failed Blind ends the run.`
      );
    }
    case "END_RUN": {
      const refusal = endlessRefusal(plan, run);
      if (refusal) return refuse(refusal);
      return announce(
        run,
        "RUN_ENDED",
        `Package submitted. ${plan.title} won.`,
        { ended: true }
      );
    }
    case "CASH_OUT":
    case "REROLL":
    case "BUY":
    case "BUY_PACK":
    case "PICK_PACK_CARD":
    case "SKIP_PACK":
    case "SELL_RELIC":
      return shopAction(plan, run, action);
    case "NEXT_BLIND": {
      if (run.table.status !== "CLEARED") {
        return refuse(`Clear ${blind.blind.name} first.`);
      }
      if (dmcDefenseOf(blind) && !run.table.rewardClaimed) {
        return refuse("Choose an SOP relic first.");
      }
      const stop = nextStop(plan, run);
      if (!stop) return refuse(`${plan.title} is complete.`);
      if (run.shop?.opened) {
        return refuse("Keep a card from the pack or skip it first.");
      }
      // Leaving without visiting the shop still collects the payout.
      const paid = run.cashOut
        ? run.table
        : {
            ...run.table,
            budget: run.table.budget + payoutFor(plan, run).total,
          };
      const next = stop.blind;
      if (stop.actIndex !== run.actIndex) {
        // A new study: its own subjects, snapshots, rulebook and outputs.
        // The last study's sites closed out with it; everything else the
        // run earned comes along. Its first Blind draws no crisis.
        const nextAct = actAt(plan, run, stop.actIndex);
        const round = endlessRound(plan, stop.actIndex);
        const endless = endlessOf(plan);
        // A campaign act draws its Boss as its study starts. A
        // post-marketing round's was drawn before it, so the round draws
        // the one after it instead.
        const boss =
          round !== null && endless
            ? drawEndlessBoss(endless, stop.actIndex + 1, run)
            : drawBoss(nextAct, stop.actIndex, run);
        const opening = drawDeviation(
          nextAct,
          { seed: run.seed, ...boss },
          stop.actIndex,
          0
        );
        return {
          ...run,
          drawIndex: opening.drawIndex,
          draws: opening.draws,
          bossIds: [...run.bossIds, boss.bossId],
          actIndex: stop.actIndex,
          blindIndex: 0,
          cashOut: null,
          shop: null,
          table: startBlind(
            next,
            undefined,
            { ...carriedInventory(paid), sites: [], enrollments: [] },
            null,
            run.table.lastEvent,
            "ACT_STARTED",
            `${nextAct.title}. A new ${round === null ? "study" : "post-marketing study"}: subjects, snapshots, the SAP and every output start over. ${next.blind.name}. Target ${next.blind.quota}.`,
            opening.deviation
          ),
        };
      }
      const drawnCrisis = drawCrisis(act, run, run.actIndex, stop.blindIndex);
      const { crisis } = drawnCrisis;
      const { deviation, drawIndex, draws } = drawDeviation(
        act,
        { seed: run.seed, ...drawnCrisis },
        run.actIndex,
        stop.blindIndex
      );
      return {
        ...run,
        drawIndex,
        draws,
        blindIndex: stop.blindIndex,
        // The study goes on: later Blinds see every snapshot change so far,
        // and the tray and budget come along.
        cashOut: null,
        shop: null,
        table: startBlind(
          next,
          studyHistory(paid),
          carriedInventory(paid),
          crisis,
          run.table.lastEvent,
          "BLIND_STARTED",
          `${next.blind.name}. Target ${next.blind.quota}.`,
          deviation
        ),
      };
    }
    case "SELL_CONSUMABLE":
      // Between Blinds the table is closed; the shop takes the sale.
      if (run.table.status === "CLEARED") return shopAction(plan, run, action);
      return { ...run, table: advanceTable(blind, run.table, action) };
    default:
      return { ...run, table: advanceTable(blind, run.table, action) };
  }
}

/** Derives everything a run renders. Pure; safe to call on every render. */
export function deriveRunView(plan: RunPlan, run: RunState): RunView {
  const { blindIndex } = run;
  const blinds = runBlinds(plan, run);
  const blind = blinds[blindIndex];
  const stop = nextStop(plan, run);
  const isFinalBlind = stop === null;
  const phase: RunPhase =
    run.table.status === "CLEARED"
      ? isFinalBlind
        ? "RUN_WON"
        : run.shop
          ? "SHOP"
          : "BLIND_CLEARED"
      : run.table.status === "FAILED"
        ? "RUN_FAILED"
        : "PLAYING";
  const showIntro =
    phase === "PLAYING" &&
    run.table.handsPlayed === 0 &&
    run.table.discards === 0;
  const act = actView(plan, run, run.actIndex);
  const boss = blinds[blinds.length - 1];
  const endless = endlessOf(plan);
  return {
    act,
    blind,
    blindIndex,
    blindCount: blinds.length,
    isFinalBlind,
    nextBlind: stop?.blind ?? null,
    nextAct:
      stop && stop.actIndex !== run.actIndex
        ? actView(plan, run, stop.actIndex)
        : null,
    actIntro:
      showIntro && run.actIndex > 0 && blindIndex === 0
        ? {
            act,
            bossTitle: boss.title,
            bossIntro: boss.intro,
            reset: STUDY_RESET,
            kept: RUN_KEPT,
          }
        : null,
    phase,
    showIntro,
    table: deriveTableView(blind, run.table),
    seed: run.seed,
    draws: run.draws,
    pendingCashOut:
      cashOutRefusal(plan, run) === null ? payoutFor(plan, run) : null,
    cashOut: run.cashOut,
    shop: deriveShopView(plan, run),
    endless: endless
      ? {
          title: endless.title,
          canContinue: phase === "RUN_WON" && !run.ended,
          round: act.round,
          campaignWon: run.endless || phase === "RUN_WON",
        }
      : null,
  };
}
