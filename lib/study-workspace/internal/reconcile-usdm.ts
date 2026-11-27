import {
  CRF_STUDIO_USDM_EXTENSION_URL_PREFIX,
  USDM_SDTM_DOMAIN_EXTENSION_URL,
  usdmContentHash,
  type UsdmV4Activity,
  type UsdmV4BiomedicalConcept,
  type UsdmV4Document,
  type UsdmV4EligibilityCriterionItem,
  type UsdmV4Encounter,
  type UsdmV4ExtensionAttribute,
  type UsdmV4InterventionalStudyDesign,
  type UsdmV4Objective,
  type UsdmV4ScheduleTimeline,
  type UsdmV4StudyArm,
  type UsdmV4StudyCell,
  type UsdmV4StudyCohort,
  type UsdmV4StudyDesignPopulation,
  type UsdmV4StudyElement,
  type UsdmV4StudyEpoch,
  type UsdmV4StudyIntervention,
  type UsdmV4StudyVersion,
} from "@/lib/clinical-standards";
import type { ReconcileUsdmStudyOptions, StudyWorkspace } from "../types";
import { commitStudyRevision } from "./revision";

function isCrfManagedExtension(
  attr: UsdmV4ExtensionAttribute,
  includeSdtmDomain = false
): boolean {
  if (attr.url.startsWith(CRF_STUDIO_USDM_EXTENSION_URL_PREFIX)) return true;
  if (includeSdtmDomain && attr.url === USDM_SDTM_DOMAIN_EXTENSION_URL) {
    return true;
  }
  return false;
}

/**
 * Keeps all non-CRF `extensionAttributes` from `existing` in order and
 * splices in the CRF-managed `extensionAttributes` from `incoming`.
 */
function mergeExtensionAttributes(
  existing: readonly UsdmV4ExtensionAttribute[] | undefined,
  incoming: readonly UsdmV4ExtensionAttribute[] | undefined,
  options: { readonly includeSdtmDomain?: boolean } = {}
): UsdmV4ExtensionAttribute[] | undefined {
  const includeSdtm = options.includeSdtmDomain ?? false;
  const preserved = (existing ?? [])
    .filter((attr) => !isCrfManagedExtension(attr, includeSdtm))
    .map((attr) => structuredClone(attr));
  const managed = (incoming ?? [])
    .filter((attr) => isCrfManagedExtension(attr, includeSdtm))
    .map((attr) => structuredClone(attr));
  const combined = [...preserved, ...managed];
  if (combined.length === 0) {
    return existing === undefined && incoming === undefined ? undefined : [];
  }
  return combined;
}

function mergeArms(
  existingArms: readonly UsdmV4StudyArm[],
  incomingArms: readonly UsdmV4StudyArm[]
): UsdmV4StudyArm[] {
  const byId = new Map(existingArms.map((arm) => [arm.id, arm]));
  return incomingArms.map((incoming) => {
    const prev = byId.get(incoming.id);
    if (!prev) return structuredClone(incoming);
    const ext = mergeExtensionAttributes(
      prev.extensionAttributes,
      incoming.extensionAttributes
    );
    return {
      ...structuredClone(prev),
      name: incoming.name,
      description: incoming.description,
      type: structuredClone(incoming.type),
      ...(ext !== undefined ? { extensionAttributes: ext } : {}),
    };
  });
}

function mergeEpochs(
  existingEpochs: readonly UsdmV4StudyEpoch[],
  incomingEpochs: readonly UsdmV4StudyEpoch[]
): UsdmV4StudyEpoch[] {
  const byId = new Map(existingEpochs.map((epoch) => [epoch.id, epoch]));
  return incomingEpochs.map((incoming) => {
    const prev = byId.get(incoming.id);
    if (!prev) return structuredClone(incoming);
    const ext = mergeExtensionAttributes(
      prev.extensionAttributes,
      incoming.extensionAttributes
    );
    return {
      ...structuredClone(prev),
      name: incoming.name,
      description: incoming.description,
      type: structuredClone(incoming.type),
      previousId: incoming.previousId,
      nextId: incoming.nextId,
      ...(ext !== undefined ? { extensionAttributes: ext } : {}),
    };
  });
}

