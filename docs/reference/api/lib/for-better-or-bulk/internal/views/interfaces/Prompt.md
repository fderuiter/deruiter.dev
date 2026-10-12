[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/for-better-or-bulk/internal/views](../README.md) / Prompt

# Interface: Prompt

What one person's buttons would do right now.

## Properties

### floorDrop

> `readonly` **floorDrop**: [`FloorDropPrompt`](FloorDropPrompt.md) \| `null`

Set when the interact press would set the held item on open floor: it needs a hold.

***

### interact

> `readonly` **interact**: `string` \| `null`

What an interact press does, or why it does nothing; `interactLands`
says which. The cabinet puts the key in front of a press that lands only,
so a refusal never reads as an action (round 17).

***

### interactLands

> `readonly` **interactLands**: `boolean`

Whether an interact press lands, so `interact` names an action.

***

### status

> `readonly` **status**: `string`

***

### work

> `readonly` **work**: `string` \| `null`
