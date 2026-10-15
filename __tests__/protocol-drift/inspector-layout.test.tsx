import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ProtocolDriftGame } from "@/components/protocol-drift/ProtocolDriftGame";
import { useProtocolDriftStore } from "@/components/protocol-drift/store";
import { installFlowMocks } from "./ui-helpers";

vi.mock("@/lib/audio", () => ({
  getSoundEngine: () => ({
    isSoundAllowed: () => false,
    playTone: vi.fn(),
  }),
}));

async function mountAtDraft() {
  const view = render(<ProtocolDriftGame />);
  const accept = await screen.findByRole("button", {
    name: /accept assignment/i,
  });
  await act(async () => {
    fireEvent.click(accept);
  });
  return view;
}

describe("Forensic Inspector layout", () => {
  beforeAll(() => installFlowMocks());
  afterEach(() => cleanup());

  it("stays a title bar until there is something to inspect (#2274)", async () => {
    await mountAtDraft();
    const inspector = screen.getByTestId("inspector");
    expect(inspector.dataset.quiet).toBe("true");
    expect(inspector.style.height).toBe("");
    expect(screen.queryByTestId("pane-form")).toBeNull();
    expect(screen.getByText(/No issues yet/)).toBeTruthy();
  });

  it("docks at clamp(168px, 22vh, 328px) with three panes in 30/40/30 columns", async () => {
    await mountAtDraft();
    await act(async () => {
      useProtocolDriftStore
        .getState()
        .select({ issueId: null, submissionId: "sub-a01-vs-d0" });
    });
    const inspector = screen.getByTestId("inspector");
    expect(inspector.dataset.expanded).toBe("false");
    expect(inspector.dataset.quiet).toBe("false");
    expect(inspector.style.height).toBe("clamp(168px, 22vh, 328px)");
    expect(screen.getByTestId("pane-form")).toBeTruthy();
    expect(screen.getByTestId("pane-trace")).toBeTruthy();
    expect(screen.getByTestId("pane-review")).toBeTruthy();
    const grid = screen.getByTestId("pane-form").parentElement as HTMLElement;
    expect(grid.className).toContain("grid-cols-[30fr_40fr_30fr]");
  });

  it("folds to its title bar and back, keeping the open-issue count in view", async () => {
    await mountAtDraft();
    await act(async () => {
      useProtocolDriftStore
        .getState()
        .select({ issueId: null, submissionId: "sub-a01-vs-d0" });
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Collapse" }));
    });
    expect(screen.getByTestId("inspector").dataset.quiet).toBe("true");
    expect(screen.queryByTestId("pane-form")).toBeNull();
    expect(screen.getByText(/0 open issues/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
    });
    expect(screen.getByTestId("inspector").dataset.quiet).toBe("false");
    expect(screen.getByTestId("pane-form")).toBeTruthy();
    act(() => useProtocolDriftStore.getState().setInspectorCollapsed(false));
  });

  it("expands over the canvas on I and docks again on Escape", async () => {
    await mountAtDraft();
    const root = document.querySelector(
      "[data-game='protocol-drift']"
    ) as HTMLElement;
    await act(async () => {
      fireEvent.keyDown(root, { key: "i" });
    });
    const inspector = screen.getByTestId("inspector");
    expect(inspector.dataset.expanded).toBe("true");
    expect(inspector.style.top).toBe("112px");
    await act(async () => {
      fireEvent.keyDown(root, { key: "Escape" });
    });
    expect(screen.getByTestId("inspector").dataset.expanded).toBe("false");
    expect(useProtocolDriftStore.getState().inspectorExpanded).toBe(false);
  });
});
