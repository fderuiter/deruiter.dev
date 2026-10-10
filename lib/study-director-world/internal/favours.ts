import { applyEffects, type TeamMember } from "@/lib/study-director";
import { clamp } from "@/lib/game-utils";
import { spendCost } from "./clock";
import {
  TRUSTED_TRUST,
  WARY_TRUST,
  adjustTrust,
  bondFor,
  heartsFor,
  observe,
  withBond,
} from "./team";
import {
  type ActionCost,
  type DialogueLine,
  type DigestLine,
  type RelationshipAction,
  type RelationshipOption,
  type WorldResult,
  type WorldState,
} from "../types";

/** Hearts a member needs before they will cover for the player. */
export const COVER_MIN_HEARTS = 4;
/** Days between times a member will cover for the player. */
export const COVER_COOLDOWN_DAYS = 3;
/** Coffees the player can bring in a day, across the whole team. */
export const COFFEE_RUNS_PER_DAY = 2;
/** Workload a member needs before there is a small job to take off them. */
const FAVOUR_MIN_WORKLOAD = 35;
/** Workload a small job takes off a member. */
const FAVOUR_RELIEF = 6;
/** Overtime minutes, and energy, a covered hour gives back. */
const COVER_MINUTES = 60;
const COVER_ENERGY = 15;
/** Extra trust a coffee earns once the player knows how they take it. */
const QUIRK_COFFEE_BONUS = 2;

const COSTS: Record<RelationshipAction, ActionCost> = {
  coffee: { minutes: 10, energy: 1, focus: 0 },
  favour: { minutes: 20, energy: 2, focus: 5 },
  askAbout: { minutes: 15, energy: 1, focus: 2 },
  cover: { minutes: 5, energy: 0, focus: 0 },
};

/** The buttons: what each action is called, with its time. */
export const RELATIONSHIP_LABEL: Record<RelationshipAction, string> = {
  coffee: "Bring coffee · 10 min",
  favour: "Take a small job · 20 min",
  askAbout: "Ask about them · 15 min",
  cover: "Ask them to cover · 5 min",
};

/** What a member is like and how they take their coffee. Learned by asking. */
const QUIRKS: Record<
  TeamMember["archetype"],
  { quirk: string; coffee: string }
> = {
  overloadedStar: {
    quirk:
      "never says no, so she over-commits. Ask what she is dropping before you give her more.",
    coffee: "a very hot flat white",
  },
  veteranDataManager: {
    quirk:
      "keeps a private list of every query that has come back twice. Ask for the list.",
    coffee: "tea, strong, no questions",
  },
  veteranMonitor: {
    quirk:
      "trusts people who show up on site and remembers who did. A visit says more than a memo.",
    coffee: "black coffee, no small talk",
  },
  steadyProfessional: {
    quirk:
      "likes the agenda a day ahead. A surprise costs you more than the extra hour.",
    coffee: "green tea in the good mug",
  },
  optimisticStatistician: {
    quirk:
      "prices everything at the best case. Always ask for the pessimistic number too.",
    coffee: "an oat cappuccino",
  },
};

const quirkId = (memberId: string) => `quirk:${memberId}`;

/** True once the player has asked a member about themselves. */
export function knowsQuirk(world: WorldState, memberId: string): boolean {
  return world.known.includes(quirkId(memberId));
}

function member(world: WorldState, memberId: string) {
  return world.study.team.find((m) => m.id === memberId) ?? null;
}

function coffeesBroughtToday(world: WorldState): number {
  const day = world.study.day;
  return world.study.team.filter((m) => bondFor(world, m.id).coffeeDay === day)
    .length;
}

/** Why an action cannot be taken now, or null when it can. */
function refusalFor(
  world: WorldState,
  m: TeamMember,
  action: RelationshipAction
): string | null {
  const bond = bondFor(world, m.id);
  const day = world.study.day;
  switch (action) {
    case "coffee":
      if (bond.coffeeDay === day)
        return `${m.name} has had a coffee from you today.`;
      if (coffeesBroughtToday(world) >= COFFEE_RUNS_PER_DAY)
        return "You have already done the coffee run twice today.";
      return null;
    case "favour":
      if (bond.favourDay === day) return `You already helped ${m.name} today.`;
      if (m.workload < FAVOUR_MIN_WORKLOAD)
        return `${m.name} has nothing they need a hand with.`;
      return null;
    case "askAbout":
      if (knowsQuirk(world, m.id))
        return `You already know what makes ${m.name} tick.`;
      if (bond.trust < WARY_TRUST)
        return `${m.name} is not ready to talk about themselves yet.`;
      return null;
    case "cover":
      if (heartsFor(bond.trust) < COVER_MIN_HEARTS)
        return `${m.name} does not know you well enough to cover for you.`;
      if (bond.coverDay && day - bond.coverDay < COVER_COOLDOWN_DAYS)
        return `${m.name} covered for you recently. Give it a few days.`;
      if (world.overtime === 0 && world.energy >= 60)
        return "You do not need covering right now.";
      return null;
  }
}

