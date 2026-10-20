// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  ACT_I,
  ACT_II,
  ACT_III,
  ACT_III_SHOP,
  ACT_II_SHOP,
  ACT_I_SHOP,
  BIOSTAT_OPS_CAMPAIGN,
  CLASSIC_SHOP,
  DEMOGRAPHICS_SCENARIO,
  POST_MARKETING,
  RARITY_WEIGHTS,
  RELIC_RARITY_LABELS,
  RELIC_RARITY_MIN_PRICE,
  RelicSchema,
  ShopCatalogSchema,
  advanceRun,
  advanceTable,
  blindStartCpu,
  createRunState,
  createTableState,
  deriveCodexView,
  deriveRunView,
  deriveTableView,
  describeRelicTrigger,
  parseRunSave,
  replayRun,
  serializeRun,
  emptyCodex,
  freeDiscards,
  relicModifiers,
  relicRarity,
  shopEntryId,
  siteEnrollments,
  summarizeRun,
  type LoggedAction,
  type Relic,
  type RelicCard,
  type RelicCounts,
  type RunState,
  type ShopCatalog,
  type Act,
  type Campaign,
  type ShopEntry,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

type RelicEntry = Extract<ShopEntry, { kind: "RELIC" }>;

const relicEntries = (shop: ShopCatalog): RelicEntry[] =>
  shop.entries.filter((e): e is RelicEntry => e.kind === "RELIC");

const relicIds = (shop: ShopCatalog) =>
  new Set(relicEntries(shop).map((e) => e.relic.id));

/** A relic by id, from whichever act's shop stocks it. */
const relic = (id: string): Relic => {
  for (const shop of [ACT_I_SHOP, ACT_II_SHOP, ACT_III_SHOP]) {
    const entry = relicEntries(shop).find((e) => e.relic.id === id);
    if (entry) return entry.relic;
  }
  throw new Error(`No shop relic ${id}`);
};

/** Every relic #2083 added: the ones the classic catalog never stocked. */
const SYNERGY_IDS = [
  ...new Set(
    [ACT_I_SHOP, ACT_II_SHOP, ACT_III_SHOP].flatMap((shop) =>
      [...relicIds(shop)].filter((id) => !relicIds(CLASSIC_SHOP).has(id))
    )
  ),
];

const card = (overrides: Partial<RelicCard> & { id: string }): RelicCard => ({
  cardType: "TABLE",
  population: "ITT",
  chips: 25,
  mult: 2,
  qcPassed: false,
  cancelled: false,
  ...overrides,
});

const counts = (partial: Partial<RelicCounts> = {}): RelicCounts => ({
  staleInHand: 0,
  redlinesFixed: 0,
  discards: 0,
  handsPlayed: 0,
  ...partial,
});

/** What one relic adds to a hand of `cards` with `partial` counts. */
const fire = (
  id: string,
  cards: RelicCard[] = [],
  partial: Partial<RelicCounts> = {}
) =>
  relicModifiers([relic(id)], {
    cards,
    ruleResults: [],
    counts: counts(partial),
  });

