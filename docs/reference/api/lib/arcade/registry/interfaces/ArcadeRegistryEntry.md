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

### epic?

> `readonly` `optional` **epic?**: `number`

The game's three-view epic under #2350. A gated view must name it, so
every gate points at the work that lifts it (DX Doctor's three-view
guardrails, #2845).

***

### listing

> `readonly` **listing**: [`ArcadeListing`](../type-aliases/ArcadeListing.md)

***

### name

> `readonly` **name**: `string`

The game's short name in running text, such as the phone notice and the
phone picks. The full title stays in `ARCADE_GAMES_METADATA`.

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
