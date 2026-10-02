// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ACT_I,
  ACT_I_SHOP,
  AMENDMENT_STALE_ALERT,
  DEMOGRAPHICS_SCENARIO,
  RunActionSchema,
  SAP_AMENDMENTS,
  SapAmendmentSchema,
  STALE_ALERT,
  activeRulebook,
  advanceRun,
  advanceTable,
  amendRulebook,
  amendedRule,
  carriedInventory,
  consumableName,
  consumableSellValue,
  createRunState,
  createTableState,
  deriveRunView,
  deriveTableView,
  fitsRulebook,
  runBlinds,
  shopEntryId,
  type Consumable,
  type Inventory,
  type RunAction,
  type RunState,
  type SapAmendment,
  type Scenario,
  type ShopEntry,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

const scenario = DEMOGRAPHICS_SCENARIO;
const ROUNDING = SAP_AMENDMENTS.ROUNDING;
const PRECISION = SAP_AMENDMENTS.PRECISION;
const DRAFT_A = "C-T14.1.1-A";
const DRAFTS = [DRAFT_A, "C-T14.1.1-B", "C-T14.1.1-C"];

const amendment = (a: SapAmendment, id = a.code): Consumable => ({
  id,
  kind: "AMENDMENT",
  amendment: a,
});
const withTray = (...consumables: Consumable[]): TableState =>
  createTableState(scenario, undefined, { consumables, budget: 0 });
const run = (
  actions: TableAction[],
  from: TableState,
  s: Scenario = scenario
): TableState => actions.reduce((state, a) => advanceTable(s, state, a), from);
const use = (consumableId: string): TableAction => ({
  type: "USE_AMENDMENT",
  consumableId,
});

/** Inspect Draft A and correct every finding on it. */
function fixDraftA(state: TableState): TableState {
  let next = run([{ type: "INSPECT_CARD", cardId: DRAFT_A }], state);
  const draft = scenario.drawPile[0];
  for (let row = 0; row < draft.rows.length; row++) {
    for (let col = 0; col < draft.columns.length; col++) {
      next = run([{ type: "INSPECT_CELL", row, col }], next);
    }
  }
  for (const finding of deriveTableView(scenario, next).inspection!
    .openFindings) {
    next = run([{ type: "CORRECT_FINDING", findingId: finding.id }], next);
  }
  return run([{ type: "CLOSE_INSPECT" }], next);
}

describe("SAP Amendments as data", () => {
  it("catalogs valid amendments the Act I shop stocks at twice their sell value", () => {
    for (const a of Object.values(SAP_AMENDMENTS)) {
      expect(SapAmendmentSchema.parse(a)).toEqual(a);
      const entry = ACT_I_SHOP.entries.find(
        (e) => e.kind === "AMENDMENT" && e.amendment.id === a.id
      );
      expect(entry?.price).toBe(a.sellValue * 2);
      expect(shopEntryId(entry!)).toBe(a.id);
    }
  });

  it("refuses a fatal category, a lower-case code and a zero bonus", () => {
    const refuse = (patch: Partial<Record<string, unknown>>) =>
      SapAmendmentSchema.safeParse({ ...ROUNDING, ...patch }).success;
    expect(refuse({ category: "DENOMINATOR" })).toBe(false);
    expect(refuse({ code: "ar" })).toBe(false);
    expect(refuse({ code: "TOOLONG" })).toBe(false);
    expect(refuse({ bonusDelta: 0 })).toBe(false);
    expect(refuse({ penaltyDelta: -1 })).toBe(false);
    expect(refuse({})).toBe(true);
  });

  it("logs USE_AMENDMENT as a run action", () => {
    expect(
      RunActionSchema.parse({ type: "USE_AMENDMENT", consumableId: "AR" })
    ).toEqual({ type: "USE_AMENDMENT", consumableId: "AR" });
  });
});

