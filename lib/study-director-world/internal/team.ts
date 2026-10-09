import {
  getEvent,
  inbox,
  phaseForDay,
  type MemberArchetype,
  type Phase,
  type StudyEvent,
  type StudyState,
  type TeamMember,
  type TeamRole,
} from "@/lib/study-director";
import { uniformAt } from "@/lib/utils/prng";
import { clamp } from "@/lib/game-utils";
import { CRO_FLOOR, isWalkable, roomAt, stepFrom } from "./floor";
import { facingToward } from "./movement";
import { workHours } from "./dressing";
import { placeTeam } from "./people";
import {
  DAY_START,
  type Bond,
  type DaySchedule,
  type Facing,
  type Mood,
  type Observation,
  type PersonActivity,
  type PersonPlacement,
  type PersonState,
  type RelationshipCard,
  type RoomId,
  type ScheduleBlock,
  type TilePoint,
  type TrustCause,
  type WorkStream,
  type WorldMap,
  type WorldState,
} from "../types";

/** Clock minutes one tile of walking takes a member: four tiles a minute. */
const TILES_PER_MINUTE = 4;

/** The stream each role can own. */
export const STREAM_FOR_ROLE: Record<TeamRole, WorkStream> = {
  dataManager: "queries",
  monitor: "monitoring",
  regulatory: "training",
  biostatistician: "analysis",
  medicalWriter: "writing",
  programmer: "programming",
};

/** What each stream is called in a sentence. */
export const STREAM_LABEL: Record<WorkStream, string> = {
  queries: "query resolution",
  monitoring: "the monitoring schedule",
  training: "site training",
  analysis: "the analysis plan",
  writing: "the decision write-ups",
  programming: "the table programs",
};

export const ROLE_LABEL: Record<TeamRole, string> = {
  biostatistician: "Biostatistician",
  dataManager: "Data manager",
  regulatory: "Regulatory lead",
  monitor: "Monitor",
  medicalWriter: "Medical writer",
  programmer: "Programmer",
};

/** How much a member trusts a new Study Director on day 1. */
const STARTING_TRUST: Record<MemberArchetype, number> = {
  overloadedStar: 48,
  veteranDataManager: 40,
  veteranMonitor: 42,
  steadyProfessional: 55,
  optimisticStatistician: 62,
};

/** How each cause moves trust. Talking counts once a day. */
export const TRUST_EFFECTS: Record<TrustCause, number> = {
  talk: 3,
  coach: 8,
  followThrough: 6,
  heard: 2,
  brushOff: -2,
  ignore: -6,
  dump: -8,
  override: -10,
  coffee: 3,
  favour: 4,
  cover: -4,
};

/** Extra trust every kind act earns on a day the player chose people (#1837). */
export const PEOPLE_PRIORITY_BONUS = 2;

/** Trust as hearts, 0 to 5: the only way the player sees it. */
export function heartsFor(trust: number): number {
  return Math.round(clamp(trust, 0, 100) / 20);
}

/** Trust at which a member discloses early warnings. */
export const OPEN_TRUST = 65;
/** Trust below which a member deflects. */
export const WARY_TRUST = 40;
/** Trust at which a member goes the extra mile: four hearts (#1838). */
export const TRUSTED_TRUST = 70;

/** A member's bond with the player before anything has happened. */
export function initialBond(study: StudyState, member: TeamMember): Bond {
  const rescue = study.difficulty === "rescue" ? -10 : 0;
  const calm = study.difficulty === "calm" ? 5 : 0;
  return {
    trust: clamp(STARTING_TRUST[member.archetype] + rescue + calm, 0, 100),
    confidence: clamp(30 + member.skill * 8, 0, 100),
    coached: 0,
    talkedDay: 0,
    coachedDay: 0,
    askedDay: 0,
    owns: null,
  };
}

