/**
 * The pipeline's local controlled terminology subset: the codelists that SDTM
 * and ADaM variables point to through `VariableMeta.codelist`, and from which
 * Define-XML writes its CodeLists.
 *
 * The CDISC entries are hand-curated. `__tests__/cdisc-ct-release.test.ts`
 * checks each codelist's NCI code, publishing set and extensibility, and each
 * term's submission value and NCI code, against the NCI EVS release of the
 * CT package date in `STANDARD_VERSIONS`. The subset covers only what the
 * pipeline uses, so it is not a claim of conformance to the whole package.
 * Sponsor-defined entries carry no NCI code.
 */

/** One term of a codelist. */
export interface TerminologyTerm {
  /** The submission value, for example `Y`. */
  readonly value: string;
  /** Decode, when the codelist has one, for example `Yes`. */
  readonly decode?: string;
  /** NCI code of the term, for example `C49488`. CDISC terms only. */
  readonly nciCode?: string;
}

/** One codelist of the local terminology subset. */
export interface TerminologyCodelist {
  /** Codelist id, the value of `VariableMeta.codelist`, for example `NY`. */
  readonly id: string;
  /** Codelist name. */
  readonly name: string;
  /**
   * The CDISC CT publishing set the codelist belongs to. Absent for a
   * sponsor-defined codelist.
   */
  readonly publishingSet?: "SDTM" | "ADaM";
  /** NCI code of the codelist, for CDISC codelists. */
  readonly nciCode?: string;
  /**
   * Whether values outside `terms` are allowed. They are written to
   * Define-XML as extended values. A value outside a non-extensible codelist
   * is an error: the data keeps it as collected, a conformance rule reports
   * it, and Define-XML describes the planned codelist without it (#3020).
   */
  readonly extensible: boolean;
  /** The planned terms, in display order. */
  readonly terms: readonly TerminologyTerm[];
  /**
   * When set, the terms are read from the data instead: every value of the
   * coded variable, with its decode taken from the paired variable named in
   * `DECODE_VARIABLES`. Used for sponsor lists such as arm and parameter
   * codes, whose terms the study design defines.
   */
  readonly fromData?: true;
}

/**
 * The variable that holds the decode of a coded variable, for codelists
 * whose decodes come from the data: `ARMCD` is decoded by `ARM`, `PARAMCD`
 * by `PARAM`, and so on.
 */
export const DECODE_VARIABLES: Readonly<Record<string, string>> = Object.freeze(
  {
    ARMCD: "ARM",
    ACTARMCD: "ACTARM",
    PARAMCD: "PARAM",
    VSTESTCD: "VSTEST",
    LBTESTCD: "LBTEST",
    EGTESTCD: "EGTEST",
  }
);

const cdisc = <Id extends string>(
  id: Id,
  name: string,
  publishingSet: "SDTM" | "ADaM",
  nciCode: string,
  extensible: boolean,
  terms: readonly TerminologyTerm[]
): TerminologyCodelist & { readonly id: Id } => ({
  id,
  name,
  publishingSet,
  nciCode,
  extensible,
  terms,
});

const term = (
  value: string,
  nciCode: string,
  decode?: string
): TerminologyTerm =>
  decode ? { value, decode, nciCode } : { value, nciCode };

/** A codelist id of the local terminology subset. */
export type CodelistId =
  | "NY"
  | "SEX"
  | "RACEC"
  | "AGEU"
  | "DOMAIN"
  | "EPOCH"
  | "VSTESTCD"
  | "LBTESTCD"
  | "EGTESTCD"
  | "VSRESU"
  | "UNIT"
  | "FRM"
  | "FREQ"
  | "ROUTE"
  | "STENRF"
  | "NRIND"
  | "ACN"
  | "DSCAT"
  | "IECAT"
  | "DTYPE"
  | "DATEFL"
  | "SBJTSTAT"
  | "AEREL"
  | "ARMCD"
  | "ARMNULRS"
  | "AGEGR1"
  | "ADVS.PARAMCD"
  | "ADLB.PARAMCD"
  | "ADEG.PARAMCD"
  | "ADQS.PARAMCD"
  | "ADTTE.PARAMCD"
  | "ADHCE.PARAMCD";

