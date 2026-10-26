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
- While `active` is true, keep the player safe. Laser Loon switches to its Sandbox, where nothing hurts the loon, and switches back when the tutorial ends.
- `stepId` names the current step if the game needs to stage something for it.

## 3. Hand it to the cabinet

Pass the script to `PlayCabinet` as `tutorial`. The cabinet then offers it once on first launch, adds a Tutorial key beside Setup, and adds "Replay the tutorial" to the Setup sheet.

## 4. Test it

- Move the game from `PENDING` to `SCRIPTS` in `__tests__/arcade-tutorial.test.ts`. That test checks the script and that every registry game is accounted for.
- Add the game to `__tests__/e2e/arcade-tutorial.spec.ts`, walking the tutorial with the game's own keys.
- Other browser specs start with every tutorial offer already answered (`TUTORIALS_ANSWERED` in `playwright.config.ts`), so they launch straight into the game.
- Take screenshots at 1024, 1280 and 1440, and at phone sizes if the game has a phone view.
- Tick the game's box on #2972 when the PR merges.
