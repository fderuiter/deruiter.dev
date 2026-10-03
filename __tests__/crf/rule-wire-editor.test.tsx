// @vitest-environment jsdom
import React, { useState } from "react";
import {
  describe,
  it,
  expect,
  afterEach,
  beforeAll,
  afterAll,
  vi,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
  act,
} from "@testing-library/react";
import { fromAny } from "@total-typescript/shoehorn";
import { LogicRulesTab } from "@/components/crf/RightInspector/LogicRulesTab";
import type { CRFField, CRFForm, EditCheckRule } from "@/lib/crf/types";
import { buildRuleWireGraph, describeRuleLogic } from "@/lib/crf/rule-wires";

// #674: drives the real Logic tab, switching between the sentence view and
// the optional visual-wire view over one shared set of synthetic rules.

type ROCallback = (
  entries: Array<{
    target: Element;
    contentRect: { width: number; height: number };
  }>
) => void;
const observers: Array<{ cb: ROCallback; target: Element | null }> = [];
const OriginalResizeObserver = globalThis.ResizeObserver;

class CapturingResizeObserver {
  private record: { cb: ROCallback; target: Element | null };
  constructor(cb: ROCallback) {
    this.record = { cb, target: null };
    observers.push(this.record);
  }
  observe(target: Element) {
    this.record.target = target;
  }
  unobserve() {}
  disconnect() {
    const i = observers.indexOf(this.record);
    if (i >= 0) observers.splice(i, 1);
  }
}

function fireResize(width: number) {
  observers.forEach(({ cb, target }) => {
    if (target) cb([{ target, contentRect: { width, height: 400 } }]);
  });
}

beforeAll(() => {
  globalThis.ResizeObserver = fromAny<
    typeof ResizeObserver,
    typeof CapturingResizeObserver
  >(CapturingResizeObserver);
});
afterAll(() => {
  globalThis.ResizeObserver = OriginalResizeObserver;
});

const fields: CRFField[] = [
  {
    id: "f_sys",
    variableName: "SYSBP",
    label: "Systolic BP",
    dataType: "integer",
    columnSpan: 6,
    required: false,
  },
  {
    id: "f_dia",
    variableName: "DIABP",
    label: "Diastolic BP",
    dataType: "integer",
    columnSpan: 6,
    required: false,
  },
  {
    id: "f_preg",
    variableName: "PREGYN",
    label: "Pregnant",
    dataType: "radio",
    columnSpan: 6,
    required: false,
  },
];

const queryRule: EditCheckRule = {
  id: "r_query",
  name: "Systolic over threshold",
  description: "synthetic",
  triggerFieldIds: ["f_sys"],
  actionType: "raise_query",
  targetFieldId: "f_sys",
  conditions: [{ fieldId: "f_sys", operator: "gt", value: 180 }],
  logicalOperator: "AND",
  querySeverity: "warning",
  queryMessage: "Confirm systolic value.",
};

const groupedRule: EditCheckRule = {
  id: "r_grouped",
  name: "Show diastolic",
  description: "synthetic",
  triggerFieldIds: ["f_preg", "f_sys"],
  actionType: "show_field",
  targetFieldId: "f_dia",
  conditions: [{ fieldId: "f_preg", operator: "eq", value: "Y" }],
  logicalOperator: "AND",
  conditionGroups: [
    {
      id: "g1",
      logicalOperator: "AND",
      conditions: [{ fieldId: "f_preg", operator: "eq", value: "Y" }],
    },
    {
      id: "g2",
      logicalOperator: "OR",
      conditions: [{ fieldId: "f_sys", operator: "gte", value: 140 }],
    },
  ],
  groupLogicalOperator: "OR",
};

