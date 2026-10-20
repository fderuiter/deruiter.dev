# Run an arcade real-device check

A ten-minute pass per game on real hardware, for the problems a desktop
browser's device emulation cannot show: the Safari toolbar collapsing, the
iOS silent switch, the notch and Dynamic Island, real thumb reach, and heat
and battery. Every game's phone view needs this pass before it leaves the
desktop-only gate ([ADR 0062](../../adr/0062-three-views-per-arcade-game.md),
phone bar item 20). Score the game on the
[arcade playtest rubric](../explanation/arcade-playtest-rubric.md) first; this
check confirms what the emulated playtest could not.

## Devices

- An iPhone running Safari, preferably one with a notch or Dynamic Island.
- An Android phone running Chrome.
- An iPad running Safari, for games with a tablet view.

Test against production or a deliberate preview. A game that is still behind
the gate can be opened with `?view=phone` once its registry entry allows
preview readiness.

## Checks

Run every check on every device. Write each one down as pass or fail with a
short note.

1. **Launch from a shared link.** Open the game's URL from a message or a
   QR code, not from the hub. The page loads, the cabinet launches, and the
   link preview looks right.
2. **Toolbar collapse.** Scroll and play until Safari's or Chrome's toolbar
   collapses and comes back. The stage neither jumps nor hides controls
   under the toolbar, and nothing redraws mid-move.
3. **Rotation.** Rotate mid-run in both directions. The run survives, the
   stage fits the new shape, and a portrait-only or landscape-only game says
   so clearly.
4. **Lock and resume.** Lock the screen mid-run for ten seconds, then unlock.
   The game paused when the screen locked and offers Resume, and the run is
   intact.
5. **Silent switch.** Play with the iPhone's silent switch on, then off.
   Sound follows the switch, and a game whose sound matters shows the
   silent-switch hint.
6. **Airplane mode after load.** Load the game, turn on airplane mode, and
   finish a run. Nothing breaks, scores still save locally, and any network
   call fails quietly.
7. **Add to Home Screen.** Install the site, then launch the game from the
   home-screen icon. It runs standalone with the safe areas respected, and
   no control sits under the notch or the home indicator.
8. **Heat and battery.** Play for five minutes. The phone does not get
   uncomfortably warm, and battery use looks in line with any other game.

## Record the result

Comment on the game's real-device issue (for example
[#2386](https://github.com/fderuiter/deruiter.dev/issues/2386) for Retro
Labyrinth) using this template:

```text
Real-device check, YYYY-MM-DD, commit <sha>

Device: iPhone 15 (iOS 18.x, Safari)
1 Shared link: pass
2 Toolbar collapse: pass
3 Rotation: fail - stage stays portrait-sized after rotating to landscape
4 Lock and resume: pass
5 Silent switch: pass
6 Airplane mode: pass
7 Home Screen: pass
8 Heat and battery: pass

Device: Pixel 7 (Android 15, Chrome)
...
```

Every fail becomes its own issue, linked from the comment. The game leaves
the gate only when every check passes on every device.
