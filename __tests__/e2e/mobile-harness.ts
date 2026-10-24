import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import path from "node:path";
import { waitForLayoutReady } from "./helpers/settle";

/** The view a cabinet with views mounts (ADR 0062), as `data-view` names it. */
export type ArcadeView = "phone" | "tablet" | "desktop";

/** Every cabinet's root. */
const CABINET = "[data-arcade-cabinet]";
/** The cabinet's stage, where the game itself renders. */
const STAGE = `${CABINET} .arcade-cabinet-stage`;
/**
 * The controls a player can press, for the touch target check. A disabled
 * control is left out: it cannot be pressed, so its size does not matter.
 */
const CONTROLS = [
  "button",
  "a[href]",
  "input:not([type=hidden])",
  "select",
  "textarea",
  "summary",
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="slider"]',
  '[role="menuitem"]',
].join(", ");
/** The axe tags the cabinet scan runs (AGENTS.md invariant 10). */
const WCAG_21_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
/** Impacts that fail the cabinet scan. */
const BLOCKING = new Set(["critical", "serious", "moderate"]);

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
 * overflow still shows up here. Screen-reader-only (`.sr-only`) content is
 * clipped by design and skipped. Elements inside a horizontal scroller
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
      // Screen-reader-only content is clipped to 1px by design.
      if (element.closest(".sr-only")) continue;
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

/**
 * The full view matrix (#2365): phones at 320, 375 and 430 and one held
 * landscape, tablets at 768 and 1024, and desktop at 1440.
 */
export const VIEW_MATRIX: readonly MatrixSize[] = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 430, height: 932 },
  { width: 852, height: 393 },
  { width: 768, height: 1024 },
  { width: 1024, height: 1366 },
  { width: 1440, height: 900 },
];

/** The view matrix a pull request captures: 320, 375, 768 and 1440. */
export const VIEW_MATRIX_PR: readonly MatrixSize[] = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
];

/**
 * One matrix capture: the size, the file, whether the cabinet was
 * immersive, and the view it mounted (null for a cabinet without views).
 */
interface MatrixShot extends MatrixSize {
  file: string;
  immersive: boolean;
  view: string | null;
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
    await waitForLayoutReady(page);
    const { immersive, view } = await page.evaluate(() => ({
      immersive: document.querySelector('[data-immersive="true"]') !== null,
      view:
        document
          .querySelector("[data-arcade-cabinet]")
          ?.getAttribute("data-view") ?? null,
    }));
    const file = path.join(
      dir,
      `${slug}-${size.width}x${size.height}-${immersive ? "immersive" : "windowed"}.png`
    );
    await page.screenshot({ path: file });
    shots.push({ ...size, file, immersive, view });
  }
  if (original) await page.setViewportSize(original);
  return shots;
}

/**
 * Captures a game's cabinet across the view matrix into
 * `test-results/view-matrix/<slug>/`, recording the view mounted at each
 * size. Defaults to the pull request set; pass {@link VIEW_MATRIX} for the
 * full one.
 *
 * @param page - The page with the cabinet launched and settled.
 * @param slug - The game's route slug, e.g. `retro-labyrinth`.
 * @param sizes - The sizes to capture.
 * @returns One entry per size, in the order given.
 */
export async function captureViewMatrix(
  page: Page,
  slug: string,
  sizes: readonly MatrixSize[] = VIEW_MATRIX_PR
): Promise<MatrixShot[]> {
  const dir = path.join(process.cwd(), "test-results", "view-matrix", slug);
  return captureMatrix(page, slug, dir, sizes);
}

/** Whether the page has a touch screen, so a press is a tap rather than a click. */
async function isTouch(page: Page): Promise<boolean> {
  return page.evaluate(() => navigator.maxTouchPoints > 0);
}

/**
 * Presses a control the way the device would: a tap on a touch screen,
 * a click otherwise.
 */
async function press(
  page: Page,
  target: ReturnType<Page["locator"]>,
  timeout?: number
): Promise<void> {
  if (await isTouch(page)) await target.tap({ timeout });
  else await target.click({ timeout });
}

/** Options for {@link launchCabinet}. */
export interface LaunchOptions {
  /** A query string for the route, without the `?`, e.g. `seed=e2e-4`. */
  query?: string;
  /** How long to keep pressing Launch. Defaults to 90 s for a cold chunk. */
  timeout?: number;
}

/**
 * Opens `/arcade/<slug>` and presses Launch Cabinet until the cabinet is up:
 * immersive on a touch screen, windowed otherwise. A phone-class width that
 * shows the desktop-only notice first gets "Try it anyway". The press is
 * polled (AGENTS.md invariant 12), so a tap that lands before hydration is
 * retried, and it is retried only while Launch is still showing.
 *
 * @param page - The page to open the game in.
 * @param slug - The game's route slug, e.g. `trial-and-error`.
 * @param options - A query string and a timeout.
 */
