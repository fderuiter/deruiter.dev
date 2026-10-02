import {
  safeIsAvailable,
  safeRawStorage,
  type RawStorage,
} from "@/lib/safe-storage";
import type { FinalReport, StudyDirectorProfile } from "@/lib/study-director";
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
] as const satisfies readonly StudyDirectorProfile[];

/** One finished study, as the career file remembers it. */
interface CareerRun {
  seed: string;
  grade: Grade;
  stars: number;
  profile: StudyDirectorProfile;
  headline: string;
}

/** Progress that outlives a single study. Plain JSON, kept in this browser. */
export interface CareerFile {
  version: 1;
  started: number;
  finished: number;
  bestGrade: Grade | null;
  bestStars: number;
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

export function emptyCareer(): CareerFile {
  return {
    version: 1,
    started: 0,
    finished: 0,
    bestGrade: null,
    bestStars: 0,
    titles: {},
    history: [],
  };
}

function betterGrade(a: Grade | null, b: Grade | null): Grade | null {
  if (a === null) return b;
  if (b === null) return a;
  return GRADE_ORDER.indexOf(a) >= GRADE_ORDER.indexOf(b) ? a : b;
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
  const earned = career.titles[profile];
  const bestGrade = betterGrade(career.bestGrade, grade);
  return {
    career: {
      ...career,
      finished: career.finished + 1,
      bestGrade,
      bestStars: Math.max(career.bestStars, stars),
      titles: {
        ...career.titles,
        [profile]: { title, count: (earned?.count ?? 0) + 1 },
      },
      history: [
        { seed, grade, stars, profile, headline },
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
        .map((r) => ({
          seed: r.seed.slice(0, 80),
          grade: r.grade,
          stars: Math.min(5, count(r.stars)),
          profile: r.profile,
          headline: r.headline.slice(0, 80),
        }))
        .slice(0, HISTORY_LIMIT)
    : [];
  return {
    version: 1,
    started: count(v.started),
    finished: count(v.finished),
    bestGrade: isGrade(v.bestGrade) ? v.bestGrade : null,
    bestStars: Math.min(5, count(v.bestStars)),
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
