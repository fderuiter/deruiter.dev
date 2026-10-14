// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ACT_I,
  ACT_I_SHOP,
  ARCHIVE_PRICE,
  BIOSTAT_OPS_CAMPAIGN,
  DEMOGRAPHICS_SCENARIO,
  DMC_MILESTONE_SCENARIO,
  DUPLICATE_PRICE,
  EMPTY_RUN_DECK,
  FDA_IR_SCENARIO,
  RUN_SAVE_VERSION,
  RunSaveSchema,
  SPONSOR_SAFETY_SCENARIO,
  ShopCatalogSchema,
  advanceRun,
  createRunState,
  dealSeed,
  dealtDeck,
  dealtScenario,
  deriveRunView,
  parseRunSave,
  protectedCardIds,
  replayRun,
  serializeRun,
  shellCard,
  shuffledDeckOrder,
  shopEntryId,
  sponsorById,
  sponsorCardChips,
  type LoggedAction,
  type RunAction,
  type RunDeck,
  type RunPlan,
  type RunState,
  type ShellEntry,
} from "@/lib/trial-and-error";

/**
 * The run deck (#2082): shells bought in the shop join a deck carried from
 * Blind to Blind and act to act, and the Archive and Duplicate services
 * change what the next Blind deals.
 */

const C = BIOSTAT_OPS_CAMPAIGN;
const SAVED_AT = new Date("2026-10-14T00:00:00Z");

const SHELLS = ACT_I_SHOP.entries.filter(
  (e): e is ShellEntry => e.kind === "SHELL"
);
const shell = (id: string) =>
  SHELLS.find((e) => e.shell.id === id) as ShellEntry;
const OVERVIEW = shell("T-14.3.1-LIB");
const DEMOGRAPHICS = shell("T-14.1.3-LIB");

/** A run whose current Blind is marked cleared, without playing it. */
const cleared = (run: RunState): RunState => ({
  ...run,
  table: { ...run.table, status: "CLEARED", rewardClaimed: "claimed" },
});

/** Applies moves, recording them as a save would. */
function play(plan: RunPlan, run: RunState, actions: RunAction[]): RunState {
  return actions.reduce((r, a) => advanceRun(plan, r, a), run);
}

/** The current Blind cleared and cashed out, with `budget` to spend. */
function inShop(plan: RunPlan, run: RunState, budget = 50): RunState {
  const paid = advanceRun(plan, cleared(run), { type: "CASH_OUT" });
  expect(paid.shop).not.toBeNull();
  return { ...paid, table: { ...paid.table, budget } };
}

/** A shop whose first slot sells `entry`. */
function stocked(run: RunState, entry: ShellEntry): RunState {
  const shop = run.shop!;
  return {
    ...run,
    shop: { ...shop, slots: [{ entry, sold: false }, ...shop.slots.slice(1)] },
  };
}

const lastMessage = (run: RunState) => run.table.lastEvent?.message ?? "";
const dealtIds = (plan: RunPlan, run: RunState) =>
  deriveRunView(plan, run).blind.deck.map((c) => c.id);

