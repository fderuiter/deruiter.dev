// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  DEMOGRAPHICS_SCENARIO,
  HandClassificationSchema,
  CsrStageSchema,
  HandTypeSchema,
  classifyHand,
  type ClassifiableCard,
  type HandType,
} from "@/lib/trial-and-error";

let seq = 0;
function c(
  partial: Partial<ClassifiableCard> & Pick<ClassifiableCard, "cardType">
): ClassifiableCard {
  seq += 1;
  return {
    id: partial.id ?? `X${seq}`,
    population: "ITT",
    chips: 10,
    topic: `T${seq}`,
    ...partial,
  };
}

const table = (topic: string, extra: Partial<ClassifiableCard> = {}) =>
  c({ cardType: "TABLE", topic, ...extra });
const listing = (topic: string, extra: Partial<ClassifiableCard> = {}) =>
  c({ cardType: "LISTING", topic, ...extra });
const figure = (topic: string, extra: Partial<ClassifiableCard> = {}) =>
  c({ cardType: "FIGURE", topic, ...extra });
const ids = (cards: ClassifiableCard[], ...indexes: number[]) =>
  indexes.map((i) => cards[i].id);

describe("classifyHand", () => {
  it("returns null for an empty selection", () => {
    expect(classifyHand([])).toBeNull();
  });

  it("scores a lone card as a High Table", () => {
    const cards = [table("DM")];
    expect(classifyHand(cards)).toEqual({
      handType: "HIGH_TABLE",
      scoringCardIds: ids(cards, 0),
    });
  });

  it("scores only the highest-Chips card when nothing combines, first-selected on ties", () => {
    const cards = [
      table("A", { chips: 20 }),
      listing("B", { chips: 30 }),
      figure("C", { chips: 30 }),
    ];
    expect(classifyHand(cards)).toEqual({
      handType: "HIGH_TABLE",
      scoringCardIds: ids(cards, 1),
    });
  });

  it("detects a TLF Pair only for a Table and a Listing on the same topic", () => {
    const pair = [table("AE"), listing("AE"), figure("X")];
    expect(classifyHand(pair)).toEqual({
      handType: "TLF_PAIR",
      scoringCardIds: ids(pair, 0, 1),
    });
    expect(classifyHand([table("AE"), listing("DM")])?.handType).toBe(
      "HIGH_TABLE"
    );
    expect(classifyHand([table("AE"), table("AE")])?.handType).toBe(
      "HIGH_TABLE"
    );
    expect(classifyHand([listing("AE"), listing("AE")])?.handType).toBe(
      "HIGH_TABLE"
    );
  });

  it("picks the richer pair when two pairs share no second table", () => {
    const cards = [
      table("AE", { chips: 10 }),
      listing("AE"),
      table("DM", { chips: 40 }),
      listing("DM"),
    ];
    // Two Pair beats either single pair.
    expect(classifyHand(cards)).toEqual({
      handType: "TLF_TWO_PAIR",
      scoringCardIds: ids(cards, 0, 1, 2, 3),
    });
    const onlyOneListing = [
      table("AE", { chips: 10 }),
      table("DM", { chips: 40 }),
      listing("DM"),
      listing("AE", { cardType: "FIGURE" }),
    ];
    expect(classifyHand(onlyOneListing)).toEqual({
      handType: "TLF_PAIR",
      scoringCardIds: ids(onlyOneListing, 1, 2),
    });
  });

  it("detects TLF Two Pair with either listing order, but not two pairs on one topic", () => {
    const crossed = [table("AE"), table("DM"), listing("DM"), listing("AE")];
    expect(classifyHand(crossed)?.handType).toBe("TLF_TWO_PAIR");
    const sameTopic = [table("AE"), table("AE"), listing("AE"), listing("AE")];
    expect(classifyHand(sameTopic)?.handType).toBe("TLF_PAIR");
    const noMatch = [table("AE"), table("DM"), listing("DS"), listing("AE")];
    expect(classifyHand(noMatch)?.handType).toBe("TLF_PAIR");
  });

  it("detects a Population Flush of five outputs sharing one population", () => {
    const cards = [
      table("A"),
      listing("B"),
      figure("C"),
      table("D"),
      table("E"),
    ];
    expect(classifyHand(cards)).toEqual({
      handType: "POPULATION_FLUSH",
      scoringCardIds: ids(cards, 0, 1, 2, 3, 4),
    });
    const mixed = [...cards.slice(0, 4), table("E", { population: "FAS" })];
    expect(classifyHand(mixed)?.handType).toBe("HIGH_TABLE");
    const tokens = [...cards.slice(0, 4), c({ cardType: "SUBJECT_TOKEN" })];
    expect(classifyHand(tokens)?.handType).not.toBe("POPULATION_FLUSH");
  });

  it("keeps FAS and ITT as different suits for a flush", () => {
    const cards = [
      table("A"),
      table("B"),
      table("C"),
      table("D"),
      table("E", { population: "FAS" }),
    ];
    expect(classifyHand(cards)?.handType).not.toBe("POPULATION_FLUSH");
  });

  it("detects a CSR Straight across all five pipeline stages, in any order", () => {
    const cards = [
      listing("L", { csrStage: "PATIENT_LISTING", population: "SAFETY" }),
      table("E", { csrStage: "EFFICACY", population: "FAS" }),
      table("D", { csrStage: "DISPOSITION" }),
      table("S", { csrStage: "SAFETY_AE", population: "SAFETY" }),
      table("B", { csrStage: "BASELINE" }),
    ];
    expect(classifyHand(cards)?.handType).toBe("CSR_STRAIGHT");
    const missing = [
      ...cards.slice(0, 4),
      table("B2", { csrStage: "EFFICACY" }),
    ];
    expect(classifyHand(missing)?.handType).not.toBe("CSR_STRAIGHT");
  });

  it("prefers a Straight over a Flush when the same five cards make both", () => {
    const stages = [
      "DISPOSITION",
      "BASELINE",
      "EFFICACY",
      "SAFETY_AE",
      "PATIENT_LISTING",
    ] as const;
    const cards = stages.map((s, i) => table(`T${i}`, { csrStage: s }));
    expect(classifyHand(cards)?.handType).toBe("CSR_STRAIGHT");
  });

  it("detects an Efficacy Full House only when both Figures depend on a Table in hand", () => {
    const cards = [
      table("EFF"),
      table("PFS"),
      table("OS"),
      figure("EFF"),
      figure("OS"),
    ];
    expect(classifyHand(cards)?.handType).toBe("EFFICACY_FULL_HOUSE");
    const orphan = [
      table("EFF"),
      table("PFS"),
      table("OS"),
      figure("EFF"),
      figure("QOL"),
    ];
    expect(classifyHand(orphan)?.handType).not.toBe("EFFICACY_FULL_HOUSE");
    const wrongShape = [
      table("EFF"),
      table("PFS"),
      figure("PFS"),
      figure("EFF"),
      figure("EFF"),
    ];
    expect(classifyHand(wrongShape)?.handType).not.toBe("EFFICACY_FULL_HOUSE");
  });

  it("detects MedDRA Five of a Kind: five Tables with five distinct SOCs", () => {
    const socs = [
      "Cardiac",
      "Hepatobiliary",
      "Nervous system",
      "Renal",
      "Skin",
    ];
    const cards = socs.map((soc, i) =>
      table(`S${i}`, { soc, population: i % 2 ? "SAFETY" : "ITT" })
    );
    expect(classifyHand(cards)?.handType).toBe("MEDDRA_FIVE_OF_A_KIND");
    const repeated = [...cards.slice(0, 4), table("S9", { soc: "Cardiac" })];
    expect(classifyHand(repeated)?.handType).not.toBe("MEDDRA_FIVE_OF_A_KIND");
    const untagged = [...cards.slice(0, 4), table("S9")];
    expect(classifyHand(untagged)?.handType).not.toBe("MEDDRA_FIVE_OF_A_KIND");
  });

  it("ranks Five of a Kind above a Flush made by the same cards", () => {
    const cards = ["A", "B", "C", "D", "E"].map((soc) => table(soc, { soc }));
    expect(classifyHand(cards)?.handType).toBe("MEDDRA_FIVE_OF_A_KIND");
  });

  it("returns ids in selection order and only for scoring cards", () => {
    const cards = [figure("X", { chips: 90 }), listing("AE"), table("AE")];
    const result = classifyHand(cards);
    expect(result).toEqual({
      handType: "TLF_PAIR",
      scoringCardIds: ids(cards, 1, 2),
    });
    expect(HandClassificationSchema.safeParse(result).success).toBe(true);
  });

  it("finds a Two Pair, a Pair and a Flush in the shipped Small Blind deck", () => {
    const deck = DEMOGRAPHICS_SCENARIO.deck;
    const pick = (...cardIds: string[]) =>
      cardIds.map((id) => deck.find((card) => card.id === id)!);
    expect(
      classifyHand(pick("C-T14.1.1-A", "C-L16.2.4", "C-T14.3.1", "C-L16.2.7"))
        ?.handType
    ).toBe("TLF_TWO_PAIR");
    expect(classifyHand(pick("C-T14.1.1-A", "C-L16.2.4"))?.handType).toBe(
      "TLF_PAIR"
    );
    expect(
      classifyHand(
        pick(
          "C-T14.1.1-A",
          "C-L16.2.4",
          "C-T14.1.2",
          "C-L16.1.1",
          "C-T14.1.1-B"
        )
      )?.handType
    ).toBe("POPULATION_FLUSH");
  });
});

