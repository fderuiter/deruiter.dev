import {
  applyEffects,
  resolveDecision,
  type Effects,
  type SiteState,
  type StudyState,
  type TeamMember,
} from "@/lib/study-director";
import { clamp } from "@/lib/game-utils";
import { spend } from "./clock";
import {
  STREAM_FOR_ROLE,
  STREAM_LABEL,
  adjustTrust,
  bondFor,
  personState,
  withBond,
} from "./team";
import type {
  Assignment,
  DelegationOutcome,
  DelegationVerb,
  DialogueLine,
  OvernightLine,
  WorkStream,
  WorldResult,
  WorldState,
} from "../types";

/** Workload an assignment adds while it is open, and takes away when done. */
export const ASSIGNMENT_LOAD = 12;
/** Workload taken off a member when their problem is escalated. */
const ESCALATION_RELIEF = 15;
/** What escalating for contract help costs the study. */
const ESCALATION_SPEND = 3000;
/** Coaching sessions after which a trusting member takes ownership. */
export const OWNERSHIP_COACHING = 2;
/** Trust a member needs to take ownership of their stream. */
export const OWNERSHIP_TRUST = 70;

/** Units of work a member gets through in a night, from skill, speed and load. */
export function nightlyCapacity(member: TeamMember): number {
  const load = member.workload > 85 ? 0.5 : member.workload > 70 ? 0.75 : 1;
  return Math.max(1, Math.round(((member.skill * member.speed) / 3) * load));
}

function worstSite(study: StudyState, stream: WorkStream): SiteState | null {
  const score = (s: SiteState) =>
    stream === "queries"
      ? s.openQueries
      : stream === "monitoring"
        ? s.unsignedSource + s.deviations
        : stream === "training"
          ? s.trainingCurrent
            ? 0
            : 1
          : 0;
  const sorted = [...study.sites].sort((a, b) => score(b) - score(a));
  return sorted[0] && score(sorted[0]) > 0 ? sorted[0] : null;
}

/** How much work a stream's assignment is, in units. */
function sizeOf(stream: WorkStream, site: SiteState | null): number {
  if (stream === "queries") return clamp(site?.openQueries ?? 0, 3, 15);
  if (stream === "monitoring") return 4;
  return 3;
}

/**
 * What a number of units of a stream does to the study. Queries close at
 * the site, a monitoring visit audits the site and gets source signed,
 * training brings the site current once complete, and the desk-bound
 * streams nudge their meter.
 */
function streamEffects(
  stream: WorkStream,
  units: number,
  siteId: string | null,
  finished: boolean
): Effects {
  switch (stream) {
    case "queries":
      return siteId ? { sites: [{ siteId, openQueries: -units }] } : {};
    case "monitoring":
      return siteId
        ? {
            auditSites: [siteId],
            sites: [{ siteId, unsignedSource: -Math.ceil(units / 2) }],
          }
        : {};
    case "training":
      return finished && siteId
        ? { sites: [{ siteId, trainingCurrent: true }] }
        : {};
    case "analysis":
      return { meters: { integrity: 1 } };
    case "writing":
      return { meters: { compliance: 1 } };
    default:
      return { meters: { timeline: 1 } };
  }
}

function line(
  kind: DialogueLine["kind"],
  text: string,
  trustDelta?: number
): DialogueLine {
  return trustDelta === undefined ? { kind, text } : { kind, text, trustDelta };
}

/** Records a delegation in the domain's decision log, documented. */
function logDecision(
  world: WorldState,
  id: string,
  label: string,
  effects: Effects
): WorldState | null {
  const result = resolveDecision(world.study, {
    eventId: `world:${id}`,
    optionId: id.split(":")[0],
    label,
    effects,
    attentionCost: 0,
    debtIfUndocumented: 0,
    documented: true,
  });
  return result.ok ? { ...world, study: result.state } : null;
}

