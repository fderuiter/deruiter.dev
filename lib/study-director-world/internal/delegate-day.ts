import {
  applyEffects,
  inbox,
  resolveEvent,
  type EventOption,
  type StudyEvent,
  type StudyState,
  type Urgency,
} from "@/lib/study-director";
import { uniformAt } from "@/lib/utils/prng";
import { goHome } from "./day";
import { closeVisit } from "./sites";
import { TRUST_EFFECTS, adjustTrust } from "./team";
import type {
  OvernightLine,
  OvernightReport,
  SiteVisitReport,
  WorldResult,
  WorldState,
} from "../types";

/**
 * The chance the team lets a message slide when the player delegates the
 * day (#2092): it then applies its `ifIgnored` fallout. Urgent mail gets
 * escalated more often, so it slips less.
 */
export const DELEGATED_SLIP_CHANCE: Record<Urgency, number> = {
  critical: 0.15,
  important: 0.3,
  routine: 0.45,
};

/** Trust each team member loses when the player hands them the day. */
export const DELEGATED_TRUST_COST = -TRUST_EFFECTS.delegated;

/**
 * What the team answers when the player is not there: the option that costs
 * the least effort, the first one on a tie. It is never written up.
 */
export function teamAnswer(event: StudyEvent): EventOption | null {
  let best: EventOption | null = null;
  for (const option of event.options)
    if (!best || option.attentionCost < best.attentionCost) best = option;
  return best;
}

/** What delegating today would hand over, for the confirmation. */
export function delegationPreview(world: WorldState): {
  messages: number;
  available: boolean;
} {
  return {
    messages: inbox(world.study).length,
    available: world.study.status === "running" && world.location !== "home",
  };
}

function slipped(study: StudyState, event: StudyEvent): StudyState {
  return {
    ...applyEffects(study, event.ifIgnored),
    handled: [...study.handled, event.id],
    log: [
      ...study.log,
      {
        day: study.day,
        eventId: event.id,
        optionId: "ignored",
        label: "Let slide by the team",
        documented: false,
        attentionSpent: 0,
        effects: event.ifIgnored,
      },
    ],
  };
}

/**
 * Delegates the whole day (#2092): the team settles the inbox without the
 * player, then the day ends as if they went home. Each waiting message gets
 * the team's least-effort answer, undocumented, unless a seeded draw lets it
 * slide, when its `ifIgnored` fallout lands instead. Every team member
 * trusts the player a little less for being absent. The draws use their own
 * stream of the seed, keyed by day, so the same seed and state always
 * delegate the same way and nothing else in the run moves.
 */
export function delegateDay(world: WorldState): WorldResult<{
  report: OvernightReport;
  visit: SiteVisitReport | null;
}> {
  const { available } = delegationPreview(world);
  if (world.study.status !== "running")
    return { ok: false, reason: "study-complete" };
  if (!available) return { ok: false, reason: "unknown-action" };
  // Leaving a site writes the visit up first, as driving home does.
  const closed = closeVisit(world);
  let study = closed.world.study;
  const lines: OvernightLine[] = [];
  const stream = `${study.seed}:delegate:${study.day}`;
  inbox(study).forEach((event, i) => {
    const option = teamAnswer(event);
    const slide =
      !option || uniformAt(stream, i) < DELEGATED_SLIP_CHANCE[event.urgency];
    if (!slide && option) {
      const answered = resolveEvent(study, event.id, option.id, false);
      if (answered.ok) {
        study = answered.state;
        lines.push({
          text: `${event.subject}: the team chose "${option.label}", not written up`,
          tone: "neutral",
        });
        return;
      }
    }
    study = slipped(study, event);
    lines.push({
      text: `${event.subject}: nobody picked it up`,
      tone: "bad",
    });
  });
  if (lines.length === 0)
    lines.push({ text: "Nothing was waiting. A quiet day.", tone: "good" });
  let next: WorldState = { ...closed.world, study };
  for (const member of study.team)
    next = adjustTrust(next, member.id, "delegated").world;
  lines.push({
    text: `The team ran the day without you: trust -${DELEGATED_TRUST_COST} with everyone`,
    tone: "bad",
  });
  const night = goHome(next, { delegated: true });
  return {
    ok: true,
    world: night.world,
    visit: closed.report,
    // The wrap-up speaks of the player's own day, which they did not have.
    report: { ...night.report, wrapUp: undefined, delegated: lines },
  };
}
