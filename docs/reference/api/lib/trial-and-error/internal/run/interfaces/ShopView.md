[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / ShopView

# Interface: ShopView

Everything the shop screen renders.

## Properties

### archive

> **archive**: [`ShopServiceView`](ShopServiceView.md)

The Archive service (#2082).

***

### duplicate

> **duplicate**: [`ShopServiceView`](ShopServiceView.md)

The Duplicate service (#2082).

***

### items

> **items**: [`ShopItemView`](ShopItemView.md)[]

***

### opened

> **opened**: \{ `cards`: [`PackCardView`](PackCardView.md)[]; `choose`: `number`; `name`: `string`; `packId`: `string`; `picksLeft`: `number`; \} \| `null`

***

### packs

> **packs**: [`ShopItemView`](ShopItemView.md)[]

***

### purchases

> **purchases**: `number`

Purchases made this visit: a new pack opened is a new reveal.

***

### relicSellValues

> **relicSellValues**: `Record`\<`string`, `number`\>

What each relic in the rack sells for, by id.

***

### rerollPrice

> **rerollPrice**: `number`

***

### rerollRefusal

> **rerollRefusal**: `string` \| `null`