/** Active work assigned to a member. */
export function assignmentsFor(
  world: WorldState,
  memberId: string
): Assignment[] {
  return (world.assignments ?? []).filter((a) => a.memberId === memberId);
}

/**
 * One delegation verb on a member, translated into world and domain calls:
 *
 * - ask status: ten minutes; they say what they are on, and it counts as a talk.
 * - assign: ten minutes; their stream's next piece of work lands over the
 *   following nights through their capacity. Their workload rises now
 *   (recorded with `resolveDecision`, so the domain sees a delegation), and
 *   dumping work on someone overloaded costs trust.
 * - review: twenty minutes; reviewing work that has landed is follow-through
 *   and builds trust; reviewing work still in progress is micromanagement.
 * - coach: forty-five minutes; trust and confidence rise, and a member
 *   coached twice who trusts you takes ownership of their stream.
 * - escalate: ten minutes; you ask your boss for contract help, which costs
 *   the budget and takes load off them. Welcome if they were struggling,
 *   going over their head if not.
 * - take over: an hour of demanding work; you clear some of their stream
 *   yourself. It takes load off them, and overriding an owner costs trust.
 */
export function delegate(
  world: WorldState,
  memberId: string,
  verb: DelegationVerb
): WorldResult<DelegationOutcome> {
  const member = world.study.team.find((m) => m.id === memberId);
  const person = personState(world, memberId);
  if (!member || !person) return { ok: false, reason: "unknown-action" };
  const stream = STREAM_FOR_ROLE[member.role];
  const bond = bondFor(world, memberId);
  const day = world.study.day;
  const name = member.name;
  const cost =
    verb === "review"
      ? "reviewEdc"
      : verb === "coach"
        ? "meeting"
        : verb === "takeOver"
          ? "amendment"
          : "talk";
  const spent = spend(world, cost);
  if (!spent.ok) return spent;
  let next = spent.world;
  const lines: DialogueLine[] = [];

  if (verb === "askStatus") {
    const trusted = adjustTrust(next, memberId, "talk");
    next = withBond(trusted.world, memberId, { askedDay: day });
    lines.push(line("information", `${name} is ${person.task}.`));
    const open = assignmentsFor(next, memberId).filter((a) => a.remaining > 0);
    if (open[0])
      lines.push(
        line(
          "information",
          `${STREAM_LABEL[open[0].stream].replace(/^the /, "The ")}: ${open[0].remaining > open[0].amount / 2 ? "just started" : "more than halfway"}.`
        )
      );
    if (trusted.delta > 0)
      lines.push(
        line("relationship", `${name} appreciates being asked.`, trusted.delta)
      );
    return { ok: true, world: next, lines };
  }

  if (verb === "assign") {
    if (assignmentsFor(next, memberId).some((a) => a.remaining > 0))
      return {
        ok: true,
        world,
        lines: [
          line(
            "relationship",
            `${name} is still on what you gave them last time.`
          ),
        ],
      };
    const site = worstSite(next.study, stream);
    const amount = sizeOf(stream, site);
    const id = `assign:${memberId}:${day}`;
    const label = `Assigned ${STREAM_LABEL[stream]}${site ? ` at ${site.name}` : ""} to ${name}`;
    const logged = logDecision(next, id, label, {
      workload: [{ memberId, delta: ASSIGNMENT_LOAD }],
    });
    if (!logged) return { ok: false, reason: "study-complete" };
    next = {
      ...logged,
      assignments: [
        ...(logged.assignments ?? []),
        {
          id,
          memberId,
          stream,
          siteId: site?.id ?? null,
          day,
          amount,
          remaining: amount,
          reviewed: false,
        },
      ],
    };
    const nights = Math.max(1, Math.ceil(amount / nightlyCapacity(member)));
    const cause = person.mood === "overloaded" ? "dump" : "heard";
    const trusted = adjustTrust(next, memberId, cause);
    next = trusted.world;
    lines.push(
      line(
        "information",
        `${label}. It will land over the next ${nights === 1 ? "night" : `${nights} nights`}.`
      ),
      cause === "dump"
        ? line(
            "relationship",
            `${name} takes it without a word. That was one thing too many.`,
            trusted.delta
          )
        : line(
            "relationship",
            `${name} looks pleased to be trusted with it.`,
            trusted.delta
          )
    );
    return { ok: true, world: next, lines };
  }

  if (verb === "review") {
    const done = assignmentsFor(next, memberId).find(
      (a) => a.remaining === 0 && !a.reviewed
    );
    if (done) {
      next = {
        ...next,
        assignments: (next.assignments ?? []).map((a) =>
          a.id === done.id ? { ...a, reviewed: true } : a
        ),
      };
      const trusted = adjustTrust(next, memberId, "followThrough");
      next = trusted.world;
      lines.push(
        line(
          "information",
          `You go through ${STREAM_LABEL[done.stream]} with ${name}. It's done properly.`
        ),
        line("relationship", `${name} notices you followed up.`, trusted.delta)
      );
      return { ok: true, world: next, lines };
    }
    const open = assignmentsFor(next, memberId).find((a) => a.remaining > 0);
    if (open) {
      const trusted = adjustTrust(next, memberId, "brushOff");
      next = trusted.world;
      lines.push(
        line(
          "information",
          `${open.amount - open.remaining} of ${open.amount} done so far.`
        ),
        line(
          "relationship",
          `${name} would rather you let them finish.`,
          trusted.delta
        )
      );
      return { ok: true, world: next, lines };
    }
    lines.push(
      line(
        "joke",
        `${name} shows you a very tidy desk. There is nothing of yours to review.`
      )
    );
    return { ok: true, world: next, lines };
  }

  if (verb === "coach") {
    if (bond.coachedDay === day)
      return {
        ok: true,
        world,
        lines: [
          line(
            "relationship",
            `You already coached ${name} today. Let it sink in.`
          ),
        ],
      };
    const trusted = adjustTrust(next, memberId, "coach");
    const coached = bond.coached + 1;
    next = withBond(trusted.world, memberId, {
      coached,
      coachedDay: day,
      confidence: Math.min(100, bond.confidence + 10),
    });
    lines.push(
      line(
        "information",
        `An hour with ${name} on how you'd approach ${STREAM_LABEL[stream]}.`
      ),
      line("relationship", `${name} sits up straighter.`, trusted.delta)
    );
    const trust = bondFor(next, memberId).trust;
    if (
      !bond.owns &&
      coached >= OWNERSHIP_COACHING &&
      trust >= OWNERSHIP_TRUST
    ) {
      next = withBond(next, memberId, { owns: stream });
      lines.push(
        line(
          "opportunity",
          `${name} takes ownership of ${STREAM_LABEL[stream]}. You won't need to chase it any more.`
        )
      );
      return { ok: true, world: next, lines, owns: stream };
    }
    return { ok: true, world: next, lines };
  }

  if (verb === "escalate") {
    const struggling = person.mood === "overloaded";
    const logged = logDecision(
      next,
      `escalate:${memberId}:${day}`,
      `Escalated ${name}'s workload: contract help`,
      {
        spend: ESCALATION_SPEND,
        workload: [{ memberId, delta: -ESCALATION_RELIEF }],
      }
    );
    if (!logged) return { ok: false, reason: "study-complete" };
    const trusted = adjustTrust(
      logged,
      memberId,
      struggling ? "heard" : "override"
    );
    next = trusted.world;
    lines.push(
      line(
        "information",
        `Your boss approves contract help for ${name}: $${ESCALATION_SPEND.toLocaleString("en-US")}.`
      ),
      struggling
        ? line(
            "relationship",
            `${name} looks relieved. Somebody noticed.`,
            trusted.delta
          )
        : line(
            "relationship",
            `${name} hears about it from your boss first. That stings.`,
            trusted.delta
          )
    );
    return { ok: true, world: next, lines };
  }

  // Take it yourself.
  const site = worstSite(next.study, stream);
  const units = 3;
  const logged = logDecision(
    next,
    `takeOver:${memberId}:${day}`,
    `Took ${STREAM_LABEL[stream]} off ${name}`,
    {
      ...streamEffects(stream, units, site?.id ?? null, true),
      workload: [{ memberId, delta: -6 }],
    }
  );
  if (!logged) return { ok: false, reason: "study-complete" };
  const overridden = adjustTrust(
    logged,
    memberId,
    bond.owns ? "override" : "brushOff"
  );
  next = overridden.world;
  const delta = overridden.delta;
  lines.push(
    line(
      "information",
      `An hour on ${STREAM_LABEL[stream]}${site ? ` at ${site.name}` : ""}. You did it yourself.`
    ),
    bond.owns
      ? line(
          "relationship",
          `${name} owned that. Now they're not sure they do.`,
          delta
        )
      : line("relationship", `${name} watches you do their job.`, delta)
  );
  return { ok: true, world: next, lines };
}

