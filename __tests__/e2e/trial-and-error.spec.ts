import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { settleFooterTicker } from "./helpers/footer-ticker";
import {
  BIOSTAT_OPS_CAMPAIGN,
  advanceRun,
  deriveRunView,
  createRunState,
  dailySeed,
  runBlinds,
  serializeRun,
  type LoggedAction,
  type RunState,
} from "../../lib/trial-and-error";
import { playBlind } from "../utils/trial-and-error-bot";
import { amendmentInTray } from "../utils/trial-and-error-amendment-run";
import { deviationLanded } from "../utils/trial-and-error-deviation-run";

/**
 * A fixed seed makes the crisis draw repeatable (T&E-05): this one deals the
 * Site Audit at the start of the Big Blind.
 */
const SEED = "e2e-4";
/** The route plays the three-act campaign (#924). */
const CAMPAIGN = BIOSTAT_OPS_CAMPAIGN;
const ROUTE = `/arcade/trial-and-error?seed=${SEED}`;
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOCKING = new Set(["critical", "serious", "moderate"]);
const DRAFT_A = "C-T14.1.1-A";
const DM_LISTING = "C-L16.2.4";

async function launch(page: Page) {
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await expect(async () => {
    const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
    if (await launchBtn.isVisible()) {
      await launchBtn.click();
    }
    await expect(page.getByTestId("hand")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
}

async function expectNoBlockingViolations(page: Page, state: string) {
  // The footer stays in scope, held on a settled line (#952).
  await settleFooterTicker(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = results.violations
    .filter((v) => BLOCKING.has(v.impact ?? ""))
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
    );
  expect(blocking, `axe violations in state "${state}"`).toEqual([]);
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const card = (page: Page, id: string) => page.locator(`[data-card-id="${id}"]`);
const player = (page: Page) => page.getByTestId("score-player");

interface TeProbe {
  seen: string[];
  entries: { start: number; value: number; sources: string[] }[];
  end: number | null;
  /** The hand's document box when the player first appears. */
  hand: { x: number; y: number; width: number; height: number } | null;
}
const drawer = (page: Page) => page.getByTestId("inspect-drawer");
const gridCell = (page: Page, row: number, col: number) =>
  drawer(page)
    .getByRole("row")
    .nth(row + 1)
    .getByRole("gridcell")
    .nth(col);

/** Clears the Small Blind with Draft A and its listing, then deals the next. */
async function clearSmallBlind(page: Page) {
  await winSmallBlind(page);
  await page.getByRole("button", { name: "Next Blind" }).click();
  await expect(page.getByTestId("blind-name")).toHaveText(
    "Big Blind: Sponsor Safety Review"
  );
  await answerSiteAudit(page);
}

/** Clears the Small Blind with Draft A and its listing. */
async function winSmallBlind(page: Page) {
  await card(page, DRAFT_A).focus();
  await page.keyboard.press("i");
  await expect(gridCell(page, 0, 0)).toBeFocused();
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
  await expect(drawer(page)).toBeHidden();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await expect(page.getByTestId("blind-result")).toContainText("Blind cleared");
}

/** Answers the seeded Site Audit by hosting it, which costs nothing now. */
async function answerSiteAudit(page: Page) {
  const choice = page.getByRole("button", { name: /Host the auditors/ });
  await expect(choice).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("crisis")).toBeHidden();
  await expect(page.getByTestId("blind-modifier")).toContainText("Crisis:");
}

test.describe("Trial & Error: Biostat Ops Card Table", () => {
  test("is fully keyboard-playable: inspect, correct, select, play and clear the Small Blind", async ({
    page,
  }) => {
    await launch(page);
    await card(page, DRAFT_A).focus();

    // Inspect Draft A (1 CPU): focus moves into the drawer's review grid.
    await page.keyboard.press("i");
    await expect(drawer(page)).toBeVisible();
    await expect(gridCell(page, 0, 0)).toBeFocused();
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 3; col++) {
        await expect(gridCell(page, row, col)).toBeFocused();
        await page.keyboard.press("Enter");
        await page.keyboard.press("c");
        if (col < 2) await page.keyboard.press("ArrowRight");
      }
      if (row < 4) {
        await page.keyboard.press("Home");
        await page.keyboard.press("ArrowDown");
      }
    }
    await expect(drawer(page).getByTestId("expected-value")).toHaveText(
      "[57] × [8] = 456"
    );

    // Escape closes the drawer and returns focus to the card.
    await page.keyboard.press("Escape");
    await expect(drawer(page)).toBeHidden();
    await expect(card(page, DRAFT_A)).toBeFocused();

    // Select the TLF Pair and play it with Enter.
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await expect(card(page, DM_LISTING)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("hand-preview")).toContainText("TLF Pair");
    await expect(page.getByTestId("unverified-flag")).toBeHidden();
    await page.keyboard.press("Enter");

    // The scoring timeline takes focus on its Skip control; Space skips.
    await expect(player(page)).toBeVisible();
    await expect(page.getByRole("button", { name: /Skip/ })).toBeFocused();
    await page.keyboard.press("Space");
    await expect(player(page)).toBeHidden();

    await expect(page.getByTestId("blind-result")).toContainText(
      "Blind cleared"
    );
    await expect(page.getByTestId("blind-result")).toContainText("828 of 450");
    // Cash-out is the primary next step; Next Blind skips the shop.
    await expect(
      page.getByRole("button", { name: /^Cash out \$\d+k$/ })
    ).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Next Blind" })
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("blind-name")).toHaveText(
      "Big Blind: Sponsor Safety Review"
    );
    await expect(page.getByTestId("blind-intro")).toContainText(
      "safety physician"
    );

    // The Big Blind opens on a seeded crisis (T&E-05): the card turns up,
    // play waits for an answer, and a choice the run cannot afford says why.
    await expect(
      page.getByRole("heading", { name: "Crisis: Site Audit" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Play Hand/ })
    ).toBeDisabled();
    // The Small Blind's payout, collected on the way past the shop, covers
    // a remote audit.
    await expect(
      page.getByRole("button", { name: /Pay for a remote audit/ })
    ).toBeEnabled();
    await expectNoBlockingViolations(page, "Big Blind crisis");
    await answerSiteAudit(page);
    await expect(card(page, "C-T14.3.1-A")).toBeFocused();
    await expect(
      page.getByRole("button", { name: /Discard · 2 CPU/ })
    ).toBeVisible();
    await expectNoBlockingViolations(page, "Big Blind start");

    // Run Info (T&E-UX-05): Shift+R opens it with the seed; Escape returns
    // focus to the card.
    await page.keyboard.press("Shift+R");
    const runInfo = page.getByRole("dialog", { name: "Run Info" });
    await expect(runInfo.getByTestId("run-seed")).toHaveText(SEED);
    await expect(runInfo.getByTestId("run-info-hand")).toHaveCount(7);
    await expectNoBlockingViolations(page, "Run Info");
    await page.keyboard.press("Escape");
    await expect(runInfo).toBeHidden();
    await expect(card(page, "C-T14.3.1-A")).toBeFocused();
  });

  test("stales the Safety outputs when the data moves, and recompiles one with R (T&E-03)", async ({
    page,
  }) => {
    await launch(page);
    await clearSmallBlind(page);
    await expect(page.getByTestId("current-snapshot")).toHaveText("SNAP-P1-v1");

    // Play the ITT disposition table alone; S-004 then leaves the Safety set.
    await card(page, "C-T14.1.2").focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("current-snapshot")).toHaveText("SNAP-P1-v2");
    const stale = card(page, "C-T14.3.2.5-A");
    await expect(stale).toHaveAttribute("data-stale", "true");
    await expect(stale.locator('[data-stamp="STALE"]')).toBeVisible();
    await expect(stale.getByTestId("stale-badge")).toHaveText("25 → 0 Chips");
    await expect(card(page, "C-L16.1.1")).not.toHaveAttribute(
      "data-stale",
      "true"
    );
    await expectNoBlockingViolations(page, "stale cards");

    // A stale card blocks Play Hand until it is recompiled.
    await stale.focus();
    await page.keyboard.press("Space");
    await expect(page.getByTestId("stale-alert")).toContainText(
      "Output compiled against obsolete population snapshot; recompile required (2 CPU)."
    );
    await expect(
      page.getByRole("button", { name: /Play Hand/ })
    ).toBeDisabled();
    await page.keyboard.press("r");
    await expect(stale).not.toHaveAttribute("data-stale", "true");
    await expect(page.getByTestId("stale-alert")).toBeHidden();
    await expect(page.getByTestId("cpu-counter")).toHaveText("6/10");
    await expect(stale).toBeFocused();

    // Its snapshot is readable from the card detail.
    await page.keyboard.press("?");
    await expect(
      page.getByTestId("card-detail").getByTestId("snapshot-chip")
    ).toHaveText("SNAP-P1-v2 · v2");
  });

  test("allocates a blank shell to Safety for a flush, and seals it from the tray (T&E-04)", async ({
    page,
  }) => {
    await launch(page);
    // Send three ITT cards back to programming: the blank shell arrives.
    for (const id of [DRAFT_A, "C-T14.1.1-B", "C-L16.2.4"]) {
      await card(page, id).focus();
      await page.keyboard.press("Space");
    }
    await page.keyboard.press("d");
    const blank = card(page, "C-T14.1.3");
    await expect(blank).toHaveAttribute("data-blank", "true");
    await expect(
      page.getByTestId("cpu-pips").locator('[data-pip="spent"]')
    ).toHaveCount(1);

    for (const id of [
      "C-T14.3.1",
      "C-L16.2.7",
      "C-T14.3.2",
      "C-L16.2.8",
      "C-T14.1.3",
    ]) {
      await card(page, id).focus();
      await page.keyboard.press("Space");
    }
    await expect(page.getByTestId("empty-alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Play Hand/ })
    ).toBeDisabled();
    const options = page.getByTestId("allocate-option");
    await expect(options.nth(1)).toContainText("Population Flush");
    await expectNoBlockingViolations(page, "allocation preview");

    // A jumps to the allocation choices; Safety makes the flush.
    await page.keyboard.press("a");
    await expect(options.first()).toBeFocused();
    await options.nth(1).click();
    await expect(blank).not.toHaveAttribute("data-blank", "true");
    await expect(page.getByTestId("hand-preview")).toContainText(
      "Population Flush"
    );
    await expect(page.getByTestId("cpu-counter")).toHaveText("9/10");

    // Pick up the Adjudicated Endpoint seal and press it onto the shell.
    await page
      .getByTestId("consumable-tray")
      .getByRole("button", { name: /Adjudicated Endpoint/ })
      .click();
    await blank.focus();
    await page.keyboard.press("Enter");
    await expect(blank.getByTestId("seal-badge")).toHaveCount(1);
    await expect(page.getByTestId("consumable")).toHaveCount(1);
    await expectNoBlockingViolations(page, "sealed card and tray");

    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Next Blind" })).toBeVisible({
      timeout: 15000,
    });
  });

  test("an uninspected card still zeroes the hand, and D discards for 1 CPU", async ({
    page,
  }) => {
    await launch(page);
    await card(page, DRAFT_A).focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("unverified-flag")).toBeVisible();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await expect(page.getByTestId("last-hand")).toContainText(
      "(zero-score rule)"
    );
    await expect(page.getByTestId("cpu-counter")).toHaveText("8/10");

    await page.keyboard.press("Space");
    await page.keyboard.press("d");
    await expect(page.getByTestId("cpu-counter")).toHaveText("7/10");
    await expect(page.locator("[data-card-id]:focus")).toHaveCount(1);
  });

  for (const width of [390, 1440]) {
    test(`has zero blocking axe violations in every table state at ${width}px`, async ({
      page,
    }) => {
      // Several full-page axe scans plus a cabinet launch can outrun the
      // default 30s test budget when workers share the CPU.
      test.slow();
      // Audit settled frames: the site footer's status ticker cross-fades every
      // few seconds, and a scan landing mid-fade reads a blended ~1.3:1 colour
      // (#952). Reduced motion makes that swap instant without narrowing the
      // audit to the cabinet.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await launch(page);
      await expectNoBlockingViolations(page, "fresh hand");

      await card(page, DRAFT_A).click();
      await card(page, DM_LISTING).click();
      await expect(page.getByTestId("unverified-flag")).toBeVisible();
      await expectNoBlockingViolations(page, "pair selected, unverified");

      await card(page, DRAFT_A).focus();
      await page.keyboard.press("i");
      await expect(drawer(page)).toBeVisible();
      await gridCell(page, 2, 2).click();
      await expectNoBlockingViolations(
        page,
        "inspect drawer, fatal redline revealed"
      );

      await drawer(page)
        .getByRole("button", { name: /Flag & Correct/ })
        .click();
      await drawer(page)
        .getByRole("button", { name: /Close Inspect/ })
        .click();
      await expect(drawer(page)).toBeHidden();
      await expectNoBlockingViolations(page, "after a correction");

      await page.getByRole("button", { name: /Play Hand/ }).click();
      await expect(page.getByTestId("last-hand")).toBeVisible();
      await expectNoBlockingViolations(page, "after a played hand");

      // Spend the remaining CPU on single-card hands until the Blind ends.
      for (let i = 0; i < 6; i++) {
        if (await page.getByTestId("blind-result").isVisible()) break;
        await page.locator("[data-card-id]").first().click();
        await page.getByRole("button", { name: /Play Hand/ }).click();
      }
      await expect(page.getByTestId("blind-result")).toBeVisible();
      await expectNoBlockingViolations(page, "blind over");
    });
  }

  for (const width of [320, 375, 768, 1440]) {
    test(`has no horizontal page overflow at ${width}px, with and without the drawer`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await launch(page);
      await card(page, DRAFT_A).click();
      await expectNoHorizontalOverflow(page);
      await card(page, DRAFT_A).focus();
      await page.keyboard.press("i");
      await expect(drawer(page)).toBeVisible();
      await gridCell(page, 2, 1).click();
      await expectNoHorizontalOverflow(page);
    });
  }

  for (const width of [320, 375, 768]) {
    test(`reviews every Inspect cell by click at ${width}px (#956)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await launch(page);
      await card(page, DRAFT_A).focus();
      await page.keyboard.press("i");
      await expect(drawer(page)).toBeVisible();
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          const cell = gridCell(page, row, col);
          await cell.click();
          await expect(cell).not.toHaveAttribute("data-status", "UNREVIEWED");
        }
      }
      await expect(drawer(page).getByTestId("reviewed-count")).toHaveText(
        "15/15"
      );
    });
  }

  test("reflows without page overflow at 200% zoom", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await launch(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await card(page, DRAFT_A).click();
    await expectNoHorizontalOverflow(page);
  });

  test("opens Run Info without page overflow at 200% zoom", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await launch(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const runInfo = page.getByRole("dialog", { name: "Run Info" });
    await expect(async () => {
      await page.getByTestId("run-info-button").click();
      await expect(runInfo).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await expectNoHorizontalOverflow(page);
    await expectNoBlockingViolations(page, "Run Info at 200% zoom");
  });

  test("respects prefers-reduced-motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launch(page);
    // globals.css clamps every animation to 0.01ms and one iteration under
    // reduced motion; any animation still running longer is a regression.
    const lingering = await page
      .locator('section[aria-labelledby="card-table-heading"] *')
      .evaluateAll(
        (els) =>
          els
            .map((el) => getComputedStyle(el))
            .filter(
              (style) =>
                style.animationName !== "none" &&
                (parseFloat(style.animationDuration) > 0.01 ||
                  style.animationIterationCount !== "1")
            ).length
      );
    expect(lingering).toBe(0);
  });

  test.describe("scoring spectacle (T&E-UX-02)", () => {
    async function correctDraftA(page: Page) {
      await card(page, DRAFT_A).focus();
      await page.keyboard.press("i");
      await expect(drawer(page)).toBeVisible();
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
          await gridCell(page, row, col).click();
          await page.keyboard.press("c");
        }
      }
      await page.keyboard.press("Escape");
      await expect(drawer(page)).toBeHidden();
    }

    test("plays the timeline at 4× without layout shift and lands on CLEARED", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await page.getByRole("button", { name: "4×" }).click();
      await expect(page.getByRole("button", { name: "4×" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      await correctDraftA(page);
      await card(page, DRAFT_A).click();
      await card(page, DM_LISTING).click();

      // Record what playback shows and any layout shift while it runs: at 4×
      // the final frame holds for only 150 ms, too briefly to poll for.
      await page.evaluate(() => {
        const w = window as Window & { __te?: TeProbe };
        const probe: TeProbe = {
          seen: [],
          entries: [],
          end: null,
          hand: null,
        };
        w.__te = probe;
        const note = (label: string) => {
          if (!probe.seen.includes(label)) probe.seen.push(label);
        };
        new MutationObserver(() => {
          const player = document.querySelector('[data-testid="score-player"]');
          if (player) note("player");
          // Measured in the frame the player appears: at 4× on a loaded
          // machine the whole timeline can resolve before a later poll.
          const hand = document.querySelector('[data-testid="hand"]');
          if (player && hand && !probe.hand) {
            const r = hand.getBoundingClientRect();
            probe.hand = {
              x: r.left + window.scrollX,
              y: r.top + window.scrollY,
              width: r.width,
              height: r.height,
            };
          }
          if (player?.classList.contains("te-loud-fire")) note("fire");
          if (document.querySelector('[data-testid="player-cleared"]')) {
            note("player-cleared");
          }
          const flash = document.querySelector(
            '[data-testid="blind-cleared-flash"]'
          );
          if (flash?.textContent === "Cleared") note("blind-cleared-flash");
          if (!player && probe.seen.includes("player") && probe.end === null) {
            probe.end = performance.now();
          }
        }).observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
        });
        new PerformanceObserver((list) => {
          for (const raw of list.getEntries()) {
            const entry = raw as PerformanceEntry & {
              value: number;
              hadRecentInput: boolean;
              sources?: { node?: Node | null }[];
            };
            if (entry.hadRecentInput) continue;
            probe.entries.push({
              start: entry.startTime,
              value: entry.value,
              sources: (entry.sources ?? []).map((source) => {
                const el = source.node as HTMLElement | null;
                return (
                  el?.outerHTML ??
                  source.node?.parentElement?.outerHTML ??
                  ""
                ).slice(0, 160);
              }),
            });
          }
        }).observe({ type: "layout-shift" });
      });
      // Document-relative, so clicking Play (which may scroll) is not a shift.
      const handBox = () =>
        page.getByTestId("hand").evaluate((el) => {
          const r = el.getBoundingClientRect();
          return {
            x: r.left + window.scrollX,
            y: r.top + window.scrollY,
            width: r.width,
            height: r.height,
          };
        });
      const handBefore = await handBox();

      await page.getByRole("button", { name: /Play Hand/ }).click();
      await page.waitForFunction(() =>
        (window as Window & { __te?: TeProbe }).__te?.seen.includes("player")
      );
      await expect(player(page)).toBeHidden();

      await expect(page.getByTestId("round-score")).toHaveText("828");
      await expect(page.getByTestId("blind-result")).toContainText(
        "Blind cleared"
      );
      await expect(page.getByTestId("blind-result")).toContainText(
        "828 of 450"
      );
      const probe = await page.evaluate(
        () => (window as Window & { __te?: TeProbe }).__te!
      );
      expect(probe.hand).toEqual(handBefore);
      expect(probe.seen).toEqual(
        expect.arrayContaining([
          "player",
          "fire",
          "player-cleared",
          "blind-cleared-flash",
        ])
      );
      // Layout shift during playback only: the result panel replacing the
      // hand after resolution is a deliberate end-of-Blind transition.
      expect(probe.end).not.toBeNull();
      const during = probe.entries.filter((e) => e.start < probe.end!);
      expect(
        during.reduce((sum, e) => sum + e.value, 0),
        JSON.stringify(during, null, 1)
      ).toBe(0);

      const breakdown = page.getByTestId("score-breakdown");
      await breakdown.locator("summary").focus();
      await page.keyboard.press("Enter");
      await expect(breakdown.getByRole("listitem").last()).toContainText(
        "Target crossed: Blind cleared."
      );
    });

    test("is axe clean mid-playback, with the zero-rule slam", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await card(page, DRAFT_A).click();
      await card(page, DM_LISTING).click();
      await page.getByRole("button", { name: /Play Hand/ }).click();
      await expect(page.getByTestId("zero-slam")).toHaveText(
        "DENOMINATOR ERROR ×0"
      );
      const results = await new AxeBuilder({ page })
        .include('section[aria-labelledby="card-table-heading"]')
        .withTags(WCAG_TAGS)
        .analyze();
      expect(
        results.violations.filter((v) => BLOCKING.has(v.impact ?? ""))
      ).toEqual([]);
      // A slow scan can outlast playback, so skip only if it is still running.
      await page.evaluate(() =>
        document
          .querySelector<HTMLElement>('[data-testid="score-player"]')
          ?.click()
      );
      await expect(player(page)).toBeHidden();
      await expect(page.getByTestId("last-hand")).toContainText(
        "(zero-score rule)"
      );
    });

    test("under reduced motion skips straight to the result", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await launch(page);
      await card(page, DRAFT_A).click();
      await card(page, DM_LISTING).click();
      await page.getByRole("button", { name: /Play Hand/ }).click();
      await expect(page.getByTestId("last-hand")).toBeVisible();
      await expect(player(page)).toHaveCount(0);
    });
  });

  test.describe("card faces and physicality (T&E-UX-03)", () => {
    const order = (page: Page) =>
      page
        .locator("[data-card-id]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-card-id")));

    test("prints a live mini-output on every card in hand", async ({
      page,
    }) => {
      await launch(page);
      const cards = page.locator("[data-card-id]");
      await expect(cards).toHaveCount(8);
      for (let i = 0; i < 8; i++) {
        await expect(cards.nth(i).locator("[data-face-kind]")).toHaveCount(1);
      }
      await expect(
        card(page, "C-L16.2.4").locator('[data-face-kind="LISTING"]')
      ).toContainText("S-001");
      await expect(
        card(page, "C-T14.3.1").locator('[data-face-kind="TABLE"]')
      ).toContainText("Any TEAE");
    });

    test("reads a card with ? and reorders with Alt+arrows, axe clean", async ({
      page,
    }) => {
      test.slow();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await launch(page);
      await card(page, "C-T14.1.2").focus();
      await page.keyboard.press("Shift+Slash");
      const detail = page.getByTestId("card-detail");
      await expect(detail).toBeVisible();
      await expect(detail.getByRole("table")).toContainText("Completed");
      // The global Field Manual shortcut must not also fire.
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expectNoBlockingViolations(page, "card detail open");
      await page.keyboard.press("Escape");
      await expect(detail).toBeHidden();
      await expect(card(page, "C-T14.1.2")).toBeFocused();

      const before = await order(page);
      await page.keyboard.press("Alt+ArrowLeft");
      const after = await order(page);
      const from = before.indexOf("C-T14.1.2");
      expect(after[from - 1]).toBe("C-T14.1.2");
      await expect(card(page, "C-T14.1.2")).toBeFocused();
      await expectNoBlockingViolations(page, "after a keyboard reorder");
    });

    test("drags a card by its grip to reorder the hand", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await launch(page);
      // Layout boxes, which Reorder compares, ignore the breathing and tilt
      // transforms. The hand's overlap (#1181) is sized after it measures its
      // row, so wait for two identical reads before aiming.
      const slots = () =>
        page.locator("[data-card-id]").evaluateAll((els) =>
          els.map((el) => {
            const item = el.closest('[data-testid="hand"] > *') as HTMLElement;
            return { left: item.offsetLeft, width: item.offsetWidth };
          })
        );
      let layout = await slots();
      await expect
        .poll(async () => {
          const previous = JSON.stringify(layout);
          layout = await slots();
          return JSON.stringify(layout) === previous;
        })
        .toBe(true);
      const first = (await order(page))[0]!;
      const step = layout[1]!.left - layout[0]!.left;
      const width = layout[0]!.width;
      // Reorder moves the card past a neighbour once its trailing edge
      // crosses that neighbour's centre, so index 2 holds for drag offsets
      // between 2 steps and 3 steps less half a card. Aim at the middle.
      const offset = 2.5 * step - width / 2;
      const grip = page.getByTestId("drag-grip").first();
      const box = await grip.boundingBox();
      const x = box!.x + box!.width / 2;
      const y = box!.y + box!.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + offset, y + 4, { steps: 20 });
      await page.mouse.up();
      await expect.poll(async () => (await order(page)).indexOf(first)).toBe(2);
    });

    test("breathes at rest on desktop, and not below 768px", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize({ width: 1440, height: 900 });
      await launch(page);
      const wobble = () =>
        page
          .locator(".te-card-wobble")
          .first()
          .evaluate((el) => getComputedStyle(el).animationName);
      expect(await wobble()).toBe("te-card-breathe");
      await page.setViewportSize({ width: 375, height: 800 });
      await expect.poll(wobble).toBe("none");
    });

    test("scrolls the hand inside its own container at 320px", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 700 });
      await launch(page);
      const hand = page.getByTestId("hand");
      const { scroll, client } = await hand.evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
      }));
      expect(scroll).toBeGreaterThan(client);
      await expectNoHorizontalOverflow(page);
      await card(page, "C-L16.1.1").scrollIntoViewIfNeeded();
      await card(page, "C-L16.1.1").click();
      await expect(card(page, "C-L16.1.1")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });

    for (const [width, height, reducedMotion] of [
      [1280, 720, "no-preference"],
      [1440, 900, "no-preference"],
      [1440, 900, "reduce"],
    ] as const) {
      test(`shows the whole hand without scrolling at ${width}px, motion ${reducedMotion} (#1181)`, async ({
        page,
      }) => {
        await page.emulateMedia({ reducedMotion });
        await page.setViewportSize({ width, height });
        await launch(page);
        const hand = page.getByTestId("hand");
        // The row fits once it has been measured, as the deal settles.
        await expect(async () => {
          const fit = await hand.evaluate((el) => {
            const row = el.getBoundingClientRect();
            // Each card's slot: the fan's tilt may tip a corner past it.
            const cards = Array.from(el.children).map((c) =>
              c.getBoundingClientRect()
            );
            return {
              scroll: el.scrollWidth,
              client: el.clientWidth,
              count: cards.length,
              inside: cards.every(
                (c) => c.left >= row.left - 1 && c.right <= row.right + 1
              ),
            };
          });
          expect(fit.count).toBe(8);
          expect(fit.scroll).toBeLessThanOrEqual(fit.client);
          expect(fit.inside).toBe(true);
        }).toPass({ timeout: 10000 });
        const last = hand.locator("[data-card-id]").last();
        await last.click();
        await expect(last).toHaveAttribute("aria-pressed", "true");
        await expectNoHorizontalOverflow(page);
      });
    }

    test("keeps the card detail readable at 200% zoom", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await launch(page);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await card(page, "C-T14.3.1").focus();
      await page.keyboard.press("Shift+Slash");
      await expect(page.getByTestId("card-detail")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  });

  test.describe("juice kit loud layer (T&E-UX-04)", () => {
    const layerAnimations = (page: Page) =>
      page.evaluate(
        () =>
          document.getAnimations().filter((a) => {
            const target = (a.effect as KeyframeEffect | null)?.target;
            return target instanceof Element
              ? target.closest("[data-te-loud-layer]") !== null
              : false;
          }).length
      );

    async function playPair(page: Page) {
      await card(page, DRAFT_A).click();
      await card(page, DM_LISTING).click();
      await page.getByRole("button", { name: /Play Hand/ }).click();
    }

    test("is inert at rest and runs only during resolution at 1440px", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await expect(page.locator("[data-te-loud-layer]")).toHaveCount(0);
      expect(await layerAnimations(page)).toBe(0);

      await playPair(page);
      await expect(page.locator("[data-te-loud-layer]")).toHaveCount(2);
      expect(await layerAnimations(page)).toBeGreaterThan(0);

      await expect(player(page)).toBeHidden();
      await expect(page.locator("[data-te-loud-layer]")).toHaveCount(0);
      expect(await layerAnimations(page)).toBe(0);
    });

    test("never appears at 375px", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await playPair(page);
      await expect(player(page)).toBeVisible();
      await expect(page.locator("[data-te-loud-layer]")).toHaveCount(0);
    });

    test("offers cabinet SFX and Music switches that persist", async ({
      page,
    }) => {
      await launch(page);
      const music = page.getByRole("button", { name: "Music", exact: true });
      await expect(music).toHaveAttribute("aria-pressed", "false");
      await music.click();
      await expect(music).toHaveAttribute("aria-pressed", "true");
      expect(
        await page.evaluate(() => window.localStorage.getItem("te:audio"))
      ).toBe("sfx=1;music=1");
    });
  });

  test.describe("cabinet loud-moment switch (ADR 0046 amendment)", () => {
    const cabinet = (page: Page) => page.locator("[data-te-cabinet]");

    test("enables loud layers on desktop without reduced motion", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await expect(cabinet(page)).toHaveAttribute("data-te-loud", "on");
    });

    test("keeps loud layers off under reduced motion", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await launch(page);
      await expect(cabinet(page)).toHaveAttribute("data-te-loud", "off");
    });

    test("keeps loud layers off below 768px", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await expect(cabinet(page)).toHaveAttribute("data-te-loud", "off");
    });

    test("scopes --te-* tokens to the cabinet", async ({ page }) => {
      await launch(page);
      const inside = await cabinet(page).evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--te-chips").trim()
      );
      const outside = await page.evaluate(() =>
        getComputedStyle(document.body).getPropertyValue("--te-chips").trim()
      );
      expect(inside).toBe("#93c5fd");
      expect(outside).toBe("");
    });
  });
});