function mergeCellsAndElements(
  existingDesign: UsdmV4InterventionalStudyDesign,
  incomingDesign: UsdmV4InterventionalStudyDesign,
  mergedArms: readonly UsdmV4StudyArm[],
  mergedEpochs: readonly UsdmV4StudyEpoch[]
): {
  readonly elements: UsdmV4StudyElement[];
  readonly studyCells: UsdmV4StudyCell[];
} {
  const armIds = new Set(mergedArms.map((arm) => arm.id));
  const epochIds = new Set(mergedEpochs.map((epoch) => epoch.id));

  // Keep existing cells for arm-epoch pairs that still exist so Study Studio
  // cell/element edits and intervention links survive CRF Studio round-trips.
  const keptCells = (existingDesign.studyCells ?? [])
    .filter((cell) => armIds.has(cell.armId) && epochIds.has(cell.epochId))
    .map((cell) => structuredClone(cell));

  const coveredPairs = new Set(
    keptCells.map((cell) => `${cell.armId}::${cell.epochId}`)
  );
  const incomingElementsById = new Map(
    (incomingDesign.elements ?? []).map((el) => [el.id, el])
  );
  const existingElementsById = new Map(
    (existingDesign.elements ?? []).map((el) => [el.id, el])
  );

  const addedCells: UsdmV4StudyCell[] = [];
  for (const cell of incomingDesign.studyCells ?? []) {
    if (!armIds.has(cell.armId) || !epochIds.has(cell.epochId)) continue;
    const key = `${cell.armId}::${cell.epochId}`;
    if (coveredPairs.has(key)) continue;
    coveredPairs.add(key);
    addedCells.push(structuredClone(cell));
  }

  const studyCells = [...keptCells, ...addedCells];
  const referencedElementIds = new Set(
    studyCells.flatMap((cell) => cell.elementIds ?? [])
  );

  const elements: UsdmV4StudyElement[] = [];
  const addedElementIds = new Set<string>();
  for (const el of existingDesign.elements ?? []) {
    if (referencedElementIds.has(el.id)) {
      elements.push(structuredClone(el));
      addedElementIds.add(el.id);
    }
  }
  for (const elementId of referencedElementIds) {
    if (addedElementIds.has(elementId)) continue;
    const incomingEl =
      incomingElementsById.get(elementId) ??
      existingElementsById.get(elementId);
    if (incomingEl) {
      elements.push(structuredClone(incomingEl));
      addedElementIds.add(elementId);
    }
  }

  return { elements, studyCells };
}

function mergeEncounters(
  existingEncounters: readonly UsdmV4Encounter[],
  incomingEncounters: readonly UsdmV4Encounter[]
): UsdmV4Encounter[] {
  const byId = new Map(existingEncounters.map((enc) => [enc.id, enc]));
  return incomingEncounters.map((incoming) => {
    const prev = byId.get(incoming.id);
    if (!prev) return structuredClone(incoming);
    const ext = mergeExtensionAttributes(
      prev.extensionAttributes,
      incoming.extensionAttributes
    );
    return {
      ...structuredClone(prev),
      ...structuredClone(incoming),
      label: prev.label ?? incoming.label,
      description: incoming.description ?? prev.description,
      environmentalSettings:
        (prev.environmentalSettings?.length ?? 0) > 0
          ? structuredClone(prev.environmentalSettings!)
          : structuredClone(incoming.environmentalSettings),
      contactModes:
        (prev.contactModes?.length ?? 0) > 0
          ? structuredClone(prev.contactModes!)
          : structuredClone(incoming.contactModes),
      ...(ext !== undefined ? { extensionAttributes: ext } : {}),
    };
  });
}

