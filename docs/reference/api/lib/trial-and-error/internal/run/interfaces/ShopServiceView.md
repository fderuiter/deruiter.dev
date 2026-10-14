[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/trial-and-error/internal/run](../README.md) / ShopServiceView

# Interface: ShopServiceView

A shop service (#2082): what it costs, and why it cannot serve now.

## Properties

### cardRefusals

> **cardRefusals**: `Record`\<`string`, `string`\>

Why it cannot serve a particular card of the deck, by card id.

***

### price

> **price**: `number`

***

### refusal

> **refusal**: `string` \| `null`

Why it cannot serve any card now, or null.

***

### used

> **used**: `boolean`

It already served this visit.
