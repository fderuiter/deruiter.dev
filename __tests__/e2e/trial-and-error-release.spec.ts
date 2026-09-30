import { test, expect, type Page } from "@playwright/test";
import {
  BIOSTAT_OPS_CAMPAIGN,
  advanceRun,
  createRunState,
  deriveRunView,
  runBlinds,
  serializeRun,
  type LoggedAction,
  type RunState,
} from "../../lib/trial-and-error";
import { playBlind } from "../utils/trial-and-error-bot";

/**
 * Release-hardening gaps from #925 that the other Trial & Error specs leave
 * open: polite announcements in the real live region, the whole cabinet on
 * blocked or corrupt storage, a shopped campaign resumed in the browser
 * matching the pure replay, and 200% zoom at narrow widths. Helpers are
 * copied rather than imported, so the spec files stay independent.
 */

/** Deals Draft A and its Listing into the opening hand. */
const SEED = "e2e-4";
const ROUTE = `/arcade/trial-and-error?seed=${SEED}`;
const DRAFT_A = "C-T14.1.1-A";
const DM_LISTING = "C-L16.2.4";
const CAMPAIGN = BIOSTAT_OPS_CAMPAIGN;

const card = (page: Page, id: string) => page.locator(`[data-card-id="${id}"]`);
const handCards = (page: Page) =>
  page.getByTestId("hand").locator("[data-card-id]");
const drawer = (page: Page) => page.getByTestId("inspect-drawer");

