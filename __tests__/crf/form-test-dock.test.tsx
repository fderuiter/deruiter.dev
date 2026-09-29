// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { FormTestDock } from "@/components/crf/Modes/FormTestDock";
import {
  DEFAULT_TEST_SCOPE,
  buildScopedKey,
  fillSampleValues,
  type ConditionalFieldValues,
  type CRFField,
  type CRFForm,
  type EditCheckRule,
} from "@/lib/crf";

/**
 * #541 — the dock's user-facing contract.
 *
 * The harness logic is covered in `form-test-harness.test.ts`. This suite
 * covers what an author actually touches: the visible control, the scoped
 * Fill sample and Reset actions, explained results on screen, and keyboard
 * and reduced-motion behaviour.
 */

function field(overrides: Partial<CRFField> & { id: string }): CRFField {
  return {
    variableName: overrides.id.toUpperCase(),
    label: overrides.id,
    dataType: "text",
    columnSpan: 6,
    required: false,
    ...overrides,
  } as CRFField;
}

const HIDE_RULE: EditCheckRule = {
  id: "rule_hide",
  name: "Hide detail for male subjects",
  description: "",
  triggerFieldIds: ["sex"],
  actionType: "hide_field",
  targetFieldId: "detail",
  conditions: [{ fieldId: "sex", operator: "eq", value: "M" }],
  logicalOperator: "AND",
};

const FORM: CRFForm = {
  id: "form_1",
  name: "Demographics",
  domain: "DM",
  description: "",
  version: "1.0",
  sections: [
    {
      id: "sec_1",
      title: "Subject",
      fields: [
        field({ id: "sex", variableName: "SEX", required: true }),
        field({ id: "detail", variableName: "DETAIL" }),
        field({
          id: "bmi",
          variableName: "BMI",
          dataType: "calculated",
          calculationFormula: "SEX / 2",
        }),
      ],
    },
  ],
  rules: [HIDE_RULE],
};

function renderDock(
  overrides: Partial<React.ComponentProps<typeof FormTestDock>> = {}
) {
  const onChangeValues = vi.fn();
  const onClose = vi.fn();
  const props = {
    isOpen: true,
    form: FORM,
    values: {} as ConditionalFieldValues,
    scope: DEFAULT_TEST_SCOPE,
    onChangeValues,
    onClose,
    ...overrides,
  };
  const utils = render(<FormTestDock {...props} />);
  return { ...utils, onChangeValues, onClose, props };
}

