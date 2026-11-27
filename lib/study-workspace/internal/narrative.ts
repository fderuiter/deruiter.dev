import type {
  StudyCriterionView,
  StudyEdit,
  StudyEndpointView,
  StudyNarrativeFinding,
  StudyNarrativeView,
  StudyObjectiveView,
  StudyPatchOperation,
  StudyWorkspace,
} from "../types";
import {
  StudyDesignError,
  orderedChain,
  recordsOf,
  selectedDesign,
  termOf,
  textOf,
  type JsonRecord,
} from "./design-grid";
import { cleanName, findTerm, idMaker, removal } from "./design-ops";
import {
  STUDY_CRITERION_CATEGORIES,
  STUDY_ENDPOINT_LEVELS,
  STUDY_OBJECTIVE_LEVELS,
  usdmCode,
} from "./design-terms";
import { createStudyEdit } from "./ops";

/** Input for adding a study objective. */
export interface NewStudyObjectiveInput {
  readonly name: string;
  readonly levelCode: string;
  readonly text: string;
}

/** Changes to apply to an existing study objective. */
export interface StudyObjectiveChanges {
  readonly name?: string;
  readonly levelCode?: string;
  readonly text?: string;
}

/** Input for adding an endpoint inside a study objective. */
export interface NewStudyEndpointInput {
  readonly objectiveId: string;
  readonly name: string;
  readonly levelCode: string;
  readonly purpose: string;
  readonly text: string;
}

/** Changes to apply to an existing endpoint inside a study objective. */
export interface StudyEndpointChanges {
  readonly objectiveId: string;
  readonly endpointId: string;
  readonly name?: string;
  readonly levelCode?: string;
  readonly purpose?: string;
  readonly text?: string;
}

/** Input for adding an eligibility criterion and its criterion text item. */
export interface NewStudyCriterionInput {
  readonly name: string;
  readonly identifier: string;
  readonly categoryCode: string;
  readonly text: string;
  readonly itemName?: string;
}

/** Changes to apply to an existing eligibility criterion and its text item. */
export interface StudyCriterionChanges {
  readonly name?: string;
  readonly identifier?: string;
  readonly categoryCode?: string;
  readonly text?: string;
  readonly itemName?: string;
}

function clampIndex(index: number, length: number): number {
  const whole = Math.trunc(index);
  if (whole < 0) return 0;
  return whole > length ? length : whole;
}

function relinkCriteria(items: JsonRecord[]): JsonRecord[] {
  return items.map((item, index) => ({
    ...item,
    previousId: index > 0 ? items[index - 1].id : null,
    nextId: index < items.length - 1 ? items[index + 1].id : null,
  }));
}

/**
 * Projects study objectives, nested endpoints, and eligibility criteria from
 * the selected design and version, surfacing explicit findings when coded
 * levels, criterion text items, or structured texts are missing.
 */