describe("shop shells", () => {
  it("stocks five blank Table shells with layouts, each with its own id", () => {
    expect(SHELLS).toHaveLength(5);
    for (const entry of SHELLS) {
      expect(entry.shell.cardType).toBe("TABLE");
      expect(entry.shell.layout).toBeDefined();
      expect(entry.shell.id).toMatch(/-LIB$/);
      expect(shopEntryId(entry)).toBe(entry.shell.id);
    }
    expect(ShopCatalogSchema.safeParse(ACT_I_SHOP).success).toBe(true);
  });

  it("refuses a shop shell without a layout, or one that is not a Table", () => {
    const bare = {
      ...OVERVIEW,
      shell: { ...OVERVIEW.shell, layout: undefined },
    };
    const listing = {
      ...OVERVIEW,
      shell: { ...OVERVIEW.shell, cardType: "LISTING" as const },
    };
    for (const entry of [bare, listing]) {
      expect(
        ShopCatalogSchema.safeParse({ ...ACT_I_SHOP, entries: [entry] }).success
      ).toBe(false);
    }
  });

  it("deals a shell as a blank Table card with the entry's hand fields", () => {
    const soc = shell("T-14.3.2.1-LIB");
    expect(shellCard(soc, "X")).toEqual({
      id: "X",
      cardType: "TABLE",
      number: "Table 14.3.2.1",
      title: "AEs by SOC: Cardiac",
      population: "SAFETY",
      chips: 25,
      mult: 1,
      topic: "AE",
      csrStage: "SAFETY_AE",
      soc: "Cardiac disorders",
      shellId: "T-14.3.2.1-LIB",
    });
    const bare = { ...OVERVIEW, card: { title: "Bare", topic: "AE" } };
    expect(shellCard(bare, "Y")).not.toHaveProperty("csrStage");
    expect(shellCard(bare, "Y")).not.toHaveProperty("soc");
  });

  it("stocks shells through the seeded shop stream on some seeds", () => {
    const stockedShell = Array.from({ length: 40 }, (_, i) => `shells-${i}`)
      .map((seed) => inShop(C, createRunState(C, seed)))
      .some((run) => run.shop!.slots.some((s) => s.entry.kind === "SHELL"));
    expect(stockedShell).toBe(true);
  });

  it("never stocks a shell for a run that deals its authored decks", () => {
    for (let i = 0; i < 40; i++) {
      const run = createRunState(C, `shells-${i}`, {}, "SHUFFLED", "AUTHORED");
      const shop = inShop(C, run);
      expect(shop.shop!.slots.every((s) => s.entry.kind !== "SHELL")).toBe(
        true
      );
      expect(
        play(C, shop, [{ type: "REROLL" }]).shop!.slots.every(
          (s) => s.entry.kind !== "SHELL"
        )
      ).toBe(true);
    }
  });
});

