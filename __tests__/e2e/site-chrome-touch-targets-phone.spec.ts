import { test, expect, type Page } from "@playwright/test";

// The phone projects run this file (#2365). Shared site chrome must be
// tappable on a coarse pointer: 44px is Apple's minimum touch target, and the
// 2026-10-25 usability audit measured these links at 16 to 34px (#2894).
const MIN_TARGET_PX = 44;

/** Heights of every visible link or button that matches the selector. */
async function heights(page: Page, selector: string) {
  return page.locator(selector).evaluateAll((els) =>
    els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && getComputedStyle(el).visibility !== "hidden";
      })
      .map((el) => ({
        label: (el.textContent || el.getAttribute("aria-label") || "")
          .trim()
          .slice(0, 40),
        height: Math.round(el.getBoundingClientRect().height),
      }))
  );
}

function expectAllTappable(found: { label: string; height: number }[]) {
  expect(found.length).toBeGreaterThan(0);
  const small = found.filter((t) => t.height < MIN_TARGET_PX);
  expect(small, `targets under ${MIN_TARGET_PX}px`).toEqual([]);
}

test.describe("site chrome touch targets on a phone (#2894)", () => {
  test("footer links and buttons", async ({ page }) => {
    await page.goto("/blog");
    expectAllTappable(
      await heights(
        page,
        "footer ul a, footer a, footer [data-testid='footer-utility-row'] button"
      )
    );
  });

  test("Duck button in the footer ticker", async ({ page }) => {
    await page.goto("/blog");
    expectAllTappable(
      await heights(page, "[data-testid='footer-status-ticker'] button")
    );
  });

  test("breadcrumbs and the navbar brand", async ({ page }) => {
    await page.goto("/arcade/laser-loon");
    expectAllTappable(
      await heights(page, "nav[aria-label='Breadcrumb'] a, header a[href='/']")
    );
  });

  test("platform back link", async ({ page }) => {
    await page.goto("/platform/operations");
    expectAllTappable(await heights(page, "main header a[href='/platform']"));
  });
});
