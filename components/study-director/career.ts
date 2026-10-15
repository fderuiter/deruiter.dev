import {
  safeIsAvailable,
  safeRawStorage,
  type RawStorage,
} from "@/lib/safe-storage";
import {
  DIFFICULTIES,
  STUDY_LENGTHS,
  studyLength,
  type Difficulty,
  type FinalReport,
  type StudyDirectorProfile,
  type StudyLength,
  type StudyState,
} from "@/lib/study-director";
import { recordArcadeScore } from "@/lib/arcade-achievements";

type Grade = FinalReport["evaluations"]["regulatory"]["grade"];

/** Every Study Director profile, in the order the personnel file lists them. */
export const PROFILES = [
  "firefighter",
  "bureaucrat",
  "peoplePleaser",
  "scientist",
  "operator",
  "delegator",
  "controlFreak",
  "absentee",
] as const satisfies readonly StudyDirectorProfile[];

/** One finished study, as the career file remembers it. */
interface CareerRun {
  seed: string;
  grade: Grade;
  stars: number;
  profile: StudyDirectorProfile;
  headline: string;
  /**
   * How hard the study started (#2058). Runs filed before careers recorded
   * it have none, and count only towards the overall bests.
   */
  difficulty?: Difficulty;
  /** Short or full (#2191); runs filed before then have none. */
  length?: StudyLength;
  /** True for a run played in the walkable office (#2191). */
  office?: boolean;
}

/** The study day that earns the Study Kickoff trophy: three working weeks in (#2191). */
export const KICKOFF_DAY = 15;

/**
 * True when a closed study left a clean file: every decision written up and
 * none ignored, which is what FDA Replay Approved promises (#2191).
 */
export function cleanFile(state: StudyState): boolean {
  const answered = state.log.filter(
    (r) => r.optionId !== "ignored" && r.optionId !== "audit"
  );
  return (
    answered.length > 0 &&
    answered.every((r) => r.documented) &&
    !state.log.some((r) => r.optionId === "ignored")
  );
}

/** The best result on one difficulty. */
interface DifficultyBest {
  grade: Grade;
  stars: number;
}

/** Progress that outlives a single study. Plain JSON, kept in this browser. */
export interface CareerFile {
  version: 1;
  started: number;
  finished: number;
  bestGrade: Grade | null;
  bestStars: number;
  /** Best grade and stars on each difficulty played since #2058. */
  bests: Partial<Record<Difficulty, DifficultyBest>>;
  /** Title of each profile earned, and how many times. */
  titles: Partial<
    Record<StudyDirectorProfile, { title: string; count: number }>
  >;
  /** The most recent finished studies, newest first. */
  history: CareerRun[];
}

export const CAREER_KEY = "study_director_career_v1";
const HISTORY_LIMIT = 12;
const GRADE_ORDER: readonly Grade[] = ["F", "D", "C", "B", "A"];

/**
 * A finished study as an Arcade Daily result (#2113): the regulatory grade
 * counts most and the sponsor's stars break ties, so an A with one star
 * beats a B with five. Grade F with one star scores 11; A with five, 55.
 */
export function dailyResultFor(report: FinalReport): {
  score: number;
  label: string;
} {
  const grade = report.evaluations.regulatory.grade;
  const stars = report.evaluations.sponsor.stars;
  return {
    score: (GRADE_ORDER.indexOf(grade) + 1) * 10 + stars,
    label: `Grade ${grade}, ${stars} star${stars === 1 ? "" : "s"}`,
  };
}

export function emptyCareer(): CareerFile {
  return {
    version: 1,
    started: 0,
    finished: 0,
    bestGrade: null,
    bestStars: 0,
    bests: {},
    titles: {},
    history: [],
  };
}

function betterGrade(a: Grade | null, b: Grade | null): Grade | null {
  if (a === null) return b;
  if (b === null) return a;
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b;
}

