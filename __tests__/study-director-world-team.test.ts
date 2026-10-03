// @vitest-environment node
import { describe, expect, it } from "vitest";
import { endDay, getEvent, type StudyState } from "@/lib/study-director";
import {
  CRO_FLOOR,
  DAY_START,
  TRUST_EFFECTS,
  adjustTrust,
  bondFor,
  daySchedule,
  decide,
  delegate,
  describePerson,
  dialogueLines,
  goHome,
  isWalkable,
  newWorld,
  parseWorld,
  personState,
  placePeople,
  positionAt,
  relationshipCard,
  serializeWorld,
  startDay,
  talk,
  withBond,
  workHours,
  type WorldState,
} from "@/lib/study-director-world";

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

function morning(
  seed = "team-1",
  difficulty: "calm" | "standard" | "rescue" = "standard"
) {
  return startDay(newWorld(seed, difficulty)).world;
}

/** The same world with one member's workload set. */
function withLoad(
  world: WorldState,
  memberId: string,
  workload: number
): WorldState {
  return {
    ...world,
    study: {
      ...world.study,
      team: world.study.team.map((m) =>
        m.id === memberId ? { ...m, workload } : m
      ),
    },
  };
}

function withSite(
  world: WorldState,
  siteId: string,
  patch: Partial<StudyState["sites"][number]>
): WorldState {
  return {
    ...world,
    study: {
      ...world.study,
      sites: world.study.sites.map((s) =>
        s.id === siteId ? { ...s, ...patch } : s
      ),
    },
  };
}

const trusting = (w: WorldState, id: string, trust: number) =>
  withBond(w, id, { trust });

describe("schedules derived from state (#1688)", () => {
  it("sends a calm member for a coffee outside and lunch in the break room", () => {
    const world = withLoad(morning(), "lee", 20);
    const schedule = daySchedule(world, "lee");
    expect(schedule?.mood).toBe("calm");
    const kinds = schedule?.blocks.map((b) => b.activity);
    expect(kinds).toEqual([
      "working",
      "coffee",
      "outside",
      "working",
      "lunch",
      "working",
    ]);
    const outside = schedule?.blocks.find((b) => b.activity === "outside");
    expect(outside?.room).toBe("parking");
    expect(schedule?.blocks.find((b) => b.activity === "lunch")?.room).toBe(
      "breakRoom"
    );
    expect(schedule?.leave).toBe(18 * 60);
  });

  it("keeps an overloaded member at the desk for lunch and late into the evening", () => {
    const world = withLoad(morning(), "maya", 98);
    const schedule = daySchedule(world, "maya");
    expect(schedule?.mood).toBe("overloaded");
    expect(schedule?.blocks.map((b) => b.activity)).toEqual([
      "working",
      "lunchAtDesk",
      "working",
    ]);
    const desk = schedule?.blocks[0].spot;
    expect(schedule?.blocks.every((b) => b.spot === desk)).toBe(true);
    expect(schedule?.leave).toBeGreaterThanOrEqual(19 * 60);
    const calm = daySchedule(withLoad(morning(), "maya", 20), "maya");
    expect(schedule?.arrive).toBeLessThan(calm?.arrive ?? 0);
  });

  it("leaves and lunches by the workload thresholds the set dressing reads", () => {
    expect(workHours(40)).toEqual({
      leavesAt: 18 * 60,
      staysLate: false,
      lunchAtDesk: false,
    });
    expect(workHours(70)).toEqual({
      leavesAt: 18 * 60,
      staysLate: false,
      lunchAtDesk: true,
    });
    expect(workHours(85)).toEqual({
      leavesAt: 18 * 60 + 60,
      staysLate: true,
      lunchAtDesk: true,
    });
    expect(workHours(100).leavesAt).toBe(18 * 60 + 150);
    for (const load of [20, 60, 70, 80, 98]) {
      const schedule = daySchedule(withLoad(morning(), "dana", load), "dana");
      const hours = workHours(load);
      expect(schedule?.leave).toBe(hours.leavesAt);
      expect(schedule?.blocks.some((b) => b.activity === "lunchAtDesk")).toBe(
        hours.lunchAtDesk
      );
    }
  });

  it("is a pure function of state, day and minute", () => {
    const world = morning("pure-1");
    const a = daySchedule(world, "walt");
    const b = daySchedule(structuredClone(world), "walt");
    expect(a).toEqual(b);
    const nextDay = { ...world, study: endDay(world.study) };
    expect(daySchedule(nextDay, "walt")).not.toEqual(a);
    for (const minute of [7 * 60, 10 * 60 + 17, 12 * 60 + 40, 17 * 60 + 5])
      expect(placePeople({ ...world, minute })).toEqual(
        placePeople({ ...structuredClone(world), minute })
      );
  });

  it("has everyone at their desk when the office opens, on any seed", () => {
    for (const seed of ["a", "b", "c", "d"])
      for (const difficulty of ["calm", "standard", "rescue"] as const) {
        const world = morning(seed, difficulty);
        const people = placePeople({ ...world, minute: DAY_START });
        expect(people).toHaveLength(world.study.team.length);
        expect(people.every((p) => p.activity === "working")).toBe(true);
      }
  });

  it("walks people one tile at a time along the floor between places", () => {
    const world = withLoad(morning("walk-1"), "omar", 20);
    const schedule = daySchedule(world, "omar");
    if (!schedule) throw new Error("no schedule");
    const coffee = schedule.blocks.find((b) => b.activity === "coffee");
    if (!coffee) throw new Error("no coffee");
    let prev = positionAt(schedule, coffee.start);
    let walkedTiles = 0;
    for (let m = coffee.start + 0.25; m < coffee.end; m += 0.25) {
      const pos = positionAt(schedule, m);
      if (!pos || !prev) throw new Error("missing position");
      const d =
        Math.abs(pos.tile.x - prev.tile.x) + Math.abs(pos.tile.y - prev.tile.y);
      expect(d).toBeLessThanOrEqual(1);
      expect(isWalkable(CRO_FLOOR, pos.tile.x, pos.tile.y)).toBe(true);
      if (pos.activity === "walking") walkedTiles += d;
      prev = pos;
    }
    expect(walkedTiles).toBeGreaterThan(10);
    expect(prev?.activity).toBe("coffee");
    expect(prev?.room).toBe("breakRoom");
  });

  it("puts nobody on the floor before they arrive, after they leave, or at night", () => {
    const world = morning("night-1");
    const schedule = daySchedule(world, "dana");
    if (!schedule) throw new Error("no schedule");
    expect(positionAt(schedule, schedule.arrive - 1)).toBeNull();
    expect(positionAt(schedule, schedule.leave + 60)).toBeNull();
    expect(placePeople({ ...world, minute: 21 * 60 })).toHaveLength(0);
    expect(placePeople({ ...world, location: "home" })).toEqual([]);
    const site = { ...CRO_FLOOR, id: "site-01" };
    expect(placePeople({ ...world, minute: 10 * 60 }, site)).toEqual([]);
  });

  it("lets the player read the team from behaviour, never a number", () => {
    const world = { ...withLoad(morning(), "maya", 98), minute: 12 * 60 + 10 };
    const maya = placePeople(world).find((p) => p.memberId === "maya");
    expect(maya?.activity).toBe("lunchAtDesk");
    const text = maya ? describePerson(world, maya) : "";
    expect(text).toMatch(/eating lunch at the desk/);
    expect(text).not.toMatch(/\d/);
  });
});

