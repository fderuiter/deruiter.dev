[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/database](../README.md) / DatabaseStageOptions

# Interface: DatabaseStageOptions

Inputs to [runDatabaseStage](../functions/runDatabaseStage.md).

## Properties

### allowProductionHost?

> `optional` **allowProductionHost?**: `string`

Exact host the person allows despite production markers.

***

### applySchema

> **applySchema**: `boolean`

Apply the schema without asking (non-interactive opt-in).

***

### databaseUrl

> **databaseUrl**: `string` \| `undefined`

***

### dryRun

> **dryRun**: `boolean`

***

### log

> **log**: (`line`) => `void`

#### Parameters

##### line

`string`

#### Returns

`void`

***

### nodeEnv?

> `optional` **nodeEnv?**: `string`

***

### profileAllowsMutation

> **profileAllowsMutation**: `boolean`

***

### prompter

> **prompter**: [`SetupPrompter`](../../prompts/interfaces/SetupPrompter.md)

***

### root

> **root**: `string`

***

### run

> **run**: [`CommandRunner`](../../providers/publish/type-aliases/CommandRunner.md)

***

### seed

> **seed**: `boolean`

Seed sample data without asking (non-interactive opt-in).

***

### skipSeed

> **skipSeed**: `boolean`

***

### vercelEnv?

> `optional` **vercelEnv?**: `string`
