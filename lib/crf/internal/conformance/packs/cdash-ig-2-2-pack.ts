import { standardCitation } from "@/lib/clinical-standards";
import type { CRFForm } from "../../../types";
import { CDASH_STANDARD_VARIABLES } from "../../cdisc-cdash-library";
import type {
  ConformanceEvaluationContext,
  ConformanceFinding,
  ConformanceRulePack,
} from "../types";

const CHOICE_DATA_TYPES = new Set<string>([
  "radio",
  "single_select",
  "checkbox",
  "multi_select",
]);

const DATE_DATA_TYPES = new Set<string>([
  "date",
  "datetime",
  "partial_date",
  "precision_date",
]);

const ISO_DATE_OR_PARTIAL_RE =
  /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/;
const ISO_PARTIAL_UNK_RE = /^\d{4}(?:-UNK|-(?:0[1-9]|1[0-2])-UNK)$/;
const ISO_DATETIME_RE =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;

/**
 * Checks whether a default date/datetime value conforms to ISO 8601 date,
 * partial date, full ISO 8601 `datetime` (with optional seconds/offset), or
 * CDISC null flavors (`ND`, `NA`, `UNK`).
 */
export function isValidIso8601DateDefault(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed === "ND" || trimmed === "NA" || trimmed === "UNK") return true;
  if (ISO_PARTIAL_UNK_RE.test(trimmed)) return true;
  if (ISO_DATE_OR_PARTIAL_RE.test(trimmed)) return true;
  if (ISO_DATETIME_RE.test(trimmed)) return true;
  return false;
}

function getEvaluatedForms(ctx: ConformanceEvaluationContext): CRFForm[] {
  const { document, scope, targetFormId } = ctx;
  if (scope === "form" && targetFormId) {
    const node = document.forms.byId[targetFormId];
    return node ? [node.form] : [];
  }
  return document.forms.order
    .map((id) => document.forms.byId[id]?.form)
    .filter((f): f is CRFForm => Boolean(f));
}

/**
 * Declarative CDISC CDASHIG 2.2 / SDTMIG v3.4 conformance rule pack.
 * Standardizes `SD0001`, `SD0002`, and `SD0004` as `"error"` and `SD0003` as `"warning"`.
 */
