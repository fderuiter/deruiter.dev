[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/arcade/registry](../README.md) / ArcadeRegistryEntry

# Interface: ArcadeRegistryEntry

One game in the registry.

## Properties

### daily

> `readonly` **daily**: `boolean`

Takes part in the Arcade Daily (`lib/arcade/daily.ts`).

***

### listing

> `readonly` **listing**: [`ArcadeListing`](../type-aliases/ArcadeListing.md)

***

### phoneOrientation?

> `readonly` `optional` **phoneOrientation?**: [`ArcadePhoneOrientation`](../type-aliases/ArcadePhoneOrientation.md)

Set once the game has a dedicated phone view.

***

### route

> `readonly` **route**: `string`

***

### slug

> `readonly` **slug**: `string`

***

### views

> `readonly` **views**: `object`

#### desktop

> `readonly` **desktop**: [`ArcadeViewReadiness`](../type-aliases/ArcadeViewReadiness.md)

#### phone

> `readonly` **phone**: [`ArcadeViewReadiness`](../type-aliases/ArcadeViewReadiness.md)

#### tablet

> `readonly` **tablet**: [`ArcadeViewReadiness`](../type-aliases/ArcadeViewReadiness.md)
