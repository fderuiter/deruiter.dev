/** Protocol-origin SDTM trial design datasets, derived from StudyDefinition. */
import type {
  CellValue,
  Dataset,
  StudyDefinition,
  VariableMeta,
  VariableRole,
} from "../../types";
import { sdtmCodelist } from "./codelists";
import { sdtmRequired } from "./required";

type Row = Record<string, CellValue>;
type DomainName = "TA" | "TE" | "TV" | "TI" | "TS";
interface ColumnSpec {
  readonly name: string;
  readonly label: string;
  readonly type?: VariableMeta["type"];
  readonly role: VariableRole;
  readonly length?: number;
}
interface DomainSpec {
  readonly label: string;
  readonly structure: string;
  readonly keys: readonly string[];
  readonly columns: readonly ColumnSpec[];
}
const id = (name: string, label: string): ColumnSpec => ({
  name,
  label,
  role: "Identifier",
});
const topic = (name: string, label: string): ColumnSpec => ({
  name,
  label,
  role: "Topic",
});
const timing = (name: string, label: string): ColumnSpec => ({
  name,
  label,
  role: "Timing",
  type: "integer",
});
/** A column whose SDTMIG 3.4 role the helpers above do not name. */
const column = (
  name: string,
  label: string,
  role: VariableRole,
  type?: VariableMeta["type"]
): ColumnSpec => (type ? { name, label, role, type } : { name, label, role });

/** Typed column mapping specifications shared by tabulation and metadata. */
const SPECS: Record<DomainName, DomainSpec> = {
  TA: {
    label: "Trial Arms",
    structure: "One record per planned element per arm",
    keys: ["STUDYID", "ARMCD", "TAETORD"],
    columns: [
      id("STUDYID", "Study Identifier"),
      id("DOMAIN", "Domain Abbreviation"),
      topic("ARMCD", "Planned Arm Code"),
      column("ARM", "Description of Planned Arm", "Synonym Qualifier"),
      timing("TAETORD", "Element Order"),
      column("ETCD", "Element Code", "Record Qualifier"),
      column("ELEMENT", "Description of Element", "Synonym Qualifier"),
      column("EPOCH", "Epoch", "Timing"),
    ],
  },
  TE: {
    label: "Trial Elements",
    structure: "One record per planned element",
    keys: ["STUDYID", "ETCD"],
    columns: [
      id("STUDYID", "Study Identifier"),
      id("DOMAIN", "Domain Abbreviation"),
      topic("ETCD", "Element Code"),
      column("ELEMENT", "Description of Element", "Synonym Qualifier"),
      column("TESTRL", "Rule for Start of Element", "Rule"),
      column("TEENRL", "Rule for End of Element", "Rule"),
      column("TEDUR", "Planned Duration of Element", "Timing"),
    ],
  },
  TV: {
    label: "Trial Visits",
    structure: "One record per planned visit",
    keys: ["STUDYID", "VISITNUM"],
    columns: [
      id("STUDYID", "Study Identifier"),
      id("DOMAIN", "Domain Abbreviation"),
      column("VISITNUM", "Visit Number", "Topic", "integer"),
      column("VISIT", "Visit Name", "Synonym Qualifier"),
      timing("VISITDY", "Planned Study Day"),
      column("TVSTRL", "Rule for Start of Visit", "Rule"),
      column("TVENRL", "Rule for End of Visit", "Rule"),
    ],
  },
  TI: {
    label: "Trial Inclusion Exclusion Criteria",
    structure: "One record per inclusion or exclusion criterion",
    keys: ["STUDYID", "IETESTCD"],
    columns: [
      id("STUDYID", "Study Identifier"),
      id("DOMAIN", "Domain Abbreviation"),
      topic("IETESTCD", "Criterion Short Name"),
      column("IETEST", "Criterion Text", "Synonym Qualifier"),
      column("IECAT", "Criterion Category", "Grouping Qualifier"),
    ],
  },
  TS: {
    label: "Trial Summary",
    structure: "One record per trial summary parameter value",
    keys: ["STUDYID", "TSPARMCD", "TSSEQ"],
    columns: [
      id("STUDYID", "Study Identifier"),
      id("DOMAIN", "Domain Abbreviation"),
      column("TSSEQ", "Sequence Number", "Identifier", "integer"),
      topic("TSPARMCD", "Trial Summary Parameter Short Name"),
      column("TSPARM", "Trial Summary Parameter", "Synonym Qualifier"),
      column("TSVAL", "Parameter Value", "Result Qualifier"),
      column("TSVALCD", "Parameter Value Code", "Result Qualifier"),
      column("TSVCDREF", "Value Code Reference", "Result Qualifier"),
      column("TSVCDVER", "Value Code Version", "Result Qualifier"),
    ],
  },
};

function table(name: DomainName, rows: readonly Row[]): Dataset {
  const spec = SPECS[name];
  return {
    name,
    label: spec.label,
    layer: "sdtm",
    class: "Trial Design",
    structure: spec.structure,
    keys: spec.keys,
    variables: spec.columns.map((column) => ({
      name: column.name,
      label: column.label,
      type: column.type ?? "text",
      ...(column.type ? {} : { length: column.length ?? 200 }),
      role: column.role,
      origin: "Protocol" as const,
      ...sdtmCodelist(column.name),
      ...sdtmRequired(name, column.name),
    })),
    columns: Object.fromEntries(
      spec.columns.map(({ name: variable }) => [
        variable,
        rows.map((row) => row[variable] ?? null),
      ])
    ),
    rowCount: rows.length,
  };
}