/** A member's bond: the saved one, or how they start. */
export function bondFor(world: WorldState, memberId: string): Bond {
  const saved = world.bonds?.[memberId];
  if (saved) return saved;
  const member = world.study.team.find((m) => m.id === memberId);
  return member
    ? initialBond(world.study, member)
    : {
        trust: 50,
        confidence: 50,
        coached: 0,
        talkedDay: 0,
        coachedDay: 0,
        askedDay: 0,
        owns: null,
      };
}

/** Replaces a member's bond. */
export function withBond(
  world: WorldState,
  memberId: string,
  patch: Partial<Bond>
): WorldState {
  return {
    ...world,
    bonds: {
      ...world.bonds,
      [memberId]: { ...bondFor(world, memberId), ...patch },
    },
  };
}

/**
 * Moves a member's trust for a reason. Talking only counts the first time
 * each day, so trust cannot be farmed by pestering.
 */
export function adjustTrust(
  world: WorldState,
  memberId: string,
  cause: TrustCause
): { world: WorldState; delta: number } {
  const bond = bondFor(world, memberId);
  const day = world.study.day;
  if (cause === "talk" && bond.talkedDay === day) return { world, delta: 0 };
  const effect = TRUST_EFFECTS[cause];
  const kind =
    effect > 0 && world.plan?.day === day && world.plan.priority === "people"
      ? PEOPLE_PRIORITY_BONUS
      : 0;
  const trust = clamp(bond.trust + effect + kind, 0, 100);
  const patch: Partial<Bond> = { trust };
  if (cause === "talk") patch.talkedDay = day;
  return {
    world: withBond(world, memberId, patch),
    delta: trust - bond.trust,
  };
}

/** The team member who sent an event, if a team member did. */
export function senderOf(
  study: StudyState,
  event: Pick<StudyEvent, "from">
): TeamMember | null {
  return (
    study.team.find(
      (m) => event.from === m.name || event.from.startsWith(`${m.name} (`)
    ) ?? null
  );
}

/** Events waiting on the player that a member sent. */
export function pendingFrom(study: StudyState, memberId: string): StudyEvent[] {
  return inbox(study).filter((e) => senderOf(study, e)?.id === memberId);
}

/** Records something the player saw or was told. Idempotent by id. */
export function observe(world: WorldState, fact: Observation): WorldState {
  if (world.known.includes(fact.id)) return world;
  return {
    ...world,
    known: [...world.known, fact.id],
    observations: [...(world.observations ?? []), fact],
  };
}

const PHASE_TASK: Record<TeamRole, Partial<Record<Phase, string>>> = {
  dataManager: {
    protocol: "reviewing the CRF design",
    startup: "building the EDC",
    conduct: "working the query queue",
    cleaning: "cleaning data for lock",
  },
  monitor: {
    startup: "qualifying sites",
    conduct: "planning site visits",
    cleaning: "chasing source signatures",
  },
  regulatory: {
    protocol: "preparing the IRB submission",
    startup: "collecting site essential documents",
    conduct: "keeping the TMF current",
    closeout: "reconciling the TMF",
  },
  biostatistician: {
    protocol: "writing the statistical analysis plan",
    analysis: "running the analysis",
  },
  medicalWriter: {
    protocol: "editing the protocol",
    reporting: "drafting the CSR",
  },
  programmer: {
    cleaning: "programming the tables",
    analysis: "validating the outputs",
  },
};

const DEFAULT_TASK: Record<TeamRole, string> = {
  dataManager: "working the query queue",
  monitor: "writing visit reports",
  regulatory: "filing to the TMF",
  biostatistician: "checking the randomization",
  medicalWriter: "tidying the templates",
  programmer: "maintaining the derivations",
};

/**
 * One member's world layer: energy, stress, confidence, trust and what they
 * are doing, derived from the study and their bond with the player. Their
 * location comes from their schedule (`placePeople`).
 */
