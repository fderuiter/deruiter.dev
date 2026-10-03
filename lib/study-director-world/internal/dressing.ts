import { clamp } from "@/lib/game-utils";
import {
  METER_IDS,
  computeMeters,
  inbox,
  totalOpenQueries,
  type Meters,
  type StudyState,
} from "@/lib/study-director";
import { CRO_FLOOR } from "./floor";
import {
  DAY_END,
  HARD_STOP,
  type BinState,
  type FloorDressing,
  type FloorMood,
  type InteractionOutcome,
  type RoomCondition,
  type RoomId,
  type SetDressingMark,
  type TeamHoursHint,
  type WorldMap,
  type WorldState,
} from "../types";

// The office decay rules. The classic desk's illustration
// (`components/study-director/scene.ts`) and the world's floor both read
// these, so the two views of one study agree.

/** The bin smoulders when any meter is under this. */
export const BIN_SMOKE_BELOW = 35;
/** And catches fire when any meter is under this. */
export const BIN_FIRE_BELOW = 20;

/** The lowest of the six meters. */
export function lowestMeter(meters: Meters): number {
  return Math.min(...METER_IDS.map((id) => meters[id]));
}

/** The waste bin: smoke under 35 on any meter, fire under 20. */
export function binFor(meters: Meters): BinState {
  const low = lowestMeter(meters);
  return low < BIN_FIRE_BELOW
    ? "fire"
    : low < BIN_SMOKE_BELOW
      ? "smoke"
      : "calm";
}

/** Stacks of query paper: one per 12 open queries, 0 to 4. */
export function paperStacksFor(openQueries: number): number {
  return clamp(Math.floor(openQueries / 12), 0, 4);
}

/** Sticky notes for undocumented decisions: one per 12 points of debt, 0 to 6. */
export function stickyNotesFor(documentationDebt: number): number {
  return clamp(Math.floor(documentationDebt / 12), 0, 6);
}

/** The desk plant follows the team meter. */
export function plantFor(teamMeter: number): "thriving" | "droopy" | "wilted" {
  return teamMeter >= 60 ? "thriving" : teamMeter >= 35 ? "droopy" : "wilted";
}

/** Red pen on the calendar: one mark per 7 days of slip, 0 to 3. */
export function redMarksFor(slipDays: number): number {
  return clamp(Math.ceil(slipDays / 7), 0, 3);
}

/** Calm at 50 and above on every meter, a crisis once the bin burns. */
export function moodFor(meters: Meters): FloorMood {
  const low = lowestMeter(meters);
  return low < BIN_FIRE_BELOW ? "crisis" : low < 50 ? "stressed" : "calm";
}

/** Workload above which a member stays past the end of the office day. */
const LATE_ABOVE = 75;
/** Workload above which a member eats lunch at their desk. */
const DESK_LUNCH_ABOVE = 65;
/** Minutes of overtime per point of workload over the late threshold. */
const LATE_MINUTES_PER_POINT = 6;

/**
 * When each team member goes home and where they eat lunch, from their
 * workload alone. Pure: NPC schedules can read it without moving anyone.
 */
export function teamHours(study: StudyState): TeamHoursHint[] {
  return study.team.map((m) => ({ memberId: m.id, ...workHours(m.workload) }));
}

/**
 * The single rule for when someone goes home and where they eat lunch. NPC
 * schedules (#1688) and the floor's set dressing (#1691) both read it, so
 * the lamps left on agree with who is still at their desk.
 */
export function workHours(workload: number): Omit<TeamHoursHint, "memberId"> {
  const over = Math.max(0, workload - LATE_ABOVE);
  const staysLate = over > 0;
  return {
    leavesAt: staysLate
      ? Math.min(HARD_STOP, DAY_END + Math.round(over * LATE_MINUTES_PER_POINT))
      : DAY_END,
    staysLate,
    lunchAtDesk: workload > DESK_LUNCH_ABOVE,
  };
}

