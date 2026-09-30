import { describe, it, expect } from "vitest";
import {
  ACT_I,
  BIOSTAT_OPS_CAMPAIGN,
  DEFAULT_SEED,
  RunSaveSchema,
  SPONSORS,
  STAKES,
  advanceRun,
  createRunState,
  deriveRunView,
  lockedRelicSlot,
  parseRunSave,
  planActs,
  raiseQuotas,
  replayRun,
  ruledPlan,
  runBlinds,
  runChoice,
  serializeRun,
  sponsorCardChips,
  stakeCashOut,
  stakeLevels,
  stakeModifiers,
  cashOut,
  type LoggedAction,
  type RunChoice,
  type RunState,
  type SponsorId,
  type Stake,
} from "@/lib/trial-and-error";
import { playBlind } from "./utils/trial-and-error-bot";

const C = BIOSTAT_OPS_CAMPAIGN;
const SAVED_AT = new Date("2026-09-30T00:00:00Z");
const SPONSOR_IDS = Object.keys(SPONSORS) as SponsorId[];
const ALL_STAKES = STAKES.map((s) => s.stake);

/** A run whose current Blind is marked cleared, without playing it. */
const cleared = (run: RunState): RunState => ({
  ...run,
  table: { ...run.table, status: "CLEARED", rewardClaimed: "claimed" },
});

/** Clears Blinds without playing them until the run reaches `actIndex`. */
function skipTo(run: RunState, actIndex: number): RunState {
  let next = run;
  while (next.actIndex < actIndex) {
    next = advanceRun(C, cleared(next), { type: "NEXT_BLIND" });
  }
  return next;
}

/** The first act's Blinds as a run under `choice` plays them. */
const firstBlinds = (choice: Partial<RunChoice>) =>
  runBlinds(C, { bossIds: [null], actIndex: 0, ...choice });

describe("default choice", () => {
  it("is byte-identical to a run created without options", () => {
    for (const seed of [DEFAULT_SEED, "s1", "s2", "fold-7"]) {
      const plain = createRunState(C, seed);
      const chosen = createRunState(C, seed, {
        sponsorId: "VIRTUAL_BIOTECH",
        stake: 1,
      });
      expect(chosen).toStrictEqual(plain);
      expect(JSON.stringify(chosen)).toBe(JSON.stringify(plain));
      expect(plain).not.toHaveProperty("sponsorId");
      expect(plain).not.toHaveProperty("stake");
      expect(plain).not.toHaveProperty("lockedRelicSlot");
    }
  });

  it("plays the authored plan itself", () => {
    expect(ruledPlan(C, { sponsorId: "VIRTUAL_BIOTECH", stake: 1 })).toBe(C);
    expect(runChoice(createRunState(C))).toEqual({
      sponsorId: "VIRTUAL_BIOTECH",
      stake: 1,
    });
  });

  it("rewrites a plan once per choice", () => {
    const choice: RunChoice = { sponsorId: "CARDIO_MEGA_TRIAL", stake: 4 };
    expect(ruledPlan(C, choice)).toBe(ruledPlan(C, { ...choice }));
    expect(ruledPlan(C, choice)).not.toBe(C);
    expect(ruledPlan(C, choice).id).toBe(C.id);
  });

  it("refuses an unknown sponsor or a stake off the ladder", () => {
    expect(() =>
      createRunState(C, "x", { sponsorId: "BIG_PHARMA" as SponsorId })
    ).toThrow(RangeError);
    for (const stake of [0, 7, 2.5]) {
      expect(() => createRunState(C, "x", { stake: stake as Stake })).toThrow(
        RangeError
      );
    }
  });
});

