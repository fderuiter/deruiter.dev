import { expect, test } from "@playwright/test";
import path from "path";

test.describe("Case-study architecture diagrams", () => {
  test.describe.configure({ mode: "serial" });

  test("renders the clinical data mapper architecture as a readable SVG with screenshot verification", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/case-studies/clinical-data-mapper", {
      waitUntil: "domcontentloaded",
    });

    const diagram = page
      .getByRole("img", { name: /architecture diagram/i })
      .first();

    await expect(async () => {
      await expect(diagram).toBeVisible();
      await expect(diagram.locator("svg")).toBeVisible();
    }).toPass({ timeout: 15000 });

    await expect(page.locator("code.language-mermaid")).toHaveCount(0);
    await expect(diagram.locator("svg")).toContainText("Streaming SAX Lexer");

    // Accessibility & container layout checks
    const srDescription = diagram.locator(".sr-only");
    await expect(srDescription).toBeAttached();
    await expect(srDescription).toContainText("Mermaid source alternative:");
    await expect(srDescription).toContainText("Streaming SAX Lexer");

    await expect(diagram).toHaveClass(/overflow-x-auto/);

    const geometry = await diagram.evaluate((container) => {
      const svg = container.querySelector("svg");
      if (!svg) return null;

      const containerRect = container.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();
      const labelText = svg.textContent?.trim() ?? "";

      return {
        containerWidth: containerRect.width,
        scrollWidth: container.scrollWidth,
        svgHeight: svgRect.height,
        svgWidth: svgRect.width,
        labelText,
      };
    });

    expect(geometry).not.toBeNull();
    expect(geometry?.svgWidth).toBeGreaterThan(0);
    expect(geometry?.svgHeight).toBeGreaterThan(0);
    expect(geometry?.scrollWidth).toBeGreaterThanOrEqual(
      Math.ceil(geometry?.svgWidth ?? 0)
    );
    expect(geometry?.containerWidth).toBeGreaterThan(0);
    expect(geometry?.labelText).toContain("Streaming SAX Lexer");

    // Capture visual screenshot for evidence review
    const screenshotPath = isMobile
      ? "/tmp/case-study-diagram-mobile.png"
      : "/tmp/case-study-diagram-desktop.png";
    await diagram.screenshot({ path: screenshotPath });
  });

  test("renders multiple diagrams on a single case study page independently without ID collision", async ({
    page,
  }) => {
    // Lambda Wave has 2 Mermaid diagrams
    await page.goto("/case-studies/lambda-wave", {
      waitUntil: "domcontentloaded",
    });

    const diagrams = page.locator("[data-mermaid-diagram]");
    await expect(async () => {
      await expect(diagrams).toHaveCount(2);
      await expect(diagrams.nth(0).locator("svg")).toBeVisible();
      await expect(diagrams.nth(1).locator("svg")).toBeVisible();
    }).toPass({ timeout: 15000 });

    const svg0 = await diagrams.nth(0).locator("svg").innerHTML();
    const svg1 = await diagrams.nth(1).locator("svg").innerHTML();
    expect(svg0).not.toEqual(svg1);
  });

  test("pages without Mermaid diagrams do not render raw code or error blocks", async ({
    page,
  }) => {
    const requestedUrls: string[] = [];
    page.on("request", (request) => requestedUrls.push(request.url()));

    // Every case study now carries an architecture diagram (#928), so this
    // uses a blog dispatch: the same RichNarrative renderer, no Mermaid source.
    await page.goto("/blog/the-cost-of-being-wrong-quietly", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("article").first()).toBeVisible();

    await expect(page.locator("[data-mermaid-diagram]")).toHaveCount(0);
    await expect(page.locator("[data-mermaid-error]")).toHaveCount(0);
    await expect(page.locator("code.language-mermaid")).toHaveCount(0);
    expect(
      requestedUrls.some((url) => /mermaid/i.test(new URL(url).pathname))
    ).toBe(false);
  });

  test("rejects invalid syntax with strict Mermaid security before it can affect an article", async ({
    page,
  }) => {
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({
      path: require.resolve("mermaid/dist/mermaid.min.js"),
    });

    const rejected = await page.evaluate(async () => {
      const mermaid = (
        window as unknown as { mermaid: typeof import("mermaid").default }
      ).mermaid;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
      });
      try {
        await mermaid.render(
          "invalid-case-study-diagram",
          "flowchart NOT_VALID",
          document.body
        );
        return false;
      } catch {
        return true;
      }
    });

    expect(rejected).toBe(true);
  });
});
