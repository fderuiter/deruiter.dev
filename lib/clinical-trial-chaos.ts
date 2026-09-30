export * from "./clinical-trial-chaos/types";
export * from "./clinical-trial-chaos/engine";
export * from "./clinical-trial-chaos/shift";
export * from "./clinical-trial-chaos/arcade-engine";
export * from "./clinical-trial-chaos/scenarios";
export * from "./clinical-trial-chaos/offices";
export * from "./clinical-trial-chaos/sponsor";
export * from "./clinical-trial-chaos/outfits";
export * from "./clinical-trial-chaos/sound-effects";

import { SEEDED_SCENARIOS } from "./clinical-trial-chaos/scenarios";
import { CDISCDomain } from "./clinical-trial-chaos/types";

export interface ClinicalScenario {
  id: string;
  subjectLabel: string;
  observations: readonly {
    field: string;
    value: string;
    correction?: string;
    destination: CDISCDomain;
  }[];
}

/** Legacy export for backwards compatibility with earlier scaffold consumers */
export const clinicalChaosScenarios: readonly ClinicalScenario[] =
  SEEDED_SCENARIOS.map((subj) => ({
    id: subj.id,
    subjectLabel: subj.subjectLabel,
    observations: subj.observations.map((obs) => ({
      field: obs.field,
      value: obs.rawValue,
      correction: obs.correctedValue,
      destination: obs.destination,
    })),
  }));