function mergeActivities(
  existingActivities: readonly UsdmV4Activity[],
  incomingActivities: readonly UsdmV4Activity[]
): UsdmV4Activity[] {
  const byId = new Map(existingActivities.map((act) => [act.id, act]));
  return incomingActivities.map((incoming) => {
    const prev = byId.get(incoming.id);
    if (!prev) return structuredClone(incoming);
    const ext = mergeExtensionAttributes(
      prev.extensionAttributes,
      incoming.extensionAttributes,
      { includeSdtmDomain: true }
    );
    return {
      ...structuredClone(prev),
      ...structuredClone(incoming),
      label: prev.label ?? incoming.label,
      ...(ext !== undefined ? { extensionAttributes: ext } : {}),
    };
  });
}

function mergeObjectives(
  existingObjectives: readonly UsdmV4Objective[] | undefined,
  incomingObjectives: readonly UsdmV4Objective[] | undefined
): UsdmV4Objective[] {
  const byId = new Map((existingObjectives ?? []).map((obj) => [obj.id, obj]));
  return (incomingObjectives ?? []).map((incoming) => {
    const prev = byId.get(incoming.id);
    if (!prev) return structuredClone(incoming);
    const ext = mergeExtensionAttributes(
      prev.extensionAttributes,
      incoming.extensionAttributes
    );
    return {
      ...structuredClone(prev),
      ...structuredClone(incoming),
      ...(ext !== undefined ? { extensionAttributes: ext } : {}),
    };
  });
}

function mergePopulation(
  existingPop: UsdmV4StudyDesignPopulation | undefined,
  incomingPop: UsdmV4StudyDesignPopulation | undefined
): UsdmV4StudyDesignPopulation | undefined {
  if (!incomingPop)
    return existingPop ? structuredClone(existingPop) : undefined;
  if (!existingPop) return structuredClone(incomingPop);
  const prevCohortsById = new Map(
    (existingPop.cohorts ?? []).map((cohort) => [cohort.id, cohort])
  );
  const cohorts: UsdmV4StudyCohort[] = (incomingPop.cohorts ?? []).map(
    (cohort) => {
      const prev = prevCohortsById.get(cohort.id);
      if (!prev) return structuredClone(cohort);
      const ext = mergeExtensionAttributes(
        prev.extensionAttributes,
        cohort.extensionAttributes
      );
      return {
        ...structuredClone(prev),
        ...structuredClone(cohort),
        ...(ext !== undefined ? { extensionAttributes: ext } : {}),
      };
    }
  );
  const ext = mergeExtensionAttributes(
    existingPop.extensionAttributes,
    incomingPop.extensionAttributes
  );
  return {
    ...structuredClone(existingPop),
    ...structuredClone(incomingPop),
    id: existingPop.id,
    cohorts,
    ...(ext !== undefined ? { extensionAttributes: ext } : {}),
  };
}

function mergeTimelines(
  existingTimelines: readonly UsdmV4ScheduleTimeline[] | undefined,
  incomingTimelines: readonly UsdmV4ScheduleTimeline[] | undefined
): UsdmV4ScheduleTimeline[] {
  if (!incomingTimelines) {
    return existingTimelines ? structuredClone([...existingTimelines]) : [];
  }
  const primaryExisting = existingTimelines?.[0];
  return incomingTimelines.map((timeline, index) => {
    if (index === 0 && primaryExisting) {
      const ext = mergeExtensionAttributes(
        primaryExisting.extensionAttributes,
        timeline.extensionAttributes
      );
      return {
        ...structuredClone(timeline),
        id: primaryExisting.id,
        ...(ext !== undefined ? { extensionAttributes: ext } : {}),
      };
    }
    return structuredClone(timeline);
  });
}

