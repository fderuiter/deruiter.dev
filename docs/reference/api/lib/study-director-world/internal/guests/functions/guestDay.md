[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/guests](../README.md) / guestDay

# Function: guestDay()

> **guestDay**(`seed`, `id`, `setup?`): `number`

The study day a visitor comes on: fixed by the seed, so a replay meets
them on the same day. A short study (#2092) passes its setup, which
squeezes the visiting window onto its calendar.

## Parameters

### seed

`string`

### id

`"sponsorVisit"` \| `"vendorMeeting"`

### setup?

[`StudySetup`](../../../../study-director/types/interfaces/StudySetup.md)

## Returns

`number`
