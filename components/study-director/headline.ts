import {
  METER_IDS,
  computeMeters,
  inbox,
  phaseForDay,
  type StudyState,
} from "@/lib/study-director";
import { METER_LABELS, PHASE_LABELS } from "./labels";

/**
 * Today's front-page headline, from the study's own state. The most urgent
 * truth wins; the Study Director's quote never changes.
 */
export function dailyHeadline(state: StudyState): string {
  const meters = computeMeters(state);
  const ranked = [...METER_IDS].sort((a, b) => meters[a] - meters[b]);
  const worst = ranked[0];
  const best = ranked[ranked.length - 1];
  const critical = inbox(state).filter((e) => e.urgency === "critical").length;
  const phase = phaseForDay(state.day, state.setup.durationDays);
  const yesterday = phaseForDay(state.day - 1, state.setup.durationDays);
  const day = `Day ${state.day}`;

  if (meters[worst] < 20) {
    return `${day}: ${METER_LABELS[worst]} at ${meters[worst]}. Study Director: “Everything is fine.”`;
  }
  if (critical >= 2) {
    return `${day}: ${critical} critical messages, one Study Director.`;
  }
  if (state.day > 1 && phase !== yesterday) {
    return `${day}: ${PHASE_LABELS[phase]} begins. Nobody has read the plan.`;
  }
  if (state.documentationDebt >= 40) {
    return `${day}: Decisions made, reasons unknown.`;
  }
  if (meters[best] - meters[worst] >= 30) {
    return `${day}: ${METER_LABELS[best]} is strong. ${METER_LABELS[worst]} is not.`;
  }
  if (critical === 1) {
    return `${day}: One critical message. It can probably wait. (It cannot.)`;
  }
  return `${day}: A quiet day. Suspiciously quiet.`;
}
