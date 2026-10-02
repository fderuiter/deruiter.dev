// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ACT_I,
  ACT_I_CRISES,
  DEMOGRAPHICS_SCENARIO,
  GUIDANCE_CARDS,
  GuidanceCardSchema,
  HAND_BASE_SCORES,
  HAND_EXAMPLES,
  HAND_LEVEL_BONUS,
  HandLevelsSchema,
  HandTypeSchema,
  SPONSOR_SAFETY_SCENARIO,
  advanceRun,
  advanceTable,
  carriedInventory,
  createRunState,
  createTableState,
  deriveTableView,
  evaluateHand,
  handLevelTable,
  initialHandLevels,
  leveledBase,
  scoreTimeline,
  type Consumable,
  type HandType,
  type Inventory,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

const SMALL = DEMOGRAPHICS_SCENARIO;
const BIG = SPONSOR_SAFETY_SCENARIO;
const E2A = `GUIDE-ICH-E2A@${BIG.id}`;
const OVERLAP = `FN-AE-OVERLAP@${BIG.id}`;
const DRAFT_A = "C-T14.1.1-A";

const guide = (handType: HandType, id: string = handType): Consumable => ({
  id,
  kind: "GUIDANCE",
  guidance: GUIDANCE_CARDS[handType],
});
const inventory = (...consumables: Consumable[]): Inventory => ({
  consumables,
  budget: 0,
});
const run = (
  actions: TableAction[],
  from: TableState,
  scenario = SMALL
): TableState => actions.reduce((s, a) => advanceTable(scenario, s, a), from);
const use = (consumableId: string) => ({
  type: "USE_GUIDANCE" as const,
  consumableId,
});

/** The per-level numbers documented in #947 and the ADR 0046 amendment. */
const DOCUMENTED: Record<HandType, [string, number, number]> = {
  CSR_STRAIGHT: ["ICH E3", 30, 3],
  EFFICACY_FULL_HOUSE: ["ICH E9(R1)", 35, 3],
  POPULATION_FLUSH: ["ICH E9", 25, 2],
  MEDDRA_FIVE_OF_A_KIND: ["ICH E2A", 35, 3],
  TLF_TWO_PAIR: ["CDISC ADaM IG", 20, 2],
  TLF_PAIR: ["CDISC SDTM IG", 15, 1],
  HIGH_TABLE: ["FDA Study Data TCG", 10, 1],
};

