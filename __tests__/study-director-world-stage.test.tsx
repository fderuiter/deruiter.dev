import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  CRO_FLOOR,
  isWalkable,
  newWorld,
  phoneCalls,
  placePeople,
  startDay,
  type Facing,
  type PlayerState,
  type WorldState,
} from "@/lib/study-director-world";
import {
  NAMEPLATE_RANGE,
  currentGoal,
  interactionPrompt,
  nameplates,
  todaysTasks,
} from "@/components/study-director-world/stage-model";
import {
  StageLabels,
  TasksPanel,
} from "@/components/study-director-world/StageLabels";

const base = (): WorldState =>
  startDay(newWorld("stage-model", "standard")).world;

/** A spot beside a station, looking at it. */
function facingStation(id: string): PlayerState {
  const s = CRO_FLOOR.stations.find((x) => x.id === id)!;
  const around: Array<[number, number, Facing]> = [
    [0, 1, "up"],
    [0, -1, "down"],
    [1, 0, "left"],
    [-1, 0, "right"],
  ];
  for (const [dx, dy, facing] of around)
    if (isWalkable(CRO_FLOOR, s.x + dx, s.y + dy))
      return { x: s.x + dx, y: s.y + dy, facing };
  throw new Error(`no way to stand at ${id}`);
}

afterEach(cleanup);

describe("interactionPrompt", () => {
  it("names the station you face and what it does", () => {
    const player = facingStation("edc");
    const p = interactionPrompt(CRO_FLOOR, player, []);
    expect(p).toMatchObject({
      kind: "station",
      name: "EDC workstation",
      text: "Press E to use EDC workstation",
    });
    expect(p?.detail).toMatch(/queries/);
  });

  it("names the person you face", () => {
    const w = base();
    const people = placePeople(w, CRO_FLOOR);
    const maya = people.find((x) => x.name === "Maya")!;
    const player: PlayerState = { x: maya.x, y: maya.y + 1, facing: "up" };
    const p = interactionPrompt(CRO_FLOOR, player, people);
    expect(p).toMatchObject({ kind: "person", name: "Maya" });
    expect(p?.text).toBe("Press E to talk to Maya");
  });

  it("is null when you face a wall or an empty floor tile", () => {
    expect(
      interactionPrompt(CRO_FLOOR, { x: 35, y: 12, facing: "left" }, [])
    ).toBeNull();
  });
});

describe("nameplates", () => {
  it("shows people and stations nearby, nearest first, and the faced one however far", () => {
    const w = base();
    const people = placePeople(w, CRO_FLOOR);
    const player = facingStation("edc");
    const near = nameplates(CRO_FLOOR, player, people, null);
    for (const n of near)
      expect(
        Math.abs(n.x - player.x) + Math.abs(n.y - player.y)
      ).toBeLessThanOrEqual(NAMEPLATE_RANGE);
    expect(near.map((n) => n.label)).toContain("EDC workstation");
    const distances = near.map(
      (n) => Math.abs(n.x - player.x) + Math.abs(n.y - player.y)
    );
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);

    // A faced target is always labelled, wherever it is.
    const spawn: PlayerState = { x: 35, y: 12, facing: "up" };
    const coffee = CRO_FLOOR.stations.find((x) => x.id === "coffee")!;
    expect(
      Math.abs(coffee.x - spawn.x) + Math.abs(coffee.y - spawn.y)
    ).toBeGreaterThan(NAMEPLATE_RANGE);
    const withoutIt = nameplates(CRO_FLOOR, spawn, people, null);
    expect(withoutIt.map((n) => n.label)).not.toContain("Coffee machine");
    const withIt = nameplates(CRO_FLOOR, spawn, people, {
      kind: "station",
      x: coffee.x,
      y: coffee.y,
      name: coffee.name,
      text: "Press E",
    });
    expect(withIt.map((n) => n.label)).toContain("Coffee machine");
  });
});

