import { uniformAt } from "./rng";
import type {
  ActionResult,
  Dashboard,
  DecisionInput,
  Effects,
  Health,
  MeterId,
  Meters,
  Phase,
  SiteAuditReport,
  SiteState,
  StudySetup,
  StudyState,
  TeamMember,
  TeamRole,
} from "../types";
import { METER_IDS } from "../types";

/** Attention points available each simulated day. */
export const ATTENTION_PER_DAY = 5;
/** Extra attention a decision costs when the player documents it properly. */
export const DOCUMENTATION_ATTENTION = 1;
/** Attention an audit of one site costs. */
export const AUDIT_ATTENTION = 2;
/** Most attention routine work can take from a day. */
const MAX_ROUTINE_LOAD = 2;
/** Days an audit keeps a site's dashboard honest. */
export const AUDIT_WINDOW_DAYS = 10;

const PHASE_BOUNDS: Array<[Phase, number]> = [
  ["protocol", 0.08],
  ["startup", 0.2],
  ["conduct", 0.6],
  ["cleaning", 0.75],
  ["analysis", 0.88],
  ["reporting", 0.96],
  ["closeout", 1],
];

const clamp = (value: number, lo = 0, hi = 100): number =>
  Math.min(hi, Math.max(lo, value));

/**
 * Attention the study's own upkeep takes before the player decides anything.
 * A calm study costs nothing. A backlog of open queries and unrecorded
 * decisions pulls the Study Director into routine work, so a shortcut that
 * saves attention today is paid for in attention later.
 */
export function routineLoad(state: StudyState): number {
  const queries = totalOpenQueries(state);
  const load =
    Math.floor(queries / 10) +
    (state.documentationDebt >= 35 ? 1 : 0) +
    (state.documentationDebt >= 65 ? 1 : 0);
  return Math.min(MAX_ROUTINE_LOAD, load);
}

/** The phase a study is in on `day`, from the planned duration. */
export function phaseForDay(day: number, durationDays: number): Phase {
  const fraction = day / Math.max(1, durationDays);
  for (const [phase, bound] of PHASE_BOUNDS) {
    if (fraction < bound) return phase;
  }
  return "closeout";
}

/** Fraction of the planned duration at which conduct starts and ends. */
function enrollmentWindow(setup: StudySetup): [number, number] {
  return [
    Math.round(setup.durationDays * 0.2),
    Math.round(setup.durationDays * 0.6),
  ];
}

/** Starts a study. `sites` and `team` come from a preset. */
export function createStudy(
  seed: string,
  setup: StudySetup,
  sites: SiteState[],
  team: TeamMember[]
): StudyState {
  return {
    version: 1,
    seed,
    setup,
    day: 0,
    status: "running",
    team: team.map((m) => ({ ...m })),
    sites: sites.map((s) => ({ ...s })),
    attention: ATTENTION_PER_DAY,
    routine: 0,
    documentationDebt: 0,
    spent: 0,
    slipDays: 0,
    queriesRaised: 0,
    adjust: {
      integrity: 0,
      compliance: 0,
      timeline: 0,
      budget: 0,
      client: 0,
      team: 0,
    },
    draws: 0,
    log: [],
    flags: [],
    scheduled: [],
    seen: {},
    handled: [],
  };
}

function member(state: StudyState, role: TeamRole): TeamMember | undefined {
  return state.team.find((m) => m.role === role);
}

/** Queries per day the data manager can clear. */
export function dataManagerCapacity(state: StudyState): number {
  const dm = member(state, "dataManager");
  if (!dm) return 0;
  const overload = dm.workload > 90 ? 0.6 : dm.workload > 75 ? 0.85 : 1;
  return Math.max(1, dm.skill * dm.speed * 0.15 * overload);
}

export function totalOpenQueries(state: StudyState): number {
  return state.sites.reduce((sum, s) => sum + s.openQueries, 0);
}

