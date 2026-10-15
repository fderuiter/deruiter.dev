// Study Director 10/10 audit, first pass: no soft-lock at the hard stop
// (#2184), results and refusals shown on screen (#2185), and no walking out
// of a meeting in progress (#2186).
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";
import { OvernightCard } from "@/components/study-director-world/DayCards";
import {
  CRO_FLOOR,
  HARD_STOP,
  WORLD_SAVE_KEY,
  getRoom,
  goHome,
  newWorld,
  roomAt,
  serializeWorld,
  startDay,
  startMeeting,
  tileAt,
  type Facing,
  type SiteVisitReport,
  type WorldState,
} from "@/lib/study-director-world";

function dayOne(): WorldState {
  return startDay(newWorld("audit-2184", "standard")).world;
}

/** A floor tile in a room, next to one of its doors, and the way out. */
function besideDoor(roomId: string): {
  x: number;
  y: number;
  out: Facing;
} {
  const room = getRoom(CRO_FLOOR, roomId as never);
  if (!room) throw new Error(`no ${roomId}`);
  const ways: Array<[Facing, number, number]> = [
    ["up", 0, -1],
    ["down", 0, 1],
    ["left", -1, 0],
    ["right", 1, 0],
  ];
  const { x: bx, y: by, width, height } = room.bounds;
  for (let y = by; y < by + height; y++)
    for (let x = bx; x < bx + width; x++) {
      if (tileAt(CRO_FLOOR, x, y) !== "floor") continue;
      for (const [out, dx, dy] of ways)
        if (tileAt(CRO_FLOOR, x + dx, y + dy) === "door") return { x, y, out };
    }
  throw new Error(`no door out of ${roomId}`);
}

async function openWorld(world: WorldState) {
  globalThis.localStorage.setItem(WORLD_SAVE_KEY, serializeWorld(world));
  window.history.replaceState(null, "", "/#mode=world");
  render(<StudyDirectorGame />);
  const playfield = await screen.findByTestId("world-playfield");
  // The first morning's calls ring on open; let each ring (day 1 can bring
  // more than the sponsor's, #2254).
  for (let i = 0; i < 5; i++) {
    const ring = screen.queryByRole("button", { name: "Let it ring" });
    if (!ring) break;
    fireEvent.click(ring);
  }
  return playfield;
}

const KEY: Record<Facing, string> = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

describe("Study Director audit: the end of the day", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    globalThis.localStorage?.setItem?.("study_director_world_intro_seen", "1");
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState(null, "", "/");
  });

  it("offers to go home from where you stand at the hard stop (#2184)", async () => {
    const spot = besideDoor("lobby");
    const playfield = await openWorld({
      ...dayOne(),
      minute: HARD_STOP,
      player: { x: spot.x, y: spot.y, facing: spot.out },
      location: "lobby",
    });
    fireEvent.keyDown(playfield, { key: KEY[spot.out] });

    // The refusal is on screen, not only read out (#2185).
    expect(screen.getByTestId("world-said").textContent).toMatch(
      /too late to keep working/
    );
    const card = screen.getByTestId("world-outcome");
    expect(within(card).getByText("Time to go home")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Go home" }));
    expect(await screen.findByTestId("world-overnight")).toBeTruthy();
  });

  it("offers to go home when out of energy (#2184)", async () => {
    const spot = besideDoor("lobby");
    const playfield = await openWorld({
      ...dayOne(),
      energy: 0,
      walked: 39,
      player: { x: spot.x, y: spot.y, facing: spot.out },
      location: "lobby",
    });
    for (let i = 0; i < 4; i++)
      fireEvent.keyDown(playfield, { key: KEY[spot.out] });
    expect(screen.getByTestId("world-outcome").textContent).toMatch(
      /Out of energy/
    );
  });

  it("keeps you in the room while a meeting is on (#2186)", async () => {
    const spot = besideDoor("conference");
    const inRoom: WorldState = {
      ...dayOne(),
      player: { x: spot.x, y: spot.y, facing: spot.out },
      location: "conference",
    };
    const started = startMeeting(inRoom, "sponsor", []);
    if (!started.ok) throw new Error(started.reason);
    const playfield = await openWorld(started.world);
    fireEvent.keyDown(playfield, { key: KEY[spot.out] });
    expect(screen.getByTestId("world-said").textContent).toMatch(
      /End the call before you leave/
    );
    expect(screen.getByTestId("world-room").textContent).toMatch(/conference/i);
    expect(screen.getByTestId("world-directory-note").textContent).toMatch(
      /Closed during a meeting/
    );
    expect(roomAt(CRO_FLOOR, spot.x, spot.y)?.id).toBe("conference");
  });
});

describe("Study Director audit: the overnight card keeps the visit (#2185)", () => {
  afterEach(cleanup);

  it("shows the write-up of a site you drove home from", () => {
    const night = goHome({ ...dayOne(), minute: 15 * 60 });
    const visit = fromPartial<SiteVisitReport>({
      siteId: "site-01",
      siteName: "Site 01",
      day: 1,
      audited: true,
      findings: [
        {
          field: "deviations",
          text: "1 deviation not on the dashboard.",
          hidden: true,
        },
      ],
      unchecked: [],
      learned: [],
      verdict: "The dashboard is behind the binder.",
    });
    render(
      <OvernightCard
        report={night.report}
        nextDay={2}
        onNextDay={() => {}}
        onCloseout={() => {}}
        closeoutLabel="See the closeout"
        visit={visit}
      />
    );
    const card = screen.getByTestId("world-overnight");
    expect(within(card).getByText("Site 01 visit write-up")).toBeTruthy();
    expect(
      within(card).getByText(
        "Hidden by the dashboard: 1 deviation not on the dashboard."
      )
    ).toBeTruthy();
  });
});