function mergeSelectedDesign(
  existingDesign: UsdmV4InterventionalStudyDesign,
  incomingDesign: UsdmV4InterventionalStudyDesign
): UsdmV4InterventionalStudyDesign {
  const arms = mergeArms(existingDesign.arms ?? [], incomingDesign.arms ?? []);
  const epochs = mergeEpochs(
    existingDesign.epochs ?? [],
    incomingDesign.epochs ?? []
  );
  const { elements, studyCells } = mergeCellsAndElements(
    existingDesign,
    incomingDesign,
    arms,
    epochs
  );
  const encounters = mergeEncounters(
    existingDesign.encounters ?? [],
    incomingDesign.encounters ?? []
  );
  const activities = mergeActivities(
    existingDesign.activities ?? [],
    incomingDesign.activities ?? []
  );
  const objectives = mergeObjectives(
    existingDesign.objectives,
    incomingDesign.objectives
  );
  const population = mergePopulation(
    existingDesign.population,
    incomingDesign.population
  );
  const scheduleTimelines = mergeTimelines(
    existingDesign.scheduleTimelines,
    incomingDesign.scheduleTimelines
  );
  const designExt = mergeExtensionAttributes(
    existingDesign.extensionAttributes,
    incomingDesign.extensionAttributes
  );

  // Keep intervention IDs already referenced by elements so Study Studio
  // element-level interventions stay linked.
  const elementInterventionIds = elements.flatMap(
    (el) => el.studyInterventionIds ?? []
  );
  const studyInterventionIds = [
    ...new Set([
      ...(incomingDesign.studyInterventionIds ?? []),
      ...elementInterventionIds,
    ]),
  ];

  return {
    ...structuredClone(existingDesign),
    name: incomingDesign.name || existingDesign.name,
    studyPhase: incomingDesign.studyPhase ?? existingDesign.studyPhase,
    arms,
    epochs,
    elements,
    studyCells,
    encounters,
    activities,
    objectives,
    ...(population !== undefined ? { population } : {}),
    scheduleTimelines,
    eligibilityCriteria: structuredClone(
      incomingDesign.eligibilityCriteria ?? []
    ),
    studyInterventionIds,
    ...(designExt !== undefined ? { extensionAttributes: designExt } : {}),
  };
}

function mergeBiomedicalConcepts(
  existingVersion: UsdmV4StudyVersion,
  incomingVersion: UsdmV4StudyVersion,
  selectedDesignId: string
): UsdmV4BiomedicalConcept[] {
  const existingById = new Map(
    (existingVersion.biomedicalConcepts ?? []).map((bc) => [bc.id, bc])
  );
  const siblingConceptIds = new Set(
    (existingVersion.studyDesigns ?? [])
      .filter((design) => design.id !== selectedDesignId)
      .flatMap((design) => design.activities ?? [])
      .flatMap((act) => act.biomedicalConceptIds ?? [])
  );

  const merged: UsdmV4BiomedicalConcept[] = [];
  const includedIds = new Set<string>();

  for (const incoming of incomingVersion.biomedicalConcepts ?? []) {
    const prev = existingById.get(incoming.id);
    if (!prev) {
      merged.push(structuredClone(incoming));
    } else {
      const ext = mergeExtensionAttributes(
        prev.extensionAttributes,
        incoming.extensionAttributes
      );
      merged.push({
        ...structuredClone(prev),
        ...structuredClone(incoming),
        ...(ext !== undefined ? { extensionAttributes: ext } : {}),
      });
    }
    includedIds.add(incoming.id);
  }

  for (const prev of existingVersion.biomedicalConcepts ?? []) {
    if (!includedIds.has(prev.id) && siblingConceptIds.has(prev.id)) {
      merged.push(structuredClone(prev));
      includedIds.add(prev.id);
    }
  }

  return merged;
}

function mergeVersionInterventions(
  existingVersion: UsdmV4StudyVersion,
  incomingVersion: UsdmV4StudyVersion,
  selectedDesign: UsdmV4InterventionalStudyDesign,
  selectedDesignId: string
): UsdmV4StudyIntervention[] | undefined {
  const existingById = new Map(
    (existingVersion.studyInterventions ?? []).map((item) => [item.id, item])
  );
  const neededIds = new Set<string>([
    ...(selectedDesign.studyInterventionIds ?? []),
    ...(existingVersion.studyDesigns ?? [])
      .filter((design) => design.id !== selectedDesignId)
      .flatMap((design) => [
        ...(design.studyInterventionIds ?? []),
        ...(design.elements ?? []).flatMap(
          (el) => el.studyInterventionIds ?? []
        ),
      ]),
  ]);

  const result: UsdmV4StudyIntervention[] = [];
  const seen = new Set<string>();
  for (const incoming of incomingVersion.studyInterventions ?? []) {
    const prev = existingById.get(incoming.id);
    const ext = mergeExtensionAttributes(
      prev?.extensionAttributes,
      incoming.extensionAttributes
    );
    result.push(
      prev
        ? {
            ...structuredClone(prev),
            ...structuredClone(incoming),
            ...(ext !== undefined ? { extensionAttributes: ext } : {}),
          }
        : structuredClone(incoming)
    );
    seen.add(incoming.id);
  }

  for (const prev of existingVersion.studyInterventions ?? []) {
    if (!seen.has(prev.id) && neededIds.has(prev.id)) {
      result.push(structuredClone(prev));
      seen.add(prev.id);
    }
  }

  if (result.length === 0) {
    return existingVersion.studyInterventions === undefined ? undefined : [];
  }
  return result;
}