export const CDASH_IG_2_2_CONFORMANCE_PACK: ConformanceRulePack = {
  id: "cdash-ig-2.2",
  name: `CDISC ${standardCitation("CDASHIG")} / ${standardCitation("SDTMIG")} Conformance Pack`,
  version: "2.2.0",
  standardCitation: `${standardCitation("CDASHIG")} / ${standardCitation("SDTMIG")}`,
  rules: [
    {
      ruleId: "SD0001",
      description:
        "Variable name exceeds 8-character CDISC SDTM submission length limit",
      defaultSeverity: "error",
      tier: "cdash",
      evaluate(ctx: ConformanceEvaluationContext): ConformanceFinding[] {
        const findings: ConformanceFinding[] = [];
        for (const form of getEvaluatedForms(ctx)) {
          for (const section of form.sections || []) {
            for (const field of section.fields || []) {
              const rawVar = (field.variableName || "").trim();
              if (rawVar.length > 8) {
                const truncated = rawVar.slice(0, 8).toUpperCase();
                findings.push({
                  id: `SD0001_${form.id}_${field.id}`,
                  packId: "cdash-ig-2.2",
                  packVersion: "2.2.0",
                  tier: "cdash",
                  ruleId: "SD0001",
                  legacyEngineRule: "CDASH-VAR-LEN",
                  ruleDescription:
                    "Variable name exceeds 8-character CDISC SDTM length limit",
                  severity: "error",
                  formId: form.id,
                  formName: form.name,
                  formDomain: form.domain,
                  location: `Field "${field.label}"`,
                  fieldId: field.id,
                  variableName: field.variableName,
                  message: `Variable '${field.variableName}' exceeds CDISC 8-character limit (${rawVar.length} chars). SDTM standard requires <= 8 characters.`,
                  autoFixAvailable: true,
                  autoFixType: "truncate_variable",
                  suggestedFix: `Truncate to '${truncated}'`,
                });
              }
            }
          }
        }
        return findings;
      },
    },
    {
      ruleId: "SD0002",
      description:
        "Active standard CDASH domains must include all Required (R) and Highly Recommended (HR) core variables",
      defaultSeverity: "error",
      tier: "cdash",
      evaluate(ctx: ConformanceEvaluationContext): ConformanceFinding[] {
        const findings: ConformanceFinding[] = [];
        for (const form of getEvaluatedForms(ctx)) {
          const domainUpper = (form.domain || "").trim().toUpperCase();
          const standardVars = CDASH_STANDARD_VARIABLES[domainUpper];
          if (!standardVars || standardVars.length === 0) continue;

          const presentVariables = new Set<string>();
          for (const section of form.sections || []) {
            for (const field of section.fields || []) {
              const v = (field.variableName || "").trim().toUpperCase();
              if (v) presentVariables.add(v);
            }
          }

          const coreVariables = standardVars.filter(
            (v) => v.core === "R" || v.core === "HR"
          );
          for (const coreVar of coreVariables) {
            if (!presentVariables.has(coreVar.sdtmVariable.toUpperCase())) {
              findings.push({
                id: `SD0002_${form.id}_${coreVar.sdtmVariable}`,
                packId: "cdash-ig-2.2",
                packVersion: "2.2.0",
                tier: "cdash",
                ruleId: "SD0002",
                legacyEngineRule: "SD0002",
                ruleDescription: `Missing CDASH Core (${coreVar.core}) variable: ${coreVar.sdtmVariable}`,
                severity: "error",
                formId: form.id,
                formName: form.name,
                formDomain: form.domain,
                location: `Form "${form.name}"`,
                variableName: coreVar.sdtmVariable,
                message: `Domain '${domainUpper}' is missing standard CDASH Core variable '${coreVar.sdtmVariable}' (${coreVar.cdashLabel}).`,
                autoFixAvailable: true,
                autoFixType: "add_core_variable",
                suggestedFix: `Add '${coreVar.sdtmVariable}' field to form`,
              });
            }
          }
        }
        return findings;
      },
    },
    {
      ruleId: "SD0003",
      description:
        "Choice fields should bind a standard NCI controlled terminology codelist or explicit discrete options",
      defaultSeverity: "warning",
      tier: "cdash",
      evaluate(ctx: ConformanceEvaluationContext): ConformanceFinding[] {
        const findings: ConformanceFinding[] = [];
        for (const form of getEvaluatedForms(ctx)) {
          for (const section of form.sections || []) {
            for (const field of section.fields || []) {
              if (
                CHOICE_DATA_TYPES.has(field.dataType) &&
                !field.codelistId &&
                (!field.customOptions || field.customOptions.length === 0)
              ) {
                findings.push({
                  id: `SD0003_${form.id}_${field.id}`,
                  packId: "cdash-ig-2.2",
                  packVersion: "2.2.0",
                  tier: "cdash",
                  ruleId: "SD0003",
                  legacyEngineRule: "SD0003",
                  ruleDescription:
                    "Codelist selection missing controlled terminology binding",
                  severity: "warning",
                  formId: form.id,
                  formName: form.name,
                  formDomain: form.domain,
                  location: `Field "${field.label}"`,
                  fieldId: field.id,
                  variableName: field.variableName,
                  message: `Choice field '${field.variableName || field.label}' has no standard NCI codelist or custom options configured.`,
                  autoFixAvailable: true,
                  autoFixType: "assign_nci_codelist",
                  suggestedFix: "Assign standard No/Yes (NY) codelist (C66742)",
                });
              }
            }
          }
        }
        return findings;
      },
    },
    {
      ruleId: "SD0004",
      description:
        "Default values on date and datetime fields must conform to ISO 8601",
      defaultSeverity: "error",
      tier: "cdash",
      evaluate(ctx: ConformanceEvaluationContext): ConformanceFinding[] {
        const findings: ConformanceFinding[] = [];
        for (const form of getEvaluatedForms(ctx)) {
          for (const section of form.sections || []) {
            for (const field of section.fields || []) {
              if (
                DATE_DATA_TYPES.has(field.dataType) &&
                field.defaultValue !== undefined &&
                field.defaultValue !== null &&
                field.defaultValue !== "" &&
                !isValidIso8601DateDefault(field.defaultValue)
              ) {
                findings.push({
                  id: `SD0004_${form.id}_${field.id}`,
                  packId: "cdash-ig-2.2",
                  packVersion: "2.2.0",
                  tier: "cdash",
                  ruleId: "SD0004",
                  legacyEngineRule: "SD0004",
                  ruleDescription:
                    "Default date/datetime value does not conform to ISO 8601 standard",
                  severity: "error",
                  formId: form.id,
                  formName: form.name,
                  formDomain: form.domain,
                  location: `Field "${field.label}"`,
                  fieldId: field.id,
                  variableName: field.variableName,
                  message: `Default value '${String(field.defaultValue)}' for date field '${field.variableName || field.label}' is not valid ISO 8601.`,
                  autoFixAvailable: true,
                  autoFixType: "fix_date_format",
                  suggestedFix: "Reset invalid date default to empty string",
                });
              }
            }
          }
        }
        return findings;
      },
    },
  ],
};
