import { describe, expect, it } from "vitest";
import {
  ATTENTION_PER_DAY,
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  auditSite,
  beginStudy,
  createStudy,
  inbox,
  resolveEvent,
} from "@/lib/study-director";
import {
  DAY_END,
  DAY_START,
  HARD_STOP,
  ROUTINE_MINUTES_PER_POINT,
  actionCost,
  createWorld,
  drinkCoffee,
  fatigueFrom,
  formatClock,
  goHome,
  newWorld,
  parseWorld,
  serializeWorld,
  spend,
  startDay,
  weekdayFor,
  type WorldState,
} from "@/lib/study-director-world";

const at = (world: WorldState, minute: number): WorldState => ({
  ...world,
  minute,
});

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

describe("study director world: clock", () => {
  it("prices walking by tiles, four tiles a minute", () => {
    expect(actionCost("walk", 0).minutes).toBe(0);
    expect(actionCost("walk", 4).minutes).toBe(1);
    expect(actionCost("walk", 5).minutes).toBe(2);
    expect(actionCost("walk", 40).minutes).toBe(10);
  });

  it("spends time, energy and focus for work", () => {
    const world = newWorld("k-1", "standard");
    const result = expectOk(spend(world, "amendment"));
    expect(result.world.minute).toBe(world.minute + 60);
    expect(result.world.energy).toBe(world.energy - 6);
    expect(result.world.focus).toBe(world.focus - 25);
    expect(result.world.overtime).toBe(0);
  });

  it("charges double energy and records overtime past the office day", () => {
    const world = at(newWorld("k-2", "standard"), DAY_END - 15);
    const result = expectOk(spend(world, "sponsorCall"));
    expect(result.world.overtime).toBe(30);
    // Two thirds of the call is late: 6 * (1 + 2/3) = 10.
    expect(result.cost.energy).toBe(10);
  });

  it("refuses work past the hard stop or beyond the player's energy", () => {
    const late = at(newWorld("k-3", "standard"), HARD_STOP - 10);
    expect(spend(late, "meeting")).toEqual({ ok: false, reason: "too-late" });
    const tired = { ...newWorld("k-3", "standard"), energy: 2 };
    expect(spend(tired, "amendment")).toEqual({
      ok: false,
      reason: "too-tired",
    });
    expect(spend(tired, "talk").ok).toBe(true);
  });

  it("gives diminishing returns after the fourth coffee", () => {
    let world = { ...newWorld("k-4", "standard"), energy: 10, focus: 40 };
    for (let i = 0; i < 4; i += 1) world = expectOk(drinkCoffee(world)).world;
    expect(world.energy).toBe(90);
    expect(world.focus).toBe(80);
    const fifth = expectOk(spend(world, "coffee")).world;
    expect(fifth.energy).toBe(95);
    expect(fifth.focus).toBe(75);
    expect(fifth.coffees).toBe(5);
  });

  it("turns overtime into bounded fatigue", () => {
    expect(fatigueFrom(0)).toBe(0);
    expect(fatigueFrom(60)).toBe(10);
    expect(fatigueFrom(10_000)).toBe(40);
  });

  it("formats clock times and working weekdays", () => {
    expect(formatClock(DAY_START)).toBe("8:00 AM");
    expect(formatClock(10 * 60 + 42)).toBe("10:42 AM");
    expect(formatClock(12 * 60)).toBe("12:00 PM");
    expect(formatClock(DAY_END + 5)).toBe("6:05 PM");
    expect(weekdayFor(1)).toBe("Monday");
    expect(weekdayFor(5)).toBe("Friday");
    expect(weekdayFor(23)).toBe("Wednesday");
  });
});