function mergeCriterionItems(
  existingVersion: UsdmV4StudyVersion,
  incomingVersion: UsdmV4StudyVersion,
  selectedDesignId: string
): UsdmV4EligibilityCriterionItem[] | undefined {
  const siblingItemIds = new Set(
    (existingVersion.studyDesigns ?? [])
      .filter((design) => design.id !== selectedDesignId)
      .flatMap((design) => design.eligibilityCriteria ?? [])
      .map((criterion) => criterion.criterionItemId)
      .filter((id): id is string => typeof id === "string")
  );
  const existingById = new Map(
    (existingVersion.eligibilityCriterionItems ?? []).map((item) => [
      item.id,
      item,
    ])
  );

  const result: UsdmV4EligibilityCriterionItem[] = [];
  const seen = new Set<string>();
  for (const item of incomingVersion.eligibilityCriterionItems ?? []) {
    const prev = existingById.get(item.id);
    const ext = mergeExtensionAttributes(
      prev?.extensionAttributes,
      item.extensionAttributes
    );
    result.push(
      prev
        ? {
            ...structuredClone(prev),
            ...structuredClone(item),
            ...(ext !== undefined ? { extensionAttributes: ext } : {}),
          }
        : structuredClone(item)
    );
    seen.add(item.id);
  }
  for (const prev of existingVersion.eligibilityCriterionItems ?? []) {
    if (!seen.has(prev.id) && siblingItemIds.has(prev.id)) {
      result.push(structuredClone(prev));
      seen.add(prev.id);
    }
  }
  if (result.length === 0) {
    return existingVersion.eligibilityCriterionItems === undefined
      ? undefined
      : [];
  }
  return result;
}

function collectUsdmEntityIds(
  root: unknown,
  target = new Set<string>()
): Set<string> {
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.id === "string" && typeof rec.instanceType === "string") {
      target.add(rec.id);
    }
    Object.values(rec).forEach(visit);
  };
  visit(root);
  return target;
}

function disambiguateSubtreeIds<T>(
  subtree: T,
  reservedIds: Set<string>,
  scopePrefix: string
): T {
  const remapped = new Map<string, string>();
  const scan = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(scan);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    const rec = node as Record<string, unknown>;
    if (typeof rec.id === "string" && typeof rec.instanceType === "string") {
      const original = rec.id;
      if (reservedIds.has(original)) {
        let candidate = `${scopePrefix}-${original}`;
        let n = 2;
        while (reservedIds.has(candidate)) {
          candidate = `${scopePrefix}-${n}-${original}`;
          n += 1;
        }
        remapped.set(original, candidate);
        reservedIds.add(candidate);
      } else {
        reservedIds.add(original);
      }
    }
    Object.values(rec).forEach(scan);
  };
  scan(subtree);
  if (remapped.size === 0) return subtree;

  const rewrite = (node: unknown, keyName?: string): unknown => {
    if (typeof node === "string") {
      if (
        keyName &&
        (keyName === "id" ||
          keyName.endsWith("Id") ||
          keyName.endsWith("Ids")) &&
        remapped.has(node)
      ) {
        return remapped.get(node)!;
      }
      return node;
    }
    if (Array.isArray(node)) {
      return node.map((item) => rewrite(item, keyName));
    }
    if (typeof node !== "object" || node === null) return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      out[k] = rewrite(v, k);
    }
    return out;
  };
  return rewrite(subtree) as T;
}

