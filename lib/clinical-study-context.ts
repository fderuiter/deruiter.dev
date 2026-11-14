import { DEMO_301_STUDY } from "@/lib/study-data";

/**
 * Which study the clinical pages show, kept for the browser tab (#3157).
 *
 * `/clinical` and `/study-data` read the same choice so a visitor who picks a
 * study on one page finds it picked on the next. The only study today is
 * DEMO-301. The choice lives in `sessionStorage`, so it survives navigation
 * within the tab and nothing outlives it. Storage can be missing or throw
 * (private windows, blocked site data, test harnesses), so every read and
 * write is guarded and falls back to DEMO-301, per AGENTS.md invariant 1.
 */

/** The fictional study every clinical page uses. */
export const DEMO_STUDY_ID = "DEMO-301";

/** A study the clinical pages can show. */
export type ClinicalStudyId = typeof DEMO_STUDY_ID;

/** The sessionStorage key. Bump the version if the stored shape changes. */
export const CLINICAL_STUDY_STORAGE_KEY = "clinical:study:v1";

/** The event fired in this tab when the stored study changes. */
export const CLINICAL_STUDY_CHANGE_EVENT = "clinical-study-change";

/** What the study picker says about a study in one line. */
export interface ClinicalStudySummary {
  readonly id: ClinicalStudyId;
  /** Protocol title. */
  readonly title: string;
  /** Case report forms, one per scheduled activity. */
  readonly forms: number;
  /** SDTM and ADaM datasets a default run produces. */
  readonly datasets: number;
  /** Tables and figures a default run produces. */
  readonly tlfs: number;
}

/**
 * The studies the picker offers. Dataset and TLF counts are those of a run
 * at the default seed and subject count; a unit test runs the pipeline and
 * fails if they drift.
 */
export const CLINICAL_STUDIES: Readonly<
  Record<ClinicalStudyId, ClinicalStudySummary>
> = Object.freeze({
  [DEMO_STUDY_ID]: Object.freeze({
    id: DEMO_STUDY_ID,
    title: DEMO_301_STUDY.title,
    forms: DEMO_301_STUDY.design.activities.length,
    datasets: 29,
    tlfs: 5,
  }),
});

function isClinicalStudyId(value: unknown): value is ClinicalStudyId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CLINICAL_STUDIES, value)
  );
}

function storage(): Storage | null {
  try {
    const store = typeof window === "undefined" ? null : window.sessionStorage;
    if (
      typeof store?.getItem !== "function" ||
      typeof store.setItem !== "function"
    ) {
      return null;
    }
    return store;
  } catch {
    return null;
  }
}

/** The study stored for this tab, or DEMO-301 when none is stored or readable. */
export function readSelectedStudy(): ClinicalStudyId {
  const store = storage();
  if (!store) return DEMO_STUDY_ID;
  try {
    const value = store.getItem(CLINICAL_STUDY_STORAGE_KEY);
    return isClinicalStudyId(value) ? value : DEMO_STUDY_ID;
  } catch {
    return DEMO_STUDY_ID;
  }
}

/**
 * Stores the study for this tab and tells listeners in the tab.
 *
 * @returns whether the choice was stored.
 */
export function writeSelectedStudy(id: ClinicalStudyId): boolean {
  if (!isClinicalStudyId(id)) return false;
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(CLINICAL_STUDY_STORAGE_KEY, id);
  } catch {
    return false;
  }
  try {
    window.dispatchEvent(new Event(CLINICAL_STUDY_CHANGE_EVENT));
  } catch {
    // A missing event constructor must not undo a stored choice.
  }
  return true;
}

/** Subscribes to study changes in this tab, for `useSyncExternalStore`. */
export function subscribeSelectedStudy(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CLINICAL_STUDY_CHANGE_EVENT, onChange);
  return () =>
    window.removeEventListener(CLINICAL_STUDY_CHANGE_EVENT, onChange);
}
