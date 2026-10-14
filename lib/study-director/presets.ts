import type { SiteState, StudyLength, StudySetup, TeamMember } from "./types";

/** The vertical-slice study: a first-time biotech's randomized PK study. */
export const STUDY_24_081: StudySetup = {
  id: "24-081",
  title: "Study 24-081",
  design: "Randomized PK Study",
  sponsor: { name: "Arcadia Therapeutics", archetype: "firstTimeBiotech" },
  clinicalPhase: "I",
  subjects: 48,
  durationDays: 77,
  budget: 184_000,
  protocolMaturity: "questionable",
  regulatoryRisk: "moderate",
  complexity: 4,
};

export const STUDY_24_081_SITES: SiteState[] = [
  {
    id: "site-01",
    name: "Site 01",
    coordinator: "steady",
    burden: 40,
    enrolled: 0,
    openQueries: 0,
    deviations: 0,
    unsignedSource: 0,
    eligibilityConcerns: 0,
    trainingCurrent: true,
    lastAuditedDay: null,
  },
  {
    id: "site-02",
    name: "Site 02",
    coordinator: "terrified",
    burden: 55,
    enrolled: 0,
    openQueries: 0,
    deviations: 0,
    unsignedSource: 0,
    eligibilityConcerns: 0,
    trainingCurrent: true,
    lastAuditedDay: null,
  },
  {
    id: "site-03",
    name: "Site 03",
    coordinator: "invisible",
    burden: 65,
    enrolled: 0,
    openQueries: 0,
    deviations: 0,
    unsignedSource: 0,
    eligibilityConcerns: 0,
    trainingCurrent: false,
    lastAuditedDay: null,
  },
  {
    id: "site-04",
    name: "Site 04",
    coordinator: "overconfident",
    burden: 45,
    enrolled: 0,
    openQueries: 0,
    deviations: 0,
    unsignedSource: 0,
    eligibilityConcerns: 0,
    trainingCurrent: true,
    lastAuditedDay: null,
  },
  {
    id: "site-05",
    name: "Site 05",
    coordinator: "newcomer",
    burden: 50,
    enrolled: 0,
    openQueries: 0,
    deviations: 0,
    unsignedSource: 0,
    eligibilityConcerns: 0,
    trainingCurrent: true,
    lastAuditedDay: null,
  },
];

export const STUDY_24_081_TEAM: TeamMember[] = [
  {
    id: "maya",
    name: "Maya",
    role: "dataManager",
    archetype: "overloadedStar",
    skill: 5,
    speed: 3,
    reliability: 5,
    workload: 60,
  },
  {
    id: "priya",
    name: "Priya",
    role: "biostatistician",
    archetype: "optimisticStatistician",
    skill: 4,
    speed: 3,
    reliability: 3,
    workload: 40,
  },
  {
    id: "dana",
    name: "Dana",
    role: "regulatory",
    archetype: "steadyProfessional",
    skill: 4,
    speed: 4,
    reliability: 4,
    workload: 50,
  },
  {
    id: "walt",
    name: "Walt",
    role: "monitor",
    archetype: "veteranMonitor",
    skill: 5,
    speed: 3,
    reliability: 4,
    workload: 45,
  },
  {
    id: "lee",
    name: "Lee",
    role: "medicalWriter",
    archetype: "steadyProfessional",
    skill: 3,
    speed: 3,
    reliability: 4,
    workload: 20,
  },
  {
    id: "omar",
    name: "Omar",
    role: "programmer",
    archetype: "steadyProfessional",
    skill: 3,
    speed: 4,
    reliability: 3,
    workload: 30,
  },
];

/**
 * The short study (#2092): the same sponsor and protocol run as a ~35-day
 * pilot with half the subjects at the first three sites, so a run fits in
 * one sitting. Its scripted events keep their order on a squeezed calendar
 * (`calendarScale`).
 */
export const STUDY_24_081_SHORT: StudySetup = {
  ...STUDY_24_081,
  design: "Randomized PK Study, pilot cohort",
  subjects: 24,
  durationDays: 35,
  budget: 92_000,
  length: "short",
};

/** The short study's sites: Sites 01 to 03, where most of the story happens. */
export const STUDY_24_081_SHORT_SITES: SiteState[] = STUDY_24_081_SITES.slice(
  0,
  3
);

/** Everything a new study needs, by length. Both run with the same team. */
export function studyPreset(length: StudyLength): {
  setup: StudySetup;
  sites: SiteState[];
  team: TeamMember[];
} {
  return length === "short"
    ? {
        setup: STUDY_24_081_SHORT,
        sites: STUDY_24_081_SHORT_SITES,
        team: STUDY_24_081_TEAM,
      }
    : {
        setup: STUDY_24_081,
        sites: STUDY_24_081_SITES,
        team: STUDY_24_081_TEAM,
      };
}
