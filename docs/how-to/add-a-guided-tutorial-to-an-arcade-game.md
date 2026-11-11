# Add a guided tutorial to an arcade game

Every arcade game gets a guided tutorial that teaches by doing ([#2972](https://github.com/fderuiter/deruiter.dev/issues/2972)). The cabinet supplies the offer, the coach card, the Tutorial key and the device record. A game supplies a script and sends a signal when the player does what a practice step asks.

## 1. Write the script

Put the script in the game's own `lib/` module and export it from the module's `index.ts`. Laser Loon's is `lib/laser-loon/tutorial.ts`.

```ts
import type { TutorialScript } from "@/lib/arcade";

export const MY_GAME_TUTORIAL: TutorialScript = {
  gameId: "my-game", // the registry slug
  version: 1, // bump to offer a rewritten script again
  minutes: 2,
  steps: [
    { id: "welcome", chapter: "Basics", title: "…", body: "…" },
    {
      id: "jump",
      chapter: "Basics",
      title: "Jump",
      body: "One or two sentences: what to do and why it matters.",
      keys: "Space",
      touch: "Tap Jump",
      target: "controls",
      practice: { signal: "jump", count: 2 },
    },
  ],
};
```

Guidelines:

- One idea per step, in the order a new player needs them. Aim for about two minutes.
- At least half the steps are practice steps. Read steps cover only what cannot be practised safely.
- Give both `keys` and `touch` when the game plays on a touch cabinet.
- Use the Field Manual's names for things. The closing card points players to it for the full rules.
- `target` is the value of a `data-tutorial-target` attribute on the control the step is about. Without one, or when the control is not on screen, the card docks at the stage's top right.

## 2. Send signals and keep the run safe

Inside the cabinet, the game reads `useCabinetTutorial()` from `@/components/arcade/tutorial`:

- Call `signal("jump")` wherever the action really happens. A signal the current step is not waiting for is dropped without a render, so it is safe in a game loop.
- While `active` is true, keep the player safe and keep the practice out of saved progress. Laser Loon switches to its Sandbox, where nothing hurts the loon, and switches back when the tutorial ends. Monkey C Mayhem has no sandbox, so it clears the course of gaps and foes after every step of the run instead (`keepTutorialRunSafe` in `lib/garmin/tutorial.ts`).
- `stepId` names the current step if the game needs to stage something for it.
- `available` is true when the cabinet has a tutorial for the game, running or not. A game with its own first-run help can leave that to the cabinet's offer, so the two are not shown one over the other. Study Director does this, and its Controls button still opens its help.
- A game modal that covers the stage, such as Trial & Error's Inspect view, carries `data-tutorial-covers="true"`. The card steps aside while it is open, so the game shows the current step inside the modal (`components/trial-and-error/Tutorial.tsx`).

## 3. Hand it to the cabinet

Pass the script to `PlayCabinet` as `tutorial`. The cabinet then offers it once on first launch, adds a Tutorial key beside Setup, and adds "Replay the tutorial" to the Setup sheet.

A room with no cabinet, such as Meme Vault, runs the tutorial itself (`components/arcade/MemeVaultClient.tsx`):

- Call `useTutorialRun(script)` and render `TutorialOverlay` inside a `relative` container marked `data-arcade-cabinet`, which is the stage the card is placed in.
- Pass `launched` once that container is on screen, so the offer is not placed below the fold.
- Mark the element that takes focus during practice with `data-keyboard-boundary="true"` and `tabIndex={-1}`.
- Add a Tutorial button so the player can replay it, since there is no Setup sheet.
- Scroll each card into view below the site header once it is placed, because the room scrolls. `TutorialOverlay` also does this once per step, for a cabinet taller than the window.

## 4. Test it

- Move the game from `PENDING` to `SCRIPTS` in `__tests__/arcade-tutorial.test.ts`. That test checks the script and that every registry game is accounted for.
- Add the game to `__tests__/e2e/arcade-tutorial.spec.ts`, walking the tutorial with the game's own keys.
- Other browser specs start with every tutorial offer already answered (`TUTORIALS_ANSWERED` in `playwright.config.ts`), so they launch straight into the game.
- Take screenshots at 1024, 1280 and 1440, and at phone sizes if the game has a phone view.
- Tick the game's box on #2972 when the PR merges.