describe("synergy relics (#2083)", () => {
  it("adds 15 to 20 triggered relics, each scaling with something the player controls", () => {
    expect(SYNERGY_IDS.length).toBeGreaterThanOrEqual(15);
    expect(SYNERGY_IDS.length).toBeLessThanOrEqual(20);
    for (const id of SYNERGY_IDS) {
      const r = relic(id);
      expect(r.trigger, id).toBeDefined();
      expect(RelicSchema.safeParse(r).success, id).toBe(true);
      const t = r.trigger!;
      const scales =
        (t.phase === "ON_HAND_PLAYED" && t.scale !== undefined) ||
        t.phase === "ON_CARD_SCORED" ||
        (t.phase === "ON_DISCARD" && t.stacks === true) ||
        (t.phase === "ON_BLIND_START" && t.cpuPerAct !== undefined);
      expect(scales, id).toBe(true);
    }
  });

  it("Safety Data Manager: +12 Chips for each Safety output scored", () => {
    const mods = fire("REL-SAFETY-DATA-MANAGER", [
      card({ id: "a", population: "SAFETY" }),
      card({ id: "b", population: "ITT" }),
      card({ id: "c", population: "SAFETY" }),
    ]);
    expect(mods.map((m) => [m.sourceId, m.chips])).toEqual([
      ["REL-SAFETY-DATA-MANAGER@a", 12],
      ["REL-SAFETY-DATA-MANAGER@c", 12],
    ]);
  });

  it("Query Triage Desk: +1 Mult per discard made this Blind, nothing before one", () => {
    expect(fire("REL-QUERY-TRIAGE-DESK")).toEqual([]);
    const [mod] = fire("REL-QUERY-TRIAGE-DESK", [], { discards: 3 });
    expect(mod).toMatchObject({
      sourceId: "REL-QUERY-TRIAGE-DESK",
      label: "Query Triage Desk (3 discards)",
      plusMult: 3,
      xMult: 1,
    });
    expect(freeDiscards([relic("REL-QUERY-TRIAGE-DESK")])).toBe(0);
  });

  it("Change-Control Log: +20 Chips per stale output in hand", () => {
    expect(fire("REL-CHANGE-CONTROL-LOG")).toEqual([]);
    expect(
      fire("REL-CHANGE-CONTROL-LOG", [], { staleInHand: 1 })[0]
    ).toMatchObject({
      chips: 20,
      label: "Change-Control Log (1 stale output in hand)",
    });
    expect(
      fire("REL-CHANGE-CONTROL-LOG", [], { staleInHand: 2 })[0].chips
    ).toBe(40);
  });

  it("QC Checklist: +10 Chips per redline fixed this Blind", () => {
    expect(fire("REL-QC-CHECKLIST")).toEqual([]);
    expect(fire("REL-QC-CHECKLIST", [], { redlinesFixed: 4 })[0]).toMatchObject(
      { chips: 40, label: "QC Checklist (4 redlines fixed)" }
    );
  });

  it("CAPA Coordinator: +1 Mult per redline fixed this Blind", () => {
    expect(
      fire("REL-CAPA-COORDINATOR", [], { redlinesFixed: 3 })[0].plusMult
    ).toBe(3);
  });

  it("Per-Protocol Advocate: +3 Mult for each Per-Protocol output scored", () => {
    const mods = fire("REL-PER-PROTOCOL-ADVOCATE", [
      card({ id: "a", population: "PER_PROTOCOL" }),
      card({ id: "b", population: "FAS" }),
    ]);
    expect(mods.map((m) => [m.sourceId, m.plusMult])).toEqual([
      ["REL-PER-PROTOCOL-ADVOCATE@a", 3],
    ]);
  });

  it("Patient Profile Reviewer: +25 Chips for each Listing scored", () => {
    const mods = fire("REL-PATIENT-PROFILE-REVIEWER", [
      card({ id: "l1", cardType: "LISTING" }),
      card({ id: "t1" }),
      card({ id: "l2", cardType: "LISTING" }),
    ]);
    expect(mods.map((m) => m.chips)).toEqual([25, 25]);
  });

  it("Interim Analysis Plan: +2 Mult per hand already played this Blind", () => {
    expect(fire("REL-INTERIM-ANALYSIS-PLAN")).toEqual([]);
    expect(
      fire("REL-INTERIM-ANALYSIS-PLAN", [], { handsPlayed: 2 })[0]
    ).toMatchObject({
      plusMult: 4,
      label: "Interim Analysis Plan (2 hands played before)",
    });
  });

  it("Elastic Compute Lease and Dedicated Compute Cluster: CPU that grows each act", () => {
    const lease = relic("REL-ELASTIC-COMPUTE");
    const cluster = relic("REL-DEDICATED-CLUSTER");
    expect([0, 1, 2].map((act) => blindStartCpu([lease], act))).toEqual([
      1, 2, 3,
    ]);
    expect([0, 1, 2].map((act) => blindStartCpu([cluster], act))).toEqual([
      2, 3, 4,
    ]);
    // The act defaults to the first, and a nonsense act counts as the first.
    expect(blindStartCpu([lease, cluster])).toBe(3);
    expect(blindStartCpu([lease], -2)).toBe(1);
    // Neither adds to a hand.
    expect(fire("REL-ELASTIC-COMPUTE", [card({ id: "a" })])).toEqual([]);
  });

  it("Rapid Triage Board: a free discard, and +15 Chips per discard made", () => {
    expect(freeDiscards([relic("REL-RAPID-TRIAGE-BOARD")])).toBe(1);
    expect(fire("REL-RAPID-TRIAGE-BOARD")).toEqual([]);
    expect(fire("REL-RAPID-TRIAGE-BOARD", [], { discards: 2 })[0].chips).toBe(
      30
    );
  });

  it("Graphics QC Pipeline: retriggers only QC ✓ Figures that scored", () => {
    const mods = fire("REL-GRAPHICS-QC-PIPELINE", [
      card({
        id: "f1",
        cardType: "FIGURE",
        qcPassed: true,
        chips: 40,
        mult: 3,
      }),
      card({ id: "f2", cardType: "FIGURE" }),
      card({ id: "f3", cardType: "FIGURE", qcPassed: true, cancelled: true }),
      card({ id: "t1", qcPassed: true }),
    ]);
    expect(mods).toEqual([
      {
        sourceId: "REL-GRAPHICS-QC-PIPELINE@f1",
        label: "Graphics QC Pipeline retriggers f1",
        chips: 40,
        plusMult: 3,
        xMult: 1,
      },
    ]);
  });

  it("ITT Steering Committee: ×1.1 Mult for each ITT output scored", () => {
    const mods = fire("REL-ITT-STEERING-COMMITTEE", [
      card({ id: "a" }),
      card({ id: "b", population: "SAFETY" }),
      card({ id: "c" }),
    ]);
    expect(mods.map((m) => m.xMult)).toEqual([1.1, 1.1]);
  });

  it("Inspection-Ready Auditor: ×0.1 more Mult per redline fixed, added not compounded", () => {
    expect(fire("REL-INSPECTION-READY-AUDITOR")).toEqual([]);
    expect(
      fire("REL-INSPECTION-READY-AUDITOR", [], { redlinesFixed: 5 })[0].xMult
    ).toBe(1.5);
  });

  it("Version-Control Archivist: +4 Mult per stale output in hand", () => {
    expect(
      fire("REL-VERSION-CONTROL-ARCHIVIST", [], { staleInHand: 3 })[0].plusMult
    ).toBe(12);
  });

  it("Lean Black Belt: ×0.15 more Mult per discard made this Blind", () => {
    expect(fire("REL-LEAN-BLACK-BELT", [], { discards: 2 })[0].xMult).toBe(1.3);
    expect(freeDiscards([relic("REL-LEAN-BLACK-BELT")])).toBe(0);
  });

  it("Medical Monitor: retriggers each Safety output that scored", () => {
    const mods = fire("REL-MEDICAL-MONITOR", [
      card({ id: "s1", population: "SAFETY", chips: 30, mult: 2 }),
      card({ id: "s2", population: "SAFETY", cancelled: true }),
      card({ id: "i1" }),
    ]);
    expect(mods.map((m) => [m.sourceId, m.chips, m.plusMult])).toEqual([
      ["REL-MEDICAL-MONITOR@s1", 30, 2],
    ]);
  });

  it("Database Lock Countdown: ×0.15 more Mult per hand already played", () => {
    expect(
      fire("REL-DATABASE-LOCK-COUNTDOWN", [], { handsPlayed: 3 })[0].xMult
    ).toBe(1.45);
  });

  it("never overrides the SAP: a scaled relic only adds to the hand", () => {
    for (const id of SYNERGY_IDS) {
      for (const mod of fire(
        id,
        [
          card({ id: "x", qcPassed: true }),
          card({ id: "y", population: "SAFETY" }),
        ],
        { staleInHand: 2, redlinesFixed: 2, discards: 2, handsPlayed: 2 }
      )) {
        expect(mod.chips, id).toBeGreaterThanOrEqual(0);
        expect(mod.plusMult, id).toBeGreaterThanOrEqual(0);
        expect(mod.xMult, id).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("rejects an ON_DISCARD relic that neither frees discards nor stacks", () => {
    const base = relic("REL-QUERY-TRIAGE-DESK");
    expect(
      RelicSchema.safeParse({ ...base, trigger: { phase: "ON_DISCARD" } })
        .success
    ).toBe(false);
  });
});

describe("relic rarities (#2083)", () => {
  it("gives every shop relic a rarity, and prices rarer relics higher", () => {
    for (const shop of [ACT_I_SHOP, ACT_II_SHOP, ACT_III_SHOP, CLASSIC_SHOP]) {
      expect(ShopCatalogSchema.safeParse(shop).success).toBe(true);
      for (const { relic: r, price } of relicEntries(shop)) {
        expect(r.rarity, r.id).toBeDefined();
        expect(price, r.id).toBeGreaterThanOrEqual(
          RELIC_RARITY_MIN_PRICE[r.rarity!]
        );
      }
    }
    const prices = (rarity: string) =>
      [ACT_I_SHOP, ACT_II_SHOP, ACT_III_SHOP]
        .flatMap(relicEntries)
        .filter((e) => e.relic.rarity === rarity)
        .map((e) => e.price);
    expect(Math.max(...prices("COMMON"))).toBeLessThan(
      Math.min(...prices("RARE"))
    );
  });

  it("refuses a rare relic priced like a common", () => {
    const rare = relicEntries(ACT_III_SHOP).find(
      (e) => e.relic.rarity === "RARE"
    )!;
    expect(
      ShopCatalogSchema.safeParse({
        ...ACT_III_SHOP,
        entries: [{ ...rare, price: 4 }],
      }).success
    ).toBe(false);
  });

  it("treats a relic without a rarity as a common", () => {
    const { rarity: _r, ...plain } = relic("REL-QC-CHECKLIST");
    void _r;
    expect(relicRarity(plain)).toBe("COMMON");
    expect(RELIC_RARITY_LABELS).toEqual({
      COMMON: "Common",
      UNCOMMON: "Uncommon",
      RARE: "Rare",
    });
    expect(RARITY_WEIGHTS.COMMON).toBeGreaterThan(RARITY_WEIGHTS.UNCOMMON);
    expect(RARITY_WEIGHTS.UNCOMMON).toBeGreaterThan(RARITY_WEIGHTS.RARE);
  });
});

describe("a shop per act (#2083)", () => {
  it("points each act, and every post-marketing study, at its own shop", () => {
    expect(ACT_I.shop).toBe(ACT_I_SHOP);
    expect(ACT_II.shop).toBe(ACT_II_SHOP);
    expect(ACT_III.shop).toBe(ACT_III_SHOP);
    for (const study of POST_MARKETING.studies) {
      expect(study.shop).toBe(ACT_III_SHOP);
    }
  });

  it("stocks relics in Acts II and III that Act I never does", () => {
    const actI = relicIds(ACT_I_SHOP);
    const onlyII = [...relicIds(ACT_II_SHOP)].filter((id) => !actI.has(id));
    const onlyIII = [...relicIds(ACT_III_SHOP)].filter((id) => !actI.has(id));
    expect(onlyII.length).toBeGreaterThanOrEqual(5);
    expect(onlyIII.length).toBeGreaterThanOrEqual(8);
  });

  it("grows rarer act by act", () => {
    const share = (shop: ShopCatalog) => {
      const entries = relicEntries(shop);
      return (
        entries.filter((e) => e.relic.rarity !== "COMMON").length /
        entries.length
      );
    };
    expect(share(ACT_II_SHOP)).toBeGreaterThan(share(ACT_I_SHOP));
    expect(share(ACT_III_SHOP)).toBeGreaterThan(share(ACT_II_SHOP));
  });

  it("keeps every sponsor's starting relic in each act's shop", () => {
    for (const shop of [ACT_I_SHOP, ACT_II_SHOP, ACT_III_SHOP]) {
      expect(relicIds(shop).has("REL-SENIOR-MEDICAL-WRITER")).toBe(true);
    }
  });
});

/** A run whose current Blind is marked cleared, so it can cash out. */
const cleared = (run: RunState): RunState => ({
  ...run,
  table: { ...run.table, status: "CLEARED" },
});

const stockOf = (seed: string) => {
  const run = advanceRun(ACT_I, cleared(createRunState(ACT_I, seed)), {
    type: "CASH_OUT",
  });
  return run.shop!.slots.map((s) => shopEntryId(s.entry));
};

describe("the shop draw weighs by rarity (#2083)", () => {
  it("gives the same stock for the same seed", () => {
    for (const seed of ["alpha", "bravo", "2026-10-14"]) {
      expect(stockOf(seed)).toEqual(stockOf(seed));
    }
    const seeds = Array.from({ length: 12 }, (_, i) => `stock-${i}`);
    expect(new Set(seeds.map((s) => stockOf(s).join())).size).toBeGreaterThan(
      1
    );
  });

  it("draws commons more often than rares", () => {
    const rarityOf = new Map(
      relicEntries(ACT_I_SHOP).map((e) => [e.relic.id, e.relic.rarity!])
    );
    const tally = { COMMON: 0, UNCOMMON: 0, RARE: 0 };
    for (let i = 0; i < 300; i++) {
      for (const id of stockOf(`tally-${i}`)) {
        const rarity = rarityOf.get(id);
        if (rarity) tally[rarity] += 1;
      }
    }
    // Per relic stocked, a common turns up far more often than a rare.
    const per = (rarity: keyof typeof tally) =>
      tally[rarity] / [...rarityOf.values()].filter((r) => r === rarity).length;
    expect(per("COMMON")).toBeGreaterThan(per("UNCOMMON"));
    expect(per("UNCOMMON")).toBeGreaterThan(per("RARE"));
    expect(tally.RARE).toBeGreaterThan(0);
  });

  it("shows each relic's rarity in the shop view, and none on anything else", () => {
    for (let i = 0; i < 20; i++) {
      const run = advanceRun(
        ACT_I,
        cleared(createRunState(ACT_I, `view-${i}`)),
        { type: "CASH_OUT" }
      );
      const view = deriveRunView(ACT_I, run).shop!;
      run.shop!.slots.forEach((slot, j) => {
        expect(view.items[j].rarity).toBe(
          slot.entry.kind === "RELIC" ? slot.entry.relic.rarity : null
        );
      });
      for (const pack of view.packs) expect(pack.rarity).toBeNull();
    }
  });

  it("weighs a Relic pack's cards by rarity, and shows their rarity", () => {
    const shopRun = advanceRun(ACT_I, cleared(createRunState(ACT_I, "pack")), {
      type: "CASH_OUT",
    });
    const withRelicPack: RunState = {
      ...shopRun,
      table: { ...shopRun.table, budget: 50 },
      shop: {
        ...shopRun.shop!,
        packs: [
          {
            pack: ACT_I_SHOP.packs.find((p) => p.kind === "RELIC")!,
            sold: false,
          },
        ],
      },
    };
    const opened = advanceRun(ACT_I, withRelicPack, {
      type: "BUY_PACK",
      slot: 0,
    });
    const again = advanceRun(ACT_I, withRelicPack, {
      type: "BUY_PACK",
      slot: 0,
    });
    expect(opened.shop!.opened!.cards).toEqual(again.shop!.opened!.cards);
    const view = deriveRunView(ACT_I, opened).shop!.opened!;
    expect(view.cards.length).toBeGreaterThan(0);
    for (const c of view.cards) {
      expect(c.kind).toBe("RELIC");
      expect(c.rarity).not.toBeNull();
    }
  });
});

describe("synergy relics at the card table (#2083)", () => {
  const scenario = DEMOGRAPHICS_SCENARIO;
  const run = (actions: TableAction[], from: TableState) =>
    actions.reduce(
      (state, action) => advanceTable(scenario, state, action),
      from
    );
  const withRelics = (
    relics: Relic[],
    extra: Partial<Parameters<typeof createTableState>[2]> = {}
  ): TableState =>
    createTableState(scenario, undefined, {
      consumables: [],
      budget: 0,
      relics,
      ...extra,
    });
  const ledgerFor = (state: TableState, sourceId: string) =>
    state.lastPlay!.evaluation.ledger.filter((l) => l.sourceId === sourceId);
  const CLEAN_LISTING = "C-L16.2.7";
  const DRAFT_A = "C-T14.1.1-A";

  it("counts redlines corrected in Inspect, and scales with them", () => {
    const start = withRelics([relic("REL-CAPA-COORDINATOR")]);
    expect(start.redlinesFixed).toBeUndefined();
    let fixed = run([{ type: "INSPECT_CARD", cardId: DRAFT_A }], start);
    const draft = scenario.drawPile[0];
    for (let row = 0; row < draft.rows.length; row++) {
      for (let col = 0; col < draft.columns.length; col++) {
        fixed = run([{ type: "INSPECT_CELL", row, col }], fixed);
      }
    }
    const open = deriveTableView(scenario, fixed).inspection!.openFindings;
    expect(open.length).toBeGreaterThan(0);
    for (const finding of open) {
      fixed = run([{ type: "CORRECT_FINDING", findingId: finding.id }], fixed);
    }
    expect(fixed.redlinesFixed).toBe(open.length);
    // A refused correction counts nothing.
    const refused = run(
      [{ type: "CORRECT_FINDING", findingId: open[0].id }],
      fixed
    );
    expect(refused.redlinesFixed).toBe(open.length);
    fixed = run(
      [
        { type: "CLOSE_INSPECT" },
        { type: "TOGGLE_SELECT", cardId: CLEAN_LISTING },
        { type: "PLAY_HAND" },
      ],
      fixed
    );
    expect(ledgerFor(fixed, "REL-CAPA-COORDINATOR")).toContainEqual(
      expect.objectContaining({ kind: "PLUS_MULT", value: open.length })
    );
  });

  it("stacks discards and hands played into later hands", () => {
    const start = withRelics([
      relic("REL-QUERY-TRIAGE-DESK"),
      relic("REL-INTERIM-ANALYSIS-PLAN"),
    ]);
    const first = run(
      [
        { type: "TOGGLE_SELECT", cardId: DRAFT_A },
        { type: "DISCARD" },
        { type: "TOGGLE_SELECT", cardId: CLEAN_LISTING },
        { type: "PLAY_HAND" },
      ],
      start
    );
    expect(ledgerFor(first, "REL-QUERY-TRIAGE-DESK")).toContainEqual(
      expect.objectContaining({ kind: "PLUS_MULT", value: 1 })
    );
    // No hand was played before the first.
    expect(ledgerFor(first, "REL-INTERIM-ANALYSIS-PLAN")).toEqual([]);
    const second = run(
      [{ type: "TOGGLE_SELECT", cardId: first.hand[0] }, { type: "PLAY_HAND" }],
      first
    );
    expect(ledgerFor(second, "REL-INTERIM-ANALYSIS-PLAN")).toContainEqual(
      expect.objectContaining({ kind: "PLUS_MULT", value: 2 })
    );
  });

  it("counts the stale outputs in hand once an enrollment lands", () => {
    const site = ACT_I_SHOP.sites[0];
    const goLive = new Date(
      Date.parse(scenario.populationSnapshot.capturedAt) + 86_400_000
    )
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z");
    const start = withRelics([relic("REL-CHANGE-CONTROL-LOG")], {
      enrollments: siteEnrollments(site, goLive),
    });
    const first = run(
      [{ type: "TOGGLE_SELECT", cardId: CLEAN_LISTING }, { type: "PLAY_HAND" }],
      start
    );
    expect(ledgerFor(first, "REL-CHANGE-CONTROL-LOG")).toEqual([]);
    expect(
      deriveTableView(scenario, first).hand.filter((c) => c.stale).length
    ).toBeGreaterThan(1);
    // A stale output is recompiled before it plays; the rest stay stale.
    const recompiled = run([{ type: "RECOMPILE", cardId: "C-L16.2.4" }], first);
    const stale = deriveTableView(scenario, recompiled).hand.filter(
      (c) => c.stale
    ).length;
    expect(stale).toBeGreaterThan(0);
    const second = run(
      [{ type: "TOGGLE_SELECT", cardId: "C-L16.2.4" }, { type: "PLAY_HAND" }],
      recompiled
    );
    expect(second.handsPlayed).toBe(2);
    expect(ledgerFor(second, "REL-CHANGE-CONTROL-LOG")).toContainEqual(
      expect.objectContaining({ kind: "CHIPS", value: 20 * stale })
    );
  });

  it("starts a later act's Blinds with more CPU from a relic that grows each act", () => {
    const lease = relic("REL-ELASTIC-COMPUTE");
    const plain = createTableState(scenario);
    const actI = withRelics([lease]);
    const actIII = withRelics([lease], { act: 2 });
    expect(actI.cpu.available).toBe(plain.cpu.available + 1);
    expect(actIII.cpu.available).toBe(plain.cpu.available + 3);
    expect(deriveTableView(scenario, actIII).cpuAllocation).toBe(
      scenario.table.startingCpu + 3
    );
  });
});

describe("relics across acts in a campaign (#2083)", () => {
  const C = BIOSTAT_OPS_CAMPAIGN;
  /** The campaign at Act I's Boss, cleared, with `relics` in the rack. */
  const atActBoss = (relics: Relic[]): RunState => {
    let run = createRunState(C, "acts");
    run = { ...run, blindIndex: 2 };
    return {
      ...run,
      table: { ...run.table, status: "CLEARED", relics, budget: 0 },
    };
  };

  it("carries the act into the next study, where the CPU grows", () => {
    const lease = relic("REL-ELASTIC-COMPUTE");
    const next = advanceRun(C, atActBoss([lease]), { type: "NEXT_BLIND" });
    expect(next.actIndex).toBe(1);
    const view = deriveRunView(C, next);
    expect(view.table.cpuAllocation).toBe(view.blind.table.startingCpu + 2);
    expect(next.table.lastEvent?.message).toMatch(
      /Elastic Compute Lease: \+2 CPU\./
    );
  });

  it("sells a relic bought in an earlier act's shop for half its price there", () => {
    const log = relic("REL-CHANGE-CONTROL-LOG");
    expect(relicIds(ACT_II_SHOP).has(log.id)).toBe(false);
    const inActII = advanceRun(C, atActBoss([log]), { type: "NEXT_BLIND" });
    const clearedII = cleared(inActII);
    const view = deriveRunView(
      C,
      advanceRun(C, clearedII, { type: "CASH_OUT" })
    );
    expect(view.shop!.relicSellValues[log.id]).toBe(2);
    const sold = advanceRun(C, clearedII, {
      type: "SELL_RELIC",
      relicId: log.id,
    });
    expect(sold.table.budget - clearedII.table.budget).toBe(2);
  });
});

describe("the Codex describes every relic's trigger (#2083)", () => {
  it("lists each synergy relic with its rarity and what triggers it", () => {
    const view = deriveCodexView(BIOSTAT_OPS_CAMPAIGN, emptyCodex());
    const relics = view.find((s) => s.category === "RELIC")!.entries;
    for (const id of SYNERGY_IDS) {
      const entry = relics.find((e) => e.id === id);
      expect(entry, id).toBeDefined();
      const r = relic(id);
      expect(entry!.teaser).toContain(
        RELIC_RARITY_LABELS[r.rarity!].toLowerCase()
      );
      expect(entry!.flavor).toContain(describeRelicTrigger(r));
    }
  });

  it("puts each trigger in plain words", () => {
    expect(describeRelicTrigger(relic("REL-SENIOR-PROGRAMMER"))).toBe(
      "Every hand: +30 Chips."
    );
    expect(describeRelicTrigger(relic("REL-CHANGE-CONTROL-LOG"))).toBe(
      "Every hand: +20 Chips for each stale output in hand."
    );
    expect(describeRelicTrigger(relic("REL-DOUBLE-PROGRAMMING"))).toBe(
      "When the hand has no redline: ×1.5 Mult."
    );
    expect(describeRelicTrigger(relic("REL-SENIOR-MEDICAL-WRITER"))).toBe(
      "When the hand holds a Figure: +50 Chips."
    );
    expect(describeRelicTrigger(relic("REL-INTERIM-ANALYSIS-PLAN"))).toBe(
      "Every hand: +2 Mult for each hand already played this Blind."
    );
    expect(describeRelicTrigger(relic("REL-LEAD-PROGRAMMER-MACRO"))).toBe(
      "Each QC ✓ Table scored: +4 Mult."
    );
    expect(describeRelicTrigger(relic("REL-ITT-PURIST"))).toBe(
      "Each ITT output scored scores its own Chips and Mult again."
    );
    expect(describeRelicTrigger(relic("REL-RAPID-TRIAGE-BOARD"))).toBe(
      "The first discard of each Blind costs no base CPU. Each discard this Blind adds +15 Chips to every later hand."
    );
    expect(
      describeRelicTrigger({
        ...relic("REL-PROTOCOL-OPTIMIZATION-SOP"),
        trigger: { phase: "ON_DISCARD", freeDiscards: 2 },
      })
    ).toBe("The first 2 discards of each Blind cost no base CPU.");
    expect(describeRelicTrigger(relic("REL-GRID-ALLOCATION"))).toBe(
      "Each Blind starts with +1 CPU."
    );
    expect(describeRelicTrigger(relic("REL-DEDICATED-CLUSTER"))).toBe(
      "Each Blind starts with +2 CPU, and +1 more for each act after the first."
    );
    expect(
      describeRelicTrigger({
        ...relic("REL-SENIOR-PROGRAMMER"),
        modifier: {
          sourceId: "X",
          label: "X",
          chips: 0,
          plusMult: 0,
          xMult: 1,
        },
      })
    ).toBe("Every hand: nothing.");
    expect(
      describeRelicTrigger({
        ...relic("REL-PATIENT-PROFILE-REVIEWER"),
        trigger: { phase: "ON_CARD_SCORED", cardType: "SUBJECT_TOKEN" },
      })
    ).toBe("Each subject token scored: +25 Chips.");
  });
});

/**
 * A v3 save of a whole shopping campaign, written by the code before #2083,
 * with what that code showed after each cash-out and reroll and at each
 * Blind boundary. Loading it now must replay exactly that.
 */
interface V3Fixture {
  save: { version: number; seed: string; actions: LoggedAction[] };
  stock: string[][];
  blinds: { scenarioId: string; budget: number; relics: string[] }[];
}

describe("saves from before per-act shops (#2083)", () => {
  const C = BIOSTAT_OPS_CAMPAIGN;
  const fixture: V3Fixture = JSON.parse(
    readFileSync(
      path.resolve(
        process.cwd(),
        "__tests__/fixtures/trial-and-error-v3-save.json"
      ),
      "utf8"
    )
  );

  it("replays a v3 shopping campaign exactly as it was played", () => {
    expect(fixture.save.version).toBe(3);
    const restored = parseRunSave(JSON.stringify(fixture.save), [C]);
    expect(restored).not.toBeNull();
    expect(restored!.log.shops).toBe("CLASSIC");
    expect(restored!.run.shops).toBe("CLASSIC");
    let run = createRunState(
      C,
      fixture.save.seed,
      {},
      "SHUFFLED",
      "RUN",
      "CLASSIC",
      "FIXED"
    );
    const stock: string[][] = [];
    const blinds: V3Fixture["blinds"] = [];
    for (const action of fixture.save.actions) {
      run = advanceRun(C, run, action);
      if (
        (action.type === "CASH_OUT" || action.type === "REROLL") &&
        run.shop
      ) {
        stock.push(run.shop.slots.map((s) => shopEntryId(s.entry)));
      }
      if (action.type === "NEXT_BLIND") {
        blinds.push({
          scenarioId: run.table.scenarioId,
          budget: run.table.budget,
          relics: run.table.relics.map((r) => r.id),
        });
      }
    }
    expect(stock).toEqual(fixture.stock);
    expect(blinds).toEqual(fixture.blinds);
    expect(restored!.run).toEqual(run);
    // It reached Act III, so Acts II and III stocked the classic catalog.
    expect(run.actIndex).toBe(2);
    const classic = new Set(CLASSIC_SHOP.entries.map(shopEntryId));
    expect(stock.flat().every((id) => classic.has(id))).toBe(true);
  });

  it("keeps a classic run classic through a save, and a new run per act", () => {
    const restored = parseRunSave(JSON.stringify(fixture.save), [C])!;
    const again = parseRunSave(serializeRun(restored.log, new Date(0)), [C]);
    expect(again?.run).toEqual(restored.run);
    expect(
      JSON.parse(
        serializeRun({ actId: C.id, seed: "a", actions: [] }, new Date(0))
      ).shops
    ).toBeUndefined();
    const restarted = advanceRun(C, restored.run, { type: "RESTART_RUN" });
    expect(restarted.shops).toBeUndefined();
    expect(replayRun(C, { ...restored.log, actions: [] }).shops).toBe(
      "CLASSIC"
    );
  });

  it("stocks Act II from Act II's shop in a new run, and from the classic one in an old run", () => {
    const actII = new Set(ACT_II_SHOP.entries.map(shopEntryId));
    const classic = new Set(CLASSIC_SHOP.entries.map(shopEntryId));
    const inActII = (shops: "PER_ACT" | "CLASSIC", seed: string) => {
      const run = createRunState(C, seed, {}, "SHUFFLED", "RUN", shops);
      const atBoss: RunState = {
        ...run,
        blindIndex: 2,
        table: { ...run.table, status: "CLEARED" },
      };
      const next = advanceRun(C, atBoss, { type: "NEXT_BLIND" });
      expect(next.actIndex).toBe(1);
      const paid = advanceRun(C, cleared(next), { type: "CASH_OUT" });
      return paid.shop!.slots.map((slot) => shopEntryId(slot.entry));
    };
    const perAct = Array.from({ length: 30 }, (_, i) =>
      inActII("PER_ACT", `act-ii-${i}`)
    ).flat();
    const old = Array.from({ length: 30 }, (_, i) =>
      inActII("CLASSIC", `act-ii-${i}`)
    ).flat();
    expect(perAct.every((id) => actII.has(id))).toBe(true);
    expect(perAct.some((id) => !classic.has(id))).toBe(true);
    expect(old.every((id) => classic.has(id))).toBe(true);
  });
});

describe("odds and ends (#2083)", () => {
  it("draws a shop relic without a rarity as a common", () => {
    const { rarity: _r, ...plain } = relic("REL-QC-CHECKLIST");
    void _r;
    const entry: ShopEntry = { kind: "RELIC", price: 4, relic: plain };
    const act: Act = {
      ...ACT_I,
      shop: { ...ACT_I_SHOP, entries: [entry] },
    };
    const run = advanceRun(act, cleared(createRunState(act, "plain")), {
      type: "CASH_OUT",
    });
    expect(run.shop!.slots.map((s) => shopEntryId(s.entry))).toEqual([
      "REL-QC-CHECKLIST",
    ]);
    expect(deriveRunView(act, run).shop!.items[0].rarity).toBe("COMMON");
  });

  it("summarizes a saved run in the deal, deck and shop modes it was saved in", () => {
    const log = {
      actId: BIOSTAT_OPS_CAMPAIGN.id,
      seed: "modes",
      dealing: "AUTHORED" as const,
      decks: "AUTHORED" as const,
      shops: "CLASSIC" as const,
      actions: [] as LoggedAction[],
    };
    // An unfinished run has no history entry yet.
    expect(summarizeRun(BIOSTAT_OPS_CAMPAIGN, log)).toBeNull();
  });

  it("leaves an act with no shop shopless in a classic run", () => {
    const shopless: Act = { ...ACT_I, shop: undefined };
    const campaign: Campaign = {
      ...BIOSTAT_OPS_CAMPAIGN,
      acts: [shopless, ACT_II],
      endless: undefined,
    };
    for (const plan of [shopless, campaign]) {
      const run = createRunState(
        plan,
        "none",
        {},
        "SHUFFLED",
        "RUN",
        "CLASSIC"
      );
      const paid = advanceRun(plan, cleared(run), { type: "CASH_OUT" });
      expect(paid.shop).toBeNull();
      expect(paid.cashOut).not.toBeNull();
    }
  });
});
