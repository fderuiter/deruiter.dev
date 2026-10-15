// @vitest-environment node
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  DAY_ONE_OPENERS,
  DECK_KEEP_SHARE,
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  STUDY_EVENTS,
  beginStudy,
  createStudy,
  deckDay,
  drawDeck,
  endDay,
  eventDay,
  getEvent,
  inbox,
  readDeck,
  resolveEvent,
  scaleDays,
  studyPreset,
  type StudyLength,
  type StudyState,
} from "@/lib/study-director";
import {
  newWorld,
  parseWorld,
  serializeWorld,
} from "@/lib/study-director-world";
import { uniformAt } from "@/lib/utils/prng";

// #2093: each run deals a seeded deck of events, shuffled within day windows,
// a subset of the optional ones, and late mail for slipped runs.

function fresh(seed: string, length: StudyLength = "full"): StudyState {
  const preset = studyPreset(length);
  return createStudy(seed, preset.setup, preset.sites, preset.team);
}

const start = (seed: string, length: StudyLength = "full") =>
  beginStudy(fresh(seed, length));

/** Ends days without answering anything; returns each day's inbox order. */
function inboxOrder(seed: string): string[][] {
  let s = start(seed);
  const days: string[][] = [];
  for (let i = 0; i < 120 && s.status === "running"; i += 1) {
    days.push(inbox(s).map((e) => e.id));
    s = endDay(s);
  }
  return days;
}

/**
 * Plays a run to the end, answering each message with an option picked from
 * a stream of `salt`, so different salts take different branches.
 */
function play(seed: string, salt: string, length: StudyLength = "full") {
  let s = start(seed, length);
  let k = 0;
  for (let i = 0; i < 200 && s.status === "running"; i += 1) {
    for (const event of inbox(s)) {
      const pick = uniformAt(salt, k++);
      if (pick < 0.15) continue; // leave some to expire
      const option =
        event.options[Math.floor(pick * event.options.length)] ??
        event.options[0];
      const r = resolveEvent(s, event.id, option.id, pick > 0.5);
      if (r.ok) s = r.state;
    }
    s = endDay(s);
  }
  return s;
}

const deckable = STUDY_EVENTS.filter((e) => !e.followUp && !e.wildcard);
const optional = deckable.filter((e) => !e.core && !e.recalls);

describe("the event deck", () => {
  it("deals the same deck from the same seed, and a different one from another", () => {
    const a = start("deck-a").deck;
    expect(start("deck-a").deck).toEqual(a);
    expect(start("deck-b").deck).not.toEqual(a);
    expect(Object.keys(start("deck-b").deck!).sort()).not.toEqual(
      Object.keys(a!).sort()
    );
  });

  it("gives two seeds different inboxes, and replays one exactly", () => {
    const a = inboxOrder("order-a");
    expect(inboxOrder("order-a")).toEqual(a);
    expect(inboxOrder("order-b")).not.toEqual(a);
  });

  it("always deals the core events, and about three quarters of the rest", () => {
    let total = 0;
    const runs = 40;
    for (let i = 0; i < runs; i += 1) {
      const deck = drawDeck(fresh(`share-${i}`)).deck!;
      for (const event of deckable.filter((e) => e.core))
        expect(deck[event.id], event.id).toBeDefined();
      const drawn = optional.filter((e) => deck[e.id] !== undefined).length;
      expect(drawn / optional.length).toBeGreaterThan(0.6);
      expect(drawn / optional.length).toBeLessThan(0.9);
      total += drawn;
    }
    const mean = total / runs / optional.length;
    expect(mean).toBeGreaterThan(DECK_KEEP_SHARE - 0.05);
    expect(mean).toBeLessThan(DECK_KEEP_SHARE + 0.05);
  });

  it("never deals a follow-up or a wildcard", () => {
    const deck = start("no-follow").deck!;
    for (const event of STUDY_EVENTS.filter((e) => e.followUp))
      expect(deck[event.id]).toBeUndefined();
  });

  it("draws each day inside the event's window, scaled for the short study", () => {
    const bounds = (id: string): [number, number] => {
      const event = getEvent(id)!;
      if (event.window) return event.window;
      const spread = Math.min(4, Math.max(1, Math.round(event.day * 0.08)));
      return [Math.max(1, event.day - spread), event.day + spread];
    };
    for (const length of ["full", "short"] as const)
      for (const seed of ["win-1", "win-2", "win-3"]) {
        const s = start(seed, length);
        for (const [id, day] of Object.entries(s.deck!)) {
          if (getEvent(id)?.recalls) continue;
          // A day-1 opener is brought forward from its window (#2254).
          if (day === 1 && DAY_ONE_OPENERS.includes(id)) continue;
          const [lo, hi] = bounds(id);
          expect(day, id).toBeGreaterThanOrEqual(scaleDays(lo, s.setup));
          expect(day, id).toBeLessThanOrEqual(scaleDays(hi, s.setup));
        }
      }
  });

  it("deals a callback only with the event it recalls, and after it", () => {
    for (let i = 0; i < 40; i += 1) {
      const deck = drawDeck(fresh(`recall-${i}`)).deck!;
      for (const event of deckable.filter((e) => e.recalls)) {
        const parent = deck[event.recalls!];
        if (parent === undefined) expect(deck[event.id]).toBeUndefined();
        else expect(deck[event.id]).toBeGreaterThan(parent);
      }
    }
  });

  it("uses its own stream: the wildcards and the study's draws are unchanged", () => {
    const study = fresh("own-stream");
    const dealt = drawDeck(study);
    expect(dealt.draws).toBe(study.draws);
    expect(dealt.scheduled).toEqual(study.scheduled);
    const { deck: _deck, ...rest } = dealt;
    expect(_deck).toBeDefined();
    expect(rest).toEqual(study);
  });
});