export async function launchCabinet(
  page: Page,
  slug: string,
  { query, timeout = 90000 }: LaunchOptions = {}
): Promise<void> {
  await page.goto(`/arcade/${slug}${query ? `?${query}` : ""}`, {
    waitUntil: "domcontentloaded",
  });
  const touch = await isTouch(page);
  const ready = page.locator(
    touch ? `${CABINET}[data-immersive="true"]` : CABINET
  );
  const anyway = page.getByRole("button", { name: /Try it anyway/i }).first();
  const launch = page.getByRole("button", { name: /Launch Cabinet/i });
  await expect(async () => {
    if (await anyway.isVisible().catch(() => false)) {
      await press(page, anyway, 2000);
    }
    if ((await launch.count()) > 0) await press(page, launch, 2000);
    await expect(ready).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout });
}

/**
 * Asserts the cabinet mounted `view`, read from its `data-view` attribute.
 *
 * @param page - The page with the cabinet launched.
 * @param view - The view the cabinet should show.
 */
export async function expectView(page: Page, view: ArcadeView): Promise<void> {
  await expect(page.locator(CABINET).first()).toHaveAttribute(
    "data-view",
    view
  );
}

/**
 * Asserts the stage covers at least `min` of the viewport, as the visible
 * part of its box over the viewport's area.
 *
 * @param page - The page with the cabinet launched.
 * @param min - The least share of the viewport, from 0 to 1.
 * @returns The share measured.
 */
export async function assertStageCoverage(
  page: Page,
  min: number
): Promise<number> {
  const stage = page.locator(STAGE).first();
  await expect(stage).toBeVisible();
  const share = await stage.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const width = window.innerWidth;
    const height = window.innerHeight;
    const visibleWidth = Math.max(
      0,
      Math.min(box.right, width) - Math.max(box.left, 0)
    );
    const visibleHeight = Math.max(
      0,
      Math.min(box.bottom, height) - Math.max(box.top, 0)
    );
    return (visibleWidth * visibleHeight) / (width * height);
  });
  expect(
    share,
    `stage covers ${Math.round(share * 100)}% of the viewport`
  ).toBeGreaterThanOrEqual(min);
  return share;
}

/**
 * Asserts every enabled control in the cabinet is at least `min` CSS px in
 * both directions (ADR 0061 rule 4). Controls that are hidden, inert, inside
 * `aria-hidden`, screen-reader-only or disabled are left out, since nobody
 * can press them.
 *
 * @param page - The page with the cabinet launched.
 * @param min - The floor in CSS px. Defaults to 44.
 */
export async function assertTouchTargets(page: Page, min = 44): Promise<void> {
  const small = await page.evaluate(
    ({ cabinet, controls, floor }) => {
      const out: string[] = [];
      const root = document.querySelector(cabinet);
      if (!root) return ["no cabinet"];
      for (const el of Array.from(
        root.querySelectorAll<HTMLElement>(controls)
      )) {
        if (
          el.matches(":disabled") ||
          el.getAttribute("aria-disabled") === "true" ||
          el.closest("[inert], [aria-hidden='true'], .sr-only")
        ) {
          continue;
        }
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 && box.height === 0) continue;
        if (box.width < floor - 0.5 || box.height < floor - 0.5) {
          const name =
            el.getAttribute("aria-label") ||
            el.textContent?.trim().slice(0, 30) ||
            el.tagName.toLowerCase();
          out.push(
            `${name} ${Math.round(box.width)}x${Math.round(box.height)}`
          );
        }
      }
      return out;
    },
    { cabinet: CABINET, controls: CONTROLS, floor: min }
  );
  expect(small, `controls under ${min}px`).toEqual([]);
}

/**
 * Asserts the visible text in the cabinet is at least `min` CSS px, by the
 * computed font size of the element holding each text node. Text in a canvas
 * is not seen; screen-reader-only and hidden text is left out.
 *
 * @param page - The page with the cabinet launched.
 * @param min - The floor in CSS px. Defaults to 12.
 */
export async function assertTextFloor(page: Page, min = 12): Promise<void> {
  const tiny = await page.evaluate(
    ({ cabinet, floor }) => {
      const out: string[] = [];
      const root = document.querySelector(cabinet);
      if (!root) return ["no cabinet"];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const seen = new Set<Element>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent?.trim();
        const el = node.parentElement;
        if (!text || !el || seen.has(el)) continue;
        seen.add(el);
        if (el.closest(".sr-only, [hidden]")) continue;
        const style = getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        const box = el.getBoundingClientRect();
        if (box.width === 0 || box.height === 0) continue;
        const size = parseFloat(style.fontSize);
        if (size < floor - 0.01) out.push(`${text.slice(0, 30)} (${size}px)`);
        if (out.length >= 15) break;
      }
      return out;
    },
    { cabinet: CABINET, floor: min }
  );
  expect(tiny, `text under ${min}px`).toEqual([]);
}

/**
 * Asserts the primary action sits where a thumb reaches it: its centre in
 * the bottom 40% of a portrait screen, or in the outer 25% column on either
 * side of a landscape one.
 *
 * @param page - The page with the cabinet launched.
 * @param selector - The primary action.
 */