async function launch(page: Page, route = ROUTE) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(async () => {
    const launchBtn = page.getByRole("button", { name: /Launch Cabinet/i });
    if (await launchBtn.isVisible()) {
      await launchBtn.click();
    }
    await expect(page.getByTestId("hand")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30000 });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Offers `save` as the campaign's saved run on load, and resumes it. */
async function resumeSave(page: Page, save: string) {
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
  await expect(page.getByTestId("hand")).toBeVisible();
}

/**
 * A campaign save on the Small Blind, one hand from clearing it: the bot's
 * inspections and corrections are logged, and `selects` are the cards of
 * the clearing hand, left for the test to pick and play.
 */
function smallBlindBeforeClearingHand(): { save: string; selects: string[] } {
  let run: RunState = createRunState(CAMPAIGN, SEED);
  const blind = runBlinds(CAMPAIGN, run)[run.blindIndex];
  const logged: LoggedAction[] = [];
  let selects: string[] = [];
  for (const move of playBlind(blind, run.table, "PERFECT").actions) {
    if (move.type === "RESET") continue;
    if (move.type === "TOGGLE_SELECT") {
      selects.push(move.cardId);
      continue;
    }
    const batch: LoggedAction[] = [
      ...selects.map((cardId): LoggedAction => ({
        type: "TOGGLE_SELECT",
        cardId,
      })),
      move,
    ];
    const after = batch.reduce((r, a) => advanceRun(CAMPAIGN, r, a), run);
    if (move.type === "PLAY_HAND" && after.table.status === "CLEARED") {
      const save = serializeRun(
        { actId: CAMPAIGN.id, seed: SEED, actions: logged },
        new Date()
      );
      return { save, selects };
    }
    run = after;
    logged.push(...batch);
    selects = [];
  }
  throw new Error("The bot never cleared the Small Blind");
}

/**
 * Records every text either live region of the site's A11yProvider shows,
 * tagged with its politeness, from before the page's own scripts run.
 */
const recordLiveRegions = (page: Page) =>
  page.addInitScript(() => {
    const seen: { mode: string; text: string }[] = [];
    (window as unknown as { __teLive: typeof seen }).__teLive = seen;
    const last = new Map<Element, string>();
    const scan = () => {
      for (const region of document.querySelectorAll("[aria-live]")) {
        const text = (region.textContent ?? "").trim();
        if (text && last.get(region) !== text) {
          seen.push({ mode: region.getAttribute("aria-live") ?? "", text });
        }
        last.set(region, text);
      }
    };
    new MutationObserver(scan).observe(document, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });

const liveTexts = (page: Page, mode: string) =>
  page.evaluate(
    (m) =>
      (
        window as unknown as { __teLive: { mode: string; text: string }[] }
      ).__teLive
        .filter((entry) => entry.mode === m)
        .map((entry) => entry.text),
    mode
  );

test.describe("Trial & Error release hardening (#925)", () => {
  test.describe("polite live announcements", () => {
    // The site announcer plays polite messages one at a time, 3 s each, with
    // no bound on its queue (#1635). These tests keep the queue short so they
    // check what is announced and how, not how long a backlog takes to drain.
    test("announces the scored hand after playback and the cleared Blind, politely", async ({
      page,
    }) => {
      test.slow();
      const { save, selects } = smallBlindBeforeClearingHand();
      await recordLiveRegions(page);
      await resumeSave(page, save);
      for (const id of selects) {
        await expect(async () => {
          await card(page, id).click();
          await expect(card(page, id)).toHaveAttribute("aria-pressed", "true", {
            timeout: 2000,
          });
        }).toPass({ timeout: 15000 });
      }
      await page.getByRole("button", { name: /Play Hand/ }).click();
      await expect(page.getByTestId("blind-result")).toContainText(
        "Blind cleared",
        { timeout: 15000 }
      );
      await expect
        .poll(() => liveTexts(page, "polite"), { timeout: 45000 })
        .toContainEqual(
          expect.stringMatching(
            /scored \d+ \(\d+ Chips × \d+ Mult\)\. Round \d+ of \d+\..* cleared\./
          )
        );
      // Scoring is never shouted: nothing reaches the assertive region.
      const assertive = await liveTexts(page, "assertive");
      expect(assertive.filter((t) => /scored|cleared|failed/.test(t))).toEqual(
        []
      );
    });

    test("announces a failed Blind politely", async ({ page }) => {
      test.slow();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await recordLiveRegions(page);
      await launch(page);
      // Single-card hands with nothing corrected cannot reach the quota.
      for (let i = 0; i < 8; i++) {
        if (await page.getByTestId("blind-result").isVisible()) break;
        await expect(async () => {
          await handCards(page).first().click();
          await expect(
            page.getByRole("button", { name: /Play Hand/ })
          ).toBeEnabled({ timeout: 2000 });
        }).toPass({ timeout: 15000 });
        await page.getByRole("button", { name: /Play Hand/ }).click();
      }
      await expect(page.getByTestId("blind-result")).toContainText(
        "Blind failed"
      );
      await expect
        .poll(() => liveTexts(page, "polite"), { timeout: 60000 })
        .toContainEqual(expect.stringMatching(/Round \d+ of \d+\..* failed: /));
    });
  });

  test.describe("storage it cannot rely on", () => {
    /** Every Trial & Error key, holding something no build ever wrote. */
    const CORRUPT: Record<string, string> = {
      "te:game-speed": "NaN",
      "te:audio": "sfx=9;music=?",
      "te:codex": "{not json",
      [`te:run-save:${CAMPAIGN.id}`]: '{"v":1,"actions":',
      "te:score-log-open": "maybe",
      "te:tutorial-seen": "{}",
    };

    test("plays, switches speed and audio, and opens the Codex with storage blocked", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await page.addInitScript(() => {
        const blocked = () => {
          throw new DOMException("blocked", "SecurityError");
        };
        Storage.prototype.getItem = blocked;
        Storage.prototype.setItem = blocked;
        Storage.prototype.removeItem = blocked;
      });
      await launch(page);

      const speed = page.getByRole("group", { name: "Scoring speed" });
      await expect(speed.getByRole("button", { name: "1×" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      await speed.getByRole("button", { name: "4×" }).click();
      const music = page.getByRole("button", { name: "Music", exact: true });
      await expect(music).toHaveAttribute("aria-pressed", "false");
      await music.click();
      // The switch holds for the page even though it cannot be saved.
      await expect(music).toHaveAttribute("aria-pressed", "true");

      await card(page, DRAFT_A).click();
      await card(page, DM_LISTING).click();
      await page.getByRole("button", { name: /Play Hand/ }).click();
      await expect(page.getByTestId("last-hand")).toBeVisible({
        timeout: 15000,
      });

      const info = page.getByRole("dialog", { name: "Run Info" });
      await expect(async () => {
        await page.getByTestId("run-info-button").click();
        await expect(info).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 15000 });
      await info.getByTestId("run-info-codex").click();
      await expect(page.getByRole("dialog", { name: "Codex" })).toBeVisible();
      expect(errors).toEqual([]);
    });

    test("starts clean on corrupt stored values, then plays a hand", async ({
      page,
    }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));
      await page.addInitScript((entries) => {
        for (const [key, value] of Object.entries(entries)) {
          window.localStorage.setItem(key, value);
        }
      }, CORRUPT);
      await launch(page);
      // A corrupt save is not offered for resume: a fresh table is dealt.
      await expect(page.getByTestId("resume-run")).toBeHidden();
      const speed = page.getByRole("group", { name: "Scoring speed" });
      await expect(speed.getByRole("button", { name: "1×" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      await expect(
        page.getByRole("button", { name: "Music", exact: true })
      ).toHaveAttribute("aria-pressed", "false");
      await card(page, DRAFT_A).click();
      await card(page, DM_LISTING).click();
      await page.getByRole("button", { name: /Play Hand/ }).click();
      await expect(page.getByTestId("last-hand")).toBeVisible({
        timeout: 15000,
      });
      expect(errors).toEqual([]);
    });
  });

  test("resumes a shopped campaign in Act II exactly as the pure replay has it", async ({
    page,
  }) => {
    // Plays Act I with the balance bot, cashing out and buying between
    // Blinds, then Act II's opening review up to its first hand.
    let run: RunState = createRunState(CAMPAIGN, SEED);
    const actions: LoggedAction[] = [];
    const step = (action: LoggedAction) => {
      run = advanceRun(CAMPAIGN, run, action);
      actions.push(action);
    };
    let bought = 0;
    while (run.actIndex < 1) {
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
      step({ type: "CASH_OUT" });
      for (const slot of [0, 1]) {
        const before = run.shop;
        step({ type: "BUY", slot });
        if (run.shop !== before) bought += 1;
      }
      step({ type: "NEXT_BLIND" });
    }
    expect(bought).toBeGreaterThan(0);
    // Inspections and corrections only: a resumed save drops a selection,
    // and Act II's first hand would already clear the Blind.
    const blind = runBlinds(CAMPAIGN, run)[run.blindIndex];
    for (const action of playBlind(blind, run.table, "PERFECT").actions) {
      if (action.type === "PLAY_HAND") break;
      if (action.type === "RESET" || action.type === "TOGGLE_SELECT") continue;
      step(action);
    }
    const expected = deriveRunView(CAMPAIGN, run);
    expect(expected.act.index).toBe(1);
    expect(expected.table.cpu.spent).toBeGreaterThan(0);
    const save = serializeRun(
      { actId: CAMPAIGN.id, seed: SEED, actions },
      new Date()
    );

    await page.emulateMedia({ reducedMotion: "reduce" });
    await resumeSave(page, save);

    await expect(page.getByTestId("blind-name")).toHaveText(
      expected.blind.blind.name
    );
    await expect(page.getByTestId("cpu-counter")).toHaveText(
      `${expected.table.cpu.available}/${expected.table.cpuAllocation}`
    );
    await expect(page.getByTestId("study-budget")).toHaveText(
      `Budget $${expected.table.budget}k`
    );
    await expect(
      page.getByTestId("relic-rack").getByTestId("relic")
    ).toHaveCount(expected.table.relics.length);
    await expect
      .poll(() =>
        handCards(page).evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-card-id"))
        )
      )
      .toEqual(expected.table.handIds);
  });

  for (const width of [320, 375, 768]) {
    test(`reflows without page overflow at 200% zoom at ${width}px`, async ({
      page,
    }) => {
      // Site and cabinet chrome (navbar bar, cabinet header and footer rows,
      // site footer) do not wrap at 200% text below 400px (#1636).
      test.fail(width < 400, "Overflows at 200% text below 400px (#1636)");
      await page.setViewportSize({ width, height: 800 });
      await launch(page);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await card(page, DRAFT_A).click();
      await expectNoHorizontalOverflow(page);
      await card(page, DRAFT_A).focus();
      await page.keyboard.press("i");
      await expect(drawer(page)).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });

    test(`keeps the Card Table inside the viewport at 200% zoom at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 });
      await launch(page);
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
      await card(page, DRAFT_A).click();
      // Everything the Card Table draws stays on screen, except what sits in
      // its own horizontal scroller (the hand at narrow widths).
      const offenders = await page
        .locator('section[aria-labelledby="card-table-heading"] *')
        .evaluateAll((els) => {
          const limit = document.documentElement.clientWidth + 0.5;
          const table = document.querySelector(
            'section[aria-labelledby="card-table-heading"]'
          );
          // Only scrollers inside the table count: the page wrapper's own
          // overflow-x-hidden would otherwise excuse everything.
          const scrolls = (el: Element): boolean => {
            for (
              let p = el.parentElement;
              p && p !== table;
              p = p.parentElement
            ) {
              if (/(auto|scroll)/.test(getComputedStyle(p).overflowX)) {
                return true;
              }
            }
            return false;
          };
          return els
            .filter((el) => {
              const box = el.getBoundingClientRect();
              return box.width > 0 && box.right > limit && !scrolls(el);
            })
            .map(
              (el) =>
                el.getAttribute("data-testid") ??
                `${el.tagName.toLowerCase()}.${String(el.getAttribute("class") ?? "").slice(0, 40)}`
            );
        });
      expect(offenders).toEqual([]);
    });
  }
});
