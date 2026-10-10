// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  advanceDay,
  createStudy,
  reportedSite,
  type SiteState,
} from "@/lib/study-director";
import {
  SITE_CHECKS,
  SITE_CHECK_IDS,
  SITE_IDS,
  SITE_MAPS,
  closeVisit,
  coordinatorProfile,
  newWorld,
  performCheck,
  startDay,
  travel,
  travelMinutes,
  type WorldState,
} from "@/lib/study-director-world";

const fresh = (seed = "more-sites"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

/** A study some weeks in, with the same problems at every site. */
function troubled(world: WorldState): WorldState {
  return {
    ...world,
    study: {
      ...world.study,
      day: 30,
      sites: world.study.sites.map((s) => ({
        ...s,
        enrolled: 8,
        deviations: 4,
        unsignedSource: 6,
        eligibilityConcerns: 1,
        openQueries: 10,
      })),
    },
  };
}

const atSite = (world: WorldState, siteId: string): WorldState =>
  expectOk(travel({ ...world, minute: 9 * 60 }, siteId)).world;

describe("study director world: five clinical sites", () => {
  it("has five sites in the study and a map for each", () => {
    expect(STUDY_24_081_SITES.map((s) => s.id)).toEqual([...SITE_IDS]);
    expect(SITE_IDS).toHaveLength(5);
    for (const id of SITE_IDS) expect(SITE_MAPS[id].name).toMatch(/^Site 0\d$/);
  });

  it("gives every site its own coordinator, investigator, distance and type", () => {
    const people = SITE_IDS.map((id) =>
      coordinatorProfile(atSite(fresh(), id), id)!
    );
    expect(new Set(people.map((p) => p.name)).size).toBe(5);
    expect(new Set(SITE_IDS.map((id) => travelMinutes(id))).size).toBe(5);
    expect(new Set(STUDY_24_081_SITES.map((s) => s.coordinator)).size).toBe(5);
    // No two coordinators share a visible or hidden trait.
    const traitIds = people.flatMap((p) => [
      ...p.visible.map((t) => t.id),
      ...Array.from({ length: p.unknown }, (_, i) => `hidden-${p.name}-${i}`),
    ]);
    expect(new Set(traitIds).size).toBe(traitIds.length);
  });

  it("charges each check its listed time, energy and focus at the new sites", () => {
    for (const siteId of ["site-04", "site-05"]) {
      let world = atSite(troubled(fresh()), siteId);
      for (const id of SITE_CHECK_IDS) {
        const before = world;
        world = expectOk(performCheck(world, id)).world;
        expect(world.minute - before.minute).toBe(SITE_CHECKS[id].cost.minutes);
        expect(before.focus - world.focus).toBe(SITE_CHECKS[id].cost.focus);
        expect(before.energy - world.energy).toBe(SITE_CHECKS[id].cost.energy);
        // Keep the day long enough for the next check.
        world = { ...world, minute: 9 * 60, energy: 100, focus: 100 };
      }
    }
  });
});

describe("study director world: the overconfident coordinator", () => {
  it("shows confidence on the first visit and hides how the records are kept", () => {
    const world = atSite(fresh(), "site-04");
    const profile = coordinatorProfile(world, "site-04")!;
    expect(profile.name).toBe("Marcus Webb");
    expect(profile.visible.map((t) => t.label)).toEqual([
      "Confident",
      "Replies in minutes",
    ]);
    expect(profile.learned).toEqual([]);
    expect(profile.unknown).toBe(2);
  });

  it("learns the records are written from memory, then that steps are skipped", () => {
    const world = atSite(troubled(fresh()), "site-04");
    // The investigator only says so from the second visit.
    expect(expectOk(performCheck(world, "meetPi")).learned).toEqual([]);
    const source = expectOk(performCheck(world, "sourceReview"));
    expect(source.learned.map((t) => t.id)).toEqual(["worksFromMemory"]);
    const closed = closeVisit(source.world);
    const again = atSite(startDay(closed.world).world, "site-04");
    expect(
      expectOk(performCheck(again, "meetPi")).learned.map((t) => t.id)
    ).toEqual(["skipsSteps"]);
  });

  it("hides most of its trouble from the dashboard until audited", () => {
    const { study } = troubled(fresh());
    const site = study.sites.find((s) => s.id === "site-04") as SiteState;
    const shown = reportedSite(study, "site-04")!;
    expect(shown.openQueries).toBeLessThan(site.openQueries / 2);
    expect(shown.unsignedSource).toBeLessThan(site.unsignedSource / 2);
  });
});

describe("study director world: the new coordinator", () => {
  it("is eager and new, and tells you so", () => {
    const world = atSite(fresh(), "site-05");
    const profile = coordinatorProfile(world, "site-05")!;
    expect(profile.name).toBe("Jun Park");
    expect(profile.visible.map((t) => t.label)).toEqual([
      "Eager",
      "New to the job",
    ]);
  });

  it("learns they have no one to ask from the interview on the first visit", () => {
    const world = atSite(fresh(), "site-05");
    const talk = expectOk(performCheck(world, "interviewCoordinator"));
    expect(talk.learned.map((t) => t.id)).toEqual(["noOneToAsk"]);
    expect(talk.observation.text).toContain("Is this right?");
  });

  it("reports nearly everything, so the dashboard is close to the truth", () => {
    const { study } = troubled(fresh());
    const site = study.sites.find((s) => s.id === "site-05") as SiteState;
    const shown = reportedSite(study, "site-05")!;
    expect(shown.openQueries).toBeGreaterThanOrEqual(site.openQueries * 0.7);
    expect(shown.deviations).toBeGreaterThanOrEqual(site.deviations * 0.7);
  });

  it("makes more mistakes than a steady coordinator would, because it is new", () => {
    const sites = STUDY_24_081_SITES.map((site) => ({
      ...site,
      coordinator: site.id === "site-05" ? "newcomer" : "steady",
      burden: 50,
    })) as SiteState[];
    let newcomer = 0;
    let steady = 0;
    for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      let study = createStudy(seed, STUDY_24_081, sites, STUDY_24_081_TEAM);
      for (let day = 0; day < 45; day++) study = advanceDay(study);
      for (const s of study.sites)
        if (s.id === "site-05") newcomer += s.deviations;
        else if (s.id === "site-01") steady += s.deviations;
    }
    expect(newcomer).toBeGreaterThan(steady);
  });
});
