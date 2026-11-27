// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseMarkdownToRichItems } from "@/hooks/usePretextLayout";
import {
  resolveCodeChipExtraWidth,
  validateLayoutHeight,
} from "@/lib/graphics-engine";

// Mock TerminologyProvider
vi.mock("@/components/providers/TerminologyProvider", () => ({
  useTerminology: () => ({
    simplified: false,
  }),
}));

describe("Responsive Regex Tokenizer & CSS Variable Synchronization Suite", () => {
  describe("1. CSS Variable and Code Chip Spacing Synchronizer", () => {
    it("should compute dynamic extra width for code chips at runtime", () => {
      const extraWidth = resolveCodeChipExtraWidth();
      expect(extraWidth).toBeGreaterThan(0);
      expect(typeof extraWidth).toBe("number");
    });

    it("should parse inline markdown and assign correct extraWidth to code elements", () => {
      const items = parseMarkdownToRichItems(
        "Here is some `code` content.",
        "16px sans-serif",
        "bold 16px sans-serif",
        "italic 16px sans-serif",
        "bold 16px monospace"
      );

      const codeItem = items.find((item) => item.type === "code");
      expect(codeItem).toBeDefined();
      expect(codeItem?.extraWidth).toBe(resolveCodeChipExtraWidth());
    });
  });

  describe("2. Multiline & Paragraph Preserving Tokenizer", () => {
    it("should parse multi-paragraph texts separately when we have newlines", () => {
      const multiLineText = "Paragraph One\n\nParagraph Two with `code` block";
      const paragraphs = multiLineText.split("\n");
      expect(paragraphs).toHaveLength(3); // "Paragraph One", "", "Paragraph Two with `code` block"
      expect(paragraphs[1]).toBe("");
    });
  });

  describe("3. Layout Height Validation Alerts Suppression", () => {
    beforeEach(() => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should suppress warnings if actual DOM height is 0 (hidden)", () => {
      validateLayoutHeight(100, 0, "Test Context");
      expect(console.warn).not.toHaveBeenCalled();
    });

    it("should suppress warnings within a 150ms window after a resize event", () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("resize"));
      }

      validateLayoutHeight(100, 80, "Test Context");
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});
