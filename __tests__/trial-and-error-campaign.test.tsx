// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ActIntro } from "@/components/trial-and-error/ActIntro";
import { CardTable } from "@/components/trial-and-error/CardTable";
import {
  DEMOGRAPHICS_SCENARIO,
  PHASE_II_QC_SCENARIO,
  type ActIntroView,
  type Campaign,
  type Scenario,
} from "@/lib/trial-and-error";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

beforeEach(() => {
  // Reduced motion: score playback resolves at once.
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes("reduce"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
});
afterEach(cleanup);

const INTRO: ActIntroView = {
  act: {
    id: "act-2",
    title: "Act II: Phase II Proof of Concept",
    index: 1,
    count: 3,
    round: null,
  },
  bossTitle: "FDA Information Request",
  bossIntro: "The agency has questions.",
  reset: ["The SAP rulebook"],
  kept: ["SOP relics", "Study budget"],
};

describe("the act card (#924)", () => {
  it("names the study, its Boss, what starts over and what carries", () => {
    const onDismiss = vi.fn();
    render(<ActIntro intro={INTRO} loud onDismiss={onDismiss} />);
    const dialog = screen.getByRole("dialog", {
      name: "Act II: Phase II Proof of Concept",
    });
    expect(dialog.getAttribute("aria-describedby")).toBe("act-intro-boss");
    expect(within(dialog).getByText("Study 2 of 3 · a new study")).toBeTruthy();
    expect(screen.getByTestId("act-intro-boss").textContent).toBe(
      "Boss waiting: FDA Information RequestThe agency has questions."
    );
    expect(
      within(screen.getByTestId("act-intro-reset-list"))
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual(["The SAP rulebook"]);
    expect(
      within(screen.getByTestId("act-intro-kept-list"))
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual(["SOP relics", "Study budget"]);
    expect(screen.getByRole("heading", { level: 2 }).className).toContain(
      "te-loud-act"
    );
    fireEvent.click(screen.getByTestId("act-intro-start"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("stays calm without loud effects, and Escape dismisses it", () => {
    const onDismiss = vi.fn();
    render(<ActIntro intro={INTRO} loud={false} onDismiss={onDismiss} />);
    expect(screen.getByRole("heading", { level: 2 }).className).not.toContain(
      "te-loud-act"
    );
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

const easy = (scenario: Scenario): Scenario => ({
  ...scenario,
  blind: { ...scenario.blind, quota: 1 },
});

/** Two one-Blind acts with a quota of 1: any hand clears each. */
const MINI: Campaign = {
  id: "mini-campaign",
  title: "Mini campaign",
  acts: [
    {
      id: "mini-1",
      title: "Act I: Phase I Safety",
      blinds: [easy(DEMOGRAPHICS_SCENARIO)],
    },
    {
      id: "mini-2",
      title: "Act II: Phase II Proof of Concept",
      blinds: [easy(PHASE_II_QC_SCENARIO)],
    },
  ],
};

describe("moving between studies on the card table (#924)", () => {
  // A clean Listing both studies deal: it scores on its own.
  const playListing = () => {
    fireEvent.click(
      document.querySelector<HTMLButtonElement>('[data-card-id="C-L16.2.7"]')!
    );
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
  };

  it("names the next study, shows its act card, then plays it", async () => {
    render(<CardTable act={MINI} seed="alpha" />);
    expect(screen.queryByTestId("act-intro")).toBeNull();
    expect(screen.getByText(/Act I: Phase I Safety · Blind 1 of/)).toBeTruthy();

    playListing();
    await waitFor(() =>
      expect(screen.getByTestId("next-blind").textContent).toBe(
        `Next: Act II: Phase II Proof of Concept, a new study · ${PHASE_II_QC_SCENARIO.blind.name} · target 1`
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Next study" }));

    const intro = await screen.findByTestId("act-intro");
    expect(within(intro).getByRole("heading", { level: 2 }).textContent).toBe(
      "Act II: Phase II Proof of Concept"
    );
    expect(screen.getByTestId("act-intro-boss").textContent).toContain(
      PHASE_II_QC_SCENARIO.title
    );
    fireEvent.click(screen.getByTestId("act-intro-start"));
    await waitFor(() => expect(screen.queryByTestId("act-intro")).toBeNull());
    await waitFor(() =>
      expect(document.activeElement?.getAttribute("data-card-id")).toBe(
        document.querySelector("[data-card-id]")?.getAttribute("data-card-id")
      )
    );
    expect(
      screen.getByText(/Act II: Phase II Proof of Concept · Blind 1 of/)
    ).toBeTruthy();

    playListing();
    await waitFor(() =>
      expect(screen.getByTestId("blind-result").textContent).toContain(
        "Campaign won"
      )
    );
  });
});
