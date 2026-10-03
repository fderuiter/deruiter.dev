// @vitest-environment node
import { describe, expect, it } from "vitest";
import { computeMeters, type StudyState } from "@/lib/study-director";
import {
  CRO_FLOOR,
  DAY_END,
  HARD_STOP,
  PLAYER_MUG,
  ROOM_IDS,
  SET_DRESSING_MARKS,
  TIDY_ROOM,
  binFor,
  countMarks,
  describeDressing,
  describeSurroundings,
  dressFloor,
  examineSelf,
  moodFor,
  newWorld,
  paperStacksFor,
  plantFor,
  redMarksFor,
  roomConditions,
  startDay,
  stickyNotesFor,
  teamHours,
  type WorldState,
} from "@/lib/study-director-world";
import { sceneFor } from "@/components/study-director/scene";
import {
  FloorRenderer,
  sceneHasFire,
  type FloorScene,
} from "@/components/study-director-world/floor-renderer";

const fresh = (seed = "dress-1"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

/** A world whose study has been pushed by `edit`. */
function withStudy(
  world: WorldState,
  edit: (study: StudyState) => StudyState,
  extra: Partial<WorldState> = {}
): WorldState {
  return { ...world, ...extra, study: edit(world.study) };
}

function workload(study: StudyState, load: Record<string, number>) {
  return study.team.map((m) => ({ ...m, workload: load[m.id] ?? m.workload }));
}

/** Overloaded but holding: queries piling up, the sponsor restless. */
function stressed(world = fresh()): WorldState {
  return withStudy(
    world,
    (s) => ({
      ...s,
      day: 20,
      team: workload(s, { maya: 88, walt: 80, dana: 70, priya: 70 }),
      sites: s.sites.map((site) => ({ ...site, openQueries: 12 })),
      documentationDebt: 45,
      adjust: { ...s.adjust, client: -15, team: -35 },
    }),
    { coffees: 3, fatigue: 10 }
  );
}

/** Everything is on fire. */
function crisis(world = fresh()): WorldState {
  return withStudy(
    world,
    (s) => ({
      ...s,
      day: 90,
      team: s.team.map((m) => ({ ...m, workload: 98 })),
      sites: s.sites.map((site) => ({ ...site, openQueries: 40 })),
      documentationDebt: 90,
      slipDays: 30,
      adjust: {
        ...s.adjust,
        integrity: -70,
        compliance: -70,
        client: -70,
        team: -70,
      },
    }),
    { coffees: 6, fatigue: 40 }
  );
}

describe("study director world: the office tells the story", () => {
  it("dresses a calm first morning lightly", () => {
    const d = dressFloor(fresh());
    expect(d.mood).toBe("calm");
    expect(d.bin).toBe("calm");
    expect(d.printouts).toBe(0);
    expect(d.travelPins).toBe(0);
    expect(d.fileOverflow).toBe(0);
    expect(d.crisisMeetings).toBe(0);
    expect(d.cups).toBe(1);
    expect(d.lunch).toBe(3);
    expect(d.hours.every((h) => !h.staysLate && h.leavesAt === DAY_END)).toBe(
      true
    );
    expect(countMarks(d.rooms.office, "fire")).toBe(0);
    expect(countMarks(d.rooms.office, "smoke")).toBe(0);
    expect(countMarks(d.rooms.breakRoom, "deserted")).toBe(0);
  });

  it("dresses every room on the map and nothing else", () => {
    const d = dressFloor(stressed());
    expect(Object.keys(d.rooms).sort()).toEqual([...ROOM_IDS].sort());
    const known = new Set<string>(SET_DRESSING_MARKS);
    for (const c of Object.values(d.rooms)) {
      expect(c.clutter).toBeGreaterThanOrEqual(0);
      expect(c.clutter).toBeLessThanOrEqual(1);
      for (const m of c.marks) expect(known.has(m)).toBe(true);
    }
  });

  it("fills the floor as the study degrades", () => {
    const calm = dressFloor(fresh());
    const mid = dressFloor(stressed());
    const bad = dressFloor(crisis());
    expect(mid.mood).toBe("stressed");
    expect(bad.mood).toBe("crisis");
    for (const key of [
      "printouts",
      "travelPins",
      "fileOverflow",
      "sponsorMail",
      "crisisMeetings",
      "cups",
    ] as const) {
      expect(mid[key]).toBeGreaterThanOrEqual(calm[key]);
      expect(bad[key]).toBeGreaterThanOrEqual(mid[key]);
    }
    expect(bad.lunch).toBeLessThan(calm.lunch);
    expect(bad.printouts).toBe(4);
    expect(bad.travelPins).toBe(6);
    expect(bad.fileOverflow).toBe(4);
    expect(bad.crisisMeetings).toBe(3);
    expect(bad.cups).toBe(6);
  });

  it("puts each mark in its room", () => {
    const d = dressFloor(stressed());
    expect(countMarks(d.rooms.dataManagement, "printout")).toBe(d.printouts);
    expect(countMarks(d.rooms.monitoring, "travelPin")).toBe(d.travelPins);
    expect(countMarks(d.rooms.regulatory, "fileOverflow")).toBe(d.fileOverflow);
    expect(countMarks(d.rooms.lobby, "sponsorMail")).toBe(d.sponsorMail);
    expect(countMarks(d.rooms.conference, "crisisMeeting")).toBe(
      d.crisisMeetings
    );
    expect(countMarks(d.rooms.office, "cup")).toBe(d.cups);
    expect(countMarks(d.rooms.breakRoom, "lunch")).toBe(d.lunch);
    // Maya (88) stays late in Data Management, Walt (80) in Monitoring.
    expect(countMarks(d.rooms.dataManagement, "lateLamp")).toBe(1);
    expect(countMarks(d.rooms.monitoring, "lateLamp")).toBe(1);
    expect(countMarks(d.rooms.programming, "lateLamp")).toBe(0);
    expect(d.rooms.dataManagement.clutter).toBeGreaterThan(
      d.rooms.programming.clutter
    );
  });

  it("smokes, then burns, and empties the break room in a crisis", () => {
    const mid = dressFloor(stressed());
    expect(mid.bin).toBe("smoke");
    expect(countMarks(mid.rooms.office, "smoke")).toBe(1);
    expect(countMarks(mid.rooms.office, "fire")).toBe(0);
    const bad = dressFloor(crisis());
    expect(bad.bin).toBe("fire");
    expect(countMarks(bad.rooms.office, "fire")).toBe(1);
    expect(bad.lunch).toBe(0);
    expect(countMarks(bad.rooms.breakRoom, "deserted")).toBe(1);
  });

  it("is pure: the same state gives the same dressing and changes nothing", () => {
    const world = crisis();
    const before = JSON.stringify(world);
    expect(dressFloor(world)).toEqual(dressFloor(world));
    expect(JSON.stringify(world)).toBe(before);
  });

  it("feeds the roomConditions seam, which stays tidy without a world", () => {
    const world = stressed();
    expect(roomConditions(CRO_FLOOR, world)).toEqual(dressFloor(world).rooms);
    for (const c of Object.values(roomConditions(CRO_FLOOR)))
      expect(c).toEqual(TIDY_ROOM);
  });

  it("describes the set dressing in the room description", () => {
    const world = crisis();
    const conditions = roomConditions(CRO_FLOOR, world);
    const inOffice: WorldState = {
      ...world,
      player: { x: 4, y: 4, facing: "left" },
      location: "office",
    };
    const text = describeSurroundings(inOffice, CRO_FLOOR, [], conditions);
    expect(text).toContain("The waste bin is on fire.");
    expect(text).toContain("Six coffee cups");
    expect(describeDressing(conditions.breakRoom)).toContain(
      "Nobody takes a break here any more."
    );
    expect(describeDressing(conditions.dataManagement).join(" ")).toMatch(
      /query printouts/
    );
    expect(describeDressing(TIDY_ROOM)).toEqual([]);
    expect(describeDressing(undefined)).toEqual([]);
  });
});

describe("study director world: team hours hint", () => {
  it("keeps the overloaded late, within the hard stop, and off the break room", () => {
    const hours = teamHours(crisis().study);
    for (const h of hours) {
      expect(h.staysLate).toBe(true);
      expect(h.lunchAtDesk).toBe(true);
      expect(h.leavesAt).toBeGreaterThan(DAY_END);
      expect(h.leavesAt).toBeLessThanOrEqual(HARD_STOP);
    }
    const calm = teamHours(fresh().study);
    expect(calm.every((h) => h.leavesAt === DAY_END)).toBe(true);
  });
});

describe("study director world: shared decay rules", () => {
  it("are the rules the classic office illustration uses", () => {
    const { study } = crisis();
    const meters = computeMeters(study);
    const scene = sceneFor(study, meters);
    expect(scene.paperStacks).toBe(paperStacksFor(120));
    expect(scene.stickyNotes).toBe(stickyNotesFor(90));
    expect(scene.redMarks).toBe(redMarksFor(30));
    expect(scene.plant).toBe(plantFor(meters.team));
    expect(scene.fire).toBe(binFor(meters) === "fire");
    expect(scene.smoke).toBe(binFor(meters) !== "calm");
  });

  it("keep the classic thresholds", () => {
    const meters = {
      integrity: 100,
      compliance: 100,
      timeline: 100,
      budget: 100,
      client: 100,
      team: 100,
    };
    expect(binFor(meters)).toBe("calm");
    expect(binFor({ ...meters, budget: 34 })).toBe("smoke");
    expect(binFor({ ...meters, budget: 35 })).toBe("calm");
    expect(binFor({ ...meters, budget: 19 })).toBe("fire");
    expect(moodFor({ ...meters, team: 49 })).toBe("stressed");
    expect(moodFor({ ...meters, team: 19 })).toBe("crisis");
    expect(paperStacksFor(11)).toBe(0);
    expect(paperStacksFor(500)).toBe(4);
    expect(stickyNotesFor(100)).toBe(6);
    expect(redMarksFor(1)).toBe(1);
    expect(redMarksFor(100)).toBe(3);
    expect(plantFor(60)).toBe("thriving");
    expect(plantFor(35)).toBe("droopy");
    expect(plantFor(34)).toBe("wilted");
  });
});

describe("study director world: the FINE mug", () => {
  it("says everything is fine, whatever the state", () => {
    for (const world of [fresh(), stressed(), crisis()]) {
      const out = examineSelf(world);
      expect(out.world).toBe(world);
      expect(out.title).toBe("You");
      expect(out.lines.join(" ")).toContain(PLAYER_MUG);
      expect(out.lines[out.lines.length - 1]).toBe("Everything is fine.");
    }
    expect(examineSelf(crisis()).lines).toContain(
      "Behind you, the waste bin is on fire."
    );
  });
});

describe("study director world: the bin fire and reduced motion", () => {
  const sceneFor = (world: WorldState): FloorScene => ({
    map: CRO_FLOOR,
    player: world.player,
    people: [],
    conditions: roomConditions(CRO_FLOOR, world),
    target: null,
  });

  it("animates only when motion is allowed", () => {
    const burning = sceneFor(crisis());
    expect(sceneHasFire(burning)).toBe(true);
    const engine = new FloorRenderer(burning);
    expect(engine.isAnimating()).toBe(true);
    engine.setReducedMotion(true);
    expect(engine.isAnimating()).toBe(false);
    engine.setReducedMotion(false);
    expect(engine.isAnimating()).toBe(true);
  });

  it("does not run the loop for a floor without a fire", () => {
    const calm = sceneFor(fresh());
    expect(sceneHasFire(calm)).toBe(false);
    expect(new FloorRenderer(calm).isAnimating()).toBe(false);
  });
});
