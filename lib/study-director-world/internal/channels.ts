import {
  AREA_IDS,
  dashboard,
  documentDecision,
  getEvent,
  inbox,
  resolveEvent,
  type AreaId,
  type DecisionRecord,
  type StudyEvent,
} from "@/lib/study-director";
import { uniformAt } from "@/lib/utils/prng";
import { clamp } from "@/lib/game-utils";
import { spend } from "./clock";
import { undocumentedDecisions } from "./dialogue";
import { adjustTrust, senderOf } from "./team";
import {
  DAY_START,
  ROUTINE_MINUTES_PER_POINT,
  type CallRecord,
  type Channel,
  type DeskView,
  type DialogueLine,
  type EdcRow,
  type EventDialogue,
  type EventVia,
  type PersonPlacement,
  type PhoneCall,
  type WorldResult,
  type WorldState,
} from "../types";

/** Senders who call rather than write or walk over. */
const CALLERS = [
  /Sponsor/,
  /Your boss/,
  / PI$/,
  /coordinator/i,
  /Medical Monitor/,
  /Central Lab/,
];

/** Minutes after the morning starts before the phone can ring. */
const FIRST_RING = 30;
/** Latest minute a call rings: 4:30 PM. */
const LAST_RING = 16 * 60 + 30;
/** Fewest minutes between two calls. */
const CALL_GAP = 20;
/** Minutes until an ignored call rings again. */
export const RETRY_MINUTES = 45;
/** Tiles within which a team member stops you about their message. */
const CATCH_RANGE = 2;

/**
 * How an event reaches the player. A team member's message comes in person;
 * sponsors, the boss, investigators, coordinators and the lab phone; the
 * rest is mail on the desk.
 */
export function channelFor(
  world: WorldState,
  event: Pick<StudyEvent, "from">
): Channel {
  const member = senderOf(world.study, event);
  if (member) return { kind: "person", memberId: member.id };
  if (CALLERS.some((re) => re.test(event.from))) return { kind: "phone" };
  return { kind: "mail" };
}

function waiting(world: WorldState, kind: Channel["kind"]): StudyEvent[] {
  return inbox(world.study).filter((e) => channelFor(world, e).kind === kind);
}

/** The minute the working day starts once routine work is done. */
function morning(world: WorldState): number {
  return DAY_START + world.study.routine * ROUTINE_MINUTES_PER_POINT;
}

function recordFor(world: WorldState, eventId: string): CallRecord | undefined {
  return (world.calls ?? []).find(
    (c) => c.eventId === eventId && c.day === world.study.day
  );
}

/**
 * Today's calls, in the order the phone rings. Each waiting phone message
 * rings once at a time drawn from the world's own seeded stream, between
 * half an hour after the morning starts and half past four, at least twenty
 * minutes after the call before it. A message carried over from an earlier
 * day rings earlier: the caller is chasing. An ignored call rings again
 * forty-five minutes later; a call sent to voicemail or answered does not.
 */
export function phoneCalls(world: WorldState): PhoneCall[] {
  const { study } = world;
  const start = morning(world);
  const drawn = waiting(world, "phone").map((event) => {
    const carried = (study.seen[event.id] ?? study.day) < study.day;
    const u = uniformAt(`${study.seed}:world:call:${event.id}`, study.day);
    const window = carried ? 90 : 300;
    return {
      event,
      at: Math.round(start + (carried ? 15 : FIRST_RING) + u * window),
    };
  });
  drawn.sort((a, b) => a.at - b.at || a.event.id.localeCompare(b.event.id));
  const calls: PhoneCall[] = [];
  let last = -Infinity;
  for (const { event, at } of drawn) {
    const scheduled = clamp(at, last + CALL_GAP, LAST_RING);
    last = scheduled;
    const record = recordFor(world, event.id);
    const ringAt =
      record?.status === "ignored" ? (record.retryAt ?? scheduled) : scheduled;
    const status: PhoneCall["status"] =
      record?.status === "answered"
        ? "answered"
        : record?.status === "voicemail"
          ? "voicemail"
          : world.minute >= ringAt
            ? "ringing"
            : "scheduled";
    calls.push({
      eventId: event.id,
      from: event.from,
      subject: event.subject,
      ringAt,
      status,
    });
  }
  return calls;
}

/**
 * The call ringing right now, if any: the first whose time has come. The
 * phone only rings while the player is at work and the study is running.
 */
export function ringingCall(world: WorldState): PhoneCall | null {
  if (world.location === "home" || world.study.status !== "running")
    return null;
  if (world.meeting) return null;
  // The phone is on your desk; on a site visit (#1690) calls wait for you.
  if (world.visit) return null;
  return phoneCalls(world).find((c) => c.status === "ringing") ?? null;
}

function withCall(world: WorldState, record: CallRecord): WorldState {
  const others = (world.calls ?? []).filter(
    (c) => !(c.eventId === record.eventId && c.day === record.day)
  );
  return { ...world, calls: [...others, record] };
}

