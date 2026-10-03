import type { CoordinatorArchetype, SiteState } from "@/lib/study-director";
import {
  SITE_STATION_IDS,
  type CoordinatorTrait,
  type Room,
  type RoomId,
  type SiteCheckId,
  type Station,
  type StationId,
  type WorldMap,
} from "../types";

type SiteStationId = (typeof SITE_STATION_IDS)[number];

/**
 * Glyphs of the site stations on the site maps. Sites reuse `X`, the car,
 * from the CRO floor.
 */
export const SITE_GLYPHS: Record<SiteStationId, string> = {
  siteReception: "U",
  coordinator: "Q",
  consentForms: "N",
  screeningLog: "L",
  sourceDocuments: "Z",
  regulatoryBinder: "V",
  pi: "I",
  drugAccountability: "Y",
  temperatureLog: "M",
};

/**
 * A clinical site, 30 by 18 tiles: offices along the top, the hallway,
 * reception, pharmacy and lab below it, and the car park outside.
 *
 * Legend as on the CRO floor, plus the site stations: `U` reception desk,
 * `Q` the coordinator, `N` consent forms, `L` screening log, `Z` source
 * documents, `V` regulatory binder, `I` the principal investigator, `Y` drug
 * accountability log, `M` temperature log, and `X` your car.
 */
const SITE_ROWS = [
  "##############################",
  "#N.....#.......#......#......#",
  "#.DD.Q.#.Z...L.#.V....#..I...#",
  "#......#.......#.BB...#..DD..#",
  "#......#.......#......#....P.#",
  "###+######+#######+######+####",
  "#............................#",
  "#............................#",
  "####+######+#########+########",
  "#.......#......#.............#",
  "#.RRRU..#.Y..G.#..TTTT....M..#",
  "#.......#......#.............#",
  "#......P#......#..TTTT.......#",
  "####+#########################",
  "#............................#",
  "#..CC....CC.......X..........#",
  "#............................#",
  "##############################",
] as const;

/** Who works at a site and how far it is, beyond what the domain knows. */
interface SiteProfile {
  coordinator: string;
  pi: string;
  /** Minutes each way from the CRO car park. */
  travelMinutes: number;
  /** One sentence on what the reception looks like. */
  reception: string;
}

const SITE_PROFILES: Record<string, SiteProfile> = {
  "site-01": {
    coordinator: "Dana Okafor",
    pi: "Dr. Hale",
    travelMinutes: 25,
    reception: "A quiet waiting room with this month's magazines.",
  },
  "site-02": {
    coordinator: "Priya Lindqvist",
    pi: "Dr. Moreau",
    travelMinutes: 40,
    reception: "Every surface has a laminated reminder about the protocol.",
  },
  "site-03": {
    coordinator: "Tom Reyes",
    pi: "Dr. Castellanos",
    travelMinutes: 55,
    reception: "Nobody is at the desk. A bell says ring for service.",
  },
};

const FALLBACK_PROFILE: SiteProfile = {
  coordinator: "The coordinator",
  pi: "The investigator",
  travelMinutes: 45,
  reception: "A busy waiting room.",
};

/** The site's people and distance, for any site in a study. */
export function siteProfile(siteId: string): SiteProfile {
  return SITE_PROFILES[siteId] ?? FALLBACK_PROFILE;
}

/** A hidden trait and the checks that can bring it to light. */
export interface HiddenTrait extends CoordinatorTrait {
  /** Checks that reveal it. */
  revealedBy: SiteCheckId[];
  /** The earliest visit, counting from 1, on which it can be learned. */
  fromVisit: number;
}

/**
 * What a coordinator shows on day one and what they turn out to be. The
 * annoying, terrified coordinator is the one whose records hold up; the
 * friendly one who says everything is fine is the one to worry about.
 */
export const COORDINATOR_TRAITS: Record<
  CoordinatorArchetype,
  { visible: CoordinatorTrait[]; hidden: HiddenTrait[] }
