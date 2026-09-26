import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ACT_I,
  ACT_I_SHOP,
  ActSchema,
  CASH_OUT_BASE,
  CONSUMABLE_SLOTS,
  DMC_RELICS,
  ENROLLMENT_AFTER_HANDS,
  INTEREST_CAP,
  PopulationTransitionSchema,
  RELIC_RACK_FULL,
  RELIC_SLOTS,
  ShopCatalogSchema,
  applyTransition,
  advanceRun,
  cashOut,
  consumableSellValue,
  createRunState,
  deriveRunView,
  fitsRulebook,
  rerollPrice,
  runBlinds,
  sellValue,
  siteEnrollments,
  type Consumable,
  type RunAction,
  type RunState,
  type ShopEntry,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

/** Act I without its crisis deck, so these flows test the shop alone. */
const act = { ...ACT_I, crisisDeck: undefined };

const apply = (run: RunState, ...actions: RunAction[]) =>
  actions.reduce((r, a) => advanceRun(act, r, a), run);

/** Clears the current Blind with the median bot's line. */
function clearBlind(run: RunState): RunState {
  const blind = runBlinds(act, run)[run.blindIndex];
  const { actions } = playBlind(blind, run.table, "MEDIAN");
  let next = run;
  for (const action of actions) {
    if (next.table.status !== "REVIEWING") break;
    if (action.type === "RESET") continue;
    next = advanceRun(act, next, action);
  }
  expect(next.table.status).toBe("CLEARED");
  return next;
}

/** A cleared Small Blind, in the shop, with `budget` to spend. */
function inShop(seed = "fold-change", budget = 100): RunState {
  const cleared = clearBlind(createRunState(act, seed));
  const run = apply(cleared, { type: "CASH_OUT" });
  return { ...run, table: { ...run.table, budget } };
}

const lastMessage = (run: RunState) => run.table.lastEvent?.message;

describe("cash-out", () => {
  it("pays the tier base, a dollar per unspent hand of CPU and capped interest", () => {
    expect(cashOut("SMALL_BLIND", 0, 0).total).toBe(CASH_OUT_BASE.SMALL_BLIND);
    expect(cashOut("BIG_BLIND", 5, 12).lines).toEqual([
      expect.objectContaining({ id: "BASE", amount: 4 }),
      expect.objectContaining({ id: "CPU", amount: 2 }),
      expect.objectContaining({ id: "INTEREST", amount: 2 }),
    ]);
    expect(cashOut("BOSS_BLIND", 0, 1000).lines[2].amount).toBe(INTEREST_CAP);
    expect(cashOut("SMALL_BLIND", -4, -20).total).toBe(3);
  });

  it("is exact and never negative for any CPU and budget", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("SMALL_BLIND", "BIG_BLIND", "BOSS_BLIND" as const),
        fc.integer({ min: -10, max: 40 }),
        fc.integer({ min: -50, max: 500 }),
        (tier, cpu, budget) => {
          const report = cashOut(tier, cpu, budget);
          const sum = report.lines.reduce((s, l) => s + l.amount, 0);
          return (
            report.total === sum &&
            report.lines.every(
              (l) => Number.isInteger(l.amount) && l.amount >= 0
            )
          );
        }
      )
    );
  });

  it("is paid once, after the Blind clears, and opens the shop", () => {
    const fresh = createRunState(act);
    expect(lastMessage(apply(fresh, { type: "CASH_OUT" }))).toMatch(/^Clear /);
    const cleared = clearBlind(fresh);
    const view = deriveRunView(act, cleared);
    expect(view.phase).toBe("BLIND_CLEARED");
    const pending = view.pendingCashOut!;
    const paid = apply(cleared, { type: "CASH_OUT" });
    expect(paid.table.budget).toBe(cleared.table.budget + pending.total);
    expect(paid.cashOut).toEqual(pending);
    expect(deriveRunView(act, paid).phase).toBe("SHOP");
    expect(paid.shop?.slots).toHaveLength(2);
    expect(paid.shop?.packs).toHaveLength(2);
    expect(lastMessage(apply(paid, { type: "CASH_OUT" }))).toBe(
      "This Blind is already cashed out."
    );
  });

  it("is collected on the way out when the player skips the shop", () => {
    const cleared = clearBlind(createRunState(act));
    const pending = deriveRunView(act, cleared).pendingCashOut!;
    const next = apply(cleared, { type: "NEXT_BLIND" });
    expect(next.blindIndex).toBe(1);
    expect(next.table.budget).toBe(cleared.table.budget + pending.total);
    expect(next.shop).toBeNull();
    expect(next.cashOut).toBeNull();
  });
});

