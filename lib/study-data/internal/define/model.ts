/**
 * The Define-XML 2.1 document model. `buildDefine` fills it from a pipeline
 * run; the XML writer and the HTML renderer both read it, so the two views of
 * a define always say the same thing.
 */
import type { DataLayer, VariableOrigin, VariableRole } from "../../types";

/** A layer that has a Define-XML document: SDTM or ADaM. */
export type DefineLayer = Exclude<DataLayer, "collected">;

/** Define-XML 2.1 `ItemDef` data types the pipeline writes. */
export type DefineDataType =
  "text" | "integer" | "float" | "date" | "datetime" | "time";

/** Inputs to `buildDefine` that are not in the run itself. */
export interface DefineOptions {
  /** Which layer's datasets the document describes. */
  readonly layer: DefineLayer;
  /**
   * The ODM `CreationDateTime`, an ISO 8601 timestamp with a zone. The study
   * data package passes its fixed reproducibility timestamp, so the bytes
   * depend only on the run; the real build time stays in its timestamp file.
   */
  readonly createdAt: string;
  /**
   * Called once for each codelist whose data holds values outside it when it
   * is not extensible (#3020). The define describes the planned codelist
   * without those values; the datasets keep them as collected, and the
   * conformance rules report them, so a caller can carry the findings with
   * the define.
   */
  readonly onValuesOutsideCodelist?: (
    outside: DefineValuesOutsideCodelist
  ) => void;
}

/** Values a non-extensible codelist does not admit, and where they are. */
export interface DefineValuesOutsideCodelist {
  /** The codelist id, as in `CONTROLLED_TERMINOLOGY`. */
  readonly codelist: string;
  /** The values outside the codelist, in code point order. */
  readonly values: readonly string[];
  /** The variables that hold them. */
  readonly variables: readonly {
    readonly dataset: string;
    readonly variable: string;
  }[];
}

/** One `def:Standard`: an implementation guide or a CT package. */
export interface DefineStandard {
  readonly oid: string;
  readonly name: "SDTMIG" | "ADaMIG" | "CDISC/NCI";
  readonly type: "IG" | "CT";
  /** CT publishing set, for CT standards. */
  readonly publishingSet?: "SDTM" | "ADaM";
  readonly version: string;
  readonly status: "Final";
  /** A comment on the standard, for example that the CT is a local subset. */
  readonly commentOid?: string;
}

/** One `def:CommentDef`. */
export interface DefineComment {
  readonly oid: string;
  readonly text: string;
}

/** Where a variable's values come from (`def:Origin`). */
export interface DefineOrigin {
  readonly type: VariableOrigin;
  /** Who provides the value, for Collected, Derived and Assigned origins. */
  readonly source?: "Investigator" | "Sponsor";
  /** For example the predecessor variable or the collection field. */
  readonly description?: string;
}

/** One `ItemRef`, in a dataset or in a value list. */
export interface DefineItemRef {
  readonly itemOid: string;
  /** Variable name, for readers of the model. */
  readonly name: string;
  readonly orderNumber: number;
  readonly mandatory: boolean;
  /** One-based position among the dataset keys. */
  readonly keySequence?: number;
  readonly methodOid?: string;
  /** SDTM variable role. */
  readonly role?: VariableRole;
  /** The where clause a value-level reference applies under. */
  readonly whereClauseOid?: string;
}

/** One `ItemDef`: a dataset variable, or one variable for one parameter. */
export interface DefineItem {
  readonly oid: string;
  /** Variable name. */
  readonly name: string;
  /** Variable label, or for value-level items the parameter and label. */
  readonly label: string;
  readonly dataType: DefineDataType;
  /** Maximum length: bytes for text, digits for numbers. */
  readonly length?: number;
  /** Digits after the decimal point, for float items. */
  readonly significantDigits?: number;
  /** SAS display format, for ADaM dates, datetimes and times. */
  readonly displayFormat?: string;
  readonly codeListOid?: string;
  readonly origin: DefineOrigin;
  /** The value list that refines this variable by parameter. */
  readonly valueListOid?: string;
  /** Dataset the item belongs to. */
  readonly dataset: string;
  /** For a value-level item, the parameter value it describes. */
  readonly whereValue?: string;
}

