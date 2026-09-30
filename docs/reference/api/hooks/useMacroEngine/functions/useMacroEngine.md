[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [hooks/useMacroEngine](../README.md) / useMacroEngine

# Function: useMacroEngine()

> **useMacroEngine**(): `object`

## Returns

`object`

### deleteMacro

> **deleteMacro**: (`id`) => `void`

#### Parameters

##### id

`string`

#### Returns

`void`

### executeMacro

> **executeMacro**: (`idOrMacro`) => `Promise`\<`boolean`\>

#### Parameters

##### idOrMacro

`string` \| \{ `createdAt`: `number`; `description?`: `string`; `id`: `string`; `name`: `string`; `steps`: `object`[]; `updatedAt`: `number`; \}

#### Returns

`Promise`\<`boolean`\>

### isRecording

> **isRecording**: `boolean`

### recordedSteps

> **recordedSteps**: `object`[]

### recordedStepsCount

> **recordedStepsCount**: `number`

### recordingName

> **recordingName**: `string`

### savedMacros

> **savedMacros**: `object`[]

### saveMacro

> **saveMacro**: (`name`, `description?`) => \{ `createdAt`: `number`; `description?`: `string`; `id`: `string`; `name`: `string`; `steps`: `object`[]; `updatedAt`: `number`; \} \| `null`

#### Parameters

##### name

`string`

##### description?

`string`

#### Returns

\{ `createdAt`: `number`; `description?`: `string`; `id`: `string`; `name`: `string`; `steps`: `object`[]; `updatedAt`: `number`; \} \| `null`

### startRecording

> **startRecording**: (`name?`) => `void`

#### Parameters

##### name?

`string`

#### Returns

`void`

### stopRecording

> **stopRecording**: () => `object`[]

#### Returns

`object`[]

### toggleRecording

> **toggleRecording**: (`name?`) => `void`

#### Parameters

##### name?

`string`

#### Returns

`void`
