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
  type ChallengeId,
  type GameState,
} from "@/lib/for-better-or-bulk";

function met(state: GameState, id: ChallengeId): boolean {
  const found = evaluateChallenges(state).find((c) => c.id === id);
  if (!found) throw new Error(`missing challenge ${id}`);
  return found.met;
}

describe("For Better or Bulk game challenges", () => {
  const base = createLevel(DEFAULT_SETUP);

  it("keeps the copy the owner approved", () => {
    expect(CHALLENGE_COPY).toBe("Game challenges. Not a grade on the wedding.");
  });

  it("lists three challenges in display order", () => {
    expect(CHALLENGE_IDS).toEqual(["no-burnt", "set-by-three", "fred-stayed"]);
    expect(evaluateChallenges(base).map((c) => c.id)).toEqual(CHALLENGE_IDS);
  });

  it("meets no burnt batches only when none burnt", () => {
    expect(met({ ...base, burntBatches: 0 }, "no-burnt")).toBe(true);
    expect(met({ ...base, burntBatches: 1 }, "no-burnt")).toBe(false);
    const one = evaluateChallenges({ ...base, burntBatches: 1 })[0];
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

  it("meets Fred stayed unless he went out", () => {
    expect(met({ ...base, presence: null }, "fred-stayed")).toBe(true);
    expect(
      met(
        { ...base, presence: { choice: "stay", commitment: null } },
        "fred-stayed"
      )
    ).toBe(true);
    expect(
      met(
        { ...base, presence: { choice: "break", commitment: "chairs" } },
        "fred-stayed"
      )
    ).toBe(false);
    expect(
      met(
        { ...base, presence: { choice: "leave", commitment: null } },
        "fred-stayed"
      )
    ).toBe(false);
  });

  it("counts one star for each challenge met", () => {
    const all = evaluateChallenges({
      ...base,
      burntBatches: 0,
      finishedAt: 0,
      presence: null,
    });
    expect(countStars(all)).toBe(3);
    expect(
      countStars(
        evaluateChallenges({
          ...base,
          burntBatches: 2,
          finishedAt: null,
          presence: { choice: "leave", commitment: null },
        })
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