describe("hand levels", () => {
  it("catalogs one Guidance card per hand with the documented bonus", () => {
    for (const handType of HandTypeSchema.options) {
      const [name, chips, mult] = DOCUMENTED[handType];
      const card = GUIDANCE_CARDS[handType];
      expect(GuidanceCardSchema.parse(card)).toEqual(card);
      expect(card).toMatchObject({ name, handType });
      expect(HAND_LEVEL_BONUS[handType]).toEqual({ chips, mult });
    }
    expect(new Set(Object.values(GUIDANCE_CARDS).map((g) => g.id)).size).toBe(
      7
    );
  });

  it("adds the bonus once per level above 1, and treats bad levels as 1", () => {
    for (const handType of HandTypeSchema.options) {
      const base = HAND_BASE_SCORES[handType];
      const bonus = HAND_LEVEL_BONUS[handType];
      expect(leveledBase(handType)).toEqual(base);
      expect(leveledBase(handType, 3)).toMatchObject({
        baseChips: base.baseChips + 2 * bonus.chips,
        baseMult: base.baseMult + 2 * bonus.mult,
      });
      for (const bad of [0, -2, 1.5, Number.NaN]) {
        expect(leveledBase(handType, bad)).toEqual(base);
      }
    }
  });

  it("scores the leveled base and records the level", () => {
    const card = { id: "T-14.1.1", chips: 30, mult: 1 };
    const flat = evaluateHand({
      handType: "POPULATION_FLUSH",
      cards: [card],
      ruleResults: [],
    });
    expect(flat.level).toBe(1);
    expect(flat.score).toBe((100 + 30) * (7 + 1));
    const leveled = evaluateHand({
      handType: "POPULATION_FLUSH",
      cards: [card],
      ruleResults: [],
      level: 3,
    });
    expect(leveled).toMatchObject({
      level: 3,
      base: { baseChips: 150, baseMult: 11 },
      chips: { base: 150, total: 180 },
      mult: { base: 11, total: 12 },
      score: 180 * 12,
    });
    expect(leveled.ledger[0].label).toBe("POPULATION_FLUSH base Chips (Lv.3)");
    const [baseStep] = scoreTimeline(leveled, {
      roundScoreBefore: 0,
      target: 100,
    });
    expect(baseStep).toMatchObject({
      kind: "HAND_BASE",
      level: 3,
      chips: 150,
      mult: 11,
      text: "Population Flush Lv.3: 150 Chips, +11 Mult.",
    });
    expect(
      evaluateHand({
        handType: "POPULATION_FLUSH",
        cards: [card],
        ruleResults: [],
        level: 0,
      })
    ).toEqual(flat);
  });

  it("never lowers a fixed hand's score as its level rises", () => {
    const scored = fc.record({
      id: fc.string({ minLength: 1, maxLength: 8 }),
      chips: fc.nat({ max: 200 }),
      mult: fc.nat({ max: 20 }),
    });
    const rule = fc.record({
      ruleId: fc.constantFrom("SAP-1", "SAP-2", "SAP-3"),
      passed: fc.boolean(),
      chipsDelta: fc.integer({ min: -200, max: 200 }),
      multDelta: fc.integer({ min: -20, max: 20 }),
      multMultiplier: fc.option(fc.constantFrom(0, 0.5, 1, 1.5, 2), {
        nil: undefined,
      }),
      evidence: fc.constant("Evidence."),
    });
    const modifier = fc.record({
      sourceId: fc.constantFrom("RELIC-A", "RELIC-B"),
      label: fc.constant("Relic"),
      chips: fc.integer({ min: -50, max: 50 }),
      plusMult: fc.integer({ min: -5, max: 5 }),
      xMult: fc.constantFrom(0.5, 1, 1.5, 2),
    });
    fc.assert(
      fc.property(
        fc.constantFrom(...HandTypeSchema.options),
        fc.array(scored, { minLength: 1, maxLength: 5 }),
        fc.array(rule, { maxLength: 4 }),
        fc.array(modifier, { maxLength: 2 }),
        fc.integer({ min: 1, max: 20 }),
        (handType, cards, ruleResults, modifiers, level) => {
          const at = (n: number) =>
            evaluateHand({ handType, cards, ruleResults, modifiers, level: n })
              .score;
          expect(at(level + 1)).toBeGreaterThanOrEqual(at(level));
        }
      )
    );
  });

  it("builds the Run Info hand table from the domain", () => {
    const levels = initialHandLevels();
    expect(HandLevelsSchema.parse(levels)).toEqual(levels);
    levels.CSR_STRAIGHT = { level: 2, playedCount: 3 };
    const rows = handLevelTable(levels);
    expect(rows.map((r) => r.handType)).toEqual(HandTypeSchema.options);
    expect(rows.find((r) => r.handType === "CSR_STRAIGHT")).toEqual({
      handType: "CSR_STRAIGHT",
      name: "CSR Straight",
      level: 2,
      chips: 170,
      mult: 13,
      playedCount: 3,
      description: HAND_BASE_SCORES.CSR_STRAIGHT.description,
      example: HAND_EXAMPLES.CSR_STRAIGHT,
    });
  });
});

