import type {
  StudyAnalysisEndpointOption,
  StudyAnalysisFinding,
  StudyAnalysisIntentView,
  StudyAnalysisInterventionOption,
  StudyAnalysisPopulationView,
  StudyEdit,
  StudyEstimandView,
  StudyIntercurrentEventView,
  StudyPatchOperation,
  StudyWorkspace,
} from "../types";
import {
  StudyDesignError,
  recordsOf,
  selectedDesign,
  termOf,
  textOf,
  type JsonRecord,
} from "./design-grid";
import { cleanName, idMaker, removal } from "./design-ops";
import { createStudyEdit } from "./ops";

/** Input for adding an analysis population to the selected design. */
export interface NewStudyAnalysisPopulationInput {
  readonly name: string;
  readonly label?: string;
  readonly text: string;
  readonly subsetOfIds?: readonly string[];
}

/** Changes to apply to an existing analysis population. */
export interface StudyAnalysisPopulationChanges {
  readonly name?: string;
  readonly label?: string;
  readonly text?: string;
  readonly subsetOfIds?: readonly string[];
}

/** Input for adding an ICH E9(R1) estimand to the selected design. */
export interface NewStudyEstimandInput {
  readonly name: string;
  readonly description?: string;
  readonly populationSummary: string;
  readonly analysisPopulationId: string;
  readonly variableOfInterestId: string;
  readonly interventionIds: readonly string[];
  readonly intercurrentEvents?: readonly {
    readonly name: string;
    readonly text: string;
    readonly strategy: string;
  }[];
}

/** Changes to apply to an existing estimand. */
export interface StudyEstimandChanges {
  readonly name?: string;
  readonly description?: string;
  readonly populationSummary?: string;
  readonly analysisPopulationId?: string;
  readonly variableOfInterestId?: string;
  readonly interventionIds?: readonly string[];
}

/** Input for adding an intercurrent event and handling strategy to an estimand. */
export interface NewStudyIntercurrentEventInput {
  readonly estimandId: string;
  readonly name: string;
  readonly text: string;
  readonly strategy: string;
}

/** Changes to apply to an existing intercurrent event on an estimand. */
export interface StudyIntercurrentEventChanges {
  readonly estimandId: string;
  readonly eventId: string;
  readonly name?: string;
  readonly text?: string;
  readonly strategy?: string;
}

function clampIndex(index: number, length: number): number {
  const whole = Math.trunc(index);
  if (whole < 0) return 0;
  return whole > length ? length : whole;
}

function collectAvailableEndpoints(
  design: JsonRecord
): StudyAnalysisEndpointOption[] {
  const options: StudyAnalysisEndpointOption[] = [];
  for (const obj of recordsOf(design.objectives)) {
    const objectiveId = textOf(obj.id);
    const objectiveName = textOf(obj.name);
    for (const ep of recordsOf(obj.endpoints)) {
      options.push({
        id: textOf(ep.id),
        objectiveId,
        objectiveName,
        name: textOf(ep.name),
        text: textOf(ep.text),
        level: termOf(ep.level),
      });
    }
  }
  return options;
}

function collectAvailableInterventions(
  version: JsonRecord,
  design: JsonRecord
): StudyAnalysisInterventionOption[] {
  const designUsedIds = new Set<string>();
  if (Array.isArray(design.studyInterventionIds)) {
    for (const id of design.studyInterventionIds) designUsedIds.add(textOf(id));
  }
  for (const el of recordsOf(design.elements)) {
    if (Array.isArray(el.studyInterventionIds)) {
      for (const id of el.studyInterventionIds) designUsedIds.add(textOf(id));
    }
  }

  const all = recordsOf(version.studyInterventions);
  const filtered =
    designUsedIds.size > 0
      ? [
          ...all.filter((item) => designUsedIds.has(textOf(item.id))),
          ...all.filter((item) => !designUsedIds.has(textOf(item.id))),
        ]
      : all;

  return filtered.map((item) => ({
    id: textOf(item.id),
    name: textOf(item.name),
    role: termOf(item.role),
  }));
}

/**
 * Projects ICH E9(R1) estimands, analysis populations, and link catalogs from
 * the selected design and version without touching `workspace.analyses`,
 * surfacing explicit findings when target endpoint, population, or
 * intervention links are missing or broken.
 */