/** The relationship actions on a member, each with a reason when unavailable. */
export function relationshipOptions(
  world: WorldState,
  memberId: string
): RelationshipOption[] {
  const m = member(world, memberId);
  if (!m) return [];
  return (["coffee", "favour", "askAbout", "cover"] as const).map((action) => {
    const reason = refusalFor(world, m, action);
    return reason
      ? { action, label: RELATIONSHIP_LABEL[action], available: false, reason }
      : { action, label: RELATIONSHIP_LABEL[action], available: true };
  });
}

function line(
  kind: DialogueLine["kind"],
  text: string,
  trustDelta?: number
): DialogueLine {
  return trustDelta === undefined ? { kind, text } : { kind, text, trustDelta };
}

/**
 * One relationship action on a member: a coffee, a small job taken off
 * them, asking about them (which teaches their quirk once) or, from four
 * hearts, asking them to cover your last hour. Each has a limit; one the
 * rules do not allow is refused with lines saying why, and costs nothing.
 * Trust is only ever reported as a direction, never a number (ADR 0055).
 */
export function relate(
  world: WorldState,
  memberId: string,
  action: RelationshipAction
): WorldResult<{ lines: DialogueLine[] }> {
  const m = member(world, memberId);
  if (!m) return { ok: false, reason: "unknown-action" };
  const why = refusalFor(world, m, action);
  if (why) return { ok: true, world, lines: [line("relationship", why)] };
  const spent = spendCost(world, COSTS[action]);
  if (!spent.ok) return spent;
  let next = spent.world;
  const day = world.study.day;
  const { name } = m;

  if (action === "coffee") {
    const known = knowsQuirk(world, memberId);
    const trusted = adjustTrust(next, memberId, "coffee");
    next = withBond(trusted.world, memberId, { coffeeDay: day });
    let delta = trusted.delta;
    if (known) {
      const before = bondFor(next, memberId).trust;
      next = withBond(next, memberId, {
        trust: clamp(before + QUIRK_COFFEE_BONUS, 0, 100),
      });
      delta += bondFor(next, memberId).trust - before;
    }
    return {
      ok: true,
      world: next,
      lines: [
        line(
          "information",
          known
            ? `${name} takes it: ${QUIRKS[m.archetype].coffee}, exactly right.`
            : `You bring ${name} a coffee. You guessed.`
        ),
        line("relationship", `${name} did not expect that.`, delta),
      ],
    };
  }

  if (action === "favour") {
    const trusted = adjustTrust(next, memberId, "favour");
    next = withBond(trusted.world, memberId, { favourDay: day });
    next = {
      ...next,
      study: applyEffects(next.study, {
        workload: [{ memberId, delta: -FAVOUR_RELIEF }],
      }),
    };
    return {
      ok: true,
      world: next,
      lines: [
        line(
          "information",
          `Twenty minutes on a job that was not yours. ${name} has one fewer thing on the list.`
        ),
        line(
          "relationship",
          `${name} says nothing and remembers it.`,
          trusted.delta
        ),
      ],
    };
  }

  if (action === "askAbout") {
    const q = QUIRKS[m.archetype];
    next = observe(next, {
      id: quirkId(memberId),
      day,
      source: name,
      text: `${name} ${q.quirk} Takes their coffee as ${q.coffee}.`,
    });
    return {
      ok: true,
      world: next,
      lines: [
        line("information", `${name} ${q.quirk}`),
        line(
          "relationship",
          `Noted. ${name} takes their coffee as ${q.coffee}.`
        ),
      ],
    };
  }

  // Cover: they take your last hour, and it costs you some of their goodwill.
  const trusted = adjustTrust(next, memberId, "cover");
  next = withBond(trusted.world, memberId, { coverDay: day });
  next = {
    ...next,
    overtime: Math.max(0, next.overtime - COVER_MINUTES),
    energy: clamp(next.energy + COVER_ENERGY, 0, 100),
  };
  return {
    ok: true,
    world: next,
    lines: [
      line(
        "opportunity",
        `${name} takes the last hour so you can stop. You get some of it back.`
      ),
      line(
        "relationship",
        `${name} will do it again, but not every week.`,
        trusted.delta
      ),
    ],
  };
}

/**
 * A word from the team member who trusts the player most, once they trust
 * them enough: which site is worth a look this week. It names a place, never
 * a number, and comes from the study's real state, which the dashboard may
 * not show. Null before day two or when nobody trusts the player yet.
 */
export function earlyWarning(world: WorldState): DigestLine | null {
  if (world.study.day < 2) return null;
  const trusted = [...world.study.team]
    .map((m) => ({ m, trust: bondFor(world, m.id).trust }))
    .filter((x) => x.trust >= TRUSTED_TRUST)
    .sort((a, b) => b.trust - a.trust || a.m.id.localeCompare(b.m.id))[0];
  if (!trusted) return null;
  const trouble = (s: WorldState["study"]["sites"][number]) =>
    s.openQueries + s.deviations + s.unsignedSource + s.eligibilityConcerns;
  const worst = [...world.study.sites].sort(
    (a, b) => trouble(b) - trouble(a) || a.id.localeCompare(b.id)
  )[0];
  if (!worst || trouble(worst) === 0) return null;
  return {
    text: `${trusted.m.name} has a feeling about ${worst.name}. Worth a look this week.`,
    tone: "neutral",
  };
}
