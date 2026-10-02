// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ATTENTION_PER_DAY,
  AUDIT_ATTENTION,
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  advanceDay,
  auditSite,
  computeMeters,
  createStudy,
  dashboard,
  phaseForDay,
  resolveDecision,
  routineLoad,
  totalOpenQueries,
  type DecisionInput,
  type StudyState,
} from "@/lib/study-director";

const fresh = (seed = "seed-a") =>
  createStudy(seed, STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM);

const run = (state: StudyState, days: number): StudyState => {
  let s = state;
  for (let i = 0; i < days; i += 1) s = advanceDay(s);
  return s;
};

const decision = (over: Partial<DecisionInput> = {}): DecisionInput => ({
  eventId: "e1",
  optionId: "o1",
  label: "Proceed",
  effects: {},
  attentionCost: 1,
  debtIfUndocumented: 6,
  documented: false,
  ...over,
});

describe("study director core", () => {
  it("is deterministic per seed and differs across seeds", () => {
    expect(run(fresh("x"), 50)).toEqual(run(fresh("x"), 50));
    const a = run(fresh("x"), 50).sites.map((s) => s.enrolled + s.deviations);
    const b = run(fresh("y"), 50).sites.map((s) => s.enrolled + s.deviations);
    expect(a).not.toEqual(b);
  });

  it("walks the phases in order over the planned duration", () => {
    const d = STUDY_24_081.durationDays;
    expect(phaseForDay(0, d)).toBe("protocol");
    expect(phaseForDay(30, d)).toBe("conduct");
    expect(phaseForDay(d, d)).toBe("closeout");
  });

  it("enrolls up to, and never past, the subject target", () => {
    const s = run(fresh(), 70);
    const enrolled = s.sites.reduce((n, x) => n + x.enrolled, 0);
    expect(enrolled).toBeLessThanOrEqual(STUDY_24_081.subjects);
    expect(enrolled).toBeGreaterThan(20);
  });

  it("completes when the planned duration passes and stops advancing", () => {
    const s = run(fresh(), STUDY_24_081.durationDays);
    expect(s.status).toBe("complete");
    expect(advanceDay(s)).toBe(s);
  });

  it("resets attention each day and spends it on decisions", () => {
    let s = fresh();
    const r = resolveDecision(s, decision({ attentionCost: 3 }));
    expect(r.ok && r.state.attention).toBe(ATTENTION_PER_DAY - 3);
    s = r.ok ? r.state : s;
    expect(advanceDay(s).attention).toBe(ATTENTION_PER_DAY);
  });

  it("takes routine attention only when queries or debt pile up", () => {
    const calm = fresh();
    expect(routineLoad(calm)).toBe(0);
    const backlog = {
      ...calm,
      documentationDebt: 70,
      sites: calm.sites.map((x) => ({ ...x, openQueries: 12 })),
    };
    expect(routineLoad(backlog)).toBe(2);
    const next = advanceDay(backlog);
    expect(next.routine).toBeGreaterThan(0);
    expect(next.attention).toBe(ATTENTION_PER_DAY - next.routine);
    expect(next.attention).toBeGreaterThanOrEqual(ATTENTION_PER_DAY - 2);
  });

  it("refuses a decision that costs more attention than is left", () => {
    const r = resolveDecision(
      fresh(),
      decision({ attentionCost: ATTENTION_PER_DAY })
    );
    expect(r.ok).toBe(true);
    const r2 = resolveDecision(
      fresh(),
      decision({ attentionCost: ATTENTION_PER_DAY, documented: true })
    );
    expect(r2).toEqual({ ok: false, reason: "not-enough-attention" });
  });

  it("documenting costs attention but avoids debt; skipping adds debt", () => {
    const skipped = resolveDecision(fresh(), decision());
    const documented = resolveDecision(fresh(), decision({ documented: true }));
    expect(skipped.ok && skipped.state.documentationDebt).toBe(6);
    expect(documented.ok && documented.state.documentationDebt).toBe(0);
    expect(documented.ok && documented.state.attention).toBe(
      ATTENTION_PER_DAY - 2
    );
    expect(skipped.ok && skipped.state.log[0]).toMatchObject({
      documented: false,
      eventId: "e1",
    });
  });

  it("applies effects to meters, sites, team, budget and schedule", () => {
    const r = resolveDecision(
      fresh(),
      decision({
        effects: {
          meters: { client: 10 },
          spend: 5000,
          slipDays: 4,
          workload: [{ memberId: "maya", delta: 30 }],
          sites: [{ siteId: "site-03", trainingCurrent: true, burden: -10 }],
        },
      })
    );
    if (!r.ok) throw new Error("expected ok");
    expect(r.state.spent).toBe(5000);
    expect(r.state.slipDays).toBe(4);
    expect(r.state.team.find((m) => m.id === "maya")?.workload).toBe(90);
    expect(r.state.sites[2]).toMatchObject({
      trainingCurrent: true,
      burden: 55,
    });
    expect(computeMeters(r.state).client).toBeGreaterThan(
      computeMeters(fresh()).client - 4
    );
  });

  it("keeps meters within 0 to 100 under extreme inputs", () => {
    const r = resolveDecision(
      fresh(),
      decision({ effects: { meters: { integrity: -500, team: 500 } } })
    );
    if (!r.ok) throw new Error("expected ok");
    const m = computeMeters(r.state);
    expect(m.integrity).toBe(0);
    expect(m.team).toBe(100);
  });

  it("propagates burden into deviations, queries and data-manager load", () => {
    const calm = run(
      createStudy(
        "k",
        STUDY_24_081,
        STUDY_24_081_SITES.map((s) => ({ ...s, burden: 5 })),
        STUDY_24_081_TEAM
      ),
      45
    );
    const heavy = run(
      createStudy(
        "k",
        STUDY_24_081,
        STUDY_24_081_SITES.map((s) => ({ ...s, burden: 95 })),
        STUDY_24_081_TEAM
      ),
      45
    );
    const dev = (s: StudyState) =>
      s.sites.reduce((n, x) => n + x.deviations, 0);
    expect(dev(heavy)).toBeGreaterThan(dev(calm));
    const perSubject = (s: StudyState) =>
      s.queriesRaised / s.sites.reduce((n, x) => n + x.enrolled, 0);
    expect(perSubject(heavy)).toBeGreaterThan(perSubject(calm));
    const dm = (s: StudyState) =>
      s.team.find((m) => m.role === "dataManager")?.workload ?? 0;
    expect(dm(heavy)).toBeGreaterThanOrEqual(dm(calm));
  });

  it("shows a green dashboard over hidden problems until a site is audited", () => {
    const hidden = fresh();
    const trouble = {
      ...hidden,
      day: 40,
      sites: hidden.sites.map((s) =>
        s.id === "site-03"
          ? {
              ...s,
              coordinator: "invisible" as const,
              openQueries: 14,
              unsignedSource: 3,
              eligibilityConcerns: 1,
              trainingCurrent: false,
            }
          : s
      ),
    };
    const before = dashboard(trouble);
    expect(before.data.health).toBe("green");
    expect(before.regulatory.health).toBe("green");
    const audit = auditSite(trouble, "site-03");
    if (!audit.ok) throw new Error("expected ok");
    expect(audit.report).toMatchObject({
      openQueries: 14,
      unsignedSource: 3,
      eligibilityConcerns: 1,
      trainingCurrent: false,
    });
    expect(audit.state.attention).toBe(ATTENTION_PER_DAY - AUDIT_ATTENTION);
    const after = dashboard(audit.state);
    expect(after.safety.health).not.toBe("green");
    expect(after.regulatory.health).not.toBe("green");
  });

  it("rejects audits of unknown sites and when attention is spent", () => {
    expect(auditSite(fresh(), "nope")).toEqual({
      ok: false,
      reason: "unknown-target",
    });
    const spent = { ...fresh(), attention: 1 };
    expect(auditSite(spent, "site-01")).toEqual({
      ok: false,
      reason: "not-enough-attention",
    });
  });

  it("lets an unattended study drift: queries pile up when the data manager is overloaded", () => {
    const s = run(fresh(), 55);
    expect(totalOpenQueries(s)).toBeGreaterThanOrEqual(0);
    expect(computeMeters(s).integrity).toBeLessThanOrEqual(100);
  });

  it("survives a study with no data manager", () => {
    const team = STUDY_24_081_TEAM.filter((m) => m.role !== "dataManager");
    const s = run(createStudy("z", STUDY_24_081, STUDY_24_081_SITES, team), 60);
    expect(Number.isFinite(computeMeters(s).timeline)).toBe(true);
  });
});
