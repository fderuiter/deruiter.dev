import {
  getEvent,
  phaseForDay,
  projectedFinishDay,
  siteVisibility,
  totalOpenQueries,
  type SiteState,
  type StudyState,
  type TeamMember,
} from "@/lib/study-director";
import { spend } from "./clock";
import {
  OPEN_TRUST,
  STREAM_FOR_ROLE,
  STREAM_LABEL,
  WARY_TRUST,
  adjustTrust,
  bondFor,
  observe,
  personState,
} from "./team";
import type {
  DialogueLine,
  Observation,
  PersonState,
  WorldResult,
  WorldState,
} from "../types";

/** Decisions on the log that were never written up. */
export function undocumentedDecisions(study: StudyState) {
  return study.log.filter(
    (r) => !r.documented && r.optionId !== "ignored" && getEvent(r.eventId)
  );
}

function fact(
  world: WorldState,
  member: TeamMember,
  id: string,
  text: string,
  extra: Pick<Observation, "area" | "siteId"> = {}
): Observation {
  return { id, day: world.study.day, source: member.name, text, ...extra };
}

const bucket = (n: number, size = 5) => Math.floor(n / size);

/** The site hiding the most of something from the dashboard. */
function worstHidden(
  study: StudyState,
  pick: (s: SiteState) => number
): { site: SiteState; total: number; hidden: number } | null {
  let best: { site: SiteState; total: number; hidden: number } | null = null;
  for (const site of study.sites) {
    const total = pick(site);
    const hidden = Math.round(total * (1 - siteVisibility(study, site)));
    if (
      !best ||
      hidden > best.hidden ||
      (hidden === best.hidden && total > best.total)
    )
      best = { site, total, hidden };
  }
  return best;
}

/** What a member says about how they are, by mood and trust. */
function selfLine(
  world: WorldState,
  member: TeamMember,
  p: PersonState
): DialogueLine {
  const { trust } = p;
  if (p.mood === "overloaded") {
    if (trust >= OPEN_TRUST)
      return {
        kind: "warning",
        text: "Honestly? I'm drowning. If nobody takes something off me, something slips this week.",
        fact: fact(
          world,
          member,
          `overloaded:${member.id}:d${world.study.day}`,
          `${member.name} says they are drowning and something will slip.`
        ),
      };
    if (trust >= WARY_TRUST)
      return {
        kind: "joke",
        text: "I'm fine. Everything is fine. Why do you ask?",
      };
    return {
      kind: "relationship",
      text: `${member.name} doesn't look up from the screen. You are not someone they complain to.`,
    };
  }
  if (p.mood === "busy")
    return trust >= WARY_TRUST
      ? {
          kind: "information",
          text: "Busy, but the good kind. I'll shout if it turns.",
        }
      : { kind: "relationship", text: "Busy. Was there something?" };
  return trust >= WARY_TRUST
    ? {
        kind: "opportunity",
        text: `I've got room this week if you want to hand me something on ${STREAM_LABEL[STREAM_FOR_ROLE[member.role]]}.`,
      }
    : { kind: "relationship", text: "Fine, thanks. Quiet." };
}

/**
 * What a member knows about the study from their seat. The same underlying
 * state reads differently by trust: an open member gives the real number
 * before the dashboard does, a middling one a hint, a wary one the line.
 */
