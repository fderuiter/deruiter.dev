import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ARCADE_GAME_ROUTES, getArcadeNeighbors } from "@/lib/arcade";
import { ARCADE_GAMES_METADATA } from "@/lib/arcade-data";

describe("arcade previous/next ring (#1330)", () => {
  it("walks every game in hub order and wraps at both ends", () => {
    const visited: string[] = [];
    let route: (typeof ARCADE_GAME_ROUTES)[number] = ARCADE_GAME_ROUTES[0];
    for (let i = 0; i < ARCADE_GAME_ROUTES.length; i++) {
      visited.push(route);
      route = getArcadeNeighbors(route).next
        .href as (typeof ARCADE_GAME_ROUTES)[number];
    }
    expect(visited).toEqual([...ARCADE_GAME_ROUTES]);
    expect(route).toBe(ARCADE_GAME_ROUTES[0]);

    for (const r of ARCADE_GAME_ROUTES) {
      const { prev, next } = getArcadeNeighbors(r);
      expect(getArcadeNeighbors(next.href as typeof r).prev.href).toBe(r);
      expect(prev.label).toBe("Previous Game");
      expect(next.label).toBe("Next Game");
    }
  });

  it("puts Trial & Error between Clinical Chaos and Study Director", () => {
    expect(getArcadeNeighbors("/arcade/clinical-chaos").next.href).toBe(
      "/arcade/trial-and-error"
    );
    const te = getArcadeNeighbors("/arcade/trial-and-error");
    expect(te.prev.href).toBe("/arcade/clinical-chaos");
    expect(te.next.href).toBe("/arcade/study-director");
  });

  it("takes titles and tags from the shared game metadata", () => {
    const { next } = getArcadeNeighbors("/arcade/clinical-chaos");
    const meta = ARCADE_GAMES_METADATA.find(
      (g) => g.route === "/arcade/trial-and-error"
    );
    expect(next.title).toBe(meta?.title);
    expect(next.tag).toBe(meta?.genre);
  });

  it("every game page renders the shared ring, with no hardcoded neighbours", () => {
    const clients = [
      "WorkingWithDuck",
      "LaserLoon",
      "QuasiPuzzler",
      "GarminWatch",
      "ClinicalChaos",
      "TrialAndError",
      "StudyDirector",
      "RetroLabyrinth",
    ];
    for (const name of clients) {
      const src = readFileSync(
        path.resolve(process.cwd(), `components/arcade/${name}Client.tsx`),
        "utf8"
      );
      expect(src, name).toMatch(/getArcadeNeighbors\("\/arcade\/[a-z-]+"\)/);
      expect(src, name).not.toMatch(/label: "(Previous|Next) Game"/);
    }
  });

  it("game clients leave header clearance to PageLayout (no doubled pt-28)", () => {
    for (const name of [
      "ArcadeHub",
      "LaserLoon",
      "QuasiPuzzler",
      "GarminWatch",
      "ClinicalChaos",
      "RetroLabyrinth",
    ]) {
      const src = readFileSync(
        path.resolve(process.cwd(), `components/arcade/${name}Client.tsx`),
        "utf8"
      );
      expect(src, name).not.toMatch(/\bpt-28\b/);
    }
  });
});
