"use client";

import { useId, useState, type FormEvent } from "react";
import {
  STUDY_INTERVENTION_ROLES,
  STUDY_INTERVENTION_TYPES,
  addStudyIntervention,
  assignStudyIntervention,
  projectStudyInterventions,
  removeStudyIntervention,
  unassignStudyIntervention,
  updateStudyIntervention,
  type StudyDesignGrid,
  type StudyDesignTerm,
  type StudyEdit,
  type StudyInterventionView,
  type StudyWorkspace,
} from "@/lib/study-workspace";

type Apply = (make: (workspace: StudyWorkspace) => StudyEdit) => boolean;

const BUTTON =
  "min-h-12 min-w-12 rounded border border-white/[0.08] bg-[#0d0e11] px-3 py-1.5 text-sm text-[#f4f4f6] hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
const FIELD =
  "min-h-12 min-w-0 rounded border border-white/[0.08] bg-[#0d0e11] px-2 py-1.5 text-sm text-[#f4f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";
const MONO = "font-[family-name:var(--font-geist-mono)]";

/** Every element in the design, with the arm and epoch it sits in. */
function elementsOf(grid: StudyDesignGrid) {
  const epochNames = new Map(grid.epochs.map((e) => [e.id, e.name]));
  const seen = new Map<string, string>();
  for (const row of grid.rows) {
    for (const cell of row.cells) {
      for (const element of cell.elements) {
        if (!seen.has(element.id)) {
          seen.set(
            element.id,
            `${element.name} (${row.arm.name}, ${epochNames.get(cell.epochId) ?? cell.epochId})`
          );
        }
      }
    }
  }
  return [...seen].map(([id, label]) => ({ id, label }));
}

const termLabel = (term: StudyDesignTerm | null) =>
  term ? `${term.decode} (${term.code})` : "Not given";

/**
 * The interventions of the selected design (#3406): what each one is, its
 * coded role and type, and the elements of the grid it is given in. Role
 * and type offer only terms from the pinned CT package. Every change is a
 * workspace edit, so it can be undone.
 */
export function InterventionsPanel({
  workspace,
  grid,
  apply,
}: {
  readonly workspace: StudyWorkspace;
  readonly grid: StudyDesignGrid;
  readonly apply: Apply;
}) {
  const interventions = projectStudyInterventions(workspace);
  const elements = elementsOf(grid);
  return (
    <section aria-labelledby="interventions" className="min-w-0 space-y-4">
      <h3 id="interventions" className="font-semibold">
        Interventions
      </h3>
      {interventions.length === 0 ? (
        <p className="text-sm text-slate-400">
          The design names no interventions yet.
        </p>
      ) : (
        <ul className="grid gap-4 @3xl:grid-cols-2">
          {interventions.map((item) => (
            <li key={item.id} className="min-w-0">
              <InterventionCard item={item} elements={elements} apply={apply} />
            </li>
          ))}
        </ul>
      )}
      <InterventionForm
        legend="Add an intervention"
        submit="Add"
        onSubmit={(fields) => apply((w) => addStudyIntervention(w, fields))}
      />
    </section>
  );
}