function mergeSelectedVersion(
  existingVersion: UsdmV4StudyVersion,
  incomingVersion: UsdmV4StudyVersion,
  selectedDesignId: string,
  reservedOutsideVersion: ReadonlySet<string>
): UsdmV4StudyVersion {
  const incomingDesign = incomingVersion.studyDesigns?.[0];
  let updatedSelectedDesign: UsdmV4InterventionalStudyDesign | null = null;

  const siblingDesigns = (existingVersion.studyDesigns ?? []).filter(
    (design) => design.id !== selectedDesignId
  );
  const reservedForDesign = new Set(reservedOutsideVersion);
  for (const sibling of siblingDesigns) {
    collectUsdmEntityIds(sibling, reservedForDesign);
  }
  // Keep version-level entity IDs (version id, titles, identifiers, orgs) reserved too.
  reservedForDesign.add(existingVersion.id);
  for (const t of existingVersion.titles ?? [])
    collectUsdmEntityIds(t, reservedForDesign);
  for (const ident of existingVersion.studyIdentifiers ?? []) {
    collectUsdmEntityIds(ident, reservedForDesign);
  }
  for (const org of existingVersion.organizations ?? []) {
    collectUsdmEntityIds(org, reservedForDesign);
  }

  const studyDesigns = (existingVersion.studyDesigns ?? []).map((design) => {
    if (design.id !== selectedDesignId || !incomingDesign) {
      return structuredClone(design);
    }
    const merged = mergeSelectedDesign(design, incomingDesign);
    // Reserve the design's own root id so `workspace.selection.studyDesignId` never changes.
    reservedForDesign.delete(design.id);
    updatedSelectedDesign = disambiguateSubtreeIds(
      merged,
      reservedForDesign,
      selectedDesignId
    );
    return updatedSelectedDesign;
  });

  const biomedicalConcepts = disambiguateSubtreeIds(
    mergeBiomedicalConcepts(existingVersion, incomingVersion, selectedDesignId),
    reservedForDesign,
    existingVersion.id
  );
  const rawInterventions = updatedSelectedDesign
    ? mergeVersionInterventions(
        existingVersion,
        incomingVersion,
        updatedSelectedDesign,
        selectedDesignId
      )
    : existingVersion.studyInterventions
      ? structuredClone([...existingVersion.studyInterventions])
      : undefined;
  const studyInterventions = rawInterventions
    ? disambiguateSubtreeIds(
        rawInterventions,
        reservedForDesign,
        existingVersion.id
      )
    : undefined;
  const rawCriteriaItems = mergeCriterionItems(
    existingVersion,
    incomingVersion,
    selectedDesignId
  );
  const eligibilityCriterionItems = rawCriteriaItems
    ? disambiguateSubtreeIds(
        rawCriteriaItems,
        reservedForDesign,
        existingVersion.id
      )
    : undefined;

  // Update official title and primary identifier text while keeping existing
  // USDM IDs, organizations, and StudyRole appliesToIds intact.
  const incomingTitleText = incomingVersion.titles?.[0]?.text;
  const existingTitles = existingVersion.titles ?? [];
  const titles =
    existingTitles.length > 0 && incomingTitleText
      ? existingTitles.map((title, idx) =>
          idx === 0
            ? { ...structuredClone(title), text: incomingTitleText }
            : structuredClone(title)
        )
      : structuredClone(existingTitles);

  const incomingIdentifierText = incomingVersion.studyIdentifiers?.[0]?.text;
  const existingIdentifiers = existingVersion.studyIdentifiers ?? [];
  const studyIdentifiers =
    existingIdentifiers.length > 0 && incomingIdentifierText
      ? existingIdentifiers.map((ident, idx) =>
          idx === 0
            ? { ...structuredClone(ident), text: incomingIdentifierText }
            : structuredClone(ident)
        )
      : structuredClone(existingIdentifiers);

  const incomingSponsorName = incomingVersion.organizations?.[0]?.name;
  const organizations =
    existingVersion.organizations &&
    existingVersion.organizations.length > 0 &&
    incomingSponsorName
      ? existingVersion.organizations.map((org, idx) =>
          idx === 0
            ? { ...structuredClone(org), name: incomingSponsorName }
            : structuredClone(org)
        )
      : existingVersion.organizations
        ? structuredClone([...existingVersion.organizations])
        : undefined;

  const versionExtRaw = mergeExtensionAttributes(
    existingVersion.extensionAttributes,
    incomingVersion.extensionAttributes
  );
  const versionExt = versionExtRaw
    ? disambiguateSubtreeIds(
        versionExtRaw,
        reservedForDesign,
        existingVersion.id
      )
    : undefined;

  return {
    ...structuredClone(existingVersion),
    versionIdentifier:
      incomingVersion.versionIdentifier || existingVersion.versionIdentifier,
    titles,
    studyIdentifiers,
    ...(organizations !== undefined ? { organizations } : {}),
    biomedicalConcepts,
    ...(studyInterventions !== undefined ? { studyInterventions } : {}),
    ...(eligibilityCriterionItems !== undefined
      ? { eligibilityCriterionItems }
      : {}),
    studyDesigns,
    ...(versionExt !== undefined ? { extensionAttributes: versionExt } : {}),
  };
}

