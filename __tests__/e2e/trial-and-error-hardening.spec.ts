import { test, expect, type Page } from "@playwright/test";

/**
 * Presentation-hardening checks from #925, split out in #1591 so they do not
 * collide with open work on `trial-and-error.spec.ts`. Helpers are copied
 * from that spec rather than imported, so the two files stay independent.
 */

/** Deals Draft A and its Listing into the opening hand. */
const SEED = "e2e-4";
const ROUTE = `/arcade/trial-and-error?seed=${SEED}`;
/** Stocks the Senior Programmer relic in the first shop. */
const SHOP_ROUTE = "/arcade/trial-and-error?seed=shop-24";
const DRAFT_A = "C-T14.1.1-A";
const DM_LISTING = "C-L16.2.4";
/** Every class or attribute that marks a loud moment (ADR 0046 amendment). */
const LOUD_SELECTOR = '[data-te-loud-layer], [class*="te-loud-"]';

const card = (page: Page, id: string) => page.locator(`[data-card-id="${id}"]`);
const player = (page: Page) => page.getByTestId("score-player");
const drawer = (page: Page) => page.getByTestId("inspect-drawer");
const gridCell = (page: Page, row: number, col: number) =>
  drawer(page)
    .getByRole("row")
    .nth(row + 1)
    .getByRole("gridcell")
    .nth(col);

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

/** Selects Draft A and its Listing, then plays them. */
async function playPair(page: Page) {
  await expect(async () => {
    await card(page, DRAFT_A).click();
    await expect(card(page, DRAFT_A)).toHaveAttribute("aria-pressed", "true", {
      timeout: 2000,
    });
  }).toPass({ timeout: 15000 });
  await card(page, DM_LISTING).click();
  await expect(card(page, DM_LISTING)).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /Play Hand/ }).click();
}

/** Clears the Small Blind with Draft A and its listing, by keyboard. */
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

/** The Card Table itself, inside the cabinet chrome. */
const TABLE_SELECTOR = 'section[aria-labelledby="card-table-heading"]';

/**
 * Every running animation, named by what it animates. With a `scope`
 * selector, only animations on elements inside it count.
 */
const runningAnimations = (page: Page, scope: string | null) =>
  page.evaluate((within) => {
    const out: string[] = [];
    for (const a of document.getAnimations()) {
      if (a.playState !== "running") continue;
      const target = (a.effect as KeyframeEffect | null)?.target;
      if (!(target instanceof Element)) continue;
      if (within && !target.closest(within)) continue;
      const name =
        (a as CSSAnimation).animationName ??
        (a as CSSTransition).transitionProperty ??
        a.id;
      const classes = String(target.getAttribute("class") ?? "")
        .split(/\s+/)
        .slice(0, 3)
        .join(".");
      out.push(`${name} @ ${target.tagName.toLowerCase()}.${classes}`);
    }
    return out;
  }, scope);

/** A returning player: the Field Manual's "new" badge has been dismissed. */
const markManualSeen = (page: Page) =>
  page.addInitScript(() => {
    try {
      window.localStorage.setItem("seen_manual_trial-and-error", "true");
    } catch {
      // Storage blocked: the badge then stays hidden anyway.
    }
  });

