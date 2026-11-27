import { expect, test } from "@playwright/test";

/**
 * Regression coverage for ROI Region Grow (`roi_select`) hash synchronization,
 * contextual toolbar and 3D-view hints, and 2D slice seeding without unintended
 * voxel mutations across `/neuro` and `/m/neuro`.
 */
test.describe("NeuroRecon ROI Region Grow tool synchronization", () => {
  test("preserves #tool=roi_select, seeds 3D region growing on 2D slice click without voxel edits, and handles 3D view slice hint", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/neuro#view=2d&tool=roi_select");

    await expect(page.getByText("2D Multi-Planar Orthoview")).toBeVisible({
      timeout: 30000,
    });

    // Toolbar contextual state: ROI prompt visible, brush radius hidden
    await expect(page.getByTestId("neuro-roi-toolbar-prompt")).toContainText(
      "±15 INT"
    );
    await expect(page.getByLabel("Brush radius 1")).toHaveCount(0);
    await expect(page.getByText("No Seed Voxel Selected")).toBeVisible();

    // Click inside cerebral parenchyma on the Coronal 2D slice canvas
    const coronalCanvas = page.getByRole("img", {
      name: /2D Coronal MRI Slice View/i,
    });
    await expect(coronalCanvas).toBeVisible();

    await expect(async () => {
      const box = await coronalCanvas.boundingBox();
      expect(box).not.toBeNull();
      await coronalCanvas.click({
        position: {
          x: Math.round(box!.width * 0.34),
          y: Math.round(box!.height * 0.5),
        },
        force: true,
      });
      await expect(page.getByText("SEED VOXEL:")).toBeVisible({
        timeout: 4000,
      });
    }).toPass({ timeout: 15000 });

    await expect(page.getByText("ROI VOLUME")).toBeVisible();
    await expect(page.getByText("VOXEL COUNT")).toBeVisible();
    // Clicking with roi_select must NOT mutate voxels or mark Case 01 dirty
    const case01Tab = page.getByRole("button", { name: /Case 01/i });
    await expect(case01Tab).not.toContainText("has unsaved edits");

    // Switch to 3D Only view while roi_select is active -> contextual 2D slice hint appears
    await expect(async () => {
      await page.getByRole("button", { name: "3D Only" }).click();
      await expect(page.getByTestId("neuro-roi-3d-slice-hint")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 15000 });

    // Clicking the inline button switches back to Split 3D/2D while keeping tool=roi_select
    await expect(async () => {
      await page
        .getByRole("button", { name: "Open Split 3D/2D Slices" })
        .click({ force: true });
      await expect(page.getByText("2D Multi-Planar Orthoview")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 15000 });

    await expect(page.getByTestId("neuro-roi-3d-slice-hint")).toHaveCount(0);
    expect(page.url()).toContain("tool=roi_select");
    expect(page.url()).not.toContain("view=3d");
  });

  test("activates ROI Region Grow via keys 5 and G and preserves #tool=roi_select on /m/neuro without horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/m/neuro#view=2d");

    await expect(page.getByText("2D Multi-Planar Orthoview")).toBeVisible({
      timeout: 30000,
    });

    // Initially Case 01 defaults to erase (Brush radius visible)
    await expect(page.getByLabel("Brush radius 1")).toBeVisible();

    // Dismiss onboarding if needed or send key 5 directly to keyboard boundary
    await expect(async () => {
      await page.keyboard.press("5");
      await expect(page.getByTestId("neuro-roi-toolbar-prompt")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 15000 });
    expect(page.url()).toContain("tool=roi_select");
    await expect(page.getByLabel("Brush radius 1")).toHaveCount(0);

    // Switch away with key 3 (paint), then back with key G
    await expect(async () => {
      await page.keyboard.press("3");
      await expect(page.getByLabel("Brush radius 1")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 15000 });

    await expect(async () => {
      await page.keyboard.press("g");
      await expect(page.getByTestId("neuro-roi-toolbar-prompt")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 15000 });

    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(horizontalOverflow).toBe(false);
  });
});
