import { describe, expect, it } from "vitest";
import {
  DELEGATED_TRUST_COST,
  bondFor,
  delegateDay,
  delegationPreview,
  newWorld,
  parseWorld,
  serializeWorld,
  startDay,
  teamAnswer,
  type WorldState,
} from "@/lib/study-director-world";
import {
  STUDY_EVENTS,
  finalizeStudy,
  getEvent,
  inbox,
} from "@/lib/study-director";

/** The first morning of a run, with the player at their desk. */
function morning(seed: string, length: "short" | "full" = "short") {
  return startDay(newWorld(seed, "standard", length)).world;
}

/** A morning with a few messages waiting. */
function busyMorning(seed: string): WorldState {
  let world = morning(seed);
  for (let i = 0; i < 6 && inbox(world.study).length < 2; i += 1) {
    const result = delegateDay(world);
    if (!result.ok) throw new Error(result.reason);
    world = startDay(result.world).world;
  }
  return world;
}

describe("office save: study length", () => {
  it("starts and keeps a short study through a save", () => {
    const world = morning("len-1");
    expect(world.study.setup.length).toBe("short");
    expect(world.study.setup.durationDays).toBe(35);
    expect(world.study.sites).toHaveLength(3);
    const parsed = parseWorld(serializeWorld(world));
    expect(parsed?.study.setup.length).toBe("short");
    expect(parsed && serializeWorld(parsed)).toBe(serializeWorld(world));
  });

  it("loads an existing full-study save as the full study", () => {
    const world = morning("len-2", "full");
    const text = serializeWorld(world);
    expect(JSON.parse(text).study.setup).not.toHaveProperty("length");
    const parsed = parseWorld(text);
    expect(parsed?.study.setup.durationDays).toBe(77);
    expect(parsed?.study.setup).not.toHaveProperty("length");
    expect(parsed?.study.sites).toHaveLength(5);
  });

  it("treats an unknown length as the full study", () => {
    const raw = JSON.parse(serializeWorld(morning("len-3", "full")));
    raw.study.setup.length = "medium";
    expect(parseWorld(JSON.stringify(raw))?.study.setup).not.toHaveProperty(
      "length"
    );
  });

  it("defaults a new world to the full study", () => {
    expect(newWorld("len-4", "calm").study.setup.durationDays).toBe(77);
  });
});

describe("delegating the day", () => {
  it("answers with the least-effort option", () => {
    for (const event of STUDY_EVENTS) {
      const pick = teamAnswer(event);
      expect(pick).not.toBeNull();
      const cheapest = Math.min(...event.options.map((o) => o.attentionCost));
      expect(pick?.attentionCost).toBe(cheapest);
    }
  });

  it("settles the inbox, sends the player home and reports it", () => {
    const world = busyMorning("del-1");
    const waiting = inbox(world.study).map((e) => e.id);
    expect(waiting.length).toBeGreaterThan(0);
    expect(delegationPreview(world)).toEqual({
      messages: waiting.length,
      available: true,
    });
    const result = delegateDay(world);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.world.location).toBe("home");
    expect(result.world.study.day).toBe(world.study.day + 1);
    for (const id of waiting) expect(result.world.study.handled).toContain(id);
    const delegated = result.report.delegated ?? [];
    expect(delegated.length).toBe(waiting.length + 1);
    expect(delegated.at(-1)?.text).toMatch(/trust -3/);
    expect(result.report.wrapUp).toBeUndefined();
    // Team answers are recorded undocumented: a cost to quality.
    const today = result.world.study.log.filter(
      (r) => r.day === world.study.day && getEvent(r.eventId)
    );
    expect(today.every((r) => !r.documented)).toBe(true);
    for (const member of world.study.team) {
      const before = bondFor(world, member.id).trust;
      const after = bondFor(result.world, member.id).trust;
      expect(after).toBe(Math.max(0, before - DELEGATED_TRUST_COST));
    }
  });

  it("is deterministic for a given seed and state", () => {
    const world = busyMorning("del-2");
    const a = delegateDay(world);
    const b = delegateDay(JSON.parse(serializeWorld(world)));
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(serializeWorld(a.world)).toBe(serializeWorld(b.world));
    expect(a.report).toEqual(b.report);
  });

  it("lets some messages slide into their fallout over a run", () => {
    let world = morning("del-3");
    let answered = 0;
    let slid = 0;
    for (let i = 0; i < 60 && world.study.status === "running"; i += 1) {
      const result = delegateDay(world);
      if (!result.ok) throw new Error(result.reason);
      const fresh = result.world.study.log.filter(
        (r) => r.day === world.study.day && getEvent(r.eventId)
      );
      answered += fresh.filter((r) => r.optionId !== "ignored").length;
      slid += fresh.filter((r) => r.label === "Let slide by the team").length;
      world =
        result.world.study.status === "running"
          ? startDay(result.world).world
          : result.world;
    }
    expect(answered).toBeGreaterThan(0);
    expect(slid).toBeGreaterThan(0);
    expect(slid).toBeLessThan(answered);
  });

  it("can carry a short study to its closeout", () => {
    let world = morning("del-4");
    let days = 0;
    while (world.study.status === "running" && days < 60) {
      const result = delegateDay(world);
      if (!result.ok) throw new Error(result.reason);
      days += 1;
      world =
        result.world.study.status === "running"
          ? startDay(result.world).world
          : result.world;
    }
    expect(world.study.status).toBe("complete");
    expect(days).toBeLessThanOrEqual(45);
    expect(finalizeStudy(world.study).evaluations.regulatory.grade).toMatch(
      /^[A-F]$/
    );
  });

  it("refuses at home and once the study is over", () => {
    const world = morning("del-5");
    expect(delegateDay({ ...world, location: "home" })).toEqual({
      ok: false,
      reason: "unknown-action",
    });
    expect(
      delegateDay({ ...world, study: { ...world.study, status: "complete" } })
    ).toEqual({ ok: false, reason: "study-complete" });
  });
});
