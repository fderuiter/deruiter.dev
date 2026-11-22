import type {
  StudyDesignCellRef,
  StudyDesignTerm,
  StudyEdit,
  StudyPatchOperation,
  StudyWorkspace,
} from "../types";
import {
  DATA_GENERATED_WITHIN_STUDY,
  DATA_ORIGIN_DESCRIPTION,
  STUDY_ARM_TYPES,
  STUDY_EPOCH_TYPES,
  usdmCode,
} from "./design-terms";
import {
  StudyDesignError,
  orderedEpochs,
  recordsOf,
  selectedDesign,
  type JsonRecord,
} from "./design-grid";
import { applyStudyPatch, createStudyEdit } from "./ops";

/**
 * Design grid operations (#3401). Each one returns a `StudyEdit` for
 * `applyStudyEdit`, so every add, rename, move and remove can be undone.
 * Objects are found by USDM id, never by row or label.
 */

/** Every `id` in the document, so new ids never collide. */
function usedIds(node: unknown, ids = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) usedIds(item, ids);
  } else if (typeof node === "object" && node !== null) {
    for (const [key, value] of Object.entries(node)) {
      if (key === "id" && typeof value === "string") ids.add(value);
      else usedIds(value, ids);
    }
  }
  return ids;
}

/** Makes `Prefix_n` ids with the smallest unused `n`. */
function idMaker(workspace: StudyWorkspace) {
  const ids = usedIds(workspace.usdm);
  return (prefix: string): string => {
    let n = 1;
    while (ids.has(`${prefix}_${n}`)) n += 1;
    const id = `${prefix}_${n}`;
    ids.add(id);
    return id;
  };
}

/** True when some string in the document equals `id`. */
function mentions(node: unknown, id: string): boolean {
  if (node === id) return true;
  if (Array.isArray(node)) return node.some((item) => mentions(item, id));
  if (typeof node === "object" && node !== null) {
    return Object.values(node).some((value) => mentions(value, id));
  }
  return false;
}

/**
 * Makes the edit for a removal, refusing it when something outside the
 * grid still names a removed id (a schedule entry, a population or an
 * extension), so a removal never leaves a dangling reference.
 */
function removal(
  workspace: StudyWorkspace,
  patch: StudyPatchOperation[],
  removedIds: readonly string[],
  note: string
): StudyEdit {
  const { usdm } = applyStudyPatch(workspace.usdm, patch);
  for (const id of removedIds) {
    if (mentions(usdm, id)) {
      throw new StudyDesignError(
        `${id} is still referenced elsewhere in the study; remove those references first.`
      );
    }
  }
  return createStudyEdit(workspace, patch, note);
}

function cleanName(name: string, what: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new StudyDesignError(`A ${what} needs a name.`);
  return trimmed;
}

function findTerm(
  terms: readonly StudyDesignTerm[],
  code: string,
  what: string
): StudyDesignTerm {
  const found = terms.find((term) => term.code === code);
  if (!found) throw new StudyDesignError(`${code} is not an ${what} term.`);
  return found;
}

function indexOf(list: JsonRecord[], id: string, what: string): number {
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) throw new StudyDesignError(`The design has no ${what} ${id}.`);
  return index;
}

function clampIndex(index: number, length: number): number {
  const whole = Math.trunc(index);
  if (whole < 0) return 0;
  return whole > length ? length : whole;
}

/** Removes array items by index, highest first so indices stay valid. */
function removeAt(pointer: string, indices: number[]): StudyPatchOperation[] {
  return [...indices]
    .sort((a, b) => b - a)
    .map((index) => ({ op: "remove" as const, path: `${pointer}/${index}` }));
}

/** Element indices that only the removed cells used. */
function unusedElements(
  design: JsonRecord,
  removedCellIds: ReadonlySet<string>,
  candidates: ReadonlySet<string>
): number[] {
  const stillUsed = new Set(
    recordsOf(design.studyCells)
      .filter((cell) => !removedCellIds.has(String(cell.id)))
      .flatMap((cell) =>
        Array.isArray(cell.elementIds) ? cell.elementIds : []
      )
  );
  return recordsOf(design.elements).flatMap((element, index) =>
    candidates.has(String(element.id)) && !stillUsed.has(element.id)
      ? [index]
      : []
  );
}

// Arms

