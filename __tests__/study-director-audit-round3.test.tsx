import React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import {
  applyEffects,
  finalizeStudy,
  getEvent,
  inbox,
} from "@/lib/study-director";
import {
  WORLD_SAVE_KEY,
  answerInterruption,
  carOutcome,
  choosePriority,
  decide,
  endMeeting,
  eveningWrapUp,
  goHome,
  newWorld,
  pendingInterruption,
  planFor,
  scheduleFor,
  serializeWorld,
  startDay,
  startMeeting,
  travel,
  type WorldState,
} from "@/lib/study-director-world";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";
import { feedbackBetween } from "@/components/study-director-world/feedback-model";
import { todaysTasks } from "@/components/study-director-world/stage-model";
import { ReportView } from "@/components/study-director/ReportView";

// Round 3 of the Study Director playtest (2026-10-16): #2334 to #2337.

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

const day1 = (seed: string): WorldState =>
  startDay(newWorld(seed, "standard")).world;

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

function tick(times: number) {
  for (let i = 0; i < times; i += 1)
    act(() => {
      vi.advanceTimersByTime(120);
    });
}

function openDirectory() {
  const toggle = screen
    .getAllByRole("button", { name: /directory/i })
    .find((b) => b.getAttribute("aria-expanded") === "false");
  if (toggle) fireEvent.click(toggle);
}

const letItRing = () => {
  const ring = screen.queryByRole("button", { name: "Let it ring" });
  if (ring) fireEvent.click(ring);
};

describe("going home from a site, the way the car does it (#2334)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not blame the player for what came while they were at the site", () => {
    const morning = day1("away-1");
    const atSite = expectOk(
      travel({ ...morning, minute: 8 * 60 + 57 }, "site-03")
    ).world;
    // Noon at the site: the 10:00 interruption came and lapsed meanwhile.
    const late = { ...atSite, minute: 11 * 60 + 50 };
    globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(late));
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    const playfield = screen.getByTestId("world-playfield");
    letItRing();
    openDirectory();
    fireEvent.click(screen.getByRole("button", { name: /Walk to Your car/ }));
    tick(60);
    fireEvent.keyDown(playfield, { key: "e" });
    const car = screen.getByTestId("world-outcome");
    fireEvent.click(within(car).getByRole("button", { name: "Go home" }));
    const overnight = screen.getByTestId("world-overnight");
    expect(overnight.textContent).not.toMatch(/go unanswered/);
  });
});

describe("decision spend is reported (#2335)", () => {
  /** Day 1 with one of its decisions taken that costs money. */
  function withCharge(): { before: WorldState; after: WorldState } {
    for (const seed of ["spend-1", "spend-2", "spend-3", "spend-4"]) {
      const world = day1(seed);
      for (const event of inbox(world.study)) {
        const option = getEvent(event.id)?.options.find(
          (o) => (o.effects.spend ?? 0) > 0
        );
        if (!option) continue;
        const r = decide(world, event.id, option.id);
        if (r.ok && r.world.study.spent > world.study.spent)
          return { before: world, after: r.world };
      }
    }
    throw new Error("no day-1 decision with a charge");
  }

  it("counts the day's decisions in what the overnight card says was spent", () => {
    const { before, after } = withCharge();
    const charge = after.study.spent - before.study.spent;
    const night = goHome(after);
    const total = night.world.study.spent - before.study.spent;
    const line = night.report.lines.find((l) => / spent today/.test(l.text));
    expect(line?.text).toBe(
      `${money(total)} spent today, ${money(night.world.study.spent)} of ${money(night.world.study.setup.budget)} so far (${money(charge)} of it on today's decisions)`
    );
  });

  it("toasts the budget when a decision costs money", () => {
    const { before, after } = withCharge();
    const charge = after.study.spent - before.study.spent;
    const toast = feedbackBetween(before, after).find((f) =>
      f.text.startsWith("Budget")
    );
    expect(toast).toMatchObject({
      text: `Budget −${money(charge)}`,
      tone: "bad",
    });
  });

  it("nets a credit no decision record carries, such as an invoice sent back", () => {
    const world = day1("spend-credit");
    const credited = {
      ...world,
      study: applyEffects(world.study, { spend: -1500 }),
    };
    const night = goHome(credited);
    const total = night.world.study.spent - world.study.spent;
    const running = night.world.study.spent - credited.study.spent;
    const line = night.report.lines.find((l) => / spent today/.test(l.text));
    expect(line?.text).toBe(
      `${money(total)} spent today, ${money(night.world.study.spent)} of ${money(night.world.study.setup.budget)} so far (${money(running)} running costs, less $1,500 back from today's decisions)`
    );
  });

  it("keeps the plain line on a day with no decision spend", () => {
    const world = day1("spend-quiet");
    const night = goHome(world);
    const line = night.report.lines.find((l) => / spent today/.test(l.text));
    expect(line?.text).toMatch(
      /^\$[\d,]+ spent today, \$[\d,]+ of \$[\d,]+ so far$/
    );
  });
});

