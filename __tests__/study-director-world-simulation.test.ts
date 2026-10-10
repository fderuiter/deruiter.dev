// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  finalizeStudy,
  getEvent,
  inbox,
  type Difficulty,
  type FinalReport,
} from "@/lib/study-director";
import {
  HARD_STOP,
  decide,
  documentAtDesk,
  goHome,
  newWorld,
  startDay,
  type WorldState,
} from "@/lib/study-director-world";

type Style = "absent" | "answers" | "thorough";

interface Run {
  days: number;
  stuckDays: number;
  report: FinalReport;
}

/**
 * Plays a whole run without a screen. The bot never walks: it answers what
 * is in the inbox, most urgent first, as the player would from the phone
 * and desk, and goes home when it runs out of time or energy.
 *
 *   absent    goes home every day without opening anything
 *   answers   takes the first option on each message, never writes it up
 *   thorough  takes the option that records a finding, then files it
 */
function play(seed: string, difficulty: Difficulty, style: Style): Run {
  let world: WorldState = newWorld(seed, difficulty);
  let days = 0;
  let stuckDays = 0;
  while (world.study.status === "running" && days < 400) {
    world = startDay(world).world;
    if (world.minute >= HARD_STOP || world.energy <= 0) stuckDays += 1;
    if (style !== "absent") {
      let answered = 0;
      for (const event of inbox(world.study)) {
        const options = getEvent(event.id)?.options ?? [];
        const pick =
          style === "thorough"
            ? (options.find((o) => o.finding) ?? options[0])
            : options[0];
        if (!pick) continue;
        const result = decide(world, event.id, pick.id);
        if (!result.ok) break;
        world = result.world;
        answered += 1;
        if (style === "thorough") {
          const filed = documentAtDesk(world, event.id);
          if (filed.ok) world = filed.world;
        }
      }
      if (answered === 0 && inbox(world.study).length > 0) stuckDays += 1;
    }
    world = goHome(world).world;
    days += 1;
  }
  return { days, stuckDays, report: finalizeStudy(world.study) };
}

const DIFFICULTIES: Difficulty[] = ["calm", "standard", "rescue"];
const SEEDS = ["sim-a", "sim-b", "sim-c", "sim-d"];

const stars = (r: Run) => r.report.evaluations.sponsor.stars;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const average = (d: Difficulty, style: Style) =>
  mean(SEEDS.map((s) => stars(play(s, d, style))));

describe("study director world: seeded full-run simulations", () => {
  it.each(DIFFICULTIES)("a %s run lasts a sensible length", (difficulty) => {
    for (const style of ["absent", "answers", "thorough"] as Style[])
      for (const seed of SEEDS) {
        const run = play(seed, difficulty, style);
        // Study 24-081 plans 80 days; slips add a few, never a second study.
        expect(run.days).toBeGreaterThanOrEqual(80);
        expect(run.days).toBeLessThanOrEqual(110);
      }
  });

  it.each(DIFFICULTIES)(
    "no %s day is unwinnable: the first message can always be answered",
    (difficulty) => {
      for (const seed of SEEDS)
        expect(play(seed, difficulty, "thorough").stuckDays).toBe(0);
    }
  );

  it("is deterministic: the same seed and choices give the same ending", () => {
    const a = play("sim-a", "standard", "answers");
    const b = play("sim-a", "standard", "answers");
    expect(b.days).toBe(a.days);
    expect(b.report.evaluations).toEqual(a.report.evaluations);
  });

  it.each(DIFFICULTIES)(
    "%s scoring spreads: staying away fails, careful work pays",
    (difficulty) => {
      const absent = average(difficulty, "absent");
      const answers = average(difficulty, "answers");
      const thorough = average(difficulty, "thorough");
      expect(absent).toBeLessThanOrEqual(1.5);
      expect(answers).toBeGreaterThan(absent);
      expect(thorough).toBeGreaterThan(answers - 0.01);
      expect(thorough - absent).toBeGreaterThanOrEqual(2);
      for (const seed of SEEDS)
        expect(
          play(seed, difficulty, "absent").report.evaluations.regulatory.grade
        ).toBe("F");
    }
  );

  it("orders the difficulties: rescue is harder than standard than calm", () => {
    const calm = average("calm", "answers");
    const standard = average("standard", "answers");
    const rescue = average("rescue", "answers");
    expect(calm).toBeGreaterThanOrEqual(standard);
    expect(standard).toBeGreaterThan(rescue);
  });
});
