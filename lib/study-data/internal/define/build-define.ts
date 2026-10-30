/**
 * Builds the Define-XML 2.1 document model of one layer of a pipeline run.
 *
 * Everything comes from what the run carries: dataset names, classes,
 * structures and keys; each variable's label, type, origin, method, source
 * and codelist; the derivation method specs; the local terminology subset;
 * and the values themselves, for lengths and value-level metadata. Because
 * the datasets and the define read the same specs, the define cannot
 * describe a variable the data does not have, or miss one it does.
 */
import { STANDARD_VERSIONS, SYNTHETIC_DATA_NOTICE } from "../../presets";
import {
  CLINICAL_STANDARDS_PROFILE,
  standardCitation,
} from "@/lib/clinical-standards";
import type {
  CellValue,
  Dataset,
  PipelineRun,
  VariableMeta,
} from "../../types";
import { ADAM_METHODS } from "../adam/specs";
import {
  CONTROLLED_TERMINOLOGY,
  DECODE_VARIABLES,
  terminologyCodelist,
  type TerminologyCodelist,
} from "@/lib/clinical-standards";
import {
  exportColumns,
  toSasNumber,
  utf8Length,
  type ExportColumn,
  type StorageKind,
} from "../export/columns";
import { EXPORT_SOURCE_SYSTEM } from "../export/dataset-json";
import {
  codeListOid,
  commentOid,
  defineFileOid,
  itemGroupOid,
  itemOid,
  leafId,
  metaDataVersionOid,
  methodOid,
  standardOid,
  studyOid,
  valueItemOid,
  valueListOid,
  whereClauseOid,
} from "../export/oids";
import { SDTM_METHODS } from "../sdtm/methods";
import type {
  DefineCodeList,
  DefineCodeListTerm,
  DefineComment,
  DefineDataType,
  DefineDocument,
  DefineItem,
  DefineItemGroup,
  DefineItemRef,
  DefineLayer,
  DefineMethod,
  DefineOptions,
  DefineOrigin,
  DefineStandard,
  DefineValueList,
  DefineWhereClause,
} from "./model";
import { VALUE_LEVEL } from "./value-level";

/**
 * The Define-XML version the documents declare (`def:DefineVersion`). It is
 * the version of the vendored schema the tests check the documents against.
 */
export const DEFINE_XML_VERSION = `${CLINICAL_STANDARDS_PROFILE["Define-XML"]}.0`;

const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const SDTM_CLASSES: Readonly<Record<string, string>> = {
  "Special Purpose": "SPECIAL PURPOSE",
  Interventions: "INTERVENTIONS",
  Events: "EVENTS",
  Findings: "FINDINGS",
  "Findings About": "FINDINGS ABOUT",
  Relationships: "RELATIONSHIP",
  "Trial Design": "TRIAL DESIGN",
  "Study Reference": "STUDY REFERENCE",
};

const ADAM_CLASSES: Readonly<Record<string, string>> = {
  ADSL: "SUBJECT LEVEL ANALYSIS DATASET",
  BDS: "BASIC DATA STRUCTURE",
  OCCDS: "OCCURRENCE DATA STRUCTURE",
  OTHER: "ADAM OTHER",
};

const ADAM_SUBCLASSES = new Set(["ADVERSE EVENT", "TIME-TO-EVENT"]);

const IMPUTATION_METHODS = new Set(["ADAE_IMPUTE", "ADCM_IMPUTE", "BDS_LOCF"]);

const DISPLAY_FORMATS: Readonly<Partial<Record<StorageKind, string>>> = {
  "sas-date": "DATE9.",
  "sas-datetime": "DATETIME20.",
  "sas-time": "TIME8.",
};

/** Variables that are mandatory in every dataset that has them. */
const ALWAYS_MANDATORY = new Set(["STUDYID", "DOMAIN", "RDOMAIN", "USUBJID"]);

const NO_ACRF_COMMENT =
  "No annotated CRF is generated for this study. A Collected origin names the field of the synthetic collection layer that holds the value.";

const CT_COMMENT = `Codelists come from a local, hand-curated subset of CDISC Controlled Terminology aligned to the NCI EVS package dated ${STANDARD_VERSIONS["NCI-EVS-CT"]}. Every codelist and term in the subset is checked against the NCI EVS SDTM and ADaM exports of that date.`;

