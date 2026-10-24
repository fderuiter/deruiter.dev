# Run the arcade phone device matrix

The Playwright suite emulates seven phones for the arcade (#2365). Each runs
in Chromium with touch, `isMobile` and a device pixel ratio of 2 or 3. These
checks catch layout and input problems before a game goes to a real device;
[the real-device check](run-an-arcade-real-device-check.md) covers what
emulation cannot.

## The matrix

| Project | Viewport (CSS px) | DPR |
| --- | --- | --- |
| Phone small Android | 320x568 | 2 |
| Phone iPhone SE | 375x667 | 2 |
| Phone iPhone 15 | 393x852 | 3 |
| Phone Pro Max | 430x932 | 3 |
| Phone Pixel 7 | 412x915 | 3 |
| Phone iPhone 15 landscape | 852x393 | 3 |
| Phone Pixel 7 landscape | 915x412 | 3 |

The phone projects run only `__tests__/e2e/phone-kit.spec.ts` and each game's
`*-phone.spec.ts`, so the rest of the suite does not multiply by seven. The
WebKit `Mobile Safari` project stays for the device-gate specs.

## Run it locally

Build the app once, then run the phone projects:

```bash
npm run build
npm run test:e2e:phone
```

To run one size or one game, pass Playwright's own filters:

```bash
npm run test:e2e:phone -- --project="Phone iPhone SE"
npm run test:e2e:phone -- retro-labyrinth-phone.spec.ts
```

In a Claude Code cloud session Chromium is already installed under
`/opt/pw-browsers`. Do not run `playwright install`. If a project pins
another `@playwright/test` version, launch with
`executablePath: '/opt/pw-browsers/chromium'`.

## Name a phone spec

- Call the file `<game>-phone.spec.ts`. Only that suffix and the phone kit
  match the phone projects.
- Start the top-level `describe` with the game's display name and "on a
  phone", for example `Retro Labyrinth on a phone (#2003)`. The pull request
  `device-gate` job selects device specs by the game names in
  `ARCADE_DEVICE_GAMES` (`scripts/ci-run-policy.mjs`), so a spec named this
  way runs whenever a pull request touches its game.
- Start a shared kit spec's `describe` with `Mobile arcade kit`, or add its
  title to `ARCADE_KIT_TITLES`.
- A game whose phone and tablet specs are the same can register them once in
  `__tests__/e2e/helpers/` and call the helper from both files, as Retro
  Labyrinth does.

## The shared assertions

`__tests__/e2e/mobile-harness.ts` holds the checks every phone spec reuses.
`__tests__/e2e/mobile-harness.spec.ts` tests each one against a small page,
both passing and failing.

| Helper | What it checks |
| --- | --- |
| `launchCabinet(page, slug)` | Opens the game and presses Launch until the cabinet is up |
| `expectView(page, view)` | The cabinet's `data-view` |
| `assertStageCoverage(page, min)` | The stage's visible share of the viewport |
| `assertTouchTargets(page, 44)` | Every enabled control in the cabinet is at least 44px |
| `assertTextFloor(page, 12)` | Visible text in the cabinet is at least 12px |
| `assertThumbZone(page, selector)` | The primary action is in the bottom 40%, or an outer 25% column in landscape |
| `assertNoHorizontalOverflow(page)` | Nothing is wider than the viewport |
| `axeCabinet(page)` | No critical, serious or moderate axe violation under WCAG 2.1 AA |
| `captureViewMatrix(page, slug)` | Screenshots at 320, 375, 768 and 1440 (`VIEW_MATRIX` for the full set) |
| `swapViewMidRun(page, from, to, readRun)` | A resize across a breakpoint keeps the run and pauses |
| `interruptAndResume(page, steps)` | Hide, reload and Resume restore the saved run |
| `expectTapsOnlyFirstScore(page, script)` | The game's tap script reaches its first score |
