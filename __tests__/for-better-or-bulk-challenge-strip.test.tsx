import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  BEST_TIMES_STORAGE_KEY,
  DEFAULT_SETUP,
  bestTimeKey,
  computeReceipt,
  createLevel,
} from "@/lib/for-better-or-bulk";
import { ChallengeStrip } from "@/components/for-better-or-bulk/ChallengeStrip";
import { ReceiptView } from "@/components/for-better-or-bulk/ReceiptView";
import { SetupScreen } from "@/components/for-better-or-bulk/SetupScreen";
import {
  readBestTimes,
  saveBestTime,
} from "@/components/for-better-or-bulk/best-time-storage";

const SOLO = { ...DEFAULT_SETUP, assist: false };

function strip(): HTMLElement {
  return screen.getByTestId("fbb-time-challenge");
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("best time storage (#2056)", () => {
  it("saves a first finish, keeps a faster one, and ignores a slower one", () => {
    expect(saveBestTime(SOLO, 130).isNew).toBe(true);
    expect(saveBestTime(SOLO, 140).isNew).toBe(false);
    expect(saveBestTime(SOLO, 115).isNew).toBe(true);
    expect(readBestTimes()).toEqual({ [bestTimeKey(SOLO)]: 115 });
  });

  it("reads malformed storage as no best times", () => {
    window.localStorage.setItem(BEST_TIMES_STORAGE_KEY, "{oops");
    expect(readBestTimes()).toEqual({});
    expect(saveBestTime(SOLO, 130).previous).toBeNull();
  });
});

describe("the setup screen's time challenge strip (#2056)", () => {
  function renderSetup(initial = SOLO) {
    return render(
      <SetupScreen initial={initial} initialMode="solo" onStart={vi.fn()} />
    );
  }

  it("shows par and no best yet on a fresh browser", () => {
    renderSetup();
    expect(strip().textContent).toContain("not a grade on the wedding");
    expect(screen.getByTestId("fbb-par").textContent).toBe(
      "Par: everything set by 1:12."
    );
    expect(screen.getByTestId("fbb-best-time").textContent).toContain(
      "No best time yet"
    );
    expect(screen.queryByTestId("fbb-no-best")).toBeNull();
  });

  it("shows the stored best, and the relaxed par and best when the relaxed clock is on", () => {
    window.localStorage.setItem(
      BEST_TIMES_STORAGE_KEY,
      JSON.stringify({
        [bestTimeKey(SOLO)]: 110,
        [bestTimeKey({ ...SOLO, relaxed: true })]: 165,
      })
    );
    renderSetup();
    expect(screen.getByTestId("fbb-best-time").textContent).toBe(
      "Your best: 12:51."
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Relaxed clock/ }));
    expect(screen.getByTestId("fbb-par").textContent).toBe(
      "Par: everything set by 12:36."
    );
    expect(screen.getByTestId("fbb-best-time").textContent).toBe(
      "Your best: 12:30."
    );
  });

  it("falls back to no best when storage is malformed", () => {
    window.localStorage.setItem(BEST_TIMES_STORAGE_KEY, "not json");
    renderSetup();
    expect(screen.getByTestId("fbb-best-time").textContent).toContain(
      "No best time yet"
    );
  });

  it("says there is no par for another plan, and that helper days set no best", () => {
    renderSetup({ ...DEFAULT_SETUP, assist: true });
    expect(screen.getByTestId("fbb-no-best").textContent).toBe(
      "Helper days don't set a best time."
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /Paper lanterns/ }));
    expect(screen.getByTestId("fbb-par").textContent).toContain(
      "No par for this plan"
    );
  });
});

describe("the receipt's time challenge strip (#2056)", () => {
  it("shows the time against par and a new best", () => {
    render(
      <ChallengeStrip
        par={120}
        best={110}
        duration={200}
        run={{
          finishedAt: 110,
          record: { time: 110, previous: 118, best: 110, isNew: true },
        }}
      />
    );
    expect(screen.getByTestId("fbb-run-time").textContent).toBe(
      "Everything set at 12:51, 21 minutes under par."
    );
    expect(screen.getByTestId("fbb-best-time").textContent).toBe(
      "New best, 16 minutes sooner than 1:07."
    );
  });

  it("names a first finish, an over-par day and a day with no time", () => {
    const { rerender } = render(
      <ChallengeStrip
        par={120}
        best={130}
        duration={200}
        run={{
          finishedAt: 130,
          record: { time: 130, previous: null, best: 130, isNew: true },
        }}
      />
    );
    expect(screen.getByTestId("fbb-run-time").textContent).toBe(
      "Everything set at 1:33, 21 minutes over par."
    );
    expect(screen.getByTestId("fbb-best-time").textContent).toContain(
      "New best: the first finish"
    );
    rerender(
      <ChallengeStrip
        par={120}
        best={115}
        duration={200}
        run={{ finishedAt: null, record: null }}
      />
    );
    expect(screen.getByTestId("fbb-run-time").textContent).toContain(
      "still open at 4:00"
    );
    expect(screen.getByTestId("fbb-best-time").textContent).toBe(
      "Your best: 1:01."
    );
  });

  it("renders in the receipt apart from the game challenges, and not at all without one", () => {
    const receipt = computeReceipt(createLevel(SOLO));
    const props = {
      receipt,
      runCode: null,
      onPlayAgain: vi.fn(),
      onChangePlan: vi.fn(),
      onWatchReplay: vi.fn(),
    };
    const { rerender } = render(<ReceiptView {...props} />);
    expect(screen.queryByTestId("fbb-time-challenge")).toBeNull();
    rerender(
      <ReceiptView
        {...props}
        timeChallenge={{
          par: 120,
          best: null,
          duration: 200,
          noBestReason: "Helper days don't set a best time.",
          run: { finishedAt: 100, record: null },
        }}
      />
    );
    const challenges = screen.getByTestId("fbb-challenges");
    expect(challenges.contains(strip())).toBe(false);
    expect(screen.getByTestId("fbb-no-best").textContent).toBe(
      "Helper days don't set a best time."
    );
  });
});
