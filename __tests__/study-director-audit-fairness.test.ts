// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DAY_ONE_OPENERS,
  applyDifficulty,
  applyEffects,
  beginStudy,
  createStudy,
  endDay,
  getEvent,
  inbox,
  studyPreset,
  type Difficulty,
  type StudyLength,
  type StudyState,
} from "@/lib/study-director";
import {
  INTERRUPTION_TIMES,
  clearQueriesAtEdc,
  decide,
  documentAtDesk,
  endMeeting,
  goHome,
  newWorld,
  scheduleFor,
  sponsorAgenda,
  startDay,
  startMeeting,
  travel,
  type WorldState,
} from "@/lib/study-director-world";

// #2254, from the replay audit after the fix PRs: Calm's extra budget was
// burnt at a matching extra rate, so it was never headroom; going home
// straight from a site blamed the player for interruptions that came while
// they were away; and day 1 opened the same way in every seed.

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

const inConference = (w: WorldState): WorldState => ({
  ...w,
  player: { x: 15, y: 10, facing: "down" },
  location: "conference",
});

/**
 * The playtest's careful player, as in the seeded-simulation suites: the
 * sponsor's messages on a sponsor call, every other message answered with
 * the option that records a finding, everything written up, and the query
 * queue worked at the EDC.
 */
