"use client";

import { useId, useState, type FormEvent } from "react";
import {
  STUDY_CRITERION_CATEGORIES,
  STUDY_ENDPOINT_LEVELS,
  STUDY_OBJECTIVE_LEVELS,
  addStudyCriterion,
  addStudyEndpoint,
  addStudyObjective,
  moveStudyCriterion,
  moveStudyEndpoint,
  moveStudyObjective,
  projectStudyNarrative,
  removeStudyCriterion,
  removeStudyEndpoint,
  removeStudyObjective,
  updateStudyCriterion,
  updateStudyEndpoint,
  updateStudyObjective,
  type StudyCriterionView,
  type StudyEndpointView,
  type StudyObjectiveView,
  type StudyWorkspace,
} from "@/lib/study-workspace";
import type { StudyApplyFn } from "./StudyDesignGrid";

const BUTTON =
  "min-h-12 rounded border border-white/[0.08] bg-[#0d0e11] px-3 py-1.5 text-sm text-[#f4f4f6] hover:border-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]";
const FIELD =
  "min-h-12 min-w-0 max-w-full rounded border border-white/[0.08] bg-[#0d0e11] px-2.5 py-1.5 text-sm text-[#f4f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";
const TEXTAREA =
  "min-h-20 min-w-0 max-w-full rounded border border-white/[0.08] bg-[#0d0e11] px-2.5 py-2 text-sm text-[#f4f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";
const MONO = "font-[family-name:var(--font-geist-mono)] tabular-nums";

/**
 * Interactive Narrative view: study objectives, nested endpoints, and
 * eligibility criteria with coded CDISC levels/categories, structured text
 * inputs, keyboard reorder controls, and explicit findings.
 */
