[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/oss-credits/types](../README.md) / LicenseTextRef

# Interface: LicenseTextRef

One license text that applies to a package, by content hash.

## Properties

### from?

> `optional` **from?**: `string`

Parent `name@version` when kind is "inherited".

***

### holder?

> `optional` **holder?**: `string`

Copyright holder filled into the SPDX template when kind is "derived".

***

### kind

> **kind**: [`LicenseTextKind`](../type-aliases/LicenseTextKind.md)

***

### name

> **name**: `string`

File name in the tarball, parent package for inherited text, or the SPDX template id.

***

### sha

> **sha**: `string`

Key into `FactsStore.texts`.
