import { applyEffects, reportedSite } from "@/lib/study-director";
import { fnv1a } from "@/lib/utils/prng";
import { spendCost } from "./clock";
import { CRO_FLOOR, roomAt } from "./floor";
import { adjustTrust, placePeople } from "./team";
import type {
  ActionCost,
  GuestId,
  GuestOption,
  GuestRecord,
  GuestScene,
  OvernightLine,
  WorldResult,
  WorldState,
} from "../types";

/** How long a visitor waits in the conference room before they leave. */
const STAY_MINUTES = 90;
/** A site audited within this many days is one the player really knows. */
const KNOWN_WITHIN_DAYS = 14;
/** The gap between what a site holds and what the dashboard shows that counts as hiding. */
const HIDDEN_GAP = 3;
const MAX_RECORDS = 12;

interface Schedule {
  /** First day it can come, and how many days after that it may fall. */
  from: number;
  spread: number;
  /** Minutes after midnight. */
  at: number;
}

const SCHEDULE: Record<GuestId, Schedule> = {
  sponsorVisit: { from: 16, spread: 6, at: 14 * 60 },
  vendorMeeting: { from: 31, spread: 6, at: 10 * 60 + 30 },
};

const VISITORS: Record<GuestId, GuestScene["visitor"]> = {
  sponsorVisit: {
    name: "Imogen Vale",
    role: "VP of Clinical Operations",
    organisation: "Arcadia Therapeutics",
  },
  vendorMeeting: {
    name: "Colm Ibarra",
    role: "Account manager",
    organisation: "Halden Data Systems",
  },
};

/** The study day a visitor comes on: fixed by the seed, so a replay meets them on the same day. */
export function guestDay(seed: string, id: GuestId): number {
  const { from, spread } = SCHEDULE[id];
  return from + (fnv1a(`${seed}:guest:${id}`) % spread);
}

/** The visitors a given day brings, in the order they arrive. */
function dueToday(world: WorldState): GuestId[] {
  const { seed, day } = world.study;
  return (Object.keys(SCHEDULE) as GuestId[])
    .filter((id) => guestDay(seed, id) === day)
    .sort((a, b) => SCHEDULE[a].at - SCHEDULE[b].at);
}

function recordFor(world: WorldState, id: GuestId): GuestRecord | undefined {
  return (world.guests ?? []).find((g) => g.id === id);
}

/** A visitor who has arrived and not yet been seen or lost today, or null. */
function waiting(world: WorldState): GuestId | null {
  if (world.study.status !== "running" || world.location === "home")
    return null;
  return (
    dueToday(world).find(
      (id) =>
        !recordFor(world, id) &&
        world.minute >= SCHEDULE[id].at &&
        world.minute < SCHEDULE[id].at + STAY_MINUTES
    ) ?? null
  );
}

/** Whether a visitor is waiting in the conference room right now. */
export function guestWaiting(world: WorldState): boolean {
  return waiting(world) !== null;
}

const inConference = (world: WorldState): boolean =>
  !world.visit &&
  !world.meeting &&
  roomAt(CRO_FLOOR, world.player.x, world.player.y)?.id === "conference";

/**
 * The site the dashboard is quietest about while the study holds trouble
 * there, judged by what its coordinator normally reports: an audit lifts the
 * veil for the player, not for the sponsor's printout.
 */
function quietestTrouble(world: WorldState) {
  const unaudited = {
    ...world.study,
    sites: world.study.sites.map((s) => ({ ...s, lastAuditedDay: null })),
  };
  let worst: { id: string; name: string; gap: number } | null = null;
  for (const site of world.study.sites) {
    const shown = reportedSite(unaudited, site.id);
    if (!shown) continue;
    const gap =
      site.openQueries -
      shown.openQueries +
      (site.deviations - shown.deviations) * 2;
    if (gap >= HIDDEN_GAP && (!worst || gap > worst.gap))
      worst = { id: site.id, name: site.name, gap };
  }
  return worst;
}

/** Whether the player has audited that site recently enough to know what is behind its numbers. */
function knowsTheTruth(world: WorldState, siteId: string): boolean {
  const site = world.study.sites.find((s) => s.id === siteId);
  return (
    !!site &&
    site.lastAuditedDay !== null &&
    world.study.day - site.lastAuditedDay <= KNOWN_WITHIN_DAYS
  );
}

/** The data manager, if they are on the floor today. */
function dataManagerHere(world: WorldState) {
  const manager = world.study.team.find((m) => m.role === "dataManager");
  if (!manager) return null;
  const here = placePeople(world, CRO_FLOOR).some(
    (p) => p.memberId === manager.id
  );
  return here ? manager : null;
}

const cost = (minutes: number, energy = 0, focus = 0): ActionCost => ({
  minutes,
  energy,
  focus,
});