/** Adds an arm at the end, with a type from `STUDY_ARM_TYPES`. */
export function addStudyArm(
  workspace: StudyWorkspace,
  input: { readonly name: string; readonly typeCode: string }
): StudyEdit {
  const name = cleanName(input.name, "arm");
  const type = findTerm(STUDY_ARM_TYPES, input.typeCode, "arm type");
  const { pointer } = selectedDesign(workspace);
  const nextId = idMaker(workspace);
  const id = nextId("StudyArm");
  const arm = {
    id,
    name,
    type: usdmCode(nextId("Code"), type),
    dataOriginDescription: DATA_ORIGIN_DESCRIPTION,
    dataOriginType: usdmCode(nextId("Code"), DATA_GENERATED_WITHIN_STUDY),
    instanceType: "StudyArm",
  };
  return createStudyEdit(
    workspace,
    [{ op: "add", path: `${pointer}/arms/-`, value: arm }],
    `Add arm "${name}"`
  );
}

/** Renames an arm. */
export function renameStudyArm(
  workspace: StudyWorkspace,
  armId: string,
  name: string
): StudyEdit {
  const clean = cleanName(name, "arm");
  const { pointer, design } = selectedDesign(workspace);
  const index = indexOf(recordsOf(design.arms), armId, "arm");
  return createStudyEdit(
    workspace,
    [{ op: "replace", path: `${pointer}/arms/${index}/name`, value: clean }],
    `Rename arm to "${clean}"`
  );
}

/** Moves an arm to a new row position. */
export function moveStudyArm(
  workspace: StudyWorkspace,
  armId: string,
  toIndex: number
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const arms = recordsOf(design.arms);
  const from = indexOf(arms, armId, "arm");
  const to = clampIndex(toIndex, arms.length - 1);
  const patch: StudyPatchOperation[] =
    from === to
      ? []
      : [
          { op: "remove", path: `${pointer}/arms/${from}` },
          { op: "add", path: `${pointer}/arms/${to}`, value: arms[from] },
        ];
  return createStudyEdit(
    workspace,
    patch,
    `Move arm "${String(arms[from].name)}"`
  );
}

/**
 * Removes an arm, its cells and the elements only those cells used.
 *
 * @throws StudyDesignError when another part of the study names the arm.
 */
export function removeStudyArm(
  workspace: StudyWorkspace,
  armId: string
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const arms = recordsOf(design.arms);
  const index = indexOf(arms, armId, "arm");
  return removeWithCells(
    workspace,
    pointer,
    design,
    (cell) => cell.armId === armId,
    [{ op: "remove", path: `${pointer}/arms/${index}` }],
    armId,
    `Remove arm "${String(arms[index].name)}"`
  );
}

function removeWithCells(
  workspace: StudyWorkspace,
  pointer: string,
  design: JsonRecord,
  inCells: (cell: JsonRecord) => boolean,
  ownRemoval: StudyPatchOperation[],
  ownId: string,
  note: string
): StudyEdit {
  const cells = recordsOf(design.studyCells);
  const removed = cells.flatMap((cell, index) =>
    inCells(cell) ? [index] : []
  );
  const removedIds = new Set(removed.map((index) => String(cells[index].id)));
  const elementIds = new Set(
    removed.flatMap((index) => {
      const ids = cells[index].elementIds;
      return Array.isArray(ids) ? ids.map(String) : [];
    })
  );
  const elements = recordsOf(design.elements);
  const dropped = unusedElements(design, removedIds, elementIds);
  const patch = [
    ...removeAt(`${pointer}/studyCells`, removed),
    ...removeAt(`${pointer}/elements`, dropped),
    ...ownRemoval,
  ];
  return removal(
    workspace,
    patch,
    [
      ownId,
      ...removedIds,
      ...dropped.map((index) => String(elements[index].id)),
    ],
    note
  );
}

// Epochs

/** The epochs with `previousId` and `nextId` set from their order. */
function linked(epochs: JsonRecord[]): JsonRecord[] {
  return epochs.map((epoch, index) => ({
    ...epoch,
    previousId: index > 0 ? epochs[index - 1].id : null,
    nextId: index < epochs.length - 1 ? epochs[index + 1].id : null,
  }));
}

function replaceEpochs(
  workspace: StudyWorkspace,
  pointer: string,
  epochs: JsonRecord[],
  note: string
): StudyEdit {
  return createStudyEdit(
    workspace,
    [{ op: "replace", path: `${pointer}/epochs`, value: linked(epochs) }],
    note
  );
}

/**
 * Adds an epoch with a type from `STUDY_EPOCH_TYPES`, at `index` in study
 * order (the end by default). The epochs are written in study order with
 * their `previousId` and `nextId` links.
 */
