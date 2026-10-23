import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { ProofWorkspaceClient } from "@/app/proof/ProofWorkspaceClient";

/**
 * The page wiring around the Proof Studio hooks (#2530): custom theorems,
 * theorem switching, simulations and the reset control. The hooks have
 * their own unit tests; these check that the page connects them.
 */

const workers: { postMessage: ReturnType<typeof vi.fn> }[] = [];

beforeEach(() => {
  window.history.replaceState(null, "", "/proof");
  workers.length = 0;
  vi.stubGlobal(
    "Worker",
    class {
      postMessage = vi.fn();
      terminate = vi.fn();
      onmessage = null;
      constructor() {
        workers.push(this);
      }
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

const hashParams = () => new URLSearchParams(window.location.hash.slice(1));
const provenConclusion = () =>
  screen.queryByRole("button", { name: /^Node E, PROVEN, R, .*, conclusion,/ });
const postedTypes = () =>
  workers.flatMap((w) => w.postMessage.mock.calls.map((c) => c[0].type));

describe("Proof Studio custom theorems", () => {
  it("shows an inline error for an invalid formula and keeps the current theorem", () => {
    render(<ProofWorkspaceClient />);
    fireEvent.click(screen.getByRole("button", { name: /^Custom Studio$/ }));
    fireEvent.change(screen.getByLabelText(/Target Invariant Goal/), {
      target: { value: "P -> " },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Load into Workspace" })
    );

    expect(screen.getByRole("alert").textContent).not.toBe("");
    expect(hashParams().get("theorem")).toBeNull();
    expect(
      screen.getByRole("button", { name: /^Node A, \w+, P, / })
    ).toBeTruthy();
  });

  it("loads valid formulas into the workspace and the share link", () => {
    render(<ProofWorkspaceClient />);
    fireEvent.click(screen.getByRole("button", { name: /^Custom Studio$/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Load into Workspace" })
    );

    expect(
      screen.queryByRole("button", { name: "Load into Workspace" })
    ).toBeNull();
    expect(hashParams().get("theorem")).toBe("custom");
    expect(JSON.parse(hashParams().get("custom")!)).toEqual([
      "P",
      "P -> Q",
      "Q -> R",
      "R",
    ]);
    expect(postedTypes()).toContain("ABORT");
  });

  it("opens the studio for a custom link without formulas and refuses to simulate it", () => {
    window.history.replaceState(null, "", "/proof#theorem=custom");
    render(<ProofWorkspaceClient />);
    expect(
      screen.getByRole("button", { name: "Load into Workspace" })
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Close Custom Studio Modal" })
    );
    runCommand("simulate");
    expect(screen.getByText(/Custom simulation unavailable/)).toBeTruthy();
    expect(postedTypes()).not.toContain("START_SIMULATION");
  });

  it("asks for formulas when switching to custom before any were loaded", () => {
    render(<ProofWorkspaceClient />);
    runCommand("theorem custom");
    expect(
      screen.getByRole("button", { name: "Load into Workspace" })
    ).toBeTruthy();
    expect(hashParams().get("theorem")).toBeNull();
  });
});

describe("Proof Studio theorem switching", () => {
  it("switches from the terminal, resets the graph and logs the new goal", () => {
    render(<ProofWorkspaceClient />);
    runCommand("connect C E");
    runCommand("theorem mt");
    expect(hashParams().get("theorem")).toBe("modus-tollens");
    expect(screen.getByText(/Switched active theorem to \[/)).toBeTruthy();
    expect(postedTypes()).toContain("ABORT");
  });

  it("does nothing when asked for the theorem already showing", () => {
    render(<ProofWorkspaceClient />);
    runCommand("theorem mp");
    expect(screen.queryByText(/Switched active theorem to/)).toBeNull();
  });

  it("follows the hash on Back to another theorem", () => {
    render(<ProofWorkspaceClient />);
    runCommand("connect C E");
    runCommand("connect D E");
    expect(provenConclusion()).toBeTruthy();
    act(() => {
      window.history.pushState(null, "", "/proof#theorem=modus-tollens");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    act(() => {
      window.history.pushState(null, "", "/proof");
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(provenConclusion()).toBeNull();
  });
});

describe("Proof Studio simulation and export", () => {
  it("starts one simulation at a time with the active theorem", () => {
    render(<ProofWorkspaceClient />);
    runCommand("simulate loop");
    const starts = workers
      .flatMap((w) => w.postMessage.mock.calls.map((c) => c[0]))
      .filter((m) => m.type === "START_SIMULATION");
    expect(starts).toEqual([
      expect.objectContaining({ mode: "loop", theoremId: "modus-ponens" }),
    ]);
    expect(screen.getByText(/Starting Proof Graph Simulation/)).toBeTruthy();
    runCommand("simulate");
    expect(postedTypes().filter((t) => t === "START_SIMULATION")).toHaveLength(
      1
    );
  });

  it("opens the export dialog for export with no format", () => {
    render(<ProofWorkspaceClient />);
    runCommand("export");
    expect(
      screen.getByRole("button", { name: "Close Export Modal" })
    ).toBeTruthy();
  });
});

describe("Proof Studio canvas controls", () => {
  it("resets the graph to the given edges", () => {
    render(<ProofWorkspaceClient />);
    runCommand("connect C E");
    runCommand("connect D E");
    expect(provenConclusion()).toBeTruthy();
    fireEvent.click(screen.getByTitle("Reset node positions & connections"));
    expect(provenConclusion()).toBeNull();
  });

  it("toggles magnetic snapping from its button", () => {
    render(<ProofWorkspaceClient />);
    const toggle = screen.getByRole("button", { name: /Magnetic Snapping:/ });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(toggle);
    expect(
      screen
        .getByRole("button", { name: /Magnetic Snapping:/ })
        .getAttribute("aria-pressed")
    ).toBe("false");
  });

  it("Escape in the terminal moves focus to the console toggle", () => {
    render(<ProofWorkspaceClient />);
    const input = screen.getByPlaceholderText(/Enter logic command/i);
    input.focus();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.activeElement).not.toBe(input);
    expect(document.activeElement?.tagName).toBe("BUTTON");
  });
});
