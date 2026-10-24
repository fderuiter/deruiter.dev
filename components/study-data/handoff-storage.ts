/**
 * Carries a study from CRF Studio to /study-data within one browser tab.
 *
 * A USDM v4 export is too large for a URL, so CRF Studio writes it to
 * `sessionStorage` under one versioned key and navigates to
 * `/study-data?source=crf`; the page takes it once and removes it. Nothing
 * leaves the browser and nothing outlives the tab. Storage access is guarded
 * because it can be missing or throw (private windows, blocked site data,
 * test harnesses), per AGENTS.md invariant 1.
 */

/** The sessionStorage key. Bump the version if the payload shape changes. */
export const STUDY_DATA_HANDOFF_KEY = "study-data:handoff:v1";

/** Where CRF Studio sends the visitor after storing the study. */
export const STUDY_DATA_HANDOFF_PATH = "/study-data?source=crf";

/** The `source` query value that tells /study-data to look for a study. */
export const STUDY_DATA_HANDOFF_SOURCE = "crf";

interface StoredHandoff {
  readonly version: 1;
  readonly source: "crf-studio";
  readonly usdm: unknown;
}

function storage(): Storage | null {
  try {
    const store = typeof window === "undefined" ? null : window.sessionStorage;
    if (
      typeof store?.getItem !== "function" ||
      typeof store.setItem !== "function" ||
      typeof store.removeItem !== "function"
    ) {
      return null;
    }
    return store;
  } catch {
    return null;
  }
}

/** Why a study could not be stored for the handoff. */
export type StoreHandoffFailure = "unavailable" | "too-large";

/**
 * Stores a USDM document for /study-data to take.
 *
 * @returns `null` when stored, otherwise why it was not.
 */
export function storeStudyHandoff(usdm: unknown): StoreHandoffFailure | null {
  const store = storage();
  if (!store) return "unavailable";
  const payload: StoredHandoff = { version: 1, source: "crf-studio", usdm };
  try {
    store.setItem(STUDY_DATA_HANDOFF_KEY, JSON.stringify(payload));
    return null;
  } catch (error) {
    return error instanceof DOMException && error.name === "QuotaExceededError"
      ? "too-large"
      : "unavailable";
  }
}

/** What /study-data found when it looked for a handed-off study. */
export type TakenHandoff =
  | { readonly status: "found"; readonly usdm: unknown }
  | { readonly status: "missing" }
  | { readonly status: "unreadable" };

/** Takes the stored study, removing it so a reload does not take it again. */
export function takeStudyHandoff(): TakenHandoff {
  const store = storage();
  if (!store) return { status: "unreadable" };
  let raw: string | null;
  try {
    raw = store.getItem(STUDY_DATA_HANDOFF_KEY);
    store.removeItem(STUDY_DATA_HANDOFF_KEY);
  } catch {
    return { status: "unreadable" };
  }
  if (raw === null) return { status: "missing" };
  try {
    const parsed = JSON.parse(raw) as Partial<StoredHandoff> | null;
    if (parsed?.version !== 1 || parsed.source !== "crf-studio") {
      return { status: "unreadable" };
    }
    return { status: "found", usdm: parsed.usdm };
  } catch {
    return { status: "unreadable" };
  }
}
