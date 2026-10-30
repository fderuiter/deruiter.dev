"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  PRIORITIES,
  SITE_CHECKS,
  TEAM_INTERACTIONS,
  WORLD_SAVE_KEY,
  answerInterruption,
  guestScene,
  meetGuest,
  choosePriority,
  currentMap,
  delegateDay,
  delegationPreview,
  describeSurroundings,
  driveHome,
  examineSelf,
  excuseAway,
  formatClock,
  forgivingStep,
  hudReadout,
  interact,
  newWorld,
  officeDirectory,
  parseWorld,
  passTime,
  pendingInterruption,
  performCheck,
  placePeople,
  planFor,
  planRoute,
  roomAt,
  roomConditions,
  serializeWorld,
  siteRefusalText,
  startDay,
  step,
  travel,
  type DirectoryEntry,
  type Facing,
  type InteractionOutcome,
  type MorningDigest,
  type OvernightReport,
  type PriorityId,
  type SiteCheckId,
  type SiteVisitReport,
  type TravelOption,
  type WorldRefusal,
  type WorldState,
} from "@/lib/study-director-world";
import {
  studyLength,
  type Difficulty,
  type StudyLength,
  type StudyState,
} from "@/lib/study-director";
import { safeIsAvailable, safeRawStorage } from "@/lib/safe-storage";
import "@/components/study-director/study-director-touch.css";
import { STUDY_DIRECTOR_AUTO_PAUSE_EVENT } from "./auto-pause";
import { followCamera } from "./camera";
import { revealInView } from "./DayCards";
import { cuesBetween, feedbackBetween, type Feedback } from "./feedback-model";
import { hudChanges } from "./hud-model";
import { highlightedTile, type FloorScene } from "./floor-renderer";
import { interactionPrompt, nameplates, todaysTasks } from "./stage-model";
import { useTeamLayer } from "./TeamLayer";
import { DIFFICULTY_TEXT } from "@/components/study-director/DifficultyPicker";
import { KICKOFF_DAY } from "@/components/study-director/career";
import { recordArcadeMilestone } from "@/lib/arcade-achievements";
import { tapDestination } from "./tap-walk";
import { playWorldCue } from "./world-sound";

/** Milliseconds between steps when walking by directory or holding a key. */
const STEP_MS = 110;

const KEY_DIRECTIONS: Record<string, Facing> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

const REFUSALS: Record<WorldRefusal, string> = {
  "too-late": "It is too late to keep working. Go home from here.",
  "too-tired": "You are too tired to keep walking. Go home and rest.",
  "unknown-action": "That cannot be done here.",
  "study-complete": "The study is over.",
  unreachable: "There is no way through to there right now.",
};

/**
 * Refusals that end the working day: past the hard stop or out of energy,
 * the car may be out of reach, so the game offers to go home from where you
 * stand instead of asking for a walk it would refuse (#2184).
 */
const STUCK: Partial<Record<WorldRefusal, string>> = {
  "too-late": "Time to go home",
  "too-tired": "Out of energy",
};

/** A line shown on screen, as well as read out (#2185). */
interface Said {
  text: string;
  tone: "neutral" | "good" | "bad";
  /** Set when the line belongs to a directory walk, so it shows there too. */
  walk?: boolean;
}

function loadWorld(): WorldState | null {
  try {
    if (!safeIsAvailable()) return null;
    return parseWorld(safeRawStorage.getItem(WORLD_SAVE_KEY));
  } catch {
    return null;
  }
}

/** Set once the player has seen the office's first-run help. */
export const INTRO_KEY = "study_director_world_intro_seen";

