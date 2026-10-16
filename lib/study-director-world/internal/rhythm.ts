import {
  applyEffects,
  getEvent,
  inbox,
  type Effects,
  type TeamRole,
} from "@/lib/study-director";
import { applyOfficeEffects } from "./goodwill";
import { clamp } from "@/lib/game-utils";
import { fnv1a } from "@/lib/utils/prng";
import { spendCost } from "./clock";
import { undocumentedDecisions } from "./dialogue";
import { guestWaiting, guestWrapUp } from "./guests";
import { adjustTrust, bondFor, personState } from "./team";
import { DAY_END, HISTORY_LIMIT } from "../types";
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

/** The study with some meter adjustments applied. */
function meters(
  world: WorldState,
  change: NonNullable<Effects["meters"]>
): WorldState {
  return { ...world, study: applyEffects(world.study, { meters: change }) };
}

/** More (or, negative, less) work for whoever holds a role on the team. */
function loadRole(
  world: WorldState,
  role: TeamRole,
  delta: number
): WorldState {
  const member = world.study.team.find((m) => m.role === role);
  return member
    ? {
        ...world,
        study: applyEffects(world.study, {
          workload: [{ memberId: member.id, delta }],
        }),
      }
    : world;
}

/** The site with the most open queries, if any have any. */
function loudestSite(world: WorldState) {
  const sorted = [...world.study.sites].sort(
    (a, b) => b.openQueries - a.openQueries
  );
  return sorted[0] && sorted[0].openQueries > 0 ? sorted[0] : null;
}

