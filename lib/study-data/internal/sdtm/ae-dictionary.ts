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

const BY_PT = new Map(AE_DICTIONARY.map((entry) => [entry.pt, entry]));

/** The dictionary entry for a preferred term, or undefined when it has none. */
export function codeAeTerm(pt: unknown): AeDictionaryTerm | undefined {
  return typeof pt === "string" ? BY_PT.get(pt) : undefined;
}
