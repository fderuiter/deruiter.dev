import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import {
  assertStageCoverage,
  assertTextFloor,
  assertThumbZone,
  assertTouchTargets,
  axeCabinet,
  captureViewMatrix,
  expectTapsOnlyFirstScore,
  expectView,
  interruptAndResume,
  launchCabinet,
  swapViewMidRun,
} from "./mobile-harness";

// Self-tests for the phone harness (#2365). Each helper runs against a small
// page served from memory, once where it should pass and, where a failure is
// cheap to reach, once where it should fail, so a helper that stops checking
// is caught here rather than by a game spec that quietly passes. The pages
// need no app server and no device, so only the desktop project runs them.

const FIXTURE_SLUG = "harness-fixture";
const FIXTURE_URL = `**/arcade/${FIXTURE_SLUG}*`;

const PAGE_HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Harness fixture</title>
<style>
  body { margin: 0; font: 16px sans-serif; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .arcade-cabinet-stage { width: 100vw; }
  button { min-width: 44px; min-height: 44px; font-size: 16px; }
</style></head><body>`;

/** Shows `body` as a page, without navigating anywhere. */
async function show(page: Page, body: string) {
  await page.setContent(`${PAGE_HEAD}${body}</body></html>`);
}

/** Serves `body` at the fixture game's route, so a reload keeps it. */
async function serve(page: Page, body: string) {
  await page.route(FIXTURE_URL, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `${PAGE_HEAD}${body}</body></html>`,
    })
  );
}

/** The message of the error `run` throws, or "" when it passes. */
async function failureOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** A cabinet whose stage is `stageHeight` tall, holding `inner`. */
const cabinet = (inner: string, stageHeight = "100vh", attrs = "") =>
  `<div data-arcade-cabinet="fixture" ${attrs}><div class="arcade-cabinet-stage" style="height:${stageHeight}">${inner}</div></div>`;

/**
 * A fixture game: Launch mounts a cabinet with a score and a Score button.
 * Launch only works 300 ms after load, as a page still hydrating. The view
 * follows the width (phone under 768, tablet under 1280), and a change of
 * view pauses the run. With `saves`, a launched run is written on pagehide and the
 * next launch offers "Resume run"; `savesWrong` writes a score of zero.
 */
const fixtureGame = ({
  saves = false,
  savesWrong = false,
  keepsRunOnSwap = true,
}: {
  saves?: boolean;
  savesWrong?: boolean;
  keepsRunOnSwap?: boolean;
} = {}) => `
<button id="launch" type="button">Launch Cabinet</button>
<script>
  const KEY = "harness_fixture_run";
  const viewFor = () => innerWidth < 768 ? "phone" : innerWidth < 1280 ? "tablet" : "desktop";
  let score = 0;
  let mounted = false;
  function mount() {
    mounted = true;
    document.getElementById("launch").remove();
    const touch = navigator.maxTouchPoints > 0;
    const root = document.createElement("div");
    root.setAttribute("data-arcade-cabinet", "fixture");
    root.setAttribute("data-view", viewFor());
    root.setAttribute("data-paused", "false");
    if (touch) root.setAttribute("data-immersive", "true");
    root.innerHTML = '<div class="arcade-cabinet-stage" style="height:100vh">' +
      '<p>Score <span data-testid="score">0</span></p>' +
      '<button type="button" id="score-up">Score</button></div>';
    document.body.appendChild(root);
    const shown = root.querySelector('[data-testid="score"]');
    const paint = () => { shown.textContent = String(score); };
    root.querySelector("#score-up").addEventListener("click", () => { score += 10; paint(); });
    addEventListener("resize", () => {
      const next = viewFor();
      if (next === root.getAttribute("data-view")) return;
      root.setAttribute("data-view", next);
      root.setAttribute("data-paused", "true");
      if (!${keepsRunOnSwap}) { score = 0; paint(); }
    });
    const saved = ${saves} ? localStorage.getItem(KEY) : null;
    if (saved !== null) {
      const resume = document.createElement("button");
      resume.type = "button";
      resume.textContent = "Resume run";
      resume.addEventListener("click", () => { score = Number(saved); paint(); resume.remove(); });
      root.appendChild(resume);
    }
  }
  addEventListener("pagehide", () => {
    if (${saves} && mounted) localStorage.setItem(KEY, String(${savesWrong} ? 0 : score));
  });
  setTimeout(() => {
    document.getElementById("launch").addEventListener("click", mount);
  }, 300);
</script>`;

/** The fixture's score, as a number. */
const readScore = async (page: Page) =>
  Number(await page.getByTestId("score").textContent());

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "harness self-tests run on the desktop project"
  );
});

test.describe("Mobile harness self-tests: launch and views", () => {
  test("launchCabinet presses Launch until a still-hydrating page answers", async ({
    page,
  }) => {
    await serve(page, fixtureGame());
    await launchCabinet(page, FIXTURE_SLUG, { query: "seed=s1" });
    await expect(page.locator("[data-arcade-cabinet]")).toBeVisible();
    expect(new URL(page.url()).search).toBe("?seed=s1");
  });

  test("expectView reads data-view and waits for a swap", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await serve(page, fixtureGame());
    await launchCabinet(page, FIXTURE_SLUG);
    await expectView(page, "phone");
    await page.setViewportSize({ width: 1440, height: 900 });
    await expectView(page, "desktop");
  });

  test("captureViewMatrix writes one shot per size and records the view", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await serve(page, fixtureGame());
    await launchCabinet(page, FIXTURE_SLUG);
    const shots = await captureViewMatrix(page, FIXTURE_SLUG);
    expect(shots.map((shot) => [shot.width, shot.view])).toEqual([
      [320, "phone"],
      [375, "phone"],
      [768, "tablet"],
      [1440, "desktop"],
    ]);
    for (const shot of shots) expect(fs.existsSync(shot.file)).toBe(true);
    expect(page.viewportSize()).toEqual({ width: 1440, height: 900 });
  });

  test("swapViewMidRun passes a swap that keeps the run, and fails one that drops it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await serve(page, fixtureGame());
    await launchCabinet(page, FIXTURE_SLUG);
    await page.locator("#score-up").click();
    await swapViewMidRun(
      page,
      "desktop",
      { view: "phone", size: { width: 375, height: 667 } },
      readScore
    );

    await page.unrouteAll();
    await page.setViewportSize({ width: 1440, height: 900 });
    await serve(page, fixtureGame({ keepsRunOnSwap: false }));
    await launchCabinet(page, FIXTURE_SLUG);
    await page.locator("#score-up").click();
    const failure = await failureOf(() =>
      swapViewMidRun(
        page,
        "desktop",
        { view: "tablet", size: { width: 1024, height: 768 } },
        readScore
      )
    );
    expect(failure).toContain("the run after the swap");
  });

  test("interruptAndResume passes a restored run, and fails a lost one", async ({
    page,
  }) => {
    const steps = {
      readRun: readScore,
      relaunch: (p: Page) => launchCabinet(p, FIXTURE_SLUG),
    };
    await serve(page, fixtureGame({ saves: true }));
    await launchCabinet(page, FIXTURE_SLUG);
    await page.locator("#score-up").click();
    await page.locator("#score-up").click();
    await interruptAndResume(page, steps);
    expect(await readScore(page)).toBe(20);

    await page.unrouteAll();
    await page.evaluate(() => localStorage.clear());
    await serve(page, fixtureGame({ saves: true, savesWrong: true }));
    await launchCabinet(page, FIXTURE_SLUG);
    await page.locator("#score-up").click();
    const failure = await failureOf(() => interruptAndResume(page, steps));
    expect(failure).toContain("the run after Resume");
  });
});

test.describe("Mobile harness self-tests: layout checks", () => {
  test("assertStageCoverage measures the visible stage against the viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    await show(page, cabinet("<p>Stage</p>", "50vh"));
    const share = await assertStageCoverage(page, 0.45);
    expect(share).toBeCloseTo(0.5, 2);
    expect(await failureOf(() => assertStageCoverage(page, 0.6))).toContain(
      "stage covers 50% of the viewport"
    );
  });

  test("assertTouchTargets fails a small control and skips ones nobody can press", async ({
    page,
  }) => {
    await show(
      page,
      cabinet(`
        <button type="button">Big enough</button>
        <button type="button" disabled style="min-width:0;min-height:0;width:20px;height:20px">Off</button>
        <div aria-hidden="true"><button type="button" tabindex="-1" style="min-width:0;min-height:0;width:20px;height:20px">Hidden</button></div>
        <span class="sr-only"><a href="#x">Skip</a></span>`)
    );
    await assertTouchTargets(page, 44);

    await show(
      page,
      cabinet(
        `<button type="button" aria-label="Tiny" style="min-width:0;min-height:0;width:30px;height:30px"></button>`
      )
    );
    expect(await failureOf(() => assertTouchTargets(page, 44))).toContain(
      "Tiny 30x30"
    );
  });

  test("assertTextFloor fails small text and skips screen-reader-only text", async ({
    page,
  }) => {
    await show(
      page,
      cabinet(
        `<p style="font-size:12px">Readable</p><span class="sr-only" style="font-size:8px">Only for readers</span>`
      )
    );
    await assertTextFloor(page, 12);

    await show(page, cabinet(`<p style="font-size:10px">Fine print</p>`));
    expect(await failureOf(() => assertTextFloor(page, 12))).toContain(
      "Fine print (10px)"
    );
  });

  test("assertThumbZone wants the bottom 40% upright and an outer column sideways", async ({
    page,
  }) => {
    const at = (style: string) =>
      cabinet(
        `<button type="button" id="primary" style="position:fixed;${style}">Play</button>`
      );

    await page.setViewportSize({ width: 375, height: 667 });
    await show(page, at("bottom:16px;left:160px"));
    await assertThumbZone(page, "#primary");
    await show(page, at("top:16px;left:160px"));
    expect(await failureOf(() => assertThumbZone(page, "#primary"))).toContain(
      "centre in the bottom 40%"
    );

    await page.setViewportSize({ width: 852, height: 393 });
    await show(page, at("bottom:16px;right:16px"));
    await assertThumbZone(page, "#primary");
    await show(page, at("bottom:16px;left:400px"));
    expect(await failureOf(() => assertThumbZone(page, "#primary"))).toContain(
      "in an outer 25% column"
    );
  });

  test("axeCabinet passes a clean cabinet and fails a nameless button", async ({
    page,
  }) => {
    await show(
      page,
      `<main>${cabinet('<button type="button">Play</button>')}</main>`
    );
    await axeCabinet(page);

    await show(
      page,
      `<main>${cabinet('<button type="button"></button>')}</main>`
    );
    expect(await failureOf(() => axeCabinet(page))).toContain("button-name");
  });
});

test.describe("Mobile harness self-tests: taps only", () => {
  test.use({ hasTouch: true });

  test("expectTapsOnlyFirstScore taps the script and sees the score rise", async ({
    page,
  }) => {
    await serve(page, fixtureGame());
    await launchCabinet(page, FIXTURE_SLUG);
    await expectTapsOnlyFirstScore(page, {
      taps: [(p) => p.locator("#score-up")],
      score: readScore,
    });
  });
});

test.describe("Mobile harness self-tests: taps only without touch", () => {
  test("expectTapsOnlyFirstScore refuses a project without touch", async ({
    page,
  }) => {
    await serve(page, fixtureGame());
    await launchCabinet(page, FIXTURE_SLUG);
    const failure = await failureOf(() =>
      expectTapsOnlyFirstScore(page, {
        taps: [(p) => p.locator("#score-up")],
        score: readScore,
      })
    );
    expect(failure).toContain("a taps-only run needs a touch project");
  });
});
