import {
  deskView,
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
 * What changed between two worlds, as toasts: energy and focus moving by a
 * few points, a team member's trust crossing a heart, and an item leaving
 * the task list (stamped as done). Nothing is reported across a new day or
 * after the player has gone home, where the cards say it already.
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
  const stillOpen = new Set(todaysTasks(next).map((t) => t.id));
  for (const task of todaysTasks(prev)) {
    if (stillOpen.has(task.id)) continue;
    out.push({
      id: `done:${task.id}:${next.minute}`,
      kind: "stamp",
      text: `Done: ${task.text}`,
      tone: "neutral",
    });
  }
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
