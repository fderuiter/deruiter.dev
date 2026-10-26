/**
 * Checks that a Define-XML document model and the datasets it describes
 * agree, and that the document's own references resolve.
 *
 * `buildDefine` reads the same specs as the datasets, so a gap here means a
 * builder or a dataset changed under the other. Each kind of gap has its
 * own rule id so a package's findings say which reference broke:
 *
 * - every dataset of the layer has an `ItemGroupDef`, and every group a dataset;
 * - every dataset variable has an `ItemRef` whose `ItemDef` exists, and every
 *   `ItemDef` is referenced by a dataset or a value list;
 * - every Derived item's references name a `MethodDef`, every named method
 *   exists, and every `MethodDef` is referenced;
 * - every referenced `CodeList` exists and every `CodeList` is referenced;
 * - every value list and where clause referenced exists and is referenced.
 */
import { standardCitation } from "../../standards";
import type { Dataset, Finding } from "../../types";
import type { DefineDocument, DefineItemRef } from "./model";

const DEFINE_PARITY_CITATION = `${standardCitation("Define-XML")} metadata references: https://www.cdisc.org/standards/data-exchange/define-xml`;

/** Rule ids {@link checkDefineParity} reports, one per kind of gap. */
export const DEFINE_PARITY_RULES = Object.freeze({
  groupMissing: "DEFINE-PARITY-GROUP-MISSING",
  groupUnused: "DEFINE-PARITY-GROUP-UNUSED",
  itemMissing: "DEFINE-PARITY-ITEM-MISSING",
  itemUnused: "DEFINE-PARITY-ITEM-UNUSED",
  methodMissing: "DEFINE-PARITY-METHOD-MISSING",
  methodUnused: "DEFINE-PARITY-METHOD-UNUSED",
  codeListMissing: "DEFINE-PARITY-CODELIST-MISSING",
  codeListUnused: "DEFINE-PARITY-CODELIST-UNUSED",
  valueListMissing: "DEFINE-PARITY-VALUELIST-MISSING",
  valueListUnused: "DEFINE-PARITY-VALUELIST-UNUSED",
  whereClauseMissing: "DEFINE-PARITY-WHERECLAUSE-MISSING",
  whereClauseUnused: "DEFINE-PARITY-WHERECLAUSE-UNUSED",
} as const);

/**
 * Compares a Define-XML document model with the datasets of its layer.
 *
 * @param define - The document, as `buildDefine` returns it.
 * @param datasets - The run's datasets; only those of the document's layer
 *   are compared.
 * @returns One error finding per gap, in document order; none when the
 *   document and the data agree.
 */