export function projectStudyNarrative(
  workspace: StudyWorkspace
): StudyNarrativeView {
  const { version, design } = selectedDesign(workspace);
  const findings: StudyNarrativeFinding[] = [];

  let endpointCount = 0;
  const objectives: StudyObjectiveView[] = recordsOf(design.objectives).map(
    (obj) => {
      const objId = textOf(obj.id);
      const objName = textOf(obj.name);
      const objText = textOf(obj.text);
      const objLevel = termOf(obj.level);

      if (!objText.trim()) {
        findings.push({
          kind: "missing-objective-text",
          message: `Objective "${objName || objId}" has no structured text.`,
          ids: [objId],
        });
      }
      if (!objLevel) {
        findings.push({
          kind: "missing-objective-level",
          message: `Objective "${objName || objId}" has no coded level.`,
          ids: [objId],
        });
      }

      const endpoints: StudyEndpointView[] = recordsOf(obj.endpoints).map(
        (ep) => {
          endpointCount += 1;
          const epId = textOf(ep.id);
          const epName = textOf(ep.name);
          const epText = textOf(ep.text);
          const epPurpose = textOf(ep.purpose);
          const epLevel = termOf(ep.level);

          if (!epText.trim()) {
            findings.push({
              kind: "missing-endpoint-text",
              message: `Endpoint "${epName || epId}" in "${objName || objId}" has no structured text.`,
              ids: [objId, epId],
            });
          }
          if (!epPurpose.trim()) {
            findings.push({
              kind: "missing-endpoint-purpose",
              message: `Endpoint "${epName || epId}" in "${objName || objId}" has no purpose.`,
              ids: [objId, epId],
            });
          }
          if (!epLevel) {
            findings.push({
              kind: "missing-endpoint-level",
              message: `Endpoint "${epName || epId}" in "${objName || objId}" has no coded level.`,
              ids: [objId, epId],
            });
          }

          return {
            id: epId,
            objectiveId: objId,
            name: epName,
            text: epText,
            purpose: epPurpose,
            level: epLevel,
          };
        }
      );

      return {
        id: objId,
        name: objName,
        text: objText,
        level: objLevel,
        endpoints,
      };
    }
  );

  const criterionOrder = orderedChain(recordsOf(design.eligibilityCriteria));
  if (criterionOrder.broken) {
    findings.push({
      kind: "criterion-order",
      message:
        "Eligibility criteria previous and next links do not form one chain, so they are shown in file order.",
      ids: criterionOrder.items.map((item) => textOf(item.id)),
    });
  }

  const itemById = new Map<string, JsonRecord>(
    recordsOf(version.eligibilityCriterionItems).map((item) => [
      textOf(item.id),
      item,
    ])
  );

  const population =
    typeof design.population === "object" && design.population !== null
      ? (design.population as JsonRecord)
      : null;
  const populationCriterionIds =
    population && Array.isArray(population.criterionIds)
      ? new Set(population.criterionIds.map(textOf))
      : null;

  const criteria: StudyCriterionView[] = criterionOrder.items.map((crit) => {
    const id = textOf(crit.id);
    const name = textOf(crit.name);
    const identifier = textOf(crit.identifier);
    const category = termOf(crit.category);
    const criterionItemId = textOf(crit.criterionItemId);
    const item = criterionItemId ? itemById.get(criterionItemId) : undefined;
    const itemText = item ? textOf(item.text) : "";

    if (!category) {
      findings.push({
        kind: "missing-criterion-category",
        message: `Criterion "${name || id}" has no coded Inclusion or Exclusion category.`,
        ids: [id],
      });
    }
    if (!item) {
      findings.push({
        kind: "missing-criterion-item",
        message: `Criterion "${name || id}" references criterion item ${criterionItemId || "(empty)"}, which is missing from the study version.`,
        ids: criterionItemId ? [id, criterionItemId] : [id],
      });
    } else if (!itemText.trim()) {
      findings.push({
        kind: "missing-criterion-text",
        message: `Criterion "${name || id}" has empty criterion text.`,
        ids: [id, criterionItemId],
      });
    }
    if (populationCriterionIds && !populationCriterionIds.has(id)) {
      findings.push({
        kind: "unlisted-population-criterion",
        message: `Criterion "${name || id}" is not listed in the study population's criterionIds.`,
        ids: [id],
      });
    }

    return {
      id,
      name,
      identifier,
      category,
      criterionItemId,
      itemName: item ? textOf(item.name) : "",
      text: itemText,
      hasCriterionItem: Boolean(item),
    };
  });

  return {
    designId: textOf(design.id),
    objectives,
    endpointCount,
    criteria,
    findings,
  };
}

// Objectives

/** Adds a study objective with a CDISC Objective Level code. */
export function addStudyObjective(
  workspace: StudyWorkspace,
  input: NewStudyObjectiveInput
): StudyEdit {
  const name = cleanName(input.name, "objective");
  const level = findTerm(
    STUDY_OBJECTIVE_LEVELS,
    input.levelCode,
    "objective level"
  );
  const { pointer, design } = selectedDesign(workspace);
  const nextId = idMaker(workspace);
  const objective: JsonRecord = {
    id: nextId("Objective"),
    name,
    text: input.text.trim(),
    level: usdmCode(nextId("Code"), level),
    endpoints: [],
    instanceType: "Objective",
  };
  const patch: StudyPatchOperation[] = Array.isArray(design.objectives)
    ? [{ op: "add", path: `${pointer}/objectives/-`, value: objective }]
    : [{ op: "add", path: `${pointer}/objectives`, value: [objective] }];
  return createStudyEdit(workspace, patch, `Add objective "${name}"`);
}

