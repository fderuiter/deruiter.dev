"use client";

import { useId, useState, type FormEvent } from "react";
import {
  STUDY_INTERCURRENT_EVENT_STRATEGIES,
  addStudyAnalysisPopulation,
  addStudyEstimand,
  addStudyIntercurrentEvent,
  moveStudyEstimand,
  moveStudyIntercurrentEvent,
  projectStudyAnalysisIntent,
  removeStudyAnalysisPopulation,
  removeStudyEstimand,
  removeStudyIntercurrentEvent,
  updateStudyAnalysisPopulation,
  updateStudyEstimand,
  updateStudyIntercurrentEvent,
  type StudyAnalysisEndpointOption,
  type StudyAnalysisInterventionOption,
  type StudyAnalysisPopulationView,
  type StudyEstimandView,
  type StudyIntercurrentEventView,
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
 * Interactive Analysis Intent view: ICH E9(R1) estimands, linked endpoints,
 * analysis populations, study interventions, and intercurrent event strategies.
 */
export function StudyAnalysisPanel({
  workspace,
  apply,
}: {
  readonly workspace: StudyWorkspace;
  readonly apply: StudyApplyFn;
}) {
  const analysis = projectStudyAnalysisIntent(workspace);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#13151a] px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-[#f4f4f6]">
            Analysis intent &amp; ICH E9(R1) estimands
          </h3>
          <p className="text-xs text-slate-400">
            Target endpoints, analysis populations, linked interventions, and
            intercurrent event strategies. Downstream statistical analysis
            records in workspace.analyses remain untouched.
          </p>
        </div>
        <div className={`${MONO} flex flex-wrap gap-3 text-xs text-slate-300`}>
          <span>
            {analysis.estimands.length}{" "}
            {analysis.estimands.length === 1 ? "estimand" : "estimands"}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            {analysis.analysisPopulations.length} analysis{" "}
            {analysis.analysisPopulations.length === 1
              ? "population"
              : "populations"}
          </span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <span>
            {analysis.availableEndpoints.length} catalog{" "}
            {analysis.availableEndpoints.length === 1
              ? "endpoint"
              : "endpoints"}
          </span>
        </div>
      </div>

      <section
        aria-labelledby="analysis-estimands-heading"
        className="space-y-4"
      >
        <h3 id="analysis-estimands-heading" className="text-lg font-semibold">
          Estimands
        </h3>
        {analysis.estimands.length === 0 ? (
          <p className="text-sm text-slate-400">
            This study design has no estimands yet. Add one below once an
            endpoint and analysis population are defined.
          </p>
        ) : (
          <ol className="space-y-4">
            {analysis.estimands.map((estimand, index) => (
              <li key={estimand.id} className="min-w-0">
                <EstimandCard
                  estimand={estimand}
                  index={index}
                  count={analysis.estimands.length}
                  endpoints={analysis.availableEndpoints}
                  populations={analysis.analysisPopulations}
                  interventions={analysis.availableInterventions}
                  apply={apply}
                />
              </li>
            ))}
          </ol>
        )}
        <AddEstimandForm
          endpoints={analysis.availableEndpoints}
          populations={analysis.analysisPopulations}
          interventions={analysis.availableInterventions}
          apply={apply}
        />
      </section>

      <section
        aria-labelledby="analysis-populations-heading"
        className="space-y-4"
      >
        <h3 id="analysis-populations-heading" className="text-lg font-semibold">
          Analysis populations
        </h3>
        {analysis.analysisPopulations.length === 0 ? (
          <p className="text-sm text-slate-400">
            This study design defines no analysis populations yet.
          </p>
        ) : (
          <ul className="grid gap-3 @2xl:grid-cols-2">
            {analysis.analysisPopulations.map((population) => (
              <li key={population.id} className="min-w-0">
                <PopulationCard population={population} apply={apply} />
              </li>
            ))}
          </ul>
        )}
        <AddPopulationForm apply={apply} />
      </section>

      <section aria-labelledby="analysis-findings" className="min-w-0">
        <h3 id="analysis-findings" className="font-semibold">
          Analysis intent findings
        </h3>
        {analysis.findings.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-300">
            Every estimand resolves its target endpoint, analysis population,
            linked interventions, and intercurrent event strategies.
          </p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-200">
            {analysis.findings.map((finding, idx) => (
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

function EstimandCard({
  estimand,
  index,
  count,
  endpoints,
  populations,
  interventions,
  apply,
}: {
  readonly estimand: StudyEstimandView;
  readonly index: number;
  readonly count: number;
  readonly endpoints: readonly StudyAnalysisEndpointOption[];
  readonly populations: readonly StudyAnalysisPopulationView[];
  readonly interventions: readonly StudyAnalysisInterventionOption[];
  readonly apply: StudyApplyFn;
}) {
  const [editing, setEditing] = useState(false);
  const [addingEvent, setAddingEvent] = useState(false);

  const [name, setName] = useState(estimand.name);
  const [description, setDescription] = useState(estimand.description);
  const [populationSummary, setPopulationSummary] = useState(
    estimand.populationSummary
  );
  const [endpointId, setEndpointId] = useState(estimand.variableOfInterestId);
  const [populationId, setPopulationId] = useState(
    estimand.analysisPopulationId
  );
  const [selectedInterventionIds, setSelectedInterventionIds] = useState<
    string[]
  >([...estimand.interventionIds]);

  const nameId = useId();
  const descId = useId();
  const epSelectId = useId();
  const popSelectId = useId();
  const summaryId = useId();

  const interventionMap = new Map(interventions.map((i) => [i.id, i.name]));

  const openEditor = () => {
    setName(estimand.name);
    setDescription(estimand.description);
    setPopulationSummary(estimand.populationSummary);
    setEndpointId(
      endpoints.some((ep) => ep.id === estimand.variableOfInterestId)
        ? estimand.variableOfInterestId
        : (endpoints[0]?.id ?? "")
    );
    setPopulationId(
      populations.some((pop) => pop.id === estimand.analysisPopulationId)
        ? estimand.analysisPopulationId
        : (populations[0]?.id ?? "")
    );
    setSelectedInterventionIds(
      estimand.interventionIds.filter((id) => interventionMap.has(id))
    );
    setEditing(true);
  };

  const toggleIntervention = (id: string) => {
    setSelectedInterventionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    if (
      apply((w) =>
        updateStudyEstimand(w, estimand.id, {
          name,
          description,
          populationSummary,
          variableOfInterestId: endpointId,
          analysisPopulationId: populationId,
          interventionIds: selectedInterventionIds,
        })
      )
    ) {
      setEditing(false);
    }
  };

  return (
    <article
      aria-label={`Estimand ${estimand.name}`}
      className="min-w-0 space-y-4 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <h4 className="break-words text-base font-semibold text-[#f4f4f6]">
            {estimand.name}
          </h4>
          {estimand.description && (
            <p className="break-words text-sm text-slate-300">
              {estimand.description}
            </p>
          )}
          <dl className="grid gap-2 text-sm @lg:grid-cols-2">
            <div className="min-w-0 rounded border border-white/[0.08] bg-[#0d0e11] p-2.5">
              <dt className={`${MONO} text-xs text-slate-400`}>
                Target endpoint (variable of interest)
              </dt>
              <dd className="mt-0.5 break-words font-medium">
                {estimand.endpointName ? (
                  <span className="text-[#f4f4f6]">
                    {estimand.endpointName}
                  </span>
                ) : (
                  <span className="text-amber-300">
                    Missing endpoint link (
                    {estimand.variableOfInterestId || "none"})
                  </span>
                )}
              </dd>
            </div>
            <div className="min-w-0 rounded border border-white/[0.08] bg-[#0d0e11] p-2.5">
              <dt className={`${MONO} text-xs text-slate-400`}>
                Analysis population
              </dt>
              <dd className="mt-0.5 break-words font-medium">
                {estimand.analysisPopulationName ? (
                  <span className="text-[#f4f4f6]">
                    {estimand.analysisPopulationName}
                  </span>
                ) : (
                  <span className="text-amber-300">
                    Missing population link (
                    {estimand.analysisPopulationId || "none"})
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <div className="text-sm">
            <span className={`${MONO} text-xs text-slate-400`}>
              Linked interventions:{" "}
            </span>
            {estimand.interventionIds.length === 0 ? (
              <span className="text-amber-300">None linked</span>
            ) : (
              <span className="text-slate-200">
                {estimand.interventionIds
                  .map((id) => interventionMap.get(id) ?? `Unknown (${id})`)
                  .join(", ")}
              </span>
            )}
          </div>

          <div className="text-sm">
            <span className={`${MONO} block text-xs text-slate-400`}>
              Population-level summary
            </span>
            {estimand.populationSummary.trim() ? (
              <p className="mt-0.5 break-words text-slate-300">
                {estimand.populationSummary}
              </p>
            ) : (
              <p className="mt-0.5 text-amber-300">
                Missing population-level summary measure.
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={editing}
            className={BUTTON}
            onClick={() => (editing ? setEditing(false) : openEditor())}
          >
            {editing ? "Close editor" : `Edit estimand ${estimand.name}`}
          </button>
          {count > 1 && (
            <>
              <button
                type="button"
                className={BUTTON}
                disabled={index === 0}
                aria-label={`Move estimand ${estimand.name} up`}
                onClick={() =>
                  apply((w) => moveStudyEstimand(w, estimand.id, index - 1))
                }
              >
                Move up
              </button>
              <button
                type="button"
                className={BUTTON}
                disabled={index === count - 1}
                aria-label={`Move estimand ${estimand.name} down`}
                onClick={() =>
                  apply((w) => moveStudyEstimand(w, estimand.id, index + 1))
                }
              >
                Move down
              </button>
            </>
          )}
          <button
            type="button"
            className={BUTTON}
            aria-label={`Remove estimand ${estimand.name}`}
            onClick={() => apply((w) => removeStudyEstimand(w, estimand.id))}
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
              Estimand name
              <input
                id={nameId}
                className={FIELD}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label
              htmlFor={descId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Description (optional)
              <input
                id={descId}
                className={FIELD}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 @lg:grid-cols-2">
            <label
              htmlFor={epSelectId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Target endpoint
              <select
                id={epSelectId}
                className={FIELD}
                value={endpointId}
                onChange={(event) => setEndpointId(event.target.value)}
              >
                {endpoints.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.name} ({ep.objectiveName})
                  </option>
                ))}
              </select>
            </label>
            <label
              htmlFor={popSelectId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Analysis population
              <select
                id={popSelectId}
                className={FIELD}
                value={populationId}
                onChange={(event) => setPopulationId(event.target.value)}
              >
                {populations.map((pop) => (
                  <option key={pop.id} value={pop.id}>
                    {pop.name}
                    {pop.label ? ` (${pop.label})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {interventions.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm text-slate-300">
                Linked study interventions
              </legend>
              <div className="flex flex-wrap gap-3">
                {interventions.map((intervention) => {
                  const checked = selectedInterventionIds.includes(
                    intervention.id
                  );
                  return (
                    <label
                      key={intervention.id}
                      className="flex min-h-12 cursor-pointer items-center gap-2 rounded border border-white/[0.08] bg-[#0d0e11] px-3 py-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleIntervention(intervention.id)}
                        className="h-4 w-4 accent-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                      />
                      <span>{intervention.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          <label
            htmlFor={summaryId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Population-level summary
            <textarea
              id={summaryId}
              rows={2}
              className={TEXTAREA}
              value={populationSummary}
              onChange={(event) => setPopulationSummary(event.target.value)}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={BUTTON}
              disabled={!endpointId || !populationId}
            >
              Save estimand
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
            Intercurrent events &amp; strategies (
            {estimand.intercurrentEvents.length})
          </h5>
          <button
            type="button"
            aria-expanded={addingEvent}
            className={BUTTON}
            onClick={() => setAddingEvent((prev) => !prev)}
          >
            {addingEvent
              ? "Cancel new event"
              : `Add intercurrent event to ${estimand.name}`}
          </button>
        </div>

        {estimand.intercurrentEvents.length === 0 ? (
          <p className="text-sm text-amber-300">
            No intercurrent events recorded for this estimand.
          </p>
        ) : (
          <ol className="space-y-2.5">
            {estimand.intercurrentEvents.map((ice, iceIndex) => (
              <li key={ice.id} className="min-w-0">
                <IntercurrentEventCard
                  event={ice}
                  index={iceIndex}
                  count={estimand.intercurrentEvents.length}
                  apply={apply}
                />
              </li>
            ))}
          </ol>
        )}

        {addingEvent && (
          <AddIntercurrentEventForm
            estimandId={estimand.id}
            apply={apply}
            onAdded={() => setAddingEvent(false)}
          />
        )}
      </div>
    </article>
  );
}

function IntercurrentEventCard({
  event: ice,
  index,
  count,
  apply,
}: {
  readonly event: StudyIntercurrentEventView;
  readonly index: number;
  readonly count: number;
  readonly apply: StudyApplyFn;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(ice.name);
  const [strategy, setStrategy] = useState(
    ice.strategy || STUDY_INTERCURRENT_EVENT_STRATEGIES[0]
  );
  const [text, setText] = useState(ice.text);

  const nameId = useId();
  const stratId = useId();
  const textId = useId();

  const strategyOptions = STUDY_INTERCURRENT_EVENT_STRATEGIES.includes(strategy)
    ? STUDY_INTERCURRENT_EVENT_STRATEGIES
    : [strategy, ...STUDY_INTERCURRENT_EVENT_STRATEGIES];

  const openEditor = () => {
    setName(ice.name);
    setStrategy(ice.strategy || STUDY_INTERCURRENT_EVENT_STRATEGIES[0]);
    setText(ice.text);
    setEditing(true);
  };

  const handleSave = (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (
      apply((w) =>
        updateStudyIntercurrentEvent(w, {
          estimandId: ice.estimandId,
          eventId: ice.id,
          name,
          strategy,
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-[#f4f4f6]">{ice.name}</span>
            <span
              className={`${MONO} rounded border border-amber-400/40 bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-200`}
            >
              {ice.strategy.trim() || "Missing strategy"}
            </span>
          </div>
          {ice.text.trim() ? (
            <p className="break-words text-sm text-slate-300">{ice.text}</p>
          ) : (
            <p className="text-sm text-amber-300">
              No intercurrent event description recorded.
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
            {editing ? "Close" : `Edit event ${ice.name}`}
          </button>
          <button
            type="button"
            className={BUTTON}
            disabled={index === 0}
            aria-label={`Move event ${ice.name} up`}
            onClick={() =>
              apply((w) =>
                moveStudyIntercurrentEvent(w, {
                  estimandId: ice.estimandId,
                  eventId: ice.id,
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
            aria-label={`Move event ${ice.name} down`}
            onClick={() =>
              apply((w) =>
                moveStudyIntercurrentEvent(w, {
                  estimandId: ice.estimandId,
                  eventId: ice.id,
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
            aria-label={`Remove event ${ice.name}`}
            onClick={() =>
              apply((w) =>
                removeStudyIntercurrentEvent(w, {
                  estimandId: ice.estimandId,
                  eventId: ice.id,
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
          <div className="grid gap-2 @lg:grid-cols-2">
            <label
              htmlFor={nameId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Event name
              <input
                id={nameId}
                className={FIELD}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label
              htmlFor={stratId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              ICH E9(R1) strategy
              <select
                id={stratId}
                className={FIELD}
                value={strategy}
                onChange={(e) => setStrategy(e.target.value)}
              >
                {strategyOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label
            htmlFor={textId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Event description
            <textarea
              id={textId}
              rows={2}
              className={TEXTAREA}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={`${BUTTON} min-w-12`}>
              Save event
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

function AddIntercurrentEventForm({
  estimandId,
  apply,
  onAdded,
}: {
  readonly estimandId: string;
  readonly apply: StudyApplyFn;
  readonly onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [strategy, setStrategy] = useState(
    STUDY_INTERCURRENT_EVENT_STRATEGIES[0]
  );
  const [text, setText] = useState("");
  const nameId = useId();
  const stratId = useId();
  const textId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (
      apply((w) =>
        addStudyIntercurrentEvent(w, { estimandId, name, strategy, text })
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
      <div className="grid gap-2 @lg:grid-cols-2">
        <label htmlFor={nameId} className="flex min-w-0 flex-col gap-1 text-sm">
          New event name
          <input
            id={nameId}
            className={FIELD}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label
          htmlFor={stratId}
          className="flex min-w-0 flex-col gap-1 text-sm"
        >
          ICH E9(R1) strategy
          <select
            id={stratId}
            className={FIELD}
            value={strategy}
            onChange={(event) => setStrategy(event.target.value)}
          >
            {STUDY_INTERCURRENT_EVENT_STRATEGIES.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label htmlFor={textId} className="flex min-w-0 flex-col gap-1 text-sm">
        Event description
        <textarea
          id={textId}
          rows={2}
          className={TEXTAREA}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button type="submit" className={`${BUTTON} min-w-12`}>
        Add intercurrent event
      </button>
    </form>
  );
}

function AddEstimandForm({
  endpoints,
  populations,
  interventions,
  apply,
}: {
  readonly endpoints: readonly StudyAnalysisEndpointOption[];
  readonly populations: readonly StudyAnalysisPopulationView[];
  readonly interventions: readonly StudyAnalysisInterventionOption[];
  readonly apply: StudyApplyFn;
}) {
  const [name, setName] = useState("");
  const [endpointId, setEndpointId] = useState(endpoints[0]?.id ?? "");
  const [populationId, setPopulationId] = useState(populations[0]?.id ?? "");
  const [populationSummary, setPopulationSummary] = useState("");
  const [selectedInterventionIds, setSelectedInterventionIds] = useState<
    string[]
  >([]);

  const nameId = useId();
  const epId = useId();
  const popId = useId();
  const summaryId = useId();

  if (endpoints.length === 0 || populations.length === 0) {
    return (
      <div className="rounded-lg border border-white/[0.08] bg-[#13151a] p-4 text-sm text-slate-300">
        Define at least one endpoint in Narrative and one analysis population
        below before adding a new estimand.
      </div>
    );
  }

  const resolvedEpId = endpoints.some((e) => e.id === endpointId)
    ? endpointId
    : endpoints[0].id;
  const resolvedPopId = populations.some((p) => p.id === populationId)
    ? populationId
    : populations[0].id;

  const toggleIntervention = (id: string) => {
    setSelectedInterventionIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const validInterventions = selectedInterventionIds.filter((id) =>
      interventions.some((i) => i.id === id)
    );
    if (
      apply((w) =>
        addStudyEstimand(w, {
          name,
          variableOfInterestId: resolvedEpId,
          analysisPopulationId: resolvedPopId,
          populationSummary,
          interventionIds: validInterventions,
        })
      )
    ) {
      setName("");
      setPopulationSummary("");
      setSelectedInterventionIds([]);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="min-w-0 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
    >
      <fieldset className="min-w-0 space-y-3">
        <legend className="mb-1 font-semibold">Add an estimand</legend>
        <div className="grid gap-3 @lg:grid-cols-3">
          <label
            htmlFor={nameId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            New estimand name
            <input
              id={nameId}
              className={FIELD}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label htmlFor={epId} className="flex min-w-0 flex-col gap-1 text-sm">
            Target endpoint
            <select
              id={epId}
              className={FIELD}
              value={resolvedEpId}
              onChange={(event) => setEndpointId(event.target.value)}
            >
              {endpoints.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.name} ({ep.objectiveName})
                </option>
              ))}
            </select>
          </label>
          <label
            htmlFor={popId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Analysis population
            <select
              id={popId}
              className={FIELD}
              value={resolvedPopId}
              onChange={(event) => setPopulationId(event.target.value)}
            >
              {populations.map((pop) => (
                <option key={pop.id} value={pop.id}>
                  {pop.name}
                  {pop.label ? ` (${pop.label})` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {interventions.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {interventions.map((intervention) => (
              <label
                key={intervention.id}
                className="flex min-h-12 cursor-pointer items-center gap-2 rounded border border-white/[0.08] bg-[#0d0e11] px-3 py-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedInterventionIds.includes(intervention.id)}
                  onChange={() => toggleIntervention(intervention.id)}
                  className="h-4 w-4 accent-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                />
                <span>{intervention.name}</span>
              </label>
            ))}
          </div>
        )}

        <label
          htmlFor={summaryId}
          className="flex min-w-0 flex-col gap-1 text-sm"
        >
          Population-level summary
          <textarea
            id={summaryId}
            rows={2}
            className={TEXTAREA}
            value={populationSummary}
            onChange={(event) => setPopulationSummary(event.target.value)}
          />
        </label>
        <button type="submit" className={`${BUTTON} min-w-12`}>
          Add estimand
        </button>
      </fieldset>
    </form>
  );
}

function PopulationCard({
  population,
  apply,
}: {
  readonly population: StudyAnalysisPopulationView;
  readonly apply: StudyApplyFn;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(population.name);
  const [label, setLabel] = useState(population.label);
  const [text, setText] = useState(population.text);

  const nameId = useId();
  const labelId = useId();
  const textId = useId();

  const openEditor = () => {
    setName(population.name);
    setLabel(population.label);
    setText(population.text);
    setEditing(true);
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    if (
      apply((w) =>
        updateStudyAnalysisPopulation(w, population.id, { name, label, text })
      )
    ) {
      setEditing(false);
    }
  };

  return (
    <article
      aria-label={`Analysis population ${population.name}`}
      className="h-full min-w-0 space-y-3 rounded-lg border border-white/[0.08] bg-[#13151a] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="break-words font-semibold text-[#f4f4f6]">
              {population.name}
            </h4>
            {population.label && (
              <span
                className={`${MONO} rounded border border-white/[0.08] bg-[#0d0e11] px-1.5 py-0.5 text-xs text-slate-300`}
              >
                {population.label}
              </span>
            )}
          </div>
          <p className="break-words text-sm leading-relaxed text-slate-300">
            {population.text || "No population definition recorded."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-expanded={editing}
            className={BUTTON}
            onClick={() => (editing ? setEditing(false) : openEditor())}
          >
            {editing ? "Close" : `Edit population ${population.name}`}
          </button>
          <button
            type="button"
            className={BUTTON}
            aria-label={`Remove population ${population.name}`}
            onClick={() =>
              apply((w) => removeStudyAnalysisPopulation(w, population.id))
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
          <div className="grid gap-2 @lg:grid-cols-2">
            <label
              htmlFor={nameId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Population name
              <input
                id={nameId}
                className={FIELD}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label
              htmlFor={labelId}
              className="flex min-w-0 flex-col gap-1 text-sm"
            >
              Short label
              <input
                id={labelId}
                className={FIELD}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
              />
            </label>
          </div>
          <label
            htmlFor={textId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Population definition
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
              Save population
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

function AddPopulationForm({ apply }: { readonly apply: StudyApplyFn }) {
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");

  const nameId = useId();
  const labelId = useId();
  const textId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (apply((w) => addStudyAnalysisPopulation(w, { name, label, text }))) {
      setName("");
      setLabel("");
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
          Add an analysis population
        </legend>
        <div className="grid gap-2 @lg:grid-cols-2">
          <label
            htmlFor={nameId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            New population name
            <input
              id={nameId}
              placeholder="e.g. Per-Protocol Population"
              className={FIELD}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label
            htmlFor={labelId}
            className="flex min-w-0 flex-col gap-1 text-sm"
          >
            Short label
            <input
              id={labelId}
              placeholder="e.g. PP"
              className={FIELD}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
        </div>
        <label htmlFor={textId} className="flex min-w-0 flex-col gap-1 text-sm">
          Population definition
          <textarea
            id={textId}
            rows={2}
            className={TEXTAREA}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button type="submit" className={`${BUTTON} min-w-12`}>
          Add analysis population
        </button>
      </fieldset>
    </form>
  );
}
