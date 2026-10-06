/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect, Page, TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleFooterTicker } from "./helpers/footer-ticker";
import * as fs from "fs";
import * as path from "path";

/**
 * Helper to save scan results to JSON files for CI reporting and trend tracking.
 */
function saveResult(
  projectName: string,
  stateName: string,
  violations: any[],
  checkedUrl: string
) {
  const dir = path.join(
    __dirname,
    "../../playwright-report/accessibility-results"
  );
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const safeStateName = stateName.replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `${projectName}-${safeStateName}.json`;
  const filePath = path.join(dir, filename);

  const resultData = {
    project: projectName,
    state: stateName,
    url: checkedUrl,
    violationsCount: violations.length,
    violations: violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n: any) => ({
        target: n.target,
        html: n.html,
      })),
    })),
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(filePath, JSON.stringify(resultData, null, 2));
}

/**
 * Helper to format failure messages clearly in terminal logs with CSS selectors and HTML snippets.
 */
function formatViolationsForLog(
  projectName: string,
  stateName: string,
  violations: any[]
): string {
  if (violations.length === 0) return "";
  let log = `\n==================================================\n`;
  log += `🚨 ACCESSIBILITY VIOLATIONS DETECTED (${projectName} - ${stateName})\n`;
  log += `Found ${violations.length} critical, serious, or moderate violations.\n`;
  log += `==================================================\n\n`;

  violations.forEach((violation, idx) => {
    log += `Violation #${idx + 1}:\n`;
    log += `  Rule ID:     ${violation.id}\n`;
    log += `  Severity:    ${violation.impact}\n`;
    log += `  Description: ${violation.description}\n`;
    log += `  Help:        ${violation.help}\n`;
    log += `  Help URL:    ${violation.helpUrl}\n`;
    log += `  Affected Elements:\n`;
    violation.nodes.forEach((node: any, nIdx: number) => {
      log += `    Element ${nIdx + 1}:\n`;
      log += `      CSS Selector: ${node.target.join(" > ")}\n`;
      log += `      HTML snippet: ${node.html}\n`;
    });
    log += `--------------------------------------------------\n\n`;
  });
  return log;
}

/**
 * Waits for the /simulator step card to finish its fade-in. The card is a
 * framer-motion section that enters from opacity 0, and its text appears in
 * the DOM before the fade ends, so an axe scan taken on the first frame
 * measures the partially transparent text as a contrast failure. Waiting for
 * exactly one card (the AnimatePresence exit has finished) at full opacity
 * audits the step at rest, as a reader sees it.
 */
async function settleSimulatorStep(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const sections = document.querySelectorAll<HTMLElement>(
      'section[aria-labelledby="simulator-step-heading"], section[aria-labelledby="simulator-result-heading"]'
    );
    return (
      sections.length === 1 &&
      Number(window.getComputedStyle(sections[0]).opacity) === 1
    );
  });
}

/**
 * Common helper to execute AxeBuilder audit with strict WCAG 2.1 AA rules and zero tolerance.
 */
async function auditAndAssert(
  page: Page,
  testInfo: TestInfo,
  stateName: string,
  options: { disableRules?: string[]; exclude?: string[] } = {}
) {
  if (options.disableRules && options.disableRules.length > 0) {
    throw new Error(
      `Prohibited disableRules override detected in test [${stateName}]: ${options.disableRules.join(
        ", "
      )}. Shift-left zero-tolerance policy forbids disabling WCAG rules.`
    );
  }

  let builder = new AxeBuilder({ page }).withTags([
    "wcag2a",
    "wcag2aa",
    "wcag21a",
    "wcag21aa",
    "best-practice",
  ]);

  for (const selector of options.exclude ?? []) {
    builder = builder.exclude(selector);
  }

  await settleFooterTicker(page);
  const results = await builder.analyze();
  // Filter for critical, serious, and moderate violations (zero tolerance policy)
  const targetViolations = results.violations.filter(
    (v) =>
      v.impact === "critical" ||
      v.impact === "serious" ||
      v.impact === "moderate"
  );

  saveResult(testInfo.project.name, stateName, targetViolations, page.url());

  if (targetViolations.length > 0) {
    const errorLog = formatViolationsForLog(
      testInfo.project.name,
      stateName,
      targetViolations
    );
    console.error(errorLog);
  }

  expect(
    targetViolations.length,
    `Found ${targetViolations.length} critical/serious/moderate accessibility violations in [${stateName}]`
  ).toBe(0);
}

