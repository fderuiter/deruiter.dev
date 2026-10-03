[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / FloorDressing

# Interface: FloorDressing

How the whole floor looks for a study: the counts behind each room's
marks, the bin, the mood, and the conditions to hand the renderer and the
room description (#1691).

## Properties

### bin

> **bin**: [`BinState`](../type-aliases/BinState.md)

***

### crisisMeetings

> **crisisMeetings**: `number`

Crisis meetings booked into the conference room, 0 to 3.

***

### cups

> **cups**: `number`

Coffee cups gathering in your office, 1 to 6.

***

### fileOverflow

> **fileOverflow**: `number`

Folders spilling out of the regulatory filing cabinet, 0 to 4.

***

### hours

> **hours**: [`TeamHoursHint`](TeamHoursHint.md)[]

When each team member goes home.

***

### lunch

> **lunch**: `number`

Signs of lunch in the break room, 0 (deserted) to 3.

***

### mood

> **mood**: [`FloorMood`](../type-aliases/FloorMood.md)

***

### printouts

> **printouts**: `number`

Query printouts on the data manager's desk, 0 to 4.

***

### rooms

> **rooms**: `Record`\<[`RoomId`](../type-aliases/RoomId.md), [`RoomCondition`](RoomCondition.md)\>

***

### sponsorMail

> **sponsorMail**: `number`

Unanswered sponsor mail piled at reception, 0 to 5.

***

### travelPins

> **travelPins**: `number`

Pins on the monitor's travel board, one per site visit owed, 0 to 6.