const unsupportedRule: EditCheckRule = {
  id: "r_unsupported",
  name: "Imported XPath check",
  description: "synthetic",
  triggerFieldIds: ["f_sys"],
  actionType: "hide_field",
  targetFieldId: "f_preg",
  conditions: [{ fieldId: "f_sys", operator: "lt", value: 50 }],
  logicalOperator: "AND",
  unsupportedExpression: {
    raw: { xpath: "count(//x) > 2" },
    reason: "XPath expression",
  },
};

function makeForm(rules: EditCheckRule[]): CRFForm {
  return {
    id: "form1",
    name: "Vitals",
    domain: "VS",
    description: "",
    version: "1.0",
    sections: [{ id: "sec1", title: "Vitals", fields }],
    rules,
  };
}

let latestRules: EditCheckRule[] = [];

function Harness({
  initial,
  selected = null,
}: {
  initial: EditCheckRule[];
  selected?: CRFField | null;
}) {
  const [form, setForm] = useState<CRFForm>(() => makeForm(initial));
  return (
    <LogicRulesTab
      form={form}
      selectedField={selected}
      onUpdateRules={(rules) => {
        latestRules = rules;
        setForm((prev) => ({ ...prev, rules }));
      }}
    />
  );
}

const sentenceTexts = () =>
  screen.getAllByTestId("rule-sentence").map((el) => el.textContent);
const openWires = () =>
  fireEvent.click(screen.getByRole("button", { name: "Visual wires" }));
const openSentences = () =>
  fireEvent.click(screen.getByRole("button", { name: "Sentences" }));
const listedWireIds = () =>
  within(screen.getByRole("list", { name: "Rule connections" }))
    .getAllByRole("listitem")
    .map((li) => li.getAttribute("data-wire-id"));

