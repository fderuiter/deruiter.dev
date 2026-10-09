[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / WorldState

# Interface: WorldState

The world on top of a study: the clock, the player's energy and focus,
and what the player has learned. The study itself stays authoritative
(ADR 0055) and runs in clock budget mode.

## Properties

### assignments?

> `optional` **assignments?**: [`Assignment`](Assignment.md)[]

Work handed to the team that is still landing, or waiting for review (#1689).

***

### bonds?

> `optional` **bonds?**: `Record`\<`string`, [`Bond`](Bond.md)\>

Each team member's working relationship with the player, by member id (#1688).

***

### calls?

> `optional` **calls?**: [`CallRecord`](CallRecord.md)[]

Phone calls today that were answered, ignored or sent to voicemail (#1689).

***

### coffees

> **coffees**: `number`

Cups of coffee today.

***

### energy

> **energy**: `number`

0 to 100. Spent by activity, restored overnight.

***

### fatigue

> **fatigue**: `number`

Energy the player could not recover overnight after working late.

***

### focus

> **focus**: `number`

0 to 100. Spent by demanding work, restored overnight and by coffee.

***

### known

> **known**: `string`[]

Facts the player has learned, by id.

***

### location

> **location**: `string`

Where the player is: a room id, or "home" overnight.

***

### map?

> `optional` **map?**: `string`

The map the player is on, by `WORLD_MAPS` id; absent means the CRO floor.

***

### meeting?

> `optional` **meeting?**: [`Meeting`](Meeting.md) \| `null`

A meeting in progress in the conference room, if any (#1689).

***

### minute

> **minute**: `number`

Minutes after midnight.

***

### observations?

> `optional` **observations?**: [`Observation`](Observation.md)[]

What the player has seen or been told, with when and from whom (#1688).

***

### overtime

> **overtime**: `number`

Minutes worked past the end of the office day, today.

***

### plan?

> `optional` **plan?**: [`DayPlan`](DayPlan.md)

Today's chosen priority and the interruptions already dealt with (#1837).

***

### player

> **player**: [`PlayerState`](PlayerState.md)

Where the player stands on the floor and which way they face.

***

### raised?

> `optional` **raised?**: `string`[]

Events a team member has already raised with the player in person (#1689).

***

### study

> **study**: [`StudyState`](../../../study-director/types/interfaces/StudyState.md)

***

### version

> **version**: `1`

***

### visit?

> `optional` **visit?**: [`SiteVisit`](SiteVisit.md) \| `null`

The site visit in progress, while the player is at a clinical site.

***

### walked

> **walked**: `number`

Tiles walked today; every fortieth costs a point of energy.