/** Days after which a site that has never been visited owes one. */
const FIRST_VISIT_BY_DAY = 15;
/** Days after an audit before the site owes another visit. */
const REVISIT_AFTER_DAYS = 30;

function visitsOwed(study: StudyState): number {
  let pins = 0;
  for (const site of study.sites) {
    const overdue =
      site.lastAuditedDay === null
        ? study.day >= FIRST_VISIT_BY_DAY
        : study.day - site.lastAuditedDay > REVISIT_AFTER_DAYS;
    if (overdue) pins += 1;
    if (site.openQueries >= 15) pins += 1;
  }
  return clamp(pins, 0, 6);
}

function repeat(mark: SetDressingMark, n: number): SetDressingMark[] {
  return Array.from({ length: Math.max(0, Math.floor(n)) }, () => mark);
}

/** Desk clutter from a workload: tidy up to 40%, buried at 95%. */
function clutterFor(workload: number): number {
  return clamp((workload - 40) / 55, 0, 1);
}

/** What the floor needs from the world: the study and the player's day. */
export type DressingInput = Pick<WorldState, "study" | "coffees" | "fatigue">;

/**
 * The office telling the story of the study (#1691): a pure mapping from
 * state to set dressing for every room. The data manager's desk gains query
 * printouts, the monitor's travel board fills with visits owed, the
 * regulatory filing cabinet overflows with documentation debt, sponsor mail
 * piles up at reception, the conference room fills with crisis meetings,
 * coffee cups gather in your office, lamps stay on where people work late,
 * the break room empties, and the bin smokes, then burns.
 */
export function dressFloor(
  input: DressingInput,
  map: WorldMap = CRO_FLOOR
): FloorDressing {
  const { study } = input;
  const meters = computeMeters(study);
  const waiting = inbox(study);
  const bin = binFor(meters);
  const hours = teamHours(study);
  const printouts = paperStacksFor(totalOpenQueries(study));
  const travelPins = visitsOwed(study);
  const fileOverflow = clamp(Math.floor(study.documentationDebt / 20), 0, 4);
  const sponsorWaiting = waiting.filter((e) => /\(Sponsor\)/.test(e.from));
  const sponsorMail = clamp(
    sponsorWaiting.length + Math.floor(Math.max(0, 70 - meters.client) / 15),
    0,
    5
  );
  const redMeters = METER_IDS.filter((id) => meters[id] < BIN_SMOKE_BELOW);
  const critical = waiting.filter((e) => e.urgency === "critical");
  const crisisMeetings = clamp(redMeters.length + critical.length, 0, 3);
  const cups = clamp(
    1 + Math.floor(input.coffees) + Math.floor(input.fatigue / 10),
    1,
    6
  );
  const lunch = clamp(hours.filter((h) => !h.lunchAtDesk).length, 0, 3);

  const late = new Map(hours.map((h) => [h.memberId, h.staysLate]));
  const rooms = {} as Record<RoomId, RoomCondition>;
  for (const room of map.rooms) {
    const members = study.team.filter((m) => m.role === room.department);
    const workload = Math.max(0, ...members.map((m) => m.workload));
    const marks: SetDressingMark[] = repeat(
      "lateLamp",
      members.filter((m) => late.get(m.id)).length
    );
    let clutter = room.department ? clutterFor(workload) : 0;
    switch (room.id) {
      case "office":
        clutter = printouts / 4;
        marks.push(...repeat("cup", cups));
        if (bin !== "calm") marks.push("smoke");
        if (bin === "fire") marks.push("fire");
        break;
      case "dataManagement":
        clutter = Math.max(clutter, printouts / 4);
        marks.push(...repeat("printout", printouts));
        break;
      case "monitoring":
        marks.push(...repeat("travelPin", travelPins));
        break;
      case "regulatory":
        clutter = Math.max(clutter, fileOverflow / 4);
        marks.push(...repeat("fileOverflow", fileOverflow));
        break;
      case "lobby":
        marks.push(...repeat("sponsorMail", sponsorMail));
        break;
      case "conference":
        marks.push(...repeat("crisisMeeting", crisisMeetings));
        break;
      case "breakRoom":
        marks.push(...repeat("lunch", lunch));
        if (lunch === 0) marks.push("deserted");
        break;
      default:
        break;
    }
    rooms[room.id] = { clutter: Math.round(clutter * 100) / 100, marks };
  }

  return {
    mood: moodFor(meters),
    bin,
    printouts,
    travelPins,
    fileOverflow,
    sponsorMail,
    crisisMeetings,
    cups,
    lunch,
    hours,
    rooms,
  };
}