test.describe("Trial & Error Procurement Shop", () => {
  // This seed stocks the Senior Programmer and a Guidance Pack.
  const SHOP_ROUTE = "/arcade/trial-and-error?seed=shop-24";

  test("clears a Blind, cashes out, buys a relic, opens a pack and continues", async ({
    page,
  }) => {
    await page.goto(SHOP_ROUTE, { waitUntil: "domcontentloaded" });
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) await launchBtn.click();
      await expect(page.getByTestId("hand")).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
    await winSmallBlind(page);

    const cashOut = page.getByRole("button", { name: /^Cash out \$\d+k$/ });
    await expect(cashOut).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("shop")).toBeVisible();
    await expect(page.getByTestId("cash-out-line")).toHaveCount(3);
    await expectNoBlockingViolations(page, "shop open");

    // Sell both seals to afford the relic.
    const tray = page.getByTestId("consumable-tray");
    await tray.getByRole("button", { name: /^Sell/ }).first().click();
    await tray.getByRole("button", { name: /^Sell/ }).first().click();
    await page
      .getByTestId("shop-items")
      .getByRole("button", { name: "Buy Senior Programmer" })
      .click();
    await expect(
      page.getByTestId("relic-rack").getByTestId("relic")
    ).toContainText("REL-SENIOR-PROGRAMMER");

    await page
      .getByTestId("shop-packs")
      .getByRole("button", { name: "Open Guidance Pack" })
      .click();
    const opening = page.getByTestId("pack-opening");
    await expect(opening).toBeVisible();
    await expect(opening.getByTestId("pack-card").first()).toBeFocused();
    await expectNoBlockingViolations(page, "pack opening");
    await page.keyboard.press("Enter");
    await expect(opening).toBeHidden();
    await expect(page.getByTestId("consumable-tray")).toContainText("Use:");

    await page.getByRole("button", { name: "Next Blind" }).click();
    await expect(page.getByTestId("blind-name")).toHaveText(
      "Big Blind: Sponsor Safety Review"
    );
  });
});