export function personState(
  world: WorldState,
  memberId: string
): PersonState | null {
  const { study } = world;
  const member = study.team.find((m) => m.id === memberId);
  if (!member) return null;
  const bond = bondFor(world, memberId);
  const pending = pendingFrom(study, memberId);
  const assigned = (world.assignments ?? []).filter(
    (a) => a.memberId === memberId && a.remaining > 0
  );
  const stress = Math.round(
    clamp(
      member.workload * 0.75 +
        pending.length * 6 +
        assigned.length * 6 +
        Math.max(0, 50 - bond.trust) * 0.2,
      0,
      100
    )
  );
  const energy = Math.round(
    clamp(
      100 -
        Math.max(0, member.workload - 40) * 0.9 -
        Math.max(0, stress - 60) * 0.5,
      0,
      100
    )
  );
  const confidence = Math.round(
    clamp(bond.confidence - Math.max(0, stress - 70) * 0.5, 0, 100)
  );
  const mood: Mood =
    stress >= 65 ? "overloaded" : stress >= 45 ? "busy" : "calm";
  const phase = phaseForDay(study.day, study.setup.durationDays);
  const task = assigned[0]
    ? `${STREAM_LABEL[assigned[0].stream]}, as you asked`
    : pending[0]
      ? `waiting on you about ${getEvent(pending[0].id)?.subject.toLowerCase() ?? "something"}`
      : bond.owns
        ? `running ${STREAM_LABEL[bond.owns]}`
        : (PHASE_TASK[member.role][phase] ?? DEFAULT_TASK[member.role]);
  return {
    memberId,
    name: member.name,
    role: member.role,
    workload: member.workload,
    energy,
    stress,
    confidence,
    trust: bond.trust,
    mood,
    task,
    owns: bond.owns,
  };
}

const bars = (value: number): 1 | 2 | 3 | 4 =>
  value >= 80 ? 4 : value >= 60 ? 3 : value >= 35 ? 2 : 1;

const STRESS_WORDS = [
  "",
  "relaxed",
  "some pressure",
  "stretched",
  "close to breaking",
];
const LOAD_WORDS = ["", "light", "steady", "heavy", "buried"];

/**
 * The relationship card: trust as hearts, stress and workload as rough
 * bars. Never an exact number; the player reads people, not meters.
 */
export function relationshipCard(
  world: WorldState,
  memberId: string
): RelationshipCard | null {
  const p = personState(world, memberId);
  if (!p) return null;
  const stressBars = bars(p.stress);
  const workloadBars = bars(p.workload);
  return {
    memberId,
    name: p.name,
    role: ROLE_LABEL[p.role],
    hearts: heartsFor(p.trust),
    stressBars,
    workloadBars,
    stressLabel: STRESS_WORDS[stressBars],
    workloadLabel: LOAD_WORDS[workloadBars],
    task: p.task,
    owns: p.owns,
  };
}

// ---------------------------------------------------------------------------
// Schedules and positions.

/** Where members park and walk in from. */
const CAR_PARK: TilePoint = { x: 35, y: 16 };

const BREAK_SEATS: readonly TilePoint[] = [
  { x: 24, y: 12 },
  { x: 27, y: 12 },
  { x: 24, y: 13 },
  { x: 27, y: 13 },
  { x: 25, y: 11 },
  { x: 26, y: 11 },
  { x: 25, y: 14 },
  { x: 26, y: 14 },
];
/** Where people wait at the coffee machine, one tile each. */
const COFFEE_SPOTS: readonly TilePoint[] = [
  { x: 25, y: 10 },
  { x: 26, y: 10 },
  { x: 27, y: 10 },
  { x: 28, y: 10 },
  { x: 29, y: 10 },
  { x: 30, y: 10 },
];
const OUTSIDE_SPOTS: readonly TilePoint[] = [
  { x: 32, y: 17 },
  { x: 37, y: 17 },
  { x: 33, y: 18 },
  { x: 38, y: 16 },
  { x: 36, y: 19 },
  { x: 32, y: 20 },
];
/** Conference seats, along both sides of the table. The anchor stays free. */
const CONFERENCE_SEATS: readonly TilePoint[] = [
  { x: 12, y: 12 },
  { x: 13, y: 12 },
  { x: 14, y: 12 },
  { x: 15, y: 12 },
  { x: 16, y: 12 },
  { x: 17, y: 12 },
  { x: 18, y: 12 },
  { x: 19, y: 12 },
  { x: 13, y: 10 },
  { x: 17, y: 10 },
];

