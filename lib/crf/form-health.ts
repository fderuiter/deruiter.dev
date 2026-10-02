import { CRFForm } from "./types";

export interface FormHealthMetrics {
  totalFields: number;
  mandatoryFields: number;
  codelistsAttached: number;
  sdvVerifiedCount: number;
  sdvReadinessPercentage: number;
  cdashConformancePercentage: number;
  missingCoreVariables: string[];
}

export const CDASH_CORE_DOMAIN_VARIABLES: Record<string, string[]> = {
  DM: ["SEX", "AGE", "RACE"],
  VS: ["VSTESTCD", "VSORRES", "VSDTC"],
  AE: ["AETERM", "AESTDTC", "AESEV", "AESER", "AEREL"],
  LB: ["LBTESTCD", "LBORRES", "LBDTC"],
  CM: ["CMTRT", "CMSTDTC", "CMDOS"],
  MH: ["MHTERM", "MHSTDTC"],
  EG: ["EGTESTCD", "EGORRES", "EGDTC"],
  PE: ["PETESTCD", "PEORRES"],
  DS: ["DSDECOD", "DSSTDTC"],
  DA: ["DATESTCD", "DAORRES"],
};

/**
 * Computes live health and CDASH 2.2 conformance telemetry metrics for a CRF form.
 */
export function computeFormHealthMetrics(form: CRFForm): FormHealthMetrics {
  const sections = form?.sections || [];
  const allFields = sections.flatMap((s) => s?.fields || []).filter(Boolean);
  const totalFields = allFields.length;
  const mandatoryFields = allFields.filter((f) => Boolean(f?.required)).length;
  const codelistsAttached = allFields.filter((f) =>
    Boolean(f?.codelistId || (f?.customOptions && f.customOptions.length > 0))
  ).length;
  const sdvVerifiedCount = allFields.filter((f) =>
    Boolean(f?.sdvVerified)
  ).length;
  const sdvReadinessPercentage =
    totalFields > 0 ? Math.round((sdvVerifiedCount / totalFields) * 100) : 0;

  const domain = (form?.domain || "").toUpperCase();
  const coreVars = CDASH_CORE_DOMAIN_VARIABLES[domain] || [];

  const presentVarNames = new Set(
    allFields
      .map((f) =>
        f && typeof f.variableName === "string"
          ? f.variableName.trim().toUpperCase()
          : ""
      )
      .filter((v) => v.length > 0)
  );
  const missingCoreVariables = coreVars.filter((v) => !presentVarNames.has(v));

  let cdashConformancePercentage = 100;
  if (coreVars.length > 0) {
    const presentCoreCount = coreVars.length - missingCoreVariables.length;
    cdashConformancePercentage = Math.round(
      (presentCoreCount / coreVars.length) * 100
    );
  }

  return {
    totalFields,
    mandatoryFields,
    codelistsAttached,
    sdvVerifiedCount,
    sdvReadinessPercentage,
    cdashConformancePercentage,
    missingCoreVariables,
  };
}