/** How many of one mark a room carries. */
export function countMarks(
  condition: RoomCondition | undefined,
  mark: SetDressingMark
): number {
  return condition ? condition.marks.filter((m) => m === mark).length : 0;
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

function count(n: number, one: string, many = `${one}s`): string {
  return `${NUMBER_WORDS[n] ?? n} ${n === 1 ? one : many}`;
}

/**
 * Sentences describing a room's set dressing, for the room description.
 * Tidy rooms and unknown marks add nothing.
 */
export function describeDressing(
  condition: RoomCondition | undefined
): string[] {
  if (!condition) return [];
  const n = (mark: SetDressingMark) => countMarks(condition, mark);
  const lines: string[] = [];
  if (n("printout") > 0)
    lines.push(
      `${count(n("printout"), "stack")} of query printouts on the data manager's desk.`
    );
  if (n("travelPin") > 0)
    lines.push(
      `The travel board has ${count(n("travelPin"), "pin")} for site visits owed.`
    );
  if (n("fileOverflow") > 0)
    lines.push(
      `The filing cabinet is overflowing: ${count(n("fileOverflow"), "folder")} on the floor.`
    );
  if (n("sponsorMail") > 0)
    lines.push(
      `${count(n("sponsorMail"), "letter")} from the sponsor piled at reception.`
    );
  if (n("crisisMeeting") > 0)
    lines.push(
      `The room is booked for ${count(n("crisisMeeting"), "crisis meeting")} today.`
    );
  if (n("cup") > 1)
    lines.push(`${count(n("cup"), "coffee cup")} on and around the desk.`);
  if (n("lateLamp") > 0)
    lines.push(
      n("lateLamp") === 1
        ? "A desk lamp stays on: someone is working late."
        : `${count(n("lateLamp"), "desk lamp")} stay on: people are working late.`
    );
  if (n("deserted") > 0) lines.push("Nobody takes a break here any more.");
  else if (n("lunch") > 0)
    lines.push(`${count(n("lunch"), "lunch", "lunches")} on the table.`);
  if (n("fire") > 0) lines.push("The waste bin is on fire.");
  else if (n("smoke") > 0) lines.push("The waste bin is smouldering.");
  return lines.map((l) => l.charAt(0).toUpperCase() + l.slice(1));
}

/** What the Study Director's mug says. It always says this. */
export const PLAYER_MUG = "FINE";

/**
 * Examining yourself: you are holding the FINE mug, and everything is fine.
 * The only honest tell is what is behind you. Free; changes nothing.
 */
export function examineSelf(world: WorldState): InteractionOutcome {
  const meters = computeMeters(world.study);
  const mood = moodFor(meters);
  const bin = binFor(meters);
  const tell =
    bin === "fire"
      ? "Behind you, the waste bin is on fire."
      : bin === "smoke"
        ? "Something smells faintly of smoke."
        : mood === "stressed"
          ? "Your left eye twitches, just slightly."
          : "The coffee is still warm.";
  return {
    world,
    title: "You",
    lines: [
      `You are holding your mug. It says ${PLAYER_MUG}.`,
      tell,
      "Everything is fine.",
    ],
    tone: "neutral",
  };
}
