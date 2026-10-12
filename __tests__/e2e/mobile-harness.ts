import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** The widths of the mobile matrix (ADR 0061): floor, phone, tablet, desktop. */
const MATRIX_WIDTHS = [320, 375, 768, 1440] as const;

/** Viewport height used for matrix captures. */
const MATRIX_HEIGHT = 800;

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

/** One matrix capture: the width, the file, and whether the cabinet was immersive. */
export interface MatrixShot {
  width: number;
  file: string;
  immersive: boolean;
}

/**
 * Captures the page at each matrix width into `dir`, named by the state the
 * page is in at that width: `<slug>-<width>-immersive.png` or
 * `<slug>-<width>-windowed.png`. The viewport the page started at is restored.
 *
 * @param page - The page to capture, already navigated and settled.
 * @param slug - A short name for the page, e.g. `trial-and-error`.
 * @param dir - The directory to write into. Created if missing.
 * @returns One entry per width, in matrix order.
 */
export async function captureMatrix(
  page: Page,
  slug: string,
  dir: string
): Promise<MatrixShot[]> {
  fs.mkdirSync(dir, { recursive: true });
  const original = page.viewportSize();
  const shots: MatrixShot[] = [];
  for (const width of MATRIX_WIDTHS) {
    await page.setViewportSize({ width, height: MATRIX_HEIGHT });
    await page.waitForTimeout(250);
    const immersive = await page.evaluate(
      () => document.querySelector('[data-immersive="true"]') !== null
    );
    const file = path.join(
      dir,
      `${slug}-${width}-${immersive ? "immersive" : "windowed"}.png`
    );
    await page.screenshot({ path: file });
    shots.push({ width, file, immersive });
  }
  if (original) await page.setViewportSize(original);
  return shots;
}