/** The day the study will actually finish, given slips and query backlog. */
export function projectedFinishDay(state: StudyState): number {
  const backlogDays = Math.ceil(
    totalOpenQueries(state) / Math.max(1, dataManagerCapacity(state))
  );
  const phase = phaseForDay(state.day, state.setup.durationDays);
  const backlogDelay = phase === "closeout" ? 0 : Math.max(0, backlogDays - 10);
  return state.setup.durationDays + state.slipDays + backlogDelay;
}

/** Target workload for a role in a phase, before the state's own pressure. */
const PHASE_LOAD: Record<TeamRole, Record<Phase, number>> = {
  biostatistician: {
    protocol: 55,
    startup: 45,
    conduct: 30,
    cleaning: 45,
    analysis: 90,
    reporting: 70,
    closeout: 30,
  },
  dataManager: {
    protocol: 30,
    startup: 80,
    conduct: 55,
    cleaning: 85,
    analysis: 60,
    reporting: 30,
    closeout: 25,
  },
  regulatory: {
    protocol: 65,
    startup: 85,
    conduct: 35,
    cleaning: 25,
    analysis: 25,
    reporting: 45,
    closeout: 60,
  },
  monitor: {
    protocol: 20,
    startup: 60,
    conduct: 80,
    cleaning: 65,
    analysis: 25,
    reporting: 20,
    closeout: 40,
  },
  medicalWriter: {
    protocol: 60,
    startup: 30,
    conduct: 20,
    cleaning: 20,
    analysis: 45,
    reporting: 95,
    closeout: 50,
  },
  programmer: {
    protocol: 20,
    startup: 40,
    conduct: 35,
    cleaning: 55,
    analysis: 90,
    reporting: 60,
    closeout: 25,
  },
};

function targetWorkload(
  state: StudyState,
  m: TeamMember,
  phase: Phase
): number {
  let target = PHASE_LOAD[m.role][phase];
  if (m.role === "dataManager") target += totalOpenQueries(state) * 1.2;
  if (m.role === "monitor") {
    const burden =
      state.sites.reduce((s, x) => s + x.burden, 0) /
      Math.max(1, state.sites.length);
    target += burden * 0.25;
  }
  return clamp(target);
}

/** Draws a whole number with the given expectation, using the seeded PRNG. */
function drawCount(
  state: StudyState,
  expected: number
): { count: number; state: StudyState } {
  const whole = Math.floor(expected);
  const extra = uniformAt(state.seed, state.draws) < expected - whole ? 1 : 0;
  return { count: whole + extra, state: { ...state, draws: state.draws + 1 } };
}

const COORDINATOR_DEVIATION_FACTOR = {
  terrified: 0.8,
  invisible: 1.3,
  steady: 1,
} as const;

/**
 * Advances the study one day: sites enroll, deviations and queries accrue
 * from burden (the causal chain), the data manager clears what they can,
 * workloads drift toward their targets, budget burns, and attention resets.
 */
