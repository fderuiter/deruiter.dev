import {
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  applyDifficulty,
  beginStudy,
  createStudy,
  dashboard,
  endDay,
  getEvent,
  inbox,
  phaseForDay,
  projectedFinishDay,
  type AreaId,
  type Difficulty,
  type StudyState,
} from "@/lib/study-director";
import { fatigueFrom, weekdayFor } from "./clock";
import { undocumentedDecisions } from "./dialogue";
import { workTheNight } from "./delegation";
import { CRO_FLOOR } from "./floor";
import { adjustTrust, senderOf } from "./team";
import {
  DAY_START,
  ROUTINE_MINUTES_PER_POINT,
  type DigestLine,
  type MorningDigest,
  type OvernightLine,
  type OvernightReport,
  type WorldState,
} from "../types";

/** Where the player stands when the day starts. */
const ARRIVAL = "lobby";

/**
 * Wraps a study that has already begun in a world. The study switches to
 * clock budgeting: the world, not the domain, limits what fits in a day.
 */
export function createWorld(study: StudyState): WorldState {
  return {
    version: 1,
    study: { ...study, budget: "clock" },
    minute: DAY_START,
    energy: 100,
    focus: 100,
    coffees: 0,
    overtime: 0,
    fatigue: 0,
    location: ARRIVAL,
    player: { ...CRO_FLOOR.spawn },
    walked: 0,
    known: [],
    map: CRO_FLOOR.id,
    visit: null,
  };
}