function roleLine(
  world: WorldState,
  member: TeamMember,
  trust: number
): DialogueLine {
  const { study } = world;
  const open = trust >= OPEN_TRUST;
  const middling = trust >= WARY_TRUST;
  switch (member.role) {
    case "dataManager": {
      const worst = worstHidden(study, (s) => s.openQueries);
      if (worst && worst.hidden >= 3) {
        if (open)
          return {
            kind: "warning",
            text: `${worst.site.name} is sitting on ${worst.total} open queries. The EDC shows about ${worst.total - worst.hidden}; their coordinator doesn't enter the rest.`,
            fact: fact(
              world,
              member,
              `queries:${worst.site.id}:${bucket(worst.total)}`,
              `${worst.site.name} has about ${worst.total} open queries, more than the EDC shows.`,
              { area: "data", siteId: worst.site.id }
            ),
          };
        if (middling)
          return {
            kind: "information",
            text: `Queries are climbing at ${worst.site.name}. I'm keeping up. Mostly.`,
            fact: fact(
              world,
              member,
              `queries-hint:${worst.site.id}`,
              `${member.name} says queries are climbing at ${worst.site.name}.`,
              { area: "data", siteId: worst.site.id }
            ),
          };
        return { kind: "relationship", text: "Queries are being handled." };
      }
      const total = totalOpenQueries(study);
      return total > 0
        ? {
            kind: "information",
            text: `${total} open queries across the sites, and the EDC has all of them. For once.`,
          }
        : {
            kind: "information",
            text: "Nothing to clean yet. Enjoy it; it doesn't last.",
          };
    }
    case "monitor": {
      const worst = worstHidden(study, (s) => s.unsignedSource + s.deviations);
      if (worst && worst.total >= 2) {
        if (open)
          return {
            kind: "warning",
            text: `${worst.site.name} has ${worst.site.unsignedSource} unsigned source documents and ${worst.site.deviations} deviations. I'd go and look before an inspector does.`,
            fact: fact(
              world,
              member,
              `source:${worst.site.id}:${bucket(worst.total, 3)}`,
              `${worst.site.name}: ${worst.site.unsignedSource} unsigned source, ${worst.site.deviations} deviations.`,
              { area: "regulatory", siteId: worst.site.id }
            ),
          };
        if (middling)
          return {
            kind: "information",
            text: `I'd keep an eye on ${worst.site.name}. The paperwork is slipping.`,
            fact: fact(
              world,
              member,
              `source-hint:${worst.site.id}`,
              `${member.name} says paperwork is slipping at ${worst.site.name}.`,
              { area: "regulatory", siteId: worst.site.id }
            ),
          };
        return { kind: "relationship", text: "Monitoring is on schedule." };
      }
      const quiet = study.sites.find((s) => s.coordinator === "invisible");
      return quiet && middling
        ? {
            kind: "warning",
            text: `${quiet.name}'s coordinator never calls back. That isn't good news; it's no news.`,
            fact: fact(
              world,
              member,
              `quiet-site:${quiet.id}`,
              `${quiet.name}'s coordinator reports little; its dashboard is not to be trusted.`,
              { area: "data", siteId: quiet.id }
            ),
          }
        : {
            kind: "joke",
            text: "Thirty years of monitoring. The sites are always fine, right up until the visit.",
          };
    }
    case "regulatory": {
      const untrained = study.sites.filter((s) => !s.trainingCurrent);
      if (untrained.length > 0) {
        const names = untrained.map((s) => s.name).join(" and ");
        if (open)
          return {
            kind: "warning",
            text: `${names} still hasn't finished protocol training. An inspector would find that in five minutes.`,
            fact: fact(
              world,
              member,
              `training:${untrained.map((s) => s.id).join("+")}`,
              `Training is not current at ${names}.`,
              { area: "regulatory", siteId: untrained[0].id }
            ),
          };
        if (middling)
          return {
            kind: "information",
            text: "Training records are mostly in. Mostly.",
          };
        return { kind: "relationship", text: "Regulatory is on track." };
      }
      if (study.documentationDebt >= 15 && open)
        return {
          kind: "warning",
          text: "The TMF has gaps where your decisions should be. Write them up while you still remember why.",
          fact: fact(
            world,
            member,
            `debt:${bucket(study.documentationDebt, 10)}`,
            "Dana says decisions are missing from the TMF.",
            { area: "regulatory" }
          ),
        };
      return {
        kind: "information",
        text: "Approvals and training are on file at every site.",
      };
    }
    case "biostatistician": {
      const worst = worstHidden(study, (s) => s.eligibilityConcerns);
      if (worst && worst.total >= 1) {
        if (open)
          return {
            kind: "warning",
            text: `${worst.total} subjects at ${worst.site.name} may not meet eligibility. If they stay in the analysis set, the endpoint is in trouble.`,
            fact: fact(
              world,
              member,
              `eligibility:${worst.site.id}:${worst.total}`,
              `${worst.total} eligibility concerns at ${worst.site.name}.`,
              { area: "safety", siteId: worst.site.id }
            ),
          };
        if (middling)
          return {
            kind: "joke",
            text: "The p-value is going to be beautiful. Probably.",
          };
        return { kind: "relationship", text: "The analysis plan is on track." };
      }
      return middling
        ? {
            kind: "joke",
            text: "Statistically, everything is fine. Ask me again after lock.",
          }
        : { kind: "relationship", text: "The analysis plan is on track." };
    }
    case "medicalWriter": {
      const missing = undocumentedDecisions(study).length;
      if (missing > 0) {
        if (open)
          return {
            kind: "warning",
            text: `${missing} of your decisions have no write-up. I can't write a CSR from memory, and neither can an inspector.`,
            fact: fact(
              world,
              member,
              `undocumented:${missing}`,
              `${missing} decisions are not written up.`,
              { area: "regulatory" }
            ),
          };
        if (middling)
          return {
            kind: "information",
            text: "I've got most of what I need for the write-ups. Not all.",
          };
        return { kind: "relationship", text: "Writing's fine." };
      }
      return {
        kind: "information",
        text: "Everything you've decided is written up. I checked twice.",
      };
    }
    default: {
      const planned = study.setup.durationDays + study.slipDays;
      const backlog = Math.max(0, projectedFinishDay(study) - planned);
      if (backlog > 0) {
        if (open)
          return {
            kind: "warning",
            text: `At this query backlog, lock slips about ${backlog} days. The programs don't care how nice the dashboard looks.`,
            fact: fact(
              world,
              member,
              `lock-slip:${backlog}`,
              `Omar projects lock slipping about ${backlog} days on the backlog.`,
              { area: "timeline" }
            ),
          };
        if (middling)
          return { kind: "joke", text: "My code runs. Your data, less so." };
        return { kind: "relationship", text: "Programs run." };
      }
      const phase = phaseForDay(study.day, study.setup.durationDays);
      return phase === "analysis" || phase === "cleaning"
        ? {
            kind: "information",
            text: "Tables are validating clean against the specs.",
          }
        : {
            kind: "joke",
            text: "The tables are programmed. All I need is data that agrees with itself.",
          };
    }
  }
}

