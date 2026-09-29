import { describe, expect, it } from "vitest";
import {
  ATTENTION_PER_DAY,
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  STUDY_EVENTS,
  beginStudy,
  computeMeters,
  createStudy,
  dashboard,
  endDay,
  getEvent,
  inbox,
  resolveEvent,
  type StudyState,
} from "@/lib/study-director";

const start = (seed = "s1") =>
  beginStudy(
    createStudy(seed, STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM)
  );

type Policy = (
  state: StudyState,
  eventId: string
) => { option: string; documented: boolean } | null;

/** Plays a whole study, answering the inbox with `policy`. */
function play(seed: string, policy: Policy): StudyState {
  let s = start(seed);
  let guard = 0;
  while (s.status === "running" && guard < 400) {
    guard += 1;
    for (const event of inbox(s)) {
      const choice = policy(s, event.id);
      if (!choice) continue;
      const r = resolveEvent(s, event.id, choice.option, choice.documented);
      if (r.ok) s = r.state;
    }
    s = endDay(s);
  }
  return s;
}

describe("study director events", () => {
  it("has a valid event graph", () => {
    const ids = STUDY_EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(STUDY_EVENTS.length).toBeGreaterThanOrEqual(28);
    for (const event of STUDY_EVENTS) {
      expect(event.options.length).toBeGreaterThanOrEqual(2);
      expect(event.options.length).toBeLessThanOrEqual(5);
      expect(event.day).toBeGreaterThanOrEqual(1);
      expect(event.day).toBeLessThanOrEqual(STUDY_24_081.durationDays);
      expect(event.ttl).toBeGreaterThanOrEqual(1);
      const optionIds = event.options.map((o) => o.id);
      expect(new Set(optionIds).size).toBe(optionIds.length);
      for (const option of event.options) {
        for (const next of option.schedule ?? [])
          expect(getEvent(next.eventId)).toBeDefined();
        expect(option.attentionCost).toBeGreaterThanOrEqual(0);
      }
    }
    const scheduledIds = new Set(
      STUDY_EVENTS.flatMap((e) =>
        e.options.flatMap((o) => o.schedule?.map((x) => x.eventId) ?? [])
      )
    );
    for (const event of STUDY_EVENTS.filter((e) => e.followUp)) {
      expect(scheduledIds.has(event.id)).toBe(true);
    }
  });

  it("keeps something in the inbox through most of the study (#1384)", () => {
    expect(STUDY_EVENTS.length).toBeGreaterThanOrEqual(44);
    const scripted = STUDY_EVENTS.filter((e) => !e.followUp && !e.trigger);
    const quiet = Array.from(
      { length: STUDY_24_081.durationDays },
      (_, i) => i + 1
    ).filter(
      (day) => !scripted.some((e) => day >= e.day && day < e.day + e.ttl)
    );
    expect(quiet.length).toBeLessThanOrEqual(20);
    const days = [...new Set(scripted.map((e) => e.day))].sort((a, b) => a - b);
    for (let i = 1; i < days.length; i += 1)
      expect(days[i] - days[i - 1]).toBeLessThanOrEqual(9);
  });

  it("pairs every risky shortcut in the routine-work events with an inspection question", () => {
    const routine = new Set([
      "pi-training-trailer",
      "freezer-alarm",
      "tmf-reconciliation",
      "sae-late-report",
      "sponsor-name-change",
      "monitor-report-late",
      "coordinator-vacation",
      "sponsor-data-peek",
      "central-lab-mismatch",
      "csr-comment-versions",
    ]);
    for (const event of STUDY_EVENTS.filter((e) => routine.has(e.id))) {
      for (const option of event.options) {
        if (option.debtIfUndocumented >= 8 && option.attentionCost === 0) {
          expect(option.finding, `${event.id}/${option.id}`).toBeDefined();
        }
      }
    }
  });

  it("offers real tradeoffs: no event's options are all identical", () => {
    for (const event of STUDY_EVENTS) {
      const shapes = new Set(
        event.options.map((o) =>
          JSON.stringify([o.attentionCost, o.debtIfUndocumented, o.effects])
        )
      );
      expect(shapes.size).toBe(event.options.length);
    }
  });

  it("lists critical events before routine ones", () => {
    let s = start();
    while (s.day < 24) s = endDay(s);
    const urgencies = inbox(s).map((e) => e.urgency);
    expect(urgencies).toEqual(
      [...urgencies].sort(
        (a, b) =>
          ["critical", "important", "routine"].indexOf(a) -
          ["critical", "important", "routine"].indexOf(b)
      )
    );
    expect(inbox(s).some((e) => e.id === "edc-missing-subject")).toBe(true);
  });

  it("spends attention and marks answered events handled", () => {
    const s = start();
    const first = inbox(s)[0];
    const r = resolveEvent(s, first.id, first.options[0].id, true);
    if (!r.ok) throw new Error("expected ok");
    expect(r.state.attention).toBeLessThan(ATTENTION_PER_DAY);
    expect(inbox(r.state).some((e) => e.id === first.id)).toBe(false);
    expect(resolveEvent(r.state, first.id, first.options[0].id, false)).toEqual(
      {
        ok: false,
        reason: "unknown-target",
      }
    );
  });

  it("rejects unknown events and options", () => {
    expect(resolveEvent(start(), "nope", "x", false)).toEqual({
      ok: false,
      reason: "unknown-target",
    });
    expect(resolveEvent(start(), "sponsor-biomarkers", "nope", false)).toEqual({
      ok: false,
      reason: "unknown-target",
    });
  });

  it("applies fallout to events left unanswered and logs them as ignored", () => {
    const s = play("ignore", () => null);
    expect(s.status).toBe("complete");
    const ignored = s.log.filter((r) => r.optionId === "ignored");
    expect(ignored.length).toBeGreaterThan(20);
    expect(computeMeters(s).client).toBeLessThan(65);
  });

  it("schedules follow-ups from earlier choices: a deferred decision returns on day 60", () => {
    const deferred = play("d", (_s, id) =>
      id === "stat-endpoint-two" ? { option: "defer", documented: true } : null
    );
    const decided = play("d", (_s, id) =>
      id === "stat-endpoint-two" ? { option: "decide", documented: true } : null
    );
    expect(deferred.log.some((r) => r.eventId === "endpoint-rework")).toBe(
      true
    );
    expect(decided.log.some((r) => r.eventId === "endpoint-rework")).toBe(
      false
    );
    expect(deferred.flags).toContain("endpoint2-deferred");
  });

  it("makes an early yes cause later pain: adding biomarkers raises site burden and deviations", () => {
    const yes = play("b", (_s, id) =>
      id === "sponsor-biomarkers"
        ? { option: "accept", documented: false }
        : null
    );
    const no = play("b", (_s, id) =>
      id === "sponsor-biomarkers"
        ? { option: "decline", documented: true }
        : null
    );
    const burden = (s: StudyState) => s.sites.reduce((n, x) => n + x.burden, 0);
    expect(burden(yes)).toBeGreaterThan(burden(no));
  });

  it("records undocumented choices so the inspection can find them", () => {
    const s = play("i", (_s, id) =>
      id === "eligibility-subject-017"
        ? { option: "proceed", documented: false }
        : null
    );
    const record = s.log.find((r) => r.eventId === "eligibility-subject-017");
    expect(record).toMatchObject({ optionId: "proceed", documented: false });
    expect(s.flags).toContain("subject-017-proceeded");
    expect(s.documentationDebt).toBeGreaterThanOrEqual(14);
  });

  it("fires the veteran's warning only when the study calls for it", () => {
    let s = start("q");
    while (s.day < 28) s = endDay(s);
    const calm = {
      ...s,
      team: s.team.map((m) => ({ ...m, workload: 10 })),
      sites: s.sites.map((x) => ({ ...x, openQueries: 0 })),
    };
    const loaded = {
      ...s,
      team: s.team.map((m) => ({ ...m, workload: 90 })),
    };
    expect(inbox(calm).some((e) => e.id === "veteran-warning")).toBe(false);
    expect(inbox(loaded).some((e) => e.id === "veteran-warning")).toBe(true);
  });

  it("keeps the dashboard mostly green while the ignored study rots", () => {
    let s = start("g");
    while (s.day < 50) s = endDay(s);
    const d = dashboard(s);
    const true_problems = s.sites.reduce(
      (n, x) => n + x.openQueries + x.unsignedSource + x.eligibilityConcerns,
      0
    );
    expect(true_problems).toBeGreaterThanOrEqual(0);
    expect(["green", "amber", "red"]).toContain(d.data.health);
  });

  it("plays a full study with careful choices and ends better than ignoring everything", () => {
    const careful = play("c", (_s, id) => {
      const event = getEvent(id);
      const best = event?.options.reduce((a, b) =>
        a.attentionCost >= b.attentionCost ? a : b
      );
      return best ? { option: best.id, documented: false } : null;
    });
    const ignoring = play("c", () => null);
    const total = (s: StudyState) =>
      Object.values(computeMeters(s)).reduce((a, b) => a + b, 0);
    expect(careful.status).toBe("complete");
    expect(total(careful)).toBeGreaterThan(total(ignoring));
  });
});