describe("amendRulebook", () => {
  const base = scenario.rulebook;

  it("returns the rulebook unchanged with no amendments", () => {
    expect(amendRulebook(base, [])).toBe(base);
  });

  it("raises one non-fatal rule's stakes and renames the rulebook", () => {
    const amended = amendRulebook(base, [ROUNDING]);
    expect(amended.id).toBe(`${base.id}-AR`);
    expect(amended.title).toContain("amended (Rounding Amendment)");
    const before = base.rules.find((r) => r.category === "ROUNDING")!;
    const after = amended.rules.find((r) => r.id === before.id)!;
    expect(after.correctionMultBonus).toBe(before.correctionMultBonus + 3);
    expect(after.redlineMultPenalty).toBe(before.redlineMultPenalty + 1);
    expect(after.consequence).toContain(
      "Amended by Rounding Amendment: correcting it now earns +4 Mult"
    );
    // Every other rule is untouched.
    expect(amended.rules.filter((r) => r.id !== before.id)).toEqual(
      base.rules.filter((r) => r.id !== before.id)
    );
  });

  it("folds amendments in order and skips one with no rule to amend", () => {
    const both = amendRulebook(base, [ROUNDING, PRECISION]);
    expect(both.id).toBe(`${base.id}-AR-AP`);
    const noRounding = {
      ...base,
      rules: base.rules.filter((r) => r.category !== "ROUNDING"),
    };
    expect(amendedRule(noRounding, ROUNDING)).toBeNull();
    expect(amendRulebook(noRounding, [ROUNDING])).toBe(noRounding);
  });

  it("never amends a fatal rule", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(ROUNDING, PRECISION), { maxLength: 6 }),
        (amendments) => {
          const amended = amendRulebook(base, amendments);
          for (const rule of base.rules.filter((r) => r.severity === "FATAL")) {
            expect(amended.rules.find((r) => r.id === rule.id)).toEqual(rule);
          }
        }
      )
    );
  });
});

