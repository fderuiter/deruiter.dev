import { afterEach, describe, expect, it } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import SchemaFlowWorkspace from "@/components/SchemaFlowWorkspace";

afterEach(() => {
  cleanup();
});

const node = (id: string) => screen.getByTestId(`node-${id}`);
const prompt = () =>
  screen.getByRole("textbox", {
    name: "Tactic prompt terminal command input",
  });
const log = () =>
  screen.getByRole("log", { name: "Terminal feedback records" });
const type = (command: string) => {
  fireEvent.change(prompt(), { target: { value: command } });
  fireEvent.keyDown(prompt(), { key: "Enter" });
};
const edgePaths = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("path.flow-path"));

describe("SchemaFlow proof canvas", () => {
  it("draws the starting edge between node centres and marks unproven nodes", () => {
    const { container } = render(<SchemaFlowWorkspace />);
    const [edge] = edgePaths(container);
    expect(edge.getAttribute("d")).toBe("M 190 120 L 450 220");
    expect(edge.getAttribute("stroke")).toBe("#0891b2");
    expect(node("A").getAttribute("aria-label")).toBe(
      "NODE A, P, premise, proven"
    );
    expect(node("C").getAttribute("aria-label")).toMatch(/, unproven$/);
  });

  it("connects two nodes clicked in turn and shows the selection meanwhile", () => {
    const { container } = render(<SchemaFlowWorkspace />);
    fireEvent.click(node("B"));
    expect(
      screen.getByText(
        "👉 Selected NODE B. Click target node to draw directed branch."
      )
    ).toBeTruthy();
    expect(node("B").querySelector("rect")?.getAttribute("stroke")).toBe(
      "#06b6d4"
    );
    expect(screen.getByText("TAP / SELECTED")).toBeTruthy();

    fireEvent.click(node("C"));
    expect(edgePaths(container)).toHaveLength(2);
    expect(node("C").getAttribute("aria-label")).toMatch(/, proven$/);
    expect(
      within(log()).getByText("✔ Established directed path: Node B → Node C")
    ).toBeTruthy();
    expect(screen.getByText(/^💡 Hover or tap nodes/)).toBeTruthy();
  });

  it("selects nodes from the keyboard with Enter or Space only", () => {
    render(<SchemaFlowWorkspace />);
    fireEvent.keyDown(node("D"), { key: "Enter" });
    expect(screen.getByText(/Selected NODE D\./)).toBeTruthy();
    fireEvent.keyDown(node("D"), { key: " " });
    expect(within(log()).getByText("Deselected Node D.")).toBeTruthy();
    fireEvent.keyDown(node("D"), { key: "x" });
    expect(screen.queryByText(/Selected NODE D\./)).toBeNull();
  });

  it("shows a tooltip and previews the hovered node in the inspector", () => {
    render(<SchemaFlowWorkspace />);
    expect(screen.getByText("CONTEXTUAL NODE INSPECTOR")).toBeTruthy();
    expect(screen.getByText("TOUCH & POINTER READY")).toBeTruthy();

    fireEvent.mouseEnter(node("E"));
    const tooltip = screen.getByTestId("node-tooltip");
    expect(within(tooltip).getByText("NODE E SPECIFICATION")).toBeTruthy();
    expect(tooltip.querySelector("foreignObject")?.getAttribute("x")).toBe(
      "520"
    );
    expect(screen.getByText("HOVER PREVIEW")).toBeTruthy();
    expect(screen.getByText("INSPECTOR // NODE E")).toBeTruthy();
    expect(screen.getByTestId("inspector-node-formula").textContent).toBe("R");
    expect(screen.getByTestId("inspector-node-status").textContent).toBe(
      "UNPROVEN"
    );

    fireEvent.mouseLeave(node("E"));
    expect(screen.queryByTestId("node-tooltip")).toBeNull();
    expect(screen.getByText("CONTEXTUAL NODE INSPECTOR")).toBeTruthy();
  });

  it("clears the canvas and rolls it back from the header buttons", () => {
    const { container } = render(<SchemaFlowWorkspace />);
    const rollback = screen.getByRole("button", { name: /Rollback \(0\)/ });
    expect((rollback as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: /Reset Canvas/ }));
    expect(edgePaths(container)).toHaveLength(0);
    expect(within(log()).getByText("All pathways cleared.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Rollback \(1\)/ }));
    expect(edgePaths(container)).toHaveLength(1);
    expect(
      within(log()).getByText(
        "✔ Successfully rolled back proof connection configuration to previous state."
      )
    ).toBeTruthy();
  });
});

describe("SchemaFlow goal card", () => {
  it("walks from required pathways to a verified goal", () => {
    const { container } = render(<SchemaFlowWorkspace />);
    expect(
      screen.getByText(
        "Required: Establish pathways (A & B) → C and (C & D) → E."
      )
    ).toBeTruthy();

    type("connect B C");
    expect(
      screen.getByText(
        "Intermediate Q proven. Establish C → E & D → E pathways."
      )
    ).toBeTruthy();

    type("connect C E");
    type("connect D E");
    expect(
      screen.getByText("Success: Conclusion verified successfully on GPU.")
    ).toBeTruthy();
    for (const edge of edgePaths(container)) {
      expect(edge.getAttribute("stroke")).toBe("#06b6d4");
    }
    const pathways = screen.getByText("PATHWAYS ACTIVE:").nextElementSibling;
    expect(pathways?.textContent).toBe("4");
  });
});

describe("SchemaFlow solver telemetry", () => {
  it("starts and stops the solver loop from its button and the shell", () => {
    render(<SchemaFlowWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Start Solver Loop/ }));
    expect(
      screen.getByRole("button", { name: /Stop Solver Loop/ })
    ).toBeTruthy();
    type("simulate");
    expect(
      screen.getByRole("button", { name: /Start Solver Loop/ })
    ).toBeTruthy();
    expect(
      within(log()).getAllByText(/Solver loop telemetry simulation suspended\./)
    ).toHaveLength(1);
  });
});

