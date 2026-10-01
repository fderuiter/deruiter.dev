import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import SchemaFlowWorkspace, {
  compileGraphToProtocol,
  Node,
  Edge,
} from "@/components/SchemaFlowWorkspace";
import { UniversalCrfProtocolSchema } from "@/lib/crf/universal-schema";

describe("SchemaFlow Workspace Compiler, Export Drawer & Live Diffing Panel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const testNodes: Node[] = [
    {
      id: "A",
      label: "NODE A",
      type: "premise",
      formula: "P",
      description: "Premise P",
      x: 100,
      y: 80,
    },
    {
      id: "B",
      label: "NODE B",
      type: "premise",
      formula: "P -> Q",
      description: "Premise P -> Q",
      x: 100,
      y: 280,
    },
    {
      id: "C",
      label: "NODE C",
      type: "intermediate",
      formula: "Q",
      description: "Intermediate Q",
      x: 360,
      y: 180,
    },
  ];

  const testEdges: Edge[] = [{ source: "A", target: "C" }];

  it("client-side compiler transforms graph nodes and edges into a Zod-valid StudyProtocol data structure", () => {
    const protocol = compileGraphToProtocol(testNodes, testEdges);
    expect(protocol).toBeDefined();
    expect(protocol.id).toBe("SCHEMAFLOW-PROTOCOL-001");
    expect(protocol.forms.length).toBe(3);

    // Validate with Zod schema
    const parseResult = UniversalCrfProtocolSchema.safeParse(protocol);
    expect(parseResult.success).toBe(true);

    // Verify form and rule mapping
    const formC = protocol.forms.find((f) => f.id === "FORM_C");
    expect(formC).toBeDefined();
    expect(formC?.rules.length).toBe(1);
    expect(formC?.rules[0].id).toBe("RULE_A_TO_C");
  });

  it("renders Export Schema and Baseline Diff buttons in canvas header", () => {
    render(<SchemaFlowWorkspace />);
    expect(screen.getByTestId("export-schema-btn")).toBeDefined();
    expect(screen.getByTestId("baseline-diff-btn")).toBeDefined();
  });

  it("opens Export Drawer and displays live JSON, YAML, and CDISC ODM XML exports", () => {
    render(<SchemaFlowWorkspace />);

    // Click Export Schema button
    const exportBtn = screen.getByTestId("export-schema-btn");
    act(() => {
      fireEvent.click(exportBtn);
    });

    // Check drawer dialog open
    expect(
      screen.getByRole("dialog", { name: /Compiled Schema Export Drawer/i })
    ).toBeDefined();
    expect(screen.getByText(/Live Compiled Schema Export/i)).toBeDefined();

    // Check JSON tab active by default
    expect(screen.getByText(/SCHEMAFLOW-PROTOCOL-001/i)).toBeDefined();

    // Switch to YAML tab
    const yamlTab = screen.getByRole("button", { name: /YAML Format/i });
    act(() => {
      fireEvent.click(yamlTab);
    });
    expect(screen.getByText(/schemaVersion/i)).toBeDefined();

    // Switch to CDISC ODM XML tab
    const odmTab = screen.getByRole("button", { name: /CDISC ODM XML/i });
    act(() => {
      fireEvent.click(odmTab);
    });
    expect(
      screen.getByText(/<ODM xmlns="http:\/\/www.cdisc.org\/ns\/odm\/v1.3"/i)
    ).toBeDefined();
  });

  it("executes CLI export and diff commands in embedded terminal and logs feedback", () => {
    render(<SchemaFlowWorkspace />);

    const cliInput = screen.getByPlaceholderText(
      /Type 'help' or syntax commands.../i
    );

    // Run 'export json' CLI command
    act(() => {
      fireEvent.change(cliInput, { target: { value: "export json" } });
      fireEvent.keyDown(cliInput, { key: "Enter", code: "Enter" });
    });

    // Verify success feedback in terminal log
    expect(screen.getByText(/✔ Exported schema as JSON/i)).toBeDefined();
    expect(
      screen.getByRole("dialog", { name: /Compiled Schema Export Drawer/i })
    ).toBeDefined();

    // Close export drawer
    const closeExportBtn = screen.getByRole("button", {
      name: /Close Export Drawer/i,
    });
    act(() => {
      fireEvent.click(closeExportBtn);
    });

    // Run 'export yaml' CLI command
    act(() => {
      fireEvent.change(cliInput, { target: { value: "export yaml" } });
      fireEvent.keyDown(cliInput, { key: "Enter", code: "Enter" });
    });
    expect(screen.getByText(/✔ Exported schema as YAML/i)).toBeDefined();

    // Close export drawer
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: /Close Export Drawer/i })
      );
    });

    // Run 'export odm' CLI command
    act(() => {
      fireEvent.change(cliInput, { target: { value: "export odm" } });
      fireEvent.keyDown(cliInput, { key: "Enter", code: "Enter" });
    });
    expect(screen.getByText(/✔ Exported schema as ODM/i)).toBeDefined();

    // Close export drawer
    act(() => {
      fireEvent.click(
        screen.getByRole("button", { name: /Close Export Drawer/i })
      );
    });

    // Run 'diff' CLI command
    act(() => {
      fireEvent.change(cliInput, { target: { value: "diff" } });
      fireEvent.keyDown(cliInput, { key: "Enter", code: "Enter" });
    });

    expect(
      screen.getByText(/✔ Structural Diff against baseline v1.0.0/i)
    ).toBeDefined();
    expect(
      screen.getByRole("dialog", {
        name: /Structural SDTM Baseline Diff Panel/i,
      })
    ).toBeDefined();
  });

  it("opens Baseline Diff panel and dynamically reflects graph modification counts", () => {
    render(<SchemaFlowWorkspace />);

    // Open Diff Panel
    const diffBtn = screen.getByTestId("baseline-diff-btn");
    act(() => {
      fireEvent.click(diffBtn);
    });

    expect(
      screen.getByRole("dialog", {
        name: /Structural SDTM Baseline Diff Panel/i,
      })
    ).toBeDefined();
    expect(screen.getByText(/No Structural Diff Detected/i)).toBeDefined();

    // Add connection 'B C' via CLI prompt while diff panel or canvas is active
    const cliInput = screen.getByPlaceholderText(
      /Type 'help' or syntax commands.../i
    );
    act(() => {
      fireEvent.change(cliInput, { target: { value: "connect B C" } });
      fireEvent.keyDown(cliInput, { key: "Enter", code: "Enter" });
    });

    // Diff panel should immediately reflect 1 added rule change
    const diffEntries = screen.getAllByText(
      /Pathway Dependency: Node B -> Node C/i
    );
    expect(diffEntries.length).toBeGreaterThan(0);

    // Snapshot new baseline to reset diffs
    const snapshotBtn = screen.getByRole("button", {
      name: /Snapshot New Baseline/i,
    });
    act(() => {
      fireEvent.click(snapshotBtn);
    });

    expect(screen.getByText(/No Structural Diff Detected/i)).toBeDefined();
  });
});