/**
 * Twenty-one small things that can land on a day. Each is a real choice with a cost
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
          study: applyOfficeEffects(w.study, { meters: { client: 2 } }),
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
    id: "badge",
    title: "A new starter is stuck at the door",
    body: "Someone in a lanyard that is not yet theirs is holding a box and waving at the badge reader. Reception has gone to lunch.",
    options: [
      {
        id: "show",
        label: "Let them in and show them round",
        cost: cost(15),
        result:
          "Kitchen, printer, the good chair. They will remember which of those you pointed out first.",
        apply: (w) => ({
          ...w,
          study: applyEffects(w.study, { meters: { team: 1 } }),
        }),
      },
      {
        id: "point",
        label: "Point them at reception",
        cost: cost(1),
        result: "Reception is at lunch. They wait by the box.",
      },
    ],
  },
  {
    id: "coffeeOut",
    title: "The coffee machine is out of beans",
    body: "A note on the machine says EMPTY in three different hands. Somebody has to order more, and everybody has decided it is somebody else.",
    options: [
      {
        id: "order",
        label: "Order the beans",
        cost: cost(5),
        result:
          "Two kilos, next-day delivery. The note gets a fourth line: thank you.",
        apply: (w) => meters(w, { team: 1 }),
      },
      {
        id: "note",
        label: "Add a line to the note",
        cost: cost(1),
        result: "Now it says EMPTY in four hands.",
      },
    ],
  },
  {
    id: "tearfulCoordinator",
    title: "A coordinator calls, close to tears",
    body: "The coordinator at the busiest site has three monitors' worth of findings and one afternoon. They want to know what matters first.",
    options: [
      {
        id: "listen",
        label: "Take the call and triage with them",
        cost: cost(20, 1, 4),
        result:
          "You pick the three things that matter. They write them on their hand.",
        apply: (w) => {
          const site = loudestSite(w);
          return site
            ? {
                ...w,
                study: applyEffects(w.study, {
                  sites: [{ siteId: site.id, burden: -2 }],
                }),
              }
            : w;
        },
      },
      {
        id: "pass",
        label: "Pass it to the monitor",
        cost: cost(2),
        result: "The monitor takes it. The monitor's afternoon is now theirs.",
        apply: (w) => loadRole(w, "monitor", 4),
      },
    ],
  },
  {
    id: "financeBurn",
    title: "Finance wants the burn explained",
    body: "Someone from finance is at your door with a printout. Spend is ahead of the plan and they would like a sentence they can put in a box.",
    options: [
      {
        id: "explain",
        label: "Walk them through it",
        cost: cost(20, 0, 5),
        result:
          "Pass-throughs, site start-up, one invoice nobody expected. The box gets its sentence.",
        apply: (w) => meters(w, { budget: 1 }),
      },
      {
        id: "spreadsheet",
        label: "Send them the spreadsheet",
        cost: cost(3),
        result:
          "They reply with a question about column K. There are forty columns.",
        apply: (w) => meters(w, { budget: -1 }),
      },
    ],
  },
  {
    id: "irbQuestion",
    title: "The IRB has a question about consent",
    body: "The review board wants to know why page four of the consent form uses a word the summary page does not.",
    options: [
      {
        id: "answer",
        label: "Answer it now",
        cost: cost(15, 0, 4),
        result:
          "One word, changed in two places, with a note saying why. The board says thank you in capitals.",
        apply: (w) => meters(w, { compliance: 2 }),
      },
      {
        id: "regulatory",
        label: "Flag it for regulatory",
        cost: cost(2),
        result:
          "It joins regulatory's list, near the top, below four other things near the top.",
        apply: (w) => loadRole(w, "regulatory", 4),
      },
    ],
  },
  {
    id: "birthday",
    title: "Cake for a birthday",
    body: "There is a cake in the break room with somebody's name on it in blue icing. The singing is about to start.",
    options: [
      {
        id: "sing",
        label: "Go and sing, badly",
        cost: cost(10),
        result:
          "You know the words. Everybody knows the words. The cake is mostly sugar and helps.",
        apply: (w) =>
          befriend(
            { ...w, energy: clamp(w.energy + 5, 0, 100) },
            leastTrusting(w, 2)
          ),
      },
      {
        id: "wave",
        label: "Wave from the doorway",
        cost: cost(1),
        result: "Somebody saves you a slice. It is the slice with no icing.",
      },
    ],
  },
  {
    id: "invoice",
    title: "An invoice that looks wrong",
    body: "A vendor invoice has arrived for a service you are fairly sure ended last month. It is due on Friday.",
    options: [
      {
        id: "check",
        label: "Check it line by line",
        cost: cost(20, 0, 6),
        result:
          "Two lines are for last month. You send it back with both circled.",
        apply: (w) => ({
          ...w,
          study: applyEffects(w.study, { spend: -1500 }),
        }),
      },
      {
        id: "approve",
        label: "Approve it and move on",
        cost: cost(1),
        result: "Paid. It is the vendor's best month.",
        apply: (w) => ({ ...w, study: applyEffects(w.study, { spend: 1500 }) }),
      },
    ],
  },
  {
    id: "laptopUpdate",
    title: "Your laptop wants to restart",
    body: "A box in the corner of the screen says updates are ready. It has said so since Tuesday, and the box is getting bigger.",
    options: [
      {
        id: "restart",
        label: "Let it restart",
        cost: cost(15),
        result:
          "Fifteen minutes of a spinning circle. Everything opens faster afterwards.",
        apply: (w) => ({ ...w, focus: clamp(w.focus + 5, 0, 100) }),
      },
      {
        id: "postpone",
        label: "Postpone it again",
        cost: cost(0),
        result: "The box comes back every ten minutes for the rest of the day.",
        apply: (w) => ({ ...w, focus: clamp(w.focus - 4, 0, 100) }),
      },
    ],
  },
  {
    id: "monitoringReport",
    title: "A monitoring report needs your signature",
    body: "Thirty pages from last week's visit, with a sign-off box on the last one. The monitor would like it back today.",
    options: [
      {
        id: "read",
        label: "Read it properly first",
        cost: cost(25, 0, 5),
        result:
          "Page nineteen has a finding nobody escalated. You escalate it and then you sign.",
        apply: (w) => meters(w, { integrity: 1 }),
      },
      {
        id: "sign",
        label: "Sign the last page",
        cost: cost(2),
        result:
          "Signed. Page nineteen will come up again, in somebody else's report.",
        apply: (w) => meters(w, { compliance: -1 }),
      },
    ],
  },
  {
    id: "courier",
    title: "The lab courier is at reception",
    body: "A courier with a cool box needs a signature for the sample shipment. The shipping log is two floors of paperwork away.",
    options: [
      {
        id: "log",
        label: "Check the shipping log first",
        cost: cost(10),
        result:
          "One tube number does not match. Fixed before it leaves the building.",
        apply: (w) => meters(w, { integrity: 1 }),
      },
      {
        id: "sign",
        label: "Sign for it",
        cost: cost(1),
        result:
          "The van leaves. The lab will tell you about tube 14 in a fortnight.",
        apply: (w) => meters(w, { integrity: -1 }),
      },
    ],
  },
  {
    id: "meetingAboutMeetings",
    title: "A meeting about meetings",
    body: "An invitation arrives for this afternoon: a review of the recurring meetings, to see which ones could be an email.",
    options: [
      {
        id: "go",
        label: "Go and argue for fewer",
        cost: cost(30, 1),
        result:
          "Two standing meetings are cancelled. The team gets back an hour a week.",
        apply: (w) => meters(w, { team: 1 }),
      },
      {
        id: "decline",
        label: "Decline, politely",
        cost: cost(1),
        result: "Declined. The meeting about meetings runs long without you.",
      },
    ],
  },
  {
    id: "protocolVersion",
    title: "A new protocol version arrives",
    body: "The sponsor has sent version 4.2 with a tracked-changes copy. The summary of changes says minor.",
    options: [
      {
        id: "read",
        label: "Read the tracked changes now",
        cost: cost(20, 0, 5),
        result:
          "Minor, except the visit window, which is now two days shorter. You tell the sites.",
        apply: (w) => meters(w, { integrity: 1 }),
      },
      {
        id: "later",
        label: "Trust the summary",
        cost: cost(1),
        result:
          "Minor. The visit window will introduce itself at the next monitoring visit.",
        apply: (w) => meters(w, { integrity: -1 }),
      },
    ],
  },
  {
    id: "internQuestion",
    title: "The intern has a question",
    body: "The summer intern is hovering with a notebook. They want to know why a query gets closed if the answer is still wrong.",
    options: [
      {
        id: "explain",
        label: "Explain it properly",
        cost: cost(15),
        result:
          "You draw it on the whiteboard. Halfway through you realise you are explaining it to yourself.",
        apply: (w) => befriend(meters(w, { team: 1 }), leastTrusting(w, 1)),
      },
      {
        id: "sop",
        label: "Point them at the SOP",
        cost: cost(1),
        result:
          "The SOP is a hundred and forty pages. They come back tomorrow with eleven questions.",
      },
    ],
  },
  {
    id: "secondEyes",
    title: "The data manager wants a second pair of eyes",
    body: "A listing looks odd and the data manager would like somebody else to look before it goes to the sites.",
    options: [
      {
        id: "look",
        label: "Look it over together",
        cost: cost(15, 0, 3),
        result:
          "It is a sorting error, not a data error. Caught before forty queries went out.",
        apply: (w) => loadRole(w, "dataManager", -3),
      },
      {
        id: "later",
        label: "Not now",
        cost: cost(1),
        result:
          "It goes out as it is. The replies arrive by the end of the week.",
        apply: (w) => loadRole(w, "dataManager", 2),
      },
    ],
  },
  {
    id: "tmfTracker",
    title: "The TMF tracker turned red",
    body: "The trial master file tracker has a red row: a site's delegation log expired and nobody has the new one.",
    options: [
      {
        id: "chase",
        label: "Chase the site for it now",
        cost: cost(15, 0, 3),
        result: "The site had it all along, in a drawer. It is filed by four.",
        apply: (w) => meters(w, { compliance: 1 }),
      },
      {
        id: "friday",
        label: "Note it for Friday",
        cost: cost(1),
        result: "Friday has a lot of notes on it.",
        apply: (w) => meters(w, { compliance: -1 }),
      },
    ],
  },
  {
    id: "doubleBooked",
    title: "Two sites booked the same monitor",
    body: "Two sites have each confirmed a visit from the monitor on the same Thursday, two hundred miles apart.",
    options: [
      {
        id: "sort",
        label: "Sort the schedule yourself",
        cost: cost(15, 0, 4),
        result:
          "One visit moves a week. Both sites say that works, which is not the same as it working.",
        apply: (w) => loadRole(w, "monitor", -2),
      },
      {
        id: "leave",
        label: "Let them work it out",
        cost: cost(1),
        result: "They work it out by email, copying you, eleven times.",
        apply: (w) => loadRole(w, "monitor", 4),
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

/** How long an interruption waits for an answer before it lapses (#2189). */
export const INTERRUPTION_WINDOW = 90;

