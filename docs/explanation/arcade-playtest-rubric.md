# Arcade Playtest Rubric

The ten-point rubric every arcade playtest is scored on, so that "9/10" means
the same thing to every reviewer. It was written on 2026-10-11 to make explicit
the criteria the three For Better or Bulk playtests used implicitly (7, 7.5 and
7.5 out of 10; issues #1927, #1931 and #1933). Those reports gave one holistic
score with BLOCKER, SHOULD-FIX and NICE findings, and every point they took off
maps to one line below. [ADR 0062](../../adr/0062-three-views-per-arcade-game.md)
uses it for each game's phone bar.

## How to score

Ten criteria, each worth 1 point. Score each 1 (meets it, verified in play), 0.5 (one should-fix gap, or verified only by reading code) or 0 (a blocker, or several gaps).

Two caps apply on top of the sum:
- **Blocker cap:** any crash, page error, stuck state or unwinnable path caps the game at 5.
- **Evidence cap:** a criterion that was only checked in code, not in play, is worth at most 0.5.

**10/10 means:** zero blockers, zero should-fix findings, every criterion verified in a real browser at the sizes of the view being scored, and a stranger could pick the game up cold, play it through, and want to play again. Nice-to-have ideas do not cost points.

Score each view on its own. The desktop view is played at 1024, 1280 and 1440. The tablet view is played on the iPad matrix in [ADR 0061](../../adr/0061-mobile-first-arcade.md). The phone view is played at the sizes in ADR 0062's phone bar, item 20.

## The ten criteria

1. **It works.** No crashes, console page errors, stuck states, soft-locks or unwinnable paths. Every flow (start, pause, resume, end, restart, replay) completes. *(FBB: clean in all three rounds.)*
2. **First minute.** A new player knows the goal and the first action without reading a manual: a clear start screen, a first prompt, and controls that match what the game says. *(FBB round 1: coach lines; leave option hiding its cost.)*
3. **Controls and focus.** Keys work on the first press without clicking the canvas; on-screen key hints match real behaviour; pause works from the keyboard; Tab and Shift+Tab never trap focus. *(FBB rounds 1-2: Shift+Tab label, Tab swap.)*
4. **Progress is legible.** Every meaningful action moves something on screen. Counters, stock, timers and objectives tell the truth. *(FBB round 3 blocker: half-filled basket shows 0/1; crates double-count stock.)*
5. **Feedback and juice.** Every action gets an immediate visible (and, where the game has sound, audible) response; state changes are announced. *(FBB round 1: shower and rush easy to miss.)*
6. **Fair challenge and agency.** You can win and lose; idling does not win; difficulty ramps; assists support the player rather than play for them. *(FBB rounds 1-2: the helper finished the day alone.)*
7. **Rhythm and events.** The shape of a run is readable: surprises are announced, schedules are in order, the next beat is clear. *(FBB round 3: header not in clock order; coach line stale.)*
8. **Payoff.** The end screen is clean, honest about what happened, explains the score, and gives a reason to replay (stars, best score, share). *(FBB rounds 2-3: receipt title clipped, helper credited as Fred.)*
9. **Voice and content.** Copy is funny or purposeful, kind about real people, and factually accurate; no typos or doubled words. *(FBB: "Tudor mansion", doubled labels, missing space, shoe joke.)*
10. **Fit and finish.** Layout holds at the view's sizes with nothing under the navbar; canvas is crisp on HiDPI; text meets WCAG AA contrast; reduced motion is respected; a game still behind the phone gate shows it on phones (ADR 0048). *(FBB: navbar covering the cabinet, receipt contrast, translucent Preferences.)*

## Worked example: For Better or Bulk, round 3 (7.5)

| # | Score | Why |
|---|---|---|
| 1 | 1 | No page errors or stuck states |
| 2 | 1 | Setup and coach clear |
| 3 | 1 | Keyboard fixes held |
| 4 | 0 | Basket shows 0/1 after one arrangement; crates double-count stock |
| 5 | 1 | Toasts for every event |
| 6 | 1 | Helper now a partner |
| 7 | 0.5 | Header out of clock order; coach line stale |
| 8 | 0.5 | Receipt title clipped; helper credited to Fred |
| 9 | 0.5 | Missing space, repeated petals line, "Tudor" via linked page |
| 10 | 1 | Nav and contrast fixed in the game |
| | **7.5** | |
