// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  CRO_FLOOR,
  GUEST_IDS,
  bondFor,
  goHome,
  guestDay,
  guestScene,
  guestWaiting,
  isWalkable,
  meetGuest,
  newWorld,
  parseWorld,
  pendingInterruption,
  placePeople,
  serializeWorld,
  startDay,
  type GuestId,
  type WorldState,
} from "@/lib/study-director-world";

const fresh = (seed: string): WorldState =>
  startDay(newWorld(seed, "standard")).world;

const AT = { sponsorVisit: 14 * 60, vendorMeeting: 10 * 60 + 30 } as const;

/** A free tile inside the conference room. */
const CONFERENCE_TILE = (() => {
  const room = CRO_FLOOR.rooms.find((r) => r.id === "conference")!;
  for (let y = room.bounds.y; y < room.bounds.y + room.bounds.height; y++)
    for (let x = room.bounds.x; x < room.bounds.x + room.bounds.width; x++)
      if (isWalkable(CRO_FLOOR, x, y)) return { x, y };
  throw new Error("no free tile in the conference room");
})();

/** The day a visitor is due, ten minutes after they arrive, with the player in the room. */
function visited(
  seed: string,
  id: GuestId,
  extra: Partial<WorldState> = {}
): WorldState {
  const world = fresh(seed);
  return {
    ...world,
    minute: AT[id] + 10,
    player: { ...CONFERENCE_TILE, facing: "down" },
    ...extra,
    study: { ...world.study, day: guestDay(seed, id) },
  };
}

const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  expect(r.ok).toBe(true);
  return r as Extract<T, { ok: true }>;
};

/** A seed on which the data manager is on the floor when the visitor is in. */
function seedWithManager(id: GuestId): string {
  for (let i = 0; i < 40; i++) {
    const seed = `guest-${i}`;
    const world = visited(seed, id);
    const manager = world.study.team.find((m) => m.role === "dataManager")!;
    if (placePeople(world).some((p) => p.memberId === manager.id)) return seed;
  }
  throw new Error("no seed has the data manager on the floor");
}

/** A study with a site hiding trouble from the dashboard. */
function hiding(world: WorldState): WorldState {
  return {
    ...world,
    study: {
      ...world.study,
      sites: world.study.sites.map((s) =>
        s.id === "site-03"
          ? { ...s, openQueries: 14, deviations: 4, lastAuditedDay: null }
          : s
      ),
    },
  };
}

describe("study director world: visitors, when they come", () => {
  it("fixes each visit's day by the seed, inside its window", () => {
    for (const seed of ["a", "b", "c", "d", "e", "f", "g"]) {
      const sponsor = guestDay(seed, "sponsorVisit");
      const vendor = guestDay(seed, "vendorMeeting");
      expect(sponsor).toBeGreaterThanOrEqual(16);
      expect(sponsor).toBeLessThan(22);
      expect(vendor).toBeGreaterThanOrEqual(31);
      expect(vendor).toBeLessThan(37);
      expect(guestDay(seed, "sponsorVisit")).toBe(sponsor);
    }
    const days = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map((s) =>
        guestDay(s, "sponsorVisit")
      )
    );
    expect(days.size).toBeGreaterThan(1);
  });

  it("waits ninety minutes in the conference room, on its day only", () => {
    for (const id of GUEST_IDS) {
      const world = visited("w", id);
      expect(guestScene({ ...world, minute: AT[id] - 1 })).toBeNull();
      expect(guestScene({ ...world, minute: AT[id] })?.id).toBe(id);
      expect(guestScene({ ...world, minute: AT[id] + 89 })?.id).toBe(id);
      expect(guestScene({ ...world, minute: AT[id] + 90 })).toBeNull();
      expect(
        guestScene({
          ...world,
          study: { ...world.study, day: world.study.day + 1 },
        })
      ).toBeNull();
      expect(guestScene({ ...world, location: "home" })).toBeNull();
    }
  });

  it("holds an interruption back while a visitor is waiting", () => {
    const world = visited("w", "sponsorVisit", { minute: 14 * 60 + 5 });
    expect(guestWaiting(world)).toBe(true);
    expect(pendingInterruption(world)).toBeNull();
  });
});

