/**
 * Object identifiers shared by the Dataset-JSON files and, later, the
 * Define-XML documents (#2591). Every OID the package writes is built here,
 * so the two can never disagree about what a dataset or variable is called.
 */
import type { DataLayer } from "../../types";

/** The `ItemGroupDef` OID of a dataset, for example `IG.DM`. */
export function itemGroupOid(datasetName: string): string {
  return `IG.${datasetName}`;
}

/** The `ItemDef` OID of one variable, for example `IT.DM.USUBJID`. */
export function itemOid(datasetName: string, variableName: string): string {
  return `IT.${datasetName}.${variableName}`;
}

/** The ODM study OID, for example `ST.DEMO-301`. */
export function studyOid(studyId: string): string {
  return `ST.${studyId}`;
}

/**
 * The ODM `MetaDataVersion` OID of one layer's Define-XML document, for
 * example `MDV.DEMO-301.SDTM`. SDTM and ADaM are described by separate
 * documents, so each layer has its own.
 */
export function metaDataVersionOid(
  studyId: string,
  layer: Exclude<DataLayer, "collected">
): string {
  return `MDV.${studyId}.${layer === "sdtm" ? "SDTM" : "ADaM"}`;
}
