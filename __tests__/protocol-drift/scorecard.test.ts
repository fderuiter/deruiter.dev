// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildScorecard,
  evaluateBadges,
  queryRestraintLabel,
  queryRestraintRatio,
  type ClinicalQuery,
  type ScorecardInput,
  type Scorecard,
} from "@/lib/protocol-drift";
import { ok, playFullLevel, startEngine } from "./helpers";

function lockedScorecard(): Scorecard {
  const engine = startEngine();
  playFullLevel(engine);
  ok(engine, { type: "REQUEST_LOCK" });
  const locked = ok(engine, { type: "CONFIRM_LOCK" }).find(
    (e) => e.type === "LOCKED"
  );
  if (!locked || locked.type !== "LOCKED") throw new Error("not locked");
  return locked.scorecard;
}

describe("scorecard", () => {
  it("labels restraint ratios", () => {
    expect(queryRestraintRatio(0, 0)).toBeNull();
    expect(queryRestraintRatio(4, 3)).toBe(0.75);
    expect(queryRestraintLabel(null)).toBe("No Queries Sent");
    expect(queryRestraintLabel(1)).toBe("Gold Standard Auditor");
    expect(queryRestraintLabel(0.4)).toBe("Query Spammer");
    expect(queryRestraintLabel(0.5)).toBe("Balanced Inquirer");
  });

  it("awards all three badges for the careful playthrough", () => {
    const card = lockedScorecard();
    expect(card.integrityPassed).toBe(true);
    expect(card.trialDurationDays).toBe(28);
    expect(card.badges.map((b) => [b.id, b.earned])).toEqual([
      ["PREVENTATIVE_ARCHITECT", true],
      ["FORENSIC_SLEUTH", true],
      ["AMENDMENT_NAVIGATOR", true],
    ]);
    expect(card.queryRestraintLabel).toBe("Gold Standard Auditor");
    expect(card.queriesSent).toBe(card.evidenceLinkedQueries);
    expect(card.goodwill["SITE-B"]).toBeLessThanOrEqual(35);
    expect(card.meanGoodwill).toBeCloseTo(
      (card.goodwill["SITE-A"] +
        card.goodwill["SITE-B"] +
        card.goodwill["SITE-C"]) /
        3,
      10
    );
  });

  it("withholds badges and counts only sent queries", () => {
    const q = (sent: number, evidence: boolean) =>
      ({ sentAtMinute: sent, isEvidenceLinked: evidence }) as ClinicalQuery;
    const site = {
      goodwill: 50,
      attention: 100,
      version: "v2",
      latencyHours: 4,
      openQueries: 0,
    } as const;
    const input: ScorecardInput = {
      lockedAtMinute: 0,
      queries: [q(10, false), q(20, false), q(30, true), q(-1, true)],
      sites: {
        "SITE-A": { ...site, siteId: "SITE-A" },
        "SITE-B": { ...site, siteId: "SITE-B" },
        "SITE-C": { ...site, siteId: "SITE-C" },
      },
      regexSplitBeforeNarrative: false,
      sleuthResolvedWithEvidence: false,
      lateBacklogRoutedV1: true,
      applicabilityErrors: 1,
      integrityPassed: false,
    };
    expect(
      evaluateBadges(input).every((b) => !b.earned && b.reason.length > 0)
    ).toBe(true);
    const card = buildScorecard(input);
    expect(card.queriesSent).toBe(3);
    expect(card.queryRestraintLabel).toBe("Query Spammer");
    expect(card.meanGoodwill).toBe(50);
  });
});
