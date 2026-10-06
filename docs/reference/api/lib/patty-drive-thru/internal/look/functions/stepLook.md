[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/look](../README.md) / stepLook

# Function: stepLook()

> **stepLook**(`look`, `input`, `dtSec`): [`LookState`](../../../types/interfaces/LookState.md)

Advances the head by `dtSec`. Turn keys and drags move the target, which
is held inside the booth's half turn either way; the head then eases toward
it. Non-finite input is ignored, and a non-positive step only applies the
drag.

## Parameters

### look

[`LookState`](../../../types/interfaces/LookState.md)

### input

[`LookInput`](../../../types/interfaces/LookInput.md)

### dtSec

`number`

## Returns

[`LookState`](../../../types/interfaces/LookState.md)
