import type { StudyState } from "@/lib/study-director";
import { dressFloor, type DressingInput } from "./dressing";
import { CRO_FLOOR, isWalkable, tileAt } from "./floor";
import { facingToward } from "./movement";
import type {
  Facing,
  PersonPlacement,
  Room,
  RoomCondition,
  RoomId,
  TilePoint,
  WorldMap,
} from "../types";

const NEIGHBOURS: readonly TilePoint[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];

/** Faces a person toward the desk beside them, or into the room. */
function deskFacing(map: WorldMap, at: TilePoint): Facing {
  for (const d of NEIGHBOURS) {
    const t = { x: at.x + d.x, y: at.y + d.y };
    if (tileAt(map, t.x, t.y) === "desk") return facingToward(at, t);
  }
  return "down";
}

/** Free tiles in a room after its seats, for teams larger than the desks. */
function spareTiles(map: WorldMap, room: Room): TilePoint[] {
  const tiles: TilePoint[] = [];
  const { x, y, width, height } = room.bounds;
  for (let ty = y; ty < y + height; ty += 1)
    for (let tx = x; tx < x + width; tx += 1) {
      const isAnchor = tx === room.anchor.x && ty === room.anchor.y;
      if (!isAnchor && isWalkable(map, tx, ty)) tiles.push({ x: tx, y: ty });
    }
  return tiles;
}

/**
 * Where each team member stands: at a desk in their department's room, in
 * team order. This is the default placement; NPC schedules (#1688) will
 * move people through the day and pass their own placements instead.
 * Members whose role has no room on the map are left off it.
 */
export function placeTeam(
  study: StudyState,
  map: WorldMap = CRO_FLOOR
): PersonPlacement[] {
  const taken = new Set<string>();
  const placements: PersonPlacement[] = [];
  for (const member of study.team) {
    const room = map.rooms.find((r) => r.department === member.role);
    if (!room) continue;
    const spot = [...room.seats, ...spareTiles(map, room)].find(
      (t) => !taken.has(`${t.x},${t.y}`)
    );
    if (!spot) continue;
    taken.add(`${spot.x},${spot.y}`);
    placements.push({
      memberId: member.id,
      name: member.name,
      role: member.role,
      room: room.id,
      x: spot.x,
      y: spot.y,
      facing: deskFacing(map, spot),
    });
  }
  return placements;
}

/** A tidy room: no clutter, no marks. */
export const TIDY_ROOM: RoomCondition = { clutter: 0, marks: [] };

/**
 * How every room on a map looks. Without a world every room is tidy; with
 * one, the office tells the story of the study (#1691): the conditions come
 * from `dressFloor`, the pure state-to-set-dressing mapping.
 */
export function roomConditions(
  map: WorldMap = CRO_FLOOR,
  world?: DressingInput
): Record<RoomId, RoomCondition> {
  if (world) return dressFloor(world, map).rooms;
  const conditions = {} as Record<RoomId, RoomCondition>;
  for (const room of map.rooms) conditions[room.id] = TIDY_ROOM;
  return conditions;
}