describe("buying a shell", () => {
  it("adds it to the run deck, not the tray, and the next Blind deals it", () => {
    const shop = stocked(inShop(C, createRunState(C, "alpha")), OVERVIEW);
    const bought = play(C, shop, [{ type: "BUY", slot: 0 }]);
    const id = "T-14.3.1-LIB@shop-0-0";
    expect(bought.deck?.added).toEqual([
      { id, kind: "SHELL", entry: OVERVIEW },
    ]);
    expect(bought.table.consumables).toEqual(shop.table.consumables);
    expect(bought.table.budget).toBe(50 - OVERVIEW.price);
    expect(bought.shop!.slots[0].sold).toBe(true);
    expect(lastMessage(bought)).toContain("joins your deck");
    // The cleared table keeps the cards it was dealt.
    expect(dealtIds(C, bought)).not.toContain(id);
    const view = deriveRunView(C, bought);
    expect(view.deck.blindName).toBe(SPONSOR_SAFETY_SCENARIO.blind.name);
    expect(view.deck.cards.find((c) => c.id === id)?.origin).toBe("BOUGHT");
    expect(view.deck.size).toBe(SPONSOR_SAFETY_SCENARIO.deck.length + 1);
    expect(view.deck.added).toBe(1);
    const next = play(C, bought, [{ type: "NEXT_BLIND" }]);
    expect(dealtIds(C, next)).toContain(id);
    expect(next.dealtDeck).toEqual(next.deck);
    expect(deriveRunView(C, next).blind.shells.map((s) => s.id)).toContain(
      OVERVIEW.shell.id
    );
  });

  it("carries a shell bought in Act I into Act II, where it can be drawn", () => {
    let run = stocked(inShop(C, createRunState(C, "carry")), OVERVIEW);
    run = play(C, run, [{ type: "BUY", slot: 0 }, { type: "NEXT_BLIND" }]);
    while (run.actIndex < 1) {
      run = advanceRun(C, cleared(run), { type: "NEXT_BLIND" });
    }
    const id = "T-14.3.1-LIB@shop-0-0";
    const view = deriveRunView(C, run);
    expect(view.act.index).toBe(1);
    const index = view.blind.deck.findIndex((c) => c.id === id);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(run.table.deckOrder).toContain(index);
    // Discarding through the deck draws it, and it compiles clean.
    let table = run;
    for (let i = 0; i < 6 && !table.table.hand.includes(id); i++) {
      const selection = table.table.hand
        .filter((c) => !deriveRunView(C, table).blind.pinned?.includes(c))
        .slice(0, 3)
        .map((cardId): RunAction => ({ type: "TOGGLE_SELECT", cardId }));
      table = play(C, table, [...selection, { type: "DISCARD" }]);
    }
    expect(table.table.hand).toContain(id);
    const allocated = advanceRun(C, table, {
      type: "ALLOCATE",
      cardId: id,
      population: "SAFETY",
    });
    expect(allocated.table.allocations[id]).toBe("SAFETY");
  });

  it("adds the sponsor's card Chips to a shell, as to any card", () => {
    const sponsorId = "CARDIO_MEGA_TRIAL";
    const bonus = sponsorCardChips(
      sponsorById(sponsorId),
      shellCard(OVERVIEW, "x")
    );
    let run = createRunState(C, "sponsored", { sponsorId });
    run = stocked(inShop(C, run), OVERVIEW);
    run = play(C, run, [{ type: "BUY", slot: 0 }, { type: "NEXT_BLIND" }]);
    const card = deriveRunView(C, run).blind.deck.find((c) =>
      c.id.startsWith("T-14.3.1-LIB@")
    );
    expect(bonus).toBe(10);
    expect(card?.chips).toBe(OVERVIEW.shell.chips + bonus);
  });
});