export function addStudyEpoch(
  workspace: StudyWorkspace,
  input: {
    readonly name: string;
    readonly typeCode: string;
    readonly index?: number;
  }
): StudyEdit {
  const name = cleanName(input.name, "epoch");
  const type = findTerm(STUDY_EPOCH_TYPES, input.typeCode, "epoch type");
  const { pointer, design } = selectedDesign(workspace);
  const epochs = [...orderedEpochs(design).epochs];
  const nextId = idMaker(workspace);
  const epoch: JsonRecord = {
    id: nextId("StudyEpoch"),
    name,
    type: usdmCode(nextId("Code"), type),
    instanceType: "StudyEpoch",
  };
  epochs.splice(
    clampIndex(input.index ?? epochs.length, epochs.length),
    0,
    epoch
  );
  return replaceEpochs(workspace, pointer, epochs, `Add epoch "${name}"`);
}

/** Renames an epoch. */
export function renameStudyEpoch(
  workspace: StudyWorkspace,
  epochId: string,
  name: string
): StudyEdit {
  const clean = cleanName(name, "epoch");
  const { pointer, design } = selectedDesign(workspace);
  const index = indexOf(recordsOf(design.epochs), epochId, "epoch");
  return createStudyEdit(
    workspace,
    [{ op: "replace", path: `${pointer}/epochs/${index}/name`, value: clean }],
    `Rename epoch to "${clean}"`
  );
}

/** Moves an epoch to a new position in study order. */
export function moveStudyEpoch(
  workspace: StudyWorkspace,
  epochId: string,
  toIndex: number
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const epochs = [...orderedEpochs(design).epochs];
  const from = indexOf(epochs, epochId, "epoch");
  const [epoch] = epochs.splice(from, 1);
  epochs.splice(clampIndex(toIndex, epochs.length), 0, epoch);
  return replaceEpochs(
    workspace,
    pointer,
    epochs,
    `Move epoch "${String(epoch.name)}"`
  );
}

/**
 * Removes an epoch, its cells and the elements only those cells used, and
 * relinks the remaining epochs.
 *
 * @throws StudyDesignError when another part of the study names the epoch.
 */
export function removeStudyEpoch(
  workspace: StudyWorkspace,
  epochId: string
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const ordered = orderedEpochs(design).epochs;
  const epoch = ordered[indexOf(ordered, epochId, "epoch")];
  const rest = ordered.filter((item) => item !== epoch);
  return removeWithCells(
    workspace,
    pointer,
    design,
    (cell) => cell.epochId === epochId,
    [{ op: "replace", path: `${pointer}/epochs`, value: linked(rest) }],
    epochId,
    `Remove epoch "${String(epoch.name)}"`
  );
}

// Elements

function cellIndex(design: JsonRecord, ref: StudyDesignCellRef): number {
  return recordsOf(design.studyCells).findIndex(
    (cell) => cell.armId === ref.armId && cell.epochId === ref.epochId
  );
}

function checkCellRef(design: JsonRecord, ref: StudyDesignCellRef): void {
  indexOf(recordsOf(design.arms), ref.armId, "arm");
  indexOf(recordsOf(design.epochs), ref.epochId, "epoch");
}

/**
 * Adds a new element to the cell at an arm and epoch, creating the cell
 * when the design has none there.
 */
export function addStudyElement(
  workspace: StudyWorkspace,
  input: StudyDesignCellRef & { readonly name: string }
): StudyEdit {
  const name = cleanName(input.name, "element");
  const { pointer, design } = selectedDesign(workspace);
  checkCellRef(design, input);
  const nextId = idMaker(workspace);
  const elementId = nextId("StudyElement");
  const element = { id: elementId, name, instanceType: "StudyElement" };
  const patch: StudyPatchOperation[] = [
    Array.isArray(design.elements)
      ? { op: "add", path: `${pointer}/elements/-`, value: element }
      : { op: "add", path: `${pointer}/elements`, value: [element] },
  ];
  const at = cellIndex(design, input);
  if (at >= 0) {
    patch.push({
      op: "add",
      path: `${pointer}/studyCells/${at}/elementIds/-`,
      value: elementId,
    });
  } else {
    patch.push({
      op: "add",
      path: `${pointer}/studyCells/-`,
      value: {
        id: nextId("StudyCell"),
        armId: input.armId,
        epochId: input.epochId,
        elementIds: [elementId],
        instanceType: "StudyCell",
      },
    });
  }
  return createStudyEdit(workspace, patch, `Add element "${name}"`);
}

