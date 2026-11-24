import { CLINICAL_STANDARDS_PROFILE } from "@/lib/clinical-standards";
import type { StudyDesignTerm } from "../types";

/**
 * Coded terms the design grid offers when the person adds an arm or an
 * epoch. Each code is a CDISC term from the pinned CT package
 * (`CLINICAL_STANDARDS_PROFILE.CT`), checked by the CT subset test. None is
 * picked for the person: adding an arm or epoch names its type.
 */

/** Arm types: the Arm Type codelist terms. */
export const STUDY_ARM_TYPES: readonly StudyDesignTerm[] = [
  { code: "C174266", decode: "Experimental Arm" },
  { code: "C174267", decode: "Active Comparator Arm" },
  { code: "C174268", decode: "Placebo Comparator Arm" },
  { code: "C174269", decode: "Sham Comparator Arm" },
  { code: "C174270", decode: "No Intervention Arm" },
];

/**
 * Epoch types: the terms of the SDTM Epoch codelist (C99079), in the
 * order a study usually runs through them.
 */
export const STUDY_EPOCH_TYPES: readonly StudyDesignTerm[] = [
  { code: "C199844", decode: "Pre-Screening" },
  { code: "C202487", decode: "Screening" },
  { code: "C98779", decode: "Run-In" },
  { code: "C125938", decode: "Baseline" },
  { code: "C42872", decode: "Washout" },
  { code: "C101526", decode: "Treatment" },
  { code: "C102255", decode: "Blinded Treatment" },
  { code: "C102256", decode: "Open Label Treatment" },
  { code: "C123453", decode: "Induction Treatment" },
  { code: "C123452", decode: "Continuation Treatment" },
  { code: "C209541", decode: "Intervention" },
  { code: "C210380", decode: "Product Exposure" },
  { code: "C165873", decode: "Observation" },
  { code: "C202578", decode: "Follow-Up" },
  { code: "C202577", decode: "Long-Term Follow-Up" },
];

/** Intervention roles: the Study Intervention Role codelist (C207417). */
export const STUDY_INTERVENTION_ROLES: readonly StudyDesignTerm[] = [
  { code: "C41161", decode: "Experimental Intervention" },
  { code: "C68609", decode: "Active Comparator" },
  { code: "C753", decode: "Placebo" },
  { code: "C18020", decode: "Diagnostic" },
  { code: "C165822", decode: "Background Treatment" },
  { code: "C207614", decode: "Additional Required Treatment" },
  { code: "C165835", decode: "Rescue Medicine" },
  { code: "C158128", decode: "Challenge Agent" },
];

/** Intervention types: the Intervention Type codelist (C99078). */
export const STUDY_INTERVENTION_TYPES: readonly StudyDesignTerm[] = [
  { code: "C1909", decode: "Drug" },
  { code: "C307", decode: "Biologic" },
  { code: "C923", decode: "Vaccine" },
  { code: "C54696", decode: "Combination Product" },
  { code: "C16830", decode: "Medical Device" },
  { code: "C15238", decode: "Genetic" },
  { code: "C1505", decode: "Dietary Supplement" },
  { code: "C15184", decode: "Behavioral Therapy" },
  { code: "C98769", decode: "Procedure" },
  { code: "C15329", decode: "Surgery" },
  { code: "C218507", decode: "Non-Surgical Procedure" },
  { code: "C15313", decode: "Radiation" },
  { code: "C18020", decode: "Diagnostic Test" },
];

/**
 * The data origin the schema requires on every arm. A new arm gets
 * "Data Generated Within Study", the term both reference studies use; the
 * grid shows it on the arm so the person can see it.
 */
export const DATA_GENERATED_WITHIN_STUDY: StudyDesignTerm = {
  code: "C188866",
  decode: "Data Generated Within Study",
};

/** The description written with that data origin. */
export const DATA_ORIGIN_DESCRIPTION = "Data collected in this study";

/** A USDM `Code` object for a term. */
export function usdmCode(id: string, term: StudyDesignTerm) {
  return {
    id,
    code: term.code,
    codeSystem: "http://www.cdisc.org",
    codeSystemVersion: CLINICAL_STANDARDS_PROFILE.CT.packageDate,
    decode: term.decode,
    instanceType: "Code" as const,
  };
}