describe("todaysTasks", () => {
  it("lists a ringing phone first, as urgent", () => {
    const w = base();
    const [call] = phoneCalls(w);
    const ringing: WorldState = {
      ...w,
      minute: call.ringAt,
      location: "corridor",
    };
    const tasks = todaysTasks(ringing);
    expect(tasks[0]).toMatchObject({ id: "ringing", urgent: true });
    expect(tasks[0].text).toMatch(/Arcadia Therapeutics/);
  });

  it("is empty once you have gone home", () => {
    expect(todaysTasks({ ...base(), location: "home" })).toEqual([]);
  });

  it("only marks the urgent items urgent", () => {
    const tasks = todaysTasks(base());
    expect(tasks.filter((t) => t.urgent).length).toBeLessThanOrEqual(2);
    for (const t of tasks.filter((x) => !x.urgent))
      expect(t.where.length).toBeGreaterThan(0);
  });
});

describe("currentGoal", () => {
  it("points at the EDC on the first day until the player acts", () => {
    const w = base();
    expect(currentGoal(w, [], false)).toMatch(/EDC workstation/);
    expect(currentGoal(w, [], true)).toBeNull();
  });

  it("then follows the first open task, and stops at home", () => {
    const w = { ...base(), study: { ...base().study, day: 2 } };
    expect(
      currentGoal(
        w,
        [
          {
            id: "x",
            text: "Maya has something for you",
            where: "Find Maya",
            urgent: false,
          },
        ],
        true
      )
    ).toBe("Maya has something for you. Find Maya.");
    expect(currentGoal({ ...w, location: "home" }, [], true)).toBeNull();
  });
});

describe("StageLabels", () => {
  const view = { x: 0, y: 0, w: 40, h: 22 };

  it("places the prompt over the faced tile and drops that nameplate", () => {
    const prompt = interactionPrompt(CRO_FLOOR, facingStation("edc"), [])!;
    render(
      <StageLabels
        view={view}
        prompt={prompt}
        plates={[
          {
            id: "station:edc",
            label: "EDC workstation",
            kind: "station",
            x: prompt.x,
            y: prompt.y,
          },
          { id: "station:phone", label: "Phone", kind: "station", x: 1, y: 1 },
        ]}
      />
    );
    const shown = screen.getByTestId("world-prompt");
    expect(shown.textContent).toMatch(/use EDC workstation/);
    expect(shown.style.left).toMatch(/%$/);
    const plates = screen.getAllByTestId("world-nameplate");
    expect(plates.map((p) => p.textContent)).toEqual(["Phone"]);
  });

  it("leaves out labels that are off screen and is hidden from assistive tech", () => {
    render(
      <StageLabels
        view={{ x: 10, y: 5, w: 10, h: 6 }}
        prompt={null}
        plates={[
          { id: "a", label: "Inside", kind: "person", x: 12, y: 7 },
          { id: "b", label: "Outside", kind: "person", x: 30, y: 7 },
        ]}
      />
    );
    expect(screen.getByTestId("world-labels").getAttribute("aria-hidden")).toBe(
      "true"
    );
    expect(
      screen.getAllByTestId("world-nameplate").map((p) => p.textContent)
    ).toEqual(["Inside"]);
  });
});

describe("TasksPanel", () => {
  it("lists open items with where to go, and says when none are open", () => {
    render(
      <TasksPanel
        tasks={[
          {
            id: "r",
            text: "The phone is ringing: Arcadia",
            where: "Your office",
            urgent: true,
          },
          {
            id: "m",
            text: "2 unread emails",
            where: "Phone in your office",
            urgent: false,
          },
        ]}
      />
    );
    const panel = screen.getByTestId("world-tasks");
    expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
    expect(panel.textContent).toMatch(/Now/);
    cleanup();
    render(<TasksPanel tasks={[]} />);
    expect(screen.getByText(/Nothing is waiting on you/)).toBeTruthy();
  });
});