describe("shop catalog", () => {
  it("validates as data, and Act I validates with it", () => {
    expect(ShopCatalogSchema.safeParse(ACT_I_SHOP).success).toBe(true);
    expect(ActSchema.safeParse(ACT_I).success).toBe(true);
  });

  it("refuses a site that re-enrolls a subject already in the study", () => {
    const [site, ...rest] = ACT_I_SHOP.sites;
    const clash = {
      ...site,
      subjects: [{ ...site.subjects[0], id: "S-001" }],
    };
    expect(
      ActSchema.safeParse({
        ...ACT_I,
        shop: { ...ACT_I_SHOP, sites: [clash, ...rest] },
      }).success
    ).toBe(false);
  });

  it("prices consumables so selling returns half the price, rounded down", () => {
    for (const entry of ACT_I_SHOP.entries) {
      if (entry.kind === "RELIC") continue;
      const item = (
        entry.kind === "SEAL"
          ? { id: "x", kind: "SEAL", seal: entry.seal }
          : { id: "x", kind: "GUIDANCE", guidance: entry.guidance }
      ) as Consumable;
      expect(consumableSellValue(item)).toBe(sellValue(entry.price));
    }
  });

  it("never stocks a waiver seal the SAP has no rule for", () => {
    const rounding = ACT_I_SHOP.entries.find(
      (e): e is Extract<ShopEntry, { kind: "SEAL" }> =>
        e.kind === "SEAL" && e.seal.effect.kind === "WAIVE"
    )!;
    const [small, big] = ACT_I.blinds;
    const waives = (rb: typeof small.rulebook) =>
      rb.rules.some((r) => (r.waivableBy ?? []).includes(rounding.seal.id));
    expect(fitsRulebook(rounding, small.rulebook)).toBe(waives(small.rulebook));
    expect(fitsRulebook(rounding, big.rulebook)).toBe(waives(big.rulebook));
  });
});

