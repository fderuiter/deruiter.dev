[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / Item

# Interface: Item

## Properties

### count?

> `readonly` `optional` **count?**: `number`

Chairs only: how many chairs this carry holds (a stack of two, or one).
Absent means one.

***

### kind

> `readonly` **kind**: [`ItemKind`](../type-aliases/ItemKind.md)

***

### madeBy

> `readonly` **madeBy**: [`PlayerId`](../type-aliases/PlayerId.md) \| `null`

Who did the work that made this item, if anyone.

***

### source?

> `readonly` `optional` **source?**: [`SupplyKind`](../type-aliases/SupplyKind.md)

Burnt food only: the crate the batch was cooked from. Binning it restocks
one batch of that crate.
