import { test, expect, devices, type Page } from "@playwright/test";

test.describe("Headless Synthetic User Probes & Journey Monitoring", () => {
  test("Probe 1: Landing Page Pretext Layout & Dynamic Filter Flow", async ({
    page,
  }) => {
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    // Verify main content container renders
    const mainContent = page.locator("#main-content");
    await expect(mainContent).toBeVisible();

    // Verify Case Study cards render with valid heights (Pretext layout engine verified)
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    // Check first card bounding box to ensure no layout collapse
    await expect(async () => {
      const firstCard = page.locator("article").first();
      const box = await firstCard.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThan(50);
      expect(box!.width).toBeGreaterThan(100);
    }).toPass({ timeout: 10000 });
  });

  test("Probe 2: Command Palette Discovery, Filtering & Navigation Journey", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const commandDialog = page.getByRole("dialog", {
      name: /Command Palette/i,
    });

    // Open Command Palette via visible Search trigger button in Navbar with hydration retry
    await expect(async () => {
      const desktopSearchBtn = page.getByRole("button", {
        name: /search portfolio and commands/i,
      });
      const mobileSearchBtn = page.getByRole("button", {
        name: "Open Command Search",
      });

      if (await desktopSearchBtn.isVisible().catch(() => false)) {
        await desktopSearchBtn.click();
      } else {
        await mobileSearchBtn.click();
      }

      await expect(commandDialog).toBeVisible({ timeout: 1500 });
    }).toPass({ timeout: 15000 });

    // Filter for "Proof"
    const searchInput = commandDialog.getByRole("combobox");
    await searchInput.fill("Proof");

    // Select Proof Assistant option
    const proofOption = commandDialog
      .getByText(/Proof Studio|Formal Proof|Logical Proof/i)
      .first();
    await expect(proofOption).toBeVisible({ timeout: 5000 });
    await proofOption.click();

    // Verify seamless navigation to /proof
    await page.waitForURL("**/proof", { timeout: 15000 });
    expect(page.url()).toContain("/proof");
  });

  test("Probe 3: Proof Assistant DAG Engine & Export Flow", async ({
    page,
  }) => {
    await page.goto("/proof", { waitUntil: "domcontentloaded" });

    // Verify Proof Workspace header and graph area mount
    await expect(
      page
        .getByText(
          /Logical Proof|Proof Canvas|Formal Verification|Deduction Studio/i
        )
        .first()
    ).toBeVisible({ timeout: 10000 });

    // Ensure premises or theorem graph nodes or rule palette are rendered
    const proofElement = page
      .getByText(
        /Premise|Theorem|Modus Ponens|Rule Palette|Logical Proof Canvas/i
      )
      .first();
    await expect(proofElement).toBeVisible({ timeout: 10000 });

    // Probe Export modal / drawer if available
    const exportBtn = page
      .getByRole("button", { name: /Export|Share Proof/i })
      .first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      const modal = page.getByRole("dialog");
      if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(modal).toBeVisible();
        await page.keyboard.press("Escape");
      }
    }
  });

  test("Probe 4: Arcade Canvas 2D Engine Initialization", async ({ page }) => {
    await page.goto("/arcade/laser-loon", { waitUntil: "domcontentloaded" });

    // Click Launch Cabinet to initialize canvas engine with hydration-safe polling
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) {
        await launchBtn.click();
      }
      const canvas = page.locator("canvas").first();
      await expect(canvas).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 20000 });
  });

  test("Probe 5: API Ingestion, Schema Guard & Rate Limiting Health", async ({
    request,
  }) => {
    // 1. Valid Telemetry Ingestion Probe
    const validRes = await request.post("/api/telemetry", {
      data: {
        eventType: "page_view",
        projectSlug: "synthetic-probe-runner",
      },
      headers: { "Content-Type": "application/json" },
    });
    // POST /api/telemetry answers 201 when the Redis buffer write succeeded and
    // 202 when the event was accepted but dropped (buffer unavailable). It never
    // returns 200 -- see app/api/telemetry/route.ts.
    expect([201, 202]).toContain(validRes.status());
    const validJson = await validRes.json();
    expect(validJson.success).toBe(true);

    // 2. Strict Schema Reject Probe (Missing required eventType)
    const invalidRes = await request.post("/api/telemetry", {
      data: {
        projectSlug: "malformed-payload-probe",
      },
      headers: { "Content-Type": "application/json" },
    });
    expect(invalidRes.status()).toBe(400);
    const errorJson = await invalidRes.json();
    expect(errorJson.error).toBeDefined();

    // 3. Case Studies API probe
    const caseStudiesRes = await request.get("/api/case-studies");
    if (caseStudiesRes.status() === 200) {
      const cases = await caseStudiesRes.json();
      expect(Array.isArray(cases)).toBe(true);
    }
  });

  test("Probe 6: Patrol Shift Critical Journey — Dispatch to Debrief", async ({
    page,
  }) => {
    const response = await page.goto("/patrol", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).toBeLessThan(400);

    await expect(
      page.locator('[data-testid="patrol-shift-container"]')
    ).toBeVisible({ timeout: 15000 });

    // 1. Intro -> mountain map hub. Every interactive trigger is wrapped in a
    // toPass poll so a click cannot land on static HTML before React 19
    // attaches its listeners.
    await expect(async () => {
      await page
        .getByRole("button", { name: /Skip Intro|Resume Shift/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-mountain-map"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    // 2. Take a dispatch.
    await expect(async () => {
      await page
        .getByRole("button", { name: /Standby on Hill \/ Await Dispatch/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-dispatch-overlay"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    // 3. Run the scene (OEC).
    await expect(async () => {
      await page
        .getByRole("button", { name: /Acknowledge & Respond/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-scene-interaction"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    // 4. Transport (OET) — the canvas must acquire a 2D context.
    await expect(async () => {
      await page
        .getByRole("button", { name: /Stabilize & Prepare Toboggan/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-oet-canvas"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    const hasContext = await page.evaluate(() => {
      const canvas = document.querySelector(
        '[data-testid="oet-viewport-canvas"]'
      ) as HTMLCanvasElement | null;
      return Boolean(canvas && canvas.getContext("2d"));
    });
    expect(hasContext).toBe(true);

    // 5. Radio traffic is text-first, so the journey is completable with audio
    // unavailable and nothing is conveyed by sound alone.
    const liveRegion = page.locator('[aria-live="polite"]').first();
    await expect(liveRegion).toBeAttached();
  });

  // Regression guard for #720. The apex and www hosts previously disagreed: www
  // served content while canonical tags, the sitemap and robots all advertised a
  // host that redirected away. This probe only runs when pointed at the real
  // deployed origin, since a local server has no DNS or edge redirect to assert.
  test("Probe 8: Canonical host redirect and metadata parity", async ({
    request,
    baseURL,
  }) => {
    test.skip(
      !baseURL?.includes("deruiter.dev"),
      "Canonical host probe requires a deployed deruiter.dev origin"
    );

    // 1. The non-canonical www host permanently redirects to the apex.
    const wwwResponse = await request.head("https://www.deruiter.dev/", {
      maxRedirects: 0,
    });
    expect([301, 308]).toContain(wwwResponse.status());
    expect(wwwResponse.headers()["location"]).toBe("https://deruiter.dev/");

    // 2. The canonical apex serves directly rather than redirecting onward.
    const apexResponse = await request.get("https://deruiter.dev/", {
      maxRedirects: 0,
    });
    expect(apexResponse.status()).toBe(200);

    // 3. Advertised canonical identity matches the host that actually serves, so
    //    crawlers are never pointed at a redirecting URL.
    const html = await apexResponse.text();
    expect(html).toContain('rel="canonical" href="https://deruiter.dev"');
    expect(html).not.toContain("https://www.deruiter.dev");

    // 4. Every sitemap entry and the robots pointer resolve to the canonical host.
    const sitemap = await request.get("https://deruiter.dev/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).not.toContain("https://www.deruiter.dev");

    const robots = await request.get("https://deruiter.dev/robots.txt");
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain(
      "Sitemap: https://deruiter.dev/sitemap.xml"
    );
  });

  // The Trial & Error Card Table journey (#1560, #925): launch the cabinet,
  // review and play the Small Blind's winning hand by keyboard, clear it and
  // cash out into the Procurement Shop. A fixed seed deals the same hand.
  test("Probe 9: Trial & Error Card Table from launch to the shop", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/arcade/trial-and-error?seed=shop-24", {
      waitUntil: "domcontentloaded",
    });
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) await launchBtn.click();
      await expect(page.getByTestId("hand")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });

    // Inspect the first draft and correct every cell the SAP flags.
    const draft = page.locator('[data-card-id="C-T14.1.1-A"]');
    const firstCell = page
      .getByTestId("inspect-drawer")
      .getByRole("row")
      .nth(1)
      .getByRole("gridcell")
      .first();
    await expect(async () => {
      await draft.focus();
      await page.keyboard.press("i");
      await expect(firstCell).toBeFocused({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        await page.keyboard.press("Enter");
        await page.keyboard.press("c");
        if (col < 2) await page.keyboard.press("ArrowRight");
      }
      if (row < 4) {
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowDown");
      }
    }
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("inspect-drawer")).toBeHidden();

    // Play the draft with its listing, the disposition table and Drafts B
    // and C: the five cards the Small Blind always deals first (#2055) make
    // an ITT Population Flush.
    await page.keyboard.press("Space");
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Space");
    }
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("blind-result")).toContainText(
      "Blind cleared",
      { timeout: 15000 }
    );

    await page.getByRole("button", { name: /^Cash out \$\d+k$/ }).click();
    await expect(page.getByTestId("shop")).toBeVisible();
    await expect(page.getByTestId("shop-items")).toBeVisible();
  });

  // Patty's Drive-Thru (#1813): launch the cabinet, clock in and see the
  // shift running, in the 3D booth where WebGL exists and the flat register
  // where it does not.
  test("Probe 10: Patty's Drive-Thru from launch to a running shift", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/arcade/patty-drive-thru?seed=e2e-4", {
      waitUntil: "domcontentloaded",
    });
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) await launchBtn.click();
      await expect(page.getByTestId("pdt-intro")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 30000 });

    await page.getByRole("button", { name: "Clock in" }).click();
    const game = page.getByTestId("pdt-game");
    await expect(game).toBeVisible();
    await expect(page.getByTestId("pdt-clock")).toBeVisible();
    const view = await game.getAttribute("data-pdt-view");
    await expect(
      page.getByTestId(view === "3d" ? "pdt-booth-canvas" : "pdt-register")
    ).toBeVisible();
    // The shift clock counts down, so the game loop is running.
    const clock = page.getByTestId("pdt-clock");
    const start = (await clock.textContent()) ?? "";
    await expect(clock).not.toHaveText(start, { timeout: 10000 });
  });

  // #2709: the Study Data Pipeline journey, run to lineage to download, at a
  // desktop and a phone viewport. Both run on the chromium project.
  const { defaultBrowserType: _browser, ...pixel5 } = devices["Pixel 5"];
  for (const [viewport, use] of [
    ["desktop", { viewport: { width: 1440, height: 900 } }],
    ["phone", pixel5],
  ] as const) {
    test.describe(`Probe 11 (${viewport})`, () => {
      test.use(use);
      test(`Probe 11: Study Data Pipeline run, lineage to the USDM activity, package download (${viewport})`, async ({
        page,
      }) => {
        await studyDataJourney(page);
      });
    });
  }
});

async function studyDataJourney(page: Page) {
  const response = await page.goto("/study-data", {
    waitUntil: "domcontentloaded",
  });
  // /study-data ships with Clinical v1, which is under release:hold (#2691).
  // Until production has it, the daily probe of the deployed origin skips
  // here; every local and CI run, which serve the branch, runs the journey.
  test.skip(
    !!process.env.PLAYWRIGHT_TEST_BASE_URL && response?.status() === 404,
    "/study-data is not deployed to the probed origin yet (#2691)"
  );
  expect(response?.status()).toBe(200);

  // The page runs the default study once on load.
  await expect(page.getByText(/^Run 1: 90 subjects, seed 301/)).toBeVisible({
    timeout: 60_000,
  });

  // 1. Run the pipeline again with another seed and subject count.
  await expect(async () => {
    await page.getByLabel("Seed").fill("2709");
    await page.getByLabel("Subjects").fill("40");
    await page.getByRole("button", { name: "Run pipeline" }).click();
    await expect(page.getByText(/^Run 2: 40 subjects, seed 2709/)).toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ timeout: 60_000 });

  // 2. Trace a table cell, then walk back to the protocol activity that
  // scheduled its source records.
  const lineage = page.locator('section[aria-labelledby="lineage-title"]');
  const status = lineage.getByRole("status");
  const cell = page.getByRole("grid").first().locator("td[data-ars-results]");
  await expect(async () => {
    await cell.first().click();
    await expect(status).toContainText("Tracing Table", { timeout: 5_000 });
  }).toPass({ timeout: 15_000 });
  const activity = lineage
    .getByRole("button", { name: /^Trace forward: / })
    .first();
  await expect(activity).toBeVisible();
  await expect(async () => {
    await activity.click();
    await expect(status).toContainText(
      /Tracing .+ · (every planned visit|[A-Z0-9 ]+)/,
      { timeout: 5_000 }
    );
    await expect(status).not.toContainText("Tracing Table");
  }).toPass({ timeout: 15_000 });

  // 3. Download the submission package.
  const datasets = page.getByRole("button", { name: "Datasets (.zip)" });
  await expect(datasets).toBeEnabled();
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    datasets.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.zip$/);
  expect(await download.failure()).toBeNull();
}