/** Updates an objective's name, coded level, or structured text. */
export function updateStudyObjective(
  workspace: StudyWorkspace,
  objectiveId: string,
  changes: StudyObjectiveChanges
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const objectives = recordsOf(design.objectives);
  const index = objectives.findIndex((item) => item.id === objectiveId);
  if (index < 0) {
    throw new StudyDesignError(`The design has no objective ${objectiveId}.`);
  }
  const current = objectives[index];
  const nextId = idMaker(workspace);
  const patch: StudyPatchOperation[] = [];
  const basePath = `${pointer}/objectives/${index}`;

  let nextName = textOf(current.name);
  if (changes.name !== undefined) {
    nextName = cleanName(changes.name, "objective");
    patch.push({ op: "replace", path: `${basePath}/name`, value: nextName });
  }
  if (changes.text !== undefined) {
    patch.push({
      op: "replace",
      path: `${basePath}/text`,
      value: changes.text.trim(),
    });
  }
  if (changes.levelCode !== undefined) {
    const level = findTerm(
      STUDY_OBJECTIVE_LEVELS,
      changes.levelCode,
      "objective level"
    );
    const existingLevelId =
      typeof current.level === "object" && current.level !== null
        ? textOf((current.level as JsonRecord).id)
        : "";
    patch.push({
      op: "replace",
      path: `${basePath}/level`,
      value: usdmCode(existingLevelId || nextId("Code"), level),
    });
  }

  return createStudyEdit(workspace, patch, `Update objective "${nextName}"`);
}

/** Moves an objective to a new position in the study's objective list. */
export function moveStudyObjective(
  workspace: StudyWorkspace,
  objectiveId: string,
  toIndex: number
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const objectives = [...recordsOf(design.objectives)];
  const from = objectives.findIndex((item) => item.id === objectiveId);
  if (from < 0) {
    throw new StudyDesignError(`The design has no objective ${objectiveId}.`);
  }
  const to = clampIndex(toIndex, objectives.length - 1);
  const patch: StudyPatchOperation[] =
    from === to
      ? []
      : [
          { op: "remove", path: `${pointer}/objectives/${from}` },
          {
            op: "add",
            path: `${pointer}/objectives/${to}`,
            value: objectives[from],
          },
        ];
  return createStudyEdit(
    workspace,
    patch,
    `Move objective "${textOf(objectives[from].name)}"`
  );
}

/**
 * Removes an objective and its nested endpoints, refusing when an estimand
 * or other part of the study still references the objective or its endpoints.
 */
export function removeStudyObjective(
  workspace: StudyWorkspace,
  objectiveId: string
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const objectives = recordsOf(design.objectives);
  const index = objectives.findIndex((item) => item.id === objectiveId);
  if (index < 0) {
    throw new StudyDesignError(`The design has no objective ${objectiveId}.`);
  }
  const target = objectives[index];
  const endpointIds = recordsOf(target.endpoints).map((ep) => textOf(ep.id));
  return removal(
    workspace,
    [{ op: "remove", path: `${pointer}/objectives/${index}` }],
    [objectiveId, ...endpointIds],
    `Remove objective "${textOf(target.name)}"`
  );
}

// Endpoints

/** Adds a nested endpoint inside an objective with a CDISC Endpoint Level code. */
export function addStudyEndpoint(
  workspace: StudyWorkspace,
  input: NewStudyEndpointInput
): StudyEdit {
  const name = cleanName(input.name, "endpoint");
  const level = findTerm(
    STUDY_ENDPOINT_LEVELS,
    input.levelCode,
    "endpoint level"
  );
  const { pointer, design } = selectedDesign(workspace);
  const objectives = recordsOf(design.objectives);
  const objIndex = objectives.findIndex(
    (item) => item.id === input.objectiveId
  );
  if (objIndex < 0) {
    throw new StudyDesignError(
      `The design has no objective ${input.objectiveId}.`
    );
  }

  const nextId = idMaker(workspace);
  const endpoint: JsonRecord = {
    id: nextId("Endpoint"),
    name,
    text: input.text.trim(),
    purpose: input.purpose.trim(),
    level: usdmCode(nextId("Code"), level),
    instanceType: "Endpoint",
  };
  const basePath = `${pointer}/objectives/${objIndex}`;
  const patch: StudyPatchOperation[] = Array.isArray(
    objectives[objIndex].endpoints
  )
    ? [{ op: "add", path: `${basePath}/endpoints/-`, value: endpoint }]
    : [{ op: "add", path: `${basePath}/endpoints`, value: [endpoint] }];

  return createStudyEdit(workspace, patch, `Add endpoint "${name}"`);
}