describe("Guidance cards on the table", () => {
  it("fills a free Big Blind tray slot after its seal", () => {
    const state = createTableState(BIG);
    expect(state.consumables.map((c) => c.id)).toEqual([OVERLAP, E2A]);
    const full = createTableState(
      BIG,
      undefined,
      inventory(guide("TLF_PAIR", "a"), guide("TLF_PAIR", "b"))
    );
    expect(full.consumables.map((c) => c.id)).toEqual(["a", "b"]);
  });

  it("levels its hand up for the run, and announces the level-up", () => {
    const state = run([use(E2A)], createTableState(BIG), BIG);
    expect(state.consumables.map((c) => c.id)).toEqual([OVERLAP]);
    expect(state.handLevels.MEDDRA_FIVE_OF_A_KIND).toEqual({
      level: 2,
      playedCount: 0,
    });
    expect(state.lastEvent).toMatchObject({
      kind: "LEVELED_UP",
      message:
        "ICH E2A: MedDRA Five of a Kind levelled up to Lv.2. Base 235 Chips, +21 Mult.",
      levelUp: {
        guidanceId: "GUIDE-ICH-E2A",
        guidanceName: "ICH E2A",
        handType: "MEDDRA_FIVE_OF_A_KIND",
        from: { level: 1, chips: 200, mult: 18 },
        to: { level: 2, chips: 235, mult: 21 },
      },
    });
    const view = deriveTableView(BIG, state);
    expect(view.handLevels).toBe(state.handLevels);
    expect(
      view.handTable.find((r) => r.handType === "MEDDRA_FIVE_OF_A_KIND")
    ).toMatchObject({ level: 2, chips: 235, mult: 21 });
  });

  it("scores the preview and the played hand at the hand's level", () => {
    const start = createTableState(
      SMALL,
      undefined,
      inventory(guide("HIGH_TABLE", "g"))
    );
    const flat = deriveTableView(
      SMALL,
      run([{ type: "TOGGLE_SELECT", cardId: DRAFT_A }], start)
    ).preview!;
    const leveled = run(
      [use("g"), { type: "TOGGLE_SELECT", cardId: DRAFT_A }],
      start
    );
    const preview = deriveTableView(SMALL, leveled).preview!;
    expect(preview.level).toBe(2);
    expect(preview.chips.base).toBe(flat.chips.base + 10);
    expect(preview.mult.base).toBe(flat.mult.base + 1);
    const played = run([{ type: "PLAY_HAND" }], leveled);
    expect(played.lastPlay?.evaluation.level).toBe(2);
    expect(played.handLevels.HIGH_TABLE).toEqual({
      level: 2,
      playedCount: 1,
    });
  });

  it("sells for its value, and refuses the wrong consumable or action", () => {
    const start = createTableState(BIG);
    const sold = run(
      [{ type: "SELL_CONSUMABLE", consumableId: E2A }],
      start,
      BIG
    );
    expect(sold.budget).toBe(3);
    expect(sold.lastEvent?.message).toBe(
      "Sold ICH E2A for $3k. Study budget $3k."
    );
    expect(sold.handLevels).toEqual(initialHandLevels());
    expect(run([use(OVERLAP)], start, BIG).lastEvent?.message).toBe(
      "That Guidance card is not in your tray."
    );
    expect(run([use("nope")], start, BIG).lastEvent?.message).toBe(
      "That Guidance card is not in your tray."
    );
    expect(
      run(
        [{ type: "APPLY_SEAL", consumableId: E2A, cardId: "C-T14.3.1-A" }],
        start,
        BIG
      ).lastEvent?.message
    ).toBe(
      "ICH E2A is a Guidance card: use it to level up MedDRA Five of a Kind."
    );
  });

  it("can be used while a crisis waits, and is kept across Blinds", () => {
    const crisis = ACT_I_CRISES[0];
    const pending = createTableState(BIG, undefined, undefined, crisis);
    const used = run([use(E2A)], pending, BIG);
    expect(used.crisis).toBe(crisis);
    expect(used.handLevels.MEDDRA_FIVE_OF_A_KIND.level).toBe(2);
    const carried = carriedInventory(used);
    expect(carried.handLevels).toBe(used.handLevels);
    const next = createTableState(ACT_I.bossPool![0], undefined, carried);
    expect(next.handLevels.MEDDRA_FIVE_OF_A_KIND.level).toBe(2);
    // A kept Guidance card rides along in the tray too.
    const kept = createTableState(
      ACT_I.bossPool![0],
      undefined,
      carriedInventory(pending)
    );
    expect(kept.consumables.map((c) => c.id)).toContain(E2A);
  });

  it("restores the Blind's opening levels on RESET, and a new run starts at 1", () => {
    const opening = createTableState(
      SMALL,
      undefined,
      inventory(guide("HIGH_TABLE", "g"))
    );
    const reset = run([use("g"), { type: "RESET" }], opening);
    expect(reset.handLevels).toEqual(initialHandLevels());
    expect(reset.consumables.map((c) => c.id)).toContain("g");

    const r0 = createRunState(ACT_I, "levels");
    expect(r0.table.handLevels).toEqual(initialHandLevels());
    const r1 = {
      ...r0,
      table: createTableState(SMALL, undefined, inventory(guide("TLF_PAIR"))),
    };
    const leveled = advanceRun(ACT_I, r1, use("TLF_PAIR"));
    expect(leveled.table.handLevels.TLF_PAIR.level).toBe(2);
    const restarted = advanceRun(ACT_I, leveled, { type: "RESTART_RUN" });
    expect(restarted.table.handLevels).toEqual(initialHandLevels());
  });

  it("replays deterministically", () => {
    const actions: TableAction[] = [
      use(E2A),
      { type: "TOGGLE_SELECT", cardId: "C-T14.3.1-A" },
      { type: "PLAY_HAND" },
    ];
    expect(run(actions, createTableState(BIG), BIG)).toEqual(
      run(actions, createTableState(BIG), BIG)
    );
  });
});
