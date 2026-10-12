// Study Director playtest fixes (#1936): a finished run survives a reload,
// the overnight HUD and the site priority tell the truth.
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";
import {
  CRO_FLOOR,
  WORLD_SAVE_KEY,
  choosePriority,
  eveningWrapUp,
  getStation,
  goHome,
  hudReadout,
  newWorld,
  observe,
  serializeWorld,
  startDay,
  type SiteVisitReport,
  type WorldState,
} from "@/lib/study-director-world";

function dayOne(): WorldState {
  return startDay(newWorld("playtest-1936", "standard")).world;
}

/** A study that ended on its last overnight report, never closed out. */
function finishedButNotClosedOut(): WorldState {
  const world = dayOne();
  const car = getStation(CRO_FLOOR, "exit");
  if (!car) throw new Error("no car on the floor");
  const { study } = world;
  const lastDay: WorldState = {
    ...world,
    study: { ...study, day: study.setup.durationDays + study.slipDays - 1 },
    location: "parking",
    player: { x: car.x - 1, y: car.y, facing: "right" },
  };
  const night = goHome(lastDay);
  expect(night.report.complete).toBe(true);
  return night.world;
}

describe("Study Director world: reload after the last night (#1936)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("opens a finished run at its closeout instead of a new Day 1", async () => {
    globalThis.localStorage.setItem(
      WORLD_SAVE_KEY,
      serializeWorld(finishedButNotClosedOut())
    );
    window.history.replaceState(null, "", "/#mode=world");
    render(<StudyDirectorGame />);
    expect(await screen.findByTestId("study-report")).toBeTruthy();
    // Filed once: the next office run starts fresh.
    expect(globalThis.localStorage.getItem(WORLD_SAVE_KEY)).toBe(null);
  });
});

describe("Study Director world: honest readouts (#1936)", () => {
  it("shows Overnight on the HUD while the player is at home", () => {
    const night = goHome({ ...dayOne(), minute: 9 * 60 + 51 });
    const hud = hudReadout(night.world);
    expect(hud.clock).toBe("Overnight");
    expect(hud.overnight).toBe(true);
    expect(hudReadout(dayOne()).clock).toBe("8:00 AM");
  });

  it("keeps the sites priority only for a visit, not for hearsay", () => {
    const chosen = choosePriority(dayOne(), "sites");
    if (!chosen.ok) throw new Error("could not choose a priority");
    const told = observe(chosen.world, {
      id: "walt-site-03",
      day: chosen.world.study.day,
      source: "Walt",
      text: "Site 03 is behind on entry.",
      siteId: "site-03",
    });
    const heard = eveningWrapUp(told).map((l) => l.text);
    expect(heard.join(" ")).toContain("never looked at a site yourself");

    const visited: WorldState = {
      ...told,
      siteVisitHistory: [
        fromPartial<SiteVisitReport>({
          siteId: "site-01",
          siteName: "Site 01",
          day: told.study.day,
          checks: [],
          audited: false,
          findings: [],
          unchecked: [],
          learned: [],
        }),
      ],
    };
    expect(
      eveningWrapUp(visited)
        .map((l) => l.text)
        .join(" ")
    ).toContain("you looked at a site yourself. Kept.");
  });
});
