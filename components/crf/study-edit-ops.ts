import { safeGetRawItem } from "@/lib/safe-storage";
import {
  type CRFField,
  type CRFForm,
  type CRFSection,
  type CodelistDefinition,
  type StudyProtocol,
  type StudyVisit,
  type TestScenario,
  assessScenarioFreshness,
  assignFormsToVisit,
  generateCdashVariableName,
  generateEngineId,
  getOncologyPresetSync,
  loadStudyDraft,
  unassignFormsFromVisit,
} from "@/lib/crf";

/**
 * The study the studio opens with: the most recently acknowledged local draft
 * (forms, visits, codelists, rules and branding together), else the built-in
 * oncology example with any cached default branding, so a refresh never
 * silently loses an author's in-progress study.
 */
export function loadInitialStudy(): StudyProtocol {
  if (typeof window !== "undefined") {
    const draft = loadStudyDraft();
    if (draft.status === "recovered") {
      return draft.study;
    }
  }

  const preset = getOncologyPresetSync();
  if (typeof window !== "undefined") {
    try {
      const cached = safeGetRawItem("crf_studio_default_branding");
      if (cached) {
        const parsedBranding = JSON.parse(cached);
        return {
          ...preset,
          branding: parsedBranding,
        };
      }
    } catch {
      // Fallback to preset
    }
  }
  return preset;
}

/** When the studio opened on a recovered local draft, the time it was saved. */
export function loadRecoveredDraftSavedAt(): string | null {
  if (typeof window === "undefined") return null;
  const draft = loadStudyDraft();
  return draft.status === "recovered" ? draft.savedAt : null;
}

interface InsertionTarget {
  sectionId?: string;
  index?: number;
}

/**
 * Where a new field lands. An explicit section wins; otherwise it goes right
 * after the selected field, else into the form's first section.
 */
export function resolveInsertionTarget(
  form: CRFForm,
  selectedFieldId: string | null,
  target: InsertionTarget = {}
): InsertionTarget {
  let sectionId = target.sectionId;
  let index = target.index;

  if (!sectionId && selectedFieldId) {
    for (const s of form.sections) {
      const fIdx = s.fields.findIndex((f) => f.id === selectedFieldId);
      if (fIdx !== -1) {
        sectionId = s.id;
        if (index === undefined) {
          index = fIdx + 1;
        }
        break;
      }
    }
  }

  if (!sectionId && form.sections.length > 0) {
    sectionId = form.sections[0].id;
  }

  return { sectionId, index };
}

/**
 * Renames a field (and its repeating columns) so none of its variable names
 * collide with a variable already on the form.
 */
export function withUniqueVariableNames(
  form: CRFForm,
  field: CRFField
): CRFField {
  const existingVars = new Set<string>();
  for (const s of form.sections) {
    for (const f of s.fields) {
      existingVars.add(f.variableName.toUpperCase());
      if (f.repeatingColumns) {
        for (const rc of f.repeatingColumns) {
          existingVars.add(rc.variableName.toUpperCase());
        }
      }
    }
  }

  let variableName = field.variableName;
  if (existingVars.has(variableName.toUpperCase())) {
    variableName = generateCdashVariableName(variableName, existingVars);
  }
  existingVars.add(variableName.toUpperCase());

  let repeatingColumns = field.repeatingColumns;
  if (repeatingColumns && repeatingColumns.length > 0) {
    repeatingColumns = repeatingColumns.map((rc) => {
      let rcVar = rc.variableName;
      if (existingVars.has(rcVar.toUpperCase())) {
        rcVar = generateCdashVariableName(rcVar, existingVars);
      }
      existingVars.add(rcVar.toUpperCase());
      return {
        ...rc,
        id: generateEngineId("fld"),
        variableName: rcVar,
      };
    });
  }

  return {
    ...field,
    variableName,
    ...(repeatingColumns ? { repeatingColumns } : {}),
  };
}

/** Binds a form to a visit through the operation the CLI also uses. */
export function assignFormToVisit(
  study: StudyProtocol,
  visitId: string,
  formId: string
): StudyProtocol {
  const result = assignFormsToVisit(study, visitId, [formId]);
  return result.ok ? result.study : study;
}

/** Unbinds a form from a visit through the operation the CLI also uses. */
export function unassignFormFromVisit(
  study: StudyProtocol,
  visitId: string,
  formId: string
): StudyProtocol {
  const result = unassignFormsFromVisit(study, visitId, [formId]);
  return result.ok ? result.study : study;
}

/** The next scheduled visit, 28 days after the last, carrying every non-log form. */
export function createNextVisit(study: StudyProtocol, now: number): StudyVisit {
  const nextIdx = study.visits.length + 1;
  return {
    id: `v_visit_${now}`,
    oid: `SE.VISIT_${nextIdx}`,
    name: `Visit ${nextIdx} (Day ${(nextIdx - 1) * 28})`,
    visitType: "Scheduled",
    targetDay: (nextIdx - 1) * 28,
    windowBefore: 3,
    windowAfter: 3,
    assignedFormIds: study.forms.filter((f) => !f.isLogForm).map((f) => f.id),
  };
}

/** Adds a scaffolded form, optionally assigning it to a visit, with its codelists. */
export function injectForm(
  study: StudyProtocol,
  newForm: CRFForm,
  targetVisitId: string | undefined,
  newCodelists: CodelistDefinition[]
): StudyProtocol {
  const visits = targetVisitId
    ? study.visits.map((v) =>
        v.id === targetVisitId
          ? {
              ...v,
              assignedFormIds: Array.from(
                new Set([...v.assignedFormIds, newForm.id])
              ),
            }
          : v
      )
    : study.visits;

  return {
    ...study,
    forms: [...study.forms, newForm],
    visits,
    codelists: newCodelists.length
      ? [...study.codelists, ...newCodelists]
      : study.codelists,
  };
}

export function createSection(form: CRFForm, now: number): CRFSection {
  return {
    id: `sec_${now}`,
    title: `Section ${form.sections.length + 1}`,
    fields: [],
  };
}

/**
 * How a review package (#680) labels a saved test: by its per-dependency
 * freshness (#679), or undefined for a never-run test so the package falls
 * back to its own fingerprint check.
 */
export function scenarioStaleness(
  scenario: TestScenario,
  study: StudyProtocol
): { stale: boolean; reason?: string } | undefined {
  const assessment = assessScenarioFreshness(scenario, study);
  if (assessment.freshness === "never_run") return undefined;
  if (assessment.freshness === "current") return { stale: false };
  return {
    stale: true,
    reason: assessment.reasons[0]?.message ?? assessment.label,
  };
}