export function advanceDay(input: StudyState): StudyState {
  if (input.status !== "running") return input;
  let state: StudyState = { ...input, day: input.day + 1 };
  const { setup } = state;
  const phase = phaseForDay(state.day, setup.durationDays);
  const [enrollStart, enrollEnd] = enrollmentWindow(setup);
  const enrolling = state.day > enrollStart && state.day <= enrollEnd;
  const window = Math.max(1, enrollEnd - enrollStart);
  const complexityFactor = 1 + (setup.complexity - 1) * 0.25;

  const sites: SiteState[] = [];
  let raisedToday = 0;
  for (const original of state.sites) {
    let site = { ...original };
    const enrolledTotal = state.sites.reduce((s, x) => s + x.enrolled, 0);
    if (enrolling && enrolledTotal < setup.subjects) {
      const perSitePace = setup.subjects / state.sites.length / window;
      const pace =
        perSitePace *
        1.15 *
        (1 - site.burden / 200) *
        (site.trainingCurrent ? 1 : 0.7);
      const draw = drawCount(state, pace);
      state = draw.state;
      site = {
        ...site,
        enrolled: Math.min(
          site.enrolled + draw.count,
          site.enrolled + (setup.subjects - enrolledTotal)
        ),
      };
    }
    if (site.enrolled > 0 && (phase === "conduct" || phase === "cleaning")) {
      const rate =
        (site.burden / 100) *
        0.02 *
        complexityFactor *
        COORDINATOR_DEVIATION_FACTOR[site.coordinator];
      const dev = drawCount(state, site.enrolled * rate);
      state = dev.state;
      const unsigned = drawCount(
        state,
        site.enrolled * (site.burden / 100) * 0.02
      );
      state = unsigned.state;
      const eligibility = drawCount(
        state,
        site.enrolled * (site.burden / 100) * 0.004 * complexityFactor
      );
      state = eligibility.state;
      const routine = drawCount(state, site.enrolled * 0.06);
      state = routine.state;
      const queries = dev.count * 2 + routine.count;
      raisedToday += queries;
      site = {
        ...site,
        deviations: site.deviations + dev.count,
        openQueries: site.openQueries + queries,
        unsignedSource: site.unsignedSource + unsigned.count,
        eligibilityConcerns: site.eligibilityConcerns + eligibility.count,
      };
    }
    sites.push(site);
  }
  state = { ...state, sites, queriesRaised: state.queriesRaised + raisedToday };

  // The data manager clears queries, biggest backlog first.
  let capacity = dataManagerCapacity(state);
  const cleared = [...state.sites]
    .sort((a, b) => b.openQueries - a.openQueries)
    .map((s) => {
      const take = Math.min(s.openQueries, Math.ceil(capacity));
      capacity = Math.max(0, capacity - take);
      return { id: s.id, take };
    });
  state = {
    ...state,
    sites: state.sites.map((s) => ({
      ...s,
      openQueries:
        s.openQueries - (cleared.find((c) => c.id === s.id)?.take ?? 0),
    })),
  };

  state = {
    ...state,
    team: state.team.map((m) => ({
      ...m,
      workload: Math.round(
        clamp(m.workload + (targetWorkload(state, m, phase) - m.workload) * 0.2)
      ),
    })),
  };

  const meanLoad =
    state.team.reduce((s, m) => s + m.workload, 0) /
    Math.max(1, state.team.length);
  const burn =
    (setup.budget / setup.durationDays) *
    (1 + Math.max(0, meanLoad - 80) / 100);
  const creep = meanLoad > 85 ? 0.3 : 0;

  state = {
    ...state,
    spent: state.spent + burn,
    documentationDebt: clamp(state.documentationDebt + creep),
  };
  const routine = routineLoad(state);
  state = { ...state, routine, attention: ATTENTION_PER_DAY - routine };
  if (state.day >= setup.durationDays + state.slipDays) {
    state = { ...state, status: "complete" };
  }
  return state;
}

