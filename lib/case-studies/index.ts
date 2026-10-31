/**
 * Case Studies Public Barrel & Fallback Registry
 *
 * Governed by ADR 0012, ADR 0016, and issue #3488.
 */

export * from "./types";
export { compileCaseStudy } from "./compiler";

// Re-exported CLI sandbox command and playback definitions
export {
  IMEDNET_COMMANDS_OBJ,
  IMEDNET_PLAYBACK_OBJ,
} from "./studies/imednet-python-sdk";
export {
  DUCKDEPLOY_COMMANDS_OBJ,
  DUCKDEPLOY_PLAYBACK_OBJ,
} from "./studies/duckdeploy";
export {
  CARDIAC_RISK_COMMANDS_OBJ,
  CARDIAC_RISK_PLAYBACK_OBJ,
} from "./studies/cardiac-risk-modeling";
export {
  FOUR_GLORY_COMMANDS_OBJ,
  FOUR_GLORY_PLAYBACK_OBJ,
} from "./studies/4glory";
export {
  CRF_XL_COMMANDS_OBJ,
  CRF_XL_PLAYBACK_OBJ,
} from "./studies/crf-xl";
export {
  PROMPTOPS_COMMANDS_OBJ,
  PROMPTOPS_PLAYBACK_OBJ,
} from "./studies/promptops";

// Individual case study imports in canonical order
import { caseStudy as clinicalDataMapper } from "./studies/clinical-data-mapper";
import { caseStudy as cadenceClinical } from "./studies/cadence-clinical";
import { caseStudy as imednetPythonSdk } from "./studies/imednet-python-sdk";
import { caseStudy as weddingWebsite } from "./studies/wedding-website";
import { caseStudy as schemaflow } from "./studies/schemaflow";
import { caseStudy as honoKiln } from "./studies/hono-kiln";
import { caseStudy as inbodyQrDecoder } from "./studies/inbody-qr-decoder";
import { caseStudy as polyglotTsp } from "./studies/polyglot-tsp";
import { caseStudy as oxidizemath } from "./studies/oxidizemath";
import { caseStudy as ualbf } from "./studies/ualbf";
import { caseStudy as sortify } from "./studies/sortify";
import { caseStudy as laserLoon } from "./studies/laser-loon";
import { caseStudy as sonosNetworkController } from "./studies/sonos-network-controller";
import { caseStudy as clintrials } from "./studies/clintrials";
import { caseStudy as equiposeRandomization } from "./studies/equipose-randomization";
import { caseStudy as lambdaWave } from "./studies/lambda-wave";
import { caseStudy as duckdeploy } from "./studies/duckdeploy";
import { caseStudy as cardiacRiskModeling } from "./studies/cardiac-risk-modeling";
import { caseStudy as fourGlory } from "./studies/4glory";
import { caseStudy as crfXl } from "./studies/crf-xl";
import { caseStudy as promptops } from "./studies/promptops";
import { caseStudy as designingForMyBrother } from "./studies/designing-for-my-brother";
import { caseStudy as studyDataPipeline } from "./studies/study-data-pipeline";
import type { CaseStudyData } from "./types";

/**
 * Static fallback case studies array in canonical order (1 to 23).
 */
export const FALLBACK_CASE_STUDIES: CaseStudyData[] = [
  clinicalDataMapper,
  cadenceClinical,
  imednetPythonSdk,
  weddingWebsite,
  schemaflow,
  honoKiln,
  inbodyQrDecoder,
  polyglotTsp,
  oxidizemath,
  ualbf,
  sortify,
  laserLoon,
  sonosNetworkController,
  clintrials,
  equiposeRandomization,
  lambdaWave,
  duckdeploy,
  cardiacRiskModeling,
  fourGlory,
  crfXl,
  promptops,
  designingForMyBrother,
  studyDataPipeline,
];
