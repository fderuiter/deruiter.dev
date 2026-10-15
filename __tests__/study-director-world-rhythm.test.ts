// @vitest-environment node
import { describe, expect, it } from "vitest";
import { inbox } from "@/lib/study-director";
import {
  INTERRUPTION_TIMES,
  INTERRUPTION_WINDOW,
  PEOPLE_DAY_TARGET,
  PEOPLE_PRIORITY_BONUS,
  PRIORITIES,
  TRUST_EFFECTS,
  adjustTrust,
  answerInterruption,
  bondFor,
  choosePriority,
  eveningWrapUp,
  goHome,
  newWorld,
  pendingInterruption,
  planFor,
  scheduleFor,
  settlePriority,
  startDay,
  type WorldState,
} from "@/lib/study-director-world";

const fresh = (seed = "rhythm-1"): WorldState =>
  startDay(newWorld(seed, "standard")).world;

const at = (w: WorldState, minute: number): WorldState => ({ ...w, minute });

/** The same world with one member's workload set. */
const withLoad = (
  w: WorldState,
  memberId: string,
  workload: number
): WorldState => ({
  ...w,
  study: {
    ...w.study,
    team: w.study.team.map((m) => (m.id === memberId ? { ...m, workload } : m)),
  },
});

describe("the day's plan", () => {
  it("starts each morning with no priority and nothing handled", () => {
    const w = fresh();
    expect(planFor(w)).toEqual({ day: 1, priority: null, handled: [] });
    expect(w.plan).toEqual({ day: 1, priority: null, handled: [] });
  });

  it("lets the player choose once, and keeps the first choice", () => {
    const w = fresh();
    const first = choosePriority(w, "people");
    expect(first).toMatchObject({ ok: true, changed: true });
    if (!first.ok) return;
    expect(planFor(first.world).priority).toBe("people");
    const second = choosePriority(first.world, "desk");
    expect(second).toMatchObject({ ok: true, changed: false });
    if (!second.ok) return;
    expect(planFor(second.world).priority).toBe("people");
  });

  it("describes every priority", () => {
    for (const id of ["people", "sites", "desk"] as const) {
      expect(PRIORITIES[id].label.length).toBeGreaterThan(3);
      expect(PRIORITIES[id].promise.length).toBeGreaterThan(20);
    }
  });

  it("forgets yesterday's choice on a new day", () => {
    const w = fresh();
    const chosen = choosePriority(w, "sites");
    if (!chosen.ok) throw new Error("choose failed");
    const tomorrow = {
      ...chosen.world,
      study: { ...chosen.world.study, day: 2 },
    };
    expect(planFor(tomorrow).priority).toBeNull();
  });
});

describe("priorities change trust", () => {
  it("adds a little to every kind act on a people day, and only then", () => {
    const w = fresh();
    const member = w.study.team[0].id;
    const plain = adjustTrust(w, member, "heard");
    expect(plain.delta).toBe(TRUST_EFFECTS.heard);
    const chosen = choosePriority(w, "people");
    if (!chosen.ok) throw new Error("choose failed");
    const kind = adjustTrust(chosen.world, member, "heard");
    expect(kind.delta).toBe(TRUST_EFFECTS.heard + PEOPLE_PRIORITY_BONUS);
    // Unkind acts are not softened.
    const harsh = adjustTrust(chosen.world, member, "ignore");
    expect(harsh.delta).toBe(TRUST_EFFECTS.ignore);
    // Another priority gives no bonus.
    const desk = choosePriority(w, "desk");
    if (!desk.ok) throw new Error("choose failed");
    expect(adjustTrust(desk.world, member, "heard").delta).toBe(
      TRUST_EFFECTS.heard
    );
  });
});

