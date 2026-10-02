import {
  safeIsAvailable,
  safeRawStorage,
  type RawStorage,
} from "@/lib/safe-storage";
import type { StudyState } from "@/lib/study-director";

const SAVE_KEY = "study_director_save_v1";

function storage(): RawStorage | null {
  return safeIsAvailable() ? safeRawStorage : null;
}

function isStudyState(value: unknown): value is StudyState {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<StudyState>;
  return (
    v.version === 1 &&
    typeof v.seed === "string" &&
    typeof v.day === "number" &&
    Array.isArray(v.team) &&
    Array.isArray(v.sites) &&
    Array.isArray(v.log) &&
    Array.isArray(v.handled)
  );
}

/** Reads a saved run, or null when there is none or it is unreadable. */
export function loadStudySave(): StudyState | null {
  try {
    const raw = storage()?.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStudyState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Saves the run; failures (private mode, quota) are ignored. */
export function saveStudy(state: StudyState): void {
  try {
    storage()?.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Saving is a convenience; the run continues without it.
  }
}

export function clearStudySave(): void {
  try {
    storage()?.removeItem?.(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
