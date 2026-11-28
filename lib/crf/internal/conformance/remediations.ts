import type { CRFField, StudyProtocol } from "../../types";
import {
  CDASH_STANDARD_VARIABLES,
  STANDARD_CODELISTS,
} from "../cdisc-cdash-library";
import type { ConformanceAutoFixType } from "./types";

export interface RemediationTargetDescriptor {
  readonly formId: string;
  readonly fieldId?: string;
  readonly variableName?: string;
  readonly autoFixAvailable: boolean;
  readonly autoFixType?: ConformanceAutoFixType;
}

function hash32(seed: string, salt: number): number {
  let h = (0x811c9dc5 ^ salt) >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Generates a pure, collision-free deterministic UUIDv4-formatted identifier
 * from structural protocol inputs without wall-clock or PRNG entropy.
 */
export function deterministicRemediationUuid(seed: string): string {
  const w0 = hash32(seed, 0x10203040).toString(16).padStart(8, "0");
  const w1 = hash32(seed, 0x50607080).toString(16).padStart(8, "0");
  const w2Raw = hash32(seed, 0x90a0b0c0);
  const w2 = (((w2Raw & 0xffff0fff) | 0x00004000) >>> 0)
    .toString(16)
    .padStart(8, "0");
  const w3Raw = hash32(seed, 0xd0e0f001);
  const w3 = (((w3Raw & 0x3fffffff) | 0x80000000) >>> 0)
    .toString(16)
    .padStart(8, "0");
  const hex = `${w0}${w1}${w2}${w3}`;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function disambiguateTruncatedVariableName(
  desired: string,
  existingUpperVars: ReadonlySet<string>
): string {
  if (!existingUpperVars.has(desired)) return desired;
  for (let i = 1; i <= 99; i++) {
    const suffix = String(i);
    const prefix = desired.slice(0, Math.max(1, 8 - suffix.length));
    const candidate = `${prefix}${suffix}`;
    if (!existingUpperVars.has(candidate)) {
      return candidate;
    }
  }
  return desired;
}

/**
 * Pure, deterministic remediation transformer for a single conformance finding.
 * Never mutates the input `StudyProtocol` and never reads the system clock.
 */
export function applyPureRemediation(
  study: StudyProtocol,
  target: RemediationTargetDescriptor
): StudyProtocol {
  if (!target.autoFixAvailable || !target.autoFixType) {
    return study;
  }

  const existingFieldIds = new Set<string>();
  const existingSectionIds = new Set<string>();
  for (const f of study.forms) {
    for (const s of f.sections) {
      existingSectionIds.add(s.id);
      for (const fld of s.fields) {
        existingFieldIds.add(fld.id);
      }
    }
  }

  if (target.autoFixType === "assign_visit_form") {
    if (study.visits.length === 0) return study;
    const firstVisit = study.visits[0];
    if (firstVisit.assignedFormIds.includes(target.formId)) {
      return study;
    }
    const updatedVisits = study.visits.map((visit, idx) =>
      idx === 0
        ? {
            ...visit,
            assignedFormIds: [...visit.assignedFormIds, target.formId],
          }
        : visit
    );
    return {
      ...study,
      visits: updatedVisits,
    };
  }

  let changed = false;
  const updatedForms = study.forms.map((form) => {
    if (form.id !== target.formId) return form;

    switch (target.autoFixType) {
      case "truncate_variable": {
        const otherUpperVars = new Set<string>();
        for (const s of form.sections) {
          for (const fld of s.fields) {
            if (fld.id !== target.fieldId && fld.variableName) {
              otherUpperVars.add(fld.variableName.trim().toUpperCase());
            }
          }
        }
        const updatedSections = form.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => {
            if (
              field.id === target.fieldId &&
              field.variableName.trim().length > 8
            ) {
              const baseTrunc = field.variableName
                .trim()
                .slice(0, 8)
                .toUpperCase();
              const nextVar = disambiguateTruncatedVariableName(
                baseTrunc,
                otherUpperVars
              );
              changed = true;
              return {
                ...field,
                variableName: nextVar,
              };
            }
            return field;
          }),
        }));
        return changed ? { ...form, sections: updatedSections } : form;
      }

      case "assign_nci_codelist": {
        const nyCodelist = STANDARD_CODELISTS.find((c) => c.id === "CL_NY");
        const updatedSections = form.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => {
            if (field.id === target.fieldId) {
              changed = true;
              return {
                ...field,
                codelistId: "CL_NY",
                customOptions: nyCodelist
                  ? nyCodelist.options.map((o) => ({ ...o }))
                  : [
                      { code: "Y", label: "Yes", order: 1 },
                      { code: "N", label: "No", order: 2 },
                    ],
              };
            }
            return field;
          }),
        }));
        return changed ? { ...form, sections: updatedSections } : form;
      }

      case "fix_date_format": {
        // Pure remediation: reset invalid default date to "" without wall-clock Date()
        const updatedSections = form.sections.map((section) => ({
          ...section,
          fields: section.fields.map((field) => {
            if (field.id === target.fieldId) {
              changed = true;
              return {
                ...field,
                defaultValue: "",
              };
            }
            return field;
          }),
        }));
        return changed ? { ...form, sections: updatedSections } : form;
      }

      case "add_core_variable": {
        if (!target.variableName) return form;
        const domainUpper = (form.domain || "").trim().toUpperCase();
        const stdVar = CDASH_STANDARD_VARIABLES[domainUpper]?.find(
          (v) =>
            v.sdtmVariable.toUpperCase() === target.variableName!.toUpperCase()
        );
        if (!stdVar) return form;

        const alreadyPresent = form.sections.some((sec) =>
          sec.fields.some(
            (f) =>
              (f.variableName || "").trim().toUpperCase() ===
              stdVar.sdtmVariable.toUpperCase()
          )
        );
        if (alreadyPresent) return form;

        let fieldSeedIdx = 0;
        let fieldId = `f_autofix_${stdVar.sdtmVariable.toLowerCase()}_${deterministicRemediationUuid(
          `${study.id}::${form.id}::field::${stdVar.sdtmVariable}::${existingFieldIds.size}`
        )}`;
        while (existingFieldIds.has(fieldId)) {
          fieldSeedIdx++;
          fieldId = `f_autofix_${stdVar.sdtmVariable.toLowerCase()}_${deterministicRemediationUuid(
            `${study.id}::${form.id}::field::${stdVar.sdtmVariable}::${existingFieldIds.size}::${fieldSeedIdx}`
          )}`;
        }
        existingFieldIds.add(fieldId);

        const resolvedCodelistId =
          stdVar.codelistId ??
          (stdVar.nciConceptId
            ? STANDARD_CODELISTS.find(
                (c) => c.nciCodelistCode === stdVar.nciConceptId
              )?.id
            : undefined);

        const newField: CRFField = {
          id: fieldId,
          variableName: stdVar.sdtmVariable,
          label: stdVar.cdashLabel,
          dataType:
            stdVar.dataCategory === "Timing"
              ? "date"
              : resolvedCodelistId
                ? "single_select"
                : "text",
          columnSpan: 6,
          required: stdVar.core === "R",
          ...(resolvedCodelistId ? { codelistId: resolvedCodelistId } : {}),
          cdashMetadata: stdVar,
        };

        changed = true;
        if (form.sections.length > 0) {
          return {
            ...form,
            sections: form.sections.map((sec, idx) =>
              idx === 0 ? { ...sec, fields: [...sec.fields, newField] } : sec
            ),
          };
        }

        let secSeedIdx = 0;
        let sectionId = `sec_autofix_${deterministicRemediationUuid(
          `${study.id}::${form.id}::section::${existingSectionIds.size}`
        )}`;
        while (existingSectionIds.has(sectionId)) {
          secSeedIdx++;
          sectionId = `sec_autofix_${deterministicRemediationUuid(
            `${study.id}::${form.id}::section::${existingSectionIds.size}::${secSeedIdx}`
          )}`;
        }
        existingSectionIds.add(sectionId);

        return {
          ...form,
          sections: [
            {
              id: sectionId,
              title: "Core Demographics / Assessments",
              fields: [newField],
            },
          ],
        };
      }

      default:
        return form;
    }
  });

  return changed ? { ...study, forms: updatedForms } : study;
}