describe("sponsors", () => {
  it("Virtual Biotech has no twist", () => {
    const sponsor = SPONSORS.VIRTUAL_BIOTECH;
    expect(sponsor.twist).toBeNull();
    expect(sponsor.startingRelicId).toBeNull();
    expect(sponsor.startingBudget).toBe(0);
    expect(sponsor.handSizeBonus).toBe(0);
    expect(sponsor.quotaFactor).toBe(1);
    expect(sponsor.cardChips).toEqual([]);
  });

  it("Oncology Pharma starts with Senior Medical Writer, Efficacy Full House at Lv.2 and heavier Figures", () => {
    const run = createRunState(C, "onc", { sponsorId: "ONCOLOGY_PHARMA" });
    expect(run.sponsorId).toBe("ONCOLOGY_PHARMA");
    expect(run.table.relics.map((r) => r.id)).toEqual([
      "REL-SENIOR-MEDICAL-WRITER",
    ]);
    expect(run.table.handLevels.EFFICACY_FULL_HOUSE.level).toBe(2);
    expect(run.table.handLevels.HIGH_TABLE.level).toBe(1);
    expect(run.table.budget).toBe(0);

    const blinds = firstBlinds({ sponsorId: "ONCOLOGY_PHARMA" });
    ACT_I.blinds.forEach((authored, i) => {
      expect(blinds[i].blind.quota).toBe(authored.blind.quota);
      expect(blinds[i].table.handSize).toBe(authored.table.handSize);
      authored.deck.forEach((card, j) => {
        expect(blinds[i].deck[j].chips).toBe(
          card.chips + (card.cardType === "FIGURE" ? 10 : 0)
        );
      });
    });
  });

  it("Cardio Mega-Trial deals +1 hand size, raises quotas ×1.1 and weights Safety outputs", () => {
    const run = createRunState(C, "cardio", {
      sponsorId: "CARDIO_MEGA_TRIAL",
    });
    expect(run.table.relics).toEqual([]);
    expect(run.table.budget).toBe(0);
    const blinds = firstBlinds({ sponsorId: "CARDIO_MEGA_TRIAL" });
    ACT_I.blinds.forEach((authored, i) => {
      expect(blinds[i].table.handSize).toBe(authored.table.handSize + 1);
      expect(blinds[i].blind.quota).toBe(
        raiseQuotas(authored, 1.1).blind.quota
      );
      expect(blinds[i].blind.quota).toBeGreaterThan(authored.blind.quota);
      authored.deck.forEach((card, j) => {
        expect(blinds[i].deck[j].chips).toBe(
          card.chips + (card.population === "SAFETY" ? 10 : 0)
        );
      });
    });
    // The first table deals the larger hand.
    const first = ACT_I.blinds[0];
    expect(run.table.hand).toHaveLength(
      Math.min(first.deck.length, first.table.handSize + 1)
    );
  });

  it("Rare Disease Biotech starts with $10k and scores +5 Chips on every card", () => {
    const run = createRunState(C, "rare", {
      sponsorId: "RARE_DISEASE_BIOTECH",
    });
    expect(run.table.budget).toBe(10);
    expect(run.table.relics).toEqual([]);
    const blinds = firstBlinds({ sponsorId: "RARE_DISEASE_BIOTECH" });
    ACT_I.blinds.forEach((authored, i) => {
      expect(blinds[i].blind.quota).toBe(authored.blind.quota);
      authored.deck.forEach((card, j) => {
        expect(blinds[i].deck[j].chips).toBe(card.chips + 5);
      });
    });
  });

  it("sums every matching card bonus", () => {
    const sponsor = {
      ...SPONSORS.VIRTUAL_BIOTECH,
      cardChips: [
        { chips: 1 },
        { cardType: "FIGURE" as const, chips: 2 },
        { population: "SAFETY" as const, chips: 4 },
      ],
    };
    expect(
      sponsorCardChips(sponsor, { cardType: "FIGURE", population: "SAFETY" })
    ).toBe(7);
    expect(
      sponsorCardChips(sponsor, { cardType: "TABLE", population: "ITT" })
    ).toBe(1);
  });
});