> = {
  terrified: {
    visible: [
      {
        id: "anxious",
        label: "Anxious",
        detail: "Phones about every small thing, twice.",
      },
      {
        id: "apologetic",
        label: "Apologetic",
        detail: "Apologises for the paperwork before you have seen it.",
      },
    ],
    hidden: [
      {
        id: "meticulous",
        label: "Meticulous",
        detail:
          "Reports every deviation the day it happens, however small. The noise on the dashboard is honesty.",
        revealedBy: ["sourceReview", "consent"],
        fromVisit: 1,
      },
      {
        id: "witnessesConsent",
        label: "Has every consent witnessed",
        detail:
          "Asks a second person to witness each consent signature. Nobody asked her to.",
        revealedBy: ["interviewCoordinator"],
        fromVisit: 2,
      },
    ],
  },
  invisible: {
    visible: [
      {
        id: "friendly",
        label: "Friendly",
        detail: "Says everything is fine, warmly.",
      },
      {
        id: "hardToReach",
        label: "Hard to reach",
        detail: "Answers email on Friday afternoons.",
      },
    ],
    hidden: [
      {
        id: "overstretched",
        label: "Overstretched",
        detail:
          "Runs three studies alone. This one gets whatever is left on Friday.",
        revealedBy: ["interviewCoordinator"],
        fromVisit: 1,
      },
      {
        id: "signaturesLater",
        label: "Leaves signatures for later",
        detail:
          "Source pages wait in a tray for the investigator's signature, for weeks.",
        revealedBy: ["sourceReview", "meetPi"],
        fromVisit: 2,
      },
    ],
  },
  steady: {
    visible: [
      {
        id: "organised",
        label: "Organised",
        detail: "Answers within a day, with attachments.",
      },
    ],
    hidden: [
      {
        id: "tidyBinder",
        label: "Keeps the binder current",
        detail: "The regulatory binder is tabbed, indexed and signed off.",
        revealedBy: ["delegationLog"],
        fromVisit: 1,
      },
      {
        id: "singlePoint",
        label: "Single point of failure",
        detail:
          "Holds the whole study in her head. Nobody else at the site could run a visit.",
        revealedBy: ["meetPi", "interviewCoordinator"],
        fromVisit: 2,
      },
    ],
  },
};

function room(
  id: RoomId,
  name: string,
  bounds: [number, number, number, number],
  anchor: [number, number],
  blurb: string
): Room {
  const [x, y, width, height] = bounds;
  return {
    id,
    name,
    bounds: { x, y, width, height },
    anchor: { x: anchor[0], y: anchor[1] },
    seats: [],
    blurb,
  };
}

function siteRooms(site: string, profile: SiteProfile): Room[] {
  return [
    room(
      "coordinatorOffice",
      "Coordinator's office",
      [1, 1, 6, 4],
      [3, 4],
      `${profile.coordinator}'s office, with the consent forms in a cabinet.`
    ),
    room(
      "recordsRoom",
      "Records room",
      [8, 1, 7, 4],
      [10, 4],
      "The records room: subjects' source documents and the screening log."
    ),
    room(
      "regulatoryFiles",
      "Regulatory files",
      [16, 1, 6, 4],
      [18, 4],
      "A small room for the regulatory binder and its delegation log."
    ),
    room(
      "piOffice",
      "PI office",
      [23, 1, 6, 4],
      [25, 4],
      `${profile.pi}'s office. The principal investigator is between clinics.`
    ),
    room(
      "siteHall",
      "Hallway",
      [1, 6, 28, 2],
      [14, 7],
      `The ${site} hallway that joins every room.`
    ),
    room(
      "siteReception",
      "Reception",
      [1, 9, 7, 4],
      [4, 11],
      `${site} reception. ${profile.reception}`
    ),
    room(
      "pharmacy",
      "Pharmacy",
      [9, 9, 6, 4],
      [11, 9],
      "The investigational pharmacy, with the drug fridge and its log."
    ),
    room(
      "lab",
      "Lab",
      [16, 9, 13, 4],
      [21, 9],
      "The lab, where samples are spun and frozen."
    ),
    room(
      "siteParking",
      "Site parking",
      [1, 14, 28, 3],
      [18, 14],
      `The ${site} car park. Your car is the way back.`
    ),
  ];
}

