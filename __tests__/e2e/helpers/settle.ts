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
  try {
    await page.waitForFunction(
      ({ selector, frames }) => {
        type Settle = {
          root: Element;
          changed: boolean;
          quiet: number;
          observer: MutationObserver;
          recent: string[];
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
            recent: [],
            observer: new MutationObserver((records) => {
              fresh.changed = true;
              for (const record of records) {
                const target = record.target as Element;
                const name = `${target.tagName.toLowerCase()}.${String(
                  target.getAttribute("class") ?? ""
                ).slice(0, 60)} [${record.attributeName}]`;
                fresh.recent.push(name);
              }
              fresh.recent = fresh.recent.slice(-8);
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
          const timing = animation.effect?.getComputedTiming();
          // WebKit can leave a sub-millisecond transition (seen on `tab-size`
          // under the reduced-motion reset) in "running" indefinitely. It
          // has no frames left to paint, so there is nothing to wait for.
          if (Number(timing?.endTime ?? 0) < 1) return false;
          return timing?.iterations !== Infinity;
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
  } catch (error) {
    // Name what kept moving, so a timeout on a browser the author cannot run
    // locally (WebKit in cloud sessions) says where to look.
    const still = await page
      .evaluate(() => {
        const w = window as unknown as { __e2eSettle?: { recent: string[] } };
        const animations = document
          .getAnimations()
          .filter(
            (animation) =>
              animation.playState === "running" &&
              Number(animation.effect?.getComputedTiming().endTime ?? 0) >= 1 &&
              animation.effect?.getComputedTiming().iterations !== Infinity
          )
          .map((animation) => {
            const target = (animation.effect as KeyframeEffect | null)
              ?.target as Element | null;
            const kind =
              (animation as Animation & { transitionProperty?: string })
                .transitionProperty ??
              (animation as Animation & { animationName?: string })
                .animationName ??
              animation.constructor.name;
            const timing = animation.effect?.getComputedTiming();
            return `${target?.tagName.toLowerCase() ?? "?"}.${String(
              target?.getAttribute("class") ?? ""
            ).slice(0, 40)} (${kind} ${Math.round(
              Number(timing?.localTime ?? 0)
            )}/${Math.round(Number(timing?.endTime ?? 0))}ms)`;
          })
          .slice(0, 8);
        return { mutations: w.__e2eSettle?.recent ?? [], animations };
      })
      .catch(() => null);
    if (error instanceof Error && still) {
      error.message += `\nStill changing: ${JSON.stringify(still)}`;
    }
    throw error;
  }
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
