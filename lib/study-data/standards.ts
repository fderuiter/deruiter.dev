/**
 * The clinical standards profile: the one place every standard version and
 * the controlled terminology claim are declared.
 *
 * CRF Studio, the Study Data Pipeline, the clinical platform and the arcade
 * games all read their versions from here, so an export footer, a TS
 * parameter, a Define-XML attribute and a USDM code system version cannot
 * disagree. This file imports nothing, so any module can depend on it
 * without creating a cycle.
 *
 * Changing a version here is a controlled upgrade with an impact report, not
 * an edit (ADR 0065).
 */

/** How far the controlled terminology the site uses has been checked. */
export interface ControlledTerminologyClaim {
  /** The NCI EVS CDISC CT package the codes are aligned to. */
  readonly package: string;
  /** Release date of that package, as NCI EVS publishes it. */
  readonly packageDate: string;
  /**
   * A local, hand-curated subset of codelists and terms, not the whole
   * package. No new codelists are added through this profile.
   */
  readonly scope: "local subset";
  /**
   * The package file the subset was verified against, when it has been.
   * Absent: the codes have not been verified against a downloaded package.
   */
  readonly verifiedAgainst?: string;
}

/** Every standard the site cites, with its pinned version. */
export interface ClinicalStandardsProfile {
  /** CDISC Unified Study Definitions Model, as the v4.0.0 API schema. */
  readonly USDM: string;
  /** CDASH Implementation Guide. */
  readonly CDASHIG: string;
  /** SDTM model. */
  readonly SDTM: string;
  /** SDTM Implementation Guide. */
  readonly SDTMIG: string;
  /** ADaM model. */
  readonly ADaM: string;
  /** ADaM Implementation Guide. */
  readonly ADaMIG: string;
  /** SDTM and SDTMIG Conformance Rules. */
  readonly "SDTM-CR": string;
  /** ADaM Occurrence Data Structure, which ADAE follows. */
  readonly OCCDS: string;
  /** ADaM Conformance Rules. */
  readonly "ADaM-CR": string;
  /** Define-XML. */
  readonly "Define-XML": string;
  /** Dataset-JSON. */
  readonly "Dataset-JSON": string;
  /** Analysis Results Standard. */
  readonly ARS: string;
  /** Operational Data Model. */
  readonly ODM: string;
  /** The controlled terminology claim. */
  readonly CT: ControlledTerminologyClaim;
}

/** The pinned profile. Frozen, so a consumer cannot change it at run time. */
export const CLINICAL_STANDARDS_PROFILE: ClinicalStandardsProfile =
  Object.freeze({
    USDM: "4.0.0",
    CDASHIG: "2.2",
    SDTM: "2.0",
    SDTMIG: "3.4",
    ADaM: "2.1",
    ADaMIG: "1.3",
    "SDTM-CR": "2.0",
    OCCDS: "1.0",
    "ADaM-CR": "5.0",
    "Define-XML": "2.1",
    "Dataset-JSON": "1.1",
    ARS: "1.0",
    ODM: "1.3.2",
    CT: Object.freeze({
      package: "SDTM CT",
      packageDate: "2026-09-25",
      scope: "local subset",
    }),
  });

/** A standard of the profile, other than the CT claim. */
export type ProfileStandard = Exclude<keyof ClinicalStandardsProfile, "CT">;

const DISPLAY_NAMES: Readonly<Record<ProfileStandard, string>> = {
  USDM: "USDM",
  CDASHIG: "CDASHIG",
  SDTM: "SDTM",
  SDTMIG: "SDTMIG",
  ADaM: "ADaM",
  ADaMIG: "ADaMIG",
  "SDTM-CR": "SDTM and SDTMIG Conformance Rules",
  OCCDS: "ADaM OCCDS",
  "ADaM-CR": "ADaM Conformance Rules",
  "Define-XML": "Define-XML",
  "Dataset-JSON": "Dataset-JSON",
  ARS: "ARS",
  ODM: "ODM",
};

/**
 * A standard's name and version, as copy and export footers cite it.
 *
 * @param standard - The standard.
 * @returns For example `SDTMIG 3.4` or `ADaM OCCDS 1.0`.
 */
export function standardCitation(standard: ProfileStandard): string {
  return `${DISPLAY_NAMES[standard]} ${CLINICAL_STANDARDS_PROFILE[standard]}`;
}

/**
 * The CT package as copy cites it.
 *
 * @returns For example `SDTM CT 2026-09-25`.
 */
export function controlledTerminologyCitation(): string {
  const { package: name, packageDate } = CLINICAL_STANDARDS_PROFILE.CT;
  return `${name} ${packageDate}`;
}