interface Facets {
  readonly dataType: DefineDataType;
  readonly length?: number;
  readonly significantDigits?: number;
  readonly displayFormat?: string;
}

/** Integer and fraction digit counts of a finite number, sign excluded. */
function digits(value: number): { integer: number; fraction: number } {
  const [mantissa, exponentText] = Math.abs(value).toString().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const all = whole + fraction;
  const point = whole.length + (exponentText ? Number(exponentText) : 0);
  return {
    integer: Math.max(1, point),
    fraction: Math.max(0, all.length - point),
  };
}

function facets(
  variable: VariableMeta,
  storage: StorageKind,
  values: readonly CellValue[]
): Facets {
  if (storage === "text") {
    if (
      variable.type === "date" ||
      variable.type === "datetime" ||
      variable.type === "time"
    ) {
      return { dataType: variable.type };
    }
    let length = 1;
    for (const value of values) {
      if (typeof value === "string") {
        length = Math.max(length, utf8Length(value));
      }
    }
    return { dataType: "text", length };
  }
  let integer = 1;
  let fraction = 0;
  for (const value of values) {
    if (value === null) continue;
    const number =
      storage === "number"
        ? (value as number)
        : toSasNumber(storage, value as string);
    const parts = digits(number);
    integer = Math.max(integer, parts.integer);
    fraction = Math.max(fraction, parts.fraction);
  }
  if (storage !== "number") {
    return {
      dataType: "integer",
      length: integer,
      displayFormat: DISPLAY_FORMATS[storage],
    };
  }
  if (variable.type === "integer")
    return { dataType: "integer", length: integer };
  return {
    dataType: "float",
    length: integer + fraction,
    significantDigits: fraction,
  };
}

function origin(dataset: Dataset, variable: VariableMeta): DefineOrigin {
  const where = `${dataset.name}.${variable.name}`;
  switch (variable.origin) {
    case "Collected":
      if (!variable.source) {
        throw new RangeError(`${where} is Collected but names no source.`);
      }
      return {
        type: "Collected",
        source: "Investigator",
        description: `Collected as ${variable.source} in the synthetic collection layer.`,
      };
    case "Derived":
      if (!variable.method) {
        throw new RangeError(`${where} is Derived but names no method.`);
      }
      return { type: "Derived", source: "Sponsor" };
    case "Assigned":
      return { type: "Assigned", source: "Sponsor" };
    case "Protocol":
      return {
        type: "Protocol",
        description: "From the USDM study definition.",
      };
    case "Predecessor":
      if (!variable.source) {
        throw new RangeError(`${where} is Predecessor but names no source.`);
      }
      return { type: "Predecessor", description: variable.source };
    default:
      return { type: "Not Available" };
  }
}

function methodText(layer: DefineLayer, id: string): string {
  const methods: Readonly<Record<string, string>> =
    layer === "sdtm" ? SDTM_METHODS : ADAM_METHODS;
  const text = methods[id];
  if (!text) {
    throw new RangeError(
      `Method ${id} is not in the ${layer} derivation specs.`
    );
  }
  return text;
}

function className(dataset: Dataset, layer: DefineLayer): string {
  const name = (layer === "sdtm" ? SDTM_CLASSES : ADAM_CLASSES)[dataset.class];
  if (!name) {
    throw new RangeError(
      `${dataset.name} has class "${dataset.class}", which ${standardCitation("Define-XML")} does not list.`
    );
  }
  return name;
}

function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function stringValue(dataset: Dataset, variable: string, value: CellValue) {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new TypeError(
      `${dataset.name}.${variable} is coded but holds the number ${value}.`
    );
  }
  return value;
}

interface CodelistUse {
  readonly dataset: Dataset;
  readonly variable: string;
}