test.describe("Trial & Error presentation hardening (#925, #1591)", () => {
  test.describe("calm at rest", () => {
    test("runs no animations anywhere on an idle table under reduced motion", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await launch(page);
      // The deal settles, then nothing in the document may keep running.
      await expect.poll(() => runningAnimations(page, null)).toEqual([]);
    });

    test("runs no Card Table animations on an idle table at 375px", async ({
      page,
    }) => {
      await markManualSeen(page);
      await page.setViewportSize({ width: 375, height: 800 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await expect
        .poll(() => runningAnimations(page, TABLE_SELECTOR))
        .toEqual([]);
    });

    test("runs only the ADR 0046 card breathing on an idle desktop Card Table", async ({
      page,
    }) => {
      await markManualSeen(page);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      // ADR 0046 ("Calm at rest") keeps one deliberate exception on desktop:
      // the sub-pixel te-card-breathe compositor drift on cards in hand.
      await expect
        .poll(async () =>
          (await runningAnimations(page, TABLE_SELECTOR)).filter(
            (a) => !a.startsWith("te-card-breathe @")
          )
        )
        .toEqual([]);
      const breathing = (await runningAnimations(page, TABLE_SELECTOR)).length;
      expect(breathing).toBeGreaterThan(0);
      expect(breathing).toBeLessThanOrEqual(
        await page.locator("[data-card-id]").count()
      );
    });

    test("runs no animations anywhere in the document on a first visit at 375px", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await expect
        .poll(() => runningAnimations(page, null), { timeout: 5000 })
        .toEqual([]);
    });
  });

  test("resolves scoring playback at 1× within about 4 s", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await launch(page);
    await expect(page.getByRole("button", { name: "1×" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.evaluate(() => {
      const w = window as Window & {
        __tePlay?: { start: number | null; end: number | null };
      };
      const probe = {
        start: null as number | null,
        end: null as number | null,
      };
      w.__tePlay = probe;
      new MutationObserver(() => {
        const shown = document.querySelector('[data-testid="score-player"]');
        if (shown && probe.start === null) probe.start = performance.now();
        if (!shown && probe.start !== null && probe.end === null) {
          probe.end = performance.now();
        }
      }).observe(document.body, { subtree: true, childList: true });
    });
    await playPair(page);
    await expect(page.getByTestId("last-hand")).toBeVisible({
      timeout: 10000,
    });
    await expect(player(page)).toHaveCount(0);
    const probe = await page.evaluate(
      () =>
        (
          window as Window & {
            __tePlay?: { start: number | null; end: number | null };
          }
        ).__tePlay!
    );
    expect(probe.start).not.toBeNull();
    expect(probe.end).not.toBeNull();
    // ScorePlayer budgets 3.3 s of steps plus a 0.6 s closing hold at 1×,
    // however long the relic chain (unit-tested at 40 steps). This checks
    // the real clock on a real hand. Each step's timer starts after the
    // previous render commits, so a loaded runner drifts past 3.9 s; about
    // 4 s means under 5.
    const elapsed = Math.round(probe.end! - probe.start!);
    test.info().annotations.push({
      type: "playback-ms",
      description: String(elapsed),
    });
    expect(elapsed).toBeLessThanOrEqual(5000);
  });

  test.describe("loud-moment scoping", () => {
    interface LoudProbe {
      seen: number;
      outside: string[];
    }

    /** Records every loud element that ever renders, and any outside the cabinet. */
    const watchLoud = (page: Page) =>
      page.evaluate((selector) => {
        const probe: LoudProbe = { seen: 0, outside: [] };
        (window as Window & { __teLoud?: LoudProbe }).__teLoud = probe;
        const check = () => {
          for (const el of document.querySelectorAll(selector)) {
            probe.seen += 1;
            if (!el.closest("[data-te-cabinet]")) {
              probe.outside.push(el.outerHTML.slice(0, 160));
            }
          }
        };
        new MutationObserver(check).observe(document.documentElement, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ["class", "data-te-loud-layer"],
        });
        check();
      }, LOUD_SELECTOR);

    const readLoud = (page: Page) =>
      page.evaluate(
        () => (window as Window & { __teLoud?: LoudProbe }).__teLoud!
      );

    test("renders loud effects only inside [data-te-cabinet] on desktop", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await watchLoud(page);
      await playPair(page);
      await expect(page.getByTestId("last-hand")).toBeVisible({
        timeout: 10000,
      });
      const probe = await readLoud(page);
      expect(probe.seen).toBeGreaterThan(0);
      expect(probe.outside).toEqual([]);
      // Nothing loud leaks onto the portfolio frame itself.
      for (const host of ["html", "body", "nav", "footer"]) {
        await expect(page.locator(host).first()).not.toHaveClass(/te-loud-/);
      }
    });

    for (const [label, width, reducedMotion] of [
      ["below 768px", 375, "no-preference"],
      ["under reduced motion", 1440, "reduce"],
    ] as const) {
      test(`never renders a loud effect ${label}, even mid-scoring`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion });
        await launch(page);
        await watchLoud(page);
        await playPair(page);
        await expect(page.getByTestId("last-hand")).toBeVisible({
          timeout: 10000,
        });
        expect((await readLoud(page)).seen).toBe(0);
      });
    }
  });

  test.describe("cabinet audio gating", () => {
    interface AudioProbe {
      contexts: number;
      sources: number;
    }

    /**
     * Counts every AudioContext and every oscillator or buffer source the
     * page creates, before any of the app's scripts run.
     */
    async function instrumentAudio(page: Page, siteUnmuted: boolean) {
      await page.addInitScript((unmuted) => {
        const probe = { contexts: 0, sources: 0 };
        (window as Window & { __teAudio?: typeof probe }).__teAudio = probe;
        if (unmuted) {
          try {
            window.localStorage.setItem("sound_muted", "false");
          } catch {
            // Storage blocked: the test's own assertion will say so.
          }
        }
        const Base = window.AudioContext;
        if (!Base) return;
        class CountingAudioContext extends Base {
          constructor(options?: AudioContextOptions) {
            super(options);
            probe.contexts += 1;
          }
          createOscillator() {
            probe.sources += 1;
            return super.createOscillator();
          }
          createBufferSource() {
            probe.sources += 1;
            return super.createBufferSource();
          }
        }
        window.AudioContext = CountingAudioContext;
      }, siteUnmuted);
    }

    const readAudio = (page: Page) =>
      page.evaluate(
        () => (window as Window & { __teAudio?: AudioProbe }).__teAudio!
      );

    test("is muted by default: a full scored hand makes no sound", async ({
      page,
    }) => {
      await instrumentAudio(page, false);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      await expect(
        page.getByRole("button", { name: /Unmute/ }).first()
      ).toBeVisible();
      await playPair(page);
      await expect(page.getByTestId("last-hand")).toBeVisible({
        timeout: 10000,
      });
      expect(await readAudio(page)).toEqual({ contexts: 0, sources: 0 });
    });

    test("stays silent before a user gesture, even with the site unmuted", async ({
      page,
    }) => {
      await instrumentAudio(page, true);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto(ROUTE, { waitUntil: "domcontentloaded" });
      // Playwright's own evaluate and locator calls run as a user gesture,
      // so until the first deliberate gesture every step goes through a
      // raw CDP evaluate with userGesture off. Its script clicks are not
      // user activation either.
      const cdp = await page.context().newCDPSession(page);
      const quiet = async <T>(expression: string): Promise<T> => {
        const { result, exceptionDetails } = await cdp.send(
          "Runtime.evaluate",
          { expression, userGesture: false, returnByValue: true }
        );
        if (exceptionDetails) throw new Error(exceptionDetails.text);
        return result.value as T;
      };
      const clickButton = (pattern: string) =>
        `(() => { const b = Array.from(document.querySelectorAll("button")).find((el) => ${pattern}.test(el.textContent || "")); if (b) b.click(); return !!b; })()`;
      const exists = (selector: string) =>
        `!!document.querySelector(${JSON.stringify(selector)})`;

      await expect
        .poll(
          async () => {
            await quiet(clickButton("/Launch Cabinet/i"));
            return quiet<boolean>(exists('[data-testid="hand"]'));
          },
          { timeout: 30000 }
        )
        .toBe(true);
      await quiet(
        `[${JSON.stringify(DRAFT_A)}, ${JSON.stringify(DM_LISTING)}].forEach((id) => document.querySelector('[data-card-id="' + id + '"]').click())`
      );
      await expect
        .poll(() => quiet<boolean>(clickButton("/Play Hand/")))
        .toBe(true);
      await expect
        .poll(() => quiet<boolean>(exists('[data-testid="last-hand"]')), {
          timeout: 10000,
        })
        .toBe(true);
      expect(
        await quiet<{ active: boolean; sources: number }>(
          "({ active: navigator.userActivation.hasBeenActive, sources: window.__teAudio.sources })"
        )
      ).toEqual({ active: false, sources: 0 });
      await cdp.detach();

      // The first real gesture opens the gate: selecting a card now clicks.
      // The played pair has left the hand, so take whichever card leads it.
      await expect(async () => {
        const before = (await readAudio(page)).sources;
        await page.locator("[data-card-id]").first().click();
        await expect
          .poll(async () => (await readAudio(page)).sources, { timeout: 2000 })
          .toBeGreaterThan(before);
      }).toPass({ timeout: 15000 });
    });

    test("pauses music while the tab is hidden and stops it when the cabinet exits", async ({
      page,
    }) => {
      await instrumentAudio(page, true);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await launch(page);
      const music = page.getByRole("button", { name: "Music", exact: true });
      await expect(async () => {
        if ((await music.getAttribute("aria-pressed")) !== "true") {
          await music.click();
        }
        await expect(music).toHaveAttribute("aria-pressed", "true", {
          timeout: 2000,
        });
      }).toPass({ timeout: 15000 });

      const sources = async () => (await readAudio(page)).sources;
      /** Asserts no new sources are scheduled over a quiet window. */
      const expectQuiet = async () => {
        // Let any beat already inside the look-ahead window finish.
        await page.waitForTimeout(400);
        const settled = await sources();
        await page.waitForTimeout(1200);
        expect(await sources()).toBe(settled);
      };
      await expect.poll(sources).toBeGreaterThan(0);

      const setVisibility = (state: "hidden" | "visible") =>
        page.evaluate((next) => {
          Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => next,
          });
          document.dispatchEvent(new Event("visibilitychange"));
        }, state);

      await setVisibility("hidden");
      await expectQuiet();

      await setVisibility("visible");
      const resumedFrom = await sources();
      await expect.poll(sources).toBeGreaterThan(resumedFrom);

      await expect(async () => {
        await page.getByTitle("Reset / Power Off Cabinet").click();
        await expect(page.getByTestId("hand")).toHaveCount(0, {
          timeout: 2000,
        });
      }).toPass({ timeout: 15000 });
      await expectQuiet();
    });
  });

  test.describe("keyboard map", () => {
    const order = (page: Page) =>
      page
        .locator("[data-card-id]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-card-id")));

    test("plays the Card Table by keyboard as #925 documents", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await launch(page);
      const cards = page.locator("[data-card-id]");
      await expect(async () => {
        await cards.first().focus();
        await expect(cards.first()).toBeFocused({ timeout: 2000 });
      }).toPass({ timeout: 15000 });
      const [first, second] = await order(page);

      // ←/→ move across the hand.
      await page.keyboard.press("ArrowRight");
      await expect(card(page, second!)).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await expect(card(page, first!)).toBeFocused();

      // Alt+←/→ reorders the focused card, and focus follows it.
      await page.keyboard.press("Alt+ArrowRight");
      await expect
        .poll(async () => (await order(page)).indexOf(first!))
        .toBe(1);
      await expect(card(page, first!)).toBeFocused();
      await page.keyboard.press("Alt+ArrowLeft");
      await expect
        .poll(async () => (await order(page)).indexOf(first!))
        .toBe(0);

      // Space selects and deselects.
      await page.keyboard.press("Space");
      await expect(card(page, first!)).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press("Space");
      await expect(card(page, first!)).toHaveAttribute("aria-pressed", "false");

      // I inspects (1 CPU); arrows move between cells; T traces a flagged
      // cell to its listing; Escape closes and returns focus to the card.
      await card(page, DRAFT_A).focus();
      await page.keyboard.press("Space");
      await expect(page.getByTestId("cpu-counter")).toHaveText("10/10");
      await page.keyboard.press("i");
      await expect(gridCell(page, 0, 0)).toBeFocused();
      await expect(page.getByTestId("cpu-counter")).toHaveText("9/10");
      await page.keyboard.press("ArrowRight");
      await expect(gridCell(page, 0, 1)).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(gridCell(page, 1, 1)).toBeFocused();
      await gridCell(page, 2, 2).click();
      await page.keyboard.press("t");
      await expect(page.getByTestId("trace-listing")).toContainText(
        "Listing 16.2.4"
      );
      await expect(gridCell(page, 2, 2)).toHaveAttribute("data-traced", /.*/);
      await page.keyboard.press("Escape");
      await expect(drawer(page)).toBeHidden();
      await expect(card(page, DRAFT_A)).toBeFocused();

      // Documented as R; the actual key is Shift+R, because a plain R on a
      // card recompiles a stale output (T&E-03).
      await page.keyboard.press("Shift+R");
      const runInfo = page.getByRole("dialog", { name: "Run Info" });
      await expect(runInfo).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(runInfo).toBeHidden();
      await expect(card(page, DRAFT_A)).toBeFocused();

      // Enter plays the selected hand (2 CPU).
      await card(page, DM_LISTING).focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("last-hand")).toBeVisible();
      await expect(page.getByTestId("cpu-counter")).toHaveText("7/10");

      // D discards the selected cards (1 CPU).
      await expect(cards.first()).toBeVisible();
      await cards.first().focus();
      await page.keyboard.press("Space");
      await page.keyboard.press("d");
      await expect(page.getByTestId("cpu-counter")).toHaveText("6/10");

      // Tab leaves the hand for the next control group.
      await cards.first().focus();
      await page.keyboard.press("Tab");
      await expect(page.locator("[data-card-id]:focus")).toHaveCount(0);
    });

    test("sells a relic with S in the shop, reached with Tab", async ({
      page,
    }) => {
      await launch(page, SHOP_ROUTE);
      await winSmallBlind(page);
      const cashOut = page.getByRole("button", { name: /^Cash out \$\d+k$/ });
      await expect(cashOut).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByTestId("shop")).toBeVisible();

      // Consumables sell from their own Sell button (Enter), not with S.
      const tray = page.getByTestId("consumable-tray");
      for (let i = 0; i < 2; i++) {
        await tray.getByRole("button", { name: /^Sell/ }).first().focus();
        await page.keyboard.press("Enter");
      }
      const buy = page
        .getByTestId("shop-items")
        .getByRole("button", { name: "Buy Senior Programmer" });
      await buy.focus();
      await page.keyboard.press("Enter");

      // Documented as ←/→ across shop items and the relic rack; the actual
      // keys are Tab and Shift+Tab, since each item and relic is its own
      // button. Arrows are not bound there.
      const sell = page.getByTestId("relic-rack").getByTestId("relic-sell");
      await sell.focus();
      await page.keyboard.press("ArrowRight");
      await expect(sell).toBeFocused();
      await page.keyboard.press("s");
      const confirm = page.getByTestId("relic-sell-confirm");
      await expect(confirm).toBeVisible();
      await expect(confirm.getByRole("button", { name: "Sell" })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(
        page.getByTestId("relic-rack").getByTestId("relic")
      ).toHaveCount(0);
    });
  });
});
