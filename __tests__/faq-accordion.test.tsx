import fs from "node:fs";
import path from "node:path";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { FAQAccordion } from "@/components/ui/FAQAccordion";
import { CRF_FAQ, LASER_LOON_FAQ, SCHEDULE_FAQ } from "@/lib/faq-content";
import { getFAQPageNode } from "@/lib/seo";

const PAGES = [
  ["/schedule", SCHEDULE_FAQ],
  ["/crf", CRF_FAQ],
  ["/work/laser-loon", LASER_LOON_FAQ],
] as const;

function readSchema(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]');
  return JSON.parse(script?.textContent ?? "{}") as {
    "@graph": Array<{
      "@type": string;
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>;
    }>;
  };
}

describe("FAQAccordion (#1254)", () => {
  afterEach(cleanup);

  it("getFAQPageNode maps items to Question/Answer entities", () => {
    const node = getFAQPageNode(
      [{ question: "Q?", answer: "A." }],
      "/schedule"
    ) as { "@type": string; mainEntity: Array<Record<string, unknown>> };
    expect(node["@type"]).toBe("FAQPage");
    expect(node.mainEntity[0]).toMatchObject({
      "@type": "Question",
      name: "Q?",
      acceptedAnswer: { "@type": "Answer", text: "A." },
    });
  });

  it.each(PAGES)(
    "%s: JSON-LD questions and answers match the visible DOM exactly",
    (pageUrl, items) => {
      const { container } = render(
        <FAQAccordion items={items} pageUrl={pageUrl} />
      );
      const faq = readSchema(container)["@graph"].find(
        (node) => node["@type"] === "FAQPage"
      );
      expect(faq?.mainEntity).toHaveLength(items.length);
      const triggers = screen.getAllByRole("button");
      items.forEach((item, index) => {
        expect(faq?.mainEntity[index]?.name).toBe(item.question);
        expect(faq?.mainEntity[index]?.acceptedAnswer.text).toBe(item.answer);
        expect(triggers[index]?.textContent).toContain(item.question);
        const panel = document.getElementById(
          triggers[index]!.getAttribute("aria-controls") ?? ""
        );
        expect(panel?.textContent).toBe(item.answer);
      });
    }
  );

  it("toggles on click and tracks aria-expanded", () => {
    render(<FAQAccordion items={SCHEDULE_FAQ} pageUrl="/schedule" />);
    const first = screen.getAllByRole("button")[0]!;
    const panel = document.getElementById(
      first.getAttribute("aria-controls") ?? ""
    )!;
    expect(first.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hidden).toBe(true);

    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hidden).toBe(false);

    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("false");
  });

  it("uses native buttons so Tab, Enter and Space work without custom key handlers", () => {
    render(<FAQAccordion items={SCHEDULE_FAQ} pageUrl="/schedule" />);
    for (const trigger of screen.getAllByRole("button")) {
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger.getAttribute("type")).toBe("button");
      expect(trigger.tabIndex).toBe(0);
    }
  });

  it("has zero axe violations collapsed and expanded", async () => {
    const { container } = render(
      <main>
        <FAQAccordion items={CRF_FAQ} pageUrl="/crf" />
      </main>
    );
    const options = {
      runOnly: {
        type: "tag" as const,
        values: ["wcag2a", "wcag2aa", "wcag21aa"],
      },
    };
    expect((await axe.run(container, options)).violations).toEqual([]);
    fireEvent.click(screen.getAllByRole("button")[0]!);
    expect((await axe.run(container, options)).violations).toEqual([]);
  });

  it.each([
    ["app/schedule/page.tsx", "SCHEDULE_FAQ", "/schedule"],
    ["app/crf/page.tsx", "CRF_FAQ", "/crf"],
    ["app/work/laser-loon/page.tsx", "LASER_LOON_FAQ", "/work/laser-loon"],
  ])("%s mounts the accordion with %s", (file, constant, url) => {
    const source = fs.readFileSync(path.join(process.cwd(), file), "utf8");
    expect(source).toContain(`items={${constant}}`);
    expect(source).toContain(`pageUrl="${url}"`);
  });
});