interface Choice {
  id: string;
  label: string;
  cost: ActionCost;
  /** Why the choice cannot be made, if it cannot. */
  blocked?: (world: WorldState) => string | null;
  /** The new world and what the player is told. */
  run: (world: WorldState) => { world: WorldState; result: string };
}

const needsManager = (world: WorldState): string | null =>
  dataManagerHere(world) ? null : "The data manager is not on the floor today.";

function sponsorChoices(): Choice[] {
  return [
    {
      id: "truth",
      label: "Walk her through what you have actually seen",
      cost: cost(60, 8, 8),
      run: (world) => {
        const trouble = quietestTrouble(world);
        const knows = trouble ? knowsTheTruth(world, trouble.id) : false;
        const [client, integrity, result] = !trouble
          ? [
              3,
              0,
              "There is nothing behind the dashboard that the dashboard did not say. A short, pleasant hour.",
            ]
          : knows
            ? [
                4,
                1,
                `You tell her what you found at ${trouble.name}, including the part you would rather not. She writes it down and underlines nothing.`,
              ]
            : [
                1,
                0,
                `You repeat the dashboard. She asks what is behind it at ${trouble.name}. You say you will find out. She writes that down.`,
              ];
        return {
          world: {
            ...world,
            study: applyEffects(world.study, { meters: { client, integrity } }),
          },
          result,
        };
      },
    },
    {
      id: "summary",
      label: "Give her the clean summary",
      cost: cost(25, 3, 3),
      run: (world) => {
        const trouble = quietestTrouble(world);
        return {
          world: {
            ...world,
            study: applyEffects(world.study, {
              meters: { client: 2, integrity: trouble ? -3 : 0 },
            }),
          },
          result: trouble
            ? `She is pleased. You know the summary is shorter than what ${trouble.name} is holding.`
            : "A clean summary of a clean picture. She is pleased and has nothing to circle.",
        };
      },
    },
    {
      id: "manager",
      label: "Hand her to the data manager",
      cost: cost(40, 2, 4),
      blocked: needsManager,
      run: (world) => {
        const manager = dataManagerHere(world);
        let next = world;
        if (manager) {
          next = {
            ...next,
            study: applyEffects(next.study, {
              workload: [{ memberId: manager.id, delta: 5 }],
              meters: { client: 3 },
            }),
          };
          next = adjustTrust(next, manager.id, "heard").world;
        }
        return {
          world: next,
          result: `${manager?.name ?? "The data manager"} shows her the listings and does not oversell them. She asks better questions of them than of you.`,
        };
      },
    },
    {
      id: "reschedule",
      label: "Apologise and ask for another day",
      cost: cost(5),
      run: (world) => ({
        world: {
          ...world,
          study: applyEffects(world.study, { meters: { client: -3 } }),
        },
        result:
          "She says of course, in a voice that means the opposite, and takes her chewed pen with her.",
      }),
    },
  ];
}

function vendorChoices(): Choice[] {
  return [
    {
      id: "audit",
      label: "Ask for the audit-trail walkthrough",
      cost: cost(45, 3, 6),
      run: (world) => ({
        world: {
          ...world,
          study: {
            ...applyEffects(world.study, { meters: { compliance: 2 } }),
            documentationDebt: Math.max(0, world.study.documentationDebt - 6),
          },
        },
        result:
          "Forty-five minutes on who changed what, and why it has to say so. You leave knowing which edits need a reason written next to them.",
      }),
    },
    {
      id: "renewal",
      label: "Negotiate the renewal",
      cost: cost(40, 4, 6),
      run: (world) => ({
        world: {
          ...world,
          study: applyEffects(world.study, { spend: -1500 }),
        },
        result:
          "He has a number he is allowed to give and a better one he is not. You find the better one.",
      }),
    },
    {
      id: "manager",
      label: "Send the data manager with your questions",
      cost: cost(15, 0, 2),
      blocked: needsManager,
      run: (world) => {
        const manager = dataManagerHere(world);
        let next = world;
        if (manager) {
          next = {
            ...next,
            study: applyEffects(next.study, {
              workload: [{ memberId: manager.id, delta: 6 }],
              meters: { compliance: 1 },
            }),
          };
          next = adjustTrust(next, manager.id, "heard").world;
        }
        return {
          world: next,
          result: `${manager?.name ?? "The data manager"} has been waiting a year to ask about the export format. Colm takes notes.`,
        };
      },
    },
    {
      id: "brochure",
      label: "Take the brochure and go",
      cost: cost(3),
      run: (world) => ({
        world,
        result: "He leaves a brochure. It is a good brochure.",
      }),
    },
  ];
}

const CHOICES: Record<GuestId, () => Choice[]> = {
  sponsorVisit: sponsorChoices,
  vendorMeeting: vendorChoices,
};

