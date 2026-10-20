// @vitest-environment node
import { describe, it, expect } from "vitest";
import { fromPartial } from "@total-typescript/shoehorn";
import { describeBlindLoss, type TableView } from "@/lib/trial-and-error";

const failed = (view: Partial<TableView>) =>
  describeBlindLoss(
    fromPartial<TableView>({
      outcome: "FAILED",
      clock: null,
      quota: 2000,
      roundScore: 2500,
      scoreLog: [],
      modifiers: [],
      handsLeft: null,
      hand: [fromPartial({})],
      ...view,
    })
  );

describe("describeBlindLoss branches (#1944)", () => {
  it("never reports a negative shortfall", () => {
    expect(failed({})).toMatch(/^0 short\. No hand was played\./);
    expect(failed({ clock: fromPartial({ hold: false }) })).toMatch(/^0 short/);
  });

  it('takes "an" before a hand name that starts with a vowel (#2154)', () => {
    const best = (name: string) =>
      failed({ scoreLog: [fromPartial({ name, score: 7714 })] });
    expect(best("Efficacy Full House")).toContain(
      "Your best hand was an Efficacy Full House (7714)."
    );
    expect(best("TLF Pair")).toContain("Your best hand was a TLF Pair (7714).");
  });

  it("names the tightest of several hand limits, in the singular for one", () => {
    const text = failed({
      handsLeft: 0,
      modifiers: [
        fromPartial({
          name: "Loose",
          debuffType: "HAND_LIMIT",
          maxHandsAllowed: 3,
        }),
        fromPartial({
          name: "Tight",
          debuffType: "HAND_LIMIT",
          maxHandsAllowed: 1,
        }),
        fromPartial({
          name: "Looser",
          debuffType: "HAND_LIMIT",
          maxHandsAllowed: 4,
        }),
        fromPartial({ name: "Unset", debuffType: "HAND_LIMIT" }),
      ],
    });
    expect(text).toContain("Tight left 1 hand.");
    expect(text).not.toContain("Loose left");
  });

  it("does not blame a hand limit while hands remain", () => {
    expect(
      failed({
        handsLeft: 1,
        modifiers: [
          fromPartial({
            name: "Tight",
            debuffType: "HAND_LIMIT",
            maxHandsAllowed: 2,
          }),
        ],
      })
    ).toContain("The CPU ran out before another hand.");
  });

  it("names the zeroed sets when most populations still count", () => {
    expect(
      failed({
        modifiers: [
          fromPartial({
            name: "Audit Hold",
            debuffType: "DISABLE_POPULATION",
            disabledPopulations: ["ITT", "FAS"],
          }),
        ],
      })
    ).toContain("Audit Hold zeroed ITT and FAS outputs.");
  });

  it("names the kept sets when most populations are zeroed", () => {
    expect(
      failed({
        modifiers: [
          fromPartial({
            name: "Lockdown",
            debuffType: "DISABLE_POPULATION",
            disabledPopulations: ["SCREENED", "ITT", "PER_PROTOCOL", "FAS"],
          }),
        ],
      })
    ).toContain("Lockdown counted only Safety outputs.");
  });

  it("says zeroed when every population is off", () => {
    expect(
      failed({
        modifiers: [
          fromPartial({
            name: "Total Hold",
            debuffType: "DISABLE_POPULATION",
            disabledPopulations: [
              "SCREENED",
              "ITT",
              "SAFETY",
              "PER_PROTOCOL",
              "FAS",
            ],
          }),
        ],
      })
    ).toContain("Total Hold zeroed");
  });

  it("skips population modifiers that zero nothing, and other debuffs", () => {
    const text = failed({
      modifiers: [
        fromPartial({
          name: "Empty",
          debuffType: "DISABLE_POPULATION",
          disabledPopulations: [],
        }),
        fromPartial({ name: "Missing", debuffType: "DISABLE_POPULATION" }),
        fromPartial({ name: "Other", debuffType: "HAND_LIMIT" }),
      ],
    });
    expect(text).not.toContain("Empty");
    expect(text).not.toContain("Missing");
    expect(text).toBe(
      "0 short. No hand was played. The CPU ran out before another hand."
    );
  });

  it("keeps the first of the best hands and notices an empty deck", () => {
    expect(
      failed({
        roundScore: 900,
        hand: [],
        scoreLog: [
          fromPartial({ name: "Flush", score: 600 }),
          fromPartial({ name: "Pair", score: 300 }),
          fromPartial({ name: "Straight", score: 600 }),
        ],
      })
    ).toBe(
      "1100 short. Your best hand was a Flush (600). The deck ran out of outputs."
    );
  });
});
