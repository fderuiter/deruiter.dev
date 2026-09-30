// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ProofWorkspaceClient } from "@/app/proof/ProofWorkspaceClient";

/**
 * Issue #1616: the Proof terminal input must not trap keyboard focus.
 * Tab completes only while a suggestion is showing; otherwise Tab and
 * Shift+Tab move focus normally, and Escape leaves the input.
 */

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

function getInput(): HTMLInputElement {
  return screen.getByPlaceholderText(/Enter logic command/i);
}

describe("Proof terminal keyboard focus (#1616)", () => {
  it("lets Tab move focus on when no suggestion is showing", () => {
    render(<ProofWorkspaceClient />);
    const input = getInput();
    input.focus();
    // fireEvent returns false when the handler called preventDefault.
    expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(true);
    expect(input.value).toBe("");
  });

  it("never completes or blocks Shift+Tab, even with a suggestion", () => {
    render(<ProofWorkspaceClient />);
    const input = getInput();
    input.focus();
    expect(fireEvent.keyDown(input, { key: "Tab", shiftKey: true })).toBe(true);

    fireEvent.change(input, { target: { value: "conn" } });
    expect(fireEvent.keyDown(input, { key: "Tab", shiftKey: true })).toBe(true);
    expect(input.value).toBe("conn");
  });

  it("completes the suggestion on Tab and keeps focus in the input", () => {
    render(<ProofWorkspaceClient />);
    const input = getInput();
    input.focus();
    fireEvent.change(input, { target: { value: "conn" } });
    expect(fireEvent.keyDown(input, { key: "Tab" })).toBe(false);
    expect(input.value).toBe("connect");
  });

  it("does not take over Ctrl+Tab or Alt+Tab", () => {
    render(<ProofWorkspaceClient />);
    const input = getInput();
    fireEvent.change(input, { target: { value: "conn" } });
    expect(fireEvent.keyDown(input, { key: "Tab", ctrlKey: true })).toBe(true);
    expect(fireEvent.keyDown(input, { key: "Tab", altKey: true })).toBe(true);
    expect(input.value).toBe("conn");
  });

  it("shows a Tab hint tied to the input only while a suggestion shows", () => {
    render(<ProofWorkspaceClient />);
    const input = getInput();
    expect(screen.queryByText(/to complete/i)).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();

    fireEvent.change(input, { target: { value: "conn" } });
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const hint = document.getElementById(describedBy as string);
    expect(hint?.textContent).toMatch(/Tab to complete/i);
    expect(hint?.textContent).toContain("connect");

    fireEvent.keyDown(input, { key: "Tab" });
    expect(screen.queryByText(/to complete/i)).toBeNull();
    expect(input.getAttribute("aria-describedby")).toBeNull();
  });

  it("leaves the input on Escape and lands on the console toggle", () => {
    render(<ProofWorkspaceClient />);
    const input = getInput();
    input.focus();
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.activeElement).not.toBe(input);
    expect(document.activeElement?.textContent).toBe("Collapse");
  });
});
