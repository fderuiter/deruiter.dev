import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { settleFooterTicker } from "./helpers/footer-ticker";

/**
 * Real-browser checks for /platform/sql (#2633): the page at the four widths
 * of the layout matrix, with zero critical, serious or moderate axe
 * violations and no horizontal overflow, and the real engine, DuckDB
 * compiled to WebAssembly, started under the site's own security policy to
 * run a saved query.
 */

const WIDTHS = [320, 375, 768, 1440] as const;

/** Elements that stick out of the viewport, outside any scroll container. */
function overflowing(page: Page) {
  return page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return [...document.querySelectorAll("main *")]
      .filter((element) => {
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
          if (
            ["auto", "scroll", "hidden", "clip"].includes(
              getComputedStyle(parent).overflowX
            )
          )
            return false;
          parent = parent.parentElement;
        }
        return element.getBoundingClientRect().right > width + 1;
      })
      .map((element) => element.tagName.toLowerCase());
  });
}

async function seriousViolations(page: Page) {
  // The footer ticker's cross-fade would read as a contrast failure (#952).
  await settleFooterTicker(page);
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  return audit.violations
    .filter((v) => ["critical", "serious", "moderate"].includes(v.impact ?? ""))
    .map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) }));
}

async function startEngine(page: Page) {
  const start = page.getByRole("button", { name: "Start SQL engine" });
  // Retried until hydration has attached the handler (AGENTS.md 12).
  await expect(async () => {
    await start.click({ timeout: 2_000 });
    await expect(start).toBeDisabled({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  // Compiling a 34 MB binary takes a while on a shared CI runner.
  await expect(
    page.getByText(/is running with \d+ gold tables, read-only\./)
  ).toBeVisible({ timeout: 120_000 });
}

for (const width of WIDTHS) {
  test(`SQL workbench is accessible and contained at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.slow();
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/platform/sql");
    await expect(
      page.getByRole("heading", { level: 1, name: "Query the warehouse" })
    ).toBeVisible();
    // A table's contract open in the schema browser, so it is checked too.
    await page.locator("summary", { hasText: "gold.fct_enrollment" }).click();
    expect(await overflowing(page)).toEqual([]);
    expect(await seriousViolations(page)).toEqual([]);

    const path = testInfo.outputPath(`sql-${width}.png`);
    await page.screenshot({ path, fullPage: true });
    await testInfo.attach(`sql-${width}`, { path, contentType: "image/png" });
  });
}

test("allows WebAssembly on this page and nowhere else", async ({ page }) => {
  const sql = await page.request.get("/platform/sql");
  expect(sql.headers()["content-security-policy"]).toContain(
    "'wasm-unsafe-eval'"
  );
  const home = await page.request.get("/");
  expect(home.headers()["content-security-policy"]).not.toContain(
    "'wasm-unsafe-eval'"
  );
});

test("starts the engine and runs a saved query", async ({ page }) => {
  test.setTimeout(240_000);
  // A blocked compile or worker shows as a Content Security Policy message.
  const refused: string[] = [];
  page.on("console", (message) => {
    if (/Content Security Policy/i.test(message.text()))
      refused.push(message.text());
  });
  const workers: string[] = [];
  page.on("worker", (worker) => workers.push(worker.url()));

  const engineFiles: string[] = [];
  page.on("request", (request) => {
    if (/\/_next\/static\/media\/duckdb-/.test(request.url()))
      engineFiles.push(request.url());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/platform/sql", { waitUntil: "load" });
  // Nothing of the engine loads until the visitor asks for it.
  expect(engineFiles).toEqual([]);
  expect(workers).toEqual([]);
  await startEngine(page);
  expect(engineFiles.some((url) => url.endsWith(".wasm"))).toBe(true);

  // The engine worker's own response carries the WebAssembly allowance.
  const engineWorker = workers.find((url) =>
    /duckdb-browser-eh\.worker\./.test(url)
  );
  expect(engineWorker).toBeTruthy();
  const workerResponse = await page.request.get(engineWorker!);
  expect(workerResponse.headers()["content-security-policy"]).toContain(
    "'wasm-unsafe-eval'"
  );

  await page
    .getByRole("combobox", { name: "Saved query" })
    .selectOption({ index: 1 });
  await page.getByRole("button", { name: "Run", exact: true }).click();
  const grid = page.getByRole("region", { name: "Query result" });
  await expect(grid.getByRole("row").nth(1)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/\d+ rows? in [\d,]+ ms\./)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);

  // The plan, and a refused statement, read in the page.
  await page.getByRole("button", { name: "Show the plan (EXPLAIN)" }).click();
  await expect(page.getByRole("region", { name: "Query plan" })).toBeVisible();
  const editor = page.getByRole("textbox", { name: "SQL (DuckDB)" });
  await editor.fill("SELECT * FROM read_csv('https://example.com/x.csv')");
  await editor.press("Control+Enter");
  await expect(page.locator("main").getByRole("alert")).toBeVisible();

  // A typo comes back in DuckDB's own words, and the engine keeps running.
  await editor.fill("SELECT nope FROM gold.dim_study");
  await editor.press("Control+Enter");
  await expect(page.locator("main").getByRole("alert")).toContainText(
    /Binder Error/
  );
  await editor.fill("SELECT 42 AS answer");
  await editor.press("Control+Enter");
  await expect(grid.getByRole("cell", { name: "42" })).toBeVisible();

  expect(refused).toEqual([]);
});

test.describe("without a service worker", () => {
  // The rewrite below is a page route, and a fetch the service worker makes
  // never reaches it. The worker used to spend the whole test precaching
  // the site, so it never controlled the page; now that it precaches only
  // the offline shell (#3064) it takes control within seconds and fetches
  // the engine's worker itself, with the policy intact.
  test.use({ serviceWorkers: "block" });

  test("says so, rather than waiting, when the browser refuses to compile the engine", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    // The worker's own policy governs its compile: without the allowance on
    // the worker's response, the engine cannot start, which is why
    // WASM_POLICY_SOURCES lists the worker as well as the page.
    await page.route(
      /\/_next\/static\/media\/duckdb-browser-eh\.worker\./,
      async (route) => {
        const response = await route.fetch();
        const headers = { ...response.headers() };
        headers["content-security-policy"] = headers[
          "content-security-policy"
        ].replace(" 'wasm-unsafe-eval'", "");
        await route.fulfill({ response, headers });
      }
    );
    await page.goto("/platform/sql");
    const start = page.getByRole("button", { name: "Start SQL engine" });
    await expect(async () => {
      await start.click({ timeout: 2_000 });
      await expect(start).toBeDisabled({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
    await expect(page.locator("main").getByRole("alert")).toContainText(
      /The engine did not start: it stopped responding while it compiled/,
      { timeout: 150_000 }
    );
    await expect(
      page.getByRole("button", { name: "Try starting the engine again" })
    ).toBeEnabled();
  });
});
