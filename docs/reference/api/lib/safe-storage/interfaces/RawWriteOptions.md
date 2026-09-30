[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/safe-storage](../README.md) / RawWriteOptions

# Interface: RawWriteOptions

## Properties

### retainInMemory?

> `optional` **retainInMemory?**: `boolean`

Whether the value is also kept in the in-memory cache, so later reads in
the same page see it even when the write could not reach localStorage.
Defaults to true. Pass false for keys whose readers must see exactly what
localStorage holds and fall back to their default when a write fails, as
a direct localStorage call would. Such failed writes are expected by
the caller and are not logged.
