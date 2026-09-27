import { describe, it, expect } from "vitest";
import {
  decodeCodeEntities,
  escapeCodeText,
  getCodeTokenClass,
  tokenizeCode,
  highlightCodeBlocks,
  SUPPORTED_CODE_LANGUAGES,
} from "@/lib/blog/syntax-highlighter";

describe("Blog Syntax Highlighter (Ticket #1146)", () => {
  describe("Entity decoding & escaping", () => {
    it("decodes named HTML entities", () => {
      expect(decodeCodeEntities("&amp;&lt;&gt;&quot;&apos;&nbsp;")).toBe(
        `&<>"'\u00a0`
      );
    });

    it("decodes numeric decimal and hex entities", () => {
      expect(decodeCodeEntities("&#65;&#x42;&#x43;")).toBe("ABC");
    });

    it("preserves invalid or out-of-range numeric entities", () => {
      expect(decodeCodeEntities("&#xD800;&#x110000;")).toBe(
        "&#xD800;&#x110000;"
      );
    });

    it("escapes special HTML characters", () => {
      expect(escapeCodeText(`<div class="test">'hello' & "world"</div>`)).toBe(
        "&lt;div class=&quot;test&quot;&gt;&#39;hello&#39; &amp; &quot;world&quot;&lt;/div&gt;"
      );
    });
  });

  describe("Token classification", () => {
    it("classifies TypeScript keywords, literals, and operators", () => {
      expect(getCodeTokenClass("const", "typescript")).toBe("keyword");
      expect(getCodeTokenClass("interface", "ts")).toBe("keyword");
      expect(getCodeTokenClass("null", "typescript")).toBe("literal");
      expect(getCodeTokenClass("undefined", "typescript")).toBe("literal");
      expect(getCodeTokenClass("42", "typescript")).toBe("number");
      expect(getCodeTokenClass('"hello"', "typescript")).toBe("string");
      expect(getCodeTokenClass("// comment", "typescript")).toBe("comment");
      expect(getCodeTokenClass("===", "typescript")).toBe("operator");
      expect(getCodeTokenClass("fooBar", "typescript")).toBeNull();
    });

    it("classifies Rust keywords and literals", () => {
      expect(getCodeTokenClass("fn", "rust")).toBe("keyword");
      expect(getCodeTokenClass("pub", "rs")).toBe("keyword");
      expect(getCodeTokenClass("struct", "rust")).toBe("keyword");
      expect(getCodeTokenClass("Some", "rust")).toBe("literal");
      expect(getCodeTokenClass("None", "rust")).toBe("literal");
      expect(getCodeTokenClass("Ok", "rust")).toBe("literal");
    });
  });

  describe("tokenizeCode", () => {
    it("tokenizes a TypeScript function declaration with classes", () => {
      const code = 'const msg: string = "hello"; // greeting';
      const output = tokenizeCode(code, "typescript");

      expect(output).toContain(
        '<span class="blog-code-token--keyword">const</span>'
      );
      expect(output).toContain(
        '<span class="blog-code-token--string">&quot;hello&quot;</span>'
      );
      expect(output).toContain(
        '<span class="blog-code-token--comment">// greeting</span>'
      );
      expect(output).toContain(
        '<span class="blog-code-token--operator">=</span>'
      );
    });

    it("tokenizes a Rust snippet", () => {
      const code = "pub fn run() -> Option<u32> { Some(42) }";
      const output = tokenizeCode(code, "rust");

      expect(output).toContain(
        '<span class="blog-code-token--keyword">pub</span>'
      );
      expect(output).toContain(
        '<span class="blog-code-token--keyword">fn</span>'
      );
      expect(output).toContain(
        '<span class="blog-code-token--literal">Some</span>'
      );
      expect(output).toContain(
        '<span class="blog-code-token--number">42</span>'
      );
    });
  });

  describe("highlightCodeBlocks", () => {
    it("wraps code inside supported pre/code blocks with token spans", () => {
      const input =
        '<pre><code class="language-typescript">const x = 1;</code></pre>';
      const output = highlightCodeBlocks(input);

      expect(output).toContain('class="blog-code-token--keyword"');
      expect(output).toContain("const");
      expect(output).toContain('class="blog-code-token--number"');
      expect(output).toContain("1");
    });

    it("leaves unsupported languages untouched", () => {
      const input =
        '<pre><code class="language-brainfuck">+++[.-]</code></pre>';
      const output = highlightCodeBlocks(input);

      expect(output).toBe(input);
    });

    it("leaves code blocks without language tag untouched", () => {
      const input = "<pre><code>plain code</code></pre>";
      const output = highlightCodeBlocks(input);

      expect(output).toBe(input);
    });

    it("only reads a language from class attributes", () => {
      const input =
        '<pre id="language-typescript"><code aria-label="language-rust">const x = 1;</code></pre>';
      expect(highlightCodeBlocks(input)).toBe(input);
    });

    it("keeps escaped markup as code text after highlighting", () => {
      const input =
        '<pre><code class="language-typescript">const x = &lt;img src=x onerror=alert(1)&gt;;</code></pre>';
      const output = highlightCodeBlocks(input);
      const host = document.createElement("div");
      host.innerHTML = output;
      expect(host.querySelector("img")).toBeNull();
      expect(host.querySelector("code")?.textContent).toBe(
        "const x = <img src=x onerror=alert(1)>;"
      );
    });

    it("leaves already-structured nested HTML inside code untouched", () => {
      const input =
        '<pre><code class="language-typescript"><span>nested</span></code></pre>';
      const output = highlightCodeBlocks(input);

      expect(output).toBe(input);
    });

    it("recognizes all SUPPORTED_CODE_LANGUAGES set entries", () => {
      expect(SUPPORTED_CODE_LANGUAGES.has("typescript")).toBe(true);
      expect(SUPPORTED_CODE_LANGUAGES.has("javascript")).toBe(true);
      expect(SUPPORTED_CODE_LANGUAGES.has("rust")).toBe(true);
    });
  });
});
