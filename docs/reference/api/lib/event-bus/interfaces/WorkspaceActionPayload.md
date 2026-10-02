[**fderuiter-portfolio**](../../../README.md)

***

[fderuiter-portfolio](../../../modules.md) / [lib/event-bus](../README.md) / WorkspaceActionPayload

# Interface: WorkspaceActionPayload

Configuration for registering a workspace contextual command.

## Properties

### badge?

> `optional` **badge?**: `string`

***

### cliHandler?

> `optional` **cliHandler?**: (`args`) => `unknown`

#### Parameters

##### args

`Record`\<`string`, `unknown`\>

#### Returns

`unknown`

***

### cliName?

> `optional` **cliName?**: `string`

***

### description?

> `optional` **description?**: `string`

***

### flags?

> `optional` **flags?**: `Record`\<`string`, \{ `default?`: `unknown`; `description?`: `string`; `required?`: `boolean`; `type?`: `string`; \}\>

***

### handler?

> `optional` **handler?**: (`args?`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### args?

`Record`\<`string`, `unknown`\>

#### Returns

`void` \| `Promise`\<`void`\>

***

### id

> **id**: `string`

***

### parameters?

> `optional` **parameters?**: `Record`\<`string`, `unknown`\>

***

### payload?

> `optional` **payload?**: `unknown`

***

### responseSchema?

> `optional` **responseSchema?**: `unknown`

***

### schema?

> `optional` **schema?**: `unknown`

***

### shortcut?

> `optional` **shortcut?**: `string`

***

### subToolId

> **subToolId**: `string`

***

### subToolName

> **subToolName**: `string`

***

### tags?

> `optional` **tags?**: `string`[]

***

### title

> **title**: `string`
