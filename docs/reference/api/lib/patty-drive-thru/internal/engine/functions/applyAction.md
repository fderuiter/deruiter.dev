[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/engine](../README.md) / applyAction

# Function: applyAction()

> **applyAction**(`state`, `action`): [`StepResult`](../../../types/interfaces/StepResult.md)

Applies one player action at the current shift time. Actions that do not
fit the current state (an order that is gone, a node that is not on screen,
a wipe still cooling down) change nothing; mistakes the player could really
make (a wrong ring-up, bumping an unfinished order, pressing a button they
are too young to press) cost dignity.

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

### action

[`ShiftAction`](../../../types/type-aliases/ShiftAction.md)

## Returns

[`StepResult`](../../../types/interfaces/StepResult.md)