describe("an outcome card does not hide the interruption (#2336)", () => {
  // probe-2 has an interruption waiting at 10:02 on day 1.
  const waiting = (): WorldState => ({
    ...day1("probe-2"),
    minute: 10 * 60 + 2,
    player: { x: 4, y: 4, facing: "down" },
    location: "office",
  });

  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the interruption on screen beside the F card", () => {
    const world = waiting();
    const pending = pendingInterruption(world);
    if (!pending) throw new Error("nothing pending");
    globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(world));
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    letItRing();
    fireEvent.keyDown(screen.getByTestId("world-playfield"), { key: "f" });
    expect(screen.getByTestId("world-outcome")).toBeTruthy();
    expect(screen.getByTestId("world-interruption").textContent).toContain(
      pending.title
    );
  });

  it("names the card, not a place the panel is not", () => {
    const task = todaysTasks(waiting()).find((t) => t.id === "interruption");
    expect(task?.where).not.toMatch(/below the stage/);
    expect(task?.where).toBe('Answer it on the "Just now" card');
  });

  it("warns at the car that going home leaves the interruption unanswered", () => {
    const world = waiting();
    const pending = pendingInterruption(world);
    if (!pending) throw new Error("nothing pending");
    expect(carOutcome(world).lines).toContain(
      `"${pending.title}" is still waiting for an answer. Going home leaves it unanswered.`
    );
    const answered = expectOk(
      answerInterruption(world, pending.options[0].id)
    ).world;
    expect(carOutcome(answered).lines.join(" ")).not.toMatch(/still waiting/);
  });
});

describe("copy that matches the numbers (#2337)", () => {
  afterEach(cleanup);

  it("says 1 meeting, not 1 meetings, on the closeout", () => {
    const morning = day1("plural-1");
    const call = expectOk(
      startMeeting(
        {
          ...morning,
          minute: 9 * 60 + 50,
          player: { x: 15, y: 10, facing: "down" },
          location: "conference",
        },
        "team",
        ["walt"]
      )
    ).world;
    const world = expectOk(endMeeting(call)).world;
    expect(world.meetingHistory).toHaveLength(1);
    const report = finalizeStudy({ ...world.study, status: "complete" });
    render(<ReportView report={report} world={world} onRestart={() => {}} />);
    expect(document.body.textContent).toMatch(/1 meeting, 0 site visits/);
    expect(document.body.textContent).not.toMatch(/1 meetings/);
  });

  it("writes a zero case for Be with the team", () => {
    const world = expectOk(choosePriority(day1("people-0"), "people")).world;
    const text = eveningWrapUp(world)
      .map((l) => l.text)
      .join(" ");
    expect(text).toMatch(
      /Be with the team: you did not spend time with anyone on the team\. Not kept\./
    );
    expect(text).not.toMatch(/got to 0/);
  });

  /** A world on the first day finance turns up, with spend set. */
  function financeDay(share: number): WorldState {
    const base = day1("finance-1");
    for (let day = 1; day < 60; day += 1) {
      const study = { ...base.study, day };
      const slot = scheduleFor({ ...base, study }).find(
        (s) => s.interruption.id === "financeBurn"
      );
      if (!slot) continue;
      const pace =
        (study.setup.budget * Math.min(day, study.setup.durationDays)) /
        study.setup.durationDays;
      return {
        ...base,
        study: { ...study, spent: pace * share },
        plan: { ...planFor(base), day },
        minute: slot.at,
      };
    }
    throw new Error("finance never visits");
  }

  it("does not say spend is ahead of the plan when it is behind", () => {
    const behind = pendingInterruption(financeDay(0.5));
    expect(behind?.id).toBe("financeBurn");
    expect(behind?.body).not.toMatch(/ahead of the plan/);
    expect(behind?.body).toMatch(/behind the plan/);
    const told = expectOk(answerInterruption(financeDay(0.5), "explain"));
    expect(told.result).not.toMatch(/invoice nobody expected/);
  });

  it("still says ahead when it is", () => {
    const ahead = pendingInterruption(financeDay(1.3));
    expect(ahead?.body).toMatch(/ahead of the plan/);
  });
});
