/**
 * Which study version and study design a reader works on (#3072).
 *
 * A USDM v4 study can hold several versions, and a version several designs.
 * Readers used to take the first of each without saying so, which reads the
 * wrong protocol when a file carries an amendment or a second design. This
 * resolves the pair explicitly: a document with exactly one of each needs no
 * selection, and anything else names the choices instead of guessing.
 */
import type {
  UsdmV4InterventionalStudyDesign,
  UsdmV4StudyVersion,
} from "./usdm-v4-types";

/** The study version and design to read, by their USDM ids. */
export interface UsdmStudySelection {
  studyVersionId: string;
  studyDesignId: string;
}

/** One study version and the designs it holds, offered when a reader must ask. */
export interface UsdmStudyVersionOption {
  studyVersionId: string;
  versionIdentifier: string;
  designs: { id: string; name: string }[];
}

/** Why a study version and design could not be resolved. */
export type UsdmSelectionProblemCode =
  "no-study-version" | "no-study-design" | "ambiguous" | "unknown-selection";

/** The outcome of {@link resolveUsdmStudyDesign}. */
export type UsdmSelectionResult =
  | {
      ok: true;
      version: UsdmV4StudyVersion;
      design: UsdmV4InterventionalStudyDesign;
      versionIndex: number;
      designIndex: number;
    }
  | {
      ok: false;
      code: UsdmSelectionProblemCode;
      message: string;
      options: UsdmStudyVersionOption[];
    };

// Entries keep their array positions, so indices match the caller's arrays.
function records<T>(value: unknown): T[] {
  return Array.isArray(value)
    ? (value.map((item) =>
        item && typeof item === "object" ? item : {}
      ) as T[])
    : [];
}

function label(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

/** Lists every study version in a USDM v4 study with the designs it holds. */
export function listUsdmStudyVersions(
  study: unknown
): UsdmStudyVersionOption[] {
  const versions = records<UsdmV4StudyVersion>(
    (study as { versions?: unknown } | null)?.versions
  );
  return versions.map((version, index) => ({
    studyVersionId: label(version.id, `#${index}`),
    versionIdentifier: label(version.versionIdentifier, ""),
    designs: records<UsdmV4InterventionalStudyDesign>(version.studyDesigns).map(
      (design, designIndex) => ({
        id: label(design.id, `#${designIndex}`),
        name: label(design.name, ""),
      })
    ),
  }));
}

/**
 * Resolves the study version and design to read from a USDM v4 `study`.
 * Without a selection it succeeds only when there is exactly one version
 * with exactly one design; otherwise it returns `ambiguous` with the options,
 * so the caller can ask rather than read the first.
 */
export function resolveUsdmStudyDesign(
  study: unknown,
  selection?: UsdmStudySelection
): UsdmSelectionResult {
  const versions = records<UsdmV4StudyVersion>(
    (study as { versions?: unknown } | null)?.versions
  );
  const options = listUsdmStudyVersions(study);
  const problem = (code: UsdmSelectionProblemCode, message: string) =>
    ({ ok: false, code, message, options }) as const;

  if (versions.length === 0) {
    return problem("no-study-version", "study has no version");
  }
  if (options.every((option) => option.designs.length === 0)) {
    return problem("no-study-design", "study version has no study design");
  }

  let chosen = selection;
  if (!chosen) {
    if (options.length !== 1 || options[0].designs.length !== 1) {
      const designs = options.reduce((n, o) => n + o.designs.length, 0);
      return problem(
        "ambiguous",
        `study has ${options.length} version(s) and ${designs} design(s); choose a study version and design`
      );
    }
    chosen = {
      studyVersionId: options[0].studyVersionId,
      studyDesignId: options[0].designs[0].id,
    };
  }

  const versionIndex = options.findIndex(
    (option) => option.studyVersionId === chosen.studyVersionId
  );
  const designIndex =
    versionIndex < 0
      ? -1
      : options[versionIndex].designs.findIndex(
          (design) => design.id === chosen.studyDesignId
        );
  if (designIndex < 0) {
    return problem(
      "unknown-selection",
      `no study design ${chosen.studyDesignId} in study version ${chosen.studyVersionId}`
    );
  }
  const version = versions[versionIndex];
  return {
    ok: true,
    version,
    design: records<UsdmV4InterventionalStudyDesign>(version.studyDesigns)[
      designIndex
    ],
    versionIndex,
    designIndex,
  };
}
