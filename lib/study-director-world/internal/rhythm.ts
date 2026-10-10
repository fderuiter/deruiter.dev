import { applyEffects, getEvent, inbox } from "@/lib/study-director";
import { clamp } from "@/lib/game-utils";
import { fnv1a } from "@/lib/utils/prng";
import { spendCost } from "./clock";
import { undocumentedDecisions } from "./dialogue";
import { adjustTrust, bondFor, personState } from "./team";
import type {
  ActionCost,
  DayPlan,
  Interruption,
  OvernightLine,
  PriorityId,
  ScheduledInterruption,
  WorldResult,
  WorldState,
} from "../types";

// ---------------------------------------------------------------------------
// Priorities (#1837).

/** What each priority is called and what it promises the player. */
export const PRIORITIES: Record<
  PriorityId,
  { label: string; promise: string }
> = {
  people: {
    label: "Be with the team",
    promise:
      "Every kind act earns a little more trust today. You will hear in the morning how everyone is holding up.",
  },
  sites: {
    label: "Keep the sites moving",
    promise:
      "Overnight you will learn which site has gone quiet, and quiet is not always fine.",
  },
  desk: {
    label: "Clear the desk",
    promise:
      "Write up every decision you make. A clear desk at the end of the day is worth a point of compliance.",
  },
};

/** A day's plan before anything has been chosen. */
const EMPTY_PLAN = (day: number): DayPlan => ({
  day,
  priority: null,
  handled: [],
});

/** Today's plan: the saved one, or a fresh one with no priority chosen. */
export function planFor(world: WorldState): DayPlan {
  const day = world.study.day;
  return world.plan?.day === day ? world.plan : EMPTY_PLAN(day);
}

/**
 * Chooses today's priority. It is a promise, so it can be made once a day:
 * choosing again, or after the day has started to go wrong, changes nothing.
 */
export function choosePriority(
  world: WorldState,
  priority: PriorityId
): WorldResult<{ changed: boolean }> {
  if (world.study.status !== "running")
    return { ok: false, reason: "study-complete" };
  const plan = planFor(world);
  if (plan.priority) return { ok: true, world, changed: false };
  return {
    ok: true,
    world: { ...world, plan: { ...plan, priority } },
    changed: true,
  };
}

// ---------------------------------------------------------------------------
// Interruptions and midday choices (#1837).

interface Choice {
  id: string;
  label: string;
  cost: ActionCost;
  result: string;
  apply?: (world: WorldState) => WorldState;
}

interface Catalogued extends Omit<Interruption, "options"> {
  options: Choice[];
}

const cost = (minutes: number, energy = 0, focus = 0): ActionCost => ({
  minutes,
  energy,
  focus,
});

/** The team members who most need a kind word today: the least trusting first. */
function leastTrusting(world: WorldState, count: number): string[] {
  return [...world.study.team]
    .sort(
      (a, b) =>
        bondFor(world, a.id).trust - bondFor(world, b.id).trust ||
        a.id.localeCompare(b.id)
    )
    .slice(0, count)
    .map((m) => m.id);
}

function befriend(world: WorldState, ids: readonly string[]): WorldState {
  let next = world;
  for (const id of ids) next = adjustTrust(next, id, "heard").world;
  return next;
}

/** The site with the most open queries, if any have any. */
function loudestSite(world: WorldState) {
  const sorted = [...world.study.sites].sort(
    (a, b) => b.openQueries - a.openQueries
  );
  return sorted[0] && sorted[0].openQueries > 0 ? sorted[0] : null;
}

/**
 * Six small things that can land on a day. Each is a real choice with a cost
 * in time, and each is original, plain and a little dry (ADR 0016). The
 * effects are small on purpose: an interruption bends a day, it does not
 * decide a study.
 */
