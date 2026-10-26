/**
 * The study's fictional adverse event dictionary, in MedDRA's five-level
 * shape. Preferred terms and system organ classes reuse the MedDRA-style
 * names the generator has always written, so AESOC equals AEBODSYS. The
 * lower and group level names are invented, and every code is synthetic:
 * codes start at 99000000 so none can be mistaken for a MedDRA code.
 * MedDRA is licensed, and the package ships none of its content.
 */
export interface AeDictionaryTerm {
  /** Preferred term, written to AEDECOD. */
  readonly pt: string;
  readonly ptcd: number;
  /** Lowest level term; each one shares its preferred term's name and code. */
  readonly llt: string;
  readonly lltcd: number;
  readonly hlt: string;
  readonly hltcd: number;
  readonly hlgt: string;
  readonly hlgtcd: number;
  /** Primary system organ class, written to AEBODSYS and AESOC. */
  readonly soc: string;
  readonly soccd: number;
}

const NERVOUS = { soc: "Nervous system disorders", soccd: 99000001 } as const;
const NEURO_SYMPTOMS = {
  hlgt: "Fictional neurological symptoms",
  hlgtcd: 99000101,
} as const;
const METABOLISM = {
  soc: "Metabolism and nutrition disorders",
  soccd: 99000005,
} as const;
const METABOLIC_CONDITIONS = {
  hlgt: "Fictional metabolic conditions",
  hlgtcd: 99000113,
} as const;
const INFECTIONS = { soc: "Infections and infestations", soccd: 99000006 } as const;
const INFECTIONS_GROUP = {
  hlgt: "Fictional infections",
  hlgtcd: 99000114,
} as const;
const term = (
  pt: string,
  ptcd: number,
  hlt: string,
  hltcd: number,
  group: { readonly hlgt: string; readonly hlgtcd: number },
  soc: { readonly soc: string; readonly soccd: number }
): AeDictionaryTerm => ({
  pt,
  ptcd,
  llt: pt,
  lltcd: ptcd,
  hlt,
  hltcd,
  ...group,
  ...soc,
});

/** The dictionary, in the order the generator draws terms from it. */
export const AE_DICTIONARY: readonly AeDictionaryTerm[] = [
  term(
    "Headache",
    99001001,
    "Fictional headache terms",
    99000201,
    NEURO_SYMPTOMS,
    NERVOUS
  ),
  term(
    "Nausea",
    99001002,
    "Fictional nausea terms",
    99000202,
    { hlgt: "Fictional gastrointestinal symptoms", hlgtcd: 99000102 },
    { soc: "Gastrointestinal disorders", soccd: 99000002 }
  ),
  term(
    "Fatigue",
    99001003,
    "Fictional fatigue terms",
    99000203,
    { hlgt: "Fictional general symptoms", hlgtcd: 99000103 },
    { soc: "General disorders", soccd: 99000003 }
  ),
  term(
    "Dizziness",
    99001004,
    "Fictional dizziness terms",
    99000204,
    NEURO_SYMPTOMS,
    NERVOUS
  ),
];

/** A medical history condition as the site reports it, and its coding. */
export interface HistoryDictionaryEntry {
  /** The condition as the site reports it, written to MHTERM. */
  readonly reported: string;
  readonly term: AeDictionaryTerm;
}

/**
 * Medical history conditions, coded with the same fictional dictionary. They
 * are kept apart from `AE_DICTIONARY` because the generator draws adverse
 * events from that list by position, so adding a term there would change
 * every adverse event drawn after it. A condition's reported name is the
 * indication the concomitant medication page records for it.
 */
export const HISTORY_DICTIONARY: readonly HistoryDictionaryEntry[] = [
  {
    reported: "Hypertension",
    term: term(
      "Hypertension",
      99001101,
      "Fictional vascular hypertensive terms",
      99000211,
      { hlgt: "Fictional vascular conditions", hlgtcd: 99000111 },
      { soc: "Vascular disorders", soccd: 99000004 }
    ),
  },
  {
    reported: "Hypercholesterolaemia",
    term: term(
      "Hypercholesterolaemia",
      99001102,
      "Fictional lipid terms",
      99000212,
      METABOLIC_CONDITIONS,
      METABOLISM
    ),
  },
  {
    reported: "Type 2 diabetes mellitus",
    term: term(
      "Type 2 diabetes mellitus",
      99001103,
      "Fictional glucose terms",
      99000213,
      METABOLIC_CONDITIONS,
      METABOLISM
    ),
  },
  {
    reported: "Gastro-oesophageal reflux disease",
    term: term(
      "Gastrooesophageal reflux disease",
      99001104,
      "Fictional reflux terms",
      99000214,
      { hlgt: "Fictional gastrointestinal conditions", hlgtcd: 99000112 },
      { soc: "Gastrointestinal disorders", soccd: 99000002 }
    ),
  },
  {
    reported: "Appendicitis",
    term: term(
      "Appendicitis",
      99001105,
      "Fictional abdominal infection terms",
      99000215,
      INFECTIONS_GROUP,
      INFECTIONS
    ),
  },
  {
    reported: "Pneumonia",
    term: term(
      "Pneumonia",
      99001106,
      "Fictional respiratory infection terms",
      99000216,
      INFECTIONS_GROUP,
      INFECTIONS
    ),
  },
];

const BY_PT = new Map(AE_DICTIONARY.map((entry) => [entry.pt, entry]));
const BY_REPORTED_CONDITION = new Map(
  HISTORY_DICTIONARY.map((entry) => [entry.reported, entry.term])
);

/** The dictionary entry for a preferred term, or undefined when it has none. */
export function codeAeTerm(pt: unknown): AeDictionaryTerm | undefined {
  return typeof pt === "string" ? BY_PT.get(pt) : undefined;
}

/** The coding of a reported medical history condition, when it has one. */
export function codeHistoryTerm(reported: unknown): AeDictionaryTerm | undefined {
  return typeof reported === "string"
    ? BY_REPORTED_CONDITION.get(reported)
    : undefined;
}
