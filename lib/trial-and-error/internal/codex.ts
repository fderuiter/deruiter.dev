import { z } from "zod";
import type {
  Act,
  BossBlindModifier,
  CrisisCard,
  FootnoteSeal,
  GuidanceCard,
  HandType,
  Relic,
  Scenario,
  ShopEntry,
} from "../types";
import { HandTypeSchema, SponsorIdSchema, StakeSchema } from "../types";
import { GUIDANCE_CARDS } from "./guidance";
import { HAND_BASE_SCORES, HAND_EXAMPLES, HAND_NAMES } from "./hands";
import { RELIC_PHASE_LABELS, relicPhase } from "./relics";
import {
  advanceRun,
  createRunState,
  deriveRunView,
  planActs,
  runBlinds,
  type RunPlan,
  type RunState,
} from "./run";
import type { RunLog } from "./save";
import type { RunOrigin } from "./seed";
import { SPONSORS } from "./sponsors";
import { dmcDefenseOf } from "./table";

/**
 * The Codex and run history (#949, #1529). Pure: the Codex is a document the
 * browser adapter stores as a string; these functions only record into it,
 * check it and describe it. Nothing here reads the clock or storage.
 *
 * An entry is discovered the first time a run shows it to the player: seen in
 * the shop or a pack, drawn into the tray, met as a Boss, played as a hand or
 * sponsored. Each keeps the run it was first seen in, so later runs never
 * overwrite that.
 */

/** The Codex format's current version. */
export const CODEX_VERSION = 1;

/** How many finished runs the history keeps, newest first. */
export const RUN_HISTORY_LIMIT = 10;

/** The Codex's sections, in the order the Codex shows them. */
export const CODEX_CATEGORIES = [
  "RELIC",
  "GUIDANCE",
  "SEAL",
  "BOSS",
  "CRISIS",
  "HAND",
  "SPONSOR",
] as const;
/** One Codex section. */
export type CodexCategory = (typeof CODEX_CATEGORIES)[number];

/** Each section's heading. */
export const CODEX_CATEGORY_LABELS: Readonly<Record<CodexCategory, string>> =
  Object.freeze({
    RELIC: "Relics",
    GUIDANCE: "Guidance cards",
    SEAL: "Footnote Seals",
    BOSS: "Boss Blinds",
    CRISIS: "Crisis cards",
    HAND: "Hand types",
    SPONSOR: "Sponsors",
  });

/** How an entry was first seen. */
export const DISCOVERY_SOURCES = [
  "SHOP",
  "PACK",
  "TRAY",
  "RACK",
  "REWARD",
  "BOSS",
  "CRISIS",
  "PLAYED",
  "SPONSOR",
] as const;
/** How an entry was first seen. */
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

/** Each source as the Codex words it. */
export const DISCOVERY_SOURCE_LABELS: Readonly<
  Record<DiscoverySource, string>
> = Object.freeze({
  SHOP: "Seen in the Procurement Shop",
  PACK: "Seen in a pack",
  TRAY: "Drawn into the tray",
  RACK: "Joined the relic rack",
  REWARD: "Offered as a Boss reward",
  BOSS: "Met as a Boss",
  CRISIS: "Drawn as a crisis",
  PLAYED: "Played",
  SPONSOR: "Sponsored a run",
});

const codexId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const runSeed = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count = z.number().int().min(0).max(1_000_000);

const RunOriginSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("RANDOM") }),
  z.object({ kind: z.literal("SEEDED") }),
  z.object({ kind: z.literal("DAILY"), date: isoDate }),
]);

/** The run an entry was first seen in. */
export const CodexRunRefSchema = z.object({
  actId: codexId,
  seed: runSeed,
  /** How the run's seed was chosen; absent means a random run. */
  origin: RunOriginSchema.optional(),
});
/** The run an entry was first seen in. */
export type CodexRunRef = z.infer<typeof CodexRunRefSchema>;

