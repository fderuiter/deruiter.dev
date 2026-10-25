# Build an arcade game for three views

Every arcade game is one session with a desktop, a tablet and a phone view
([ADR 0062](../../adr/0062-three-views-per-arcade-game.md)). This guide shows
how to build a new game that way, or move an existing one onto it. Retro
Labyrinth was the first game moved ([#2375](https://github.com/fderuiter/deruiter.dev/issues/2375)),
so it is the worked example throughout.

## Start from the scaffold

```bash
npm run scaffold game signal-catch
```

`npm run scaffold arcade` is the same command. It writes a playable game that
already follows every rule below, and adds it to every registry DX Doctor
checks:

- **Engine:** `lib/signal-catch/index.ts`, a pure reducer with no React.
- **Session:** `components/signal-catch/useSignalCatchSession.ts`, and
  `SignalCatchSession.tsx` to host it.
- **Action map:** `components/signal-catch/actions.ts`.
- **Shared parts:** `components/signal-catch/parts/SignalCatchBoard.tsx`.
- **Views:** `DesktopView.tsx`, `TabletView.tsx` and `PhoneView.tsx` in
  `components/signal-catch/views/`.
- **Cabinet and route:** `components/arcade/SignalCatchClient.tsx`, plus the
  page and its OpenGraph card under `app/arcade/signal-catch/`.
- **Tests:** a session unit test and one phone and one tablet end-to-end spec.

The command prints the steps it cannot do for you: the lists that count every
game, the hub preview image and the social card copy. Pass `--dry-run` to see
the files first.

## Split the session from the views

The session owns the game. It holds the engine state, the loop, timers,
saves, scoring and the action map. A view only lays out and paints. It reads
session state and dispatches intents.

The session must not read the device: no `usePhone`, `useCabinetTouch`,
`useTouchDevice`, `matchMedia` or width media query. The cabinet decides
which view to show, and that choice is the only device branch. A view does
not read the device either. It lays out for the one device it was written for.

A scaffolded session is a store from `createArcadeStore`, exported by
`components/arcade/views`. Views read it through three hooks, so a frame does
not re-render React:

- `useSessionSelector` reads a slice of state for the HUD and cards.
- `useSessionDispatch` sends an intent.
- `useSessionFrame` paints the canvas once per frame.

Retro Labyrinth's session predates the store. `useRetroLabyrinthSession`
returns `{ view, intents, subscribe, onFrame }`, and
`RetroLabyrinthSessionProvider` puts it in context, but the shape is the same:
state out, intents in, and one paint call per frame.

Three more rules keep a view swap safe:

- The session holds no DOM nodes, canvas contexts or WebGL resources. A view
  creates them on mount and disposes of them on unmount.
- A view never imports another view.
- Anything two views share goes in `components/<game>/parts/`, and a part
  never imports a view. `npm run lint:boundaries` enforces both. Retro Labyrinth's `MazeCanvas`, `RoomHud` and
  `HexTerminal` are parts, so only the layout repeats between views.

### Hand the views to the cabinet

`defineGameViews` takes the session holder and one dynamic import per view, so
each view is its own chunk and a phone never downloads the desktop layout:

```tsx
const RETRO_LABYRINTH_VIEWS = defineGameViews({
  session: RetroLabyrinthCabinetSession,
  desktop: () =>
    import("@/components/retro-labyrinth/views/DesktopView").then((mod) => ({
      default: mod.DesktopView,
    })),
  tablet: () =>
    import("@/components/retro-labyrinth/views/TabletView").then((mod) => ({
      default: mod.TabletView,
    })),
  phone: "desktop",
});
```

Pass the result to `PlayCabinet` as `views`. A view that is not built yet
borrows another: Retro Labyrinth's phone still shows the desktop view, behind
the desktop-only gate, until its phone pass
([#2379](https://github.com/fderuiter/deruiter.dev/issues/2379)). The game's
entry in `ARCADE_REGISTRY` (`lib/arcade/registry.ts`) says the same thing:
`views: GATED_ON_PHONE`, with `epic` naming the issue that finishes the work.
Set a view to `"ready"` only when it meets its bar.

## Write the action map

Every key, gamepad button and touch key performs an action from one map,
written with `defineActions` from `@/lib/arcade`. The cabinet's control list,
the key hints and the field manual are all generated from it with
`controlsFromActions`, so they cannot drift from the bindings. Retro
Labyrinth's map is `LABYRINTH_ACTIONS` in `lib/retro-labyrinth/actions.ts`.
Before the move, its control list said "1-3" while the game read keys 1 to 5.

For each action, give:

- `keys`: physical positions (`KeyboardEvent.code`), such as `KeyW`.
- `label`: the words a touch key and the manual show.
- `context`: the input context it acts in. Retro Labyrinth's moves act only
  in `run`, while Enter answers the cards in `card`.
- `repeat`: set it for held moves.
- `gamepad`: optional buttons and stick axes.

Pass the map's controls to `PlayCabinet`'s `controls`, never an inline
list. DX Doctor checks this for every cabinet with views.

## Lay out each view on a stage

The tablet and phone views put the playfield on a stage from
`components/arcade/stage`:

- `TabletStage` and `PhoneStage` take the same slots: `hud`, `moveDock`, the
  playfield as `children`, `status`, `panel` and `actionDock`.
- The phone stage stacks the HUD, stage and thumb dock in portrait, and puts
  a thumb column on each side in landscape.
- `useStageFit` sizes a canvas to the space the stage leaves it.

Build the docks from the presets in `components/arcade/mobile/docks/`:
`DpadDock`, `StickDock`, `DragPad`, `ActionCluster`, `ActionStrip` and
`HoldButton`, laid out by `ActionDock` or the stage's dock slots. Each preset
takes action ids from the map, so a key's name is the action's label.

Phone views use the shared parts in `components/arcade/mobile/ui/` rather
than their own:

- `PhoneHud` for the stat row.
- `BottomSheet` for anything beside the stage.
- `CoachMarks` for the first-run sequence.
- `TouchTip` for help that would otherwise hide in a `title=` tooltip.

Retro Labyrinth's tablet view lays the touch cabinet out on `TabletStage`
([#2859](https://github.com/fderuiter/deruiter.dev/issues/2859)), with a
d-pad dock under the left thumb and the tools, EMP and Market under the
right.

Two touch-key details catch most new views:

- `TouchButton` always adds a 44 px minimum. A tablet key must be at least
  48 px, so give it a real width, such as `w-12`, or `w-full` inside a
  `minmax(3rem,auto)` grid track.
- A key's `aria-label` must contain its visible text, or axe reports
  `label-content-name-mismatch`.

## Meet the bar for each view

A game's epic closes only when all three bars in ADR 0062 hold. In short:

- **Desktop, 1024 to 2560 px.**
  - Behaviour is unchanged, checked by screenshots at 1024, 1280 and 1440.
  - The game is complete on the keyboard, and focus is always visible.
  - Hover is never the only way to find something.
- **Tablet.**
  - Both orientations work, a keyboard case hides the touch controls, and
    every key is at least 48 px.
  - Every size from iPad mini to iPad Pro 13 lays out cleanly.
  - A Split View pane narrower than 744 px gets the phone view.
- **Phone.**
  - The primary action is within thumb reach.
  - No text is under 12 px, and DX Doctor rejects `text-[9px]` to
    `text-[11px]` in a phone view.
  - A call or lock screen pauses and saves the run.
  - A coach sequence of three steps or fewer covers the first minute.
  - A full loop takes two to five minutes.
  - The game runs at 60 fps on a throttled mid-range phone.
  - Touch play is as fair as keyboard play.
  - A fresh playtest scores 9/10 or better.

For fairness, keep a `RunFairness` record in the session and call
`useRunFairness(fairness, "phone")` in each view, with that view's form
factor. Tuning reads the run's input, never its view, so narrowing a desktop window
to the phone view grants no touch assists. `lib/arcade/run-tags.ts` defines
the record.

### Make phone play fun

The fun guidelines in ADR 0062 apply to every phone view:

- Prefer tap, hold, drag and swipe. A d-pad is the last resort, and
  drag-and-drop becomes tap-to-pick, tap-to-place.
- Show the stage and one other thing. Put the rest in a bottom sheet, and
  pause real-time play while it is open.
- Use haptics and brief, event-driven effects, never continuous particle
  loops.
- Use big numbers, few words and labelled icons.
- Confirm destructive taps, and make hit areas larger than the art.

## Test it

- **Replay fixtures.** When you move an existing game, record its runs on
  `main` before the session seam changes any code. The seam must reproduce
  them exactly. See [record arcade replay fixtures](record-arcade-replay-fixtures.md).
- **Session unit tests.** Drive the session headlessly with intents and assert
  on state. No view, canvas or device is needed.
- **Device specs.** Playwright's iPad projects run files ending in
  `-tablet.spec.ts`, and its phone projects run files ending in
  `-phone.spec.ts`. The general projects run every spec, so skip a device test
  outside its projects, for example
  `test.skip(!/^iPad/.test(testInfo.project.name))`. Launch through
  `PlayCabinet`'s Launch Cabinet button before asserting on the canvas.
  `__tests__/e2e/helpers/retro-labyrinth-device.ts` shares one suite across
  the phone and tablet specs.
- **Layout checks.** Assert that keys are at least 48 px and inside the
  viewport, that nothing overflows horizontally, and that axe finds no
  blocking violations over the cabinet.
- **Real devices.** Finish with the
  [arcade phone device matrix](run-the-arcade-phone-device-matrix.md) and the
  [real-device check](run-an-arcade-real-device-check.md).

## What DX Doctor checks

`npm run quality` runs DX Doctor. Its `arcade-three-view-guardrails` check
(`lib/dx/three-view-guard.ts`) fails when:

- a game in the registry leaves out a view, or gates one without an `epic`;
- a view imports another view;
- a session, engine or view reads the device;
- a phone view sets text under 12 px;
- a cabinet with views takes an inline control list.

A file that still breaks a rule while its epic is open goes in
`THREE_VIEW_ALLOWLIST` with that epic's number. Retro Labyrinth's
`DesktopView.tsx` is listed until its phone view lands. Remove the row when
the work is done; the check reports a row whose file is clean.

`routes-arcade-registry-parity` fails when a registry route is missing from
the sitemap metadata, the public route registry or the Command Palette. The
scaffold adds all three.
