// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LiveEdcSimulator } from "@/components/crf/Modes/LiveEdcSimulator";
import { ONCOLOGY_RECIST_PRESET } from "@/lib/crf/presets";
import type { StudyProtocol, CRFField } from "@/lib/crf/types";

/**
 * Reproduction for #1200: the Live EDC saved AGE=300 on a field authored
 * with `minValue: 18, maxValue: 120`. A range violation must follow the
 * field's requirement tier, exactly as a missing value does: Hard Stop
 * blocks the save, Auto-Query saves and raises a discrepancy query.
 */

function numberField(
  id: string,
  label: string,
  min: number,
  max: number,
  tier: CRFField["requirementTier"]
): CRFField {
  return {
    id,
    variableName: id.toUpperCase(),
    label,
    dataType: "integer",
    columnSpan: 6,
    required: false,
    minValue: min,
    maxValue: max,
    requirementTier: tier,
  } as CRFField;
}

function buildRangeStudy(): StudyProtocol {
  return {
    ...ONCOLOGY_RECIST_PRESET,
    forms: [
      {
        id: "form_range",
        name: "Range Form",
        domain: "DM",
        description: "",
        version: "1.0",
        sections: [
          {
            id: "sec_1",
            title: "Ranges",
            fields: [
              numberField("age", "Age", 18, 120, "hard_stop"),
              numberField("weight", "Weight", 30, 200, "auto_query"),
            ],
          },
        ],
        rules: [],
      },
    ],
  } as StudyProtocol;
}

describe("[#1200] Live EDC enforces minValue / maxValue on save", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container.remove();
  });

  async function setValue(selector: string, value: string) {
    const input = container.querySelector(selector) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value"
      )?.set?.call(input, value);
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  async function save() {
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      /save form/i.test(b.textContent || "")
    );
    expect(button).toBeDefined();
    await act(async () => {
      button?.click();
    });
  }

  async function render() {
    await act(async () => {
      root.render(<LiveEdcSimulator study={buildRangeStudy()} />);
    });
  }

  it("puts min and max on the numeric inputs", async () => {
    await render();
    const age = container.querySelector(
      "#ecrf-input-dm-age"
    ) as HTMLInputElement;
    expect(age.getAttribute("min")).toBe("18");
    expect(age.getAttribute("max")).toBe("120");
  });

  it("blocks the save when a Hard Stop field is out of range", async () => {
    await render();
    await setValue("#ecrf-input-dm-age", "300");
    await setValue("#ecrf-input-dm-weight", "70");
    await save();

    expect(container.textContent).not.toMatch(/form saved successfully/i);
    expect(container.textContent).toMatch(/submission blocked/i);
    expect(container.textContent).toMatch(/AGE.*between 18 and 120/);
    const age = container.querySelector("#ecrf-input-dm-age");
    expect(age?.getAttribute("aria-invalid")).toBe("true");
  });

  it("saves and raises a query when an Auto-Query field is out of range", async () => {
    await render();
    await setValue("#ecrf-input-dm-age", "40");
    await setValue("#ecrf-input-dm-weight", "500");
    await save();

    expect(container.textContent).toMatch(/form saved successfully/i);
    expect(container.textContent).toMatch(/1 auto-query ticket/i);
  });

  it("saves in-range values without a query", async () => {
    await render();
    await setValue("#ecrf-input-dm-age", "40");
    await setValue("#ecrf-input-dm-weight", "70");
    await save();

    expect(container.textContent).toMatch(/form saved successfully/i);
    expect(container.textContent).not.toMatch(/auto-query ticket/i);
  });
});