describe("dialogue gated by trust (#1688)", () => {
  // Site 03's coordinator is invisible: the dashboard shows a tenth of it.
  const hidden = () =>
    withSite(morning("talk-1"), "site-03", { openQueries: 20 });

  it("discloses an early warning from the same state only to a trusting member", () => {
    const base = hidden();
    const open = dialogueLines(trusting(base, "maya", 80), "maya");
    const middling = dialogueLines(trusting(base, "maya", 50), "maya");
    const wary = dialogueLines(trusting(base, "maya", 20), "maya");
    const warning = open.find(
      (l) => l.kind === "warning" && l.fact?.area === "data"
    );
    expect(warning?.text).toMatch(/Site 03 is sitting on 20 open queries/);
    expect(warning?.fact?.siteId).toBe("site-03");
    expect(middling.some((l) => /climbing at Site 03/.test(l.text))).toBe(true);
    expect(middling.some((l) => /20/.test(l.text))).toBe(false);
    expect(wary.map((l) => l.text)).toContain("Queries are being handled.");
    expect(wary.some((l) => l.fact)).toBe(false);
  });

  it("gates other roles the same way", () => {
    const base = withSite(hidden(), "site-03", {
      unsignedSource: 4,
      deviations: 2,
    });
    const walt = dialogueLines(trusting(base, "walt", 80), "walt");
    expect(
      walt.some((l) => l.kind === "warning" && /4 unsigned source/.test(l.text))
    ).toBe(true);
    expect(
      dialogueLines(trusting(base, "walt", 20), "walt").map((l) => l.text)
    ).toContain("Monitoring is on schedule.");
    const dana = dialogueLines(trusting(base, "dana", 80), "dana");
    expect(
      dana.some((l) =>
        /Site 03 still hasn't finished protocol training/.test(l.text)
      )
    ).toBe(true);
    expect(
      dialogueLines(trusting(base, "dana", 20), "dana").map((l) => l.text)
    ).toContain("Regulatory is on track.");
  });

  it("has an overloaded member admit it only when they trust you", () => {
    const base = withLoad(morning(), "maya", 98);
    expect(dialogueLines(trusting(base, "maya", 80), "maya")[0]).toMatchObject({
      kind: "warning",
      text: expect.stringMatching(/drowning/),
    });
    expect(dialogueLines(trusting(base, "maya", 50), "maya")[0]).toMatchObject({
      kind: "joke",
      text: expect.stringMatching(/Everything is fine/),
    });
  });

  it("gives every line a purpose and does not repeat what you already know", () => {
    const world = trusting(hidden(), "maya", 80);
    const first = expectOk(talk(world, "maya"));
    expect(first.world.minute).toBe(world.minute + 10);
    for (const l of first.lines)
      expect([
        "information",
        "warning",
        "opportunity",
        "relationship",
        "joke",
      ]).toContain(l.kind);
    expect(first.world.observations?.some((o) => o.siteId === "site-03")).toBe(
      true
    );
    const again = dialogueLines(first.world, "maya");
    expect(again.some((l) => /sitting on 20/.test(l.text))).toBe(false);
    expect(again.length).toBeGreaterThan(0);
  });
});

