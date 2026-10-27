/**
 * Clinical standards shared by CRF Studio and the study-data pipeline
 * (#2927 item 9): the one standards profile every export cites, the USDM v4
 * study definition types, schema and schedule, and the CDISC controlled
 * terminology both tools use, and the one envelope every hand-off between
 * the clinical tools travels in (#3083). `lib/crf` and `lib/study-data` each depend on
 * this module and no longer import each other.
 *
 * The terminology stays as two subsets because they serve different outputs:
 * the codelists CRF Studio offers for collection, and the codelists the
 * pipeline's SDTM, ADaM and Define-XML use. Where both carry the same CDISC
 * codelist, `__tests__/clinical-standards-terminology.test.ts` holds them to
 * the same submission values and NCI codes.
 */
export * from "./profile";
export * from "./codelists";
export * from "./terminology";
export * from "./usdm-v4-types";
export * from "./usdm-v4-schedule";
export * from "./usdm-v4-schema";
export * from "./bom";
export * from "./usdm-handoff";
