/**
 * Reading-mode contract for the dual-layer narrative perspective.
 *
 * Every page can be read in two layers: a Professional overview of the systems
 * and responsibilities involved, and a Behind the Scenes layer with the candid
 * engineering story. See ADR 0047.
 */

/** The two reading modes a visitor can choose between. */
export type PersonaType = "professional" | "behind-the-scenes";

/** Reading mode used on a first visit and whenever a stored value is unrecognized. */
export const DEFAULT_PERSONA: PersonaType = "professional";

/** localStorage key holding the visitor's reading mode. Unchanged since the original toggle shipped. */
export const PERSONA_STORAGE_KEY = "global-persona";

/**
 * Value the original concise mode persisted before the ADR 0047 rename.
 * Kept only so returning visitors keep their mode; it is never written.
 */
export const LEGACY_SUMMARY_PERSONA_VALUE = "recruiter";

/**
 * Value the original deep-dive mode persisted before the ADR 0047 rename.
 * Kept only so returning visitors keep their mode; it is never written.
 */
export const LEGACY_DEEP_DIVE_PERSONA_VALUE = "technical";

/**
 * Narrows any stored or URL-supplied value to a reading mode.
 *
 * Current values pass through unchanged. The two legacy values map to their
 * renamed equivalents, so a visitor who chose the deep-dive layer before the
 * rename still lands in Behind the Scenes. Anything else resolves to the
 * Professional default.
 *
 * @param value - A raw value from storage, a URL parameter or a caller.
 * @returns The matching reading mode.
 */
export function normalizePersona(value: unknown): PersonaType {
  if (typeof value !== "string") return DEFAULT_PERSONA;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "behind-the-scenes" ||
    normalized === LEGACY_DEEP_DIVE_PERSONA_VALUE
  ) {
    return "behind-the-scenes";
  }
  return DEFAULT_PERSONA;
}

/**
 * Whether a raw value is one of the pre-rename persisted values that should be
 * rewritten to its current equivalent.
 *
 * @param value - A raw value read from storage.
 * @returns True for the two legacy values only.
 */
export function isLegacyPersonaValue(value: unknown): boolean {
  return (
    value === LEGACY_SUMMARY_PERSONA_VALUE ||
    value === LEGACY_DEEP_DIVE_PERSONA_VALUE
  );
}

/** Screen-reader announcement made when a visitor switches reading mode. */
export const PERSONA_ANNOUNCEMENTS: Readonly<Record<PersonaType, string>> = {
  professional:
    "Professional Mode: Concise overview of technical responsibilities and systems impact",
  "behind-the-scenes":
    "Behind the Scenes Mode: Candid reality and engineering stories",
};
