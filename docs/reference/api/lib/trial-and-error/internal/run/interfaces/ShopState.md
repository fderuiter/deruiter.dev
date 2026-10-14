[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / ShopState

# Interface: ShopState

One visit to the Procurement Shop, between a cleared Blind and the next.

## Properties

### archived?

> `optional` **archived?**: `true`

The Archive service was used this visit (#2082); it serves once.

***

### duplicated?

> `optional` **duplicated?**: `true`

The Duplicate service was used this visit (#2082); it serves once.

***

### opened

> **opened**: [`OpenedPack`](OpenedPack.md) \| `null`

The pack being opened, until every pick is made or it is skipped.

***

### packs

> **packs**: [`PackSlot`](PackSlot.md)[]

***

### purchases

> **purchases**: `number`

Items taken this visit, which keeps tray ids unique.

***

### rerolls

> **rerolls**: `number`

Rerolls bought this visit; the next one costs `rerollPrice(rerolls)`.

***

### slots

> **slots**: [`ShopSlot`](ShopSlot.md)[]
