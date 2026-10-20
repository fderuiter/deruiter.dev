[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/arcade/progress/catalog](../README.md) / ArcadeCatalogEntry

# Interface: ArcadeCatalogEntry

One game's progress.

## Properties

### legacyScoreKeys?

> `readonly` `optional` **legacyScoreKeys?**: readonly `string`[]

Older names of `scoreKey`, folded in once as well.

***

### scoreKey?

> `readonly` `optional` **scoreKey?**: `string`

The key the game's best score was kept under before `arcade.core`.
Read once by the core slice's upgrade and left in place.

***

### scoreKeyIsSave?

> `readonly` `optional` **scoreKeyIsSave?**: `boolean`

True when `scoreKey` holds the game's own save or unlock list rather
than a bare best, so it is read but never written.

***

### slices

> `readonly` **slices**: readonly [`ArcadeSliceInfo`](../../slice/interfaces/ArcadeSliceInfo.md)[]

The game's own slices.

***

### slug

> `readonly` **slug**: `string`

The game's registry slug.
