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

function runCommand(command: string) {
  const input = screen.getByPlaceholderText(/Enter logic command/i);
  fireEvent.change(input, { target: { value: command } });
  fireEvent.submit(input.closest("form") as HTMLFormElement);
}

describe("Proof terminal connect uses its parsed arguments (#1226)", () => {
  it("completes the default proof with connect C E and connect D E", () => {
    render(<ProofWorkspaceClient />);
    runCommand("connect C E");
    runCommand("connect D E");
    expect(
      screen.getByRole("button", { name: /^Node E, R, conclusion, proven/ })
    ).toBeTruthy();
  });

  it("does not depend on a prior canvas selection", () => {
    render(<ProofWorkspaceClient />);
    fireEvent.click(screen.getByRole("button", { name: /^Node A, / }));
    runCommand("connect C E");
    runCommand("connect D E");
    expect(
      screen.getByRole("button", { name: /^Node E, R, conclusion, proven/ })
    ).toBeTruthy();
  });

  it("reports the supplied pair for an invalid connection", () => {
    render(<ProofWorkspaceClient />);
    runCommand("connect A E");
    expect(
      screen.queryByRole("button", { name: /^Node E, R, conclusion, proven/ })
    ).toBeNull();
    expect(screen.getAllByText(/FALLACY DETECTED/).length).toBeGreaterThan(0);
  });
});
