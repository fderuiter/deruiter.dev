import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";
import { SPOTLIGHT_STEPS } from "@/components/study-director/DeskSpotlightTour";
import { TUTORIAL_SEEN_KEY } from "@/components/study-director/useStudySave";

function startStudy() {
  render(<StudyDirectorGame />);
  fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
}

describe("Study Director Day 1 Desk Spotlight Tour", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("offers spotlight tour to a first-time user starting Day 1 on the Inbox panel", () => {
    startStudy();
    expect(screen.getByTestId("spotlight-tour")).toBeTruthy();
    expect(screen.getByTestId("tour-step-indicator").textContent).toContain(
      "Step 1 of 6"
    );
    expect(
      screen.getByRole("heading", { name: SPOTLIGHT_STEPS[0].title })
    ).toBeTruthy();

    const spotlight = screen.getByTestId("tour-spotlight");
    expect(spotlight).toBeTruthy();
  });

  it("steps through all desk panels sequentially (Inbox -> Decision -> Attention -> Meters -> Sites -> End Day)", () => {
    startStudy();

    for (let i = 0; i < SPOTLIGHT_STEPS.length; i++) {
      const step = SPOTLIGHT_STEPS[i];
      expect(screen.getByTestId("tour-step-indicator").textContent).toContain(
        `Step ${i + 1} of ${SPOTLIGHT_STEPS.length}`
      );
      expect(screen.getByRole("heading", { name: step.title })).toBeTruthy();

      const nextBtn = screen.getByTestId("tour-next-button");
      if (i < SPOTLIGHT_STEPS.length - 1) {
        expect(nextBtn.textContent).toContain("Next Step");
        fireEvent.click(nextBtn);
      } else {
        expect(nextBtn.textContent).toContain("Complete Tour");
        fireEvent.click(nextBtn);
      }
    }

    expect(screen.queryByTestId("spotlight-tour")).toBeNull();
    expect(globalThis.localStorage?.getItem(TUTORIAL_SEEN_KEY)).toBe("true");
  });

  it("allows stepping backward with the Back button", () => {
    startStudy();
    expect(screen.getByTestId("tour-step-indicator").textContent).toContain(
      "Step 1 of 6"
    );

    fireEvent.click(screen.getByTestId("tour-next-button"));
    expect(screen.getByTestId("tour-step-indicator").textContent).toContain(
      "Step 2 of 6"
    );

    fireEvent.click(screen.getByTestId("tour-prev-button"));
    expect(screen.getByTestId("tour-step-indicator").textContent).toContain(
      "Step 1 of 6"
    );
  });

  it("skipping or closing the tour removes overlay and sets sd:tutorial-seen in local storage", () => {
    startStudy();
    expect(screen.getByTestId("spotlight-tour")).toBeTruthy();

    fireEvent.click(screen.getByTestId("tour-skip-button"));
    expect(screen.queryByTestId("spotlight-tour")).toBeNull();
    expect(globalThis.localStorage?.getItem(TUTORIAL_SEEN_KEY)).toBe("true");
  });

  it("does not auto-show the tour for returning users with sd:tutorial-seen set", () => {
    globalThis.localStorage?.setItem(TUTORIAL_SEEN_KEY, "true");
    startStudy();

    expect(screen.queryByTestId("spotlight-tour")).toBeNull();
    expect(screen.getByText(/Day 1 \/ 77/)).toBeTruthy();
  });

  it("allows returning users to manually re-trigger tour from header Desk Tour button", () => {
    globalThis.localStorage?.setItem(TUTORIAL_SEEN_KEY, "true");
    startStudy();

    expect(screen.queryByTestId("spotlight-tour")).toBeNull();
    const trigger = screen.getByTestId("tour-trigger");
    expect(trigger).toBeTruthy();

    fireEvent.click(trigger);
    expect(screen.getByTestId("spotlight-tour")).toBeTruthy();
    expect(screen.getByTestId("tour-step-indicator").textContent).toContain(
      "Step 1 of 6"
    );
  });

  it("supports keyboard navigation inside the tour overlay (ArrowRight, ArrowLeft, Escape)", () => {
    startStudy();
    const tour = screen.getByTestId("spotlight-tour");

    fireEvent.keyDown(tour, { key: "ArrowRight" });
    expect(screen.getByTestId("tour-step-indicator").textContent).toContain(
      "Step 2 of 6"
    );

    fireEvent.keyDown(tour, { key: "ArrowLeft" });
    expect(screen.getByTestId("tour-step-indicator").textContent).toContain(
      "Step 1 of 6"
    );

    fireEvent.keyDown(tour, { key: "Escape" });
    expect(screen.queryByTestId("spotlight-tour")).toBeNull();
    expect(globalThis.localStorage?.getItem(TUTORIAL_SEEN_KEY)).toBe("true");
  });

  it("meets touch target size standards (minimum 48px height) for tour action buttons", () => {
    startStudy();
    const skipBtn = screen.getByTestId("tour-skip-button");
    const nextBtn = screen.getByTestId("tour-next-button");
    const prevBtn = screen.getByTestId("tour-prev-button");
    const closeBtn = screen.getByRole("button", { name: "Exit tour" });

    expect(skipBtn.className).toContain("min-h-[48px]");
    expect(nextBtn.className).toContain("min-h-[48px]");
    expect(prevBtn.className).toContain("min-h-[48px]");
    expect(closeBtn.className).toContain("min-h-[48px]");
  });
});
