import {
  isBlocked,
  roomAt,
  type DirectoryEntry,
  type PersonPlacement,
  type TilePoint,
  type WorldMap,
} from "@/lib/study-director-world";
import type { View } from "./camera";

/**
 * The tile under a point on the floor canvas, from where the point falls as a
 * fraction of the canvas (0 to 1 across and down). The view is the part of the
 * map on screen, so the same tap lands on a different tile as the camera moves.
 */
export function tileUnderTap(view: View, fx: number, fy: number): TilePoint {
  return {
    x: Math.floor(view.x + fx * view.w),
    y: Math.floor(view.y + fy * view.h),
  };
}

/** A walk to one free tile, shaped as a directory entry so it reuses the directory walk. */
function tileEntry(map: WorldMap, tile: TilePoint): DirectoryEntry {
  return {
    id: `tile:${tile.x},${tile.y}`,
    label: "that spot",
    detail: "Floor",
    target: {
      kind: "room",
      room: {
        id: roomAt(map, tile.x, tile.y)?.id ?? map.rooms[0].id,
        name: "that spot",
        bounds: { x: tile.x, y: tile.y, width: 1, height: 1 },
        anchor: tile,
        seats: [],
        blurb: "",
      },
    },
  };
}

/**
 * Where a tap on the floor sends the player: the person or station on the
 * tapped tile (walk up to them), or the tapped free tile itself. Walls,
 * furniture and tiles off the map send nowhere (null).
 */
export function tapDestination(args: {
  map: WorldMap;
  people: readonly PersonPlacement[];
  directory: readonly DirectoryEntry[];
  view: View;
  fx: number;
  fy: number;
}): DirectoryEntry | null {
  const { map, people, directory, view, fx, fy } = args;
  const tile = tileUnderTap(view, fx, fy);
  if (tile.x < 0 || tile.y < 0 || tile.x >= map.width || tile.y >= map.height)
    return null;
  const person = people.find((p) => p.x === tile.x && p.y === tile.y);
  if (person)
    return directory.find((e) => e.id === `person:${person.memberId}`) ?? null;
  const station = map.stations.find((s) => s.x === tile.x && s.y === tile.y);
  if (station)
    return directory.find((e) => e.id === `station:${station.id}`) ?? null;
  if (isBlocked(map, tile.x, tile.y, people)) return null;
  return tileEntry(map, tile);
}