describe("stakes", () => {
  it("Routine Monitoring changes nothing", () => {
    expect(stakeLevels(1).map((l) => l.id)).toEqual(["ROUTINE_MONITORING"]);
    expect(stakeModifiers(1)).toEqual({
      smallBlindPays: true,
      redlinePenaltyFactor: 1,
      shopSurcharge: 0,
      relicSlotLocked: false,
      actQuotaGrowth: 1,
    });
  });

  it("Sponsor Audit withholds a Small Blind's milestone payment only", () => {
    const report = cashOut("SMALL_BLIND", 4, 10);
    const audited = stakeCashOut(report, "SMALL_BLIND", stakeModifiers(2));
    expect(audited.lines.find((l) => l.id === "BASE")?.amount).toBe(0);
    expect(audited.total).toBe(report.total - 3);
    const big = cashOut("BIG_BLIND", 4, 10);
    expect(stakeCashOut(big, "BIG_BLIND", stakeModifiers(2))).toBe(big);
    expect(stakeCashOut(report, "SMALL_BLIND", stakeModifiers(1))).toBe(report);

    // In a run: the first Blind is a Small Blind.
    expect(ACT_I.blinds[0].blind.tier).toBe("SMALL_BLIND");
    const plain = deriveRunView(C, cleared(createRunState(C, "audit")));
    const audit = deriveRunView(
      C,
      cleared(createRunState(C, "audit", { stake: 2 }))
    );
    expect(audit.pendingCashOut!.total).toBe(plain.pendingCashOut!.total - 3);
    expect(
      audit.pendingCashOut!.lines.find((l) => l.id === "BASE")?.amount
    ).toBe(0);
  });

  it("For-Cause Audit doubles every redline Mult penalty", () => {
    const [plain] = firstBlinds({});
    const [audited] = firstBlinds({ stake: 3 });
    const [lower] = firstBlinds({ stake: 2 });
    expect(lower.rulebook).toBe(plain.rulebook);
    plain.rulebook.rules.forEach((rule, i) => {
      expect(audited.rulebook.rules[i].redlineMultPenalty).toBe(
        rule.redlineMultPenalty * 2
      );
    });
    expect(plain.rulebook.rules.some((r) => r.redlineMultPenalty > 0)).toBe(
      true
    );
  });

  it("Regulatory Inspection adds $1k to every shop price and reroll", () => {
    const shopRun = (stake: Stake) =>
      advanceRun(C, cleared(createRunState(C, "inspect", { stake })), {
        type: "CASH_OUT",
      });
    const plain = deriveRunView(C, shopRun(3)).shop!;
    const inspected = deriveRunView(C, shopRun(4)).shop!;
    expect(inspected.rerollPrice).toBe(plain.rerollPrice + 1);
    // The shop stream is unchanged, so the same stock is on offer.
    expect(inspected.items.map((i) => i.name)).toEqual(
      plain.items.map((i) => i.name)
    );
    inspected.items.forEach((item, i) =>
      expect(item.price).toBe(plain.items[i].price + 1)
    );
    inspected.packs.forEach((pack, i) =>
      expect(pack.price).toBe(plain.packs[i].price + 1)
    );
  });

  it("Form 483 locks one relic slot per act from the seeded PRNG", () => {
    const seed = "form-483";
    const run = createRunState(C, seed, { stake: 5 });
    const slot = lockedRelicSlot(seed, 0, 5);
    expect(run.lockedRelicSlot).toBe(slot);
    expect(run.suspendedRelic).toBeNull();
    expect(deriveRunView(C, run).table.relicSlots).toBe(4);
    // Below Form 483 nothing is locked.
    const lower = createRunState(C, seed, { stake: 4 });
    expect(lower).not.toHaveProperty("lockedRelicSlot");
    expect(deriveRunView(C, lower).table.relicSlots).toBe(5);
    // Each act draws its own lock, and the same seed draws the same ones.
    const acts = [0, 1, 2].map(
      (i) => skipTo(createRunState(C, seed, { stake: 5 }), i).lockedRelicSlot
    );
    expect(acts).toEqual([0, 1, 2].map((i) => lockedRelicSlot(seed, i, 5)));
  });

  it("Form 483 suspends a relic in the locked slot for the act, then returns it", () => {
    // A seed whose first act locks slot 0, where Oncology's relic sits, and
    // whose second act locks another slot.
    const seed = Array.from({ length: 500 }, (_, i) => `lock-${i}`).find(
      (s) => lockedRelicSlot(s, 0, 5) === 0 && lockedRelicSlot(s, 1, 5) !== 0
    )!;
    const run = createRunState(C, seed, {
      sponsorId: "ONCOLOGY_PHARMA",
      stake: 5,
    });
    expect(run.table.relics).toEqual([]);
    expect(run.suspendedRelic?.relic.id).toBe("REL-SENIOR-MEDICAL-WRITER");
    expect(run.suspendedRelic?.slot).toBe(0);
    const next = skipTo(run, 1);
    expect(next.table.relics.map((r) => r.id)).toEqual([
      "REL-SENIOR-MEDICAL-WRITER",
    ]);
    expect(next.suspendedRelic).toBeNull();
    expect(next.table.lastEvent?.message).toContain("Form 483");
  });

  it("Form 483 refuses a relic that would fill the locked slot", () => {
    // A seed whose shop offers a relic in its first slot.
    const find = Array.from({ length: 200 }, (_, i) => `rack-${i}`)
      .map((seed) => {
        const base = createRunState(C, seed, { stake: 5 });
        const relics = ACT_I.shop!.entries.flatMap((e) =>
          e.kind === "RELIC" ? [e.relic] : []
        );
        const full: RunState = {
          ...base,
          table: {
            ...base.table,
            budget: 99,
            relics: relics.slice(-4),
          },
        };
        return advanceRun(C, cleared(full), { type: "CASH_OUT" });
      })
      .find((r) => r.shop?.slots[0]?.entry.kind === "RELIC");
    expect(find).toBeDefined();
    const run = find!;
    const view = deriveRunView(C, run);
    expect(view.shop!.items[0].refusal).toContain("Form 483");
    const after = advanceRun(C, run, { type: "BUY", slot: 0 });
    expect(after.table.relics).toHaveLength(4);
    expect(after.table.lastEvent?.kind).toBe("REFUSED");
  });

  it("Warning Letter raises each act's quotas ×1.25 more than the last", () => {
    const acts = planActs(C);
    for (const index of [0, 1, 2]) {
      const blinds = runBlinds(C, {
        bossIds: [null, null, null],
        actIndex: index,
        stake: 6,
      });
      acts[index].blinds.forEach((authored, i) => {
        expect(blinds[i].blind.quota).toBe(
          index === 0
            ? authored.blind.quota
            : raiseQuotas(authored, 1.25 ** index).blind.quota
        );
      });
    }
    expect(
      ruledPlan(C, { sponsorId: "VIRTUAL_BIOTECH", stake: 6 }).endless!
        .quotaGrowth
    ).toBeCloseTo(C.endless!.quotaGrowth * 1.25);
  });
});

