import { test, expect } from "@playwright/test";
import { ONCOLOGY_RECIST_PRESET } from "../../lib/crf/presets";

test.beforeEach(async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/arcade/clinical-chaos");
  if (isMobile) {
    const tryAnyway = page.getByRole("button", { name: /Try it anyway/i });
    await expect(async () => {
      await expect(tryAnyway).toBeVisible();
      await tryAnyway.click();
      await expect(tryAnyway).toBeHidden();
    }).toPass({ timeout: 15000 });
  }
  await expect(async () => {
    await page.getByRole("button", { name: /Launch Cabinet/i }).click();
    await expect(page.locator("canvas[role='application']")).toBeVisible();
  }).toPass({ timeout: 15000 });
});

test("desktop start keeps the Next instruction in view", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop viewport assertion");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(async () => {
    await page.getByRole("button", { name: /Start 3-Phase Campaign/i }).click();
    await expect(page.getByText("Next:", { exact: true })).toBeVisible();
  }).toPass({ timeout: 15000 });
  await expect(page.getByText("Next:", { exact: true })).toBeInViewport({
    ratio: 1,
  });
  const canvas = page.locator("canvas[role='application']");
  // The desktop layout; the bitmap itself is scaled for the screen (#1180).
  await expect(canvas).toHaveAttribute("data-logical-height", "150");
  // #834: the first-shift walkthrough sits below the Next instruction.
  await expect(
    page.getByRole("region", { name: "First-shift calibration" })
  ).toBeVisible();
});

test("fullscreen at 1440x900 keeps the flagged fields, stations and lifelines on screen (#1327)", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "Desktop viewport assertion");
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(async () => {
    await page.getByRole("button", { name: /Start 3-Phase Campaign/i }).click();
    await expect(page.locator("#cc-dossier-title")).toBeVisible();
  }).toPass({ timeout: 15000 });
  await page.getByRole("button", { name: "Skip calibration" }).click();
  await page.getByRole("button", { name: "Enter Fullscreen (F)" }).click();
  await expect(
    page.getByRole("button", { name: /^Exit Fullscreen/ }).first()
  ).toBeVisible();

  await expect(page.locator("canvas[role='application']")).toBeInViewport({
    ratio: 1,
  });
  await expect(
    page.getByRole("region", { name: "EDC stations" })
  ).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("region", { name: "Lifelines" })).toBeInViewport({
    ratio: 1,
  });
  const dossier = page.locator('section[aria-labelledby="cc-dossier-title"]');
  await expect(dossier).toBeInViewport({ ratio: 1 });
});

test("early station routing gives accessible guidance without an auditor penalty", async ({
  page,
}) => {
  await expect(async () => {
    await page.getByRole("button", { name: /Start 3-Phase Campaign/i }).click();
    await expect(page.locator("#cc-dossier-title")).toContainText("SUBJ-1001");
  }).toPass({ timeout: 15000 });

  const stations = page.getByRole("region", { name: "EDC stations" });
  const dm = stations.getByRole("button", { name: /DM Station/ });
  const ae = stations.getByRole("button", { name: /AE Station/ });
  const auditor = page.getByRole("meter", { name: "FDA auditor suspicion" });
  const initialSuspicion = await auditor.getAttribute("aria-valuenow");
  await expect(dm).toContainText("Fix first");
  await expect(ae).toContainText("Other domain");

  await expect(async () => {
    await dm.click();
    await expect(stations).toContainText(
      "Resolve 1 flagged observation before routing"
    );
  }).toPass({ timeout: 15000 });
  const board = page.locator('[data-keyboard-boundary="true"]');
  await board.focus();
  await board.press("1");
  await expect(stations).toContainText(
    "Resolve 1 flagged observation before routing"
  );
  await expect(
    page.getByText("21 CFR Part 11 Electronic Signature")
  ).toHaveCount(0);
  await expect(auditor).toHaveAttribute(
    "aria-valuenow",
    initialSuspicion ?? "0"
  );
});

test("a clean routine packet dispatches without the review dialog", async ({
  page,
}) => {
  await expect(async () => {
    await page.getByRole("button", { name: /Start 3-Phase Campaign/i }).click();
    await expect(page.locator("#cc-dossier-title")).toContainText("SUBJ-1001");
  }).toPass({ timeout: 15000 });

  await expect(async () => {
    await page.getByText("Validate Choice").first().click();
    await expect(
      page.getByText("CDISC Controlled Terminology Validation")
    ).toBeVisible();
  }).toPass({ timeout: 15000 });
  await page.getByRole("button", { name: /180 cm/ }).click();

  const dm = page
    .getByRole("region", { name: "EDC stations" })
    .getByRole("button", { name: /DM Station/ });
  await expect(async () => {
    await expect(dm).toContainText("Accepts");
    await dm.click();
    await expect(dm).toContainText("Submits:1");
  }).toPass({ timeout: 15000 });
  await expect(
    page.getByText("21 CFR Part 11 Electronic Signature")
  ).toHaveCount(0);
});

