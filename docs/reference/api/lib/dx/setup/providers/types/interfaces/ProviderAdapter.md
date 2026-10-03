[**fderuiter-portfolio**](../../../../../../README.md)

***

[fderuiter-portfolio](../../../../../../modules.md) / [lib/dx/setup/providers/types](../README.md) / ProviderAdapter

# Interface: ProviderAdapter

The contract every integration implements. Adapters describe themselves;
the integrations stage does the prompting, writing and publishing, so no
adapter can write a file or call a deployment CLI on its own.

## Properties

### capability

> **capability**: [`ProviderCapability`](../type-aliases/ProviderCapability.md)

***

### degraded

> **degraded**: `string`

What the application does when this integration is skipped.

***

### destinations

> **destinations**: readonly [`PublishDestination`](../type-aliases/PublishDestination.md)[]

Destinations a person may choose to publish these keys to.

***

### docs

> **docs**: `string`

Repository documentation for the full dashboard journey.

***

### guidedSteps

> **guidedSteps**: readonly `string`[]

Dashboard steps for the guided path.

***

### id

> **id**: `string`

***

### keys

> **keys**: readonly [`ProviderKey`](ProviderKey.md)[]

***

### manualPath

> **manualPath**: `string`

What the advanced/manual path accepts instead of the named vendor.

***

### name

> **name**: `string`

***

### portability

> **portability**: [`ProviderPortability`](ProviderPortability.md)

## Methods

### probe()?

> `optional` **probe**(`context`): `Promise`\<[`ProbeResult`](ProbeResult.md)\>

Optional live check. Must be read-only, must not send email, write
data or create resources, and must report only status codes.

#### Parameters

##### context

[`ProbeContext`](ProbeContext.md)

#### Returns

`Promise`\<[`ProbeResult`](ProbeResult.md)\>

***

### validate()

> **validate**(`values`): [`ProbeResult`](ProbeResult.md)

Offline check of the values' shape. Never touches the network.

#### Parameters

##### values

`Readonly`\<`Record`\<`string`, `string`\>\>

#### Returns

[`ProbeResult`](ProbeResult.md)
