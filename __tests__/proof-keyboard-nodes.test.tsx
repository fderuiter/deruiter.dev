import React from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ProofWorkspaceClient } from "@/app/proof/ProofWorkspaceClient";

beforeAll(async () => {
  globalThis.Worker = class {
    postMessage = vi.fn();
    terminate = vi.fn();
    addEventListener = vi.fn();
    removeEventListener = vi.fn();
  } as unknown as typeof Worker;
  const { unmount } = render(<ProofWorkspaceClient />);
  await screen.findByRole("button", { name: /^Node A / }, { timeout: 10000 });
  unmount();
  cleanup();
});

beforeEach(() => {
  window.history.replaceState(null, "", "/proof");
  vi.stubGlobal(
    "Worker",
    class {
      postMessage = vi.fn();
      terminate = vi.fn();
      addEventListener = vi.fn();
      removeEventListener = vi.fn();
    }
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Proof graph keyboard controls (#1228)", () => {
  it("names and focuses node controls, connects them, and reports actual completion", () => {
    render(<ProofWorkspaceClient />);
    const intermediate = screen.getByRole("button", {
      name: /^Node C PROVEN Q .* intermediate$/,
    });
    const goal = screen.getByRole("button", {
      name: /^Node E PENDING R .* conclusion$/,
    });
    expect(goal.getAttribute("aria-label")).toBeNull();
    intermediate.focus();
    fireEvent.click(intermediate);
    expect(intermediate.getAttribute("aria-pressed")).toBe("true");
    goal.focus();
    fireEvent.click(goal);
    expect(
      screen.getByRole("button", {
        name: /^Node E PENDING R .* conclusion$/,
      })
    ).toBe(goal);
    const premise = screen.getByRole("button", {
      name: /^Node D GIVEN Q → R .* premise$/,
    });
    premise.focus();
    fireEvent.click(premise);
    goal.focus();
    fireEvent.click(goal);
    expect(
      screen.getByRole("button", {
        name: /^Node E PROVEN R .* conclusion$/,
      })
    ).toBe(goal);
    expect(document.activeElement).toBe(goal);
  });
});
