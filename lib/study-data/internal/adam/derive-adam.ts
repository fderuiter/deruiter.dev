/** Analysis entrypoint for DEMO-301 SDTM, including independent QC fixtures. */
import type { Dataset, Finding, StudyDefinition } from "../../types";
import { deriveAdamCore } from "./core";
import { deriveAdae, deriveAdcm, deriveAdtte } from "./events";
import { deriveAdhce } from "./hce";

/** ADaM datasets and study-specific analysis findings from SDTM inputs. */
export interface AdamDerivation {
  readonly datasets: readonly Dataset[];
  readonly findings: readonly Finding[];
}

/** Derive ADSL, ADVS, ADLB, ADEG, ADAE, ADCM, ADTTE and ADHCE from a study's SDTM layer. */
export function deriveAdamDatasets(
  definition: StudyDefinition,
  sdtm: readonly Dataset[]
): AdamDerivation {
  const core = deriveAdamCore(definition, sdtm);
  const adsl = core[0];
  const adae = deriveAdae(sdtm, adsl);
  const adcm = deriveAdcm(sdtm, adsl);
  const adtte = deriveAdtte(definition, sdtm, adsl, adae.dataset, adcm.dataset);
  const advs = core.find((dataset) => dataset.name === "ADVS")!;
  const adhce = deriveAdhce(adsl, adtte.dataset, advs);
  return {
    datasets: [...core, adae.dataset, adcm.dataset, adtte.dataset, adhce],
    findings: [...adae.findings, ...adcm.findings, ...adtte.findings],
  };
}