function resolveCodeList(
  codelist: TerminologyCodelist,
  uses: readonly CodelistUse[],
  standardFor: (set: "SDTM" | "ADaM") => string,
  onOutside?: DefineOptions["onValuesOutsideCodelist"]
): DefineCodeList {
  const values = new Set<string>();
  const decodes = new Map<string, string>();
  for (const { dataset, variable } of uses) {
    const column = dataset.columns[variable] ?? [];
    const decodeVariable = DECODE_VARIABLES[variable];
    const decodeColumn = decodeVariable
      ? dataset.columns[decodeVariable]
      : undefined;
    column.forEach((cell, row) => {
      const value = stringValue(dataset, variable, cell);
      if (value === null) return;
      values.add(value);
      if (!codelist.fromData || !decodeColumn) return;
      const decode = stringValue(dataset, decodeVariable!, decodeColumn[row]);
      if (decode === null) return;
      const known = decodes.get(value);
      if (known !== undefined && known !== decode) {
        throw new RangeError(
          `${codelist.id} value ${value} is decoded both as "${known}" and "${decode}".`
        );
      }
      decodes.set(value, decode);
    });
  }
  const planned = codelist.fromData
    ? codelist.terms.filter((term) => values.has(term.value))
    : codelist.terms;
  const plannedValues = new Set(codelist.terms.map((term) => term.value));
  const outside = [...values]
    .filter((value) => !plannedValues.has(value))
    .sort(compareCodePoints);
  const cdisc = codelist.publishingSet !== undefined;
  // A non-extensible codelist admits no other value, so the define describes
  // the planned codelist and the value stays in the data as collected, where
  // a conformance rule reports it (#3020). An extensible codelist lists it.
  const admitsOthers = codelist.extensible || codelist.fromData;
  if (outside.length > 0 && !admitsOthers) {
    onOutside?.({
      codelist: codelist.id,
      values: outside,
      variables: uses
        .filter(({ dataset, variable }) =>
          (dataset.columns[variable] ?? []).some(
            (cell) => typeof cell === "string" && outside.includes(cell)
          )
        )
        .map(({ dataset, variable }) => ({
          dataset: dataset.name,
          variable,
        })),
    });
  }
  const extra = admitsOthers ? outside : [];
  const terms: DefineCodeListTerm[] = [
    ...planned.map((term) => ({
      codedValue: term.value,
      decode: term.decode ?? decodes.get(term.value),
      nciCode: term.nciCode,
      extended: false,
    })),
    ...extra.map((value) => ({
      codedValue: value,
      decode: decodes.get(value),
      nciCode: undefined,
      extended: cdisc && codelist.extensible,
    })),
  ].map((term, index) => ({
    codedValue: term.codedValue,
    ...(term.decode === undefined ? {} : { decode: term.decode }),
    ...(term.nciCode === undefined ? {} : { nciCode: term.nciCode }),
    extended: term.extended,
    orderNumber: index + 1,
  }));
  const decodedCount = terms.filter((term) => term.decode !== undefined).length;
  if (decodedCount !== 0 && decodedCount !== terms.length) {
    throw new RangeError(
      `Codelist ${codelist.id} has decodes for some terms but not all.`
    );
  }
  return {
    oid: codeListOid(codelist.id),
    id: codelist.id,
    name: codelist.name,
    dataType: "text",
    ...(codelist.nciCode ? { nciCode: codelist.nciCode } : {}),
    ...(cdisc ? { extensible: codelist.extensible } : {}),
    ...(codelist.publishingSet
      ? { standardOid: standardFor(codelist.publishingSet) }
      : {}),
    decoded: terms.length > 0 && decodedCount === terms.length,
    terms,
  };
}

function isMandatory(dataset: Dataset, variable: VariableMeta): boolean {
  const mandatory =
    ALWAYS_MANDATORY.has(variable.name) ||
    dataset.keys.includes(variable.name) ||
    variable.role === "Topic" ||
    variable.required === true;
  if (mandatory && (dataset.columns[variable.name] ?? []).includes(null)) {
    throw new RangeError(
      `${dataset.name}.${variable.name} is a key, topic, identifier or required variable but has missing values.`
    );
  }
  return mandatory;
}

