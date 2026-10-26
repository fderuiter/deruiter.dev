/**
 * The study's fictional drug dictionary, in WHODrug's shape: a reported
 * medication name is coded to a standardized name and a therapeutic class.
 * The standardized names are generic (nonproprietary) drug names and the
 * class names are plain descriptions; the class codes are synthetic and
 * start with Z, a letter the ATC classification does not use, so none can
 * be mistaken for an ATC or WHODrug code. WHODrug is licensed, and the
 * package ships none of its content.
 */
export interface CmDictionaryEntry {
  /** The name as the site reports it, written to CMTRT. */
  readonly reported: string;
  /** Standardized medication name, written to CMDECOD. */
  readonly decod: string;
  /** Therapeutic class, written to CMCLAS. */
  readonly cls: string;
  /** Synthetic class code, written to CMCLASCD. */
  readonly clscd: string;
}

/** Every medication the generator can report, in the order it uses them. */
export const CM_DICTIONARY: readonly CmDictionaryEntry[] = [
  {
    reported: "Ramipril",
    decod: "RAMIPRIL",
    cls: "Angiotensin-converting enzyme inhibitors",
    clscd: "Z01A",
  },
  {
    reported: "Atorvastatin",
    decod: "ATORVASTATIN",
    cls: "Lipid-lowering agents",
    clscd: "Z02A",
  },
  {
    reported: "Metformin",
    decod: "METFORMIN",
    cls: "Blood glucose-lowering agents",
    clscd: "Z03A",
  },
  {
    reported: "Omeprazole",
    decod: "OMEPRAZOLE",
    cls: "Acid-reducing agents",
    clscd: "Z04A",
  },
  {
    reported: "Acetylsalicylic acid",
    decod: "ACETYLSALICYLIC ACID",
    cls: "Antiplatelet agents",
    clscd: "Z05A",
  },
  {
    reported: "Paracetamol",
    decod: "PARACETAMOL",
    cls: "Analgesics",
    clscd: "Z06A",
  },
  {
    reported: "Ondansetron",
    decod: "ONDANSETRON",
    cls: "Antiemetics",
    clscd: "Z07A",
  },
  {
    reported: "Amlodipine",
    decod: "AMLODIPINE",
    cls: "Calcium channel blockers",
    clscd: "Z01B",
  },
];

const BY_REPORTED = new Map(
  CM_DICTIONARY.map((entry) => [entry.reported, entry])
);

/** The dictionary entry for a reported name, or undefined when it has none. */
export function codeMedication(
  reported: unknown
): CmDictionaryEntry | undefined {
  return typeof reported === "string" ? BY_REPORTED.get(reported) : undefined;
}
