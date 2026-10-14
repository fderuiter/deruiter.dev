[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / createRunState

# Function: createRunState()

> **createRunState**(`authored`, `seed?`, `options?`, `dealing?`, `decks?`, `shops?`): [`RunState`](../interfaces/RunState.md)

A fresh run for `seed`: the first act's Boss drawn from its pool, and the
first Blind dealt with full CPU. The first Blind draws no crisis. A later
act draws its Boss as its study starts, so a campaign's first act plays
exactly as the act does on its own.

`options` chooses the sponsor and stake (#950); the defaults, Virtual
Biotech at stake 1, leave the run exactly as it plays without them. The
sponsor's starting kit is in the first table, and the choice is kept on
the run, which records only what differs from the defaults.

`dealing` is SHUFFLED unless a save from before #2055 is being replayed:
then AUTHORED deals every Blind in its written order, as it was recorded.
`decks` is AUTHORED for a save from before the run deck (#2082), and
`shops` is CLASSIC for a save from before each act had its own shop
(#2083), so every act stocks the shared catalog, drawn evenly.

## Parameters

### authored

[`RunPlan`](../type-aliases/RunPlan.md)

### seed?

`string` = `DEFAULT_SEED`

### options?

`Partial`\<[`RunChoice`](../../run-rules/interfaces/RunChoice.md)\> = `{}`

### dealing?

[`DeckDealing`](../../deal/type-aliases/DeckDealing.md) = `"SHUFFLED"`

### decks?

[`DeckLibrary`](../../run-deck/type-aliases/DeckLibrary.md) = `"RUN"`

### shops?

[`ShopLibrary`](../type-aliases/ShopLibrary.md) = `"PER_ACT"`

## Returns

[`RunState`](../interfaces/RunState.md)