export function projectStudyAnalysisIntent(
  workspace: StudyWorkspace
): StudyAnalysisIntentView {
  const { version, design } = selectedDesign(workspace);
  const findings: StudyAnalysisFinding[] = [];

  const availableEndpoints = collectAvailableEndpoints(design);
  const endpointById = new Map(availableEndpoints.map((ep) => [ep.id, ep]));

  const availableInterventions = collectAvailableInterventions(version, design);
  const interventionById = new Map(
    availableInterventions.map((item) => [item.id, item])
  );

  const analysisPopulations: StudyAnalysisPopulationView[] = recordsOf(
    design.analysisPopulations
  ).map((pop) => ({
    id: textOf(pop.id),
    name: textOf(pop.name),
    label: textOf(pop.label),
    text: textOf(pop.text),
    subsetOfIds: Array.isArray(pop.subsetOfIds)
      ? pop.subsetOfIds.map(textOf).filter(Boolean)
      : [],
  }));
  const populationById = new Map(
    analysisPopulations.map((pop) => [pop.id, pop])
  );

  for (const pop of analysisPopulations) {
    for (const subsetId of pop.subsetOfIds) {
      if (!populationById.has(subsetId)) {
        findings.push({
          kind: "unknown-population-subset",
          message: `Analysis population "${pop.name || pop.id}" names subset population ${subsetId}, which the design does not have.`,
          ids: [pop.id, subsetId],
        });
      }
    }
  }

  const estimands: StudyEstimandView[] = recordsOf(design.estimands).map(
    (est) => {
      const id = textOf(est.id);
      const name = textOf(est.name);
      const description = textOf(est.description);
      const populationSummary = textOf(est.populationSummary);
      const analysisPopulationId = textOf(est.analysisPopulationId);
      const variableOfInterestId = textOf(est.variableOfInterestId);
      const interventionIds = Array.isArray(est.interventionIds)
        ? est.interventionIds.map(textOf).filter(Boolean)
        : [];

      const population = analysisPopulationId
        ? populationById.get(analysisPopulationId)
        : undefined;
      const endpoint = variableOfInterestId
        ? endpointById.get(variableOfInterestId)
        : undefined;

      if (!endpoint) {
        findings.push({
          kind: "missing-endpoint-link",
          message: variableOfInterestId
            ? `Estimand "${name || id}" targets endpoint ${variableOfInterestId}, which is missing from the study's objectives.`
            : `Estimand "${name || id}" has no target endpoint link.`,
          ids: variableOfInterestId ? [id, variableOfInterestId] : [id],
        });
      }

      if (!population) {
        findings.push({
          kind: "missing-population-link",
          message: analysisPopulationId
            ? `Estimand "${name || id}" references analysis population ${analysisPopulationId}, which the design does not have.`
            : `Estimand "${name || id}" has no analysis population link.`,
          ids: analysisPopulationId ? [id, analysisPopulationId] : [id],
        });
      }

      if (interventionIds.length === 0) {
        findings.push({
          kind: "missing-intervention-link",
          message: `Estimand "${name || id}" links no study interventions.`,
          ids: [id],
        });
      } else {
        for (const intId of interventionIds) {
          if (!interventionById.has(intId)) {
            findings.push({
              kind: "unknown-intervention-link",
              message: `Estimand "${name || id}" links intervention ${intId}, which the study version does not have.`,
              ids: [id, intId],
            });
          }
        }
      }

      if (!populationSummary.trim()) {
        findings.push({
          kind: "missing-population-summary",
          message: `Estimand "${name || id}" has no population-level summary measure.`,
          ids: [id],
        });
      }

      const intercurrentEvents: StudyIntercurrentEventView[] = recordsOf(
        est.intercurrentEvents
      ).map((ice) => {
        const iceId = textOf(ice.id);
        const iceName = textOf(ice.name);
        const iceText = textOf(ice.text);
        const strategy = textOf(ice.strategy);
        if (!iceText.trim() || !strategy.trim()) {
          findings.push({
            kind: "missing-intercurrent-event-details",
            message: `Intercurrent event "${iceName || iceId}" on "${name || id}" is missing its description or strategy.`,
            ids: [id, iceId],
          });
        }
        return {
          id: iceId,
          estimandId: id,
          name: iceName,
          text: iceText,
          strategy,
        };
      });

      if (intercurrentEvents.length === 0) {
        findings.push({
          kind: "missing-intercurrent-events",
          message: `Estimand "${name || id}" defines no intercurrent events.`,
          ids: [id],
        });
      }

      return {
        id,
        name,
        description,
        populationSummary,
        analysisPopulationId,
        analysisPopulationName: population?.name ?? null,
        variableOfInterestId,
        endpointName: endpoint?.name ?? null,
        interventionIds,
        intercurrentEvents,
      };
    }
  );

  return {
    designId: textOf(design.id),
    estimands,
    analysisPopulations,
    availableEndpoints,
    availableInterventions,
    findings,
  };
}