export async function assertThumbZone(
  page: Page,
  selector: string
): Promise<void> {
  const target = page.locator(selector).first();
  await expect(target).toBeVisible();
  const box = await target.boundingBox();
  const viewport = page.viewportSize();
  expect(box, `${selector} has a box`).not.toBeNull();
  expect(viewport).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  const { width, height } = viewport!;
  if (height >= width) {
    expect(y, `${selector} centre in the bottom 40%`).toBeGreaterThanOrEqual(
      height * 0.6
    );
    expect(y).toBeLessThanOrEqual(height);
  } else {
    const outer = x <= width * 0.25 || x >= width * 0.75;
    expect(
      outer,
      `${selector} centre at x=${Math.round(x)} in an outer 25% column of ${width}px`
    ).toBe(true);
  }
}

/**
 * Runs axe-core over the cabinet under WCAG 2.1 AA, and fails on any
 * critical, serious or moderate violation (AGENTS.md invariant 10).
 *
 * @param page - The page with the cabinet launched and settled.
 */
export async function axeCabinet(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .include(CABINET)
    .withTags(WCAG_21_AA)
    .analyze();
  const blocking = results.violations
    .filter((v) => BLOCKING.has(v.impact ?? ""))
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
    );
  expect(blocking, "blocking axe violations in the cabinet").toEqual([]);
}

/** Reads the part of a run that must survive a swap or a reload. */
export type RunReader = (page: Page) => Promise<unknown>;

/** The size and view on the far side of a breakpoint. */
export interface ViewTarget {
  view: ArcadeView;
  size: MatrixSize;
}

/**
 * Resizes the viewport across a breakpoint mid-run (#2355) and asserts the
 * cabinet swapped from `from` to `to.view`, paused for the swap, and kept the
 * run that `readRun` reads (the score, the level, whatever the game holds).
 *
 * @param page - The page with a run under way.
 * @param from - The view before the resize.
 * @param to - The size to resize to, and the view it should mount.
 * @param readRun - Reads the run before and after.
 */
export async function swapViewMidRun(
  page: Page,
  from: ArcadeView,
  to: ViewTarget,
  readRun: RunReader
): Promise<void> {
  await expectView(page, from);
  const before = await readRun(page);
  await page.setViewportSize(to.size);
  await expectView(page, to.view);
  await expect(page.locator(CABINET).first()).toHaveAttribute(
    "data-paused",
    "true"
  );
  expect(await readRun(page), "the run after the swap").toEqual(before);
}

/** How {@link interruptAndResume} reopens and resumes a game after a reload. */
export interface ResumeSteps {
  /** Reads the run before the interruption and after Resume. */
  readRun: RunReader;
  /** Brings the cabinet back up after the reload, e.g. with {@link launchCabinet}. */
  relaunch: (page: Page) => Promise<void>;
  /** The Resume control. Defaults to the first button named "Resume…". */
  resume?: (page: Page) => ReturnType<Page["locator"]>;
}

/**
 * Hides the page as a phone does when the player switches apps
 * (`visibilitychange` to hidden, then `pagehide`), reloads it, relaunches the
 * game and presses Resume, then asserts the run is the one saved (#2357).
 *
 * @param page - The page with a run under way.
 * @param steps - How to read the run, relaunch, and find Resume.
 */
export async function interruptAndResume(
  page: Page,
  steps: ResumeSteps
): Promise<void> {
  const before = await steps.readRun(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(
      new PageTransitionEvent("pagehide", { persisted: false })
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await steps.relaunch(page);
  const resume = steps.resume
    ? steps.resume(page)
    : page.getByRole("button", { name: /^Resume/ }).first();
  await expect(async () => {
    await press(page, resume, 2000);
    await expect(resume).toBeHidden({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
  await expect
    .poll(() => steps.readRun(page), { message: "the run after Resume" })
    .toEqual(before);
}

/** One step of a taps-only script: the control to tap. */
export type TapStep = (page: Page) => ReturnType<Page["locator"]>;

/** A game's taps-only script to its first score. */
export interface TapScript {
  /** The controls to tap, in order. Each is tapped once. */
  taps: readonly TapStep[];
  /** Reads the score as a number. */
  score: (page: Page) => Promise<number>;
}

/**
 * The taps-only contract (#2365): a game reaches its first score with taps
 * alone. Taps each step of `script` in order, and asserts the score rose
 * from where it started.
 *
 * @param page - The page with the cabinet launched on a touch project.
 * @param script - The taps and how to read the score.
 */
export async function expectTapsOnlyFirstScore(
  page: Page,
  script: TapScript
): Promise<void> {
  expect(await isTouch(page), "a taps-only run needs a touch project").toBe(
    true
  );
  const start = await script.score(page);
  for (const step of script.taps) {
    const target = step(page);
    await expect(target).toBeVisible();
    await target.tap();
  }
  await expect
    .poll(() => script.score(page), { message: "the score after the taps" })
    .toBeGreaterThan(start);
}