const CATALOG: readonly Catalogued[] = [
  {
    id: "lunch",
    title: "Lunch in the kitchen",
    body: "The team is heading to the kitchen with food. There is a chair free at the end of the table.",
    options: [
      {
        id: "join",
        label: "Sit with them",
        cost: cost(45),
        result:
          "Forty-five minutes, none of it about the study. People remember who sat down.",
        apply: (w) =>
          befriend(
            { ...w, energy: clamp(w.energy + 10, 0, 100) },
            leastTrusting(w, 3)
          ),
      },
      {
        id: "desk",
        label: "Eat at your desk",
        cost: cost(10, 0, 4),
        result: "You eat over the keyboard and lose the thread twice.",
      },
    ],
  },
  {
    id: "sponsorPing",
    title: "The sponsor wants a status line",
    body: "A message from the sponsor: could you send a quick line before the afternoon, just so they know where things are.",
    options: [
      {
        id: "write",
        label: "Write an honest update",
        cost: cost(15, 1, 5),
        result: "Short, plain, and true. The sponsor writes back: thank you.",
        apply: (w) => ({
          ...w,
          study: applyEffects(w.study, { meters: { client: 2 } }),
        }),
      },
      {
        id: "later",
        label: "Say you will send it tomorrow",
        cost: cost(2),
        result: "Tomorrow suits them fine. They notice it is tomorrow.",
        apply: (w) => ({
          ...w,
          study: applyEffects(w.study, { meters: { client: -2 } }),
        }),
      },
    ],
  },
  {
    id: "printer",
    title: "The printer is jammed again",
    body: "There is a queue at the printer and nobody is touching it. The signature pages for the binder are in there.",
    options: [
      {
        id: "fix",
        label: "Clear the jam yourself",
        cost: cost(10, 1, 2),
        result: "Toner on both hands. The queue says nothing and means thanks.",
        apply: (w) => ({
          ...w,
          study: applyEffects(w.study, { meters: { team: 1 } }),
        }),
      },
      {
        id: "walk",
        label: "Walk past",
        cost: cost(0),
        result: "Someone else will. Nobody does for a while.",
        apply: (w) => ({
          ...w,
          study: applyEffects(w.study, { meters: { team: -1 } }),
        }),
      },
    ],
  },
  {
    id: "queryPile",
    title: "A pile of queries on one form",
    body: "Overnight a single form produced a run of queries. The sites will each get the same note unless someone sorts it first.",
    options: [
      {
        id: "batch",
        label: "Have the data manager batch them",
        cost: cost(5, 0, 2),
        result:
          "One note instead of a dozen. It costs the data manager an hour.",
        apply: (w) => {
          const site = loudestSite(w);
          const manager = w.study.team.find((m) => m.role === "dataManager");
          return {
            ...w,
            study: applyEffects(w.study, {
              sites: site ? [{ siteId: site.id, openQueries: -3 }] : [],
              workload: manager ? [{ memberId: manager.id, delta: 5 }] : [],
            }),
          };
        },
      },
      {
        id: "forward",
        label: "Forward them to the sites as they are",
        cost: cost(5, 0, 1),
        result:
          "Quick. A couple of sites reply that this is the third form this week.",
        apply: (w) => {
          const site = loudestSite(w);
          return {
            ...w,
            study: applyEffects(w.study, {
              sites: site
                ? [{ siteId: site.id, openQueries: -1, burden: 2 }]
                : [],
            }),
          };
        },
      },
    ],
  },
  {
    id: "fireDrill",
    title: "Fire drill",
    body: "The alarm goes at a quarter to the hour. The building empties onto the car park; the sheet on the wall says someone should hold the door.",
    options: [
      {
        id: "lead",
        label: "Hold the door and count heads",
        cost: cost(20),
        result: "Everyone is out in four minutes. The warden shakes your hand.",
        apply: (w) => ({
          ...w,
          study: applyEffects(w.study, { meters: { team: 1 } }),
        }),
      },
      {
        id: "stay",
        label: "Stay at your desk",
        cost: cost(0),
        result: "You finish the paragraph. The warden writes your name down.",
        apply: (w) => ({
          ...w,
          study: applyEffects(w.study, { meters: { compliance: -1 } }),
        }),
      },
    ],
  },
  {
    id: "vendor",
    title: "A vendor wants twenty minutes",
    body: "A sales rep from the EDC vendor is in the lobby with a laptop and a tote bag. They say it will not take long.",
    options: [
      {
        id: "demo",
        label: "Take the demo",
        cost: cost(25, 1, 5),
        result:
          "They offer a discount on an add-on you would have bought anyway.",
        apply: (w) => ({
          ...w,
          study: applyEffects(w.study, { meters: { budget: 1 } }),
        }),
      },
      {
        id: "decline",
        label: "Decline politely",
        cost: cost(1),
        result: "They leave a pen. It is a good pen.",
      },
    ],
  },
];

