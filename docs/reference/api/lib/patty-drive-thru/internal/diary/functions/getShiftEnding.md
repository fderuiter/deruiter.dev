[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/diary](../README.md) / getShiftEnding

# Function: getShiftEnding()

> **getShiftEnding**(`state`): `object`

How the shift ended, as a heading and one paragraph. A shift that is still
playing reads as if it closed now.

## Parameters

### state

[`ShiftState`](../../../types/interfaces/ShiftState.md)

## Returns

`object`

### outcome

> `readonly` **outcome**: `"completed"` \| `"docked"` \| `"breakdown"`

### summary

> `readonly` **summary**: `string`

### title

> `readonly` **title**: `string`