/** Lets the phone ring out. It rings again in forty-five minutes. */
export function ignoreCall(world: WorldState, eventId: string): WorldState {
  return withCall(world, {
    eventId,
    day: world.study.day,
    status: "ignored",
    retryAt: world.minute + RETRY_MINUTES,
  });
}

/** Sends the call to voicemail: it waits at your desk and stops ringing. */
export function sendToVoicemail(
  world: WorldState,
  eventId: string
): WorldState {
  return withCall(world, {
    eventId,
    day: world.study.day,
    status: "voicemail",
  });
}

/** The parts of an event every dialogue shares. */
function eventLines(event: StudyEvent, via: EventVia): DialogueLine[] {
  const opener: Record<EventVia, string> = {
    hallway: `${speakerName(event)} catches you in the hallway.`,
    talk: `${speakerName(event)} has something for you.`,
    phone: `${event.from} on the line.`,
    voicemail: `A voicemail from ${event.from}.`,
    callback: `You call ${event.from} back.`,
    mail: `A letter in your tray from ${event.from}.`,
    meeting: `${speakerName(event)} raises it in the room.`,
  };
  const lines: DialogueLine[] = [
    { kind: "information", text: opener[via] },
    {
      kind: event.urgency === "critical" ? "warning" : "information",
      text: event.body,
    },
  ];
  if (event.urgency === "critical")
    lines.push({ kind: "warning", text: "This one is urgent." });
  return lines;
}

function speakerName(event: Pick<StudyEvent, "from">): string {
  return event.from.replace(/ \(.*\)$/, "");
}

/**
 * An event as a conversation: who is speaking, what they say and the
 * event's options as the choices. Null if the event is not waiting.
 */
export function eventDialogue(
  world: WorldState,
  eventId: string,
  via: EventVia
): EventDialogue | null {
  const event = inbox(world.study).find((e) => e.id === eventId);
  if (!event) return null;
  return {
    eventId,
    via,
    speaker: speakerName(event),
    subject: event.subject,
    lines: eventLines(event, via),
    choices: event.options.map((o) => ({ id: o.id, label: o.label })),
  };
}

/**
 * Answers the ringing phone: ten minutes on the call, after which the
 * caller waits for a decision. Choosing an option ends the call through
 * `decide`; hanging up without one leaves the message to call back about.
 */
export function answerCall(
  world: WorldState,
  eventId: string
): WorldResult<{ dialogue: EventDialogue }> {
  const dialogue = eventDialogue(world, eventId, "phone");
  if (!dialogue) return { ok: false, reason: "unknown-action" };
  const spent = spend(world, "talk");
  if (!spent.ok) return spent;
  return {
    ok: true,
    dialogue,
    world: withCall(spent.world, {
      eventId,
      day: world.study.day,
      status: "answered",
    }),
  };
}

/**
 * Opens a message at the desk: reading mail or listening to voicemail takes
 * ten minutes, and returning a call takes the call's ten minutes.
 */
export function openAtDesk(
  world: WorldState,
  eventId: string,
  via: Extract<EventVia, "mail" | "voicemail" | "callback">
): WorldResult<{ dialogue: EventDialogue }> {
  const dialogue = eventDialogue(world, eventId, via);
  if (!dialogue) return { ok: false, reason: "unknown-action" };
  const spent = spend(world, via === "callback" ? "talk" : "readMail");
  if (!spent.ok) return spent;
  const next =
    via === "callback"
      ? withCall(spent.world, {
          eventId,
          day: world.study.day,
          status: "answered",
        })
      : spent.world;
  return { ok: true, world: next, dialogue };
}

/**
 * Chooses one of an event's options: the translation of a dialogue choice
 * into the domain. It calls `resolveEvent`, which records the decision
 * through `resolveDecision`, undocumented: writing it up is a separate
 * twenty minutes at the desk, and until then it counts as documentation
 * debt. Answering a team member's message is follow-through and builds
 * their trust. Answering someone who stopped you in the hallway takes the
 * conversation's ten minutes; the phone, the desk and a talk have already
 * spent theirs.
 */
export function decide(
  world: WorldState,
  eventId: string,
  optionId: string,
  via: EventVia = "phone"
): WorldResult<{ record: DecisionRecord; lines: DialogueLine[] }> {
  const event = getEvent(eventId);
  // Being stopped in the hallway costs the conversation's time when you
  // answer; every other way in has already paid for its time.
  const spent = via === "hallway" ? spend(world, "talk") : null;
  if (spent && !spent.ok) return spent;
  const start = spent?.world ?? world;
  const result = resolveEvent(start.study, eventId, optionId, false);
  if (!event || !result.ok)
    return {
      ok: false,
      reason:
        !result.ok && result.reason === "study-complete"
          ? "study-complete"
          : "unknown-action",
    };
  let next: WorldState = markRaised({ ...start, study: result.state }, eventId);
  const record = result.state.log[result.state.log.length - 1];
  const lines: DialogueLine[] = [
    { kind: "information", text: `Decided: ${record.label}.` },
    {
      kind: "warning",
      text: "Not on file yet. Write it up at your desk (20 minutes), or it becomes documentation debt.",
    },
  ];
  const channel = channelFor(world, event);
  if (channel.kind === "person") {
    const trusted = adjustTrust(next, channel.memberId, "followThrough");
    next = trusted.world;
    lines.push({
      kind: "relationship",
      text: `${speakerName(event)} nods. You got back to them.`,
      trustDelta: trusted.delta,
    });
  }
  return { ok: true, world: next, record, lines };
}

