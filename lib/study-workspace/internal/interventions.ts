import type {
  StudyEdit,
  StudyInterventionView,
  StudyPatchOperation,
  StudyWorkspace,
} from "../types";
import {
  STUDY_INTERVENTION_ROLES,
  STUDY_INTERVENTION_TYPES,
  usdmCode,
} from "./design-terms";
import {
  StudyDesignError,
  recordsOf,
  selectedDesign,
  type JsonRecord,
} from "./design-grid";
import { cleanName, findTerm, idMaker, removal } from "./design-ops";
import { createStudyEdit } from "./ops";

/**
 * Study interventions of the selected design (#3406). USDM keeps them on
 * the study version and lists the ones a design uses in its
 * `studyInterventionIds`; an element names what is given in it through its
 * own `studyInterventionIds`. Role and type are coded from the pinned CT
 * package and nothing else.
 */

/** Fields of a new intervention. */
export interface NewStudyIntervention {
  readonly name: string;
  readonly description?: string;
  readonly roleCode: string;
  readonly typeCode: string;
}

/** Fields an intervention edit may change. */
export interface StudyInterventionChanges {
  readonly name?: string;
  readonly description?: string;
  readonly roleCode?: string;
  readonly typeCode?: string;
}

function locate(workspace: StudyWorkspace) {
  const { pointer, design } = selectedDesign(workspace);
  const versionPointer = pointer.replace(/\/studyDesigns\/\d+$/, "");
  const versionIndex = Number(/\/versions\/(\d+)/.exec(pointer)?.[1]);
  const study = (workspace.usdm as unknown as JsonRecord).study as JsonRecord;
  const version = (study.versions as JsonRecord[])[versionIndex];
  return { pointer, design, versionPointer, version };
}

function interventionIndex(version: JsonRecord, id: string): number {
  const index = recordsOf(version.studyInterventions).findIndex(
    (item) => item.id === id
  );
  if (index < 0) {
    throw new StudyDesignError(`The study version has no intervention ${id}.`);
  }
  return index;
}

