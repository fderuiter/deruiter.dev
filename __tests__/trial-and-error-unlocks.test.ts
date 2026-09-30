// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  MAX_STAKE,
  SPONSOR_ORDER,
  STAKES,
  defaultUnlocks,
  emptyCodex,
  isChoiceUnlocked,
  parseCodex,
  recordRun,
  sponsorOptions,
  stakeOptions,
  unlockAfterWin,
  unlockedStake,
  type RunHistoryEntry,
  type Unlocks,
} from "@/lib/trial-and-error";
import { CODEX_KEY, updateCodex } from "@/components/trial-and-error/useCodex";

/** The standard in-memory Storage (AGENTS.md §1). */
class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

function entry(
  seed: string,
  overrides: Partial<RunHistoryEntry> = {}
): RunHistoryEntry {
  return {
    actId: "biostat-ops",
    seed,
    reached: {
      actIndex: 2,
      actTitle: "Act III",
      blindIndex: 2,
      blindTitle: "CSR Lock",
      round: null,
    },
    bestHand: null,
    result: "WON",
    campaignWon: true,
    moves: 40,
    ...overrides,
  };
}

describe("unlock progression (#950)", () => {
  it("opens only Virtual Biotech at stake 1 on a first visit", () => {
    const unlocks = defaultUnlocks();
    expect(unlocks).toEqual({ VIRTUAL_BIOTECH: 1 });
    expect(emptyCodex().unlocks).toEqual(unlocks);
    expect(unlockedStake(unlocks, "VIRTUAL_BIOTECH")).toBe(1);
    for (const id of SPONSOR_ORDER.slice(1)) {
      expect(unlockedStake(unlocks, id)).toBeNull();
    }
    expect(
      isChoiceUnlocked(unlocks, { sponsorId: "VIRTUAL_BIOTECH", stake: 2 })
    ).toBe(false);
  });

  it("treats Virtual Biotech at stake 1 as open even in an empty record", () => {
    expect(unlockedStake({}, "VIRTUAL_BIOTECH")).toBe(1);
    expect(
      isChoiceUnlocked({}, { sponsorId: "VIRTUAL_BIOTECH", stake: 1 })
    ).toBe(true);
  });

  it("unlocks the next stake and the next sponsor on a win", () => {
    const once = unlockAfterWin(defaultUnlocks(), {
      sponsorId: "VIRTUAL_BIOTECH",
      stake: 1,
    });
    expect(once).toEqual({ VIRTUAL_BIOTECH: 2, ONCOLOGY_PHARMA: 1 });
    const oncology = unlockAfterWin(once, {
      sponsorId: "ONCOLOGY_PHARMA",
      stake: 1,
    });
    expect(oncology).toEqual({
      VIRTUAL_BIOTECH: 2,
      ONCOLOGY_PHARMA: 2,
      CARDIO_MEGA_TRIAL: 1,
    });
  });

  it("walks every sponsor to the top of the ladder and stops there", () => {
    let unlocks: Unlocks = defaultUnlocks();
    for (const sponsorId of SPONSOR_ORDER) {
      for (let stake = 1; stake <= MAX_STAKE; stake += 1) {
        expect(isChoiceUnlocked(unlocks, { sponsorId, stake })).toBe(true);
        unlocks = unlockAfterWin(unlocks, { sponsorId, stake });
      }
    }
    for (const sponsorId of SPONSOR_ORDER) {
      expect(unlockedStake(unlocks, sponsorId)).toBe(MAX_STAKE);
    }
    // A win at the top, or with the last sponsor, unlocks nothing more.
    expect(
      unlockAfterWin(unlocks, {
        sponsorId: "RARE_DISEASE_BIOTECH",
        stake: MAX_STAKE,
      })
    ).toBe(unlocks);
  });

  it("never lowers an unlock, and returns the same record when nothing is new", () => {
    const high: Unlocks = { VIRTUAL_BIOTECH: 5, ONCOLOGY_PHARMA: 1 };
    expect(
      unlockAfterWin(high, { sponsorId: "VIRTUAL_BIOTECH", stake: 2 })
    ).toBe(high);
  });

  it("opens a sponsor won from a challenge link, up to the next stake", () => {
    expect(
      unlockAfterWin(defaultUnlocks(), {
        sponsorId: "CARDIO_MEGA_TRIAL",
        stake: 3,
      })
    ).toEqual({
      VIRTUAL_BIOTECH: 1,
      CARDIO_MEGA_TRIAL: 4,
      RARE_DISEASE_BIOTECH: 1,
    });
  });
});