function introSeen(): boolean {
  try {
    return safeIsAvailable() && safeRawStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

function saveWorld(world: WorldState): void {
  try {
    if (safeIsAvailable())
      safeRawStorage.setItem(WORLD_SAVE_KEY, serializeWorld(world));
  } catch {
    // Storage full or blocked: the run continues unsaved.
  }
}

/** The save is cleared once its finished study has gone to the closeout. */
function clearWorldSave(): void {
  try {
    if (safeIsAvailable()) safeRawStorage.removeItem(WORLD_SAVE_KEY);
  } catch {
    // Storage blocked: nothing was saved.
  }
}

/** The first morning of a new run: the same seed always opens the same way. */
function firstMorning(
  seed: string,
  difficulty: Difficulty,
  length: StudyLength = "full"
) {
  return startDay(newWorld(seed, difficulty, length));
}

/** The first morning a saved run would have had: same seed, difficulty and length. */
function firstMorningOf(saved: WorldState) {
  return firstMorning(
    saved.study.seed,
    saved.study.difficulty ?? "standard",
    studyLength(saved.study.setup)
  );
}

/**
 * True while a saved run is exactly its first morning, nothing done yet, so
 * its difficulty can still be chosen after a reload (#2058).
 */
function untouched(saved: WorldState): boolean {
  const fresh = parseWorld(serializeWorld(firstMorningOf(saved).world));
  return fresh !== null && serializeWorld(fresh) === serializeWorld(saved);
}

/**
 * A saved run to resume, or a new one on its first morning. A run that
 * finished but never reached the closeout (the page was reloaded on the last
 * overnight report) comes back `finished`, so it can go there now (#1936).
 * A run nobody has touched yet comes back `fresh`, so its difficulty can
 * still be picked.
 */
/** A study shared by link (`#mode=world&seed=…&length=…&difficulty=…`), or null (#2191). */
function sharedRun(): {
  seed: string;
  difficulty: Difficulty;
  length: StudyLength;
} | null {
  const hash = window.location.hash;
  const seed = /(?:^#|&)seed=([\w-]{1,60})(?:&|$)/.exec(hash)?.[1];
  if (!seed) return null;
  const difficulty =
    (/(?:^#|&)difficulty=(calm|standard|rescue)(?:&|$)/.exec(hash)?.[1] as
      Difficulty | undefined) ?? "standard";
  const length =
    (/(?:^#|&)length=(short|full)(?:&|$)/.exec(hash)?.[1] as
      StudyLength | undefined) ?? "full";
  return { seed, difficulty, length };
}

/**
 * The shared seed is used once; a reload resumes the saved run. Call it only
 * once that run is saved (#2251).
 */
function dropSharedRun(): void {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#mode=world`
  );
}

function openWorld(): {
  world: WorldState;
  digest: MorningDigest | null;
  finished?: boolean;
  fresh?: boolean;
  /** A shared link was set aside for a study already under way (#2191). */
  sharedWaiting?: boolean;
} {
  const saved = loadWorld();
  const shared = sharedRun();
  if (saved && saved.study.status === "complete") {
    return {
      world: saved,
      digest: null,
      finished: true,
      sharedWaiting: shared !== null,
    };
  }
  if (saved && saved.study.status === "running" && !untouched(saved)) {
    return {
      ...(saved.location === "home"
        ? startDay(saved)
        : { world: saved, digest: null }),
      sharedWaiting: shared !== null && shared.seed !== saved.study.seed,
    };
  }
  if (shared) {
    // The shared run's first morning is saved before the link is dropped, so
    // an office that mounts again (StrictMode, or the cabinet's launch)
    // resumes it instead of finding neither a seed nor a save (#2251).
    const opening = firstMorning(shared.seed, shared.difficulty, shared.length);
    saveWorld(opening.world);
    dropSharedRun();
    return { ...opening, fresh: true };
  }
  if (saved && saved.study.status === "running")
    return { ...firstMorningOf(saved), fresh: true };
  const seed = `sdw-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return { ...firstMorning(seed, "standard"), fresh: true };
}

interface Walk {
  entryId: string;
  /** The place walked to, for a walk to a tapped tile the directory does not list. */
  entry: DirectoryEntry;
  label: string;
  steps: Facing[];
  facing: Facing;
  /** Minutes spent waiting for someone to move out of the way. */
  waits?: number;
}

/** Minutes a walk waits for someone to get out of the way before giving up. */
const MAX_WAITS = 8;

/**
 * The way to a place. People in a doorway block it, so when there is no way
 * round them the route goes through them and the walk waits for them to move
 * on instead of refusing (#1835).
 */
function routeAround(
  from: Parameters<typeof planRoute>[0],
  target: Parameters<typeof planRoute>[1],
  map: Parameters<typeof planRoute>[2],
  people: Parameters<typeof planRoute>[3]
) {
  return (
    planRoute(from, target, map, people) ?? planRoute(from, target, map, [])
  );
}

/** What the session reads from the page, supplied by the view (ADR 0062). */
interface StudyDirectorWorldSessionOptions {
  readonly onExit: () => void;
  /** Hands a finished study to the classic closeout: report, verdict, share card. */
  readonly onCloseout?: (study: StudyState, world: WorldState) => void;
  /** Called once when a new run leaves its untouched first morning (#2191). */
  readonly onStart?: () => void;
  /** Whether the office runs in the touch cabinet (ADR 0061). */
  readonly touch: boolean;
}

/**
 * The Study Director office session (#3437): the world, its day clock and
 * walks, the morning and overnight cards, the team layer and the handlers
 * the office calls. Moved verbatim from StudyDirectorWorld.tsx; the office
 * renders what it returns.
 */
export function useStudyDirectorWorldSession(
  options: StudyDirectorWorldSessionOptions
) {
  const { onExit, onCloseout, onStart, touch } = options;
  const [opened] = useState(openWorld);
  const [world, setWorld] = useState<WorldState>(opened.world);
  const [digest, setDigest] = useState<MorningDigest | null>(opened.digest);
  const [outcome, setOutcome] = useState<InteractionOutcome | null>(null);
  const [report, setReport] = useState<OvernightReport | null>(null);
  const [walk, setWalk] = useState<Walk | null>(null);
  const [visitReport, setVisitReport] = useState<SiteVisitReport | null>(null);
  const [notice, setNotice] = useState("");
  // The latest result or refusal, visible on the stage (#2185).
  const [said, setSaid] = useState<Said | null>(null);
  // First-run help (#1819); the Controls button reopens it.
  const [showIntro, setShowIntro] = useState(() => !introSeen());
  // A resumed run that has moved on from its first morning has acted
  // already: the day-1 goal went back to "walk to the EDC" on reload (#2187).
  const [acted, setActed] = useState(() => !opened.fresh);
  // The first morning of a new run, while nothing has changed it: its
  // difficulty can still be chosen (#2058). Any change to the world ends that.
  const [freshWorld, setFreshWorld] = useState<WorldState | null>(
    opened.fresh ? opened.world : null
  );
  const choosing = freshWorld !== null && world === freshWorld;
  // The career counts a new run once it is under way, not when it opens.
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current || freshWorld === null || world === freshWorld) return;
    counted.current = true;
    onStart?.();
  }, [world, freshWorld, onStart]);
  // Three weeks in earns Study Kickoff, as its text says (#2191).
  const studyDay = world.study.day;
  useEffect(() => {
    if (studyDay >= KICKOFF_DAY)
      recordArcadeMilestone("study-director", "first_weeks");
  }, [studyDay]);
  const difficulty: Difficulty = world.study.difficulty ?? "standard";
  const length: StudyLength = studyLength(world.study.setup);
  // Delegating the day asks first: it cannot be taken back (#2092).
  const [confirmDelegate, setConfirmDelegate] = useState(false);
  const playfieldRef = useRef<HTMLDivElement>(null);
  const lastStep = useRef(0);

  // The map the player is on: the CRO floor, or a site on a visit (#1690).
  const map = currentMap(world);
  const onSite = world.visit != null;
  const people = useMemo(() => placePeople(world, map), [world, map]);
  const refocus = useCallback(
    () => playfieldRef.current?.focus({ preventScroll: true }),
    []
  );
  /** Says a line aloud and on screen (#2185). */
  const show = useCallback(
    (text: string, tone: Said["tone"] = "neutral", walk = false) => {
      setNotice(text);
      setSaid({ text, tone, walk });
    },
    []
  );
  /**
   * A refusal, seen as well as heard. Past the hard stop or out of energy it
   * also offers to go home from here, since the car may be out of reach
   * (#2184).
   */
  const stuckOutcome = useRef<InteractionOutcome | null>(null);
  const refuseWith = useCallback(
    (reason: WorldRefusal, text: string = REFUSALS[reason], walk = false) => {
      show(text, "bad", walk);
      const title = STUCK[reason];
      if (!title || world.study.status !== "running") return;
      setWalk(null);
      const stuck: InteractionOutcome = {
        world,
        title,
        lines: [text, "Going home now ends the day where you stand."],
        tone: "bad",
        offer: "goHome",
      };
      stuckOutcome.current = stuck;
      setOutcome(stuck);
    },
    [show, world]
  );
  const team = useTeamLayer({
    world,
    setWorld,
    announce: setNotice,
    refuse: refuseWith,
    refocus,
  });
  const { study, coffees, fatigue } = world;
  // The office tells the story of the study (#1691).
  const conditions = useMemo(
    () => roomConditions(map, { study, coffees, fatigue }),
    [map, study, coffees, fatigue]
  );
  const directory = useMemo(() => officeDirectory(map, people), [map, people]);
  const description = useMemo(
    () => describeSurroundings(world, map, people, conditions),
    [world, map, people, conditions]
  );
  const scene = useMemo<FloorScene>(
    () => ({
      map,
      player: world.player,
      people,
      conditions,
      target: highlightedTile(map, world.player, people),
      minute: world.minute,
    }),
    [map, world.player, people, conditions, world.minute]
  );
  const hud = useMemo(() => hudReadout(world), [world]);
  const prompt = useMemo(
    () => interactionPrompt(map, world.player, people),
    [map, world.player, people]
  );
  const plates = useMemo(
    () => nameplates(map, world.player, people, prompt),
    [map, world.player, people, prompt]
  );
  const tasks = useMemo(() => todaysTasks(world), [world]);
  // Where the camera rests: the same view the canvas settles on.
  const view = useMemo(
    () => followCamera(world.player, map),
    [world.player, map]
  );
  const [showMap, setShowMap] = useState(true);
  // Key changes to the HUD are spoken once, in their own live region so they
  // never talk over what an action just said.
  const [hudNotice, setHudNotice] = useState("");
  const lastHud = useRef({ hud, minute: world.minute });
  useEffect(() => {
    const prev = lastHud.current;
    lastHud.current = { hud, minute: world.minute };
    const said = hudChanges(prev.hud, hud, prev.minute, world.minute);
    if (said.length > 0) setHudNotice(said.join(" "));
  }, [hud, world.minute]);
  // Sounds and small toasts follow what changed, once per change; both are
  // decoration on top of the live regions (#1836).
  const [toasts, setToasts] = useState<Feedback[]>([]);
  const lastWorld = useRef(world);
  useEffect(() => {
    const prev = lastWorld.current;
    lastWorld.current = world;
    if (prev === world) return;
    for (const cue of cuesBetween(prev, world)) playWorldCue(cue);
    const fresh = feedbackBetween(prev, world);
    if (fresh.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToasts((now) => [...now, ...fresh].slice(-4));
    const ids = new Set(fresh.map((f) => f.id));
    window.setTimeout(
      () => setToasts((now) => now.filter((f) => !ids.has(f.id))),
      3200
    );
  }, [world]);
  const away = report !== null;

  /** Starts the untouched run again from its first morning, same seed. */
  const restartFresh = useCallback(
    (next: Difficulty, nextLength: StudyLength, said: string) => {
      const morning = firstMorning(world.study.seed, next, nextLength);
      // A new starting point, not a change the player made: nothing to
      // toast or announce.
      lastWorld.current = morning.world;
      lastHud.current = {
        hud: hudReadout(morning.world),
        minute: morning.world.minute,
      };
      setFreshWorld(morning.world);
      setWorld(morning.world);
      setDigest(morning.digest);
      setNotice(said);
    },
    [world.study.seed]
  );

  /** Starts the untouched run again on the chosen difficulty, same seed. */
  const chooseDifficulty = useCallback(
    (next: Difficulty) => {
      if (!choosing || next === difficulty) return;
      restartFresh(
        next,
        length,
        `Study conditions: ${DIFFICULTY_TEXT[next].label}.`
      );
    },
    [choosing, difficulty, length, restartFresh]
  );

  /** Starts the untouched run again as the short or full study (#2092). */
  const chooseLength = useCallback(
    (next: StudyLength) => {
      if (!choosing || next === length) return;
      restartFresh(
        difficulty,
        next,
        next === "short" ? "Short study chosen." : "Full study chosen."
      );
    },
    [choosing, difficulty, length, restartFresh]
  );
  const here = useMemo(() => {
    const room = roomAt(map, world.player.x, world.player.y);
    return room ? people.filter((p) => p.room === room.id) : [];
  }, [map, people, world.player.x, world.player.y]);
  const inConference =
    !onSite && roomAt(map, world.player.x, world.player.y)?.id === "conference";

  const move = useCallback(
    (dir: Facing) => {
      const result = forgivingStep(world, dir, map, people);
      if (!result.ok) {
        refuseWith(result.reason);
        return;
      }
      // A meeting in progress keeps you in the conference room: walking out
      // used to leave it running with its controls gone (#2186).
      if (
        world.meeting &&
        result.moved &&
        roomAt(map, result.world.player.x, result.world.player.y)?.id !==
          "conference"
      ) {
        show(
          world.meeting.kind === "sponsor"
            ? "The sponsor is still on the line. End the call before you leave the room."
            : "The meeting is still going. End it before you leave the room.",
          "bad"
        );
        return;
      }
      if (result.moved) setSaid(null);
      setWorld(result.world);
      if (result.moved)
        team.catchUp(
          result.world,
          placePeople(result.world, currentMap(result.world))
        );
      if (result.world.location !== world.location) {
        const room = roomAt(map, result.world.player.x, result.world.player.y);
        if (room) setNotice(room.name);
      }
    },
    [world, map, people, team, refuseWith, show]
  );

  const pressE = useCallback(() => {
    const result = interact(world, map, people, TEAM_INTERACTIONS);
    if (!result) {
      setNotice("Nothing in front of you to use.");
      return;
    }
    // Anything used counts, including the EDC, desk and people that open
    // through the team layer: the day-1 "go to the EDC" goal went stale
    // after the player did exactly that (#1936).
    setActed(true);
    if (team.open(result)) {
      setOutcome(null);
      setDigest(null);
      return;
    }
    setWorld(result.world);
    setOutcome(result);
    setDigest(null);
    setNotice(`${result.title}. ${result.lines.join(" ")}`);
  }, [world, map, people, team]);

  const drive = useCallback(
    (option: TravelOption) => {
      const result = travel(world, option.mapId);
      if (!result.ok) {
        setNotice(siteRefusalText(result.reason));
        return;
      }
      setWorld(result.world);
      setOutcome(null);
      setWalk(null);
      setDigest(null);
      if (result.report) setVisitReport(result.report);
      const arrived = currentMap(result.world);
      setNotice(
        `You drove ${option.minutes} minutes and arrived at ${arrived.name ?? "the office car park"}. It is ${formatClock(result.world.minute)}.`
      );
      playfieldRef.current?.focus({ preventScroll: true });
    },
    [world]
  );

  const doCheck = useCallback(
    (id: SiteCheckId) => {
      const result = performCheck(world, id);
      if (!result.ok) {
        setNotice(siteRefusalText(result.reason));
        return;
      }
      const lines = [
        result.observation.text,
        ...result.learned.map((t) => `You learned: ${t.label}. ${t.detail}`),
      ];
      setWorld(result.world);
      setOutcome({
        world: result.world,
        title: SITE_CHECKS[id].label,
        lines,
        tone: result.observation.tone,
      });
      setNotice(`${SITE_CHECKS[id].label}. ${lines.join(" ")}`);
      playfieldRef.current?.focus({ preventScroll: true });
    },
    [world]
  );

  /** Asks yourself how it is going. It is fine. */
  const lookAtSelf = useCallback(() => {
    const result = examineSelf(world);
    setOutcome(result);
    setDigest(null);
    setNotice(`${result.title}. ${result.lines.join(" ")}`);
  }, [world]);

  const walkTo = useCallback(
    (entry: DirectoryEntry) => {
      const route = routeAround(world.player, entry.target, map, people);
      if (!route) {
        show(REFUSALS.unreachable, "bad", true);
        return;
      }
      setOutcome(null);
      setNotice(
        `Walking to ${entry.label}, about ${Math.max(1, Math.round(route.minutes))} minutes.`
      );
      setWalk({
        entryId: entry.id,
        entry,
        label: entry.label,
        steps: route.steps,
        facing: route.facing,
      });
    },
    [world.player, map, people, show]
  );

  /** What a directory walk would cost, worked out only for the entries shown. */
  const minutesTo = useCallback(
    (entry: DirectoryEntry) =>
      routeAround(world.player, entry.target, map, people)?.minutes ?? null,
    [world.player, map, people]
  );

  /** A tap on the floor: walk to the person, station or tile under the finger. */
  const tapFloor = useCallback(
    (fx: number, fy: number) => {
      const entry = tapDestination({ map, people, directory, view, fx, fy });
      if (!entry) {
        setNotice("There is no way to walk there.");
        return;
      }
      walkTo(entry);
    },
    [map, people, directory, view, walkTo]
  );

  const plan = planFor(world);
  // Today's priority can be picked until midday; after that the day has told you.
  const morning = world.minute < 12 * 60 && world.location !== "home";
  const interruption = useMemo(() => pendingInterruption(world), [world]);

  // An interruption is announced once when it lands.
  const announcedInterruption = useRef<string | null>(null);
  useEffect(() => {
    const id = interruption?.id ?? null;
    if (id && id !== announcedInterruption.current && interruption)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice(`Just now: ${interruption.title}. ${interruption.body}`);
    announcedInterruption.current = id;
  }, [interruption]);

  const guest = useMemo(() => guestScene(world), [world]);

  // A visitor is announced once when they arrive.
  const announcedGuest = useRef<string | null>(null);
  useEffect(() => {
    const id = guest?.id ?? null;
    if (id && id !== announcedGuest.current && guest)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotice(`${guest.title}. ${guest.body[0]}`);
    announcedGuest.current = id;
  }, [guest]);

  const meet = useCallback(
    (optionId: string) => {
      const result = meetGuest(world, optionId);
      if (!result.ok) {
        refuseWith(result.reason);
        return;
      }
      // What came up while the visitor had you is excused (#2189).
      setWorld(excuseAway(result.world));
      show(result.result);
      refocus();
    },
    [world, refocus, refuseWith, show]
  );

  const pickPriority = useCallback(
    (id: PriorityId) => {
      const result = choosePriority(world, id);
      if (!result.ok) {
        refuseWith(result.reason);
        return;
      }
      setWorld(result.world);
      setNotice(
        `Today is about: ${PRIORITIES[id].label}. ${PRIORITIES[id].promise}`
      );
      refocus();
    },
    [world, refocus, refuseWith]
  );

  const answer = useCallback(
    (optionId: string) => {
      const result = answerInterruption(world, optionId);
      if (!result.ok) {
        refuseWith(result.reason);
        return;
      }
      setWorld(result.world);
      // A card left open beside it, such as the car's, was written before
      // the answer; close it rather than leave it saying the message waits.
      setOutcome(null);
      show(result.result);
      refocus();
    },
    [world, refocus, refuseWith, show]
  );

  const leave = useCallback(() => {
    // Driving home from a site writes the visit up first, and excuses what
    // came while you were there (#2334).
    const night = driveHome(world);
    if (night.visit) setVisitReport(night.visit);
    setWorld(night.world);
    setReport(night.report);
    setOutcome(null);
    setWalk(null);
    setNotice(
      night.report.complete
        ? "The study is complete."
        : `You went home. Overnight report for day ${night.report.day}.`
    );
  }, [world]);

  /**
   * Hands the whole day to the team (#2092): they settle the inbox without
   * you, at a cost to trust and quality, and the overnight report says what
   * they did.
   */
  const handOver = useCallback(() => {
    setConfirmDelegate(false);
    const result = delegateDay(world);
    if (!result.ok) {
      refuseWith(result.reason);
      return;
    }
    setActed(true);
    if (result.visit) setVisitReport(result.visit);
    setWorld(result.world);
    setReport(result.report);
    setOutcome(null);
    setWalk(null);
    setDigest(null);
    setNotice(
      result.report.complete
        ? "The team ran the last day. The study is complete."
        : `The team ran day ${result.report.day} without you. Overnight report for day ${result.report.day}.`
    );
  }, [world, refuseWith]);
  const delegation = delegationPreview(world);

  // An outcome card (the car's Drive / Go home, a refusal that ends the day,
  // a desk result) is brought fully into view, whether it opened off the top
  // of the page after a directory walk (#1936) or below the fold (#2252). It
  // waits for a dialog over the floor to close. Past the hard stop or out of
  // energy every step is refused, so that card's Go home takes focus; any
  // other card, the car's included, leaves the keys on the floor to walk
  // away with, and is the first stop on Tab from it.
  const outcomeRef = useRef<HTMLElement>(null);
  const goHomeRef = useRef<HTMLButtonElement>(null);
  const focusedOutcome = useRef<InteractionOutcome | null>(null);
  const blocking = team.blocking;
  useEffect(() => {
    if (!outcome || blocking) return;
    revealInView(outcomeRef.current);
    if (
      outcome === stuckOutcome.current &&
      !touch &&
      focusedOutcome.current !== outcome
    ) {
      focusedOutcome.current = outcome;
      goHomeRef.current?.focus({ preventScroll: true });
    }
  }, [outcome, blocking, touch]);

  // An interruption or a visitor landing is brought into view the same way,
  // once any dialog over the floor has closed (#2252).
  const cardsRef = useRef<HTMLDivElement>(null);
  const landed = interruption?.id ?? guest?.id ?? null;
  useEffect(() => {
    if (landed && !blocking) revealInView(cardsRef.current);
  }, [landed, blocking]);

  // The finished study goes to the closeout, which files it in the career.
  const closedOut = useRef(false);
  const finishRun = useCallback(() => {
    closedOut.current = true;
    clearWorldSave();
    if (onCloseout) onCloseout(world.study, world);
    else onExit();
  }, [onCloseout, onExit, world]);

  // Reopening a finished run goes straight to its closeout.
  const resumedFinished = useRef(opened.finished === true);
  useEffect(() => {
    if (!resumedFinished.current) return;
    resumedFinished.current = false;
    finishRun();
  }, [finishRun]);

  const nextMorning = useCallback(() => {
    const morning = startDay(world);
    setWorld(morning.world);
    setDigest(morning.digest);
    setReport(null);
    setConfirmDelegate(false);
    setVisitReport(null);
    setSaid(null);
    setNotice(
      `${morning.digest.weekday}, day ${morning.digest.day}. You start at ${formatClock(morning.digest.startsAt)}.`
    );
    playfieldRef.current?.focus({ preventScroll: true });
  }, [world]);

  /** An arrow button: like the key, it ends a directory walk and takes a step. */
  const stepBy = (dir: Facing) => {
    setWalk(null);
    move(dir);
  };
  const pressUse = () => {
    setWalk(null);
    pressE();
  };
  const selfNow = () => {
    setWalk(null);
    lookAtSelf();
  };

  // The cabinet reports a hidden tab, a blur or a turned device: a walk in
  // progress stops where it is. Nothing else in the office runs on its own.
  const walking = walk !== null;
  useEffect(() => {
    if (!walking) return;
    const stop = () => {
      setWalk(null);
      setNotice("Paused. You stopped walking.");
    };
    window.addEventListener(STUDY_DIRECTOR_AUTO_PAUSE_EVENT, stop);
    return () =>
      window.removeEventListener(STUDY_DIRECTOR_AUTO_PAUSE_EVENT, stop);
  }, [walking]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (
      showIntro ||
      away ||
      team.blocking ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey
    )
      return;
    const dir =
      KEY_DIRECTIONS[e.key] ?? KEY_DIRECTIONS[e.key.toLowerCase()] ?? null;
    if (dir) {
      e.preventDefault();
      setWalk(null);
      const now = performance.now();
      if (e.repeat && now - lastStep.current < STEP_MS) return;
      lastStep.current = now;
      move(dir);
    } else if (e.key === "e" || e.key === "E") {
      e.preventDefault();
      setWalk(null);
      pressE();
    } else if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      setWalk(null);
      lookAtSelf();
    } else if (e.key === "Escape" && outcome) {
      e.preventDefault();
      setOutcome(null);
    }
  };

  useEffect(() => {
    // A run handed to the closeout stays cleared.
    if (closedOut.current) return;
    saveWorld(world);
  }, [world]);

  // Directory walks: one step per tick, so the clock and the view advance
  // together and an arrow key can interrupt. A ringing phone or someone
  // stopping you ends the walk; someone in the way gets walked around.
  useEffect(() => {
    if (!walk) return;
    const id = window.setTimeout(() => {
      if (team.blocking) {
        setWalk(null);
        return;
      }
      // Someone walking their schedule moves while you walk to them, so the
      // way to a person is worked out again at every step.
      const entry = directory.find((d) => d.id === walk.entryId) ?? walk.entry;
      const live =
        entry && entry.target.kind === "person"
          ? routeAround(world.player, entry.target, map, people)
          : null;
      const steps = live ? live.steps : walk.steps;
      const facing = live ? live.facing : walk.facing;
      if (steps.length === 0) {
        setWorld((w) => ({
          ...w,
          player: { ...w.player, facing },
        }));
        setWalk(null);
        setNotice(`Arrived at ${walk.label}.`);
        playfieldRef.current?.focus({ preventScroll: true });
        return;
      }
      const [dir, ...rest] = steps;
      const result = step(world, dir, map, people);
      if (result.ok && !result.moved) {
        const detour = entry
          ? planRoute(world.player, entry.target, map, people)
          : null;
        if (detour && detour.steps.length > 0 && detour.steps[0] !== dir) {
          setWalk({ ...walk, steps: detour.steps, facing: detour.facing });
          return;
        }
        // Nobody to walk round: excuse yourself and wait a minute for them
        // to move on, up to a point.
        const waits = walk.waits ?? 0;
        if (waits < MAX_WAITS) {
          const waited = passTime(world, 1);
          if (waited.ok) {
            setWorld(waited.world);
            show("Someone is in the way. Waiting a minute.", "neutral", true);
            setWalk({ ...walk, steps, facing, waits: waits + 1 });
            return;
          }
        }
      }
      if (!result.ok || !result.moved) {
        setWalk(null);
        if (result.ok) show("Someone is in the way.", "bad", true);
        else refuseWith(result.reason, REFUSALS[result.reason], true);
        return;
      }
      setWorld(result.world);
      if (
        team.catchUp(
          result.world,
          placePeople(result.world, currentMap(result.world))
        )
      ) {
        setWalk(null);
        return;
      }
      setWalk({ ...walk, steps: rest, facing });
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [walk, world, map, people, team, directory, show, refuseWith]);

  // A shared link waits while a study is under way, and says so (#2191).
  const [sharedHeld, setSharedHeld] = useState(opened.sharedWaiting === true);

  return {
    acted,
    answer,
    away,
    cardsRef,
    chooseDifficulty,
    chooseLength,
    choosing,
    confirmDelegate,
    delegation,
    description,
    difficulty,
    digest,
    directory,
    doCheck,
    drive,
    finishRun,
    goHomeRef,
    guest,
    handOver,
    here,
    hud,
    hudNotice,
    inConference,
    interruption,
    leave,
    length,
    lookAtSelf,
    map,
    meet,
    minutesTo,
    morning,
    nextMorning,
    notice,
    onKeyDown,
    onSite,
    outcome,
    outcomeRef,
    people,
    pickPriority,
    plan,
    plates,
    playfieldRef,
    pressUse,
    prompt,
    report,
    said,
    scene,
    selfNow,
    setConfirmDelegate,
    setOutcome,
    setSharedHeld,
    setShowIntro,
    setShowMap,
    setVisitReport,
    sharedHeld,
    showIntro,
    showMap,
    stepBy,
    tapFloor,
    tasks,
    team,
    toasts,
    view,
    visitReport,
    walk,
    walkTo,
    world,
  };
}
