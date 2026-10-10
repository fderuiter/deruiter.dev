import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  CRO_FLOOR,
  guestDay,
  guestScene,
  isWalkable,
  newWorld,
  startDay,
  type GuestScene,
  type WorldState,
} from "@/lib/study-director-world";
import { GuestCard } from "@/components/study-director-world/DayCards";

const CONFERENCE = (() => {
  const room = CRO_FLOOR.rooms.find((r) => r.id === "conference")!;
  for (let y = room.bounds.y; y < room.bounds.y + room.bounds.height; y++)
    for (let x = room.bounds.x; x < room.bounds.x + room.bounds.width; x++)
      if (isWalkable(CRO_FLOOR, x, y)) return { x, y };
  throw new Error("no free tile in the conference room");
})();

function scene(here: boolean): GuestScene {
  const world: WorldState = startDay(newWorld("ui-guest", "standard")).world;
  const arranged: WorldState = {
    ...world,
    minute: 10 * 60 + 40,
    player: here
      ? { ...CONFERENCE, facing: "down" }
      : { x: 1, y: 1, facing: "down" },
    study: { ...world.study, day: guestDay("ui-guest", "vendorMeeting") },
  };
  const found = guestScene(arranged);
  if (!found) throw new Error("no visitor");
  return found;
}

afterEach(cleanup);

describe("GuestCard", () => {
  it("names the visitor, how long they wait and what each option costs", () => {
    render(<GuestCard scene={scene(true)} onMeet={vi.fn()} />);
    const card = screen.getByTestId("world-guest");
    expect(card.textContent).toContain("Colm Ibarra");
    expect(card.textContent).toContain("Halden Data Systems");
    expect(card.textContent).toContain("Waiting until 12:00 PM");
    expect(
      screen.getByRole("button", { name: /Negotiate the renewal/ }).textContent
    ).toContain("40 min");
  });

  it("lets the player choose when they are in the room", () => {
    const onMeet = vi.fn();
    render(<GuestCard scene={scene(true)} onMeet={onMeet} />);
    expect(screen.queryByTestId("world-guest-where")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Negotiate/ }));
    expect(onMeet).toHaveBeenCalledWith("renewal");
  });

  it("tells the player where to go, and does nothing, when they are elsewhere", () => {
    const onMeet = vi.fn();
    render(<GuestCard scene={scene(false)} onMeet={onMeet} />);
    expect(screen.getByTestId("world-guest-where").textContent).toContain(
      "conference room"
    );
    const button = screen.getByRole("button", { name: /Negotiate/ });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(button);
    expect(onMeet).not.toHaveBeenCalled();
  });
});
