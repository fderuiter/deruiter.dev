/**
 * NCI codes the game cites that are outside the site's local CDISC
 * Controlled Terminology subset.
 *
 * Every `ctCode` in Clinical Trial Chaos either resolves in that subset (CRF
 * Studio's standard codelists or the Study Data Pipeline's terminology) or is
 * listed here. These codes are illustrative: they label the game's
 * corrections and have not been checked against the NCI EVS package the
 * subset is aligned to. A contract test holds the two lists together.
 */
export const ILLUSTRATIVE_CT_CODES: Readonly<Record<string, string>> =
  Object.freeze({
    C25206: "Temperature observations (VS)",
    C25347: "Height observations (VS)",
    C25488: "Dose corruptions (EXDOSE)",
    C49677: "Heart rate observations (VS)",
  });
