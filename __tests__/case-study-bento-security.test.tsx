// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { CaseStudyBentoCard } from "@/components/ui/CaseStudyBentoCard";
import { TerminologyProvider } from "@/components/providers/TerminologyProvider";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";

vi.mock("@/components/providers/AudioProvider", () => ({
  useAudio: () => ({
    volume: 0.5,
    muted: false,
    profile: "8-bit",
    playHover: vi.fn(),
    playSubmit: vi.fn(),
    playSuccess: vi.fn(),
    playError: vi.fn(),
    playAutocomplete: vi.fn(),
  }),
}));

/**
 * Card snippet text is data. These cases cover CodeQL alerts 19, 20 and 21:
 * the leading, inline-code and trailing branches of the card's inline parser
 * keep every visible character and never turn snippet text into elements.
 */
describe("CaseStudyBentoCard snippet text is literal", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    localStorage.clear();
  });

  async function renderSnippet(text: string): Promise<HTMLElement> {
    const study = {
      ...FALLBACK_CASE_STUDIES[0],
      editorial_content: text,
      githubStats: null,
    };
    await act(async () => {
      root.render(
        <TerminologyProvider>
          <CaseStudyBentoCard study={study} />
        </TerminologyProvider>
      );
    });
    return container;
  }

  it("keeps a generic in the text before a token (alert 19)", async () => {
    const el = await renderSnippet("Typed as Array<T> before **bold** text.");
    expect(el.textContent).toContain("Typed as Array<T> before");
    expect(el.querySelector("strong")?.textContent).toBe("bold");
    expect(el.querySelector("t")).toBeNull();
  });

  it("keeps literal source inside inline code (alert 20)", async () => {
    const el = await renderSnippet("Use `Array<T>` and `<span onclick=x>` here.");
    const codes = Array.from(el.querySelectorAll("code")).map((c) => c.textContent);
    expect(codes).toContain("Array<T>");
    expect(codes).toContain("<span onclick=x>");
    expect(el.querySelector("[onclick]")).toBeNull();
  });

  it("keeps malformed markup after the last token as text (alert 21)", async () => {
    const el = await renderSnippet("Start **here** then <img src=x onerror=alert(1) and a tail.");
    expect(el.textContent).toContain("<img src=x onerror=alert(1) and a tail.");
    expect(el.querySelector("img[onerror]")).toBeNull();
  });

  it("renders a token-free snippet unchanged", async () => {
    const el = await renderSnippet("Plain Array<T> prose with no tokens, café.");
    expect(el.textContent).toContain("Plain Array<T> prose with no tokens, café.");
  });

  it("decodes an entity once, not twice", async () => {
    const el = await renderSnippet("Escaped &amp;lt;b&amp;gt; stays literal before **x**.");
    expect(el.textContent).toContain("Escaped &lt;b&gt; stays literal");
    expect(el.querySelector("b")).toBeNull();
  });
});
