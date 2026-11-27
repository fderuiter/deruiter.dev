import type {
  StudyDesignArm,
  StudyDesignElement,
  StudyDesignEpoch,
  StudyDesignFinding,
  StudyDesignGrid,
  StudyDesignGridCell,
  StudyDesignTerm,
  StudyWorkspace,
} from "../types";

/** A loose JSON object, as the working document holds it. */
export type JsonRecord = Record<string, unknown>;

/** Thrown when a design edit names something the design does not have. */
export class StudyDesignError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudyDesignError";
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The records of an array field; an absent field is empty. */
export function recordsOf(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Reads a string field, returning empty string for non-strings. */
export const textOf = text;

function term(value: unknown): StudyDesignTerm | null {
  if (!isRecord(value)) return null;
  const code = text(value.code);
  return code ? { code, decode: text(value.decode) } : null;
}

/** Reads a USDM Code object into a `StudyDesignTerm`, or null when absent. */
export const termOf = term;

/** The selected design and its JSON Pointer in the working document. */
export interface SelectedDesign {
  readonly versionPointer: string;
  readonly version: JsonRecord;
  readonly pointer: string;
  readonly design: JsonRecord;
}

/**
 * Finds the study design the workspace works on, by the ids in its
 * selection, never by position.
 */
export function selectedDesign(workspace: StudyWorkspace): SelectedDesign {
  const { studyVersionId, studyDesignId } = workspace.selection;
  const study = (workspace.usdm as unknown as JsonRecord).study;
  const versions = isRecord(study) ? study.versions : undefined;
  const versionList = Array.isArray(versions) ? versions : [];
  const versionIndex = versionList.findIndex(
    (version) => isRecord(version) && version.id === studyVersionId
  );
  const version = versionList[versionIndex];
  const designs = isRecord(version) ? version.studyDesigns : undefined;
  const designList = Array.isArray(designs) ? designs : [];
  const designIndex = designList.findIndex(
    (design) => isRecord(design) && design.id === studyDesignId
  );
  const design = designList[designIndex];
  if (
    versionIndex < 0 ||
    designIndex < 0 ||
    !isRecord(version) ||
    !isRecord(design)
  ) {
    throw new StudyDesignError(
      `The workspace has no study design ${studyDesignId} in study version ${studyVersionId}.`
    );
  }
  return {
    versionPointer: `/study/versions/${versionIndex}`,
    version,
    pointer: `/study/versions/${versionIndex}/studyDesigns/${designIndex}`,
    design,
  };
}

/**
 * Orders records linked through `previousId` and `nextId` when that chain
 * starts once, visits every item once and agrees with itself; otherwise
 * preserves array order and reports `broken: true`.
 */
export function orderedChain(items: JsonRecord[]): {
  items: JsonRecord[];
  broken: boolean;
} {
  const linked = items.some(
    (item) =>
      typeof item.previousId === "string" || typeof item.nextId === "string"
  );
  if (!linked || items.length < 2) return { items, broken: false };
  const byId = new Map(items.map((item) => [text(item.id), item]));
  const starts = items.filter((item) => !item.previousId);
  const chain: JsonRecord[] = [];
  let current = starts.length === 1 ? starts[0] : undefined;
  while (current && !chain.includes(current)) {
    chain.push(current);
    const next = byId.get(text(current.nextId));
    if (next && next.previousId !== current.id) break;
    current = next;
  }
  const holds =
    chain.length === items.length &&
    !chain.at(-1)?.nextId &&
    byId.size === items.length;
  return holds ? { items: chain, broken: false } : { items, broken: true };
}

/**
 * Epochs in study order. USDM orders epochs through `previousId` and
 * `nextId`; when that chain starts once, visits every epoch once and agrees
 * with itself, it gives the order. Otherwise the array order is used and
 * `broken` is true.
 */
export function orderedEpochs(design: JsonRecord): {
  epochs: JsonRecord[];
  broken: boolean;
} {
  const ordered = orderedChain(recordsOf(design.epochs));
  return { epochs: ordered.items, broken: ordered.broken };
}

/**
 * Projects the selected design as an arms-by-epochs grid keyed by USDM ids.
 * Every arm and epoch pair has a cell or a finding; nothing missing is
 * filled in.
 */
export function projectStudyDesignGrid(
  workspace: StudyWorkspace
): StudyDesignGrid {
  const { design } = selectedDesign(workspace);
  const findings: StudyDesignFinding[] = [];

  const arms: StudyDesignArm[] = recordsOf(design.arms).map((arm) => ({
    id: text(arm.id),
    name: text(arm.name),
    type: term(arm.type),
    dataOrigin: term(arm.dataOriginType),
  }));
  const order = orderedEpochs(design);
  if (order.broken) {
    findings.push({
      kind: "epoch-order",
      message:
        "The epochs' previous and next links do not form one chain, so they are shown in file order.",
      ids: order.epochs.map((epoch) => text(epoch.id)),
    });
  }
  const epochs: StudyDesignEpoch[] = order.epochs.map((epoch) => ({
    id: text(epoch.id),
    name: text(epoch.name),
    type: term(epoch.type),
  }));

  const elements = new Map<string, StudyDesignElement>(
    recordsOf(design.elements).map((element) => [
      text(element.id),
      { id: text(element.id), name: text(element.name) },
    ])
  );
  const armIds = new Set(arms.map((arm) => arm.id));
  const epochIds = new Set(epochs.map((epoch) => epoch.id));
  const cells = recordsOf(design.studyCells);

  for (const cell of cells) {
    if (!armIds.has(text(cell.armId)) || !epochIds.has(text(cell.epochId))) {
      findings.push({
        kind: "orphan-cell",
        message: `Cell ${text(cell.id)} names an arm or epoch the design does not have.`,
        ids: [text(cell.id)],
      });
    }
  }

  const rows = arms.map((arm) => ({
    arm,
    cells: epochs.map((epoch): StudyDesignGridCell => {
      const matches = cells.filter(
        (cell) => cell.armId === arm.id && cell.epochId === epoch.id
      );
      if (matches.length === 0) {
        findings.push({
          kind: "missing-cell",
          message: `${arm.name || arm.id} has no cell in ${epoch.name || epoch.id}.`,
          ids: [arm.id, epoch.id],
        });
        return { armId: arm.id, epochId: epoch.id, cellId: null, elements: [] };
      }
      if (matches.length > 1) {
        findings.push({
          kind: "duplicate-cell",
          message: `${arm.name || arm.id} has ${matches.length} cells in ${epoch.name || epoch.id}; the first is shown.`,
          ids: matches.map((cell) => text(cell.id)),
        });
      }
      const cell = matches[0];
      const placed: StudyDesignElement[] = [];
      for (const id of Array.isArray(cell.elementIds) ? cell.elementIds : []) {
        const element = elements.get(text(id));
        if (element) {
          placed.push(element);
        } else {
          findings.push({
            kind: "unknown-element",
            message: `Cell ${text(cell.id)} names element ${text(id)}, which the design does not have.`,
            ids: [text(cell.id), text(id)],
          });
        }
      }
      return {
        armId: arm.id,
        epochId: epoch.id,
        cellId: text(cell.id),
        elements: placed,
      };
    }),
  }));

  return { designId: text(design.id), arms, epochs, rows, findings };
}
