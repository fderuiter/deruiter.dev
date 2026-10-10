import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StudyDirectorWorld } from "@/components/study-director-world/StudyDirectorWorld";
import {
  InterruptionCard,
  OvernightCard,
  PriorityCard,
} from "@/components/study-director-world/DayCards";
import {
  WORLD_SAVE_KEY,
  newWorld,
  CRO_FLOOR,
  officeDirectory,
  parseWorld,
  pendingInterruption,
  placePeople,
  planRoute,
  serializeWorld,
  startDay,
  type PlayerState,
  type WorldState,
} from "@/lib/study-director-world";

function saved(patch: Partial<WorldState> = {}): WorldState {
  const world = {
    ...startDay(newWorld("probe-2", "standard")).world,
    ...patch,
  };
  globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(world));
  return world;
}

function renderAt(patch: Partial<WorldState> = {}) {
  const world = saved({ location: "office", ...patch });
  render(<StudyDirectorWorld onExit={vi.fn()} />);
  return { world, playfield: screen.getByTestId("world-playfield") };
}

const current = () =>
  parseWorld(globalThis.localStorage.getItem(WORLD_SAVE_KEY));

beforeEach(() => {
  globalThis.localStorage?.clear?.();
  globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the morning priority", () => {
  it("offers three priorities, and keeps the choice as a line on Today", () => {
    renderAt();
    const card = screen.getByTestId("world-priority");
    const buttons = within(card).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    fireEvent.click(
      within(card).getByRole("button", { name: /Be with the team/ })
    );
    expect(screen.queryByTestId("world-priority")).toBeNull();
    expect(screen.getByTestId("world-priority-line").textContent).toMatch(
      /Priority:\s*Be with the team/
    );
    expect(current()?.plan?.priority).toBe("people");
  });

  it("stops offering the choice after midday", () => {
    renderAt({ minute: 12 * 60 + 5 });
    expect(screen.queryByTestId("world-priority")).toBeNull();
  });

  it("renders the card on its own with a callback", () => {
    const onChoose = vi.fn();
    render(<PriorityCard onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("button", { name: /Clear the desk/ }));
    expect(onChoose).toHaveBeenCalledWith("desk");
  });
});

describe("interruptions", () => {
  it("lands at its time, lists the cost of each answer, and is dealt with once", () => {
    const base = startDay(newWorld("probe-2", "standard")).world;
    renderAt({ minute: 10 * 60 + 2 });
    const pending = pendingInterruption({ ...base, minute: 10 * 60 + 2 });
    if (!pending) throw new Error("nothing pending");
    const card = screen.getByTestId("world-interruption");
    expect(card.textContent).toContain(pending.title);
    expect(screen.getByTestId("world-tasks").textContent).toContain(
      pending.title
    );
    const first = pending.options[0];
    fireEvent.click(
      within(card).getByRole("button", { name: new RegExp(first.label) })
    );
    expect(current()?.plan?.handled).toContain(pending.id);
    expect(current()?.minute).toBeGreaterThanOrEqual(
      10 * 60 + 2 + first.cost.minutes
    );
    expect(screen.queryByTestId("world-interruption")).toBeNull();
  });

  it("renders the card on its own", () => {
    const onAnswer = vi.fn();
    render(
      <InterruptionCard
        interruption={{
          id: "x",
          title: "A thing",
          body: "It happened.",
          options: [
            {
              id: "a",
              label: "Deal with it",
              cost: { minutes: 0, energy: 0, focus: 0 },
              result: "Done.",
            },
          ],
        }}
        onAnswer={onAnswer}
      />
    );
    expect(screen.getByRole("button", { name: /no time/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Deal with it/ }));
    expect(onAnswer).toHaveBeenCalledWith("a");
  });
});

describe("the wrap-up on the overnight card", () => {
  it("shows how the day went before what changed", () => {
    render(
      <OvernightCard
        report={{
          day: 1,
          lines: [{ tone: "good", text: "Maya cleared queries." }],
          newPhase: null,
          complete: false,
          wrapUp: [
            { tone: "neutral", text: "You decided 2 things today." },
            { tone: "bad", text: "1 decision still not written up." },
          ],
        }}
        nextDay={2}
        onNextDay={vi.fn()}
        onCloseout={vi.fn()}
        closeoutLabel="Closeout"
      />
    );
    const text = screen.getByTestId("world-overnight").textContent ?? "";
    expect(text.indexOf("How today went")).toBeGreaterThan(-1);
    expect(text.indexOf("How today went")).toBeLessThan(
      text.indexOf("What changed")
    );
    expect(text).toContain("1 decision still not written up.");
  });
});

describe("getting to know the team", () => {
  const maya: PlayerState = { x: 8, y: 3, facing: "right" };

  it("brings a coffee, and says why a second one has to wait", () => {
    const { playfield, world } = renderAt({ player: maya });
    fireEvent.keyDown(playfield, { key: "e" });
    const dialog = screen.getByRole("dialog", { name: "Maya" });
    const coffee = within(dialog).getByRole("button", { name: /Bring coffee/ });
    fireEvent.click(coffee);
    expect(dialog.textContent).toMatch(/You bring Maya a coffee/);
    expect(current()?.bonds?.maya.coffeeDay).toBe(1);
    expect(current()?.minute).toBe(world.minute + 10 + 10);
    expect(dialog.textContent).toMatch(/has had a coffee from you today/);
    // Clicking the unavailable button explains and costs nothing.
    const minute = current()?.minute;
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Bring coffee/ })
    );
    expect(current()?.minute).toBe(minute);
  });

  it("learns what makes them tick, once", () => {
    const { playfield } = renderAt({ player: maya });
    fireEvent.keyDown(playfield, { key: "e" });
    const dialog = screen.getByRole("dialog", { name: "Maya" });
    fireEvent.click(
      within(dialog).getByRole("button", { name: /Ask about them/ })
    );
    expect(dialog.textContent).toMatch(/never says no/);
    expect(dialog.textContent).toMatch(/already know what makes Maya tick/);
  });
});

describe("walking to a place someone is blocking", () => {
  it("walks anyway, and they have moved on by the time you arrive", async () => {
    // At 11:00 on this seed, people standing in the car park leave no way to
    // the car that goes round them (found by probing seeds and times).
    const { world } = renderAt({ minute: 11 * 60 });
    const people = placePeople(world, CRO_FLOOR);
    const car = officeDirectory(CRO_FLOOR, people).find(
      (e) => e.label === "Your car"
    );
    if (!car) throw new Error("no car in the directory");
    expect(planRoute(world.player, car.target, CRO_FLOOR, people)).toBeNull();
    const clear = planRoute(world.player, car.target, CRO_FLOOR, []);
    if (!clear) throw new Error("the car is not reachable at all");

    fireEvent.click(screen.getByRole("button", { name: /^Office directory$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Walk to Your car/ }));
    await waitFor(
      () => {
        const status = screen
          .getAllByRole("status")
          .map((n) => n.textContent)
          .join(" ");
        expect(status).toMatch(/Arrived at Your car/);
      },
      { timeout: 25000 }
    );
    // It walked the way the clear floor allows, and by the time it got there
    // the people had moved on. The old behaviour was to refuse at the start.
    expect((current()?.minute ?? 0) - world.minute).toBeGreaterThanOrEqual(
      clear.minutes
    );
  }, 40000);
});
