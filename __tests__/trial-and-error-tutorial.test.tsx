// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  TUTORIAL_SEEN_KEY,
  TrialAndErrorTable,
} from "@/components/trial-and-error/Tutorial";
import { TUTORIAL_STEPS } from "@/lib/trial-and-error";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
// The manual's own modal needs the site's audio provider; its action is the
// part under test here.
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
const useStorage = (value: unknown) =>
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value,
  });

let storage: MockStorage;
beforeEach(() => {
  announce.mockClear();
  storage = new MockStorage();
  useStorage(storage);
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

const coachTitle = () => screen.getByTestId("coach").querySelector("h3");

describe("first-run guided Blind (#1089)", () => {
  it("offers the guided Blind to a first-time player", () => {
    render(<TrialAndErrorTable />);
    expect(screen.getByTestId("tutorial-offer")).toBeTruthy();
    // The campaign stays playable underneath.
    expect(screen.getByTestId("hand")).toBeTruthy();
  });

  it("does not offer it to a returning player", () => {
    storage.setItem(TUTORIAL_SEEN_KEY, "1");
    render(<TrialAndErrorTable />);
    expect(screen.queryByTestId("tutorial-offer")).toBeNull();
  });

  it("remembers a skip", () => {
    render(<TrialAndErrorTable />);
    fireEvent.click(screen.getByRole("button", { name: "No thanks" }));
    expect(storage.getItem(TUTORIAL_SEEN_KEY)).toBe("1");
    expect(screen.queryByTestId("tutorial-offer")).toBeNull();
  });

  it("walks from Welcome to the first action and announces each step", async () => {
    render(<TrialAndErrorTable />);
    fireEvent.click(screen.getByRole("button", { name: "Start guided Blind" }));
    expect(screen.getByTestId("hand").textContent).toContain("(Guided)");
    expect(coachTitle()?.textContent).toBe(TUTORIAL_STEPS[0].title);
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        `${TUTORIAL_STEPS[0].title}. ${TUTORIAL_STEPS[0].text}`
      )
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(coachTitle()?.textContent).toBe(TUTORIAL_STEPS[1].title);
    // A step that waits for the table has no Next.
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        `${TUTORIAL_STEPS[1].title}. ${TUTORIAL_STEPS[1].text}`
      )
    );
  });

  it("skips from any step to the campaign and remembers it", () => {
    render(<TrialAndErrorTable />);
    fireEvent.click(screen.getByRole("button", { name: "Start guided Blind" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
    expect(screen.queryByTestId("coach")).toBeNull();
    expect(screen.getByTestId("hand").textContent).not.toContain("(Guided)");
    expect(storage.getItem(TUTORIAL_SEEN_KEY)).toBe("1");
  });

  it("replays from the Field Manual for a returning player", () => {
    storage.setItem(TUTORIAL_SEEN_KEY, "1");
    render(<TrialAndErrorTable />);
    fireEvent.click(screen.getByRole("button", { name: "Replay tutorial" }));
    expect(coachTitle()?.textContent).toBe(TUTORIAL_STEPS[0].title);
  });

  it("still offers and skips when storage throws", () => {
    useStorage({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    render(<TrialAndErrorTable />);
    expect(screen.getByTestId("tutorial-offer")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start guided Blind" }));
    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Skip tutorial" }))
    ).not.toThrow();
    expect(screen.queryByTestId("coach")).toBeNull();
  });

  it("works with no storage at all", () => {
    useStorage(undefined);
    render(<TrialAndErrorTable />);
    expect(screen.getByTestId("tutorial-offer")).toBeTruthy();
  });
});