test.describe("Trial & Error saved runs (#1079)", () => {
  test("resumes the same table after a reload, from the keyboard", async ({
    page,
  }) => {
    await launch(page);
    await card(page, DRAFT_A).click();
    await card(page, DM_LISTING).click();
    await page.getByRole("button", { name: /Play Hand/ }).click();
    await expect(page.getByTestId("round-score")).not.toHaveText(/^0\b/);
    // Played cards stay in the DOM while their exit animation runs.
    for (const id of [DRAFT_A, DM_LISTING]) {
      await expect(page.locator(`[data-card-id="${id}"]`)).toHaveCount(0);
    }
    const handIds = () =>
      page
        .locator("[data-card-id]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-card-id")));
    const hand = await handIds();
    const score = await page.getByTestId("round-score").textContent();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) await launchBtn.click();
      await expect(page.getByTestId("resume-run")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 30000 });
    await expect(page.getByTestId("resume-run")).toContainText(SEED);
    await expectNoBlockingViolations(page, "resume prompt");
    const resume = page.getByRole("button", { name: "Resume run" });
    await expect(resume).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("hand")).toBeVisible();
    await expect(page.getByTestId("round-score")).toHaveText(score ?? "");
    expect(await handIds()).toEqual(hand);
  });
});

test.describe("Trial & Error seeded runs (#1528)", () => {
  const CHALLENGE_SEED = "7K3M-Q9PX";

  /** The hand a seed deals first, from the domain itself. */
  const firstHand = (seed: string) =>
    deriveRunView(CAMPAIGN, createRunState(CAMPAIGN, seed)).table.handIds;
  const handIds = (page: Page) =>
    page
      .locator("[data-card-id]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-card-id")));

  async function openChallenge(page: Page, hash: string) {
    await page.goto(`/arcade/trial-and-error${hash}`, {
      waitUntil: "domcontentloaded",
    });
    const dialog = page.getByRole("dialog", { name: "New run" });
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) await launchBtn.click();
      await expect(dialog).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30000 });
    return dialog;
  }

  for (const width of [375, 1280]) {
    test(`replays a challenge link's seed at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      const dialog = await openChallenge(page, "#seed=7k3m-q9px");
      await expect(dialog.getByTestId("new-run-seed")).toHaveValue(
        CHALLENGE_SEED
      );
      await expect(dialog.getByTestId("new-run-seed")).toBeFocused();
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `New Run at ${width}px`);
      await page.keyboard.press("Enter");

      await expect(dialog).toBeHidden();
      expect(new URL(page.url()).hash).toBe("");
      await expect.poll(() => handIds(page)).toEqual(firstHand(CHALLENGE_SEED));
      await page.getByTestId("run-info-button").click();
      const info = page.getByRole("dialog", { name: "Run Info" });
      await expect(info.getByTestId("run-seed")).toHaveText(CHALLENGE_SEED);
      await expect(
        info.getByRole("button", { name: "Copy challenge link" })
      ).toBeVisible();
      await expectNoBlockingViolations(page, `Run Info seed at ${width}px`);
    });
  }

  test("starts today's Daily Protocol from Run Info", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await launch(page);
    const info = page.getByRole("dialog", { name: "Run Info" });
    await expect(async () => {
      await page.getByTestId("run-info-button").click();
      await expect(info).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await info.getByTestId("run-info-new-run").click();
    const dialog = page.getByRole("dialog", { name: "New run" });
    const daily = dialog.getByRole("radio", { name: /Daily Protocol/ });
    await expect(daily).toBeEnabled();
    await daily.check();
    await dialog.getByRole("button", { name: "Start run" }).click();
    await expect(dialog).toBeHidden();

    await page.getByTestId("run-info-button").click();
    const today = new Date().toISOString().slice(0, 10);
    await expect(info.getByTestId("run-daily")).toContainText(today);
    const seed = (await info.getByTestId("run-seed").textContent()) ?? "";
    expect(seed).toBe(dailySeed(today));
    expect(await handIds(page)).toEqual(firstHand(seed));
  });
});

test.describe("Trial & Error hand cheat sheet (#1081)", () => {
  for (const width of [320, 375, 768, 1440]) {
    test(`opens mid-hand on H at ${width}px without overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await launch(page);
      await card(page, DRAFT_A).click();
      await card(page, DM_LISTING).click();
      await card(page, DM_LISTING).focus();
      await page.keyboard.press("h");
      const sheet = page.getByTestId("hand-sheet");
      await expect(sheet).toBeVisible();
      await expect(
        sheet.locator('[data-hand="TLF_PAIR"][data-selected]')
      ).toContainText("Your selection");
      await expect(page.getByTestId("hand-sheet-row")).toHaveCount(7);
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `hand sheet at ${width}px`);
      if (width === 1440) {
        // A side panel beside the table: it never covers the hand.
        const panel = await sheet.boundingBox();
        const hand = await page.getByTestId("hand").boundingBox();
        expect(panel!.x + panel!.width).toBeLessThanOrEqual(hand!.x);
      }
      await page.keyboard.press("Escape");
      await expect(sheet).toBeHidden();
      await expect(card(page, DM_LISTING)).toBeFocused();
    });
  }

  test("reflows at 200% zoom", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await launch(page);
    await card(page, DRAFT_A).focus();
    await page.keyboard.press("h");
    await expect(page.getByTestId("hand-sheet")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Close \[H\]/ })
    ).toBeFocused();
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press("h");
    await expect(page.getByTestId("hand-sheet")).toBeHidden();
  });
});

