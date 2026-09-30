[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/study-director-world/internal/clock](../README.md) / spend

# Function: spend()

> **spend**(`world`, `kind`, `tiles?`): [`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `cost`: [`ActionCost`](../../../types/interfaces/ActionCost.md); \}\>

Spends the time, energy and focus an action costs. Work that runs past the
end of the office day is overtime: it costs double energy and is carried
home as fatigue. Refuses when the action would run past the hard stop or
the player has no energy left for it.

## Parameters

### world

[`WorldState`](../../../types/interfaces/WorldState.md)

### kind

`"document"` \| `"coffee"` \| `"walk"` \| `"talk"` \| `"readMail"` \| `"reviewEdc"` \| `"sponsorCall"` \| `"meeting"` \| `"amendment"`

### tiles?

`number` = `0`

## Returns

[`WorldResult`](../../../types/type-aliases/WorldResult.md)\<\{ `cost`: [`ActionCost`](../../../types/interfaces/ActionCost.md); \}\>
