import { describe, expect, it } from "vitest";
import {
  STUDY_24_081,
  STUDY_24_081_SITES,
  STUDY_24_081_TEAM,
  beginStudy,
  classifyProfile,
  createStudy,
  endDay,
  evaluate,
  finalizeStudy,
  getEvent,
  inbox,
  inspectionReadiness,
  lockDatabase,
  resolveEvent,
  runInspection,
  type StudyState,
} from "@/lib/study-director";

type Policy = (id: string) => { option: string; documented: boolean } | null;

function play(seed: string, policy: Policy): StudyState {
  let s = beginStudy(
    createStudy(seed, STUDY_24_081, STUDY_24_081_SITES, STUDY_24_081_TEAM)
  );
  while (s.status === "running") {
    for (const event of inbox(s)) {
      const choice = policy(event.id);
      if (!choice) continue;
      const r = resolveEvent(s, event.id, choice.option, choice.documented);
      if (r.ok) s = r.state;
    }
    s = endDay(s);
  }
  return s;
}

const documentEverything: Policy = (id) => {
  const o =
    getEvent(id)?.options.find((x) => x.finding) ?? getEvent(id)?.options[0];
  return o ? { option: o.id, documented: true } : null;
};

describe("study director endgame", () => {
  it("locks the database: open queries cost days and are then cleared", () => {
    const base = play("l", () => null);
    const loaded = {
      ...base,
      queriesRaised: 40,
      sites: base.sites.map((s, i) => ({
        ...s,
        openQueries: i === 0 ? 20 : 0,
      })),
    };
    const { state, summary } = lockDatabase(loaded);
    expect(summary.openQueriesAtLock).toBe(20);
    expect(summary.dataCleanPct).toBe(50);
    expect(summary.lockDelayDays).toBeGreaterThan(0);
    expect(state.day).toBe(loaded.day + summary.lockDelayDays);
    expect(state.sites.every((s) => s.openQueries === 0)).toBe(true);
  });

  it("locks cleanly when nothing is open", () => {
    const base = play("l2", () => null);
    const clean = {
      ...base,
      sites: base.sites.map((s) => ({ ...s, openQueries: 0 })),
    };
    expect(lockDatabase(clean).summary.lockDelayDays).toBe(0);
  });

  it("turns an undocumented 'we'll document later' into a major observation", () => {
    const undocumented = play("f", (id) =>
      id === "eligibility-subject-017"
        ? { option: "proceed", documented: false }
        : null
    );
    const documented = play("f", (id) =>
      id === "eligibility-subject-017"
        ? { option: "proceed", documented: true }
        : null
    );
    const find = (s: StudyState) =>
      inspectionReadiness(s).items.find(
        (i) => i.eventId === "eligibility-subject-017"
      );
    expect(find(undocumented)).toMatchObject({
      outcome: "major",
      documented: false,
    });
    expect(find(undocumented)?.question).toMatch(/creatinine/);
    expect(find(documented)).toMatchObject({
      outcome: "closed",
      documented: true,
    });
    expect(find(documented)?.answer).toMatch(/hemolyzed/);
  });

  it("treats an ignored critical message as a major finding, but not an ignored routine one", () => {
    const s = play("ig", () => null);
    const items = inspectionReadiness(s).items;
    expect(
      items.some(
        (i) => i.eventId === "edc-missing-subject" && i.outcome === "major"
      )
    ).toBe(true);
    expect(items.some((i) => i.eventId === "lab-manual")).toBe(false);
  });

  it("grades from the number of majors and minors", () => {
    const s = play("gr", () => null);
    const grade = inspectionReadiness(s).grade;
    expect(["C", "D", "F"]).toContain(grade);
    const perfect = play("gr", documentEverything);
    expect(["A", "B", "C"]).toContain(inspectionReadiness(perfect).grade);
    expect(
      inspectionReadiness(perfect).items.filter((i) => i.outcome === "major")
        .length
    ).toBeLessThan(
      inspectionReadiness(s).items.filter((i) => i.outcome === "major").length
    );
  });

  it("makes the FDA more likely to visit when documentation debt is high", () => {
    const base = play("v", () => null);
    let low = 0;
    let high = 0;
    for (let i = 0; i < 200; i += 1) {
      const seeded = { ...base, seed: `seed-${i}` };
      if (runInspection({ ...seeded, documentationDebt: 0 }).triggered)
        low += 1;
      if (runInspection({ ...seeded, documentationDebt: 100 }).triggered)
        high += 1;
    }
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeLessThan(200);
  });

  it("is deterministic per state", () => {
    const s = play("d", () => null);
    expect(runInspection(s)).toEqual(runInspection(s));
    expect(finalizeStudy(s)).toEqual(finalizeStudy(s));
  });

  it("evaluates all four verdicts in range", () => {
    const e = evaluate(play("e", documentEverything));
    expect(e.sponsor.stars).toBeGreaterThanOrEqual(1);
    expect(e.sponsor.stars).toBeLessThanOrEqual(5);
    expect(e.sponsor.quote.length).toBeGreaterThan(0);
    expect(e.science.evaluablePct).toBeLessThanOrEqual(100);
    expect(e.science.evaluablePct).toBeGreaterThanOrEqual(0);
    expect(e.company.marginPct).toBeLessThanOrEqual(100);
    expect(["A", "B", "C", "D", "F"]).toContain(e.regulatory.grade);
  });

  it("can produce a happy sponsor with a bad margin, and vice versa", () => {
    const s = play("m", () => null);
    const pleased = evaluate({
      ...s,
      adjust: { ...s.adjust, client: 60 },
      spent: STUDY_24_081.budget * 1.3,
    });
    expect(pleased.sponsor.stars).toBeGreaterThanOrEqual(4);
    expect(pleased.company.marginPct).toBeLessThan(0);
    const tight = evaluate({
      ...s,
      adjust: { ...s.adjust, client: -80 },
      spent: STUDY_24_081.budget * 0.6,
    });
    expect(tight.sponsor.stars).toBe(1);
    expect(tight.company.marginPct).toBeGreaterThan(30);
  });

  it("discovers different Study Directors from different play", () => {
    const documenter = classifyProfile(play("p", documentEverything));
    const ignorer = classifyProfile(play("p", () => null));
    expect(ignorer.profile).toBe("firefighter");
    expect(documenter.profile).not.toBe("firefighter");
    expect(documenter.evidence).toHaveLength(3);
    expect(documenter.title).toMatch(/^The /);
  });

  it("detects a control freak from repeated audits and a delegator from hand-offs", () => {
    const base = play("cf", () => null);
    const audits = Array.from({ length: 5 }, (_, i) => ({
      day: i + 1,
      eventId: `audit:site-0${(i % 3) + 1}`,
      optionId: "audit",
      label: "Audit",
      documented: true,
      attentionSpent: 2,
      effects: {},
    }));
    expect(classifyProfile({ ...base, log: audits }).profile).toBe(
      "controlFreak"
    );
    const handoffs = Array.from({ length: 8 }, (_, i) => ({
      day: i + 1,
      eventId: "lab-manual",
      optionId: "walt",
      label: "Hand off",
      documented: false,
      attentionSpent: 0,
      effects: { workload: [{ memberId: "walt", delta: 5 }] },
    }));
    expect(classifyProfile({ ...base, log: handoffs }).profile).toBe(
      "delegator"
    );
  });

  it("finalizes a study into one report", () => {
    const report = finalizeStudy(play("r", documentEverything));
    expect(report.lock.dataCleanPct).toBeGreaterThanOrEqual(0);
    expect(report.inspection.items.length).toBeGreaterThanOrEqual(0);
    expect(report.state.status).toBe("complete");
  });
});
