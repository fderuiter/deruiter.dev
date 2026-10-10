import { clamp } from "@/lib/game-utils";
import {
  auditSite,
  reportedSite,
  type SiteAuditReport,
  type SiteState,
} from "@/lib/study-director";
import { OVERTIME_ENERGY_FACTOR, formatClock, lateMinutes } from "./clock";
import { CRO_FLOOR, WORLD_MAPS, roomAt } from "./floor";
import {
  COORDINATOR_TRAITS,
  SITE_MAPS,
  siteForMap,
  siteProfile,
  type HiddenTrait,
} from "./site-maps";
import {
  HARD_STOP,
  type SITE_STATION_IDS,
  type ActionCost,
  type CoordinatorProfile,
  type CoordinatorTrait,
  type InteractionHandler,
  type InteractionOutcome,
  type PlayerState,
  type SiteCheck,
  type SiteCheckId,
  type SiteFinding,
  type SiteFindingField,
  type SiteObservation,
  type SiteRefusal,
  type SiteResult,
  type SiteVisit,
  type SiteVisitReport,
  type StationId,
  type TravelOption,
  type WorldMap,
  type WorldState,
} from "../types";

/** Clock minute a site's staff go home; no check may run past it. */
export const SITE_CLOSES = 17 * 60;
/** Clock minute the principal investigator leaves for clinic. */
export const PI_LEAVES = 15 * 60;
/** Least time on site worth driving out for, in minutes. */
const MIN_VISIT_MINUTES = 30;
/** Minutes of driving per point of energy. */
const DRIVE_MINUTES_PER_ENERGY = 10;

function check(
  id: SiteCheckId,
  label: string,
  station: StationId,
  [minutes, energy, focus]: [number, number, number],
  covers: SiteFindingField[],
  records = true
): SiteCheck {
  return {
    id,
    label,
    station,
    cost: { minutes, energy, focus },
    covers,
    records,
  };
}

/**
 * Every check a site visit can include and what it costs. Together they
 * take most of a site's day and more focus than the player has, so a visit
 * is a choice of what to look at. Records checks resolve into an audit;
 * conversations teach the player about the people.
 */
export const SITE_CHECKS: Record<SiteCheckId, SiteCheck> = {
  consent: check(
    "consent",
    "Check consent forms",
    "consentForms",
    [50, 4, 15],
    ["deviations"]
  ),
  eligibility: check(
    "eligibility",
    "Check eligibility",
    "screeningLog",
    [60, 4, 25],
    ["eligibilityConcerns"]
  ),
  drugAccountability: check(
    "drugAccountability",
    "Count drug accountability",
    "drugAccountability",
    [40, 3, 15],
    ["deviations"]
  ),
  temperatureLogs: check(
    "temperatureLogs",
    "Check temperature logs",
    "temperatureLog",
    [20, 2, 5],
    ["deviations"]
  ),
  delegationLog: check(
    "delegationLog",
    "Check the delegation log",
    "regulatoryBinder",
    [25, 2, 8],
    ["trainingCurrent"]
  ),
  sourceReview: check(
    "sourceReview",
    "Review source documents",
    "sourceDocuments",
    [90, 6, 30],
    ["unsignedSource", "openQueries"]
  ),
  interviewCoordinator: check(
    "interviewCoordinator",
    "Interview the coordinator",
    "coordinator",
    [30, 3, 8],
    [],
    false
  ),
  meetPi: check("meetPi", "Meet the PI", "pi", [20, 2, 8], [], false),
};

/** The check done at a station, or null for stations that are not checks. */
export function checkAtStation(station: StationId): SiteCheck | null {
  return Object.values(SITE_CHECKS).find((c) => c.station === station) ?? null;
}

/** The map the player is on. A save from before maps existed is on the floor. */
export function currentMap(world: WorldState): WorldMap {
  return (world.map && WORLD_MAPS[world.map]) || CRO_FLOOR;
}

/** The study site the player is visiting, or null at the CRO. */
function visitedSite(world: WorldState): SiteState | null {
  return world.visit
    ? (world.study.sites.find((s) => s.id === world.visit?.siteId) ?? null)
    : null;
}

/** Minutes from the CRO car park to a site, one way. */
export function travelMinutes(siteId: string): number {
  return siteProfile(siteId).travelMinutes;
}

const visitKey = (siteId: string) => `visit:${siteId}:`;
const traitKey = (siteId: string, traitId: string) =>
  `trait:${siteId}:${traitId}`;

