"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  SITE_CHECKS,
  TEAM_INTERACTIONS,
  WORLD_SAVE_KEY,
  closeVisit,
  currentMap,
  describePerson,
  describeSurroundings,
  examineSelf,
  formatClock,
  goHome,
  hudReadout,
  interact,
  newWorld,
  officeDirectory,
  parseWorld,
  performCheck,
  placePeople,
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
  type SiteCheckId,
  type SiteVisitReport,
  type TravelOption,
  type WorldRefusal,
  type WorldState,
} from "@/lib/study-director-world";
import type { StudyState } from "@/lib/study-director";
import { safeIsAvailable, safeRawStorage } from "@/lib/safe-storage";
import { DigestCard, OvernightCard } from "./DayCards";
import { FloorView } from "./FloorView";
import { hudChanges } from "./hud-model";
import { highlightedTile, type FloorScene } from "./floor-renderer";
import { OfficeDirectory } from "./OfficeDirectory";
import { SiteVisitPanel, SiteVisitReportPanel } from "./SiteVisitPanel";
import { MeetingSection, TeamOverlay, useTeamLayer } from "./TeamLayer";
import { WorldHud } from "./WorldHud";
import { useReducedMotion } from "./use-reduced-motion";
import { WorldIntro } from "./WorldIntro";

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
  "too-late": "It is too late to keep working. Go to your car and go home.",
  "too-tired": "You are too tired to keep walking. Have a coffee or go home.",
  "unknown-action": "That cannot be done here.",
  "study-complete": "The study is over.",
  unreachable: "There is no way through to there right now.",
};

function loadWorld(): WorldState | null {
  try {
    if (!safeIsAvailable()) return null;
    return parseWorld(safeRawStorage.getItem(WORLD_SAVE_KEY));
  } catch {
    return null;
  }
}

const INTRO_KEY = "study_director_world_intro_seen";