describe("USE_AMENDMENT", () => {
  it("puts the amended rulebook in force and stales exactly the preview's outputs", () => {
    const state = withTray(amendment(ROUNDING));
    const preview = deriveTableView(scenario, state).amendmentPreviews[0];
    expect(preview).toMatchObject({
      consumableId: "AR",
      fromId: scenario.rulebook.id,
      toId: `${scenario.rulebook.id}-AR`,
      ruleId: "SAP-DM-03",
      ruleLabel: "Rounding",
      bonus: { from: 1, to: 4 },
      penalty: { from: 1, to: 2 },
      refusal: null,
    });
    expect(preview.staled.map((c) => c.cardId)).toEqual(DRAFTS);

    const used = run([use("AR")], state);
    expect(used.consumables.some((c) => c.id === "AR")).toBe(false);
    expect(used.sapAmendments).toEqual([ROUNDING]);
    expect(Object.keys(used.compiledUnder)).toEqual(DRAFTS);
    expect(used.lastEvent).toMatchObject({ kind: "SAP_AMENDED" });
    expect(used.lastEvent?.message).toContain(
      `Rounding Amendment filed: ${preview.toId} is in force.`
    );
    expect(used.lastEvent?.message).toContain(
      "3 outputs compiled under SAP-DM-001 went stale"
    );
    const view = deriveTableView(scenario, used);
    expect(view.rulebook.id).toBe(preview.toId);
    expect(activeRulebook(scenario, used).id).toBe(preview.toId);
    for (const id of DRAFTS) {
      const card = view.hand.find((h) => h.card.id === id)!;
      expect(card.stale).toBe(true);
      expect(card.staleAlert).toBe(AMENDMENT_STALE_ALERT);
    }
    expect(view.amendmentPreviews).toEqual([]);
  });

  it("blocks Play Hand on a stale output until it is recompiled under the new rulebook", () => {
    const used = run(
      [use("AR"), { type: "TOGGLE_SELECT", cardId: DRAFT_A }],
      withTray(amendment(ROUNDING))
    );
    const view = deriveTableView(scenario, used);
    expect(view.canPlay).toBe(false);
    expect(view.playBlockedReason).toBe(AMENDMENT_STALE_ALERT);
    expect(view.playBlocker?.reason).toContain(AMENDMENT_STALE_ALERT);

    const recompiled = run([{ type: "RECOMPILE", cardId: DRAFT_A }], used);
    expect(recompiled.lastEvent?.message).toContain(
      `under ${scenario.rulebook.id}-AR`
    );
    expect(recompiled.compiledUnder[DRAFT_A]).toBeUndefined();
    const after = deriveTableView(scenario, recompiled);
    expect(after.hand.find((h) => h.card.id === DRAFT_A)?.staleAlert).toBe(
      null
    );
    expect(after.playBlockedReason).toBeNull();
  });

  it("says so when no output in hand is compiled under the old rulebook", () => {
    const empty = { ...withTray(amendment(ROUNDING)), hand: [] };
    const used = run([use("AR")], empty);
    expect(used.lastEvent?.message).toContain(
      "No output in hand was compiled under SAP-DM-001."
    );
  });

  it("scores the amended rule: a rounding correction earns +3 Mult more", () => {
    const plain = fixDraftA(withTray());
    const amended = fixDraftA(
      run(
        [use("AR"), { type: "RECOMPILE", cardId: DRAFT_A }],
        withTray(amendment(ROUNDING))
      )
    );
    const preview = (state: TableState) =>
      deriveTableView(
        scenario,
        run([{ type: "TOGGLE_SELECT", cardId: DRAFT_A }], state)
      ).preview!;
    expect(preview(amended).mult.total - preview(plain).mult.total).toBe(3);
  });

  it("refuses a missing item, another consumable kind, a repeat and a rulebook with nothing to amend", () => {
    const state = withTray(amendment(ROUNDING), amendment(ROUNDING, "AR2"));
    expect(run([use("nope")], state).lastEvent?.message).toBe(
      "That SAP Amendment is not in your tray."
    );
    const plain = withTray();
    const seal = plain.consumables.find((c) => c.kind === "SEAL")!;
    expect(run([use(seal.id)], plain).lastEvent?.message).toBe(
      "That SAP Amendment is not in your tray."
    );

    const once = run([use("AR")], state);
    const twice = run([use("AR2")], once);
    expect(twice.lastEvent).toMatchObject({
      kind: "REFUSED",
      message: "Rounding Amendment is already in force.",
    });
    expect(deriveTableView(scenario, once).amendmentPreviews[0].refusal).toBe(
      "Rounding Amendment is already in force."
    );

    const bare: Scenario = {
      ...scenario,
      rulebook: {
        ...scenario.rulebook,
        rules: scenario.rulebook.rules.filter((r) => r.category !== "ROUNDING"),
      },
    };
    const refused = run(
      [use("AR")],
      createTableState(bare, undefined, {
        consumables: [amendment(ROUNDING)],
        budget: 0,
      }),
      bare
    );
    expect(refused.lastEvent?.message).toBe(
      "SAP-DM-001 has no rounding rule to amend."
    );
  });

  it("refuses to affix an amendment as a seal, and names it in the tray", () => {
    const state = withTray(amendment(ROUNDING));
    const refused = run(
      [{ type: "APPLY_SEAL", consumableId: "AR", cardId: DRAFT_A }],
      state
    );
    expect(refused.lastEvent?.message).toBe(
      "Rounding Amendment is a SAP Amendment: file it to amend the rulebook."
    );
    expect(consumableName(amendment(ROUNDING))).toBe("Rounding Amendment");
    expect(consumableSellValue(amendment(ROUNDING))).toBe(3);
  });

  it("carries the amended rulebook into the next Blind with nothing stale", () => {
    const used = run([use("AR")], withTray(amendment(ROUNDING)));
    const inventory: Inventory = carriedInventory(used);
    expect(inventory.sapAmendments).toEqual([ROUNDING]);
    const next = createTableState(scenario, undefined, inventory);
    const view = deriveTableView(scenario, next);
    expect(view.rulebook.id).toBe(`${scenario.rulebook.id}-AR`);
    expect(view.hand.every((h) => h.staleAlert === null)).toBe(true);
  });

  it("never stales an output already compiled under an earlier rulebook", () => {
    fc.assert(
      fc.property(fc.subarray(DRAFTS), (recompile) => {
        const first = run(
          [
            use("AR"),
            ...recompile.map((cardId): TableAction => ({
              type: "RECOMPILE",
              cardId,
            })),
          ],
          withTray(amendment(ROUNDING), amendment(PRECISION))
        );
        const preview = deriveTableView(scenario, first).amendmentPreviews.find(
          (p) => p.consumableId === "AP"
        )!;
        // Only the outputs recompiled under the Rounding amendment go stale.
        expect(preview.staled.map((c) => c.cardId).sort()).toEqual(
          [...recompile].sort()
        );
        const second = run([use("AP")], first);
        for (const id of DRAFTS) {
          expect(second.compiledUnder[id]).toBe(
            recompile.includes(id)
              ? `${scenario.rulebook.id}-AR`
              : scenario.rulebook.id
          );
        }
      })
    );
  });

  it("replays to the same state from the same actions", () => {
    const actions: TableAction[] = [
      use("AR"),
      { type: "RECOMPILE", cardId: DRAFT_A },
      { type: "TOGGLE_SELECT", cardId: DRAFT_A },
    ];
    expect(run(actions, withTray(amendment(ROUNDING)))).toEqual(
      run(actions, withTray(amendment(ROUNDING)))
    );
  });

  it("keeps the population alert for snapshot staleness", () => {
    expect(STALE_ALERT).not.toBe(AMENDMENT_STALE_ALERT);
  });
});

