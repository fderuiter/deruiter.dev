import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const layout of [
  { name: "320px", width: 320, fontScale: 1 },
  { name: "200% text", width: 1280, fontScale: 2 },
]) {
  for (const modal of [
    {
      trigger: "Export",
      title: "Export Workspace State",
      close: "Close Export Modal",
    },
    {
      trigger: "Custom Studio",
      title: "Custom Invariant Studio",
      close: "Close Custom Studio Modal",
    },
  ]) {
    test(`${modal.trigger} dialog supports keyboard and accessible layout at ${layout.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: layout.width, height: 720 });
      await page.goto("/proof");
      if (layout.fontScale === 2) {
        await page.addStyleTag({
          content: "html { font-size: 200% !important; }",
        });
      }
      const trigger = page.getByRole("button", {
        name: modal.trigger,
        exact: true,
      });
      const dialog = page.getByRole("dialog", { name: modal.title });
      await expect(async () => {
        if (!(await dialog.isVisible())) await trigger.click();
        await expect(dialog).toBeVisible();
      }).toPass({ timeout: 15000 });
      await expect(dialog).toHaveAttribute("aria-modal", "true");
      const close = dialog.getByRole("button", { name: modal.close });
      await expect(close).toBeFocused();

      if (modal.trigger === "Export") {
        await dialog
          .getByRole("button", { name: "markdown", exact: true })
          .click();
        await dialog.locator("pre").evaluate((element) => {
          element.textContent =
            "https://example.invalid/" + "long-proof-formula".repeat(100);
        });
      } else {
        for (const label of [
          "Premise 1 Formula:",
          "Premise 2 Formula:",
          "Premise 3 Formula:",
          "Target Invariant Goal:",
        ]) {
          await expect(dialog.getByLabel(label, { exact: true })).toBeVisible();
        }
      }

      const violations = (
        await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations.filter((violation) =>
        ["critical", "serious", "moderate"].includes(violation.impact ?? "")
      );
      expect(violations).toEqual([]);

      const overflow = await dialog.evaluate((element) => {
        const width = document.documentElement.clientWidth;
        return Array.from(element.querySelectorAll<HTMLElement>("*"))
          .filter((child) => {
            const rect = child.getBoundingClientRect();
            return rect.width > 0 && (rect.right > width + 1 || rect.left < -1);
          })
          .map((child) => child.tagName);
      });
      expect(overflow).toEqual([]);
      const buttons = dialog.getByRole("button");
      await buttons.last().focus();
      await page.keyboard.press("Tab");
      await expect(buttons.first()).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(buttons.last()).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();

      await trigger.click();
      await expect(dialog).toBeVisible();
      await close.click();
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    });
  }
}
