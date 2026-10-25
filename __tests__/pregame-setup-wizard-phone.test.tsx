// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import axe from "axe-core";
import {
  PreGameSetupWizard,
  getSavedSetupConfig,
  saveSetupConfig,
} from "@/components/arcade/PreGameSetupWizard";

const mockAnnounce = vi.fn();

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: mockAnnounce }),
}));

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    playNote: vi.fn(),
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playKeystroke: vi.fn(),
    volume: 0.3,
    muted: false,
  }),
}));

// `?view=phone` forces the phone view in any build (ADR 0062), which is how
// these tests get the phone layout without a coarse pointer.
function useView(view: "phone" | null) {
  window.history.replaceState(null, "", view ? `/?view=${view}` : "/");
}

function openWizard(onComplete = vi.fn()) {
  render(
    <PreGameSetupWizard
      gameId="laser-loon"
      gameTitle="Laser Loon"
      isOpen={true}
      onComplete={onComplete}
      onCancel={vi.fn()}
    />
  );
  return onComplete;
}

const next = () =>
  fireEvent.click(screen.getByRole("button", { name: /Next Step/i }));

describe("PreGameSetupWizard on a phone (#2795)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useView("phone");
  });

  afterEach(() => {
    cleanup();
    useView(null);
  });

  it("fills the cabinet and asks one question per screen", () => {
    openWizard();
    const overlay = screen.getByTestId("pregame-setup-wizard-overlay");
    expect(overlay.dataset.layout).toBe("phone");
    expect(screen.getByText("Laser Loon • Question 1 of 6")).toBeTruthy();
    expect(screen.getByText(/Difficulty Mode/i)).toBeTruthy();
    expect(screen.queryByText(/Initial Starting Loadout/i)).toBeNull();
    // The desktop step buttons give way to a row of progress dots.
    expect(
      screen.queryByRole("button", { name: /Go to wizard step/i })
    ).toBeNull();
    const dots = screen.getByTestId("wizard-progress-dots");
    expect(dots.getAttribute("aria-hidden")).toBe("true");
    expect(dots.children).toHaveLength(6);
    expect(dots.children[0].className).toContain("w-5");
  });

  it("walks the six questions with Next and Back, then offers Start Game", () => {
    openWizard();
    const questions = [
      /Initial Starting Loadout/i,
      /Screen Shake Intensity/i,
      /CRT Filter Effect/i,
      /Cabinet Bezel Theme/i,
      /Step 3: Setup Summary/i,
    ];
    questions.forEach((heading, index) => {
      next();
      expect(screen.getByText(heading)).toBeTruthy();
      expect(
        screen.getByText(`Laser Loon • Question ${index + 2} of 6`)
      ).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: /Next Step/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Start Game/i })).toBeTruthy();
    expect(mockAnnounce).toHaveBeenLastCalledWith(
      "Question 6 of 6: Summary",
      "polite"
    );

    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(screen.getByText(/Cabinet Bezel Theme/i)).toBeTruthy();
    expect(screen.queryByText(/CRT Filter Effect/i)).toBeNull();
  });

  it("moves between questions with the arrow keys", () => {
    openWizard();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "ArrowRight",
    });
    expect(screen.getByText(/Initial Starting Loadout/i)).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "ArrowLeft",
    });
    expect(screen.getByText(/Difficulty Mode/i)).toBeTruthy();
  });

  it("shows big single-column choice cards with their descriptions and no text below 12px", () => {
    openWizard();
    const casual = screen.getByRole("button", { name: /Casual/i });
    expect(casual.className).toContain("min-h-[64px]");
    expect(casual.parentElement?.className).toContain("grid-cols-1");
    expect(
      screen.getByText(/Relaxed difficulty with extra safety margins/i)
        .className
    ).not.toContain("hidden");
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 5; i += 1) {
      expect(dialog.innerHTML).not.toMatch(/text-\[(8|9|10|11)px\]/);
      next();
    }
    expect(dialog.innerHTML).not.toMatch(/text-\[(8|9|10|11)px\]/);
  });

  it("keeps choices across questions and saves them on Start Game", () => {
    const onComplete = openWizard();
    fireEvent.click(screen.getByRole("button", { name: /Hard/i }));
    next();
    fireEvent.click(
      screen.getByRole("button", { name: /Glacial Cryo-Shatter/i })
    );
    next();
    fireEvent.click(screen.getByRole("button", { name: /None \(Off\)/i }));
    next();
    next();
    next();
    expect(screen.getByText("Hard")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Start Game/i }));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: "hard",
        loadout: "cryo",
        screenShake: "none",
      })
    );
    expect(getSavedSetupConfig("laser-loon").loadout).toBe("cryo");
  });

  it("starts from saved choices", () => {
    saveSetupConfig("laser-loon", {
      ...getSavedSetupConfig("laser-loon"),
      difficulty: "casual",
    });
    openWizard();
    expect(screen.getByRole("button", { name: /Casual/i }).className).toContain(
      "ring-amber-400"
    );
  });

  it("has zero axe violations on each question", async () => {
    const { container } = render(
      <main>
        <PreGameSetupWizard
          gameId="laser-loon"
          gameTitle="Laser Loon"
          isOpen={true}
          onComplete={vi.fn()}
        />
      </main>
    );
    for (let i = 0; i < 6; i += 1) {
      const result = await axe.run(container, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      });
      expect(result.violations).toEqual([]);
      if (i < 5) next();
    }
  });
});

describe("PreGameSetupWizard on desktop keeps three steps (#2795)", () => {
  afterEach(cleanup);

  it("renders the card layout with the step buttons and both step 1 questions", () => {
    useView(null);
    openWizard();
    expect(
      screen.getByTestId("pregame-setup-wizard-overlay").dataset.layout
    ).toBe("card");
    expect(screen.getByText("Laser Loon • Step 1 of 3")).toBeTruthy();
    expect(screen.getByText(/Difficulty Mode/i)).toBeTruthy();
    expect(screen.getByText(/Initial Starting Loadout/i)).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /Go to wizard step/i })
    ).toHaveLength(3);
  });
});
