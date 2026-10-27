/**
 * NCI codes the game cites that are outside the site's local CDISC
 * Controlled Terminology subset.
 *
 * Every `ctCode` in Clinical Trial Chaos either resolves in that subset (CRF
 * Studio's standard codelists or the Study Data Pipeline's terminology) or is
 * listed here. These codes label the game's corrections. Like every NCI code
 * in the repository, each one is checked to exist in the pinned NCI EVS
 * release by `__tests__/cdisc-ct-release.test.ts`. A contract test holds the
 * two lists together.
 */
export const ILLUSTRATIVE_CT_CODES: Readonly<Record<string, string>> =
  Object.freeze({
    C25206: "Temperature observations (VS)",
    C25347: "Height observations (VS)",
    C25488: "Dose corruptions (EXDOSE)",
    C49677: "Heart rate observations (VS)",
  });
