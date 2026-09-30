import { getEvent } from "./events";
import { computeMeters, dataManagerCapacity, totalOpenQueries } from "./model";
import { uniformAt } from "./rng";
import { clamp as clampRange } from "../../game-utils";
import type {
  Evaluations,
  FinalReport,
  InspectionItem,
  InspectionReport,
  LockSummary,
  ProfileResult,
  StudyDirectorProfile,
  StudyState,
} from "../types";

const round1 = (n: number): number => Math.round(n * 10) / 10;
const clamp = (n: number, lo = 0, hi = 100): number => clampRange(n, lo, hi);

/**
 * Locks the database. Queries still open at lock cost days and integrity, so
 * a backlog the player ignored comes due here.
 */
export function lockDatabase(state: StudyState): {
  state: StudyState;
  summary: LockSummary;
} {
  const open = totalOpenQueries(state);
  const lockDelayDays = Math.ceil(
    open / Math.max(1, dataManagerCapacity(state))
  );
  const dataCleanPct = round1(
    clamp((1 - open / Math.max(1, state.queriesRaised)) * 100)
  );
  return {
    state: {
      ...state,
      day: state.day + lockDelayDays,
      slipDays: state.slipDays + lockDelayDays,
      adjust: {
        ...state.adjust,
        integrity: state.adjust.integrity - Math.min(15, open * 0.5),
      },
      sites: state.sites.map((s) => ({ ...s, openQueries: 0 })),
    },
    summary: { dataCleanPct, openQueriesAtLock: open, lockDelayDays },
  };
}

/** Everything an inspector could ask about, drawn from the decision log. */
function inspectionItems(state: StudyState): InspectionItem[] {
  const items: InspectionItem[] = [];
  for (const record of state.log) {
    const event = getEvent(record.eventId);
    if (!event) continue;
    if (record.optionId === "ignored") {
      if (event.urgency !== "critical") continue;
      items.push({
        eventId: record.eventId,
        day: record.day,
        question: `"${event.subject}" was raised on day ${record.day}. Where is the documented response?`,
        documented: false,
        answer: "No response is on file.",
        outcome: "major",
      });
      continue;
    }
    const finding = event.options.find(
      (o) => o.id === record.optionId
    )?.finding;
    if (!finding) continue;
    items.push({
      eventId: record.eventId,
      day: record.day,
      question: finding.question,
      documented: record.documented,
      answer: record.documented
        ? finding.answer
        : "Nothing on file. The decision was made verbally.",
      outcome: record.documented ? "closed" : finding.severity,
    });
  }
  const unsigned = state.sites.reduce((n, s) => n + s.unsignedSource, 0);
  if (unsigned >= 3) {
    items.push({
      eventId: "state:unsigned-source",
      day: state.day,
      question: `${unsigned} source documents are unsigned. Explain.`,
      documented: false,
      answer: "Source documents remain unsigned.",
      outcome: "minor",
    });
  }
  const untrained = state.sites.filter((s) => !s.trainingCurrent);
  if (untrained.length > 0) {
    items.push({
      eventId: "state:training",
      day: state.day,
      question: `Training on the current protocol is incomplete at ${untrained.map((s) => s.name).join(", ")}.`,
      documented: false,
      answer: "Training records are incomplete.",
      outcome: "minor",
    });
  }
  return items;
}

function gradeFor(items: InspectionItem[]): InspectionReport["grade"] {
  const major = items.filter((i) => i.outcome === "major").length;
  const minor = items.filter((i) => i.outcome === "minor").length;
  if (major >= 3) return "F";
  if (major === 2) return "D";
  if (major === 1) return "C";
  return minor <= 1 ? "A" : "B";
}

/** How ready the study is, whether or not the FDA comes. */
export function inspectionReadiness(state: StudyState): InspectionReport {
  const items = inspectionItems(state);
  return { triggered: false, items, grade: gradeFor(items) };
}

/**
 * The FDA visits with a chance that rises with documentation debt. When it
 * does, it replays the player's own decisions.
 */
export function runInspection(state: StudyState): InspectionReport {
  const readiness = inspectionReadiness(state);
  const chance = clamp(0.3 + state.documentationDebt / 200, 0, 0.85);
  const triggered = uniformAt(state.seed, state.draws) < chance;
  return { ...readiness, triggered };
}

const SPONSOR_QUOTES: Record<1 | 2 | 3 | 4 | 5, string> = {
  5: "Excellent communication and proactive issue management.",
  4: "A solid partner. We would work with them again.",
  3: "The study got done. We were surprised more than once.",
  2: "We heard about problems later than we should have.",
  1: "We will not be recommending this team.",
};

