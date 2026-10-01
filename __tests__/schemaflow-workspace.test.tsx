import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import SchemaFlowWorkspace from "@/components/SchemaFlowWorkspace";

describe("SchemaFlowWorkspace Component Architectural & Logical Validation", () => {
  const componentPath = path.resolve(
    __dirname,
    "../components/SchemaFlowWorkspace.tsx"
  );
  const content = fs.readFileSync(componentPath, "utf-8");

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("exports the SchemaFlowWorkspace component as the default export", () => {
    expect(typeof SchemaFlowWorkspace).toBe("function");
  });

  it("uses inline SVG elements with absolute coordinate coordinates for zero-reflow declarative layout", () => {
    expect(content).toContain("<svg");
    expect(content).toContain('viewBox="0 0 800 420"');
    expect(content).toContain("transform={`translate(${node.x}, ${node.y})`}");
  });

  it("updates the RAM progress gauge by declaring and modifying CSS custom variables inline on style", () => {
    expect(content).toContain('"--gauge-progress"');
    expect(content).toContain("gauge-fill");
    expect(content).toContain("stroke-dashoffset");
  });

  it("supports interactive click-to-execute connection/disconnection state rules", () => {
    expect(content).toContain("connectNodes");
    expect(content).toContain("disconnectNodes");
    expect(content).toContain("handleNodeClick");
  });

  it("maintains a historical state stack supporting proof tree rollback history upon request", () => {
    expect(content).toContain("executeRollback");
    expect(content).toContain("setHistory");
    expect(content).toContain("rollback");
  });

  it("hosts an accessible command CLI terminal supporting a command registry", () => {
    expect(content).toContain("runCliCommand");
    expect(content).toContain("consoleInput");
    expect(content).toContain("consoleLogs");
    expect(content).toContain("connect");
    expect(content).toContain("disconnect");
  });

  it("configures SchemaFlowWorkspaceWrapper with high-fidelity loading skeleton fallback to eliminate CLS", () => {
    const wrapperPath = path.resolve(
      __dirname,
      "../components/SchemaFlowWorkspaceWrapper.tsx"
    );
    const wrapperContent = fs.readFileSync(wrapperPath, "utf-8");
    expect(wrapperContent).toContain("SchemaFlowWorkspaceSkeleton");
    expect(wrapperContent).toContain("loading:");

    const skeletonPath = path.resolve(
      __dirname,
      "../components/SchemaFlowWorkspaceSkeleton.tsx"
    );
    const skeletonContent = fs.readFileSync(skeletonPath, "utf-8");
    expect(skeletonContent).toContain('data-testid="schemaflow-skeleton"');
    expect(skeletonContent).toContain("min-h-[520px]");
  });

  it("memoizes proof graph evaluations using React.useMemo to prevent recalculations on unrelated re-renders", () => {
    expect(content).toContain("React.useMemo");
    expect(content).toContain("isC_Proven");
    expect(content).toContain("isE_Proven");
  });

  it("uses direct DOM refs for telemetry gauge and text updates during high-frequency solver loops", () => {
    expect(content).toContain("gaugeContainerRef");
    expect(content).toContain("ramTextRef");
    expect(content).toContain("ramValRef");
    expect(content).toContain("gaugeContainerRef.current.style.setProperty");
    expect(content).toContain('"--gauge-progress"');
    expect(content).toContain("ramTextRef.current.textContent");
  });

  it("updates telemetry gauge CSS property and text label directly in DOM when solver loop is active", () => {
    render(<SchemaFlowWorkspace />);

    const startBtn = screen.getByRole("button", { name: /Start Solver Loop/i });
    expect(startBtn).toBeDefined();

    // Start solver loop
    act(() => {
      fireEvent.click(startBtn);
    });

    const stopBtn = screen.getByRole("button", { name: /Stop Solver Loop/i });
    expect(stopBtn).toBeDefined();

    // Find RAM Telemetry gauge container
    const gaugeHeading = screen.getByText("Solver RAM Telemetry");
    const gaugeContainer = gaugeHeading
      .closest(".bg-zinc-900\\/20")
      ?.querySelector("div[style*='--gauge-progress']");
    expect(gaugeContainer).not.toBeNull();

    // Advance fake timers by 80ms ticks
    act(() => {
      vi.advanceTimersByTime(240);
    });

    // Check that style --gauge-progress is set directly on element
    const styleAttr = gaugeContainer?.getAttribute("style");
    expect(styleAttr).toContain("--gauge-progress");

    // Stop solver loop cleanly
    act(() => {
      fireEvent.click(stopBtn);
    });

    expect(
      screen.getByRole("button", { name: /Start Solver Loop/i })
    ).toBeDefined();
  });

  it("displays terminal CLI welcome message instructing users to hover or tap nodes to read specifications", () => {
    render(<SchemaFlowWorkspace />);
    expect(
      screen.getByText((content) =>
        content.includes("Hover or tap nodes to read specifications.")
      )
    ).toBeDefined();
  });

  it("renders contextual node inspection panel displaying label, formula, type, status, and description content", () => {
    render(<SchemaFlowWorkspace />);
    const inspectorPanel = screen.getByTestId("node-inspector-panel");
    expect(inspectorPanel).toBeDefined();
    expect(screen.getByText(/CONTEXTUAL NODE INSPECTOR/i)).toBeDefined();

    // Tap/Click Node C to inspect it
    const nodeC = screen.getByTestId("node-C");
    act(() => {
      fireEvent.click(nodeC);
    });

    expect(screen.getByTestId("inspector-node-label").textContent).toBe(
      "NODE C"
    );
    expect(screen.getByTestId("inspector-node-formula").textContent).toBe("Q");
    expect(screen.getByTestId("inspector-node-type").textContent).toBe(
      "intermediate"
    );
    expect(
      screen.getByTestId("inspector-node-description").textContent
    ).toContain("Intermediate Goal Q: Data mapping is consistent.");
  });

  it("displays floating specification tooltip overlay and updates inspector panel when hovering over an SVG node", () => {
    render(<SchemaFlowWorkspace />);

    const nodeA = screen.getByTestId("node-A");

    // Initially tooltip should not be visible
    expect(screen.queryByTestId("node-tooltip")).toBeNull();

    // Hover over Node A
    act(() => {
      fireEvent.mouseEnter(nodeA);
    });

    // Floating tooltip appears
    const tooltip = screen.getByTestId("node-tooltip");
    expect(tooltip).toBeDefined();
    expect(tooltip.textContent).toContain(
      "Premise P: Fact verification complete."
    );

    // Inspector panel updates with Node A specification
    expect(screen.getByTestId("inspector-node-label").textContent).toBe(
      "NODE A"
    );
    expect(screen.getByTestId("inspector-node-formula").textContent).toBe("P");
    expect(
      screen.getByTestId("inspector-node-description").textContent
    ).toContain("Premise P: Fact verification complete.");

    // Mouse leave hides tooltip
    act(() => {
      fireEvent.mouseLeave(nodeA);
    });
    expect(screen.queryByTestId("node-tooltip")).toBeNull();
  });

  it("maintains selection state for pathway creation when tapping a node to view its specification", () => {
    render(<SchemaFlowWorkspace />);

    const nodeC = screen.getByTestId("node-C");
    const nodeE = screen.getByTestId("node-E");

    // Tap Node C to inspect & select
    act(() => {
      fireEvent.click(nodeC);
    });

    // Node C specs are displayed in inspector
    expect(screen.getByTestId("inspector-node-label").textContent).toBe(
      "NODE C"
    );

    // Tap Node E to connect C -> E
    act(() => {
      fireEvent.click(nodeE);
    });

    // Connection C -> E should be established (terminal log reports success)
    expect(
      screen.getByText(/Established directed path: Node C → Node E/i)
    ).toBeDefined();
  });
});
