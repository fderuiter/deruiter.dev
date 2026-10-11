/**
 * Where an interact press lands (ADR 0060). The engine, the prompts, the coach
 * outline and the solo assist all read this one rule, so a press always acts
 * on the tile the player can see it act on, and the assist can plan a press
 * without importing the simulation that imports it.
 *
 * This module imports only types and presets.
 */

import { PLAYER_RADIUS, VENUE_MAP, WALKABLE_TILES } from "../presets";
import type {
  GameState,
  Item,
  ItemKind,
  Player,
  PlayerId,
  Station,
  SupplyKind,
  Tile,
} from "../types";

/** What a grill cooks, by the raw item put on it. */
export const GRILL_COOKS: Readonly<Partial<Record<ItemKind, ItemKind>>> = {
  "hotdogs-raw": "hotdogs",
  "wings-raw": "wings",
};

/** The raw crate each cooked food came from, so a burnt batch can restock it. */
export const RAW_FOR_COOKED: Readonly<Partial<Record<ItemKind, SupplyKind>>> = {
  hotdogs: "hotdogs-raw",
  wings: "wings-raw",
};

export function tileAt(x: number, y: number): string {
  return VENUE_MAP[y]?.[x] ?? "#";
}

export function isWalkable(x: number, y: number): boolean {
  return WALKABLE_TILES.includes(tileAt(x, y));
}

/** The tile a person is facing, one step from the tile they stand on. */
export function frontTile(
  player: Pick<Player, "x" | "y" | "facingX" | "facingY">
): { x: number; y: number } {
  return {
    x: Math.floor(player.x) + player.facingX,
    y: Math.floor(player.y) + player.facingY,
  };
}

/** Whether a station takes this item now: it is empty and the item suits it. */
export function stationAccepts(station: Station, item: Item): boolean {
  if (station.item) return false;
  // The bin is emptied by holding work at it, never by a press.
  if (station.kind === "bin") return false;
  if (station.kind === "grill") return item.kind in GRILL_COOKS;
  return item.kind === "roses";
}

/** The four neighbours of a tile, in a fixed order so a tie always breaks the same way. */
const NEIGHBOURS: readonly Tile[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function sameTile(a: Tile, b: Tile): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Whether a crate, station or open target on this tile takes the held item
 * now. The floor is not counted here: it is the fallback after reach.
 */
function tileTakes(state: GameState, tile: Tile, held: Item): boolean {
  const supply = state.supplies.find((s) => sameTile(s, tile));
  if (supply) return supply.kind === held.kind;
  const station = state.stations.find((s) => sameTile(s, tile));
  if (station) return stationAccepts(station, held);
  const target = state.targets.find((t) => sameTile(t, tile));
  if (target) return target.status === "open" && target.wants === held.kind;
  return false;
}

/** Whether an item may rest on this tile: walkable ground with nothing on it. */
function floorDropAt(state: GameState, tile: Tile): boolean {
  if (!isWalkable(tile.x, tile.y)) return false;
  const occupied = [
    state.supplies,
    state.stations,
    state.targets,
    state.floor,
  ].some((list) => list.some((entry) => sameTile(entry, tile)));
  return !occupied;
}

/**
 * The tiles a body can act on, the one in front of its nearest tile first.
 * A body is a circle of PLAYER_RADIUS, so when it straddles a boundary across
 * its facing, the tile in front of each tile it overlaps counts too (round 8,
 * ADR 0060). The list is never empty and its first entry is `frontTile`.
 */
export function faceTiles(
  person: Pick<Player, "x" | "y" | "facingX" | "facingY">
): Tile[] {
  const primary = frontTile(person);
  const cx = Math.floor(person.x);
  const cy = Math.floor(person.y);
  const tiles: Tile[] = [primary];
  if (person.facingY !== 0) {
    if (person.x - PLAYER_RADIUS < cx)
      tiles.push({ x: cx - 1, y: cy + person.facingY });
    if (person.x + PLAYER_RADIUS > cx + 1)
      tiles.push({ x: cx + 1, y: cy + person.facingY });
  } else if (person.facingX !== 0) {
    if (person.y - PLAYER_RADIUS < cy)
      tiles.push({ x: cx + person.facingX, y: cy - 1 });
    if (person.y + PLAYER_RADIUS > cy + 1)
      tiles.push({ x: cx + person.facingX, y: cy + 1 });
  }
  return tiles;
}

/** Whether a press on this tile with empty hands would pick something up. */
function pickableAt(state: GameState, tile: Tile): boolean {
  const supply = state.supplies.find((s) => sameTile(s, tile));
  const station = state.stations.find((s) => sameTile(s, tile));
  const floorItem = state.floor.find((f) => sameTile(f, tile));
  return (
    (supply !== undefined && state.stock[supply.kind] > 0) ||
    station?.item != null ||
    floorItem !== undefined
  );
}

/**
 * The tile a press of the interact key acts on for a person standing as
 * `person` describes, or null when a press does nothing. Pure and
 * deterministic: the engine, the prompts, the canvas and the assist's route
 * all read this one rule.
 *
 * With nothing in hand, the first faced tile (see `faceTiles`) that has stock,
 * an item on a station, or a loose item on the floor is used. With something
 * in hand, the first faced tile that takes the item is used. Failing that, a
 * station next to the person that takes the item is used, so standing beside
 * the arrange table puts roses on it and not on the floor. The floor is the
 * last choice, and only the tile in front of the nearest tile counts as the
 * floor.
 */
export function pressTileFor(
  state: GameState,
  person: Pick<Player, "x" | "y" | "facingX" | "facingY" | "holding">
): Tile | null {
  const faced = faceTiles(person);
  const held = person.holding;
  if (!held) {
    return faced.find((tile) => pickableAt(state, tile)) ?? null;
  }
  const takes = faced.find((tile) => tileTakes(state, tile, held));
  if (takes) return takes;
  const cx = Math.floor(person.x);
  const cy = Math.floor(person.y);
  for (const offset of NEIGHBOURS) {
    const tile = { x: cx + offset.x, y: cy + offset.y };
    const station = state.stations.find((s) => sameTile(s, tile));
    if (station && stationAccepts(station, held)) return tile;
  }
  const front = frontTile(person);
  return floorDropAt(state, front) ? front : null;
}

/**
 * The tile that work (holding the arrange, petals or bin work key) acts on: the
 * first faced tile that has a station or target, else the tile in front of the
 * nearest tile. Shares `faceTiles` with `pressTileFor`, so work and presses
 * agree when a body straddles two tiles.
 */
export function workTileFor(
  state: GameState,
  person: Pick<Player, "x" | "y" | "facingX" | "facingY">
): Tile {
  const faced = faceTiles(person);
  return (
    faced.find(
      (tile) =>
        state.stations.some((s) => sameTile(s, tile)) ||
        state.targets.some((t) => sameTile(t, tile))
    ) ?? frontTile(person)
  );
}

/** The tile a press of the interact key acts on for one person right now. */
export function interactTile(state: GameState, id: PlayerId): Tile | null {
  return pressTileFor(state, state.players[id]);
}
