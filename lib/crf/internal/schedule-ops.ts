/**
 * Schedule of Activities operations shared by the studio and the CLI
 * (epic #3071, step 3): binding forms to a visit and unbinding them. Both
 * front ends call these, so a form bound in the browser and one bound with
 * `crf visit assign` produce the same study. They are pure: the caller
 * stamps `lastModified` and commits.
 */
import type { StudyProtocol, StudyVisit } from "../types";

/** The outcome of a schedule operation: the new study, or why it was refused. */
export type ScheduleOpResult =
  | { ok: true; study: StudyProtocol; visit: StudyVisit }
  | { ok: false; error: string };

function findVisit(
  study: StudyProtocol,
  visitIdOrName: string
): StudyVisit | undefined {
  const name = visitIdOrName.trim().toLowerCase();
  return (
    study.visits.find((visit) => visit.id === visitIdOrName) ??
    study.visits.find((visit) => visit.name.toLowerCase() === name)
  );
}

/** Resolves form ids or CDASH domains to form ids, naming any that match nothing. */
function resolveForms(
  study: StudyProtocol,
  formIdsOrDomains: readonly string[]
): { ids: string[]; unknown: string[] } {
  const ids: string[] = [];
  const unknown: string[] = [];
  for (const token of formIdsOrDomains) {
    const domain = token.trim().toUpperCase();
    const form =
      study.forms.find((f) => f.id === token) ??
      study.forms.find((f) => f.domain.toUpperCase() === domain);
    if (!form) unknown.push(token);
    else if (!ids.includes(form.id)) ids.push(form.id);
  }
  return { ids, unknown };
}

function updateVisit(
  study: StudyProtocol,
  visitIdOrName: string,
  formIdsOrDomains: readonly string[],
  next: (assigned: string[], formIds: string[]) => string[]
): ScheduleOpResult {
  const visit = findVisit(study, visitIdOrName);
  if (!visit) {
    return {
      ok: false,
      error: `Visit '${visitIdOrName}' not found in protocol.`,
    };
  }
  const { ids, unknown } = resolveForms(study, formIdsOrDomains);
  if (unknown.length > 0) {
    return {
      ok: false,
      error: `Form '${unknown.join("', '")}' not found in protocol.`,
    };
  }
  const assignedFormIds = next(visit.assignedFormIds, ids);
  if (
    assignedFormIds.length === visit.assignedFormIds.length &&
    assignedFormIds.every((id, i) => id === visit.assignedFormIds[i])
  ) {
    // Nothing changed: keep the same objects so views can skip re-rendering.
    return { ok: true, study, visit };
  }
  const updated: StudyVisit = { ...visit, assignedFormIds };
  return {
    ok: true,
    study: {
      ...study,
      visits: study.visits.map((v) => (v.id === visit.id ? updated : v)),
    },
    visit: updated,
  };
}

/**
 * Binds forms to a visit. The visit is named by id or name, each form by id
 * or CDASH domain. Forms already bound stay where they are; an unknown visit
 * or form refuses the whole operation rather than binding the rest.
 */
export function assignFormsToVisit(
  study: StudyProtocol,
  visitIdOrName: string,
  formIdsOrDomains: readonly string[]
): ScheduleOpResult {
  return updateVisit(
    study,
    visitIdOrName,
    formIdsOrDomains,
    (assigned, ids) => [
      ...assigned,
      ...ids.filter((id) => !assigned.includes(id)),
    ]
  );
}

/**
 * Unbinds forms from a visit, named as for {@link assignFormsToVisit}. A form
 * that is not bound to the visit is left as it is.
 */
export function unassignFormsFromVisit(
  study: StudyProtocol,
  visitIdOrName: string,
  formIdsOrDomains: readonly string[]
): ScheduleOpResult {
  return updateVisit(study, visitIdOrName, formIdsOrDomains, (assigned, ids) =>
    assigned.filter((id) => !ids.includes(id))
  );
}