describe("shop transactions", () => {
  it("escalates the reroll price and refuses a reroll it cannot pay for", () => {
    expect([0, 1, 2].map(rerollPrice)).toEqual([5, 6, 7]);
    let run = inShop("fold-change", 11);
    run = apply(run, { type: "REROLL" });
    expect(run.table.budget).toBe(6);
    expect(run.shop?.rerolls).toBe(1);
    run = apply(run, { type: "REROLL" });
    expect(run.table.budget).toBe(0);
    const broke = apply(run, { type: "REROLL" });
    expect(lastMessage(broke)).toBe("Reroll needs $7k; $0k left.");
    expect(broke.table.budget).toBe(0);
  });

  it("buys a relic whose modifier scores in the next hand", () => {
    // The first seed whose shop stocks a relic in a single slot.
    const run = [...Array(30).keys()]
      .map((i) => inShop(`relic-${i}`))
      .find((r) => r.shop!.slots.some((s) => s.entry.kind === "RELIC"))!;
    const slot = run.shop!.slots.findIndex((s) => s.entry.kind === "RELIC");
    expect(slot).not.toBe(-1);
    const entry = run.shop!.slots[slot].entry as Extract<
      ShopEntry,
      { kind: "RELIC" }
    >;
    const bought = apply(run, { type: "BUY", slot });
    expect(bought.table.budget).toBe(100 - entry.price);
    expect(bought.table.relics.map((r) => r.id)).toContain(entry.relic.id);
    expect(lastMessage(apply(bought, { type: "BUY", slot }))).toBe(
      "That slot is empty."
    );
    // The next Blind's first hand carries the relic's modifier.
    let next = apply(bought, { type: "NEXT_BLIND" });
    const blind = runBlinds(act, next)[next.blindIndex];
    const { actions } = playBlind(blind, next.table, "MEDIAN");
    for (const action of actions) {
      if (action.type === "RESET") continue;
      next = advanceRun(act, next, action);
      if (action.type === "PLAY_HAND" && next.table.handsPlayed > 0) break;
    }
    const evaluation = next.table.lastPlay!.evaluation;
    const { chips, plusMult } = entry.relic.modifier;
    expect(evaluation.chips.relics).toBeGreaterThanOrEqual(chips);
    expect(evaluation.mult.relics).toBeGreaterThanOrEqual(plusMult);
  });

  it("refuses a sixth relic in the domain, with a reason", () => {
    const run = inShop();
    const full = {
      ...run,
      table: {
        ...run.table,
        relics: ACT_I_SHOP.entries
          .filter((e) => e.kind === "RELIC")
          .map((e) => (e as Extract<ShopEntry, { kind: "RELIC" }>).relic)
          .slice(0, RELIC_SLOTS),
      },
    };
    expect(full.table.relics).toHaveLength(RELIC_SLOTS);
    const shop = {
      ...full.shop!,
      slots: [
        {
          entry: { kind: "RELIC" as const, price: 1, relic: DMC_RELICS[0] },
          sold: false,
        },
      ],
    };
    const refused = apply({ ...full, shop }, { type: "BUY", slot: 0 });
    expect(lastMessage(refused)).toBe(RELIC_RACK_FULL);
    expect(refused.table.relics).toHaveLength(RELIC_SLOTS);
    expect(refused.table.budget).toBe(full.table.budget);
    expect(deriveRunView(act, { ...full, shop }).shop?.items[0].refusal).toBe(
      RELIC_RACK_FULL
    );
  });

  it("refuses a purchase over budget and never lets the budget go negative", () => {
    const run = inShop("fold-change", 0);
    const refused = apply(run, { type: "BUY", slot: 0 });
    expect(lastMessage(refused)).toMatch(/costs \$\d+k; \$0k left\.$/);
    expect(refused.table.budget).toBe(0);
  });

  it("sells relics and consumables for half their price", () => {
    const run = inShop();
    const withRelic = {
      ...run,
      table: { ...run.table, relics: [DMC_RELICS[0]] },
    };
    const sold = apply(withRelic, {
      type: "SELL_RELIC",
      relicId: DMC_RELICS[0].id,
    });
    expect(sold.table.relics).toEqual([]);
    expect(sold.table.budget).toBe(103);
    const tray = run.table.consumables[0];
    if (tray) {
      const soldItem = apply(run, {
        type: "SELL_CONSUMABLE",
        consumableId: tray.id,
      });
      expect(soldItem.table.budget).toBe(100 + consumableSellValue(tray));
    }
    const playing = createRunState(act);
    expect(
      lastMessage(
        apply(
          { ...playing, table: { ...playing.table, relics: [DMC_RELICS[0]] } },
          { type: "SELL_RELIC", relicId: DMC_RELICS[0].id }
        )
      )
    ).toBe("Relics are sold between Blinds.");
  });
});

