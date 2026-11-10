// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "fs";
import { join } from "path";
import { InlineMarkdown } from "@/components/ui/InlineMarkdown";
import { TerminologyProvider } from "@/components/providers/TerminologyProvider";
import { FALLBACK_CASE_STUDIES } from "@/lib/case-studies-data";

/**
 * Two defects found by rendering the site locally on 2026-09-19. Both were live
 * in production and neither was caught by any existing test, because both are
 * only visible once something actually renders.
 */

describe("case study identifiers are unique", () => {
  /**
   * `sonos-network-controller` and `equipose-randomization` both declared
   * `id: "canonical-14"`. React used the id as a list key, so the console
   * carried "Encountered two children with the same key" on every page that
   * listed case studies, and React is free to duplicate or omit a child in that
   * situation.
   */
  it("declares no duplicate ids", () => {
    const ids = FALLBACK_CASE_STUDIES.map((s) => s.id);
    const duplicates = [
      ...new Set(ids.filter((id, i) => ids.indexOf(id) !== i)),
    ];

    expect(
      duplicates,
      `duplicate ids are used as React list keys, so React may duplicate or omit a card: ${duplicates.join(", ")}`
    ).toEqual([]);
  });

  it("declares no duplicate slugs", () => {
    const slugs = FALLBACK_CASE_STUDIES.map((s) => s.slug);
    const duplicates = [
      ...new Set(slugs.filter((slug, i) => slugs.indexOf(slug) !== i)),
    ];

    expect(duplicates, "duplicate slugs collide on the route").toEqual([]);
  });
});

/**
 * `editorial_content` is Markdown; `architectural_narrative` is sanitized HTML.
 * The case-study detail page rendered the former through `RichNarrative`, an
 * HTML renderer, so every study displayed its asterisks and backticks
 * literally -- "This **TypeScript** tool reads **CDISC ODM** metadata".
 *
 * The teaser grid rendered the same field correctly the whole time, which is
 * why this survived: the homepage looked right.
 */
describe("InlineMarkdown renders the editorial_content subset", () => {
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
  });

  function render(text: string, maxLength?: number) {
    act(() => {
      root.render(
        <TerminologyProvider>
          <InlineMarkdown text={text} maxLength={maxLength} />
        </TerminologyProvider>
      );
    });
  }

  it("renders **bold** as <strong> rather than literal asterisks", () => {
    render("An enterprise-grade **TypeScript** platform.");

    expect(container.querySelector("strong")?.textContent).toBe("TypeScript");
    expect(
      container.textContent,
      "asterisks in the output mean the Markdown was not parsed"
    ).not.toContain("**");
  });

  it("renders `code` as <code> rather than literal backticks", () => {
    render("Synthesizes `double-blind schemas` for trials.");

    expect(container.querySelector("code")?.textContent).toBe(
      "double-blind schemas"
    );
    expect(
      container.textContent,
      "backticks in the output mean the Markdown was not parsed"
    ).not.toContain("`");
  });

  /**
   * The private copy this replaced defaulted to 240 characters, which is a
   * card budget. Carrying that default onto a full-width page would silently
   * clip a case study's description with an ellipsis.
   */
  it("does not truncate unless a budget is given", () => {
    const long = `Start. ${"word ".repeat(120)}End.`;
    render(long);

    expect(container.textContent).toContain("End.");
    expect(container.textContent).not.toContain("…");
  });

  it("truncates when a budget is given", () => {
    const long = `Start. ${"word ".repeat(120)}End.`;
    render(long, 60);

    expect(container.textContent).toContain("…");
    expect(container.textContent).not.toContain("End.");
  });
});

/**
 * Source-level, because the detail page is a Server Component that reaches a
 * database through `CaseStudyService` at module scope -- rendering it in JSDOM
 * would connect to whatever database the environment points at.
 */
describe("the case study detail page renders each field with the right renderer", () => {
  const source = readFileSync(
    join(process.cwd(), "app/case-studies/[slug]/page.tsx"),
    "utf-8"
  );

  it("never passes editorial_content to the HTML renderer", () => {
    expect(
      source,
      "editorial_content is Markdown; RichNarrative expects HTML and will print the markup literally"
    ).not.toMatch(/<RichNarrative[^>]*html=\{study\.editorial_content\}/);
  });

  it("renders editorial_content through InlineMarkdown", () => {
    expect(source).toMatch(
      /<InlineMarkdown[\s\S]{0,200}study\.editorial_content/
    );
  });

  it("still renders architectural_narrative as HTML", () => {
    expect(
      source,
      "architectural_narrative is sanitized HTML and must keep its HTML renderer"
    ).toMatch(/<RichNarrative[\s\S]{0,120}architectural_narrative/);
  });
});

describe("case study links to the platform demos (#3428)", () => {
  const internalHrefs = (html: string) =>
    [...html.matchAll(/href="(\/[^"#?]*)/g)].map((m) => m[1]);
  const pageExists = (href: string) => {
    const dir = join(process.cwd(), "app", ...href.split("/").filter(Boolean));
    return ["page.tsx", "page.ts", "page.mdx"].some((file) => {
      try {
        readFileSync(join(dir, file));
        return true;
      } catch {
        return false;
      }
    });
  };

  it("links five clinical case studies to one /platform page each", () => {
    for (const slug of [
      "clinical-data-mapper",
      "cadence-clinical",
      "imednet-python-sdk",
      "crf-xl",
      "equipose-randomization",
    ]) {
      const study = FALLBACK_CASE_STUDIES.find((s) => s.slug === slug);
      expect(study, slug).toBeDefined();
      const platform = internalHrefs(study!.architectural_narrative).filter(
        (href) => href.startsWith("/platform/")
      );
      expect(platform, slug).toHaveLength(1);
    }
  });

  it("points every internal narrative link at a page that exists", () => {
    for (const study of FALLBACK_CASE_STUDIES) {
      for (const href of internalHrefs(study.architectural_narrative)) {
        expect(pageExists(href), `${study.slug} → ${href}`).toBe(true);
      }
    }
  });
});
