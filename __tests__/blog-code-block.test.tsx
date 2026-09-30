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
import {
  A11yProvider,
  LiveAnnouncer,
} from "@/components/providers/A11yProvider";

describe("CodeBlock Component (Ticket #1059)", () => {
  const originalExecCommand = Object.getOwnPropertyDescriptor(
    document,
    "execCommand"
  );

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
    if (originalExecCommand) {
      Object.defineProperty(document, "execCommand", originalExecCommand);
    } else {
      Reflect.deleteProperty(document, "execCommand");
    }
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

  it("announces copy success through the global live announcer", async () => {
    render(
      <A11yProvider announcer={new LiveAnnouncer()}>
        <CodeBlock language="typescript" code="console.log('test');">
          <code>{"console.log('test');"}</code>
        </CodeBlock>
      </A11yProvider>
    );

    const politeRegion = document.querySelector('[aria-live="polite"]');
    expect(politeRegion?.textContent).toBe("");

    fireEvent.click(
      screen.getByRole("button", { name: /copy code to clipboard/i })
    );

    await waitFor(() => {
      expect(politeRegion?.textContent).toBe("Code copied to clipboard");
    });
  });

  it("falls back to execCommand when the Clipboard API is unavailable", async () => {
    Object.assign(navigator, { clipboard: undefined });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: execCommand,
      configurable: true,
      writable: true,
    });

    render(
      <CodeBlock language="bash" code="npm test">
        <code>npm test</code>
      </CodeBlock>
    );

    fireEvent.click(
      screen.getByRole("button", { name: /copy code to clipboard/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/copied!/i)).toBeDefined();
    });
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("announces a failed copy assertively and keeps the copy label", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });
    Object.defineProperty(document, "execCommand", {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
      writable: true,
    });

    render(
      <A11yProvider announcer={new LiveAnnouncer()}>
        <CodeBlock language="bash" code="npm test">
          <code>npm test</code>
        </CodeBlock>
      </A11yProvider>
    );

    fireEvent.click(
      screen.getByRole("button", { name: /copy code to clipboard/i })
    );

    const assertiveRegion = document.querySelector('[aria-live="assertive"]');
    await waitFor(() => {
      expect(assertiveRegion?.textContent).toMatch(/^Failed to copy code: /);
    });
    expect(screen.queryByText(/copied!/i)).toBeNull();
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