/**
 * Documents a decision at the desk: twenty minutes and some focus, and the
 * domain marks it on file and repays its documentation debt.
 */
export function documentAtDesk(
  world: WorldState,
  eventId: string
): WorldResult<{ lines: DialogueLine[] }> {
  const spent = spend(world, "document");
  if (!spent.ok) return spent;
  const result = documentDecision(spent.world.study, eventId);
  if (!result.ok)
    return {
      ok: false,
      reason:
        result.reason === "study-complete"
          ? "study-complete"
          : "unknown-action",
    };
  const subject = getEvent(eventId)?.subject ?? eventId;
  return {
    ok: true,
    world: { ...spent.world, study: result.state },
    lines: [{ kind: "information", text: `Written up and filed: ${subject}.` }],
  };
}

/** What waits at the desk: voicemail, mail, calls to return and write-ups. */
export function deskView(world: WorldState): DeskView {
  const entry = (e: StudyEvent) => ({
    eventId: e.id,
    from: e.from,
    subject: e.subject,
  });
  const calls = phoneCalls(world);
  const status = (id: string) => calls.find((c) => c.eventId === id)?.status;
  const phone = waiting(world, "phone");
  return {
    voicemail: phone.filter((e) => status(e.id) === "voicemail").map(entry),
    mail: waiting(world, "mail").map(entry),
    callbacks: phone.filter((e) => status(e.id) !== "voicemail").map(entry),
    undocumented: undocumentedDecisions(world.study).map((r) => ({
      eventId: r.eventId,
      label: getEvent(r.eventId)?.subject ?? r.label,
      day: r.day,
    })),
    documentationDebt: Math.round(world.study.documentationDebt),
  };
}

/**
 * A team member near the player who has a message they have not raised yet:
 * they stop you, in the corridor or anywhere else on the floor. Null when
 * nobody is waiting within two tiles.
 */
export function hallwayCatch(
  world: WorldState,
  people: readonly PersonPlacement[]
): { memberId: string; eventId: string } | null {
  if (world.location === "home" || world.meeting) return null;
  const raised = new Set(world.raised ?? []);
  for (const event of waiting(world, "person")) {
    if (raised.has(event.id)) continue;
    const sender = senderOf(world.study, event);
    const p = sender && people.find((x) => x.memberId === sender.id);
    if (!p || p.activity === "walking") continue;
    const distance =
      Math.abs(p.x - world.player.x) + Math.abs(p.y - world.player.y);
    if (distance <= CATCH_RANGE)
      return { memberId: p.memberId, eventId: event.id };
  }
  return null;
}

/** Notes that a member has raised their message, so they do not stop you again. */
export function markRaised(world: WorldState, eventId: string): WorldState {
  const raised = world.raised ?? [];
  return raised.includes(eventId)
    ? world
    : { ...world, raised: [...raised, eventId] };
}

/**
 * Walking away from someone who stopped you. Their message still waits, and
 * they are a little put out.
 */
export function brushOff(world: WorldState, eventId: string): WorldState {
  const event = getEvent(eventId);
  const sender = event ? senderOf(world.study, event) : null;
  const marked = markRaised(world, eventId);
  return sender ? adjustTrust(marked, sender.id, "brushOff").world : marked;
}

/** Messages from a member waiting on the player. */
export function messagesFrom(
  world: WorldState,
  memberId: string
): StudyEvent[] {
  return waiting(world, "person").filter(
    (e) => senderOf(world.study, e)?.id === memberId
  );
}

const AREA_LABEL: Record<AreaId, string> = {
  enrollment: "Enrollment",
  safety: "Safety",
  data: "Data",
  regulatory: "Regulatory",
  budget: "Budget",
  timeline: "Timeline",
};

/**
 * The EDC workstation: each dashboard area as the sites report it, beside
 * what the player has actually seen or been told about it, newest first.
 * The gap between the two columns is the game.
 */
export function edcScreen(world: WorldState): EdcRow[] {
  const board = dashboard(world.study);
  const seen = world.observations ?? [];
  return AREA_IDS.map((area) => ({
    area,
    label: AREA_LABEL[area],
    health: board[area].health,
    reported: board[area].summary,
    seen: seen
      .filter((o) => o.area === area)
      .slice()
      .reverse()
      .slice(0, 3),
  }));
}