function InterventionCard({
  item,
  elements,
  apply,
}: {
  readonly item: StudyInterventionView;
  readonly elements: readonly { id: string; label: string }[];
  readonly apply: Apply;
}) {
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState("");
  const selectId = useId();
  const labels = new Map(elements.map((e) => [e.id, e.label]));
  const free = elements.filter((e) => !item.elementIds.includes(e.id));
  const chosen = free.some((e) => e.id === target)
    ? target
    : (free[0]?.id ?? "");

  return (
    <article
      aria-label={`Intervention ${item.name}`}
      className="h-full space-y-3 rounded border border-white/[0.08] bg-[#13151a] p-4 text-sm"
    >
      <h4 className="font-semibold text-[#f4f4f6]">{item.name}</h4>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-slate-300">
        <dt className="text-slate-400">Role</dt>
        <dd className={MONO}>{termLabel(item.role)}</dd>
        <dt className="text-slate-400">Type</dt>
        <dd className={MONO}>{termLabel(item.type)}</dd>
      </dl>
      {item.description && <p className="text-slate-300">{item.description}</p>}

      <div>
        <p className="text-slate-400">Given in</p>
        {item.elementIds.length === 0 ? (
          <p className="text-amber-200">No element gives it yet.</p>
        ) : (
          <ul className="mt-1 space-y-2">
            {item.elementIds.map((elementId) => (
              <li key={elementId} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0">
                  {labels.get(elementId) ?? elementId}
                </span>
                <button
                  type="button"
                  className={BUTTON}
                  aria-label={`Stop giving ${item.name} in ${labels.get(elementId) ?? elementId}`}
                  onClick={() =>
                    apply((w) =>
                      unassignStudyIntervention(w, elementId, item.id)
                    )
                  }
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {free.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label
            htmlFor={selectId}
            className="flex min-w-0 flex-1 flex-col gap-1 text-slate-300"
          >
            Give in element
            <select
              id={selectId}
              className={FIELD}
              value={chosen}
              onChange={(event) => setTarget(event.target.value)}
            >
              {free.map((element) => (
                <option key={element.id} value={element.id}>
                  {element.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className={BUTTON}
            onClick={() =>
              apply((w) => assignStudyIntervention(w, chosen, item.id))
            }
          >
            Give
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={BUTTON}
          aria-expanded={editing}
          onClick={() => setEditing((open) => !open)}
        >
          {editing ? "Close editor" : "Edit"}
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={() => apply((w) => removeStudyIntervention(w, item.id))}
        >
          Delete intervention
        </button>
      </div>
      {editing && (
        <InterventionForm
          legend={`Edit ${item.name}`}
          submit="Save"
          initial={item}
          onSubmit={(fields) => {
            const done = apply((w) =>
              updateStudyIntervention(w, item.id, fields)
            );
            if (done) setEditing(false);
            return done;
          }}
        />
      )}
    </article>
  );
}

interface InterventionFields {
  readonly name: string;
  readonly description: string;
  readonly roleCode: string;
  readonly typeCode: string;
}

function InterventionForm({
  legend,
  submit,
  initial,
  onSubmit,
}: {
  readonly legend: string;
  readonly submit: string;
  readonly initial?: StudyInterventionView;
  readonly onSubmit: (fields: InterventionFields) => boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [roleCode, setRoleCode] = useState(
    initial?.role?.code ?? STUDY_INTERVENTION_ROLES[0].code
  );
  const [typeCode, setTypeCode] = useState(
    initial?.type?.code ?? STUDY_INTERVENTION_TYPES[0].code
  );
  const ids = useId();

  const handle = (event: FormEvent) => {
    event.preventDefault();
    if (onSubmit({ name, description, roleCode, typeCode }) && !initial) {
      setName("");
      setDescription("");
    }
  };

  return (
    <form onSubmit={handle}>
      <fieldset className="grid gap-3 rounded border border-white/[0.08] bg-[#13151a] p-4 @2xl:grid-cols-2">
        <legend className="px-1 font-semibold">{legend}</legend>
        <label
          htmlFor={`${ids}-name`}
          className="flex min-w-0 flex-col gap-1 text-sm text-slate-300"
        >
          Intervention name
          <input
            id={`${ids}-name`}
            className={FIELD}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label
          htmlFor={`${ids}-description`}
          className="flex min-w-0 flex-col gap-1 text-sm text-slate-300"
        >
          Description
          <input
            id={`${ids}-description`}
            className={FIELD}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <TermSelect
          id={`${ids}-role`}
          label="Role"
          terms={STUDY_INTERVENTION_ROLES}
          value={roleCode}
          onChange={setRoleCode}
        />
        <TermSelect
          id={`${ids}-type`}
          label="Type"
          terms={STUDY_INTERVENTION_TYPES}
          value={typeCode}
          onChange={setTypeCode}
        />
        <div>
          <button type="submit" className={`${BUTTON} min-w-12`}>
            {submit}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function TermSelect({
  id,
  label,
  terms,
  value,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly terms: readonly StudyDesignTerm[];
  readonly value: string;
  readonly onChange: (code: string) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex min-w-0 flex-col gap-1 text-sm text-slate-300"
    >
      {label}
      <select
        id={id}
        className={FIELD}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {terms.map((term) => (
          <option key={term.code} value={term.code}>
            {term.decode} ({term.code})
          </option>
        ))}
      </select>
    </label>
  );
}
