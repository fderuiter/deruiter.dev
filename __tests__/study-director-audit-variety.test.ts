// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  STUDY_EVENTS,
  applyDifficulty,
  beginStudy,
  createStudy,
  endDay,
  finalizeStudy,
  getEvent,
  inbox,
  studyPreset,
  totalOpenQueries,
  type Difficulty,
  type FinalReport,
  type StudyState,
} from "@/lib/study-director";
import {
  HARD_STOP,
  QUERIES_PER_SESSION,
  clearQueriesAtEdc,
  decide,
  documentAtDesk,
  endMeeting,
  goHome,
  newWorld,
  sponsorAgenda,
  startDay,
  startMeeting,
  workableQueries,
  type WorldState,
} from "@/lib/study-director-world";

// #2192, from a playtest audit: the last weeks of a full run were mostly
// empty, the cleaning phase had nothing to do but watch queries fall, two
// seeds opened with the same fortnight, and a careful player's office work
// erased the difference between a calm study and a rescue.

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

type Policy = "absent" | "answers" | "careful";

interface Run {
  days: number;
  /** Days after day 58 that opened with nothing in the inbox. */
  emptyLate: number;
  lateDays: number;
  /** Queries the player cleared at the EDC. */
  cleared: number;
  study: StudyState;
  report: FinalReport;
}

/** Where the conference table is on the CRO floor. */
const inConference = (w: WorldState): WorldState => ({
  ...w,
  player: { x: 15, y: 10, facing: "down" },
  location: "conference",
});

/**
 * Plays a whole office run without a screen, as the seeded-simulation suite
 * does. `answers` takes each message's first option. `careful` is the
 * playtest's careful player: it takes the sponsor's messages on a sponsor
 * call, answers the rest with the option that records a finding, writes
 * every decision up, and works the query queue at the EDC.
 */
function play(seed: string, difficulty: Difficulty, policy: Policy): Run {
  let world = newWorld(seed, difficulty);
  let days = 0;
  let emptyLate = 0;
  let lateDays = 0;
  let cleared = 0;
  const pick = (id: string) => {
    const options = getEvent(id)?.options ?? [];
    return policy === "careful"
      ? (options.find((o) => o.finding) ?? options[0])
      : options[0];
  };
  while (world.study.status === "running" && days < 400) {
    world = startDay(world).world;
    if (world.study.day > 58) {
      lateDays += 1;
      if (inbox(world.study).length === 0) emptyLate += 1;
    }
    if (policy === "careful" && sponsorAgenda(world).length > 0) {
      const call = startMeeting(inConference(world), "sponsor", []);
      if (call.ok) {
        let w = call.world;
        for (const event of sponsorAgenda(w)) {
          const r = decide(w, event.id, pick(event.id)!.id, "meeting");
          if (r.ok) w = r.world;
        }
        const ended = endMeeting(w);
        if (ended.ok) world = ended.world;
      }
    }
    if (policy !== "absent") {
      for (const event of inbox(world.study)) {
        const option = pick(event.id);
        if (!option) continue;
        const r = decide(world, event.id, option.id);
        if (!r.ok) break;
        world = r.world;
      }
    }
    if (policy === "careful") {
      for (const record of world.study.log)
        if (!record.documented && record.day === world.study.day) {
          const filed = documentAtDesk(world, record.eventId);
          if (filed.ok) world = filed.world;
        }
      for (let i = 0; i < 3; i += 1) {
        const r = clearQueriesAtEdc(world);
        if (!r.ok) break;
        world = r.world;
        cleared += r.cleared;
      }
    }
    world = goHome(world).world;
    days += 1;
  }
  return {
    days,
    emptyLate,
    lateDays,
    cleared,
    study: world.study,
    report: finalizeStudy(world.study),
  };
}