describe("SchemaFlow tactic shell", () => {
  it("echoes commands and styles errors and successes", () => {
    render(<SchemaFlowWorkspace />);
    type("connect A A");
    expect(within(log()).getByText("connect A A")).toBeTruthy();
    expect(
      within(log()).getByText("✖ Self-connections are forbidden.")
    ).toBeTruthy();
    type("disconnect A C");
    expect(
      within(log()).getByText("✔ Severed path: Node A ↛ Node C")
    ).toBeTruthy();
  });

  it("shows help and clears the log", () => {
    render(<SchemaFlowWorkspace />);
    type("help");
    expect(
      within(log()).getByText(/^Command Reference Checklist:/)
    ).toBeTruthy();
    type("clear");
    expect(log().children).toHaveLength(0);
  });

  it("ghosts the completion and accepts it with Tab", () => {
    render(<SchemaFlowWorkspace />);
    fireEvent.change(prompt(), { target: { value: "roll" } });
    expect(screen.getByText("back")).toBeTruthy();
    fireEvent.keyDown(prompt(), { key: "Tab" });
    expect((prompt() as HTMLInputElement).value).toBe("rollback");
  });

  it("fills the prompt from a quick command and runs it from the button", () => {
    const { container } = render(<SchemaFlowWorkspace />);
    const run = screen.getByTitle("Execute CLI Tactic") as HTMLButtonElement;
    expect(run.disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "connect B C" }));
    expect((prompt() as HTMLInputElement).value).toBe("connect B C");
    expect(run.disabled).toBe(false);

    fireEvent.click(run);
    expect(edgePaths(container)).toHaveLength(2);
    expect((prompt() as HTMLInputElement).value).toBe("");
  });

  it("recalls the last command with the up arrow", () => {
    render(<SchemaFlowWorkspace />);
    type("help");
    fireEvent.keyDown(prompt(), { key: "ArrowUp" });
    expect((prompt() as HTMLInputElement).value).toBe("help");
    fireEvent.keyDown(prompt(), { key: "ArrowDown" });
    expect((prompt() as HTMLInputElement).value).toBe("");
  });
});