describe("study director world: the sponsor visit", () => {
  it("says what the dashboard says, and asks about the site that looks quiet", () => {
    const scene = guestScene(hiding(visited("s", "sponsorVisit")))!;
    expect(scene.visitor.organisation).toBe("Arcadia Therapeutics");
    expect(scene.body.join(" ")).toContain("Site 03");
    expect(scene.here).toBe(true);
    const calm = guestScene(visited("s", "sponsorVisit"))!;
    expect(calm.body.join(" ")).toContain("anything she should hear from you");
  });

  it("cannot be met from outside the conference room", () => {
    const world = visited("s", "sponsorVisit", {
      player: { x: 1, y: 1, facing: "down" },
    });
    const scene = guestScene(world)!;
    expect(scene.here).toBe(false);
    expect(scene.options.every((o) => !o.available)).toBe(true);
    expect(scene.options[0].reason).toContain("conference room");
    const result = meetGuest(world, "truth");
    expect(result).toEqual({ ok: false, reason: "unreachable" });
  });

  it("charges the listed time, energy and focus for each way to spend it", () => {
    const seed = seedWithManager("sponsorVisit");
    const world = visited(seed, "sponsorVisit");
    for (const option of guestScene(world)!.options) {
      const done = ok(meetGuest(world, option.id));
      expect(done.world.minute - world.minute).toBe(option.cost.minutes);
      expect(world.energy - done.world.energy).toBe(option.cost.energy);
      expect(world.focus - done.world.focus).toBe(option.cost.focus);
    }
  });

  it("rewards telling the truth you actually know over the clean summary", () => {
    const world = hiding(visited("s", "sponsorVisit"));
    const knowing = {
      ...world,
      study: {
        ...world.study,
        sites: world.study.sites.map((s) =>
          s.id === "site-03" ? { ...s, lastAuditedDay: world.study.day - 2 } : s
        ),
      },
    };
    const meter = (w: WorldState, key: "client" | "integrity") =>
      w.study.adjust[key];
    const truth = ok(meetGuest(knowing, "truth")).world;
    const guess = ok(meetGuest(world, "truth")).world;
    const summary = ok(meetGuest(world, "summary")).world;
    expect(meter(truth, "client")).toBeGreaterThan(meter(guess, "client"));
    expect(meter(truth, "integrity")).toBe(meter(world, "integrity") + 1);
    // The clean summary pleases her and costs integrity when something is hidden.
    expect(meter(summary, "client")).toBe(meter(world, "client") + 2);
    expect(meter(summary, "integrity")).toBe(meter(world, "integrity") - 3);
    // With nothing hidden the same summary is honest.
    const clean = visited("s", "sponsorVisit");
    expect(meter(ok(meetGuest(clean, "summary")).world, "integrity")).toBe(
      meter(clean, "integrity")
    );
  });

  it("hands her to the data manager only when they are on the floor", () => {
    const seed = seedWithManager("sponsorVisit");
    const world = visited(seed, "sponsorVisit");
    const manager = world.study.team.find((m) => m.role === "dataManager")!;
    const done = ok(meetGuest(world, "manager")).world;
    const after = done.study.team.find((m) => m.id === manager.id)!;
    expect(after.workload).toBeGreaterThan(manager.workload);
    expect(bondFor(done, manager.id).trust).toBeGreaterThanOrEqual(
      bondFor(world, manager.id).trust
    );

    // A day when they are away: the option explains itself and cannot be taken.
    const away = visited(seed, "sponsorVisit", { location: "parking" });
    const scene = guestScene({
      ...away,
      study: {
        ...away.study,
        team: away.study.team.filter((m) => m.role !== "dataManager"),
      },
    })!;
    const option = scene.options.find((o) => o.id === "manager")!;
    expect(option.available).toBe(false);
    expect(option.reason).toContain("not on the floor");
  });

  it("can be met once, and is then remembered", () => {
    const world = visited("s", "sponsorVisit");
    const done = ok(meetGuest(world, "reschedule")).world;
    expect(done.guests).toEqual([
      {
        id: "sponsorVisit",
        day: world.study.day,
        outcome: "met",
        choice: "reschedule",
      },
    ]);
    expect(guestScene(done)).toBeNull();
    expect(meetGuest(done, "reschedule").ok).toBe(false);
  });

  it("is a snub if nobody meets her, which the sponsor notices overnight", () => {
    const world = visited("s", "sponsorVisit", { minute: 17 * 60 });
    const home = goHome(world);
    expect(home.world.guests?.[0]).toMatchObject({
      id: "sponsorVisit",
      outcome: "missed",
    });
    // The night does its own work on the meter; the snub is the difference.
    const met = goHome({
      ...world,
      guests: [{ id: "sponsorVisit", day: world.study.day, outcome: "met" }],
    });
    expect(home.world.study.adjust.client).toBe(
      met.world.study.adjust.client - 4
    );
    expect(home.report.lines.some((l) => /nobody met her/.test(l.text))).toBe(
      true
    );
    expect(home.report.wrapUp?.some((l) => /waited/.test(l.text))).toBe(true);
  });
});

