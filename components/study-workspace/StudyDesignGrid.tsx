"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import {
  STUDY_ARM_TYPES,
  STUDY_EPOCH_TYPES,
  StudyDesignError,
  TAVR_DEVICE_USDM,
  TAVR_SAVR_USDM,
  addStudyArm,
  addStudyElement,
  addStudyEpoch,
  applyStudyEdit,
  createBlankStudyWorkspace,
  emptyStudyEditHistory,
  importUsdmStudy,
  moveStudyArm,
  moveStudyElement,
  moveStudyEpoch,
  projectStudyDesignGrid,
  redoStudyEdit,
  removeStudyArm,
  removeStudyElement,
  removeStudyEpoch,
  renameStudyArm,
  renameStudyElement,
  renameStudyEpoch,
  undoStudyEdit,
  type StudyDesignCellRef,
  type StudyDesignGrid as Grid,
  type StudyEdit,
  type StudyEditHistory,
  type StudyWorkspace,
} from "@/lib/study-workspace";
import { downloadFile } from "@/lib/download";
import {
  discardStudyWorkspaceDraft,
  dismissQuarantinedStudyWorkspaceDraft,
  loadStudyWorkspaceDraft,
  type QuarantinedStudyWorkspaceDraft,
  type StudyWorkspaceDraftRecord,
} from "./randomization-draft-storage";
import { useStudyWorkspaceDraft } from "./useStudyWorkspaceDraft";
import { TrialSchemaFigure } from "./TrialSchemaFigure";

/** The studies the grid can open: two reference studies and a blank one. */
const SOURCES = [
  { id: "tavr-savr", label: "Reference: TAVR versus SAVR" },
  { id: "tavr-device", label: "Reference: single-arm TAVR" },
  { id: "blank", label: "Blank study" },
] as const;

type SourceId = (typeof SOURCES)[number]["id"];

const isSourceId = (value: unknown): value is SourceId =>
  SOURCES.some((option) => option.id === value);

async function openSource(id: SourceId): Promise<StudyWorkspace> {
  if (id === "blank") return (await createBlankStudyWorkspace()).workspace;
  const result = await importUsdmStudy({
    document: id === "tavr-savr" ? TAVR_SAVR_USDM : TAVR_DEVICE_USDM,
  });
  if (result.status !== "ok") {
    throw new Error(`The reference study did not open: ${result.status}.`);
  }
  return result.workspace;
}

/** What the inspector is showing. */
type Selection =
  | { readonly kind: "arm"; readonly id: string }
  | { readonly kind: "epoch"; readonly id: string }
  | { readonly kind: "cell"; readonly ref: StudyDesignCellRef }
  | {
      readonly kind: "element";
      readonly id: string;
      readonly ref: StudyDesignCellRef;
    };

interface Session {
  readonly workspace: StudyWorkspace;
  readonly history: StudyEditHistory;
}

const BUTTON =
  "min-h-12 rounded border border-white/[0.08] bg-[#0d0e11] px-3 py-1.5 text-sm text-[#f4f4f6] hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
const FIELD =
  "min-h-12 min-w-0 rounded border border-white/[0.08] bg-[#0d0e11] px-2 py-1.5 text-sm text-[#f4f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";
const MONO = "font-[family-name:var(--font-geist-mono)]";

const sameCell = (a: StudyDesignCellRef, b: StudyDesignCellRef) =>
  a.armId === b.armId && a.epochId === b.epochId;

/**
 * The design view of Clinical Study Studio (#3401, ADR 0074): arms as rows,
 * epochs as columns and the study elements in each cell. Every arm, epoch
 * and cell is a button; the inspector beside the grid holds the edits for
 * what is selected, so the grid works from the keyboard alone. Every edit
 * goes through the study workspace and can be undone.
 */