/** Interruptions that only make sense in the middle of the day. */
const MIDDAY = new Set(["lunch"]);

/** The catalog in the order this seed works through it. */
function rotation(seed: string): Catalogued[] {
  return [...CATALOG].sort(
    (a, b) => fnv1a(`${seed}:rhythm:${a.id}`) - fnv1a(`${seed}:rhythm:${b.id}`)
  );
}

/**
 * Three distinct interruptions for the day. Each seed works through the
 * whole catalog in its own order, three a day, so none comes back within a
 * week (#2189: six of them repeated from the second week); lunch always
 * takes the midday slot.
 */
export function scheduleFor(world: WorldState): ScheduledInterruption[] {
  const { seed, day } = world.study;
  const order = rotation(seed);
  const per = INTERRUPTION_TIMES.length;
  const first = (Math.max(0, day - 1) * per) % order.length;
  const picked = INTERRUPTION_TIMES.map(
    (_, i) => order[(first + i) % order.length]
  );
  const midday = picked.findIndex((e) => MIDDAY.has(e.id));
  if (midday >= 0 && midday !== 1)
    [picked[1], picked[midday]] = [picked[midday], picked[1]];
  return picked.map((entry, i) => ({
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

/** Dealt with, or excused because it came while the player was away. */
function settled(world: WorldState, id: string): boolean {
  const plan = planFor(world);
  return plan.handled.includes(id) || (plan.excused ?? []).includes(id);
}

/**
 * The interruption waiting for an answer: the first of today's that has
 * arrived, has not lapsed and has not been dealt with. Nothing arrives
 * while the player is at a site, in a meeting, with a visitor waiting, or
 * has gone home.
 */
export function pendingInterruption(world: WorldState): Interruption | null {
  if (world.study.status !== "running" || world.location === "home")
    return null;
  if (world.visit || world.meeting || guestWaiting(world)) return null;
  const due = scheduleFor(world).find(
    (s) =>
      s.at <= world.minute &&
      world.minute < s.at + INTERRUPTION_WINDOW &&
      !settled(world, s.interruption.id)
  );
  return due?.interruption ?? null;
}

/**
 * Back from a site, a meeting or a visitor: what came up while you were away
 * is excused, so it is neither held against you overnight nor stacked up on
 * your return. Only the latest one that is still waiting is kept (#2189).
 */
export function excuseAway(world: WorldState): WorldState {
  return excuseInterruptions(world, true);
}

/**
 * Going home while still away, from a site or out of a meeting: nothing that
 * came up in the meantime was ever in front of the player, so all of it is
 * excused and the wrap-up does not blame them for it (#2254). Anywhere else
 * the world is unchanged.
 */
export function excuseGoingHome(world: WorldState): WorldState {
  return world.visit || world.meeting
    ? excuseInterruptions(world, false)
    : world;
}

function excuseInterruptions(
  world: WorldState,
  keepWaiting: boolean
): WorldState {
  const plan = planFor(world);
  const arrived = scheduleFor(world).filter(
    (s) => s.at <= world.minute && !settled(world, s.interruption.id)
  );
  const last = arrived[arrived.length - 1];
  const keep =
    keepWaiting && last && world.minute < last.at + INTERRUPTION_WINDOW
      ? last.interruption.id
      : null;
  const excused = arrived
    .map((s) => s.interruption.id)
    .filter((id) => id !== keep);
  if (excused.length === 0) return world;
  return {
    ...world,
    plan: { ...plan, excused: [...(plan.excused ?? []), ...excused] },
  };
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
  const work = workDoneToday(world);
  lines.push({
    text:
      today.length > 0
        ? `You decided ${plural(today.length, "thing")} today.`
        : work.length > 0
          ? "No decisions today."
          : "You decided nothing today.",
    tone: "neutral",
  });
  // Work that is not a decision still counts: a day at the EDC or out at
  // the sites read as a day of nothing (#2253).
  if (work.length > 0)
    lines.push({
      text: `${today.length > 0 ? "You also" : "You"} ${list(work)}.`,
      tone: "good",
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
    if (s.at > world.minute || settled(world, s.interruption.id)) continue;
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
  lines.push(...guestWrapUp(world));
  lines.push(...priorityOutcome(world, unwritten));
  return lines;
}

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * The work the player did today that is not a decision: queries closed at
 * the EDC, sites visited and meetings held, each as a phrase for the
 * wrap-up ("closed 15 queries at the EDC").
 */
function workDoneToday(world: WorldState): string[] {
  const day = world.study.day;
  const work: string[] = [];
  const closed = planFor(world).queriesClosed ?? 0;
  if (closed > 0)
    work.push(`closed ${plural(closed, "query", "queries")} at the EDC`);
  const sites = new Set(
    (world.siteVisitHistory ?? [])
      .filter((r) => r.day === day)
      .map((r) => r.siteId)
  );
  if (world.visit?.day === day) sites.add(world.visit.siteId);
  if (sites.size > 0) {
    const names = [...sites].map(
      (id) => world.study.sites.find((s) => s.id === id)?.name ?? id
    );
    work.push(`visited ${list(names)}`);
  }
  const meetings = (world.meetingHistory ?? []).filter(
    (m) => m.day === day
  ).length;
  if (meetings > 0) work.push(`held ${plural(meetings, "meeting")}`);
  return work;
}

/** True when the player, not the team, decided something today. */
function decidedToday(world: WorldState): boolean {
  return world.study.log.some(
    (r) =>
      r.day === world.study.day &&
      r.optionId !== "ignored" &&
      r.optionId !== "audit" &&
      !r.delegated
  );
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
    // Only a visit counts: hearing about a site from the team is not
    // looking at it yourself (#1936).
    const looked =
      world.visit?.day === day ||
      (world.siteVisitHistory ?? []).some((r) => r.day === day);
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
  if (!decidedToday(world))
    return [
      {
        text:
          (planFor(world).queriesClosed ?? 0) > 0
            ? `${label}: no decisions to write up, and you worked the query queue. Nothing to keep.`
            : `${label}: nothing crossed the desk today. Nothing to keep.`,
        tone: "neutral",
      },
    ];
  return unwritten === 0
    ? [{ text: `${label}: every decision is written up. Kept.`, tone: "good" }]
    : [{ text: `${label}: the desk is not clear. Not kept.`, tone: "bad" }];
}

/** True when the player looked at a site themselves today. */
function visitedToday(world: WorldState, siteId: string): boolean {
  const day = world.study.day;
  return (
    (world.visit?.day === day && world.visit.siteId === siteId) ||
    (world.siteVisitHistory ?? []).some(
      (r) => r.day === day && r.siteId === siteId
    )
  );
}

/**
 * Ways to say a site sent nothing overnight. The one line repeated on every
 * Keep-the-sites day (#2253), so the night picks one by the day.
 */
const QUIET_SITE_LINES: ReadonlyArray<(name: string) => string> = [
  (name) => `${name} sent nothing overnight. Quiet is not the same as fine.`,
  (name) => `Nothing from ${name} overnight. No news is not good news.`,
  (name) => `${name} stayed silent overnight. Somebody should go and look.`,
  (name) =>
    `Still no word from ${name}. The dashboard only knows what it is told.`,
];

/** The second half of a quiet-streak line, rotated by the day. */
const QUIET_STREAK_TAILS: readonly string[] = [
  "Quiet is not the same as fine.",
  "No news is not good news.",
  "Somebody should go and look.",
  "The dashboard only knows what it is told.",
];

/**
 * Nights a site has gone without anyone standing in it, counting tonight:
 * since the player's last visit, or since the study began when nobody has
 * gone (#2288). Read from saved state, so a reload or a replay of the same
 * seed counts the same. When the trimmed visit history no longer reaches
 * back to this site, the count starts at the oldest visit it still holds.
 */
function quietNights(
  world: WorldState,
  siteId: string
): { nights: number; since: "visit" | "start" | "trimmed" } {
  const history = world.siteVisitHistory ?? [];
  const days = history.filter((r) => r.siteId === siteId).map((r) => r.day);
  if (world.visit?.siteId === siteId) days.push(world.visit.day);
  const since =
    days.length > 0
      ? "visit"
      : history.length >= HISTORY_LIMIT
        ? "trimmed"
        : "start";
  const last =
    since === "visit"
      ? Math.max(...days)
      : since === "trimmed"
        ? Math.min(...history.map((r) => r.day))
        : 0;
  return { nights: Math.max(1, world.study.day - last), since };
}

/**
 * The quiet-site line. A first quiet night rotates its wording; from the
 * second night on it says how long the site has been quiet, which is what
 * the player can act on (#2288).
 */
function quietSiteLine(
  world: WorldState,
  name: string,
  siteId: string,
  turn: number
): string {
  const { nights, since } = quietNights(world, siteId);
  if (nights < 2) return QUIET_SITE_LINES[turn % QUIET_SITE_LINES.length](name);
  const span = {
    visit: `for ${nights} nights since you last looked`,
    start: `for ${nights} nights since the study began`,
    trimmed: `for at least ${nights} nights`,
  }[since];
  return `${name} has been quiet ${span}. ${
    QUIET_STREAK_TAILS[turn % QUIET_STREAK_TAILS.length]
  }`;
}

/**
 * What the chosen priority adds to the night. People: how the team looked
 * when you left, said only when you stayed to the end of the day yourself.
 * Sites: which site sent nothing, leaving out a site you visited today.
 * Desk: a clear desk earns a point of compliance. Returns the world with any
 * effect applied. Pass `delegated` when the team ran the day without the
 * player, who then saw nobody at their desk.
 */
export function settlePriority(
  world: WorldState,
  options: { delegated?: boolean } = {}
): {
  world: WorldState;
  lines: OvernightLine[];
} {
  const { priority } = planFor(world);
  if (!priority) return { world, lines: [] };
  const lines: OvernightLine[] = [];
  if (priority === "people" && (options.delegated || world.minute < DAY_END)) {
    lines.push({
      text: options.delegated
        ? "You were not in today, so you did not see who stayed late."
        : "You left before the end of the day, so you did not see who stayed late.",
      tone: "neutral",
    });
    return { world, lines };
  }
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
    const silent = world.study.sites.filter(
      (s) => s.coordinator === "invisible"
    );
    // A site the player stood in today did not send nothing: they saw it.
    const seen = silent.filter((s) => visitedToday(world, s.id));
    const quiet = silent.filter((s) => !visitedToday(world, s.id));
    if (silent.length === 0)
      lines.push({ text: "Every site checked in overnight.", tone: "good" });
    if (seen.length > 0 && quiet.length === 0)
      lines.push({
        text: `You saw ${seen.map((s) => s.name).join(" and ")} yourself today.`,
        tone: "neutral",
      });
    for (const s of quiet)
      lines.push({
        text: quietSiteLine(
          world,
          s.name,
          s.id,
          world.study.day + silent.indexOf(s)
        ),
        tone: "neutral",
      });
    return { world, lines };
  }
  // A clear desk earns its point only on a day something was decided: an
  // empty day paid compliance for nothing (#2190).
  if (!decidedToday(world)) return { world, lines };
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