/** Visits made to a site so far, counting one in progress. */
function visitsTo(world: WorldState, siteId: string): number {
  return world.known.filter((k) => k.startsWith(visitKey(siteId))).length;
}

function siteLabel(world: WorldState, siteId: string): string {
  return (
    world.study.sites.find((s) => s.id === siteId)?.name ??
    SITE_MAPS[siteId]?.name ??
    siteId
  );
}

/**
 * Where the car can go from here. From the CRO: every study site that can
 * still be reached before it closes. From a site: back to the office and on
 * to the other sites. Going home is always offered beside these.
 */
export function travelOptions(world: WorldState): TravelOption[] {
  const here = currentMap(world).id;
  const options: TravelOption[] = [];
  if (here !== CRO_FLOOR.id && world.visit)
    options.push({
      mapId: CRO_FLOOR.id,
      label: "Drive back to the office",
      minutes: travelMinutes(world.visit.siteId),
    });
  for (const site of world.study.sites) {
    if (site.id === here || !SITE_MAPS[site.id]) continue;
    const minutes = travelMinutes(site.id);
    if (world.minute + minutes + MIN_VISIT_MINUTES > SITE_CLOSES) continue;
    options.push({
      mapId: site.id,
      label: `Drive to ${site.name}`,
      minutes,
    });
  }
  return options;
}

/** Spends a cost like `spend` does: overtime doubles energy, past the hard stop is refused. */
function spendCost(
  world: WorldState,
  cost: ActionCost
): SiteResult<{ cost: ActionCost }> {
  const end = world.minute + cost.minutes;
  if (end > HARD_STOP) return { ok: false, reason: "too-late" };
  const late = lateMinutes(world.minute, end);
  const share = cost.minutes > 0 ? late / cost.minutes : 0;
  const energy = Math.round(
    cost.energy * (1 + share * (OVERTIME_ENERGY_FACTOR - 1))
  );
  if (energy > world.energy) return { ok: false, reason: "too-tired" };
  return {
    ok: true,
    cost: { ...cost, energy },
    world: {
      ...world,
      minute: end,
      energy: world.energy - energy,
      focus: clamp(world.focus - cost.focus, 0, 100),
      overtime: world.overtime + late,
    },
  };
}