export function applyEffects(state: StudyState, effects: Effects): StudyState {
  const adjust = { ...state.adjust };
  for (const id of METER_IDS) {
    adjust[id] += effects.meters?.[id] ?? 0;
  }
  const team = state.team.map((m) => {
    const delta = (effects.workload ?? [])
      .filter((w) => w.memberId === m.id)
      .reduce((s, w) => s + w.delta, 0);
    return delta === 0 ? m : { ...m, workload: clamp(m.workload + delta) };
  });
  const sites = state.sites.map((s) => {
    const changes = (effects.sites ?? []).filter((c) => c.siteId === s.id);
    const audited = effects.auditSites?.includes(s.id)
      ? state.day
      : s.lastAuditedDay;
    return changes.reduce<SiteState>(
      (acc, c) => ({
        ...acc,
        burden: clamp(acc.burden + (c.burden ?? 0)),
        enrolled: Math.max(0, acc.enrolled + (c.enrolled ?? 0)),
        openQueries: Math.max(0, acc.openQueries + (c.openQueries ?? 0)),
        deviations: Math.max(0, acc.deviations + (c.deviations ?? 0)),
        unsignedSource: Math.max(
          0,
          acc.unsignedSource + (c.unsignedSource ?? 0)
        ),
        eligibilityConcerns: Math.max(
          0,
          acc.eligibilityConcerns + (c.eligibilityConcerns ?? 0)
        ),
        trainingCurrent: c.trainingCurrent ?? acc.trainingCurrent,
      }),
      { ...s, lastAuditedDay: audited }
    );
  });
  return {
    ...state,
    adjust,
    team,
    sites,
    spent: Math.max(0, state.spent + (effects.spend ?? 0)),
    slipDays: Math.max(0, state.slipDays + (effects.slipDays ?? 0)),
  };
}

/**
 * Resolves a decision: spends attention, applies its effects and records it.
 * A decision the player does not document adds documentation debt, which the
 * inspection later replays (ADR 0054).
 */
export function resolveDecision(
  state: StudyState,
  input: DecisionInput
): ActionResult {
  if (state.status !== "running")
    return { ok: false, reason: "study-complete" };
  const attentionSpent =
    Math.max(0, input.attentionCost) +
    (input.documented ? DOCUMENTATION_ATTENTION : 0);
  if (attentionSpent > state.attention)
    return { ok: false, reason: "not-enough-attention" };
  const next = applyEffects(state, input.effects);
  return {
    ok: true,
    state: {
      ...next,
      attention: state.attention - attentionSpent,
      documentationDebt: clamp(
        state.documentationDebt +
          (input.documented ? 0 : Math.max(0, input.debtIfUndocumented))
      ),
      log: [
        ...state.log,
        {
          day: state.day,
          eventId: input.eventId,
          optionId: input.optionId,
          label: input.label,
          documented: input.documented,
          attentionSpent,
          effects: input.effects,
        },
      ],
    },
  };
}

/** The six meters, derived from the true state plus the player's adjustments. */
export function computeMeters(state: StudyState): Meters {
  const { setup } = state;
  const deviations = state.sites.reduce((s, x) => s + x.deviations, 0);
  const unsigned = state.sites.reduce((s, x) => s + x.unsignedSource, 0);
  const eligibility = state.sites.reduce(
    (s, x) => s + x.eligibilityConcerns,
    0
  );
  const untrained = state.sites.filter((s) => !s.trainingCurrent).length;
  const meanLoad =
    state.team.reduce((s, m) => s + m.workload, 0) /
    Math.max(1, state.team.length);
  const planned = state.day / setup.durationDays;
  const spentRatio = state.spent / setup.budget;
  const late = Math.max(0, projectedFinishDay(state) - setup.durationDays);
  const base: Meters = {
    integrity:
      100 - deviations * 1.5 - totalOpenQueries(state) * 0.4 - eligibility * 6,
    compliance:
      100 - state.documentationDebt * 0.5 - unsigned * 3 - untrained * 8,
    timeline: 100 - late * 4,
    budget:
      100 -
      Math.max(0, spentRatio - planned) * 300 -
      Math.max(0, spentRatio - 1) * 300,
    client: 65 - late * 2,
    team: 100 - Math.max(0, meanLoad - 45) * 1.6,
  };
  const out = {} as Meters;
  for (const id of METER_IDS as readonly MeterId[]) {
    out[id] = Math.round(clamp(base[id] + state.adjust[id]));
  }
  return out;
}

function siteVisibility(state: StudyState, site: SiteState): number {
  if (
    site.lastAuditedDay !== null &&
    state.day - site.lastAuditedDay <= AUDIT_WINDOW_DAYS
  )
    return 1;
  return { terrified: 0.9, steady: 0.5, invisible: 0.1 }[site.coordinator];
}