test.describe("Trial & Error score log (#1082)", () => {
  /** Plays the unfixed pair, which Draft A's fatal finding zeroes. */
  async function playZeroedPair(page: Page) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await launch(page);
    await card(page, DRAFT_A).click();
    await card(page, DM_LISTING).click();
    await page.getByRole("button", { name: /Play Hand/ }).click();
    await expect(page.getByTestId("last-hand")).toBeVisible();
  }

  for (const width of [320, 375, 768, 1440]) {
    test(`lists the Blind's hands at ${width}px without overflow`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await playZeroedPair(page);
      const toggle = page.getByTestId("score-log-toggle");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(toggle).toContainText("1 hand");
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      const entry = page.getByTestId("score-log-entry");
      await expect(entry).toHaveCount(1);
      await expect(entry).toContainText("TLF Pair");
      await expect(entry).toContainText("Scored zero");
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `score log at ${width}px`);
    });
  }

  test("reflows at 200% zoom", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await playZeroedPair(page);
    await page.getByTestId("score-log-toggle").click();
    await expect(page.getByTestId("score-log-entry")).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("Trial & Error boss intro on the Act I Boss (#1083)", () => {
  /**
   * A saved run at the start of the Act I Boss: the median bot clears the
   * Small and Big Blinds for this seed, so resuming lands on the Boss.
   */
  function saveAtBoss(): string {
    let run: RunState = createRunState(CAMPAIGN, SEED);
    const actions: LoggedAction[] = [];
    const step = (action: LoggedAction) => {
      run = advanceRun(CAMPAIGN, run, action);
      actions.push(action);
    };
    for (let i = 0; i < 2; i++) {
      const blind = runBlinds(CAMPAIGN, run)[run.blindIndex];
      for (const action of playBlind(blind, run.table, "MEDIAN").actions) {
        if (run.table.status !== "REVIEWING") break;
        if (action.type === "RESET") continue;
        step(action);
      }
      expect(run.table.status).toBe("CLEARED");
      step({ type: "NEXT_BLIND" });
    }
    expect(runBlinds(CAMPAIGN, run)[run.blindIndex].blind.tier).toBe(
      "BOSS_BLIND"
    );
    return serializeRun(
      { actId: CAMPAIGN.id, seed: SEED, actions },
      new Date()
    );
  }

  async function resumeAtBoss(page: Page) {
    const save = saveAtBoss();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ([key, value]) => {
        if (!window.localStorage.getItem(key)) {
          window.localStorage.setItem(key, value);
        }
      },
      [`te:run-save:${CAMPAIGN.id}`, save] as const
    );
    await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
    await expect(async () => {
      const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
      if (await launchBtn.isVisible()) await launchBtn.click();
      await expect(page.getByTestId("resume-run")).toBeVisible({
        timeout: 3000,
      });
    }).toPass({ timeout: 30000 });
    await page.getByRole("button", { name: "Resume run" }).click();
  }

  for (const width of [320, 1440]) {
    test(`names the Safety Set Only debuff before the Boss is played at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await resumeAtBoss(page);
      const intro = page.getByTestId("boss-intro");
      await expect(intro).toBeVisible();
      await expect(page.getByTestId("boss-intro-debuff")).toContainText(
        "Boss: Safety Set Only"
      );
      await expect(page.getByTestId("boss-intro-terms")).toHaveText(
        "Quota 8500 · 10 CPU"
      );
      await expect(page.getByTestId("boss-intro-stages")).toHaveCount(0);
      await expect(page.getByTestId("boss-intro-start")).toBeFocused();
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `Act I boss intro at ${width}px`);

      await page.keyboard.press("Enter");
      await expect(intro).toBeHidden();
      // This seed's Boss also deals a crisis, which is answered first.
      const migrate = page.getByRole("button", { name: /Migrate now/ });
      await expect(migrate).toBeFocused();
      await migrate.click();
      await expect(page.getByTestId("blind-name")).toContainText(
        "Dose Escalation Committee"
      );
      // The Boss is playable once the intro is gone: play the first card
      // that makes a hand on its own.
      const play = page.getByRole("button", { name: /Play Hand/ });
      const ids = await page
        .locator("[data-card-id]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-card-id")));
      for (const id of ids) {
        await card(page, id!).click();
        if (await play.isEnabled()) break;
        await card(page, id!).click();
      }
      await play.click();
      await expect(page.getByTestId("last-hand")).toBeVisible();
      await expect(intro).toBeHidden();
    });
  }

  test("fits at 200% zoom and closes on Escape", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await resumeAtBoss(page);
    await expect(page.getByTestId("boss-intro")).toBeVisible();
    await expect(page.getByTestId("boss-intro-start")).toBeFocused();
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("boss-intro")).toBeHidden();
  });
});

/**
 * A saved campaign run, played by the balance bot Blind after Blind until
 * `stop` says it has arrived or the campaign is won: it claims the first
 * relic a defended DMC offers and skips the shop. `after` is logged last.
 */
function saveWhen(
  stop: (run: RunState) => boolean,
  after: LoggedAction[] = []
): string {
  let run: RunState = createRunState(CAMPAIGN, SEED);
  const actions: LoggedAction[] = [];
  const step = (action: LoggedAction) => {
    run = advanceRun(CAMPAIGN, run, action);
    actions.push(action);
  };
  while (!stop(run)) {
    const blind = runBlinds(CAMPAIGN, run)[run.blindIndex];
    for (const action of playBlind(blind, run.table, "PERFECT").actions) {
      if (run.table.status !== "REVIEWING") break;
      if (action.type === "RESET") continue;
      step(action);
    }
    expect(run.table.status).toBe("CLEARED");
    const reward = deriveRunView(CAMPAIGN, run).table.reward;
    if (reward && reward.claimed === null) {
      step({ type: "CLAIM_RELIC", relicId: reward.choices[0].id });
    }
    if (deriveRunView(CAMPAIGN, run).phase === "RUN_WON") break;
    step({ type: "NEXT_BLIND" });
  }
  after.forEach(step);
  return serializeRun({ actId: CAMPAIGN.id, seed: SEED, actions }, new Date());
}

async function resume(page: Page, save: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key)) {
        window.localStorage.setItem(key, value);
      }
    },
    [`te:run-save:${CAMPAIGN.id}`, save] as const
  );
  await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
  await expect(async () => {
    const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
    if (await launchBtn.isVisible()) await launchBtn.click();
    await expect(page.getByTestId("resume-run")).toBeVisible({
      timeout: 3000,
    });
  }).toPass({ timeout: 30000 });
  await page.getByRole("button", { name: "Resume run" }).click();
}

test.describe("Trial & Error campaign across studies (#924)", () => {
  for (const width of [320, 1440]) {
    test(`opens Act II on its act card at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await resume(
        page,
        saveWhen((run) => run.actIndex === 1)
      );
      const intro = page.getByTestId("act-intro");
      await expect(intro).toBeVisible();
      await expect(
        intro.getByRole("heading", {
          name: "Act II: Phase II Proof of Concept",
        })
      ).toBeVisible();
      await expect(page.getByTestId("act-intro-boss")).toContainText(
        "Boss waiting:"
      );
      await expect(page.getByTestId("act-intro-start")).toBeFocused();
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `Act II act card at ${width}px`);

      await page.keyboard.press("Enter");
      await expect(intro).toBeHidden();
      await expect(page.getByTestId("blind-name")).toContainText(
        "Phase II Internal QC"
      );
    });

    test(`reaches CSR Lock, the final boss, at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await resume(
        page,
        saveWhen(
          (run) =>
            run.actIndex === 2 &&
            runBlinds(CAMPAIGN, run)[run.blindIndex].blind.tier === "BOSS_BLIND"
        )
      );
      await expect(page.getByTestId("boss-intro")).toBeVisible();
      await expect(page.getByTestId("boss-intro-slots")).toContainText(
        "5. Listing"
      );
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `CSR Lock intro at ${width}px`);
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("boss-intro")).toBeHidden();
      await expect(page.getByTestId("csr-slots")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `CSR Lock table at ${width}px`);
    });
  }
});

test.describe("Trial & Error post-marketing rounds (#1088)", () => {
  for (const width of [320, 1440]) {
    test(`offers post-marketing after CSR Lock at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await resume(
        page,
        saveWhen(() => false)
      );
      const choice = page.getByTestId("endless-choice");
      await expect(choice).toBeVisible();
      await expect(page.getByTestId("blind-result")).toContainText(
        "Campaign won"
      );
      await expect(
        choice.getByRole("button", { name: "Submit and end run" })
      ).toBeFocused();
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `endless choice at ${width}px`);

      await choice
        .getByRole("button", { name: "Continue into post-marketing" })
        .click();
      await expect(page.getByTestId("next-blind")).toContainText(
        "Post-marketing round 1"
      );
    });

    test(`opens post-marketing round 1 on its act card at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await resume(
        page,
        saveWhen(
          () => false,
          [{ type: "CONTINUE_ENDLESS" }, { type: "NEXT_BLIND" }]
        )
      );
      const intro = page.getByTestId("act-intro");
      await expect(intro).toBeVisible();
      await expect(intro).toContainText("Post-marketing round 1 · a new study");
      await expect(page.getByTestId("act-intro-start")).toBeFocused();
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(
        page,
        `post-marketing act card at ${width}px`
      );

      await page.keyboard.press("Enter");
      await expect(intro).toBeHidden();
      await expect(page.getByTestId("blind-name")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(
        page,
        `post-marketing table at ${width}px`
      );
    });
  }
});

test.describe("Trial & Error SAP Amendments (#1086)", () => {
  const save = () => {
    const { run, actions } = amendmentInTray(CAMPAIGN);
    return serializeRun(
      { actId: CAMPAIGN.id, seed: run.seed, actions },
      new Date()
    );
  };

  for (const [label, width, fontSize] of [
    ["320px", 320, "100%"],
    ["200% zoom", 1280, "200%"],
  ] as const) {
    test(`confirms and files an amendment from the tray at ${label}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await resume(page, save());
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, fontSize);
      const tile = page.locator(
        '[data-testid="consumable"][data-kind="amendment"]'
      );
      const use = tile.getByRole("button", { name: /^Use / });
      await use.click();
      const dialog = page.getByTestId("amendment-dialog");
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: /Keep in tray/ })
      ).toBeFocused();
      await expect(page.getByTestId("amendment-staled")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `amendment dialog at ${label}`);

      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(use).toBeFocused();

      await use.click();
      await dialog.getByTestId("amendment-confirm").click();
      await expect(dialog).toBeHidden();
      await expect(tile).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `amended table at ${label}`);
    });
  }
});