describe("Archive and Duplicate", () => {
  const archivable = (run: RunState) => {
    const view = deriveRunView(C, run);
    return view.deck.cards.find(
      (c) => !c.locked && view.shop!.archive.cardRefusals[c.id] === undefined
    )!;
  };

  it("archives a card: the next Blind does not deal it, and nor do later ones", () => {
    const shop = inShop(C, createRunState(C, "archive"));
    const target = archivable(shop);
    const archived = play(C, shop, [
      { type: "ARCHIVE_CARD", cardId: target.id },
    ]);
    expect(archived.deck?.archived).toEqual([target.id]);
    expect(archived.table.budget).toBe(50 - ARCHIVE_PRICE);
    expect(archived.shop?.archived).toBe(true);
    expect(lastMessage(archived)).toContain(`Archived ${target.number}`);
    const view = deriveRunView(C, archived);
    expect(view.deck.cards.map((c) => c.id)).not.toContain(target.id);
    expect(view.deck.archived).toBe(1);
    expect(view.shop!.archive.used).toBe(true);
    expect(view.shop!.archive.refusal).toBe(
      "Archive serves once per shop visit."
    );
    const next = play(C, archived, [{ type: "NEXT_BLIND" }]);
    expect(dealtIds(C, next)).not.toContain(target.id);
    // The deal changed: the same seed without the archive deals differently.
    const plain = play(C, shop, [{ type: "NEXT_BLIND" }]);
    expect(next.table.deckOrder).not.toEqual(plain.table.deckOrder);
  });

  it("archives an added card by taking it out of the deck", () => {
    let run = stocked(inShop(C, createRunState(C, "archive-own")), OVERVIEW);
    run = play(C, run, [{ type: "BUY", slot: 0 }]);
    const id = run.deck!.added[0].id;
    run = play(C, run, [{ type: "ARCHIVE_CARD", cardId: id }]);
    expect(run.deck).toEqual({ added: [], archived: [] });
    // An emptied deck is not carried.
    const next = play(C, run, [{ type: "NEXT_BLIND" }]);
    expect(next.deck).toBeUndefined();
    expect(next.dealtDeck).toBeUndefined();
  });

  it("duplicates an authored card: the copy is dealt beside the original", () => {
    const shop = inShop(C, createRunState(C, "duplicate"));
    const target = deriveRunView(C, shop).deck.cards[0];
    const copied = play(C, shop, [
      { type: "DUPLICATE_CARD", cardId: target.id },
    ]);
    const copyId = `${target.id}@copy-0`;
    expect(copied.deck?.added).toEqual([
      { id: copyId, kind: "COPY", cardId: target.id },
    ]);
    expect(copied.table.budget).toBe(50 - DUPLICATE_PRICE);
    expect(copied.shop?.duplicated).toBe(true);
    expect(lastMessage(copied)).toContain(`Duplicated ${target.number}`);
    const next = play(C, copied, [{ type: "NEXT_BLIND" }]);
    const deck = deriveRunView(C, next).blind.deck;
    const copy = deck.find((c) => c.id === copyId);
    const original = deck.find((c) => c.id === target.id);
    expect(copy).toEqual({ ...original, id: copyId });
    expect(
      deriveRunView(C, next).deck.cards.find((c) => c.id === copyId)?.origin
    ).toBe("COPY");
  });

  it("duplicates a bought shell as another shell, and a copy as the original", () => {
    let run = stocked(inShop(C, createRunState(C, "dup-shell")), DEMOGRAPHICS);
    run = play(C, run, [{ type: "BUY", slot: 0 }]);
    const id = run.deck!.added[0].id;
    run = play(C, run, [{ type: "DUPLICATE_CARD", cardId: id }]);
    expect(run.deck!.added[1]).toEqual({
      id: "T-14.1.3-LIB@copy-0",
      kind: "SHELL",
      entry: DEMOGRAPHICS,
    });
    // Next visit: a copy of a copy names the authored original.
    run = play(C, run, [{ type: "NEXT_BLIND" }]);
    const shop = inShop(C, run);
    const authored = deriveRunView(C, shop).deck.cards.find(
      (c) => c.origin === "AUTHORED"
    )!;
    let copied = play(C, shop, [
      { type: "DUPLICATE_CARD", cardId: authored.id },
    ]);
    copied = { ...copied, shop: { ...copied.shop!, duplicated: undefined } };
    copied = play(C, copied, [
      { type: "DUPLICATE_CARD", cardId: `${authored.id}@copy-1` },
    ]);
    expect(copied.deck!.added.slice(-1)[0]).toEqual({
      id: `${authored.id}@copy-1`,
      kind: "COPY",
      cardId: authored.id,
    });
  });

  it("refuses with a reason, changing nothing but the message", () => {
    const shop = inShop(C, createRunState(C, "refuse"));
    const view = deriveRunView(C, shop);
    const card = view.deck.cards[0].id;
    const cases: [RunState, RunAction, string][] = [
      [
        cleared(createRunState(C, "refuse")),
        { type: "ARCHIVE_CARD", cardId: card },
        "The shop is closed.",
      ],
      [
        { ...shop, table: { ...shop.table, budget: 1 } },
        { type: "ARCHIVE_CARD", cardId: card },
        `Archive costs $${ARCHIVE_PRICE}k; $1k left.`,
      ],
      [
        { ...shop, table: { ...shop.table, budget: 1 } },
        { type: "DUPLICATE_CARD", cardId: card },
        `Duplicate costs $${DUPLICATE_PRICE}k; $1k left.`,
      ],
      [
        shop,
        { type: "ARCHIVE_CARD", cardId: "nope" },
        "That card is not in your deck.",
      ],
      [
        shop,
        { type: "DUPLICATE_CARD", cardId: "nope" },
        "That card is not in your deck.",
      ],
      [
        { ...shop, decks: "AUTHORED" },
        { type: "DUPLICATE_CARD", cardId: card },
        "This run was saved before the run deck: every Blind deals its authored deck.",
      ],
      [
        { ...shop, shop: { ...shop.shop!, duplicated: true } },
        { type: "DUPLICATE_CARD", cardId: card },
        "Duplicate serves once per shop visit.",
      ],
    ];
    for (const [run, action, message] of cases) {
      const next = advanceRun(C, run, action);
      expect(lastMessage(next)).toBe(message);
      expect(next.table.lastEvent?.kind).toBe("REFUSED");
      expect(next.deck).toEqual(run.deck);
      expect(next.table.budget).toBe(run.table.budget);
    }
  });

  it("refuses while a pack is open", () => {
    const shop = inShop(C, createRunState(C, "pack-open"));
    const opened = play(C, shop, [{ type: "BUY_PACK", slot: 0 }]);
    expect(opened.shop?.opened).not.toBeNull();
    const view = deriveRunView(C, opened);
    expect(view.shop!.archive.refusal).toBe("Finish opening the pack first.");
    expect(view.shop!.duplicate.refusal).toBe("Finish opening the pack first.");
  });

  it("never archives a Blind's scripted setup, nor below a full opening hand", () => {
    // Act I's Small Blind pins its setup; reach its shop from a restart.
    const plan: RunPlan = {
      ...ACT_I,
      crisisDeck: undefined,
      bossPool: undefined,
    };
    const small = inShop(plan, createRunState(plan, "pinned"));
    // The next Blind is the Big Blind, which pins nothing: every card goes
    // until the deck reaches a full hand.
    let run = small;
    const handSize = SPONSOR_SAFETY_SCENARIO.table.handSize;
    for (let i = 0; i < SPONSOR_SAFETY_SCENARIO.deck.length - handSize; i++) {
      const card = deriveRunView(plan, run).deck.cards[0].id;
      run = play(plan, run, [{ type: "ARCHIVE_CARD", cardId: card }]);
      run = { ...run, shop: { ...run.shop!, archived: undefined } };
    }
    const view = deriveRunView(plan, run);
    expect(view.deck.size).toBe(handSize);
    const last = view.deck.cards[0].id;
    expect(view.shop!.archive.cardRefusals[last]).toBe(
      `The deck cannot drop below ${handSize} cards, a full opening hand.`
    );
    // A Blind with a pinned setup refuses to archive it.
    const pinned = DEMOGRAPHICS_SCENARIO.pinned![0];
    const intoSmall: RunPlan = {
      ...ACT_I,
      blinds: [SPONSOR_SAFETY_SCENARIO, DEMOGRAPHICS_SCENARIO],
      crisisDeck: undefined,
      bossPool: undefined,
    };
    const shop = inShop(intoSmall, createRunState(intoSmall, "pinned"));
    expect(
      advanceRun(intoSmall, shop, { type: "ARCHIVE_CARD", cardId: pinned })
        .table.lastEvent?.message
    ).toContain("scripted setup: it is always dealt.");
    expect(
      deriveRunView(intoSmall, shop).deck.cards.find((c) => c.id === pinned)
        ?.locked
    ).toBe(true);
  });
});