/** Two bests on one difficulty, keeping the better grade and the most stars. */
function betterBest(
  a: DifficultyBest | undefined,
  b: DifficultyBest | undefined
): DifficultyBest | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    grade: betterGrade(a.grade, b.grade) ?? a.grade,
    stars: Math.max(a.stars, b.stars),
  };
}

/** Counts a new study. Resuming a saved one does not count again. */
export function recordStart(career: CareerFile): CareerFile {
  return { ...career, started: career.started + 1 };
}

/** What a finished study changed in the career, for the closeout's badges. */
export interface CareerNews {
  newTitle: boolean;
  newBestGrade: boolean;
  newBestStars: boolean;
}

/**
 * Adds a finished study. Recording the same seed twice changes nothing, so
 * a page refresh on the closeout never double-counts.
 */
export function recordRun(
  career: CareerFile,
  report: FinalReport,
  headline: string
): { career: CareerFile; news: CareerNews } {
  const seed = report.state.seed;
  const none = { newTitle: false, newBestGrade: false, newBestStars: false };
  if (career.history.some((run) => run.seed === seed)) {
    return { career, news: none };
  }
  const grade = report.evaluations.regulatory.grade;
  const stars = report.evaluations.sponsor.stars;
  const { profile, title } = report.profile;
  // A study without a difficulty plays as standard (ADR 0054).
  const difficulty = report.state.difficulty ?? "standard";
  const earned = career.titles[profile];
  const bestGrade = betterGrade(career.bestGrade, grade);
  return {
    career: {
      ...career,
      finished: career.finished + 1,
      bestGrade,
      bestStars: Math.max(career.bestStars, stars),
      bests: {
        ...career.bests,
        [difficulty]: betterBest(career.bests[difficulty], { grade, stars }),
      },
      titles: {
        ...career.titles,
        [profile]: { title, count: (earned?.count ?? 0) + 1 },
      },
      history: [
        {
          seed,
          grade,
          stars,
          profile,
          headline,
          difficulty,
          length: studyLength(report.state.setup),
          ...(report.state.budget === "clock" ? { office: true } : {}),
        },
        ...career.history,
      ].slice(0, HISTORY_LIMIT),
    },
    news: {
      newTitle: earned === undefined,
      // A first study is its own best; only later ones can beat a record.
      newBestGrade:
        career.bestGrade !== null &&
        bestGrade !== career.bestGrade &&
        bestGrade === grade,
      newBestStars: career.bestStars > 0 && stars > career.bestStars,
    },
  };
}

const isGrade = (v: unknown): v is Grade =>
  typeof v === "string" && (GRADE_ORDER as readonly string[]).includes(v);
const isProfile = (v: unknown): v is StudyDirectorProfile =>
  typeof v === "string" && (PROFILES as readonly string[]).includes(v);
const count = (v: unknown): number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
const asDifficulty = (v: unknown): Difficulty | undefined =>
  DIFFICULTIES.find((d) => d === v);

/**
 * Per-difficulty bests from a stored file. A file from before #2058 has
 * none; its runs tagged with a difficulty (none, in practice) seed them,
 * and untagged runs are left out rather than guessed.
 */
function readBests(value: unknown, history: CareerRun[]): CareerFile["bests"] {
  let bests: CareerFile["bests"] = {};
  if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      const id = asDifficulty(key);
      const e = entry as { grade?: unknown; stars?: unknown } | null;
      if (id && e && isGrade(e.grade))
        bests[id] = { grade: e.grade, stars: Math.min(5, count(e.stars)) };
    }
  }
  for (const run of history) {
    if (!run.difficulty) continue;
    bests = {
      ...bests,
      [run.difficulty]: betterBest(bests[run.difficulty], {
        grade: run.grade,
        stars: run.stars,
      }),
    };
  }
  return bests;
}