export function StudyDesignGrid() {
  const [source, setSource] = useState<SourceId>("tavr-savr");
  const [session, setSession] = useState<Session | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  // A stored draft waiting for the person to restore or discard it.
  const [offer, setOffer] = useState<StudyWorkspaceDraftRecord | null>(null);
  const [quarantined, setQuarantined] =
    useState<QuarantinedStudyWorkspaceDraft | null>(null);
  const [baseWriteId, setBaseWriteId] = useState<string | null>(null);

  const open = (id: SourceId) => {
    setSource(id);
    void openSource(id).then((workspace) => {
      setSession({ workspace, history: emptyStudyEditHistory() });
      setSelection(null);
      setError(null);
      setStatus(`Opened ${workspace.usdm.study.name}.`);
    });
  };

  useEffect(() => {
    let live = true;
    // Storage is read after mount, so the server render never depends on it.
    const draft = loadStudyWorkspaceDraft();
    void openSource("tavr-savr").then((workspace) => {
      if (!live) return;
      setSession({ workspace, history: emptyStudyEditHistory() });
      setStatus(`Opened ${workspace.usdm.study.name}.`);
      if (draft.status === "recovered") setOffer(draft.record);
      if (draft.status === "quarantined") setQuarantined(draft.entry);
    });
    return () => {
      live = false;
    };
  }, []);

  const ui = useMemo(() => ({ source }), [source]);

  if (!session) {
    return (
      <p role="status" className="text-sm text-slate-400">
        Opening the study…
      </p>
    );
  }

  const grid = projectStudyDesignGrid(session.workspace);

  const restore = (record: StudyWorkspaceDraftRecord) => {
    setSession({
      workspace: record.workspace,
      history: emptyStudyEditHistory(),
    });
    if (isSourceId(record.ui.source)) setSource(record.ui.source);
    setBaseWriteId(record.writeId);
    setSelection(null);
    setOffer(null);
    setStatus(
      `Restored the draft of ${record.workspace.usdm.study.name} at ${record.workspace.revision.id}.`
    );
  };
  const discard = () => {
    discardStudyWorkspaceDraft();
    setBaseWriteId(null);
    setOffer(null);
    setStatus("Discarded the saved draft.");
  };

  const apply = (make: (workspace: StudyWorkspace) => StudyEdit) => {
    try {
      const edit = make(session.workspace);
      setSession(applyStudyEdit(session.workspace, session.history, edit));
      setError(null);
      setStatus(`${edit.note}.`);
      return true;
    } catch (caught) {
      if (!(caught instanceof StudyDesignError)) throw caught;
      setError(caught.message);
      return false;
    }
  };

  const undo = () => {
    const note = session.history.undo.at(-1)?.note;
    setSession(undoStudyEdit(session.workspace, session.history));
    setSelection(null);
    setStatus(`Undid: ${note}.`);
  };
  const redo = () => {
    const note = session.history.redo.at(-1)?.note;
    setSession(redoStudyEdit(session.workspace, session.history));
    setSelection(null);
    setStatus(`Redid: ${note}.`);
  };

  return (
    <div className="@container space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-col gap-1 text-sm text-slate-300">
          Study
          <select
            className={FIELD}
            value={source}
            onChange={(event) => open(event.target.value as SourceId)}
          >
            {SOURCES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={BUTTON}
          onClick={undo}
          disabled={session.history.undo.length === 0}
        >
          Undo
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={redo}
          disabled={session.history.redo.length === 0}
        >
          Redo
        </button>
        <p className={`${MONO} min-w-0 text-xs text-slate-400`}>
          Revision {session.workspace.revision.id}
        </p>
      </div>

      {offer && (
        <DraftOffer record={offer} onRestore={restore} onDiscard={discard} />
      )}
      {quarantined && (
        <QuarantineNotice
          entry={quarantined}
          onDone={() => setQuarantined(null)}
        />
      )}
      <DraftAutosave
        workspace={session.workspace}
        ui={ui}
        baseWriteId={baseWriteId}
        // Only the person's edits are saved, and never over an offered draft.
        enabled={
          !offer &&
          session.history.undo.length + session.history.redo.length > 0
        }
      />

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
      {error && (
        <p
          role="alert"
          className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
        >
          {error}
        </p>
      )}

      <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_20rem]">
        <GridTable grid={grid} selection={selection} onSelect={setSelection} />
        <Inspector
          key={JSON.stringify(selection)}
          grid={grid}
          selection={selection}
          onSelect={setSelection}
          apply={apply}
        />
      </div>

      <AddForms apply={apply} />
      <Findings grid={grid} />
      <section aria-labelledby="trial-schema" className="min-w-0">
        <h3 id="trial-schema" className="mb-3 font-semibold">
          Trial schema
        </h3>
        <TrialSchemaFigure grid={grid} />
      </section>
    </div>
  );
}

