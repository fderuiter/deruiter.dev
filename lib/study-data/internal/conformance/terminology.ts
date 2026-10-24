/**
 * The pipeline's local controlled terminology subset: the codelists that SDTM
 * and ADaM variables point to through `VariableMeta.codelist`, and from which
 * Define-XML writes its CodeLists.
 *
 * The CDISC entries are hand-curated. Their NCI codes were looked up in the
 * NCI EVS CDISC SDTM and ADaM terminology text exports on 2026-10-24. The
 * subset is aligned to the CT package date in `STANDARD_VERSIONS` but has not
 * been verified against that package, so it is not a claim of conformance to
 * it. Sponsor-defined entries carry no NCI code.
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
   * is an error.
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
  | "AGEU"
  | "DOMAIN"
  | "EPOCH"
  | "VSTESTCD"
  | "LBTESTCD"
  | "VSRESU"
  | "UNIT"
  | "NRIND"
  | "ACN"
  | "DSCAT"
  | "IECAT"
  | "DTYPE"
  | "DATEFL"
  | "SBJTSTAT"
  | "AEREL"
  | "ARMCD"
  | "AGEGR1"
  | "ADVS.PARAMCD"
  | "ADLB.PARAMCD"
  | "ADTTE.PARAMCD";

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
  cdisc("AGEU", "Age Unit", "SDTM", "C66781", false, [term("YEARS", "C29848")]),
  cdisc("DOMAIN", "SDTM Domain Abbreviation", "SDTM", "C66734", true, [
    term("AE", "C49562"),
    term("DM", "C49572"),
    term("DS", "C49576"),
    term("EX", "C49587"),
    term("LB", "C49592"),
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
  cdisc("VSRESU", "Units for Vital Signs Results", "SDTM", "C66770", true, [
    term("mmHg", "C49670"),
    term("beats/min", "C49673"),
    term("kg", "C28252"),
  ]),
  cdisc("UNIT", "Unit", "SDTM", "C71620", true, [
    term("U/L", "C67456"),
    term("umol/L", "C48508"),
    term("mmol/L", "C64387"),
    term("g/L", "C42576"),
    term("10^9/L", "C67255"),
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
  {
    id: "AGEGR1" as const,
    name: "Age Group",
    extensible: false,
    terms: [{ value: "<40" }, { value: "40-64" }, { value: "65+" }],
  },
  ...(["ADVS", "ADLB", "ADTTE"] as const).map(
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
 * it. Not verified against the NCI EVS package; see the module comment.
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