/** The four verdicts: sponsor, company, science and regulatory. */
export function evaluate(state: StudyState): Evaluations {
  const meters = computeMeters(state);
  const stars = (
    meters.client >= 80
      ? 5
      : meters.client >= 62
        ? 4
        : meters.client >= 45
          ? 3
          : meters.client >= 28
            ? 2
            : 1
  ) as 1 | 2 | 3 | 4 | 5;
  const enrolled = state.sites.reduce((n, s) => n + s.enrolled, 0);
  const deviations = state.sites.reduce((n, s) => n + s.deviations, 0);
  const eligibility = state.sites.reduce(
    (n, s) => n + s.eligibilityConcerns,
    0
  );
  const unsigned = state.sites.reduce((n, s) => n + s.unsignedSource, 0);
  const majorDeviations = eligibility + Math.floor(deviations / 5);
  const excluded = Math.min(enrolled, majorDeviations);
  const evaluable = Math.max(0, enrolled - excluded);
  const items = inspectionItems(state);
  return {
    sponsor: { stars, quote: SPONSOR_QUOTES[stars] },
    company: {
      marginPct: round1(
        ((state.setup.budget - state.spent) / state.setup.budget) * 100
      ),
      timelineVarianceDays: state.day - state.setup.durationDays,
    },
    science: {
      evaluablePct: round1((evaluable / state.setup.subjects) * 100),
      missingPct: round1(
        clamp(
          ((unsigned + totalOpenQueries(state)) / Math.max(1, enrolled * 8)) *
            100
        )
      ),
      majorDeviations,
    },
    regulatory: {
      grade: gradeFor(items),
      gaps: items.filter((i) => i.outcome !== "closed").length,
    },
  };
}

const PROFILE_TEXT: Record<
  StudyDirectorProfile,
  { title: string; summary: string }
> = {
  firefighter: {
    title: "The Firefighter",
    summary:
      "Great in an emergency. Preventative work kept sliding, and some of those emergencies were yours from weeks earlier.",
  },
  bureaucrat: {
    title: "The Bureaucrat",
    summary: "Fantastic documentation. The decisions took a while.",
  },
  peoplePleaser: {
    title: "The People Pleaser",
    summary: "The sponsor loves you. The team is quietly tired.",
  },
  scientist: {
    title: "The Scientist",
    summary: "You protected data integrity. Budget and timeline paid for it.",
  },
  operator: {
    title: "The Operator",
    summary: "Efficient and decisive. The regulatory risk piled up quietly.",
  },
  delegator: {
    title: "The Delegator",
    summary:
      "Strong team throughput. You are only as strong as your weakest hand-off.",
  },
  controlFreak: {
    title: "The Control Freak",
    summary: "You caught nearly everything. You also became the bottleneck.",
  },
};

/**
 * Discovers which Study Director the player was, from what they did: how
 * much they documented, ignored, delegated and audited, and which meters
 * ended up high or low.
 */
export function classifyProfile(state: StudyState): ProfileResult {
  const answered = state.log.filter(
    (r) => r.optionId !== "ignored" && r.optionId !== "audit"
  );
  const audits = state.log.filter((r) => r.optionId === "audit").length;
  const ignored = state.log.filter((r) => r.optionId === "ignored");
  const total = Math.max(1, answered.length + ignored.length);
  const documentedShare =
    answered.filter((r) => r.documented).length / Math.max(1, answered.length);
  const ignoredShare = ignored.length / total;
  const delegations = answered.filter((r) =>
    r.effects.workload?.some((w) => w.delta > 0)
  ).length;
  const criticalAnswered = answered.filter(
    (r) => getEvent(r.eventId)?.urgency === "critical"
  ).length;
  const meters = computeMeters(state);
  const lateShare = clamp(state.slipDays / 10, 0, 1);
  const scores: Record<StudyDirectorProfile, number> = {
    firefighter:
      ignoredShare * 1.5 +
      (criticalAnswered / Math.max(1, answered.length)) * 0.8,
    bureaucrat: documentedShare * 1.2 + lateShare * 0.6,
    peoplePleaser:
      (meters.client / 100) * 0.9 + ((100 - meters.team) / 100) * 0.9,
    scientist:
      (meters.integrity / 100) * 0.9 +
      ((100 - meters.budget) / 100) * 0.5 +
      lateShare * 0.3,
    operator:
      (1 - documentedShare) * 0.8 +
      (state.documentationDebt / 100) * 0.8 +
      (1 - lateShare) * 0.3,
    delegator: (delegations / Math.max(1, answered.length)) * 2.4,
    controlFreak:
      Math.min(1, audits / 4) * 1.2 +
      (answered.reduce((n, r) => n + r.attentionSpent, 0) /
        Math.max(1, answered.length)) *
        0.1,
  };
  const order: StudyDirectorProfile[] = [
    "firefighter",
    "bureaucrat",
    "peoplePleaser",
    "scientist",
    "operator",
    "delegator",
    "controlFreak",
  ];
  const profile = order.reduce(
    (best, key) => (scores[key] > scores[best] ? key : best),
    order[0]
  );
  return {
    profile,
    ...PROFILE_TEXT[profile],
    evidence: [
      `${Math.round(documentedShare * 100)}% of your decisions were documented.`,
      `${ignored.length} messages went unanswered.`,
      `${audits} site audit${audits === 1 ? "" : "s"}, ${delegations} hand-off${delegations === 1 ? "" : "s"} to the team.`,
    ],
  };
}

/** Locks the database and assembles the whole end-of-study report. */
export function finalizeStudy(state: StudyState): FinalReport {
  const locked = lockDatabase(state);
  return {
    state: locked.state,
    lock: locked.summary,
    evaluations: evaluate(locked.state),
    profile: classifyProfile(locked.state),
    inspection: runInspection(locked.state),
  };
}