// Analysis Populations

/** Adds an analysis population to the selected study design. */
export function addStudyAnalysisPopulation(
  workspace: StudyWorkspace,
  input: NewStudyAnalysisPopulationInput
): StudyEdit {
  const name = cleanName(input.name, "analysis population");
  const { pointer, design } = selectedDesign(workspace);
  const existingIds = new Set(
    recordsOf(design.analysisPopulations).map((pop) => textOf(pop.id))
  );
  const subsetOfIds = [...new Set(input.subsetOfIds ?? [])];
  for (const subsetId of subsetOfIds) {
    if (!existingIds.has(subsetId)) {
      throw new StudyDesignError(
        `The design has no analysis population ${subsetId}.`
      );
    }
  }

  const nextId = idMaker(workspace);
  const population: JsonRecord = {
    id: nextId("AnalysisPopulation"),
    name,
    label: input.label?.trim() ? input.label.trim() : null,
    text: input.text.trim(),
    subsetOfIds,
    instanceType: "AnalysisPopulation",
  };
  const patch: StudyPatchOperation[] = Array.isArray(design.analysisPopulations)
    ? [
        {
          op: "add",
          path: `${pointer}/analysisPopulations/-`,
          value: population,
        },
      ]
    : [
        {
          op: "add",
          path: `${pointer}/analysisPopulations`,
          value: [population],
        },
      ];
  return createStudyEdit(workspace, patch, `Add analysis population "${name}"`);
}

/** Updates an analysis population's name, label, definition text, or subsets. */
export function updateStudyAnalysisPopulation(
  workspace: StudyWorkspace,
  populationId: string,
  changes: StudyAnalysisPopulationChanges
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const populations = recordsOf(design.analysisPopulations);
  const index = populations.findIndex((item) => item.id === populationId);
  if (index < 0) {
    throw new StudyDesignError(
      `The design has no analysis population ${populationId}.`
    );
  }
  const current = populations[index];
  const basePath = `${pointer}/analysisPopulations/${index}`;
  const patch: StudyPatchOperation[] = [];

  let nextName = textOf(current.name);
  if (changes.name !== undefined) {
    nextName = cleanName(changes.name, "analysis population");
    patch.push({ op: "replace", path: `${basePath}/name`, value: nextName });
  }
  if (changes.label !== undefined) {
    const trimmed = changes.label.trim();
    patch.push(
      current.label === undefined
        ? { op: "add", path: `${basePath}/label`, value: trimmed || null }
        : { op: "replace", path: `${basePath}/label`, value: trimmed || null }
    );
  }
  if (changes.text !== undefined) {
    patch.push({
      op: "replace",
      path: `${basePath}/text`,
      value: changes.text.trim(),
    });
  }
  if (changes.subsetOfIds !== undefined) {
    const existingIds = new Set(populations.map((pop) => textOf(pop.id)));
    const deduped = [...new Set(changes.subsetOfIds)].filter(
      (id) => id !== populationId
    );
    for (const subsetId of deduped) {
      if (!existingIds.has(subsetId)) {
        throw new StudyDesignError(
          `The design has no analysis population ${subsetId}.`
        );
      }
    }
    patch.push(
      Array.isArray(current.subsetOfIds)
        ? { op: "replace", path: `${basePath}/subsetOfIds`, value: deduped }
        : { op: "add", path: `${basePath}/subsetOfIds`, value: deduped }
    );
  }

  return createStudyEdit(
    workspace,
    patch,
    `Update analysis population "${nextName}"`
  );
}

/**
 * Removes an analysis population, refusing when an estimand or another
 * population's `subsetOfIds` still references it.
 */