const grade = (value: number, amberAt: number, redAt: number): Health =>
  value >= redAt ? "red" : value >= amberAt ? "amber" : "green";

/**
 * What the dashboard shows. Enrollment, budget and timeline are honest.
 * Safety, data and regulatory only reflect the share of problems each site
 * has surfaced, so a quiet site looks green until the player audits it.
 */
export function dashboard(state: StudyState): Dashboard {
  const { setup } = state;
  const visible = (pick: (s: SiteState) => number): number =>
    state.sites.reduce((sum, s) => sum + pick(s) * siteVisibility(state, s), 0);
  const enrolled = state.sites.reduce((s, x) => s + x.enrolled, 0);
  const [enrollStart, enrollEnd] = enrollmentWindow(setup);
  const expected =
    setup.subjects *
    clamp(
      (state.day - enrollStart) / Math.max(1, enrollEnd - enrollStart),
      0,
      1
    );
  const behind = Math.max(0, expected - enrolled);
  const spentRatio = state.spent / setup.budget;
  const overspend = spentRatio - state.day / setup.durationDays;
  const late = Math.max(0, projectedFinishDay(state) - setup.durationDays);
  const visQueries = visible((s) => s.openQueries);
  const visSafety = visible((s) => s.eligibilityConcerns * 5 + s.deviations);
  const visReg =
    visible((s) => s.unsignedSource + (s.trainingCurrent ? 0 : 4)) +
    state.documentationDebt * 0.05;
  return {
    enrollment: {
      health: grade(behind, 3, 8),
      summary: `${enrolled} of ${setup.subjects} enrolled`,
    },
    safety: {
      health: grade(visSafety, 4, 10),
      summary:
        visSafety < 1
          ? "No open safety signals reported"
          : visSafety < 4
            ? "Minor deviations noted"
            : "Eligibility or deviation signals reported",
    },
    data: {
      health: grade(visQueries, 8, 20),
      summary: `${Math.round(visQueries)} open queries reported`,
    },
    regulatory: {
      health: grade(visReg, 3, 8),
      summary:
        visReg < 3
          ? "Approvals and training on file"
          : visReg < 8
            ? "Some sign-offs or training pending"
            : "Sign-offs, approvals or training outstanding",
    },
    budget: {
      health: grade(overspend, 0.05, 0.15),
      summary: `${Math.round(spentRatio * 100)}% of budget spent`,
    },
    timeline: {
      health: grade(late, 1, 5),
      summary: late > 0 ? `${late} days behind` : "On plan",
    },
  };
}

/** Audits one site: costs attention, reveals its true state for a window. */
export function auditSite(
  state: StudyState,
  siteId: string
): ActionResult<{ report: SiteAuditReport }> {
  if (state.status !== "running")
    return { ok: false, reason: "study-complete" };
  const site = state.sites.find((s) => s.id === siteId);
  if (!site) return { ok: false, reason: "unknown-target" };
  if (AUDIT_ATTENTION > state.attention)
    return { ok: false, reason: "not-enough-attention" };
  return {
    ok: true,
    state: {
      ...state,
      attention: state.attention - AUDIT_ATTENTION,
      log: [
        ...state.log,
        {
          day: state.day,
          eventId: `audit:${siteId}`,
          optionId: "audit",
          label: `Audited ${site.name}`,
          documented: true,
          attentionSpent: AUDIT_ATTENTION,
          effects: { auditSites: [siteId] },
        },
      ],
      sites: state.sites.map((s) =>
        s.id === siteId ? { ...s, lastAuditedDay: state.day } : s
      ),
    },
    report: {
      siteId,
      openQueries: site.openQueries,
      deviations: site.deviations,
      unsignedSource: site.unsignedSource,
      eligibilityConcerns: site.eligibilityConcerns,
      trainingCurrent: site.trainingCurrent,
    },
  };
}
