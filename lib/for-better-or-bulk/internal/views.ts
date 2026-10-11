/**
 * Read-only views over a For Better or Bulk level: the wall clock, and what
 * the interact and work buttons would do for one person right now. Front ends
 * use them for button prompts and the screen-reader status line.
 */

import { clamp } from "@/lib/game-utils";
import { ITEM_LABELS } from "../presets";
import type { GameState, PlayerId } from "../types";
import { frontTile } from "./sim";

/** The level runs from 9:00 to 4:00 on the wall clock. */
const START_HOUR = 9;
const LEVEL_HOURS = 7;

/** The wall-clock time for a level time, as "h:mm". */
export function clockLabel(time: number, duration: number): string {
  const clamped = clamp(time, 0, duration);
  const minutes = Math.floor((clamped / duration) * LEVEL_HOURS * 60);
  const hour24 = START_HOUR + Math.floor(minutes / 60);
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:${String(minutes % 60).padStart(2, "0")}`;
}

/** What one person's buttons would do right now. */
export interface Prompt {
  readonly interact: string | null;
  readonly work: string | null;
  readonly status: string;
}

/** Button prompts and a status line for one person. */
export function getPrompt(state: GameState, id: PlayerId): Prompt {
  const player = state.players[id];
  const name = id === "fred" ? "Fred" : "Abbi";
  if (player.presence === "away") {
    return {
      interact: null,
      work: null,
      status: `${name} is out with his brothers.`,
    };
  }
  if (player.busyFor > 0) {
    return {
      interact: null,
      work: null,
      status: `${name}: ${player.busyReason ?? "busy"}`,
    };
  }
  const held = player.holding;
  const status = held
    ? `${name} is carrying ${ITEM_LABELS[held.kind]}.`
    : `${name} has free hands.`;
  const { x, y } = frontTile(player);
  const supply = state.supplies.find((s) => s.x === x && s.y === y);
  const station = state.stations.find((s) => s.x === x && s.y === y);
  const target = state.targets.find((t) => t.x === x && t.y === y);
  const floorItem = state.floor.find((f) => f.x === x && f.y === y);

  let interact: string | null = null;
  let work: string | null = null;
  if (!held) {
    if (supply && state.stock[supply.kind] > 0)
      interact = `Take ${ITEM_LABELS[supply.kind]}`;
    else if (station?.item) interact = `Take ${ITEM_LABELS[station.item.kind]}`;
    else if (floorItem)
      interact = `Pick up ${ITEM_LABELS[floorItem.item.kind]}`;
    if (
      station &&
      (station.kind === "arrange" || station.kind === "petals") &&
      station.item?.kind === "roses"
    ) {
      work = station.kind === "arrange" ? "Arrange the roses" : "Pluck petals";
    } else if (
      target?.status === "open" &&
      target.filled.length === 0 &&
      (target.category === "centerpieces" || target.category === "petals")
    ) {
      work = "Simplify: leave this one bare";
    }
  } else if (station) {
    if (station.kind === "bin") interact = "Throw it out";
    else if (
      !station.item &&
      station.kind === "grill" &&
      (held.kind === "hotdogs-raw" || held.kind === "wings-raw")
    ) {
      interact = "Put it on the grill";
    } else if (
      !station.item &&
      station.kind !== "grill" &&
      held.kind === "roses"
    ) {
      interact = "Put the roses down";
    }
  } else if (target?.status === "open" && target.wants === held.kind) {
    interact = `Place ${ITEM_LABELS[held.kind]}`;
  } else if (!target && !supply && !floorItem) {
    interact = "Put it down";
  }
  return { interact, work, status };
}