test("phone fallback keeps a visible compact and selectable canvas", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Touch viewport assertion");
  await expect(async () => {
    await page.getByRole("button", { name: /Start 3-Phase Campaign/i }).click();
    await expect(page.locator("#cc-dossier-title")).toContainText("SUBJ-1001");
  }).toPass({ timeout: 15000 });
  const canvas = page.locator("canvas[role='application']");
  // Each width taps a different slot, so a broken hit test cannot pass on the
  // previous iteration's selection.
  for (const [width, x, expected] of [
    [320, 130, "SUBJ-1002"],
    [390, 60, "SUBJ-1001"],
  ] as const) {
    await page.setViewportSize({ width, height: 844 });
    // Wait for the ResizeObserver to size the layout for this width
    await expect
      .poll(() =>
        canvas.evaluate(
          (element: HTMLCanvasElement) =>
            Number(element.dataset.logicalHeight) ===
            Math.round((element.getBoundingClientRect().width * 5) / 13)
        )
      )
      .toBe(true);
    const canvasSize = await canvas.evaluate((element: HTMLCanvasElement) => ({
      width: Number(element.dataset.logicalWidth),
      height: Number(element.dataset.logicalHeight),
    }));
    expect(canvasSize.width).toBeLessThanOrEqual(500);
    expect(canvasSize.width).toBeGreaterThanOrEqual(200);
    await canvas.click({
      position: { x, y: canvasSize.height * 0.55 },
    });
    await expect(page.locator("#cc-dossier-title")).toContainText(expected);
  }
});

test.describe("with a CRF Studio protocol loaded (#1150)", () => {
  test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, "Desktop flow; phones get the desktop-only notice");
    // Mirrors CRF Studio's "Launch simulation", which leaves the protocol in
    // localStorage for later visits to the game.
    await page.evaluate((protocol) => {
      localStorage.setItem("crf_active_protocol", JSON.stringify(protocol));
    }, ONCOLOGY_RECIST_PRESET);
    await page.reload();
    await expect(async () => {
      await page.getByRole("button", { name: /Launch Cabinet/i }).click();
      await expect(page.locator("canvas[role='application']")).toBeVisible();
    }).toPass({ timeout: 15000 });
  });

  test("every flagged field accepts one offered choice and the packet can route", async ({
    page,
  }) => {
    await expect(async () => {
      await page
        .getByRole("button", { name: /Start 3-Phase Campaign/i })
        .click();
      await expect(page.locator("#cc-dossier-title")).toBeVisible();
    }).toPass({ timeout: 15000 });

    const dialog = page.getByRole("dialog", {
      name: "CDISC Controlled Terminology Validation",
    });
    for (let fixed = 0; fixed < 8; fixed++) {
      const flagged = page.getByText("Validate Choice").first();
      if ((await flagged.count()) === 0) break;
      await expect(async () => {
        if ((await dialog.count()) === 0 || !(await dialog.isVisible())) {
          await flagged.click();
        }
        await expect(dialog).toBeVisible();
      }).toPass({ timeout: 15000 });

      let verified = false;
      const options = dialog.locator("button:has(kbd)");
      const count = await options.count();
      for (let i = 0; i < count && !verified; i++) {
        if (!(await dialog.isVisible().catch(() => false))) {
          break;
        }
        const opt = options.nth(i);
        if (await opt.isDisabled().catch(() => true)) continue;

        let selectedVerified = false;
        try {
          await opt.click({ timeout: 5000 });
        } catch {
          if (await dialog.isHidden().catch(() => true)) {
            verified = true;
            break;
          }
          continue;
        }

        await expect
          .poll(
            async () => {
              const isVer = await dialog
                .getByText("✓ Standard Verified")
                .isVisible()
                .catch(() => false);
              if (isVer) selectedVerified = true;
              const isDisabled = await opt.isDisabled().catch(() => true);
              const isHidden = await dialog.isHidden().catch(() => true);
              return isVer || isDisabled || isHidden || selectedVerified;
            },
            { timeout: 10000 }
          )
          .toBe(true);

        const isVerNow = await dialog
          .getByText("✓ Standard Verified")
          .isVisible()
          .catch(() => false);
        const isDialogHidden = await dialog.isHidden().catch(() => true);

        if (selectedVerified || isVerNow || isDialogHidden) {
          verified = true;
          break;
        }
      }

      expect(verified).toBe(true);
      await expect(dialog).toBeHidden();
    }

    await expect(page.getByText("Clean.", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^\d?\s*Route to [A-Z]{2}$/ }).first()
    ).toBeVisible();
  });
});
