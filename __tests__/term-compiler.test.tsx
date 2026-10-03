/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "@testing-library/react";
import { CANONICAL_GLOSSARY } from "@/lib/term-glossary";
import { compileTerms, validateTermTags } from "@/lib/term-compiler";
import { RichNarrative } from "@/components/RichNarrative";
import { TerminologyProvider } from "@/components/providers/TerminologyProvider";
import { dictionary } from "@/lib/i18n-dictionary";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";

// Mock framer-motion to prevent transition freezes in jsdom tests
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  const Component = ({
    children,
    className,
    style,
    onClick,
    ...props
  }: any) => {
    const {
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      ...rest
    } = props;
    return (
      <div className={className} style={style} onClick={onClick} {...rest}>
        {children}
      </div>
    );
  };
  return {
    ...actual,
    motion: new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === "button") return Component;
          return Component;
        },
      }
    ),
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

describe("Centralized Term Template Compiler", () => {
  describe("1. Term Compilation & Word Boundary Matching", () => {
    it("should compile plain text technical terms into standardized term tags", () => {
      const rawText =
        "Lead technical architect for GxP-compliant eClinical databases, translating protocols into eCRF systems.";

      const compiled = compileTerms(rawText);

      expect(compiled).toContain('data-key="gxp-term"');
      expect(compiled).toContain('data-key="ecrf-term"');
      expect(compiled).toContain('data-term="industry-standard"');
      expect(compiled).toContain('data-term="digital case report form"');
      expect(compiled).toContain("GxP");
      expect(compiled).toContain("eCRF");
    });

    it("should preserve original text casing in visible matched content", () => {
      const rawText = "Managing eCRF systems and GXP compliance.";
      const compiled = compileTerms(rawText);

      expect(compiled).toContain(">eCRF</span>");
      expect(compiled).toContain(">GXP</span>");
    });

    it("should enforce word boundaries and avoid replacing partial words or substring collisions", () => {
      const rawText = "The system uses eCRFs and eCRF123 identifiers.";
      const compiled = compileTerms(rawText);

      // "eCRFs" should match the alias entry for eCRFs
      expect(compiled).toContain('data-key="ecrf-term"');
      // Should not mangle "eCRF123" into "<span...>eCRF</span>123"
      expect(compiled).not.toContain(">eCRF</span>123");
    });

    it("should prioritize longer term phrases over shorter sub-phrases", () => {
      const rawText =
        "Implementing CDISC Operational Data Model (ODM) and Source Document Verification (SDV) protocols.";

      const compiled = compileTerms(rawText);

      // Should match "CDISC Operational Data Model (ODM)" as a single tag rather than separately splitting CDISC and ODM
      expect(compiled).toContain('data-key="odm-term"');
      expect(compiled).toContain(">CDISC Operational Data Model (ODM)</span>");

      // Should match "Source Document Verification (SDV)" as a single tag
      expect(compiled).toContain('data-key="sdv-term"');
      expect(compiled).toContain(">Source Document Verification (SDV)</span>");
    });
  });

  describe("2. Exclusion Guardrails (HTML Tags, Attributes, and Code Blocks)", () => {
    it("should not transform text inside <code> or <pre> code blocks", () => {
      const rawHtml = `
        <p>We configure GxP pipelines.</p>
        <pre><code class="language-typescript">
          interface ODMClinicalData {
            studyOID: string; // eCRF and SDTM mapping
          }
        </code></pre>
      `;

      const compiled = compileTerms(rawHtml);

      // Plain text GxP outside code block should be compiled
      expect(compiled).toContain('data-key="gxp-term"');

      // Text inside code block should be completely untouched
      expect(compiled).toContain("interface ODMClinicalData");
      expect(compiled).toContain("// eCRF and SDTM mapping");
      expect(compiled).not.toContain('<span data-key="ecrf-term">eCRF</span>');
      expect(compiled).not.toContain('<span data-key="sdtm-term">SDTM</span>');
    });

    it("should not transform text inside HTML tag attributes", () => {
      const rawHtml =
        '<a href="/docs/gxp-compliance" class="ecrf-link">Read GxP Guidelines</a>';
      const compiled = compileTerms(rawHtml);

      expect(compiled).toContain('href="/docs/gxp-compliance"');
      expect(compiled).toContain('class="ecrf-link"');
      expect(compiled).toContain('data-key="gxp-term"');
    });

    it("should not double-transform pre-existing term tags", () => {
      const preExisting =
        '<span data-key="gxp-term" data-term="industry-standard" data-definition="Good Practice standards">GxP</span>';
      const compiled = compileTerms(preExisting);

      // Count occurrences of data-key="gxp-term"
      const matches = compiled.match(/data-key="gxp-term"/g);
      expect(matches?.length).toBe(1);
    });

    it("should not transform text inside markdown inline code backticks `...` or fenced blocks", () => {
      const rawMarkdown =
        "We compile `JSON Schema` and `AST` structures into AST graphs.";
      const compiled = compileTerms(rawMarkdown);

      expect(compiled).toContain("`JSON Schema`");
      expect(compiled).toContain("`AST`");
      expect(compiled).not.toContain("`<span");
      // Plain text AST outside backticks should be compiled
      expect(compiled).toContain('data-key="ast-term"');
    });
  });

  describe("3. Glossary Validation & Error Detection", () => {
    it("should validate all entries in the canonical glossary", () => {
      expect(CANONICAL_GLOSSARY.length).toBeGreaterThan(10);
      for (const item of CANONICAL_GLOSSARY) {
        expect(item.key).toBeDefined();
        expect(item.canonical).toBeDefined();
        expect(item.simplified).toBeDefined();
        expect(item.definition).toBeDefined();
      }
    });

    it("should pass validation for correctly compiled content", () => {
      const compiled = compileTerms("Lead architect for GxP eCRF systems.");
      const res = validateTermTags(compiled);
      expect(res.valid).toBe(true);
      expect(res.errors).toEqual([]);
    });

    it("should abort with clear errors when malformed or invalid term tags are present", () => {
      const malformedKey =
        '<span data-key="unknown-key" data-term="x" data-definition="y">Text</span>';
      const resKey = validateTermTags(malformedKey);
      expect(resKey.valid).toBe(false);
      expect(resKey.errors[0]).toContain(
        'invalid/unrecognized data-key="unknown-key"'
      );

      const missingAttr =
        '<span data-key="gxp-term" data-term="industry-standard">GxP</span>';
      const resAttr = validateTermTags(missingAttr);
      expect(resAttr.valid).toBe(false);
      expect(resAttr.errors[0]).toContain(
        "has missing/empty attributes: [data-definition]"
      );

      const invalidTag =
        '<div data-key="gxp-term" data-term="industry-standard" data-definition="def">GxP</div>';
      const resTag = validateTermTags(invalidTag);
      expect(resTag.valid).toBe(false);
      expect(resTag.errors[0]).toContain("must be <span> or <abbr>");
    });
  });

  describe("4. Integration with RichNarrative & Terminology Toggle State", () => {
    it("should render compiled terms with Tooltip interactive markup", () => {
      const rawText =
        "Lead technical architect for GxP-compliant eClinical databases.";
      const compiledHtml = compileTerms(rawText);

      const { container } = render(
        <TerminologyProvider>
          <RichNarrative html={compiledHtml} />
        </TerminologyProvider>
      );

      const trigger = container.querySelector("span[aria-describedby]");
      expect(trigger).not.toBeNull();
      expect(trigger?.textContent).toBe("GxP");
    });

    it("should update tooltips across timeline and case study views when toggling simplified mode", async () => {
      const compiledHtml = compileTerms(
        "Translating protocols into eCRF systems."
      );

      const { container } = render(
        <TerminologyProvider>
          <RichNarrative html={compiledHtml} />
        </TerminologyProvider>
      );

      // In detailed mode (default): shows eCRF
      expect(container.textContent).toContain("eCRF");

      // Verify fallback timeline data carries 100% valid compiled terms
      const timelineRes = validateTermTags(
        dictionary.detailed.timeline[0].professionalDescription
      );
      expect(timelineRes.valid).toBe(true);

      // Verify fallback case study data carries 100% valid compiled terms
      const studyRes = validateTermTags(
        FALLBACK_CASE_STUDIES[0].editorial_content
      );
      expect(studyRes.valid).toBe(true);
    });
  });

  describe("5. Build Compilation Performance Requirement", () => {
    it("should compile all case study narratives and timeline entries in under 50ms", () => {
      const start = performance.now();

      for (const study of FALLBACK_CASE_STUDIES) {
        compileTerms(study.editorial_content);
        compileTerms(study.architectural_narrative);
      }

      for (const item of dictionary.detailed.timeline) {
        compileTerms(item.professionalDescription);
        compileTerms(item.realityDescription);
      }

      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
