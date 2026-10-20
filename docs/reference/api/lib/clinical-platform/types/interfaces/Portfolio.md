[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/clinical-platform/types](../README.md) / Portfolio

# Interface: Portfolio

One synthetic sponsor portfolio: studies, their sites and vendors.

## Properties

### id

> `readonly` **id**: `string`

Stable portfolio id.

***

### seed

> `readonly` **seed**: `number`

Seed the portfolio was generated from.

***

### sites

> `readonly` **sites**: readonly [`Site`](Site.md)[]

Sites across all studies.

***

### sponsor

> `readonly` **sponsor**: `string`

Fictional sponsor name.

***

### studies

> `readonly` **studies**: readonly [`Study`](Study.md)[]

Studies in the portfolio.

***

### vendors

> `readonly` **vendors**: readonly [`Vendor`](Vendor.md)[]

Fictional vendors the studies use.
