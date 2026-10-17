import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { getEvent, inbox } from "@/lib/study-director";
import {
  WORLD_SAVE_KEY,
  adjustTrust,
  bondFor,
  choosePriority,
  decide,
  endMeeting,
  eveningWrapUp,
  goHome,
  hudReadout,
  newWorld,
  parseWorld,
  serializeWorld,
  startDay,
  startMeeting,
  type PlayerState,
  type WorldState,
} from "@/lib/study-director-world";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";
import { hudChanges } from "@/components/study-director-world/hud-model";

// Round 4 of the Study Director playtest (2026-10-17): #2344 and #2345.

function expectOk<T extends { ok: boolean }>(
  result: T
): Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
  return result as Extract<T, { ok: true }>;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** "ui-team" rings Arcadia on day 1; "assess" costs $4,000. */
const SEED = "ui-team";
const EVENT = "sponsor-biomarkers";
const day1 = (seed = SEED): WorldState =>
  startDay(newWorld(seed, "standard")).world;

/** What the budget line should say once the study stands at `spent`. */
const budgetLine = (moved: number, world: WorldState) =>
  `Budget: −${money(moved)} (${money(world.study.spent)} of ${money(world.study.setup.budget)} spent).`;

const inConference = (world: WorldState): WorldState => ({
  ...world,
  minute: 9 * 60 + 50,
  player: { x: 15, y: 10, facing: "down" },
  location: "conference",
});

describe("a priced choice says its price where it is made (#2344)", () => {
  it("puts the cost and the running total in the decision's result lines", () => {
    const world = day1();
    const result = expectOk(decide(world, EVENT, "assess"));
    const moved = result.world.study.spent - world.study.spent;
    expect(moved).toBe(4000);
    expect(result.lines.map((l) => l.text)).toContain(
      budgetLine(moved, result.world)
    );
  });

  it("says nothing about money for a choice that costs none", () => {
    const world = day1();
    const result = expectOk(decide(world, EVENT, "decline"));
    expect(result.world.study.spent).toBe(world.study.spent);
    expect(result.lines.some((l) => /Budget/.test(l.text))).toBe(false);
  });

  it("puts what the room's decisions cost in the meeting summary", () => {
    const call = expectOk(
      startMeeting(inConference(day1()), "sponsor", [])
    ).world;
    const decided = expectOk(decide(call, EVENT, "assess", "meeting")).world;
    const { report, world } = expectOk(endMeeting(decided));
    expect(report.changes).toContain(budgetLine(4000, world));
    // The price is not something the meeting changed: the verdict counts
    // the same as before.
    expect(report.verdict).toBe("Some of it was useful.");
  });

  it("speaks a budget move in the HUD live region", () => {
    const world = day1();
    const after = expectOk(decide(world, EVENT, "assess")).world;
    const said = hudChanges(
      hudReadout(world),
      hudReadout(after),
      world.minute,
      after.minute
    );
    expect(said).toContain(
      `Budget −${money(4000)}, ${money(after.study.spent)} of ${money(after.study.setup.budget)} spent.`
    );
  });
});

describe("the priced choice in the office (#2344)", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  function renderAt(player: PlayerState, patch: Partial<WorldState> = {}) {
    const world = { ...day1(), player, location: "office" as const, ...patch };
    globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(world));
    render(<StudyDirectorWorld onExit={vi.fn()} />);
    return { world, playfield: screen.getByTestId("world-playfield") };
  }
  const current = () =>
    parseWorld(globalThis.localStorage.getItem(WORLD_SAVE_KEY));

  it("states the price in the desk dialog and the HUD live region", () => {
    const { playfield } = renderAt({ x: 4, y: 3, facing: "up" });
    fireEvent.keyDown(playfield, { key: "e" });
    fireEvent.click(
      within(screen.getByRole("dialog", { name: "Your desk" })).getByRole(
        "button",
        { name: /Call: Arcadia/ }
      )
    );
    const dialog = screen.getByRole("dialog", { name: /Exploratory/ });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Add them after an impact/ })
    );
    const after = current();
    if (!after) throw new Error("no save");
    expect(dialog.textContent).toContain(budgetLine(4000, after));
    expect(screen.getByTestId("world-hud-notice").textContent).toContain(
      `Budget −$4,000, ${money(after.study.spent)} of ${money(after.study.setup.budget)} spent.`
    );
  });

  it("states the price on the sponsor call card and in its summary", () => {
    renderAt({ x: 15, y: 10, facing: "down" }, { location: "conference" });
    fireEvent.click(
      within(screen.getByTestId("world-meeting")).getByRole("button", {
        name: /Sponsor call/,
      })
    );
    const room = screen.getByTestId("world-meeting");
    fireEvent.click(
      within(room).getByRole("button", { name: /Add them after an impact/ })
    );
    const decided = current();
    if (!decided) throw new Error("no save");
    expect(screen.getByTestId("world-meeting").textContent).toContain(
      budgetLine(4000, decided)
    );
    fireEvent.click(screen.getByRole("button", { name: "End the meeting" }));
    const report = screen.getByRole("dialog", { name: "Sponsor call over" });
    expect(report.textContent).toContain(budgetLine(4000, decided));
  });
});

describe("Be with the team says what it counts (#2345)", () => {
  /** A people day on which the player only decided things face to face. */
  function decidedInPerson(): WorldState {
    // Priya's "Endpoint 2 derivation" comes on day 2.
    const day2 = startDay(goHome(day1("people-f2f")).world).world;
    let world = expectOk(choosePriority(day2, "people")).world;
    let faceToFace = 0;
    for (const event of inbox(world.study)) {
      const option = getEvent(event.id)?.options[0];
      if (!option) continue;
      const r = decide(world, event.id, option.id, "talk");
      if (!r.ok || !r.lines.some((l) => /You got back to them/.test(l.text)))
        continue;
      world = r.world;
      faceToFace += 1;
    }
    expect(faceToFace).toBeGreaterThan(0);
    return world;
  }

  it("does not say you saw nobody after deciding things in person", () => {
    const text = eveningWrapUp(decidedInPerson())
      .map((l) => l.text)
      .join(" ");
    expect(text).not.toMatch(/did not spend time with anyone/);
    expect(text).toMatch(
      /Be with the team: no kind acts today \(a chat, a coffee, coaching, a status check or a favour\)\. Not kept\./
    );
  });

  it("names kind acts when some were done but not enough", () => {
    let world = decidedInPerson();
    const [first] = world.study.team;
    world = adjustTrust(world, first.id, "talk").world;
    const text = eveningWrapUp(world)
      .map((l) => l.text)
      .join(" ");
    expect(text).toMatch(
      /Be with the team: kind acts for only 1 of the team, short of 3\. Not kept\./
    );
  });

  it("still counts a talk once a day, so trust cannot be farmed", () => {
    const world = decidedInPerson();
    const [first] = world.study.team;
    const once = adjustTrust(world, first.id, "talk");
    const twice = adjustTrust(once.world, first.id, "talk");
    expect(once.delta).toBeGreaterThan(0);
    expect(twice.delta).toBe(0);
    expect(bondFor(twice.world, first.id).trust).toBe(
      bondFor(once.world, first.id).trust
    );
  });

  it("says Kept with kind acts for three of the team", () => {
    let world = decidedInPerson();
    for (const m of world.study.team.slice(0, 3))
      world = adjustTrust(world, m.id, "talk").world;
    const text = eveningWrapUp(world)
      .map((l) => l.text)
      .join(" ");
    expect(text).toMatch(
      /Be with the team: kind acts for 3 of the team\. Kept\./
    );
  });
});
