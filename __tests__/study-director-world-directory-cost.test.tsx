import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { OfficeDirectory } from "@/components/study-director-world/OfficeDirectory";
import {
  CRO_FLOOR,
  newWorld,
  officeDirectory,
  placePeople,
  planRoute,
  startDay,
} from "@/lib/study-director-world";

describe("OfficeDirectory walk costs", () => {
  afterEach(cleanup);

  const world = startDay(newWorld("cost-1", "standard")).world;
  const people = placePeople(world, CRO_FLOOR);
  const entries = officeDirectory(CRO_FLOOR, people);
  const minutesTo = (entry: (typeof entries)[number]) =>
    planRoute(world.player, entry.target, CRO_FLOOR, people)?.minutes ?? null;

  it("shows the cost of each walk before the player commits", () => {
    render(
      <OfficeDirectory
        entries={entries}
        walkingTo={null}
        disabled={false}
        onWalk={vi.fn()}
        minutesTo={minutesTo}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /office directory/i }));
    const costs = screen.getAllByTestId("walk-cost");
    expect(costs.length).toBeGreaterThan(5);
    for (const c of costs)
      expect(c.textContent).toMatch(/^(under a minute|about \d+ minutes?)$/);
  });

  it("describes a walk by its cost without changing the button's name", () => {
    const onWalk = vi.fn();
    render(
      <OfficeDirectory
        entries={entries}
        walkingTo={null}
        disabled={false}
        onWalk={onWalk}
        minutesTo={minutesTo}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /office directory/i }));
    const first = entries[0];
    const button = screen.getByRole("button", {
      name: `Walk to ${first.label}, ${first.detail}`,
    });
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")?.textContent).toMatch(
      /minute/
    );
    fireEvent.click(button);
    expect(onWalk).toHaveBeenCalledWith(first);
  });

  it("shows no cost without a cost function", () => {
    render(
      <OfficeDirectory
        entries={entries}
        walkingTo={null}
        disabled={false}
        onWalk={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /office directory/i }));
    expect(screen.queryAllByTestId("walk-cost")).toHaveLength(0);
  });
});
