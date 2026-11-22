/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { FieldRenderer } from "@/components/crf/CenterCanvas/FieldRenderer";
import type { CRFField } from "@/lib/crf/types";

const mockField: CRFField = {
  id: "field-1",
  variableName: "AGE",
  label: "Subject Age",
  dataType: "number",
  columnSpan: 6,
  required: false,
} as CRFField;

// Regression coverage for #659: the field card's own keydown handler (Enter/Space
// selects the field) is attached to the card container, so keydown events bubbling
// up from a focused child action button (the requirement-tier badge, move/duplicate/
// delete, etc.) were also re-triggering onSelect() alongside that child's own action.
describe("FieldRenderer keyboard activation boundary (#659)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does not call onSelect when Enter is pressed on a child action button", async () => {
    const onSelect = vi.fn();
    const onUpdateField = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <FieldRenderer
          field={mockField}
          isSelected={false}
          onSelect={onSelect}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          onUpdateField={onUpdateField}
          codelists={[]}
        />
      );
    });

    const tierButton = Array.from(container.querySelectorAll("button")).find(
      (b) => b.dataset.tooltip?.startsWith("Requirement Tier:")
    ) as HTMLButtonElement;
    expect(tierButton).toBeTruthy();

    tierButton.focus();
    await act(async () => {
      tierButton.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("still calls onSelect when Enter is pressed on the card itself", async () => {
    const onSelect = vi.fn();

    await act(async () => {
      root = createRoot(container);
      root.render(
        <FieldRenderer
          field={mockField}
          isSelected={false}
          onSelect={onSelect}
          onDuplicate={vi.fn()}
          onDelete={vi.fn()}
          codelists={[]}
        />
      );
    });

    const card = container.querySelector("[data-field-id]") as HTMLElement;
    expect(card).toBeTruthy();

    card.focus();
    await act(async () => {
      card.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
      );
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