/** Minutes after midnight at which a day's three interruptions arrive. */
export const INTERRUPTION_TIMES = [
  10 * 60,
  12 * 60 + 45,
  15 * 60 + 30,
] as const;

/** Three distinct interruptions for the day, in an order fixed by the seed. */
export function scheduleFor(world: WorldState): ScheduledInterruption[] {
  const { seed, day } = world.study;
  return [...CATALOG]
    .sort(
      (a, b) =>
        fnv1a(`${seed}:rhythm:${day}:${a.id}`) -
        fnv1a(`${seed}:rhythm:${day}:${b.id}`)
    )
    .slice(0, INTERRUPTION_TIMES.length)
    .map((entry, i) => ({
      at: INTERRUPTION_TIMES[i],
      interruption: {
        id: entry.id,
        title: entry.title,
        body: entry.body,
        options: entry.options.map(({ id, label, cost: c, result }) => ({
          id,
          label,
          cost: c,
          result,
        })),
      },
    }));
}

/**
 * The interruption waiting for an answer: the first of today's that has
 * arrived and not been dealt with. Nothing arrives while the player is at a
 * site, in a meeting, or has gone home.
 */
export function pendingInterruption(world: WorldState): Interruption | null {
  if (world.study.status !== "running" || world.location === "home")
    return null;
  if (world.visit || world.meeting) return null;
  const handled = planFor(world).handled;
  const due = scheduleFor(world).find(
    (s) => s.at <= world.minute && !handled.includes(s.interruption.id)
  );
  return due?.interruption ?? null;
}

/**
 * Answers the pending interruption with one of its options. The option's
 * cost is paid first (and can be refused for time or energy); then its
 * effects land and it is marked as dealt with.
 */
export function answerInterruption(
  world: WorldState,
  optionId: string
): WorldResult<{ result: string }> {
  const pending = pendingInterruption(world);
  if (!pending) return { ok: false, reason: "unknown-action" };
  const entry = CATALOG.find((c) => c.id === pending.id);
  const choice = entry?.options.find((o) => o.id === optionId);
  if (!entry || !choice) return { ok: false, reason: "unknown-action" };
  const spent = spendCost(world, choice.cost);
  if (!spent.ok) return spent;
  let next = spent.world;
  if (choice.apply) next = choice.apply(next);
  const plan = planFor(next);
  next = {
    ...next,
    plan: { ...plan, handled: [...plan.handled, pending.id] },
  };
  return { ok: true, world: next, result: choice.result };
}

// ---------------------------------------------------------------------------
// The evening wrap-up and what the priority reveals overnight (#1837).

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** Team members the player spent time with today, by any kind of contact. */
export function peopleSeenToday(world: WorldState): number {
  const day = world.study.day;
  return world.study.team.filter((m) => {
    const b = bondFor(world, m.id);
    return [b.talkedDay, b.coachedDay, b.askedDay, b.coffeeDay, b.favourDay]
      .filter((d): d is number => typeof d === "number")
      .includes(day);
  }).length;
}

/** People the player must have seen for a "people" day to count as kept. */
export const PEOPLE_DAY_TARGET = 3;

/**
 * What the day came to, for the player to read before they go home: what
 * they decided, what is still open, how the interruptions went and whether
 * they kept the priority they chose. Built only from what the player did.
 */