const STATION_INFO: Record<
  SiteStationId,
  { room: RoomId; name: (p: SiteProfile) => string; blurb: string }
> = {
  siteReception: {
    room: "siteReception",
    name: () => "Reception desk",
    blurb: "Shows what you have found on this visit so far.",
  },
  coordinator: {
    room: "coordinatorOffice",
    name: (p) => `Coordinator ${p.coordinator}`,
    blurb: "Interview the coordinator.",
  },
  consentForms: {
    room: "coordinatorOffice",
    name: () => "Consent forms",
    blurb: "Check the signed consent forms.",
  },
  screeningLog: {
    room: "recordsRoom",
    name: () => "Screening log",
    blurb: "Check eligibility against the screening log.",
  },
  sourceDocuments: {
    room: "recordsRoom",
    name: () => "Source documents",
    blurb: "Review source documents against the EDC.",
  },
  regulatoryBinder: {
    room: "regulatoryFiles",
    name: () => "Regulatory binder",
    blurb: "Check the delegation log and training records.",
  },
  pi: {
    room: "piOffice",
    name: (p) => `Investigator ${p.pi}`,
    blurb: "Meet the principal investigator.",
  },
  drugAccountability: {
    room: "pharmacy",
    name: () => "Drug accountability log",
    blurb: "Count the investigational product against the log.",
  },
  temperatureLog: {
    room: "lab",
    name: () => "Temperature log",
    blurb: "Check the freezer and fridge temperature logs.",
  },
};

function glyphAt(glyph: string): { x: number; y: number } {
  const y = SITE_ROWS.findIndex((row) => row.includes(glyph));
  return { x: SITE_ROWS[y].indexOf(glyph), y };
}

function siteStations(site: string, profile: SiteProfile): Station[] {
  const stations: Station[] = (Object.keys(SITE_GLYPHS) as SiteStationId[]).map(
    (id) => {
      const info = STATION_INFO[id];
      return {
        id: id as StationId,
        name: info.name(profile),
        room: info.room,
        blurb: info.blurb,
        ...glyphAt(SITE_GLYPHS[id]),
      };
    }
  );
  stations.push({
    id: "exit",
    name: "Your car",
    room: "siteParking",
    blurb: `Leaves ${site}: back to the office, on to another site, or home.`,
    ...glyphAt("X"),
  });
  return stations;
}

/** The three clinical sites of Study 24-081 reached by fast travel. */
export const SITE_IDS = ["site-01", "site-02", "site-03"] as const;

function siteName(siteId: string): string {
  return `Site ${siteId.replace(/^site-/, "")}`;
}

function siteMap(siteId: string): WorldMap {
  const profile = siteProfile(siteId);
  const name = siteName(siteId);
  return {
    id: siteId,
    name,
    width: 30,
    height: SITE_ROWS.length,
    rows: SITE_ROWS,
    rooms: siteRooms(name, profile),
    stations: siteStations(name, profile),
    spawn: { x: 18, y: 14, facing: "up" },
  };
}

/** Each site's map, by `WORLD_MAPS` id (the site id). */
export const SITE_MAPS: Readonly<Record<string, WorldMap>> = Object.fromEntries(
  SITE_IDS.map((id) => [id, siteMap(id)])
);

/** The site a map belongs to, or null for a map that is not a site. */
export function siteForMap(
  sites: readonly SiteState[],
  mapId: string | undefined
): SiteState | null {
  if (!mapId || !(mapId in SITE_MAPS)) return null;
  return sites.find((s) => s.id === mapId) ?? null;
}
