import {
  deskView,
  messagesFrom,
  ringingCall,
  sponsorAgenda,
  stepFrom,
  tileAt,
  type PersonPlacement,
  type PlayerState,
  type TilePoint,
  type WorldMap,
  type WorldState,
} from "@/lib/study-director-world";

/** People and stations this many steps away get a nameplate. */
export const NAMEPLATE_RANGE = 4;

/** What the player faces, and what pressing E would do. */
export interface InteractionPrompt extends TilePoint {
  kind: "person" | "station";
  /** The name of the person or station. */
  name: string;
  /** The prompt as it reads: "Press E to talk to Maya". */
  text: string;
  /** What using a station does, in one line. */
  detail?: string;
}

/** The prompt for the tile in front of the player, or null when there is none. */
export function interactionPrompt(
  map: WorldMap,
  player: PlayerState,
  people: readonly PersonPlacement[]
): InteractionPrompt | null {
  const front = stepFrom(player, player.facing);
  const person = people.find((p) => p.x === front.x && p.y === front.y);
  if (person)
    return {
      kind: "person",
      x: person.x,
      y: person.y,
      name: person.name,
      text: `Press E to talk to ${person.name}`,
    };
  if (tileAt(map, front.x, front.y) !== "station") return null;
  const station = map.stations.find((s) => s.x === front.x && s.y === front.y);
  if (!station) return null;
  return {
    kind: "station",
    x: station.x,
    y: station.y,
    name: station.name,
    text: `Press E to use ${station.name}`,
    detail: station.blurb,
  };
}

/** A name hovering over a person or a station. */
export interface Nameplate extends TilePoint {
  id: string;
  label: string;
  kind: "person" | "station";
}

const distance = (a: TilePoint, b: TilePoint) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * The names to show: people and stations within a few steps of the player,
 * and whatever is faced however far, nearest first. Far-off names are left
 * out so the stage does not fill with labels.
 */
export function nameplates(
  map: WorldMap,
  player: PlayerState,
  people: readonly PersonPlacement[],
  faced: InteractionPrompt | null
): Nameplate[] {
  const all: Nameplate[] = [
    ...people.map((p): Nameplate => ({
      id: `person:${p.memberId}`,
      label: p.name,
      kind: "person",
      x: p.x,
      y: p.y,
    })),
    ...map.stations.map((s): Nameplate => ({
      id: `station:${s.id}`,
      label: s.name,
      kind: "station",
      x: s.x,
      y: s.y,
    })),
  ];
  return all
    .filter(
      (n) =>
        distance(n, player) <= NAMEPLATE_RANGE ||
        (faced !== null && n.x === faced.x && n.y === faced.y)
    )
    .sort((a, b) => distance(a, player) - distance(b, player));
}

/** One open item for today. */
export interface WorldTask {
  id: string;
  text: string;
  /** Where to deal with it. */
  where: string;
  /** True for something that will not wait: a ringing phone, a meeting running. */
  urgent: boolean;
}

/**
 * Today's open items, most urgent first: the phone ringing, a meeting under
 * way, people waiting to talk, then what is on the desk, the sponsor's
 * agenda, decisions not yet written up and the queries the sites have open.
 * Empty when the player has gone home.
 */
export function todaysTasks(world: WorldState): WorldTask[] {
  if (world.location === "home" || world.study.status !== "running") return [];
  const tasks: WorldTask[] = [];
  const ringing = ringingCall(world);
  if (ringing)
    tasks.push({
      id: "ringing",
      text: `The phone is ringing: ${ringing.from}`,
      where: "Your office",
      urgent: true,
    });
  if (world.meeting)
    tasks.push({
      id: "meeting",
      text: `${world.meeting.kind === "team" ? "A team meeting" : "A sponsor call"} is in progress`,
      where: "Conference room",
      urgent: true,
    });
  for (const m of world.study.team) {
    const waiting = messagesFrom(world, m.id);
    if (waiting.length > 0)
      tasks.push({
        id: `talk:${m.id}`,
        text: `${m.name} has something for you`,
        where: `Find ${m.name}`,
        urgent: false,
      });
  }
  const desk = deskView(world);
  const count = (
    id: string,
    n: number,
    one: string,
    many: string,
    where: string
  ) => {
    if (n > 0)
      tasks.push({
        id,
        text: n === 1 ? one : many.replace("{n}", String(n)),
        where,
        urgent: false,
      });
  };
  count(
    "voicemail",
    desk.voicemail.length,
    "1 voicemail",
    "{n} voicemails",
    "Phone in your office"
  );
  count(
    "callbacks",
    desk.callbacks.length,
    "1 call to return",
    "{n} calls to return",
    "Phone in your office"
  );
  count(
    "mail",
    desk.mail.length,
    "1 unread email",
    "{n} unread emails",
    "Phone in your office"
  );
  const agenda = sponsorAgenda(world).length;
  count(
    "sponsor",
    agenda,
    "1 item for the sponsor call",
    "{n} items for the sponsor call",
    "Conference room"
  );
  count(
    "writeup",
    desk.undocumented.length,
    "1 decision to write up",
    "{n} decisions to write up",
    "Phone in your office"
  );
  const queries = world.study.sites.reduce((n, s) => n + s.openQueries, 0);
  count(
    "queries",
    queries,
    "1 open query at the sites",
    "{n} open queries at the sites",
    "EDC workstation"
  );
  return tasks;
}

/** The one thing to do next, for the HUD: the first task, or a nudge on day one. */
export function currentGoal(
  world: WorldState,
  tasks: readonly WorldTask[],
  acted: boolean
): string | null {
  if (world.location === "home") return null;
  if (!acted && world.study.day === 1 && !world.visit)
    return "walk to the EDC workstation in your office and press E.";
  const first = tasks[0];
  return first ? `${first.text}. ${first.where}.` : null;
}