/** Renames an element. */
export function renameStudyElement(
  workspace: StudyWorkspace,
  elementId: string,
  name: string
): StudyEdit {
  const clean = cleanName(name, "element");
  const { pointer, design } = selectedDesign(workspace);
  const index = indexOf(recordsOf(design.elements), elementId, "element");
  return createStudyEdit(
    workspace,
    [
      {
        op: "replace",
        path: `${pointer}/elements/${index}/name`,
        value: clean,
      },
    ],
    `Rename element to "${clean}"`
  );
}

function placedIn(
  design: JsonRecord,
  ref: StudyDesignCellRef,
  elementId: string
): { cell: number; ids: string[]; position: number } {
  const cell = cellIndex(design, ref);
  const record = recordsOf(design.studyCells)[cell];
  const ids =
    record && Array.isArray(record.elementIds)
      ? record.elementIds.map(String)
      : [];
  const position = ids.indexOf(elementId);
  if (cell < 0 || position < 0) {
    throw new StudyDesignError(
      `Element ${elementId} is not in the cell for ${ref.armId} and ${ref.epochId}.`
    );
  }
  return { cell, ids, position };
}

/**
 * Moves an element within its cell or to another cell: the keyboard
 * equivalent of dragging it (ADR 0074). The target cell is created when the
 * design has none there. `index` is the position in the target cell; the
 * end by default.
 */
export function moveStudyElement(
  workspace: StudyWorkspace,
  input: {
    readonly elementId: string;
    readonly from: StudyDesignCellRef;
    readonly to: StudyDesignCellRef;
    readonly index?: number;
  }
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const { elementId, from, to } = input;
  const source = placedIn(design, from, elementId);
  checkCellRef(design, to);
  const name = String(
    recordsOf(design.elements).find((element) => element.id === elementId)
      ?.name ?? elementId
  );
  const cells = `${pointer}/studyCells`;
  const sameCell = from.armId === to.armId && from.epochId === to.epochId;
  if (sameCell) {
    const ids = source.ids.filter((id) => id !== elementId);
    ids.splice(clampIndex(input.index ?? ids.length, ids.length), 0, elementId);
    return createStudyEdit(
      workspace,
      [
        {
          op: "replace",
          path: `${cells}/${source.cell}/elementIds`,
          value: ids,
        },
      ],
      `Reorder element "${name}"`
    );
  }
  const patch: StudyPatchOperation[] = [
    {
      op: "remove",
      path: `${cells}/${source.cell}/elementIds/${source.position}`,
    },
  ];
  const target = cellIndex(design, to);
  if (target >= 0) {
    const record = recordsOf(design.studyCells)[target];
    const ids = Array.isArray(record.elementIds)
      ? record.elementIds.map(String)
      : [];
    if (ids.includes(elementId)) {
      throw new StudyDesignError(
        `Element ${elementId} is already in that cell.`
      );
    }
    const at = clampIndex(input.index ?? ids.length, ids.length);
    patch.push({
      op: "add",
      path: `${cells}/${target}/elementIds/${at}`,
      value: elementId,
    });
  } else {
    patch.push({
      op: "add",
      path: `${cells}/-`,
      value: {
        id: idMaker(workspace)("StudyCell"),
        armId: to.armId,
        epochId: to.epochId,
        elementIds: [elementId],
        instanceType: "StudyCell",
      },
    });
  }
  return createStudyEdit(workspace, patch, `Move element "${name}"`);
}

/**
 * Takes an element out of one cell. The element itself is removed too when
 * no other cell uses it. The cell stays, so its arm and epoch keep a cell.
 *
 * @throws StudyDesignError when a removed element is named elsewhere.
 */
export function removeStudyElement(
  workspace: StudyWorkspace,
  input: StudyDesignCellRef & { readonly elementId: string }
): StudyEdit {
  const { pointer, design } = selectedDesign(workspace);
  const { elementId } = input;
  const source = placedIn(design, input, elementId);
  const patch: StudyPatchOperation[] = [
    {
      op: "remove",
      path: `${pointer}/studyCells/${source.cell}/elementIds/${source.position}`,
    },
  ];
  const usedElsewhere = recordsOf(design.studyCells).some(
    (cell, index) =>
      index !== source.cell &&
      Array.isArray(cell.elementIds) &&
      cell.elementIds.includes(elementId)
  );
  const elements = recordsOf(design.elements);
  const name = String(
    elements.find((element) => element.id === elementId)?.name ?? elementId
  );
  if (usedElsewhere) {
    return createStudyEdit(
      workspace,
      patch,
      `Remove element "${name}" from a cell`
    );
  }
  const index = elements.findIndex((element) => element.id === elementId);
  if (index >= 0)
    patch.push({ op: "remove", path: `${pointer}/elements/${index}` });
  return removal(workspace, patch, [elementId], `Remove element "${name}"`);
}
