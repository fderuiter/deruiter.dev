import { describe, it, expect } from "vitest";
import DOMPurify from "isomorphic-dompurify";
import fs from "fs";
import path from "path";
import { renderHook } from "@testing-library/react";
import { dictionary } from "@/lib/i18n-dictionary";
import { useTerminology } from "@/components/providers/TerminologyProvider";
import { resolveTermSwap } from "@/components/RichNarrative";

describe("Interactive Terminology Tooltips - Sanitization Layers", () => {
  const allowedTags = [
    "h2",
    "h3",
    "h4",
    "p",
    "code",
    "pre",
    "strong",
    "em",
    "a",
    "ul",
    "ol",
    "li",
    "span",
    "abbr",
  ];
  const allowedAttrs = [
    "href",
    "target",
    "rel",
    "class",
    "data-term",
    "data-definition",
    "data-key",
  ];

  const sanitizeOptions = {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttrs,
  };

  it("should preserve allowed inline terminology tags span and abbr", () => {
    const dirtyHtml = `
      <span data-term="Node Editor" data-definition="A visual editor" data-key="node-editor">Reactive Engine</span>
      <abbr data-term="AST" data-definition="Abstract Syntax Tree" data-key="ast-key">AST Compiler</abbr>
    `;
    const cleanHtml = DOMPurify.sanitize(dirtyHtml, sanitizeOptions);

    expect(cleanHtml).toContain("span");
    expect(cleanHtml).toContain("abbr");
    expect(cleanHtml).toContain('data-term="Node Editor"');
    expect(cleanHtml).toContain('data-definition="A visual editor"');
    expect(cleanHtml).toContain('data-key="node-editor"');
    expect(cleanHtml).toContain('data-term="AST"');
    expect(cleanHtml).toContain('data-definition="Abstract Syntax Tree"');
    expect(cleanHtml).toContain('data-key="ast-key"');
  });

  it("should rigorously block and strip arbitrary scripts, onclick handlers, and style tags", () => {
    const maliciousHtml = `
      <span data-term="Test" onclick="alert(1)" style="color: red">Safe text</span>
      <script>console.log('injected');</script>
      <img src="x" onerror="alert(2)" />
    `;
    const cleanHtml = DOMPurify.sanitize(maliciousHtml, sanitizeOptions);

    expect(cleanHtml).not.toContain("<script>");
    expect(cleanHtml).not.toContain("onclick");
    expect(cleanHtml).not.toContain("style");
    expect(cleanHtml).not.toContain("onerror");
    expect(cleanHtml).not.toContain("img");
  });
});

describe("Interactive Terminology Tooltips - Component Structures", () => {
  const richNarrativePath = path.resolve(
    __dirname,
    "../components/RichNarrative.tsx"
  );
  const togglePath = path.resolve(
    __dirname,
    "../components/TerminologyToggle.tsx"
  );
  const tooltipPath = path.resolve(__dirname, "../components/ui/Tooltip.tsx");

  it("should have imported usePersistentState and implemented DOMParser rehydration in RichNarrative", () => {
    const content = fs.readFileSync(richNarrativePath, "utf-8");
    expect(content).toContain(
      'import { usePersistentState } from "@/hooks/usePersistentState";'
    );
    expect(content).toContain("new DOMParser()");
    expect(content).toContain(
      'parseFromString(`<div>${cleanHtml}</div>`, "text/html")'
    );
    expect(content).toContain("domToReact");
  });

  it("should implement Simplified Terminology option and standard accessibility attributes in TerminologyToggle", () => {
    const content = fs.readFileSync(togglePath, "utf-8");
    expect(content).toContain(
      'usePersistentState("simplified-terminology", false)'
    );
    expect(content).toContain('role="switch"');
    expect(content).toContain("aria-checked={simplified}");
    expect(content).toContain('aria-label="Toggle simplified terminology"');
  });

  it("should implement focusable and accessible tooltip specifications in Tooltip component", () => {
    const content = fs.readFileSync(tooltipPath, "utf-8");
    expect(content).toContain("tabIndex={0}");
    expect(content).toContain("aria-describedby={tooltipId}");
    expect(content).toContain('role="tooltip"');
  });

  it("should allow and preserve standard accessibility attributes in RichNarrative sanitize and rehydration", () => {
    const content = fs.readFileSync(richNarrativePath, "utf-8");
    expect(content).toContain('"role"');
    expect(content).toContain('"tabindex"');
    expect(content).toContain('"aria-label"');
    expect(content).toContain('"aria-describedby"');
    expect(content).toContain('"aria-hidden"');
    expect(content).toContain('"aria-expanded"');
    expect(content).toContain('"aria-checked"');
    expect(content).toContain('name.startsWith("aria-")');
    expect(content).toContain("props.role = attr.value");
    expect(content).toContain("props.tabIndex =");
  });
});

