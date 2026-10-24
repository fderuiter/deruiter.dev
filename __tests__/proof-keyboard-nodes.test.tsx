import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { ProofWorkspaceClient } from "@/app/proof/ProofWorkspaceClient";

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
      name: /^Node C, PROVEN, Q, .*, intermediate,/,
    });
    const goal = screen.getByRole("button", {
      name: /^Node E, PENDING, R, .*, conclusion,/,
    });
    intermediate.focus();
    fireEvent.click(intermediate);
    expect(intermediate.getAttribute("aria-pressed")).toBe("true");
    goal.focus();
    fireEvent.click(goal);
    expect(goal.getAttribute("aria-label")).toMatch(/^Node E, PENDING, /);
    const premise = screen.getByRole("button", {
      name: /^Node D, GIVEN, Q → R, .*, premise,/,
    });
    premise.focus();
    fireEvent.click(premise);
    goal.focus();
    fireEvent.click(goal);
    expect(goal.getAttribute("aria-label")).toMatch(/^Node E, PROVEN, /);
    expect(document.activeElement).toBe(goal);
  });
});
