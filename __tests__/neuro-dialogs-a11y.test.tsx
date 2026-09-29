import React, { act } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot, Root } from "react-dom/client";
import { NeuroFieldManual } from "@/components/neuro/NeuroFieldManual";
import { NeuroSuccessDialog } from "@/components/neuro/NeuroSuccessDialog";

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 80));
  });

const waitForDialogGone = async () => {
  for (let i = 0; i < 30; i++) {
    if (!document.body.querySelector('[role="dialog"]')) return;
    await flush();
  }
};

describe("NeuroRecon dialogs: accessibility (#1223)", () => {
  let container: HTMLDivElement;
  let root: Root;
  let trigger: HTMLButtonElement;

  beforeEach(() => {
    trigger = document.createElement("button");
    trigger.textContent = "Field Manual";
    document.body.appendChild(trigger);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    trigger.remove();
    vi.restoreAllMocks();
  });

  function ManualHarness() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button data-testid="open" onClick={() => setOpen(true)}>
          open
        </button>
        <NeuroFieldManual isOpen={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  it("Field Manual exposes dialog semantics, moves focus in, closes on Escape and restores focus", async () => {
    await act(async () => root.render(<ManualHarness />));
    const opener = container.querySelector<HTMLButtonElement>(
      '[data-testid="open"]'
    )!;
    opener.focus();
    await act(async () => opener.click());
    await flush();

    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const labelId = dialog.getAttribute("aria-labelledby")!;
    expect(document.getElementById(labelId)?.textContent).toContain(
      "Field Manual"
    );
    expect(
      document.getElementById(dialog.getAttribute("aria-describedby")!)
    ).not.toBeNull();
    expect(dialog.contains(document.activeElement)).toBe(true);

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    await waitForDialogGone();
    await flush();
    expect(document.activeElement).toBe(opener);
  });

  it("Field Manual traps Tab focus inside the dialog", async () => {
    await act(async () =>
      root.render(<NeuroFieldManual isOpen onClose={() => {}} />)
    );
    await flush();
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
    const buttons = dialog.querySelectorAll("button");
    const last = buttons[buttons.length - 1];
    last.focus();
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true })
      );
    });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("success dialog is a named dialog, focuses its primary action and Escape stays in case", async () => {
    const onStay = vi.fn();
    await act(async () =>
      root.render(
        <NeuroSuccessDialog
          isOpen
          message="Surface repaired."
          eulerCharacteristic={2}
          diceScore={0.95}
          reward={500}
          onStay={onStay}
          onAdvance={() => {}}
          onSchedule={() => {}}
        />
      )
    );
    await flush();
    const dialog = document.body.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(
      document.getElementById(dialog.getAttribute("aria-labelledby")!)
        ?.textContent
    ).toBe("Scenario Target Reached");
    expect(
      document.getElementById(dialog.getAttribute("aria-describedby")!)
        ?.textContent
    ).toBe("Surface repaired.");
    expect(document.activeElement?.textContent).toContain("Advance Next Case");

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      );
    });
    expect(onStay).toHaveBeenCalledTimes(1);
  });
});
