import { test, expect } from "@playwright/test";
import { ARCADE_REGISTRY } from "../../../lib/arcade/registry";

/**
 * Every game's standby card, the attract screen before Launch, must show its
 * whole content (#2890). A 16:10 card that clipped its content hid Launch
 * Cabinet below its own edge on phones and portrait iPads. Playwright's own
 * tap scrolls a clipped button into view, so the check reads the geometry
 * rather than tapping.
 *
 * @param device - The device named in each test title.
 * @param projects - The Playwright projects that run the checks.
 */
export function describeStandbyCardFit(device: string, projects: RegExp) {
  for (const { route, name } of ARCADE_REGISTRY) {
    test(`${name}'s standby card shows Launch Cabinet on a ${device} (#2890)`, async ({
      page,
    }, testInfo) => {
      test.skip(
        !projects.test(testInfo.project.name),
        `${device} projects only`
      );
      await page.goto(route);
      const launch = page
        .getByRole("button", { name: /Launch Cabinet/i })
        .first();
      // A game still behind the phone gate shows its card after "Try it
      // anyway", so the card must fit there too. A game without a cabinet
      // (Meme Vault) shows neither.
      const tryAnyway = page.getByRole("button", { name: /Try it anyway/i });
      const shown = await launch
        .or(tryAnyway)
        .first()
        .waitFor({ timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      test.skip(!shown, `no standby card on a ${device}`);
      if (await tryAnyway.isVisible()) await tryAnyway.click();
      await expect(launch).toBeVisible();
      const fit = await launch.evaluate((button) => {
        let card = button.parentElement;
        while (card && !card.className.toString().includes("aspect-[16/10]")) {
          card = card.parentElement;
        }
        if (!card) return null;
        const box = card.getBoundingClientRect();
        const key = button.getBoundingClientRect();
        return {
          clipped: card.scrollHeight - card.clientHeight,
          scrolled: card.scrollTop,
          cardTop: box.top,
          cardBottom: box.bottom,
          cardHeight: box.height,
          keyTop: key.top,
          keyBottom: key.bottom,
        };
      });
      expect(fit).not.toBeNull();
      expect(fit!.scrolled).toBe(0);
      expect(fit!.clipped).toBeLessThanOrEqual(1);
      expect(fit!.keyTop).toBeGreaterThanOrEqual(fit!.cardTop);
      expect(fit!.keyBottom).toBeLessThanOrEqual(fit!.cardBottom);
      const viewport = testInfo.project.use.viewport!;
      if (viewport.width > viewport.height) {
        expect(fit!.cardHeight).toBeLessThanOrEqual(viewport.height);
      }
    });
  }
}