describe("[#541] Form test dock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Open and close", () => {
    it("renders nothing while closed", () => {
      const { container } = renderDock({ isOpen: false });
      expect(container.firstChild).toBeNull();
    });

    it("renders nothing when no form is active", () => {
      const { container } = renderDock({ form: null });
      expect(container.firstChild).toBeNull();
    });

    it("exposes a labelled region and a close control", () => {
      renderDock();

      expect(
        screen.getByRole("region", { name: /form test dock/i })
      ).toBeDefined();
      expect(
        screen.getByRole("button", { name: /close form test dock/i })
      ).toBeDefined();
    });

    it("closes through the visible control", () => {
      const { onClose } = renderDock();
      fireEvent.click(
        screen.getByRole("button", { name: /close form test dock/i })
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("moves focus to the dock on open so keyboard users land inside it", async () => {
      vi.useFakeTimers();
      try {
        renderDock();
        vi.advanceTimersByTime(100);
      } finally {
        vi.useRealTimers();
      }

      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: /close form test dock/i })
      );
    });

    it("marks itself as a keyboard boundary so studio shortcuts do not fire while typing", () => {
      renderDock();
      const region = screen.getByRole("region", { name: /form test dock/i });
      expect(region.hasAttribute("data-keyboard-boundary")).toBe(true);
    });

    it("gates its entrance animation behind motion-safe", () => {
      renderDock();
      const region = screen.getByRole("region", { name: /form test dock/i });
      expect(region.className).toContain("motion-safe:animate-in");
      // No unconditional animate-in, which would ignore reduced-motion.
      expect(region.className).not.toMatch(/(^|\s)animate-in/);
    });

    it("adapts to available space instead of forcing a fixed split", () => {
      renderDock();
      const region = screen.getByRole("region", { name: /form test dock/i });
      // Height is bounded by the viewport rather than pinned.
      expect(region.className).toContain("max-h-[60vh]");
      // The body stacks on narrow screens and splits only from lg up.
      const body = region.querySelector(".grid");
      expect(body?.className).toContain("grid-cols-1");
      expect(body?.className).toContain("lg:grid-cols-2");
    });
  });

  describe("Fill sample and Reset state their scope", () => {
    it("names the form, subject and visit the actions affect", () => {
      renderDock();
      const region = screen.getByRole("region", { name: /form test dock/i });

      expect(region.textContent).toContain("Fill sample and Reset affect only");
      expect(region.textContent).toContain("Demographics");
      expect(region.textContent).toContain(DEFAULT_TEST_SCOPE.subjectId);
      expect(region.textContent).toContain(DEFAULT_TEST_SCOPE.visitId);
      expect(region.textContent).toMatch(
        /Other subjects and visits are untouched/i
      );
    });

    it("fills only the active scope", () => {
      const other = { subjectId: "OTHER", visitId: "v2" };
      const seeded = { [`${other.subjectId}_${other.visitId}_sex`]: "kept" };
      const { onChangeValues } = renderDock({ values: seeded });

      fireEvent.click(screen.getByRole("button", { name: /fill sample/i }));

      const next = onChangeValues.mock.calls[0][0] as ConditionalFieldValues;
      expect(next[`${other.subjectId}_${other.visitId}_sex`]).toBe("kept");
      expect(next[buildScopedKey(DEFAULT_TEST_SCOPE, "sex")]).toBeDefined();
    });

    it("resets only the active scope", () => {
      const other = { subjectId: "OTHER", visitId: "v2" };
      const values: ConditionalFieldValues = {
        ...fillSampleValues(FORM, {}, DEFAULT_TEST_SCOPE),
        [`${other.subjectId}_${other.visitId}_sex`]: "kept",
      };
      const { onChangeValues } = renderDock({ values });

      fireEvent.click(screen.getByRole("button", { name: /reset/i }));

      const next = onChangeValues.mock.calls[0][0] as ConditionalFieldValues;
      expect(next[buildScopedKey(DEFAULT_TEST_SCOPE, "sex")]).toBeUndefined();
      expect(next[`${other.subjectId}_${other.visitId}_sex`]).toBe("kept");
    });

    it("writes an edited value into the active scope", () => {
      const { onChangeValues } = renderDock();

      const input = screen.getByTestId(
        buildScopedKey(DEFAULT_TEST_SCOPE, "sex")
      );
      fireEvent.change(input, { target: { value: "F" } });

      const next = onChangeValues.mock.calls[0][0] as ConditionalFieldValues;
      expect(next[buildScopedKey(DEFAULT_TEST_SCOPE, "sex")]).toBe("F");
    });
  });

  describe("Explained results", () => {
    it("reports a rule waiting on an input rather than calling it false", () => {
      renderDock();
      const region = screen.getByRole("region", { name: /form test dock/i });

      expect(region.textContent).toContain("Hide detail for male subjects");
      expect(region.textContent).toContain("Waiting on input");
      expect(region.textContent).toContain("waiting on input");
    });

    it("shows a rule as fired once its condition is decidably true", () => {
      renderDock({
        values: { [buildScopedKey(DEFAULT_TEST_SCOPE, "sex")]: "M" },
      });
      const region = screen.getByRole("region", { name: /form test dock/i });

      expect(region.textContent).toContain("Fired");
      expect(region.textContent).toContain("1 hidden");
    });

    it("omits a rule-hidden field from the inputs panel", () => {
      renderDock({
        values: { [buildScopedKey(DEFAULT_TEST_SCOPE, "sex")]: "M" },
      });

      expect(
        screen.queryByTestId(buildScopedKey(DEFAULT_TEST_SCOPE, "detail"))
      ).toBeNull();
    });

    it("counts a visible, required, empty field as unanswered", () => {
      renderDock();
      const region = screen.getByRole("region", { name: /form test dock/i });

      expect(region.textContent).toContain("1 required unanswered");
      expect(region.textContent).toContain("Required and unanswered");
      expect(region.textContent).toContain("SEX");
    });

    it("reports an all-clear once nothing is outstanding", () => {
      renderDock({
        values: { [buildScopedKey(DEFAULT_TEST_SCOPE, "sex")]: "F" },
      });
      const region = screen.getByRole("region", { name: /form test dock/i });

      expect(region.textContent).toContain("0 required unanswered");
      expect(region.textContent).toMatch(/No outstanding queries/i);
    });

    it("does not offer a calculated field as an input", () => {
      renderDock();
      expect(
        screen.queryByTestId(buildScopedKey(DEFAULT_TEST_SCOPE, "bmi"))
      ).toBeNull();
    });

    it("shows a calculation's status when its inputs are missing", () => {
      renderDock();
      const region = screen.getByRole("region", { name: /form test dock/i });

      expect(region.textContent).toContain("Calculations");
      expect(region.textContent).toMatch(/missing inputs/i);
    });
  });
});

/**
 * The dock is only reachable if the studio wires it up. These assertions cover
 * the two entry points #541 requires - a visible control and a safe shortcut -
 * at the integration seam rather than inside the dock itself.
 */
describe("[#541] Studio wiring", () => {
  const containerSource = readFileSync(
    resolve(__dirname, "../../components/crf/CRFStudioContainer.tsx"),
    "utf-8"
  );
  const headerSource = readFileSync(
    resolve(__dirname, "../../components/crf/StudioHeader.tsx"),
    "utf-8"
  );

  it("renders the dock from the studio container", () => {
    expect(containerSource).toContain("<FormTestDock");
    expect(containerSource).toContain("isOpen={isTestDockOpen}");
    expect(containerSource).toContain("form={activeForm || null}");
  });

  it("holds the synthetic record above the dock so it survives a close", () => {
    // Values in the container rather than the dock is what makes
    // edit -> test -> close -> reopen continuous.
    expect(containerSource).toContain(
      "const [testDockValues, setTestDockValues]"
    );
    expect(containerSource).toContain("values={testDockValues}");
  });

  it("binds a shortcut that no other studio binding claims", () => {
    expect(containerSource).toContain('e.key === "\\\\"');

    const bindings = containerSource.match(
      /e\.key(?:\.toLowerCase\(\))? === "([^"]+)"/g
    );
    const backslashBindings = (bindings || []).filter((b) =>
      b.includes('"\\\\"')
    );
    expect(backslashBindings).toHaveLength(1);
  });

  it("closes the dock on Escape alongside the other dismissables", () => {
    const escapeBlock = containerSource.slice(
      containerSource.indexOf('if (e.key === "Escape")'),
      containerSource.indexOf("if (isInput)")
    );
    expect(escapeBlock).toContain("setIsTestDockOpen(false)");
  });

  it("offers a visible toggle in the studio header", () => {
    expect(headerSource).toContain("onToggleTestDock");
    expect(headerSource).toContain("aria-pressed={isTestDockOpen}");
    expect(containerSource).toContain("onToggleTestDock={");
  });
});
