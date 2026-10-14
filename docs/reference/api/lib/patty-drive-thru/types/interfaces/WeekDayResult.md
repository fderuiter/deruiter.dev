[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/patty-drive-thru/types](../README.md) / WeekDayResult

# Interface: WeekDayResult

What a finished day of the week leaves behind (#2086).

## Properties

### day

> `readonly` **day**: [`WeekdayId`](../type-aliases/WeekdayId.md)

***

### drinksDropped

> `readonly` **drinksDropped**: `number`

***

### endMeters

> `readonly` **endMeters**: [`StartMeters`](StartMeters.md)

The standing meters when the day ended, before any carry-over.

***

### expired

> `readonly` **expired**: `number`

***

### late

> `readonly` **late**: `number`

***

### netCents

> `readonly` **netCents**: `number`

***

### outcome

> `readonly` **outcome**: `"completed"` \| `"docked"` \| `"breakdown"`

***

### score

> `readonly` **score**: `number`

The day's `scoreShift` result.

***

### seed

> `readonly` **seed**: `string`

The seed the day was played with, derived from the week seed.

***

### served

> `readonly` **served**: `number`

***

### yells

> `readonly` **yells**: `number`