test.describe("Trial & Error protocol deviations (#1087)", () => {
  const save = () => {
    const { run, actions } = deviationLanded(CAMPAIGN);
    return serializeRun(
      { actId: CAMPAIGN.id, seed: run.seed, actions },
      new Date()
    );
  };

  for (const [label, width, fontSize] of [
    ["320px", 320, "100%"],
    ["1440px", 1440, "100%"],
    ["200% zoom", 1280, "200%"],
  ] as const) {
    test(`explains a landed deviation and what to do next at ${label}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await resume(page, save());
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, fontSize);
      const deviation = page.getByTestId("deviation-card");
      await expect(deviation).toBeVisible();
      await expect(
        deviation.getByRole("heading", { name: /Protocol deviation:/ })
      ).toBeVisible();
      await expect(page.getByTestId("deviation-staled")).toContainText(
        "went stale"
      );
      await expect(page.getByTestId("deviation-next")).toContainText(
        "recompile"
      );
      await expect(page.getByTestId("deviation-note")).toContainText(
        "After hand 1"
      );
      await expect(page.getByTestId("score-log-deviation")).toHaveCount(1);
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `deviation at ${label}`);
    });
  }

  test("fits a resumed run's hand to its row at 1440px", async ({ page }) => {
    // The row is not in the DOM while the Resume prompt shows, so it must be
    // measured when it attaches, not when the table mounts.
    await page.setViewportSize({ width: 1440, height: 900 });
    await resume(page, save());
    const hand = page.getByTestId("hand");
    await expect(async () => {
      const fit = await hand.evaluate((el) => ({
        scroll: el.scrollWidth,
        client: el.clientWidth,
        count: el.children.length,
      }));
      expect(fit.count).toBe(8);
      expect(fit.scroll).toBeLessThanOrEqual(fit.client);
    }).toPass({ timeout: 10000 });
  });
});

test.describe("Trial & Error guided Blind (#1089)", () => {
  const coach = (page: Page) => page.getByTestId("coach");
  const coachTitle = (page: Page) => coach(page).getByRole("heading");

  for (const [label, width, fontSize] of [
    ["1440px", 1440, "100%"],
    ["320px", 320, "100%"],
    ["200% zoom", 1280, "200%"],
  ] as const) {
    test(`completes the guided Blind by keyboard at ${label}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({ width, height: 900 });
      await launch(page);
      await page.evaluate((size) => {
        document.documentElement.style.fontSize = size;
      }, fontSize);
      await expect(page.getByTestId("tutorial-offer")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `tutorial offer at ${label}`);

      await page.getByRole("button", { name: "Start guided Blind" }).click();
      await expect(coachTitle(page)).toBeFocused();
      await expect(coachTitle(page)).toHaveText("Your first review");
      await page.getByRole("button", { name: "Next" }).click();
      await expect(coachTitle(page)).toHaveText("Inspect the Table");
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `coach step at ${label}`);

      await card(page, "C-T14.1.1-G").focus();
      await page.keyboard.press("i");
      await expect(drawer(page).getByTestId("coach")).toBeVisible();
      await expect(coachTitle(page)).toHaveText("Review a cell");
      await expectNoBlockingViolations(page, `coach in Inspect at ${label}`);
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await expect(coachTitle(page)).toHaveText("Correct the finding");
      await page.keyboard.press("c");
      await expect(coachTitle(page)).toHaveText("Back to the table");
      await page.keyboard.press("Escape");
      await expect(drawer(page)).toBeHidden();
      await expect(coachTitle(page)).toHaveText("Make a TLF Pair");

      await card(page, "C-T14.1.1-G").focus();
      await page.keyboard.press("Space");
      await card(page, DM_LISTING).focus();
      await page.keyboard.press("Space");
      await expect(coachTitle(page)).toHaveText("Play the hand");
      await page.keyboard.press("Enter");
      await expect(coachTitle(page)).toHaveText("Blind cleared", {
        timeout: 15000,
      });
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(
        page,
        `guided Blind cleared at ${label}`
      );

      await page.getByRole("button", { name: "Start the campaign" }).click();
      await expect(coach(page)).toHaveCount(0);
      await expect(page.getByTestId("tutorial-offer")).toHaveCount(0);
      await expect(card(page, DRAFT_A)).toBeVisible();
    });
  }

  test("skips at any step and is not offered again", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await launch(page);
    await page.getByRole("button", { name: "Start guided Blind" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("button", { name: "Skip tutorial" }).click();
    await expect(coach(page)).toHaveCount(0);
    await expect(card(page, DRAFT_A)).toBeVisible();
    await page.reload();
    await launch(page);
    await expect(page.getByTestId("tutorial-offer")).toHaveCount(0);
  });
});