function idsOf(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function termOf(value: unknown) {
  if (typeof value !== "object" || value === null) return null;
  const code = (value as JsonRecord).code;
  const decode = (value as JsonRecord).decode;
  return typeof code === "string"
    ? { code, decode: typeof decode === "string" ? decode : "" }
    : null;
}

/**
 * The interventions the selected design uses: those its
 * `studyInterventionIds` lists and those its elements name, each with the
 * elements it is given in.
 */
export function projectStudyInterventions(
  workspace: StudyWorkspace
): StudyInterventionView[] {
  const { design, version } = locate(workspace);
  const elements = recordsOf(design.elements);
  const used = new Set(idsOf(design.studyInterventionIds));
  for (const element of elements) {
    for (const id of idsOf(element.studyInterventionIds)) used.add(id);
  }
  return recordsOf(version.studyInterventions)
    .filter((item) => typeof item.id === "string" && used.has(item.id))
    .map((item) => {
      const id = item.id as string;
      return {
        id,
        name: typeof item.name === "string" ? item.name : id,
        description:
          typeof item.description === "string" ? item.description : "",
        role: termOf(item.role),
        type: termOf(item.type),
        listed: idsOf(design.studyInterventionIds).includes(id),
        elementIds: elements
          .filter((element) => idsOf(element.studyInterventionIds).includes(id))
          .map((element) => String(element.id)),
      };
    });
}

/** Adds an intervention to the study version and the selected design. */
export function addStudyIntervention(
  workspace: StudyWorkspace,
  input: NewStudyIntervention
): StudyEdit {
  const name = cleanName(input.name, "intervention");
  const role = findTerm(
    STUDY_INTERVENTION_ROLES,
    input.roleCode,
    "intervention role"
  );
  const type = findTerm(
    STUDY_INTERVENTION_TYPES,
    input.typeCode,
    "intervention type"
  );
  const { pointer, design, versionPointer, version } = locate(workspace);
  const nextId = idMaker(workspace);
  const id = nextId("StudyIntervention");
  const intervention = {
    id,
    name,
    description: input.description?.trim() || null,
    role: usdmCode(nextId("Code"), role),
    type: usdmCode(nextId("Code"), type),
    codes: [],
    administrations: [],
    instanceType: "StudyIntervention",
  };
  const patch: StudyPatchOperation[] = [
    Array.isArray(version.studyInterventions)
      ? {
          op: "add",
          path: `${versionPointer}/studyInterventions/-`,
          value: intervention,
        }
      : {
          op: "add",
          path: `${versionPointer}/studyInterventions`,
          value: [intervention],
        },
    Array.isArray(design.studyInterventionIds)
      ? { op: "add", path: `${pointer}/studyInterventionIds/-`, value: id }
      : { op: "add", path: `${pointer}/studyInterventionIds`, value: [id] },
  ];
  return createStudyEdit(workspace, patch, `Add intervention "${name}"`);
}

/** Changes an intervention's name, description, role or type. */
export function updateStudyIntervention(
  workspace: StudyWorkspace,
  interventionId: string,
  changes: StudyInterventionChanges
): StudyEdit {
  const { versionPointer, version } = locate(workspace);
  const index = interventionIndex(version, interventionId);
  const current = recordsOf(version.studyInterventions)[index];
  const at = `${versionPointer}/studyInterventions/${index}`;
  const patch: StudyPatchOperation[] = [];
  let name = typeof current.name === "string" ? current.name : interventionId;
  if (changes.name !== undefined) {
    name = cleanName(changes.name, "intervention");
    patch.push({ op: "replace", path: `${at}/name`, value: name });
  }
  if (changes.description !== undefined) {
    patch.push({
      op: "add",
      path: `${at}/description`,
      value: changes.description.trim() || null,
    });
  }
  const recode = (
    field: "role" | "type",
    code: string,
    terms: typeof STUDY_INTERVENTION_ROLES,
    what: string
  ) => {
    const term = findTerm(terms, code, what);
    const existing = current[field] as JsonRecord | undefined;
    const codeId =
      typeof existing?.id === "string"
        ? existing.id
        : idMaker(workspace)("Code");
    patch.push({
      op: "add",
      path: `${at}/${field}`,
      value: usdmCode(codeId, term),
    });
  };
  if (changes.roleCode !== undefined) {
    recode(
      "role",
      changes.roleCode,
      STUDY_INTERVENTION_ROLES,
      "intervention role"
    );
  }
  if (changes.typeCode !== undefined) {
    recode(
      "type",
      changes.typeCode,
      STUDY_INTERVENTION_TYPES,
      "intervention type"
    );
  }
  if (patch.length === 0) {
    throw new StudyDesignError("The edit changes nothing.");
  }
  return createStudyEdit(workspace, patch, `Edit intervention "${name}"`);
}

/**
 * Removes an intervention from the selected design, and from the study
 * version when no other design lists it. Refused while an element still
 * gives it, so nothing is left naming a missing intervention.
 */
export function removeStudyIntervention(
  workspace: StudyWorkspace,
  interventionId: string
): StudyEdit {
  const { pointer, design, versionPointer, version } = locate(workspace);
  const index = interventionIndex(version, interventionId);
  const name = String(
    recordsOf(version.studyInterventions)[index].name ?? interventionId
  );
  const patch: StudyPatchOperation[] = [];
  const listedAt = idsOf(design.studyInterventionIds).indexOf(interventionId);
  if (listedAt >= 0) {
    patch.push({
      op: "remove",
      path: `${pointer}/studyInterventionIds/${listedAt}`,
    });
  }
  const otherDesigns = recordsOf(version.studyDesigns).filter(
    (other) =>
      other.id !== design.id &&
      idsOf(other.studyInterventionIds).includes(interventionId)
  );
  if (otherDesigns.length === 0) {
    patch.push({
      op: "remove",
      path: `${versionPointer}/studyInterventions/${index}`,
    });
    return removal(
      workspace,
      patch,
      [interventionId],
      `Remove intervention "${name}"`
    );
  }
  const given = recordsOf(design.elements).some((element) =>
    idsOf(element.studyInterventionIds).includes(interventionId)
  );
  if (given) {
    throw new StudyDesignError(
      `${interventionId} is still given in an element of this design; take it off those elements first.`
    );
  }
  return createStudyEdit(workspace, patch, `Remove intervention "${name}"`);
}

function elementAt(design: JsonRecord, elementId: string) {
  const index = recordsOf(design.elements).findIndex(
    (element) => element.id === elementId
  );
  if (index < 0) {
    throw new StudyDesignError(`The design has no element ${elementId}.`);
  }
  return { index, element: recordsOf(design.elements)[index] };
}

/** Records that an intervention is given in an element. */
export function assignStudyIntervention(
  workspace: StudyWorkspace,
  elementId: string,
  interventionId: string
): StudyEdit {
  const { pointer, design, version } = locate(workspace);
  const index = interventionIndex(version, interventionId);
  const { index: at, element } = elementAt(design, elementId);
  const given = idsOf(element.studyInterventionIds);
  if (given.includes(interventionId)) {
    throw new StudyDesignError(
      `${interventionId} is already given in ${elementId}.`
    );
  }
  const patch: StudyPatchOperation[] = [
    Array.isArray(element.studyInterventionIds)
      ? {
          op: "add",
          path: `${pointer}/elements/${at}/studyInterventionIds/-`,
          value: interventionId,
        }
      : {
          op: "add",
          path: `${pointer}/elements/${at}/studyInterventionIds`,
          value: [interventionId],
        },
  ];
  if (!idsOf(design.studyInterventionIds).includes(interventionId)) {
    patch.push(
      Array.isArray(design.studyInterventionIds)
        ? {
            op: "add",
            path: `${pointer}/studyInterventionIds/-`,
            value: interventionId,
          }
        : {
            op: "add",
            path: `${pointer}/studyInterventionIds`,
            value: [interventionId],
          }
    );
  }
  const name = String(
    recordsOf(version.studyInterventions)[index].name ?? interventionId
  );
  return createStudyEdit(
    workspace,
    patch,
    `Give "${name}" in "${String(element.name ?? elementId)}"`
  );
}

/** Records that an intervention is no longer given in an element. */
export function unassignStudyIntervention(
  workspace: StudyWorkspace,
  elementId: string,
  interventionId: string
): StudyEdit {
  const { pointer, design } = locate(workspace);
  const { index: at, element } = elementAt(design, elementId);
  const position = idsOf(element.studyInterventionIds).indexOf(interventionId);
  if (position < 0) {
    throw new StudyDesignError(
      `${interventionId} is not given in ${elementId}.`
    );
  }
  return createStudyEdit(
    workspace,
    [
      {
        op: "remove",
        path: `${pointer}/elements/${at}/studyInterventionIds/${position}`,
      },
    ],
    `Stop giving ${interventionId} in "${String(element.name ?? elementId)}"`
  );
}
