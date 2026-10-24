import { defineConfig, devices } from "@playwright/test";

/**
 * When set, probes run against an already-deployed origin (production, or a
 * Preview URL) instead of a locally built app. Booting a local server in that
 * case is both pointless and a hard failure, because nothing has been built.
 */
const externalBaseUrl = process.env.PLAYWRIGHT_TEST_BASE_URL;

/**
 * Staged release deployments are served from `*.vercel.app` URLs behind Vercel
 * Authentication. With Protection Bypass for Automation enabled, sending the
 * project's bypass secret lets probes reach them; the cookie header carries the
 * bypass across same-origin navigations and asset requests.
 */
const vercelBypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

/**
 * ADR 0061 tablet matrix. Chromium with touch emulation stands in for iPad
 * Safari: each size runs in portrait and in landscape. Only the tablet specs
 * run here, so the rest of the suite does not multiply by eight.
 */
const TABLET_TEST_MATCH = [/tablet-kit\.spec\.ts$/, /-tablet\.spec\.ts$/];
const TABLET_DEVICES: ReadonlyArray<readonly [string, number, number]> = [
  ["iPad mini", 744, 1133],
  ["iPad Air", 820, 1180],
  ["iPad Pro 11", 834, 1194],
  ["iPad Pro 13", 1024, 1366],
];

/**
 * The phone matrix (#2365): the 320px floor, the common portrait sizes, and
 * two of them held landscape. Every name starts with "Phone", so
 * `--project="Phone*"` selects them all. A spec runs here when it is the
 * phone kit or a game's `*-phone.spec.ts`.
 */
const PHONE_TEST_MATCH = [/phone-kit\.spec\.ts$/, /-phone\.spec\.ts$/];
const PHONE_DEVICES: ReadonlyArray<
  readonly [name: string, width: number, height: number, dpr: number]
> = [
  ["Phone small Android", 320, 568, 2],
  ["Phone iPhone SE", 375, 667, 2],
  ["Phone iPhone 15", 393, 852, 3],
  ["Phone Pro Max", 430, 932, 3],
  ["Phone Pixel 7", 412, 915, 3],
  ["Phone iPhone 15 landscape", 852, 393, 3],
  ["Phone Pixel 7 landscape", 915, 412, 3],
];

export default defineConfig({
  testDir: "./__tests__/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // One worker could not finish: the suite was cancelled at 34m41s under a
  // 45-minute job cap and again at 58m39s under 70. The runner has 4 vCPU and
  // was spending three of them idle while 576 tests ran serially. Two workers
  // rather than the default (cores/2) keeps headroom for the Next server and
  // the Postgres service container sharing the box, and keeps pixel-matching
  // in visual.spec.ts away from a fully saturated CPU.
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: externalBaseUrl || "http://localhost:3000",
    trace: "on-first-retry",
    extraHTTPHeaders: vercelBypassSecret
      ? {
          "x-vercel-protection-bypass": vercelBypassSecret,
          "x-vercel-set-bypass-cookie": "true",
        }
      : undefined,
  },
  expect: {
    timeout: 15000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Tablet Safari",
      use: { ...devices["iPad (gen 7)"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    ...TABLET_DEVICES.flatMap(([name, shortSide, longSide]) =>
      [
        { name, width: shortSide, height: longSide },
        { name: `${name} landscape`, width: longSide, height: shortSide },
      ].map(({ name: projectName, width, height }) => ({
        name: projectName,
        testMatch: TABLET_TEST_MATCH,
        use: {
          hasTouch: true,
          isMobile: true,
          deviceScaleFactor: 2,
          viewport: { width, height },
        },
      }))
    ),
    // #2365: the phone matrix. Chromium with touch stands in for the phone
    // browsers; WebKit's "Mobile Safari" above stays for the device-gate
    // specs. Only the phone kit and the games' phone specs run here.
    ...PHONE_DEVICES.map(([name, width, height, deviceScaleFactor]) => ({
      name,
      testMatch: PHONE_TEST_MATCH,
      use: {
        userAgent: devices["Pixel 7"].userAgent,
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor,
        viewport: { width, height },
      },
    })),
  ],
  // Only manage a local server when there is no external target to probe.
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: {
          PLAYWRIGHT_TEST: "true",
          SKIP_DB_HEALTH_CHECK: "true",
        },
      },
});
