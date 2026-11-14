// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from "vitest";
import mermaid from "mermaid";
import { THEOREMS, exportProofToMermaid } from "@/lib/proof";
import { createCustomTheorem } from "@/lib/proof-custom";

type TheoremDefinition = Parameters<typeof exportProofToMermaid>[1] & object;

interface ParsedFlowchart {
  vertices: Map<string, string>;
  edges: Array<[string, string]>;
}

/**
 * Mermaid keeps entity codes as placeholders until it renders. Turn them
 * back into characters so a test can compare the label a reader would see.
 */
function decodeMermaidPlaceholders(text: string): string {
  return text
    .replace(/ﬂ°°(\d+)¶ß/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/ﬂ°quot¶ß/g, '"');
}

/** Parses a flowchart with the installed Mermaid and reads back its graph. */
async function parseFlowchart(source: string): Promise<ParsedFlowchart> {
  await mermaid.parse(source);
  const diagram = await mermaid.mermaidAPI.getDiagramFromText(source);
  const db = diagram.db as unknown as {
    getVertices: () => Map<string, { id: string; text: string }>;
    getEdges: () => Array<{ start: string; end: string }>;
  };
  return {
    vertices: new Map(
      [...db.getVertices().values()].map((v) => [
        v.id,
        decodeMermaidPlaceholders(v.text),
      ])
    ),
    edges: db.getEdges().map((e) => [e.start, e.end]),
  };
}

function withNodes(
  nodes: TheoremDefinition["nodes"],
  title = "Crafted"
): TheoremDefinition {
  return { ...THEOREMS["modus-ponens"], id: "custom", title, nodes };
}

const premise = THEOREMS["modus-ponens"].nodes[0];

// CodeQL alert 8: labels and ids reach Mermaid syntax from a theorem object.
describe("exportProofToMermaid encoding", () => {
  beforeAll(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "antiscript",
      flowchart: { htmlLabels: false },
    });
  });

  it("parses every built-in theorem export with its original labels", async () => {
    for (const [id, theorem] of Object.entries(THEOREMS)) {
      const parsed = await parseFlowchart(
        exportProofToMermaid([], id as keyof typeof THEOREMS)
      );
      expect(parsed.vertices.size).toBe(theorem.nodes.length);
      for (const node of theorem.nodes) {
        expect(parsed.vertices.get(`Node_${node.id}`)).toContain(node.label);
      }
    }
  });

  it("parses a custom theorem export with all of its edges", async () => {
    const theorem = createCustomTheorem(["P", "P -> Q", "Q -> R"], "R");
    const edges = theorem.validPairs.map(([source, target]) => ({
      source,
      target,
    }));
    const parsed = await parseFlowchart(exportProofToMermaid(edges, theorem));
    expect(parsed.vertices.size).toBe(theorem.nodes.length);
    expect(parsed.edges).toHaveLength(edges.length);
  });

  it("keeps an adversarial label as one node's literal text", async () => {
    const label =
      'P"] --> X["owned"]\nclick Node_A "javascript:alert(1)" # \\ <b>&amp;</b> `x`';
    const source = exportProofToMermaid(
      [],
      withNodes([{ ...premise, id: "A", label }])
    );

    const parsed = await parseFlowchart(source);
    expect([...parsed.vertices.keys()]).toEqual(["Node_A"]);
    expect(parsed.edges).toEqual([]);
    expect(parsed.vertices.get("Node_A")).toContain(label.replace("\n", " "));
    expect(source).not.toMatch(/^\s*click /m);
  });

  it("keeps a multi-line title inside its comment", async () => {
    const source = exportProofToMermaid(
      [],
      withNodes([{ ...premise, id: "A" }], "T\nclick Node_A call alert()")
    );
    expect(source).not.toMatch(/^\s*click /m);
    expect((await parseFlowchart(source)).vertices.size).toBe(1);
  });

  it("drops nodes with non-identifier ids and edges to unknown nodes", async () => {
    const source = exportProofToMermaid(
      [
        { source: "A", target: "B" },
        { source: "A", target: 'Z["x"]' },
        { source: "A", target: "missing" },
      ],
      withNodes([
        { ...premise, id: "A" },
        { ...premise, id: "B" },
        { ...premise, id: 'C["owned"] --> D' },
      ])
    );
    const parsed = await parseFlowchart(source);
    expect([...parsed.vertices.keys()].sort()).toEqual(["Node_A", "Node_B"]);
    expect(parsed.edges).toEqual([["Node_A", "Node_B"]]);
  });
});
