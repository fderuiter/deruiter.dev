// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React from "react";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AstStepDebugger } from "@/components/crf/Debugger/AstStepDebugger";
import { FormTestDock } from "@/components/crf/Modes/FormTestDock";
import { RuleGraphStudio } from "@/components/crf/Modes/RuleGraphStudio";
import { DEFAULT_TEST_SCOPE, buildScopedKey } from "@/lib/crf";
import type {
  CRFField,
  CRFForm,
  EditCheckRule,
  StudyProtocol,
} from "@/lib/crf/types";

function mockField(overrides: Partial<CRFField> & { id: string }): CRFField {
  return {
    variableName: overrides.id.toUpperCase(),
    label: overrides.id,
    dataType: "number",
    columnSpan: 6,
    required: false,
    ...overrides,
  } as CRFField;
}

const TEST_FIELDS: CRFField[] = [
  mockField({ id: "age", variableName: "AGE", dataType: "number" }),
  mockField({ id: "weight", variableName: "WEIGHT", dataType: "number" }),
  mockField({ id: "sysbp", variableName: "SYSBP", dataType: "number" }),
  mockField({ id: "sex", variableName: "SEX", dataType: "text" }),
];

const TEST_RULE: EditCheckRule = {
  id: "rule_vitals_check",
  name: "Hypertension query rule",
  description: "Raise query if SYSBP > 140 and AGE > 50",
  triggerFieldIds: ["sysbp", "age"],
  actionType: "raise_query",
  targetFieldId: "sysbp",
  logicalOperator: "AND",
  conditions: [
    { fieldId: "sysbp", operator: "gt", value: 140 },
    { fieldId: "age", operator: "gt", value: 50 },
  ],
  querySeverity: "warning",
  queryMessage: "Systolic blood pressure exceeds 140 mmHg in subject over 50.",
};

const TEST_FORM: CRFForm = {
  id: "form_vitals",
  name: "Vital Signs",
  domain: "VS",
  description: "",
  version: "1.0",
  sections: [
    {
      id: "sec_vs",
      title: "Vitals",
      fields: TEST_FIELDS,
    },
  ],
  rules: [TEST_RULE],
};

const TEST_STUDY: StudyProtocol = {
  id: "study_test",
  protocolNumber: "TEST-001",
  studyName: "Test Study",
  phase: "Phase III",
  sponsor: "Test Sponsor",
  therapeuticArea: "Cardiology",
  version: "1.0",
  lastModified: "2026-10-01",
  forms: [TEST_FORM],
  visits: [],
  codelists: [],
};

describe("AST Step Debugger UI Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders AstStepDebugger with stepper controls and active step detail", () => {
    render(
      <AstStepDebugger
        rule={TEST_RULE}
        fields={TEST_FIELDS}
        initialValues={{ sysbp: 150, age: 60 }}
      />
    );

    expect(
      screen.getByText(/AST Step Debugger: Hypertension query rule/i)
    ).toBeDefined();
    expect(
      screen.getAllByText(
        (_, el) => el?.textContent?.trim() === "Step 1 of 3"
      )[0]
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /Next/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Back/i })).toBeDefined();
    expect(
      screen.getAllByText((content) => content.includes("SYSBP (150) > 140"))[0]
    ).toBeDefined();
  });

  it("steps forward and backward through condition nodes", () => {
    render(
      <AstStepDebugger
        rule={TEST_RULE}
        fields={TEST_FIELDS}
        initialValues={{ sysbp: 150, age: 60 }}
      />
    );

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(
      screen.getAllByText(
        (_, el) => el?.textContent?.trim() === "Step 2 of 3"
      )[0]
    ).toBeDefined();
    expect(
      screen.getAllByText((content) => content.includes("AGE (60) > 50"))[0]
    ).toBeDefined();

    const backBtn = screen.getByRole("button", { name: /Back/i });
    fireEvent.click(backBtn);

    expect(
      screen.getAllByText(
        (_, el) => el?.textContent?.trim() === "Step 1 of 3"
      )[0]
    ).toBeDefined();
  });

  it("recalculates rule outcomes and step inspector instantaneously when changing input values", () => {
    render(
      <AstStepDebugger
        rule={TEST_RULE}
        fields={TEST_FIELDS}
        initialValues={{ sysbp: 120, age: 60 }}
      />
    );

    // Initial state: SYSBP is 120 (SYSBP > 140 is FALSE)
    expect(
      screen.getAllByText((content) => content.includes("SYSBP (120) > 140"))[0]
    ).toBeDefined();
    expect(screen.getByText(/Outcome: FALSE/i)).toBeDefined();

    // Override SYSBP to 160
    const sysbpInput = screen.getByDisplayValue("120");
    fireEvent.change(sysbpInput, { target: { value: "160" } });

    // Should update instantaneously
    expect(
      screen.getAllByText((content) => content.includes("SYSBP (160) > 140"))[0]
    ).toBeDefined();
    expect(screen.getByText(/Outcome: TRUE/i)).toBeDefined();
  });

  it("expands AST trace details inside FormTestDock", () => {
    render(
      <FormTestDock
        isOpen={true}
        form={TEST_FORM}
        values={{
          [buildScopedKey(DEFAULT_TEST_SCOPE, "sysbp")]: 150,
          [buildScopedKey(DEFAULT_TEST_SCOPE, "age")]: 60,
        }}
        scope={DEFAULT_TEST_SCOPE}
        onChangeValues={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/Hypertension query rule/i)).toBeDefined();

    // Click "AST Trace" button
    const traceBtn = screen.getByRole("button", {
      name: /Toggle AST trace for Hypertension query rule/i,
    });
    fireEvent.click(traceBtn);

    // Expanded debugger view should be rendered
    expect(screen.getByText(/Condition Execution Tree/i)).toBeDefined();
  });

  it("loads pre-populated sample subject data profiles in FormTestDock", () => {
    const onChangeValues = vi.fn();
    render(
      <FormTestDock
        isOpen={true}
        form={TEST_FORM}
        values={{}}
        scope={DEFAULT_TEST_SCOPE}
        onChangeValues={onChangeValues}
        onClose={vi.fn()}
      />
    );

    const devProfileBtn = screen.getByRole("button", {
      name: /Protocol Deviation/i,
    });
    fireEvent.click(devProfileBtn);

    expect(onChangeValues).toHaveBeenCalled();
  });

  it("renders AST Step Debugger in RuleGraphStudio when rule is selected", () => {
    render(<RuleGraphStudio study={TEST_STUDY} />);

    expect(
      screen.getByText(/Logic Dependency DAG & AST Rule Studio/i)
    ).toBeDefined();
    expect(
      screen.getByText(/AST Step Debugger: Hypertension query rule/i)
    ).toBeDefined();
  });
});
