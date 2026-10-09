// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  exportProofToLean4,
  exportProofToLatex,
  exportProofToMarkdown,
  exportProofToMermaid,
  exportWorkspaceProof,
  getExportFilename,
  getExportMimeType,
} from "../lib/proof-utils";
import { createCustomTheorem } from "../lib/proof-custom";

describe("Proof Export Generators (Lean 4, LaTeX, Markdown, Mermaid)", () => {
  it("generates correct filenames and extensions for all export formats", () => {
    expect(getExportFilename("lean", "modus-ponens")).toBe(
      "proof-modus-ponens.lean"
    );
    expect(getExportFilename("latex", "modus-tollens")).toBe(
      "proof-modus-tollens.tex"
    );
    expect(getExportFilename("markdown", "paxos-synod")).toBe(
      "proof-paxos-synod.md"
    );
    expect(getExportFilename("mermaid", "disjunctive-syllogism")).toBe(
      "proof-disjunctive-syllogism.mmd"
    );

    // Default theorem
    expect(getExportFilename("lean")).toBe("proof-modus-ponens.lean");

    // Custom theorem as string ID
    expect(getExportFilename("markdown", "custom")).toBe("proof-custom.md");

    // Custom theorem object
    const customTheorem = createCustomTheorem(["P", "P -> Q", "Q -> R"], "R");
    expect(getExportFilename("lean", customTheorem)).toBe("proof-custom.lean");
    expect(getExportFilename("latex", customTheorem)).toBe("proof-custom.tex");
  });

  it("maps export formats to standard MIME types", () => {
    expect(getExportMimeType("lean")).toBe("text/x-lean;charset=utf-8");
    expect(getExportMimeType("latex")).toBe(
      "application/x-latex;charset=utf-8"
    );
    expect(getExportMimeType("markdown")).toBe("text/markdown;charset=utf-8");
    expect(getExportMimeType("mermaid")).toBe("text/vnd.mermaid;charset=utf-8");
  });

  it("withholds a Lean proof template until the current graph is complete", () => {
    const solvedEdges = [
      { source: "A", target: "C" },
      { source: "B", target: "C" },
      { source: "C", target: "E" },
      { source: "D", target: "E" },
    ];

    const before = exportWorkspaceProof("lean", [], "modus-ponens");
    expect(before).toContain("INCOMPLETE");
    expect(before).not.toContain("theorem modus_ponens_pipeline");

    const solved = exportWorkspaceProof("lean", solvedEdges, "modus-ponens");
    expect(solved).toContain("theorem modus_ponens_pipeline");
    expect(solved).toContain("not checked by the Lean kernel");

    const pruned = exportWorkspaceProof(
      "lean",
      solvedEdges.slice(0, -1),
      "modus-ponens"
    );
    expect(pruned).toContain("INCOMPLETE");
    expect(pruned).not.toContain("theorem modus_ponens_pipeline");
  });

  it("labels incomplete workspace snapshots consistently across export formats", () => {
    const latex = exportWorkspaceProof("latex", [], "modus-ponens");
    expect(latex).toContain("INCOMPLETE");
    expect(latex).not.toContain("\\begin{prooftree}");

    const markdown = exportWorkspaceProof("markdown", [], "modus-ponens");
    expect(markdown).toContain("# Proof Workspace Export:");
    expect(markdown).toContain("INCOMPLETE");
    expect(markdown).not.toContain("Proof Certificate");

    const mermaid = exportWorkspaceProof("mermaid", [], "modus-ponens");
    expect(mermaid).toContain("Workspace status: INCOMPLETE");

    for (const format of ["lean", "latex", "markdown", "mermaid"] as const) {
      expect(exportWorkspaceProof(format, [], "custom")).toContain(
        "CUSTOM WORKSPACE UNAVAILABLE"
      );
    }
  });

  it("exports valid Lean 4 code across theorems", () => {
    const leanMP = exportProofToLean4("modus-ponens");
    expect(leanMP).toContain("theorem modus_ponens_pipeline");
    expect(leanMP).toContain("have hC : Q := hB hA");

    const leanMT = exportProofToLean4("modus-tollens");
    expect(leanMT).toContain("theorem modus_tollens_memory_safety");
  });

  it("exports valid LaTeX natural deduction tree prooftrees", () => {
    const latexMP = exportProofToLatex("modus-ponens");
    expect(latexMP).toContain("\\begin{prooftree}");
    expect(latexMP).toContain("\\end{prooftree}");
    expect(latexMP).toContain("MP");
  });

  it("exports a Markdown workspace snapshot with ledger table", () => {
    const md = exportProofToMarkdown([], "modus-ponens");
    expect(md).toContain("# Proof Workspace Export: Modus Ponens");
    expect(md).toContain("| Step | Proposition | Inference Rule |");
    expect(md).toContain("PENDING");
  });

  it("exports valid Mermaid flowchart graph syntax", () => {
    const mermaid = exportProofToMermaid(
      [{ source: "A", target: "C" }],
      "modus-ponens"
    );
    expect(mermaid).toContain("graph LR");
    expect(mermaid).toContain("Node_A --> Node_C");
    expect(mermaid).toContain("classDef proven");
  });

  it("exports complete LaTeX prooftrees and Mermaid graph TD flowcharts for custom theorems", () => {
    const customTheorem = createCustomTheorem(["P", "P -> Q", "Q -> R"], "R");
    const edges = customTheorem.validPairs.map(([source, target]) => ({
      source,
      target,
    }));

    const latex = exportWorkspaceProof("latex", edges, customTheorem);
    expect(latex).toContain("\\begin{prooftree}");
    expect(latex).toContain("\\end{prooftree}");
    expect(latex).toContain("MP");

    const mermaid = exportWorkspaceProof("mermaid", edges, customTheorem);
    expect(mermaid).toContain("graph TD");
    expect(mermaid).toContain("Node_A");
    expect(mermaid).toContain("Node_E");
    expect(mermaid).toContain("classDef proven");

    const lean = exportWorkspaceProof("lean", edges, customTheorem);
    expect(lean).toContain("theorem custom_proof");
    expect(lean).toContain("«P»");

    const markdown = exportWorkspaceProof("markdown", edges, customTheorem);
    expect(markdown).toContain("# Proof Workspace Export: Custom Proof");
    expect(markdown).toContain("| Step | Proposition | Inference Rule |");
  });
});