describe("booster packs", () => {
  /** A shop whose pack slots hold `kind`. */
  const withPack = (kind: string) => {
    const run = inShop();
    const pack = ACT_I_SHOP.packs.find((p) => p.kind === kind)!;
    return { ...run, shop: { ...run.shop!, packs: [{ pack, sold: false }] } };
  };

  it("opens to its size and keeps exactly choose K", () => {
    let run = apply(withPack("GUIDANCE"), { type: "BUY_PACK", slot: 0 });
    const opened = run.shop!.opened!;
    expect(opened.cards).toHaveLength(opened.pack.size);
    expect(run.table.budget).toBe(100 - opened.pack.price);
    expect(lastMessage(apply(run, { type: "BUY", slot: 0 }))).toBe(
      "Finish opening the pack first."
    );
    expect(lastMessage(apply(run, { type: "NEXT_BLIND" }))).toBe(
      "Keep a card from the pack or skip it first."
    );
    // Make room in the tray, then keep one.
    run = { ...run, table: { ...run.table, consumables: [] } };
    run = apply(run, { type: "PICK_PACK_CARD", cardId: opened.cards[0].id });
    expect(run.shop!.opened).toBeNull();
    expect(run.table.consumables).toHaveLength(opened.pack.choose);
  });

  it("forfeits the rest of a skipped pack", () => {
    let run = apply(withPack("RELIC"), { type: "BUY_PACK", slot: 0 });
    const relics = run.table.relics.length;
    run = apply(run, { type: "SKIP_PACK" });
    expect(run.shop!.opened).toBeNull();
    expect(run.table.relics).toHaveLength(relics);
    expect(lastMessage(apply(run, { type: "SKIP_PACK" }))).toBe(
      "No pack is open."
    );
  });

  it("refuses a pack card the tray has no room for", () => {
    let run = apply(withPack("GUIDANCE"), { type: "BUY_PACK", slot: 0 });
    const filler = run.table.consumables[0] ?? {
      id: "filler",
      kind: "GUIDANCE",
      guidance: (
        ACT_I_SHOP.entries.find((e) => e.kind === "GUIDANCE") as Extract<
          ShopEntry,
          { kind: "GUIDANCE" }
        >
      ).guidance,
    };
    run = {
      ...run,
      table: {
        ...run.table,
        consumables: Array.from({ length: CONSUMABLE_SLOTS }, (_, i) => ({
          ...filler,
          id: `filler-${i}`,
        })) as Consumable[],
      },
    };
    const card = run.shop!.opened!.cards[0];
    const refused = apply(run, { type: "PICK_PACK_CARD", cardId: card.id });
    expect(lastMessage(refused)).toMatch(/^The tray holds/);
    expect(deriveRunView(act, run).shop?.opened?.cards[0].refusal).toMatch(
      /^The tray holds/
    );
  });

  it("activates a site whose subjects enroll after the next Blind's first hand, staling exactly the dependent outputs", () => {
    let run = apply(withPack("SITE_ACTIVATION"), { type: "BUY_PACK", slot: 0 });
    const card = run.shop!.opened!.cards[0];
    expect(card.kind).toBe("SITE");
    const view = deriveRunView(act, run).shop!.opened!.cards[0];
    expect(view.warning).toMatch(/after the next Blind's first hand/);
    run = apply(run, { type: "PICK_PACK_CARD", cardId: card.id });
    const site = card.kind === "SITE" ? card.site : null;
    expect(run.table.sites.map((s) => s.id)).toEqual([site!.id]);
    expect(run.table.enrollments).toHaveLength(site!.subjects.length);
    for (const t of run.table.enrollments) {
      expect(PopulationTransitionSchema.safeParse(t).success).toBe(true);
    }

    run = apply(run, { type: "NEXT_BLIND" });
    const versions = run.table.snapshots.length;
    const invalidations = run.table.invalidations.length;
    // Nothing enrolls until the first hand is played.
    expect(run.table.enrollments).toHaveLength(site!.subjects.length);

    const blind = runBlinds(act, run)[run.blindIndex];
    const { actions } = playBlind(blind, run.table, "MEDIAN");
    let before = run;
    for (const action of actions) {
      if (action.type === "RESET") continue;
      before = run;
      run = advanceRun(act, run, action);
      if (run.table.handsPlayed === ENROLLMENT_AFTER_HANDS) break;
    }
    expect(run.table.enrollments).toEqual([]);
    const added = run.table.invalidations.slice(invalidations);
    const enrolled = added.filter((i) => i.reason === "SITE_ACTIVATION");
    expect(enrolled.map((i) => i.subjectId)).toEqual(
      site!.subjects.map((s) => s.id)
    );
    expect(run.table.snapshots.length).toBeGreaterThanOrEqual(
      versions + site!.subjects.length
    );
    const current = run.table.snapshots[run.table.snapshots.length - 1];
    for (const s of site!.subjects) {
      expect(current.subjects.some((x) => x.id === s.id)).toBe(true);
    }
    // Exactly the outputs left in hand on a changed population go stale.
    const played = new Set(before.table.selected);
    const held = before.table.hand.filter((id) => !played.has(id));
    for (const record of enrolled) {
      for (const id of record.staleCardIds) expect(held).toContain(id);
    }
    // The site's Chips join every hand's scoring.
    expect(run.table.lastPlay!.evaluation.chips.relics).toBeGreaterThanOrEqual(
      site!.modifier.chips
    );
  });

  it("enrolls through the snapshot module and refuses a duplicate", () => {
    const [site] = ACT_I_SHOP.sites;
    const snapshot = ACT_I.blinds[0].populationSnapshot;
    const [first] = siteEnrollments(site, "2026-03-01T09:00:00Z");
    const outcome = applyTransition(snapshot, first);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.snapshot.version).toBe(snapshot.version + 1);
    expect(outcome.snapshot.subjects).toHaveLength(
      snapshot.subjects.length + 1
    );
    expect(snapshot.subjects).toHaveLength(12);
    expect(applyTransition(outcome.snapshot, first).ok).toBe(false);
    expect(
      PopulationTransitionSchema.safeParse({ ...first, subject: undefined })
        .success
    ).toBe(false);
  });
});