/**
 * Reads a career file from untrusted JSON (storage or an import). Fields
 * that do not check out are dropped rather than trusted; anything that is
 * not a version 1 career at all returns null.
 */
export function parseCareer(value: unknown): CareerFile | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  if (v.version !== 1) return null;
  const titles: CareerFile["titles"] = {};
  if (typeof v.titles === "object" && v.titles !== null) {
    for (const [key, entry] of Object.entries(v.titles)) {
      const e = entry as { title?: unknown; count?: unknown } | null;
      if (isProfile(key) && e && typeof e.title === "string") {
        titles[key] = { title: e.title.slice(0, 60), count: count(e.count) };
      }
    }
  }
  const history: CareerRun[] = Array.isArray(v.history)
    ? v.history
        .filter(
          (r): r is CareerRun =>
            typeof r === "object" &&
            r !== null &&
            typeof r.seed === "string" &&
            isGrade(r.grade) &&
            isProfile(r.profile) &&
            typeof r.headline === "string"
        )
        .map((r) => {
          const difficulty = asDifficulty(r.difficulty);
          const length = STUDY_LENGTHS.find((l) => l === r.length);
          return {
            seed: r.seed.slice(0, 80),
            grade: r.grade,
            stars: Math.min(5, count(r.stars)),
            profile: r.profile,
            headline: r.headline.slice(0, 80),
            ...(difficulty ? { difficulty } : {}),
            ...(length ? { length } : {}),
            ...(r.office === true ? { office: true } : {}),
          };
        })
        .slice(0, HISTORY_LIMIT)
    : [];
  return {
    version: 1,
    started: count(v.started),
    finished: count(v.finished),
    bestGrade: isGrade(v.bestGrade) ? v.bestGrade : null,
    bestStars: Math.min(5, count(v.bestStars)),
    bests: readBests(v.bests, history),
    titles,
    history,
  };
}

/** Combines two career files, keeping the best of each figure. */
export function mergeCareers(a: CareerFile, b: CareerFile): CareerFile {
  const titles: CareerFile["titles"] = { ...a.titles };
  for (const id of PROFILES) {
    const other = b.titles[id];
    if (!other) continue;
    const mine = titles[id];
    titles[id] = {
      title: mine?.title ?? other.title,
      count: Math.max(mine?.count ?? 0, other.count),
    };
  }
  const bests: CareerFile["bests"] = {};
  for (const id of DIFFICULTIES) {
    const best = betterBest(a.bests[id], b.bests[id]);
    if (best) bests[id] = best;
  }
  const seen = new Set<string>();
  const history = [...a.history, ...b.history].filter((run) => {
    if (seen.has(run.seed)) return false;
    seen.add(run.seed);
    return true;
  });
  return {
    version: 1,
    started: Math.max(a.started, b.started),
    finished: Math.max(a.finished, b.finished),
    bestGrade: betterGrade(a.bestGrade, b.bestGrade),
    bestStars: Math.max(a.bestStars, b.bestStars),
    bests,
    titles,
    history: history.slice(0, HISTORY_LIMIT),
  };
}

function storage(): RawStorage | null {
  return safeIsAvailable() ? safeRawStorage : null;
}

export function loadCareer(): CareerFile {
  try {
    const raw = storage()?.getItem(CAREER_KEY);
    return (raw ? parseCareer(JSON.parse(raw)) : null) ?? emptyCareer();
  } catch {
    return emptyCareer();
  }
}

export function saveCareer(career: CareerFile): void {
  try {
    storage()?.setItem(CAREER_KEY, JSON.stringify(career));
    const score = career.finished * 100 + career.bestStars * 50;
    recordArcadeScore("study-director", score);
  } catch {
    // The career is a keepsake; the game runs without it.
  }
}

/** Reads an imported career file's text, or null when it is not one. */
export function importCareer(text: string): CareerFile | null {
  try {
    return parseCareer(JSON.parse(text));
  } catch {
    return null;
  }
}
