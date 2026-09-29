import { test, expect } from "@playwright/test";

test("Custom Studio validates, loads, exports and shares the visitor's formulas", async ({
  page,
}) => {
  await page.goto("/proof");
  const dialog = page.getByRole("dialog", { name: "Custom Invariant Studio" });
  await expect(async () => {
    if (!(await dialog.isVisible()))
      await page
        .getByRole("button", { name: "Custom Studio", exact: true })
        .click();
    await expect(dialog).toBeVisible();
  }).toPass({ timeout: 15000 });
  const labels = [
    "Premise 1 Formula:",
    "Premise 2 Formula:",
    "Premise 3 Formula:",
    "Target Invariant Goal:",
  ];
  const formulas = ["A", "A -> B", "B -> C", "C"];
  for (let i = 0; i < 4; i++)
    await dialog.getByLabel(labels[i], { exact: true }).fill(formulas[i]);
  await dialog.getByLabel(labels[1], { exact: true }).fill("A ->");
  await dialog.getByRole("button", { name: "Load into Workspace" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Premise 2");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(labels[1], { exact: true }).fill(formulas[1]);
  await dialog.getByRole("button", { name: "Load into Workspace" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/custom=/);
  const shareUrl = page.url();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const exportDialog = page.getByRole("dialog", {
    name: "Export Workspace State",
  });
  await exportDialog
    .getByRole("button", { name: "markdown", exact: true })
    .click();
  const output = exportDialog.getByRole("region", { name: "Proof export" });
  await expect(output).toContainText("A -> B");
  await expect(output).toContainText("B -> C");
  await expect(output).not.toContainText("P → Q");
  await exportDialog
    .getByRole("button", { name: "Close Export Modal" })
    .click();
  const canvas = page.getByRole("region", { name: "Proof workspace canvas" });
  await expect(canvas).toContainText("A -> B");
  await expect(canvas).toContainText("B -> C");
  await expect(canvas).not.toContainText("P → Q");
  await page.getByRole("button", { name: "Auto-Step", exact: true }).click();
  const terminalTab = page.getByRole("button", {
    name: "Terminal",
    exact: true,
  });
  if (await terminalTab.isVisible()) await terminalTab.click();
  const command = page.getByPlaceholder(
    "Enter logic command (e.g. 'connect A C', 'apply mp A B', 'help')..."
  );
  await command.fill("apply mp C D");
  await command.press("Enter");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await exportDialog.getByRole("button", { name: "lean", exact: true }).click();
  await expect(output).toContainText("«A» «B» «C» : Prop");
  await expect(output).toContainText("(h3 : «B» → «C»)");
  await exportDialog
    .getByRole("button", { name: "Close Export Modal" })
    .click();
  const canvasTab = page.getByRole("button", { name: "Canvas", exact: true });
  if (await canvasTab.isVisible()) await canvasTab.click();
  await page.getByRole("button", { name: "Simulate", exact: true }).click();
  if (await terminalTab.isVisible()) await terminalTab.click();
  await expect(
    page.getByText(/Background Simulation completed successfully/)
  ).toBeVisible();
  await expect(
    page.getByText("[Step 1/5] Parsed premises: A; A -> B; B -> C", {
      exact: true,
    })
  ).toBeVisible();
  await expect(
    page.getByText(
      "[Step 5/5] Checked 8 truth-table valuations against the submitted goal.",
      { exact: true }
    )
  ).toBeVisible();
  await page.goto(shareUrl);
  await expect(async () => {
    if (!(await dialog.isVisible()))
      await page
        .getByRole("button", { name: "Custom Studio", exact: true })
        .click();
    await expect(dialog).toBeVisible();
  }).toPass({ timeout: 15000 });
  for (let i = 0; i < 4; i++)
    await expect(dialog.getByLabel(labels[i], { exact: true })).toHaveValue(
      formulas[i]
    );
});