function DraftOffer({
  record,
  onRestore,
  onDiscard,
}: {
  readonly record: StudyWorkspaceDraftRecord;
  readonly onRestore: (record: StudyWorkspaceDraftRecord) => void;
  readonly onDiscard: () => void;
}) {
  const plans = record.workspace.randomizationPlans.length;
  return (
    <section
      aria-labelledby="draft-offer"
      className="space-y-3 rounded border border-white/[0.08] bg-[#13151a] px-4 py-3 text-sm"
    >
      <h3 id="draft-offer" className="font-semibold text-[#f4f4f6]">
        A saved draft is in this browser
      </h3>
      <p className="text-slate-300">
        {record.workspace.usdm.study.name} at revision{" "}
        <span className={MONO}>{record.workspace.revision.id}</span>
        {plans > 0 &&
          `, with ${plans} randomization plan${plans === 1 ? "" : "s"}`}
        {record.savedAt && (
          <>
            , saved{" "}
            <time dateTime={record.savedAt}>
              {new Date(record.savedAt).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </time>
          </>
        )}
        . It is not changed until you choose.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          className={BUTTON}
          onClick={() => onRestore(record)}
        >
          Restore draft
        </button>
        <button type="button" className={BUTTON} onClick={onDiscard}>
          Discard draft
        </button>
      </div>
    </section>
  );
}

function QuarantineNotice({
  entry,
  onDone,
}: {
  readonly entry: QuarantinedStudyWorkspaceDraft;
  readonly onDone: () => void;
}) {
  const download = () => {
    downloadFile(entry.raw, `study-draft-${entry.id}.json`, {
      mimeType: "application/json",
    });
  };
  const dismiss = () => {
    dismissQuarantinedStudyWorkspaceDraft(entry.id);
    onDone();
  };
  return (
    <section
      role="alert"
      className="space-y-3 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
    >
      <p>
        A saved draft could not be opened (
        <span className={MONO}>{entry.problem}</span>). Its original text was
        set aside; download it before you dismiss it.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={BUTTON} onClick={download}>
          Download unreadable draft
        </button>
        <button type="button" className={BUTTON} onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </section>
  );
}

function DraftAutosave({
  workspace,
  ui,
  baseWriteId,
  enabled,
}: {
  readonly workspace: StudyWorkspace;
  readonly ui: Readonly<Record<string, unknown>>;
  readonly baseWriteId: string | null;
  readonly enabled: boolean;
}) {
  const draft = useStudyWorkspaceDraft(workspace, ui, {
    baseWriteId,
    enabled,
  });
  const text = {
    idle: "Edits are saved in this browser as you work.",
    saving: "Saving draft…",
    saved: "Draft saved in this browser.",
    unavailable: draft.errorMessage,
    error: draft.errorMessage,
    conflict: "Another tab saved a different draft, so this one was not saved.",
  }[draft.status];
  const problem =
    draft.status === "error" ||
    draft.status === "unavailable" ||
    draft.status === "conflict";
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <p
        className={`min-w-0 ${problem ? "text-amber-200" : "text-slate-400"}`}
        role={problem ? "alert" : undefined}
      >
        {text}
      </p>
      {draft.status === "conflict" && (
        <button type="button" className={BUTTON} onClick={draft.keepMine}>
          Keep this tab&apos;s draft
        </button>
      )}
      {problem && (
        <button type="button" className={BUTTON} onClick={draft.downloadDraft}>
          Download workspace
        </button>
      )}
    </div>
  );
}