const DIRS: readonly Facing[] = ["up", "left", "right", "down"];
const pathCache = new Map<string, TilePoint[]>();

/**
 * The shortest walk between two tiles over free floor, ignoring people, as
 * the tiles stepped onto (the start excluded, the end included). Fixed
 * neighbour order keeps it deterministic. Empty when unreachable or equal.
 */
export function walkPath(
  map: WorldMap,
  from: TilePoint,
  to: TilePoint
): TilePoint[] {
  const cacheKey = `${map.id}:${from.x},${from.y}>${to.x},${to.y}`;
  const cached = pathCache.get(cacheKey);
  if (cached) return cached;
  const key = (p: TilePoint) => `${p.x},${p.y}`;
  const came = new Map<string, string>();
  const seen = new Set([key(from)]);
  let frontier: TilePoint[] = [from];
  let found = from.x === to.x && from.y === to.y;
  while (!found && frontier.length > 0) {
    const next: TilePoint[] = [];
    for (const tile of frontier) {
      for (const d of DIRS) {
        const n = stepFrom(tile, d);
        const k = key(n);
        if (seen.has(k) || !isWalkable(map, n.x, n.y)) continue;
        seen.add(k);
        came.set(k, key(tile));
        if (n.x === to.x && n.y === to.y) found = true;
        next.push(n);
      }
      if (found) break;
    }
    frontier = next;
  }
  const path: TilePoint[] = [];
  if (found && !(from.x === to.x && from.y === to.y)) {
    for (
      let at: string | undefined = key(to);
      at && at !== key(from);
      at = came.get(at)
    ) {
      const [x, y] = at.split(",").map(Number);
      path.push({ x, y });
    }
    path.reverse();
  }
  pathCache.set(cacheKey, path);
  return path;
}

/** A value in [0, 1) from the world's own stream, never the domain's draws. */
function jitter(study: StudyState, memberId: string, k: number): number {
  return uniformAt(`${study.seed}:world:schedule:${memberId}:${study.day}`, k);
}

const at = (minute: number) => Math.round(minute);

/** Workload up to which a member is calm enough for a coffee outside. */
const CALM_UP_TO = 50;

/**
 * A member's day, derived from their workload rather than scripted. A calm
 * member (50 or less) takes a coffee outside mid-morning and lunches in the
 * break room. A busy one grabs a coffee and comes straight back, and above
 * 65 eats lunch at the desk. An overloaded one (above 75) is in early,
 * skips the coffee, eats at the desk and leaves late. Everyone else leaves
 * at six, and everyone is at their desk when the office opens. Leaving and
 * lunch follow `workHours`; the other times vary a little by seed and day.
 */
