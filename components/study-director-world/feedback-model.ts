import {
  deskView,
  guestScene,
  pendingInterruption,
  phoneCalls,
  planFor,
  relationshipCard,
  ringingCall,
  type WorldState,
} from "@/lib/study-director-world";
import type { WorldSoundCue } from "./world-sound";
import { todaysTasks } from "./stage-model";

/** Energy or focus has to move this far to be worth a toast. */
export const TOAST_THRESHOLD = 5;

/** One small piece of visual feedback after an action. */
export interface Feedback {
  id: string;
  kind: "meter" | "heart" | "stamp";
  text: string;
  tone: "good" | "bad" | "neutral";
}

/**
 * Tasks whose leaving the list is not, by itself, something done: the
 * phone, the interruption and a visitor are told apart by what became of
 * them; a visitor still to come turns into a visitor waiting; and a meeting
 * ending has its own report (#2252).
 */
const NOT_STAMPED = (id: string) =>
  id === "ringing" ||
  id === "interruption" ||
  id === "guest" ||
  id === "meeting" ||
  id.startsWith("guest:");

/**
 * The stamps for items that left today's list, worded for what actually
 * happened to them. Only something dealt with says "Done": a call let ring
 * says so, an interruption that lapsed is "Missed", one held back by a
 * meeting or a visitor is "Waiting", and a meeting ending says nothing
 * here, since its report opens (#2252).
 */
function settledBetween(prev: WorldState, next: WorldState): Feedback[] {
  const out: Feedback[] = [];
  const stamp = (key: string, text: string): Feedback => ({
    id: `${key}:${next.minute}`,
    kind: "stamp",
    text,
    tone: "neutral",
  });

  const call = ringingCall(prev);
  if (call && ringingCall(next)?.eventId !== call.eventId) {
    const now = phoneCalls(next).find((c) => c.eventId === call.eventId);
    // An answered call opens the conversation; the decision is what counts.
    if (now?.status === "voicemail")
      out.push(stamp(`call:${call.eventId}`, `Voicemail: ${call.from}`));
    else if (now?.status === "scheduled")
      out.push(stamp(`call:${call.eventId}`, `Let it ring: ${call.from}`));
  }

  const asked = pendingInterruption(prev);
  if (asked && pendingInterruption(next)?.id !== asked.id) {
    const key = `interruption:${asked.id}`;
    if (planFor(next).handled.includes(asked.id))
      out.push(stamp(key, `Done: ${asked.title}`));
    else if (next.meeting || next.visit || guestScene(next))
      out.push(stamp(key, `Waiting: ${asked.title}`));
    else if (!(planFor(next).excused ?? []).includes(asked.id))
      out.push(stamp(key, `Missed: ${asked.title}`));
  }

  const guest = guestScene(prev);
  if (guest && guestScene(next)?.id !== guest.id) {
    const record = (next.guests ?? []).find(
      (g) => g.id === guest.id && g.day === next.study.day
    );
    if (record)
      out.push(
        stamp(
          `guest:${guest.id}`,
          record.outcome === "met"
            ? `Done: met ${guest.visitor.name}`
            : `Missed: ${guest.visitor.name} left`
        )
      );
  }

  // A desk item that only changed tray (a call to return sent on to
  // voicemail, say) is still on the desk, so it is not done.
  const before = deskView(prev);
  const after = deskView(next);
  const onDesk = new Set(
    [...after.voicemail, ...after.callbacks, ...after.mail].map(
      (i) => i.eventId
    )
  );
  const trays = {
    voicemail: before.voicemail,
    callbacks: before.callbacks,
    mail: before.mail,
  } as const;
  const moved = (id: string) =>
    id in trays &&
    trays[id as keyof typeof trays].some((i) => onDesk.has(i.eventId));
  const stillOpen = new Set(todaysTasks(next).map((t) => t.id));
  for (const task of todaysTasks(prev)) {
    if (stillOpen.has(task.id) || NOT_STAMPED(task.id) || moved(task.id))
      continue;
    out.push(stamp(`done:${task.id}`, `Done: ${task.text}`));
  }
  return out;
}

/**
 * What changed between two worlds, as toasts: energy and focus moving by a
 * few points, a team member's trust crossing a heart, and an item leaving
 * the task list, worded for what became of it (#2252). Nothing is reported
 * across a new day or after the player has gone home, where the cards say
 * it already.
 */
export function feedbackBetween(
  prev: WorldState,
  next: WorldState
): Feedback[] {
  if (prev.study.day !== next.study.day) return [];
  if (next.location === "home" || prev.location === "home") return [];
  const out: Feedback[] = [];
  for (const [label, was, now] of [
    ["Energy", prev.energy, next.energy],
    ["Focus", prev.focus, next.focus],
  ] as const) {
    const delta = Math.round(now - was);
    if (Math.abs(delta) >= TOAST_THRESHOLD)
      out.push({
        id: `${label.toLowerCase()}:${next.minute}`,
        kind: "meter",
        text: `${label} ${delta > 0 ? "+" : "−"}${Math.abs(delta)}`,
        tone: delta > 0 ? "good" : "bad",
      });
  }
  for (const member of next.study.team) {
    const was = relationshipCard(prev, member.id);
    const now = relationshipCard(next, member.id);
    if (!was || !now || was.hearts === now.hearts) continue;
    out.push({
      id: `heart:${member.id}:${now.hearts}`,
      kind: "heart",
      text:
        now.hearts > was.hearts
          ? `${now.name} trusts you a little more`
          : `${now.name} trusts you a little less`,
      tone: now.hearts > was.hearts ? "good" : "bad",
    });
  }
  out.push(...settledBetween(prev, next));
  return out;
}

/**
 * The sounds a change makes, in order: a footstep every second tile, a door
 * when the player enters a new room, the phone starting to ring, a new email
 * on the desk, a coffee and a stamp when something is dealt with. Pure, so
 * the mapping is testable without any audio.
 */
export function cuesBetween(
  prev: WorldState,
  next: WorldState
): WorldSoundCue[] {
  if (prev.study.day !== next.study.day) return [];
  const cues: WorldSoundCue[] = [];
  if (next.walked > prev.walked && next.walked % 2 === 0) cues.push("footstep");
  if (next.location !== prev.location && next.location !== "home")
    cues.push("door");
  if (!ringingCall(prev) && ringingCall(next)) cues.push("phoneRing");
  if (deskView(next).mail.length > deskView(prev).mail.length)
    cues.push("emailChime");
  if (next.coffees > prev.coffees) cues.push("coffee");
  const open = todaysTasks(next).length;
  if (open < todaysTasks(prev).length) cues.push("stamp");
  return cues;
}