/** Updates an endpoint's name, coded level, purpose, or structured text. */
export function updateStudyEndpoint(
  workspace: StudyWorkspace,
  changes: StudyEndpointChanges
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const objectives = recordsOf(design.objectives);
  const objIndex = objectives.findIndex(
    (item) => item.id === changes.objectiveId
  );
  if (objIndex < 0) {
    throw new StudyDesignError(
      `The design has no objective ${changes.objectiveId}.`
    );
  }
  const endpoints = recordsOf(objectives[objIndex].endpoints);
  const epIndex = endpoints.findIndex((item) => item.id === changes.endpointId);
  if (epIndex < 0) {
    throw new StudyDesignError(
      `Objective ${changes.objectiveId} has no endpoint ${changes.endpointId}.`
    );
  }

  const current = endpoints[epIndex];
  const nextId = idMaker(workspace);
  const basePath = `${pointer}/objectives/${objIndex}/endpoints/${epIndex}`;
  const patch: StudyPatchOperation[] = [];

  let nextName = textOf(current.name);
  if (changes.name !== undefined) {
    nextName = cleanName(changes.name, "endpoint");
    patch.push({ op: "replace", path: `${basePath}/name`, value: nextName });
  }
  if (changes.text !== undefined) {
    patch.push({
      op: "replace",
      path: `${basePath}/text`,
      value: changes.text.trim(),
    });
  }
  if (changes.purpose !== undefined) {
    patch.push({
      op: "replace",
      path: `${basePath}/purpose`,
      value: changes.purpose.trim(),
    });
  }
  if (changes.levelCode !== undefined) {
    const level = findTerm(
      STUDY_ENDPOINT_LEVELS,
      changes.levelCode,
      "endpoint level"
    );
    const existingLevelId =
      typeof current.level === "object" && current.level !== null
        ? textOf((current.level as JsonRecord).id)
        : "";
    patch.push({
      op: "replace",
      path: `${basePath}/level`,
      value: usdmCode(existingLevelId || nextId("Code"), level),
    });
  }

  return createStudyEdit(workspace, patch, `Update endpoint "${nextName}"`);
}

/** Moves an endpoint within its parent objective. */
export function moveStudyEndpoint(
  workspace: StudyWorkspace,
  input: {
    readonly objectiveId: string;
    readonly endpointId: string;
    readonly toIndex: number;
  }
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const objectives = recordsOf(design.objectives);
  const objIndex = objectives.findIndex(
    (item) => item.id === input.objectiveId
  );
  if (objIndex < 0) {
    throw new StudyDesignError(
      `The design has no objective ${input.objectiveId}.`
    );
  }
  const endpoints = [...recordsOf(objectives[objIndex].endpoints)];
  const from = endpoints.findIndex((item) => item.id === input.endpointId);
  if (from < 0) {
    throw new StudyDesignError(
      `Objective ${input.objectiveId} has no endpoint ${input.endpointId}.`
    );
  }
  const to = clampIndex(input.toIndex, endpoints.length - 1);
  const basePath = `${pointer}/objectives/${objIndex}/endpoints`;
  const patch: StudyPatchOperation[] =
    from === to
      ? []
      : [
          { op: "remove", path: `${basePath}/${from}` },
          { op: "add", path: `${basePath}/${to}`, value: endpoints[from] },
        ];
  return createStudyEdit(
    workspace,
    patch,
    `Move endpoint "${textOf(endpoints[from].name)}"`
  );
}

/**
 * Removes an endpoint from its objective, refusing when an estimand's
 * `variableOfInterestId` or another part of the study still references it.
 */
export function removeStudyEndpoint(
  workspace: StudyWorkspace,
  input: { readonly objectiveId: string; readonly endpointId: string }
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const objectives = recordsOf(design.objectives);
  const objIndex = objectives.findIndex(
    (item) => item.id === input.objectiveId
  );
  if (objIndex < 0) {
    throw new StudyDesignError(
      `The design has no objective ${input.objectiveId}.`
    );
  }
  const endpoints = recordsOf(objectives[objIndex].endpoints);
  const epIndex = endpoints.findIndex((item) => item.id === input.endpointId);
  if (epIndex < 0) {
    throw new StudyDesignError(
      `Objective ${input.objectiveId} has no endpoint ${input.endpointId}.`
    );
  }
  const target = endpoints[epIndex];
  return removal(
    workspace,
    [
      {
        op: "remove",
        path: `${pointer}/objectives/${objIndex}/endpoints/${epIndex}`,
      },
    ],
    [input.endpointId],
    `Remove endpoint "${textOf(target.name)}"`
  );
}