/** One discovered entry. */
export const CodexEntrySchema = z.object({
  firstSeen: CodexRunRefSchema,
  via: z.enum(DISCOVERY_SOURCES),
});
/** One discovered entry. */
export type CodexEntry = z.infer<typeof CodexEntrySchema>;

const section = z.record(codexId, CodexEntrySchema);

/** A finished run, as the history keeps it. */
export const RunHistoryEntrySchema = z.object({
  actId: codexId,
  seed: runSeed,
  origin: RunOriginSchema.optional(),
  sponsorId: SponsorIdSchema.optional(),
  stake: StakeSchema.optional(),
  /** How far the run got: the act and Blind it ended on. */
  reached: z.object({
    actIndex: count,
    actTitle: z.string().min(1).max(120),
    blindIndex: count,
    blindTitle: z.string().min(1).max(120),
    /** The post-marketing round it ended in, or null for a campaign act. */
    round: count.nullable(),
  }),
  /** The run's highest-scoring hand, or null when none was played. */
  bestHand: z
    .object({
      handType: HandTypeSchema,
      score: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    })
    .nullable(),
  /** WON: the plan's last Blind cleared and the run submitted. */
  result: z.enum(["WON", "FAILED"]),
  /** The campaign was won, even if post-marketing rounds then failed. */
  campaignWon: z.boolean(),
  /** Moves the run took. */
  moves: count,
  /** The UTC date the run ended, when the adapter knows it. */
  endedOn: isoDate.optional(),
});
/** A finished run, as the history keeps it. */
export type RunHistoryEntry = z.infer<typeof RunHistoryEntrySchema>;

/** The stored Codex document, version 1. */
export const CodexSchema = z.object({
  version: z.literal(CODEX_VERSION),
  discovered: z.object({
    RELIC: section,
    GUIDANCE: section,
    SEAL: section,
    BOSS: section,
    CRISIS: section,
    HAND: section,
    SPONSOR: section,
  }),
  history: z.array(RunHistoryEntrySchema).max(RUN_HISTORY_LIMIT),
});
/** The Codex: every discovery and the last runs. */
export type Codex = z.infer<typeof CodexSchema>;

/** A Codex with nothing discovered and no runs. */
export function emptyCodex(): Codex {
  return {
    version: CODEX_VERSION,
    discovered: {
      RELIC: {},
      GUIDANCE: {},
      SEAL: {},
      BOSS: {},
      CRISIS: {},
      HAND: {},
      SPONSOR: {},
    },
    history: [],
  };
}

/**
 * Upgrades an older Codex document one version at a time. Only v1 exists,
 * so the table is empty; a v2 adds `{ 1: (v1) => v2 }` and bumps
 * `CODEX_VERSION`, and every v1 document keeps its entries and history.
 */
const MIGRATIONS: Readonly<Record<number, (doc: unknown) => unknown>> = {};

function versionOf(doc: unknown): unknown {
  return typeof doc === "object" && doc !== null
    ? (doc as { version?: unknown }).version
    : undefined;
}

/**
 * Brings a parsed Codex document of any known version up to the current one
 * and checks it, or returns null when it is not a Codex this build can read.
 * Never throws.
 */
