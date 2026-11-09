import { expect, test, type Page } from "@playwright/test";
import { PUBLIC_ROUTE_REGISTRY } from "../../lib/public-routes";
import { auditAndAssert } from "./helpers/axe-audit";
import { settleSimulatorStep, waitForVisualSettle } from "./helpers/settle";

/**
 * #3484: every public registry route is scanned at a phone width and a
 * desktop width, so a new route cannot ship without an axe scan. The
 * `/platform` hub and its sub-routes are left out because their own specs
 * (`platform-*.spec.ts`) already scan them, at more widths and in more states.
 *
 * Only the route as it first renders is scanned. Interactive states (open
 * dialogs, launched cabinets, studio tools) stay in `accessibility.spec.ts`
 * and the per-feature specs.
 */
const WIDTHS = [
  { name: "phone", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

/**
 * Routes whose first view fades in through framer-motion and needs its own
 * wait before the scan, or axe measures half-transparent text as a contrast
 * failure. The same helpers serve accessibility.spec.ts.
 */
const ROUTE_SETTLE: Record<string, (page: Page) => Promise<void>> = {
  "/simulator": settleSimulatorStep,
};

const SCANNED_ROUTES = PUBLIC_ROUTE_REGISTRY.filter(
  ({ path }) => path !== "/platform" && !path.startsWith("/platform/")
);

test.describe("Registry route accessibility (#3484)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => {
      (
        window as unknown as { __PLAYWRIGHT_TEST__?: boolean }
      ).__PLAYWRIGHT_TEST__ = true;
    });
  });

  for (const { path, name } of SCANNED_ROUTES) {
    for (const viewport of WIDTHS) {
      test(`${path} (${name}) at ${viewport.width}px`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        // Background telemetry keeps some pages from reaching "networkidle"
        // (#928), so wait for the load event and the page's own heading. A
        // scan taken while a streamed route still shows its loading fallback
        // reports a missing h1 that no reader ever sees.
        const response = await page.goto(path, { waitUntil: "load" });
        expect(response?.status(), `${path} responds`).toBeLessThan(400);
        await expect(page.locator("main h1").first()).toBeVisible();
        await ROUTE_SETTLE[path]?.(page);
        await waitForVisualSettle(page);

        await auditAndAssert(
          page,
          testInfo,
          `Registry ${path} ${viewport.width}px`
        );
      });
    }
  }
});
