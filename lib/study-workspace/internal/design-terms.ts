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
 * Epoch types: the terms of the SDTM Epoch codelist that the repository's
 * CT subset resolves. The codelist has more (Baseline, Long-Term
 * Follow-Up and others); each joins this list once the subset is
 * regenerated to hold it, so no code is offered that the CT check has not
 * resolved.
 */
export const STUDY_EPOCH_TYPES: readonly StudyDesignTerm[] = [
  { code: "C202487", decode: "Screening" },
  { code: "C98779", decode: "Run-In" },
  { code: "C42872", decode: "Washout" },
  { code: "C101526", decode: "Treatment" },
  { code: "C202578", decode: "Follow-Up" },
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
