import { describe, it, expect } from "vitest";
import {
  ACT_I,
  ACT_III,
  SCENARIOS,
  CardFaceSchema,
  DEMOGRAPHICS_SCENARIO,
  FACE_KIND_BY_CARD_TYPE,
  RedactedCardSchema,
  ScenarioSchema,
  advanceTable,
  createTableState,
  deriveTableView,
  type CardFace,
  type RedactedCard,
  type TableAction,
  type TableState,
} from "@/lib/trial-and-error";

const scenario = DEMOGRAPHICS_SCENARIO;
const DRAFT_A = "C-T14.1.1-A";
const run = (
  actions: TableAction[],
  from: TableState = createTableState(scenario)
) => actions.reduce((s, a) => advanceTable(scenario, s, a), from);
const cardView = (state: TableState, id: string) =>
  deriveTableView(scenario, state).hand.find((h) => h.card.id === id)!;

const reviewAll = (cardId: string): TableAction[] => {
  const actions: TableAction[] = [{ type: "INSPECT_CARD", cardId }];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      actions.push({ type: "INSPECT_CELL", row, col });
    }
  }
  return actions;
};

describe("card faces", () => {
  it("gives every card in the deck a face matching its type", () => {
    const state = createTableState(scenario);
    const dealt = [...state.hand];
    for (const h of deriveTableView(scenario, state).hand) {
      expect(h.face.kind).toBe(FACE_KIND_BY_CARD_TYPE[h.card.cardType]);
      expect(CardFaceSchema.safeParse(h.face).success).toBe(true);
    }
    expect(dealt).toHaveLength(8);
    for (const card of scenario.deck) {
      expect(
        [card.face, card.draftId, card.shellId].filter((x) => x !== undefined)
      ).toHaveLength(1);
    }
  });

  it("gives every card in every Blind a valid face, drafts included", () => {
    for (const blind of Object.values(SCENARIOS)) {
      const everyCard = {
        ...createTableState(blind),
        hand: blind.deck.map((c) => c.id),
      };
      for (const h of deriveTableView(blind, everyCard).hand) {
        expect(h.face.kind).toBe(FACE_KIND_BY_CARD_TYPE[h.card.cardType]);
        expect(CardFaceSchema.safeParse(h.face).success).toBe(true);
      }
    }
  });

  it("prints a draft's observed cells, then the corrected value once fixed", () => {
    const fresh = cardView(createTableState(scenario), DRAFT_A).face;
    expect(fresh).toMatchObject({
      kind: "TABLE",
      columns: ["Placebo", "Active", "Total"],
    });
    if (fresh.kind !== "TABLE") throw new Error("expected a table face");
    expect(fresh.rows).toHaveLength(5);
    expect(fresh.rows[2].values[2]).toBe("7 (63.6)");

    const fixed = run([
      { type: "INSPECT_CARD", cardId: DRAFT_A },
      { type: "INSPECT_CELL", row: 2, col: 2 },
      { type: "CORRECT_FINDING", findingId: "SAP-DM-01@r2c2" },
    ]);
    const face = cardView(fixed, DRAFT_A).face;
    if (face.kind !== "TABLE") throw new Error("expected a table face");
    expect(face.rows[2].values[2]).toBe("7 (58.3)");
  });

  it("deals no efficacy outputs or Figures anywhere in Act I", () => {
    for (const blind of [...ACT_I.blinds, ...(ACT_I.bossPool ?? [])]) {
      for (const card of blind.deck) {
        expect(card.cardType).not.toBe("FIGURE");
        expect(card.topic).not.toBe("EFF");
        expect(card.csrStage).not.toBe("EFFICACY");
      }
    }
  });
});

