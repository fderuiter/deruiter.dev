/** Protocol-origin SDTM trial design datasets, derived from StudyDefinition. */
import type {
  CellValue,
  Dataset,
  EligibilityCriterionDefinition,
  StudyDefinition,
  VariableMeta,
  VariableRole,
} from "../../types";
import { sdtmCodelist } from "./codelists";
import { sdtmRequired } from "./required";

type Row = Record<string, CellValue>;
type DomainName = "TA" | "TE" | "TV" | "TI" | "TS";

/**
 * The IETESTCD of a protocol criterion in TI, which IE records repeat: INC
 * or EXC followed by the protocol's own identifier, such as INC01.
 */
export function criterionTestCode(
  criterion: Pick<EligibilityCriterionDefinition, "category" | "identifier">
): string {
  return `${criterion.category === "INCLUSION" ? "INC" : "EXC"}${criterion.identifier}`;
}
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
      column("TABRANCH", "Branch", "Rule"),
      column("TATRANS", "Transition Rule", "Rule"),
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
      // Every arm has the same visits, so ARMCD is null on every visit.
      column("ARMCD", "Planned Arm Code", "Record Qualifier"),
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
  ctVersion = "",
  reference = "CDISC"
): Row {
  return {
    STUDYID: studyId,
    DOMAIN: "TS",
    TSSEQ: 1,
    TSPARMCD: parameter,
    TSPARM: label,
    TSVAL: String(value),
    TSVALCD: code,
    TSVCDREF: code ? reference : null,
    TSVCDVER: code ? ctVersion : null,
  };
}

/**
 * Submission values of Intervention Type Response (C99078), by NCI code, for
 * TS INTTYPE. USDM codes a study intervention's type with the same codes.
 */
const INTERVENTION_TYPES: Readonly<Record<string, string>> = {
  C15184: "BEHAVIORAL THERAPY",
  C307: "BIOLOGIC",
  C54696: "COMBINATION PRODUCT",
  C16830: "DEVICE",
  C18020: "DIAGNOSTIC TEST",
  C1505: "DIETARY SUPPLEMENT",
  C1909: "DRUG",
  C15238: "GENETIC",
  C218507: "NON-SURGICAL PROCEDURE",
  C98769: "PROCEDURE",
  C15313: "RADIATION",
  C15329: "SURGERY",
  C923: "VACCINE",
};

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
  const epochs = [...design.epochs].sort((a, b) => a.order - b.order);
  const pathOf = (armId: string) =>
    epochs.flatMap((epoch) =>
      design.cells
        .filter(
          (candidate) =>
            candidate.armId === armId && candidate.epochId === epoch.id
        )
        .flatMap((cell) =>
          cell.elementIds.map((elementId) => {
            const element = elementById.get(elementId);
            if (!element)
              throw new RangeError(`Unknown USDM element ${elementId}`);
            return { element, epoch };
          })
        )
    );
  const paths = design.arms.map((arm) => {
    const path = pathOf(arm.id);
    return { arm, path, codes: path.map(({ element }) => element.elementCode) };
  });
  const ta: Row[] = [];
  for (const { arm, path, codes } of paths) {
    path.forEach(({ element, epoch }, index) => {
      // Arms that share every element so far and differ in the next one
      // part at the end of this element, which in a parallel design is
      // randomization. Subjects pass through every element of their arm in
      // order, so no record has a transition rule.
      const branches = paths.some(
        (other) =>
          other.arm.id !== arm.id &&
          other.codes.slice(0, index + 1).join() ===
            codes.slice(0, index + 1).join() &&
          other.codes[index + 1] !== codes[index + 1]
      );
      ta.push({
        STUDYID: studyId,
        DOMAIN: "TA",
        ARMCD: arm.armCode,
        ARM: arm.name,
        TAETORD: index + 1,
        ETCD: element.elementCode,
        ELEMENT: element.name,
        TABRANCH: branches ? `Randomized to ${arm.name}` : null,
        TATRANS: null,
        EPOCH: epoch.name,
      });
    });
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
    ARMCD: null,
    TVSTRL: `${visit.targetDay - visit.windowBefore} study days after reference start`,
    TVENRL: `${visit.targetDay + visit.windowAfter} study days after reference start`,
  }));
  const ti: Row[] = design.eligibilityCriteria.map((criterion) => ({
    STUDYID: studyId,
    DOMAIN: "TI",
    IETESTCD: criterionTestCode(criterion),
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
    ...(INTERVENTION_TYPES[design.interventionType.code]
      ? [
          summary(
            studyId,
            "INTTYPE",
            "Intervention Type",
            INTERVENTION_TYPES[design.interventionType.code],
            design.interventionType.code,
            versions["NCI-EVS-CT"]
          ),
        ]
      : []),
    ...(design.pharmacologicClass
      ? [
          summary(
            studyId,
            "PCLAS",
            "Pharmacologic Class",
            design.pharmacologicClass.decode,
            design.pharmacologicClass.code,
            design.pharmacologicClass.version,
            "MED-RT"
          ),
        ]
      : []),
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
    // TS CT has an SDTM IG version parameter (SDTIGVER, C156604) but none
    // for the ADaM IG, whose version define.xml and the ADRG carry.
    summary(studyId, "SDTIGVER", "SDTM IG Version", versions.SDTMIG ?? ""),
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
