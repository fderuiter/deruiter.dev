[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/patty-drive-thru/internal/diary](../README.md) / getRushCaption

# Function: getRushCaption()

> **getRushCaption**(`windows`, `rush`, `day?`): `string`

What Bo calls out when a rush starts (#2139): the dinner rush at close,
Wednesday's after-school rush, Fry Friday, or the lunch rush.

## Parameters

### windows

readonly [`RushWindow`](../../../types/type-aliases/RushWindow.md)[]

The shift's rushes, as `getRushWindows` returns them.

### rush

`number`

Which rush began, counting from 0.

### day?

[`WeekdayId`](../../../types/type-aliases/WeekdayId.md) \| `null`

The day of the week being worked, or null for a single shift.

## Returns

`string`
