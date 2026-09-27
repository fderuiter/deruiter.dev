import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RichNarrative } from "@/components/RichNarrative";

const mockInitialize = vi.hoisted(() => vi.fn());
const mockRender = vi.hoisted(() => vi.fn());

vi.mock("mermaid", () => ({
  default: {
    initialize: mockInitialize,
    render: mockRender,
  },
}));

const mermaidNarrative = `
  <h3>Architecture</h3>
  <pre><code class="language-mermaid">flowchart TD
    A[Raw clinical data] --> B[Validated SDTM records]
  </code></pre>
  <pre><code class="language-typescript">const result = map(data);</code></pre>
`;

describe("RichNarrative Mermaid diagrams", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mockRender.mockReset();
    mockRender.mockImplementation(async (_id: string, source: string) => ({
      svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${source}</text></svg>`,
    }));
  });

  it("renders Mermaid narrative content as an accessible diagram instead of visible source", async () => {
    render(<RichNarrative html={mermaidNarrative} />);

    await waitFor(() => {
      const diagram = screen.getByRole("img", {
        name: /architecture diagram/i,
      });
      expect(diagram.getAttribute("aria-busy")).toBe("false");
      expect(diagram.querySelector("svg")).not.toBeNull();
    });

    expect(document.querySelector("code.language-mermaid")).toBeNull();
    expect(
      document.querySelector("code.language-typescript")?.textContent
    ).toBe("const result = map(data);");
  });

  it("renders each Mermaid block independently", async () => {
    render(
      <RichNarrative
        html={`${mermaidNarrative}<pre><code class="language-mermaid">flowchart LR\nA --> B</code></pre>`}
      />
    );

    await waitFor(() => {
      expect(
        screen.getAllByRole("img", { name: /architecture diagram/i })
      ).toHaveLength(2);
    });
  });

  it("uses a fresh Mermaid SVG id for every strict-mode render invocation", async () => {
    render(
      <StrictMode>
        <RichNarrative html={mermaidNarrative} />
      </StrictMode>
    );

    await waitFor(() => {
      expect(mockRender.mock.calls.length).toBeGreaterThan(1);
    });

    const renderIds = mockRender.mock.calls.map(([id]) => id);
    expect(new Set(renderIds).size).toBe(renderIds.length);
  });

  it("contains invalid Mermaid source in an explicit fallback", async () => {
    mockRender.mockRejectedValueOnce(new Error("Invalid Mermaid syntax"));

    render(
      <RichNarrative
        html={
          '<pre><code class="language-mermaid">flowchart NOT_VALID</code></pre>'
        }
      />
    );

    await waitFor(() => {
      expect(document.querySelector("[data-mermaid-error]")).not.toBeNull();
    });

    expect(screen.getByText("Architecture diagram unavailable")).not.toBeNull();
    expect(screen.getByText("View diagram source")).not.toBeNull();
  });

  it("preserves sanitized heading, paragraph, emphasis, and list semantics after rehydration", async () => {
    const html = `
      <h2>Three properties that must be structural</h2>
      <p>Auditable systems need <strong>explicit boundaries</strong>.</p>
      <ul>
        <li>Keep the source record.
          <ul><li>Keep its provenance.</li></ul>
        </li>
      </ul>
      <h3>Validation sequence</h3>
      <ol><li>Validate the input.</li><li>Record the result.</li></ol>
      <span data-key="audit-term" data-term="audit terminology" data-definition="A test term">audit trail</span>
      <script>window.compromised = true</script>
    `;
    const { container } = render(<RichNarrative html={html} />);

    await waitFor(() => {
      expect(container.querySelector('[data-key="audit-term"]')).toBeNull();
    });

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Three properties that must be structural",
      })
    ).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 3, name: "Validation sequence" })
    ).not.toBeNull();
    expect(screen.getByText("explicit boundaries").tagName).toBe("STRONG");
    expect(container.querySelector("ul > li > ul > li")?.textContent).toBe(
      "Keep its provenance."
    );
    expect(container.querySelectorAll("ol > li")).toHaveLength(2);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).not.toContain("window.compromised");
  });

  it("tokenizes supported JS, TypeScript, and Rust while keeping unknown code literal", async () => {
    const sources = [
      {
        language: "typescript",
        source: 'const fn: string = "<img src=x onerror=alert(1)>";',
      },
      { language: "javascript", source: 'const fn = "ready";' },
      { language: "rust", source: "fn main() { let ready = true; }" },
      { language: null, source: "const plain = true;" },
      { language: "python", source: 'def launch(): return "plain"' },
    ];
    const escapeCode = (source: string) =>
      source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = sources
      .map(({ language, source }) => {
        const languageClass = language ? ` class="language-${language}"` : "";
        return `<pre><code${languageClass}>${escapeCode(source)}</code></pre>`;
      })
      .join("");
    const serverMarkup = renderToString(<RichNarrative html={html} />);
    const serverContainer = document.createElement("div");
    serverContainer.innerHTML = serverMarkup;

    expect(
      Array.from(
        serverContainer.querySelectorAll("pre code"),
        (code) => code.textContent
      )
    ).toEqual(sources.map(({ source }) => source));
    expect(
      serverContainer.querySelectorAll(".blog-code-token--keyword").length
    ).toBeGreaterThan(0);
    expect(
      serverContainer.querySelectorAll(".blog-code-token--string").length
    ).toBeGreaterThan(0);
    expect(
      serverContainer.querySelectorAll(".blog-code-token--literal").length
    ).toBeGreaterThan(0);
    const rustCode = serverContainer.querySelectorAll("pre code")[2];
    const rustKeywordTexts = Array.from(
      rustCode.querySelectorAll(".blog-code-token--keyword"),
      (token) => token.textContent
    );
    expect(rustKeywordTexts).toContain("fn");
    expect(rustKeywordTexts).toContain("let");
    expect(rustCode.textContent).toBe(sources[2].source);
    for (const plainFnSource of [
      serverContainer.querySelectorAll("pre code")[0],
      serverContainer.querySelectorAll("pre code")[1],
    ]) {
      expect(
        Array.from(
          plainFnSource.querySelectorAll(".blog-code-token--keyword"),
          (token) => token.textContent
        )
      ).not.toContain("fn");
    }
    expect(
      serverContainer
        .querySelectorAll("pre code")[3]
        .querySelector(".blog-code-token--keyword")
    ).toBeNull();
    expect(
      serverContainer
        .querySelectorAll("pre code")[4]
        .querySelector(".blog-code-token--keyword")
    ).toBeNull();
    expect(serverContainer.querySelector("img")).toBeNull();

    const { container } = render(<RichNarrative html={html} />);
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: "Copy code to clipboard" })
      ).toHaveLength(sources.length);
    });

    expect(
      Array.from(
        container.querySelectorAll("pre code"),
        (code) => code.textContent
      )
    ).toEqual(sources.map(({ source }) => source));
    expect(screen.getByText("TYPESCRIPT")).not.toBeNull();
    expect(screen.getByText("JAVASCRIPT")).not.toBeNull();
    expect(screen.getByText("RUST")).not.toBeNull();
    expect(screen.getAllByText("CODE")).toHaveLength(1);
    expect(screen.getByText("PYTHON")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(
      container
        .querySelectorAll("pre code")[3]
        .querySelector(".blog-code-token--keyword")
    ).toBeNull();
    expect(
      container
        .querySelectorAll("pre code")[4]
        .querySelector(".blog-code-token--keyword")
    ).toBeNull();
  });
});
