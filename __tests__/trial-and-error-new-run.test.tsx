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
  within,
} from "@testing-library/react";
import { CardTable } from "@/components/trial-and-error/CardTable";
import {
  ACT_I,
  DOSE_ESCALATION_SCENARIO,
  dailySeed,
  type Act,
} from "@/lib/trial-and-error";

const announce = vi.fn();
vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce }),
}));
vi.mock("@/components/FieldManualButton", () => ({
  FieldManualButton: () => <button type="button">Manual</button>,
}));
const copyToClipboard = vi.fn<(text: string) => Promise<void>>();
vi.mock("@/lib/clipboard", () => ({
  copyToClipboard: (text: string) => copyToClipboard(text),
  getActiveHostUrl: () => "https://deruiter.dev",
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
const act1: Act = { ...ACT_I, crisisDeck: undefined };

beforeEach(() => {
  announce.mockClear();
  copyToClipboard.mockReset();
  copyToClipboard.mockResolvedValue(undefined);
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
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  window.history.replaceState(null, "", "/");
  if (original) Object.defineProperty(window, "localStorage", original);
});

const newRun = () => screen.queryByTestId("new-run");

function openRunInfo() {
  fireEvent.click(screen.getByTestId("run-info-button"));
  return screen.getByRole("dialog", { name: "Run Info" });
}

function openNewRunFromRunInfo() {
  fireEvent.click(within(openRunInfo()).getByTestId("run-info-new-run"));
  expect(screen.queryByRole("dialog", { name: "Run Info" })).toBeNull();
  return screen.getByRole("dialog", { name: "New run" });
}

describe("New Run (#1528)", () => {
  it("starts a typed seed in canonical form and records it as seeded", async () => {
    render(<CardTable act={act1} seed="first" />);
    const dialog = openNewRunFromRunInfo();
    const input = within(dialog).getByTestId("new-run-seed");
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole("radio", { name: /Random seed/ })
      )
    );

    // Too short: the error is announced and tied to the field.
    fireEvent.change(input, { target: { value: "7k3m-q9" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    const error = within(dialog).getByRole("alert");
    expect(error.textContent).toContain("Enter 8 letters or digits");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(error.id);
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: "7k3m q9px" } });
    expect(within(dialog).queryByRole("alert")).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    expect(newRun()).toBeNull();
    expect(announce).toHaveBeenCalledWith("New run started on seed 7K3M-Q9PX.");

    const info = openRunInfo();
    expect(within(info).getByTestId("run-seed").textContent).toBe("7K3M-Q9PX");
    expect(within(info).getByTestId("seed-share").textContent).toContain(
      "seeded"
    );
  });

  it("warns that a run in progress ends, and Escape changes nothing", () => {
    render(<CardTable act={act1} seed="keep-me" />);
    const first = document.querySelector<HTMLButtonElement>("[data-card-id]")!;
    fireEvent.click(first);
    const dialog = openNewRunFromRunInfo();
    expect(dialog.textContent).toContain(
      "Starting a new run ends the current one."
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(newRun()).toBeNull();
    const info = openRunInfo();
    expect(within(info).getByTestId("run-seed").textContent).toBe("keep-me");
  });

  it("plays today's Daily Protocol by the UTC date", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // Already October 1st in Tokyo, still September 30th in UTC.
    vi.setSystemTime(new Date("2026-09-30T23:30:00Z"));
    render(<CardTable act={act1} seed="first" />);
    const dialog = openNewRunFromRunInfo();
    expect(within(dialog).getByTestId("daily-date").textContent).toContain(
      "2026-09-30 (UTC)"
    );
    fireEvent.click(within(dialog).getByRole("radio", { name: /Daily/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    expect(announce).toHaveBeenCalledWith(
      "Daily Protocol for 2026-09-30 started."
    );
    const info = openRunInfo();
    expect(within(info).getByTestId("run-seed").textContent).toBe(
      dailySeed("2026-09-30")
    );
    expect(within(info).getByTestId("run-daily").textContent).toContain(
      "Daily Protocol 2026-09-30 (UTC)"
    );
  });

  it("copies the seed and a challenge link that replays it", async () => {
    render(<CardTable act={act1} seed="7K3M-Q9PX" />);
    const info = openRunInfo();
    fireEvent.click(within(info).getByRole("button", { name: "Copy seed" }));
    await waitFor(() =>
      expect(
        within(info).getByRole("button", { name: "Seed copied" })
      ).toBeTruthy()
    );
    expect(copyToClipboard).toHaveBeenLastCalledWith("7K3M-Q9PX");
    fireEvent.click(
      within(info).getByRole("button", { name: "Copy challenge link" })
    );
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith("Challenge link copied.")
    );
    expect(copyToClipboard).toHaveBeenLastCalledWith(
      "https://deruiter.dev/arcade/trial-and-error#seed=7K3M-Q9PX"
    );
  });

  it("names the seed when copying fails", async () => {
    copyToClipboard.mockRejectedValue(new Error("denied"));
    render(<CardTable act={act1} seed="7K3M-Q9PX" />);
    const info = openRunInfo();
    fireEvent.click(within(info).getByRole("button", { name: "Copy seed" }));
    await waitFor(() =>
      expect(announce).toHaveBeenCalledWith(
        "Copy failed. The seed is 7K3M-Q9PX."
      )
    );
  });

  it("opens a challenge link's seed and clears it from the address bar", async () => {
    window.history.replaceState(
      null,
      "",
      "/arcade/trial-and-error#seed=7k3m-q9px"
    );
    render(<CardTable act={act1} persist />);
    const dialog = screen.getByRole("dialog", { name: "New run" });
    expect(dialog.textContent).toContain("Challenge link");
    const input = within(dialog).getByTestId<HTMLInputElement>("new-run-seed");
    expect(input.value).toBe("7K3M-Q9PX");
    await waitFor(() => expect(document.activeElement).toBe(input));
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    expect(newRun()).toBeNull();
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/arcade/trial-and-error");
    expect(within(openRunInfo()).getByTestId("run-seed").textContent).toBe(
      "7K3M-Q9PX"
    );
  });

  it("keeps a Daily Protocol link's date", () => {
    const seed = dailySeed("2026-09-29");
    window.history.replaceState(
      null,
      "",
      `/arcade/trial-and-error#seed=${seed}&daily=2026-09-29`
    );
    render(<CardTable act={act1} persist />);
    const dialog = screen.getByRole("dialog", { name: "New run" });
    expect(dialog.textContent).toContain("Daily Protocol for 2026-09-29");
    fireEvent.click(within(dialog).getByRole("button", { name: "Start run" }));
    const info = openRunInfo();
    expect(within(info).getByTestId("run-daily").textContent).toContain(
      "2026-09-29"
    );
  });

  it("dismisses a challenge link on Cancel, leaving the run as it was", () => {
    window.history.replaceState(null, "", "/#seed=7K3M-Q9PX");
    render(<CardTable act={act1} seed="mine" persist />);
    const dialog = screen.getByRole("dialog", { name: "New run" });
    fireEvent.click(within(dialog).getByRole("button", { name: /Cancel/ }));
    expect(newRun()).toBeNull();
    expect(window.location.hash).toBe("");
    expect(within(openRunInfo()).getByTestId("run-seed").textContent).toBe(
      "mine"
    );
  });

  it("opens a link pasted into the address bar while playing", () => {
    render(<CardTable act={act1} seed="mine" persist />);
    expect(newRun()).toBeNull();
    act(() => {
      window.history.replaceState(null, "", "/#seed=7K3M-Q9PX");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(screen.getByRole("dialog", { name: "New run" })).toBeTruthy();
  });

  it("ignores challenge links on a table that does not persist", () => {
    window.history.replaceState(null, "", "/#seed=7K3M-Q9PX");
    render(
      <CardTable
        act={act1}
        seed="guided"
        endAction={() => ({ label: "Start the campaign", onSelect: () => {} })}
      />
    );
    expect(newRun()).toBeNull();
    const info = openRunInfo();
    expect(within(info).queryByTestId("run-info-new-run")).toBeNull();
  });

  it("offers New run and the seed to share when the run ends", () => {
    render(<CardTable scenario={DOSE_ESCALATION_SCENARIO} seed="lost" />);
    for (let i = 0; i < 9; i++) {
      const first = document.querySelector<HTMLButtonElement>("[data-card-id]");
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    }
    const result = screen.getByTestId("blind-result");
    expect(within(result).getByTestId("run-seed").textContent).toBe("lost");
    expect(
      within(result).getByRole("button", { name: "Copy challenge link" })
    ).toBeTruthy();
    fireEvent.click(within(result).getByTestId("end-new-run"));
    expect(screen.getByRole("dialog", { name: "New run" })).toBeTruthy();
    // The run is over, so nothing is lost by starting another.
    expect(newRun()!.textContent).not.toContain("ends the current one");
  });

  it("restarts on a fresh codec seed from Restart run", () => {
    render(<CardTable scenario={DOSE_ESCALATION_SCENARIO} seed="lost" />);
    for (let i = 0; i < 9; i++) {
      const first = document.querySelector<HTMLButtonElement>("[data-card-id]");
      if (!first) break;
      fireEvent.click(first);
      fireEvent.click(screen.getByRole("button", { name: /Discard/ }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Restart run" }));
    const info = openRunInfo();
    expect(within(info).getByTestId("run-seed").textContent).toMatch(
      /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/
    );
  });
});