describe("trust moves with what the player does (#1688)", () => {
  it("builds with the first talk of the day only", () => {
    const world = morning("trust-1");
    const before = bondFor(world, "priya").trust;
    const once = expectOk(talk(world, "priya"));
    expect(bondFor(once.world, "priya").trust).toBe(
      before + TRUST_EFFECTS.talk
    );
    const twice = expectOk(talk(once.world, "priya"));
    expect(bondFor(twice.world, "priya").trust).toBe(
      before + TRUST_EFFECTS.talk
    );
  });

  it("builds with coaching and follow-through, and falls with overriding and dumping", () => {
    const world = morning("trust-2");
    const t0 = bondFor(world, "maya").trust;
    const coached = expectOk(delegate(world, "maya", "coach"));
    expect(bondFor(coached.world, "maya").trust).toBe(t0 + TRUST_EFFECTS.coach);
    const owner = withBond(world, "maya", { owns: "queries", trust: 70 });
    const overridden = expectOk(delegate(owner, "maya", "takeOver"));
    expect(bondFor(overridden.world, "maya").trust).toBe(
      70 + TRUST_EFFECTS.override
    );
    const buried = trusting(withLoad(world, "maya", 98), "maya", 60);
    const dumped = expectOk(delegate(buried, "maya", "assign"));
    expect(bondFor(dumped.world, "maya").trust).toBe(60 + TRUST_EFFECTS.dump);
  });

  it("builds when you answer a member's message and falls when it runs out ignored", () => {
    let world = morning("trust-3");
    while (!world.study.seen["stat-endpoint-two"])
      world = { ...world, study: endDay(world.study) };
    const t0 = bondFor(world, "priya").trust;
    const event = getEvent("stat-endpoint-two");
    const answered = expectOk(
      decide(world, "stat-endpoint-two", event?.options[0].id ?? "")
    );
    expect(bondFor(answered.world, "priya").trust).toBe(
      t0 + TRUST_EFFECTS.followThrough
    );
    // Left alone, the message expires and Priya counts it as ignored.
    let ignored = world;
    while (!ignored.study.handled.includes("stat-endpoint-two"))
      ignored = startDay(goHome(ignored).world).world;
    expect(bondFor(ignored, "priya").trust).toBe(t0 + TRUST_EFFECTS.ignore);
  });

  it("clamps trust and keeps it in the save", () => {
    const world = trusting(morning("trust-4"), "lee", 99);
    const up = adjustTrust(world, "lee", "coach");
    expect(bondFor(up.world, "lee").trust).toBe(100);
    const saved = parseWorld(serializeWorld(up.world));
    expect(saved && bondFor(saved, "lee").trust).toBe(100);
  });

  it("shows trust as hearts and stress and workload as rough bars", () => {
    const calm = relationshipCard(
      trusting(withLoad(morning(), "omar", 10), "omar", 100),
      "omar"
    );
    expect(calm).toMatchObject({
      hearts: 5,
      workloadBars: 1,
      stressBars: 1,
      workloadLabel: "light",
    });
    const buried = relationshipCard(
      trusting(withLoad(morning(), "omar", 98), "omar", 10),
      "omar"
    );
    expect(buried).toMatchObject({
      hearts: 1,
      workloadBars: 4,
      workloadLabel: "buried",
    });
    expect(Object.keys(buried ?? {})).not.toContain("workload");
    expect(personState(morning(), "omar")?.workload).toBeTypeOf("number");
  });
});