describe("dealtDeck", () => {
  const deck = (changes: Partial<RunDeck>): RunDeck => ({
    ...EMPTY_RUN_DECK,
    ...changes,
  });

  it("gives a Blind back unchanged for an empty or absent deck", () => {
    expect(dealtScenario(SPONSOR_SAFETY_SCENARIO, undefined)).toBe(
      SPONSOR_SAFETY_SCENARIO
    );
    expect(dealtScenario(SPONSOR_SAFETY_SCENARIO, EMPTY_RUN_DECK)).toBe(
      SPONSOR_SAFETY_SCENARIO
    );
  });

  it("protects pinned cards, KM parents and the FDA's questions", () => {
    const fda = protectedCardIds(FDA_IR_SCENARIO);
    for (const q of FDA_IR_SCENARIO.encounter.questions) {
      expect(fda.has(q.cardId)).toBe(true);
    }
    const dmc = protectedCardIds(DMC_MILESTONE_SCENARIO);
    for (const card of DMC_MILESTONE_SCENARIO.deck) {
      if (card.km) expect(dmc.has(card.km.parent.cardId)).toBe(true);
    }
    // Archiving every DMC card leaves its wholly pinned deck intact.
    const all = deck({
      archived: DMC_MILESTONE_SCENARIO.deck.map((c) => c.id),
    });
    expect(dealtDeck(DMC_MILESTONE_SCENARIO, all)).toEqual(
      DMC_MILESTONE_SCENARIO.deck
    );
  });

  it("brings archived cards back, in deck order, to fill an opening hand", () => {
    const all = deck({
      archived: SPONSOR_SAFETY_SCENARIO.deck.map((c) => c.id),
    });
    const dealt = dealtDeck(SPONSOR_SAFETY_SCENARIO, all);
    expect(dealt).toEqual(
      SPONSOR_SAFETY_SCENARIO.deck.slice(
        0,
        SPONSOR_SAFETY_SCENARIO.table.handSize
      )
    );
  });

  it("skips a copy whose original the Blind does not hold", () => {
    const copy = deck({
      added: [{ id: "elsewhere@copy-0", kind: "COPY", cardId: "C-NOT-HERE" }],
    });
    expect(dealtDeck(SPONSOR_SAFETY_SCENARIO, copy)).toEqual(
      SPONSOR_SAFETY_SCENARIO.deck
    );
  });

  it("keeps a Blind's own shell when a bought one shares its id", () => {
    const own = DEMOGRAPHICS_SCENARIO.shells.find((s) => s.id === "T-14.1.3")!;
    const clash: ShellEntry = {
      ...DEMOGRAPHICS,
      shell: { ...DEMOGRAPHICS.shell, id: "T-14.1.3", chips: 99 },
    };
    const dealt = dealtScenario(
      DEMOGRAPHICS_SCENARIO,
      deck({ added: [{ id: "c", kind: "SHELL", entry: clash }] })
    );
    expect(dealt.shells.filter((s) => s.id === "T-14.1.3")).toEqual([own]);
  });

  it("shuffles the dealt deck on the Blind's own stream, pinned cards first", () => {
    const changes = deck({
      added: [{ id: "a", kind: "SHELL", entry: OVERVIEW }],
    });
    const dealt = dealtScenario(DEMOGRAPHICS_SCENARIO, changes);
    const order = shuffledDeckOrder(dealt, dealSeed("s", 0, 0));
    expect(
      order
        .slice(0, DEMOGRAPHICS_SCENARIO.pinned!.length)
        .map((i) => dealt.deck[i].id)
    ).toEqual(
      DEMOGRAPHICS_SCENARIO.deck
        .filter((c) => DEMOGRAPHICS_SCENARIO.pinned!.includes(c.id))
        .map((c) => c.id)
    );
    expect([...order].sort((a, b) => a - b)).toEqual(
      dealt.deck.map((_, i) => i)
    );
  });
});