describe("study director world: the vendor meeting", () => {
  it("is about the EDC, and mentions the audit trail only if the debt calls for it", () => {
    const tidy = guestScene(visited("v", "vendorMeeting"))!;
    expect(tidy.visitor.organisation).toBe("Halden Data Systems");
    expect(tidy.body.join(" ")).toContain("good shape");
    const world = visited("v", "vendorMeeting");
    const messy = guestScene({
      ...world,
      study: { ...world.study, documentationDebt: 40 },
    })!;
    expect(messy.body.join(" ")).toContain("without a reason");
  });

  it("clears documentation debt and raises compliance with the audit-trail walkthrough", () => {
    const base = visited("v", "vendorMeeting");
    const world = { ...base, study: { ...base.study, documentationDebt: 30 } };
    const done = ok(meetGuest(world, "audit")).world;
    expect(done.study.documentationDebt).toBe(24);
    expect(done.study.adjust.compliance).toBe(
      world.study.adjust.compliance + 2
    );
    expect(done.minute - world.minute).toBe(45);
  });

  it("saves money on the renewal and costs the day for it", () => {
    const world = visited("v", "vendorMeeting");
    const done = ok(meetGuest(world, "renewal")).world;
    expect(done.study.spent).toBe(world.study.spent - 1500);
    expect(world.energy - done.energy).toBe(4);
    expect(world.focus - done.focus).toBe(6);
  });

  it("is simply missed without a penalty if nobody goes", () => {
    const world = visited("v", "vendorMeeting", { minute: 17 * 60 });
    const home = goHome(world);
    const met = goHome({
      ...world,
      guests: [{ id: "vendorMeeting", day: world.study.day, outcome: "met" }],
    });
    expect(home.world.study.adjust.client).toBe(met.world.study.adjust.client);
    expect(home.report.lines.some((l) => /brochure/.test(l.text))).toBe(true);
  });
});

describe("study director world: visitors across saves", () => {
  it("saves and resumes who was met", () => {
    const done = ok(meetGuest(visited("s", "sponsorVisit"), "truth")).world;
    expect(parseWorld(serializeWorld(done))?.guests).toEqual(done.guests);
  });

  it("drops a damaged record and keeps the rest", () => {
    const done = ok(meetGuest(visited("s", "sponsorVisit"), "truth")).world;
    const raw = JSON.parse(serializeWorld(done));
    raw.guests.push({ id: "nobody", day: 3, outcome: "met" });
    raw.guests.push({ id: "vendorMeeting", day: 3, outcome: "dancing" });
    raw.guests.push("junk");
    const restored = parseWorld(JSON.stringify(raw));
    expect(restored?.guests).toEqual(done.guests);
  });

  it("is deterministic: the same seed meets the same visitor with the same words", () => {
    const a = guestScene(visited("same", "sponsorVisit"));
    const b = guestScene(visited("same", "sponsorVisit"));
    expect(a).toEqual(b);
  });
});