export function daySchedule(
  world: WorldState,
  memberId: string,
  map: WorldMap = CRO_FLOOR
): DaySchedule | null {
  const { study } = world;
  const member = study.team.find((m) => m.id === memberId);
  if (!member) return null;
  const desk = placeTeam(study, map).find((p) => p.memberId === memberId);
  if (!desk) return null;
  const index = study.team.findIndex((m) => m.id === memberId);
  const j = (k: number) => jitter(study, memberId, k);
  const deskSpot = { x: desk.x, y: desk.y };
  const atDesk = (
    start: number,
    end: number,
    activity: ScheduleBlock["activity"] = "working"
  ): ScheduleBlock => ({
    start,
    end,
    activity,
    room: desk.room,
    spot: deskSpot,
    facing: desk.facing,
  });
  const spotIn = (spot: TilePoint, facing: Facing) => {
    const room = roomAt(map, spot.x, spot.y)?.id ?? desk.room;
    return { spot, facing, room };
  };
  const breakSeat = BREAK_SEATS[index % BREAK_SEATS.length];
  const outside = OUTSIDE_SPOTS[index % OUTSIDE_SPOTS.length];
  const coffee = spotIn(COFFEE_SPOTS[index % COFFEE_SPOTS.length], "left");
  const blocks: ScheduleBlock[] = [];
  const hours = workHours(member.workload);
  const mood: Mood = hours.staysLate
    ? "overloaded"
    : member.workload > CALM_UP_TO
      ? "busy"
      : "calm";
  const leave = hours.leavesAt;
  const lunchBlock = (lunchAt: number, minutes: number): ScheduleBlock =>
    hours.lunchAtDesk
      ? atDesk(lunchAt, lunchAt + 25, "lunchAtDesk")
      : {
          start: lunchAt,
          end: lunchAt + minutes,
          activity: "lunch",
          ...spotIn(breakSeat, facingToward(breakSeat, { x: 25.5, y: 12.5 })),
        };
  let arrive: number;
  if (mood === "overloaded") {
    arrive = at(DAY_START - 45 - j(0) * 15);
    const lunchAt = at(12 * 60 + j(2) * 20);
    blocks.push(atDesk(arrive, lunchAt));
    blocks.push(lunchBlock(lunchAt, 25));
    blocks.push(atDesk(lunchAt + 25, leave));
  } else if (mood === "busy") {
    arrive = at(DAY_START - 30 - j(0) * 10);
    const coffeeAt = at(10 * 60 + 15 + j(2) * 45);
    const lunchAt = at(12 * 60 + 15 + j(3) * 30);
    const lunch = lunchBlock(lunchAt, 30);
    blocks.push(atDesk(arrive, coffeeAt));
    blocks.push({
      start: coffeeAt,
      end: coffeeAt + 8,
      activity: "coffee",
      ...coffee,
    });
    blocks.push(atDesk(coffeeAt + 8, lunchAt));
    blocks.push(lunch);
    blocks.push(atDesk(lunch.end, leave));
  } else {
    arrive = at(DAY_START - 25 - j(0) * 5);
    const coffeeAt = at(10 * 60 + j(2) * 60);
    const lunchAt = at(12 * 60 + j(3) * 45);
    blocks.push(atDesk(arrive, coffeeAt));
    blocks.push({
      start: coffeeAt,
      end: coffeeAt + 8,
      activity: "coffee",
      ...coffee,
    });
    blocks.push({
      start: coffeeAt + 8,
      end: coffeeAt + 30,
      activity: "outside",
      ...spotIn(outside, "down"),
    });
    blocks.push(atDesk(coffeeAt + 30, lunchAt));
    blocks.push(lunchBlock(lunchAt, 45));
    blocks.push(atDesk(lunchAt + 45, leave));
  }
  return { memberId, day: study.day, mood, arrive, leave, blocks };
}

function walking(
  path: TilePoint[],
  from: TilePoint,
  elapsed: number
): { tile: TilePoint; facing: Facing } | null {
  const k = Math.floor(elapsed * TILES_PER_MINUTE + 1e-9);
  if (k >= path.length) return null;
  const tile = k <= 0 ? from : path[k - 1];
  const next = path[Math.max(0, k)];
  return { tile, facing: facingToward(tile, next) };
}

/**
 * Where a member is at a minute of the day, from their schedule: walking
 * between places along the shortest path, four tiles a minute, or at the
 * place a block puts them. Null before they arrive and after they leave.
 */