/**
 * Reconciles an edited USDM v4 document (such as CRF Studio's export) back into
 * the active {@link StudyWorkspace} at `workspace.selection`, committing a new
 * revision via {@link commitStudyRevision}. Unselected study versions,
 * unselected study designs, and non-CRF `extensionAttributes` remain untouched.
 *
 * @throws StudyWorkspaceConflictError when `options.expectedRevisionId` does
 *   not match `workspace.revision.id`.
 */
export function reconcileUsdmStudyRevision(
  workspace: StudyWorkspace,
  incomingUsdm: UsdmV4Document,
  options: ReconcileUsdmStudyOptions
): StudyWorkspace {
  const incomingVersion = incomingUsdm.study.versions?.[0];
  if (!incomingVersion) {
    return commitStudyRevision(workspace, workspace.usdm, {
      expectedRevisionId: options.expectedRevisionId,
      note: options.note,
    });
  }

  const studyId = workspace.usdm.study.id ?? "study";
  const reservedOutsideSelectedVersion = new Set<string>(
    workspace.usdm.study.id ? [workspace.usdm.study.id] : []
  );
  for (const version of workspace.usdm.study.versions ?? []) {
    if (version.id !== workspace.selection.studyVersionId) {
      collectUsdmEntityIds(version, reservedOutsideSelectedVersion);
    }
  }

  const studyExtRaw = mergeExtensionAttributes(
    workspace.usdm.study.extensionAttributes,
    incomingUsdm.study.extensionAttributes
  );
  const studyExt = studyExtRaw
    ? disambiguateSubtreeIds(
        studyExtRaw,
        reservedOutsideSelectedVersion,
        studyId
      )
    : undefined;

  const mergedUsdm: UsdmV4Document = {
    ...structuredClone(workspace.usdm),
    study: {
      ...structuredClone(workspace.usdm.study),
      name: incomingUsdm.study.name || workspace.usdm.study.name,
      label: incomingUsdm.study.label ?? workspace.usdm.study.label,
      ...(studyExt !== undefined ? { extensionAttributes: studyExt } : {}),
      versions: (workspace.usdm.study.versions ?? []).map((version) =>
        version.id === workspace.selection.studyVersionId
          ? mergeSelectedVersion(
              version,
              incomingVersion,
              workspace.selection.studyDesignId,
              reservedOutsideSelectedVersion
            )
          : structuredClone(version)
      ),
    },
  };

  if (
    options.skipIfUnchanged &&
    options.expectedRevisionId === workspace.revision.id &&
    usdmContentHash(mergedUsdm) === workspace.revision.sha256
  ) {
    return workspace;
  }

  return commitStudyRevision(workspace, mergedUsdm, {
    expectedRevisionId: options.expectedRevisionId,
    note: options.note,
  });
}
