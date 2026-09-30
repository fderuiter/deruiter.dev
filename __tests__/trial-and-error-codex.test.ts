// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ACT_I,
  ACT_I_CRISES,
  BIOSTAT_OPS_CAMPAIGN,
  CODEX_VERSION,
  FDA_IR_SCENARIO,
  GUIDANCE_CARDS,
  RUN_HISTORY_LIMIT,
  SPONSORS,
  advanceRun,
  createRunState,
  deriveCodexView,
  deriveRunView,
  emptyCodex,
  migrateCodex,
  parseCodex,
  recordDiscoveries,
  recordRun,
  runBlinds,
  serializeCodex,
  summarizeRun,
  type Act,
  type Codex,
  type CodexRunRef,
  type RunAction,
  type RunHistoryEntry,
  type RunLog,
  type RunState,
} from "@/lib/trial-and-error";
import { CODEX_KEY, updateCodex } from "@/components/trial-and-error/useCodex";
import { playBlind } from "./utils/trial-and-error-bot";

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

/** Act I without its crisis deck, so flows test one thing at a time. */
const act: Act = { ...ACT_I, crisisDeck: undefined };
const REF: CodexRunRef = { actId: act.id, seed: "codex-1" };
const LATER: CodexRunRef = {
  actId: act.id,
  seed: "7K3M-Q9PX",
  origin: { kind: "SEEDED" },
};

type Logged = Exclude<RunAction, { type: "RESTART_RUN" }>;
const apply = (run: RunState, ...actions: RunAction[]) =>
  actions.reduce((r, a) => advanceRun(act, r, a), run);

/** The Small Blind's supporting pair, selected and played. */
const OPENING: Logged[] = [
  { type: "TOGGLE_SELECT", cardId: "C-T14.1.1-A" },
  { type: "TOGGLE_SELECT", cardId: "C-L16.2.4" },
  { type: "PLAY_HAND" },
];

/** Clears the current Blind with the median bot's line. */
function clearBlind(run: RunState): RunState {
  const blind = runBlinds(act, run)[run.blindIndex];
  let next = run;
  for (const action of playBlind(blind, run.table, "MEDIAN").actions) {
    if (next.table.status !== "REVIEWING") break;
    if (action.type === "RESET") continue;
    next = advanceRun(act, next, action);
  }
  expect(next.table.status).toBe("CLEARED");
  return next;
}

/** Single cards until CPU runs out: the Small Blind, and the run, is lost. */
function losingLog(seed: string): RunLog {
  let run = createRunState(act, seed);
  const actions: Logged[] = [];
  while (run.table.status === "REVIEWING" && actions.length < 40) {
    for (const action of [
      { type: "TOGGLE_SELECT", cardId: run.table.hand[0] },
      { type: "PLAY_HAND" },
    ] as const) {
      actions.push(action);
      run = advanceRun(act, run, action);
    }
  }
  expect(deriveRunView(act, run).phase).toBe("RUN_FAILED");
  return { actId: act.id, seed, actions, origin: { kind: "SEEDED" } };
}

function historyEntry(seed: string, moves = 3): RunHistoryEntry {
  return {
    actId: act.id,
    seed,
    reached: {
      actIndex: 0,
      actTitle: "Act I",
      blindIndex: 0,
      blindTitle: "Small Blind",
      round: null,
    },
    bestHand: { handType: "TLF_PAIR", score: 120 },
    result: "FAILED",
    campaignWon: false,
    moves,
  };
}

