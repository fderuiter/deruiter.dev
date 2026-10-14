// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { ACT_I, type Act } from "@/lib/trial-and-error";
import { authoredPlan } from "./utils/trial-and-error-authored";

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

const act: Act = { ...ACT_I, crisisDeck: undefined };
const KEY = `te:run-save:${act.id}`;
let storage: MockStorage;
const original = Object.getOwnPropertyDescriptor(window, "localStorage");

function useStorage(value: unknown) {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value,
  });
}

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

const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;
const cpu = () => screen.getByTestId("cpu-pips").textContent;

/** Selects the Small Blind's supporting pair and plays it. */
function playPair() {
  fireEvent.click(card("C-T14.1.1-A"));
  fireEvent.click(card("C-L16.2.4"));
  fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
}

describe("resuming a saved run", () => {
  it("saves after each move and resumes the same table after a reload", () => {
    const first = render(
      <CardTable act={authoredPlan(act)} seed="resume-1" persist />
    );
    expect(storage.getItem(KEY)).toBeNull();
    playPair();
    const saved = storage.getItem(KEY);
    expect(saved).toContain('"seed":"resume-1"');
    const hand = Array.from(document.querySelectorAll("[data-card-id]"), (el) =>
      el.getAttribute("data-card-id")
    );
    const score = screen.getByTestId("round-score").textContent;
    const pips = cpu();
    first.unmount();

    // The reload: a fresh table on a different seed finds the save.
    render(<CardTable act={authoredPlan(act)} seed="other-seed" persist />);
    const prompt = screen.getByTestId("resume-run");
    expect(prompt.textContent).toContain("Act I: Phase I Safety");
    expect(prompt.textContent).toContain("resume-1");
    const resume = screen.getByRole("button", { name: "Resume run" });
    expect(document.activeElement).toBe(resume);
    fireEvent.click(resume);
    expect(screen.queryByTestId("resume-run")).toBeNull();
    expect(
      Array.from(document.querySelectorAll("[data-card-id]"), (el) =>
        el.getAttribute("data-card-id")
      )
    ).toEqual(hand);
    expect(screen.getByTestId("round-score").textContent).toBe(score);
    expect(cpu()).toBe(pips);
    expect(announce).toHaveBeenCalledWith(
      expect.stringMatching(/^Resumed Act I: Phase I Safety/)
    );
  });

  it("asks before a new run discards the save, and can keep it", () => {
    const first = render(
      <CardTable act={authoredPlan(act)} seed="resume-2" persist />
    );
    playPair();
    first.unmount();
    render(<CardTable act={authoredPlan(act)} persist />);
    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    expect(screen.getByTestId("resume-confirm-new").textContent).toContain(
      "The saved run will be discarded."
    );
    fireEvent.click(screen.getByRole("button", { name: "Keep saved run" }));
    expect(screen.queryByTestId("resume-confirm-new")).toBeNull();
    expect(screen.getByRole("button", { name: "Resume run" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "New run" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Discard and start new" })
    );
    expect(screen.queryByTestId("resume-run")).toBeNull();
    expect(storage.getItem(KEY)).toBeNull();
    expect(screen.getByTestId("round-score")).toBeTruthy();
  });

  it("starts normally over a corrupt save and replaces it on the first move", () => {
    storage.setItem(KEY, "{not json");
    render(<CardTable act={authoredPlan(act)} seed="resume-3" persist />);
    expect(screen.queryByTestId("resume-run")).toBeNull();
    fireEvent.click(card("C-T14.1.1-A"));
    expect(storage.getItem(KEY)).toContain('"seed":"resume-3"');
  });

  it("works as today when storage is missing or throws", () => {
    useStorage(undefined);
    const missing = render(
      <CardTable act={authoredPlan(act)} seed="resume-4" persist />
    );
    playPair();
    expect(screen.getByTestId("round-score")).toBeTruthy();
    missing.unmount();
    useStorage({
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    });
    render(<CardTable act={authoredPlan(act)} seed="resume-4" persist />);
    expect(screen.queryByTestId("resume-run")).toBeNull();
    playPair();
    expect(screen.getByTestId("round-score")).toBeTruthy();
  });

  it("never reads or writes a save unless asked to persist", () => {
    storage.setItem(KEY, "{}");
    render(<CardTable act={authoredPlan(act)} seed="resume-5" />);
    expect(screen.queryByTestId("resume-run")).toBeNull();
    playPair();
    expect(storage.getItem(KEY)).toBe("{}");
  });

  it("removes the save when the run ends, and a restart does not bring it back", () => {
    // Two CPU buys one hand, far short of the quota: the run is lost.
    const short: Act = {
      ...act,
      blinds: [
        {
          ...act.blinds[0],
          table: { ...act.blinds[0].table, startingCpu: 2 },
        },
        ...act.blinds.slice(1),
      ],
    };
    render(<CardTable act={authoredPlan(short)} seed="resume-6" persist />);
    fireEvent.click(card("C-T14.1.1-A"));
    expect(storage.getItem(KEY)).not.toBeNull();
    fireEvent.click(card("C-L16.2.4"));
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
    expect(storage.getItem(KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restart run" }));
    expect(storage.getItem(KEY)).toBeNull();
  });
});