describe("Act III efficacy faces (#1085)", () => {
  it("deals efficacy Tables and a forest plot with valid faces in every Act III Blind", () => {
    for (const blind of [...ACT_III.blinds, ...(ACT_III.bossPool ?? [])]) {
      const view = deriveTableView(blind, {
        ...createTableState(blind),
        hand: blind.deck.map((c) => c.id),
      });
      const efficacy = view.hand.filter(
        (h) => h.card.csrStage === "EFFICACY" && h.card.cardType === "TABLE"
      );
      expect(efficacy.length, blind.id).toBeGreaterThanOrEqual(2);
      const forest = view.hand.filter(
        (h) => h.face.kind === "FIGURE" && h.face.plot.type === "FOREST"
      );
      expect(forest, blind.id).toHaveLength(1);
      for (const h of [...efficacy, ...forest]) {
        expect(CardFaceSchema.safeParse(h.face).success, h.card.id).toBe(true);
      }
      const plot = forest[0].face.kind === "FIGURE" && forest[0].face.plot;
      if (!plot || plot.type !== "FOREST") throw new Error("expected a forest");
      for (const i of plot.intervals) {
        expect(i.lower).toBeLessThanOrEqual(i.estimate);
        expect(i.estimate).toBeLessThanOrEqual(i.upper);
      }
    }
  });
});

describe("face schema rules", () => {
  const table: CardFace = {
    kind: "TABLE",
    columns: ["A", "B"],
    rows: [
      { label: "r1", values: ["1", "2"] },
      { label: "r2", values: ["1", "2"] },
      { label: "r3", values: ["1", "2"] },
    ],
  };

  it("rejects ragged tables and listings, and forest intervals that miss their estimate", () => {
    expect(CardFaceSchema.safeParse(table).success).toBe(true);
    const ragged = CardFaceSchema.safeParse({
      kind: "TABLE",
      columns: ["A", "B"],
      rows: [
        { label: "r1", values: ["1", "2"] },
        { label: "r2", values: ["1", "2"] },
        { label: "r3", values: ["1"] },
      ],
    });
    expect(ragged.error?.issues[0].path).toEqual(["rows", 2, "values"]);
    const listing = CardFaceSchema.safeParse({
      kind: "LISTING",
      columns: ["Subject", "Arm"],
      rows: [["S-1", "PBO"], ["S-2"], ["S-3", "ACT"]],
    });
    expect(listing.error?.issues[0].path).toEqual(["rows", 1]);
    expect(
      CardFaceSchema.safeParse({
        kind: "FIGURE",
        plot: {
          type: "FOREST",
          reference: 0,
          intervals: [
            { label: "a", estimate: 5, lower: 0, upper: 1 },
            { label: "b", estimate: 0, lower: -1, upper: 1 },
          ],
        },
      }).success
    ).toBe(false);
    expect(
      CardFaceSchema.safeParse({ kind: "TOKEN", cohort: "ITT", count: 12 })
        .success
    ).toBe(true);
  });

  it("requires exactly one of face or draft, and a face that matches the card type", () => {
    const [draft, listing] = scenario.deck;
    const parse = (deck: typeof scenario.deck) =>
      ScenarioSchema.safeParse({ ...scenario, deck }).error?.issues.map((i) =>
        i.path.join(".")
      );
    expect(parse([draft, { ...listing, face: undefined }])).toEqual([
      "deck.1.face",
    ]);
    expect(parse([{ ...draft, face: table }, listing])).toEqual([
      "deck.0.face",
    ]);
    expect(parse([draft, { ...listing, face: table }])).toEqual([
      "deck.1.face.kind",
    ]);
  });
});

describe("stamps", () => {
  it("stamps REDLINE while a revealed finding is open", () => {
    const state = run([
      { type: "INSPECT_CARD", cardId: DRAFT_A },
      { type: "INSPECT_CELL", row: 2, col: 2 },
    ]);
    expect(cardView(state, DRAFT_A).stamps).toEqual(["REDLINE"]);
  });

  it("stamps QC ✓ only after every cell is reviewed and every finding corrected", () => {
    const reviewed = run(reviewAll(DRAFT_A));
    const view = cardView(reviewed, DRAFT_A);
    expect(view.stamps).toEqual(["REDLINE"]);
    expect(view.openRedlines).toBeGreaterThan(0);
    let state = reviewed;
    const findings = deriveTableView(scenario, state).inspection!.openFindings;
    for (const f of findings) {
      state = advanceTable(scenario, state, {
        type: "CORRECT_FINDING",
        findingId: f.id,
      });
    }
    expect(cardView(state, DRAFT_A).stamps).toEqual(["QC_PASS"]);
  });

  it("does not vouch for a partly reviewed card with no open findings", () => {
    const state = run([
      { type: "INSPECT_CARD", cardId: DRAFT_A },
      { type: "INSPECT_CELL", row: 0, col: 0 },
    ]);
    expect(cardView(state, DRAFT_A).stamps).toEqual([]);
    expect(cardView(createTableState(scenario), "C-T14.1.2").stamps).toEqual(
      []
    );
  });
});