describe("Codex discoveries", () => {
  it("records the sponsor and a played hand with the run first seen in", () => {
    const run = apply(createRunState(act, REF.seed), ...OPENING);
    const codex = recordDiscoveries(emptyCodex(), act, run, REF);
    expect(codex.discovered.SPONSOR.VIRTUAL_BIOTECH).toEqual({
      firstSeen: REF,
      via: "SPONSOR",
    });
    const handType = run.table.lastPlay!.classification.handType;
    expect(codex.discovered.HAND[handType]).toEqual({
      firstSeen: REF,
      via: "PLAYED",
    });
  });

  it("never overwrites an entry's first-seen run", () => {
    const run = apply(createRunState(act, REF.seed), ...OPENING);
    const first = recordDiscoveries(emptyCodex(), act, run, REF);
    const again = recordDiscoveries(first, act, run, LATER);
    expect(again.discovered.SPONSOR.VIRTUAL_BIOTECH.firstSeen).toEqual(REF);
  });

  it("is idempotent: nothing new returns the same Codex object", () => {
    const run = apply(createRunState(act, REF.seed), ...OPENING);
    const first = recordDiscoveries(emptyCodex(), act, run, REF);
    expect(recordDiscoveries(first, act, run, REF)).toBe(first);
    expect(recordDiscoveries(first, act, run, LATER)).toBe(first);
  });

  it("does not mutate the Codex it is given", () => {
    const empty = emptyCodex();
    const snapshot = structuredClone(empty);
    recordDiscoveries(empty, act, createRunState(act, "x"), REF);
    expect(empty).toEqual(snapshot);
  });

  it("records shop stock as seen in the shop, and a pack's cards as seen in a pack", () => {
    const cleared = clearBlind(createRunState(act, "fold-change"));
    const paid = apply(cleared, { type: "CASH_OUT" });
    const shop = { ...paid, table: { ...paid.table, budget: 100 } };
    const codex = recordDiscoveries(emptyCodex(), act, shop, REF);
    for (const slot of shop.shop!.slots) {
      const entry = slot.entry;
      const [category, id] =
        entry.kind === "RELIC"
          ? (["RELIC", entry.relic.id] as const)
          : entry.kind === "GUIDANCE"
            ? (["GUIDANCE", entry.guidance.id] as const)
            : entry.kind === "SEAL"
              ? (["SEAL", entry.seal.id] as const)
              : ([null, null] as const);
      if (!category) continue;
      expect(codex.discovered[category][id].via).toBe("SHOP");
    }
    const packSlot = shop.shop!.packs.findIndex(
      (p) => p.pack.kind !== "SITE_ACTIVATION"
    );
    const opened = apply(shop, { type: "BUY_PACK", slot: packSlot });
    const cards = opened.shop!.opened!.cards;
    expect(cards.length).toBeGreaterThan(0);
    const after = recordDiscoveries(emptyCodex(), act, opened, REF);
    for (const card of cards) {
      if (card.kind !== "ENTRY") continue;
      const entry = card.entry;
      if (entry.kind === "RELIC") {
        expect(after.discovered.RELIC[entry.relic.id].via).toBe("PACK");
      } else if (entry.kind === "GUIDANCE") {
        expect(after.discovered.GUIDANCE[entry.guidance.id].via).toBe("PACK");
      }
    }
  });

  it("records a Boss when the run meets it, and a drawn crisis", () => {
    const bossPlan: Act = {
      id: "boss-only",
      title: "Boss",
      blinds: [FDA_IR_SCENARIO],
    };
    const run = createRunState(bossPlan, "boss-1");
    const codex = recordDiscoveries(emptyCodex(), bossPlan, run, REF);
    expect(codex.discovered.BOSS[FDA_IR_SCENARIO.boss!.id].via).toBe("BOSS");

    const crisis = ACT_I_CRISES[0];
    const withCrisis: RunState = {
      ...createRunState(ACT_I, "crisis-1"),
      draws: [
        {
          drawIndex: 0,
          kind: "CRISIS",
          id: crisis.id,
          actIndex: 0,
          blindIndex: 1,
        },
      ],
    };
    const drawn = recordDiscoveries(emptyCodex(), ACT_I, withCrisis, REF);
    expect(drawn.discovered.CRISIS[crisis.id].via).toBe("CRISIS");
  });
});

describe("run history", () => {
  it("keeps the newest runs first, capped at the limit", () => {
    let codex = emptyCodex();
    for (let i = 0; i < RUN_HISTORY_LIMIT + 3; i += 1) {
      codex = recordRun(codex, historyEntry(`seed-${i}`));
    }
    expect(codex.history).toHaveLength(RUN_HISTORY_LIMIT);
    expect(codex.history[0].seed).toBe(`seed-${RUN_HISTORY_LIMIT + 2}`);
    expect(codex.history.at(-1)!.seed).toBe("seed-3");
  });

  it("records the same finished run once", () => {
    const once = recordRun(emptyCodex(), historyEntry("dup"));
    expect(recordRun(once, historyEntry("dup"))).toBe(once);
    expect(recordRun(once, historyEntry("dup", 5)).history).toHaveLength(2);
  });

  it("summarizes a finished run from its log: reached, best hand, result, origin", () => {
    const log = losingLog("codex-lost");
    const entry = summarizeRun(act, log, "2026-09-30")!;
    expect(entry).toMatchObject({
      actId: act.id,
      seed: "codex-lost",
      origin: { kind: "SEEDED" },
      result: "FAILED",
      campaignWon: false,
      moves: log.actions.length,
      endedOn: "2026-09-30",
      reached: { actIndex: 0, blindIndex: 0, round: null },
    });
    expect(entry.reached.blindTitle).toBe(act.blinds[0].title);
    expect(entry.bestHand).not.toBeNull();
    expect(entry.bestHand!.score).toBeGreaterThanOrEqual(0);
  });

  it("summarizes nothing while the run is still live", () => {
    expect(
      summarizeRun(act, { actId: act.id, seed: "live", actions: OPENING })
    ).toBeNull();
  });
});

