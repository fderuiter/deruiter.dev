import { test, expect } from "@playwright/test";
import { waitForVisualSettle } from "./helpers/settle";

test.describe("XYFlow Desktop Graph & Mobile Topological Stack", () => {
  test("renders all five nodes in vertical rank order on /m/proof at 390x844 with zero horizontal overflow", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/m/proof");

    const stack = page.getByTestId("proof-mobile-topological-stack");
    await expect(stack).toBeVisible({ timeout: 15000 });

    const yPositions: number[] = [];
    for (const id of ["A", "B", "C", "D", "E"]) {
      const card = page.getByTestId(`mobile-proof-node-${id}`);
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(250);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(390);
      yPositions.push(box!.y);
    }

    // Strict vertical rank ordering A -> B -> C -> D -> E
    for (let i = 1; i < yPositions.length; i++) {
      expect(yPositions[i]).toBeGreaterThan(yPositions[i - 1]);
    }

    const noHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(noHorizontalOverflow).toBe(true);
  });

  for (const width of [320, 375]) {
    test(`skips XYFlow assets and keeps CLS below 0.1 on mobile at ${width}px`, async ({
      page,
    }) => {
      const requestedAssets: string[] = [];
      page.on("request", (req) => {
        requestedAssets.push(req.url());
      });

      await page.addInitScript(() => {
        (window as unknown as { __proofCls: number }).__proofCls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as (PerformanceEntry & {
            value?: number;
            hadRecentInput?: boolean;
          })[]) {
            if (!entry.hadRecentInput && typeof entry.value === "number") {
              (window as unknown as { __proofCls: number }).__proofCls +=
                entry.value;
            }
          }
        }).observe({ type: "layout-shift", buffered: true });
      });

      await page.setViewportSize({ width, height: 812 });
      await page.goto("/proof");

      await expect(
        page.getByTestId("proof-mobile-topological-stack")
      ).toBeVisible({ timeout: 15000 });
      await waitForVisualSettle(page);

      await expect(page.locator(".react-flow")).toHaveCount(0);
      const xyflowRequests = requestedAssets.filter((url) =>
        /xyflow|ProofFlowCanvas/i.test(url)
      );
      expect(xyflowRequests).toEqual([]);

      const cls = await page.evaluate(
        () => (window as unknown as { __proofCls: number }).__proofCls
      );
      expect(cls).toBeLessThan(0.1);
    });
  }

  test("frames Custom Studio nodes A-E inside desktop XYFlow viewport at 1280x800 and preserves valid edges on fallacy dismissal", async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/proof");

    await page
      .getByRole("button", { name: "Custom Studio", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Custom Invariant Studio",
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByLabel("Premise 1 Formula:", { exact: true })
      .fill("Alpha");
    await dialog
      .getByLabel("Premise 2 Formula:", { exact: true })
      .fill("Alpha -> Beta");
    await dialog
      .getByLabel("Premise 3 Formula:", { exact: true })
      .fill("Beta -> Gamma");
    await dialog
      .getByLabel("Target Invariant Goal:", { exact: true })
      .fill("Gamma");
    await dialog.getByRole("button", { name: "Load into Workspace" }).click();
    await expect(dialog).toBeHidden();

    const canvas = page.getByRole("region", { name: "Proof workspace canvas" });
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    for (const id of ["A", "B", "C", "D", "E"]) {
      const nodeBtn = canvas.getByRole("button", {
        name: new RegExp(`^Node ${id} `),
      });
      const handleBtn = canvas.getByRole("button", {
        name: new RegExp(`^Drag connection handle from Node ${id},`),
      });
      await expect(nodeBtn).toBeVisible();
      await expect(handleBtn).toBeVisible();

      const handleBox = await handleBtn.boundingBox();
      expect(handleBox).not.toBeNull();
      expect(handleBox!.width).toBeGreaterThanOrEqual(44);
      expect(handleBox!.height).toBeGreaterThanOrEqual(44);
      expect(handleBox!.x).toBeGreaterThanOrEqual(canvasBox!.x - 2);
      expect(handleBox!.x + handleBox!.width).toBeLessThanOrEqual(
        canvasBox!.x + canvasBox!.width + 2
      );
      expect(handleBox!.y).toBeGreaterThanOrEqual(canvasBox!.y - 2);
      expect(handleBox!.y + handleBox!.height).toBeLessThanOrEqual(
        canvasBox!.y + canvasBox!.height + 2
      );
    }

    // Establish A -> C and B -> C via Auto-Step so Node C is PROVEN with 2 active edges
    await page.getByRole("button", { name: "Auto-Step", exact: true }).click();
    await expect(canvas.locator(".react-flow__edge")).toHaveCount(2);
    await expect(
      canvas.getByRole("button", { name: /^Node C PROVEN / })
    ).toBeVisible();

    // Attempt invalid move D -> C and dismiss fallacy non-destructively
    const input = page.getByPlaceholder(/Enter logic command/i);
    await input.fill("connect D C");
    await input.press("Enter");
    await expect(
      page.getByText("FALLACY DETECTED", { exact: true })
    ).toBeVisible();

    await page
      .getByRole("button", { name: /Dismiss Fallacy/i })
      .first()
      .click();

    await expect(
      page.getByText("FALLACY DETECTED", { exact: true })
    ).toBeHidden();
    await expect(canvas.locator(".react-flow__edge")).toHaveCount(2);
    await expect(
      canvas.getByRole("button", { name: /^Node C PROVEN / })
    ).toBeVisible();

    // Connecting reverse edges E -> C and E -> D must fail validation and never trigger GRAPH COMPLETE
    await input.fill("connect E C");
    await input.press("Enter");
    await expect(
      page.getByText("FALLACY DETECTED", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(/GRAPH COMPLETE/)).toHaveCount(0);

    await input.fill("connect E D");
    await input.press("Enter");
    await expect(
      page.getByText("FALLACY DETECTED", { exact: true })
    ).toBeVisible();
    await expect(page.getByText(/GRAPH COMPLETE/)).toHaveCount(0);

    // Complete C -> E and D -> E via Auto-Step and verify URL hash restores proven edges
    await page
      .getByRole("button", { name: /Dismiss Fallacy/i })
      .first()
      .click();
    await page.getByRole("button", { name: "Auto-Step", exact: true }).click();
    await expect(page.getByText(/GRAPH COMPLETE/)).toBeVisible();
    await expect(canvas.locator(".react-flow__edge")).toHaveCount(4);
    await expect(page).toHaveURL(/edges=/);

    // Click Share and verify opening the copied Share URL restores proven custom edges
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const copiedShareUrl = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(copiedShareUrl).toContain("theorem=custom");
    expect(copiedShareUrl).toContain("edges=");

    const restoredPage = await context.newPage();
    await restoredPage.setViewportSize({ width: 1280, height: 800 });
    await restoredPage.goto(copiedShareUrl);
    const restoredCanvas = restoredPage.getByRole("region", {
      name: "Proof workspace canvas",
    });
    await expect(restoredPage.getByText(/GRAPH COMPLETE/)).toBeVisible();
    await expect(restoredCanvas).toContainText("Alpha -> Beta");
    await expect(restoredCanvas.locator(".react-flow__edge")).toHaveCount(4);
    await restoredPage.close();
  });

  test("logs consensus steps when simulating paxos-synod, paxos-phase2b, and bft-quorum", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    const scenarios = [
      { id: "paxos-synod", pattern: /quorum|Paxos|ballot/i },
      { id: "paxos-phase2b", pattern: /2b|chosen|quorum/i },
      { id: "bft-quorum", pattern: /Byzantine|honest|3f/i },
    ];

    for (let i = 0; i < scenarios.length; i++) {
      const scenario = scenarios[i];
      await page.goto(`/proof#theorem=${scenario.id}`);
      await page.getByRole("button", { name: "Simulate", exact: true }).click();
      await expect(
        page.getByText(/Background Simulation completed successfully/)
      ).toHaveCount(i + 1, { timeout: 15000 });
      const logText = await page.locator("body").innerText();
      expect(logText).toMatch(scenario.pattern);
    }
  });
});
