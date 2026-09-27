// @vitest-environment jsdom
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CodeBlock } from "@/components/blog/CodeBlock";
import { RichNarrative } from "@/components/RichNarrative";

describe("CodeBlock Component (Ticket #1059)", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders code block with language badge", () => {
    render(
      <CodeBlock
        language="typescript"
        code="const answer: number = 42;"
        preProps={{
          tabIndex: 0,
          role: "region",
          "aria-label": "Code sample 1",
        }}
      >
        <code className="language-typescript">const answer: number = 42;</code>
      </CodeBlock>
    );

    expect(screen.getByText("TYPESCRIPT")).toBeDefined();
    const pre = screen.getByRole("region", { name: "Code sample 1" });
    expect(pre.getAttribute("tabindex")).toBe("0");
    expect(pre.textContent).toContain("const answer: number = 42;");
  });

  it("copies code to clipboard when copy button is clicked", async () => {
    render(
      <CodeBlock language="rust" code={'fn main() { println!("Hello"); }'}>
        <code>fn main() &#123; println!(&quot;Hello&quot;); &#125;</code>
      </CodeBlock>
    );

    const copyButton = screen.getByRole("button", {
      name: /copy code to clipboard/i,
    });
    expect(copyButton).toBeDefined();

    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'fn main() { println!("Hello"); }'
    );

    await waitFor(() => {
      expect(screen.getByText(/copied!/i)).toBeDefined();
    });
  });

  it("announces copy status via ARIA live region", async () => {
    render(
      <CodeBlock language="typescript" code="console.log('test');">
        <code>{"console.log('test');"}</code>
      </CodeBlock>
    );

    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent).toBe("");

    const copyButton = screen.getByRole("button", {
      name: /copy code to clipboard/i,
    });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(liveRegion.textContent).toBe("Code copied to clipboard");
    });
  });

  it("copies the original source after syntax tokens are rendered", async () => {
    const source = "const answer: number = 42;";
    const { container } = render(
      <RichNarrative
        html={`<pre><code class="language-typescript">${source}</code></pre>`}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Copy code to clipboard" })
      ).toBeDefined();
    });

    expect(
      container.querySelector(".blog-code-token--keyword")?.textContent
    ).toBe("const");
    fireEvent.click(
      screen.getByRole("button", { name: "Copy code to clipboard" })
    );

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(source);
  });
});
