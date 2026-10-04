[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/oss-credits/types](../README.md) / FactsDrift

# Interface: FactsDrift

## Properties

### brokenTexts

> **brokenTexts**: `string`[]

Text hashes referenced by a package but missing from the store, or stored but unreferenced.

***

### integrityChanged

> **integrityChanged**: `string`[]

Facts recorded against a different integrity hash than the lockfile now has.

***

### missing

> **missing**: `string`[]

In the lockfile, absent from the facts.

***

### stale

> **stale**: `string`[]

In the facts, absent from the lockfile.

***

### unresolved

> **unresolved**: `string`[]

Shipped packages with no resolved license text.
