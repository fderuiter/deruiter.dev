/**
 * Which SDTM variables are controlled by which codelist of the local
 * terminology subset. SDTM variable names carry their domain prefix, so one
 * name-keyed table serves every domain, trial design included.
 */
import type { CodelistId } from "../conformance/terminology";

export const SDTM_CODELISTS: Readonly<Record<string, CodelistId>> =
  Object.freeze({
    DOMAIN: "DOMAIN",
    RDOMAIN: "DOMAIN",
    EPOCH: "EPOCH",
    ARMCD: "ARMCD",
    ACTARMCD: "ARMCD",
    ARMNRS: "ARMNULRS",
    AGEU: "AGEU",
    SEX: "SEX",
    IECAT: "IECAT",
    EXDOSU: "UNIT",
    AESER: "NY",
    AEREL: "AEREL",
    AEACN: "ACN",
    VSTESTCD: "VSTESTCD",
    VSORRESU: "VSRESU",
    VSSTRESU: "VSRESU",
    VSLOBXFL: "NY",
    LBTESTCD: "LBTESTCD",
    LBORRESU: "UNIT",
    LBSTRESU: "UNIT",
    LBNRIND: "NRIND",
    LBLOBXFL: "NY",
    DSCAT: "DSCAT",
  });

/** The codelist property of an SDTM variable, empty when it has none. */
export function sdtmCodelist(name: string): { readonly codelist?: string } {
  const codelist = SDTM_CODELISTS[name];
  return codelist ? { codelist } : {};
}