describe("seeded replay", () => {
  const SHOP_MOVES: fc.Arbitrary<RunAction> = fc.oneof(
    fc.constant<RunAction>({ type: "REROLL" }),
    fc
      .integer({ min: 0, max: 1 })
      .map((slot): RunAction => ({ type: "BUY", slot })),
    fc
      .integer({ min: 0, max: 1 })
      .map((slot): RunAction => ({ type: "BUY_PACK", slot })),
    fc.constant<RunAction>({ type: "SKIP_PACK" }),
    fc
      .integer({ min: 0, max: 4 })
      .map((i): RunAction => ({ type: "PICK_PACK_CARD", cardId: `#${i}` }))
  );

  /** Resolves `#i` pack picks against the open pack, so moves are replayable. */
  const play = (start: RunState, moves: RunAction[]) =>
    moves.reduce((run, move) => {
      if (move.type === "PICK_PACK_CARD" && move.cardId.startsWith("#")) {
        const cards = run.shop?.opened?.cards ?? [];
        const card =
          cards[Number(move.cardId.slice(1)) % Math.max(1, cards.length)];
        return advanceRun(act, run, {
          type: "PICK_PACK_CARD",
          cardId: card?.id ?? "none",
        });
      }
      return advanceRun(act, run, move);
    }, start);

  const START: Record<string, RunState> = {};
  const startFor = (seed: string, budget: number) =>
    (START[`${seed}:${budget}`] ??= inShop(seed, budget));

  it("reproduces identical inventories, rerolls and packs, and never goes negative", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("fold-change", "alpha", "bravo"),
        fc.integer({ min: 0, max: 40 }),
        fc.array(SHOP_MOVES, { maxLength: 12 }),
        (seed, budget, moves) => {
          const start = startFor(seed, budget);
          const a = play(start, moves);
          const b = play(start, moves);
          expect(JSON.parse(JSON.stringify(a))).toEqual(b);
          expect(a.table.budget).toBeGreaterThanOrEqual(0);
          expect(a.table.relics.length).toBeLessThanOrEqual(RELIC_SLOTS);
          expect(a.table.consumables.length).toBeLessThanOrEqual(
            CONSUMABLE_SLOTS
          );
        }
      ),
      { numRuns: 60 }
    );
  });

  it("keeps the run's crisis draws independent of shopping", () => {
    const withCrises = ACT_I;
    const cleared = (() => {
      let run = createRunState(withCrises, "alpha");
      const blind = runBlinds(withCrises, run)[0];
      for (const action of playBlind(blind, run.table, "MEDIAN").actions) {
        if (run.table.status !== "REVIEWING") break;
        if (action.type === "RESET") continue;
        run = advanceRun(withCrises, run, action);
      }
      return run;
    })();
    const skip = advanceRun(withCrises, cleared, { type: "NEXT_BLIND" });
    const shopped = [
      { type: "CASH_OUT" },
      { type: "REROLL" },
      { type: "NEXT_BLIND" },
    ].reduce((r, a) => advanceRun(withCrises, r, a as RunAction), {
      ...cleared,
      table: { ...cleared.table, budget: 50 },
    });
    expect(shopped.draws).toEqual(skip.draws);
    expect(shopped.table.crisis?.id).toBe(skip.table.crisis?.id);
  });
});

