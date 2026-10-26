[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/tutorial](../README.md) / tutorialReducer

# Function: tutorialReducer()

> **tutorialReducer**(`script`, `state`, `action`): [`TutorialState`](../interfaces/TutorialState.md)

The tutorial state machine. Next on a practice step waits until the
practice is done; skipping the practice records it and moves on. Signals
count only toward the current step, so an action done early is simply
asked for again. Back goes to the previous step with its practice reset.
Next on the last step finishes the run; Exit leaves it.

## Parameters

### script

[`TutorialScript`](../interfaces/TutorialScript.md)

The game's tutorial.

### state

[`TutorialState`](../interfaces/TutorialState.md)

The run so far.

### action

[`TutorialAction`](../type-aliases/TutorialAction.md)

What happened.

## Returns

[`TutorialState`](../interfaces/TutorialState.md)

The next state; the same object when nothing changed.
