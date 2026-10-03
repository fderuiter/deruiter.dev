import { expect, test } from "@playwright/test";

test("Study Omnibar finds a field in another form and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/crf");

  const trigger = page.getByRole("button", { name: "Find in study" });
  const dialog = page.getByRole("dialog", { name: "Find in Study" });
  const input = dialog.getByRole("combobox", {
    name: "Search forms, fields, visits and actions",
  });

  await expect(async () => {
    await trigger.click();
    await expect(input).toBeFocused();
  }).toPass({ timeout: 15000 });

  await input.fill("weight");
  await expect(dialog.getByRole("option").first()).toContainText(
    "Vital Signs & Physical Metrics (VS)"
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("f");
  await expect(input).toBeFocused();
  await input.fill("weight");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/field=f_weight/);
  await expect(page).toHaveURL(/form=form_vs_onc/);
});
