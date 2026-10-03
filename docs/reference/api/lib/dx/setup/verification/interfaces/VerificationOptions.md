[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/verification](../README.md) / VerificationOptions

# Interface: VerificationOptions

Inputs to [runVerification](../functions/runVerification.md).

## Properties

### adapters?

> `optional` **adapters?**: readonly [`ProviderAdapter`](../../providers/types/interfaces/ProviderAdapter.md)[]

***

### dryRun

> **dryRun**: `boolean`

***

### fetch

> **fetch**: [`ProbeFetch`](../../providers/types/type-aliases/ProbeFetch.md)

***

### log

> **log**: (`line`) => `void`

#### Parameters

##### line

`string`

#### Returns

`void`

***

### probeTimeoutMs?

> `optional` **probeTimeoutMs?**: `number`

***

### prompter

> **prompter**: [`SetupPrompter`](../../prompts/interfaces/SetupPrompter.md)

***

### requested

> **requested**: readonly (`"quality"` \| `"static"` \| `"env"` \| `"prisma"` \| `"db"` \| `"providers"` \| `"doctor"`)[]

Levels the flags asked for. Interactive runs may add more by asking.

***

### root

> **root**: `string`

***

### run

> **run**: [`CommandRunner`](../../providers/publish/type-aliases/CommandRunner.md)

***

### values

> **values**: `Readonly`\<`Record`\<`string`, `string`\>\>
