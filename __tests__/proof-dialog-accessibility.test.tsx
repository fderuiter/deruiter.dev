import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ProofCustomModal } from "@/components/proof/ProofCustomModal";
import { ProofExportModal } from "@/components/proof/ProofExportModal";
import * as downloadModule from "@/lib/download";

afterEach(cleanup);

function ExportHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open export</button>
      <ProofExportModal
        isOpen={open}
        onClose={() => setOpen(false)}
        activeTheoremId="modus-ponens"
        edges={[]}
      />
      <button>Background action</button>
    </>
  );
}

function CustomHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open custom studio</button>
      <ProofCustomModal
        isOpen={open}
        onClose={() => setOpen(false)}
        customPremise1="P"
        customPremise2="P → Q"
        customPremise3="Q → R"
        customGoal="R"
        setCustomPremise1={() => {}}
        setCustomPremise2={() => {}}
        setCustomPremise3={() => {}}
        setCustomGoal={() => {}}
        onLoadIntoWorkspace={() => setOpen(false)}
      />
      <button>Background action</button>
    </>
  );
}

describe("Proof dialogs", () => {
  it("names the export dialog, contains keyboard focus and returns it after Escape", async () => {
    render(<ExportHarness />);
    const trigger = screen.getByRole("button", { name: "Open export" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", {
      name: "Export Workspace State",
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    await waitFor(() => expect(document.activeElement).toBe(buttons[0]));
    const output = screen.getByRole("region", { name: "Proof export" });
    output.focus();
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(buttons[0]);
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(output);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("triggers file download when Download File is clicked in export modal", async () => {
    const downloadSpy = vi
      .spyOn(downloadModule, "downloadFile")
      .mockReturnValue(true);
    render(<ExportHarness />);
    const trigger = screen.getByRole("button", { name: "Open export" });
    fireEvent.click(trigger);

    // Switch to Markdown format where download is available even when incomplete
    const mdButton = screen.getByRole("button", { name: /markdown/i });
    fireEvent.click(mdButton);

    const downloadButton = screen.getByRole("button", {
      name: /Download File/i,
    });
    expect(downloadButton).toBeTruthy();
    fireEvent.click(downloadButton);

    expect(downloadSpy).toHaveBeenCalledWith(
      expect.stringContaining("# Proof Workspace Export: Modus Ponens"),
      "proof-modus-ponens.md",
      { mimeType: "text/markdown;charset=utf-8" }
    );
  });

  it("labels the custom formula fields and restores focus after closing", async () => {
    render(<CustomHarness />);
    const trigger = screen.getByRole("button", { name: "Open custom studio" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", {
      name: "Custom Invariant Studio",
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    for (const label of [
      "Premise 1 Formula:",
      "Premise 2 Formula:",
      "Premise 3 Formula:",
      "Target Invariant Goal:",
    ]) {
      expect(screen.getByLabelText(label).tagName).toBe("INPUT");
    }
    const close = screen.getByRole("button", {
      name: "Close Custom Studio Modal",
    });
    const load = screen.getByRole("button", { name: "Load into Workspace" });
    await waitFor(() => expect(document.activeElement).toBe(close));
    close.focus();
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(load);
    fireEvent.keyDown(load, { key: "Tab" });
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
