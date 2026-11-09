/**
 * Plain-language definitions for the clinical terms the site's clinical pages
 * use before they explain them (#3145). One list serves every page, so a term
 * reads the same on `/clinical`, `/study-data`, `/crf` and the simulator.
 *
 * A term links to a standard only where a public page for it exists. The
 * standard is named next to the link, because for TLF and CRF the page is a
 * related standard rather than a definition of the term itself.
 *
 * @module
 */

/** The public page of the standard that governs a term. */
export interface ClinicalStandardLink {
  /** The standard's name, shown as the link text. */
  name: string;
  /** The standard's public page. */
  url: string;
}

/** One glossary term with its one-sentence definition. */
export interface ClinicalGlossaryEntry {
  /** Stable lookup key, used by `GlossaryTerm`. */
  id: ClinicalGlossaryId;
  /** The term as it appears on the page. */
  term: string;
  /** One plain sentence a reader new to clinical data can follow. */
  definition: string;
  /** The governing standard, where a public page exists. */
  standard?: ClinicalStandardLink;
}

/** The keys of the ten glossary terms. */
export type ClinicalGlossaryId =
  | "usdm"
  | "sdtm"
  | "adam"
  | "define-xml"
  | "tlf"
  | "crf"
  | "core"
  | "cdash"
  | "database-lock"
  | "protocol-amendment";

const CDISC = "https://www.cdisc.org/standards";

/** The ten clinical terms, in the order a study's data moves through them. */
export const CLINICAL_GLOSSARY: readonly ClinicalGlossaryEntry[] = [
  {
    id: "usdm",
    term: "USDM",
    definition:
      "The Unified Study Definitions Model is a machine-readable format for a study's design: its objectives, arms, visits and planned activities.",
    standard: {
      name: "CDISC USDM",
      url: "https://github.com/cdisc-org/DDF-RA",
    },
  },
  {
    id: "protocol-amendment",
    term: "Protocol amendment",
    definition:
      "A formal, approved change to a study's protocol, such as a new visit or a revised eligibility rule, made after the protocol was first approved.",
  },
  {
    id: "crf",
    term: "CRF",
    definition:
      "The case report form is the set of questions a study site answers for each participant at each visit.",
    standard: { name: "CDISC CDASH", url: `${CDISC}/foundational/cdash` },
  },
  {
    id: "cdash",
    term: "CDASH",
    definition:
      "The CDISC standard for naming and structuring the fields on a case report form, so that collected data maps cleanly into SDTM.",
    standard: { name: "CDISC CDASH", url: `${CDISC}/foundational/cdash` },
  },
  {
    id: "sdtm",
    term: "SDTM",
    definition:
      "The Study Data Tabulation Model is the standard layout for the data collected in a study, organized into domains such as demographics and adverse events.",
    standard: { name: "CDISC SDTM", url: `${CDISC}/foundational/sdtm` },
  },
  {
    id: "core",
    term: "CORE",
    definition:
      "CDISC's open-source rules engine, which checks study data against the published conformance rules.",
    standard: {
      name: "CDISC CORE",
      url: "https://github.com/cdisc-org/cdisc-rules-engine",
    },
  },
  {
    id: "database-lock",
    term: "Database Lock",
    definition:
      "The point at which a study's data are declared clean and frozen, so that the final analysis runs on data that cannot change without a documented unlock.",
  },
  {
    id: "adam",
    term: "ADaM",
    definition:
      "The Analysis Data Model is the standard for analysis-ready datasets built from SDTM, so that each result can be traced back to the collected data.",
    standard: { name: "CDISC ADaM", url: `${CDISC}/foundational/adam` },
  },
  {
    id: "define-xml",
    term: "Define-XML",
    definition:
      "A machine-readable file that describes every dataset and variable in a submission, including where each value came from.",
    standard: {
      name: "CDISC Define-XML",
      url: `${CDISC}/data-exchange/define-xml`,
    },
  },
  {
    id: "tlf",
    term: "TLF",
    definition:
      "Tables, listings and figures are the summaries of a study's results that go into the clinical study report.",
    standard: {
      name: "CDISC Analysis Results Standard",
      url: `${CDISC}/foundational/analysis-results-standard`,
    },
  },
];

/**
 * Looks up one glossary term by its key.
 *
 * @param id The term's key.
 * @returns The entry.
 */
export function getClinicalGlossaryEntry(
  id: ClinicalGlossaryId
): ClinicalGlossaryEntry {
  const entry = CLINICAL_GLOSSARY.find((candidate) => candidate.id === id);
  if (!entry) {
    throw new Error(`Unknown clinical glossary term: ${id}`);
  }
  return entry;
}