describe("replay and saves (#2082)", () => {
  /** A run that buys a shell, archives and duplicates, then plays on. */
  function shoppingRun(seed: string): {
    run: RunState;
    actions: LoggedAction[];
  } {
    const actions: LoggedAction[] = [];
    let run = createRunState(C, seed);
    const act = (a: LoggedAction) => {
      actions.push(a);
      run = advanceRun(C, run, a);
    };
    // Clear the first Blind the way a save cannot: mark it, then log from
    // the shop on, so the replay starts from the same marked state.
    run = { ...cleared(run), table: { ...cleared(run).table, budget: 40 } };
    const start = run;
    act({ type: "CASH_OUT" });
    const shellSlot = run.shop!.slots.findIndex(
      (s) => s.entry.kind === "SHELL"
    );
    if (shellSlot >= 0) act({ type: "BUY", slot: shellSlot });
    const view = deriveRunView(C, run);
    const target = view.deck.cards.find(
      (c) => view.shop!.archive.cardRefusals[c.id] === undefined
    )!;
    act({ type: "ARCHIVE_CARD", cardId: target.id });
    act({
      type: "DUPLICATE_CARD",
      cardId: deriveRunView(C, run).deck.cards[0].id,
    });
    act({ type: "NEXT_BLIND" });
    return {
      run: actions.reduce((r, a) => advanceRun(C, r, a), start),
      actions,
    };
  }

  it("replays the same seed and purchases exactly", () => {
    for (const seed of ["alpha", "beta", "2026-10-14"]) {
      const a = shoppingRun(seed);
      const b = shoppingRun(seed);
      expect(a.run).toEqual(b.run);
      expect(a.run.table.deckOrder).toEqual(b.run.table.deckOrder);
    }
  });

  it("writes the current version, and records an authored-deck run's mode", () => {
    expect(RUN_SAVE_VERSION).toBe(4);
    const json = serializeRun(
      { actId: C.id, seed: "alpha", decks: "AUTHORED", actions: [] },
      SAVED_AT
    );
    expect(RunSaveSchema.parse(JSON.parse(json))).toMatchObject({
      version: 4,
      decks: "AUTHORED",
    });
    expect(
      JSON.parse(
        serializeRun({ actId: C.id, seed: "a", actions: [] }, SAVED_AT)
      ).decks
    ).toBeUndefined();
  });

  it("round-trips a run with a run deck through a save", () => {
    const actions: LoggedAction[] = [
      {
        type: "TOGGLE_SELECT",
        cardId: createRunState(C, "save").table.hand[0],
      },
    ];
    const log = { actId: C.id, seed: "save", actions };
    const restored = parseRunSave(serializeRun(log, SAVED_AT), [C]);
    expect(restored?.run).toEqual(
      replayRun(C, { ...log, actions: [...actions, ...actions] })
    );
    expect(restored?.run.decks).toBeUndefined();
  });

  it("loads a v2 save with its authored decks, replaying it as it was", () => {
    const v2 = JSON.stringify({
      version: 2,
      actId: C.id,
      savedAt: SAVED_AT.toISOString(),
      seed: "legacy",
      actions: [{ type: "DISCARD" }],
    });
    const restored = parseRunSave(v2, [C]);
    expect(restored?.log.decks).toBe("AUTHORED");
    expect(restored?.run.decks).toBe("AUTHORED");
    expect(restored?.run).toEqual(
      replayRun(C, {
        actId: C.id,
        seed: "legacy",
        decks: "AUTHORED",
        shops: "CLASSIC",
        actions: [{ type: "DISCARD" }],
      })
    );
    const again = parseRunSave(serializeRun(restored!.log, SAVED_AT), [C]);
    expect(again?.run).toEqual(restored?.run);
  });

  it("migrates a v1 save through v2 to v3", () => {
    const v1 = JSON.stringify({
      version: 1,
      actId: C.id,
      savedAt: SAVED_AT.toISOString(),
      seed: "older",
      actions: [],
    });
    const restored = parseRunSave(v1, [C]);
    expect(restored?.log).toMatchObject({
      dealing: "AUTHORED",
      decks: "AUTHORED",
    });
  });

  it("restarts an authored-deck run with a run deck", () => {
    const old = createRunState(C, "restart", {}, "SHUFFLED", "AUTHORED");
    const restarted = advanceRun(C, old, { type: "RESTART_RUN" });
    expect(restarted.decks).toBeUndefined();
  });
});