describe("follow-up chains under the deck", () => {
  it("never shows a follow-up before its parent, nor without one", () => {
    const scheduledBy = new Map<string, Array<[string, string]>>();
    for (const event of STUDY_EVENTS)
      for (const option of event.options)
        for (const s of option.schedule ?? [])
          scheduledBy.set(s.eventId, [
            ...(scheduledBy.get(s.eventId) ?? []),
            [event.id, option.id],
          ]);
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.string({ minLength: 1, maxLength: 6 }),
        fc.constantFrom<StudyLength>("full", "short"),
        (seed, salt, length) => {
          const s = play(seed, salt, length);
          for (const [id, seenDay] of Object.entries(s.seen)) {
            const event = getEvent(id)!;
            if (event.followUp && !event.wildcard) {
              const parents = scheduledBy.get(id) ?? [];
              const cause = s.log.find((r) =>
                parents.some(([e, o]) => r.eventId === e && r.optionId === o)
              );
              expect(cause, `${id} has no parent decision`).toBeDefined();
              expect(seenDay).toBeGreaterThan(cause!.day);
            }
            if (event.recalls) {
              const parentSeen = s.seen[event.recalls];
              expect(
                parentSeen,
                `${id} without ${event.recalls}`
              ).toBeDefined();
              expect(seenDay).toBeGreaterThan(parentSeen);
              const decided = s.log.find((r) => r.eventId === event.recalls);
              expect(decided).toBeDefined();
              expect(seenDay).toBeGreaterThanOrEqual(decided!.day);
            }
          }
        }
      ),
      { numRuns: 40, seed: 2093 }
    );
  });
});

describe("late study mail", () => {
  const BANDS: Array<[number, number]> = [
    [75, 84],
    [85, 94],
    [95, 104],
    [105, 110],
  ];

  function slippedSeen(seed: string, length: StudyLength): StudyState {
    let s = start(seed, length);
    s = { ...s, slipDays: s.slipDays + 45 };
    for (let i = 0; i < 200 && s.status === "running"; i += 1) s = endDay(s);
    return s;
  }

  it.each(["full", "short"] as const)(
    "reaches every ten-day stretch from day 75 to 110 in a slipped %s run",
    (length) => {
      for (let i = 0; i < 12; i += 1) {
        const s = slippedSeen(`late-${length}-${i}`, length);
        const days = Object.values(s.seen);
        for (const [lo, hi] of BANDS) {
          const from = scaleDays(lo, s.setup);
          const to = scaleDays(hi, s.setup);
          expect(
            days.some((d) => d >= from && d <= to),
            `${length} ${i}: days ${from}-${to}`
          ).toBe(true);
        }
      }
    }
  );

  it("is written past the planned end, so an on-time study never sees it", () => {
    const late = STUDY_EVENTS.filter((e) => e.day > STUDY_24_081.durationDays);
    expect(late.length).toBeGreaterThanOrEqual(BANDS.length);
    for (const event of late) {
      const [lo] = event.window!;
      expect(lo).toBeGreaterThanOrEqual(STUDY_24_081.durationDays - 1);
    }
  });
});

describe("saves from before the deck", () => {
  it("keeps every event on its written day when a run has no deck", () => {
    const legacy = fresh("legacy");
    expect(legacy.deck).toBeUndefined();
    for (const event of STUDY_EVENTS)
      expect(deckDay(legacy, event)).toBe(
        event.followUp ? null : eventDay(legacy, event)
      );
  });

  it("loads an office save without a deck on the fixed days", () => {
    const world = newWorld("old-office", "standard");
    const { deck: _deck, ...study } = world.study;
    expect(_deck).toBeDefined();
    const text = JSON.stringify({ ...world, study });
    const parsed = parseWorld(text)!;
    expect(parsed.study.deck).toBeUndefined();
    expect(serializeWorld(parsed)).toBe(text);
  });

  it("round-trips an office save with its deck", () => {
    const world = newWorld("new-office", "calm", "short");
    const parsed = parseWorld(serializeWorld(world))!;
    expect(parsed.study.deck).toEqual(world.study.deck);
    expect(serializeWorld(parsed)).toBe(serializeWorld(world));
  });

  it("reads a deck strictly", () => {
    expect(readDeck(undefined)).toBeUndefined();
    expect(readDeck([1, 2])).toBeUndefined();
    expect(readDeck("deck")).toBeUndefined();
    expect(
      readDeck({
        "sponsor-biomarkers": 1,
        "lab-manual": 2.5,
        "csr-draft": 0,
        "endpoint-rework": 60,
        "made-up": 4,
        "sponsor-ceo-call": 14,
      })
    ).toEqual({ "sponsor-biomarkers": 1, "sponsor-ceo-call": 14 });
    const world = newWorld("bad-deck", "standard");
    const parsed = parseWorld(
      JSON.stringify({ ...world, study: { ...world.study, deck: "x" } })
    )!;
    expect(parsed.study.deck).toBeUndefined();
  });

  it("starts a scenario study with a deck", () => {
    const s = beginStudy(
      createStudy(
        "scenario",
        STUDY_24_081,
        STUDY_24_081_SITES,
        STUDY_24_081_TEAM
      )
    );
    expect(Object.keys(s.deck!).length).toBeGreaterThan(0);
  });
});
