[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/macro-engine](../README.md) / MacroEngine

# Class: MacroEngine

## Constructors

### Constructor

> **new MacroEngine**(): `MacroEngine`

#### Returns

`MacroEngine`

## Methods

### deleteMacro()

> **deleteMacro**(`id`): `void`

Deletes a saved macro by ID.

#### Parameters

##### id

`string`

#### Returns

`void`

***

### executeMacro()

> **executeMacro**(`idOrMacro`): `Promise`\<`boolean`\>

Executes a saved macro sequence step by step asynchronously on the main thread.
Incorporates a safety interlock threshold (max 20 steps) and re-entrancy protection.

#### Parameters

##### idOrMacro

`string` \| \{ `createdAt`: `number`; `description?`: `string`; `id`: `string`; `name`: `string`; `steps`: `object`[]; `updatedAt`: `number`; \}

#### Returns

`Promise`\<`boolean`\>

***

### getRecordingState()

> **getRecordingState**(): [`RecordingStateSnapshot`](../interfaces/RecordingStateSnapshot.md)

Returns details of current recording state (stable reference).

#### Returns

[`RecordingStateSnapshot`](../interfaces/RecordingStateSnapshot.md)

***

### getSavedMacros()

> **getSavedMacros**(): `object`[]

Retrieves and validates all persisted macros from local browser storage.
Ensures schema integrity, sanitizing or logging corrupted entries gracefully.
Returns a stable cached array reference when raw storage has not changed.

#### Returns

`object`[]

***

### isRecording()

> **isRecording**(): `boolean`

Returns whether recording is currently active.

#### Returns

`boolean`

***

### recordStep()

> **recordStep**(`stepPayload`): `void`

Records a step into the active recording sequence.

#### Parameters

##### stepPayload

[`MacroRecordStepPayload`](../../event-bus/interfaces/MacroRecordStepPayload.md)

#### Returns

`void`

***

### saveMacro()

> **saveMacro**(`name`, `description?`, `customSteps?`): \{ `createdAt`: `number`; `description?`: `string`; `id`: `string`; `name`: `string`; `steps`: `object`[]; `updatedAt`: `number`; \} \| `null`

Saves a named macro sequence to local storage (`portfolio_macros_v1`).

#### Parameters

##### name

`string`

##### description?

`string`

##### customSteps?

`object`[]

#### Returns

\{ `createdAt`: `number`; `description?`: `string`; `id`: `string`; `name`: `string`; `steps`: `object`[]; `updatedAt`: `number`; \} \| `null`

***

### startRecording()

> **startRecording**(`name?`): `void`

Starts a macro recording session.

#### Parameters

##### name?

`string`

#### Returns

`void`

***

### stopRecording()

> **stopRecording**(): `object`[]

Stops the active macro recording session.

#### Returns

`object`[]

***

### subscribe()

> **subscribe**(`listener`): () => `void`

Subscribes to changes in macro engine state.

#### Parameters

##### listener

[`MacroEngineListener`](../type-aliases/MacroEngineListener.md)

#### Returns

() => `void`

***

### toggleRecording()

> **toggleRecording**(`name?`): `void`

Toggles recording mode on or off.

#### Parameters

##### name?

`string`

#### Returns

`void`
