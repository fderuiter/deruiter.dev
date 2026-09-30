import type { StudyEvent, StudyState, TeamMember } from "@/lib/study-director";

/**
 * Days an open message stays answerable, counting today. At 1 it lapses
 * when the day ends and its fallout applies.
 */
export function daysLeft(state: StudyState, event: StudyEvent): number {
  const first = state.seen[event.id] ?? state.day;
  return first + event.ttl - state.day;
}

/** Plain words for how long a message has left. */
export function lapseLabel(days: number): string {
  if (days <= 1) return "Lapses tonight";
  return `Lapses in ${days} days`;
}

export type SenderKind = "team" | "sponsor" | "site" | "company";

export interface Sender {
  kind: SenderKind;
  /** Display name without the role in brackets. */
  name: string;
  member?: TeamMember;
}

/** Works out who wrote a message from its "from" line. */
export function senderOf(from: string, team: TeamMember[]): Sender {
  const name = from.replace(/\s*\(.*\)\s*$/, "").trim();
  const member = team.find((m) => m.name === name);
  if (member) return { kind: "team", name, member };
  if (/sponsor/i.test(from)) return { kind: "sponsor", name };
  if (/^site\b/i.test(from)) return { kind: "site", name };
  return { kind: "company", name };
}
