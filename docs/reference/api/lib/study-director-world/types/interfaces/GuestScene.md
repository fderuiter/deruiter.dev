[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / GuestScene

# Interface: GuestScene

A visitor waiting in the conference room, and what the player can do about it.

## Properties

### arrivesAt

> **arrivesAt**: `number`

Minutes after midnight at which they arrive and at which they leave.

***

### body

> **body**: `string`[]

What the player sees and hears, a line at a time.

***

### here

> **here**: `boolean`

Whether the player is in the conference room with them.

***

### id

> **id**: `"sponsorVisit"` \| `"vendorMeeting"`

***

### kicker

> **kicker**: `string`

***

### leavesAt

> **leavesAt**: `number`

***

### options

> **options**: [`GuestOption`](GuestOption.md)[]

***

### title

> **title**: `string`

***

### visitor

> **visitor**: `object`

#### name

> **name**: `string`

#### organisation

> **organisation**: `string`

#### role

> **role**: `string`
