[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/state](../README.md) / SetupState

# Interface: SetupState

Persisted progress. Holds stage outcomes only, never a value.

## Properties

### profile?

> `optional` **profile?**: `"local-minimal"` \| `"hosted-development"` \| `"deployment"`

***

### stages

> **stages**: `Partial`\<`Record`\<[`SetupStageId`](../../types/type-aliases/SetupStageId.md), \{ `at`: `string`; `detail`: `string`; `status`: [`SetupStageStatus`](../../types/type-aliases/SetupStageStatus.md); \}\>\>

***

### updatedAt?

> `optional` **updatedAt?**: `string`

***

### version

> **version**: `1`
