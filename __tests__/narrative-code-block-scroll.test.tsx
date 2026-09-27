import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { RichNarrative } from "@/components/RichNarrative";

/**
 * Narrative code blocks were silently truncated on narrow viewports.
 *
 * `@tailwindcss/typography` is not installed, so `prose prose-invert` on the
 * case-study, blog and admin-preview articles is a class name with no rules
 * behind it. Sanitized narrative HTML rendered with user-agent defaults, and
 * `pre` defaults to `white-space: pre` with `overflow: visible`.
 * `body { overflow-x: hidden }` then clipped anything wider than the viewport.
 *
 * The combination produced no scrollbar, no page overflow, and no indication
 * that text was missing -- a page-level horizontal-overflow check reports zero
 * offenders while a code block shows its first third. Measured at 320px: a
 * container of 272px holding 739px of content.
 */
describe("narrative code blocks are reachable, not clipped", () => {
  afterEach(cleanup);

  const globals = readFileSync(join(process.cwd(), "app/globals.css"), "utf-8");

  /**
   * CSS is asserted at source level because JSDOM does not apply stylesheets,
   * so a rendered `pre` reports the UA default regardless of what ships.
   */
  it("gives .prose pre a horizontal scroll affordance", () => {
    const rule = globals.match(/\.prose\s+pre\s*\{[^}]*\}/);

    expect(
      rule,
      "no `.prose pre` rule in globals.css; without one, `pre` inherits `overflow: visible` and long lines are clipped by `body { overflow-x: hidden }`"
    ).not.toBeNull();
    expect(rule![0]).toMatch(/overflow-x:\s*auto/);
  });

  it("keeps body overflow-x hidden, which is what makes the rule necessary", () => {
    // If this ever changes, the failure mode becomes a visibly broken page
    // rather than silently clipped code -- worth knowing, not worth allowing.
    expect(globals).toMatch(/body\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it("marks each code block as a focusable labelled region", async () => {
    const { container } = render(
      <RichNarrative html='<pre><code class="language-typescript">const x = 1;</code></pre>' />
    );

    await waitFor(() => {
      const pre = container.querySelector("pre");
      expect(pre, "the code block should render").not.toBeNull();
      // A scrollable region that cannot receive focus cannot be scrolled by
      // keyboard (WCAG 2.1 AA, AGENTS.md §10).
      expect(pre!.getAttribute("tabindex")).toBe("0");
      expect(pre!.getAttribute("role")).toBe("region");
      expect(pre!.getAttribute("aria-label")).toBe("Code sample 1");
      expect(pre!.className).toContain("overflow-x-auto");
      expect(pre!.className).toContain("focus-visible:ring-2");
      pre!.focus();
      expect(document.activeElement).toBe(pre);
    });
  });

  it("gives multiple code blocks unique landmark names", async () => {
    const { container } = render(
      <RichNarrative html="<pre><code>one</code></pre><pre><code>two</code></pre>" />
    );

    await waitFor(() => {
      const labels = Array.from(container.querySelectorAll("pre")).map((pre) =>
        pre.getAttribute("aria-label")
      );
      expect(labels).toEqual(["Code sample 1", "Code sample 2"]);
    });
  });

  it("does not overwrite a tabindex the content already declares", async () => {
    const { container } = render(
      <RichNarrative html='<pre tabindex="-1"><code>const x = 1;</code></pre>' />
    );

    await waitFor(() => {
      const pre = container.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre!.getAttribute("tabindex")).toBe("-1");
    });
  });

  it("leaves prose that contains no code block untouched", async () => {
    const { container } = render(
      <RichNarrative html="<p>No code here at all.</p>" />
    );

    await waitFor(() => {
      expect(container.querySelector("pre")).toBeNull();
      expect(container.textContent).toContain("No code here at all.");
    });
  });
});
