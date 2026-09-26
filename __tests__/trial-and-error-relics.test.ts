import { describe, it, expect } from "vitest";
import {
  ACT_I_SHOP,
  DEMOGRAPHICS_SCENARIO,
  RELIC_PHASE_LABELS,
  RelicSchema,
  advanceTable,
  blindStartCpu,
  createTableState,
  deriveTableView,
  evaluateHand,
  freeDiscards,
  relicCardSourceId,
  relicModifiers,
  relicPhase,
  scoreTimeline,
  type Inventory,
  type Relic,
  type RelicCard,
  type RuleCheckResult,
  type ShopEntry,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

const scenario = DEMOGRAPHICS_SCENARIO;

/** A shop relic by id, as the Procurement Shop stocks it. */
const relic = (id: string): Relic => {
  const entry = ACT_I_SHOP.entries.find(
    (e): e is Extract<ShopEntry, { kind: "RELIC" }> =>
      e.kind === "RELIC" && e.relic.id === id
  );
  if (!entry) throw new Error(`No shop relic ${id}`);
  return entry.relic;
};

const MACRO = relic("REL-LEAD-PROGRAMMER-MACRO");
const PURIST = relic("REL-ITT-PURIST");
const WRITER = relic("REL-SENIOR-MEDICAL-WRITER");
const PIPELINE = relic("REL-DOUBLE-PROGRAMMING");
const SOP = relic("REL-PROTOCOL-OPTIMIZATION-SOP");
const GRID = relic("REL-GRID-ALLOCATION");
const SENIOR = relic("REL-SENIOR-PROGRAMMER");

const card = (overrides: Partial<RelicCard> & { id: string }): RelicCard => ({
  cardType: "TABLE",
  population: "ITT",
  chips: 25,
  mult: 1,
  qcPassed: false,
  cancelled: false,
  ...overrides,
});

const redline: RuleCheckResult = {
  ruleId: "R-RED",
  passed: false,
  chipsDelta: 0,
  multDelta: -1,
  evidence: "Precision slip.",
};

describe("relic trigger phases (#924)", () => {
  it("labels every phase, and an untriggered relic plays on hand played", () => {
    expect(RELIC_PHASE_LABELS).toEqual({
      ON_BLIND_START: "Blind start",
      ON_DISCARD: "On discard",
      ON_CARD_SCORED: "Card scored",
      ON_HAND_PLAYED: "Hand played",
    });
    expect(relicPhase(SENIOR)).toBe("ON_HAND_PLAYED");
    expect(relicPhase(MACRO)).toBe("ON_CARD_SCORED");
    expect(relicPhase(SOP)).toBe("ON_DISCARD");
    expect(relicPhase(GRID)).toBe("ON_BLIND_START");
  });

  it("validates triggers in the relic schema", () => {
    for (const r of [MACRO, PURIST, WRITER, PIPELINE, SOP, GRID]) {
      expect(RelicSchema.parse(r)).toEqual(r);
    }
    expect(
      RelicSchema.safeParse({
        ...SOP,
        trigger: { phase: "ON_DISCARD", freeDiscards: 0 },
      }).success
    ).toBe(false);
    expect(
      RelicSchema.safeParse({
        ...GRID,
        trigger: { phase: "ON_BLIND_START" },
      }).success
    ).toBe(false);
  });

  it("adds an untriggered relic's modifier to every hand", () => {
    expect(relicModifiers([SENIOR], { cards: [], ruleResults: [] })).toEqual([
      SENIOR.modifier,
    ]);
  });

  it("fires ON_HAND_PLAYED relics only when their condition holds", () => {
    const table = card({ id: "T" });
    const figure = card({ id: "F", cardType: "FIGURE" });
    const ids = (cards: RelicCard[], ruleResults: RuleCheckResult[]) =>
      relicModifiers([WRITER, PIPELINE], { cards, ruleResults }).map(
        (m) => m.sourceId
      );
    expect(ids([table], [])).toEqual(["REL-DOUBLE-PROGRAMMING"]);
    expect(ids([table, figure], [])).toEqual([
      "REL-SENIOR-MEDICAL-WRITER",
      "REL-DOUBLE-PROGRAMMING",
    ]);
    expect(ids([table, figure], [redline])).toEqual([
      "REL-SENIOR-MEDICAL-WRITER",
    ]);
    // A passed rule is no redline.
    expect(ids([table], [{ ...redline, passed: true }])).toEqual([
      "REL-DOUBLE-PROGRAMMING",
    ]);
  });

  it("fires ON_CARD_SCORED relics once per matching card, in rack order", () => {
    const hand = {
      cards: [
        card({ id: "T1", qcPassed: true }),
        card({ id: "T2" }),
        card({ id: "L1", cardType: "LISTING", qcPassed: true }),
        card({ id: "T3", population: "SAFETY", qcPassed: true }),
      ],
      ruleResults: [],
    };
    expect(relicModifiers([MACRO], hand)).toEqual([
      {
        sourceId: relicCardSourceId(MACRO.id, "T1"),
        label: "Lead Programmer Macro on T1",
        chips: 0,
        plusMult: 4,
        xMult: 1,
      },
      expect.objectContaining({
        sourceId: "REL-LEAD-PROGRAMMER-MACRO@T3",
        plusMult: 4,
      }),
    ]);
  });

  it("retriggers ITT cards with their own Chips and Mult, never a cancelled one", () => {
    const hand = {
      cards: [
        card({ id: "T1", chips: 25, mult: 1 }),
        card({ id: "L1", cardType: "LISTING", chips: 20, mult: 0 }),
        card({ id: "S1", population: "SAFETY" }),
        card({ id: "X1", cancelled: true }),
      ],
      ruleResults: [],
    };
    expect(relicModifiers([PURIST], hand)).toEqual([
      {
        sourceId: "REL-ITT-PURIST@T1",
        label: "The ITT Purist retriggers T1",
        chips: 25,
        plusMult: 1,
        xMult: 1,
      },
      {
        sourceId: "REL-ITT-PURIST@L1",
        label: "The ITT Purist retriggers L1",
        chips: 20,
        plusMult: 0,
        xMult: 1,
      },
    ]);
  });

  it("counts free discards and Blind-start CPU across the rack", () => {
    expect(freeDiscards([SOP, SENIOR, SOP])).toBe(2);
    expect(freeDiscards([SENIOR])).toBe(0);
    expect(blindStartCpu([GRID, MACRO])).toBe(1);
    expect(blindStartCpu([])).toBe(0);
    // Neither adds a score modifier.
    expect(relicModifiers([SOP, GRID], { cards: [], ruleResults: [] })).toEqual(
      []
    );
  });
});

describe("relics in the score timeline (#924)", () => {
  const evaluation = evaluateHand({
    handType: "TLF_PAIR",
    cards: [
      { id: "T1", chips: 25, mult: 1 },
      { id: "L1", chips: 20, mult: 0 },
    ],
    ruleResults: [],
    modifiers: [
      ...relicModifiers([MACRO, PURIST, PIPELINE], {
        cards: [
          card({ id: "T1", qcPassed: true }),
          card({ id: "L1", cardType: "LISTING", chips: 20, mult: 0 }),
        ],
        ruleResults: [],
      }),
    ],
  });
  const steps = scoreTimeline(evaluation, {
    roundScoreBefore: 0,
    target: 1000,
    cardNames: { T1: "Table 14.1.2", L1: "Listing 16.2.4" },
    relicNames: Object.fromEntries(
      [MACRO, PURIST, PIPELINE].map((r) => [r.id, r.name])
    ),
  });

  it("plays each card's relics right after the card, by name", () => {
    expect(
      steps.map((s) =>
        s.kind === "CARD_SCORED"
          ? `card ${s.cardId}`
          : s.kind === "RELIC"
            ? `relic ${s.relicId}${s.cardId ? ` on ${s.cardId}` : ""}`
            : s.kind
      )
    ).toEqual([
      "HAND_BASE",
      "card T1",
      "relic REL-LEAD-PROGRAMMER-MACRO on T1",
      "relic REL-ITT-PURIST on T1",
      "card L1",
      "relic REL-ITT-PURIST on L1",
      "relic REL-DOUBLE-PROGRAMMING",
      "X_MULT",
      "TOTAL",
      "BLIND_PROGRESS",
    ]);
    const relics = steps.filter((s) => s.kind === "RELIC");
    expect(relics[0]).toMatchObject({
      name: "Lead Programmer Macro",
      phase: "ON_CARD_SCORED",
      cardId: "T1",
      mult: 4,
      text: "Lead Programmer Macro on Table 14.1.2: +4 Mult.",
    });
    expect(relics[2]).toMatchObject({
      text: "The ITT Purist on Listing 16.2.4: +20 Chips.",
    });
    expect(relics[3]).toMatchObject({
      name: "Double-Programming Pipeline",
      phase: "ON_HAND_PLAYED",
      xMult: 1.5,
    });
    expect(relics[3]).not.toHaveProperty("cardId");
    expect(steps.find((s) => s.kind === "X_MULT")).toMatchObject({
      factor: 1.5,
      text: "Double-Programming Pipeline: ×1.5 Mult.",
    });
  });

  it("keeps the running totals equal to the evaluation", () => {
    const total = steps.find((s) => s.kind === "TOTAL")!;
    expect(total.running.chips).toBe(evaluation.chips.total);
    expect(total.running.mult * total.running.xMult).toBe(evaluation.finalMult);
  });

  it("names a card relic's ×Mult by relic and card, and falls back to ids", () => {
    const x = evaluateHand({
      handType: "HIGH_TABLE",
      cards: [{ id: "T1", chips: 25, mult: 1 }],
      ruleResults: [],
      modifiers: [
        {
          sourceId: relicCardSourceId("REL-X", "T1"),
          label: "x",
          chips: 0,
          plusMult: 0,
          xMult: 2,
        },
      ],
    });
    const named = scoreTimeline(x, {
      roundScoreBefore: 0,
      target: 10,
      relicNames: { "REL-X": "Reviewer" },
    });
    expect(named.find((s) => s.kind === "X_MULT")?.text).toBe(
      "Reviewer on T1: ×2 Mult."
    );
    const bare = scoreTimeline(x, { roundScoreBefore: 0, target: 10 });
    expect(bare.find((s) => s.kind === "RELIC")?.text).toBe(
      "REL-X on T1: ×2 Mult."
    );
  });
});

describe("relics at the card table (#924)", () => {
  const run = (actions: TableAction[], from: TableState) =>
    actions.reduce(
      (state, action) => advanceTable(scenario, state, action),
      from
    );
  const withRelics = (...relics: Relic[]): TableState =>
    createTableState(scenario, undefined, {
      consumables: [],
      budget: 0,
      relics,
    } satisfies Inventory);
  const DRAFT_A = "C-T14.1.1-A";
  const ITT_LISTING = "C-L16.2.4";
  const CLEAN_LISTING = "C-L16.2.7";

  it("starts the Blind with ON_BLIND_START CPU on top of its allocation", () => {
    const plain = createTableState(scenario);
    const state = withRelics(GRID);
    expect(state.cpu.available).toBe(plain.cpu.available + 1);
    expect(deriveTableView(scenario, state).cpuAllocation).toBe(
      scenario.table.startingCpu + 1
    );
    expect(deriveTableView(scenario, plain).cpuAllocation).toBe(
      scenario.table.startingCpu
    );
  });

  it("makes the Blind's first discard free with an ON_DISCARD relic", () => {
    const start = withRelics(SOP);
    const view = deriveTableView(scenario, start);
    expect(view.discardFree).toBe(true);
    expect(view.discardCost).toBe(0);
    const first = run(
      [{ type: "TOGGLE_SELECT", cardId: DRAFT_A }, { type: "DISCARD" }],
      start
    );
    expect(first.cpu.available).toBe(start.cpu.available);
    expect(first.lastEvent?.message).toBe(
      "Discarded 1 card. Protocol Optimization SOP: a free discard."
    );
    const after = deriveTableView(scenario, first);
    expect(after.discardFree).toBe(false);
    expect(after.discardCost).toBe(1);
    const second = run(
      [{ type: "TOGGLE_SELECT", cardId: first.hand[0] }, { type: "DISCARD" }],
      first
    );
    expect(second.cpu.available).toBe(first.cpu.available - 1);
    expect(second.lastEvent?.message).toBe("Discarded 1 card.");
  });

  it("counts free discards in the discards the CPU affords", () => {
    const plain = deriveTableView(scenario, createTableState(scenario));
    const sop = deriveTableView(scenario, withRelics(SOP));
    expect(sop.discardsAffordable).toBe(plain.discardsAffordable + 1);
  });

  it("fires a clean hand's ON_HAND_PLAYED relics, and not a Figure's without one", () => {
    const played = run(
      [{ type: "TOGGLE_SELECT", cardId: CLEAN_LISTING }, { type: "PLAY_HAND" }],
      withRelics(WRITER, PIPELINE)
    );
    const evaluation = played.lastPlay!.evaluation;
    expect(evaluation.xMult.factors).toContainEqual({
      sourceId: "REL-DOUBLE-PROGRAMMING",
      value: 1.5,
    });
    expect(
      evaluation.ledger.some((l) => l.sourceId === "REL-SENIOR-MEDICAL-WRITER")
    ).toBe(false);
  });

  it("retriggers an ITT output", () => {
    const played = run(
      [{ type: "TOGGLE_SELECT", cardId: ITT_LISTING }, { type: "PLAY_HAND" }],
      withRelics(PURIST)
    );
    const evaluation = played.lastPlay!.evaluation;
    expect(evaluation.ledger).toContainEqual(
      expect.objectContaining({
        sourceId: "REL-ITT-PURIST@C-L16.2.4",
        kind: "CHIPS",
        value: 20,
      })
    );
    const view = deriveTableView(scenario, played);
    expect(
      view.lastTimeline!.find(
        (s) => s.kind === "RELIC" && s.cardId === ITT_LISTING
      )?.text
    ).toMatch(/^The ITT Purist on /);
  });

  it("adds the Lead Programmer Macro only for a Table stamped QC ✓", () => {
    const fire = (from: TableState) =>
      run(
        [{ type: "TOGGLE_SELECT", cardId: DRAFT_A }, { type: "PLAY_HAND" }],
        from
      ).lastPlay!.evaluation.ledger.filter(
        (l) => l.sourceId === `REL-LEAD-PROGRAMMER-MACRO@${DRAFT_A}`
      );
    const start = withRelics(MACRO);
    expect(fire(start)).toEqual([]);

    let fixed = run([{ type: "INSPECT_CARD", cardId: DRAFT_A }], start);
    const draft = scenario.drawPile[0];
    for (let row = 0; row < draft.rows.length; row++) {
      for (let col = 0; col < draft.columns.length; col++) {
        fixed = run([{ type: "INSPECT_CELL", row, col }], fixed);
      }
    }
    for (const finding of deriveTableView(scenario, fixed).inspection!
      .openFindings) {
      fixed = run([{ type: "CORRECT_FINDING", findingId: finding.id }], fixed);
    }
    fixed = run([{ type: "CLOSE_INSPECT" }], fixed);
    expect(
      deriveTableView(scenario, fixed).hand.find((c) => c.card.id === DRAFT_A)
        ?.stamps
    ).toContain("QC_PASS");
    expect(fire(fixed)).toContainEqual(
      expect.objectContaining({ kind: "PLUS_MULT", value: 4 })
    );
  });
});

describe("relics in the score log (#924)", () => {
  it("names each card relic's firing by relic and card", () => {
    const start = createTableState(scenario, undefined, {
      consumables: [],
      budget: 0,
      relics: [PURIST],
    });
    const played = advanceTable(
      scenario,
      advanceTable(scenario, start, {
        type: "TOGGLE_SELECT",
        cardId: "C-L16.2.4",
      }),
      { type: "PLAY_HAND" }
    );
    expect(deriveTableView(scenario, played).scoreLog[0].fired).toContainEqual({
      kind: "RELIC",
      label: "REL-ITT-PURIST · C-L16.2.4",
      effect: "+20 Chips",
    });
  });
});
