[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/study-director-world/types](../README.md) / InteractionOutcome

# Interface: InteractionOutcome

What happened when the player pressed E.

## Properties

### check?

> `optional` **check?**: `"drugAccountability"` \| `"consent"` \| `"eligibility"` \| `"temperatureLogs"` \| `"delegationLog"` \| `"sourceReview"` \| `"interviewCoordinator"` \| `"meetPi"`

A site check the UI can offer to do, with its cost (#1690).

***

### lines

> **lines**: `string`[]

***

### offer?

> `optional` **offer?**: `"goHome"`

Set when the interaction asks the UI to confirm going home.

***

### panel?

> `optional` **panel?**: [`WorldPanel`](../type-aliases/WorldPanel.md)

Set when the interaction opens a screen of its own (#1688, #1689).

***

### title

> **title**: `string`

***

### tone

> **tone**: `"neutral"` \| `"good"` \| `"bad"`

***

### travel?

> `optional` **travel?**: [`TravelOption`](TravelOption.md)[]

Places the car can drive to from here, offered beside going home.

***

### world

> **world**: [`WorldState`](WorldState.md)