describe("recording unlocks in the Codex (#950)", () => {
  it("unlocks on a won campaign, including one that failed later in post-marketing", () => {
    const won = recordRun(emptyCodex(), entry("win-1"));
    expect(won.unlocks).toEqual({ VIRTUAL_BIOTECH: 2, ONCOLOGY_PHARMA: 1 });
    const postMarketing = recordRun(
      emptyCodex(),
      entry("pm-1", { result: "FAILED", campaignWon: true })
    );
    expect(postMarketing.unlocks).toEqual(won.unlocks);
  });

  it("unlocks nothing on a lost run", () => {
    const lost = recordRun(
      emptyCodex(),
      entry("lost", { result: "FAILED", campaignWon: false })
    );
    expect(lost.history).toHaveLength(1);
    expect(lost.unlocks).toEqual(defaultUnlocks());
  });

  it("uses the run's sponsor and stake", () => {
    const codex = recordRun(
      { ...emptyCodex(), unlocks: { VIRTUAL_BIOTECH: 2, ONCOLOGY_PHARMA: 1 } },
      entry("onc", { sponsorId: "ONCOLOGY_PHARMA", stake: 1 })
    );
    expect(codex.unlocks).toEqual({
      VIRTUAL_BIOTECH: 2,
      ONCOLOGY_PHARMA: 2,
      CARDIO_MEGA_TRIAL: 1,
    });
  });
});

describe("New Run options (#950)", () => {
  it("explains how to unlock each locked sponsor", () => {
    const options = sponsorOptions(defaultUnlocks());
    expect(options.map((o) => o.sponsor.id)).toEqual(SPONSOR_ORDER);
    expect(options[0]).toMatchObject({ unlocked: true, lockedReason: null });
    expect(options.slice(1).map((o) => o.lockedReason)).toEqual([
      "Win a run with Virtual Biotech to unlock.",
      "Win a run with Oncology Pharma to unlock.",
      "Win a run with Cardio Mega-Trial to unlock.",
    ]);
  });

  it("explains how to unlock each locked stake", () => {
    const options = stakeOptions({ VIRTUAL_BIOTECH: 2 }, "VIRTUAL_BIOTECH");
    expect(options.map((o) => o.level)).toEqual(STAKES);
    expect(options.map((o) => o.unlocked)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(options[2].lockedReason).toBe(
      "Win at stake 2 (Sponsor Audit) with Virtual Biotech to unlock."
    );
    expect(
      stakeOptions(defaultUnlocks(), "ONCOLOGY_PHARMA").map(
        (o) => o.lockedReason
      )
    ).toEqual(Array(MAX_STAKE).fill("Unlock Oncology Pharma first."));
  });
});

describe("unlock persistence", () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  const useStorage = (value: unknown) =>
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value,
    });

  let storage: MockStorage;
  beforeEach(() => {
    storage = new MockStorage();
    useStorage(storage);
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
  });

  it("persists a win's unlocks and reads them back", () => {
    expect(updateCodex((codex) => recordRun(codex, entry("stored")))).toBe(
      true
    );
    const stored = parseCodex(storage.getItem(CODEX_KEY));
    expect(stored.status).toBe("OK");
    expect(stored.codex.unlocks).toEqual({
      VIRTUAL_BIOTECH: 2,
      ONCOLOGY_PHARMA: 1,
    });
  });

  it("falls back to Virtual Biotech at stake 1 when storage is unavailable", () => {
    useStorage(undefined);
    expect(updateCodex((codex) => recordRun(codex, entry("nowhere")))).toBe(
      false
    );
    useStorage({
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(updateCodex((codex) => recordRun(codex, entry("blocked")))).toBe(
      false
    );
    expect(parseCodex(null).codex.unlocks).toEqual(defaultUnlocks());
  });
});