/** A new Study 24-081 run in the world, on day 1. */
export function newWorld(seed: string, difficulty: Difficulty): WorldState {
  return createWorld(
    beginStudy(
      applyDifficulty(
        createStudy(seed, STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM),
        difficulty
      )
    )
  );
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Messages that reached the player today, most urgent first. */
function arrivedToday(study: StudyState) {
  return inbox(study).filter((e) => study.seen[e.id] === study.day);
}

/**
 * Starts the working day: the player arrives at the lobby, routine load takes
 * the first part of the morning, and energy is what a night's rest restored.
 * Returns a short digest; everything else the player has to go and find out.
 */
export function startDay(world: WorldState): {
  world: WorldState;
  digest: MorningDigest;
} {
  const { study } = world;
  const routineMinutes = study.routine * ROUTINE_MINUTES_PER_POINT;
  const startsAt = DAY_START + routineMinutes;
  const energy = 100 - world.fatigue;
  const arrived = arrivedToday(study);
  const critical = arrived.filter((e) => e.urgency === "critical").length;
  const lines: DigestLine[] = [];
  if (arrived.length > 0)
    lines.push({
      text: `${plural(arrived.length, "new message")}${critical > 0 ? `, ${critical} marked urgent` : ""}`,
      tone: critical > 0 ? "bad" : "neutral",
    });
  else lines.push({ text: "No new messages", tone: "good" });
  const waiting = inbox(study).length - arrived.length;
  if (waiting > 0)
    lines.push({
      text: `${plural(waiting, "message")} still waiting from earlier`,
      tone: "neutral",
    });
  if (routineMinutes > 0)
    lines.push({
      text: `Routine work takes your first ${routineMinutes} minutes`,
      tone: "bad",
    });
  if (world.fatigue > 0)
    lines.push({
      text: `Still tired from last night: energy ${energy}`,
      tone: "bad",
    });
  lines.push(...teamDigest(study));
  return {
    world: {
      ...world,
      minute: startsAt,
      energy,
      focus: 100,
      coffees: 0,
      overtime: 0,
      location: ARRIVAL,
      player: { ...CRO_FLOOR.spawn },
      walked: 0,
      map: CRO_FLOOR.id,
      visit: null,
    },
    digest: {
      day: study.day,
      weekday: weekdayFor(study.day),
      phase: phaseForDay(study.day, study.setup.durationDays),
      startsAt,
      routineMinutes,
      energy,
      lines,
    },
  };
}

/**
 * What the morning says about the team (#1688, #1689): who wants a word and
 * what is still not written up. Who is struggling the player has to see.
 */
function teamDigest(study: StudyState): DigestLine[] {
  const lines: DigestLine[] = [];
  const asking = new Set<string>();
  for (const event of inbox(study)) {
    const member = senderOf(study, event);
    if (member) asking.add(member.name);
  }
  if (asking.size > 0)
    lines.push({
      text: `${[...asking].join(" and ")} ${asking.size === 1 ? "wants" : "want"} a word`,
      tone: "neutral",
    });
  const unwritten = undocumentedDecisions(study).length;
  if (unwritten > 0)
    lines.push({
      text: `${plural(unwritten, "decision")} still to write up at your desk`,
      tone: "bad",
    });
  return lines;
}

const AREA_LABEL: Record<AreaId, string> = {
  enrollment: "Enrollment",
  safety: "Safety",
  data: "Data",
  regulatory: "Regulatory",
  budget: "Budget",
  timeline: "Timeline",
};

const HEALTH_RANK = { green: 0, amber: 1, red: 2 } as const;

function money(dollars: number): string {
  return `$${Math.round(dollars).toLocaleString("en-US")}`;
}

/**
 * What the player learns about the night, built only from what they could
 * know: enrollment, spend and schedule are honest; the other areas are what
 * the dashboard reports, which is not necessarily the truth (ADR 0054).
 */
function overnightLines(
  before: StudyState,
  after: StudyState
): OvernightLine[] {
  const lines: OvernightLine[] = [];
  for (const site of after.sites) {
    const was = before.sites.find((s) => s.id === site.id);
    const gained = site.enrolled - (was?.enrolled ?? 0);
    if (gained > 0)
      lines.push({ text: `${site.name} enrolled +${gained}`, tone: "good" });
  }
  const spent = after.spent - before.spent;
  if (spent > 0) lines.push({ text: `${money(spent)} spent`, tone: "neutral" });
  const slip = projectedFinishDay(after) - projectedFinishDay(before);
  if (slip > 0)
    lines.push({
      text: `Projected finish slipped ${plural(slip, "day")}`,
      tone: "bad",
    });
  else if (slip < 0)
    lines.push({
      text: `Projected finish pulled in ${plural(-slip, "day")}`,
      tone: "good",
    });
  const was = dashboard(before);
  const now = dashboard(after);
  for (const area of Object.keys(now) as AreaId[]) {
    const from = HEALTH_RANK[was[area].health];
    const to = HEALTH_RANK[now[area].health];
    if (to === from) continue;
    lines.push({
      text: `${AREA_LABEL[area]}: ${now[area].summary}`,
      tone: to > from ? "bad" : "good",
    });
  }
  for (const record of after.log.slice(before.log.length)) {
    if (record.optionId !== "ignored") continue;
    const event = getEvent(record.eventId);
    lines.push({
      text: `Went unanswered: ${event?.subject ?? record.label}`,
      tone: "bad",
    });
  }
  const arrived = arrivedToday(after);
  const critical = arrived.filter((e) => e.urgency === "critical").length;
  if (arrived.length > 0)
    lines.push({
      text: `${plural(arrived.length, "new message")} arrived${critical > 0 ? `, ${critical} urgent` : ""}`,
      tone: critical > 0 ? "bad" : "neutral",
    });
  return lines;
}

/**
 * The player goes home. Overtime becomes fatigue, and the study simulates
 * the night: unanswered messages that ran out of time apply their fallout,
 * the sites and team work through their day, and new messages arrive.
 */
export function goHome(world: WorldState): {
  world: WorldState;
  report: OvernightReport;
} {
  const night = workTheNight({ ...world, meeting: null });
  const before = night.world.study;
  const after = endDay(before);
  const fromPhase = phaseForDay(before.day, before.setup.durationDays);
  const toPhase = phaseForDay(after.day, after.setup.durationDays);
  let next: WorldState = {
    ...night.world,
    study: after,
    fatigue: fatigueFrom(world.overtime),
    location: "home",
  };
  // A team member whose message ran out of time unanswered was ignored.
  for (const record of after.log.slice(before.log.length)) {
    if (record.optionId !== "ignored") continue;
    const event = getEvent(record.eventId);
    const member = event ? senderOf(after, event) : null;
    if (member) next = adjustTrust(next, member.id, "ignore").world;
  }
  return {
    world: next,
    report: {
      day: before.day,
      lines: [...night.lines, ...overnightLines(before, after)],
      newPhase: toPhase !== fromPhase ? toPhase : null,
      complete: after.status === "complete",
    },
  };
}
