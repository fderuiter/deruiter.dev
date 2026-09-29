// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FieldPropertiesTab } from "@/components/crf/RightInspector/FieldPropertiesTab";
import { CRFField } from "@/lib/crf/types";
import { STANDARD_CODELISTS } from "@/lib/crf/cdisc-cdash-library";
import {
  A11yProvider,
  LiveAnnouncer,
} from "@/components/providers/A11yProvider";
import { ToastProvider } from "@/hooks/useToast";

describe("CRF Custom Question Options Builder Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  const dummyField: CRFField = {
    id: "f_test_custom",
    variableName: "CUST_Q",
    label: "Custom Clinical Decision Question",
    dataType: "radio",
    columnSpan: 6,
    required: true,
    customOptions: [
      { code: "OPT_A", label: "Option Alpha", order: 1 },
      { code: "OPT_B", label: "Option Beta", order: 2 },
    ],
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    if (container.parentNode) {
      document.body.removeChild(container);
    }
    vi.restoreAllMocks();
  });

  it("renders custom options list when field has custom options", async () => {
    const handleUpdate = vi.fn();
    await act(async () => {
      root.render(
        <FieldPropertiesTab
          field={dummyField}
          allFieldsInForm={[dummyField]}
          codelists={STANDARD_CODELISTS}
          onUpdateField={handleUpdate}
        />
      );
    });

    const inputValues = Array.from(container.querySelectorAll("input")).map(
      (i) => i.value
    );
    expect(inputValues).toContain("Option Alpha");
    expect(inputValues).toContain("Option Beta");
    expect(container.textContent).toContain("Add Option");
  });

  it("allows adding a new custom option row", async () => {
    const handleUpdate = vi.fn();
    await act(async () => {
      root.render(
        <FieldPropertiesTab
          field={dummyField}
          allFieldsInForm={[dummyField]}
          codelists={STANDARD_CODELISTS}
          onUpdateField={handleUpdate}
        />
      );
    });

    const addBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Add Option")
    );
    expect(addBtn).toBeDefined();

    await act(async () => {
      addBtn?.click();
    });

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        customOptions: expect.arrayContaining([
          expect.objectContaining({ code: "OPT_A" }),
          expect.objectContaining({ code: "OPT_B" }),
          expect.objectContaining({ code: "OPT_3", label: "Option 3" }),
        ]),
      })
    );
  });

  it("applies a Quick Template (e.g. Likert 5-Point)", async () => {
    const handleUpdate = vi.fn();
    await act(async () => {
      root.render(
        <FieldPropertiesTab
          field={dummyField}
          allFieldsInForm={[dummyField]}
          codelists={STANDARD_CODELISTS}
          onUpdateField={handleUpdate}
        />
      );
    });

    const likertBtn = Array.from(container.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Likert 5-Point")
    );
    expect(likertBtn).toBeDefined();

    await act(async () => {
      likertBtn?.click();
    });

    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        customOptions: expect.arrayContaining([
          expect.objectContaining({ code: "1", label: "Strongly Disagree" }),
          expect.objectContaining({ code: "5", label: "Strongly Agree" }),
        ]),
      })
    );
  });

  it("promotes custom options to study codelist on save", async () => {
    const handleUpdate = vi.fn();
    const handleSaveCodelist = vi.fn();

    await act(async () => {
      root.render(
        <FieldPropertiesTab
          field={dummyField}
          allFieldsInForm={[dummyField]}
          codelists={STANDARD_CODELISTS}
          onUpdateField={handleUpdate}
          onSaveToStudyCodelist={handleSaveCodelist}
        />
      );
    });

    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save to Study Codelists")
    );
    expect(saveBtn).toBeDefined();

    await act(async () => {
      saveBtn?.click();
    });

    expect(handleSaveCodelist).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.arrayContaining([
          expect.objectContaining({ code: "OPT_A", label: "Option Alpha" }),
        ]),
      })
    );
    expect(handleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        codelistId: expect.stringMatching(/^CL_/),
        customOptions: undefined,
      })
    );
  });

  it("confirms the codelist save through the global toast, announced once (#1134)", async () => {
    const announcer = new LiveAnnouncer({ expirationMs: 60_000 });
    const announceSpy = vi.spyOn(announcer, "announce");

    await act(async () => {
      root.render(
        <A11yProvider announcer={announcer}>
          <ToastProvider>
            <FieldPropertiesTab
              field={dummyField}
              allFieldsInForm={[dummyField]}
              codelists={STANDARD_CODELISTS}
              onUpdateField={vi.fn()}
              onSaveToStudyCodelist={vi.fn()}
            />
          </ToastProvider>
        </A11yProvider>
      );
    });

    const saveBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Save to Study Codelists")
    );
    await act(async () => {
      saveBtn?.click();
    });

    const toast = container.querySelector('[data-testid="toast"]');
    expect(toast?.getAttribute("data-variant")).toBe("success");
    expect(toast?.textContent).toContain(
      'Saved as study codelist "Custom Clinical Decision Question (2 Options)"!'
    );
    expect(announceSpy).toHaveBeenCalledTimes(1);
    expect(announceSpy).toHaveBeenCalledWith(
      'Saved as study codelist "Custom Clinical Decision Question (2 Options)"!',
      "polite"
    );
  });
});
