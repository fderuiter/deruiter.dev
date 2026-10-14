[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/for-better-or-bulk/types](../README.md) / BestTimeRecord

# Interface: BestTimeRecord

A finished day's time set against the best kept before it.

## Properties

### best

> `readonly` **best**: `number`

The best after this day.

***

### isNew

> `readonly` **isNew**: `boolean`

Whether this day set the best.

***

### previous

> `readonly` **previous**: `number` \| `null`

The best before this day, or null when this was the first finish.

***

### time

> `readonly` **time**: `number`

This day's finish, in level seconds.
