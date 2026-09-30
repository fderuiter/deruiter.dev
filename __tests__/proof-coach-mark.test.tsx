import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  act,
} from "@testing-library/react";
import { ProofWorkspaceClient } from "@/app/proof/ProofWorkspaceClient";
import { safeStorage } from "@/lib/safe-storage";
import { TUTORIAL_SEEN_KEY } from "@/components/proof/ProofCoachTour";

beforeEach(() => {
  window.history.replaceState(null, "", "/proof");
  safeStorage.removeItem(TUTORIAL_SEEN_KEY);
  vi.stubGlobal(
    "Worker",
    class {
      postMessage = vi.fn();
      terminate = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    }
  );
});

afterEach(() => {
  cleanup();
  safeStorage.removeItem(TUTORIAL_SEEN_KEY);
  vi.unstubAllGlobals();
});

describe("Proof Coach Mark Overlay (#1840)", () => {
  it("displays first-time visitor offer banner on initial page load", () => {
    render(<ProofWorkspaceClient />);
    const banner = screen.getByTestId("proof-tutorial-banner");
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain("First time in the Proof Studio?");
    expect(screen.getByText("Start Guided Proof")).toBeDefined();
    expect(screen.getByText("Skip Tutorial")).toBeDefined();
  });

  it("launches guided proof tour when 'Start Guided Proof' is clicked", () => {
    render(<ProofWorkspaceClient />);
    const startBtn = screen.getByText("Start Guided Proof");
    fireEvent.click(startBtn);

    const callout = screen.getByTestId("proof-coach-callout");
    expect(callout).toBeDefined();
    expect(callout.textContent).toContain("Step 1 of 4");
    expect(callout.textContent).toContain("Select Premise Node A");
  });

  it("advances steps automatically as user selects nodes and applies MP rule", async () => {
    render(<ProofWorkspaceClient />);
    const startBtn = screen.getByText("Start Guided Proof");
    fireEvent.click(startBtn);

    // Step 1: Select Node A
    const nodeA = screen.getByRole("button", {
      name: /^Node A, P, premise, given premise/,
    });
    await act(async () => {
      fireEvent.click(nodeA);
    });

    // Should advance to Step 2
    let callout = screen.getByTestId("proof-coach-callout");
    expect(callout.textContent).toContain("Step 2 of 4");
    expect(callout.textContent).toContain("Select Premise Node B");

    // Step 2: Select Node B (with shift key to add to premise selection)
    const nodeB = screen.getByRole("button", {
      name: /^Node B, P → Q, premise, given premise/,
    });
    await act(async () => {
      fireEvent.click(nodeB, { shiftKey: true });
    });

    // Should advance to Step 3
    callout = screen.getByTestId("proof-coach-callout");
    expect(callout.textContent).toContain("Step 3 of 4");
    expect(callout.textContent).toContain("Fire Modus Ponens");

    // Step 3: Click Modus Ponens in Rule Palette
    const mpBtn = document.querySelector(
      '[data-rule="mp"]'
    ) as HTMLButtonElement;
    expect(mpBtn).toBeDefined();
    await act(async () => {
      fireEvent.click(mpBtn);
    });

    // Should advance to Step 4
    callout = screen.getByTestId("proof-coach-callout");
    expect(callout.textContent).toContain("Step 4 of 4");
  });

  it("sets proof:tutorial-seen and hides banner when 'Skip Tutorial' is clicked", () => {
    render(<ProofWorkspaceClient />);
    const skipBtn = screen.getByText("Skip Tutorial");
    fireEvent.click(skipBtn);

    expect(safeStorage.getItem<boolean>(TUTORIAL_SEEN_KEY)).toBe(true);
    expect(screen.queryByTestId("proof-tutorial-banner")).toBeNull();
  });

  it("bypasses banner automatically for returning visitors with proof:tutorial-seen set", () => {
    safeStorage.setItem(TUTORIAL_SEEN_KEY, true);
    render(<ProofWorkspaceClient />);

    expect(screen.queryByTestId("proof-tutorial-banner")).toBeNull();
  });

  it("provides screen reader aria-live announcements during tutorial transitions", () => {
    render(<ProofWorkspaceClient />);
    const startBtn = screen.getByText("Start Guided Proof");
    fireEvent.click(startBtn);

    const liveRegions = document.querySelectorAll('[aria-live="polite"]');
    const announcements = Array.from(liveRegions).map((el) => el.textContent);
    expect(
      announcements.some((text) =>
        text?.includes("Guided Modus Ponens proof tutorial started")
      )
    ).toBe(true);
  });
});
