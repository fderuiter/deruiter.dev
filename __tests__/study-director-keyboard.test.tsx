import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { StudyDirectorGame } from "@/components/study-director/StudyDirectorGame";

function start() {
  render(<StudyDirectorGame />);
  fireEvent.click(screen.getByRole("button", { name: /start the study/i }));
  return document.querySelector(
    '[data-keyboard-boundary="true"]'
  ) as HTMLElement;
}

describe("Study Director keyboard play", () => {
  beforeEach(() => {
    globalThis.localStorage?.clear?.();
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens the shortcut sheet with ? and closes it with Escape", () => {
    const root = start();
    fireEvent.keyDown(root, { key: "?" });
    const dialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(within(dialog).getByText("End the day")).toBeTruthy();
    // Shortcuts are off while the sheet is open.
    fireEvent.keyDown(root, { key: "e" });
    expect(screen.getByText(/Day 1 \/ 77/)).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens the sheet from the ? button", () => {
    start();
    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("moves through the inbox with the arrow keys", () => {
    const root = start();
    // Reach a day with more than one message.
    for (let i = 0; i < 30; i += 1) {
      const inbox = screen.getByRole("region", { name: "Inbox" });
      if (within(inbox).queryAllByRole("button").length > 1) break;
      fireEvent.keyDown(root, { key: "e" });
    }
    const inbox = screen.getByRole("region", { name: "Inbox" });
    const rows = within(inbox).getAllByRole("button");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0].getAttribute("aria-current")).toBe("true");
    fireEvent.keyDown(root, { key: "ArrowDown" });
    expect(rows[1].getAttribute("aria-current")).toBe("true");
    fireEvent.keyDown(root, { key: "ArrowUp" });
    expect(rows[0].getAttribute("aria-current")).toBe("true");
  });

  it("dismisses the outcome strip with Escape", () => {
    const root = start();
    fireEvent.keyDown(root, { key: "1" });
    expect(screen.getByTestId("study-outcome")).toBeTruthy();
    fireEvent.keyDown(root, { key: "Escape" });
    expect(screen.queryByTestId("study-outcome")).toBeNull();
  });

  it("keeps focus on the desk after a clicked decision", () => {
    const root = start();
    fireEvent.click(
      screen.getByRole("button", { name: /Sure, we'll add them/ })
    );
    expect(document.activeElement).toBe(root);
  });
});
