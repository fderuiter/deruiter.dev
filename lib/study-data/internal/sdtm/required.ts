/**
 * The variables SDTMIG 3.4 marks Core "Req" in each domain the pipeline
 * writes. A required variable is never null, and Define-XML writes it with
 * Mandatory="Yes" whatever its role (#2868).
 */
const REQUIRED: Readonly<Record<string, ReadonlySet<string>>> = {
  TA: new Set([
    "STUDYID",
    "DOMAIN",
    "ARMCD",
    "ARM",
    "TAETORD",
    "ETCD",
    "EPOCH",
  ]),
  TE: new Set(["STUDYID", "DOMAIN", "ETCD", "ELEMENT", "TESTRL"]),
  TV: new Set(["STUDYID", "DOMAIN", "VISITNUM", "VISIT", "TVSTRL"]),
  TI: new Set(["STUDYID", "DOMAIN", "IETESTCD", "IETEST", "IECAT"]),
  TS: new Set(["STUDYID", "DOMAIN", "TSSEQ", "TSPARMCD", "TSPARM"]),
  DM: new Set([
    "STUDYID",
    "DOMAIN",
    "USUBJID",
    "SUBJID",
    "SITEID",
    "SEX",
    "COUNTRY",
  ]),
  SV: new Set(["STUDYID", "DOMAIN", "USUBJID", "VISITNUM"]),
  EX: new Set(["STUDYID", "DOMAIN", "USUBJID", "EXSEQ", "EXTRT"]),
  AE: new Set(["STUDYID", "DOMAIN", "USUBJID", "AESEQ", "AETERM", "AEDECOD"]),
  VS: new Set(["STUDYID", "DOMAIN", "USUBJID", "VSSEQ", "VSTESTCD", "VSTEST"]),
  LB: new Set(["STUDYID", "DOMAIN", "USUBJID", "LBSEQ", "LBTESTCD", "LBTEST"]),
  DS: new Set(["STUDYID", "DOMAIN", "USUBJID", "DSSEQ", "DSTERM", "DSDECOD"]),
};

/** `{ required: true }` when the IG requires the variable in the domain. */
export function sdtmRequired(
  domain: string,
  name: string
): { readonly required?: true } {
  return REQUIRED[domain]?.has(name) ? { required: true } : {};
}
