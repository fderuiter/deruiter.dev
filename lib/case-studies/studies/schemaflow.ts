import { compileCaseStudy } from "../compiler";
import type { CaseStudyData } from "../types";

export const caseStudy: CaseStudyData = compileCaseStudy({
    id: "canonical-5",
    slug: "schemaflow",
    title: "SchemaFlow: Build JSON Schemas Visually",
    primary_language: "TypeScript",
    github_url: "https://github.com/fderuiter/SchemaFlow",
    published: true,
    simulated_telemetry: false,
    tags: "TypeScript, React, Flow, Schemas, AST, Node-RED",
    editorial_content:
      "A **React** and **TypeScript** graph editor for composing **JSON Schema**. Connect nodes, check for circular dependencies, and see the generated code as you work.",
    architectural_narrative: `<h3>The problem</h3>
<p>JSON Schema is useful, but nested structures can be hard to follow in a text editor. SchemaFlow lets you compose them as a graph, inspect the connections, and see the generated schema as you work.</p>
<p><strong>The approach:</strong> React renders the graph editor while TypeScript logic tracks dependencies, checks for cycles, and generates JSON Schema.</p>
<p><strong>Reported project measurements:</strong> Sub-8ms canvas node interaction latency; 100% cyclical dependency detection and resolution via <code>$ref</code> pointers; automated real-time OpenAPI v3 code generation.</p>

<h3>How it works</h3>
<p><strong>Immutable Graph State Core:</strong> State is modeled as a Directed Acyclic Graph (DAG) using a customized Zustand store with memoized selectors to eliminate unnecessary React re-renders.</p>
<p><strong>Cyclical Dependency Detection:</strong> Depth-first search (DFS) traversal detects recursive schema references, automatically synthesizing <code>$ref</code> pointer definitions rather than entering infinite compilation loops.</p>
<p><strong>Web Worker AST Compiler:</strong> Offloads heavy schema AST generation and JSON/YAML serialization to Web Workers, keeping the canvas render loop completely free of main-thread computation.</p>

<h3>How the pieces connect</h3>
<pre><code class="language-mermaid">
flowchart TD
    A[Interactive Visual Canvas: React Flow] --> B[Zustand DAG Graph State Store]
    B --> C[DFS Cyclical Reference Detector]
    C -->|Valid / Resolved DAG| D[Web Worker AST Compiler]
    D --> E[JSON Schema AST Generator]
    E --> F1[JSON Schema Draft-07 Spec]
    E --> F2[OpenAPI v3 Specification]
    E --> F3[TypeScript Type Definitions]
    F1 & F2 & F3 --> G[Live Code Preview & Registry Exporter]
</code></pre>

<h3>Implementation notes</h3>

<h4>DAG Node State & Connection Definition (<code>src/store/graph_store.ts</code>)</h4>
<pre><code class="language-typescript">
// Immutable Graph State Model
interface SchemaNode {
  id: string;
  type: "string" | "number" | "object" | "array" | "ref";
  properties: Record<string, unknown>;
  position: { x: number; y: number };
}

interface SchemaConnection {
  sourceId: string;
  targetId: string;
  sourceHandle?: string;
  targetHandle?: string;
}
</code></pre>

<h4>DFS Recursive Reference Resolver (<code>src/compiler/cycle_detector.ts</code>)</h4>
<pre><code class="language-typescript">
// Depth-First Search for recursive reference resolution
function detectAndResolveCycles(nodes: SchemaNode[], connections: SchemaConnection[]): Map<string, string> {
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  connections.forEach((c) => adj.get(c.sourceId)?.push(c.targetId));

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const refMap = new Map<string, string>();

  function dfs(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    for (const neighbor of adj.get(nodeId) || []) {
      if (!visited.has(neighbor)) {
        if (dfs(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        refMap.set(neighbor, \`#/definitions/\${neighbor}\`);
      }
    }
    recursionStack.delete(nodeId);
    return false;
  }

  nodes.forEach((n) => { if (!visited.has(n.id)) dfs(n.id); });
  return refMap;
}
</code></pre>

<h3>Tradeoffs and lessons</h3>
<ul>
  <li><strong>Worker Thread Offloading:</strong> Moving JSON Schema serialization to Web Workers prevented frame drops on complex graphs containing 100+ interconnected schema nodes.</li>
  <li><strong>Graceful Recursive <code>$ref</code> Handling:</strong> Detecting cycles and transforming them into JSON Schema <code>$ref</code> definitions prevented browser tab crashes on recursive types (like file trees).</li>
</ul>`,
    created_at: new Date("2026-02-15T00:00:00Z"),
    updated_at: new Date("2026-08-18T00:00:00Z"),
  });