describe("classifyHand restricted to a stage's hands", () => {
  it("finds an accepted pair inside a Two Pair the stage refuses", () => {
    const cards = [
      table("AE", { chips: 20 }),
      listing("AE"),
      table("DM", { chips: 30 }),
      listing("DM"),
    ];
    expect(classifyHand(cards)?.handType).toBe("TLF_TWO_PAIR");
    // The pair with more Chips wins, as without a restriction.
    expect(
      classifyHand(cards, ["HIGH_TABLE", "TLF_PAIR", "POPULATION_FLUSH"])
    ).toEqual({ handType: "TLF_PAIR", scoringCardIds: ids(cards, 2, 3) });
  });

  it("classifies a Full House that is also a Population Flush as the Full House", () => {
    const cards = [
      table("EFF"),
      table("AE"),
      table("LAB"),
      figure("EFF"),
      figure("AE"),
    ].map((card) => ({ ...card, population: "SAFETY" as const }));
    expect(classifyHand(cards, ["EFFICACY_FULL_HOUSE"])?.handType).toBe(
      "EFFICACY_FULL_HOUSE"
    );
    expect(classifyHand(cards, ["POPULATION_FLUSH"])?.handType).toBe(
      "POPULATION_FLUSH"
    );
  });

  it("falls back to the unrestricted hand when no accepted hand matches", () => {
    const cards = [table("AE"), listing("AE")];
    expect(classifyHand(cards, ["EFFICACY_FULL_HOUSE"])).toEqual(
      classifyHand(cards)
    );
    expect(classifyHand([], ["TLF_PAIR"])).toBeNull();
  });

  const cardArb = fc.record({
    cardType: fc.constantFrom("TABLE", "LISTING", "FIGURE" as const),
    topic: fc.constantFrom("AE", "DM", "EFF"),
    population: fc.constantFrom("ITT", "SAFETY" as const),
    chips: fc.integer({ min: 0, max: 40 }),
    csrStage: fc.option(fc.constantFrom(...CsrStageSchema.options), {
      nil: undefined,
    }),
  });
  const selectionArb = fc
    .array(cardArb, { minLength: 1, maxLength: 5 })
    .map((cards) =>
      cards.map((card, i): ClassifiableCard => ({ ...card, id: `P${i}` }))
    );
  const allowedArb = fc.subarray([...HandTypeSchema.options] as HandType[], {
    minLength: 1,
  });

  it("returns an allowed hand, or exactly the unrestricted one", () => {
    fc.assert(
      fc.property(selectionArb, allowedArb, (cards, allowed) => {
        const restricted = classifyHand(cards, allowed);
        const unrestricted = classifyHand(cards);
        return (
          (restricted !== null && allowed.includes(restricted.handType)) ||
          JSON.stringify(restricted) === JSON.stringify(unrestricted)
        );
      })
    );
  });

  it("is unchanged when every hand is allowed", () => {
    fc.assert(
      fc.property(selectionArb, (cards) => {
        expect(classifyHand(cards, HandTypeSchema.options)).toEqual(
          classifyHand(cards)
        );
      })
    );
  });
});
