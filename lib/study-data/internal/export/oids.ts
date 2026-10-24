/**
 * Object identifiers shared by the Dataset-JSON files and the Define-XML
 * documents. Every OID the package writes is built here, so the two can
 * never disagree about what a dataset or variable is called: a Dataset-JSON
 * `itemOID` is the OID of the define's `ItemDef` for that column.
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

/** The ODM `FileOID` of one layer's Define-XML document, for example `DEF.DEMO-301.SDTM`. */
export function defineFileOid(
  studyId: string,
  layer: Exclude<DataLayer, "collected">
): string {
  return `DEF.${studyId}.${layer === "sdtm" ? "SDTM" : "ADaM"}`;
}

/** The `CodeList` OID of a terminology codelist, for example `CL.NY`. */
export function codeListOid(codelistId: string): string {
  return `CL.${codelistId}`;
}

/** The `MethodDef` OID of a derivation method, for example `MT.STUDY_DAY`. */
export function methodOid(methodId: string): string {
  return `MT.${methodId}`;
}

/** The `def:ValueListDef` OID of one variable, for example `VL.VS.VSORRES`. */
export function valueListOid(
  datasetName: string,
  variableName: string
): string {
  return `VL.${datasetName}.${variableName}`;
}

/**
 * The value-level `ItemDef` OID of a variable for one parameter, for example
 * `IT.VS.VSORRES.SYSBP`.
 */
export function valueItemOid(
  datasetName: string,
  variableName: string,
  value: string
): string {
  return `${itemOid(datasetName, variableName)}.${value}`;
}

/**
 * The `def:WhereClauseDef` OID for one value of a variable, for example
 * `WC.VS.VSTESTCD.SYSBP`.
 */
export function whereClauseOid(
  datasetName: string,
  variableName: string,
  value: string
): string {
  return `WC.${datasetName}.${variableName}.${value}`;
}

/** The `def:Standard` OID, for example `STD.SDTMIG.3.4` or `STD.CT.SDTM.2026-09-25`. */
export function standardOid(name: string, version: string): string {
  return `STD.${name}.${version}`;
}

/** The `def:CommentDef` OID, for example `COM.NOTICE`. */
export function commentOid(commentId: string): string {
  return `COM.${commentId}`;
}

/** The `def:leaf` ID of a dataset file, for example `LF.DM`. */
export function leafId(datasetName: string): string {
  return `LF.${datasetName}`;
}
