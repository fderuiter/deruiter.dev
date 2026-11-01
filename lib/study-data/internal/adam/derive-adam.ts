/** Analysis entrypoint for a study's SDTM, including independent QC fixtures. */
import type { Dataset, Finding, StudyDefinition } from "../../types";
import { deriveAdamCore } from "./core";
import { deriveAdae, deriveAdcm, deriveAdtte } from "./events";
import { deriveAdhce } from "./hce";
import { hierarchyFor } from "./hierarchy";

/** ADaM datasets and study-specific analysis findings from SDTM inputs. */
export interface AdamDerivation {
  readonly datasets: readonly Dataset[];
  readonly findings: readonly Finding[];
}

/**
 * Derive ADSL, ADVS, ADLB, ADEG, ADQS (when QS was collected), ADAE, ADCM,
 * ADTTE and ADHCE from a study's SDTM layer. ADTTE and ADHCE follow the
 * study's hierarchical composite spec.
 */
export function deriveAdamDatasets(
  definition: StudyDefinition,
  sdtm: readonly Dataset[]
): AdamDerivation {
  const spec = hierarchyFor(definition);
  const core = deriveAdamCore(definition, sdtm);
  const adsl = core[0];
  const adae = deriveAdae(sdtm, adsl);
  const adcm = deriveAdcm(sdtm, adsl);
  const adtte = deriveAdtte(
    definition,
    sdtm,
    adsl,
    adae.dataset,
    adcm.dataset,
    spec
  );
  const adhce = deriveAdhce(adsl, adtte.dataset, core, spec);
  return {
    datasets: [...core, adae.dataset, adcm.dataset, adtte.dataset, adhce],
    findings: [...adae.findings, ...adcm.findings, ...adtte.findings],
  };
}
