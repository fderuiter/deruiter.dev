import { STUDY_EVENTS } from "./events-data";
import { advanceDay, applyEffects, resolveDecision } from "./model";
import type { ActionResult, StudyEvent, StudyState, Urgency } from "../types";

const URGENCY_ORDER: Record<Urgency, number> = {
  critical: 0,
  important: 1,
  routine: 2,
};

const byId = new Map(STUDY_EVENTS.map((e) => [e.id, e]));

/** Looks up an event by id. */
export function getEvent(id: string): StudyEvent | undefined {
  return byId.get(id);
}

function isDue(state: StudyState, event: StudyEvent): boolean {
  if (state.handled.includes(event.id)) return false;
  const scheduled = state.scheduled.find((s) => s.eventId === event.id);
  if (scheduled) return state.day >= scheduled.day;
  if (event.followUp) return false;
  if (state.day < event.day) return false;
  return event.trigger ? event.trigger(state) : true;
}

/** Events in the inbox today, most urgent first. */
export function inbox(state: StudyState): StudyEvent[] {
  return STUDY_EVENTS.filter((e) => isDue(state, e)).sort(
    (a, b) => URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
  );
}

function markSeen(state: StudyState): StudyState {
  const seen = { ...state.seen };
  for (const e of inbox(state)) seen[e.id] ??= state.day;
  return { ...state, seen };
}

/**
 * Answers an inbox event with one of its options. `documented` spends extra
 * attention to record the decision, and is what saves you at inspection.
 */
export function resolveEvent(
  state: StudyState,
  eventId: string,
  optionId: string,
  documented: boolean
): ActionResult {
  const event = byId.get(eventId);
  const option = event?.options.find((o) => o.id === optionId);
  if (!event || !option || !isDue(state, event))
    return { ok: false, reason: "unknown-target" };
  const result = resolveDecision(state, {
    eventId,
    optionId,
    label: option.label,
    effects: option.effects,
    attentionCost: option.attentionCost,
    debtIfUndocumented: option.debtIfUndocumented,
    documented,
  });
  if (!result.ok) return result;
  const next = result.state;
  return {
    ok: true,
    state: {
      ...next,
      handled: [...next.handled, eventId],
      flags: [...next.flags, ...(option.flags ?? [])],
      scheduled: [
        ...next.scheduled.filter((s) => s.eventId !== eventId),
        ...(option.schedule ?? []).map((s) => ({
          eventId: s.eventId,
          day: next.day + s.inDays,
        })),
      ],
    },
  };
}

/** Lets unanswered events whose time has run out apply their fallout. */
function expire(state: StudyState): StudyState {
  let next = state;
  for (const event of inbox(state)) {
    const first = next.seen[event.id] ?? next.day;
    if (next.day < first + event.ttl - 1) continue;
    next = {
      ...applyEffects(next, event.ifIgnored),
      handled: [...next.handled, event.id],
      log: [
        ...next.log,
        {
          day: next.day,
          eventId: event.id,
          optionId: "ignored",
          label: "Left unanswered",
          documented: false,
          attentionSpent: 0,
          effects: event.ifIgnored,
        },
      ],
    };
  }
  return next;
}

/**
 * Ends the day: unanswered events that have run out of time apply their
 * fallout, the study advances one day, and new events reach the inbox.
 */
export function endDay(state: StudyState): StudyState {
  if (state.status !== "running") return state;
  return markSeen(advanceDay(expire(markSeen(state))));
}

/** Starts the study on day 1 with the first inbox ready. */
export function beginStudy(state: StudyState): StudyState {
  return markSeen(advanceDay(state));
}
