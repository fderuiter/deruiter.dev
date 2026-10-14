[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/diary](../README.md) / getShiftEnding

# Function: getShiftEnding()

> **getShiftEnding**(`state`): `object`

How the shift ended, as a heading and one paragraph. A shift that is still
playing reads as if it closed now. Meter failures win when they happen;
a shift that reached close ends as the Company Man, a Silent Exit or a
Walkout, from its Solidarity and Dignity (#2087).

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

## Returns

`object`

### ending

> `readonly` **ending**: [`ShiftEndingId`](../../../types/type-aliases/ShiftEndingId.md)

### outcome

> `readonly` **outcome**: `"completed"` \| `"docked"` \| `"breakdown"`

### summary

> `readonly` **summary**: `string`

### title

> `readonly` **title**: `string`
