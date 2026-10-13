import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** A viewport size for a matrix capture. */
interface MatrixSize {
  width: number;
  height: number;
}

/**
 * The phone and desktop matrix (ADR 0061): floor, phone, tablet, desktop, at
 * a fixed height.
 */
const MATRIX_SIZES: readonly MatrixSize[] = [320, 375, 768, 1440].map(
  (width) => ({ width, height: 800 })
);

/**
 * The iPad matrix (ADR 0061): every tablet size in portrait and in landscape,
 * as the tablet projects in playwright.config.ts run them.
 */
export const TABLET_MATRIX: readonly MatrixSize[] = [
  { width: 744, height: 1133 },
  { width: 1133, height: 744 },
  { width: 820, height: 1180 },
  { width: 1180, height: 820 },
  { width: 834, height: 1194 },
  { width: 1194, height: 834 },
  { width: 1024, height: 1366 },
  { width: 1366, height: 1024 },
];

/**
 * Fails when any rendered element, or the document itself, is wider than the
 * viewport. Elements inside a clipped ancestor are reported too, so a clipped
 * overflow still shows up here. Elements inside a horizontal scroller
 * (`overflow-x: auto` or `scroll`, such as a card hand) are skipped: reaching
 * them by swiping is the intended design.
 *
 * @param page - The page under test, already at the size to check.
 */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const report = await page.evaluate(() => {
    const viewport = document.documentElement.clientWidth;
    const offenders: string[] = [];
    for (const element of Array.from(
      document.querySelectorAll<HTMLElement>("body *")
    )) {
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      let scroller = element.parentElement;
      while (scroller) {
        const overflowX = window.getComputedStyle(scroller).overflowX;
        if (overflowX === "auto" || overflowX === "scroll") break;
        scroller = scroller.parentElement;
      }
      if (scroller) continue;
      if (box.right > viewport + 0.5) {
        const id = element.id ? `#${element.id}` : "";
        const cls =
          typeof element.className === "string"
            ? element.className.split(" ").slice(0, 2).join(".")
            : "";
        offenders.push(
          `${element.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ""} right=${Math.round(box.right)}`
        );
      }
      if (offenders.length >= 10) break;
    }
    return {
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      offenders,
    };
  });

  expect(
    report.scrollWidth,
    `document scrollWidth should not exceed the ${report.viewport}px viewport`
  ).toBeLessThanOrEqual(report.viewport);
  expect(report.offenders, "elements wider than the viewport").toEqual([]);
}

/** One matrix capture: the size, the file, and whether the cabinet was immersive. */
interface MatrixShot extends MatrixSize {
  file: string;
  immersive: boolean;
}

/**
 * Captures the page at each size into `dir`, named by the size and the state
 * the page is in there: `<slug>-<width>x<height>-immersive.png` or
 * `<slug>-<width>x<height>-windowed.png`. The viewport the page started at is
 * restored.
 *
 * @param page - The page to capture, already navigated and settled.
 * @param slug - A short name for the page, e.g. `trial-and-error`.
 * @param dir - The directory to write into. Created if missing.
 * @param sizes - The sizes to capture. Defaults to the phone and desktop matrix.
 * @returns One entry per size, in the order given.
 */
export async function captureMatrix(
  page: Page,
  slug: string,
  dir: string,
  sizes: readonly MatrixSize[] = MATRIX_SIZES
): Promise<MatrixShot[]> {
  fs.mkdirSync(dir, { recursive: true });
  const original = page.viewportSize();
  const shots: MatrixShot[] = [];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.waitForTimeout(250);
    const immersive = await page.evaluate(
      () => document.querySelector('[data-immersive="true"]') !== null
    );
    const file = path.join(
      dir,
      `${slug}-${size.width}x${size.height}-${immersive ? "immersive" : "windowed"}.png`
    );
    await page.screenshot({ path: file });
    shots.push({ ...size, file, immersive });
  }
  if (original) await page.setViewportSize(original);
  return shots;
}