function introSeen(): boolean {
  try {
    return safeIsAvailable() && safeRawStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

function markIntroSeen(): void {
  try {
    if (safeIsAvailable()) safeRawStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Storage blocked: the help shows again next visit.
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

/** A saved run to resume, or a new one on its first morning. */
function openWorld(): { world: WorldState; digest: MorningDigest | null } {
  const saved = loadWorld();
  if (saved && saved.study.status === "running") {
    return saved.location === "home"
      ? startDay(saved)
      : { world: saved, digest: null };
  }
  const seed = `sdw-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return startDay(newWorld(seed, "standard"));
}

interface Walk {
  entryId: string;
  label: string;
  steps: Facing[];
  facing: Facing;
}

const TONE_CLASS = {
  good: "border-[var(--sd-emerald)]/50",
  bad: "border-[var(--sd-red)]/60",
  neutral: "border-[var(--sd-hairline-strong)]",
} as const;

/**
 * Study Director's world (ADR 0055): the walkable CRO floor, a HUD and the
 * office directory. The rules live in `lib/study-director-world`; this is
 * a thin adapter that turns keys and buttons into world calls and draws the
 * result.
 */
export const StudyDirectorWorld: React.FC<{
  onExit: () => void;
  /** Hands a finished study to the classic closeout: report, verdict, share card. */
  onCloseout?: (study: StudyState) => void;
}> = ({ onExit, onCloseout }) => {
  const [opened] = useState(openWorld);
  const [world, setWorld] = useState<WorldState>(opened.world);
  const [digest, setDigest] = useState<MorningDigest | null>(opened.digest);
  const [outcome, setOutcome] = useState<InteractionOutcome | null>(null);
  const [report, setReport] = useState<OvernightReport | null>(null);
  const [walk, setWalk] = useState<Walk | null>(null);
  const [visitReport, setVisitReport] = useState<SiteVisitReport | null>(null);
  const [notice, setNotice] = useState("");
  // First-run help (#1819); the Controls button reopens it.
  const [showIntro, setShowIntro] = useState(() => !introSeen());
  const [acted, setActed] = useState(false);
  const reducedMotion = useReducedMotion();
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
  const team = useTeamLayer({
    world,
    setWorld,
    announce: setNotice,
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
  const away = report !== null;
  const here = useMemo(() => {
    const room = roomAt(map, world.player.x, world.player.y);
    return room ? people.filter((p) => p.room === room.id) : [];
  }, [map, people, world.player.x, world.player.y]);
  const inConference =
    !onSite && roomAt(map, world.player.x, world.player.y)?.id === "conference";

  const move = useCallback(
    (dir: Facing) => {
      const result = step(world, dir, map, people);
      if (!result.ok) {
        setNotice(REFUSALS[result.reason]);
        return;
      }
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
    [world, map, people, team]
  );

  const pressE = useCallback(() => {
    const result = interact(world, map, people, TEAM_INTERACTIONS);
    if (!result) {
      setNotice("Nothing in front of you to use.");
      return;
    }
    if (team.open(result)) {
      setOutcome(null);
      setDigest(null);
      return;
    }
    setWorld(result.world);
    setOutcome(result);
    setDigest(null);
    setActed(true);
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
      const route = planRoute(world.player, entry.target, map, people);
      if (!route) {
        setNotice(REFUSALS.unreachable);
        return;
      }
      setOutcome(null);
      setNotice(
        `Walking to ${entry.label}, about ${Math.max(1, Math.round(route.minutes))} minutes.`
      );
      setWalk({
        entryId: entry.id,
        label: entry.label,
        steps: route.steps,
        facing: route.facing,
      });
    },
    [world.player, map, people]
  );

  const leave = useCallback(() => {
    // Driving home from a site writes the visit up first.
    const closed = closeVisit(world);
    if (closed.report) setVisitReport(closed.report);
    const night = goHome(closed.world);
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

  const nextMorning = useCallback(() => {
    const morning = startDay(world);
    setWorld(morning.world);
    setDigest(morning.digest);
    setReport(null);
    setVisitReport(null);
    setNotice(
      `${morning.digest.weekday}, day ${morning.digest.day}. You start at ${formatClock(morning.digest.startsAt)}.`
    );
    playfieldRef.current?.focus({ preventScroll: true });
  }, [world]);

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
      if (walk.steps.length === 0) {
        setWorld((w) => ({
          ...w,
          player: { ...w.player, facing: walk.facing },
        }));
        setWalk(null);
        setNotice(`Arrived at ${walk.label}.`);
        playfieldRef.current?.focus({ preventScroll: true });
        return;
      }
      const [dir, ...rest] = walk.steps;
      const result = step(world, dir, map, people);
      if (result.ok && !result.moved) {
        const entry = directory.find((d) => d.id === walk.entryId);
        const detour = entry
          ? planRoute(world.player, entry.target, map, people)
          : null;
        if (detour && detour.steps.length > 0 && detour.steps[0] !== dir) {
          setWalk({ ...walk, steps: detour.steps, facing: detour.facing });
          return;
        }
      }
      if (!result.ok || !result.moved) {
        setWalk(null);
        setNotice(
          result.ok ? "Someone is in the way." : REFUSALS[result.reason]
        );
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
      setWalk({ ...walk, steps: rest });
    }, STEP_MS);
    return () => window.clearTimeout(id);
  }, [walk, world, map, people, team, directory]);

  const panel = report ? (
    <OvernightCard
      report={report}
      nextDay={world.study.day}
      onNextDay={nextMorning}
      onCloseout={() => (onCloseout ? onCloseout(study) : onExit())}
      closeoutLabel={
        onCloseout ? "See the closeout" : "Switch to the classic desk"
      }
    />
  ) : outcome ? (
    <section
      aria-labelledby="sd-world-outcome"
      data-testid="world-outcome"
      className={`border p-3 ${TONE_CLASS[outcome.tone]}`}
    >
      <h3 id="sd-world-outcome" className="text-sm font-bold">
        {outcome.title}
      </h3>
      <ul className="mt-1 space-y-1 text-xs text-zinc-200">
        {outcome.lines.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        {outcome.check ? (
          <button
            type="button"
            onClick={() => outcome.check && doCheck(outcome.check)}
            className="min-h-[40px] border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-3 text-xs font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
          >
            {SITE_CHECKS[outcome.check].label},{" "}
            {SITE_CHECKS[outcome.check].cost.minutes} minutes
          </button>
        ) : null}
        {(outcome.travel ?? []).map((option) => (
          <button
            key={option.mapId}
            type="button"
            onClick={() => drive(option)}
            className="min-h-[40px] border border-[var(--sd-amber)]/70 px-3 text-xs font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
          >
            {option.label}, {option.minutes} minutes
          </button>
        ))}
        {outcome.offer === "goHome" ? (
          <button
            type="button"
            onClick={leave}
            className="min-h-[40px] border border-[var(--sd-amber)] bg-[var(--sd-amber)]/10 px-3 text-xs font-bold text-amber-300 hover:bg-[var(--sd-amber)]/20 active:scale-[0.98]"
          >
            Go home
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setOutcome(null);
            playfieldRef.current?.focus({ preventScroll: true });
          }}
          className="min-h-[40px] border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)]"
        >
          {outcome.offer === "goHome"
            ? "Stay"
            : outcome.check
              ? "Not now"
              : "Close"}
        </button>
      </div>
    </section>
  ) : digest ? (
    <DigestCard digest={digest} />
  ) : null;

  return (
    <div
      data-sd-world=""
      className="space-y-3 bg-[var(--sd-bg)] p-2 font-mono text-[var(--sd-text)] sm:p-3"
    >
      <div role="status" aria-live="polite" className="sr-only">
        {notice}
      </div>
      <div
        role="status"
        aria-live="polite"
        data-testid="world-hud-notice"
        className="sr-only"
      >
        {hudNotice}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold tracking-[-0.01em]">
          {map.name ? `${map.name} visit` : "The CRO floor"}
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowIntro(true)}
            className="min-h-12 border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)] hover:text-[var(--sd-amber)]"
          >
            Controls
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-12 border border-zinc-700 px-3 text-xs text-zinc-300 hover:border-[var(--sd-amber)] hover:text-[var(--sd-amber)]"
          >
            Switch to the classic desk
          </button>
        </div>
      </div>
      <WorldHud
        hud={hud}
        minute={world.minute}
        goal={
          !acted && world.study.day === 1 && !onSite && !away
            ? "walk to the EDC workstation in your office and press E."
            : null
        }
      />

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)] xl:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div
          ref={playfieldRef}
          tabIndex={0}
          role="group"
          aria-label={`${onSite ? `${map.name ?? "Site"} map` : "Office floor"}. Arrow keys or W A S D walk; E uses what you face; F asks how you are.`}
          aria-describedby="sd-world-room"
          data-keyboard-boundary="true"
          data-testid="world-playfield"
          onKeyDown={onKeyDown}
          className="min-w-0 self-start outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
        >
          <FloorView
            scene={scene}
            description={description}
            reducedMotion={reducedMotion}
          />
        </div>
        <div className="min-w-0 space-y-3">
          <section
            aria-labelledby="sd-world-where"
            className="border border-[var(--sd-hairline)] bg-[var(--sd-surface)] p-3"
          >
            <h3
              id="sd-world-where"
              className="text-[10px] font-semibold tracking-[0.14em] text-[var(--sd-muted)] uppercase"
            >
              Where you are
            </h3>
            <p
              id="sd-world-room"
              data-testid="world-room"
              className="mt-1 text-xs leading-relaxed break-words text-zinc-200"
            >
              {description}
            </p>
            {here.length > 0 ? (
              <ul
                aria-label="People here"
                data-testid="world-people-here"
                className="mt-2 space-y-0.5 text-[11px] text-zinc-300"
              >
                {here.map((p) => (
                  <li key={p.memberId} className="break-words">
                    {describePerson(world, p)}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-[11px] text-[var(--sd-muted)]">
              Arrows or WASD walk. E uses what you face or talks to whoever you
              face. F asks how you are.
            </p>
            <button
              type="button"
              onClick={lookAtSelf}
              disabled={away}
              className="mt-2 min-h-[32px] border border-zinc-700 px-2 text-[11px] text-zinc-300 hover:border-[var(--sd-amber)] disabled:opacity-50"
            >
              How are you?
            </button>
          </section>
          {inConference && !away ? (
            <MeetingSection team={team} world={world} people={people} />
          ) : null}
          {panel}
          {visitReport && !report ? (
            <SiteVisitReportPanel
              report={visitReport}
              onClose={() => {
                setVisitReport(null);
                playfieldRef.current?.focus({ preventScroll: true });
              }}
            />
          ) : null}
          {onSite ? <SiteVisitPanel world={world} /> : null}
        </div>
      </div>

      <OfficeDirectory
        title={onSite ? "Site directory" : undefined}
        entries={directory}
        walkingTo={walk?.entryId ?? null}
        disabled={away || team.blocking || Boolean(world.meeting)}
        onWalk={walkTo}
      />
      {showIntro ? (
        <WorldIntro
          onClose={() => {
            markIntroSeen();
            setShowIntro(false);
            playfieldRef.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
      {away ? null : (
        <TeamOverlay
          team={team}
          world={world}
          returnFocusTo={playfieldRef}
          reducedMotion={reducedMotion}
        />
      )}
    </div>
  );
};