export function StudyNarrativePanel({
  workspace,
  apply,
}: {
  readonly workspace: StudyWorkspace;
  readonly apply: StudyApplyFn;
}) {
  const narrative = projectStudyNarrative(workspace);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#13151a] px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[#f4f4f6]">
            Protocol objectives, endpoints &amp; eligibility
          </h3>
          <p className="text-xs text-slate-400">
            Coded CDISC Objective Level, Endpoint Level, and IECAT categories
            paired with structured USDM text items.
          </p>
        </div>
        <div className={`${MONO} flex flex-wrap gap-3 text-xs text-slate-300`}>
          <span>
            {narrative.objectives.length}{" "}
            {narrative.objectives.length === 1 ? "objective" : "objectives"}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            {narrative.endpointCount}{" "}
            {narrative.endpointCount === 1 ? "endpoint" : "endpoints"}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            {narrative.criteria.length}{" "}
            {narrative.criteria.length === 1 ? "criterion" : "criteria"}
          </span>
        </div>
      </div>

      <section
        aria-labelledby="narrative-objectives-heading"
        className="space-y-4"
      >
        <h3 id="narrative-objectives-heading" className="text-lg font-semibold">
          Objectives &amp; endpoints
        </h3>
        {narrative.objectives.length === 0 ? (
          <p className="text-sm text-slate-400">
            This study design has no objectives yet. Add one below.
          </p>
        ) : (
          <ol className="space-y-4">
            {narrative.objectives.map((objective, index) => (
              <li key={objective.id} className="min-w-0">
                <ObjectiveCard
                  objective={objective}
                  index={index}
                  count={narrative.objectives.length}
                  apply={apply}
                />
              </li>
            ))}
          </ol>
        )}
        <AddObjectiveForm apply={apply} />
      </section>

      <section
        aria-labelledby="narrative-criteria-heading"
        className="space-y-4"
      >
        <h3 id="narrative-criteria-heading" className="text-lg font-semibold">
          Eligibility criteria
        </h3>
        {narrative.criteria.length === 0 ? (
          <p className="text-sm text-slate-400">
            This study design has no eligibility criteria yet. Add one below.
          </p>
        ) : (
          <ol className="space-y-3">
            {narrative.criteria.map((criterion, index) => (
              <li key={criterion.id} className="min-w-0">
                <CriterionCard
                  criterion={criterion}
                  index={index}
                  count={narrative.criteria.length}
                  apply={apply}
                />
              </li>
            ))}
          </ol>
        )}
        <AddCriterionForm apply={apply} />
      </section>

      <section aria-labelledby="narrative-findings" className="min-w-0">
        <h3 id="narrative-findings" className="font-semibold">
          Narrative findings
        </h3>
        {narrative.findings.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-300">
            Every objective, endpoint, and eligibility criterion has its coded
            level/category and structured text.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">
            {narrative.findings.map((finding, idx) => (
              <li key={`${finding.kind}:${finding.ids.join(":")}:${idx}`}>
                {finding.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ObjectiveCard({
  objective,
  index,
  count,
  apply,
}: {
  readonly objective: StudyObjectiveView;
  readonly index: number;
  readonly count: number;
  readonly apply: StudyApplyFn;
}) {
  const [editing, setEditing] = useState(false);
  const [addingEndpoint, setAddingEndpoint] = useState(false);
  const [name, setName] = useState(objective.name);
  const [levelCode, setLevelCode] = useState(
    objective.level?.code ?? STUDY_OBJECTIVE_LEVELS[0].code
  );
  const [text, setText] = useState(objective.text);

  const nameId = useId();
  const levelId = useId();
  const textId = useId();

  const openEditor = () => {
    setName(objective.name);
    setLevelCode(objective.level?.code ?? STUDY_OBJECTIVE_LEVELS[0].code);
    setText(objective.text);
    setEditing(true);
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    if (
      apply((w) =>
        updateStudyObjective(w, objective.id, { name, levelCode, text })
      )
    ) {
      setEditing(false);
    }
  };

  return (
    <article
      aria-label={`Objective ${objective.name}`}
      className="min-w-0 space-y-4 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`${MONO} text-xs text-amber-300`}>
            {objective.level
              ? `${objective.level.decode} (${objective.level.code})`
              : "Missing coded level"}
          </p>
          <h4 className="break-words text-base font-semibold text-[#f4f4f6]">
            {objective.name}
          </h4>
          {objective.text.trim() ? (
            <p className="break-words text-sm leading-relaxed text-slate-300">
              {objective.text}
            </p>
          ) : (
            <p className="text-sm text-amber-300">
              No structured objective text recorded.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={editing}
            className={BUTTON}
            onClick={() => (editing ? setEditing(false) : openEditor())}
          >
            {editing ? "Close editor" : `Edit ${objective.name}`}
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === 0}
            aria-label={`Move objective ${objective.name} up`}
            onClick={() =>
              apply((w) => moveStudyObjective(w, objective.id, index - 1))
            }
          >
            Move up
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === count - 1}
            aria-label={`Move objective ${objective.name} down`}
            onClick={() =>
              apply((w) => moveStudyObjective(w, objective.id, index + 1))
            }
          >
            Move down
          </button>
          <button
            type="button"
            className={BUTTON}
            aria-label={`Remove objective ${objective.name}`}
            onClick={() => apply((w) => removeStudyObjective(w, objective.id))}
          >
            Remove
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="space-y-3 rounded border border-white/[0.08] bg-[#0d0e11]/70 p-3"
        >
          <div className="grid gap-3 @lg:grid-cols-2">
            <label
              htmlFor={nameId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Objective name
              <input
                id={nameId}
                className={FIELD}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label
              htmlFor={levelId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Objective level
              <select
                id={levelId}
                className={FIELD}
                value={levelCode}
                onChange={(event) => setLevelCode(event.target.value)}
              >
                {STUDY_OBJECTIVE_LEVELS.map((term) => (
                  <option key={term.code} value={term.code}>
                    {term.decode} ({term.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label
            htmlFor={textId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Objective text
            <textarea
              id={textId}
              rows={3}
              className={TEXTAREA}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={`${BUTTON} min-w-12`}>
              Save objective
            </button>
            <button
              type="button"
              className={BUTTON}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3 border-t border-white/[0.08] pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h5
            className={`${MONO} text-xs uppercase tracking-wider text-slate-400`}
          >
            Nested endpoints ({objective.endpoints.length})
          </h5>
          <button
            type="button"
            aria-expanded={addingEndpoint}
            className={BUTTON}
            onClick={() => setAddingEndpoint((prev) => !prev)}
          >
            {addingEndpoint
              ? "Cancel new endpoint"
              : `Add endpoint to ${objective.name}`}
          </button>
        </div>

        {objective.endpoints.length > 0 && (
          <ol className="space-y-2.5">
            {objective.endpoints.map((endpoint, epIndex) => (
              <li key={endpoint.id} className="min-w-0">
                <EndpointCard
                  endpoint={endpoint}
                  index={epIndex}
                  count={objective.endpoints.length}
                  apply={apply}
                />
              </li>
            ))}
          </ol>
        )}

        {addingEndpoint && (
          <AddEndpointForm
            objectiveId={objective.id}
            apply={apply}
            onAdded={() => setAddingEndpoint(false)}
          />
        )}
      </div>
    </article>
  );
}

function EndpointCard({
  endpoint,
  index,
  count,
  apply,
}: {
  readonly endpoint: StudyEndpointView;
  readonly index: number;
  readonly count: number;
  readonly apply: StudyApplyFn;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(endpoint.name);
  const [levelCode, setLevelCode] = useState(
    endpoint.level?.code ?? STUDY_ENDPOINT_LEVELS[0].code
  );
  const [purpose, setPurpose] = useState(endpoint.purpose);
  const [text, setText] = useState(endpoint.text);

  const nameId = useId();
  const levelId = useId();
  const purposeId = useId();
  const textId = useId();

  const openEditor = () => {
    setName(endpoint.name);
    setLevelCode(endpoint.level?.code ?? STUDY_ENDPOINT_LEVELS[0].code);
    setPurpose(endpoint.purpose);
    setText(endpoint.text);
    setEditing(true);
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    if (
      apply((w) =>
        updateStudyEndpoint(w, {
          objectiveId: endpoint.objectiveId,
          endpointId: endpoint.id,
          name,
          levelCode,
          purpose,
          text,
        })
      )
    ) {
      setEditing(false);
    }
  };

  return (
    <div className="min-w-0 space-y-3 rounded border border-white/[0.08] bg-[#0d0e11] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div
            className={`${MONO} flex flex-wrap gap-2 text-xs text-slate-400`}
          >
            <span>
              {endpoint.level
                ? `${endpoint.level.decode} (${endpoint.level.code})`
                : "Missing level"}
            </span>
            <span aria-hidden="true">·</span>
            <span>Purpose: {endpoint.purpose.trim() || "Missing purpose"}</span>
          </div>
          <p className="break-words font-medium text-[#f4f4f6]">
            {endpoint.name}
          </p>
          {endpoint.text.trim() ? (
            <p className="break-words text-sm text-slate-300">
              {endpoint.text}
            </p>
          ) : (
            <p className="text-sm text-amber-300">
              No structured endpoint text recorded.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={editing}
            className={BUTTON}
            onClick={() => (editing ? setEditing(false) : openEditor())}
          >
            {editing ? "Close" : `Edit endpoint ${endpoint.name}`}
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === 0}
            aria-label={`Move endpoint ${endpoint.name} up`}
            onClick={() =>
              apply((w) =>
                moveStudyEndpoint(w, {
                  objectiveId: endpoint.objectiveId,
                  endpointId: endpoint.id,
                  toIndex: index - 1,
                })
              )
            }
          >
            Move up
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === count - 1}
            aria-label={`Move endpoint ${endpoint.name} down`}
            onClick={() =>
              apply((w) =>
                moveStudyEndpoint(w, {
                  objectiveId: endpoint.objectiveId,
                  endpointId: endpoint.id,
                  toIndex: index + 1,
                })
              )
            }
          >
            Move down
          </button>
          <button
            type="button"
            className={BUTTON}
            aria-label={`Remove endpoint ${endpoint.name}`}
            onClick={() =>
              apply((w) =>
                removeStudyEndpoint(w, {
                  objectiveId: endpoint.objectiveId,
                  endpointId: endpoint.id,
                })
              )
            }
          >
            Remove
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="space-y-3 border-t border-white/[0.08] pt-3"
        >
          <div className="grid gap-2 @lg:grid-cols-3">
            <label
              htmlFor={nameId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Endpoint name
              <input
                id={nameId}
                className={FIELD}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label
              htmlFor={levelId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Endpoint level
              <select
                id={levelId}
                className={FIELD}
                value={levelCode}
                onChange={(event) => setLevelCode(event.target.value)}
              >
                {STUDY_ENDPOINT_LEVELS.map((term) => (
                  <option key={term.code} value={term.code}>
                    {term.decode} ({term.code})
                  </option>
                ))}
              </select>
            </label>
            <label
              htmlFor={purposeId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Purpose
              <input
                id={purposeId}
                className={FIELD}
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              />
            </label>
          </div>
          <label
            htmlFor={textId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Endpoint text
            <textarea
              id={textId}
              rows={2}
              className={TEXTAREA}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={`${BUTTON} min-w-12`}>
              Save endpoint
            </button>
            <button
              type="button"
              className={BUTTON}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function AddObjectiveForm({ apply }: { readonly apply: StudyApplyFn }) {
  const [name, setName] = useState("");
  const [levelCode, setLevelCode] = useState(STUDY_OBJECTIVE_LEVELS[0].code);
  const [text, setText] = useState("");
  const nameId = useId();
  const levelId = useId();
  const textId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (apply((w) => addStudyObjective(w, { name, levelCode, text }))) {
      setName("");
      setText("");
    }
  };

  return (
    <form
      onSubmit={submit}
      className="min-w-0 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
    >
      <fieldset className="min-w-0 space-y-3">
        <legend className="mb-1 font-semibold">Add an objective</legend>
        <div className="grid gap-3 @lg:grid-cols-2">
          <label
            htmlFor={nameId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            New objective name
            <input
              id={nameId}
              className={FIELD}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label
            htmlFor={levelId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Objective level
            <select
              id={levelId}
              className={FIELD}
              value={levelCode}
              onChange={(event) => setLevelCode(event.target.value)}
            >
              {STUDY_OBJECTIVE_LEVELS.map((term) => (
                <option key={term.code} value={term.code}>
                  {term.decode} ({term.code})
                </option>
              ))}
            </select>
          </label>
        </div>
        <label htmlFor={textId} className="flex min-w-0 flex-col gap-1 text-sm">
          Objective text
          <textarea
            id={textId}
            rows={2}
            className={TEXTAREA}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button type="submit" className={`${BUTTON} min-w-12`}>
          Add objective
        </button>
      </fieldset>
    </form>
  );
}

function AddEndpointForm({
  objectiveId,
  apply,
  onAdded,
}: {
  readonly objectiveId: string;
  readonly apply: StudyApplyFn;
  readonly onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [levelCode, setLevelCode] = useState(STUDY_ENDPOINT_LEVELS[0].code);
  const [purpose, setPurpose] = useState("Efficacy");
  const [text, setText] = useState("");

  const nameId = useId();
  const levelId = useId();
  const purposeId = useId();
  const textId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      apply((w) =>
        addStudyEndpoint(w, { objectiveId, name, levelCode, purpose, text })
      )
    ) {
      setName("");
      setText("");
      onAdded();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="min-w-0 space-y-3 rounded border border-white/[0.08] bg-[#0d0e11] p-3"
    >
      <div className="grid gap-2 @lg:grid-cols-3">
        <label htmlFor={nameId} className="flex min-w-0 flex-col gap-1 text-sm">
          New endpoint name
          <input
            id={nameId}
            className={FIELD}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label
          htmlFor={levelId}
          className="flex min-w-0 flex-col gap-1 text-sm"
        >
          Endpoint level
          <select
            id={levelId}
            className={FIELD}
            value={levelCode}
            onChange={(event) => setLevelCode(event.target.value)}
          >
            {STUDY_ENDPOINT_LEVELS.map((term) => (
              <option key={term.code} value={term.code}>
                {term.decode} ({term.code})
              </option>
            ))}
          </select>
        </label>
        <label
          htmlFor={purposeId}
          className="flex min-w-0 flex-col gap-1 text-sm"
        >
          Purpose
          <input
            id={purposeId}
            className={FIELD}
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
          />
        </label>
      </div>
      <label htmlFor={textId} className="flex min-w-0 flex-col gap-1 text-sm">
        Endpoint text
        <textarea
          id={textId}
          rows={2}
          className={TEXTAREA}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button type="submit" className={`${BUTTON} min-w-12`}>
        Add endpoint
      </button>
    </form>
  );
}

function CriterionCard({
  criterion,
  index,
  count,
  apply,
}: {
  readonly criterion: StudyCriterionView;
  readonly index: number;
  readonly count: number;
  readonly apply: StudyApplyFn;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(criterion.name);
  const [identifier, setIdentifier] = useState(criterion.identifier);
  const [categoryCode, setCategoryCode] = useState(
    criterion.category?.code ?? STUDY_CRITERION_CATEGORIES[0].code
  );
  const [text, setText] = useState(criterion.text);

  const nameId = useId();
  const identId = useId();
  const catId = useId();
  const textId = useId();

  const isInclusion = criterion.category?.code === "C25532";

  const openEditor = () => {
    setName(criterion.name);
    setIdentifier(criterion.identifier);
    setCategoryCode(
      criterion.category?.code ?? STUDY_CRITERION_CATEGORIES[0].code
    );
    setText(criterion.text);
    setEditing(true);
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    if (
      apply((w) =>
        updateStudyCriterion(w, criterion.id, {
          name,
          identifier,
          categoryCode,
          text,
        })
      )
    ) {
      setEditing(false);
    }
  };

  return (
    <article
      aria-label={`Criterion ${criterion.name}`}
      className="min-w-0 space-y-3 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className={`${MONO} flex flex-wrap items-center gap-2 text-xs`}>
            <span
              className={`rounded px-1.5 py-0.5 ${
                isInclusion
                  ? "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border border-amber-500/40 bg-amber-500/10 text-amber-200"
              }`}
            >
              {criterion.category
                ? `${criterion.category.decode} (${criterion.category.code})`
                : "Missing category"}
            </span>
            <span className="text-slate-400">
              #{criterion.identifier || "?"} · {criterion.name}
            </span>
          </div>
          {!criterion.hasCriterionItem ? (
            <p className="text-sm text-amber-300">
              Missing criterion text item (
              {criterion.criterionItemId || "unlinked"}). Edit and save to
              attach structured text.
            </p>
          ) : criterion.text.trim() ? (
            <p className="break-words text-sm leading-relaxed text-slate-200">
              {criterion.text}
            </p>
          ) : (
            <p className="text-sm text-amber-300">
              Criterion text item is empty.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={editing}
            className={BUTTON}
            onClick={() => (editing ? setEditing(false) : openEditor())}
          >
            {editing ? "Close" : `Edit criterion ${criterion.name}`}
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === 0}
            aria-label={`Move criterion ${criterion.name} up`}
            onClick={() =>
              apply((w) => moveStudyCriterion(w, criterion.id, index - 1))
            }
          >
            Move up
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === count - 1}
            aria-label={`Move criterion ${criterion.name} down`}
            onClick={() =>
              apply((w) => moveStudyCriterion(w, criterion.id, index + 1))
            }
          >
            Move down
          </button>
          <button
            type="button"
            className={BUTTON}
            aria-label={`Remove criterion ${criterion.name}`}
            onClick={() => apply((w) => removeStudyCriterion(w, criterion.id))}
          >
            Remove
          </button>
        </div>
      </div>

      {editing && (
        <form
          onSubmit={handleSave}
          className="space-y-3 border-t border-white/[0.08] pt-3"
        >
          <div className="grid gap-2 @lg:grid-cols-3">
            <label
              htmlFor={nameId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Criterion name
              <input
                id={nameId}
                className={FIELD}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label
              htmlFor={identId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Identifier
              <input
                id={identId}
                className={FIELD}
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
              />
            </label>
            <label
              htmlFor={catId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Category
              <select
                id={catId}
                className={FIELD}
                value={categoryCode}
                onChange={(event) => setCategoryCode(event.target.value)}
              >
                {STUDY_CRITERION_CATEGORIES.map((term) => (
                  <option key={term.code} value={term.code}>
                    {term.decode} ({term.code})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label
            htmlFor={textId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Criterion text
            <textarea
              id={textId}
              rows={2}
              className={TEXTAREA}
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={`${BUTTON} min-w-12`}>
              Save criterion
            </button>
            <button
              type="button"
              className={BUTTON}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

function AddCriterionForm({ apply }: { readonly apply: StudyApplyFn }) {
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [categoryCode, setCategoryCode] = useState(
    STUDY_CRITERION_CATEGORIES[0].code
  );
  const [text, setText] = useState("");

  const nameId = useId();
  const identId = useId();
  const catId = useId();
  const textId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      apply((w) =>
        addStudyCriterion(w, { name, identifier, categoryCode, text })
      )
    ) {
      setName("");
      setIdentifier("");
      setText("");
    }
  };

  return (
    <form
      onSubmit={submit}
      className="min-w-0 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
    >
      <fieldset className="min-w-0 space-y-3">
        <legend className="mb-1 font-semibold">
          Add an eligibility criterion
        </legend>
        <div className="grid gap-2 @lg:grid-cols-3">
          <label
            htmlFor={nameId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            New criterion name
            <input
              id={nameId}
              placeholder="e.g. INC05"
              className={FIELD}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label
            htmlFor={identId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Criterion identifier
            <input
              id={identId}
              placeholder="e.g. 05"
              className={FIELD}
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </label>
          <label
            htmlFor={catId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Criterion category
            <select
              id={catId}
              className={FIELD}
              value={categoryCode}
              onChange={(event) => setCategoryCode(event.target.value)}
            >
              {STUDY_CRITERION_CATEGORIES.map((term) => (
                <option key={term.code} value={term.code}>
                  {term.decode} ({term.code})
                </option>
              ))}
            </select>
          </label>
        </div>
        <label htmlFor={textId} className="flex min-w-0 flex-col gap-1 text-sm">
          New criterion text
          <textarea
            id={textId}
            rows={2}
            className={TEXTAREA}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button type="submit" className={`${BUTTON} min-w-12`}>
          Add criterion
        </button>
      </fieldset>
    </form>
  );
}