function bodyFor(world: WorldState, id: GuestId): string[] {
  const { study } = world;
  const who = VISITORS[id];
  if (id === "sponsorVisit") {
    const enrolled = study.sites.reduce((n, s) => n + s.enrolled, 0);
    const trouble = quietestTrouble(world);
    return [
      `${who.name} from ${who.organisation} is in the conference room with last month's dashboard printed out and a pen she has chewed.`,
      `It says ${enrolled} of ${study.setup.subjects} enrolled.`,
      trouble
        ? `She has circled ${trouble.name}. It looks quiet. She asks whether quiet is good.`
        : "She has circled nothing. She asks whether there is anything she should hear from you before she hears it from someone else.",
    ];
  }
  return [
    `${who.name} from ${who.organisation} is in the conference room with two slides and a list of open change requests for the EDC.`,
    study.documentationDebt > 20
      ? "He mentions, kindly, that the audit trail shows a lot of edits made without a reason. He does not say whose."
      : "He says the audit trail looks in good shape. He sounds almost disappointed.",
    "The contract renews next quarter. He would like to talk about that too.",
  ];
}

/**
 * The visitor waiting for the player, or null. A visitor comes on a day the
 * seed fixes, arrives at a fixed time and waits ninety minutes in the
 * conference room; the scene can only be played standing there.
 */
export function guestScene(world: WorldState): GuestScene | null {
  const id = waiting(world);
  if (!id) return null;
  const here = inConference(world);
  const options: GuestOption[] = CHOICES[id]().map((c) => {
    const blocked = c.blocked?.(world) ?? null;
    const reason = !here
      ? "Go to the conference room first."
      : blocked ||
        (world.energy < c.cost.energy ? "You are too tired for it." : null);
    return {
      id: c.id,
      label: c.label,
      cost: c.cost,
      available: !reason,
      ...(reason ? { reason } : {}),
    };
  });
  return {
    id,
    kicker: id === "sponsorVisit" ? "A visit" : "A meeting",
    title:
      id === "sponsorVisit"
        ? "The sponsor is in the conference room"
        : "The EDC vendor is in the conference room",
    visitor: VISITORS[id],
    arrivesAt: SCHEDULE[id].at,
    leavesAt: SCHEDULE[id].at + STAY_MINUTES,
    body: bodyFor(world, id),
    here,
    options,
  };
}

function remember(world: WorldState, record: GuestRecord): WorldState {
  return {
    ...world,
    guests: [...(world.guests ?? []), record].slice(-MAX_RECORDS),
  };
}

/** Spends the visit on one of the scene's options. */
export function meetGuest(
  world: WorldState,
  optionId: string
): WorldResult<{ result: string; guest: GuestId }> {
  const id = waiting(world);
  if (!id) return { ok: false, reason: "unknown-action" };
  if (!inConference(world)) return { ok: false, reason: "unreachable" };
  const choice = CHOICES[id]().find((c) => c.id === optionId);
  if (!choice || choice.blocked?.(world))
    return { ok: false, reason: "unknown-action" };
  const spent = spendCost(world, choice.cost);
  if (!spent.ok) return spent;
  const done = choice.run(spent.world);
  return {
    ok: true,
    world: remember(done.world, {
      id,
      day: world.study.day,
      outcome: "met",
      choice: choice.id,
    }),
    result: done.result,
    guest: id,
  };
}

/** What the day brought and what the player did about it, for the wrap-up. */
export function guestWrapUp(world: WorldState): OvernightLine[] {
  const lines: OvernightLine[] = [];
  for (const id of dueToday(world)) {
    const who = VISITORS[id];
    const record = recordFor(world, id);
    if (record?.outcome === "met")
      lines.push({
        text: `You met ${who.name} of ${who.organisation}.`,
        tone: "good",
      });
    else
      lines.push({
        text: `${who.name} of ${who.organisation} waited in the conference room and left.`,
        tone: "bad",
      });
  }
  return lines;
}

/**
 * Closes the day for visitors who came and were not seen: the sponsor takes
 * it as a snub and the vendor simply goes. Called as the player goes home.
 */
export function settleGuests(world: WorldState): {
  world: WorldState;
  lines: OvernightLine[];
} {
  let next = world;
  const lines: OvernightLine[] = [];
  for (const id of dueToday(world)) {
    if (recordFor(next, id)) continue;
    const who = VISITORS[id];
    next = remember(next, { id, day: world.study.day, outcome: "missed" });
    if (id === "sponsorVisit") {
      next = {
        ...next,
        study: applyEffects(next.study, { meters: { client: -4 } }),
      };
      lines.push({
        text: `${who.name} came to see the study and nobody met her. The sponsor noticed.`,
        tone: "bad",
      });
    } else {
      lines.push({
        text: `${who.name} of ${who.organisation} left a brochure at the front desk.`,
        tone: "neutral",
      });
    }
  }
  return { world: next, lines };
}