export function eveningWrapUp(world: WorldState): OvernightLine[] {
  const { study } = world;
  const lines: OvernightLine[] = [];
  const today = study.log.filter(
    (r) =>
      r.day === study.day && r.optionId !== "ignored" && getEvent(r.eventId)
  );
  lines.push({
    text:
      today.length === 0
        ? "You decided nothing today."
        : `You decided ${plural(today.length, "thing")} today.`,
    tone: "neutral",
  });
  const unwritten = undocumentedDecisions(study).length;
  if (unwritten > 0)
    lines.push({
      text: `${plural(unwritten, "decision")} still not written up.`,
      tone: "bad",
    });
  const waiting = inbox(study).length;
  lines.push({
    text:
      waiting === 0
        ? "The inbox is clear."
        : `${plural(waiting, "message")} still waiting on you.`,
    tone: waiting === 0 ? "good" : "bad",
  });
  const plan = planFor(world);
  for (const s of scheduleFor(world)) {
    if (s.at > world.minute || plan.handled.includes(s.interruption.id))
      continue;
    lines.push({
      text: `You let "${s.interruption.title}" go unanswered.`,
      tone: "bad",
    });
  }
  const answered = plan.handled.length;
  if (answered > 0)
    lines.push({
      text: `You dealt with ${plural(answered, "interruption")}.`,
      tone: "neutral",
    });
  lines.push(...priorityOutcome(world, unwritten));
  return lines;
}

function priorityOutcome(
  world: WorldState,
  unwritten: number
): OvernightLine[] {
  const { priority } = planFor(world);
  if (!priority) return [];
  const label = PRIORITIES[priority].label;
  if (priority === "people") {
    const seen = peopleSeenToday(world);
    return seen >= PEOPLE_DAY_TARGET
      ? [
          {
            text: `${label}: you spent time with ${seen} of the team. Kept.`,
            tone: "good",
          },
        ]
      : [
          {
            text: `${label}: you only got to ${seen}. Not kept.`,
            tone: "bad",
          },
        ];
  }
  if (priority === "sites") {
    const day = world.study.day;
    const looked = (world.observations ?? []).some(
      (o) => o.day === day && o.siteId
    );
    return looked
      ? [
          {
            text: `${label}: you looked at a site yourself. Kept.`,
            tone: "good",
          },
        ]
      : [
          {
            text: `${label}: you never looked at a site yourself. Not kept.`,
            tone: "bad",
          },
        ];
  }
  return unwritten === 0
    ? [{ text: `${label}: every decision is written up. Kept.`, tone: "good" }]
    : [{ text: `${label}: the desk is not clear. Not kept.`, tone: "bad" }];
}

/**
 * What the chosen priority adds to the night. People: how the team looked
 * when you left. Sites: which site sent nothing. Desk: a clear desk earns a
 * point of compliance. Returns the world with any effect applied.
 */
export function settlePriority(world: WorldState): {
  world: WorldState;
  lines: OvernightLine[];
} {
  const { priority } = planFor(world);
  if (!priority) return { world, lines: [] };
  const lines: OvernightLine[] = [];
  if (priority === "people") {
    const stretched = world.study.team.filter(
      (m) => personState(world, m.id)?.mood === "overloaded"
    );
    if (stretched.length === 0)
      lines.push({ text: "Everyone went home on time.", tone: "good" });
    for (const m of stretched)
      lines.push({
        text: `${m.name} was still at their desk when you left.`,
        tone: "bad",
      });
    return { world, lines };
  }
  if (priority === "sites") {
    const quiet = world.study.sites.filter(
      (s) => s.coordinator === "invisible"
    );
    if (quiet.length === 0)
      lines.push({ text: "Every site checked in overnight.", tone: "good" });
    for (const s of quiet)
      lines.push({
        text: `${s.name} sent nothing overnight. Quiet is not the same as fine.`,
        tone: "neutral",
      });
    return { world, lines };
  }
  if (undocumentedDecisions(world.study).length === 0) {
    lines.push({
      text: "The desk was clear: compliance is up a point.",
      tone: "good",
    });
    return {
      world: {
        ...world,
        study: applyEffects(world.study, { meters: { compliance: 1 } }),
      },
      lines,
    };
  }
  lines.push({
    text: "Decisions left unwritten overnight. The record has gaps.",
    tone: "bad",
  });
  return { world, lines };
}