export function removeStudyAnalysisPopulation(
  workspace: StudyWorkspace,
  populationId: string
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const populations = recordsOf(design.analysisPopulations);
  const index = populations.findIndex((item) => item.id === populationId);
  if (index < 0) {
    throw new StudyDesignError(
      `The design has no analysis population ${populationId}.`
    );
  }
  const target = populations[index];
  return removal(
    workspace,
    [{ op: "remove", path: `${pointer}/analysisPopulations/${index}` }],
    [populationId],
    `Remove analysis population "${textOf(target.name)}"`
  );
}

// Estimands & Intercurrent Events

function verifyEstimandLinks(
  version: JsonRecord,
  design: JsonRecord,
  links: {
    analysisPopulationId?: string;
    variableOfInterestId?: string;
    interventionIds?: readonly string[];
  }
): void {
  if (links.analysisPopulationId !== undefined) {
    const exists = recordsOf(design.analysisPopulations).some(
      (pop) => pop.id === links.analysisPopulationId
    );
    if (!exists) {
      throw new StudyDesignError(
        `The design has no analysis population ${links.analysisPopulationId}.`
      );
    }
  }
  if (links.variableOfInterestId !== undefined) {
    const endpointIds = new Set(
      collectAvailableEndpoints(design).map((ep) => ep.id)
    );
    if (!endpointIds.has(links.variableOfInterestId)) {
      throw new StudyDesignError(
        `The design has no endpoint ${links.variableOfInterestId}.`
      );
    }
  }
  if (links.interventionIds !== undefined) {
    const knownInterventions = new Set(
      recordsOf(version.studyInterventions).map((item) => textOf(item.id))
    );
    for (const intId of links.interventionIds) {
      if (!knownInterventions.has(intId)) {
        throw new StudyDesignError(
          `The study version has no intervention ${intId}.`
        );
      }
    }
  }
}

/** Adds an ICH E9(R1) estimand to the selected study design. */
export function addStudyEstimand(
  workspace: StudyWorkspace,
  input: NewStudyEstimandInput
): StudyEdit {
  const name = cleanName(input.name, "estimand");
  const { version, pointer, design } = selectedDesign(workspace);
  verifyEstimandLinks(version, design, {
    analysisPopulationId: input.analysisPopulationId,
    variableOfInterestId: input.variableOfInterestId,
    interventionIds: input.interventionIds,
  });

  const nextId = idMaker(workspace);
  const intercurrentEvents: JsonRecord[] = (input.intercurrentEvents ?? []).map(
    (ice) => ({
      id: nextId("IntercurrentEvent"),
      name: cleanName(ice.name, "intercurrent event"),
      text: ice.text.trim(),
      strategy: cleanName(ice.strategy, "intercurrent event strategy"),
      instanceType: "IntercurrentEvent",
    })
  );

  const estimand: JsonRecord = {
    id: nextId("Estimand"),
    name,
    description: input.description?.trim() ? input.description.trim() : null,
    populationSummary: input.populationSummary.trim(),
    analysisPopulationId: input.analysisPopulationId,
    interventionIds: [...new Set(input.interventionIds)],
    variableOfInterestId: input.variableOfInterestId,
    intercurrentEvents,
    instanceType: "Estimand",
  };

  const patch: StudyPatchOperation[] = Array.isArray(design.estimands)
    ? [{ op: "add", path: `${pointer}/estimands/-`, value: estimand }]
    : [{ op: "add", path: `${pointer}/estimands`, value: [estimand] }];
  return createStudyEdit(workspace, patch, `Add estimand "${name}"`);
}

