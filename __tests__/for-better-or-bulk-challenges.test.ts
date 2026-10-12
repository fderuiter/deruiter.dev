// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  CHALLENGE_COPY,
  CHALLENGE_IDS,
  DEFAULT_SETUP,
  LEVEL_SECONDS,
  computeReceipt,
  countStars,
  createLevel,
  evaluateChallenges,
  readinessLines,
  type ChallengeId,
  type GameState,
} from "@/lib/for-better-or-bulk";

/** The challenges for a state, with the readiness the receipt would use. */
function challengesOf(state: GameState) {
  return evaluateChallenges(state, readinessLines(state));
}

function met(state: GameState, id: ChallengeId): boolean {
  const found = challengesOf(state).find((c) => c.id === id);
  if (!found) throw new Error(`missing challenge ${id}`);
  return found.met;
}

function detailOf(state: GameState, id: ChallengeId): string | undefined {
  return challengesOf(state).find((c) => c.id === id)?.detail;
}

describe("For Better or Bulk game challenges", () => {
  const base = createLevel(DEFAULT_SETUP);

  it("keeps the copy the owner approved", () => {
    expect(CHALLENGE_COPY).toBe("Game challenges. Not a grade on the wedding.");
  });

  it("lists three challenges in display order", () => {
    expect(CHALLENGE_IDS).toEqual([
      "no-burnt",
      "set-by-three",
      "every-promise-kept",
    ]);
    expect(challengesOf(base).map((c) => c.id)).toEqual(CHALLENGE_IDS);
  });

  it("meets no burnt batches only when none burnt", () => {
    expect(met({ ...base, burntBatches: 0 }, "no-burnt")).toBe(true);
    expect(met({ ...base, burntBatches: 1 }, "no-burnt")).toBe(false);
    const one = challengesOf({ ...base, burntBatches: 1 })[0];
    expect(one?.detail).toBe("1 batch burnt on the grill.");
  });

  it("meets set-by-three at 3:00 or earlier and not after", () => {
    const threeOClock = (base.duration * 6) / 7;
    expect(met({ ...base, finishedAt: threeOClock }, "set-by-three")).toBe(
      true
    );
    expect(met({ ...base, finishedAt: threeOClock - 1 }, "set-by-three")).toBe(
      true
    );
    expect(met({ ...base, finishedAt: threeOClock + 1 }, "set-by-three")).toBe(
      false
    );
    expect(met({ ...base, finishedAt: null }, "set-by-three")).toBe(false);
  });

  it("keeps the 3:00 mark for a relaxed level too", () => {
    const relaxed = createLevel({ ...DEFAULT_SETUP, relaxed: true });
    expect(relaxed.duration).toBeGreaterThan(LEVEL_SECONDS);
    const threeOClock = (relaxed.duration * 6) / 7;
    expect(met({ ...relaxed, finishedAt: threeOClock }, "set-by-three")).toBe(
      true
    );
  });

  it("names the third challenge neutrally, without a person in the label", () => {
    const found = challengesOf(base).find((c) => c.id === "every-promise-kept");
    expect(found?.label).toBe("Every promise kept");
    expect(found?.label).not.toMatch(/fred|abbi/i);
  });

  it("meets every promise when Fred stays or was never called away", () => {
    expect(met({ ...base, presence: null }, "every-promise-kept")).toBe(true);
    expect(
      met(
        { ...base, presence: { choice: "stay", commitment: null } },
        "every-promise-kept"
      )
    ).toBe(true);
  });

  it("does not meet every promise when he leaves with his brothers", () => {
    const left = {
      ...base,
      presence: { choice: "leave", commitment: null },
    } as const;
    expect(met(left, "every-promise-kept")).toBe(false);
    expect(detailOf(left, "every-promise-kept")).toBe(
      "Fred went with his brothers, and the setup carried on without him."
    );
  });

  it("does not meet a break whose promised category is still open", () => {
    const broke = {
      ...base,
      presence: { choice: "break", commitment: "chairs" },
    } as const;
    expect(met(broke, "every-promise-kept")).toBe(false);
    expect(detailOf(broke, "every-promise-kept")).toBe(
      "Fred took a break and promised to come back for the chairs. That work was not done by 4:00."
    );
  });

  it("meets a break whose promised category was finished by the end", () => {
    // Lanterns are not in the cart, so their readiness is not open at all.
    const lanternless = createLevel({
      ...DEFAULT_SETUP,
      cart: { ...DEFAULT_SETUP.cart, lanterns: false },
    });
    const broke = {
      ...lanternless,
      presence: { choice: "break", commitment: "lanterns" },
    } as const;
    expect(met(broke, "every-promise-kept")).toBe(true);
    expect(detailOf(broke, "every-promise-kept")).toContain(
      "promised to come back for the lanterns. That work was done by 4:00."
    );
  });

  it("counts one star for each challenge met", () => {
    const all = challengesOf({
      ...base,
      burntBatches: 0,
      finishedAt: 0,
      presence: null,
    });
    expect(countStars(all)).toBe(3);
    expect(
      countStars(
        evaluateChallenges(
          {
            ...base,
            burntBatches: 2,
            finishedAt: null,
            presence: { choice: "leave", commitment: null },
          },
          readinessLines(base)
        )
      )
    ).toBe(0);
  });

  it("puts the challenges and stars on the receipt", () => {
    const receipt = computeReceipt({
      ...base,
      burntBatches: 0,
      finishedAt: 0,
      presence: null,
    });
    expect(receipt.stars).toBe(3);
    expect(receipt.challenges).toHaveLength(3);
    expect(receipt.disclaimer.length).toBeGreaterThan(0);
  });
});