// Eligibility Criteria

function syncPopulationCriterionIdsPatch(
  pointer: string,
  design: JsonRecord,
  criteria: JsonRecord[]
): StudyPatchOperation[] {
  const population = design.population;
  if (typeof population !== "object" || population === null) return [];
  const ids = criteria.map((crit) => textOf(crit.id));
  const popRecord = population as JsonRecord;
  return Array.isArray(popRecord.criterionIds)
    ? [
        {
          op: "replace",
          path: `${pointer}/population/criterionIds`,
          value: ids,
        },
      ]
    : [{ op: "add", path: `${pointer}/population/criterionIds`, value: ids }];
}

/**
 * Adds an eligibility criterion to the selected design together with its
 * `EligibilityCriterionItem` on the study version and updates `population.criterionIds`.
 */
export function addStudyCriterion(
  workspace: StudyWorkspace,
  input: NewStudyCriterionInput
): StudyEdit {
  const name = cleanName(input.name, "eligibility criterion");
  const identifier = cleanName(input.identifier, "criterion identifier");
  const category = findTerm(
    STUDY_CRITERION_CATEGORIES,
    input.categoryCode,
    "criterion category"
  );

  const { versionPointer, version, pointer, design } =
    selectedDesign(workspace);
  const nextId = idMaker(workspace);
  const itemId = nextId("EligibilityCriterionItem");
  const criterionId = nextId("EligibilityCriterion");

  const item: JsonRecord = {
    id: itemId,
    name: input.itemName?.trim() || name,
    text: input.text.trim(),
    instanceType: "EligibilityCriterionItem",
  };

  const criterion: JsonRecord = {
    id: criterionId,
    name,
    identifier,
    category: usdmCode(nextId("Code"), category),
    criterionItemId: itemId,
    instanceType: "EligibilityCriterion",
  };

  const ordered = [
    ...orderedChain(recordsOf(design.eligibilityCriteria)).items,
    criterion,
  ];
  const relinked = relinkCriteria(ordered);

  const patch: StudyPatchOperation[] = [
    Array.isArray(version.eligibilityCriterionItems)
      ? {
          op: "add",
          path: `${versionPointer}/eligibilityCriterionItems/-`,
          value: item,
        }
      : {
          op: "add",
          path: `${versionPointer}/eligibilityCriterionItems`,
          value: [item],
        },
    Array.isArray(design.eligibilityCriteria)
      ? {
          op: "replace",
          path: `${pointer}/eligibilityCriteria`,
          value: relinked,
        }
      : { op: "add", path: `${pointer}/eligibilityCriteria`, value: relinked },
    ...syncPopulationCriterionIdsPatch(pointer, design, relinked),
  ];

  return createStudyEdit(workspace, patch, `Add criterion "${name}"`);
}

/**
 * Updates an eligibility criterion's name, identifier, Inclusion/Exclusion
 * category, or structured criterion item text (creating a missing item when
 * repairing an incomplete criterion).
 */