const CODELISTS = [
  cdisc("NY", "No Yes Response", "SDTM", "C66742", false, [
    term("N", "C49487", "No"),
    term("Y", "C49488", "Yes"),
  ]),
  cdisc("SEX", "Sex", "SDTM", "C66731", false, [
    term("F", "C16576", "Female"),
    term("M", "C20197", "Male"),
    term("U", "C17998", "Unknown"),
  ]),
  // DM.RACE takes Race As Collected: the SDTM RACE codelist (C74457) was
  // last published in SDTM CT 2025-09-26, as CRF Studio's CL_RACE notes.
  cdisc("RACEC", "Race As Collected", "SDTM", "C128689", true, [
    term("AMERICAN INDIAN OR ALASKA NATIVE", "C41259"),
    term("ASIAN", "C41260"),
    term("BLACK OR AFRICAN AMERICAN", "C16352"),
    term("NATIVE HAWAIIAN OR PACIFIC ISLANDER", "C41219"),
    term("WHITE", "C41261"),
  ]),
  cdisc("AGEU", "Age Unit", "SDTM", "C66781", false, [term("YEARS", "C29848")]),
  cdisc("DOMAIN", "SDTM Domain Abbreviation", "SDTM", "C66734", true, [
    term("AE", "C49562"),
    term("CM", "C49568"),
    term("CO", "C49569"),
    term("DM", "C49572"),
    term("DS", "C49576"),
    term("EG", "C49626"),
    term("EX", "C49587"),
    term("IE", "C61536"),
    term("LB", "C49592"),
    term("MH", "C49603"),
    term("SE", "C49616"),
    term("SV", "C49617"),
    term("TA", "C49618"),
    term("TE", "C49619"),
    term("TI", "C49620"),
    term("TS", "C53483"),
    term("TV", "C49621"),
    term("VS", "C49622"),
  ]),
  cdisc("EPOCH", "Epoch", "SDTM", "C99079", true, [
    term("SCREENING", "C202487"),
    term("TREATMENT", "C101526"),
    term("FOLLOW-UP", "C202578"),
  ]),
  {
    ...cdisc("VSTESTCD", "Vital Signs Test Code", "SDTM", "C66741", true, [
      term("SYSBP", "C25298"),
      term("DIABP", "C25299"),
      term("PULSE", "C49676"),
      term("WEIGHT", "C25208"),
    ]),
    fromData: true,
  },
  {
    ...cdisc("LBTESTCD", "Laboratory Test Code", "SDTM", "C65047", true, [
      term("ALT", "C64433"),
      term("AST", "C64467"),
      term("BILI", "C38037"),
      term("CREAT", "C64547"),
      term("GLUC", "C105585"),
      term("HGB", "C64848"),
      term("WBC", "C51948"),
      term("PLAT", "C51951"),
    ]),
    fromData: true,
  },
  {
    ...cdisc("EGTESTCD", "ECG Test Code", "SDTM", "C71153", true, [
      term("EGHRMN", "C119259"),
      term("PRAG", "C117773"),
      term("QRSAG", "C117779"),
      term("QTAG", "C117783"),
      term("RRAG", "C117791"),
    ]),
    fromData: true,
  },
  cdisc("VSRESU", "Units for Vital Signs Results", "SDTM", "C66770", true, [
    term("mmHg", "C49670"),
    term("beats/min", "C49673"),
    term("kg", "C28252"),
  ]),
  cdisc("UNIT", "Unit", "SDTM", "C71620", true, [
    term("U/L", "C67456"),
    term("umol/L", "C48508"),
    term("mmol/L", "C64387"),
    term("mg/dL", "C67015"),
    term("g/L", "C42576"),
    term("10^9/L", "C67255"),
    term("TABLET", "C48542"),
    term("ms", "C41140"),
    term("beats/min", "C49673"),
    term("mg", "C28253"),
  ]),
  cdisc("FRM", "Dosage Form", "SDTM", "C66726", true, [
    term("TABLET", "C42998"),
  ]),
  cdisc("FREQ", "Frequency", "SDTM", "C71113", true, [
    term("QD", "C25473"),
    term("BID", "C64496"),
    term("PRN", "C64499"),
  ]),
  cdisc("ROUTE", "Route of Administration Response", "SDTM", "C66729", true, [
    term("ORAL", "C38288"),
  ]),
  cdisc("STENRF", "Relation to Reference Period", "SDTM", "C66728", false, [
    term("ONGOING", "C53279"),
  ]),
  cdisc("NRIND", "Reference Range Indicator", "SDTM", "C78736", true, [
    term("NORMAL", "C78727"),
    term("LOW", "C78801"),
    term("HIGH", "C78800"),
  ]),
  cdisc("ACN", "Action Taken with Study Treatment", "SDTM", "C66767", false, [
    term("DOSE NOT CHANGED", "C49504"),
    term("DRUG WITHDRAWN", "C49502"),
  ]),
  cdisc("DSCAT", "Category of Disposition Event", "SDTM", "C74558", false, [
    term("PROTOCOL MILESTONE", "C74588"),
    term("DISPOSITION EVENT", "C74590"),
  ]),
  cdisc("IECAT", "Category of Inclusion/Exclusion", "SDTM", "C66797", false, [
    term("INCLUSION", "C25532"),
    term("EXCLUSION", "C25370"),
  ]),
  cdisc("DTYPE", "Derivation Type", "ADaM", "C81224", true, [
    term("LOCF", "C81198"),
  ]),
  cdisc("DATEFL", "Date Imputation Flag", "ADaM", "C81223", false, [
    term("D", "C81212"),
    term("M", "C81211"),
    term("Y", "C81210"),
  ]),
  cdisc("SBJTSTAT", "Subject Trial Status", "ADaM", "C124296", true, [
    term("COMPLETED", "C25250"),
    term("DISCONTINUED", "C25484"),
  ]),
  {
    id: "AEREL" as const,
    name: "Causality",
    extensible: false,
    terms: [{ value: "NOT RELATED" }, { value: "POSSIBLY RELATED" }],
  },
  {
    id: "ARMCD" as const,
    name: "Planned Arm Code",
    extensible: false,
    terms: [],
    fromData: true,
  },
  cdisc("ARMNULRS", "Arm Null Reason", "SDTM", "C142179", true, [
    term("ASSIGNED, NOT TREATED", "C142238"),
    term("NOT ASSIGNED", "C142239"),
    term("SCREEN FAILURE", "C49628"),
    term("SCREENING NOT COMPLETED", "C166074"),
    term("UNPLANNED TREATMENT", "C142240"),
  ]),
  {
    id: "AGEGR1" as const,
    name: "Age Group",
    extensible: false,
    terms: [{ value: "<40" }, { value: "40-64" }, { value: "65+" }],
  },
  ...(["ADVS", "ADLB", "ADEG", "ADQS", "ADTTE", "ADHCE"] as const).map(
    (
      dataset
    ): TerminologyCodelist & { readonly id: `${typeof dataset}.PARAMCD` } => ({
      id: `${dataset}.PARAMCD`,
      name: `${dataset} Parameter Code`,
      extensible: false,
      terms: [],
      fromData: true,
    })
  ),
] satisfies readonly (TerminologyCodelist & { readonly id: CodelistId })[];

/**
 * The local controlled terminology subset, in the order Define-XML writes
 * it. Checked against the NCI EVS release; see the module comment.
 */
export const CONTROLLED_TERMINOLOGY: readonly TerminologyCodelist[] =
  Object.freeze(CODELISTS);

/**
 * Looks up one codelist of the local terminology subset.
 *
 * @throws RangeError when the id is not in the subset.
 */
export function terminologyCodelist(id: string): TerminologyCodelist {
  const codelist = CONTROLLED_TERMINOLOGY.find((entry) => entry.id === id);
  if (!codelist) {
    throw new RangeError(`Codelist ${id} is not in the terminology subset.`);
  }
  return codelist;
}