/** Updates an estimand's attributes, target endpoint, population, or interventions. */
export function updateStudyEstimand(
  workspace: StudyWorkspace,
  estimandId: string,
  changes: StudyEstimandChanges
): StudyEdit {
  const { version, pointer, design } = selectedDesign(workspace);
  const estimands = recordsOf(design.estimands);
  const index = estimands.findIndex((item) => item.id === estimandId);
  if (index < 0) {
    throw new StudyDesignError(`The design has no estimand ${estimandId}.`);
  }
  verifyEstimandLinks(version, design, {
    analysisPopulationId: changes.analysisPopulationId,
    variableOfInterestId: changes.variableOfInterestId,
    interventionIds: changes.interventionIds,
  });

  const current = estimands[index];
  const basePath = `${pointer}/estimands/${index}`;
  const patch: StudyPatchOperation[] = [];

  let nextName = textOf(current.name);
  if (changes.name !== undefined) {
    nextName = cleanName(changes.name, "estimand");
    patch.push({ op: "replace", path: `${basePath}/name`, value: nextName });
  }
  if (changes.description !== undefined) {
    const trimmed = changes.description.trim();
    patch.push(
      current.description === undefined
        ? { op: "add", path: `${basePath}/description`, value: trimmed || null }
        : {
            op: "replace",
            path: `${basePath}/description`,
            value: trimmed || null,
          }
    );
  }
  if (changes.populationSummary !== undefined) {
    patch.push({
      op: "replace",
      path: `${basePath}/populationSummary`,
      value: changes.populationSummary.trim(),
    });
  }
  if (changes.analysisPopulationId !== undefined) {
    patch.push({
      op: "replace",
      path: `${basePath}/analysisPopulationId`,
      value: changes.analysisPopulationId,
    });
  }
  if (changes.variableOfInterestId !== undefined) {
    patch.push({
      op: "replace",
      path: `${basePath}/variableOfInterestId`,
      value: changes.variableOfInterestId,
    });
  }
  if (changes.interventionIds !== undefined) {
    patch.push({
      op: "replace",
      path: `${basePath}/interventionIds`,
      value: [...new Set(changes.interventionIds)],
    });
  }

  return createStudyEdit(workspace, patch, `Update estimand "${nextName}"`);
}

/** Moves an estimand to a new position in the design's estimands list. */
export function moveStudyEstimand(
  workspace: StudyWorkspace,
  estimandId: string,
  toIndex: number
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const estimands = [...recordsOf(design.estimands)];
  const from = estimands.findIndex((item) => item.id === estimandId);
  if (from < 0) {
    throw new StudyDesignError(`The design has no estimand ${estimandId}.`);
  }
  const to = clampIndex(toIndex, estimands.length - 1);
  const patch: StudyPatchOperation[] =
    from === to
      ? []
      : [
          { op: "remove", path: `${pointer}/estimands/${from}` },
          {
            op: "add",
            path: `${pointer}/estimands/${to}`,
            value: estimands[from],
          },
        ];
  return createStudyEdit(
    workspace,
    patch,
    `Move estimand "${textOf(estimands[from].name)}"`
  );
}

/** Removes an estimand and its intercurrent events, refusing if referenced elsewhere. */
export function removeStudyEstimand(
  workspace: StudyWorkspace,
  estimandId: string
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const estimands = recordsOf(design.estimands);
  const index = estimands.findIndex((item) => item.id === estimandId);
  if (index < 0) {
    throw new StudyDesignError(`The design has no estimand ${estimandId}.`);
  }
  const target = estimands[index];
  const eventIds = recordsOf(target.intercurrentEvents).map((ev) =>
    textOf(ev.id)
  );
  return removal(
    workspace,
    [{ op: "remove", path: `${pointer}/estimands/${index}` }],
    [estimandId, ...eventIds],
    `Remove estimand "${textOf(target.name)}"`
  );
}

/** Adds an intercurrent event and strategy to an estimand. */
export function addStudyIntercurrentEvent(
  workspace: StudyWorkspace,
  input: NewStudyIntercurrentEventInput
): StudyEdit {
  const name = cleanName(input.name, "intercurrent event");
  const strategy = cleanName(input.strategy, "intercurrent event strategy");
  const { pointer, design } = selectedDesign(workspace);
  const estimands = recordsOf(design.estimands);
  const estIndex = estimands.findIndex((item) => item.id === input.estimandId);
  if (estIndex < 0) {
    throw new StudyDesignError(
      `The design has no estimand ${input.estimandId}.`
    );
  }

  const nextId = idMaker(workspace);
  const event: JsonRecord = {
    id: nextId("IntercurrentEvent"),
    name,
    text: input.text.trim(),
    strategy,
    instanceType: "IntercurrentEvent",
  };
  const basePath = `${pointer}/estimands/${estIndex}`;
  const patch: StudyPatchOperation[] = Array.isArray(
    estimands[estIndex].intercurrentEvents
  )
    ? [{ op: "add", path: `${basePath}/intercurrentEvents/-`, value: event }]
    : [{ op: "add", path: `${basePath}/intercurrentEvents`, value: [event] }];
  return createStudyEdit(workspace, patch, `Add intercurrent event "${name}"`);
}

