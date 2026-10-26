/**
 * The clinical data journey (#2689): the order in which the site's clinical
 * work tells one story, from collecting a study's data to governing a
 * portfolio of studies, and what kind of evidence each step rests on. Pages
 * render their place in the journey from this map, so a step that is not
 * built yet stays a planned item with its issue and never becomes a link.
 */

/** What a journey step's content is drawn from. */
export type JourneyEvidence =
  "synthetic" | "fictional-vendors" | "own-project" | "verified-experience";

/** Visible wording for each kind of evidence. */
export const JOURNEY_EVIDENCE_LABELS: Readonly<
  Record<JourneyEvidence, string>
> = {
  synthetic: "Synthetic data",
  "fictional-vendors": "Fictional vendors",
  "own-project": "Fred's own project",
  "verified-experience": "Fred's verified experience",
};

/** Identifier of a step on the main path. */
export type JourneyStepId =
  "collect" | "consequences" | "tabulate" | "govern" | "lessons";

/** One step on the main path, each a page a visitor can open now. */
export interface ClinicalJourneyStep {
  readonly id: JourneyStepId;
  /** What the step does in the story, as a short verb phrase. */
  readonly stage: string;
  readonly title: string;
  readonly href: string;
  /** Why a visitor would open this step. */
  readonly purpose: string;
  readonly evidence: readonly JourneyEvidence[];
}

/** Work that belongs in the journey but is not built yet. */
export interface PlannedJourneyItem {
  readonly title: string;
  /** The step it will join, or follow. */
  readonly step: JourneyStepId;
  /** The GitHub issue that defines it. */
  readonly issue: number;
  readonly evidence: readonly JourneyEvidence[];
}

/** A case study about Fred's own code that relates to one step. */
export interface RelatedCaseStudy {
  readonly slug: string;
  readonly title: string;
  readonly step: JourneyStepId;
  /** What the project has in common with the step. */
  readonly relation: string;
}

/**
 * An arcade game that plays with a step's subject. It is a game, so it is
 * never shown as a demo or as evidence of anything.
 */
export interface RelatedGame {
  readonly title: string;
  /** The game's arcade route, as `ARCADE_REGISTRY` lists it. */
  readonly href: string;
  readonly step: JourneyStepId;
  /** What the game has in common with the step. */
  readonly relation: string;
}

/** The main path, in order. */
export const CLINICAL_JOURNEY: readonly ClinicalJourneyStep[] = [
  {
    id: "collect",
    stage: "Collect",
    title: "CRF Studio",
    href: "/crf",
    purpose:
      "Design the case report forms a protocol needs and enter data the way a site would.",
    evidence: ["synthetic"],
  },
  {
    id: "consequences",
    stage: "Feel the consequences",
    title: "Protocol Drift",
    href: "/protocol-drift",
    purpose:
      "Play a systems simulation of the friction between a protocol's specification and the messy data sites actually collect.",
    evidence: ["synthetic"],
  },
  {
    id: "tabulate",
    stage: "Tabulate and analyse",
    title: "Study Data Pipeline",
    href: "/study-data",
    purpose:
      "Take DEMO-301, one fictional study, from its USDM definition through SDTM and ADaM to the tables of a study report, with every number traceable.",
    evidence: ["synthetic"],
  },
  {
    id: "govern",
    stage: "Govern the portfolio",
    title: "Clinical Data Platform",
    href: "/platform",
    purpose:
      "See DEMO-301 as one of eight fictional studies in a sponsor's portfolio, with contracts, metrics and quality governed across them.",
    evidence: ["synthetic", "fictional-vendors"],
  },
  {
    id: "lessons",
    stage: "Read the decisions",
    title: "Study Data Pipeline case study",
    href: "/case-studies/study-data-pipeline",
    purpose:
      "The design decisions, practices and limits behind the pipeline, in one write-up.",
    evidence: ["synthetic"],
  },
];

/** Planned additions, shown with their issue and never as live links. */
export const PLANNED_JOURNEY_ITEMS: readonly PlannedJourneyItem[] = [
  {
    title: "Modernizing a clinical data platform: a case study",
    step: "lessons",
    issue: 2647,
    evidence: ["verified-experience"],
  },
];

/**
 * Case studies about Fred's own open-source code that do, outside the demo,
 * what a step demonstrates. Each describes a real project, not synthetic
 * data, and makes no claim about an employer.
 */
export const RELATED_CASE_STUDIES: readonly RelatedCaseStudy[] = [
  {
    slug: "crf-xl",
    title: "CRF.xl",
    step: "collect",
    relation: "Turns protocol spreadsheets into CDASH forms and ODM-XML.",
  },
  {
    slug: "imednet-python-sdk",
    title: "iMednet Python SDK",
    step: "collect",
    relation: "Retrieves study metadata and records from an EDC's API.",
  },
  {
    slug: "cadence-clinical",
    title: "Cadence Clinical",
    step: "consequences",
    relation: "Keeps study records in step with a protocol as it changes.",
  },
  {
    slug: "clinical-data-mapper",
    title: "Clinical Data Mapper",
    step: "tabulate",
    relation: "Maps EDC records described by ODM metadata into SDTM domains.",
  },
  {
    slug: "equipose-randomization",
    title: "Equipose",
    step: "tabulate",
    relation:
      "Builds the reproducible randomization schedules that assign subjects to arms.",
  },
];

/** Arcade games beside the journey, shown as games next to their step. */
export const RELATED_GAMES: readonly RelatedGame[] = [
  {
    title: "Clinical Trial Chaos",
    href: "/arcade/clinical-chaos",
    step: "consequences",
    relation:
      "Sort clinical data into SDTM domains against the clock while an auditor watches.",
  },
];

/** Visible label for a related game, so it never reads as a demo. */
export const RELATED_GAME_LABEL = "Arcade game";

/** The URL of the GitHub issue that tracks a planned item. */
export function journeyIssueUrl(issue: number): string {
  return `https://github.com/fderuiter/deruiter.dev/issues/${issue}`;
}

/**
 * The step a page belongs to: the step it is, or the step a related case
 * study illustrates.
 *
 * @param path - A site path such as `/study-data` or `/case-studies/crf-xl`.
 * @returns The step and whether the page is the step itself, or null when
 *   the page is not part of the journey.
 */
export function journeyPlacement(
  path: string
): { readonly step: ClinicalJourneyStep; readonly isStep: boolean } | null {
  const own = CLINICAL_JOURNEY.find((step) => step.href === path);
  if (own) return { step: own, isStep: true };
  const related = RELATED_CASE_STUDIES.find(
    (study) => `/case-studies/${study.slug}` === path
  );
  if (!related) return null;
  const step = CLINICAL_JOURNEY.find((item) => item.id === related.step);
  return step ? { step, isStep: false } : null;
}
