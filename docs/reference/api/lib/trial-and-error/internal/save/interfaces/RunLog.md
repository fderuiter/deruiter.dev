[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/save](../README.md) / RunLog

# Interface: RunLog

A run as the save keeps it: where it started and every move since.

## Properties

### actId

> **actId**: `string`

The plan's id: the act played on its own, or the campaign.

***

### actions

> **actions**: [`LoggedAction`](../type-aliases/LoggedAction.md)[]

***

### dealing?

> `optional` **dealing?**: `"AUTHORED"`

AUTHORED for a run first saved before decks were shuffled (#2055): it
replays in written deal order. Absent means a shuffled run.

***

### decks?

> `optional` **decks?**: `"AUTHORED"`

AUTHORED for a run first saved before the run deck (#2082): every Blind
deals its authored deck and the shop stocks no shells. Absent means a
run with a run deck.

***

### origin?

> `optional` **origin?**: [`RunOrigin`](../../seed/type-aliases/RunOrigin.md)

How the seed was chosen; absent means a random run.

***

### seed

> **seed**: `string`

***

### shops?

> `optional` **shops?**: `"CLASSIC"`

CLASSIC for a run first saved before each act had its own shop (#2083):
every act stocks the shared catalog, drawn evenly. Absent means a shop
per act, drawn by rarity.

***

### sponsorId?

> `optional` **sponsorId?**: `"VIRTUAL_BIOTECH"` \| `"ONCOLOGY_PHARMA"` \| `"CARDIO_MEGA_TRIAL"` \| `"RARE_DISEASE_BIOTECH"`

The run's sponsor (#950). Absent means Virtual Biotech.

***

### stake?

> `optional` **stake?**: `number`

The run's stake (#950). Absent means stake 1.