describe("restarts, saves and replays", () => {
  it("RESTART_RUN keeps the sponsor and stake", () => {
    const run = createRunState(C, "keep", {
      sponsorId: "RARE_DISEASE_BIOTECH",
      stake: 3,
    });
    const restarted = advanceRun(C, run, {
      type: "RESTART_RUN",
      seed: "other",
    });
    expect(restarted.sponsorId).toBe("RARE_DISEASE_BIOTECH");
    expect(restarted.stake).toBe(3);
    expect(restarted.seed).toBe("other");
    expect(restarted.table.budget).toBe(10);
  });

  it("an older save without a choice still loads as the default", () => {
    const run = createRunState(C, "old");
    const json = JSON.stringify({
      version: 1,
      actId: C.id,
      savedAt: SAVED_AT.toISOString(),
      seed: "old",
      actions: [],
    });
    const restored = parseRunSave(json, [C]);
    expect(restored?.run).toStrictEqual(run);
    expect(restored?.log).toEqual({ actId: C.id, seed: "old", actions: [] });
    // And a default log serializes without the new fields.
    expect(
      serializeRun({ actId: C.id, seed: "old", actions: [] }, SAVED_AT)
    ).toBe(json);
  });

  it("a save records the choice and resumes under it", () => {
    const log = {
      actId: C.id,
      seed: "saved",
      sponsorId: "CARDIO_MEGA_TRIAL" as const,
      stake: 5 as const,
      actions: [] as LoggedAction[],
    };
    const json = serializeRun(log, SAVED_AT);
    expect(RunSaveSchema.parse(JSON.parse(json))).toMatchObject({
      sponsorId: "CARDIO_MEGA_TRIAL",
      stake: 5,
    });
    const restored = parseRunSave(json, [C]);
    expect(restored?.log).toEqual(log);
    expect(restored?.run).toStrictEqual(
      createRunState(C, "saved", { sponsorId: "CARDIO_MEGA_TRIAL", stake: 5 })
    );
    expect(
      RunSaveSchema.safeParse({ ...JSON.parse(json), stake: 7 }).success
    ).toBe(false);
  });

  it("replays deterministically for every sponsor and stake", () => {
    for (const sponsorId of SPONSOR_IDS) {
      for (const stake of ALL_STAKES) {
        const seed = `replay-${sponsorId.toLowerCase().replace(/_/g, "-")}-${stake}`;
        let run = createRunState(C, seed, { sponsorId, stake });
        const actions: LoggedAction[] = [];
        const view = deriveRunView(C, run);
        for (const action of playBlind(view.blind, run.table, "HASTY")
          .actions) {
          if (run.table.status !== "REVIEWING") break;
          if (action.type === "RESET") continue;
          actions.push(action);
          run = advanceRun(C, run, action);
        }
        for (const action of [
          { type: "CASH_OUT" },
          { type: "REROLL" },
          { type: "NEXT_BLIND" },
        ] as LoggedAction[]) {
          actions.push(action);
          run = advanceRun(C, run, action);
        }
        expect(actions.some((a) => a.type === "PLAY_HAND")).toBe(true);
        const log = { actId: C.id, seed, sponsorId, stake, actions };
        const replayed = replayRun(C, log);
        expect(replayed).toStrictEqual(run);
        expect(JSON.stringify(replayRun(C, log))).toBe(JSON.stringify(run));
        const restored = parseRunSave(serializeRun(log, SAVED_AT), [C]);
        if (restored) {
          expect(restored.run.table.budget).toBe(run.table.budget);
          expect(restored.run.draws).toEqual(run.draws);
          expect(runChoice(restored.run)).toEqual({ sponsorId, stake });
        }
      }
    }
  }, 120_000);
});