describe("the Codex view", () => {
  it("lists every entry of the plan, silhouetted until discovered", () => {
    const run = apply(createRunState(act, REF.seed), ...OPENING);
    const codex = recordDiscoveries(emptyCodex(), act, run, REF);
    const view = deriveCodexView(BIOSTAT_OPS_CAMPAIGN, codex);
    const byCategory = Object.fromEntries(view.map((s) => [s.category, s]));
    expect(byCategory.SPONSOR.entries).toHaveLength(
      Object.keys(SPONSORS).length
    );
    expect(byCategory.HAND.entries.length).toBeGreaterThanOrEqual(5);
    for (const card of Object.values(GUIDANCE_CARDS)) {
      expect(byCategory.GUIDANCE.entries.map((e) => e.id)).toContain(card.id);
    }
    for (const section of view) {
      expect(section.entries.length).toBeGreaterThan(0);
      for (const entry of section.entries) {
        expect(entry.teaser.length).toBeGreaterThan(0);
        expect(entry.teaser).not.toMatch(/—/);
      }
    }
    const sponsor = byCategory.SPONSOR.entries.find(
      (e) => e.id === "VIRTUAL_BIOTECH"
    )!;
    expect(sponsor.discovery?.firstSeen).toEqual(REF);
    expect(byCategory.SPONSOR.discovered).toBe(1);
    expect(
      byCategory.RELIC.entries.every((entry) => entry.discovery === null)
    ).toBe(true);
  });
});

describe("the stored document", () => {
  const discovered = (): Codex =>
    recordRun(
      recordDiscoveries(
        emptyCodex(),
        act,
        apply(createRunState(act, REF.seed), ...OPENING),
        LATER
      ),
      historyEntry("stored")
    );

  it("round-trips a v2 document with no data loss", () => {
    const codex = discovered();
    const read = parseCodex(serializeCodex(codex));
    expect(read.status).toBe("OK");
    expect(read.codex).toEqual(codex);
  });

  it("reads a v1 document written by hand, keeping ids this build no longer shows", () => {
    const v1 = {
      version: 1,
      discovered: {
        RELIC: {
          "REL-RETIRED": {
            firstSeen: {
              actId: "biostat-ops",
              seed: "fold-change",
              origin: { kind: "DAILY", date: "2026-09-29" },
            },
            via: "SHOP",
          },
        },
        GUIDANCE: {},
        SEAL: {},
        BOSS: {},
        CRISIS: {},
        HAND: {},
        SPONSOR: {},
      },
      history: [historyEntry("v1-run")],
    };
    expect(CODEX_VERSION).toBe(2);
    // v1 to v2 (#950) adds unlocks and keeps every entry and the history.
    const v2 = {
      ...v1,
      version: 2,
      unlocks: { VIRTUAL_BIOTECH: 1 },
    };
    const migrated = migrateCodex(v1);
    expect(migrated).toEqual(v2);
    const read = parseCodex(JSON.stringify(v1));
    expect(read.status).toBe("OK");
    expect(read.codex).toEqual(v2);
    // Re-serialising keeps the retired entry: nothing is dropped.
    expect(JSON.parse(serializeCodex(read.codex))).toEqual(v2);
  });

  it("migrates v1 wins into v2 unlocks, oldest win first", () => {
    const won = (
      seed: string,
      choice: Partial<RunHistoryEntry>
    ): RunHistoryEntry => ({
      ...historyEntry(seed),
      ...choice,
      result: "WON",
      campaignWon: true,
    });
    const v1 = {
      ...JSON.parse(serializeCodex(emptyCodex())),
      version: 1,
      // Newest first, as the history keeps it.
      history: [
        won("third", { sponsorId: "ONCOLOGY_PHARMA", stake: 1 }),
        historyEntry("lost"),
        won("second", { stake: 2 }),
        won("first", {}),
      ],
    };
    delete v1.unlocks;
    const read = parseCodex(JSON.stringify(v1));
    expect(read.status).toBe("OK");
    expect(read.codex.history).toEqual(v1.history);
    expect(read.codex.unlocks).toEqual({
      VIRTUAL_BIOTECH: 3,
      ONCOLOGY_PHARMA: 2,
      CARDIO_MEGA_TRIAL: 1,
    });
  });

  it("rejects a v2 document with an unknown sponsor or a stake off the ladder", () => {
    const good = JSON.parse(serializeCodex(emptyCodex()));
    for (const unlocks of [
      { GENERIC_CRO: 1 },
      { VIRTUAL_BIOTECH: 7 },
      { VIRTUAL_BIOTECH: 0 },
      { VIRTUAL_BIOTECH: 1.5 },
      [],
    ]) {
      expect(parseCodex(JSON.stringify({ ...good, unlocks })).status).toBe(
        "INVALID"
      );
    }
    expect(
      parseCodex(JSON.stringify({ ...good, unlocks: undefined })).status
    ).toBe("INVALID");
  });

  it("degrades corrupt, invalid or unknown documents to an empty Codex", () => {
    const good = JSON.parse(serializeCodex(discovered()));
    const tooLong = {
      ...good,
      history: Array.from({ length: RUN_HISTORY_LIMIT + 1 }, (_, i) =>
        historyEntry(`h-${i}`)
      ),
    };
    const invalid = [
      "{not json",
      "42",
      "null",
      "[]",
      JSON.stringify({ ...good, version: undefined }),
      JSON.stringify({ ...good, version: 0 }),
      JSON.stringify({ ...good, version: "1" }),
      JSON.stringify({ ...good, discovered: { RELIC: {} } }),
      JSON.stringify({
        ...good,
        discovered: {
          ...good.discovered,
          HAND: { TLF_PAIR: { firstSeen: REF, via: "TELEPORT" } },
        },
      }),
      JSON.stringify({
        ...good,
        discovered: {
          ...good.discovered,
          RELIC: { "has spaces": { firstSeen: REF, via: "SHOP" } },
        },
      }),
      JSON.stringify(tooLong),
    ];
    for (const json of invalid) {
      const read = parseCodex(json);
      expect(read.status).toBe("INVALID");
      expect(read.codex).toEqual(emptyCodex());
    }
    expect(parseCodex(null).status).toBe("EMPTY");
    expect(parseCodex("").status).toBe("EMPTY");
    const newer = parseCodex(
      JSON.stringify({ ...good, version: CODEX_VERSION + 1 })
    );
    expect(newer).toEqual({ codex: emptyCodex(), status: "NEWER" });
  });
});

