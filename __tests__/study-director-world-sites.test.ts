// @vitest-environment node
import { describe, expect, it } from "vitest";
import { dashboard, reportedSite, type SiteState } from "@/lib/study-director";
import {
  CRO_FLOOR,
  PI_LEAVES,
  SITE_CHECKS,
  SITE_CHECK_IDS,
  SITE_CLOSES,
  SITE_IDS,
  SITE_MAPS,
  SITE_ROOM_IDS,
  SITE_STATION_IDS,
  WORLD_MAPS,
  closeVisit,
  coordinatorProfile,
  currentMap,
  getStation,
  interact,
  isWalkable,
  newWorld,
  officeDirectory,
  parseWorld,
  performCheck,
  planRoute,
  serializeWorld,
  startDay,
  stepFrom,
  travel,
  travelMinutes,
  travelOptions,
  type Facing,
  type SiteCheckId,
  type StationId,
  type WorldState,
} from "@/lib/study-director-world";

const fresh = (seed = "sites-1"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

/** A world whose sites have been running for a while, with set problems. */
function withSites(
  world: WorldState,
  changes: Record<string, Partial<SiteState>>
): WorldState {
  return {
    ...world,
    study: {
      ...world.study,
      day: 30,
      sites: world.study.sites.map((s) => ({ ...s, ...changes[s.id] })),
    },
  };
}

const TROUBLED: Record<string, Partial<SiteState>> = {
  "site-02": {
    enrolled: 12,
    deviations: 3,
    unsignedSource: 1,
    eligibilityConcerns: 0,
    openQueries: 6,
  },
  "site-03": {
    enrolled: 10,
    deviations: 4,
    unsignedSource: 7,
    eligibilityConcerns: 2,
    openQueries: 9,
    trainingCurrent: false,
  },
};

/** Stands the player next to a station on the current map, facing it. */
function faceStation(world: WorldState, id: StationId): WorldState {
  const map = currentMap(world);
  const station = getStation(map, id)!;
  const dirs: Facing[] = ["down", "up", "left", "right"];
  const opposite: Record<Facing, Facing> = {
    up: "down",
    down: "up",
    left: "right",
    right: "left",
  };
  for (const d of dirs) {
    const t = stepFrom(station, d);
    if (isWalkable(map, t.x, t.y))
      return { ...world, player: { x: t.x, y: t.y, facing: opposite[d] } };
  }
  throw new Error(`No free tile beside ${id}`);
}

/** Drives to a site at 9:00 with a full day ahead. */
function atSite(world: WorldState, siteId: string): WorldState {
  return expectOk(travel({ ...world, minute: 9 * 60 }, siteId)).world;
}

describe("study director world: the site maps", () => {
  it("registers one map per site in WORLD_MAPS with every room and station", () => {
    for (const id of SITE_IDS) {
      const map = WORLD_MAPS[id];
      expect(map).toBe(SITE_MAPS[id]);
      expect(map.name).toBe(`Site ${id.slice(-2)}`);
      for (const row of map.rows) expect(row).toHaveLength(map.width);
      expect(map.rows).toHaveLength(map.height);
      expect(map.rooms.map((r) => r.id)).toEqual(
        expect.arrayContaining([...SITE_ROOM_IDS])
      );
      expect(map.stations.map((s) => s.id).sort()).toEqual(
        [...SITE_STATION_IDS, "exit"].sort()
      );
      expect(isWalkable(map, map.spawn.x, map.spawn.y)).toBe(true);
    }
    expect(WORLD_MAPS[CRO_FLOOR.id]).toBe(CRO_FLOOR);
  });

  it("can walk from the car to every room and station, so the directory works", () => {
    for (const id of SITE_IDS) {
      const map = SITE_MAPS[id];
      const entries = officeDirectory(map, []);
      expect(entries.length).toBe(map.rooms.length + map.stations.length);
      for (const entry of entries)
        expect(
          planRoute(map.spawn, entry.target, map),
          `${id} ${entry.id}`
        ).not.toBeNull();
    }
  });

  it("does every check at a station on the map", () => {
    for (const c of Object.values(SITE_CHECKS))
      expect(getStation(SITE_MAPS["site-01"], c.station)).not.toBeNull();
    expect(Object.keys(SITE_CHECKS).sort()).toEqual([...SITE_CHECK_IDS].sort());
  });
});

describe("study director world: fast travel", () => {
  it("offers the three sites from the CRO car park, beside going home", () => {
    const world = faceStation({ ...fresh(), minute: 9 * 60 }, "exit");
    const outcome = interact(world)!;
    expect(outcome.offer).toBe("goHome");
    expect(outcome.travel?.map((t) => t.mapId)).toEqual([...SITE_IDS]);
    expect(outcome.travel?.[1]).toEqual({
      mapId: "site-02",
      label: "Drive to Site 02",
      minutes: travelMinutes("site-02"),
    });
  });

  it("costs the drive's minutes and starts a visit on arrival", () => {
    const world = { ...fresh(), minute: 9 * 60 };
    const result = expectOk(travel(world, "site-03"));
    expect(result.world.minute).toBe(9 * 60 + travelMinutes("site-03"));
    expect(result.world.energy).toBeLessThan(world.energy);
    expect(currentMap(result.world)).toBe(SITE_MAPS["site-03"]);
    expect(result.world.location).toBe("siteParking");
    expect(result.world.visit).toMatchObject({
      siteId: "site-03",
      number: 1,
      checks: [],
      arrivedAt: result.world.minute,
    });
    expect(result.report).toBeNull();
  });

  it("refuses a site that would be closed by the time the player arrived", () => {
    const late = { ...fresh(), minute: SITE_CLOSES - 30 };
    expect(travel(late, "site-03")).toEqual({
      ok: false,
      reason: "site-closed",
    });
    expect(travelOptions(late)).toEqual([]);
    expect(travel(fresh(), "nowhere")).toEqual({
      ok: false,
      reason: "unknown-site",
    });
  });

  it("drives back to the office car park next to the car, writing up the visit", () => {
    const there = atSite(fresh(), "site-01");
    expect(travelOptions(there).map((t) => t.mapId)).toEqual([
      CRO_FLOOR.id,
      "site-02",
      "site-03",
      "site-04",
      "site-05",
    ]);
    const back = expectOk(travel(there, CRO_FLOOR.id));
    expect(currentMap(back.world)).toBe(CRO_FLOOR);
    expect(back.world.visit).toBeNull();
    expect(back.world.location).toBe("parking");
    expect(interact(back.world)?.title).toBe("Your car");
    expect(back.world.minute).toBe(there.minute + travelMinutes("site-01"));
    expect(back.report?.audited).toBe(false);
  });
});

describe("study director world: site checks cost time", () => {
  it("advances the clock and spends focus by each check's cost", () => {
    let world = atSite(withSites(fresh(), TROUBLED), "site-02");
    for (const id of [
      "temperatureLogs",
      "consent",
      "delegationLog",
    ] as SiteCheckId[]) {
      const before = world;
      world = expectOk(performCheck(world, id)).world;
      expect(world.minute - before.minute).toBe(SITE_CHECKS[id].cost.minutes);
      expect(before.focus - world.focus).toBe(SITE_CHECKS[id].cost.focus);
      expect(before.energy - world.energy).toBe(SITE_CHECKS[id].cost.energy);
    }
    expect(world.visit?.checks).toEqual([
      "temperatureLogs",
      "consent",
      "delegationLog",
    ]);
    expect(world.visit?.observations).toHaveLength(3);
    expect(performCheck(world, "consent")).toEqual({
      ok: false,
      reason: "already-checked",
    });
  });

  it("cannot do every check in one visit", () => {
    let world = atSite(withSites(fresh(), TROUBLED), "site-03");
    const refused: string[] = [];
    for (const id of SITE_CHECK_IDS) {
      const result = performCheck(world, id);
      if (result.ok) world = result.world;
      else refused.push(result.reason);
    }
    expect(refused.length).toBeGreaterThan(0);
    const totalFocus = Object.values(SITE_CHECKS).reduce(
      (sum, c) => sum + c.cost.focus,
      0
    );
    expect(totalFocus).toBeGreaterThan(100);
  });

  it("closes at the end of the site's day and the PI leaves early", () => {
    const world = atSite(fresh(), "site-01");
    expect(performCheck({ ...world, minute: PI_LEAVES }, "meetPi")).toEqual({
      ok: false,
      reason: "pi-unavailable",
    });
    expect(
      performCheck({ ...world, minute: SITE_CLOSES - 30 }, "sourceReview")
    ).toEqual({ ok: false, reason: "site-closed" });
    expect(performCheck({ ...world, focus: 10 }, "eligibility")).toEqual({
      ok: false,
      reason: "too-unfocused",
    });
    expect(performCheck(fresh(), "consent")).toEqual({
      ok: false,
      reason: "not-on-visit",
    });
  });

  it("offers the check, with its cost, when the player faces its station", () => {
    const world = faceStation(atSite(fresh(), "site-02"), "sourceDocuments");
    const outcome = interact(world, currentMap(world))!;
    expect(outcome.title).toBe("Source documents");
    expect(outcome.check).toBe("sourceReview");
    expect(outcome.lines.join(" ")).toContain("90 minutes");
    // Looking costs nothing; doing the check is a separate choice.
    expect(outcome.world.minute).toBe(world.minute);
  });
});

describe("study director world: observations resolve into an audit", () => {
  it("reveals the site's true state and names what the dashboard hid", () => {
    const start = withSites(fresh(), TROUBLED);
    const before = dashboard(start.study);
    let world = atSite(start, "site-03");
    world = expectOk(performCheck(world, "sourceReview")).world;
    world = expectOk(performCheck(world, "eligibility")).world;
    world = expectOk(performCheck(world, "delegationLog")).world;
    expect(world.visit?.observations.map((o) => o.tone)).toEqual([
      "bad",
      "bad",
      "bad",
    ]);

    const { world: after, report } = closeVisit(world);
    expect(after.visit).toBeNull();
    const site = after.study.sites.find((s) => s.id === "site-03")!;
    expect(site.lastAuditedDay).toBe(after.study.day);
    expect(after.study.log.at(-1)?.eventId).toBe("audit:site-03");
    // The dashboard now shows the truth for the audit window.
    expect(reportedSite(after.study, "site-03")?.unsignedSource).toBe(7);
    expect(dashboard(after.study).regulatory.health).not.toBe(
      before.regulatory.health
    );

    expect(report?.audited).toBe(true);
    const hidden = report!.findings.filter((f) => f.hidden).map((f) => f.label);
    expect(hidden).toEqual(
      expect.arrayContaining([
        "Unsigned source",
        "Questionable eligibility",
        "Training on the current protocol",
      ])
    );
    const unsigned = report!.findings.find(
      (f) => f.field === "unsignedSource"
    )!;
    expect(unsigned).toMatchObject({ actual: 7, reported: 1 });
    expect(unsigned.text).toBe("Unsigned source: 7. The dashboard showed 1.");
    expect(report!.verdict).toContain("unsigned source");
    expect(report!.unchecked).toEqual(["Deviations"]);
  });

  it("finds the annoying, terrified site was telling the truth", () => {
    let world = atSite(withSites(fresh(), TROUBLED), "site-02");
    world = expectOk(performCheck(world, "sourceReview")).world;
    world = expectOk(performCheck(world, "consent")).world;
    const { report } = closeVisit(world);
    expect(report?.findings.every((f) => !f.hidden)).toBe(true);
    expect(report?.verdict).toMatch(/honesty/);
  });

  it("audits nothing when the visit was only conversation", () => {
    let world = atSite(withSites(fresh(), TROUBLED), "site-03");
    world = expectOk(performCheck(world, "interviewCoordinator")).world;
    world = expectOk(performCheck(world, "meetPi")).world;
    const { world: after, report } = closeVisit(world);
    expect(report?.audited).toBe(false);
    expect(report?.findings).toEqual([]);
    expect(
      after.study.sites.find((s) => s.id === "site-03")?.lastAuditedDay
    ).toBeNull();
  });

  it("writes the visit up when the player drives on", () => {
    let world = atSite(withSites(fresh(), TROUBLED), "site-01");
    world = expectOk(performCheck(world, "delegationLog")).world;
    const next = expectOk(travel(world, "site-02"));
    expect(next.report?.siteId).toBe("site-01");
    expect(next.report?.audited).toBe(true);
    expect(next.world.visit?.siteId).toBe("site-02");
  });
});

describe("study director world: coordinator traits", () => {
  it("shows visible traits on the first visit and hides the rest", () => {
    const world = atSite(fresh(), "site-02");
    const profile = coordinatorProfile(world, "site-02")!;
    expect(profile.name).toBe("Priya Lindqvist");
    expect(profile.visible.map((t) => t.label)).toEqual([
      "Anxious",
      "Apologetic",
    ]);
    expect(profile.learned).toEqual([]);
    expect(profile.unknown).toBe(2);
    expect(profile.visits).toBe(1);
  });

  it("learns hidden traits from the right checks, some only on later visits", () => {
    let world = atSite(withSites(fresh(), TROUBLED), "site-02");
    // On the first visit, the interview does not yet reveal the witness habit.
    const talk = expectOk(performCheck(world, "interviewCoordinator"));
    expect(talk.learned).toEqual([]);
    world = talk.world;
    const source = expectOk(performCheck(world, "sourceReview"));
    expect(source.learned.map((t) => t.id)).toEqual(["meticulous"]);
    world = source.world;
    const first = closeVisit(world);
    expect(first.report?.learned.map((t) => t.label)).toEqual(["Meticulous"]);

    // Come back another day: the traits learned are kept, and the interview
    // now brings out the rest.
    const home = startDay(first.world).world;
    let again = atSite(home, "site-02");
    expect(again.visit?.number).toBe(2);
    expect(
      coordinatorProfile(again, "site-02")?.learned.map((t) => t.id)
    ).toEqual(["meticulous"]);
    const second = expectOk(performCheck(again, "interviewCoordinator"));
    expect(second.learned.map((t) => t.id)).toEqual(["witnessesConsent"]);
    again = second.world;
    const profile = coordinatorProfile(again, "site-02")!;
    expect(profile.unknown).toBe(0);
    expect(profile.visits).toBe(2);
    // Learning something twice does not add it twice.
    expect(
      again.known.filter((k) => k.startsWith("trait:site-02:"))
    ).toHaveLength(2);
  });

  it("the friendly coordinator who says everything is fine is overstretched", () => {
    const world = atSite(fresh(), "site-03");
    const profile = coordinatorProfile(world, "site-03")!;
    expect(profile.visible.map((t) => t.label)).toContain("Friendly");
    const talk = expectOk(performCheck(world, "interviewCoordinator"));
    expect(talk.learned.map((t) => t.label)).toEqual(["Overstretched"]);
    expect(talk.observation.text).toContain("Everything is fine");
  });
});

describe("study director world: visits across saves and days", () => {
  it("saves and resumes a visit in progress", () => {
    let world = atSite(withSites(fresh(), TROUBLED), "site-03");
    world = expectOk(performCheck(world, "temperatureLogs")).world;
    const restored = parseWorld(serializeWorld(world))!;
    expect(restored.map).toBe("site-03");
    expect(restored.visit).toEqual(world.visit);
    expect(restored.player).toEqual(world.player);
  });

  it("drops a visit to a site that is not in the study and returns to the floor", () => {
    const world = atSite(fresh(), "site-03");
    const raw = JSON.parse(serializeWorld(world));
    raw.visit.siteId = "site-99";
    const restored = parseWorld(JSON.stringify(raw))!;
    expect(restored.visit).toBeNull();
    expect(restored.map).toBe(CRO_FLOOR.id);
    expect(restored.player).toEqual(CRO_FLOOR.spawn);
  });

  it("starts the next morning back at the CRO lobby", () => {
    const world = atSite(fresh(), "site-01");
    const morning = startDay(world).world;
    expect(currentMap(morning)).toBe(CRO_FLOOR);
    expect(morning.visit).toBeNull();
    expect(morning.location).toBe("lobby");
  });
});