describe("study director world: day loop", () => {
  it("starts the day after routine load, rested by the night", () => {
    const base = newWorld("k-5", "standard");
    const loaded: WorldState = {
      ...base,
      fatigue: 15,
      study: { ...base.study, routine: 2 },
    };
    const { world, digest } = startDay(loaded);
    expect(digest.routineMinutes).toBe(2 * ROUTINE_MINUTES_PER_POINT);
    expect(world.minute).toBe(DAY_START + 90);
    expect(world.energy).toBe(85);
    expect(world.focus).toBe(100);
    expect(world.location).toBe("lobby");
    expect(digest.weekday).toBe("Monday");
    expect(digest.lines.some((l) => l.text.includes("Routine work"))).toBe(
      true
    );
    expect(digest.lines.some((l) => l.text.includes("tired"))).toBe(true);
  });

  it("reports new messages in the morning digest", () => {
    const { digest } = startDay(newWorld("k-6", "standard"));
    const arrived = inbox(newWorld("k-6", "standard").study).length;
    const first = digest.lines[0].text;
    if (arrived > 0) expect(first).toMatch(/new message/);
    else expect(first).toBe("No new messages");
  });

  it("goes home, advances the study one day and carries fatigue", () => {
    const start = startDay(newWorld("k-7", "standard")).world;
    const late = { ...start, overtime: 120 };
    const { world, report } = goHome(late);
    expect(world.study.day).toBe(start.study.day + 1);
    expect(world.fatigue).toBe(20);
    expect(world.location).toBe("home");
    expect(report.day).toBe(start.study.day);
    expect(Array.isArray(report.lines)).toBe(true);
    expect(report.complete).toBe(false);
  });

  it("reports a phase change and lapsed messages overnight", () => {
    let world = startDay(newWorld("k-8", "standard")).world;
    let phases = 0;
    let lapsed = 0;
    for (let i = 0; i < 40 && world.study.status === "running"; i += 1) {
      const { world: next, report } = goHome(world);
      if (report.newPhase) phases += 1;
      lapsed += report.lines.filter((l) =>
        l.text.startsWith("Went unanswered")
      ).length;
      world = startDay(next).world;
    }
    expect(phases).toBeGreaterThan(0);
    expect(lapsed).toBeGreaterThan(0);
  });

  it("is deterministic for a seed and a sequence of actions", () => {
    const play = () => {
      let world = startDay(newWorld("k-9", "rescue")).world;
      const lines: string[] = [];
      for (let i = 0; i < 10; i += 1) {
        const worked = spend(world, "reviewEdc");
        if (worked.ok) world = worked.world;
        const { world: next, report } = goHome(world);
        lines.push(...report.lines.map((l) => l.text));
        world = startDay(next).world;
      }
      return { world, lines };
    };
    expect(play()).toEqual(play());
  });
});

describe("study director world: clock budget mode in the domain", () => {
  const begun = () =>
    beginStudy(
      createStudy("k-10", STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM)
    );

  it("leaves the classic attention budget unchanged", () => {
    const study = { ...begun(), attention: 0 };
    const event = inbox(study)[0];
    expect(event).toBeDefined();
    const refused = resolveEvent(study, event.id, event.options[0].id, true);
    expect(refused).toEqual({ ok: false, reason: "not-enough-attention" });
    expect(auditSite(study, study.sites[0].id)).toEqual({
      ok: false,
      reason: "not-enough-attention",
    });
  });

  it("records attention costs without enforcing them in clock mode", () => {
    const world = createWorld({ ...begun(), attention: 0 });
    expect(world.study.budget).toBe("clock");
    const event = inbox(world.study)[0];
    const option = event.options[0];
    const done = resolveEvent(world.study, event.id, option.id, true);
    expect(done.ok).toBe(true);
    if (!done.ok) return;
    expect(done.state.attention).toBe(0);
    const record = done.state.log[done.state.log.length - 1];
    expect(record.attentionSpent).toBe(option.attentionCost + 1);
    const audit = auditSite(done.state, done.state.sites[0].id);
    expect(audit.ok).toBe(true);
    if (audit.ok) expect(audit.state.attention).toBe(0);
  });

  it("keeps a fresh classic study on the attention budget", () => {
    const study = begun();
    expect(study.budget).toBeUndefined();
    expect(study.attention).toBeLessThanOrEqual(ATTENTION_PER_DAY);
  });
});

describe("study director world: saves", () => {
  it("round-trips a world run", () => {
    const world = startDay(newWorld("k-11", "calm")).world;
    expect(parseWorld(serializeWorld(world))).toEqual(world);
  });

  it("drops unreadable, foreign or incomplete saves", () => {
    expect(parseWorld(null)).toBeNull();
    expect(parseWorld("{not json")).toBeNull();
    expect(parseWorld(JSON.stringify({ version: 2 }))).toBeNull();
    expect(parseWorld(JSON.stringify({ version: 1, study: {} }))).toBeNull();
  });

  it("clamps out-of-range numbers and forces clock budgeting", () => {
    const world = newWorld("k-12", "standard");
    const tampered = {
      ...world,
      energy: 900,
      focus: -20,
      minute: 99_999,
      known: ["a", 3, "b"],
      study: { ...world.study, budget: "attention" },
    };
    const parsed = parseWorld(JSON.stringify(tampered));
    expect(parsed?.energy).toBe(100);
    expect(parsed?.focus).toBe(0);
    expect(parsed?.minute).toBe(HARD_STOP);
    expect(parsed?.known).toEqual(["a", "b"]);
    expect(parsed?.study.budget).toBe("clock");
  });
});
