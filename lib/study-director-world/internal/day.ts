import {
  applyDifficulty,
  beginStudy,
  createStudy,
  dashboard,
  endDay,
  getEvent,
  inbox,
  phaseForDay,
  projectedFinishDay,
  studyPreset,
  type AreaId,
  type Difficulty,
  type StudyLength,
  type StudyState,
} from "@/lib/study-director";
import { fatigueFrom, formatClock, weekdayFor } from "./clock";
import { undocumentedDecisions } from "./dialogue";
import { workTheNight } from "./delegation";
import { earlyWarningNote } from "./favours";
import { guestsExpected, settleGuests } from "./guests";
import { CRO_FLOOR } from "./floor";
import {
  eveningWrapUp,
  excuseGoingHome,
  planFor,
  settlePriority,
} from "./rhythm";
import { closeVisit } from "./sites";
import { adjustTrust, senderOf } from "./team";
import {
  DAY_START,
  ROUTINE_MINUTES_PER_POINT,
  type DigestLine,
  type MorningDigest,
  type OvernightLine,
  type OvernightReport,
  type SiteVisitReport,
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

/**
 * A new Study 24-081 run in the world, on day 1: the full study, or the
 * short one (#2092) that fits in a sitting.
 */
export function newWorld(
  seed: string,
  difficulty: Difficulty,
  length: StudyLength = "full"
): WorldState {
  const preset = studyPreset(length);
  return createWorld(
    beginStudy(
      applyDifficulty(
        createStudy(seed, preset.setup, preset.sites, preset.team),
        difficulty
      ),
      // The office's first day varies by seed (#2254).
      { openers: true }
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
  // Someone who trusts the player tells them where to look (#1838).
  const warning = earlyWarningNote(world);
  if (warning) lines.push(warning.line);
  // Visitors are announced in the morning: the sponsor used to arrive
  // unannounced and the miss was held against the player (#2188).
  for (const guest of guestsExpected({
    ...world,
    location: ARRIVAL,
    minute: startsAt,
  }))
    lines.push({
      text: `${guest.name} of ${guest.organisation} visits at ${formatClock(guest.at)}. Meet them in the conference room.`,
      tone: guest.id === "sponsorVisit" ? "bad" : "neutral",
    });
  return {
    world: {
      ...world,
      known: warning ? [...world.known, warning.known] : world.known,
      plan: {
        day: study.day,
        priority: null,
        handled: [],
        spentAtStart: study.spent,
      },
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
  after: StudyState,
  spend: { decisions: number; night: number }
): OvernightLine[] {
  const lines: OvernightLine[] = [];
  for (const site of after.sites) {
    const was = before.sites.find((s) => s.id === site.id);
    const gained = site.enrolled - (was?.enrolled ?? 0);
    if (gained > 0)
      lines.push({ text: `${site.name} enrolled +${gained}`, tone: "good" });
  }
  // A decision today that gave money back lowered the running total before
  // the night began, and the total fell with no line saying why (#2253).
  for (const record of before.log) {
    const credit = -(record.effects.spend ?? 0);
    if (record.day !== before.day || record.optionId === "ignored") continue;
    if (credit <= 0) continue;
    lines.push({
      text:
        record.optionId === "change-order"
          ? `A change order credited ${money(credit)} back to the budget`
          : `${record.label}: ${money(credit)} back in the budget`,
      tone: "good",
    });
  }
  // The night's costs run from where the day left off, so the team's work
  // overnight is in them too.
  const { decisions } = spend;
  const running = after.spent - spend.night;
  // The day's burn and the running total: "$2,390 spent" every night read
  // like a total that never moved (#2187). What the day's decisions cost
  // counts too, named apart, or the total rose by more than the card said
  // was spent (#2335).
  const sofar = `${money(after.spent)} of ${money(after.setup.budget)} so far`;
  const net = running + decisions;
  if (decisions >= 1)
    lines.push({
      text: `${money(net)} spent today, ${sofar} (${money(decisions)} of it on today's decisions)`,
      tone: "neutral",
    });
  else if (decisions <= -1)
    lines.push(
      net > 0
        ? {
            text: `${money(net)} spent today, ${sofar} (${money(running)} running costs, less ${money(-decisions)} back from today's decisions)`,
            tone: "neutral",
          }
        : {
            text: `${money(-net)} back in the budget today, ${sofar} (${money(-decisions)} from today's decisions, less ${money(running)} running costs)`,
            tone: "good",
          }
    );
  else if (running > 0)
    lines.push({
      text: `${money(running)} spent today, ${sofar}`,
      tone: "neutral",
    });
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
  // Mail for a study that just ended will never be read (#2190).
  if (arrived.length > 0 && after.status !== "complete")
    lines.push({
      text: `${plural(arrived.length, "new message")} arrived${critical > 0 ? `, ${critical} urgent` : ""}`,
      tone: critical > 0 ? "bad" : "neutral",
    });
  return lines;
}

/**
 * What the day's choices did to spend before the night's running costs:
 * against the morning's figure when the plan kept it, otherwise the money
 * on today's recorded decisions (#2335).
 */
function daytimeSpend(world: WorldState): number {
  const { study } = world;
  const plan = planFor(world);
  if (typeof plan.spentAtStart === "number")
    return study.spent - plan.spentAtStart;
  return study.log
    .filter((r) => r.day === study.day && r.optionId !== "ignored")
    .reduce((sum, r) => sum + (r.effects.spend ?? 0), 0);
}

/**
 * Going home by car, as the car card does it: from a site the visit is
 * written up first, and what came up while the player was there is excused
 * before the visit closes. Excusing after the write-up found no visit open,
 * so the night blamed the player for messages they never saw (#2334).
 */
export function driveHome(world: WorldState): {
  world: WorldState;
  report: OvernightReport;
  visit: SiteVisitReport | null;
} {
  const closed = closeVisit(excuseGoingHome(world));
  const night = goHome(closed.world);
  return { ...night, visit: closed.report };
}

/**
 * The player goes home. Overtime becomes fatigue, and the study simulates
 * the night: unanswered messages that ran out of time apply their fallout,
 * the sites and team work through their day, and new messages arrive.
 * Pass `delegated` when the team ran the day without the player.
 */
export function goHome(
  world: WorldState,
  options: { delegated?: boolean } = {}
): {
  world: WorldState;
  report: OvernightReport;
} {
  // Interruptions that came while the player was at a site or in a meeting
  // are not theirs to answer, even when they go home from there (#2254).
  const present = excuseGoingHome(world);
  const wrapUp = eveningWrapUp(present);
  const worked = workTheNight({ ...present, meeting: null });
  const settled = settlePriority(worked.world, options);
  const callers = settleGuests(settled.world);
  const night = {
    world: callers.world,
    lines: [...worked.lines, ...settled.lines, ...callers.lines],
  };
  const before = night.world.study;
  const after = endDay(before);
  const fromPhase = phaseForDay(before.day, before.setup.durationDays);
  const toPhase = phaseForDay(after.day, after.setup.durationDays);
  let next: WorldState = {
    ...night.world,
    study: after,
    fatigue: fatigueFrom(present.overtime),
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
      lines: [
        ...night.lines,
        ...overnightLines(before, after, {
          decisions: daytimeSpend(present),
          night: present.study.spent,
        }),
      ],
      newPhase: toPhase !== fromPhase ? toPhase : null,
      complete: after.status === "complete",
      wrapUp,
    },
  };
}