function careful(
  seed: string,
  difficulty: Difficulty,
  length: StudyLength
): StudyState {
  let world = newWorld(seed, difficulty, length);
  const pick = (id: string) => {
    const options = getEvent(id)?.options ?? [];
    return options.find((o) => o.finding) ?? options[0];
  };
  for (let days = 0; world.study.status === "running" && days < 200; days++) {
    world = startDay(world).world;
    if (sponsorAgenda(world).length > 0) {
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
    for (const event of inbox(world.study)) {
      const r = decide(world, event.id, pick(event.id)!.id);
      if (!r.ok) break;
      world = r.world;
    }
    for (const record of world.study.log)
      if (!record.documented && record.day === world.study.day) {
        const filed = documentAtDesk(world, record.eventId);
        if (filed.ok) world = filed.world;
      }
    for (let i = 0; i < 3; i += 1) {
      const r = clearQueriesAtEdc(world);
      if (!r.ok) break;
      world = r.world;
    }
    world = goHome(world).world;
  }
  return world.study;
}

const margin = (s: StudyState) => s.setup.budget - s.spent;

function fresh(seed: string, difficulty: Difficulty, length: StudyLength) {
  const preset = studyPreset(length);
  return beginStudy(
    applyDifficulty(
      createStudy(seed, preset.setup, preset.sites, preset.team),
      difficulty
    )
  );
}

describe("Calm's extra budget is headroom (#2254)", () => {
  it("spends at the standard rate, so the extra 15% is margin", () => {
    for (const length of ["full", "short"] as const) {
      const calm = fresh("burn-1", "calm", length);
      const standard = fresh("burn-1", "standard", length);
      expect(calm.setup.budget).toBeGreaterThan(standard.setup.budget);
      // A quiet day burns no more on calm than on standard; it used to burn
      // exactly 15% more.
      expect(endDay(calm).spent - calm.spent).toBeLessThanOrEqual(
        endDay(standard).spent - standard.spent + 1e-9
      );
    }
  });

  it("leaves a careful calm run more margin than standard, and standard more than rescue", () => {
    for (const length of ["full", "short"] as const)
      for (const seed of ["sim-a", "sim-b"]) {
        const calm = careful(seed, "calm", length);
        const standard = careful(seed, "standard", length);
        const rescue = careful(seed, "rescue", length);
        // At least the extra budget better off than standard, less a little
        // for the days a calm run's choices can still cost.
        expect(margin(calm), `${length} ${seed}`).toBeGreaterThanOrEqual(
          margin(standard) + (calm.setup.budget - standard.setup.budget) * 0.9
        );
        expect(margin(standard)).toBeGreaterThan(margin(rescue));
      }
  });

  it("slips a short study in proportion to its calendar", () => {
    const short = fresh("slip-1", "standard", "short");
    const full = fresh("slip-1", "standard", "full");
    expect(applyEffects(full, { slipDays: 4 }).slipDays).toBe(4);
    expect(applyEffects(short, { slipDays: 4 }).slipDays).toBe(2);
    // A one-day setback is never rounded away.
    expect(applyEffects(short, { slipDays: 1 }).slipDays).toBe(1);
    const slipped = applyEffects(short, { slipDays: 5 });
    expect(applyEffects(slipped, { slipDays: -5 }).slipDays).toBe(
      slipped.slipDays - 2
    );
  });
});

describe("careful-run budget and Rescue opening (#2287)", () => {
  it.each(["calm", "standard"] as const)(
    "lets a careful %s run finish within the closeout budget threshold",
    (difficulty) => {
      for (const length of ["full", "short"] as const)
        for (const seed of ["sim-a", "sim-b", "sim-c", "sim-d"]) {
          const study = careful(seed, difficulty, length);
          const marginPct =
            ((study.setup.budget - study.spent) / study.setup.budget) * 100;
          expect(
            marginPct,
            `${difficulty} ${length} ${seed}`
          ).toBeGreaterThanOrEqual(-5);
        }
    }
  );

  it("starts Rescue with less budget, rather than spending it before day one", () => {
    const preset = studyPreset("full");
    const start = createStudy(
      "rescue-opening",
      preset.setup,
      preset.sites,
      preset.team
    );
    const standard = applyDifficulty(start, "standard");
    const rescue = applyDifficulty(start, "rescue");
    expect(rescue.setup.budget).toBeLessThan(standard.setup.budget);
    expect(rescue.spent).toBe(0);
  });

  it("keeps an older Rescue save on its original daily cost", () => {
    const preset = studyPreset("full");
    const start = createStudy(
      "rescue-legacy",
      preset.setup,
      preset.sites,
      preset.team
    );
    const current = applyDifficulty(start, "rescue");
    const legacy = {
      ...current,
      baselineBudget: undefined,
      setup: { ...current.setup, budget: start.setup.budget },
      spent: start.setup.budget * 0.08,
    };
    expect(endDay(legacy).spent - legacy.spent).toBeCloseTo(
      endDay(current).spent - current.spent
    );
  });
});

describe("time away is not held against the player (#2254)", () => {
  const unanswered = (lines: readonly { text: string }[] | undefined) =>
    (lines ?? []).filter((l) => /go unanswered/.test(l.text));

  it("does not blame going home from a site for what came while away", () => {
    const morning = startDay(newWorld("away-1", "standard")).world;
    const atSite = expectOk(
      travel({ ...morning, minute: 8 * 60 + 57 }, "site-03")
    ).world;
    expect(atSite.visit).not.toBeNull();
    // Noon at the site: the 10:00 interruption came and lapsed meanwhile.
    expect(INTERRUPTION_TIMES[0]).toBeLessThan(12 * 60);
    const home = goHome({ ...atSite, minute: 11 * 60 + 59 });
    expect(unanswered(home.report.wrapUp)).toEqual([]);
  });

  it("does not blame going home out of a meeting either", () => {
    const morning = startDay(newWorld("away-2", "standard")).world;
    const meeting = expectOk(
      startMeeting(inConference({ ...morning, minute: 9 * 60 + 50 }), "team", [
        "walt",
      ])
    ).world;
    const home = goHome({ ...meeting, minute: 11 * 60 });
    expect(unanswered(home.report.wrapUp)).toEqual([]);
  });

  it("still blames an interruption left ringing at the office", () => {
    const morning = startDay(newWorld("away-1", "standard")).world;
    const home = goHome({ ...morning, minute: 11 * 60 + 59 });
    const first = scheduleFor(morning)[0].interruption.title;
    expect(unanswered(home.report.wrapUp).map((l) => l.text)).toEqual([
      `You let "${first}" go unanswered.`,
    ]);
  });
});

describe("day 1 varies by seed (#2254)", () => {
  const dayOne = (seed: string, length: StudyLength = "full") =>
    inbox(newWorld(seed, "standard", length).study).map((e) => e.id);

  it("opens with different messages across seeds, gently", () => {
    for (const length of ["full", "short"] as const) {
      const openings = Array.from({ length: 10 }, (_, i) =>
        dayOne(`day-one-${i}`, length)
      );
      expect(new Set(openings.map((o) => o.join(","))).size).toBeGreaterThan(2);
      for (const ids of openings) {
        // The sponsor's biomarker request still opens every run (#2192).
        expect(ids).toContain("sponsor-biomarkers");
        expect(ids.length).toBeGreaterThanOrEqual(2);
        // A short study's squeezed calendar can land one more on day 1.
        expect(ids.length).toBeLessThanOrEqual(length === "short" ? 4 : 3);
        expect(ids.some((id) => DAY_ONE_OPENERS.includes(id))).toBe(true);
        // Nothing urgent, and nothing that slips the study if it is left.
        for (const id of ids) {
          const event = getEvent(id)!;
          expect(event.urgency).not.toBe("critical");
          if (DAY_ONE_OPENERS.includes(id))
            expect(event.ifIgnored.slipDays ?? 0).toBe(0);
        }
      }
    }
  });

  it("is the same day 1 for the same seed", () => {
    expect(dayOne("day-one-3")).toEqual(dayOne("day-one-3"));
    expect(dayOne("day-one-3", "short")).toEqual(dayOne("day-one-3", "short"));
  });

  it("keeps the classic desk's one-message first day", () => {
    expect(
      inbox(fresh("day-one-1", "standard", "full")).map((e) => e.id)
    ).toEqual(["sponsor-biomarkers"]);
  });
});
