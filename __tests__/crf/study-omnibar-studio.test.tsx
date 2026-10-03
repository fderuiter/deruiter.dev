/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * End-to-end journey of the Study Omnibar (#544) inside CRFStudioContainer:
 * navigation that names its owning form/visit, verified starter insertion
 * through the slash palette's own handler, the export entry, and F-shortcut
 * isolation. Lazily loaded panels are stubbed as in crf-studio.test.tsx;
 * only the export document dialog's presence is asserted.
 */
vi.mock("next/dynamic", () => ({
  default: (loader: any) => {
    const loaderStr = loader.toString();
    return function DynamicComponent() {
      if (loaderStr.includes("ExportDocumentModal")) {
        return <div data-testid="export-document-stub">Export documents</div>;
      }
      if (loaderStr.includes("ExportImportModal")) {
        return <div>CDISC Standards &amp; Interoperability Exporter</div>;
      }
      if (loaderStr.includes("VisitMatrixEditor")) {
        return <div>Protocol Visit Schedule Matrix</div>;
      }
      return null;
    };
  },
}));

import { CRFStudioContainer } from "@/components/crf/CRFStudioContainer";

function hashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

describe("Study Omnibar in CRF Studio (#544)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    window.history.replaceState(null, "", window.location.pathname);
    window.localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: "ok", data: {} }),
    } as any);
    container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      root = createRoot(container);
      root.render(<CRFStudioContainer />);
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  const omnibar = () =>
    container.querySelector(
      '[data-testid="study-omnibar"]'
    ) as HTMLElement | null;

  async function openFromHeader() {
    const trigger = container.querySelector(
      'button[aria-label="Find in study"]'
    ) as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    await act(async () => {
      trigger.focus();
      trigger.click();
    });
    expect(omnibar()).toBeTruthy();
  }

  async function search(text: string) {
    const input = omnibar()!.querySelector(
      '[role="combobox"]'
    ) as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )!.set!;
    await act(async () => {
      setter.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    return input;
  }

  async function press(
    target: Element,
    key: string,
    init: KeyboardEventInit = {}
  ) {
    await act(async () => {
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          bubbles: true,
          cancelable: true,
          ...init,
        })
      );
    });
  }

  it(
    "navigates to a field in another form, naming its owner, and keeps the studio state",
    { timeout: 60000 },
    async () => {
      await openFromHeader();
      const input = await search("weight");
      const first = omnibar()!.querySelector('[role="option"]') as HTMLElement;
      expect(first.textContent).toContain("Weight");
      expect(first.textContent).toContain(
        "Vital Signs & Physical Metrics (VS)"
      );

      await press(input, "Enter");
      expect(omnibar()).toBeNull();
      expect(hashParams().get("form")).toBe("form_vs_onc");
      expect(hashParams().get("field")).toBe("f_weight");
      expect(
        container.querySelector('[data-field-id="f_weight"]')
      ).toBeTruthy();
    }
  );

  it(
    "navigates to a visit in the study spine",
    { timeout: 60000 },
    async () => {
      await openFromHeader();
      const input = await search("cycle 2");
      const first = omnibar()!.querySelector('[role="option"]') as HTMLElement;
      expect(first.getAttribute("data-category")).toBe("visit");
      await press(input, "Enter");
      expect(hashParams().get("visit")).toBe("v_c2d1");
    }
  );

  it(
    "inserts a verified starter block with the same operation as the slash palette",
    { timeout: 60000 },
    async () => {
      const before = container.querySelectorAll("[data-field-id]").length;
      await openFromHeader();
      const input = await search("/vitals");
      const first = omnibar()!.querySelector('[role="option"]') as HTMLElement;
      expect(first.getAttribute("data-category")).toBe("insert");
      expect(first.textContent).toContain(
        "Insert into Demographics & Informed Consent (DM)"
      );
      await press(input, "Enter");

      const after = container.querySelectorAll("[data-field-id]").length;
      expect(after).toBeGreaterThan(before);
      // The inserted block's first field becomes the selection, as it does
      // when the block is chosen from the slash palette.
      const selected = hashParams().get("field");
      expect(selected).toBeTruthy();
      expect(
        container.querySelector(`[data-field-id="${selected}"]`)
      ).toBeTruthy();

      // And it is one undoable change.
      const undo = container.querySelector(
        'button[aria-label="Undo"]'
      ) as HTMLButtonElement;
      await act(async () => {
        undo.click();
      });
      expect(container.querySelectorAll("[data-field-id]").length).toBe(before);
    }
  );

  it("opens the Word/PDF export entry", { timeout: 60000 }, async () => {
    await openFromHeader();
    const input = await search("export word");
    await press(input, "Enter");
    expect(
      container.querySelector('[data-testid="export-document-stub"]')
    ).toBeTruthy();
  });

  it(
    "opens the export workspace from the export category",
    { timeout: 60000 },
    async () => {
      await openFromHeader();
      const input = await search("export workspace");
      await press(input, "Enter");
      expect(hashParams().get("mode")).toBe("export");
      expect(container.textContent).toContain(
        "CDISC Standards & Interoperability Exporter"
      );
    }
  );

  it(
    "opens with F from studio controls but never from text editors or other dialogs",
    { timeout: 60000 },
    async () => {
      const textInputs = Array.from(
        container.querySelectorAll<HTMLElement>(
          "input[type=text], input:not([type]), textarea"
        )
      );
      expect(textInputs.length).toBeGreaterThan(0);
      for (const el of textInputs.slice(0, 3)) {
        await press(el, "f");
      }
      expect(omnibar()).toBeNull();

      // Inside the slash palette dialog, F is just a character.
      const slashTrigger = container.querySelector(
        'button[aria-label="Slash Commands"]'
      ) as HTMLButtonElement;
      await act(async () => {
        slashTrigger.click();
      });
      const slashDialog = container.querySelector(
        '[aria-labelledby="slash-palette-title"]'
      ) as HTMLElement;
      expect(slashDialog).toBeTruthy();
      await press(slashDialog.querySelector("button")!, "f");
      expect(omnibar()).toBeNull();
      await press(slashDialog.querySelector("input")!, "Escape");

      const undo = container.querySelector(
        'button[aria-label="Undo"]'
      ) as HTMLButtonElement;
      await press(undo, "f");
      expect(omnibar()).toBeTruthy();
    }
  );
});