export function positionAt(
  schedule: DaySchedule,
  minute: number,
  map: WorldMap = CRO_FLOOR
): {
  tile: TilePoint;
  facing: Facing;
  room: RoomId;
  activity: PersonActivity;
} | null {
  if (minute < schedule.arrive) return null;
  const { blocks } = schedule;
  const roomOf = (t: TilePoint, fallback: RoomId) =>
    roomAt(map, t.x, t.y)?.id ?? fallback;
  if (minute >= schedule.leave) {
    const last = blocks[blocks.length - 1];
    const path = walkPath(map, last.spot, CAR_PARK);
    const w = walking(path, last.spot, minute - schedule.leave);
    return w
      ? { ...w, room: roomOf(w.tile, last.room), activity: "walking" }
      : null;
  }
  for (let i = blocks.length - 1; i >= 0; i -= 1) {
    const block = blocks[i];
    const start = i === 0 ? schedule.arrive : block.start;
    if (minute < start) continue;
    const from = i === 0 ? CAR_PARK : blocks[i - 1].spot;
    const path = walkPath(map, from, block.spot);
    const w = walking(path, from, minute - start);
    if (w)
      return { ...w, room: roomOf(w.tile, block.room), activity: "walking" };
    return {
      tile: block.spot,
      facing: block.facing,
      room: block.room,
      activity: block.activity,
    };
  }
  return null;
}

/**
 * Everyone on the floor right now, from their schedules (nobody, on a map
 * other than the CRO floor): the people list the
 * renderer, movement, interaction and directory take. People in a meeting
 * sit at the conference table instead. Two people walking can share a tile
 * for a moment; anyone standing still has their own.
 */
export function placePeople(
  world: WorldState,
  map: WorldMap = CRO_FLOOR
): PersonPlacement[] {
  // The team works on the CRO floor; on any other map (a site visit) they
  // are not there.
  if (world.location === "home" || map.id !== CRO_FLOOR.id) return [];
  const placements: PersonPlacement[] = [];
  const meeting = world.meeting ?? null;
  for (const member of world.study.team) {
    const seat = meeting ? meeting.attendees.indexOf(member.id) : -1;
    if (meeting && seat >= 0) {
      const spot = CONFERENCE_SEATS[seat % CONFERENCE_SEATS.length];
      placements.push({
        memberId: member.id,
        name: member.name,
        role: member.role,
        room: "conference",
        x: spot.x,
        y: spot.y,
        facing: spot.y > 11 ? "up" : "down",
        activity: "meeting",
      });
      continue;
    }
    const schedule = daySchedule(world, member.id, map);
    if (!schedule) continue;
    const pos = positionAt(schedule, world.minute, map);
    if (!pos) continue;
    placements.push({
      memberId: member.id,
      name: member.name,
      role: member.role,
      room: pos.room,
      x: pos.tile.x,
      y: pos.tile.y,
      facing: pos.facing,
      activity: pos.activity,
    });
  }
  return placements;
}

const ACTIVITY_TEXT: Record<PersonActivity, string> = {
  working: "is at the desk",
  lunchAtDesk: "is eating lunch at the desk",
  coffee: "is getting a coffee",
  outside: "is outside with a coffee",
  lunch: "is having lunch in the break room",
  meeting: "is in the meeting",
  walking: "is walking past",
};

/**
 * What the player can see someone doing, in a sentence: how they learn the
 * team's state from behaviour. "Maya is eating lunch at the desk, staring at
 * the screen." Never a number.
 */
export function describePerson(
  world: WorldState,
  placement: PersonPlacement
): string {
  const p = personState(world, placement.memberId);
  const doing = ACTIVITY_TEXT[placement.activity ?? "working"];
  if (!p) return `${placement.name} ${doing}.`;
  const tell =
    placement.activity === "walking" || placement.activity === "meeting"
      ? ""
      : p.mood === "overloaded"
        ? world.minute >= 18 * 60
          ? ", still here long after everyone else"
          : ", surrounded by paper and not looking up"
        : p.mood === "busy"
          ? ", typing fast"
          : placement.activity === "working"
            ? ", unhurried"
            : "";
  return `${placement.name} ${doing}${tell}.`;
}

export { workHours };