export function migrateCodex(doc: unknown): Codex | null {
  try {
    let current = doc;
    for (;;) {
      const version = versionOf(current);
      if (version === CODEX_VERSION) break;
      const step =
        typeof version === "number" ? MIGRATIONS[version] : undefined;
      if (!step) return null;
      current = step(current);
    }
    const parsed = CodexSchema.safeParse(current);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * What reading a stored Codex found. EMPTY: nothing stored. OK: a readable
 * Codex. INVALID: corrupt JSON or a document that fails the schema, which the
 * next write replaces. NEWER: a later version written by a newer build,
 * which this build reads as empty and must not overwrite.
 */
export type CodexReadStatus = "EMPTY" | "OK" | "INVALID" | "NEWER";

/** A stored Codex, read. */
export interface CodexRead {
  codex: Codex;
  status: CodexReadStatus;
}

/**
 * Reads a stored Codex string. Anything unreadable degrades to an empty
 * Codex, never an error.
 */
export function parseCodex(json: string | null): CodexRead {
  if (json === null || json === "") {
    return { codex: emptyCodex(), status: "EMPTY" };
  }
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return { codex: emptyCodex(), status: "INVALID" };
  }
  const codex = migrateCodex(doc);
  if (codex) return { codex, status: "OK" };
  const version = versionOf(doc);
  const newer = typeof version === "number" && version > CODEX_VERSION;
  return { codex: emptyCodex(), status: newer ? "NEWER" : "INVALID" };
}

/** The Codex as the string the adapter stores. */
export function serializeCodex(codex: Codex): string {
  return JSON.stringify(CodexSchema.parse(codex));
}

/** One discovery a run state shows. */
interface Sighting {
  category: CodexCategory;
  id: string;
  via: DiscoverySource;
}

function entrySighting(entry: ShopEntry, via: DiscoverySource): Sighting[] {
  if (entry.kind === "RELIC") {
    return [{ category: "RELIC", id: entry.relic.id, via }];
  }
  if (entry.kind === "GUIDANCE") {
    return [{ category: "GUIDANCE", id: entry.guidance.id, via }];
  }
  if (entry.kind === "SEAL") {
    return [{ category: "SEAL", id: entry.seal.id, via }];
  }
  return [];
}

/** Everything the run state shows the player, in a stable order. */
function sightings(plan: RunPlan, run: RunState): Sighting[] {
  const table = run.table;
  const found: Sighting[] = [];
  const sponsorId = run.sponsorId ?? "VIRTUAL_BIOTECH";
  found.push({ category: "SPONSOR", id: sponsorId, via: "SPONSOR" });
  for (const relic of table.relics) {
    found.push({ category: "RELIC", id: relic.id, via: "RACK" });
  }
  for (const item of table.consumables) {
    if (item.kind === "SEAL") {
      found.push({ category: "SEAL", id: item.seal.id, via: "TRAY" });
    } else if (item.kind === "GUIDANCE") {
      found.push({ category: "GUIDANCE", id: item.guidance.id, via: "TRAY" });
    }
  }
  for (const seals of Object.values(table.seals)) {
    for (const seal of seals) {
      found.push({ category: "SEAL", id: seal.id, via: "TRAY" });
    }
  }
  if (run.shop) {
    for (const slot of run.shop.slots) {
      found.push(...entrySighting(slot.entry, "SHOP"));
    }
    for (const card of run.shop.opened?.cards ?? []) {
      if (card.kind === "ENTRY")
        found.push(...entrySighting(card.entry, "PACK"));
    }
  }
  for (const draw of run.draws) {
    if (draw.kind === "CRISIS") {
      found.push({ category: "CRISIS", id: draw.id, via: "CRISIS" });
    }
  }
  if (table.crisis) {
    found.push({ category: "CRISIS", id: table.crisis.id, via: "CRISIS" });
  }
  const scenario = runBlinds(plan, run)[run.blindIndex];
  if (scenario?.boss) {
    found.push({ category: "BOSS", id: scenario.boss.id, via: "BOSS" });
  }
  const rewards = scenario ? (dmcDefenseOf(scenario)?.rewards ?? []) : [];
  if (table.status === "CLEARED") {
    for (const relic of rewards) {
      found.push({ category: "RELIC", id: relic.id, via: "REWARD" });
    }
  }
  for (const handType of HandTypeSchema.options) {
    if ((table.handLevels[handType]?.playedCount ?? 0) > 0) {
      found.push({ category: "HAND", id: handType, via: "PLAYED" });
    }
  }
  for (const play of table.plays) {
    found.push({
      category: "HAND",
      id: play.classification.handType,
      via: "PLAYED",
    });
  }
  return found;
}

/**
 * Records every entry the run state shows that the Codex has not seen yet,
 * with `ref` as its first-seen run. An entry already discovered keeps its
 * first-seen run. Returns the same Codex object when nothing is new, so the
 * adapter writes only when something was discovered.
 */
export function recordDiscoveries(
  codex: Codex,
  plan: RunPlan,
  run: RunState,
  ref: CodexRunRef
): Codex {
  let next: Codex | null = null;
  for (const { category, id, via } of sightings(plan, run)) {
    if (!codexId.safeParse(id).success) continue;
    const known = (next ?? codex).discovered[category];
    if (Object.hasOwn(known, id)) continue;
    next ??= {
      ...codex,
      discovered: { ...codex.discovered },
    };
    next.discovered[category] = {
      ...next.discovered[category],
      [id]: { firstSeen: ref, via },
    };
  }
  return next ?? codex;
}

/** The newest-first history entry that stands for the same finished run. */
function sameRun(a: RunHistoryEntry, b: RunHistoryEntry): boolean {
  return (
    a.actId === b.actId &&
    a.seed === b.seed &&
    a.moves === b.moves &&
    a.result === b.result &&
    a.sponsorId === b.sponsorId &&
    a.stake === b.stake
  );
}

/**
 * Adds a finished run to the front of the history, keeping the newest
 * `RUN_HISTORY_LIMIT`. Recording the same run twice in a row (the same plan,
 * seed, choice, move count and result) leaves the history as it was.
 */
export function recordRun(codex: Codex, entry: RunHistoryEntry): Codex {
  const newest = codex.history[0];
  if (newest && sameRun(newest, entry)) return codex;
  return {
    ...codex,
    history: [entry, ...codex.history].slice(0, RUN_HISTORY_LIMIT),
  };
}

/**
 * The history entry for a finished run, replayed from its log, or null when
 * the run has not ended: a won campaign still offering post-marketing waits
 * on the player. `endedOn` is the UTC date, which the adapter supplies.
 */
export function summarizeRun(
  plan: RunPlan,
  log: RunLog,
  endedOn?: string
): RunHistoryEntry | null {
  let run = createRunState(plan, log.seed, {
    sponsorId: log.sponsorId,
    stake: log.stake,
  });
  let best: RunHistoryEntry["bestHand"] = null;
  const consider = (state: RunState) => {
    const play = state.table.lastPlay;
    if (play && (best === null || play.evaluation.score > best.score)) {
      best = {
        handType: play.classification.handType,
        score: play.evaluation.score,
      };
    }
  };
  for (const action of log.actions) {
    run = advanceRun(plan, run, action);
    consider(run);
  }
  const view = deriveRunView(plan, run);
  const over =
    view.phase === "RUN_FAILED" ||
    (view.phase === "RUN_WON" && !view.endless?.canContinue);
  if (!over) return null;
  const campaignWon =
    view.phase === "RUN_WON" || (view.endless?.campaignWon ?? false);
  const title = (text: string) => text.slice(0, 120) || "Untitled";
  return {
    actId: log.actId,
    seed: log.seed,
    ...(log.origin ? { origin: log.origin } : {}),
    ...(log.sponsorId !== undefined && { sponsorId: log.sponsorId }),
    ...(log.stake !== undefined && { stake: log.stake }),
    reached: {
      actIndex: view.actIndex,
      actTitle: title(view.act.title),
      blindIndex: view.blindIndex,
      blindTitle: title(view.blind.title),
      round: view.act.round,
    },
    bestHand: best,
    result: view.phase === "RUN_WON" ? "WON" : "FAILED",
    campaignWon,
    moves: log.actions.length,
    ...(endedOn !== undefined && { endedOn }),
  };
}

/** One Codex entry as the Codex view shows it. */
export interface CodexEntryView {
  id: string;
  category: CodexCategory;
  name: string;
  /** What an undiscovered entry's silhouette says about it. */
  teaser: string;
  /** What the entry does. */
  description: string;
  /** Flavor text, when the entry has any. */
  flavor: string | null;
  /** The first-seen run and how, once discovered; null while undiscovered. */
  discovery: CodexEntry | null;
}

/** One Codex section as the Codex view shows it. */
export interface CodexSectionView {
  category: CodexCategory;
  title: string;
  entries: CodexEntryView[];
  discovered: number;
}

type CatalogEntry = Omit<CodexEntryView, "discovery" | "category">;

const SEAL_TEASERS: Readonly<Record<FootnoteSeal["effect"]["kind"], string>> = {
  PLUS_CHIPS: "A footnote seal that adds Chips to one output.",
  PLUS_MULT: "A footnote seal that adds +Mult to one output.",
  WAIVE: "A footnote seal that waives a redline.",
};

const BOSS_TEASERS: Readonly<Record<BossBlindModifier["debuffType"], string>> =
  {
    DISABLE_POPULATION: "A Boss that zeroes an analysis set.",
    HAND_LIMIT: "A Boss that caps the hands you may play.",
    DISCARD_PENALTY: "A Boss that taxes every discard.",
    BLIND_FIREWALL: "A Boss that turns treatment arms face down.",
  };

function sealEffect(seal: FootnoteSeal): string {
  if (seal.effect.kind === "PLUS_CHIPS") {
    return `+${seal.effect.value} Chips to the output it is affixed to.`;
  }
  if (seal.effect.kind === "PLUS_MULT") {
    return `+${seal.effect.value} Mult to the output it is affixed to.`;
  }
  return "Waives the redline of every SAP rule that names it.";
}

function relicEntry(relic: Relic): CatalogEntry {
  const phase = RELIC_PHASE_LABELS[relicPhase(relic)];
  return {
    id: relic.id,
    name: relic.name,
    teaser: `An SOP relic. Trigger: ${phase}.`,
    description: relic.description,
    flavor: `Trigger: ${phase}.`,
  };
}

function guidanceEntry(card: GuidanceCard): CatalogEntry {
  return {
    id: card.id,
    name: card.name,
    teaser: `A Guidance card that levels up ${HAND_NAMES[card.handType]}.`,
    description: `${card.document}. Levels up ${HAND_NAMES[card.handType]} for the rest of the run.`,
    flavor: card.flavor,
  };
}

function sealEntry(seal: FootnoteSeal): CatalogEntry {
  return {
    id: seal.id,
    name: seal.name,
    teaser: SEAL_TEASERS[seal.effect.kind],
    description: sealEffect(seal),
    flavor: seal.footnote,
  };
}

function bossEntry(scenario: Scenario, boss: BossBlindModifier): CatalogEntry {
  return {
    id: boss.id,
    name: boss.name,
    teaser: BOSS_TEASERS[boss.debuffType],
    description: `${scenario.title}: ${boss.description}`,
    flavor: scenario.intro,
  };
}

function crisisEntry(crisis: CrisisCard): CatalogEntry {
  return {
    id: crisis.id,
    name: crisis.name,
    teaser: `A crisis with ${crisis.choices.length} ways to answer it.`,
    description: crisis.description,
    flavor: `Choices: ${crisis.choices.map((c) => c.label).join(", ")}.`,
  };
}

function handEntry(handType: HandType): CatalogEntry {
  const base = HAND_BASE_SCORES[handType];
  return {
    id: handType,
    name: HAND_NAMES[handType],
    teaser: `A scoring hand worth ${base.baseChips} Chips and +${base.baseMult} Mult at Lv.1.`,
    description: `${base.baseChips} Chips and +${base.baseMult} Mult at Lv.1.`,
    flavor: `Example: ${HAND_EXAMPLES[handType]}.`,
  };
}

/** Every act a plan can reach, post-marketing studies included. */
function reachableActs(plan: RunPlan): Act[] {
  const acts = [...planActs(plan)];
  if ("acts" in plan && plan.endless) acts.push(...plan.endless.studies);
  return acts;
}

/** Adds entries to a section, the first of each id winning. */
function collect<T>(
  into: Map<string, CatalogEntry>,
  items: Iterable<T>,
  toEntry: (item: T) => CatalogEntry
): void {
  for (const item of items) {
    const entry = toEntry(item);
    if (!into.has(entry.id)) into.set(entry.id, entry);
  }
}

/**
 * Every entry a plan can show, by section, in the plan's order: what the
 * Codex can hold. Entries recorded under ids the plan no longer has are
 * kept in the document but not shown.
 */
function codexCatalog(plan: RunPlan): Record<CodexCategory, CatalogEntry[]> {
  const relics = new Map<string, CatalogEntry>();
  const guidance = new Map<string, CatalogEntry>();
  const seals = new Map<string, CatalogEntry>();
  const bosses = new Map<string, CatalogEntry>();
  const crises = new Map<string, CatalogEntry>();
  for (const act of reachableActs(plan)) {
    const scenarios = [...act.blinds, ...(act.bossPool ?? [])];
    const entries = act.shop?.entries ?? [];
    collect(
      relics,
      entries.flatMap((e) => (e.kind === "RELIC" ? [e.relic] : [])),
      relicEntry
    );
    collect(
      relics,
      scenarios.flatMap((s) => dmcDefenseOf(s)?.rewards ?? []),
      relicEntry
    );
    collect(
      guidance,
      entries.flatMap((e) => (e.kind === "GUIDANCE" ? [e.guidance] : [])),
      guidanceEntry
    );
    collect(
      guidance,
      scenarios.flatMap((s) => s.guidance ?? []),
      guidanceEntry
    );
    collect(
      seals,
      entries.flatMap((e) => (e.kind === "SEAL" ? [e.seal] : [])),
      sealEntry
    );
    collect(
      seals,
      scenarios.flatMap((s) => s.consumables ?? []),
      sealEntry
    );
    collect(
      seals,
      (act.crisisDeck ?? []).flatMap((c) =>
        c.choices.flatMap((choice) =>
          choice.effect.grantSeal ? [choice.effect.grantSeal] : []
        )
      ),
      sealEntry
    );
    collect(
      bosses,
      scenarios.flatMap((s) => (s.boss ? [[s, s.boss] as const] : [])),
      ([s, boss]) => bossEntry(s, boss)
    );
    collect(crises, act.crisisDeck ?? [], crisisEntry);
  }
  collect(guidance, Object.values(GUIDANCE_CARDS), guidanceEntry);
  const sponsors = Object.values(SPONSORS).map((sponsor): CatalogEntry => ({
    id: sponsor.id,
    name: sponsor.name,
    teaser: "A sponsor you have not run a study for yet.",
    description: sponsor.description,
    flavor: sponsor.twist,
  }));
  return {
    RELIC: [...relics.values()],
    GUIDANCE: [...guidance.values()],
    SEAL: [...seals.values()],
    BOSS: [...bosses.values()],
    CRISIS: [...crises.values()],
    HAND: HandTypeSchema.options.map(handEntry),
    SPONSOR: sponsors,
  };
}

/**
 * The Codex as the browsable view shows it: every section of the plan, each
 * entry discovered (with its first-seen run) or still a silhouette.
 */
export function deriveCodexView(
  plan: RunPlan,
  codex: Codex
): CodexSectionView[] {
  const catalog = codexCatalog(plan);
  return CODEX_CATEGORIES.map((category) => {
    const known = codex.discovered[category];
    const entries = catalog[category].map((entry): CodexEntryView => ({
      ...entry,
      category,
      discovery: Object.hasOwn(known, entry.id) ? known[entry.id] : null,
    }));
    return {
      category,
      title: CODEX_CATEGORY_LABELS[category],
      entries,
      discovered: entries.filter((e) => e.discovery !== null).length,
    };
  });
}

/** How a run's seed was chosen, as the Codex and history label it. */
export function originLabel(origin: RunOrigin | undefined): string {
  if (!origin || origin.kind === "RANDOM") return "Random seed";
  if (origin.kind === "SEEDED") return "Seeded";
  return `Daily Protocol ${origin.date}`;
}