export function updateStudyCriterion(
  workspace: StudyWorkspace,
  criterionId: string,
  changes: StudyCriterionChanges
): StudyEdit {
  const { versionPointer, version, pointer, design } =
    selectedDesign(workspace);
  const criteria = recordsOf(design.eligibilityCriteria);
  const index = criteria.findIndex((item) => item.id === criterionId);
  if (index < 0) {
    throw new StudyDesignError(`The design has no criterion ${criterionId}.`);
  }
  const current = criteria[index];
  const nextId = idMaker(workspace);
  const basePath = `${pointer}/eligibilityCriteria/${index}`;
  const patch: StudyPatchOperation[] = [];

  let nextName = textOf(current.name);
  if (changes.name !== undefined) {
    nextName = cleanName(changes.name, "eligibility criterion");
    patch.push({ op: "replace", path: `${basePath}/name`, value: nextName });
  }
  if (changes.identifier !== undefined) {
    const cleanIdent = cleanName(changes.identifier, "criterion identifier");
    patch.push({
      op: "replace",
      path: `${basePath}/identifier`,
      value: cleanIdent,
    });
  }
  if (changes.categoryCode !== undefined) {
    const category = findTerm(
      STUDY_CRITERION_CATEGORIES,
      changes.categoryCode,
      "criterion category"
    );
    const existingCatId =
      typeof current.category === "object" && current.category !== null
        ? textOf((current.category as JsonRecord).id)
        : "";
    patch.push({
      op: "replace",
      path: `${basePath}/category`,
      value: usdmCode(existingCatId || nextId("Code"), category),
    });
  }

  if (changes.text !== undefined || changes.itemName !== undefined) {
    const items = recordsOf(version.eligibilityCriterionItems);
    const currentItemId = textOf(current.criterionItemId);
    const itemIndex = items.findIndex((item) => item.id === currentItemId);
    if (itemIndex >= 0) {
      if (changes.text !== undefined) {
        patch.push({
          op: "replace",
          path: `${versionPointer}/eligibilityCriterionItems/${itemIndex}/text`,
          value: changes.text.trim(),
        });
      }
      if (changes.itemName !== undefined) {
        const cleanItemName = cleanName(changes.itemName, "criterion item");
        patch.push({
          op: "replace",
          path: `${versionPointer}/eligibilityCriterionItems/${itemIndex}/name`,
          value: cleanItemName,
        });
      }
    } else {
      const repairedId = currentItemId || nextId("EligibilityCriterionItem");
      const createdItem: JsonRecord = {
        id: repairedId,
        name: changes.itemName?.trim() || nextName,
        text: (changes.text ?? "").trim(),
        instanceType: "EligibilityCriterionItem",
      };
      patch.push(
        Array.isArray(version.eligibilityCriterionItems)
          ? {
              op: "add",
              path: `${versionPointer}/eligibilityCriterionItems/-`,
              value: createdItem,
            }
          : {
              op: "add",
              path: `${versionPointer}/eligibilityCriterionItems`,
              value: [createdItem],
            }
      );
      if (!currentItemId) {
        patch.push({
          op: "replace",
          path: `${basePath}/criterionItemId`,
          value: repairedId,
        });
      }
    }
  }

  return createStudyEdit(workspace, patch, `Update criterion "${nextName}"`);
}

/** Moves an eligibility criterion to a new position in the criterion chain. */
export function moveStudyCriterion(
  workspace: StudyWorkspace,
  criterionId: string,
  toIndex: number
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const ordered = [
    ...orderedChain(recordsOf(design.eligibilityCriteria)).items,
  ];
  const from = ordered.findIndex((item) => item.id === criterionId);
  if (from < 0) {
    throw new StudyDesignError(`The design has no criterion ${criterionId}.`);
  }
  const [moved] = ordered.splice(from, 1);
  ordered.splice(clampIndex(toIndex, ordered.length), 0, moved);
  const relinked = relinkCriteria(ordered);

  return createStudyEdit(
    workspace,
    [
      {
        op: "replace",
        path: `${pointer}/eligibilityCriteria`,
        value: relinked,
      },
      ...syncPopulationCriterionIdsPatch(pointer, design, relinked),
    ],
    `Move criterion "${textOf(moved.name)}"`
  );
}

/**
 * Removes an eligibility criterion and (when unshared) its criterion text
 * item, relinking the remaining criteria and `population.criterionIds`.
 */
export function removeStudyCriterion(
  workspace: StudyWorkspace,
  criterionId: string
): StudyEdit {
  const { versionPointer, version, pointer, design } =
    selectedDesign(workspace);
  const ordered = orderedChain(recordsOf(design.eligibilityCriteria)).items;
  const target = ordered.find((item) => item.id === criterionId);
  if (!target) {
    throw new StudyDesignError(`The design has no criterion ${criterionId}.`);
  }
  const rest = ordered.filter((item) => item.id !== criterionId);
  const relinked = relinkCriteria(rest);

  const patch: StudyPatchOperation[] = [
    { op: "replace", path: `${pointer}/eligibilityCriteria`, value: relinked },
    ...syncPopulationCriterionIdsPatch(pointer, design, relinked),
  ];
  const removedIds: string[] = [criterionId];

  const itemId = textOf(target.criterionItemId);
  const sharedItem = rest.some(
    (item) => textOf(item.criterionItemId) === itemId
  );
  if (itemId && !sharedItem) {
    const items = recordsOf(version.eligibilityCriterionItems);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0) {
      patch.push({
        op: "remove",
        path: `${versionPointer}/eligibilityCriterionItems/${itemIndex}`,
      });
      removedIds.push(itemId);
    }
  }

  return removal(
    workspace,
    patch,
    removedIds,
    `Remove criterion "${textOf(target.name)}"`
  );
}