describe("face-down cards", () => {
  it("exposes the undealt deck as opaque slots with no card data", () => {
    const view = deriveTableView(scenario, createTableState(scenario));
    expect(view.drawPile).toHaveLength(scenario.deck.length - 8);
    expect(view.spentCount).toBe(0);
    for (const back of view.drawPile) {
      expect(Object.keys(back).sort()).toEqual(["faceDown", "slot"]);
      expect(RedactedCardSchema.safeParse(back).success).toBe(true);
    }
    const serialized = JSON.stringify(view.drawPile);
    for (const card of scenario.deck.slice(8)) {
      expect(serialized).not.toContain(card.id);
      expect(serialized).not.toContain(card.title);
      expect(serialized).not.toContain(card.number);
    }
  });

  it("rejects face data on a redacted card, at compile time and at runtime", () => {
    // @ts-expect-error A redacted card has no room for face values.
    const leaky: RedactedCard = { slot: "draw-9", faceDown: true, face: {} };
    expect(RedactedCardSchema.safeParse(leaky).success).toBe(false);
    expect(
      RedactedCardSchema.safeParse({ slot: "draw-9", faceDown: false }).success
    ).toBe(false);
  });

  it("counts played and discarded cards as spent", () => {
    const state = run([
      { type: "TOGGLE_SELECT", cardId: "C-T14.1.2" },
      { type: "DISCARD" },
    ]);
    const view = deriveTableView(scenario, state);
    expect(view.spentCount).toBe(1);
    expect(view.drawPile).toHaveLength(scenario.deck.length - 9);
  });
});

describe("MOVE_CARD", () => {
  it("reorders the hand for free and announces the new position", () => {
    const start = createTableState(scenario);
    const moved = run([{ type: "MOVE_CARD", cardId: DRAFT_A, toIndex: 3 }]);
    expect(moved.hand[3]).toBe(DRAFT_A);
    expect([...moved.hand].sort()).toEqual([...start.hand].sort());
    expect(moved.cpu).toEqual(start.cpu);
    expect(moved.lastEvent).toMatchObject({
      kind: "MOVED",
      message: "Table 14.1.1 moved to position 4 of 8.",
    });
  });

  it("clamps the target and refuses no-op or unknown moves", () => {
    const start = createTableState(scenario);
    expect(
      run([{ type: "MOVE_CARD", cardId: DRAFT_A, toIndex: 99 }]).hand[7]
    ).toBe(DRAFT_A);
    expect(
      run([{ type: "MOVE_CARD", cardId: DRAFT_A, toIndex: -4 }]).lastEvent
    ).toMatchObject({
      kind: "REFUSED",
      message: "Table 14.1.1 is already first in the hand.",
    });
    const last = start.hand[7];
    expect(
      run([{ type: "MOVE_CARD", cardId: last, toIndex: 7 }]).lastEvent?.message
    ).toContain("already last");
    expect(
      run([{ type: "MOVE_CARD", cardId: start.hand[3], toIndex: 3 }]).lastEvent
        ?.message
    ).toContain("already at position 4");
    const unknown = run([{ type: "MOVE_CARD", cardId: "C-NOPE", toIndex: 0 }]);
    expect(unknown.hand).toEqual(start.hand);
    expect(unknown.lastEvent?.kind).toBe("REFUSED");
  });

  it("keeps selection and inspection state with the card", () => {
    const state = run([
      { type: "TOGGLE_SELECT", cardId: DRAFT_A },
      { type: "MOVE_CARD", cardId: DRAFT_A, toIndex: 5 },
    ]);
    const view = deriveTableView(scenario, state);
    expect(view.hand[5]).toMatchObject({
      selected: true,
      card: { id: DRAFT_A },
    });
  });
});
