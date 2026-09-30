/**
 * Resilient Playwright Chromium Launch Helper
 * Falls back to an unversioned cached browser binary when the exact
 * revision the installed @playwright/test package expects isn't present.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type LaunchOptions } from "@playwright/test";
import { getEnv } from "../env";

/**
 * Launches Chromium via Playwright, retrying against an unversioned browser
 * binary at `$PLAYWRIGHT_BROWSERS_PATH/chromium` when the default launch
 * fails because the exact revision pinned by the installed `@playwright/test`
 * package isn't present. Some pre-seeded dev environments cache an older
 * Chromium build under a stable, unversioned path instead of the exact
 * pinned revision; that cached build is still a valid Chromium for headless
 * rendering, so this avoids a hard failure without masking a genuine
 * "Playwright isn't installed at all" error (the fallback path only kicks in
 * when that specific binary actually exists).
 */
export async function launchChromiumWithFallback(
  options: LaunchOptions = {}
): Promise<Browser> {
  try {
    return await chromium.launch(options);
  } catch (error) {
    const browsersPath = getEnv().PLAYWRIGHT_BROWSERS_PATH;
    const fallbackExecutable = browsersPath
      ? path.join(browsersPath, "chromium")
      : undefined;
    if (!fallbackExecutable || !existsSync(fallbackExecutable)) {
      throw error;
    }
    return chromium.launch({ ...options, executablePath: fallbackExecutable });
  }
}
