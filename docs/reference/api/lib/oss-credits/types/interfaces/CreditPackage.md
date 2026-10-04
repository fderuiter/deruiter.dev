[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/oss-credits/types](../README.md) / CreditPackage

# Interface: CreditPackage

One credited package. Every field comes from the lockfile or the committed registry facts.

## Properties

### direct

> **direct**: `boolean`

True when listed in package.json dependencies or devDependencies.

***

### group?

> `optional` **group?**: `string`

Purpose group; set for direct dependencies only.

***

### homepage

> **homepage**: `string` \| `null`

***

### license

> **license**: `string`

SPDX expression exactly as the lockfile reports it, or "UNKNOWN".

***

### name

> **name**: `string`

***

### reason?

> `optional` **reason?**: `string`

One line on why the project uses it; set for direct dependencies only.

***

### repository

> **repository**: `string` \| `null`

***

### scope

> **scope**: [`CreditScope`](../type-aliases/CreditScope.md)

***

### version

> **version**: `string`
