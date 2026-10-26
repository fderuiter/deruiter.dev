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
    RACE: "RACEC",
    IECAT: "IECAT",
    IEORRES: "NY",
    IESTRESC: "NY",
    EXDOSU: "UNIT",
    EXDOSFRM: "FRM",
    CMDOSU: "UNIT",
    CMDOSFRQ: "FREQ",
    CMROUTE: "ROUTE",
    CMENRTPT: "STENRF",
    MHENRTPT: "STENRF",
    AESER: "NY",
    AESCONG: "NY",
    AESDISAB: "NY",
    AESDTH: "NY",
    AESHOSP: "NY",
    AESLIFE: "NY",
    AESMIE: "NY",
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
    EGTESTCD: "EGTESTCD",
    EGORRESU: "UNIT",
    EGSTRESU: "UNIT",
    EGLOBXFL: "NY",
    DSCAT: "DSCAT",
    DTHFL: "NY",
    SVPRESP: "NY",
    SVOCCUR: "NY",
  });

/** The codelist property of an SDTM variable, empty when it has none. */
export function sdtmCodelist(name: string): { readonly codelist?: string } {
  const codelist = SDTM_CODELISTS[name];
  return codelist ? { codelist } : {};
}