function isSelected(selection: Selection | null, target: Selection): boolean {
  if (!selection || selection.kind !== target.kind) return false;
  if (selection.kind === "cell" && target.kind === "cell") {
    return sameCell(selection.ref, target.ref);
  }
  return "id" in selection && "id" in target && selection.id === target.id;
}

function GridTable({
  grid,
  selection,
  onSelect,
}: {
  readonly grid: Grid;
  readonly selection: Selection | null;
  readonly onSelect: (selection: Selection) => void;
}) {
  const pick = (target: Selection) => ({
    "aria-pressed": isSelected(selection, target),
    onClick: () => onSelect(target),
  });
  if (grid.arms.length === 0 && grid.epochs.length === 0) {
    return (
      <p className="min-w-0 text-sm text-slate-400">
        This design has no arms or epochs yet. Add them below.
      </p>
    );
  }
  return (
    <div className="min-w-0 overflow-x-auto rounded-lg border border-white/[0.08]">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">
          Study design: arms by epochs. Select an arm, epoch or cell to edit it.
        </caption>
        <thead>
          <tr>
            <td className="border-b border-white/[0.08] p-2" />
            {grid.epochs.map((epoch) => (
              <th
                key={epoch.id}
                scope="col"
                className="border-b border-white/[0.08] p-2 align-bottom"
              >
                <button
                  type="button"
                  className={`${BUTTON} w-full text-left aria-pressed:border-amber-400`}
                  {...pick({ kind: "epoch", id: epoch.id })}
                >
                  <span className="block font-semibold">{epoch.name}</span>
                  <span className={`${MONO} block text-xs text-slate-400`}>
                    {epoch.type?.decode ?? "No type"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.map((row) => (
            <tr key={row.arm.id}>
              <th scope="row" className="border-t border-white/[0.08] p-2">
                <button
                  type="button"
                  className={`${BUTTON} w-full text-left aria-pressed:border-amber-400`}
                  {...pick({ kind: "arm", id: row.arm.id })}
                >
                  <span className="block font-semibold">{row.arm.name}</span>
                  <span className={`${MONO} block text-xs text-slate-400`}>
                    {row.arm.type?.decode ?? "No type"}
                  </span>
                </button>
              </th>
              {row.cells.map((cell, index) => {
                const epoch = grid.epochs[index];
                const label = `${row.arm.name}, ${epoch.name}: ${
                  cell.cellId === null
                    ? "no cell"
                    : cell.elements.length === 0
                      ? "no elements"
                      : cell.elements.map((element) => element.name).join(", ")
                }`;
                return (
                  <td
                    key={cell.epochId}
                    className="border-t border-white/[0.08] p-2 align-top"
                  >
                    <button
                      type="button"
                      aria-label={label}
                      className={`${BUTTON} w-full text-left aria-pressed:border-amber-400`}
                      {...pick({
                        kind: "cell",
                        ref: { armId: cell.armId, epochId: cell.epochId },
                      })}
                    >
                      {cell.cellId === null ? (
                        <span className="text-amber-300">No cell</span>
                      ) : cell.elements.length === 0 ? (
                        <span className="text-slate-400">Empty</span>
                      ) : (
                        <span className="flex flex-col gap-1">
                          {cell.elements.map((element) => (
                            <span key={element.id} className="break-words">
                              {element.name}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Apply = (make: (workspace: StudyWorkspace) => StudyEdit) => boolean;

function NameForm({
  label,
  initial,
  submitLabel,
  onSubmit,
}: {
  readonly label: string;
  readonly initial: string;
  readonly submitLabel: string;
  /** Returns true when the edit applied; an empty start clears the field then. */
  readonly onSubmit: (name: string) => boolean;
}) {
  const [name, setName] = useState(initial);
  const id = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (onSubmit(name) && initial === "") setName("");
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <label
        htmlFor={id}
        className="flex min-w-0 flex-1 flex-col gap-1 text-sm"
      >
        {label}
        <input
          id={id}
          className={FIELD}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <button type="submit" className={`${BUTTON} min-w-12`}>
        {submitLabel}
      </button>
    </form>
  );
}

function Inspector({
  grid,
  selection,
  onSelect,
  apply,
}: {
  readonly grid: Grid;
  readonly selection: Selection | null;
  readonly onSelect: (selection: Selection | null) => void;
  readonly apply: Apply;
}) {
  const panel =
    "min-w-0 space-y-4 rounded-lg border border-white/[0.08] bg-[#13151a] p-4";
  if (!selection) {
    return (
      <section aria-label="Edit selection" className={panel}>
        <p className="text-sm text-slate-400">
          Select an arm, an epoch or a cell to edit it.
        </p>
      </section>
    );
  }

  if (selection.kind === "arm") {
    const index = grid.arms.findIndex((arm) => arm.id === selection.id);
    const arm = grid.arms[index];
    if (!arm) return null;
    return (
      <section aria-label={`Edit arm ${arm.name}`} className={panel}>
        <h3 className="font-semibold">Arm: {arm.name}</h3>
        <dl className={`${MONO} space-y-1 text-xs text-slate-400`}>
          <div>
            <dt className="inline">Type: </dt>
            <dd className="inline">
              {arm.type ? `${arm.type.decode} (${arm.type.code})` : "None"}
            </dd>
          </div>
          <div>
            <dt className="inline">Data origin: </dt>
            <dd className="inline">
              {arm.dataOrigin
                ? `${arm.dataOrigin.decode} (${arm.dataOrigin.code})`
                : "None"}
            </dd>
          </div>
        </dl>
        <NameForm
          label="Arm name"
          initial={arm.name}
          submitLabel="Rename"
          onSubmit={(name) => apply((w) => renameStudyArm(w, arm.id, name))}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BUTTON}
            disabled={index === 0}
            onClick={() => apply((w) => moveStudyArm(w, arm.id, index - 1))}
          >
            Move up
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === grid.arms.length - 1}
            onClick={() => apply((w) => moveStudyArm(w, arm.id, index + 1))}
          >
            Move down
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              if (apply((w) => removeStudyArm(w, arm.id))) onSelect(null);
            }}
          >
            Remove arm
          </button>
        </div>
      </section>
    );
  }

  if (selection.kind === "epoch") {
    const index = grid.epochs.findIndex((epoch) => epoch.id === selection.id);
    const epoch = grid.epochs[index];
    if (!epoch) return null;
    return (
      <section aria-label={`Edit epoch ${epoch.name}`} className={panel}>
        <h3 className="font-semibold">Epoch: {epoch.name}</h3>
        <p className={`${MONO} text-xs text-slate-400`}>
          Type:{" "}
          {epoch.type ? `${epoch.type.decode} (${epoch.type.code})` : "None"}
        </p>
        <NameForm
          label="Epoch name"
          initial={epoch.name}
          submitLabel="Rename"
          onSubmit={(name) => apply((w) => renameStudyEpoch(w, epoch.id, name))}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={BUTTON}
            disabled={index === 0}
            onClick={() => apply((w) => moveStudyEpoch(w, epoch.id, index - 1))}
          >
            Move earlier
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === grid.epochs.length - 1}
            onClick={() => apply((w) => moveStudyEpoch(w, epoch.id, index + 1))}
          >
            Move later
          </button>
          <button
            type="button"
            className={BUTTON}
            onClick={() => {
              if (apply((w) => removeStudyEpoch(w, epoch.id))) onSelect(null);
            }}
          >
            Remove epoch
          </button>
        </div>
      </section>
    );
  }

  const ref = selection.ref;
  const row = grid.rows.find((r) => r.arm.id === ref.armId);
  const epochIndex = grid.epochs.findIndex((e) => e.id === ref.epochId);
  const cell = row?.cells[epochIndex];
  if (!row || !cell) return null;
  const where = `${row.arm.name}, ${grid.epochs[epochIndex].name}`;

  if (selection.kind === "element") {
    const position = cell.elements.findIndex((e) => e.id === selection.id);
    const element = cell.elements[position];
    if (!element) return null;
    return (
      <ElementInspector
        grid={grid}
        where={where}
        refCell={ref}
        element={element}
        position={position}
        count={cell.elements.length}
        onSelect={onSelect}
        apply={apply}
        className={panel}
      />
    );
  }

  return (
    <section aria-label={`Edit cell ${where}`} className={panel}>
      <h3 className="font-semibold">Cell: {where}</h3>
      {cell.cellId === null && (
        <p className="text-sm text-amber-300">
          The design has no cell here. Adding an element creates one.
        </p>
      )}
      {cell.elements.length > 0 && (
        <ul className="space-y-2">
          {cell.elements.map((element) => (
            <li key={element.id}>
              <button
                type="button"
                className={`${BUTTON} w-full text-left`}
                onClick={() =>
                  onSelect({ kind: "element", id: element.id, ref })
                }
              >
                Edit element {element.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <NameForm
        label="New element name"
        initial=""
        submitLabel="Add element"
        onSubmit={(name) => apply((w) => addStudyElement(w, { ...ref, name }))}
      />
    </section>
  );
}

function ElementInspector({
  grid,
  where,
  refCell,
  element,
  position,
  count,
  onSelect,
  apply,
  className,
}: {
  readonly grid: Grid;
  readonly where: string;
  readonly refCell: StudyDesignCellRef;
  readonly element: { readonly id: string; readonly name: string };
  readonly position: number;
  readonly count: number;
  readonly onSelect: (selection: Selection | null) => void;
  readonly apply: Apply;
  readonly className: string;
}) {
  const targets = grid.rows.flatMap((row) =>
    row.cells
      .map((cell, index) => ({
        armId: cell.armId,
        epochId: cell.epochId,
        label: `${row.arm.name}, ${grid.epochs[index].name}`,
      }))
      .filter((target) => !sameCell(target, refCell))
  );
  const [target, setTarget] = useState(0);
  const moveId = useId();
  const reorder = (index: number) =>
    apply((w) =>
      moveStudyElement(w, {
        elementId: element.id,
        from: refCell,
        to: refCell,
        index,
      })
    );
  const moveTo = (event: FormEvent) => {
    event.preventDefault();
    const to = targets[target];
    if (!to) return;
    const ref = { armId: to.armId, epochId: to.epochId };
    if (
      apply((w) =>
        moveStudyElement(w, { elementId: element.id, from: refCell, to: ref })
      )
    ) {
      onSelect({ kind: "element", id: element.id, ref });
    }
  };
  return (
    <section aria-label={`Edit element ${element.name}`} className={className}>
      <h3 className="font-semibold">Element: {element.name}</h3>
      <p className="text-sm text-slate-400">In {where}</p>
      <NameForm
        label="Element name"
        initial={element.name}
        submitLabel="Rename"
        onSubmit={(name) =>
          apply((w) => renameStudyElement(w, element.id, name))
        }
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BUTTON}
          disabled={position === 0}
          onClick={() => reorder(position - 1)}
        >
          Move up
        </button>
        <button
          type="button"
          className={BUTTON}
          disabled={position === count - 1}
          onClick={() => reorder(position + 1)}
        >
          Move down
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={() => {
            if (
              apply((w) =>
                removeStudyElement(w, { ...refCell, elementId: element.id })
              )
            ) {
              onSelect({ kind: "cell", ref: refCell });
            }
          }}
        >
          Remove from cell
        </button>
      </div>
      {targets.length > 0 && (
        <form onSubmit={moveTo} className="flex flex-wrap items-end gap-2">
          <label
            htmlFor={moveId}
            className="flex min-w-0 flex-1 flex-col gap-1 text-sm"
          >
            Move to cell
            <select
              id={moveId}
              className={FIELD}
              value={target}
              onChange={(event) => setTarget(Number(event.target.value))}
            >
              {targets.map((option, index) => (
                <option key={`${option.armId}:${option.epochId}`} value={index}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={`${BUTTON} min-w-12`}>
            Move
          </button>
        </form>
      )}
      <button
        type="button"
        className={BUTTON}
        onClick={() => onSelect({ kind: "cell", ref: refCell })}
      >
        Back to cell
      </button>
    </section>
  );
}

function AddForm({
  legend,
  nameLabel,
  typeLabel,
  types,
  onAdd,
}: {
  readonly legend: string;
  readonly nameLabel: string;
  readonly typeLabel: string;
  readonly types: readonly { readonly code: string; readonly decode: string }[];
  readonly onAdd: (name: string, typeCode: string) => boolean;
}) {
  const [name, setName] = useState("");
  const [typeCode, setTypeCode] = useState(types[0]?.code ?? "");
  const nameId = useId();
  const typeId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (onAdd(name, typeCode)) setName("");
  };
  return (
    <form
      onSubmit={submit}
      className="min-w-0 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
    >
      <fieldset className="flex min-w-0 flex-wrap items-end gap-2">
        <legend className="mb-2 font-semibold">{legend}</legend>
        <label
          htmlFor={nameId}
          className="flex min-w-0 flex-1 flex-col gap-1 text-sm"
        >
          {nameLabel}
          <input
            id={nameId}
            className={FIELD}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label
          htmlFor={typeId}
          className="flex min-w-0 flex-1 flex-col gap-1 text-sm"
        >
          {typeLabel}
          <select
            id={typeId}
            className={FIELD}
            value={typeCode}
            onChange={(event) => setTypeCode(event.target.value)}
          >
            {types.map((type) => (
              <option key={type.code} value={type.code}>
                {type.decode} ({type.code})
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={`${BUTTON} min-w-12`}>
          Add
        </button>
      </fieldset>
    </form>
  );
}

function AddForms({ apply }: { readonly apply: Apply }) {
  return (
    <div className="grid gap-4 @2xl:grid-cols-2">
      <AddForm
        legend="Add an arm"
        nameLabel="Arm name"
        typeLabel="Arm type"
        types={STUDY_ARM_TYPES}
        onAdd={(name, typeCode) =>
          apply((w) => addStudyArm(w, { name, typeCode }))
        }
      />
      <AddForm
        legend="Add an epoch"
        nameLabel="Epoch name"
        typeLabel="Epoch type"
        types={STUDY_EPOCH_TYPES}
        onAdd={(name, typeCode) =>
          apply((w) => addStudyEpoch(w, { name, typeCode }))
        }
      />
    </div>
  );
}

function Findings({ grid }: { readonly grid: Grid }) {
  return (
    <section aria-labelledby="design-findings" className="min-w-0">
      <h3 id="design-findings" className="font-semibold">
        Findings
      </h3>
      {grid.findings.length === 0 ? (
        <p className="mt-2 text-sm text-emerald-300">
          Every arm and epoch pair has a cell.
        </p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">
          {grid.findings.map((finding, index) => (
            <li key={`${finding.kind}:${finding.ids.join(":")}:${index}`}>
              {finding.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
