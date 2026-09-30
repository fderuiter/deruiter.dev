[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/safe-storage](../README.md) / safeRawStorage

# Variable: safeRawStorage

> `const` **safeRawStorage**: [`RawStorage`](../type-aliases/RawStorage.md)

localStorage through this module, shaped like the Web Storage API for code
that takes an injectable storage dependency. Values are stored exactly as
given, without an envelope, and are never kept in memory, so reads see only
what localStorage holds. `setItem` throws when the value does not reach
localStorage, as `Storage.setItem` does, so callers keep their own handling.