function summary(
  studyId: string,
  parameter: string,
  label: string,
  value: string | number,
  code: string | null = null,
  ctVersion = ""
): Row {
  return {
    STUDYID: studyId,
    DOMAIN: "TS",
    TSSEQ: 1,
    TSPARMCD: parameter,
    TSPARM: label,
    TSVAL: String(value),
    TSVALCD: code,
    TSVCDREF: code ? "CDISC" : null,
    TSVCDVER: code ? ctVersion : null,
  };
}

/** Build the five trial-design domains solely from the parsed USDM study definition. */
export function deriveTrialDesign(
  definition: StudyDefinition,
  versions: Readonly<Record<string, string>>
): readonly Dataset[] {
  const { studyId, title, design } = definition;
  const epochById = new Map(design.epochs.map((epoch) => [epoch.id, epoch]));
  const elementById = new Map(
    design.elements.map((element) => [element.id, element])
  );
  const ta: Row[] = [];
  for (const arm of design.arms) {
    let order = 0;
    for (const epoch of [...design.epochs].sort((a, b) => a.order - b.order)) {
      for (const cell of design.cells.filter(
        (candidate) =>
          candidate.armId === arm.id && candidate.epochId === epoch.id
      )) {
        for (const elementId of cell.elementIds) {
          const element = elementById.get(elementId);
          if (!element)
            throw new RangeError(`Unknown USDM element ${elementId}`);
          order += 1;
          ta.push({
            STUDYID: studyId,
            DOMAIN: "TA",
            ARMCD: arm.armCode,
            ARM: arm.name,
            TAETORD: order,
            ETCD: element.elementCode,
            ELEMENT: element.name,
            EPOCH: epoch.name,
          });
        }
      }
    }
  }
  const te: Row[] = design.elements.map((element) => {
    const cell = design.cells.find((candidate) =>
      candidate.elementIds.includes(element.id)
    );
    const epoch = cell ? epochById.get(cell.epochId) : undefined;
    const epochVisits = design.visits.filter(
      (visit) => visit.epochId === epoch?.id
    );
    const first = epochVisits[0];
    const last = epochVisits.at(-1);
    return {
      STUDYID: studyId,
      DOMAIN: "TE",
      ETCD: element.elementCode,
      ELEMENT: element.name,
      TESTRL: first
        ? `At ${first.name} (planned study day ${first.targetDay})`
        : "Per protocol element entry",
      TEENRL: last
        ? `After ${last.name} (planned study day ${last.targetDay})`
        : "Per protocol element exit",
      TEDUR:
        first && last
          ? `P${Math.max(0, last.targetDay - first.targetDay)}D`
          : null,
    };
  });
  const tv: Row[] = design.visits.map((visit) => ({
    STUDYID: studyId,
    DOMAIN: "TV",
    VISITNUM: visit.visitNum,
    VISIT: visit.name,
    VISITDY: visit.targetDay,
    TVSTRL: `${visit.targetDay - visit.windowBefore} study days after reference start`,
    TVENRL: `${visit.targetDay + visit.windowAfter} study days after reference start`,
  }));
  const ti: Row[] = design.eligibilityCriteria.map((criterion) => ({
    STUDYID: studyId,
    DOMAIN: "TI",
    IETESTCD:
      criterion.category === "INCLUSION"
        ? `INC${criterion.identifier}`
        : `EXC${criterion.identifier}`,
    IETEST: criterion.text,
    IECAT: criterion.category,
  }));
  const ts: Row[] = [
    summary(studyId, "TITLE", "Trial Title", title),
    summary(
      studyId,
      "TPHASE",
      "Trial Phase Classification",
      design.phase,
      design.phaseCode,
      versions["NCI-EVS-CT"]
    ),
    summary(
      studyId,
      "STYPE",
      "Study Type",
      "INTERVENTIONAL",
      "C98388",
      versions["NCI-EVS-CT"]
    ),
    summary(
      studyId,
      "INTMODEL",
      "Intervention Model",
      design.model.replace(/ Study$/i, "").toUpperCase(),
      design.modelCode,
      versions["NCI-EVS-CT"]
    ),
    summary(
      studyId,
      "TBLIND",
      "Trial Blinding Schema",
      design.blinding.replace(/ Study$/i, "").toUpperCase(),
      design.blindingCode,
      versions["NCI-EVS-CT"]
    ),
    summary(
      studyId,
      "PLANSUB",
      "Planned Number of Subjects",
      design.plannedEnrollment
    ),
    summary(studyId, "NARMS", "Number of Arms", design.arms.length),
    summary(
      studyId,
      "RANDOM",
      "Randomized Trial",
      design.arms.length > 1 ? "Y" : "N",
      design.arms.length > 1 ? "C49488" : "C49487",
      versions["NCI-EVS-CT"]
    ),
    summary(
      studyId,
      "SDTMIGVER",
      "SDTM Implementation Guide Version",
      versions.SDTMIG ?? ""
    ),
    summary(
      studyId,
      "ADAMIGVER",
      "ADaM Implementation Guide Version",
      versions.ADaMIG ?? ""
    ),
    summary(
      studyId,
      "CTVERS",
      "Controlled Terminology Version",
      versions["NCI-EVS-CT"] ?? ""
    ),
  ];
  return [
    table("TA", ta),
    table("TE", te),
    table("TV", tv),
    table("TI", ti),
    table("TS", ts),
  ];
}
