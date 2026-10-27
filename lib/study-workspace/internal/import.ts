import {
  CLINICAL_STANDARDS_PROFILE,
  usdmContentHash,
  validateUsdmV4Document,
  type UsdmV4Document,
} from "@/lib/clinical-standards";
import {
  STUDY_WORKSPACE_VERSION,
  type PreservedItem,
  type StudyContentCounts,
  type StudyImportProblem,
  type StudyImportResult,
  type StudyVersionChoice,
  type StudyWorkspaceSelection,
} from "../types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Options for `importUsdmStudy`. */
export interface ImportUsdmStudyOptions {
  /** The file name to record as the source. */
  readonly fileName?: string;
  /**
   * The study version and design to work on. Needed when the document has
   * more than one of either; the import never picks one silently.
   */
  readonly selection?: StudyWorkspaceSelection;
}

function reject(...problems: StudyImportProblem[]): StudyImportResult {
  return { status: "rejected", problems };
}

/** Every `id` that appears on more than one USDM object. */
function duplicateIds(root: unknown): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!isRecord(value)) return;
    if (
      typeof value.id === "string" &&
      typeof value.instanceType === "string"
    ) {
      if (seen.has(value.id)) duplicates.add(value.id);
      seen.add(value.id);
    }
    Object.values(value).forEach(visit);
  };
  visit(root);
  return [...duplicates].sort();
}

/** Paths of every object that carries extension attributes. */
function extensionPaths(root: unknown): string[] {
  const paths: string[] = [];
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}.${index}`));
      return;
    }
    if (!isRecord(value)) return;
    if (
      Array.isArray(value.extensionAttributes) &&
      value.extensionAttributes.length > 0
    ) {
      paths.push(path);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key !== "extensionAttributes")
        visit(child, path ? `${path}.${key}` : key);
    }
  };
  visit(root, "");
  return paths;
}

function choicesOf(versions: JsonRecord[]): StudyVersionChoice[] {
  return versions.map((version, index) => ({
    studyVersionId: text(version.id) ?? `#${index}`,
    versionIdentifier: text(version.versionIdentifier) ?? "",
    designs: records(version.studyDesigns).map((design, designIndex) => ({
      id: text(design.id) ?? `#${designIndex}`,
      name: text(design.name) ?? "",
    })),
  }));
}

function countContent(
  version: JsonRecord,
  design: JsonRecord
): StudyContentCounts {
  const objectives = records(design.objectives);
  return {
    arms: records(design.arms).length,
    epochs: records(design.epochs).length,
    encounters: records(design.encounters).length,
    activities: records(design.activities).length,
    objectives: objectives.length,
    endpoints: objectives.reduce(
      (total, objective) => total + records(objective.endpoints).length,
      0
    ),
    estimands: records(design.estimands).length,
    eligibilityCriteria:
      records(design.eligibilityCriteria).length ||
      records(version.eligibilityCriterionItems).length,
  };
}

/**
 * Imports a USDM v4 document into a new workspace at revision R1.
 *
 * It rejects what cannot be a USDM v4 study (not an object, another USDM
 * major version, no study version or design, duplicate ids). Schema issues
 * do not stop the import; they are listed in the report so the person can
 * see and fix them. When the document holds more than one study version or
 * design and no selection is given, it returns the choices instead of
 * picking the first. Study versions and designs that are not selected, and
 * every object carrying extension attributes, are listed as preserved: the
 * workspace keeps them untouched in the document.
 */
export async function importUsdmStudy(
  input: { readonly text: string } | { readonly document: unknown },
  options: ImportUsdmStudyOptions = {}
): Promise<StudyImportResult> {
  let document: unknown;
  if ("text" in input) {
    try {
      document = JSON.parse(input.text);
    } catch (error) {
      return reject({
        code: "not-json",
        message: error instanceof Error ? error.message : "Not valid JSON.",
      });
    }
  } else {
    document = input.document;
  }

  const usdmVersion = isRecord(document) ? text(document.usdmVersion) : null;
  const study =
    isRecord(document) && isRecord(document.study) ? document.study : null;
  if (!usdmVersion?.startsWith("4.") || !study) {
    return reject({
      code: "not-usdm-v4",
      message: `Expected a USDM v4 document with a study; found usdmVersion ${usdmVersion ?? "missing"}.`,
    });
  }

  const versions = records(study.versions);
  if (versions.length === 0) {
    return reject({
      code: "no-study-version",
      message: "The study has no version.",
    });
  }
  if (versions.every((version) => records(version.studyDesigns).length === 0)) {
    return reject({
      code: "no-study-design",
      message: "No study version has a design.",
    });
  }
  const duplicates = duplicateIds(document);
  if (duplicates.length > 0) {
    return reject({
      code: "duplicate-id",
      message: `These ids appear on more than one object: ${duplicates.join(", ")}.`,
    });
  }

  const choices = choicesOf(versions);
  let selection = options.selection;
  if (!selection) {
    if (choices.length !== 1 || choices[0].designs.length !== 1) {
      return { status: "needs-selection", choices };
    }
    selection = {
      studyVersionId: choices[0].studyVersionId,
      studyDesignId: choices[0].designs[0].id,
    };
  }
  const versionIndex = choices.findIndex(
    (choice) => choice.studyVersionId === selection.studyVersionId
  );
  const designIndex =
    versionIndex < 0
      ? -1
      : choices[versionIndex].designs.findIndex(
          (design) => design.id === selection.studyDesignId
        );
  if (designIndex < 0) {
    return reject({
      code: "unknown-selection",
      message: `No study design ${selection.studyDesignId} in study version ${selection.studyVersionId}.`,
    });
  }

  const preserved: PreservedItem[] = [];
  choices.forEach((choice, index) => {
    if (index !== versionIndex) {
      preserved.push({
        path: `study.versions.${index}`,
        reason: "other-study-version",
        label: choice.versionIdentifier || choice.studyVersionId,
      });
      return;
    }
    choice.designs.forEach((design, i) => {
      if (i !== designIndex) {
        preserved.push({
          path: `study.versions.${index}.studyDesigns.${i}`,
          reason: "other-study-design",
          label: design.name || design.id,
        });
      }
    });
  });
  for (const path of extensionPaths(document)) {
    preserved.push({ path, reason: "extension-attributes", label: path });
  }

  const version = versions[versionIndex];
  const design = records(version.studyDesigns)[designIndex];
  const sha256 = usdmContentHash(document);
  const workspace = {
    workspaceVersion: STUDY_WORKSPACE_VERSION,
    source: {
      fileName: options.fileName ?? null,
      sha256,
      systemName: text((document as JsonRecord).systemName),
      systemVersion: text((document as JsonRecord).systemVersion),
      usdmVersion,
      original: document,
    },
    selection,
    revision: { id: "R1", parentId: null, note: "Imported.", sha256 },
    // The working copy starts as a deep copy so edits never reach the original.
    usdm: structuredClone(document) as unknown as UsdmV4Document,
    locks: {
      USDM: CLINICAL_STANDARDS_PROFILE.USDM,
      ctPackageDate: CLINICAL_STANDARDS_PROFILE.CT.packageDate,
    },
    preserved,
  } as const;
  return {
    status: "ok",
    workspace,
    report: {
      schemaIssues: await validateUsdmV4Document(document),
      counts: countContent(version, design),
      preserved,
    },
  };
}