describe("SAP Amendments in the shop", () => {
  const act = { ...ACT_I, crisisDeck: undefined };
  const apply = (r: RunState, ...actions: RunAction[]) =>
    actions.reduce((next, a) => advanceRun(act, next, a), r);
  const topUp = (r: RunState): RunState => ({
    ...r,
    table: { ...r.table, budget: 100 },
  });

  /** A cleared Small Blind, in the shop, with an empty tray and $100k. */
  function inShop(seed: string): RunState {
    let r = createRunState(act, seed);
    const blind = runBlinds(act, r)[r.blindIndex];
    for (const action of playBlind(blind, r.table, "MEDIAN").actions) {
      if (r.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      r = advanceRun(act, r, action);
    }
    r = apply(r, { type: "CASH_OUT" });
    for (const item of r.table.consumables) {
      r = apply(r, { type: "SELL_CONSUMABLE", consumableId: item.id });
    }
    return topUp(r);
  }

  const stockedAmendments = (r: RunState) =>
    r.shop!.slots.flatMap((s) =>
      s.entry.kind === "AMENDMENT" ? [s.entry.amendment.id] : []
    );

  /** Rerolls until the stock shows an amendment; the stream is seeded. */
  function stocked(): { run: RunState; slot: number } {
    let r = inShop("fold-change");
    for (let i = 0; i < 40; i++) {
      const slot = r.shop!.slots.findIndex((s) => s.entry.kind === "AMENDMENT");
      if (slot >= 0) return { run: r, slot };
      r = topUp(apply(r, { type: "REROLL" }));
    }
    throw new Error("No amendment stocked in 40 rerolls");
  }

  it("buys an amendment into the tray, sells it back, and never restocks one it owns", () => {
    const { run: r, slot } = stocked();
    const entry = r.shop!.slots[slot].entry as Extract<
      ShopEntry,
      { kind: "AMENDMENT" }
    >;
    const bought = apply(r, { type: "BUY", slot });
    const item = bought.table.consumables.find((c) => c.kind === "AMENDMENT");
    expect(item).toMatchObject({ amendment: entry.amendment });
    expect(bought.table.budget).toBe(100 - entry.price);
    expect(deriveRunView(act, bought).table.amendmentPreviews).toHaveLength(1);

    let rerolled = bought;
    for (let i = 0; i < 20; i++) {
      rerolled = topUp(apply(rerolled, { type: "REROLL" }));
      expect(stockedAmendments(rerolled)).not.toContain(entry.amendment.id);
    }

    const sold = apply(bought, {
      type: "SELL_CONSUMABLE",
      consumableId: item!.id,
    });
    expect(sold.table.budget).toBe(bought.table.budget + 3);
  });

  it("draws amendments in Guidance packs alongside Guidance cards", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 30 && !seen.has("AMENDMENT"); i++) {
      const r = inShop(`pack-${i}`);
      const slot = r.shop!.packs.findIndex((p) => p.pack.kind === "GUIDANCE");
      if (slot < 0) continue;
      const opened = apply(r, { type: "BUY_PACK", slot });
      for (const card of deriveRunView(act, opened).shop!.opened!.cards) {
        seen.add(card.kind);
      }
    }
    expect([...seen].sort()).toEqual(["AMENDMENT", "GUIDANCE"]);
  });

  it("only stocks an amendment the rulebook has a rule for", () => {
    const entry: ShopEntry = {
      kind: "AMENDMENT",
      price: 6,
      amendment: ROUNDING,
    };
    expect(fitsRulebook(entry, scenario.rulebook)).toBe(true);
    expect(
      fitsRulebook(entry, {
        ...scenario.rulebook,
        rules: scenario.rulebook.rules.filter((r) => r.category !== "ROUNDING"),
      })
    ).toBe(false);
  });
});
