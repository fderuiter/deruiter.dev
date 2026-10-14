// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { fromPartial } from "@total-typescript/shoehorn";
import { CardTable } from "@/components/trial-and-error/CardTable";
import {
  ACT_I,
  DEMOGRAPHICS_SCENARIO,
  DOSE_ESCALATION_SCENARIO,
  SPONSOR_SAFETY_SCENARIO,
  describeBlindLoss,
  type Act,
  type TableView,
} from "@/lib/trial-and-error";
import { authored, authoredPlan } from "./utils/trial-and-error-authored";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

/** The standard in-memory Storage (AGENTS.md §1). */
class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const original = Object.getOwnPropertyDescriptor(window, "localStorage");
const scrollIntoView = vi.fn();

beforeEach(() => {
  announce.mockClear();
  scrollIntoView.mockClear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: new MockStorage(),
  });
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
  Element.prototype.scrollIntoView = scrollIntoView;
});
afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(window, "localStorage", original);
});

const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
const cards = () =>
  Array.from(document.querySelectorAll<HTMLButtonElement>("[data-card-id]"));
const handStart = () =>
  document.querySelector<HTMLElement>('[data-testid="hand"] [tabindex="0"]');

/** The table as the arcade hosts it: inside a focusable cabinet. */
function renderInCabinet(table: React.ReactElement) {
  render(
    <div data-arcade-cabinet="trial-and-error" tabIndex={-1}>
      {table}
    </div>
  );
  return document.querySelector<HTMLElement>("[data-arcade-cabinet]")!;
}

describe("Trial & Error playtest fixes (#1944)", () => {
  describe("hand focus after launch, Resume and New run", () => {
    it("moves focus from the cabinet to the hand once the table is up", async () => {
      const cabinet = renderInCabinet(
        <CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />
      );
      act(() => cabinet.focus());
      expect(document.activeElement).toBe(cabinet);
      await waitFor(() => expect(document.activeElement).toBe(handStart()));
    });

    it("lands the first Space on the hand instead of scrolling the page", () => {
      const cabinet = renderInCabinet(
        <CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />
      );
      act(() => cabinet.focus());
      // fireEvent returns false when the default (the page scroll) is
      // prevented.
      expect(fireEvent.keyDown(cabinet, { key: " " })).toBe(false);
      expect(document.activeElement).toBe(handStart());
    });

    it("leaves focus alone outside the arcade", async () => {
      render(<CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />);
      expect(fireEvent.keyDown(document.body, { key: " " })).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 450));
      expect(document.activeElement).toBe(document.body);
    });

    it("keeps focus on a control the player chose", async () => {
      renderInCabinet(
        <>
          <button type="button">Elsewhere</button>
          <CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />
        </>
      );
      const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
      act(() => elsewhere.focus());
      await new Promise((resolve) => setTimeout(resolve, 450));
      expect(document.activeElement).toBe(elsewhere);
    });

    const runAct: Act = { ...ACT_I, crisisDeck: undefined };

    /** Plays one pair so a run is saved, then reloads onto the prompt. */
    function reloadOntoResumePrompt() {
      const first = render(
        <CardTable act={authoredPlan(runAct)} seed="resume-1" persist />
      );
      fireEvent.click(card("C-T14.1.1-A"));
      fireEvent.click(card("C-L16.2.4"));
      fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
      first.unmount();
      render(
        <CardTable act={authoredPlan(runAct)} seed="other-seed" persist />
      );
      expect(screen.getByTestId("resume-run").className).toContain("font-mono");
    }

    it("focuses the hand after Resume run", async () => {
      reloadOntoResumePrompt();
      fireEvent.click(screen.getByRole("button", { name: "Resume run" }));
      act(() => document.body.focus());
      await waitFor(() => expect(document.activeElement).toBe(handStart()));
      expect(handStart()).not.toBeNull();
    });

    it("focuses the hand after Discard and start new", async () => {
      reloadOntoResumePrompt();
      fireEvent.click(screen.getByRole("button", { name: "New run" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Discard and start new" })
      );
      await waitFor(() => expect(document.activeElement).toBe(handStart()));
      expect(handStart()).not.toBeNull();
    });
  });

  it("scrolls the card keyboard focus lands on into view", () => {
    render(<CardTable scenario={authored(DEMOGRAPHICS_SCENARIO)} />);
    const last = cards().at(-1)!;
    act(() => last.focus());
    expect(scrollIntoView).toHaveBeenCalledWith({
      inline: "nearest",
      block: "nearest",
    });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(last);
  });

  it("scores a hand with a stale card as nothing until it is recompiled", () => {
    render(<CardTable scenario={authored(SPONSOR_SAFETY_SCENARIO)} />);
    fireEvent.click(card("C-T14.1.2"));
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
    // S-004 has left the Safety set, so these two Safety outputs are stale.
    fireEvent.click(card("C-T14.3.3-A"));
    fireEvent.click(card("C-L16.2.8"));
    expect(
      screen.getByTestId("preview-counters").getAttribute("data-score")
    ).toBe("");
    expect(screen.getByTestId("preview-recompile").textContent).toContain(
      "Recompile first"
    );
    expect(screen.getByTestId("stale-alert").textContent).toContain(
      "recompile required"
    );
  });

  describe("the fail screen says why", () => {
    it("names the shortfall, the best hand and the boss's debuff", () => {
      render(<CardTable scenario={authored(DOSE_ESCALATION_SCENARIO)} />);
      for (let i = 0; i < 9; i++) {
        const first = cards()[0];
        if (!first) break;
        fireEvent.click(first);
        fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
      }
      const diagnosis = screen.getByTestId("te-loss-diagnosis").textContent;
      expect(diagnosis).toContain("No hand was played.");
      expect(diagnosis).toContain("counted only Safety outputs.");
      expect(screen.getByTestId("blind-result").textContent).toContain(
        "Best round"
      );
    });

    const failed = (view: Partial<TableView>) =>
      describeBlindLoss(
        fromPartial<TableView>({
          outcome: "FAILED",
          clock: null,
          quota: 7500,
          roundScore: 1049,
          scoreLog: [],
          modifiers: [],
          handsLeft: null,
          hand: [fromPartial({})],
          ...view,
        })
      );

    it("blames a crisis's hand limit and names the best hand", () => {
      expect(
        failed({
          handsLeft: 0,
          scoreLog: [
            fromPartial({ name: "TLF Pair", score: 400 }),
            fromPartial({ name: "TLF Two Pair", score: 649 }),
          ],
          modifiers: [
            fromPartial({
              name: "Emergency Review",
              debuffType: "HAND_LIMIT",
              maxHandsAllowed: 2,
            }),
          ],
        })
      ).toBe(
        "6451 short. Your best hand was a TLF Two Pair (649). Emergency Review left 2 hands."
      );
    });

    it("says when the deck ran dry or the CPU ran out", () => {
      expect(failed({ hand: [] })).toContain("The deck ran out of outputs.");
      expect(failed({})).toContain("The CPU ran out before another hand.");
    });

    it("stays quiet unless the Blind failed, and on a Clinical Hold", () => {
      expect(failed({ outcome: "CLEARED" })).toBeNull();
      expect(failed({ clock: fromPartial({ hold: true }) })).toBeNull();
    });
  });
});
