import { expect, test } from "@playwright/test";

/**
 * NeuroRecon viewer controls on phones (#3464): at 320, 375 and 393 px no
 * viewer control is clipped, and on a coarse pointer the surface,
 * hemisphere, Wireframe, GPU Test and layout toggles and the slice sliders
 * are at least 44 px tall. Each case sets its own viewport and touch
 * emulation so the spec means the same thing under every project.
 *
 * The controls are measured where they are rather than scrolled to.
 * With the 3D viewer on screen, software WebGL on CI runners leaves the
 * page about one animation frame a second, and Playwright's scroll and
 * stability checks wait on frames until the test times out.
 */

const CONTROLS = [
  { role: "button", name: "pial" },
  { role: "button", name: "aseg" },
  { role: "button", name: "Both" },
  { role: "button", name: "Right (rh)" },
  { role: "button", name: "Wireframe" },
  {
    role: "button",
    name: "GPU Test: simulate WebGL context loss and recovery",
  },
  { role: "button", name: "3-Planar" },
  { role: "button", name: "Focused" },
  { role: "slider", name: "Sagittal slice" },
] as const;

for (const width of [320, 375, 393]) {
  test.describe(`NeuroRecon at ${width}px`, () => {
    test.use({
      viewport: { width, height: 900 },
      hasTouch: true,
      isMobile: true,
    });

    test("keeps every viewer control on screen and at least 44 px", async ({
      page,
      browserName,
    }) => {
      test.skip(browserName === "firefox", "isMobile is unsupported");
      await page.goto("/neuro");
      await expect(page.getByText("2D Multi-Planar Orthoview")).toBeVisible({
        timeout: 30000,
      });
      // The 3D viewer replaces its skeleton once loaded; measure after that.
      await page
        .getByTestId("brain-3d-skeleton")
        .waitFor({ state: "detached", timeout: 30000 });

      for (const { role, name } of CONTROLS) {
        const control = page.getByRole(role, { name, exact: true }).first();
        await expect(control).toBeAttached();
        const box = await control.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.x,
            right: r.right,
            height: r.height,
            visible: el.checkVisibility({ visibilityProperty: true }),
          };
        });
        expect(box.visible, name).toBe(true);
        expect(box.x, name).toBeGreaterThanOrEqual(0);
        expect(box.right, name).toBeLessThanOrEqual(width + 1);
        expect(box.height, name).toBeGreaterThanOrEqual(44);
      }

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(horizontalOverflow).toBe(false);
    });
  });
}
