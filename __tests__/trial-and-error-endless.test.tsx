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
import { CardTable } from "@/components/trial-and-error/CardTable";
import {
  DEMOGRAPHICS_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
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

const withQuota = (scenario: Scenario, quota: number): Scenario => ({
  ...scenario,
  blind: { ...scenario.blind, quota },
});

/**
 * One easy study, then a post-marketing round whose first Blind no hand can
 * clear: continuing always ends on that Blind.
 */
const MINI: Campaign = {
  id: "mini-endless",
  title: "Mini campaign",
  acts: [
    {
      id: "mini-1",
      title: "Act I: Phase I Safety",
      blinds: [withQuota(DEMOGRAPHICS_SCENARIO, 1)],
    },
  ],
  endless: {
    id: "mini-post-marketing",
    title: "Post-marketing",
    quotaGrowth: 1.25,
    studies: [
      {
        id: "mini-surveillance",
        title: "Safety surveillance",
        blinds: [withQuota(DEMOGRAPHICS_SCENARIO, 1_000_000)],
        bossPool: [DOSE_ESCALATION_SCENARIO],
      },
    ],
  },
};

/** Plays the first card in hand on its own. */
function playFirstCard() {
  fireEvent.click(document.querySelector<HTMLButtonElement>("[data-card-id]")!);
  fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
}

async function winCampaign() {
  render(<CardTable act={MINI} seed="alpha" />);
  fireEvent.click(
    document.querySelector<HTMLButtonElement>('[data-card-id="C-L16.2.7"]')!
  );
  fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
  return screen.findByTestId("endless-choice");
}

describe("the choice after the campaign is won (#1088)", () => {
  it("offers to submit or continue, with the win recorded either way", async () => {
    const choice = await winCampaign();
    expect(screen.getByTestId("blind-result").textContent).toContain(
      "Campaign won"
    );
    const submit = within(choice).getByRole("button", {
      name: "Submit and end run",
    });
    const cont = within(choice).getByRole("button", {
      name: "Continue into post-marketing",
    });
    expect(cont.getAttribute("aria-describedby")).toBe("endless-note");
    expect(screen.getByText(/The win is recorded either way/)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(submit));
    expect(screen.queryByRole("button", { name: "Play again" })).toBeNull();
  });

  it("ends the run on submit and offers a new one", async () => {
    await winCampaign();
    fireEvent.click(screen.getByRole("button", { name: "Submit and end run" }));
    const again = await screen.findByRole("button", { name: "Play again" });
    expect(screen.queryByTestId("endless-choice")).toBeNull();
    expect(screen.queryByTestId("endless-record")).toBeNull();
    expect(screen.getByTestId("blind-result").textContent).toContain(
      "Campaign won"
    );
    await waitFor(() => expect(document.activeElement).toBe(again));
  });

  it("continues into a post-marketing round, then records the round reached", async () => {
    await winCampaign();
    fireEvent.click(
      screen.getByRole("button", { name: "Continue into post-marketing" })
    );
    await waitFor(() =>
      expect(screen.getByTestId("next-blind").textContent).toContain(
        "Post-marketing round 1: Safety surveillance"
      )
    );
    const next = screen.getByRole("button", { name: "Next study" });
    await waitFor(() => expect(document.activeElement).toBe(next));
    fireEvent.click(next);

    const intro = await screen.findByTestId("act-intro");
    expect(intro.textContent).toContain("Post-marketing round 1 · a new study");
    fireEvent.click(screen.getByTestId("act-intro-start"));
    await waitFor(() => expect(screen.queryByTestId("act-intro")).toBeNull());
    expect(
      screen.getByText(
        /Post-marketing round 1: Safety surveillance · Blind 1 of/
      )
    ).toBeTruthy();

    for (let hand = 0; hand < 12; hand++) {
      if (screen.queryByTestId("blind-result")) break;
      playFirstCard();
      await waitFor(() =>
        expect(
          screen.queryByTestId("blind-result") ??
            screen.queryByRole("button", { name: /Play Hand/ })
        ).toBeTruthy()
      );
    }
    const record = await screen.findByTestId("endless-record");
    expect(record.textContent).toBe(
      "Campaign won · Post-marketing round 1 reached"
    );
    expect(screen.getByTestId("blind-result").textContent).toContain(
      "Blind failed · run over"
    );
    expect(screen.getByRole("button", { name: "Restart run" })).toBeTruthy();
  });
});