test.describe("Trial & Error Codex and run history (#1529)", () => {
  const codex = (page: Page) => page.getByRole("dialog", { name: "Codex" });

  async function openCodex(page: Page) {
    const info = page.getByRole("dialog", { name: "Run Info" });
    await expect(async () => {
      await page.getByTestId("run-info-button").click();
      await expect(info).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15000 });
    await info.getByTestId("run-info-codex").click();
    await expect(codex(page)).toBeVisible();
    await codex(page).getByTestId("codex-tab-HAND").click();
  }

  for (const width of [375, 1280]) {
    test(`records a played hand and keeps it across a reload at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await launch(page);
      await card(page, DRAFT_A).click();
      await card(page, DM_LISTING).click();
      await page.getByRole("button", { name: /Play Hand/ }).click();
      await expect(page.getByTestId("round-score")).not.toHaveText(/^0\b/);

      await openCodex(page);
      const discovered = codex(page).locator(
        '[data-testid="codex-entry"][data-discovered="true"]'
      );
      const hidden = codex(page).locator(
        '[data-testid="codex-entry"][data-discovered="false"]'
      );
      await expect(discovered).toHaveCount(1);
      await expect(discovered).toContainText(`First seen on seed ${SEED}`);
      await expect(hidden.first()).toContainText("Undiscovered");
      await expectNoHorizontalOverflow(page);
      await expectNoBlockingViolations(page, `Codex at ${width}px`);
      await page.keyboard.press("Escape");
      await expect(codex(page)).toBeHidden();
      await expect(page.getByTestId("run-info-button")).toBeFocused();

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(async () => {
        const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
        if (await launchBtn.isVisible()) await launchBtn.click();
        await expect(page.getByTestId("resume-run")).toBeVisible({
          timeout: 3000,
        });
      }).toPass({ timeout: 30000 });
      await page.getByRole("button", { name: "Resume run" }).click();
      await openCodex(page);
      await expect(discovered).toHaveCount(1);
      await codex(page).getByRole("tab", { name: "Run history" }).click();
      await expect(codex(page).getByRole("tabpanel")).toContainText(
        "No finished runs yet"
      );
    });
  }

  test("reflows at 200% zoom", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await launch(page);
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await openCodex(page);
    await expectNoHorizontalOverflow(page);
    await expectNoBlockingViolations(page, "Codex at 200% zoom");
  });
});
