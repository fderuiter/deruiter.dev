[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / RunDeckView

# Interface: RunDeckView

The run deck as the shop and Run Info show it (#2082).

## Properties

### added

> **added**: `number`

Cards the run added: shells bought and copies made.

***

### archived

> **archived**: `number`

Authored cards archived.

***

### blindName

> **blindName**: `string`

The Blind this deck deals: the one being played, or the next one.

***

### cards

> **cards**: [`RunDeckCardView`](../../run-deck/interfaces/RunDeckCardView.md)[]

The cards that Blind deals, in written order (the deal shuffles them).

***

### handSize

> **handSize**: `number`

The Blind's opening hand size: the deck never drops below it.

***

### size

> **size**: `number`

***

### waiting

> **waiting**: `number`

Added copies this Blind does not deal: their originals are not in it.
