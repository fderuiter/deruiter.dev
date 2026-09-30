import type { Meters, StudyState } from "@/lib/study-director";
import { METER_IDS } from "@/lib/study-director";
import { clamp } from "@/lib/game-utils";

/** How the office looks. Every field is driven by the study's real state. */
export interface SceneState {
  day: number;
  /** Stacks of paper on the floor, one per 12 open queries, 0 to 4. */
  paperStacks: number;
  /** Sticky notes on the corkboard, one per 12 points of documentation debt, 0 to 6. */
  stickyNotes: number;
  /** The desk plant follows team morale. */
  plant: "thriving" | "droopy" | "wilted";
  /** Red pen marks on the wall calendar, one per 7 days of slip, 0 to 3. */
  redMarks: number;
  /** Coffee cups on the desk: one, plus one per attention point spent today, up to 4. */
  cups: number;
  /** The phone light is on while a critical message waits. */
  phoneBlink: boolean;
  /** The waste bin smoulders when any meter is under 35. */
  smoke: boolean;
  /** And catches fire when any meter is under 20. */
  fire: boolean;
  night: boolean;
  /** Clock time, 9.0 at the start of the day to 17.0 when attention runs out; late evening at night. */
  hour: number;
  /** Days since a decision last added a protocol deviation, for the wall sign. */
  daysSinceDeviation: number;
  /** False until any decision has caused a deviation. */
  deviationLogged: boolean;
  /** Text pinned to the corkboard at closeout, such as the grade. */
  pinned?: string;
  /** The six meters, for the tiny dashboard on the monitor. */
  meters: Meters;
}

const SMOKE_BELOW = 35;
const FIRE_BELOW = 20;

function lowestMeter(meters: Meters): number {
  return Math.min(...METER_IDS.map((id) => meters[id]));
}

/** The last day a logged decision added a deviation at any site. */
function lastDeviationDay(state: StudyState): number | null {
  let last: number | null = null;
  for (const entry of state.log) {
    if (entry.effects.sites?.some((site) => (site.deviations ?? 0) > 0)) {
      last = entry.day;
    }
  }
  return last;
}

function openQueries(state: StudyState): number {
  return state.sites.reduce((sum, site) => sum + site.openQueries, 0);
}

/** Maps the study to the office scene. Pure, so it is tested without a DOM. */
export function sceneFor(
  state: StudyState,
  meters: Meters,
  options: {
    criticalCount?: number;
    night?: boolean;
    pinned?: string;
    attentionPerDay?: number;
  } = {}
): SceneState {
  const low = lowestMeter(meters);
  const perDay = options.attentionPerDay ?? 5;
  const spentToday = perDay - state.attention;
  const night = options.night ?? false;
  const lastDeviation = lastDeviationDay(state);
  return {
    day: state.day,
    paperStacks: clamp(Math.floor(openQueries(state) / 12), 0, 4),
    stickyNotes: clamp(Math.floor(state.documentationDebt / 12), 0, 6),
    plant:
      meters.team >= 60 ? "thriving" : meters.team >= 35 ? "droopy" : "wilted",
    redMarks: clamp(Math.ceil(state.slipDays / 7), 0, 3),
    cups: clamp(1 + spentToday, 1, 4),
    phoneBlink: (options.criticalCount ?? 0) > 0,
    smoke: low < SMOKE_BELOW,
    fire: low < FIRE_BELOW,
    night,
    hour: night ? 23.7 : 9 + (clamp(spentToday, 0, perDay) / perDay) * 8,
    daysSinceDeviation: state.day - (lastDeviation ?? 1),
    deviationLogged: lastDeviation !== null,
    pinned: options.pinned,
    meters,
  };
}

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five", "six"];

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A sentence describing the scene, for its text alternative. */
export function describeScene(scene: SceneState): string {
  const parts = [
    `The Study Director's office on day ${scene.day}${scene.night ? ", after hours" : ""}.`,
  ];
  if (scene.paperStacks > 0) {
    parts.push(
      `${capitalize(COUNT_WORDS[scene.paperStacks])} stack${scene.paperStacks === 1 ? "" : "s"} of unanswered queries on the floor.`
    );
  }
  if (scene.stickyNotes > 0) {
    parts.push(
      `${capitalize(COUNT_WORDS[scene.stickyNotes])} undocumented decision${scene.stickyNotes === 1 ? "" : "s"} stuck to the corkboard.`
    );
  }
  if (scene.redMarks > 0) parts.push("The calendar is marked up in red.");
  parts.push(
    {
      thriving: "The plant is doing well.",
      droopy: "The plant is drooping.",
      wilted: "The plant has wilted.",
    }[scene.plant]
  );
  parts.push(
    `The sign says ${scene.daysSinceDeviation} day${scene.daysSinceDeviation === 1 ? "" : "s"} since the last deviation.`
  );
  if (scene.phoneBlink) parts.push("The phone light is blinking.");
  if (scene.fire) parts.push("The waste bin is on fire.");
  else if (scene.smoke) parts.push("The waste bin is smouldering.");
  if (scene.pinned) parts.push(`Pinned to the board: ${scene.pinned}.`);
  parts.push("The Study Director holds a mug and says everything is fine.");
  return parts.join(" ");
}
