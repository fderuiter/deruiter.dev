import type { Page } from "@playwright/test";

/**
 * Resolves once the page has painted `count` more animation frames.
 *
 * Use it where a test must let the game loop run before checking that
 * nothing changed (a paused clock stays put, a released key stops walking):
 * every frame is one more chance for the loop to step, so the check is as
 * strict on a slow runner as on a fast one. A fixed `waitForTimeout` is not,
 * and the lint rule in `eslint.config.mjs` rejects it (#2528). At 60 Hz,
 * 60 frames is about a second.
 */
export async function waitForAnimationFrames(
  page: Page,
  count: number
): Promise<void> {
  await page.evaluate(
    (frames) =>
      new Promise<void>((resolve) => {
        let left = frames;
        const tick = () => {
          left -= 1;
          if (left <= 0) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count
  );
}

/**
 * Waits until the page under `root` has stopped moving: no finite CSS or Web
 * Animations are running, and no inline `style` or `class` attribute has
 * changed for `quietFrames` consecutive animation frames. framer-motion
 * drives its entrances through inline style, so the attribute check is what
 * catches a fade the `animation: none` reset does not stop.
 *
 * Use it before an axe scan or a layout measurement that would otherwise
 * read a half-faded foreground or a box still sliding into place. Infinite
 * animations (spinners, pulses) are ignored, since they never finish.
 */
export async function waitForVisualSettle(
  page: Page,
  {
    root = "body",
    quietFrames = 5,
    timeout = 10000,
  }: { root?: string; quietFrames?: number; timeout?: number } = {}
): Promise<void> {
  await page.waitForFunction(
    ({ selector, frames }) => {
      type Settle = {
        root: Element;
        changed: boolean;
        quiet: number;
        observer: MutationObserver;
      };
      const w = window as unknown as { __e2eSettle?: Settle };
      const el = document.querySelector(selector);
      if (!el) return false;
      let state = w.__e2eSettle;
      if (!state || state.root !== el || !el.isConnected) {
        state?.observer.disconnect();
        const fresh: Settle = {
          root: el,
          changed: true,
          quiet: 0,
          observer: new MutationObserver(() => {
            fresh.changed = true;
          }),
        };
        fresh.observer.observe(el, {
          subtree: true,
          attributes: true,
          attributeFilter: ["style", "class"],
        });
        state = fresh;
        w.__e2eSettle = fresh;
      }
      const animating = document.getAnimations().some((animation) => {
        if (animation.playState !== "running") return false;
        const target = (animation.effect as KeyframeEffect | null)?.target;
        if (target && !el.contains(target)) return false;
        const iterations = animation.effect?.getComputedTiming().iterations;
        return iterations !== Infinity;
      });
      if (state.changed || animating) {
        state.changed = false;
        state.quiet = 0;
        return false;
      }
      state.quiet += 1;
      if (state.quiet < frames) return false;
      state.observer.disconnect();
      delete w.__e2eSettle;
      return true;
    },
    { selector: root, frames: quietFrames },
    { polling: "raf", timeout }
  );
}

/**
 * Waits until the page has loaded, its web fonts have resolved, and `frames`
 * more animation frames have painted, so a layout measurement reads final
 * line breaks and box sizes.
 *
 * Use it where only geometry matters, such as a horizontal overflow check.
 * Unlike `waitForVisualSettle`, it does not wait for every style or class
 * mutation to stop, which on some routes (a live clock, a typing effect, a
 * studio autosave) never happens under WebKit.
 */
export async function waitForLayoutReady(
  page: Page,
  frames = 18
): Promise<void> {
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await waitForAnimationFrames(page, frames);
}