const SEEDS = ["sim-a", "sim-b", "sim-c", "sim-d"];
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe("the late game has work in it (#2192)", () => {
  it("rarely opens a day after day 58 with nothing waiting", () => {
    // Before #2192 about three quarters of these days were empty.
    const shares = SEEDS.map((seed) => {
      const run = play(seed, "standard", "answers");
      expect(run.lateDays).toBeGreaterThan(20);
      return run.emptyLate / run.lateDays;
    });
    for (const share of shares) expect(share).toBeLessThan(0.5);
    expect(mean(shares)).toBeLessThan(0.4);
  });

  it("never leaves an idle run's last weeks without mail", () => {
    // The audit's idle run had seven empty days in a row at the end.
    for (const seed of SEEDS)
      expect(play(seed, "standard", "absent").emptyLate).toBeLessThanOrEqual(2);
  });

  it("brings the core mail written past the plan into a run that slips", () => {
    const late = STUDY_EVENTS.filter(
      (e) => e.core && e.day > studyPreset("full").setup.durationDays
    );
    expect(late.length).toBeGreaterThanOrEqual(3);
    for (const seed of SEEDS) {
      const run = play(seed, "standard", "answers");
      // The run slipped well past its plan and still met all of it.
      expect(run.study.slipDays).toBeGreaterThanOrEqual(5);
      for (const event of late)
        expect(run.study.seen[event.id], `${seed} ${event.id}`).toBeDefined();
    }
  });

  it("keeps late mail out of a study that finishes on time", () => {
    const preset = studyPreset("full");
    let s = beginStudy(
      createStudy("on-time", preset.setup, preset.sites, preset.team)
    );
    while (s.status === "running") s = endDay({ ...s, slipDays: 0 });
    for (const event of STUDY_EVENTS.filter(
      (e) => e.day > preset.setup.durationDays
    ))
      expect(s.seen[event.id], event.id).toBeUndefined();
  });
});

describe("the first fortnight differs by seed (#2192)", () => {
  /** Events that reached the inbox in a run's first fourteen days. */
  function firstFortnight(seed: string): string[] {
    const preset = studyPreset("full");
    let s = beginStudy(
      applyDifficulty(
        createStudy(seed, preset.setup, preset.sites, preset.team),
        "standard"
      )
    );
    while (s.day < 14) s = endDay(s);
    return Object.entries(s.seen)
      .filter(([, day]) => day <= 14)
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => getEvent(id)!.subject);
  }

  it("shares fewer than half its subjects with another seed's", () => {
    // Before #2192 two seeds shared about three quarters.
    const counts: number[] = [];
    const overlaps = Array.from({ length: 10 }, (_, i) => {
      const a = firstFortnight(`fortnight-${2 * i}`);
      const b = new Set(firstFortnight(`fortnight-${2 * i + 1}`));
      counts.push(a.length, b.size);
      return a.filter((s) => b.has(s)).length / Math.max(a.length, b.size);
    });
    expect(mean(overlaps)).toBeLessThan(0.5);
    // Variety does not come from an emptier fortnight.
    expect(mean(counts)).toBeGreaterThanOrEqual(9);
  });

  it("still opens every run with the sponsor's biomarker request", () => {
    for (const seed of ["fortnight-0", "fortnight-1", "fortnight-2"])
      expect(firstFortnight(seed)[0]).toBe("Exploratory biomarkers");
  });

  it("replays the same fortnight from the same seed", () => {
    expect(firstFortnight("fortnight-7")).toEqual(
      firstFortnight("fortnight-7")
    );
  });
});