const FIELD_LABELS: Record<SiteFindingField, string> = {
  openQueries: "Open queries",
  deviations: "Deviations",
  unsignedSource: "Unsigned source",
  eligibilityConcerns: "Questionable eligibility",
  trainingCurrent: "Training on the current protocol",
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function finding(
  field: SiteFindingField,
  actualReport: SiteAuditReport,
  reportedReport: SiteAuditReport
): SiteFinding {
  const actual = actualReport[field];
  const reported = reportedReport[field];
  const label = FIELD_LABELS[field];
  if (typeof actual === "boolean") {
    const hidden = actual === false && reported === true;
    return {
      field,
      label,
      actual,
      reported,
      hidden,
      text: actual
        ? `${label}: current.`
        : hidden
          ? `${label}: not current. The dashboard showed it as on file.`
          : `${label}: not current, as reported.`,
    };
  }
  const shown = reported as number;
  // Hidden means materially under-reported: a problem the dashboard showed
  // none of, or a gap of two or more. A rounding difference is not hiding.
  const hidden = actual > shown && (shown === 0 || actual - shown >= 2);
  return {
    field,
    label,
    actual,
    reported: shown,
    hidden,
    text: hidden
      ? `${label}: ${actual}. The dashboard showed ${shown}.`
      : actual === shown
        ? `${label}: ${actual}, as reported.`
        : `${label}: ${actual}, close to the ${shown} reported.`,
  };
}

/** Problems with consent forms, from what the site's records really hold. */
function consentIssues(site: SiteState): number {
  return Math.round(site.deviations * 0.25) + (site.trainingCurrent ? 0 : 1);
}

/** Days without a temperature reading, from the site's burden and coordinator. */
function temperatureGaps(site: SiteState): number {
  if (site.coordinator === "terrified") return 0;
  const gaps = Math.max(0, Math.ceil((site.burden - 50) / 10));
  if (site.coordinator === "newcomer") return gaps;
  return site.coordinator === "invisible" ||
    site.coordinator === "overconfident"
    ? gaps + 1
    : gaps;
}

const COORDINATOR_LINES: Record<SiteState["coordinator"], string> = {
  terrified:
    '"I wrote down every deviation, even the tiny ones. Was that wrong? Please tell me if that was wrong."',
  invisible: '"Everything is fine. Honestly. Everything is fine."',
  steady: '"We are on track. I will send you the tracker tonight."',
  overconfident:
    '"I have done forty of these. You do not need to look at the binder. Fine, look at the binder."',
  newcomer:
    '"Is this right? I did it the way the protocol says, but I might have read it wrong. Could you check?"',
};

/** What a check shows, from the site's true state. */
function observe(id: SiteCheckId, site: SiteState): SiteObservation {
  const profile = siteProfile(site.id);
  const seen = (text: string, tone: SiteObservation["tone"]) => ({
    check: id,
    text,
    tone,
  });
  switch (id) {
    case "consent": {
      if (site.enrolled === 0)
        return seen(
          "Nobody is consented yet. The blank forms are the current version.",
          "neutral"
        );
      const n = consentIssues(site);
      return n === 0
        ? seen(
            `All ${site.enrolled} consent forms are signed, dated and on the current version.`,
            "good"
          )
        : seen(
            `${plural(n, "consent form")} with problems: an old version, or a missing date.`,
            "bad"
          );
    }
    case "eligibility":
      if (site.enrolled === 0)
        return seen("Nobody has been screened in yet.", "neutral");
      return site.eligibilityConcerns === 0
        ? seen(
            "Every subject's screening values fall inside the inclusion window.",
            "good"
          )
        : seen(
            `${plural(site.eligibilityConcerns, "subject")} with questionable eligibility: screening values outside the protocol's window, enrolled anyway.`,
            "bad"
          );
    case "drugAccountability": {
      const n = Math.round(site.deviations * 0.4);
      return n === 0
        ? seen(
            "Every kit dispensed is in the log, and the counts match.",
            "good"
          )
        : seen(
            `${plural(n, "dispensing discrepancy", "dispensing discrepancies")} between the kits on the shelf and the log.`,
            "bad"
          );
    }
    case "temperatureLogs": {
      const gaps = temperatureGaps(site);
      return gaps === 0
        ? seen(
            "The temperature logs are complete, every day, weekends included.",
            "good"
          )
        : seen(
            `${plural(gaps, "day")} with no temperature reading, all of them weekends.`,
            "bad"
          );
    }
    case "delegationLog":
      return site.trainingCurrent
        ? seen(
            "Everyone on the delegation log is signed off and trained on the current protocol.",
            "good"
          )
        : seen(
            "Staff on the delegation log are not trained on the current amendment, and are doing study tasks anyway.",
            "bad"
          );
    case "sourceReview": {
      const queries = `${plural(site.openQueries, "query", "queries")} open at the site.`;
      return site.unsignedSource === 0
        ? seen(`Source is signed and matches the EDC. ${queries}`, "good")
        : seen(
            `${plural(site.unsignedSource, "page")} of source not signed by the investigator. ${queries}`,
            "bad"
          );
    }
    case "interviewCoordinator":
      return seen(
        `${profile.coordinator}: ${COORDINATOR_LINES[site.coordinator]}`,
        "neutral"
      );
    case "meetPi":
      return site.unsignedSource > 3
        ? seen(
            `${profile.pi} signs source in batches "when there is a moment". There has not been a moment for a while.`,
            "bad"
          )
        : seen(
            `${profile.pi} has read the protocol and knows the subjects by name.`,
            "good"
          );
  }
}

/** Hidden traits a check can reveal on a given visit. */
function revealedBy(
  site: SiteState,
  id: SiteCheckId,
  visit: number
): HiddenTrait[] {
  return COORDINATOR_TRAITS[site.coordinator].hidden.filter(
    (t) => t.revealedBy.includes(id) && visit >= t.fromVisit
  );
}

const asTrait = ({
  id,
  label,
  detail,
}: CoordinatorTrait): CoordinatorTrait => ({
  id,
  label,
  detail,
});

/**
 * The coordinator of a site as the player knows them: their visible traits,
 * the hidden ones learned so far and how many are still to learn.
 */
export function coordinatorProfile(
  world: WorldState,
  siteId: string
): CoordinatorProfile | null {
  const site = world.study.sites.find((s) => s.id === siteId);
  if (!site) return null;
  const profile = siteProfile(siteId);
  const traits = COORDINATOR_TRAITS[site.coordinator];
  const learned = traits.hidden.filter((t) =>
    world.known.includes(traitKey(siteId, t.id))
  );
  return {
    siteId,
    name: profile.coordinator,
    piName: profile.pi,
    visible: traits.visible.map(asTrait),
    learned: learned.map(asTrait),
    unknown: traits.hidden.length - learned.length,
    visits: visitsTo(world, siteId),
  };
}

function siteVisitReport(
  world: WorldState,
  site: SiteState,
  audited: { before: SiteAuditReport; after: SiteAuditReport } | null
): SiteVisitReport {
  const visit = world.visit!;
  const covered = new Set<SiteFindingField>(
    visit.checks.flatMap((c) => SITE_CHECKS[c].covers)
  );
  const fields = Object.keys(FIELD_LABELS) as SiteFindingField[];
  const findings = audited
    ? fields
        .filter((f) => covered.has(f))
        .map((f) => finding(f, audited.after, audited.before))
    : [];
  const hidden = findings.filter((f) => f.hidden);
  const learned = COORDINATOR_TRAITS[site.coordinator].hidden
    .filter((t) => world.known.includes(traitKey(site.id, t.id)))
    .filter((t) =>
      visit.checks.some(
        (c) => t.revealedBy.includes(c) && visit.number >= t.fromVisit
      )
    )
    .map(asTrait);
  return {
    siteId: site.id,
    siteName: site.name,
    day: visit.day,
    checks: [...visit.checks],
    audited: audited !== null,
    findings,
    unchecked: fields
      .filter((f) => !covered.has(f))
      .map((f) => FIELD_LABELS[f]),
    learned,
    verdict: !audited
      ? "Nothing was checked against the records, so the dashboard still shows what the site reports."
      : hidden.length === 0
        ? "Everything you checked matched what the site reports. Its noise is honesty."
        : `The dashboard was hiding ${plural(hidden.length, "finding")} here: ${hidden.map((f) => f.label.toLowerCase()).join(", ")}.`,
  };
}

/**
 * Ends the visit in progress and writes it up. When any of the site's
 * records were checked, the observations resolve through the domain's
 * `auditSite`: the dashboard shows the site's true state for the audit
 * window, and the write-up names what the dashboard had been hiding.
 * Conversations alone audit nothing. Returns a null report off a visit.
 */
export function closeVisit(world: WorldState): {
  world: WorldState;
  report: SiteVisitReport | null;
} {
  const site = visitedSite(world);
  if (!world.visit || !site)
    return { world: { ...world, visit: null }, report: null };
  const recordsChecked = world.visit.checks.some((c) => SITE_CHECKS[c].records);
  let study = world.study;
  let audited: { before: SiteAuditReport; after: SiteAuditReport } | null =
    null;
  if (recordsChecked) {
    const before = reportedSite(study, site.id);
    const result = auditSite(study, site.id);
    if (result.ok && before) {
      study = result.state;
      audited = { before, after: result.report };
    }
  }
  const report = siteVisitReport(world, site, audited);
  return { world: { ...world, study, visit: null }, report };
}

function arrive(world: WorldState, map: WorldMap, spawn: PlayerState) {
  return {
    ...world,
    map: map.id,
    player: { ...spawn },
    location: roomAt(map, spawn.x, spawn.y)?.id ?? world.location,
  };
}

/** Where the player stands when driving back into the CRO car park. */
const CRO_PARKING_ARRIVAL: PlayerState = (() => {
  const car = CRO_FLOOR.stations.find((s) => s.id === "exit")!;
  return { x: car.x, y: car.y - 1, facing: "down" };
})();

/**
 * Fast travel by car to a site or back to the office. Driving costs its
 * minutes and a point of energy per ten of them. Leaving a site writes the
 * visit up first (see `closeVisit`). Arriving at a site starts a visit and
 * counts it toward learning the coordinator; a site that would be closed by
 * the time the player could do anything there is refused.
 */
export function travel(
  world: WorldState,
  mapId: string
): SiteResult<{ report: SiteVisitReport | null }> {
  if (world.study.status !== "running")
    return { ok: false, reason: "study-complete" };
  const target = WORLD_MAPS[mapId];
  if (!target || target.id === currentMap(world).id)
    return { ok: false, reason: "unknown-site" };
  const site = siteForMap(world.study.sites, mapId);
  if (target.id !== CRO_FLOOR.id && !site)
    return { ok: false, reason: "unknown-site" };
  const minutes = site
    ? travelMinutes(site.id)
    : travelMinutes(world.visit?.siteId ?? "");
  if (site && world.minute + minutes + MIN_VISIT_MINUTES > SITE_CLOSES)
    return { ok: false, reason: "site-closed" };
  const paid = spendCost(world, {
    minutes,
    energy: Math.round(minutes / DRIVE_MINUTES_PER_ENERGY),
    focus: 0,
  });
  if (!paid.ok) return paid;
  const closed = closeVisit(paid.world);
  if (!site)
    return {
      ok: true,
      report: closed.report,
      world: arrive(closed.world, CRO_FLOOR, CRO_PARKING_ARRIVAL),
    };
  const number = visitsTo(closed.world, site.id) + 1;
  const arrived = arrive(closed.world, target, target.spawn);
  return {
    ok: true,
    report: closed.report,
    world: {
      ...arrived,
      known: [
        ...arrived.known,
        `${visitKey(site.id)}${world.study.day}:${world.minute + minutes}`,
      ],
      visit: {
        siteId: site.id,
        mapId: target.id,
        day: world.study.day,
        arrivedAt: arrived.minute,
        number,
        checks: [],
        observations: [],
      },
    },
  };
}

/**
 * Why a check cannot be done right now, or null when it can. Checks happen
 * once per visit, inside the site's hours, while the player has the focus
 * for them; the PI is only in until mid-afternoon.
 */
export function checkBlocker(
  world: WorldState,
  id: SiteCheckId
): SiteRefusal | null {
  if (world.study.status !== "running") return "study-complete";
  if (!world.visit || !visitedSite(world)) return "not-on-visit";
  const c = SITE_CHECKS[id];
  if (world.visit.checks.includes(id)) return "already-checked";
  if (id === "meetPi" && world.minute >= PI_LEAVES) return "pi-unavailable";
  if (world.minute + c.cost.minutes > SITE_CLOSES) return "site-closed";
  if (world.focus < c.cost.focus) return "too-unfocused";
  if (world.energy < c.cost.energy) return "too-tired";
  return null;
}

/**
 * Does one check on the visit in progress. It costs the check's minutes,
 * energy and focus, adds what the player saw to the visit's observations,
 * and may reveal a hidden trait of the coordinator: which traits a check can
 * reveal, and from which visit, is fixed per coordinator.
 */
export function performCheck(
  world: WorldState,
  id: SiteCheckId
): SiteResult<{ observation: SiteObservation; learned: CoordinatorTrait[] }> {
  const blocker = checkBlocker(world, id);
  if (blocker) return { ok: false, reason: blocker };
  const site = visitedSite(world)!;
  const visit = world.visit!;
  const paid = spendCost(world, SITE_CHECKS[id].cost);
  if (!paid.ok) return paid;
  const observation = observe(id, site);
  const learned = revealedBy(site, id, visit.number).filter(
    (t) => !world.known.includes(traitKey(site.id, t.id))
  );
  return {
    ok: true,
    observation,
    learned: learned.map(asTrait),
    world: {
      ...paid.world,
      known: [
        ...paid.world.known,
        ...learned.map((t) => traitKey(site.id, t.id)),
      ],
      visit: {
        ...visit,
        checks: [...visit.checks, id],
        observations: [...visit.observations, observation],
      },
    },
  };
}

const BLOCKER_TEXT: Record<SiteRefusal, string> = {
  "too-late": "It is too late for that. Drive home.",
  "too-tired": "You are too tired for that.",
  "unknown-action": "That cannot be done here.",
  "study-complete": "The study is over.",
  unreachable: "There is no way through to there.",
  "site-closed": `The site closes at ${formatClock(SITE_CLOSES)}; there is not enough of the day left for this.`,
  "not-on-visit": "You are not on a site visit.",
  "already-checked": "Already done on this visit.",
  "too-unfocused":
    "You cannot concentrate on another binder today. Pick something lighter, or leave.",
  "pi-unavailable": `The PI left for clinic at ${formatClock(PI_LEAVES)}. Come earlier next time.`,
  "unknown-site": "There is no site there.",
};

/** A sentence for a refused travel or site action. */
export function siteRefusalText(reason: SiteRefusal): string {
  return BLOCKER_TEXT[reason];
}

function costLine(c: SiteCheck): string {
  return `${c.label}: ${c.cost.minutes} minutes, focus ${c.cost.focus}.`;
}

/** Pressing E at a check station: what the check is and whether it can be done. */
const checkStation: InteractionHandler = (world, target) => {
  if (target.kind !== "station") return null;
  const c = checkAtStation(target.station.id);
  if (!c) return null;
  const blocker = checkBlocker(world, c.id);
  const lines = [target.station.blurb, costLine(c)];
  const site = visitedSite(world);
  if (c.id === "interviewCoordinator" && site) {
    const profile = coordinatorProfile(world, site.id);
    if (profile)
      lines.push(
        `${profile.name} seems ${profile.visible.map((t) => t.label.toLowerCase()).join(" and ")}.`
      );
  }
  const done = world.visit?.observations.find((o) => o.check === c.id);
  if (done) lines.push(`You saw: ${done.text}`);
  else if (blocker) lines.push(BLOCKER_TEXT[blocker]);
  return {
    world,
    title: target.station.name,
    lines,
    tone: blocker && !done ? "bad" : "neutral",
    check: blocker ? undefined : c.id,
  };
};

/** The reception desk: the visit so far. */
const reception: InteractionHandler = (world, target) => {
  if (target.kind !== "station") return null;
  const visit = world.visit;
  if (!visit)
    return {
      world,
      title: target.station.name,
      lines: ["Nobody is expecting you."],
      tone: "neutral",
    };
  const left = Object.values(SITE_CHECKS).filter(
    (c) => !visit.checks.includes(c.id)
  );
  return {
    world,
    title: target.station.name,
    lines: [
      `Visit ${visit.number} to ${siteLabel(world, visit.siteId)}, signed in at ${formatClock(visit.arrivedAt)}. The site closes at ${formatClock(SITE_CLOSES)}.`,
      visit.observations.length === 0
        ? "Nothing checked yet."
        : `${plural(visit.observations.length, "check")} done.`,
      left.length > 0
        ? `Still to look at: ${left.map((c) => c.label.toLowerCase()).join(", ")}.`
        : "You have looked at everything.",
    ],
    tone: "neutral",
  };
};

/** What E does at each site station. */
export const SITE_INTERACTIONS: Record<
  (typeof SITE_STATION_IDS)[number],
  InteractionHandler
> = {
  siteReception: reception,
  coordinator: checkStation,
  consentForms: checkStation,
  screeningLog: checkStation,
  sourceDocuments: checkStation,
  regulatoryBinder: checkStation,
  pi: checkStation,
  drugAccountability: checkStation,
  temperatureLog: checkStation,
};

/**
 * The car: go home, and drive to a site or back to the office. At a site,
 * leaving writes the visit up and resolves it into an audit.
 */
export function carOutcome(world: WorldState): InteractionOutcome {
  const travel = travelOptions(world);
  const lines = [
    world.visit
      ? `It is ${formatClock(world.minute)}. Drive back to the office, on to another site, or home? Leaving writes up the visit.`
      : `It is ${formatClock(world.minute)}. Go home for the night, or drive out to a site? The study keeps running while you are away.`,
  ];
  if (!world.visit && travel.length === 0)
    lines.push(
      `The sites close at ${formatClock(SITE_CLOSES)}; it is too late to drive out to one today.`
    );
  return {
    world,
    title: "Your car",
    lines,
    tone: "neutral",
    offer: "goHome",
    travel,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Reads a saved site visit, or null when it is missing, malformed, or names
 * a site or map that no longer exists. Unknown checks are dropped.
 */
export function readVisit(
  value: unknown,
  study: { sites: readonly SiteState[] }
): SiteVisit | null {
  if (!isObject(value)) return null;
  const { siteId, mapId } = value;
  if (typeof siteId !== "string" || typeof mapId !== "string") return null;
  if (!SITE_MAPS[mapId] || !study.sites.some((s) => s.id === siteId))
    return null;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const checks = Array.isArray(value.checks)
    ? value.checks.filter((c): c is SiteCheckId => c in SITE_CHECKS)
    : [];
  const observations = Array.isArray(value.observations)
    ? value.observations.filter(
        (o): o is SiteObservation =>
          isObject(o) &&
          typeof o.text === "string" &&
          typeof o.check === "string" &&
          o.check in SITE_CHECKS &&
          (o.tone === "good" || o.tone === "bad" || o.tone === "neutral")
      )
    : [];
  return {
    siteId,
    mapId,
    day: Math.max(1, Math.floor(num(value.day, 1))),
    arrivedAt: num(value.arrivedAt, 0),
    number: Math.max(1, Math.floor(num(value.number, 1))),
    checks: [...new Set(checks)],
    observations,
  };
}
