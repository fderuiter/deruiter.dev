[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / Target

# Interface: Target

## Extends

- [`Tile`](Tile.md)

## Properties

### capacity

> `readonly` **capacity**: `number`

How many items it takes to fill; the basket takes two.

***

### category

> `readonly` **category**: [`Category`](../type-aliases/Category.md)

***

### filled

> `readonly` **filled**: readonly [`Item`](Item.md)[]

***

### filledBy

> `readonly` **filledBy**: readonly [`PlayerId`](../type-aliases/PlayerId.md)[]

***

### id

> `readonly` **id**: `string`

***

### kind

> `readonly` **kind**: [`TargetKind`](../type-aliases/TargetKind.md)

***

### simplifyProgress

> `readonly` **simplifyProgress**: `number`

Seconds of held work toward simplifying it.

***

### status

> `readonly` **status**: [`TargetStatus`](../type-aliases/TargetStatus.md)

***

### wants

> `readonly` **wants**: [`ItemKind`](../type-aliases/ItemKind.md)

The item this target accepts.

***

### x

> `readonly` **x**: `number`

#### Inherited from

[`Tile`](Tile.md).[`x`](Tile.md#x)

***

### y

> `readonly` **y**: `number`

#### Inherited from

[`Tile`](Tile.md).[`y`](Tile.md#y)