/** Updates an intercurrent event's name, text, or handling strategy. */
export function updateStudyIntercurrentEvent(
  workspace: StudyWorkspace,
  changes: StudyIntercurrentEventChanges
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const estimands = recordsOf(design.estimands);
  const estIndex = estimands.findIndex(
    (item) => item.id === changes.estimandId
  );
  if (estIndex < 0) {
    throw new StudyDesignError(
      `The design has no estimand ${changes.estimandId}.`
    );
  }
  const events = recordsOf(estimands[estIndex].intercurrentEvents);
  const evIndex = events.findIndex((item) => item.id === changes.eventId);
  if (evIndex < 0) {
    throw new StudyDesignError(
      `Estimand ${changes.estimandId} has no intercurrent event ${changes.eventId}.`
    );
  }

  const current = events[evIndex];
  const basePath = `${pointer}/estimands/${estIndex}/intercurrentEvents/${evIndex}`;
  const patch: StudyPatchOperation[] = [];

  let nextName = textOf(current.name);
  if (changes.name !== undefined) {
    nextName = cleanName(changes.name, "intercurrent event");
    patch.push({ op: "replace", path: `${basePath}/name`, value: nextName });
  }
  if (changes.text !== undefined) {
    patch.push({
      op: "replace",
      path: `${basePath}/text`,
      value: changes.text.trim(),
    });
  }
  if (changes.strategy !== undefined) {
    const cleanStrat = cleanName(
      changes.strategy,
      "intercurrent event strategy"
    );
    patch.push({
      op: "replace",
      path: `${basePath}/strategy`,
      value: cleanStrat,
    });
  }

  return createStudyEdit(
    workspace,
    patch,
    `Update intercurrent event "${nextName}"`
  );
}

/** Moves an intercurrent event within its parent estimand. */
export function moveStudyIntercurrentEvent(
  workspace: StudyWorkspace,
  input: {
    readonly estimandId: string;
    readonly eventId: string;
    readonly toIndex: number;
  }
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const estimands = recordsOf(design.estimands);
  const estIndex = estimands.findIndex((item) => item.id === input.estimandId);
  if (estIndex < 0) {
    throw new StudyDesignError(
      `The design has no estimand ${input.estimandId}.`
    );
  }
  const events = [...recordsOf(estimands[estIndex].intercurrentEvents)];
  const from = events.findIndex((item) => item.id === input.eventId);
  if (from < 0) {
    throw new StudyDesignError(
      `Estimand ${input.estimandId} has no intercurrent event ${input.eventId}.`
    );
  }
  const to = clampIndex(input.toIndex, events.length - 1);
  const basePath = `${pointer}/estimands/${estIndex}/intercurrentEvents`;
  const patch: StudyPatchOperation[] =
    from === to
      ? []
      : [
          { op: "remove", path: `${basePath}/${from}` },
          { op: "add", path: `${basePath}/${to}`, value: events[from] },
        ];
  return createStudyEdit(
    workspace,
    patch,
    `Move intercurrent event "${textOf(events[from].name)}"`
  );
}

/** Removes an intercurrent event from its estimand. */
export function removeStudyIntercurrentEvent(
  workspace: StudyWorkspace,
  input: { readonly estimandId: string; readonly eventId: string }
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const estimands = recordsOf(design.estimands);
  const estIndex = estimands.findIndex((item) => item.id === input.estimandId);
  if (estIndex < 0) {
    throw new StudyDesignError(
      `The design has no estimand ${input.estimandId}.`
    );
  }
  const events = recordsOf(estimands[estIndex].intercurrentEvents);
  const evIndex = events.findIndex((item) => item.id === input.eventId);
  if (evIndex < 0) {
    throw new StudyDesignError(
      `Estimand ${input.estimandId} has no intercurrent event ${input.eventId}.`
    );
  }
  const target = events[evIndex];
  return removal(
    workspace,
    [
      {
        op: "remove",
        path: `${pointer}/estimands/${estIndex}/intercurrentEvents/${evIndex}`,
      },
    ],
    [input.eventId],
    `Remove intercurrent event "${textOf(target.name)}"`
  );
}