describe("interruptions", () => {
  it("schedules three distinct interruptions a day, fixed by the seed", () => {
    const w = fresh();
    const a = scheduleFor(w);
    expect(a.map((s) => s.at)).toEqual([...INTERRUPTION_TIMES]);
    expect(new Set(a.map((s) => s.interruption.id)).size).toBe(3);
    expect(scheduleFor(fresh())).toEqual(a);
    const other = scheduleFor(fresh("rhythm-other"));
    const days = [1, 2, 3, 4].map((d) =>
      scheduleFor({ ...w, study: { ...w.study, day: d } }).map(
        (s) => s.interruption.id
      )
    );
    // The mix changes from day to day and from run to run.
    expect(new Set(days.map((d) => d.join())).size).toBeGreaterThan(1);
    expect(other).toHaveLength(3);
  });

  it("does not arrive before its time, or at a site, or once home", () => {
    const w = fresh();
    expect(pendingInterruption(at(w, 9 * 60))).toBeNull();
    expect(pendingInterruption(at(w, 10 * 60))).not.toBeNull();
    expect(
      pendingInterruption({
        ...at(w, 11 * 60),
        visit: { siteId: "site-01", mapId: "site-01" } as WorldState["visit"],
      })
    ).toBeNull();
    expect(
      pendingInterruption({ ...at(w, 11 * 60), location: "home" })
    ).toBeNull();
  });

  it("charges its cost, applies its effect and marks it handled", () => {
    const w = at(fresh(), 10 * 60);
    const pending = pendingInterruption(w);
    if (!pending) throw new Error("nothing pending");
    for (const option of pending.options) {
      const result = answerInterruption(w, option.id);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.result).toBe(option.result);
      expect(result.world.minute).toBeGreaterThanOrEqual(
        w.minute + option.cost.minutes
      );
      expect(planFor(result.world).handled).toContain(pending.id);
      // The next one is a different interruption, or none yet.
      expect(pendingInterruption(result.world)?.id).not.toBe(pending.id);
    }
  });

  it("refuses an unknown option, and a second answer to the same one", () => {
    const w = at(fresh(), 10 * 60);
    expect(answerInterruption(w, "nope")).toMatchObject({ ok: false });
    const pending = pendingInterruption(w);
    if (!pending) throw new Error("nothing pending");
    const done = answerInterruption(w, pending.options[0].id);
    if (!done.ok) throw new Error("answer failed");
    expect(
      answerInterruption(
        { ...done.world, minute: 10 * 60 + 1 },
        pending.options[0].id
      )
    ).toMatchObject({ ok: false });
  });

  it("lapses once its window has passed, so nothing waits until 10 PM (#2189)", () => {
    const w = fresh();
    const [first] = scheduleFor(w);
    expect(pendingInterruption(at(w, first.at))?.id).toBe(
      first.interruption.id
    );
    expect(
      pendingInterruption(at(w, first.at + INTERRUPTION_WINDOW - 1))?.id
    ).toBe(first.interruption.id);
    expect(pendingInterruption(at(w, 21 * 60 + 58))).toBeNull();
  });
});

describe("the evening wrap-up", () => {
  it("says what the day came to, and what slipped", () => {
    const w = at(fresh(), 17 * 60);
    const lines = eveningWrapUp(w).map((l) => l.text);
    expect(lines[0]).toBe("You decided nothing today.");
    expect(lines.some((l) => /message/.test(l))).toBe(true);
    // Three interruptions have arrived by 17:00 and none was answered.
    expect(lines.filter((l) => /unanswered/.test(l))).toHaveLength(3);
  });

  it("counts the interruptions that were dealt with", () => {
    const w = at(fresh(), 10 * 60);
    const pending = pendingInterruption(w);
    if (!pending) throw new Error("nothing pending");
    const done = answerInterruption(w, pending.options[0].id);
    if (!done.ok) throw new Error("answer failed");
    const lines = eveningWrapUp(at(done.world, 11 * 60)).map((l) => l.text);
    expect(lines).toContain("You dealt with 1 interruption.");
  });

  it("reports whether the chosen priority was kept", () => {
    const w = fresh();
    const chosen = choosePriority(w, "people");
    if (!chosen.ok) throw new Error("choose failed");
    const missed = eveningWrapUp(at(chosen.world, 12 * 60)).map((l) => l.text);
    expect(missed.some((l) => /Not kept/.test(l))).toBe(true);
    let kept = chosen.world;
    for (const m of kept.study.team.slice(0, PEOPLE_DAY_TARGET)) {
      kept = {
        ...kept,
        bonds: {
          ...kept.bonds,
          [m.id]: { ...bondFor(kept, m.id), talkedDay: kept.study.day },
        },
      };
    }
    expect(
      eveningWrapUp(at(kept, 12 * 60)).some((l) => /Kept\./.test(l.text))
    ).toBe(true);
  });

  it("travels with the overnight report", () => {
    const w = at(fresh(), 17 * 60);
    const home = goHome(w);
    expect(home.report.wrapUp?.[0].text).toBe("You decided nothing today.");
  });
});