/**
 * What a member says when the player talks to them: a pure function of the
 * study, their trust and what the player already knows. Every line carries
 * information, a warning, an opportunity, a relationship signal or a joke.
 * A line whose fact the player already has is dropped rather than repeated.
 */
export function dialogueLines(
  world: WorldState,
  memberId: string
): DialogueLine[] {
  const member = world.study.team.find((m) => m.id === memberId);
  const p = personState(world, memberId);
  if (!member || !p) return [];
  const bond = bondFor(world, memberId);
  const lines: DialogueLine[] = [
    selfLine(world, member, p),
    roleLine(world, member, p.trust),
  ];
  if (bond.owns)
    lines.push({
      kind: "information",
      text: `${STREAM_LABEL[bond.owns].replace(/^the /, "The ")} is mine now. You don't need to chase it.`,
    });
  else if (bond.coached > 0 && p.trust >= 55)
    lines.push({
      kind: "opportunity",
      text: `Coach me once more and I'll take ${STREAM_LABEL[STREAM_FOR_ROLE[member.role]]} off your plate for good.`,
    });
  const fresh = lines.filter(
    (l) => !l.fact || !world.known.includes(l.fact.id)
  );
  if (fresh.length > 0) return fresh;
  return [
    {
      kind: "joke",
      text: "Same as when you asked earlier. I'll tell you if it changes, promise.",
    },
  ];
}

/**
 * Talks to a member: ten minutes of the player's day. What they say is
 * worked out before the talk, any facts are recorded as seen, and the first
 * talk of the day builds a little trust, which the last line reports.
 */
export function talk(
  world: WorldState,
  memberId: string
): WorldResult<{ lines: DialogueLine[] }> {
  const member = world.study.team.find((m) => m.id === memberId);
  if (!member) return { ok: false, reason: "unknown-action" };
  const spent = spend(world, "talk");
  if (!spent.ok) return spent;
  const lines = dialogueLines(world, memberId);
  let next = spent.world;
  for (const line of lines) if (line.fact) next = observe(next, line.fact);
  const trusted = adjustTrust(next, memberId, "talk");
  next = trusted.world;
  if (trusted.delta > 0)
    lines.push({
      kind: "relationship",
      text: `${member.name} seems glad you stopped by.`,
      trustDelta: trusted.delta,
    });
  return { ok: true, world: next, lines };
}