describe("working the query queue at the EDC (#2192)", () => {
  /** A morning with an audited backlog at Site 03, so the EDC shows it all. */
  function backlog(difficulty: Difficulty = "standard", queries = 12) {
    const world = startDay(newWorld("edc-queue", difficulty)).world;
    return {
      ...world,
      study: {
        ...world.study,
        day: 40,
        sites: world.study.sites.map((s) =>
          s.id === "site-03"
            ? { ...s, openQueries: queries, lastAuditedDay: 40 }
            : { ...s, openQueries: 0 }
        ),
      },
    };
  }
  const dmLoad = (w: WorldState) =>
    w.study.team.find((m) => m.role === "dataManager")!.workload;

  it("clears queries for forty-five minutes, energy and focus", () => {
    const world = backlog();
    expect(workableQueries(world)).toBe(12);
    const r = expectOk(clearQueriesAtEdc(world));
    expect(r.cleared).toBe(QUERIES_PER_SESSION.standard);
    expect(totalOpenQueries(r.world.study)).toBe(12 - r.cleared);
    expect(r.world.minute).toBe(world.minute + 45);
    expect(r.world.energy).toBeLessThan(world.energy);
    expect(r.world.focus).toBeLessThan(world.focus);
    expect(r.world.study.adjust.integrity).toBeGreaterThan(
      world.study.adjust.integrity
    );
    expect(dmLoad(r.world)).toBeLessThan(dmLoad(world));
    expect(r.lines[0].text).toMatch(/5 queries closed at Site 03/);
  });

  it("refuses when the EDC shows nothing, and after the hard stop", () => {
    expect(clearQueriesAtEdc(backlog("standard", 0))).toEqual({
      ok: false,
      reason: "unknown-action",
    });
    expect(clearQueriesAtEdc({ ...backlog(), minute: HARD_STOP - 10 })).toEqual(
      { ok: false, reason: "too-late" }
    );
  });

  it("only works the queries a site has entered", () => {
    const world = backlog();
    const hidden = {
      ...world,
      study: {
        ...world.study,
        sites: world.study.sites.map((s) =>
          s.id === "site-03"
            ? { ...s, coordinator: "invisible" as const, lastAuditedDay: null }
            : s
        ),
      },
    };
    const r = expectOk(clearQueriesAtEdc(hidden));
    expect(r.cleared).toBe(workableQueries(hidden));
    expect(r.cleared).toBeLessThan(QUERIES_PER_SESSION.standard);
  });

  it("clears fewer per session in a rescue than in a calm study", () => {
    const calm = expectOk(clearQueriesAtEdc(backlog("calm"))).cleared;
    const rescue = expectOk(clearQueriesAtEdc(backlog("rescue"))).cleared;
    expect(calm).toBeGreaterThan(rescue);
  });

  it("gives the careful player's cleaning phase real work", () => {
    const run = play("sim-a", "standard", "careful");
    expect(run.cleared).toBeGreaterThan(10);
  });
});

describe("difficulty is felt by a careful player (#2192)", () => {
  it("scores a careful player measurably better on calm than on rescue", () => {
    const calm = SEEDS.map((seed) => play(seed, "calm", "careful").report);
    const rescue = SEEDS.map((seed) => play(seed, "rescue", "careful").report);
    const stars = (rs: FinalReport[]) =>
      mean(rs.map((r) => r.evaluations.sponsor.stars));
    const late = (rs: FinalReport[]) =>
      mean(rs.map((r) => r.evaluations.company.timelineVarianceDays));
    // Before #2192: 5 stars against 4.75, and rescue one day later.
    expect(stars(calm) - stars(rescue)).toBeGreaterThanOrEqual(0.75);
    expect(late(rescue) - late(calm)).toBeGreaterThanOrEqual(4);
  });

  it("warms a rescue sponsor by half on a sponsor call", () => {
    const call = (difficulty: Difficulty) => {
      const world = inConference(startDay(newWorld("warm", difficulty)).world);
      const started = expectOk(startMeeting(world, "sponsor", []));
      const decided = expectOk(
        decide(started.world, "sponsor-biomarkers", "assess", "meeting")
      );
      const ended = expectOk(endMeeting(decided.world));
      return (
        ended.world.study.adjust.client - decided.world.study.adjust.client
      );
    };
    expect(call("standard")).toBe(2);
    expect(call("calm")).toBe(2);
    expect(call("rescue")).toBe(1);
  });
});
