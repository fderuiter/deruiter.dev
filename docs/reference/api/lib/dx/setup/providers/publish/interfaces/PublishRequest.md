[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/dx/setup/providers/publish](../README.md) / PublishRequest

# Interface: PublishRequest

A request to publish named keys to one destination.

## Properties

### destination

> **destination**: [`PublishDestination`](../../types/type-aliases/PublishDestination.md)

***

### environment

> **environment**: `string`

Vercel environment, or a GitHub Actions environment name ("" = repository).

***

### keys

> **keys**: readonly `string`[]

***

### values

> **values**: `Readonly`\<`Record`\<`string`, `string`\>\>