describe("Centralized i18n Static Context & Dictionary Keys", () => {
  it("should contain detailed and simplified key structures in the centralized static dictionary", () => {
    expect(dictionary).toHaveProperty("detailed");
    expect(dictionary).toHaveProperty("simplified");

    // Check Bio Card structure
    expect(dictionary.detailed.bio).toHaveProperty("title");
    expect(dictionary.detailed.bio).toHaveProperty("subtitle");
    expect(dictionary.detailed.bio).toHaveProperty("description");
    expect(dictionary.simplified.bio).toHaveProperty("description");

    // Check Timeline structure
    expect(dictionary.detailed.timeline.length).toBeGreaterThan(0);
    expect(dictionary.simplified.timeline.length).toBeGreaterThan(0);
    expect(dictionary.detailed.timeline[0]).toHaveProperty(
      "professionalDescription"
    );
    expect(dictionary.detailed.timeline[0]).toHaveProperty(
      "realityDescription"
    );

    // Check Domains/Skills structure
    expect(dictionary.detailed.domains.items.length).toBe(4);
    expect(dictionary.simplified.domains.items.length).toBe(4);
  });

  it("should fallback gracefully if useTerminology is invoked outside the Provider", () => {
    const { result } = renderHook(() => useTerminology());

    expect(result.current.simplified).toBe(false);
    expect(result.current.isFallback).toBe(true);
    expect(typeof result.current.setSimplified).toBe("function");
  });
});

describe("Synchronous Initial Term Swap Helper (resolveTermSwap)", () => {
  it("should return unchanged html when simplified is false", () => {
    const html = `<p>Lead architect for <span data-key="gxp" data-term="industry-standard" data-definition="Good Practice standards">GxP</span> clinical trials.</p>`;
    const swapped = resolveTermSwap(html, false);
    expect(swapped).toBe(html);
  });

  it("should substitute inner tag content with data-term value when simplified is true", () => {
    const html = `<p>Lead architect for <span data-key="gxp" data-term="industry-standard" data-definition="Good Practice standards">GxP</span> clinical trials.</p>`;
    const swapped = resolveTermSwap(html, true);
    expect(swapped).toContain(
      '<span data-key="gxp" data-term="industry-standard" data-definition="Good Practice standards">industry-standard</span>'
    );
    expect(swapped).not.toContain(">GxP<");
  });

  it("should unescape attribute HTML entities when resolving simplified terms", () => {
    const html = `<abbr data-term="AST &quot;Compiler&quot;" data-definition="Abstract Syntax Tree" data-key="ast-key">AST</abbr>`;
    const swapped = resolveTermSwap(html, true);
    expect(swapped).toContain('>AST "Compiler"<');
  });

  it("should handle empty strings or HTML without terminology tags gracefully", () => {
    expect(resolveTermSwap("", true)).toBe("");
    const plainHtml = "<p>Standard paragraph without terms.</p>";
    expect(resolveTermSwap(plainHtml, true)).toBe(plainHtml);
  });
});

describe("Global CSS Pre-Hydration Fallback Styling Invariants", () => {
  it("should define fallback dashed underline and cursor help for terminology data attributes in globals.css", () => {
    const globalsCssPath = path.resolve(__dirname, "../app/globals.css");
    const content = fs.readFileSync(globalsCssPath, "utf-8");

    expect(content).toContain("[data-term]");
    expect(content).toContain("[data-definition]");
    expect(content).toContain("[data-key]");
    expect(content).toContain("cursor: help;");
    expect(content).toContain(
      "border-bottom: 1px dashed var(--muted, #71717a);"
    );
  });
});