describe("what the priority reveals overnight", () => {
  it("people: says who was still at their desk, or that everyone left on time", () => {
    const w = fresh();
    const chosen = choosePriority(w, "people");
    if (!chosen.ok) throw new Error("choose failed");
    const { lines } = settlePriority(at(chosen.world, 18 * 60));
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => /desk when you left|on time/.test(l.text))).toBe(
      true
    );
  });

  it("people: does not say who stayed late when the player left early or delegated (#2193)", () => {
    const w = withLoad(fresh(), "walt", 98);
    const chosen = choosePriority(w, "people");
    if (!chosen.ok) throw new Error("choose failed");
    const late = settlePriority(at(chosen.world, 18 * 60)).lines;
    expect(late.map((l) => l.text)).toContain(
      "Walt was still at their desk when you left."
    );
    const early = settlePriority(at(chosen.world, 8 * 60)).lines;
    expect(early.map((l) => l.text)).toEqual([
      "You left before the end of the day, so you did not see who stayed late.",
    ]);
    const delegated = settlePriority(at(chosen.world, 18 * 60), {
      delegated: true,
    }).lines;
    expect(delegated.map((l) => l.text)).toEqual([
      "You were not in today, so you did not see who stayed late.",
    ]);
    const home = goHome(at(chosen.world, 8 * 60), { delegated: true });
    expect(
      home.report.lines.some((l) => /still at their desk/.test(l.text))
    ).toBe(false);
  });

  it("sites: does not say a site sent nothing when the player visited it today (#2193)", () => {
    const w = fresh();
    const chosen = choosePriority(w, "sites");
    if (!chosen.ok) throw new Error("choose failed");
    const quiet = w.study.sites.filter((s) => s.coordinator === "invisible");
    expect(quiet.length).toBeGreaterThan(0);
    const visited: WorldState = {
      ...chosen.world,
      siteVisitHistory: quiet.map((s) => ({
        siteId: s.id,
        siteName: s.name,
        day: w.study.day,
        checks: [],
        audited: false,
        findings: [],
        unchecked: [],
        learned: [],
        verdict: "",
      })),
    };
    const text = settlePriority(visited)
      .lines.map((l) => l.text)
      .join(" ");
    expect(text).not.toMatch(/sent nothing/);
    for (const s of quiet) expect(text).toContain(s.name);
    expect(text).toMatch(/yourself today/);
  });

  it("sites: names a site that sent nothing, when there is one", () => {
    const w = fresh();
    const chosen = choosePriority(w, "sites");
    if (!chosen.ok) throw new Error("choose failed");
    const { lines } = settlePriority(chosen.world);
    const quiet = w.study.sites.filter((s) => s.coordinator === "invisible");
    if (quiet.length > 0) {
      for (const s of quiet)
        expect(lines.map((l) => l.text).join(" ")).toContain(s.name);
    } else {
      expect(lines[0].text).toBe("Every site checked in overnight.");
    }
  });

  it("desk: a clear desk earns a point of compliance, an unwritten one does not", () => {
    const w = fresh();
    const chosen = choosePriority(w, "desk");
    if (!chosen.ok) throw new Error("choose failed");
    const eventId = inbox(chosen.world.study)[0]?.id;
    if (!eventId) throw new Error("no event to decide");
    const written = {
      day: 1,
      eventId,
      optionId: "a",
      label: "x",
      documented: true,
      attentionSpent: 0,
      effects: {},
    };
    const clear = settlePriority({
      ...chosen.world,
      study: { ...chosen.world.study, log: [written] },
    });
    expect(clear.lines[0].tone).toBe("good");
    expect(clear.world.study.log).toEqual([written]);
    // The compliance point lands on the study.
    expect(clear.world.study).not.toEqual({
      ...chosen.world.study,
      log: [written],
    });
    const gaps = settlePriority({
      ...chosen.world,
      study: {
        ...chosen.world.study,
        log: [
          {
            day: 1,
            eventId,
            optionId: "a",
            label: "x",
            documented: false,
            attentionSpent: 0,
            effects: {},
          },
        ],
      },
    });
    expect(gaps.lines).toHaveLength(1);
    expect(gaps.lines[0].tone).toBe("bad");
    expect(gaps.world.study).toEqual({
      ...chosen.world.study,
      log: gaps.world.study.log,
    });
  });

  it("desk: an empty day earns nothing, there was nothing to clear (#2190)", () => {
    const chosen = choosePriority(fresh(), "desk");
    if (!chosen.ok) throw new Error("choose failed");
    const empty = settlePriority(chosen.world);
    expect(empty.lines).toEqual([]);
    expect(empty.world).toBe(chosen.world);
  });

  it("is silent when no priority was chosen", () => {
    expect(settlePriority(fresh())).toEqual({ world: fresh(), lines: [] });
  });
});
