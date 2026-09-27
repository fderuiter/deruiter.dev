// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  ACT_I,
  AMENDMENT_STALE_ALERT,
  deriveRunView,
  serializeRun,
  type Act,
} from "@/lib/trial-and-error";
import { amendmentInTray } from "./utils/trial-and-error-amendment-run";

vi.mock("@/hooks/useAnnouncer", () => ({
  useAnnouncer: () => ({ announce: vi.fn() }),
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
const original = Object.getOwnPropertyDescriptor(window, "localStorage");

beforeEach(() => {
  const storage = new MockStorage();
  const { run, actions } = amendmentInTray(act);
  storage.setItem(
    `te:run-save:${act.id}`,
    serializeRun({ actId: act.id, seed: run.seed, actions }, new Date())
  );
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
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
  if (original) Object.defineProperty(window, "localStorage", original);
});

/** Resumes the saved run at the Big Blind with an amendment in the tray. */
function resume() {
  render(<CardTable act={act} persist />);
  fireEvent.click(screen.getByRole("button", { name: "Resume run" }));
  const tile = within(screen.getByTestId("consumable-tray"))
    .getAllByTestId("consumable")
    .find((el) => el.getAttribute("data-kind") === "amendment")!;
  return within(tile).getByRole("button", { name: /^Use / });
}

describe("filing a SAP Amendment from the tray", () => {
  it("confirms the rule change and the outputs it stales before filing", async () => {
    const { run } = amendmentInTray(act);
    const preview = deriveRunView(act, run).table.amendmentPreviews[0];
    expect(preview.staled.length).toBeGreaterThan(0);

    fireEvent.click(resume());
    const dialog = screen.getByRole("alertdialog", {
      name: `File ${preview.name}?`,
    });
    expect(dialog.textContent).toContain(
      `${preview.fromId} becomes ${preview.toId}`
    );
    expect(
      within(dialog)
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual(preview.staled.map((c) => c.name));
    // The safe choice takes focus, and Escape keeps the amendment.
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe("Keep in tray [Esc]")
    );
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.querySelector('[data-kind="amendment"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^Use .*Amendment/ }));
    fireEvent.click(screen.getByTestId("amendment-confirm"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(document.querySelector('[data-kind="amendment"]')).toBeNull();

    const staled = document.querySelector<HTMLButtonElement>(
      `[data-card-id="${preview.staled[0].cardId}"]`
    )!;
    fireEvent.click(staled);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /Play Hand/ })
        .disabled
    ).toBe(true);
    expect(document.body.textContent).toContain(AMENDMENT_STALE_ALERT);
  });
});