/** The dataset file a `def:leaf` points to. */
export interface DefineLeaf {
  readonly id: string;
  readonly href: string;
  readonly title: string;
}

/** One `ItemGroupDef`: a dataset. */
export interface DefineItemGroup {
  readonly oid: string;
  readonly name: string;
  readonly label: string;
  /** Define-XML class name, for example `FINDINGS`. */
  readonly className: string;
  /** Define-XML subclass name, for example `TIME-TO-EVENT`. */
  readonly subClassName?: string;
  readonly structure: string;
  readonly purpose: "Tabulation" | "Analysis";
  readonly repeating: boolean;
  readonly isReferenceData: boolean;
  /** SDTM domain, for tabulation datasets. */
  readonly domain?: string;
  readonly standardOid: string;
  readonly leaf: DefineLeaf;
  /** Key variables, in sort order. */
  readonly keys: readonly string[];
  /** Number of records, for the HTML view. Define-XML does not carry it. */
  readonly records: number;
  readonly itemRefs: readonly DefineItemRef[];
}

/** One term of a `CodeList`. */
export interface DefineCodeListTerm {
  readonly codedValue: string;
  readonly decode?: string;
  /** NCI code, for CDISC terms. */
  readonly nciCode?: string;
  /** True for a value added to an extensible CDISC codelist. */
  readonly extended: boolean;
  readonly orderNumber: number;
}

/** One `CodeList`. */
export interface DefineCodeList {
  readonly oid: string;
  /** Codelist id in the local terminology subset. */
  readonly id: string;
  readonly name: string;
  readonly dataType: "text";
  /** NCI code, for CDISC codelists. */
  readonly nciCode?: string;
  /** Whether a CDISC codelist is extensible. */
  readonly extensible?: boolean;
  /** The CT standard a CDISC codelist comes from. */
  readonly standardOid?: string;
  /** True when every term has a decode (`CodeListItem`), else `EnumeratedItem`. */
  readonly decoded: boolean;
  readonly terms: readonly DefineCodeListTerm[];
}

/** One `MethodDef`. */
export interface DefineMethod {
  readonly oid: string;
  /** Method id in the derivation specs. */
  readonly id: string;
  readonly name: string;
  readonly type: "Computation" | "Imputation";
  readonly description: string;
}

/** One `def:WhereClauseDef`: variable equals one value. */
export interface DefineWhereClause {
  readonly oid: string;
  readonly dataset: string;
  /** The `ItemDef` the range check tests, for example `IT.VS.VSTESTCD`. */
  readonly itemOid: string;
  readonly variable: string;
  readonly comparator: "EQ";
  readonly values: readonly string[];
}

/** One `def:ValueListDef`. */
export interface DefineValueList {
  readonly oid: string;
  readonly dataset: string;
  readonly variable: string;
  readonly itemRefs: readonly DefineItemRef[];
}

/** A Define-XML 2.1 document for one layer of a pipeline run. */
export interface DefineDocument {
  readonly layer: DefineLayer;
  readonly studyId: string;
  readonly fileOid: string;
  readonly studyOid: string;
  readonly metaDataVersionOid: string;
  readonly metaDataVersionName: string;
  readonly metaDataVersionDescription: string;
  readonly studyName: string;
  readonly studyDescription: string;
  readonly protocolName: string;
  /** `def:DefineVersion`, matching the vendored 2.1.0 schema. */
  readonly defineVersion: string;
  readonly context: "Other";
  readonly createdAt: string;
  readonly originator: string;
  readonly sourceSystem: string;
  readonly sourceSystemVersion: string;
  /** The synthetic-data notice. */
  readonly notice: string;
  /** The comment on the whole metadata version. */
  readonly commentOid: string;
  readonly standards: readonly DefineStandard[];
  readonly valueLists: readonly DefineValueList[];
  readonly whereClauses: readonly DefineWhereClause[];
  readonly itemGroups: readonly DefineItemGroup[];
  readonly items: readonly DefineItem[];
  readonly codeLists: readonly DefineCodeList[];
  readonly methods: readonly DefineMethod[];
  readonly comments: readonly DefineComment[];
}
