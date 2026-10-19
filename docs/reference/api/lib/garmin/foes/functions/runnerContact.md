[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/garmin/foes](../README.md) / runnerContact

# Function: runnerContact()

> **runnerContact**(`foe`, `runner`, `prevBottom`, `vy`): [`FoeContact`](../type-aliases/FoeContact.md)

Sorts out the runner touching a foe. Landing on any foe from above is a
stomp; walking into a resting shell kicks it; anything else that can hurt
does. `prevBottom` is the runner's feet a tick ago and `vy` its fall speed.

## Parameters

### foe

[`Foe`](../interfaces/Foe.md)

### runner

[`Box`](../interfaces/Box.md)

### prevBottom

`number`

### vy

`number`

## Returns

[`FoeContact`](../type-aliases/FoeContact.md)
