import { test, expect, type Page } from "@playwright/test";

// Detect any uncontained element overflowing the horizontal viewport boundary
function findOverflowingElements(page: Page) {
  return page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const badElements: {
      tag: string;
      className: string;
      right: number;
      clientWidth: number;
    }[] = [];

    document.querySelectorAll("*").forEach((el) => {
      // Skip elements contained inside an explicitly clipped or scrollable horizontal container
      let parent = el.parentElement;
      let isContained = false;
      while (
        parent &&
        parent !== document.body &&
        parent !== document.documentElement
      ) {
        const style = window.getComputedStyle(parent);
        if (
          style.overflowX === "hidden" ||
          style.overflowX === "auto" ||
          style.overflowX === "scroll" ||
          style.overflowX === "clip" ||
          style.overflow === "hidden" ||
          style.overflow === "clip"
        ) {
          isContained = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (isContained) return;

      const rect = el.getBoundingClientRect();
      // Allow small 1px subpixel tolerance
      if (rect.right > clientWidth + 1) {
        badElements.push({
          tag: el.tagName.toLowerCase(),
          className:
            typeof el.className === "string" ? el.className.slice(0, 50) : "",
          right: Math.round(rect.right),
          clientWidth,
        });
      }
    });

    return badElements;
  });
}

test.describe("Visual Regression & Drift Detection", () => {
  test("Case Study components layout and visibility", async ({ page }) => {
    // Emulate reduced motion to disable JS transitions/animations
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Wait for the hydration and masonry layout to be stable
    await page.goto("/");

    // Wait for the Pretext measuring text to finish on ALL cards
    await page.waitForFunction(() => {
      const elements = Array.from(document.querySelectorAll(".text-\\[9px\\]"));
      if (elements.length === 0) return false;
      return elements.every(
        (el) => el.textContent && !el.textContent.includes("MEASURING...")
      );
    });

    // Verify the case studies section is rendered and visible
    const caseStudies = page.locator("#case-studies");
    await expect(caseStudies).toBeVisible();

    // Verify all featured project cards are hydrated, visible, and bounded
    const cardElements = await page.getByTestId("featured-project-card").all();
    expect(cardElements.length).toBeGreaterThan(0);

    for (const card of cardElements) {
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }
  });

  test("Layout constraints drift detection", async ({ page }) => {
    // Emulate reduced motion to disable JS transitions/animations
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Inject the global flag for the client so the component enables the checks
    await page.addInitScript(() => {
      (
        window as unknown as { __PLAYWRIGHT_TEST__?: boolean }
      ).__PLAYWRIGHT_TEST__ = true;
    });

    await page.goto("/");
    // Wait for the Pretext measuring text to finish on ALL cards
    await page.waitForFunction(() => {
      const elements = Array.from(document.querySelectorAll(".text-\\[9px\\]"));
      if (elements.length === 0) return false;
      return elements.every(
        (el) => el.textContent && !el.textContent.includes("MEASURING...")
      );
    });

    // Give a brief moment for layout/scroll coordinates to settle completely
    await page.waitForTimeout(500);

    // Wait for the current project dossiers to be present and hydrated.
    await page.waitForSelector('[data-testid="featured-project-card"]');

    const cards = await page.getByTestId("featured-project-card").all();
    for (const card of cards) {
      const title = await card.getByRole("heading").textContent();
      const overflows = await card.evaluate(
        (element) => element.scrollWidth > element.clientWidth + 1
      );
      expect(
        overflows,
        `Project dossier '${title}' overflows its container`
      ).toBe(false);
    }
  });

  const viewports = [
    { name: "Mobile 320px Squeeze", width: 320, height: 568 },
    { name: "Mobile 375px", width: 375, height: 667 },
    { name: "Tablet 768px", width: 768, height: 1024 },
    { name: "Desktop 1440px", width: 1440, height: 900 },
  ];

  // Routes carried through the full multi-viewport overflow matrix. Patrol
  // Shift joins the landing page here per Issue #756 (M10 launch QA).
  // Trial & Error's hand joins per #945 (T&E-UX-03): it is launched from its
  // cabinet, and the fanned hand must scroll inside its own container.
  const overflowRoutes: {
    name: string;
    path: string;
    ready: string;
    launch?: boolean;
  }[] = [
    { name: "Landing", path: "/", ready: "body" },
    {
      name: "Patrol Shift",
      path: "/patrol",
      ready: '[data-testid="patrol-shift-container"]',
    },
    {
      name: "Trial & Error hand",
      path: "/arcade/trial-and-error",
      ready: '[data-testid="hand"]',
      launch: true,
    },
  ];

  for (const vp of viewports) {
    for (const route of overflowRoutes) {
      test(`Horizontal Overflow Detector across DOM on ${vp.name} (${route.name})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path);
        await page.waitForLoadState("domcontentloaded");
        if (route.launch) {
          await expect(async () => {
            const launch = page.getByRole("button", {
              name: /Launch Cabinet/i,
            });
            if (await launch.isVisible()) await launch.click();
            await expect(page.locator(route.ready)).toBeVisible({
              timeout: 3000,
            });
          }).toPass({ timeout: 15000 });
        }
        await page.waitForSelector(route.ready, { timeout: 15000 });

        const overflowingElements = await findOverflowingElements(page);

        expect(
          overflowingElements,
          `Horizontal overflow detected on ${route.name} at viewport ${vp.name} (${vp.width}x${vp.height})`
        ).toEqual([]);
      });
    }
  }

  // #1636: with the root font size at 200%, the mobile navbar actions and the
  // footer utility row wrap instead of pushing past a 320px viewport.
  test("Horizontal Overflow Detector at 200% text on Mobile 320px Squeeze (Landing)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });

    expect(
      await findOverflowingElements(page),
      "Horizontal overflow detected on Landing at 320px with 200% text"
    ).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      )
    ).toBeLessThanOrEqual(0);
  });
});