export function checkDefineParity(
  define: DefineDocument,
  datasets: readonly Dataset[]
): Finding[] {
  const findings: Finding[] = [];
  const report = (
    ruleId: string,
    message: string,
    where: { dataset?: string; variable?: string } = {}
  ) =>
    findings.push({
      ruleId,
      severity: "error",
      layer: define.layer,
      ...(where.dataset === undefined ? {} : { dataset: where.dataset }),
      ...(where.variable === undefined ? {} : { variable: where.variable }),
      message,
      citation: DEFINE_PARITY_CITATION,
    });

  const items = new Map(define.items.map((item) => [item.oid, item]));
  const methods = new Set(define.methods.map((method) => method.oid));
  const codeLists = new Set(define.codeLists.map((list) => list.oid));
  const valueLists = new Map(define.valueLists.map((list) => [list.oid, list]));
  const whereClauses = new Set(define.whereClauses.map((clause) => clause.oid));
  const refs: DefineItemRef[] = [
    ...define.itemGroups.flatMap((group) => group.itemRefs),
    ...define.valueLists.flatMap((list) => list.itemRefs),
  ];

  const layerDatasets = datasets.filter(
    (dataset) => dataset.layer === define.layer
  );
  const groups = new Map(define.itemGroups.map((group) => [group.name, group]));
  for (const dataset of layerDatasets) {
    const group = groups.get(dataset.name);
    if (!group) {
      report(
        DEFINE_PARITY_RULES.groupMissing,
        `${dataset.name} has no ItemGroupDef.`,
        { dataset: dataset.name }
      );
      continue;
    }
    const names = new Set([
      ...dataset.variables.map((variable) => variable.name),
      ...Object.keys(dataset.columns),
    ]);
    for (const name of names) {
      const ref = group.itemRefs.find((candidate) => candidate.name === name);
      if (!ref || !items.has(ref.itemOid)) {
        report(
          DEFINE_PARITY_RULES.itemMissing,
          `${dataset.name}.${name} has no ${ref ? `ItemDef ${ref.itemOid}` : "ItemRef"}.`,
          { dataset: dataset.name, variable: name }
        );
      }
    }
  }
  for (const group of define.itemGroups) {
    if (!layerDatasets.some((dataset) => dataset.name === group.name)) {
      report(
        DEFINE_PARITY_RULES.groupUnused,
        `ItemGroupDef ${group.oid} describes no ${define.layer} dataset.`,
        { dataset: group.name }
      );
    }
  }

  const referencedItems = new Set(refs.map((ref) => ref.itemOid));
  for (const item of define.items) {
    const where = { dataset: item.dataset, variable: item.name };
    if (!referencedItems.has(item.oid)) {
      report(
        DEFINE_PARITY_RULES.itemUnused,
        `ItemDef ${item.oid} is not referenced by any dataset or value list.`,
        where
      );
    }
    if (item.codeListOid && !codeLists.has(item.codeListOid)) {
      report(
        DEFINE_PARITY_RULES.codeListMissing,
        `ItemDef ${item.oid} references CodeList ${item.codeListOid}, which is not defined.`,
        where
      );
    }
    if (item.valueListOid && !valueLists.has(item.valueListOid)) {
      report(
        DEFINE_PARITY_RULES.valueListMissing,
        `ItemDef ${item.oid} references ValueListDef ${item.valueListOid}, which is not defined.`,
        where
      );
    }
  }

  for (const ref of refs) {
    const item = items.get(ref.itemOid);
    const where = { dataset: item?.dataset, variable: ref.name };
    if (item?.origin.type === "Derived" && !ref.methodOid) {
      report(
        DEFINE_PARITY_RULES.methodMissing,
        `${item.dataset}.${ref.name} is Derived but its ItemRef names no MethodDef.`,
        where
      );
    }
    if (ref.methodOid && !methods.has(ref.methodOid)) {
      report(
        DEFINE_PARITY_RULES.methodMissing,
        `The ItemRef to ${ref.itemOid} references MethodDef ${ref.methodOid}, which is not defined.`,
        where
      );
    }
    if (ref.whereClauseOid && !whereClauses.has(ref.whereClauseOid)) {
      report(
        DEFINE_PARITY_RULES.whereClauseMissing,
        `The ItemRef to ${ref.itemOid} references WhereClauseDef ${ref.whereClauseOid}, which is not defined.`,
        where
      );
    }
  }

  const usedMethods = new Set(refs.map((ref) => ref.methodOid));
  for (const method of define.methods) {
    if (!usedMethods.has(method.oid)) {
      report(
        DEFINE_PARITY_RULES.methodUnused,
        `MethodDef ${method.oid} is not referenced by any ItemRef.`
      );
    }
  }
  const usedCodeLists = new Set(define.items.map((item) => item.codeListOid));
  for (const list of define.codeLists) {
    if (!usedCodeLists.has(list.oid)) {
      report(
        DEFINE_PARITY_RULES.codeListUnused,
        `CodeList ${list.oid} is not referenced by any ItemDef.`
      );
    }
  }
  const usedValueLists = new Set(define.items.map((item) => item.valueListOid));
  for (const list of define.valueLists) {
    if (!usedValueLists.has(list.oid)) {
      report(
        DEFINE_PARITY_RULES.valueListUnused,
        `ValueListDef ${list.oid} is not referenced by any ItemDef.`,
        { dataset: list.dataset, variable: list.variable }
      );
    }
  }
  const usedWhereClauses = new Set(refs.map((ref) => ref.whereClauseOid));
  for (const clause of define.whereClauses) {
    if (!usedWhereClauses.has(clause.oid)) {
      report(
        DEFINE_PARITY_RULES.whereClauseUnused,
        `WhereClauseDef ${clause.oid} is not referenced by any ItemRef.`,
        { dataset: clause.dataset, variable: clause.variable }
      );
    }
  }
  return findings;
}