test.describe("Continuous Accessibility (a11y) & WCAG 2.1 AA Audit Suite", () => {
  test.beforeEach(async ({ page }) => {
    // Emulate reduced motion to disable JS transitions/animations
    await page.emulateMedia({ reducedMotion: "reduce" });

    // Inject the global test flag so components enable deterministic testing behaviors
    await page.addInitScript(() => {
      (
        window as unknown as { __PLAYWRIGHT_TEST__?: boolean }
      ).__PLAYWRIGHT_TEST__ = true;
    });

    // Disable CSS animations for consistent layout scanning
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          transition: none !important;
          animation: none !important;
        }
      `,
    });
  });

  test("Audit: Default Landing Page State", async ({ page }, testInfo) => {
    await page.goto("/");
    await page.waitForFunction(() => {
      const elements = Array.from(document.querySelectorAll(".text-\\[9px\\]"));
      return (
        elements.length > 0 &&
        elements.every((el) => !el.textContent?.includes("MEASURING..."))
      );
    });
    await page.waitForTimeout(300);

    await auditAndAssert(page, testInfo, "Default Landing Page State");
  });

  test("Audit: Interactive Project Filtering Tab State", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await page.waitForFunction(() => {
      const elements = Array.from(document.querySelectorAll(".text-\\[9px\\]"));
      return (
        elements.length > 0 &&
        elements.every((el) => !el.textContent?.includes("MEASURING..."))
      );
    });

    const filterBtn = page.locator('button:has-text("TypeScript")');
    if (await filterBtn.isVisible()) {
      await filterBtn.click();
      await page.waitForTimeout(300);
    }

    await auditAndAssert(
      page,
      testInfo,
      "Interactive State: TypeScript Filter"
    );
  });

  test("Audit: Active Command Palette Search State", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    await page.waitForFunction(
      () => typeof window.__openSearch === "function",
      { timeout: 15000 }
    );

    await page.evaluate(() => {
      if (typeof window.__openSearch === "function") {
        window.__openSearch();
      }
    });

    const combobox = page.locator('[role="combobox"]');
    await expect(combobox).toBeVisible();

    await combobox.fill("TypeScript");
    await page.waitForTimeout(200);

    await auditAndAssert(
      page,
      testInfo,
      "Interactive State: Active Command Palette"
    );
  });

  test("Audit: Command Palette Focus Restoration", async ({
    page,
  }, testInfo) => {
    // The 404 page never reaches "networkidle": background telemetry keeps
    // requests in flight (#928). Wait on the DOM and on hydration instead.
    await page.goto("/this-is-not-found", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(
      () => typeof window.__openSearch === "function",
      { timeout: 15000 }
    );

    const searchBtn = page.getByRole("button", { name: "Search Site" });
    await expect(searchBtn).toBeVisible();

    const combobox = page.locator('[role="combobox"]');
    await expect(async () => {
      await searchBtn.focus();
      await expect(searchBtn).toBeFocused();
      await searchBtn.click();
      await expect(combobox).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 15000 });
    await expect(combobox).toBeFocused();

    await auditAndAssert(page, testInfo, "Command Palette Focus State");

    await page.keyboard.press("Escape");
    await expect(combobox).not.toBeVisible();

    const isFocused = await searchBtn.evaluate(
      (el) => document.activeElement === el
    );
    expect(
      isFocused,
      "Keyboard focus did not return to the calling button when the modal closed"
    ).toBe(true);
  });

  test("Audit: Mobile Navigation Focus Trap", async ({ page }, testInfo) => {
    const isMobile =
      page.viewportSize()?.width && page.viewportSize()!.width < 768;
    if (!isMobile) {
      saveResult(
        testInfo.project.name,
        "Mobile Navigation Focus Trap",
        [],
        page.url()
      );
      return;
    }

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const menuTrigger = page.locator('[aria-label="Open navigation menu"]');
    if (await menuTrigger.isVisible()) {
      await menuTrigger.click();

      const menuContainer = page.locator("#mobile-navigation");
      await expect(menuContainer).toBeVisible();
      await page.waitForTimeout(200);

      const isFocusedInitiallyInside = await page.evaluate(() => {
        return !!document.activeElement?.closest("#mobile-navigation");
      });
      expect(isFocusedInitiallyInside).toBe(true);

      await auditAndAssert(page, testInfo, "Mobile Navigation Open State");

      // Tab trapping test
      let focusEscaped = false;
      for (let i = 0; i < 15; i++) {
        await page.keyboard.press("Tab");
        const inside = await page.evaluate(() => {
          return !!document.activeElement?.closest("#mobile-navigation");
        });
        if (!inside) {
          focusEscaped = true;
          break;
        }
      }
      expect(
        focusEscaped,
        "Focus escaped the open mobile menu during Tab navigation"
      ).toBe(false);
    }
  });

  test("Audit: CRF Studio & CDISC Form Designer", async ({
    page,
  }, testInfo) => {
    await page.goto("/crf");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("text=CRF Studio", { timeout: 15000 });

    await auditAndAssert(page, testInfo, "CRF Studio Default State");
  });

  /**
   * The field manual fades in under framer-motion, which drives opacity through
   * inline style rather than a CSS animation, so the injected `animation: none`
   * reset does not stop it. Scanning mid-fade measures a partially transparent
   * foreground and reports a false contrast failure, so wait for the dialog and
   * its ancestors to reach full opacity first. Decorative descendants with a
   * deliberate opacity (the ambient gradient wash) are intentionally not waited
   * on, since they never settle at 1.
   */
  async function waitForDialogFadeIn(page: Page) {
    await page.waitForFunction(
      () => {
        const dialog = document.querySelector('[role="dialog"]');
        if (!dialog) return false;
        let node: Element | null = dialog;
        while (node) {
          if (Number(window.getComputedStyle(node).opacity) < 1) return false;
          node = node.parentElement;
        }
        return true;
      },
      undefined,
      { timeout: 10000 }
    );

    // framer-motion drives the entrance through inline style, so the ancestor
    // walk above can report 1 while descendants are still interpolating. A
    // short settle — the same approach the Proof Workspace audit uses — makes
    // the scan deterministic.
    await page.waitForTimeout(600);
  }

  test("Audit: Patrol Shift Intro, Briefing, Map Hub & Field Manual", async ({
    page,
  }, testInfo) => {
    test.setTimeout(60000);
    await page.goto("/patrol");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector('[data-testid="patrol-shift-container"]', {
      timeout: 15000,
    });

    // 1. INTRO
    await page.waitForSelector('[data-testid="patrol-intro-screen"]', {
      timeout: 15000,
    });
    await auditAndAssert(page, testInfo, "Patrol Shift Intro Screen");

    // 2. Field manual — reachable at any point, and must trap focus cleanly.
    await expect(async () => {
      await page
        .getByRole("button", { name: /Open Field Manual for Patrol Shift/i })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await waitForDialogFadeIn(page);
    await auditAndAssert(page, testInfo, "Patrol Shift Field Manual Modal");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();

    // 3. BRIEFING
    await expect(async () => {
      await page.getByRole("button", { name: /Begin Shift Briefing/i }).click();
      await expect(
        page.locator('[data-testid="patrol-briefing-screen"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await auditAndAssert(page, testInfo, "Patrol Shift Briefing Screen");

    // 4. MOUNTAIN MAP HUB
    await expect(async () => {
      await page
        .getByRole("button", { name: /Depart Base \/ Open Mountain/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-mountain-map"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await auditAndAssert(page, testInfo, "Patrol Shift Mountain Map Hub");
  });

  test("Audit: Patrol Shift Dispatch, Scene, Transport & Debrief", async ({
    page,
  }, testInfo) => {
    await page.goto("/patrol");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector('[data-testid="patrol-shift-container"]', {
      timeout: 15000,
    });

    await expect(async () => {
      await page
        .getByRole("button", { name: /Skip Intro|Resume Shift/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-mountain-map"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await expect(async () => {
      await page
        .getByRole("button", { name: /Standby on Hill \/ Await Dispatch/i })
        .click();
      await expect(
        page.getByRole("button", { name: /Acknowledge & Respond/i })
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await auditAndAssert(page, testInfo, "Patrol Shift Dispatch Overlay");

    // SCENE (OEC)
    await expect(async () => {
      await page
        .getByRole("button", { name: /Acknowledge & Respond/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-scene-interaction"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });
    await auditAndAssert(page, testInfo, "Patrol Shift Scene Interaction");
  });

  test("Audit: Patrol Shift OET step-through accessibility fallback", async ({
    page,
  }, testInfo) => {
    await page.goto("/patrol");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector('[data-testid="patrol-shift-container"]', {
      timeout: 15000,
    });

    await expect(async () => {
      await page
        .getByRole("button", { name: /Skip Intro|Resume Shift/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-mountain-map"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await expect(async () => {
      await page
        .getByRole("button", { name: /Standby on Hill \/ Await Dispatch/i })
        .click();
      await page
        .getByRole("button", { name: /Acknowledge & Respond/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-scene-interaction"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 20000 });

    await expect(async () => {
      await page
        .getByRole("button", { name: /Stabilize & Prepare Toboggan/i })
        .click();
      await expect(
        page.locator('[data-testid="patrol-oet-canvas"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    // Step-through must be a real, auditable alternative path to the real-time
    // descent, not a documented intention (Issue #756).
    await expect(async () => {
      await page.getByRole("button", { name: /Step-Through Mode/i }).click();
      await expect(
        page.locator('[data-testid="oet-a11y-step-controls"]')
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15000 });

    await auditAndAssert(page, testInfo, "Patrol Shift OET Step-Through Mode");
  });

  test("Audit: Logical Proof Workspace", async ({ page }, testInfo) => {
    await page.goto("/proof", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("button", { name: /Share/i }).first()
    ).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(400);

    await auditAndAssert(
      page,
      testInfo,
      "Logical Proof Workspace Default State"
    );
  });

  test("Audit: Incident Commander Simulator Route & Step Transitions", async ({
    page,
  }, testInfo) => {
    await page.goto("/simulator");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("text=1. Choose Your Architecture Bias", {
      timeout: 15000,
    });

    // 1. Initial / Default Stage 1 Audit
    await settleSimulatorStep(page);
    await auditAndAssert(
      page,
      testInfo,
      "Incident Commander Simulator Default State"
    );

    // 2. Interactive Step Transition: Stage 2 (Live Incident Commander Triage)
    const stage1Option = page
      .locator('button:has-text("Systems Rigor & Fault Isolation")')
      .or(
        page.locator('button:has-text("Interface Clarity & Human Ergonomics")')
      )
      .first();
    if (await stage1Option.isVisible()) {
      await stage1Option.click();
      await page.waitForSelector(
        "text=2. Live Incident Commander: Production Latency Spike",
        { timeout: 10000 }
      );
      await settleSimulatorStep(page);
      await auditAndAssert(
        page,
        testInfo,
        "Incident Commander Simulator Step 2 Triage State"
      );

      // 3. Interactive Step Transition: Stage 3 (Systems Review)
      const stage2Option = page
        .locator('button:has-text("Engage Distributed Circuit Breaker")')
        .or(page.locator('button:has-text("Scale Neon Read-Replicas")'))
        .first();
      if (await stage2Option.isVisible()) {
        await stage2Option.click();
        await page.waitForSelector("text=3. Code Review Speed Challenge", {
          timeout: 10000,
        });
        await settleSimulatorStep(page);
        await auditAndAssert(
          page,
          testInfo,
          "Incident Commander Simulator Step 3 Review State"
        );

        // 4. Final Architectural Archetype evaluation
        await page
          .locator('button:has-text("Enforce Exhaustive Idempotency Keys")')
          .first()
          .click();
        await page.waitForSelector("text=Decision stats", { timeout: 10000 });
        await settleSimulatorStep(page);
        await auditAndAssert(
          page,
          testInfo,
          "Incident Commander Simulator Archetype Result State"
        );
      }
    }
  });

  test("Audit: Neuroimaging Route - Default State (Component-Aware Loading)", async ({
    page,
  }, testInfo) => {
    await page.goto("/neuro");
    await page.waitForLoadState("networkidle");

    // Component-aware synchronization: Wait for dynamic skeleton placeholder to detach before auditing
    const skeleton = page.locator('[data-testid="brain-3d-skeleton"]');
    await skeleton.waitFor({ state: "detached", timeout: 30000 });

    await auditAndAssert(page, testInfo, "Neuroimaging Studio Default State");
  });

  test("Audit: Neuroimaging Route - Interactive Slice Viewing & Sub-states", async ({
    page,
  }, testInfo) => {
    await page.goto("/neuro");
    await page.waitForLoadState("networkidle");

    // Component-aware synchronization: Wait for dynamic skeleton placeholder to detach
    const skeleton = page.locator('[data-testid="brain-3d-skeleton"]');
    await skeleton.waitFor({ state: "detached", timeout: 30000 });

    // Interact with Multi-Planar Slice Viewer tools or view modes
    const toolBtn = page
      .locator('button:has-text("Voxel Paint Brush")')
      .or(page.locator('button:has-text("Control Point")'))
      .first();
    if (await toolBtn.isVisible()) {
      await toolBtn.click();
      await page.waitForTimeout(300);
    }

    await auditAndAssert(
      page,
      testInfo,
      "Neuroimaging Studio Interactive Slice Viewing State"
    );
  });

  test("Audit: Consultation & Schedule Page", async ({ page }, testInfo) => {
    await page.goto("/schedule");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);

    await auditAndAssert(page, testInfo, "Schedule Page Default State");
  });

  test("Audit: Case Study Deep-Dive Reader", async ({ page }, testInfo) => {
    await page.goto("/case-studies/clinical-data-mapper");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(300);

    await auditAndAssert(page, testInfo, "Case Study Reader State");
  });

  test("Audit: Arcade Hub & Game Suite", async ({ page }, testInfo) => {
    await page.goto("/arcade");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);

    await auditAndAssert(page, testInfo, "Arcade Hub Default State");
  });

  test("Audit: Arcade Game - Clinical Chaos", async ({ page }, testInfo) => {
    await page.goto("/arcade/clinical-chaos");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    await auditAndAssert(page, testInfo, "Arcade Game: Clinical Chaos");
  });

  test("Audit: Arcade Game - Garmin Watch Simulator", async ({
    page,
  }, testInfo) => {
    await page.goto("/arcade/garmin-watch");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    await auditAndAssert(page, testInfo, "Arcade Game: Garmin Watch");
  });

  test("Audit: Arcade Game - Laser Loon", async ({ page }, testInfo) => {
    await page.goto("/arcade/laser-loon");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    await auditAndAssert(page, testInfo, "Arcade Game: Laser Loon");
  });

  test("Audit: Arcade Game - Quasi-Perfect Puzzler", async ({
    page,
  }, testInfo) => {
    await page.goto("/arcade/quasi-puzzler");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    await auditAndAssert(page, testInfo, "Arcade Game: Quasi Puzzler");
  });

  test("Audit: Arcade Game - Retro Labyrinth", async ({ page }, testInfo) => {
    await page.goto("/arcade/retro-labyrinth");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    await auditAndAssert(page, testInfo, "Arcade Game: Retro Labyrinth");
  });

  test("Audit: Arcade Game - Working With Duck", async ({ page }, testInfo) => {
    await page.goto("/arcade/working-with-duck");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    await auditAndAssert(page, testInfo, "Arcade Game: Working With Duck");
  });

  test("Audit: Arcade Game - Patty's Drive-Thru", async ({
    page,
  }, testInfo) => {
    await page.goto("/arcade/patty-drive-thru");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);

    await auditAndAssert(page, testInfo, "Arcade Game: Patty's Drive-Thru");
  });
});
