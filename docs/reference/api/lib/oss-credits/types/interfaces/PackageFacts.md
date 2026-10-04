[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/oss-credits/types](../README.md) / PackageFacts

# Interface: PackageFacts

What the registry says about one locked package version. A version's tarball
is immutable, so facts keyed by name@version and pinned to the lockfile
integrity hash are identical on every platform.

## Properties

### author

> **author**: `string` \| `null`

***

### homepage

> **homepage**: `string` \| `null`

***

### integrity

> **integrity**: `string`

The lockfile integrity hash these facts were read from.

***

### licenses

> **licenses**: [`LicenseTextRef`](LicenseTextRef.md)[]

Shipped packages only: every license text that applies.

***

### notices

> **notices**: `string`[]

Shipped packages only: NOTICE file texts (keys into `texts`).

***

### repository

> **repository**: `string` \| `null`
