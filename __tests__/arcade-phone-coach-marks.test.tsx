// @vitest-environment jsdom
// #2361: first-run coach marks. Up to three tips pinned to real controls
// during play, with Skip, remembered per game on this device, and brought
// back by Setup's "Show tips again".
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React, { useRef } from "react";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import axe from "axe-core";
import {
  CoachMarks,
  ShowTipsAgain,
  type CoachMarkStep,
} from "@/components/arcade/mobile/ui";
import {
  ARCADE_COACH_MARKS_KEY,
  hasSeenCoachMarks,
  setCoachMarksSeen,
} from "@/lib/arcade";

beforeEach(() => {
  localStorage.clear();
  // jsdom lays nothing out; give every control a box so tips can pin to it.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 300,
    left: 40,
    right: 84,
    bottom: 344,
    width: 44,
    height: 44,
    x: 40,
    y: 300,
    toJSON: () => ({}),
  } as DOMRect);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Stage({
  active = true,
  steps,
  onFinish,
}: {
  active?: boolean;
  steps?: CoachMarkStep[];
  onFinish?: (skipped: boolean) => void;
}) {
  const fireRef = useRef<HTMLButtonElement>(null);
  const sequence = steps ?? [
    {
      id: "move",
      target: "[data-control=move]",
      title: "Steer",
      body: "Drag the pad to move.",
    },
    { id: "fire", target: fireRef, title: "Fire", body: "Hold to shoot." },
  ];
  return (
    <main>
      <div data-arcade-cabinet="laser-loon" className="relative">
        <button type="button" data-control="move" aria-describedby="move-hint">
          Move
        </button>
        <span id="move-hint" hidden>
          Movement pad
        </span>
        <button type="button" ref={fireRef}>
          Fire
        </button>
        <CoachMarks
          gameId="laser-loon"
          steps={sequence}
          active={active}
          onFinish={onFinish}
        />
      </div>
    </main>
  );
}

const tip = () => screen.queryByRole("note");

/** Waits for the tip to be pinned; it stays hidden until then. */
const pinned = () =>
  waitFor(() =>
    expect(screen.getByTestId("coach-mark").style.visibility).toBe("")
  );

describe("CoachMarks (#2361)", () => {
  it("pins the first tip to its control and links the control to it", async () => {
    render(<Stage />);
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe(
        "Tip 1 of 2. Steer. Drag the pad to move."
      )
    );
    const note = screen.getByRole("note", { name: "Steer" });
    expect(note.style.visibility).toBe("");
    expect(screen.getByTestId("coach-mark-ring").style.width).toBe("44px");
    const move = screen.getByRole("button", { name: "Move" });
    const describedBy = move.getAttribute("aria-describedby")?.split(" ");
    expect(describedBy?.[0]).toBe("move-hint");
    expect(document.getElementById(describedBy![1])?.textContent).toBe(
      "Drag the pad to move."
    );
  });

  it("steps through with Next, finishes with Got it, and is remembered for the game", async () => {
    const onFinish = vi.fn();
    render(<Stage onFinish={onFinish} />);
    await pinned();
    fireEvent.click(screen.getByRole("button", { name: "Next tip" }));
    await waitFor(() =>
      expect(screen.getByRole("note", { name: "Fire" })).toBeTruthy()
    );
    // The first control gets its own description back.
    expect(
      screen
        .getByRole("button", { name: "Move" })
        .getAttribute("aria-describedby")
    ).toBe("move-hint");
    expect(screen.queryByRole("button", { name: "Skip tips" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));
    expect(tip()).toBeNull();
    expect(onFinish).toHaveBeenCalledWith(false);
    expect(hasSeenCoachMarks("laser-loon")).toBe(true);
    expect(hasSeenCoachMarks("working-with-duck")).toBe(false);
    expect(
      screen
        .getByRole("button", { name: "Fire" })
        .hasAttribute("aria-describedby")
    ).toBe(false);
  });

  it("ends at once on Skip", async () => {
    const onFinish = vi.fn();
    render(<Stage onFinish={onFinish} />);
    await pinned();
    fireEvent.click(screen.getByRole("button", { name: "Skip tips" }));
    expect(tip()).toBeNull();
    expect(onFinish).toHaveBeenCalledWith(true);
    expect(hasSeenCoachMarks("laser-loon")).toBe(true);
  });

  it("does not show once seen, or while play is not running", () => {
    const { rerender } = render(<Stage active={false} />);
    expect(tip()).toBeNull();
    setCoachMarksSeen("laser-loon");
    rerender(<Stage active />);
    expect(tip()).toBeNull();
  });

  it("runs three steps at most", () => {
    const steps = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      target: "[data-control=move]",
      title: `Step ${i + 1}`,
      body: "Body.",
    }));
    render(<Stage steps={steps} />);
    expect(screen.getByTestId("coach-mark").textContent).toContain(
      "Tip 1 of 3"
    );
  });

  it("waits, hidden, while its control is off screen", async () => {
    render(
      <Stage
        steps={[
          {
            id: "gone",
            target: "[data-control=missing]",
            title: "Gone",
            body: "Not here.",
          },
        ]}
      />
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByTestId("coach-mark").style.visibility).toBe("hidden");
    expect(
      screen.getByTestId("coach-mark").querySelector("[aria-live]")?.textContent
    ).toBe("");
  });

  it("has zero axe violations", async () => {
    const { container } = render(<Stage />);
    await pinned();
    const result = await axe.run(container, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    expect(result.violations).toEqual([]);
  });
});

describe("ShowTipsAgain (#2361)", () => {
  it("shows only once the game's tips were seen, and brings them back", () => {
    const { rerender } = render(<ShowTipsAgain gameId="laser-loon" />);
    expect(screen.queryByRole("button")).toBeNull();

    setCoachMarksSeen("laser-loon");
    rerender(<ShowTipsAgain gameId="laser-loon" />);
    const button = screen.getByRole("button", { name: "Show tips again" });
    fireEvent.click(button);
    expect(hasSeenCoachMarks("laser-loon")).toBe(false);
    // The button stays where it was, so focus is not lost.
    expect(button.isConnected).toBe(true);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe(
      "The tips will show when play starts."
    );
  });
});

describe("arcade.coach-marks slice (#2361)", () => {
  it("stores a sorted, unique list of games under its own key", () => {
    setCoachMarksSeen("working-with-duck");
    setCoachMarksSeen("laser-loon");
    setCoachMarksSeen("laser-loon");
    expect(JSON.parse(localStorage.getItem(ARCADE_COACH_MARKS_KEY)!)).toEqual({
      version: 1,
      seen: ["laser-loon", "working-with-duck"],
    });
    setCoachMarksSeen("laser-loon", false);
    expect(hasSeenCoachMarks("laser-loon")).toBe(false);
    expect(hasSeenCoachMarks("working-with-duck")).toBe(true);
  });

  it("drops damaged entries rather than the whole record", () => {
    localStorage.setItem(
      ARCADE_COACH_MARKS_KEY,
      JSON.stringify({ version: 1, seen: ["laser-loon", 7, null] })
    );
    expect(hasSeenCoachMarks("laser-loon")).toBe(true);
  });
});
