// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LogicRulesTab } from "@/components/crf/RightInspector/LogicRulesTab";
import { CRFForm, EditCheckRule } from "@/lib/crf/types";
import { evaluateRuleResult, explainRule } from "@/lib/crf";

// #540: demonstrates the "edit -> test values -> explained result -> native
// reopen with equivalent meaning" journey the acceptance criteria asks for,
// driving the REAL authoring component (no mocked internals).
describe("LogicRulesTab - explainable discrepancy checks (#540)", () => {
  afterEach(() => {
    cleanup();
  });

  const baseForm: CRFForm = {
    id: "form1",
    name: "Vitals",
    domain: "VS",
    description: "",
    version: "1.0",
    sections: [
      {
        id: "sec1",
        title: "Vitals",
        fields: [
          {
            id: "f_sysbp",
            variableName: "SYSBP",
            label: "Systolic BP",
            dataType: "integer",
            columnSpan: 6,
            required: true,
          },
          {
            id: "f_diabp",
            variableName: "DIABP",
            label: "Diastolic BP",
            dataType: "integer",
            columnSpan: 6,
            required: true,
          },
        ],
      },
    ],
    rules: [],
  };

  function Harness({
    onRulesChange,
  }: {
    onRulesChange?: (rules: EditCheckRule[]) => void;
  }) {
    const [form, setForm] = useState<CRFForm>(baseForm);
    return (
      <LogicRulesTab
        form={form}
        selectedField={null}
        onUpdateRules={(rules) => {
          setForm((f) => ({ ...f, rules }));
          onRulesChange?.(rules);
        }}
      />
    );
  }

  it("authors a field/field discrepancy check and shows the explained result for test values", () => {
    let latestRules: EditCheckRule[] = [];
    render(<Harness onRulesChange={(rules) => (latestRules = rules)} />);

    // Add Rule opens the editor immediately (no separate Configure click needed).
    fireEvent.click(screen.getByRole("button", { name: /add rule/i }));
    expect(screen.getByRole("button", { name: /^close$/i })).toBeTruthy();

    // Point the default condition's subject at DIABP so that switching its
    // comparison to "Field" (which defaults to the first field, SYSBP)
    // compares two DISTINCT fields rather than a field against itself.
    const comboboxes = screen.getAllByRole("combobox");
    const conditionFieldSelect = comboboxes[2]; // [Action Type, Target Field, Condition Field, Operator, ...]
    fireEvent.change(conditionFieldSelect, { target: { value: "f_diabp" } });
    expect(latestRules[0].conditions[0].fieldId).toBe("f_diabp");

    const compareModeSelect = screen.getByTitle(
      /compare against a literal value or another field/i
    );
    fireEvent.change(compareModeSelect, { target: { value: "field" } });
    expect(latestRules[0].conditions[0].compareFieldId).toBe("f_sysbp");

    // Enter sample test values for both distinct fields and confirm the
    // live explanation reflects them.
    const testValueInputs = screen.getAllByPlaceholderText("test value");
    expect(testValueInputs).toHaveLength(2);
    fireEvent.change(testValueInputs[0], { target: { value: "150" } });
    fireEvent.change(testValueInputs[1], { target: { value: "90" } });

    expect(
      screen.getAllByText(/→\s*(TRUE|FALSE|MISSING|INCOMPATIBLE)/).length
    ).toBeGreaterThan(0);
  });

  it("supports adding a second AND/OR group and combining groups explicitly", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: /add rule/i }));
    expect(screen.queryByRole("button", { name: /groups:/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /^\+ group$/i }));

    expect(screen.getByText(/group 1:/i)).toBeTruthy();
    expect(screen.getByText(/group 2:/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /groups: and/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /groups: and/i }));
    expect(screen.getByRole("button", { name: /groups: or/i })).toBeTruthy();
  });

  it("round-trips an authored rule through JSON with equivalent evaluation meaning (native reopen)", () => {
    let latestRules: EditCheckRule[] = [];
    render(<Harness onRulesChange={(rules) => (latestRules = rules)} />);

    fireEvent.click(screen.getByRole("button", { name: /add rule/i }));

    const compareModeSelect = screen.getByTitle(
      /compare against a literal value or another field/i
    );
    fireEvent.change(compareModeSelect, { target: { value: "field" } });

    const authoredRule = latestRules[0];
    const reopened: EditCheckRule = JSON.parse(JSON.stringify(authoredRule));

    const fields = baseForm.sections[0].fields;
    const values = { f_sysbp: 150, f_diabp: 90 };
    expect(evaluateRuleResult(reopened, values, fields)).toBe(
      evaluateRuleResult(authoredRule, values, fields)
    );
    expect(explainRule(reopened, values, fields).summary).toBe(
      explainRule(authoredRule, values, fields).summary
    );
  });
});