/**
 * Builds the Define-XML 2.1 document model for the SDTM or ADaM datasets of
 * a pipeline run.
 *
 * Every dataset of the layer becomes an ItemGroupDef and every variable an
 * ItemDef whose OID is the Dataset-JSON `itemOID`. Lengths are the longest
 * value in the data, as in the Dataset-JSON and XPT files. Codelists hold the
 * planned terms of the local terminology subset plus any value the data adds
 * to an extensible CDISC codelist, flagged as an extended value. A value
 * outside a non-extensible codelist is left out of it and reported through
 * `onValuesOutsideCodelist` (#3020). VS, LB, ADVS and ADLB get value-level
 * metadata per parameter.
 *
 * @param run - A pipeline run from `runPipeline`.
 * @param options - The layer and the creation timestamp.
 * @returns The document model, for `writeDefineXml` and `renderDefineHtml`.
 * @throws RangeError when `createdAt` is not an ISO 8601 timestamp, the
 *   layer has no datasets, a dataset has no structure or an unknown class, a
 *   Derived variable names no method, a Collected or Predecessor variable
 *   names no source, or a key variable has missing values.
 */
export function buildDefine(
  run: PipelineRun,
  options: DefineOptions
): DefineDocument {
  const { layer, createdAt } = options;
  if (!ISO_TIMESTAMP.test(createdAt)) {
    throw new RangeError(
      `createdAt must be an ISO 8601 timestamp with a zone, got "${createdAt}".`
    );
  }
  const studyId = run.manifest.studyId;
  const datasets = run.datasets.filter((dataset) => dataset.layer === layer);
  if (datasets.length === 0) {
    throw new RangeError(`The run has no ${layer} datasets to describe.`);
  }
  const names = new Set<string>();
  for (const dataset of datasets) {
    if (names.has(dataset.name)) {
      throw new RangeError(`Two ${layer} datasets are named ${dataset.name}.`);
    }
    names.add(dataset.name);
  }

  const layerName = layer === "sdtm" ? "SDTM" : "ADaM";
  const guide = layer === "sdtm" ? "SDTMIG" : "ADaMIG";
  const guideVersion = STANDARD_VERSIONS[guide];
  const ctVersion = STANDARD_VERSIONS["NCI-EVS-CT"];
  const guideOid = standardOid(guide, guideVersion);
  const ctOid = (set: "SDTM" | "ADaM") => standardOid(`CT.${set}`, ctVersion);
  const noticeOid = commentOid("NOTICE");
  const ctCommentOid = commentOid("CT");

  const items: DefineItem[] = [];
  const itemGroups: DefineItemGroup[] = [];
  const valueLists: DefineValueList[] = [];
  const whereClauses: DefineWhereClause[] = [];
  const methodIds: string[] = [];
  const codelistUses = new Map<string, CodelistUse[]>();
  const pendingValueLevel: {
    dataset: Dataset;
    columns: readonly ExportColumn[];
  }[] = [];

  for (const dataset of datasets) {
    if (!dataset.structure) {
      throw new RangeError(`${dataset.name} has no structure.`);
    }
    if (dataset.subClass && !ADAM_SUBCLASSES.has(dataset.subClass)) {
      throw new RangeError(
        `${dataset.name} has subclass "${dataset.subClass}", which ${standardCitation("Define-XML")} does not list.`
      );
    }
    const columns = exportColumns(dataset);
    const itemRefs: DefineItemRef[] = [];
    columns.forEach((column, index) => {
      const { variable } = column;
      const oid = itemOid(dataset.name, variable.name);
      if (variable.method && !methodIds.includes(variable.method)) {
        methodText(layer, variable.method);
        methodIds.push(variable.method);
      }
      if (variable.codelist) {
        terminologyCodelist(variable.codelist);
        codelistUses.set(variable.codelist, [
          ...(codelistUses.get(variable.codelist) ?? []),
          { dataset, variable: variable.name },
        ]);
      }
      const keyIndex = dataset.keys.indexOf(variable.name);
      itemRefs.push({
        itemOid: oid,
        name: variable.name,
        orderNumber: index + 1,
        mandatory: isMandatory(dataset, variable),
        ...(keyIndex >= 0 ? { keySequence: keyIndex + 1 } : {}),
        ...(variable.method ? { methodOid: methodOid(variable.method) } : {}),
        ...(layer === "sdtm" && variable.role ? { role: variable.role } : {}),
      });
      items.push({
        oid,
        name: variable.name,
        label: variable.label,
        ...facets(variable, column.storage, column.values),
        ...(variable.codelist
          ? { codeListOid: codeListOid(variable.codelist) }
          : {}),
        origin: origin(dataset, variable),
        ...(VALUE_LEVEL[dataset.name]?.variables.includes(variable.name)
          ? { valueListOid: valueListOid(dataset.name, variable.name) }
          : {}),
        dataset: dataset.name,
      });
    });
    for (const key of dataset.keys) {
      if (!dataset.variables.some((variable) => variable.name === key)) {
        throw new RangeError(`${dataset.name} key ${key} is not a variable.`);
      }
    }
    const trialDesign = dataset.class === "Trial Design";
    const subjectLevel = dataset.keys.every(
      (key) => key === "STUDYID" || key === "USUBJID"
    );
    itemGroups.push({
      oid: itemGroupOid(dataset.name),
      name: dataset.name,
      label: dataset.label,
      className: className(dataset, layer),
      ...(dataset.subClass ? { subClassName: dataset.subClass } : {}),
      structure: dataset.structure,
      purpose: layer === "sdtm" ? "Tabulation" : "Analysis",
      repeating: !trialDesign && !subjectLevel,
      isReferenceData: trialDesign,
      ...(layer === "sdtm" ? { domain: dataset.name } : {}),
      standardOid: guideOid,
      leaf: {
        id: leafId(dataset.name),
        href: `${dataset.name.toLowerCase()}.xpt`,
        title: `${dataset.name.toLowerCase()}.xpt`,
      },
      keys: dataset.keys,
      records: dataset.rowCount,
      itemRefs,
    });
    if (VALUE_LEVEL[dataset.name]) pendingValueLevel.push({ dataset, columns });
  }

  // A codelist read from the data has no terms when every value is missing,
  // for example in an empty dataset; it is left out with its references.
  const codeLists = CONTROLLED_TERMINOLOGY.filter((codelist) =>
    codelistUses.has(codelist.id)
  )
    .map((codelist) =>
      resolveCodeList(
        codelist,
        codelistUses.get(codelist.id)!,
        ctOid,
        options.onValuesOutsideCodelist
      )
    )
    .filter((list) => list.terms.length > 0);
  const codeListById = new Map(codeLists.map((list) => [list.id, list]));
  items.forEach((item, index) => {
    if (
      item.codeListOid &&
      !codeLists.some((list) => list.oid === item.codeListOid)
    ) {
      const { codeListOid: _dropped, ...rest } = item;
      items[index] = rest;
    }
  });

  for (const { dataset, columns } of pendingValueLevel) {
    const spec = VALUE_LEVEL[dataset.name];
    const byColumn = columns.find((column) => column.variable.name === spec.by);
    if (!byColumn) {
      throw new RangeError(
        `${dataset.name} has no ${spec.by} for value-level metadata.`
      );
    }
    const byCodeList = byColumn.variable.codelist
      ? codeListById.get(byColumn.variable.codelist)
      : undefined;
    const present = new Set(
      byColumn.values
        .map((value) => stringValue(dataset, spec.by, value))
        .filter((value) => value !== null)
    );
    const ordered = byCodeList
      ? byCodeList.terms.map((term) => term.codedValue)
      : [];
    const parameters = [
      ...ordered.filter((value) => present.has(value)),
      ...[...present]
        .filter((value) => !ordered.includes(value))
        .sort(compareCodePoints),
    ];
    if (parameters.length === 0) {
      // An empty dataset has no parameters to describe.
      items.forEach((item, index) => {
        if (item.dataset === dataset.name && item.valueListOid) {
          const { valueListOid: _dropped, ...rest } = item;
          items[index] = rest;
        }
      });
      continue;
    }
    const decodeOf = (value: string) =>
      byCodeList?.terms.find((term) => term.codedValue === value)?.decode ??
      value;
    for (const parameter of parameters) {
      whereClauses.push({
        oid: whereClauseOid(dataset.name, spec.by, parameter),
        dataset: dataset.name,
        itemOid: itemOid(dataset.name, spec.by),
        variable: spec.by,
        comparator: "EQ",
        values: [parameter],
      });
    }
    for (const name of spec.variables) {
      const column = columns.find(
        (candidate) => candidate.variable.name === name
      );
      if (!column) {
        throw new RangeError(
          `${dataset.name} has no ${name} for value-level metadata.`
        );
      }
      const parent = items.find(
        (item) => item.oid === itemOid(dataset.name, name)
      )!;
      const parentRef = itemGroups
        .find((group) => group.name === dataset.name)!
        .itemRefs.find((ref) => ref.name === name)!;
      const refs: DefineItemRef[] = parameters.map((parameter, index) => {
        const subset = column.values.filter(
          (_, row) => byColumn.values[row] === parameter
        );
        const derived = spec.derived?.[parameter]?.variables.includes(name)
          ? spec.derived[parameter].method
          : undefined;
        if (derived && !methodIds.includes(derived)) {
          methodText(layer, derived);
          methodIds.push(derived);
        }
        items.push({
          oid: valueItemOid(dataset.name, name, parameter),
          name,
          label: `${decodeOf(parameter)}: ${column.variable.label}`,
          ...facets(column.variable, column.storage, subset),
          ...(parent.codeListOid ? { codeListOid: parent.codeListOid } : {}),
          origin: derived
            ? { type: "Derived", source: "Sponsor" }
            : parent.origin,
          dataset: dataset.name,
          whereValue: parameter,
        });
        return {
          itemOid: valueItemOid(dataset.name, name, parameter),
          name,
          orderNumber: index + 1,
          mandatory: false,
          ...(derived
            ? { methodOid: methodOid(derived) }
            : parentRef.methodOid
              ? { methodOid: parentRef.methodOid }
              : {}),
          whereClauseOid: whereClauseOid(dataset.name, spec.by, parameter),
        };
      });
      valueLists.push({
        oid: valueListOid(dataset.name, name),
        dataset: dataset.name,
        variable: name,
        itemRefs: refs,
      });
    }
  }

  const methods: DefineMethod[] = methodIds.map((id) => ({
    oid: methodOid(id),
    id,
    name: id,
    type: IMPUTATION_METHODS.has(id) ? "Imputation" : "Computation",
    description: methodText(layer, id),
  }));

  const publishingSets = (["SDTM", "ADaM"] as const).filter((set) =>
    codeLists.some((list) => list.standardOid === ctOid(set))
  );
  const standards: DefineStandard[] = [
    {
      oid: guideOid,
      name: guide,
      type: "IG",
      version: guideVersion,
      status: "Final",
    },
    ...publishingSets.map((set): DefineStandard => ({
      oid: ctOid(set),
      name: "CDISC/NCI",
      type: "CT",
      publishingSet: set,
      version: ctVersion,
      status: "Final",
      commentOid: ctCommentOid,
    })),
  ];
  const comments: DefineComment[] = [
    { oid: noticeOid, text: `${SYNTHETIC_DATA_NOTICE} ${NO_ACRF_COMMENT}` },
    ...(publishingSets.length > 0
      ? [{ oid: ctCommentOid, text: CT_COMMENT }]
      : []),
  ];

  return {
    layer,
    studyId,
    fileOid: defineFileOid(studyId, layer),
    studyOid: studyOid(studyId),
    metaDataVersionOid: metaDataVersionOid(studyId, layer),
    metaDataVersionName: `${studyId} ${layerName} metadata`,
    metaDataVersionDescription: `${guide} ${guideVersion} ${layer === "sdtm" ? "tabulation" : "analysis"} dataset metadata for ${studyId}. ${SYNTHETIC_DATA_NOTICE}`,
    studyName: studyId,
    studyDescription: `${SYNTHETIC_DATA_NOTICE} ${studyId} is a fictional study; this document describes its ${layerName} datasets.`,
    protocolName: studyId,
    defineVersion: DEFINE_XML_VERSION,
    context: "Other",
    createdAt,
    originator: "deruiter.dev",
    sourceSystem: EXPORT_SOURCE_SYSTEM.name,
    sourceSystemVersion: EXPORT_SOURCE_SYSTEM.version,
    notice: SYNTHETIC_DATA_NOTICE,
    commentOid: noticeOid,
    standards,
    valueLists,
    whereClauses,
    itemGroups,
    items,
    codeLists,
    methods,
    comments,
  };
}