describe("shop refusals", () => {
  it("refuses every shop action before the Blind is cashed out", () => {
    const fresh = createRunState(act, "closed");
    const blind = runBlinds(act, fresh)[0].blind.name;
    const refusals: [RunAction, string][] = [
      [{ type: "CASH_OUT" }, `Clear ${blind} first.`],
      [{ type: "REROLL" }, "The shop is closed."],
      [{ type: "BUY", slot: 0 }, "The shop is closed."],
      [{ type: "BUY_PACK", slot: 0 }, "The shop is closed."],
      [{ type: "PICK_PACK_CARD", cardId: "x" }, "No pack is open."],
      [{ type: "SELL_RELIC", relicId: "x" }, "Relics are sold between Blinds."],
    ];
    for (const [action, message] of refusals) {
      const next = advanceRun(act, fresh, action);
      expect(next.table.budget).toBe(fresh.table.budget);
      expect(lastMessage(next)).toBe(message);
    }
  });

  it("refuses a second cash-out, unknown items and a busy shop", () => {
    const run = inShop();
    expect(lastMessage(apply(run, { type: "CASH_OUT" }))).toBe(
      "This Blind is already cashed out."
    );
    expect(lastMessage(apply(run, { type: "BUY_PACK", slot: 9 }))).toBe(
      "That pack slot is empty."
    );
    expect(
      lastMessage(apply(run, { type: "SELL_RELIC", relicId: "nope" }))
    ).toBe("That relic is not in your rack.");
    expect(
      lastMessage(apply(run, { type: "SELL_CONSUMABLE", consumableId: "nope" }))
    ).toBe("That consumable is not in your tray.");

    const pack = ACT_I_SHOP.packs.find((p) => p.kind === "RELIC")!;
    const opened = apply(
      { ...run, shop: { ...run.shop!, packs: [{ pack, sold: false }] } },
      { type: "BUY_PACK", slot: 0 }
    );
    const view = deriveRunView(act, opened).shop!;
    expect(view.rerollRefusal).toBe("Finish opening the pack first.");
    for (const action of [
      { type: "REROLL" },
      { type: "BUY_PACK", slot: 0 },
    ] as RunAction[]) {
      expect(lastMessage(apply(opened, action))).toBe(
        "Finish opening the pack first."
      );
    }
    expect(
      lastMessage(apply(opened, { type: "PICK_PACK_CARD", cardId: "nope" }))
    ).toBe("That card is not in the pack.");
    // Skipped, the bought pack's slot reads as empty.
    const skipped = apply(opened, { type: "SKIP_PACK" });
    expect(lastMessage(apply(skipped, { type: "BUY_PACK", slot: 0 }))).toBe(
      "That pack slot is empty."
    );
  });

  it("refuses an enrollment without its subject or into no population", () => {
    const [site] = ACT_I_SHOP.sites;
    const snapshot = ACT_I.blinds[0].populationSnapshot;
    const [first] = siteEnrollments(site, "2026-03-01T09:00:00Z");
    expect(applyTransition(snapshot, { ...first, subject: undefined }).ok).toBe(
      false
    );
    expect(
      applyTransition(snapshot, {
        ...first,
        subject: { ...first.subject!, id: "S-999" },
      }).ok
    ).toBe(false);
    expect(
      applyTransition(snapshot, {
        ...first,
        subject: { ...first.subject!, populations: [] },
      }).ok
    ).toBe(false);
  });

  it("rejects mismatched subjects and duplicate catalog ids as data", () => {
    const [site] = ACT_I_SHOP.sites;
    const [first] = siteEnrollments(site, "2026-03-01T09:00:00Z");
    expect(
      PopulationTransitionSchema.safeParse({
        ...first,
        subject: { ...first.subject!, id: "S-999" },
      }).success
    ).toBe(false);
    expect(
      PopulationTransitionSchema.safeParse({
        ...first,
        change: "JOIN",
      }).success
    ).toBe(false);
    const dupes = {
      ...ACT_I_SHOP,
      entries: [...ACT_I_SHOP.entries, ACT_I_SHOP.entries[0]],
      packs: [...ACT_I_SHOP.packs, ACT_I_SHOP.packs[0]],
      sites: [...ACT_I_SHOP.sites, ACT_I_SHOP.sites[0]],
    };
    const issues = ShopCatalogSchema.safeParse(dupes).error?.issues ?? [];
    expect(issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^Duplicate id /),
        "Each site enrolls its own subjects",
      ])
    );
  });
});
