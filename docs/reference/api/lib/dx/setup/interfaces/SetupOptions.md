[**fderuiter-portfolio**](../../../../README.md)

***

[fderuiter-portfolio](../../../../modules.md) / [lib/dx/setup](../README.md) / SetupOptions

# Interface: SetupOptions

Options for [runSetupWorkflow](../functions/runSetupWorkflow.md). Every collaborator is injectable.

## Properties

### acceptDefaults?

> `optional` **acceptDefaults?**: `boolean`

With `interactive: false`, accept each question's safe default (`--yes`).

***

### allowProductionDb?

> `optional` **allowProductionDb?**: `string`

Exact database host allowed despite production markers.

***

### applySchema?

> `optional` **applySchema?**: `boolean`

Apply the schema without asking (`--apply-schema`).

***

### dryRun?

> `optional` **dryRun?**: `boolean`

***

### fetch?

> `optional` **fetch?**: [`ProbeFetch`](../providers/types/type-aliases/ProbeFetch.md)

***

### forceEnv?

> `optional` **forceEnv?**: `boolean`

***

### integrations?

> `optional` **integrations?**: `string`[]

Adapter ids to configure, e.g. `["clerk"]`.

***

### interactive?

> `optional` **interactive?**: `boolean`

False runs without prompts. Kept for callers of the original API.

***

### log?

> `optional` **log?**: (`line`) => `void`

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

### processEnv?

> `optional` **processEnv?**: `Readonly`\<`Record`\<`string`, `string` \| `undefined`\>\>

The caller's process environment, consulted for database URL precedence
and production detection. The CLI passes `process.env`; omitted means none.

***

### profile?

> `optional` **profile?**: `"local-minimal"` \| `"hosted-development"` \| `"deployment"`

***

### prompter?

> `optional` **prompter?**: [`SetupPrompter`](../prompts/interfaces/SetupPrompter.md)

***

### publish?

> `optional` **publish?**: [`PublishDestination`](../providers/types/type-aliases/PublishDestination.md)

***

### publishEnvironment?

> `optional` **publishEnvironment?**: `string`

***

### resume?

> `optional` **resume?**: `boolean`

***

### run?

> `optional` **run?**: [`CommandRunner`](../providers/publish/type-aliases/CommandRunner.md)

***

### seed?

> `optional` **seed?**: `boolean`

Seed sample data without asking (`--seed`).

***

### shellStages?

> `optional` **shellStages?**: [`SetupStageRecord`](../types/interfaces/SetupStageRecord.md)[]

Stage results already reported by `scripts/setup.sh`.

***

### skipDb?

> `optional` **skipDb?**: `boolean`

***

### skipDbSeed?

> `optional` **skipDbSeed?**: `boolean`

***

### skipIntegrations?

> `optional` **skipIntegrations?**: `boolean`

***

### verify?

> `optional` **verify?**: (`"quality"` \| `"static"` \| `"env"` \| `"prisma"` \| `"db"` \| `"providers"` \| `"doctor"`)[]

***

### workspaceRoot?

> `optional` **workspaceRoot?**: `string`
