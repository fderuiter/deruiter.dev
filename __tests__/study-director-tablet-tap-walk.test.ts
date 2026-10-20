// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  currentMap,
  newWorld,
  officeDirectory,
  placePeople,
  planRoute,
  startDay,
} from "@/lib/study-director-world";
import { followCamera } from "@/components/study-director-world/camera";
import {
  tapDestination,
  tileUnderTap,
} from "@/components/study-director-world/tap-walk";

function office() {
  const { world } = startDay(newWorld("tap-walk", "standard"));
  const map = currentMap(world);
  const people = placePeople(world, map);
  const directory = officeDirectory(map, people);
  const view = followCamera(world.player, map);
  return { world, map, people, directory, view };
}

/** Where a tile's centre falls across and down the canvas. */
const fractionOf = (
  view: { x: number; y: number; w: number; h: number },
  tile: { x: number; y: number }
) => ({
  fx: (tile.x + 0.5 - view.x) / view.w,
  fy: (tile.y + 0.5 - view.y) / view.h,
});

describe("tap to walk (#2076)", () => {
  it("finds the tile under a tap from the camera's view", () => {
    const view = { x: 4.5, y: 2, w: 22, h: 13 };
    expect(tileUnderTap(view, 0, 0)).toEqual({ x: 4, y: 2 });
    expect(tileUnderTap(view, 0.5, 0.5)).toEqual({ x: 15, y: 8 });
    // The far corner is the last tile on screen, not the one after it.
    expect(tileUnderTap(view, 0.9999, 0.9999)).toEqual({ x: 26, y: 14 });
  });

  it("walks to the station, or the person, under the finger", () => {
    const { map, people, directory, view } = office();
    const inView = (t: { x: number; y: number }) =>
      t.x >= view.x &&
      t.x < view.x + view.w &&
      t.y >= view.y &&
      t.y < view.y + view.h;
    const station = map.stations.find(inView);
    expect(station).toBeDefined();
    const toStation = tapDestination({
      map,
      people,
      directory,
      view,
      ...fractionOf(view, station!),
    });
    expect(toStation?.id).toBe(`station:${station!.id}`);

    const person = people.find(inView);
    if (person) {
      const toPerson = tapDestination({
        map,
        people,
        directory,
        view,
        ...fractionOf(view, person),
      });
      expect(toPerson?.id).toBe(`person:${person.memberId}`);
    }
  });

  it("walks to a free tile, along a route the directory walk can follow", () => {
    const { world, map, people, directory, view } = office();
    const free = { x: world.player.x + 2, y: world.player.y };
    const entry = tapDestination({
      map,
      people,
      directory,
      view,
      ...fractionOf(view, free),
    });
    expect(entry?.id).toBe(`tile:${free.x},${free.y}`);
    expect(entry?.label).toBe("that spot");
    const route = planRoute(world.player, entry!.target, map, people);
    expect(route).not.toBeNull();
    expect(route!.steps.length).toBe(2);
  });

  it("goes nowhere for a wall, furniture or a tile off the map", () => {
    const { map, people, directory } = office();
    // The map's top-left tile is a wall.
    expect(
      tapDestination({
        map,
        people,
        directory,
        view: { x: 0, y: 0, w: 22, h: 13 },
        fx: 0.01,
        fy: 0.01,
      })
    ).toBeNull();
    expect(
      tapDestination({
        map,
        people,
        directory,
        view: { x: map.width, y: 0, w: 22, h: 13 },
        fx: 0.1,
        fy: 0.5,
      })
    ).toBeNull();
  });
});
