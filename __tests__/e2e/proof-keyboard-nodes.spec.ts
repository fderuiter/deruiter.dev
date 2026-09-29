import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function tabToNode(page: Page, canvas: Locator, node: Locator) {
  await canvas.focus();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    if (await node.evaluate((element) => element === document.activeElement))
      break;
  }
  await expect(node).toBeFocused();
}

for (const layout of [
  { name: "320px", width: 320, scale: 1 },
  { name: "375px", width: 375, scale: 1 },
  { name: "200% text", width: 1280, scale: 2 },
]) {
  test(`Proof nodes support keyboard connections, rules and accessible targets at ${layout.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: layout.width, height: 900 });
    await page.goto("/proof");
    if (layout.scale === 2)
      await page.addStyleTag({
        content: "html { font-size: 200% !important; }",
      });
    const canvas = page.getByRole("region", { name: "Proof workspace canvas" });
    const node = (id: string) =>
      canvas.getByRole("button", { name: new RegExp(`^Node ${id},`) });
    await expect(async () => {
      await expect(node("A")).toBeVisible();
      await tabToNode(page, canvas, node("A"));
    }).toPass({ timeout: 15000 });
    expect(
      await node("A").evaluate((element) =>
        parseFloat(getComputedStyle(element).outlineWidth)
      )
    ).toBeGreaterThan(0);
    await tabToNode(page, canvas, node("C"));
    await page.keyboard.press("Enter");
    await expect(node("C")).toHaveAttribute("aria-pressed", "true");
    await tabToNode(page, canvas, node("E"));
    await page.keyboard.press("Space");
    await expect(node("E")).toHaveAccessibleName(/conclusion, pending/);
    await tabToNode(
      page,
      canvas,
      canvas.getByRole("button", {
        name: /^Drag connection handle from Node D,/,
      })
    );
    await page.keyboard.press("Enter");
    await tabToNode(page, canvas, node("E"));
    await page.keyboard.press("Enter");
    await expect(node("E")).toHaveAccessibleName(/conclusion, proven/);
    await tabToNode(page, canvas, node("E"));
    await page.keyboard.press("Enter");
    await tabToNode(page, canvas, node("A"));
    await page.keyboard.press("Space");
    await expect(
      page
        .locator('[aria-live="assertive"]')
        .filter({ hasText: /Connection rejected:/ })
    ).toContainText("Connection rejected:");
    const reset = page.getByTitle("Reset node positions & connections");
    await reset.focus();
    await page.keyboard.press("Enter");
    await tabToNode(page, canvas, node("C"));
    await page.keyboard.press("Shift+Enter");
    await tabToNode(page, canvas, node("D"));
    await page.keyboard.press("Shift+Space");
    await expect(node("C")).toHaveAttribute("aria-pressed", "true");
    await expect(node("D")).toHaveAttribute("aria-pressed", "true");
    const mp = page.getByTitle(/^Modus Ponens:/);
    await mp.focus();
    await page.keyboard.press("Enter");
    await expect(node("E")).toHaveAccessibleName(/conclusion, proven/);
    for (const handle of await canvas
      .getByRole("button", { name: /^Drag connection handle/ })
      .all()) {
      const bounds = await handle.boundingBox();
      expect(bounds?.width).toBeGreaterThanOrEqual(44);
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
      const sourceId = (await handle.getAttribute("aria-label"))?.match(
        /Node ([A-E]),/
      )?.[1];
      for (const other of await canvas
        .getByRole("button", { name: /^Node / })
        .all()) {
        if (
          (await other.getAttribute("aria-label"))?.startsWith(
            `Node ${sourceId},`
          )
        )
          continue;
        const otherBounds = await other.boundingBox();
        expect(
          bounds &&
            otherBounds &&
            bounds.x < otherBounds.x + otherBounds.width &&
            bounds.x + bounds.width > otherBounds.x &&
            bounds.y < otherBounds.y + otherBounds.height &&
            bounds.y + bounds.height > otherBounds.y
        ).toBe(false);
      }
    }
    const violations = (
      await new AxeBuilder({ page })
        .include('[aria-label="Proof workspace canvas"]')
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations.filter((item) =>
      ["critical", "serious", "moderate"].includes(item.impact ?? "")
    );
    expect(violations).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth + 1
      )
    ).toBe(true);
  });
}
