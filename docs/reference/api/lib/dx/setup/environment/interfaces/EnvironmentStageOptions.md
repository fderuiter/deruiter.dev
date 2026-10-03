[**fderuiter-portfolio**](../../../../../README.md)

***

[fderuiter-portfolio](../../../../../modules.md) / [lib/dx/setup/environment](../README.md) / EnvironmentStageOptions

# Interface: EnvironmentStageOptions

Inputs to [runEnvironmentStage](../functions/runEnvironmentStage.md).

## Properties

### dryRun

> **dryRun**: `boolean`

***

### forceEnv

> **forceEnv**: `boolean`

Replace `.env.local` with the template after backing it up.

***

### log

> **log**: (`line`) => `void`

#### Parameters

##### line

`string`

#### Returns

`void`

***

### now?

> `optional` **now?**: () => `Date`

#### Returns

`Date`

***

### profile

> **profile**: [`SetupProfile`](SetupProfile.md)

***

### prompter

> **prompter**: [`SetupPrompter`](../../prompts/interfaces/SetupPrompter.md)

***

### root

> **root**: `string`

***

### skipDb

> **skipDb**: `boolean`
