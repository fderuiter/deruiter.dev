import {
  PopulationTypeSchema,
  type PopulationSnapshot,
  type PopulationTransition,
  type PopulationType,
  type SnapshotRef,
  type TransitionReason,
} from "../types";

/**
 * The structured record a population transition leaves behind: which subject
 * moved, why, between which snapshot versions, and every dealt output it
 * rendered stale.
 */
export interface SnapshotInvalidation {
  transitionId: string;
  subjectId: string;
  reason: TransitionReason;
  change: PopulationTransition["change"];
  /** Populations whose membership actually changed, in suit order. */
  populations: PopulationType[];
  from: SnapshotRef;
  to: SnapshotRef;
  /** Dealt cards compiled against a population that changed. */
  staleCardIds: string[];
}

/** The result of applying a transition: the next version, or a refusal. */
export type TransitionOutcome =
  | { ok: true; snapshot: PopulationSnapshot; changed: PopulationType[] }
  | { ok: false; message: string };

/** A snapshot's id, version and capture time. */
export function snapshotRef(snapshot: PopulationSnapshot): SnapshotRef {
  return {
    id: snapshot.id,
    version: snapshot.version,
    capturedAt: snapshot.capturedAt,
  };
}

/** The ids of every subject in `population`, in snapshot order. */
export function membership(
  snapshot: PopulationSnapshot,
  population: PopulationType
): string[] {
  return snapshot.subjects
    .filter((subject) => subject.populations.includes(population))
    .map((subject) => subject.id);
}

/** Whether two snapshots have the same members of `population`. */
export function sameMembership(
  a: PopulationSnapshot,
  b: PopulationSnapshot,
  population: PopulationType
): boolean {
  if (a === b) return true;
  const left = membership(a, population);
  const right = membership(b, population);
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

/** `SNAP-P1-v1` at version 1 becomes `SNAP-P1-v2`. */
const nextId = (snapshot: PopulationSnapshot) =>
  `${snapshot.id.replace(/-v\d+$/, "")}-v${snapshot.version + 1}`;

/**
 * Enrolls a new subject: the next version holds every earlier subject and
 * the new one, whose populations are the ones that change. Refused when the
 * transition carries no subject or the snapshot already holds its id.
 */
function enroll(
  snapshot: PopulationSnapshot,
  transition: PopulationTransition
): TransitionOutcome {
  const subject = transition.subject;
  if (!subject || subject.id !== transition.subjectId) {
    return {
      ok: false,
      message: `Enrolling ${transition.subjectId} needs the subject's data.`,
    };
  }
  if (snapshot.subjects.some((s) => s.id === subject.id)) {
    return {
      ok: false,
      message: `${subject.id} is already enrolled; ${snapshot.id} is unchanged.`,
    };
  }
  const changed = PopulationTypeSchema.options.filter((p) =>
    subject.populations.includes(p)
  );
  if (changed.length === 0) {
    return {
      ok: false,
      message: `${subject.id} belongs to no population; ${snapshot.id} is unchanged.`,
    };
  }
  return {
    ok: true,
    changed,
    snapshot: {
      id: nextId(snapshot),
      version: snapshot.version + 1,
      capturedAt: transition.effectiveAt,
      subjects: [...snapshot.subjects, subject],
    },
  };
}

/**
 * Applies one transition to a snapshot and returns the next version. Pure:
 * the input snapshot is never modified, so every earlier version stays
 * available for audit. A transition that names an unknown subject, or that
 * would change no membership, is refused.
 */
export function applyTransition(
  snapshot: PopulationSnapshot,
  transition: PopulationTransition
): TransitionOutcome {
  if (transition.change === "ENROLL") return enroll(snapshot, transition);
  const target = snapshot.subjects.find((s) => s.id === transition.subjectId);
  if (!target) {
    return {
      ok: false,
      message: `${transition.subjectId} is not in snapshot ${snapshot.id}.`,
    };
  }
  const named = new Set(transition.populations);
  const joining = transition.change === "JOIN";
  const changed = PopulationTypeSchema.options.filter(
    (population) =>
      named.has(population) &&
      target.populations.includes(population) !== joining
  );
  if (changed.length === 0) {
    return {
      ok: false,
      message: `${transition.subjectId} already ${joining ? "belongs to" : "is outside"} every named population; ${snapshot.id} is unchanged.`,
    };
  }
  const populations = joining
    ? PopulationTypeSchema.options.filter(
        (p) => target.populations.includes(p) || named.has(p)
      )
    : target.populations.filter((p) => !named.has(p));
  return {
    ok: true,
    changed,
    snapshot: {
      id: nextId(snapshot),
      version: snapshot.version + 1,
      capturedAt: transition.effectiveAt,
      subjects: snapshot.subjects.map((subject) =>
        subject === target ? { ...subject, populations } : subject
      ),
    },
  };
}