/**
 * The team's night: assigned work lands through each member's capacity,
 * and owners run their streams without being asked. Maya, owning queries,
 * clears half her capacity again at the worst site; Walt, owning
 * monitoring, visits a site every third day, which makes its dashboard
 * honest for a while. Applied to the study with `applyEffects` before the
 * domain simulates the day. Returns the report lines the player sees.
 */
export function workTheNight(world: WorldState): {
  world: WorldState;
  lines: OvernightLine[];
} {
  let study = world.study;
  const lines: OvernightLine[] = [];
  const assignments = (world.assignments ?? []).map((a) => {
    if (a.remaining <= 0) return a;
    const member = study.team.find((m) => m.id === a.memberId);
    if (!member) return a;
    const units = Math.min(a.remaining, nightlyCapacity(member));
    const remaining = a.remaining - units;
    const finished = remaining === 0;
    const effects = streamEffects(a.stream, units, a.siteId, finished);
    study = applyEffects(study, {
      ...effects,
      workload: finished
        ? [{ memberId: a.memberId, delta: -ASSIGNMENT_LOAD }]
        : [],
    });
    const site = study.sites.find((s) => s.id === a.siteId);
    lines.push({
      text: finished
        ? `${member.name} finished ${STREAM_LABEL[a.stream]}${site ? ` at ${site.name}` : ""}. Worth a review.`
        : `${member.name} worked on ${STREAM_LABEL[a.stream]}${site ? ` at ${site.name}` : ""}`,
      tone: finished ? "good" : "neutral",
    });
    return { ...a, remaining };
  });
  for (const member of study.team) {
    const bond = bondFor(world, member.id);
    if (!bond.owns) continue;
    const site = worstSite(study, bond.owns);
    if (bond.owns === "monitoring") {
      if (study.day % 3 !== 0) continue;
      const visit =
        site ?? study.sites[study.day % Math.max(1, study.sites.length)];
      if (!visit) continue;
      study = applyEffects(
        study,
        streamEffects("monitoring", 2, visit.id, true)
      );
      lines.push({
        text: `${member.name} visited ${visit.name} on the monitoring schedule`,
        tone: "good",
      });
      continue;
    }
    const units = Math.max(1, Math.round(nightlyCapacity(member) / 2));
    const effects = streamEffects(bond.owns, units, site?.id ?? null, true);
    if (Object.keys(effects).length === 0) continue;
    study = applyEffects(study, effects);
    lines.push({
      text: `${member.name} kept ${STREAM_LABEL[bond.owns]} moving${site ? ` at ${site.name}` : ""}`,
      tone: "good",
    });
  }
  return { world: { ...world, study, assignments }, lines };
}