describe("Logic tab visual wires (#674)", () => {
  afterEach(() => {
    cleanup();
    latestRules = [];
    vi.restoreAllMocks();
  });

  it("shows the same rules in both views and returns to identical sentences (sentence to wires to sentence)", () => {
    const initial = [queryRule, groupedRule, unsupportedRule];
    render(<Harness initial={initial} />);
    const before = sentenceTexts();
    expect(before).toEqual(initial.map((r) => describeRuleLogic(r, fields)));

    openWires();
    const editor = screen.getByTestId("rule-wire-editor");
    const expectedWires = buildRuleWireGraph(initial, fields).wires;
    expect(listedWireIds()).toEqual(expectedWires.map((w) => w.id));
    // Readable descriptions, with a text badge so colour is supplemental.
    expect(
      within(editor).getByText(
        /PREGYN to DIABP: Show field when PREGYN equals "Y" \(condition 1 of group 1/
      )
    ).toBeTruthy();
    expect(within(editor).getAllByText("QUERY").length).toBeGreaterThan(0);

    fireEvent.click(
      within(editor).getByText(
        /SYSBP to DIABP: Show field when SYSBP is greater than or equal to 140/
      )
    );
    expect(screen.getByTestId("rule-wire-sentence").textContent).toBe(
      describeRuleLogic(groupedRule, fields)
    );
    expect(screen.getAllByRole("group", { name: /Group \d/ })).toHaveLength(2);

    openSentences();
    expect(sentenceTexts()).toEqual(before);
    // Viewing through wires wrote nothing.
    expect(latestRules).toEqual([]);
  });

  it("creates a mandatory connection without dragging, and the sentence view reads it back", () => {
    render(<Harness initial={[queryRule]} />);
    openWires();

    fireEvent.click(screen.getByRole("button", { name: "Source PREGYN" }));
    expect(
      screen
        .getByRole("button", { name: "Source PREGYN" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByRole("status").textContent).toContain(
      "Connecting from PREGYN"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Connect PREGYN to DIABP" })
    );
    const panel = screen.getByRole("group", {
      name: "Configure new connection",
    });
    const action = within(panel).getByLabelText("Action");
    expect(document.activeElement).toBe(action);
    fireEvent.change(action, { target: { value: "require_field" } });
    fireEvent.click(
      within(panel).getByRole("button", { name: "Create connection" })
    );

    expect(latestRules).toHaveLength(2);
    const created = latestRules[1];
    expect(created).toMatchObject({
      actionType: "require_field",
      targetFieldId: "f_dia",
      triggerFieldIds: ["f_preg"],
    });
    expect(screen.getByTestId("rule-wire-sentence").textContent).toBe(
      "When (PREGYN is not empty), make DIABP mandatory."
    );

    // Configure the condition from the wire surface.
    const config = screen.getByTestId("rule-wire-config");
    fireEvent.change(
      within(config).getByLabelText("Group 1 condition 1 operator"),
      { target: { value: "eq" } }
    );
    fireEvent.change(
      within(config).getByLabelText("Group 1 condition 1 value"),
      { target: { value: "Y" } }
    );
    expect(screen.getByTestId("rule-wire-sentence").textContent).toBe(
      'When (PREGYN equals "Y"), make DIABP mandatory.'
    );

    openSentences();
    expect(sentenceTexts()[1]).toBe(
      'When (PREGYN equals "Y"), make DIABP mandatory.'
    );
  });

  it("creates connections from the list form and by pointer drag", () => {
    render(<Harness initial={[]} />);
    openWires();

    const formBox = screen.getByRole("group", { name: "New connection" });
    fireEvent.change(within(formBox).getByLabelText("From source"), {
      target: { value: "f_sys" },
    });
    fireEvent.change(within(formBox).getByLabelText("To target"), {
      target: { value: "f_preg" },
    });
    fireEvent.click(within(formBox).getByRole("button", { name: "Connect" }));
    const panel = screen.getByRole("group", {
      name: "Configure new connection",
    });
    fireEvent.change(within(panel).getByLabelText("Action"), {
      target: { value: "hide_field" },
    });
    fireEvent.click(
      within(panel).getByRole("button", { name: "Create connection" })
    );
    expect(latestRules.map((r) => describeRuleLogic(r, fields))).toEqual([
      "When (SYSBP is not empty), hide PREGYN.",
    ]);

    const source = screen.getByRole("button", { name: "Source DIABP" });
    const target = screen.getByRole("button", { name: "Target SYSBP" });
    Object.defineProperty(document, "elementFromPoint", {
      configurable: true,
      value: () => target,
    });
    fireEvent.pointerDown(source, {
      button: 0,
      clientX: 10,
      clientY: 10,
      pointerId: 1,
    });
    fireEvent.pointerMove(source, { clientX: 120, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(source, { clientX: 120, clientY: 40, pointerId: 1 });
    fireEvent.click(source); // the click that follows a drag must not arm the source
    expect(source.getAttribute("aria-pressed")).toBe("false");
    const dragPanel = screen.getByRole("group", {
      name: "Configure new connection",
    });
    expect(dragPanel.textContent).toContain("DIABP → SYSBP");
    fireEvent.change(within(dragPanel).getByLabelText("Action"), {
      target: { value: "set_value" },
    });
    fireEvent.click(
      within(dragPanel).getByRole("button", { name: "Create connection" })
    );
    expect(describeRuleLogic(latestRules[1], fields)).toBe(
      "When (DIABP is not empty), derive SYSBP = DIABP."
    );
    Reflect.deleteProperty(document, "elementFromPoint");
  });

  it("adds a source into an existing rule's group without discarding other groups", () => {
    render(<Harness initial={[groupedRule]} />);
    openWires();
    fireEvent.click(screen.getByRole("button", { name: "Source SYSBP" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Connect SYSBP to DIABP" })
    );
    const panel = screen.getByRole("group", {
      name: "Configure new connection",
    });
    fireEvent.change(within(panel).getByLabelText("Add to"), {
      target: { value: "r_grouped" },
    });
    fireEvent.click(
      within(panel).getByRole("button", { name: "Create connection" })
    );
    const updated = latestRules[0];
    expect(updated.conditionGroups).toHaveLength(2);
    expect(updated.conditionGroups?.[0].conditions).toHaveLength(2);
    expect(updated.conditionGroups?.[1]).toEqual(
      groupedRule.conditionGroups?.[1]
    );
    expect(updated.groupLogicalOperator).toBe("OR");
  });

  it("shows unsupported expressions read-only rather than editing or dropping them", () => {
    render(<Harness initial={[unsupportedRule]} />);
    openWires();
    fireEvent.click(
      screen.getByText(/SYSBP to PREGYN: Hide field when SYSBP is less than 50/)
    );
    const config = screen.getByTestId("rule-wire-config");
    expect(config.textContent).toContain(
      "Unsupported expression preserved read-only (XPath expression)"
    );
    expect(
      (within(config).getByLabelText("Action") as HTMLSelectElement).disabled
    ).toBe(true);
    expect(
      within(config).queryByRole("button", { name: /Disconnect/ })
    ).toBeNull();
    expect(
      within(config).queryByLabelText("Group 1 condition 1 operator")
    ).toBeNull();
    expect(latestRules).toEqual([]);
  });

  it("cancels a pending connection with Escape", () => {
    render(<Harness initial={[]} />);
    openWires();
    const source = screen.getByRole("button", { name: "Source SYSBP" });
    fireEvent.click(source);
    fireEvent.keyDown(source, { key: "Escape" });
    expect(source.getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("status").textContent).toBe(
      "Connection cancelled."
    );
  });

  it("keeps connections and the open configuration stable across resize and selection changes", async () => {
    // Give nodes real geometry so the SVG overlay draws paths.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        const key = this.getAttribute("aria-label") ?? "";
        const index = fields.findIndex((f) => key.endsWith(f.variableName));
        const isTarget = key.startsWith("Target") || key.startsWith("Connect");
        const top = 20 + Math.max(index, 0) * 28;
        const left = isTarget ? 200 : 0;
        return {
          x: left,
          y: top,
          top,
          left,
          right: left + 100,
          bottom: top + 24,
          width: 100,
          height: 24,
          toJSON: () => ({}),
        } as DOMRect;
      }
    );

    const initial = [queryRule, groupedRule];
    const { rerender } = render(<Harness initial={initial} />);
    openWires();
    await act(async () => {
      fireResize(320);
    });
    const pathIds = () =>
      Array.from(
        screen
          .getByTestId("rule-wire-diagram")
          .querySelectorAll("path[data-wire-id]")
      ).map((p) => [p.getAttribute("data-wire-id"), p.getAttribute("d")]);
    const beforeIds = listedWireIds();
    const beforePaths = pathIds();
    expect(beforePaths.length).toBe(beforeIds.length);
    expect(beforePaths.every(([, d]) => d && d.startsWith("M 100"))).toBe(true);

    fireEvent.click(screen.getByText(/SYSBP to SYSBP: Raise query/));
    expect(
      screen.getByTestId("rule-wire-config").getAttribute("aria-label")
    ).toBe("Configure rule Systolic over threshold");

    await act(async () => {
      fireResize(280);
    });
    expect(listedWireIds()).toEqual(beforeIds);
    expect(pathIds().map(([id]) => id)).toEqual(beforePaths.map(([id]) => id));

    // Selecting a field filters the visible wires but never renames them.
    rerender(<Harness initial={initial} selected={fields[2]} />);
    const filtered = listedWireIds();
    expect(filtered.every((id) => beforeIds.includes(id))).toBe(true);
    expect(filtered.every((id) => id?.startsWith("r_grouped"))).toBe(true);
    rerender(<Harness initial={initial} selected={null} />);
    expect(listedWireIds()).toEqual(beforeIds);
    expect(
      screen.getByTestId("rule-wire-config").getAttribute("aria-label")
    ).toBe("Configure rule Systolic over threshold");
  });
});