describe("the storage adapter", () => {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  let storage: MockStorage;
  const useStorage = (value: unknown) =>
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value,
    });
  const discover = (codex: Codex) =>
    recordDiscoveries(
      codex,
      act,
      apply(createRunState(act, REF.seed), ...OPENING),
      REF
    );

  beforeEach(() => {
    storage = new MockStorage();
    useStorage(storage);
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, "localStorage", original);
  });

  it("persists discoveries, and writes nothing when nothing is new", () => {
    expect(updateCodex(discover)).toBe(true);
    const stored = storage.getItem(CODEX_KEY)!;
    expect(parseCodex(stored).codex.discovered.SPONSOR).toHaveProperty(
      "VIRTUAL_BIOTECH"
    );
    expect(updateCodex(discover)).toBe(false);
    expect(storage.getItem(CODEX_KEY)).toBe(stored);
  });

  it("replaces corrupt JSON on the next discovery", () => {
    storage.setItem(CODEX_KEY, "{not json");
    expect(updateCodex(discover)).toBe(true);
    expect(parseCodex(storage.getItem(CODEX_KEY)).status).toBe("OK");
  });

  it("never overwrites a Codex a newer build wrote", () => {
    const newer = JSON.stringify({ version: CODEX_VERSION + 1, extra: true });
    storage.setItem(CODEX_KEY, newer);
    expect(updateCodex(discover)).toBe(false);
    expect(storage.getItem(CODEX_KEY)).toBe(newer);
  });

  it("swallows a quota error on write", () => {
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(() => updateCodex(discover)).not.toThrow();
    expect(updateCodex(discover)).toBe(false);
  });

  it("survives storage that is missing or throws on access", () => {
    useStorage(undefined);
    expect(updateCodex(discover)).toBe(false);
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
    expect(() => updateCodex(discover)).not.toThrow();
    expect(updateCodex(discover)).toBe(false);
    useStorage({ getItem: "nope", setItem: "nope" });
    expect(updateCodex(discover)).toBe(false);
  });
});
