import { dashboard, inbox } from "@/lib/study-director";
import { drinkCoffee, formatClock, weekdayFor } from "./clock";
import { describeDressing } from "./dressing";
import { CRO_FLOOR, getRoom, roomAt, stationAt, stepFrom } from "./floor";
import { TIDY_ROOM } from "./people";
import { SITE_INTERACTIONS, carOutcome } from "./sites";
import type {
  DirectoryEntry,
  HudReadout,
  InteractionHandler,
  InteractionHandlers,
  InteractionOutcome,
  PersonPlacement,
  RoomCondition,
  RoomId,
  StationId,
  WorldMap,
  WorldState,
  WorldTarget,
} from "../types";

const ROLE_NAMES: Record<PersonPlacement["role"], string> = {
  biostatistician: "Biostatistician",
  dataManager: "Data manager",
  regulatory: "Regulatory lead",
  monitor: "Monitor",
  medicalWriter: "Medical writer",
  programmer: "Programmer",
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** What the player is facing: a person first, then a station, or null. */
export function targetInFront(
  world: WorldState,
  map: WorldMap = CRO_FLOOR,
  people: readonly PersonPlacement[] = []
): WorldTarget | null {
  const front = stepFrom(world.player, world.player.facing);
  const person = people.find((p) => p.x === front.x && p.y === front.y);
  if (person) return { kind: "person", person };
  const station = stationAt(map, front.x, front.y);
  return station ? { kind: "station", station } : null;
}

const coffee: InteractionHandler = (world) => {
  const result = drinkCoffee(world);
  if (!result.ok)
    return {
      world,
      title: "Coffee machine",
      lines: [
        result.reason === "too-late"
          ? "Too late for coffee. Go home."
          : "The study is over.",
      ],
      tone: "bad",
    };
  const next = result.world;
  const helped = world.coffees < 4;
  return {
    world: next,
    title: "Coffee machine",
    lines: [
      `Cup ${next.coffees} today. Energy ${Math.round(next.energy)}, focus ${Math.round(next.focus)}.`,
      helped
        ? "It helps."
        : "Your hands are shaking. Focus is going the wrong way.",
    ],
    tone: helped ? "good" : "bad",
  };
};

/** The car: go home, or drive to a site (#1690). */
const exit: InteractionHandler = (world) => carOutcome(world);

const edc: InteractionHandler = (world) => {
  const data = dashboard(world.study).data;
  return {
    world,
    title: "EDC workstation",
    lines: [
      `Data: ${data.summary}.`,
      "This is what the sites report, which is not necessarily the truth.",
    ],
    tone: data.health === "green" ? "neutral" : "bad",
  };
};

const phone: InteractionHandler = (world) => {
  const waiting = inbox(world.study);
  const urgent = waiting.filter((e) => e.urgency === "critical");
  const lines = [
    waiting.length === 0
      ? "No messages waiting."
      : `${plural(waiting.length, "message")} waiting${urgent.length > 0 ? `, ${urgent.length} urgent` : ""}.`,
    ...waiting.slice(0, 3).map((e) => `From ${e.from}: ${e.subject}`),
  ];
  return {
    world,
    title: "Phone",
    lines,
    tone: urgent.length > 0 ? "bad" : "neutral",
  };
};

const etmf: InteractionHandler = (world) => {
  const { log } = world.study;
  const decided = log.filter((r) => r.optionId !== "ignored");
  const filed = decided.filter((r) => r.documented).length;
  return {
    world,
    title: "eTMF",
    lines: [
      decided.length === 0
        ? "Nothing decided yet, so nothing to file."
        : `${filed} of ${plural(decided.length, "decision")} on file.`,
    ],
    tone: filed < decided.length ? "bad" : "neutral",
  };
};

const person: InteractionHandler = (world, target) => {
  if (target.kind !== "person") return null;
  const p = target.person;
  const member = world.study.team.find((m) => m.id === p.memberId);
  const load = member?.workload ?? 0;
  const mood =
    load > 85
      ? "is buried and does not look up."
      : load > 60
        ? "is busy but nods."
        : "has a minute.";
  return {
    world,
    title: p.name,
    lines: [`${p.name}, ${ROLE_NAMES[p.role].toLowerCase()}, ${mood}`],
    tone: load > 85 ? "bad" : "neutral",
  };
};

/** What pressing E does at each station and at a person, by default. */
export const DEFAULT_INTERACTIONS: {
  station: Record<StationId, InteractionHandler>;
  person: InteractionHandler;
} = {
  station: { coffee, exit, edc, phone, etmf, ...SITE_INTERACTIONS },
  person,
};

/**
 * Presses E: uses whatever the player is facing. Handlers passed in are
 * tried first (dialogue, events and site visits plug in here), and the
 * defaults handle anything they leave alone. Returns null when nothing is
 * in front of the player. Coffee spends time; looking at a screen is free.
 */
export function interact(
  world: WorldState,
  map: WorldMap = CRO_FLOOR,
  people: readonly PersonPlacement[] = [],
  handlers: InteractionHandlers = {}
): InteractionOutcome | null {
  const target = targetInFront(world, map, people);
  if (!target) return null;
  const chain =
    target.kind === "person"
      ? [handlers.person, DEFAULT_INTERACTIONS.person]
      : [
          handlers.station?.[target.station.id],
          DEFAULT_INTERACTIONS.station[target.station.id],
        ];
  for (const handler of chain) {
    const outcome = handler?.(world, target);
    if (outcome) return outcome;
  }
  return null;
}

/**
 * The office directory: every room, person and station on the map, as
 * places to walk to. Rooms first in map order, then people in team order,
 * then stations.
 */
export function officeDirectory(
  map: WorldMap = CRO_FLOOR,
  people: readonly PersonPlacement[] = []
): DirectoryEntry[] {
  const roomName = (id: string) => getRoom(map, id)?.name ?? id;
  return [
    ...map.rooms.map((room): DirectoryEntry => ({
      id: `room:${room.id}`,
      label: room.name,
      detail: "Room",
      target: { kind: "room", room },
    })),
    ...people.map((p): DirectoryEntry => ({
      id: `person:${p.memberId}`,
      label: p.name,
      detail: `${ROLE_NAMES[p.role]}, ${roomName(p.room)}`,
      target: { kind: "person", person: p },
    })),
    ...map.stations.map((station): DirectoryEntry => ({
      id: `station:${station.id}`,
      label: station.name,
      detail: roomName(station.room),
      target: { kind: "station", station },
    })),
  ];
}

function list(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * A text description of the player's surroundings, for the canvas's
 * accessible name and the room panel: the room, who is in it, the stations
 * in it, and what the player is facing. Room conditions add a line when a
 * room is anything but tidy.
 */
export function describeSurroundings(
  world: WorldState,
  map: WorldMap = CRO_FLOOR,
  people: readonly PersonPlacement[] = [],
  conditions: Partial<Record<RoomId, RoomCondition>> = {}
): string {
  const room =
    roomAt(map, world.player.x, world.player.y) ?? getRoom(map, world.location);
  if (!room) return "You are in a doorway.";
  const here = people.filter((p) => p.room === room.id).map((p) => p.name);
  const stations = map.stations
    .filter((s) => s.room === room.id)
    .map((s) => s.name);
  const parts = [room.blurb];
  if (here.length > 0)
    parts.push(`${list(here)} ${here.length === 1 ? "is" : "are"} here.`);
  if (stations.length > 0) parts.push(`Stations: ${list(stations)}.`);
  const condition = conditions[room.id] ?? TIDY_ROOM;
  if (condition.clutter >= 0.66) parts.push("Paper is piled on every desk.");
  else if (condition.clutter >= 0.33)
    parts.push("Paper is piling up on the desks.");
  parts.push(...describeDressing(condition));
  const target = targetInFront(world, map, people);
  if (target)
    parts.push(
      `You are facing ${target.kind === "person" ? target.person.name : `the ${target.station.name}`}. Press E to interact.`
    );
  return parts.join(" ");
}

/**
 * What the HUD shows: the day, the clock, the player's energy and focus, and
 * the three things the world shows directly (budget, timeline, enrollment).
 * Integrity, Compliance and Team are left out on purpose (ADR 0055).
 */
export function hudReadout(world: WorldState): HudReadout {
  const { study } = world;
  const total = study.setup.durationDays + study.slipDays;
  return {
    day: study.day,
    weekday: weekdayFor(study.day),
    clock: formatClock(world.minute),
    energy: Math.round(world.energy),
    focus: Math.round(world.focus),
    budget: { spent: study.spent, total: study.setup.budget },
    timeline: {
      day: Math.min(study.day, total),
      total,
      slipDays: study.slipDays,
    },
    enrollment: {
      enrolled: study.sites.reduce((sum, s) => sum + s.enrolled, 0),
      target: study.setup.subjects,
    },
  };
}
