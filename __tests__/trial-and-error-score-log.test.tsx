// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import { ScoreLog } from "@/components/trial-and-error/ScoreLog";
import {
  DEMOGRAPHICS_SCENARIO,
  type ScoreLogEntry,
} from "@/lib/trial-and-error";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));

class MockStorage {
  private store = new Map<string, string>();
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const useStorage = (value: unknown) =>
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    writable: true,
    value,
  });

beforeEach(() => {
  announce.mockClear();
  useStorage(new MockStorage());
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
  if (original) Object.defineProperty(globalThis, "localStorage", original);
});

const toggle = () => screen.getByTestId("score-log-toggle");
const entries = () => screen.queryAllByTestId("score-log-entry");
const card = (id: string) =>
  document.querySelector<HTMLButtonElement>(`[data-card-id="${id}"]`)!;

const ZEROED: ScoreLogEntry = {
  handType: "TLF_PAIR",
  name: "TLF Pair",
  level: 1,
  chips: 80,
  mult: 0,
  score: 0,
  fired: [
    { kind: "RULE", label: "AE-DENOM", effect: "+10 Chips" },
    { kind: "ZERO_RULE", label: "UNBLINDING", effect: "×0" },
  ],
  zeroLabel: "UNBLINDING",
};

describe("score log (#1082)", () => {
  it("is collapsed by default and toggles with aria-expanded", () => {
    render(<ScoreLog entries={[ZEROED]} />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(toggle().textContent).toContain("1 hand");
    const list = document.getElementById(
      toggle().getAttribute("aria-controls")!
    )!;
    expect(list.hidden).toBe(true);
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(list.hidden).toBe(false);
    expect(localStorage.getItem("te:score-log-open")).toBe("1");
    fireEvent.click(toggle());
    expect(list.hidden).toBe(true);
  });

  it("marks a zero-score entry in text and lists what fired", () => {
    localStorage.setItem("te:score-log-open", "1");
    render(<ScoreLog entries={[ZEROED]} />);
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    const [entry] = entries();
    expect(entry.dataset.zero).toBe("true");
    expect(entry.textContent).toContain("1. TLF Pair");
    expect(entry.textContent).toContain("80 × 0 = 0");
    expect(entry.textContent).toContain("Scored zero: UNBLINDING ×0");
    expect(entry.textContent).toContain("AE-DENOM: +10 Chips");
  });

  it("says when no hand has been played", () => {
    localStorage.setItem("te:score-log-open", "1");
    render(<ScoreLog entries={[]} />);
    expect(toggle().textContent).toContain("0 hands");
    expect(screen.getByText("No hands played this Blind yet.")).toBeTruthy();
  });

  it("still toggles when storage is missing or throws", () => {
    useStorage(undefined);
    const { unmount } = render(<ScoreLog entries={[ZEROED]} />);
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    unmount();

    useStorage({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    render(<ScoreLog entries={[ZEROED]} />);
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(entries()).toHaveLength(1);
  });

  it("logs each hand played at the table", () => {
    // A named seed opens on the Blind's own setup (#2413), which holds the
    // disposition table; a fresh seed may pick another opener.
    render(<CardTable scenario={DEMOGRAPHICS_SCENARIO} seed="score-log" />);
    fireEvent.click(toggle());
    expect(entries()).toHaveLength(0);
    fireEvent.click(card("C-T14.1.2"));
    fireEvent.click(screen.getByRole("button", { name: /Play Hand/ }));
    expect(toggle().textContent).toContain("1 hand");
    const [entry] = entries();
    expect(entry.textContent).toContain("High Table");
    expect(entry.textContent).toContain("40 × 2 = 80");
  });
});
