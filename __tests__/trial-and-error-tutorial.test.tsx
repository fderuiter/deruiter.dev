// @vitest-environment jsdom
import React, { useEffect } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { TrialAndErrorTable } from "@/components/trial-and-error/Tutorial";
import {
  TUTORIAL_SEEN_KEY,
  carryOverTutorialSeen,
} from "@/components/trial-and-error/tutorial-seen";
import {
  CabinetTutorialContext,
  useTutorialRun,
  type TutorialRun,
} from "@/components/arcade/tutorial";
import {
  arcadeTutorialsSlice,
  read,
  setTutorialOutcome,
  write,
} from "@/lib/arcade";
import { TRIAL_AND_ERROR_TUTORIAL } from "@/lib/trial-and-error";

/**
 * Trial & Error's guided Blind (#1089) on the cabinet's shared tutorial
 * (#3455): the table deals the guided hand while the tutorial runs and
 * signals each step the table shows done.
 */

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
}));
// The manual's own modal needs the site's audio provider.
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: ({
    action,
  }: {
    action?: { label: string; onSelect: () => void };
  }) =>
    action ? (
      <button type="button" onClick={action.onSelect}>
        {action.label}
      </button>
    ) : (
      <button type="button">Manual</button>
    ),
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
let storage: MockStorage;
beforeEach(() => {
  storage = new MockStorage();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
  write(arcadeTutorialsSlice, { version: 1, games: {} });
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
afterEach(() => {
  cleanup();
  if (original) Object.defineProperty(window, "localStorage", original);
});

/** The table inside a cabinet's tutorial, with the run held for the test. */
function renderTable() {
  const holder: { run: TutorialRun | null } = { run: null };
  function Harness() {
    const run = useTutorialRun(TRIAL_AND_ERROR_TUTORIAL);
    useEffect(() => {
      holder.run = run;
    });
    return (
      <CabinetTutorialContext.Provider value={run.value}>
        <TrialAndErrorTable />
      </CabinetTutorialContext.Provider>
    );
  }
  render(<Harness />);
  const run = () => holder.run!;
  const stepId = () =>
    TRIAL_AND_ERROR_TUTORIAL.steps[run().state.index]?.id ?? null;
  return { run, stepId };
}

const guidedTable = "C-T14.1.1-G";
const card = (id: string) =>
  document.querySelector<HTMLElement>(`[data-card-id="${id}"]`);

describe("Trial & Error on the shared tutorial (#3455)", () => {
  it("plays the campaign until the tutorial starts", () => {
    const { run } = renderTable();
    expect(screen.getByTestId("hand").textContent).not.toContain("(Guided)");
    act(() => run().start());
    expect(screen.getByTestId("hand").textContent).toContain("(Guided)");
  });

  it("marks each table step's control for the tutorial card", () => {
    const { run } = renderTable();
    act(() => run().start());
    expect(card(guidedTable)?.dataset.tutorialTarget).toBe(
      `card-${guidedTable}`
    );
    expect(
      document.querySelector('[data-tutorial-target="play"]')
    ).not.toBeNull();
  });

  it("moves focus to the card the next step points at (#2155)", async () => {
    const { run, stepId } = renderTable();
    act(() => run().start());
    act(() => run().dispatch({ type: "next" }));
    expect(stepId()).toBe("inspect");
    await waitFor(() =>
      expect(
        (document.activeElement as HTMLElement | null)?.dataset.cardId
      ).toBe(guidedTable)
    );
  });

  it("signals Inspect from the table and shows the step inside the Inspect view", async () => {
    const { run, stepId } = renderTable();
    act(() => run().start());
    act(() => run().dispatch({ type: "next" }));
    fireEvent.click(card(guidedTable)!);
    fireEvent.click(screen.getByRole("button", { name: /^Inspect/ }));

    await waitFor(() => expect(run().state.progress).toBe(1));
    expect(stepId()).toBe("inspect");
    // The Inspect view covers the cabinet, so it shows the step itself.
    const drawer = screen.getByTestId("inspect-drawer");
    expect(drawer.dataset.tutorialCovers).toBe("true");
    act(() => run().dispatch({ type: "next" }));
    expect(stepId()).toBe("review");
    expect(drawer.querySelector("[data-testid='coach'] h3")?.textContent).toBe(
      "Review a cell"
    );
  });

  it("no longer offers its own replay in the Field Manual", () => {
    renderTable();
    expect(
      screen.queryByRole("button", { name: "Replay tutorial" })
    ).toBeNull();
  });

  it("returns to the campaign when the tutorial is left", () => {
    const { run } = renderTable();
    act(() => run().start());
    act(() => run().dispatch({ type: "exit" }));
    expect(screen.getByTestId("hand").textContent).not.toContain("(Guided)");
  });
});

describe("a returning player's guided Blind answer (#3455)", () => {
  it("carries the old record over as turned down", () => {
    storage.setItem(TUTORIAL_SEEN_KEY, "1");
    carryOverTutorialSeen();
    expect(read(arcadeTutorialsSlice).games["trial-and-error"]).toEqual({
      version: TRIAL_AND_ERROR_TUTORIAL.version,
      outcome: "declined",
    });
  });

  it("leaves a first-time player to be offered it", () => {
    carryOverTutorialSeen();
    expect(read(arcadeTutorialsSlice).games["trial-and-error"]).toBeUndefined();
  });

  it("keeps a record the cabinet already holds", () => {
    storage.setItem(TUTORIAL_SEEN_KEY, "1");
    setTutorialOutcome("trial-and-error", 1, "completed");
    carryOverTutorialSeen();
    expect(read(arcadeTutorialsSlice).games["trial-and-error"]?.outcome).toBe(
      "completed"
    );
  });

  it("does nothing when storage throws", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    });
    expect(() => carryOverTutorialSeen()).not.toThrow();
  });
});
