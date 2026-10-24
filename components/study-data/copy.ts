/**
 * Copy for the /study-data stage rail. Every sentence describes what the
 * pipeline does and nothing more: it makes no compliance or validation
 * claim (#2705), which `__tests__/study-data-page.test.tsx` checks with
 * `findClinicalClaims`.
 */

/** A stage of the rail, in pipeline order. */
export type RailStageId =
  "usdm" | "collected" | "sdtm" | "conformance" | "adam" | "define" | "tlf";

/** The rail's stages with the practice each one demonstrates. */
export const RAIL_STAGES: readonly {
  readonly id: RailStageId;
  readonly label: string;
  readonly practice: string;
}[] = [
  {
    id: "usdm",
    label: "USDM",
    practice:
      "The protocol is defined once, as data. Its visits, windows and schedule of activities drive every later stage.",
  },
  {
    id: "collected",
    label: "Collected",
    practice:
      "Seeded, keyed draws: the same seed and subject count give the same records, and adding subjects leaves existing ones unchanged.",
  },
  {
    id: "sdtm",
    label: "SDTM",
    practice:
      "Tabulation keeps collected values apart from derivations, and each record keeps the ids of its source records outside its submission columns.",
  },
  {
    id: "conformance",
    label: "Conformance",
    practice:
      "Each finding names the published rule it models and cites its source. A demonstration subset, not a validator of record.",
  },
  {
    id: "adam",
    label: "ADaM",
    practice:
      "Analysis rows point back to SDTM through SRCDOM, SRCVAR and SRCSEQ, and analysis values never flow back into SDTM.",
  },
  {
    id: "define",
    label: "Define-XML",
    practice:
      "Generated from the same variable metadata as the datasets, so the metadata and the data cannot drift apart.",
  },
  {
    id: "tlf",
    label: "TLFs",
    practice:
      "Every displayed number is an analysis result that names the ADaM rows it was computed from.",
  },
];
