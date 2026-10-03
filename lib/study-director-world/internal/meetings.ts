import { applyEffects, getEvent, inbox } from "@/lib/study-director";
import { spend } from "./clock";
import { channelFor, markRaised, messagesFrom } from "./channels";
import { dialogueLines } from "./dialogue";
import { adjustTrust, observe, personState, placePeople } from "./team";
import { CRO_FLOOR, roomAt } from "./floor";
import type {
  Meeting,
  MeetingReport,
  WorldMap,
  WorldResult,
  WorldState,
} from "../types";

/** Workload a meeting adds to each attendee: the hour has to come from somewhere. */
const MEETING_LOAD = 2;
/** Minutes a meeting or sponsor call takes. */
export const MEETING_MINUTES = 45;

/** Sponsor messages waiting for a call. */
export function sponsorAgenda(world: WorldState) {
  return inbox(world.study).filter(
    (e) => channelFor(world, e).kind === "phone" && /Sponsor/.test(e.from)
  );
}

/**
 * Opens a meeting in the conference room. The player must be in the room;
 * attendees must be on the floor today, and they take their seats at the
 * table until the meeting ends. Nothing is spent until it ends.
 */
export function startMeeting(
  world: WorldState,
  kind: Meeting["kind"],
  attendees: readonly string[],
  map: WorldMap = CRO_FLOOR
): WorldResult<{ meeting: Meeting }> {
  if (world.study.status !== "running")
    return { ok: false, reason: "study-complete" };
  if (world.meeting) return { ok: false, reason: "unknown-action" };
  if (roomAt(map, world.player.x, world.player.y)?.id !== "conference")
    return { ok: false, reason: "unreachable" };
  const present = new Set(placePeople(world, map).map((p) => p.memberId));
  const seated = attendees.filter(
    (id, i) => present.has(id) && attendees.indexOf(id) === i
  );
  if (kind === "team" && seated.length === 0)
    return { ok: false, reason: "unknown-action" };
  const meeting: Meeting = {
    kind,
    attendees: seated,
    startedAt: world.minute,
    logStart: world.study.log.length,
  };
  return { ok: true, meeting, world: { ...world, meeting } };
}

/**
 * Ends the meeting and reports what it cost against what it changed. It
 * takes forty-five minutes of the player's day and of every attendee's, and
 * adds a little to each attendee's workload. In a team meeting people say in
 * the room what they would say in private, if they trust you enough; their
 * messages come up to be answered; and anyone overloaded feels heard. A
 * sponsor call counts the decisions made on it and warms the sponsor if
 * anything was settled. A meeting that changed nothing says so.
 */
export function endMeeting(
  world: WorldState
): WorldResult<{ report: MeetingReport }> {
  const meeting = world.meeting;
  if (!meeting) return { ok: false, reason: "unknown-action" };
  const kind = meeting.kind === "sponsor" ? "sponsorCall" : "meeting";
  const spent = spend({ ...world, meeting: null }, kind);
  if (!spent.ok) return spent;
  let next = spent.world;
  const changes: string[] = [];
  const raised: string[] = [];
  const names = meeting.attendees.map(
    (id) => next.study.team.find((m) => m.id === id)?.name ?? id
  );

  if (meeting.kind === "team") {
    for (const id of meeting.attendees) {
      const person = personState(world, id);
      if (!person) continue;
      for (const line of dialogueLines(world, id)) {
        if (!line.fact || line.kind !== "warning") continue;
        if (next.known.includes(line.fact.id)) continue;
        next = observe(next, line.fact);
        changes.push(`${person.name}: ${line.fact.text}`);
      }
      for (const event of messagesFrom(world, id)) {
        next = markRaised(next, event.id);
        raised.push(event.id);
        changes.push(`${person.name} raised "${event.subject}"`);
      }
      if (person.mood === "overloaded") {
        const heard = adjustTrust(next, id, "heard");
        next = heard.world;
        if (heard.delta > 0) changes.push(`${person.name} felt heard`);
      }
    }
  }
  const settled = world.study.log
    .slice(meeting.logStart)
    .filter((r) => getEvent(r.eventId));
  for (const r of settled) changes.push(`Decided in the room: ${r.label}`);
  if (meeting.kind === "sponsor" && settled.length > 0) {
    next = {
      ...next,
      study: applyEffects(next.study, { meters: { client: 2 } }),
    };
    changes.push("The sponsor appreciated hearing it from you directly");
  }

  if (meeting.attendees.length > 0)
    next = {
      ...next,
      study: applyEffects(next.study, {
        workload: meeting.attendees.map((memberId) => ({
          memberId,
          delta: MEETING_LOAD,
        })),
      }),
    };

  const people = meeting.attendees.length + 1;
  const verdict =
    changes.length === 0
      ? "Could have been an email."
      : changes.length >= 3
        ? "Worth the hour."
        : "Some of it was useful.";
  return {
    ok: true,
    world: next,
    report: {
      kind: meeting.kind,
      minutes: MEETING_MINUTES,
      personMinutes: MEETING_MINUTES * people,
      attendees: names,
      changes,
      raised,
      verdict,
    },
  };
}
